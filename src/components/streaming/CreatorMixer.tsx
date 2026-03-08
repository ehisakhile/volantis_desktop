/**
 * CreatorMixer - Dynamic Audio Channel Mixer
 *
 * Provides UI for managing multiple audio sources during live streaming.
 * Supports adding/removing microphone and system audio sources dynamically.
 * Allows selection of specific microphone devices and system audio sources.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Mic,
  Monitor,
  VolumeX,
  Volume2,
  Plus,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import {
  MixerEngine,
  type MixerChannel,
  type ChannelType,
  captureMicSource,
  captureSystemSource,
  getAudioInputDevicesList,
} from '../../lib/mixer-engine';

interface CreatorMixerProps {
  /** The mixer engine instance */
  mixerEngine: MixerEngine;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Callback when a new channel should be added */
  onAddChannel?: (type: ChannelType) => void;
  /** Callback when a channel should be removed */
  onRemoveChannel?: (id: string) => void;
}

// VU Meter segment colors
const getSegmentColor = (i: number, total: number, active: boolean): string => {
  if (!active) return 'rgba(255,255,255,0.05)';
  const pct = i / total;
  if (pct > 0.88) return '#ef4444';
  if (pct > 0.72) return '#f59e0b';
  return '#22c55e';
};

// Channel VU Meter
function ChannelVUMeter({ level }: { level: number }) {
  const segments = 16;
  const activeCount = Math.round(level * segments);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 3,
            borderRadius: 1,
            background: getSegmentColor(i, segments, i < activeCount),
            transition: 'background 0.05s',
          }}
        />
      ))}
    </div>
  );
}

// Channel card component
interface ChannelCardProps {
  channel: MixerChannel;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onRemove: () => void;
  onChangeDevice?: (deviceId: string) => void;
  availableDevices?: MediaDeviceInfo[];
}

function ChannelCard({ channel, onVolumeChange, onMuteToggle, onRemove, onChangeDevice, availableDevices }: ChannelCardProps) {
  const [level, setLevel] = useState(0);
  const [showDevicePicker, setShowDevicePicker] = useState(false);

  // Update level meter
  useEffect(() => {
    const interval = setInterval(() => {
      const newLevel = channel.analyserNode ?
        calculateLevel(channel.analyserNode) : 0;
      setLevel(newLevel);
    }, 50);
    return () => clearInterval(interval);
  }, [channel.analyserNode]);

  const getTypeIcon = () => {
    switch (channel.type) {
      case 'mic':
        return <Mic style={{ width: 12, height: 12 }} />;
      case 'system':
        return <Monitor style={{ width: 12, height: 12 }} />;
      default:
        return <Volume2 style={{ width: 12, height: 12 }} />;
    }
  };

  const getTypeLabel = () => {
    switch (channel.type) {
      case 'mic':
        return 'Microphone';
      case 'system':
        return 'System Audio';
      case 'background':
        return 'Background';
      default:
        return channel.label;
    }
  };

  // Get the device name for mic channels
  const getDeviceName = () => {
    if (channel.type === 'mic' && channel.deviceId && availableDevices) {
      const device = availableDevices.find(d => d.deviceId === channel.deviceId);
      return device?.label || `Mic ${channel.deviceId.slice(0, 8)}...`;
    }
    return null;
  };

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${channel.isMuted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 6,
      padding: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            color: channel.isMuted ? '#ef4444' : '#38bdf8',
            display: 'flex',
          }}>
            {getTypeIcon()}
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
            {getTypeLabel()}
          </span>
        </div>
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: 'rgba(255,255,255,0.3)',
            display: 'flex',
          }}
          title="Remove channel"
        >
          <Trash2 style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Device selector for microphones - only show if we have devices and it's a mic channel */}
      {channel.type === 'mic' && availableDevices && availableDevices.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setShowDevicePicker(!showDevicePicker)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '4px 8px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 10,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {getDeviceName() || 'Select device...'}
            </span>
            <ChevronDown style={{ width: 10, height: 10, flexShrink: 0 }} />
          </button>
          
          {showDevicePicker && (
            <div style={{
              marginTop: 4,
              background: '#0d1219',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4,
              overflow: 'hidden',
              maxHeight: 120,
              overflowY: 'auto',
            }}>
              {availableDevices.map(device => (
                <button
                  key={device.deviceId}
                  onClick={() => {
                    onChangeDevice?.(device.deviceId);
                    setShowDevicePicker(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    textAlign: 'left',
                    background: device.deviceId === channel.deviceId ? 'rgba(56,189,248,0.1)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 10,
                    color: device.deviceId === channel.deviceId ? '#38bdf8' : 'rgba(255,255,255,0.5)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {device.label || `Microphone ${device.deviceId.slice(0, 12)}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Level meter and controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {/* VU Meter */}
        <ChannelVUMeter level={channel.isMuted ? 0 : level} />

        {/* Volume slider */}
        <div style={{ flex: 1 }}>
          <input
            type="range"
            min="0"
            max="100"
            value={channel.volume}
            onChange={(e) => onVolumeChange(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: 4,
              cursor: 'pointer',
            }}
            disabled={channel.isMuted}
          />
        </div>

        {/* Mute button */}
        <button
          onClick={onMuteToggle}
          style={{
            background: channel.isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${channel.isMuted ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 4,
            padding: '4px 6px',
            cursor: 'pointer',
            color: channel.isMuted ? '#ef4444' : 'rgba(255,255,255,0.5)',
            display: 'flex',
          }}
          title={channel.isMuted ? 'Unmute' : 'Mute'}
        >
          {channel.isMuted ? <VolumeX style={{ width: 12, height: 12 }} /> : <Volume2 style={{ width: 12, height: 12 }} />}
        </button>
      </div>

      {/* Volume percentage */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
          {Math.round(channel.volume)}%
        </span>
      </div>
    </div>
  );
}

// Helper to calculate audio level
function calculateLevel(analyser: AnalyserNode): number {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const normalized = dataArray[i] / 255;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / dataArray.length);
  return Math.min(1, rms * 2);
}

// Master output meter
interface MasterOutputProps {
  mixerEngine: MixerEngine;
  isStreaming: boolean;
}

function MasterOutput({ mixerEngine, isStreaming }: MasterOutputProps) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      setLevel(mixerEngine.getMasterLevel());
    }, 50);

    return () => clearInterval(interval);
  }, [mixerEngine, isStreaming]);

  const segments = 20;
  const activeCount = Math.round(level * segments);

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 6,
      padding: 10,
    }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, letterSpacing: '0.06em' }}>
        MASTER OUTPUT
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 1,
              background: getSegmentColor(i, segments, i < activeCount),
              boxShadow: i < activeCount && i / segments > 0.72 ? `0 0 4px ${getSegmentColor(i, segments, true)}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Device picker modal for selecting microphone before adding
interface MicDevicePickerProps {
  devices: MediaDeviceInfo[];
  onSelect: (deviceId: string) => void;
  onCancel: () => void;
}

function MicDevicePicker({ devices, onSelect, onCancel }: MicDevicePickerProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#141920',
        borderRadius: 12,
        padding: 20,
        maxWidth: 360,
        width: '90%',
        border: '1px solid rgba(56,189,248,0.2)',
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#38bdf8' }}>
          Select Microphone
        </h3>
        
        <div style={{
          maxHeight: 250,
          overflowY: 'auto',
          marginBottom: 16,
        }}>
          {devices.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              No microphones found. Please connect a microphone and try again.
            </p>
          ) : (
            devices.map(device => (
              <button
                key={device.deviceId}
                onClick={() => onSelect(device.deviceId)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 14px',
                  marginBottom: 6,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mic style={{ width: 16, height: 16, color: '#38bdf8' }} />
                  <span>{device.label || `Microphone ${device.deviceId.slice(0, 12)}`}</span>
                </div>
              </button>
            ))
          )}
        </div>

        <button
          onClick={onCancel}
          style={{
            width: '100%',
            padding: '10px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CreatorMixer({
  mixerEngine,
  isStreaming,
  onAddChannel,
  onRemoveChannel,
}: CreatorMixerProps) {
  const [channels, setChannels] = useState<MixerChannel[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [showMicPicker, setShowMicPicker] = useState(false);

  // Load available audio input devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Request permission first to enumerate devices
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const devices = await getAudioInputDevicesList();
        setAvailableDevices(devices);
      } catch (err) {
        console.error('Failed to load audio devices:', err);
      }
    };

    loadDevices();
  }, []);

  // Update channels when engine changes
  useEffect(() => {
    const updateChannels = () => {
      setChannels(mixerEngine.allChannels);
    };

    updateChannels();

    // Poll for channel changes
    const interval = setInterval(updateChannels, 500);
    return () => clearInterval(interval);
  }, [mixerEngine]);

  // Handle volume change for a channel
  const handleVolumeChange = useCallback((channelId: string, volume: number) => {
    mixerEngine.setVolume(channelId, volume);
    setChannels([...mixerEngine.allChannels]);
  }, [mixerEngine]);

  // Handle mute toggle for a channel
  const handleMuteToggle = useCallback((channelId: string) => {
    const channel = mixerEngine.getChannel(channelId);
    if (channel) {
      mixerEngine.setMute(channelId, !channel.isMuted);
      setChannels([...mixerEngine.allChannels]);
    }
  }, [mixerEngine]);

  // Handle channel removal
  const handleRemoveChannel = useCallback((channelId: string) => {
    mixerEngine.removeChannel(channelId);
    onRemoveChannel?.(channelId);
    setChannels([...mixerEngine.allChannels]);
  }, [mixerEngine, onRemoveChannel]);

  // Handle device change for a microphone channel
  const handleDeviceChange = useCallback(async (channelId: string, deviceId: string) => {
    try {
      const stream = await captureMicSource(deviceId);
      mixerEngine.replaceSource(channelId, stream, deviceId);
      setChannels([...mixerEngine.allChannels]);
    } catch (err) {
      console.error('Failed to change microphone device:', err);
    }
  }, [mixerEngine]);

  // Handle adding microphone with device selection
  const handleAddMicWithPicker = useCallback(() => {
    setShowAddMenu(false);
    setShowMicPicker(true);
  }, []);

  // Handle microphone selection from picker
  const handleMicSelected = useCallback(async (deviceId: string) => {
    setShowMicPicker(false);
    
    try {
      const id = `mic-${Date.now()}`;
      const stream = await captureMicSource(deviceId);
      
      // Get device label for display
      const device = availableDevices.find(d => d.deviceId === deviceId);
      const label = device?.label ? `MIC (${device.label.slice(0, 20)})` : 'MIC';
      
      mixerEngine.addChannel(id, label, 'mic', stream, deviceId);
      onAddChannel?.('mic');
      setChannels([...mixerEngine.allChannels]);
    } catch (err) {
      console.error('Failed to add microphone channel:', err);
    }
  }, [mixerEngine, onAddChannel, availableDevices]);

  // Handle adding system audio (shows browser picker for window/app selection)
  const handleAddSystemAudio = useCallback(async () => {
    setShowAddMenu(false);
    
    try {
      const id = `system-${Date.now()}`;
      const stream = await captureSystemSource();
      mixerEngine.addChannel(id, 'SYSTEM', 'system', stream);
      onAddChannel?.('system');
      setChannels([...mixerEngine.allChannels]);
    } catch (err) {
      // User may have cancelled the picker
      console.error('Failed to add system audio:', err);
    }
  }, [mixerEngine, onAddChannel]);

  return (
    <div style={{
      background: 'rgba(15,23,42,0.95)',
      borderRadius: 8,
      border: '1px solid rgba(56,189,248,0.2)',
      padding: 14,
    }}>
      {/* Microphone device picker modal */}
      {showMicPicker && (
        <MicDevicePicker
          devices={availableDevices}
          onSelect={handleMicSelected}
          onCancel={() => setShowMicPicker(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 2, height: 14, background: 'rgba(56,189,248,0.7)', borderRadius: 1 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Audio Mixer
          </span>
        </div>
        
        {/* Add channel button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={!isStreaming}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: isStreaming ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isStreaming ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 4,
              cursor: isStreaming ? 'pointer' : 'not-allowed',
              opacity: isStreaming ? 1 : 0.5,
              color: 'rgba(255,255,255,0.7)',
              fontSize: 10,
            }}
          >
            <Plus style={{ width: 10, height: 10 }} />
            Add Source
          </button>

          {/* Add menu dropdown */}
          {showAddMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              overflow: 'hidden',
              zIndex: 100,
              minWidth: 160,
            }}>
              <button
                onClick={handleAddMicWithPicker}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 11,
                  textAlign: 'left',
                }}
              >
                <Mic style={{ width: 14, height: 14, color: '#38bdf8' }} />
                Microphone
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                  (select device)
                </span>
              </button>
              <button
                onClick={handleAddSystemAudio}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 11,
                  textAlign: 'left',
                }}
              >
                <Monitor style={{ width: 14, height: 14, color: '#22c55e' }} />
                System Audio
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                  (select window)
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Channel list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onVolumeChange={(vol) => handleVolumeChange(channel.id, vol)}
            onMuteToggle={() => handleMuteToggle(channel.id)}
            onRemove={() => handleRemoveChannel(channel.id)}
            onChangeDevice={(deviceId) => handleDeviceChange(channel.id, deviceId)}
            availableDevices={availableDevices}
          />
        ))}

        {channels.length === 0 && (
          <div style={{
            padding: 20,
            textAlign: 'center',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 11,
          }}>
            No audio sources added.
            <br />
            Click "Add Source" to add microphone or system audio.
          </div>
        )}
      </div>

      {/* Master output */}
      <div style={{ marginTop: 12 }}>
        <MasterOutput mixerEngine={mixerEngine} isStreaming={isStreaming} />
      </div>

      {/* Live indicator */}
      {isStreaming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse-dot 1s infinite' }} />
          <span style={{ fontSize: 10, color: 'rgba(239,68,68,0.8)', letterSpacing: '0.05em' }}>
            LIVE - Audio streaming
          </span>
        </div>
      )}
    </div>
  );
}

export type { CreatorMixerProps, MixerChannel, ChannelType };