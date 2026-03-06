import { useState, useCallback, useRef, useEffect } from 'react';

export interface AudioMixerOptions {
  onLevelChange?: (level: number) => void;
}

export interface AudioMixerState {
  // Input states
  micStream: MediaStream | null;
  systemAudioStream: MediaStream | null;
  mixedStream: MediaStream | null;
  
  // Settings
  micEnabled: boolean;
  micMuted: boolean;
  systemAudioEnabled: boolean;
  systemAudioMuted: boolean;
  micVolume: number;
  systemAudioVolume: number;
  
  // Status
  isActive: boolean;
  hasMicPermission: boolean;
  hasSystemAudioPermission: boolean;
  error: string | null;
}

export interface AudioMixerControls {
  // State
  state: AudioMixerState;
  
  // Actions
  requestMicAccess: (deviceId?: string) => Promise<boolean>;
  requestSystemAudio: () => Promise<boolean>;
  toggleMic: () => void;
  toggleSystemAudio: () => void;
  setMicVolume: (volume: number) => void;
  setSystemAudioVolume: (volume: number) => void;
  muteMic: (muted: boolean) => void;
  muteSystemAudio: (muted: boolean) => void;
  stopAll: () => void;
  
  // Device enumeration
  getAudioInputDevices: () => Promise<MediaDeviceInfo[]>;
  getAudioOutputDevices: () => Promise<MediaDeviceInfo[]>;
}

const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
};

// System audio constraints for window/tab capture
const SYSTEM_AUDIO_CONSTRAINTS: DisplayMediaStreamOptions = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  video: false,
};

export function useAudioMixer(options: AudioMixerOptions = {}): AudioMixerControls {
  const { onLevelChange } = options;

  // State
  const [state, setState] = useState<AudioMixerState>({
    micStream: null,
    systemAudioStream: null,
    mixedStream: null,
    micEnabled: false,
    micMuted: false,
    systemAudioEnabled: false,
    systemAudioMuted: false,
    micVolume: 1.0,
    systemAudioVolume: 1.0,
    isActive: false,
    hasMicPermission: false,
    hasSystemAudioPermission: false,
    error: null,
  });

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const systemSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const systemGainRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);

  // Initialize audio context and processing graph
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const ctx = audioContextRef.current;

    // Create destination node for mixed output
    if (!destinationRef.current) {
      destinationRef.current = ctx.createMediaStreamDestination();
    }

    // Create gain nodes
    if (!micGainRef.current) {
      micGainRef.current = ctx.createGain();
      micGainRef.current.gain.value = state.micVolume;
    }

    if (!systemGainRef.current) {
      systemGainRef.current = ctx.createGain();
      systemGainRef.current.gain.value = state.systemAudioVolume;
    }

    // Create analyser for level monitoring
    if (!analyserRef.current) {
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.75;
    }

    return ctx;
  }, [state.micVolume, state.systemAudioVolume]);

  // Update gain values
  const updateGains = useCallback(() => {
    if (micGainRef.current) {
      micGainRef.current.gain.value = state.micMuted ? 0 : state.micVolume;
    }
    if (systemGainRef.current) {
      systemGainRef.current.gain.value = state.systemAudioMuted ? 0 : state.systemAudioVolume;
    }
  }, [state.micVolume, state.systemAudioVolume, state.micMuted, state.systemAudioMuted]);

  // Start level monitoring
  const startLevelMonitoring = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkLevel = () => {
      if (!analyserRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const level = Math.min(rms / 128, 1); // Normalize to 0-1

      if (onLevelChange) {
        onLevelChange(level);
      }

      animationFrameRef.current = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }, [onLevelChange]);

  // Stop level monitoring
  const stopLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Connect audio sources to destination
  const connectSources = useCallback(async () => {
    const ctx = initializeAudioContext();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Connect mic if available
    if (micStreamRef.current && micGainRef.current && destinationRef.current) {
      try {
        micSourceRef.current = ctx.createMediaStreamSource(micStreamRef.current);
        micSourceRef.current.connect(micGainRef.current);
        micGainRef.current.connect(destinationRef.current);
      } catch (e) {
        console.warn('Failed to connect mic source:', e);
      }
    }

    // Connect system audio if available
    if (systemStreamRef.current && systemGainRef.current && destinationRef.current) {
      try {
        systemSourceRef.current = ctx.createMediaStreamSource(systemStreamRef.current);
        systemSourceRef.current.connect(systemGainRef.current);
        systemGainRef.current.connect(destinationRef.current);
      } catch (e) {
        console.warn('Failed to connect system audio source:', e);
      }
    }

    // Connect analyser
    if (destinationRef.current && analyserRef.current) {
      destinationRef.current.connect(analyserRef.current);
    }

    // Update state
    const mixedStream = destinationRef.current?.stream || null;
    setState((prev) => ({
      ...prev,
      mixedStream,
      isActive: true,
    }));

    // Start level monitoring
    startLevelMonitoring();

    return mixedStream;
  }, [initializeAudioContext, startLevelMonitoring]);

  // Request microphone access
  const requestMicAccess = useCallback(async (deviceId?: string): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { ...DEFAULT_AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } }
          : DEFAULT_AUDIO_CONSTRAINTS,
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      micStreamRef.current = stream;

      setState((prev) => ({
        ...prev,
        micStream: stream,
        hasMicPermission: true,
        micEnabled: true,
      }));

      // Reconnect if already active
      if (state.isActive) {
        await connectSources();
      }

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to access microphone');
      setState((prev) => ({
        ...prev,
        error: error.message,
        hasMicPermission: false,
      }));
      return false;
    }
  }, [state.isActive, connectSources]);

  // Request system audio (window/tab capture)
  const requestSystemAudio = useCallback(async (): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const stream = await navigator.mediaDevices.getDisplayMedia(SYSTEM_AUDIO_CONSTRAINTS as DisplayMediaStreamOptions);
      
      // Handle when user cancels
      if (stream.getAudioTracks().length === 0) {
        setState((prev) => ({
          ...prev,
          error: 'No audio track in selected source',
          hasSystemAudioPermission: false,
        }));
        return false;
      }

      // Listen for when user stops sharing
      stream.getAudioTracks()[0].onended = () => {
        setState((prev) => ({
          ...prev,
          systemAudioStream: null,
          systemAudioEnabled: false,
          hasSystemAudioPermission: false,
        }));
      };

      systemStreamRef.current = stream;

      setState((prev) => ({
        ...prev,
        systemAudioStream: stream,
        hasSystemAudioPermission: true,
        systemAudioEnabled: true,
      }));

      // Reconnect if already active
      if (state.isActive) {
        await connectSources();
      }

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to capture system audio');
      setState((prev) => ({
        ...prev,
        error: error.message,
        hasSystemAudioPermission: false,
      }));
      return false;
    }
  }, [state.isActive, connectSources]);

  // Toggle mic
  const toggleMic = useCallback(() => {
    setState((prev) => {
      const newMicEnabled = !prev.micEnabled;
      
      if (prev.micStream) {
        prev.micStream.getAudioTracks().forEach(track => {
          track.enabled = newMicEnabled;
        });
      }
      
      return { ...prev, micEnabled: newMicEnabled };
    });
  }, []);

  // Toggle system audio
  const toggleSystemAudio = useCallback(() => {
    setState((prev) => {
      const newSystemEnabled = !prev.systemAudioEnabled;
      
      if (prev.systemAudioStream) {
        prev.systemAudioStream.getAudioTracks().forEach(track => {
          track.enabled = newSystemEnabled;
        });
      }
      
      return { ...prev, systemAudioEnabled: newSystemEnabled };
    });
  }, []);

  // Set mic volume
  const setMicVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, micVolume: volume }));
    if (micGainRef.current) {
      micGainRef.current.gain.value = volume;
    }
  }, []);

  // Set system audio volume
  const setSystemAudioVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, systemAudioVolume: volume }));
    if (systemGainRef.current) {
      systemGainRef.current.gain.value = volume;
    }
  }, []);

  // Mute/unmute mic
  const muteMic = useCallback((muted: boolean) => {
    setState((prev) => ({ ...prev, micMuted: muted }));
    updateGains();
  }, [updateGains]);

  // Mute/unmute system audio
  const muteSystemAudio = useCallback((muted: boolean) => {
    setState((prev) => ({ ...prev, systemAudioMuted: muted }));
    updateGains();
  }, [updateGains]);

  // Stop all
  const stopAll = useCallback(() => {
    // Stop level monitoring
    stopLevelMonitoring();

    // Stop mic stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    // Stop system audio stream
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(track => track.stop());
      systemStreamRef.current = null;
    }

    // Disconnect audio nodes
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (systemSourceRef.current) {
      systemSourceRef.current.disconnect();
      systemSourceRef.current = null;
    }

    // Reset state
    setState({
      micStream: null,
      systemAudioStream: null,
      mixedStream: null,
      micEnabled: false,
      micMuted: false,
      systemAudioEnabled: false,
      systemAudioMuted: false,
      micVolume: 1.0,
      systemAudioVolume: 1.0,
      isActive: false,
      hasMicPermission: false,
      hasSystemAudioPermission: false,
      error: null,
    });
  }, [stopLevelMonitoring]);

  // Get audio input devices
  const getAudioInputDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  }, []);

  // Get audio output devices
  const getAudioOutputDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audiooutput');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopAll]);

  return {
    state,
    requestMicAccess,
    requestSystemAudio,
    toggleMic,
    toggleSystemAudio,
    setMicVolume,
    setSystemAudioVolume,
    muteMic,
    muteSystemAudio,
    stopAll,
    getAudioInputDevices,
    getAudioOutputDevices,
  };
}

export default useAudioMixer;
