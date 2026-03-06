import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useStreamStore } from '../store/streamStore';
import { useAudioMixer } from '../hooks/useAudioMixer';
import {
  Mic, Radio, Square, Loader2,
  Monitor, AlertCircle, Wifi, WifiOff, Image,
  Upload, LogOut, MicOff, ChevronDown, ChevronUp
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

  // Audio mixer for mixing mic and system audio
  const audioMixer = useAudioMixer({
    onLevelChange: (level) => {
      setAudioLevel(level);
      setAudioLevel2(Math.max(0, level + (Math.random() - 0.5) * 0.08));
    }
  });

  const {
    streamTitle, streamDescription, thumbnail, thumbnailPreview, useMic, useSystemAudio,
    selectedMicDevice, micDevices, wantsToRecord, connectionState, isStreaming,
    isStarting, streamDuration, codec, bitrate, iceState, error,
    setStreamTitle, setStreamDescription, setThumbnail, setThumbnailPreview, setUseMic,
    setUseSystemAudio, setSelectedMicDevice, setMicDevices, setWantsToRecord,
    setConnectionState, setIsStreaming, setIsStarting, setStreamDuration,
    setCodec, setBitrate, setIceState, setError, resetStream,
  } = store;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pubStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [showMicPicker, setShowMicPicker] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioLevel2, setAudioLevel2] = useState(0); // simulated R channel

  useEffect(() => { loadMicDevices(); }, []);

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
      if (!isStreaming) return;
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      const level = avg / 255;
      setAudioLevel(level);
      setAudioLevel2(Math.max(0, level + (Math.random() - 0.5) * 0.08));

      // Dark background with subtle grid
      ctx.fillStyle = '#060a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Draw spectrum bars
      const barCount = 80;
      const barW = (canvas.width / barCount) - 1.5;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
        const val = sum / step / 255;
        const barH = val * canvas.height * 0.9;
        const x = i * (barW + 1.5);
        const pct = i / barCount;

        // Color: green → amber → red at top
        const r = pct > 0.7 ? 239 : pct > 0.5 ? Math.round(34 + (245 - 34) * ((pct - 0.5) / 0.2)) : 34;
        const g = pct > 0.85 ? Math.round(197 - (197 * ((pct - 0.85) / 0.15))) : 197;
        const b = 94;

        // Gradient per bar
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barH);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0.4)`);

        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barH, barW, barH);

        // Peak cap
        ctx.fillStyle = `rgba(${r},${g},${b},1)`;
        ctx.fillRect(x, canvas.height - barH - 2, barW, 2);
      }
    };
    draw();
  }, [isStreaming]);

  const handleStartStream = useCallback(async () => {
    if (!streamTitle.trim()) { setError('Stream title required'); return; }
    if (!accessToken) { navigate('/login'); return; }

    setIsStarting(true);
    setError(null);
    setConnectionState('connecting');

    try {
      // Request audio sources based on user settings
      if (useMic) {
        const micSuccess = await audioMixer.requestMicAccess(selectedMicDevice || undefined);
        if (!micSuccess) {
          throw new Error('Failed to access microphone');
        }
      }

      if (useSystemAudio) {
        const systemSuccess = await audioMixer.requestSystemAudio();
        if (!systemSuccess) {
          // User may have cancelled - continue without system audio
          console.warn('System audio not available');
        }
      }

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

      // Use mixed stream from audio mixer
      const mixedStream = audioMixer.state.mixedStream;
      if (!mixedStream || mixedStream.getAudioTracks().length === 0) {
        throw new Error('No audio source available');
      }
      pubStreamRef.current = mixedStream;

      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        setIceState(s);
        if (s === 'connected') { setConnectionState('connected'); startStats(); }
        else if (s === 'failed' || s === 'disconnected') setConnectionState('failed');
      };

      mixedStream.getAudioTracks().forEach(t => pc.addTrack(t, mixedStream));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start stream');
      setConnectionState('failed');
      teardownStream();
    } finally {
      setIsStarting(false);
    }
  }, [streamTitle, streamDescription, thumbnail, accessToken, useMic, useSystemAudio, selectedMicDevice, navigate, streamDuration, audioMixer, setStreamDuration, setIceState, setError, setConnectionState, setIsStreaming, setIsStarting, setCodec]);

  const startStats = useCallback(() => {
    let lastBytes = 0, lastTs = 0;
    statsTimerRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      const stats = await pcRef.current.getStats();
      stats.forEach(r => {
        if (r.type === 'outbound-rtp' && r.kind === 'audio') {
          const now = r.timestamp, bytes = r.bytesSent;
          if (lastTs) { const dt = (Number(now) - lastTs) / 1000; setBitrate(Math.round(((bytes - lastBytes) * 8) / dt / 1000) + ' kbps'); }
          lastBytes = Number(bytes); lastTs = Number(now);
        }
      });
    }, 1500);
  }, [setBitrate]);

  const teardownStream = useCallback(() => {
    pcRef.current?.close(); pcRef.current = null;
    pubStreamRef.current?.getTracks().forEach(t => t.stop()); pubStreamRef.current = null;
    audioContextRef.current?.close(); audioContextRef.current = null;
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setAudioLevel(0); setAudioLevel2(0);
    // Stop audio mixer
    audioMixer.stopAll();
  }, [audioMixer]);

  const handleStopStream = useCallback(() => {
    teardownStream();
    setIsStreaming(false); setConnectionState('idle');
    setStreamDuration(0); setCodec('—'); setBitrate('—'); setIceState('—');
    resetStream();
  }, [teardownStream, setIsStreaming, setConnectionState, setStreamDuration, setCodec, setBitrate, setIceState, resetStream]);

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
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
            {user?.name || user?.email}
          </span>
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
              <ToggleRow
                icon={<div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor' }} />}
                label="Record Stream"
                checked={wantsToRecord}
                onChange={setWantsToRecord}
                disabled={isStreaming}
              />
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
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', fontFamily: 'monospace' }}>
          {isStreaming ? `${bitrate} • ${codec}` : 'WebRTC / Opus'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.12)', fontFamily: 'monospace' }}>
          v1.0.0
        </span>
      </div>
    </div>
  );
}