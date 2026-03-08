import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useStreamStore } from '../store/streamStore';
import { useAudioMixer } from '../hooks/useAudioMixer';
import { useStreamRecorder, formatRecordingDuration } from '../hooks/useStreamRecorder';
import {
  MixerEngine,
  createMixerEngine,
  captureMicSource,
  captureSystemSource,
} from '../lib/mixer-engine';
import { CreatorMixer, ChatPanel } from '../components/streaming';
import { RecordingPrompt } from '../components/recording/RecordingPrompt';
import {
  Mic, Radio, Square, Loader2,
  Monitor, AlertCircle, Wifi, WifiOff, Image,
  Upload, LogOut, MicOff, ChevronDown, ChevronUp,
  FolderOpen, Disc
} from 'lucide-react';

const API_URL = 'https://api-dev.volantislive.com';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// VU Meter segment colors
const getSegmentColor = (i: number, total: number, active: boolean): string => {
  if (!active) return 'rgba(255,255,255,0.05)';
  const pct = i / total;
  if (pct > 0.88) return '#ef4444';
  if (pct > 0.72) return '#f59e0b';
  return '#22c55e';
};

// Segmented VU Meter component
function VUMeter({ level, label, vertical = false }: { level: number; label?: string; vertical?: boolean }) {
  const segments = 32;
  const activeCount = Math.round(level * segments);

  if (vertical) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {label && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: 4 }}>
            {label}
          </span>
        )}
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1.5 }}>
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: 4,
                borderRadius: 1,
                background: getSegmentColor(i, segments, i < activeCount),
                boxShadow: i < activeCount && i / segments > 0.72 ? `0 0 4px ${getSegmentColor(i, segments, true)}` : 'none',
                transition: 'background 0.05s',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>{label}</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
            {Math.round(level * 100)}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 1.5 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 1,
              background: getSegmentColor(i, segments, i < activeCount),
              boxShadow: i < activeCount && i / segments > 0.72 ? `0 0 5px ${getSegmentColor(i, segments, true)}` : 'none',
              transition: 'background 0.04s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Stat row component
function StatRow({ label, value, mono = true, accent = false }: {
  label: string; value: string; mono?: boolean; accent?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{
        fontSize: 12,
        fontFamily: mono ? '"JetBrains Mono", "Fira Code", monospace' : 'inherit',
        color: accent ? '#22c55e' : 'rgba(255,255,255,0.8)',
        fontWeight: accent ? 600 : 400,
      }}>
        {value}
      </span>
    </div>
  );
}

// Toggle row
function ToggleRow({ icon, label, checked, onChange, disabled }: {
  icon: React.ReactNode; label: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px',
        background: checked ? 'rgba(34,197,94,0.07)' : 'rgba(0,0,0,0.25)',
        border: `1px solid ${checked ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color: checked ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>{icon}</div>
        <span style={{ fontSize: 12.5, color: checked ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
          {label}
        </span>
      </div>
      {/* LED toggle */}
      <div style={{
        width: 28, height: 15, borderRadius: 8,
        background: checked ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)',
        border: `1px solid ${checked ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.12)'}`,
        position: 'relative', transition: 'all 0.2s',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: checked ? 'calc(100% - 13px)' : 2,
          width: 9, height: 9, borderRadius: '50%',
          background: checked ? '#22c55e' : 'rgba(255,255,255,0.25)',
          boxShadow: checked ? '0 0 6px rgba(34,197,94,0.8)' : 'none',
          transition: 'all 0.2s',
        }} />
      </div>
    </div>
  );
}

// Section header
function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 8, marginBottom: 10,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 2, height: 12, background: 'rgba(56,189,248,0.7)', borderRadius: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

export function StreamPage() {
  const navigate = useNavigate();
  const { user, logout, accessToken } = useAuthStore();
  const store = useStreamStore();

  // Mixer Engine for audio mixing
  const mixerEngineRef = useRef<MixerEngine | null>(null);

  const {
    streamTitle, streamDescription, thumbnail, thumbnailPreview, useMic, useSystemAudio,
    selectedMicDevice, micDevices, connectionState, isStreaming,
    isStarting, streamDuration, codec, bitrate, iceState, error, currentStream,
    setStreamTitle, setStreamDescription, setThumbnail, setThumbnailPreview, setUseMic,
    setUseSystemAudio, setSelectedMicDevice, setMicDevices,
    setConnectionState, setIsStreaming, setIsStarting, setStreamDuration,
    setCodec, setBitrate, setIceState, setError, resetStream, setCurrentStream,
  } = store;

  // Audio mixer hook for volume controls
  const audioMixer = useAudioMixer();

  // Stream recorder hook for recording functionality
  const [recordingSaved, setRecordingSaved] = useState(false);
  const recorder = useStreamRecorder({
    onAutoUploadComplete: () => {
      checkForActiveStream();
      setRecordingSaved(true);
    },
    onRecordingSaved: (filePath, filename) => {
      console.log('Recording saved locally:', filePath, filename);
      setRecordingSaved(true);
    },
  });

  // Active stream detection
  const [existingActiveStream, setExistingActiveStream] = useState<{id: string; slug: string; title: string; description?: string; cf_webrtc_publish_url?: string; created_at: string} | null>(null);
  const [isCheckingActiveStream, setIsCheckingActiveStream] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [showStreamEndedModal, setShowStreamEndedModal] = useState(false);

  // Recording state
  const [showRecordingPrompt, setShowRecordingPrompt] = useState(false);
  
  // Debug: log when showRecordingPrompt changes
  const handleSetShowRecordingPrompt = (value: boolean | ((prev: boolean) => boolean)) => {
    setShowRecordingPrompt((prev) => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      console.log('[RecordingPrompt] setShowRecordingPrompt:', newValue);
      return newValue;
    });
  };

  const hasActiveStream = !!existingActiveStream && !isStreaming;

  // Handle recording prompt acceptance
  const handleAcceptRecording = (autoUpload: boolean) => {
    console.log('[Recording] handleAcceptRecording called, autoUpload:', autoUpload);
    if (autoUpload) {
      console.log('[Recording] Calling acceptRecordingWithAutoUpload');
      recorder.acceptRecordingWithAutoUpload();
    } else {
      console.log('[Recording] Calling acceptRecording');
      recorder.acceptRecording();
    }
    handleSetShowRecordingPrompt(false);
    // Start recording if stream is already active
    if (pubStreamRef.current && streamTitle) {
      console.log('[Recording] Starting recording immediately after accept');
      const slug = currentStream?.slug || streamTitle;
      recorder.startRecording(pubStreamRef.current, slug, streamTitle);
    } else {
      console.log('[Recording] No pubStreamRef.current or streamTitle, will start when stream begins');
    }
  };

  const handleDeclineRecording = () => {
    console.log('[Recording] handleDeclineRecording called');
    recorder.declineRecording();
    handleSetShowRecordingPrompt(false);
  };

  // Auto-start recording when stream starts (if user enabled recording)
  useEffect(() => {
    if (isStreaming && pubStreamRef.current && recorder.state.wantsToRecord === true && !recorder.state.isRecording) {
      const slug = currentStream?.slug || streamTitle;
      recorder.startRecording(pubStreamRef.current, slug, streamTitle);
    }
  }, [isStreaming, recorder.state.wantsToRecord, recorder.state.isRecording, currentStream?.slug, streamTitle]);

  // Toggle recording on/off
  const handleToggleRecording = () => {
    console.log('[Recording] Toggle clicked, current state:', {
      wantsToRecord: recorder.state.wantsToRecord,
      isRecording: recorder.state.isRecording,
      isStreaming,
      showRecordingPrompt,
    });
    
    if (recorder.state.wantsToRecord === true) {
      // Recording is enabled, prompt to disable or show current state
      if (recorder.state.isRecording) {
        console.log('[Recording] Already recording, do nothing');
        // Already recording, do nothing (user can stop manually when stream ends)
      } else {
        // Start recording now
        console.log('[Recording] Starting recording now');
        if (pubStreamRef.current) {
          const slug = currentStream?.slug || streamTitle;
          recorder.startRecording(pubStreamRef.current, slug, streamTitle);
        } else {
          console.warn('[Recording] No pubStreamRef.current, cannot start recording');
        }
      }
    } else if (recorder.state.wantsToRecord === false) {
      // User declined, prompt again
      console.log('[Recording] User previously declined, showing prompt again');
      handleSetShowRecordingPrompt(true);
    } else {
      // First time - show prompt
      console.log('[Recording] First time, showing prompt');
      handleSetShowRecordingPrompt(true);
    }
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pubStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Start Visualizer - must be defined before callbacks that use it
  const startVisualizer = useCallback(() => {
    if (!pubStreamRef.current || !canvasRef.current) return;
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(pubStreamRef.current);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return;
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.5, '#eab308');
        gradient.addColorStop(1, '#22c55e');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  }, []);

  // Start Stats - must be defined before callbacks that use it
  const startStats = useCallback(() => {
    let lastBytes = 0, lastTs = 0;
    statsTimerRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      const stats = await pcRef.current.getStats();
      stats.forEach(r => {
        if (r.type === 'outbound-rtp' && r.kind === 'audio') {
          const now = r.timestamp;
          const bytes = r.bytesSent;
          if (lastTs) {
            const dt = (Number(now) - lastTs) / 1000;
            const kbps = Math.round(((bytes - lastBytes) * 8) / dt / 1000);
            setBitrate(kbps + ' kbps');
          }
          lastBytes = Number(bytes);
          lastTs = Number(now);
        }
      });
    }, 1500);
  }, []);

  const [isOnline, setIsOnline] = useState(true);
  const [showMicPicker, setShowMicPicker] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioLevel2, setAudioLevel2] = useState(0); // simulated R channel

  useEffect(() => { loadMicDevices(); }, []);

  // Check for existing active streams on mount
  useEffect(() => {
    checkForActiveStream();
  }, []);

  // Check for active streams
  const checkForActiveStream = useCallback(async () => {
    if (!accessToken) return;
    
    setIsCheckingActiveStream(true);
    try {
      const response = await fetch(`${API_URL}/livestreams?limit=10&offset=0`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (response.ok) {
        const streams = await response.json();
        if (streams && streams.length > 0) {
          const activeStream = streams.find((s: { is_active: boolean; end_time: string | null }) => s.is_active === true && !s.end_time);
          if (activeStream) {
            console.log('Found existing active stream:', activeStream);
            setExistingActiveStream(activeStream);
            setStreamTitle(activeStream.title);
            setStreamDescription(activeStream.description || '');
            setShowResumePrompt(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to check for active streams:', err);
    } finally {
      setIsCheckingActiveStream(false);
    }
  }, [accessToken, setStreamTitle, setStreamDescription]);

  // Handle resume to existing stream
  const handleResumeStream = useCallback(async () => {
    if (!existingActiveStream) return;
    
    setShowResumePrompt(false);
    setIsStarting(true);
    setError(null);
    setConnectionState('connecting');

    try {
      // Create and initialize Mixer Engine
      const engine = createMixerEngine();
      mixerEngineRef.current = engine;

      // Capture audio based on user selection
      if (useMic) {
        const micStream = await captureMicSource(selectedMicDevice || undefined);
        engine.addChannel('mic', 'MIC', 'mic', micStream, selectedMicDevice || undefined);
      }
      
      if (useSystemAudio) {
        const systemStream = await captureSystemSource();
        engine.addChannel('system', 'SYSTEM', 'system', systemStream);
      }
      
      const outputStream = engine.outputStream;
      
      if (!outputStream || outputStream.getAudioTracks().length === 0) {
        throw new Error('No audio source available');
      }
      
      pubStreamRef.current = outputStream;

      // Start visualizer
      if (canvasRef.current) {
        startVisualizer();
      }

      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        setIceState(s);
        if (s === 'connected') { setConnectionState('connected'); startStats(); }
        else if (s === 'failed' || s === 'disconnected') setConnectionState('failed');
      };

      outputStream.getAudioTracks().forEach(t => pc.addTrack(t, outputStream));
      const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const t = setTimeout(resolve, 2000);
        pc.onicecandidate = e => { if (!e.candidate) { clearTimeout(t); resolve(); } };
      });

      const publishUrl = existingActiveStream.cf_webrtc_publish_url;
      if (!publishUrl) throw new Error('No publish URL available for reconnection');
      
      const res = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
        body: pc.localDescription!.sdp,
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      setCodec(answerSdp.includes('opus') ? 'Opus/48k' : 'Unknown');

      durationIntervalRef.current = setInterval(() => setStreamDuration(streamDuration + 1), 1000);
      setIsStreaming(true);
      setCurrentStream({
        ...existingActiveStream,
        status: 'connected',
        viewer_count: 0,
      });
      setExistingActiveStream(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume stream');
      setConnectionState('failed');
      teardownStream();
    } finally {
      setIsStarting(false);
    }
  }, [existingActiveStream, useMic, useSystemAudio, selectedMicDevice, streamDuration, startVisualizer, startStats, setIceState, setConnectionState, setCodec, setStreamDuration, setIsStreaming, setError, setCurrentStream]);

  // Handle start new stream (dismiss resume prompt)
  const handleStartNewStream = useCallback(() => {
    setShowResumePrompt(false);
    setExistingActiveStream(null);
    setStreamTitle('');
    setStreamDescription('');
    setThumbnail(null);
    setThumbnailPreview(null);
  }, [setStreamTitle, setStreamDescription, setThumbnail, setThumbnailPreview]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setIsOnline(navigator.onLine);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (isStreaming && pubStreamRef.current) startVisualizer();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isStreaming]);

  const loadMicDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      setMicDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedMicDevice) setSelectedMicDevice(audioInputs[0].deviceId);
    } catch {
      setError('Microphone access denied. Check permissions.');
    }
  }, [selectedMicDevice, setMicDevices, setSelectedMicDevice, setError]);

  const handleStartStream = useCallback(async () => {
    if (!streamTitle.trim()) { setError('Stream title required'); return; }
    if (!accessToken) { navigate('/login'); return; }

    // Check for active stream first
    if (existingActiveStream) {
      setShowResumePrompt(true);
      return;
    }

    // Validate audio source selection
    if (!useMic && !useSystemAudio) {
      setError('Please select at least one audio source (Microphone or System Audio)');
      return;
    }

    // Reset recording saved indicator when starting new stream
    setRecordingSaved(false);
    recorder.reset();

    setIsStarting(true);
    setError(null);
    setConnectionState('connecting');

    try {
      // Create and initialize Mixer Engine
      const engine = createMixerEngine();
      mixerEngineRef.current = engine;

      // Capture audio based on user selection and add to mixer
      let micStream: MediaStream | null = null;
      
      if (useMic) {
        micStream = await captureMicSource(selectedMicDevice || undefined);
        engine.addChannel('mic', 'MIC', 'mic', micStream, selectedMicDevice || undefined);
      }
      
      if (useSystemAudio) {
        const systemStream = await captureSystemSource();
        engine.addChannel('system', 'SYSTEM', 'system', systemStream);
      }
      
      // Get the mixed output stream for WebRTC
      const outputStream = engine.outputStream;
      
      if (!outputStream || outputStream.getAudioTracks().length === 0) {
        throw new Error('No audio source available');
      }
      
      pubStreamRef.current = outputStream;

      // Create FormData with stream details and thumbnail
      const formData = new FormData();
      formData.append('title', streamTitle);
      if (streamDescription) formData.append('description', streamDescription);
      if (thumbnail) formData.append('thumbnail', thumbnail);

      const response = await fetch(`${API_URL}/livestreams/start/audio`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      });
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        throw new Error(e.detail || 'Failed to start stream');
      }
      const streamData = await response.json();
      if (!streamData.cf_webrtc_publish_url) throw new Error('No publish URL returned');

      // Start visualizer with the mixed output
      if (canvasRef.current) {
        startVisualizer();
      }

      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        setIceState(s);
        if (s === 'connected') { setConnectionState('connected'); startStats(); }
        else if (s === 'failed' || s === 'disconnected') setConnectionState('failed');
      };

      outputStream.getAudioTracks().forEach(t => pc.addTrack(t, outputStream));
      const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const t = setTimeout(resolve, 2000);
        pc.onicecandidate = e => { if (!e.candidate) { clearTimeout(t); resolve(); } };
      });

      const res = await fetch(streamData.cf_webrtc_publish_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
        body: pc.localDescription!.sdp,
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      setCodec(answerSdp.includes('opus') ? 'Opus/48k' : 'Unknown');

      durationIntervalRef.current = setInterval(() => setStreamDuration(streamDuration + 1), 1000);
      setIsStreaming(true);
      setCurrentStream(streamData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start stream');
      setConnectionState('failed');
      teardownStream();
    } finally {
      setIsStarting(false);
    }
  }, [streamTitle, streamDescription, thumbnail, accessToken, useMic, useSystemAudio, selectedMicDevice, navigate, streamDuration, existingActiveStream, setStreamDuration, setIceState, setError, setConnectionState, setIsStreaming, setIsStarting, setCodec, setCurrentStream, recorder, setRecordingSaved]);

  const teardownStream = useCallback(() => {
    pcRef.current?.close(); pcRef.current = null;
    pubStreamRef.current?.getTracks().forEach(t => t.stop()); pubStreamRef.current = null;
    audioContextRef.current?.close(); audioContextRef.current = null;
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setAudioLevel(0); setAudioLevel2(0);
    // Destroy MixerEngine and release all audio resources
    if (mixerEngineRef.current) {
      mixerEngineRef.current.destroy();
      mixerEngineRef.current = null;
    }
  }, []);

  const handleStopStream = useCallback(async () => {
    // Check if recording was enabled before stopping
    const didRecord = recorder.state.wantsToRecord === true;
    
    // Stop recording if it's running (this will auto-download if enabled)
    if (recorder.state.isRecording) {
      recorder.stopRecording();
    }

    teardownStream();
    
    // Stop duration counter
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Call API to stop stream
    if (currentStream?.slug) {
      try {
        const response = await fetch(`${API_URL}/livestreams/${encodeURIComponent(currentStream.slug)}/stop`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          console.error('Failed to stop stream via API:', response.status);
        }
      } catch (err) {
        console.error('Failed to stop stream via API:', err);
      }
    }
    
    setIsStreaming(false);
    setStreamDuration(0);
    setCurrentStream(null);
    setCodec('—');
    setConnectionState('idle');
    setBitrate('—');
    setIceState('—');
    
    // If no recording was used, show success modal
    // No need to check for active streams or show resume option
    if (!didRecord) {
      setShowStreamEndedModal(true);
    } else {
      // If recording was used, check for any remaining active streams
      // The upload success modal will be shown after auto-upload completes
      checkForActiveStream();
    }
     
    resetStream();
  }, [currentStream, teardownStream, recorder, accessToken, setIsStreaming, setStreamDuration, setCurrentStream, setCodec, setConnectionState, setBitrate, setIceState, resetStream, checkForActiveStream]);

  const handleLogout = useCallback(() => {
    if (isStreaming) handleStopStream();
    logout(); navigate('/login');
  }, [logout, navigate, isStreaming, handleStopStream]);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnail(file);
      const reader = new FileReader();
      reader.onloadend = () => setThumbnailPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const liveColor = isStreaming ? '#ef4444' : isStarting ? '#f59e0b' : 'rgba(255,255,255,0.2)';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0e14',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"DM Sans", "SF Pro Text", system-ui, sans-serif',
      color: 'rgba(255,255,255,0.8)',
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      {/* Resume Stream Prompt Modal */}
      {showResumePrompt && existingActiveStream && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#141920', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%',
            border: '1px solid rgba(56,189,248,0.2)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#38bdf8' }}>
              Resume Active Stream
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              An active stream was found: <strong style={{ color: 'white' }}>{existingActiveStream.title}</strong>
              <br />
              Would you like to resume streaming to this session?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => handleResumeStream()}
                disabled={isStarting}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8, border: 'none',
                  background: isStarting ? 'rgba(56,189,248,0.5)' : '#38bdf8', color: 'white',
                  fontWeight: 600, fontSize: 14, cursor: isStarting ? 'not-allowed' : 'pointer',
                }}
              >
                {isStarting ? 'Connecting...' : 'Resume Stream'}
              </button>
              <button
                onClick={() => {
                  setShowResumePrompt(false);
                  setExistingActiveStream(null);
                }}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent', color: 'rgba(255,255,255,0.7)',
                  fontWeight: 500, fontSize: 14, cursor: 'pointer',
                }}
              >
                Start New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stream Ended Modal */}
      {showStreamEndedModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#141920', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%',
            border: '1px solid rgba(34,197,94,0.2)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#22c55e' }}>
              Stream Ended
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              Your stream has ended successfully. You can view your stream details in the dashboard.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowStreamEndedModal(false);
                  navigate('/dashboard');
                }}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8, border: 'none',
                  background: '#22c55e', color: 'white',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setShowStreamEndedModal(false);
                }}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent', color: 'rgba(255,255,255,0.7)',
                  fontWeight: 500, fontSize: 14, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0e14; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.15); }
        input:focus, textarea:focus { outline: none; border-color: rgba(56,189,248,0.4) !important; box-shadow: 0 0 0 2px rgba(14,165,233,0.1); }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>

      {/* Recording Prompt Modal */}
      <RecordingPrompt
        isOpen={showRecordingPrompt}
        onAccept={handleAcceptRecording}
        onDecline={handleDeclineRecording}
      />

      {/* Titlebar */}
      <div
        data-tauri-drag-region
        style={{
          height: 30,
          background: 'linear-gradient(180deg, #141920 0%, #0f151d 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingLeft: 12, paddingRight: 12, flexShrink: 0, cursor: 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 20, height: 20,
            background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
            borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: 12 }}>V</span>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em' }}>
            VOLANTISLIVE — BROADCAST STUDIO
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {isOnline
              ? <Wifi style={{ width: 12, height: 12, color: '#22c55e' }} />
              : <WifiOff style={{ width: 12, height: 12, color: '#ef4444' }} />}
            <span style={{ fontSize: 10, color: isOnline ? '#22c55e' : '#ef4444', letterSpacing: '0.05em' }}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          {/* Recording indicator */}
          {recorder.state.isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ef4444',
                animation: 'pulse 1s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 10, color: '#ef4444', letterSpacing: '0.05em' }}>
                REC ({formatRecordingDuration(recorder.state.recordingDuration)})
              </span>
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.5; }
                }
              `}</style>
            </div>
          )}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            {user?.name || user?.email}
          </span>
          <button
            onClick={() => navigate('/recordings')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'rgba(255,255,255,0.25)', display: 'flex' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            title="Recordings"
          >
            <FolderOpen style={{ width: 12, height: 12 }} />
          </button>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'rgba(255,255,255,0.25)', display: 'flex' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
          >
            <LogOut style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT PANEL — Stream setup */}
        <div style={{
          width: 260, flexShrink: 0,
          background: 'linear-gradient(180deg, #0d1219 0%, #0a0e14 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
          padding: '14px 12px',
          gap: 16,
        }}>
          {/* Stream info */}
          <div>
            <SectionHeader title="Stream Info" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', marginBottom: 4 }}>TITLE *</div>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={e => setStreamTitle(e.target.value)}
                  placeholder="Stream title"
                  disabled={isStreaming}
                  style={{
                    width: '100%', padding: '7px 10px',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 5, color: 'rgba(255,255,255,0.85)', fontSize: 12.5,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', marginBottom: 4 }}>DESCRIPTION</div>
                <textarea
                  value={streamDescription}
                  onChange={e => setStreamDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  disabled={isStreaming}
                  style={{
                    width: '100%', padding: '7px 10px', resize: 'none',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 5, color: 'rgba(255,255,255,0.85)', fontSize: 12.5,
                    transition: 'border-color 0.15s',
                  }}
                />
              </div>
              
              {/* Recording Toggle */}
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', marginBottom: 6 }}>RECORDING</div>
                <button
                  onClick={handleToggleRecording}
                  disabled={false}
                  title={isStreaming ? "Click to toggle recording during stream" : "Click to enable recording before going live"}
                  style={{
                    width: '100%', padding: '8px 10px',
                    background: recorder.state.wantsToRecord === true
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(0,0,0,0.4)',
                    border: `1px solid ${recorder.state.wantsToRecord === true ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 5,
                    color: recorder.state.wantsToRecord === true ? '#ef4444' : 'rgba(255,255,255,0.6)',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 0.15s',
                    opacity: 1,
                  }}
                >
                  <Disc
                    size={14}
                    style={{
                      color: recorder.state.wantsToRecord === true ? '#ef4444' : 'rgba(255,255,255,0.4)',
                      animation: recorder.state.isRecording ? 'spin 2s linear infinite' : 'none'
                    }}
                  />
                  {recorder.state.wantsToRecord === true
                    ? (recorder.state.autoUpload ? 'Auto-Upload' : 'Save Locally')
                    : 'Enable Recording'}
                </button>
                <style>{`
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            </div>
          </div>

          {/* Thumbnail */}
          <div>
            <SectionHeader title="Thumbnail" />
            <div
              style={{
                width: '100%', aspectRatio: '16/9',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, overflow: 'hidden', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {thumbnailPreview
                ? <img src={thumbnailPreview} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Image style={{ width: 24, height: 24, color: 'rgba(255,255,255,0.1)' }} />
              }
            </div>
            <label style={{ display: 'block', marginTop: 6, cursor: 'pointer' }}>
              <input type="file" accept="image/*" onChange={handleThumbnailChange} style={{ display: 'none' }} disabled={isStreaming} />
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5,
                fontSize: 11, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              >
                <Upload style={{ width: 11, height: 11 }} />
                UPLOAD IMAGE
              </div>
            </label>
          </div>

          {/* Audio sources */}
          <div>
            <SectionHeader title="Audio Sources" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <ToggleRow
                icon={useMic ? <Mic style={{ width: 14, height: 14 }} /> : <MicOff style={{ width: 14, height: 14 }} />}
                label="Microphone"
                checked={useMic}
                onChange={setUseMic}
                disabled={isStreaming}
              />
              {useMic && (
                <div style={{ paddingLeft: 8 }}>
                  {/* Mic device selector */}
                  <button
                    onClick={() => setShowMicPicker(!showMicPicker)}
                    disabled={isStreaming}
                    style={{
                      width: '100%', padding: '6px 8px',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 5, color: 'rgba(255,255,255,0.5)', fontSize: 11,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', marginBottom: 6,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      {micDevices.find(d => d.deviceId === selectedMicDevice)?.label || 'Default mic'}
                    </span>
                    {showMicPicker ? <ChevronUp style={{ width: 11, height: 11, flexShrink: 0 }} /> : <ChevronDown style={{ width: 11, height: 11, flexShrink: 0 }} />}
                  </button>
                  {showMicPicker && (
                    <div style={{
                      marginBottom: 6, background: '#0d1219',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden',
                    }}>
                      {micDevices.map(d => (
                        <button
                          key={d.deviceId}
                          onClick={() => { setSelectedMicDevice(d.deviceId); setShowMicPicker(false); }}
                          style={{
                            width: '100%', padding: '6px 10px', textAlign: 'left',
                            background: d.deviceId === selectedMicDevice ? 'rgba(56,189,248,0.08)' : 'none',
                            border: 'none', cursor: 'pointer', fontSize: 11,
                            color: d.deviceId === selectedMicDevice ? '#38bdf8' : 'rgba(255,255,255,0.4)',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Mic volume slider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', width: 45 }}>Volume</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={audioMixer.state.micVolume}
                      onChange={(e) => audioMixer.setMicVolume(parseFloat(e.target.value))}
                      disabled={isStreaming}
                      style={{ flex: 1, height: 4, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 30, textAlign: 'right' }}>
                      {Math.round(audioMixer.state.micVolume * 100)}%
                    </span>
                  </div>
                </div>
              )}
              <ToggleRow
                icon={<Monitor style={{ width: 14, height: 14 }} />}
                label="System Audio"
                checked={useSystemAudio}
                onChange={setUseSystemAudio}
                disabled={isStreaming}
              />
              {useSystemAudio && (
                <div style={{ paddingLeft: 8 }}>
                  {/* System audio source selector (window/app selection) */}
                  <button
                    onClick={() => audioMixer.requestSystemAudio()}
                    disabled={isStreaming}
                    style={{
                      width: '100%', padding: '6px 8px',
                      background: audioMixer.state.hasSystemAudioPermission ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.3)',
                      border: `1px solid ${audioMixer.state.hasSystemAudioPermission ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 5, color: audioMixer.state.hasSystemAudioPermission ? '#22c55e' : 'rgba(255,255,255,0.5)',
                      fontSize: 11, cursor: 'pointer', marginBottom: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      {audioMixer.state.hasSystemAudioPermission ? '✓ Window selected' : 'Select window/app...'}
                    </span>
                  </button>
                  {/* System audio volume slider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', width: 45 }}>Volume</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={audioMixer.state.systemAudioVolume}
                      onChange={(e) => audioMixer.setSystemAudioVolume(parseFloat(e.target.value))}
                      disabled={isStreaming}
                      style={{ flex: 1, height: 4, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 30, textAlign: 'right' }}>
                      {Math.round(audioMixer.state.systemAudioVolume * 100)}%
                    </span>
                  </div>
                </div>
              )}
              {/* Recording is handled by the main Recording Toggle button above */}
            </div>
          </div>
        </div>

        {/* CENTER — Visualizer + meters */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Error banner */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', background: 'rgba(239,68,68,0.1)',
              borderBottom: '1px solid rgba(239,68,68,0.2)', flexShrink: 0,
            }}>
              <AlertCircle style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#fca5a5', flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#f87171' }}>✕</button>
            </div>
          )}

          {/* Spectrum analyzer */}
          <div style={{ flex: 1, padding: '14px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader title="Spectrum Analyzer" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: liveColor, boxShadow: isStreaming ? `0 0 8px ${liveColor}` : 'none', animation: isStreaming ? 'pulse-dot 1.5s infinite' : 'none' }} />
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: liveColor, letterSpacing: '0.08em' }}>
                  {isStreaming ? 'LIVE' : isStarting ? 'CONNECTING' : 'STANDBY'}
                </span>
              </div>
            </div>

            {/* Canvas */}
            <div style={{
              flex: 1, minHeight: 120, maxHeight: 200,
              borderRadius: 6, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.06)',
              position: 'relative',
            }}>
              <canvas
                ref={canvasRef}
                width={1200}
                height={200}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
              {!isStreaming && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(6,10,15,0.7)',
                }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.15em' }}>NO SIGNAL</span>
                </div>
              )}
            </div>

            {/* VU Meters — horizontal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <VUMeter level={isStreaming ? audioLevel : 0} label="L" />
              <VUMeter level={isStreaming ? audioLevel2 : 0} label="R" />
            </div>

            {/* dB scale labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 2 }}>
              {['-60', '-48', '-36', '-24', '-12', '-6', '-3', '0'].map(db => (
                <span key={db} style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>{db}</span>
              ))}
            </div>
          </div>

          {/* Audio Mixer - Show when streaming */}
          {isStreaming && mixerEngineRef.current && (
            <div style={{ marginBottom: 10 }}>
              <CreatorMixer
                mixerEngine={mixerEngineRef.current}
                isStreaming={isStreaming}
                onAddChannel={(type) => {
                  // Channel is added internally by CreatorMixer with device selection
                  console.log('Channel added:', type);
                }}
                onRemoveChannel={(id) => {
                  if (mixerEngineRef.current) {
                    mixerEngineRef.current.removeChannel(id);
                  }
                }}
              />
            </div>
          )}

          {/* Go Live button */}
          <div style={{ padding: '10px 16px 14px' }}>
            <button
              onClick={isStreaming ? handleStopStream : handleStartStream}
              disabled={isStarting || (!isStreaming && !streamTitle.trim())}
              style={{
                width: '100%', padding: '11px',
                background: isStreaming
                  ? 'linear-gradient(180deg, #dc2626, #b91c1c)'
                  : isStarting
                  ? 'rgba(245,158,11,0.3)'
                  : 'linear-gradient(180deg, #16a34a, #15803d)',
                border: `1px solid ${isStreaming ? 'rgba(239,68,68,0.4)' : isStarting ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.4)'}`,
                borderRadius: 7, cursor: isStarting ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: 'white', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
                boxShadow: isStreaming
                  ? '0 0 20px rgba(239,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : isStarting ? 'none'
                  : '0 0 20px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
                transition: 'all 0.15s',
                opacity: !isStarting && !isStreaming && !streamTitle.trim() ? 0.4 : 1,
              }}
            >
              {isStarting ? (
                <><Loader2 style={{ width: 15, height: 15, animation: 'spin 0.7s linear infinite' }} />CONNECTING...</>
              ) : isStreaming ? (
                <><Square style={{ width: 13, height: 13 }} />END STREAM</>
              ) : (
                <><Radio style={{ width: 14, height: 14 }} />GO LIVE</>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL — Stats + channel strip */}
        <div style={{
          width: 200, flexShrink: 0,
          background: 'linear-gradient(180deg, #0d1219 0%, #0a0e14 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          padding: '14px 12px',
          display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto',
        }}>
          {/* Stream status */}
          <div>
            <SectionHeader title="Status" />
            <div>
              <StatRow label="State" value={isStarting ? 'Starting' : isStreaming ? 'Live' : 'Idle'} accent={isStreaming} />
              <StatRow label="Duration" value={isStreaming ? formatDuration(streamDuration) : '--:--:--'} />
              <StatRow label="Codec" value={codec} />
              <StatRow label="Bitrate" value={bitrate} />
              <StatRow label="ICE" value={iceState} />
            </div>
          </div>

          {/* Channel fader (visual, decorative) */}
          <div>
            <SectionHeader title="Channel" />
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', padding: '8px 0' }}>
              {/* L channel */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <VUMeter level={isStreaming ? audioLevel : 0} label="L" vertical />
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
                  {isStreaming ? `${(audioLevel * 100).toFixed(0).padStart(3, ' ')}` : ' --'}
                </span>
              </div>
              {/* R channel */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <VUMeter level={isStreaming ? audioLevel2 : 0} label="R" vertical />
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
                  {isStreaming ? `${(audioLevel2 * 100).toFixed(0).padStart(3, ' ')}` : ' --'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection */}
          <div>
            <SectionHeader title="Connection" />
            <div>
              <StatRow label="Network" value={isOnline ? 'Online' : 'Offline'} />
              <StatRow label="WebRTC" value={connectionState} />
            </div>
          </div>

          {/* Chat Panel - Show when streaming */}
          {isStreaming && currentStream && (
            <div>
              <ChatPanel
                streamSlug={currentStream.slug}
                authToken={accessToken || ''}
                isActive={isStreaming}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{
        height: 22,
        background: 'linear-gradient(180deg, #0d1219 0%, #0a0e14 100%)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', paddingLeft: 12, paddingRight: 12,
        flexShrink: 0, gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: isStreaming ? '#ef4444' : '#22c55e', boxShadow: `0 0 4px ${isStreaming ? '#ef4444' : '#22c55e'}`, animation: isStreaming ? 'pulse-dot 1s infinite' : 'none' }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            {isStreaming ? `ON AIR • ${formatDuration(streamDuration)}` : 'STANDBY'}
          </span>
        </div>
        
        {/* Recording indicator in status bar - prominent when recording */}
        {recorder.state.isRecording && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            padding: '2px 8px',
            background: 'rgba(239, 68, 68, 0.15)',
            borderRadius: 3,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            marginLeft: 4
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#ef4444',
              animation: 'blink 1s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 9, color: '#ef4444', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              REC • {formatRecordingDuration(recorder.state.recordingDuration)}
            </span>
          </div>
        )}
        
        {/* Recording saved indicator when not recording but has recording */}
        {!recorder.state.isRecording && (recorder.state.recordedFilename || recordingSaved) && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4, 
            padding: '2px 6px',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: 3,
            marginLeft: 4
          }}>
            <span style={{ fontSize: 9, color: '#22c55e', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              SAVED
            </span>
          </div>
        )}
        
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', fontFamily: 'monospace', marginLeft: 'auto' }}>
          {isStreaming ? `${bitrate} • ${codec}` : 'WebRTC / Opus'}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', fontFamily: 'monospace' }}>
          v1.0.0
        </span>
      </div>
    </div>
  );
}