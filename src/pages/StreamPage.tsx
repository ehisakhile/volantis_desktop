import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useStreamStore } from '../store/streamStore';
import {
  Mic,
  Radio,
  Square,
  Settings,
  Signal,
  SignalHigh,
  Loader2,
  Monitor,
  AlertCircle,
  Volume2,
  Wifi,
  WifiOff,
  Image,
  Upload,
  LogOut,
  MicOff,
  VolumeX
} from 'lucide-react';

// API URL - in production this would be from environment
const API_URL = 'https://api.volantislive.com';

// ICE Configuration for WebRTC
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

// Format duration as HH:MM:SS
const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function StreamPage() {
  const navigate = useNavigate();
  const { user, logout, accessToken } = useAuthStore();
  const store = useStreamStore();
  
  const {
    streamTitle,
    streamDescription,
    thumbnailPreview,
    useMic,
    useSystemAudio,
    selectedMicDevice,
    micDevices,
    wantsToRecord,
    connectionState,
    isStreaming,
    isStarting,
    streamDuration,
    codec,
    bitrate,
    iceState,
    error,
    
    setStreamTitle,
    setStreamDescription,
    setThumbnailPreview,
    setUseMic,
    setUseSystemAudio,
    setSelectedMicDevice,
    setMicDevices,
    setWantsToRecord,
    setConnectionState,
    setIsStreaming,
    setIsStarting,
    setStreamDuration,
    setCodec,
    setBitrate,
    setIceState,
    setError,
    resetStream,
  } = store;

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pubStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Network status
  const [isOnline, setIsOnline] = useState(true);
  const [showMicPicker, setShowMicPicker] = useState(false);

  // Audio level for visualizer
  const [audioLevel, setAudioLevel] = useState(0);

  // Load microphone devices on mount
  useEffect(() => {
    loadMicDevices();
  }, []);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Audio visualizer
  useEffect(() => {
    if (isStreaming && pubStreamRef.current) {
      startVisualizer();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isStreaming]);

  const loadMicDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      setMicDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedMicDevice) {
        setSelectedMicDevice(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to load mic devices:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  }, [selectedMicDevice, setMicDevices, setSelectedMicDevice, setError]);

  const startVisualizer = useCallback(() => {
    if (!pubStreamRef.current || !canvasRef.current) return;

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    
    const source = audioContext.createMediaStreamSource(pubStreamRef.current);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isStreaming) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Calculate average level
      const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      setAudioLevel(average / 255);

      // Clear canvas
      ctx.fillStyle = '#1e2b75';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#00b894');
        gradient.addColorStop(1, '#00e5a0');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }, [isStreaming]);

  const handleStartStream = useCallback(async () => {
    if (!streamTitle.trim()) {
      setError('Please enter a stream title');
      return;
    }

    if (!accessToken) {
      setError('Please login first');
      navigate('/login');
      return;
    }

    setIsStarting(true);
    setError(null);
    setConnectionState('connecting');

    try {
      // Step 1: Start audio stream via API
      const response = await fetch(`${API_URL}/livestreams/start-audio-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: streamTitle,
          description: streamDescription || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to start stream');
      }

      const streamData = await response.json();

      if (!streamData.cf_webrtc_publish_url) {
        throw new Error('No publish URL returned from API');
      }

      // Step 2: Get user media (microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedMicDevice ? { exact: selectedMicDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      
      pubStreamRef.current = stream;

      // Step 3: Create WebRTC connection
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        setIceState(state);
        console.log(`Publish ICE → ${state}`);
        
        if (state === 'connected') {
          setConnectionState('connected');
          startStats();
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionState('failed');
        }
      };

      // Add audio track
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });

      // Prefer Opus codec
      const sdpWithOpus = offer.sdp?.replace(
        /(a=rtpmap:\d+)\s+(\w+)\//g,
        '$1 opus/48000/'
      ) || offer.sdp;
      
      await pc.setLocalDescription({ type: offer.type, sdp: sdpWithOpus });

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timeout = setTimeout(() => resolve(), 2000);
        pc.onicecandidate = (event) => {
          if (!event.candidate) {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      // Send offer to server (WHIP protocol)
      const res = await fetch(streamData.cf_webrtc_publish_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          'Accept': 'application/sdp'
        },
        body: pc.localDescription!.sdp
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server ${res.status}: ${txt.slice(0, 200)}`);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Detect codec
      if (answerSdp.includes('opus')) {
        setCodec('Opus');
      } else {
        setCodec('Unknown');
      }

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setStreamDuration(streamDuration + 1);
      }, 1000);

      // Start recording if user opted in
      if (wantsToRecord) {
        // Recording would be handled here
        console.log('Recording started');
      }

      setIsStreaming(true);

    } catch (err) {
      console.error('Publish error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to start stream';
      setError(errorMsg);
      setConnectionState('failed');
      teardownStream();
    } finally {
      setIsStarting(false);
    }
  }, [streamTitle, streamDescription, accessToken, selectedMicDevice, wantsToRecord, navigate, streamDuration, setStreamDuration, setIceState, setError, setConnectionState, setIsStreaming, setIsStarting]);

  const startStats = useCallback(() => {
    let lastBytes = 0;
    let lastTs = 0;
    
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
  }, [setBitrate]);

  const teardownStream = useCallback(() => {
    // Close WebRTC peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    // Stop stream
    if (pubStreamRef.current) {
      pubStreamRef.current.getTracks().forEach(track => track.stop());
      pubStreamRef.current = null;
    }
    
    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Clear visualizer
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e2b75';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    
    // Clear timers
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setAudioLevel(0);
  }, [setAudioLevel]);

  const handleStopStream = useCallback(() => {
    teardownStream();
    setIsStreaming(false);
    setConnectionState('idle');
    setStreamDuration(0);
    setCodec('—');
    setBitrate('—');
    setIceState('—');
    resetStream();
  }, [teardownStream, setIsStreaming, setConnectionState, setStreamDuration, setCodec, setBitrate, setIceState, resetStream]);

  const handleLogout = useCallback(() => {
    if (isStreaming) {
      handleStopStream();
    }
    logout();
    navigate('/login');
  }, [logout, navigate, isStreaming, handleStopStream]);

  // Thumbnail upload handler
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Get connection status icon
  const getConnectionIcon = () => {
    switch (connectionState) {
      case 'connected':
        return <SignalHigh className="w-5 h-5 text-accent-400" />;
      case 'connecting':
        return <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Signal className="w-5 h-5 text-navy-400" />;
    }
  };

  // Get status color
  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (isStreaming) return 'bg-accent-500 animate-pulse';
    if (isStarting) return 'bg-sky-500 animate-pulse';
    return 'bg-navy-600';
  };

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      {/* Header */}
      <header className="bg-navy-800 border-b border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-accent-400 to-accent-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              <span className="text-white font-semibold text-xl">Volantis</span>
            </div>
            <div className="h-6 w-px bg-navy-700" />
            <div className="flex items-center gap-2">
              {getConnectionIcon()}
              <span className="text-navy-300 capitalize">{connectionState}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Network status */}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-accent-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
            </div>
            
            {/* User info */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center">
                <span className="text-white font-medium">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-white">{user?.name || user?.email}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-navy-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex">
        {/* Main content area */}
        <div className="flex-1 p-6">
          {/* Error display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-300">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="text-sm text-red-400 underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left panel - Stream setup */}
            <div className="lg:col-span-2 space-y-6">
              {/* Audio Visualizer */}
              <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Audio Preview</h2>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={128}
                  className="w-full h-32 rounded-lg bg-navy-900"
                />
                
                {/* Audio level indicator */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {isStreaming ? (
                      <Volume2 className="w-5 h-5 text-accent-400" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-navy-400" />
                    )}
                  </div>
                  <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-accent-400 to-accent-600 transition-all duration-100"
                      style={{ width: isStreaming ? `${audioLevel * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-navy-400 text-sm">
                    {isStreaming ? `${Math.round(audioLevel * 100)}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Stream info form */}
              <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Stream Settings</h2>
                
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-navy-300 mb-2">
                      Stream Title *
                    </label>
                    <input
                      type="text"
                      value={streamTitle}
                      onChange={(e) => setStreamTitle(e.target.value)}
                      placeholder="Enter your stream title"
                      className="w-full px-4 py-3 rounded-lg bg-navy-900 border border-navy-600 text-white placeholder-navy-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                      disabled={isStreaming}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-navy-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={streamDescription}
                      onChange={(e) => setStreamDescription(e.target.value)}
                      placeholder="Describe your stream..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg bg-navy-900 border border-navy-600 text-white placeholder-navy-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all resize-none"
                      disabled={isStreaming}
                    />
                  </div>

                  {/* Thumbnail */}
                  <div>
                    <label className="block text-sm font-medium text-navy-300 mb-2">
                      Thumbnail
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="w-40 h-24 rounded-lg bg-navy-900 border border-navy-600 flex items-center justify-center overflow-hidden">
                        {thumbnailPreview ? (
                          <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <Image className="w-8 h-8 text-navy-600" />
                        )}
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleThumbnailChange}
                          className="hidden"
                          disabled={isStreaming}
                        />
                        <span className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg transition-colors flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          Upload
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right panel - Controls */}
            <div className="space-y-6">
              {/* Audio sources */}
              <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Audio Sources</h2>
                
                <div className="space-y-4">
                  {/* Microphone toggle */}
                  <label className="flex items-center justify-between p-3 bg-navy-900 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      {useMic ? (
                        <Mic className="w-5 h-5 text-accent-400" />
                      ) : (
                        <MicOff className="w-5 h-5 text-navy-400" />
                      )}
                      <span className="text-white">Microphone</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={useMic}
                      onChange={(e) => setUseMic(e.target.checked)}
                      disabled={isStreaming}
                      className="w-5 h-5 rounded border-navy-600 bg-navy-900 text-sky-500 focus:ring-sky-500"
                    />
                  </label>

                  {/* Mic device selector */}
                  {useMic && (
                    <div className="pl-4">
                      <button
                        onClick={() => setShowMicPicker(!showMicPicker)}
                        disabled={isStreaming}
                        className="w-full px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm text-left flex items-center justify-between"
                      >
                        <span>{selectedMicDevice || 'Select microphone'}</span>
                        <Settings className="w-4 h-4" />
                      </button>
                      
                      {showMicPicker && micDevices.length > 0 && (
                        <div className="mt-2 bg-navy-900 rounded-lg overflow-hidden">
                          {micDevices.map((device) => (
                            <button
                              key={device.deviceId}
                              onClick={() => {
                                setSelectedMicDevice(device.deviceId);
                                setShowMicPicker(false);
                              }}
                              className={`w-full px-4 py-2 text-left text-sm hover:bg-navy-700 transition-colors ${
                                selectedMicDevice === device.deviceId 
                                  ? 'text-accent-400 bg-navy-700' 
                                  : 'text-navy-300'
                              }`}
                            >
                              {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* System audio toggle */}
                  <label className="flex items-center justify-between p-3 bg-navy-900 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5 text-navy-400" />
                      <span className="text-white">System Audio</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={useSystemAudio}
                      onChange={(e) => setUseSystemAudio(e.target.checked)}
                      disabled={isStreaming}
                      className="w-5 h-5 rounded border-navy-600 bg-navy-900 text-sky-500 focus:ring-sky-500"
                    />
                  </label>

                  {/* Recording toggle */}
                  <label className="flex items-center justify-between p-3 bg-navy-900 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-navy-400" />
                      <span className="text-white">Record Stream</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={wantsToRecord}
                      onChange={(e) => setWantsToRecord(e.target.checked)}
                      disabled={isStreaming}
                      className="w-5 h-5 rounded border-navy-600 bg-navy-900 text-sky-500 focus:ring-sky-500"
                    />
                  </label>
                </div>
              </div>

              {/* Stream stats */}
              <div className="bg-navy-800 rounded-xl border border-navy-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Stream Status</h2>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-navy-400">Status</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                      <span className="text-white capitalize">
                        {isStarting ? 'Starting' : isStreaming ? 'Live' : 'Idle'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-navy-400">Duration</span>
                    <span className="text-white font-mono">
                      {isStreaming ? formatDuration(streamDuration) : '—'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-navy-400">Codec</span>
                    <span className="text-white">{codec}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-navy-400">Bitrate</span>
                    <span className="text-white">{bitrate}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-navy-400">ICE</span>
                    <span className="text-white">{iceState}</span>
                  </div>
                </div>
              </div>

              {/* Start/Stop button */}
              <button
                onClick={isStreaming ? handleStopStream : handleStartStream}
                disabled={isStarting || !streamTitle.trim()}
                className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
                  isStreaming
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-400 hover:to-accent-500 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Starting...
                  </>
                ) : isStreaming ? (
                  <>
                    <Square className="w-6 h-6" />
                    End Stream
                  </>
                ) : (
                  <>
                    <Radio className="w-6 h-6" />
                    Go Live
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
