import { useState, useRef } from 'react';
import { Mic, Monitor, Music, Plus, Volume2 } from 'lucide-react';
import { ChannelStrip } from './ChannelStrip';
import { VUMeter } from './VUMeter';
import type { ChannelType, MixerEngine } from '../../lib/mixer-engine';

interface LiveMixerPanelProps {
  mixerEngine: MixerEngine | null;
  channels: Array<{
    id: string;
    label: string;
    type: ChannelType;
    volume: number;
    muted: boolean;
    enabled: boolean;
  }>;
  isStreaming: boolean;
  onAddChannel: (type: ChannelType) => void;
  onRemoveChannel: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onMuteToggle: (id: string) => void;
  onBackgroundUpload: (file: File) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 16,
    border: '1px solid #1e293b',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#0ea5e9',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  addButtonEnabled: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
  },
  addButtonDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    color: '#64748b',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  addMenu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: 8,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    zIndex: 10,
    width: 160,
    overflow: 'hidden',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    fontSize: 14,
    color: '#cbd5e1',
    border: 'none',
    background: 'none',
    width: '100%',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s',
  },
  channelsContainer: {
    display: 'flex',
    gap: 12,
    overflowX: 'auto',
    paddingBottom: 12,
  },
  addChannelButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 160,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '2px dashed #475569',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  masterSection: {
    marginTop: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    border: '1px solid #334155',
  },
  masterLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: '#64748b',
  },
  masterValue: {
    fontSize: 11,
    color: '#475569',
    width: 40,
    textAlign: 'right',
  },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    fontSize: 11,
    color: '#f87171',
  },
  liveDotPulsing: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#ef4444',
  },
};

export function LiveMixerPanel({
  mixerEngine,
  channels,
  isStreaming,
  onAddChannel,
  onRemoveChannel,
  onVolumeChange,
  onMuteToggle,
  onBackgroundUpload,
}: LiveMixerPanelProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const handleAddBackgroundClick = () => {
    setShowAddMenu(false);
    bgFileInputRef.current?.click();
  };

  const handleBackgroundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onBackgroundUpload(file);
    }
    if (bgFileInputRef.current) {
      bgFileInputRef.current.value = '';
    }
  };

  const masterLevel = mixerEngine?.getMasterLevel() || 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <div style={styles.liveDot} />
          Audio Mixer
        </h2>
        
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={!isStreaming}
            style={{
              ...styles.addButton,
              ...(isStreaming ? styles.addButtonEnabled : styles.addButtonDisabled),
            }}
          >
            <Plus size={16} />
            Add Channel
          </button>

          {showAddMenu && (
            <div style={styles.addMenu}>
              <button
                onClick={() => { onAddChannel('mic'); setShowAddMenu(false); }}
                style={styles.menuItem}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Mic size={16} color="#38bdf8" />
                Microphone
              </button>
              <button
                onClick={() => { onAddChannel('system'); setShowAddMenu(false); }}
                style={styles.menuItem}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Monitor size={16} color="#a855f7" />
                System Audio
              </button>
              <button
                onClick={handleAddBackgroundClick}
                style={styles.menuItem}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Music size={16} color='#10b981' />
                Background Music
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={bgFileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleBackgroundFileChange}
        style={{ display: 'none' }}
      />

      <div style={styles.channelsContainer}>
        {channels.map((channel) => (
          <ChannelStrip
            key={channel.id}
            channel={channel}
            onVolumeChange={(vol) => onVolumeChange(channel.id, vol)}
            onMuteToggle={() => onMuteToggle(channel.id)}
            onRemove={() => onRemoveChannel(channel.id)}
            isStreaming={isStreaming}
          />
        ))}

        {channels.length < 3 && (
          <button
            onClick={() => setShowAddMenu(true)}
            disabled={!isStreaming}
            style={{
              ...styles.addChannelButton,
              opacity: isStreaming ? 1 : 0.5,
              cursor: isStreaming ? 'pointer' : 'not-allowed',
            }}
          >
            <Plus size={24} color="#64748b" style={{ marginBottom: 8 }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>Add</span>
          </button>
        )}
      </div>

      <div style={styles.masterSection}>
        <div style={styles.masterLabel}>MASTER</div>
        <VUMeter level={masterLevel} size="sm" />
        <div style={styles.masterValue}>
          {Math.round(masterLevel * 100)}%
        </div>
      </div>

      {isStreaming && (
        <div style={styles.liveIndicator}>
          <div style={styles.liveDotPulsing} />
          <span>Live - Audio streaming</span>
        </div>
      )}
    </div>
  );
}

export default LiveMixerPanel;
