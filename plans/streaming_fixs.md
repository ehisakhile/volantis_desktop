# Volantis Desktop App — Audio Mixer, Recording & Feature Parity Plan

## Agent Instructions

> **FIRST STEP (mandatory):** Before writing any code, explore the entire `/volantis-webapp` directory to understand existing implementations. Run:
> ```bash
> find /volantis-webapp -type f -name "*.ts" -o -name "*.tsx" | head -80
> ls /volantis-webapp/src
> ```
> All features described below already exist in the web app. Your job is to port them correctly to the Tauri 2.0 desktop app, using native Tauri APIs where appropriate. Do not reinvent — mirror and extend.

---

## Overview of Work

This plan covers three major feature areas:

1. **Audio Mixer** — multi-source audio mixing before and during streaming, including microphone device picker (external audio jacks), live channel mixer, and background music support.
2. **Recording** — native Tauri 2.0 recording implementation, standalone recorder mode (no stream), and post-stream upload + recordings library.
3. **Tauri Desktop Feature Parity** — ensuring everything that works in the web app also works correctly in the Tauri shell.

---

## Part 1: Audio Mixer

### 1.1 Pre-Stream Microphone Picker

**Goal:** Before the user starts streaming, show a device picker that enumerates all audio input devices from the OS (including external audio interfaces, USB mics, TRRS jacks, etc.).

**Reference files:**
- `useAudioMixer.ts` → `getAudioInputDevices()` already calls `navigator.mediaDevices.enumerateDevices()`
- `streamStore.ts` → already has `micDevices: MediaDeviceInfo[]`, `selectedMicDevice: string`, `setMicDevices`, `setSelectedMicDevice`
- Look at `/volantis-webapp` for the UI component that renders this picker in the web app and replicate it.

**Implementation steps:**

1. **Find the web app's mic picker component** — search `/volantis-webapp/src` for any component that calls `getAudioInputDevices` or renders a `<select>` / dropdown for mic sources. Copy its structure.

2. **Create `MicrophonePickerPanel` component** in the desktop app:
   - On mount, call `audioMixer.getAudioInputDevices()` and populate the list.
   - Re-enumerate on `navigator.mediaDevices.addEventListener('devicechange', ...)` so hot-plugged devices (USB audio, etc.) appear immediately.
   - Store the chosen `deviceId` in `streamStore.selectedMicDevice`.
   - Show device labels (e.g. "Focusrite Scarlett 2i2", "Built-in Microphone", "BlackHole 2ch").
   - Show a "Test" button that calls `requestMicAccess(deviceId)` and renders a live VU meter (use the `onLevelChange` callback already in `useAudioMixer`).

3. **Tauri-specific:** In Tauri 2.0, `navigator.mediaDevices` is available inside the WebView. However, on some platforms permissions need to be declared. Check `/volantis-webapp` for any permission handling and mirror it. In `tauri.conf.json` ensure `"mediaDevices"` permissions are enabled.

4. **Wire to stream start:** When the user clicks "Start Stream", pass `streamStore.selectedMicDevice` into `requestMicAccess(deviceId)`.

---

### 1.2 Live Audio Mixer (During Stream)

**Goal:** While streaming, show a mixer panel where the user can:
- See and control all active audio channels (mic, system audio, music files).
- Add new channels.
- Adjust per-channel volume with a fader/slider.
- Mute/unmute individual channels.
- Add background music from a local file.

**Reference files:**
- `useAudioMixer.ts` → already has `micGainRef`, `systemGainRef`, `setMicVolume`, `setSystemAudioVolume`, `muteMic`, `muteSystemAudio`, `connectSources`
- Look at `/volantis-webapp` for a `AudioMixerPanel` or similar component (search for "mixer", "channel", "fader").

**Implementation steps:**

1. **Extend `useAudioMixer` to support N dynamic channels:**

```typescript
// New interface to add
export interface AudioChannel {
  id: string;
  label: string;
  type: 'mic' | 'system' | 'file' | 'custom';
  stream: MediaStream | null;
  gainNode: GainNode | null;
  volume: number;
  muted: boolean;
  enabled: boolean;
}
```

Add to `useAudioMixer`:
- `channels: AudioChannel[]` state
- `addChannel(type, stream?, label?)` — creates a new gain node, connects to destination
- `removeChannel(id)` — disconnects and removes
- `setChannelVolume(id, volume)`
- `setChannelMuted(id, muted)`

2. **Background Music channel:**
   - Add `addMusicChannel(file: File)` that reads the File as ArrayBuffer, decodes via `audioContext.decodeAudioData`, creates a `BufferSourceNode`, connects it through a new `GainNode` to `destinationRef`.
   - Support loop toggle.
   - On stream end, stop the source node.

3. **`LiveMixerPanel` component:**
   - Renders one "channel strip" per `AudioChannel`.
   - Each strip: label, vertical fader (range input), mute button, VU meter.
   - "Add Channel" button: opens a sub-menu with options: "Add Microphone", "Add System Audio", "Add Music File".
   - "Add Music File" opens a file picker (`<input type="file" accept="audio/*">`); in Tauri, use `dialog.open()` from `@tauri-apps/plugin-dialog` instead for a native file picker.
   - Panel slides in from the right or bottom when streaming is active.

4. **VU meters:** Reuse the analyser pattern from `useAudioMixer.startLevelMonitoring` but per channel — create one `AnalyserNode` per channel, connect in parallel with the gain node.

5. **Persist mixer state** in `streamStore` so if the UI re-renders mid-stream, volumes are not reset.

---

### 1.3 System Audio Capture

**Reference:** `useAudioMixer.requestSystemAudio()` already uses `getDisplayMedia`. In Tauri on macOS/Windows, screen capture permissions must be granted. Check the web app for how it handles the prompt and mirror the UX (info modal before requesting, graceful fallback if denied).

---

## Part 2: Recording

### 2.1 Native Tauri 2.0 Recording Implementation

**Goal:** Use Tauri's Rust backend for recording so that:
- Recording is independent of the browser tab lifecycle.
- Files are written directly to disk (not held in memory as Blob).
- Recording survives window minimization, sleep, etc.

**Check web app first:** Search `/volantis-webapp` for any recording logic — look for `MediaRecorder`, `recordingBlob`, `wantsToRecord`. Understand the current browser-based implementation before replacing it.

**Tauri plugin to use:** `tauri-plugin-fs` for file writes + a custom Rust command for piping audio chunks. Alternatively, use `tauri-plugin-shell` to spawn `ffmpeg` (if bundled) for robust recording.

**Recommended approach — ffmpeg-based recording:**

1. **Bundle ffmpeg** with the app (or check if the web app already does this — look in `/volantis-webapp/src-tauri`).

2. **Rust command `start_recording`:**

```rust
// src-tauri/src/recording.rs
#[tauri::command]
pub async fn start_recording(output_path: String) -> Result<u32, String> {
    // Spawn ffmpeg process
    // Input: a named pipe or loopback audio device
    // Output: output_path (e.g. ~/Videos/Volantis/recording_2024-01-01.mp4)
    // Return: process PID for later stop
}

#[tauri::command]
pub async fn stop_recording(pid: u32) -> Result<String, String> {
    // Send SIGTERM / graceful stop to ffmpeg
    // Return: final file path
}

#[tauri::command]
pub async fn get_recordings() -> Result<Vec<RecordingMeta>, String> {
    // Scan the recordings directory
    // Return list with filename, size, duration, created_at
}
```

3. **JS side — `useNativeRecording` hook:**

```typescript
import { invoke } from '@tauri-apps/api/core';

export function useNativeRecording() {
  const startRecording = async (outputPath: string) => {
    const pid = await invoke<number>('start_recording', { outputPath });
    streamStore.setIsRecording(true);
    return pid;
  };

  const stopRecording = async (pid: number) => {
    const filePath = await invoke<string>('stop_recording', { pid });
    streamStore.setIsRecording(false);
    streamStore.setRecordingBlob(null); // native, no blob needed
    return filePath;
  };

  return { startRecording, stopRecording };
}
```

4. **Fallback:** If ffmpeg is not available, fall back to the browser `MediaRecorder` approach from the web app. Detect availability on app start.

5. **Recording output path:** Use `path.appDataDir()` or `path.videoDir()` from `@tauri-apps/api/path`. Let user configure output folder in settings (persist to `tauri-plugin-store`).

---

### 2.2 Standalone Recorder Mode (No Stream)

**Goal:** User can open the app and use it purely as a local recorder without streaming anywhere.

**Check web app:** Search `/volantis-webapp` for any "record only" mode, a toggle between "Stream", "Record", or "Stream + Record" modes.

**Implementation steps:**

1. **Add `appMode` to `streamStore`:**
```typescript
appMode: 'stream' | 'record' | 'stream_and_record'
setAppMode: (mode) => void
```

2. **Mode selector UI** on the pre-stream setup screen:
   - Three tabs or a segmented control: "Stream", "Record Only", "Stream + Record".
   - "Record Only" hides all stream destination/RTMP fields.
   - "Record Only" still shows the full audio mixer.

3. **In record-only mode:**
   - Clicking "Start" calls `startRecording()` (native Tauri) instead of the WebRTC/WHIP connection logic.
   - Show recording duration timer.
   - Show "Stop Recording" button.
   - On stop, show a "Recording saved" toast with the file path and an "Open in Finder/Explorer" button (use `shell.open()` from `@tauri-apps/plugin-shell`).

---

### 2.3 Simultaneous Stream + Record

**Goal:** When both streaming and recording, the audio/video is sent to both the WHIP endpoint and a local file simultaneously.

**Check web app:** Look for how `wantsToRecord` flag in `streamStore` is used in the stream start flow.

**Implementation steps:**

1. When `appMode === 'stream_and_record'`, after calling the WebRTC connect logic (mirror from web app), also call `startRecording()`.

2. Both share the same `mixedStream` from `useAudioMixer`.

3. On stream end (either user stops or connection drops), also call `stopRecording()`.

4. After stopping, trigger the upload flow (see 2.4).

---

### 2.4 Post-Stream Upload

**Goal:** After a stream/recording ends, prompt the user to upload the local recording to the platform.

**Check web app:** Search `/volantis-webapp` for any upload component, presigned URL logic, or S3/Cloudflare upload code.

**Implementation steps:**

1. On recording stop, show an "Upload Recording" modal/sheet with:
   - Preview: thumbnail (first frame), file size, duration.
   - Title field (pre-filled from `streamStore.streamTitle`).
   - Upload button.

2. **Upload logic:**
   - Request presigned upload URL from your API (mirror the web app's upload endpoint call).
   - Use `fetch` with the presigned URL and the local file (read via `tauri-plugin-fs`).
   - Show progress bar (use `XMLHttpRequest` for progress events or chunk the upload).

3. Store upload status in local state; show success/failure notification.

---

### 2.5 Recordings Library

**Goal:** A dedicated screen showing all past recordings with metadata.

**Check web app:** Search `/volantis-webapp` for a recordings list page, any `/recordings` route, or a `RecordingsList` component.

**Implementation steps:**

1. **`RecordingsPage` component:**
   - On mount, call `invoke('get_recordings')` to get local recordings.
   - Also fetch from API any cloud-uploaded recordings (mirror web app API call).
   - Merge and deduplicate by file name / upload ID.

2. **Recording card** shows: thumbnail (extracted from video file via ffmpeg if available), title, date, duration, file size, status (local / uploaded / uploading).

3. **Actions per recording:**
   - Play (open with system default player via `shell.open()`).
   - Upload (if not yet uploaded).
   - Delete (with confirmation dialog).
   - Open in Finder/Explorer.
   - Copy file path.

4. **Navigation:** Add "Recordings" to the desktop app sidebar/nav. Check the web app's routing structure and mirror the nav item placement.

---

## Part 3: Tauri Feature Parity Checklist

After implementing the above, go through the web app feature by feature and verify each works in the desktop app. Use this checklist:

### Agent instructions for parity check:
```bash
# List all pages/routes in the web app
find /volantis-webapp/src -name "*.tsx" | xargs grep -l "export default" | sort

# List all hooks
find /volantis-webapp/src -name "use*.ts" -o -name "use*.tsx" | sort

# List all stores
find /volantis-webapp/src -name "*store*" -o -name "*Store*" | sort

# Check for any Tauri-specific adapters already written
find /volantis-webapp/src-tauri -type f | sort
```

### Feature parity items:

| Feature | Web app location | Desktop status | Notes |
|---|---|---|---|
| Stream setup / title / description | Find in `/volantis-webapp` | Must match | Mirror form fields exactly |
| Thumbnail upload | Find in `/volantis-webapp` | Must match | Use native file picker in Tauri |
| WHIP/WebRTC stream connection | Find in `/volantis-webapp` | Must match | Same logic, no changes needed |
| Stream stats (bitrate, codec, ICE state) | `streamStore.ts` fields | Must match | Already in store |
| Mic device picker | `useAudioMixer.getAudioInputDevices` | **Implement** | See Part 1.1 |
| Live audio mixer | `useAudioMixer.ts` | **Implement** | See Part 1.2 |
| System audio capture | `useAudioMixer.requestSystemAudio` | Must match | Check permissions in Tauri |
| Background music | Not in web app | **New feature** | See Part 1.2 |
| Record only mode | Check web app | **Implement** | See Part 2.2 |
| Stream + record | `streamStore.wantsToRecord` | **Implement** | See Part 2.3 |
| Native recording | Browser MediaRecorder in web | **Replace** | See Part 2.1 |
| Post-stream upload | Check web app | **Implement** | See Part 2.4 |
| Recordings library | Check web app | **Implement** | See Part 2.5 |
| Auth / login | Check web app | Must match | Mirror auth flow |
| Stream list / dashboard | Check web app | Must match | Mirror API calls |
| Settings / preferences | Check web app | Must match | Add output folder setting |

---

## File Structure (Desktop App)

The agent should create/modify files in this structure (adapt to match the existing desktop app layout found in `/volantis-webapp/src-tauri` and the desktop app source):

```
src/
  components/
    audio/
      MicrophonePickerPanel.tsx      # Part 1.1
      LiveMixerPanel.tsx             # Part 1.2
      ChannelStrip.tsx               # Part 1.2 — individual channel UI
      VUMeter.tsx                    # Reusable level meter
    recording/
      RecordingControls.tsx          # Start/stop recording UI
      PostStreamUploadModal.tsx      # Part 2.4
      RecordingsPage.tsx             # Part 2.5
      RecordingCard.tsx              # Part 2.5
  hooks/
    useAudioMixer.ts                 # Extend existing (Part 1.2)
    useNativeRecording.ts            # Part 2.1
    useRecordingsLibrary.ts          # Part 2.5
  stores/
    streamStore.ts                   # Extend with appMode, channels
src-tauri/
  src/
    recording.rs                     # Rust commands (Part 2.1)
    lib.rs                           # Register new commands
  Cargo.toml                         # Add any new dependencies
```

---

## Key Technical Decisions

### Why native Tauri recording over browser MediaRecorder:
- `MediaRecorder` holds everything in RAM until the recording ends — problematic for long streams.
- Tauri + ffmpeg writes directly to disk in real-time.
- Native recording survives WebView crashes/reloads.
- Better codec support (H.264, AAC) vs browser's WebM/Opus default.

### Audio routing for native recording:
- The web audio `MediaStreamAudioDestinationNode` produces a `MediaStream`.
- To route this into a Tauri/ffmpeg recording: either (a) use browser `MediaRecorder` as a relay that posts chunks to a Tauri command, or (b) use a virtual audio device (BlackHole on macOS, VB-Audio on Windows) as an intermediate — the web audio graph outputs to it, ffmpeg reads from it. Option (a) is simpler to implement first.

### Tauri 2.0 permissions needed:
Add to `capabilities/default.json` in `src-tauri`:
```json
{
  "permissions": [
    "fs:allow-write",
    "fs:allow-read",
    "dialog:allow-open",
    "dialog:allow-save",
    "shell:allow-open",
    "path:allow-app-data-dir",
    "path:allow-video-dir"
  ]
}
```

---

## Implementation Order (Suggested)

1. Read the entire `/volantis-webapp` codebase first (non-negotiable).
2. Implement `MicrophonePickerPanel` + wire to stream start (quick win, foundational).
3. Extend `useAudioMixer` with dynamic channels.
4. Build `LiveMixerPanel` + `ChannelStrip`.
5. Set up Rust recording commands + `useNativeRecording` hook.
6. Add record-only mode + mode selector UI.
7. Wire stream+record simultaneous flow.
8. Build `RecordingsPage` + `RecordingCard`.
9. Implement post-stream upload modal.
10. Full parity audit against the web app checklist above.

---

## Notes for the Agent

- **Always look at the web app first.** If a component or hook already exists in `/volantis-webapp`, copy its logic and adapt for Tauri — do not rewrite from scratch.
- **Keep `streamStore.ts` as the single source of truth.** Add new fields there, do not create parallel stores.
- **The `useAudioMixer` hook is already well-structured** — extend it rather than replacing it.
- **Test on macOS and Windows** — audio device APIs behave differently. The mic device enumeration returns empty labels until `getUserMedia` has been called at least once (browser security policy). Handle this by calling `getUserMedia` with no specific device first, then re-enumerating.
- **For the VU meter**, the analyser pattern in `useAudioMixer.startLevelMonitoring` is the right approach — just replicate it per channel.