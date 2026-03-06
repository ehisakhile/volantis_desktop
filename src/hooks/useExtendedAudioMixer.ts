import { useState, useCallback, useRef, useEffect } from 'react';
import { createMixerEngine, MixerEngine, captureMicSource, captureSystemSource, getAudioInputDevicesList, ChannelType } from '../lib/mixer-engine';
import { createBackgroundAudioSource, BackgroundAudioSource } from '../lib/audio-sources';

export interface AudioChannel {
  id: string;
  label: string;
  type: ChannelType;
  stream: MediaStream | null;
  volume: number;
  muted: boolean;
  enabled: boolean;
  deviceId?: string;
}

export interface ExtendedAudioMixerOptions {
  onLevelChange?: (level: number) => void;
}

export interface ExtendedAudioMixerState {
  channels: AudioChannel[];
  mixedStream: MediaStream | null;
  isActive: boolean;
  error: string | null;
}

export interface ExtendedAudioMixerControls {
  state: ExtendedAudioMixerState;
  mixerEngine: MixerEngine | null;
  requestMicAccess: (deviceId?: string) => Promise<boolean>;
  requestSystemAudio: () => Promise<boolean>;
  addChannel: (type: ChannelType, deviceId?: string) => Promise<void>;
  removeChannel: (id: string) => void;
  setChannelVolume: (id: string, volume: number) => void;
  setChannelMuted: (id: string, muted: boolean) => void;
  addBackgroundMusic: (file: File) => Promise<void>;
  start: () => Promise<MediaStream | null>;
  stop: () => void;
  getAudioInputDevices: () => Promise<MediaDeviceInfo[]>;
}

export function useExtendedAudioMixer(options: ExtendedAudioMixerOptions = {}): ExtendedAudioMixerControls {
  const { onLevelChange } = options;

  const [state, setState] = useState<ExtendedAudioMixerState>({
    channels: [],
    mixedStream: null,
    isActive: false,
    error: null,
  });

  const mixerEngineRef = useRef<MixerEngine | null>(null);
  const backgroundSourceRef = useRef<BackgroundAudioSource | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startLevelMonitoring = useCallback(() => {
    if (!mixerEngineRef.current) return;

    const checkLevel = () => {
      if (!mixerEngineRef.current) return;
      const level = mixerEngineRef.current.getMasterLevel();
      if (onLevelChange) {
        onLevelChange(level);
      }
      animationFrameRef.current = requestAnimationFrame(checkLevel);
    };

    checkLevel();
  }, [onLevelChange]);

  const stopLevelMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const updateChannelState = useCallback(() => {
    if (!mixerEngineRef.current) return;
    const channels: AudioChannel[] = mixerEngineRef.current.allChannels.map(ch => ({
      id: ch.id,
      label: ch.label,
      type: ch.type,
      stream: ch.stream,
      volume: ch.volume,
      muted: ch.isMuted,
      enabled: true,
      deviceId: ch.deviceId,
    }));
    setState(prev => ({ ...prev, channels }));
  }, []);

  const requestMicAccess = useCallback(async (deviceId?: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      const stream = await captureMicSource(deviceId);
      
      if (mixerEngineRef.current) {
        const id = `mic-${Date.now()}`;
        mixerEngineRef.current.addChannel(id, 'MIC', 'mic', stream, deviceId);
        updateChannelState();
      }
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to access microphone';
      setState(prev => ({ ...prev, error }));
      return false;
    }
  }, [updateChannelState]);

  const requestSystemAudio = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      const stream = await captureSystemSource();
      
      if (mixerEngineRef.current) {
        const id = `system-${Date.now()}`;
        mixerEngineRef.current.addChannel(id, 'SYSTEM', 'system', stream);
        updateChannelState();
      }
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to capture system audio';
      setState(prev => ({ ...prev, error }));
      return false;
    }
  }, [updateChannelState]);

  const addChannel = useCallback(async (type: ChannelType, deviceId?: string): Promise<void> => {
    if (!mixerEngineRef.current) {
      mixerEngineRef.current = createMixerEngine();
    }

    try {
      let stream: MediaStream;
      let id: string;
      let label: string;

      if (type === 'mic') {
        id = `mic-${Date.now()}`;
        label = 'MIC';
        stream = await captureMicSource(deviceId);
      } else if (type === 'system') {
        id = `system-${Date.now()}`;
        label = 'SYSTEM';
        stream = await captureSystemSource();
      } else {
        return;
      }

      mixerEngineRef.current.addChannel(id, label, type, stream, deviceId);
      updateChannelState();
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to add channel';
      setState(prev => ({ ...prev, error }));
    }
  }, [updateChannelState]);

  const removeChannel = useCallback((id: string): void => {
    if (mixerEngineRef.current) {
      mixerEngineRef.current.removeChannel(id);
      updateChannelState();
    }
  }, [updateChannelState]);

  const setChannelVolume = useCallback((id: string, volume: number): void => {
    if (mixerEngineRef.current) {
      mixerEngineRef.current.setVolume(id, volume);
      updateChannelState();
    }
  }, [updateChannelState]);

  const setChannelMuted = useCallback((id: string, muted: boolean): void => {
    if (mixerEngineRef.current) {
      mixerEngineRef.current.setMute(id, muted);
      updateChannelState();
    }
  }, [updateChannelState]);

  const addBackgroundMusic = useCallback(async (file: File): Promise<void> => {
    if (!mixerEngineRef.current) {
      mixerEngineRef.current = createMixerEngine();
    }

    try {
      const bgSource = createBackgroundAudioSource(file, true);
      const result = await bgSource.capture();
      backgroundSourceRef.current = bgSource;
      bgSource.play();

      const id = `background-${Date.now()}`;
      mixerEngineRef.current.addChannel(id, 'BACKGROUND', 'background', result.stream);
      updateChannelState();
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to add background music';
      setState(prev => ({ ...prev, error }));
    }
  }, [updateChannelState]);

  const start = useCallback(async (): Promise<MediaStream | null> => {
    if (!mixerEngineRef.current) {
      mixerEngineRef.current = createMixerEngine();
    }

    await mixerEngineRef.current.resume();
    
    const mixedStream = mixerEngineRef.current.outputStream;
    setState(prev => ({
      ...prev,
      mixedStream,
      isActive: true,
    }));

    startLevelMonitoring();
    updateChannelState();

    return mixedStream;
  }, [startLevelMonitoring, updateChannelState]);

  const stop = useCallback(() => {
    stopLevelMonitoring();

    if (backgroundSourceRef.current) {
      backgroundSourceRef.current.stop();
      backgroundSourceRef.current = null;
    }

    if (mixerEngineRef.current) {
      mixerEngineRef.current.destroy();
      mixerEngineRef.current = null;
    }

    setState({
      channels: [],
      mixedStream: null,
      isActive: false,
      error: null,
    });
  }, [stopLevelMonitoring]);

  const getAudioInputDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    return getAudioInputDevicesList();
  }, []);

  useEffect(() => {
    return () => {
      stopLevelMonitoring();
      if (mixerEngineRef.current) {
        mixerEngineRef.current.destroy();
      }
    };
  }, [stopLevelMonitoring]);

  return {
    state,
    mixerEngine: mixerEngineRef.current,
    requestMicAccess,
    requestSystemAudio,
    addChannel,
    removeChannel,
    setChannelVolume,
    setChannelMuted,
    addBackgroundMusic,
    start,
    stop,
    getAudioInputDevices,
  };
}

export default useExtendedAudioMixer;
