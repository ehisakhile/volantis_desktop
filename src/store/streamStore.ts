import { create } from 'zustand';

export interface StreamData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  status: 'idle' | 'connecting' | 'connected' | 'recording' | 'ended';
  started_at?: string;
  viewer_count: number;
  cf_webrtc_publish_url?: string;
}

interface StreamState {
  // Stream data
  currentStream: StreamData | null;
  
  // Stream settings
  streamTitle: string;
  streamDescription: string;
  thumbnail: File | null;
  thumbnailPreview: string | null;
  
  // Audio settings
  useMic: boolean;
  useSystemAudio: boolean;
  selectedMicDevice: string;
  micDevices: MediaDeviceInfo[];
  
  // Recording settings
  wantsToRecord: boolean;
  isRecording: boolean;
  recordingBlob: Blob | null;
  
  // Connection state
  connectionState: 'idle' | 'connecting' | 'connected' | 'failed';
  isStreaming: boolean;
  isStarting: boolean;
  
  // Stats
  streamDuration: number;
  codec: string;
  bitrate: string;
  iceState: string;
  
  // Error
  error: string | null;
  
  // Actions
  setCurrentStream: (stream: StreamData | null) => void;
  setStreamTitle: (title: string) => void;
  setStreamDescription: (description: string) => void;
  setThumbnail: (file: File | null) => void;
  setThumbnailPreview: (preview: string | null) => void;
  setUseMic: (useMic: boolean) => void;
  setUseSystemAudio: (useSystemAudio: boolean) => void;
  setSelectedMicDevice: (deviceId: string) => void;
  setMicDevices: (devices: MediaDeviceInfo[]) => void;
  setWantsToRecord: (wants: boolean) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingBlob: (blob: Blob | null) => void;
  setConnectionState: (state: 'idle' | 'connecting' | 'connected' | 'failed') => void;
  setIsStreaming: (streaming: boolean) => void;
  setIsStarting: (starting: boolean) => void;
  setStreamDuration: (duration: number) => void;
  setCodec: (codec: string) => void;
  setBitrate: (bitrate: string) => void;
  setIceState: (state: string) => void;
  setError: (error: string | null) => void;
  resetStream: () => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  // Initial state
  currentStream: null,
  streamTitle: '',
  streamDescription: '',
  thumbnail: null,
  thumbnailPreview: null,
  useMic: true,
  useSystemAudio: false,
  selectedMicDevice: '',
  micDevices: [],
  wantsToRecord: false,
  isRecording: false,
  recordingBlob: null,
  connectionState: 'idle',
  isStreaming: false,
  isStarting: false,
  streamDuration: 0,
  codec: '—',
  bitrate: '—',
  iceState: '—',
  error: null,

  // Actions
  setCurrentStream: (stream) => set({ currentStream: stream }),
  setStreamTitle: (title) => set({ streamTitle: title }),
  setStreamDescription: (description) => set({ streamDescription: description }),
  setThumbnail: (file) => set({ thumbnail: file }),
  setThumbnailPreview: (preview) => set({ thumbnailPreview: preview }),
  setUseMic: (useMic) => set({ useMic }),
  setUseSystemAudio: (useSystemAudio) => set({ useSystemAudio }),
  setSelectedMicDevice: (deviceId) => set({ selectedMicDevice: deviceId }),
  setMicDevices: (devices) => set({ micDevices: devices }),
  setWantsToRecord: (wants) => set({ wantsToRecord: wants }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingBlob: (blob) => set({ recordingBlob: blob }),
  setConnectionState: (state) => set({ connectionState: state }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setIsStarting: (starting) => set({ isStarting: starting }),
  setStreamDuration: (duration) => set({ streamDuration: duration }),
  setCodec: (codec) => set({ codec }),
  setBitrate: (bitrate) => set({ bitrate }),
  setIceState: (state) => set({ iceState: state }),
  setError: (error) => set({ error }),
  
  resetStream: () => set({
    currentStream: null,
    streamTitle: '',
    streamDescription: '',
    thumbnail: null,
    thumbnailPreview: null,
    useMic: true,
    useSystemAudio: false,
    selectedMicDevice: '',
    wantsToRecord: false,
    isRecording: false,
    recordingBlob: null,
    connectionState: 'idle',
    isStreaming: false,
    isStarting: false,
    streamDuration: 0,
    codec: '—',
    bitrate: '—',
    iceState: '—',
    error: null,
  }),
}));
