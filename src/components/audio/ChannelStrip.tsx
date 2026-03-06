import { useState, useEffect, useRef } from 'react';
import { Mic, Monitor, Music, VolumeX, Volume2, Trash2 } from 'lucide-react';
import { VUMeter } from './VUMeter';
import type { ChannelType } from '../../lib/mixer-engine';

interface AudioChannel {
  id: string;
  label: string;
  type: ChannelType;
  volume: number;
  muted: boolean;
  enabled: boolean;
  deviceId?: string;
}

interface ChannelStripProps {
  channel: AudioChannel;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onRemove: () => void;
  isStreaming: boolean;
}

const colorMap: Record<ChannelType, string> = {
  mic: '#38bdf8',
  system: '#a855f7',
  background: '#10b981',
  master: '#64748b',
};

export function ChannelStrip({
  channel,
  onVolumeChange,
  onMuteToggle,
  onRemove,
  isStreaming,
}: ChannelStripProps) {
  const [level, setLevel] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);

  const getIcon = () => {
    switch (channel.type) {
      case 'mic':
        return <Mic size={16} />;
      case 'system':
        return <Monitor size={16} />;
      case 'background':
        return <Music size={16} />;
      default:
        return <Volume2 size={16} />;
    }
  };

  const color = colorMap[channel.type] || colorMap.mic;
  const mutedColor = channel.muted ? '#f87171' : color;
  const borderColor = channel.muted ? 'rgba(239, 68, 68, 0.5)' : `${color}4d`;

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 12,
      backgroundColor: '#0f172a',
      borderRadius: 8,
      border: `2px solid ${borderColor}`,
      minWidth: 120,
      transition: 'border-color 0.15s',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 8,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 500,
          color: color,
        }}>
          {getIcon()}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }}>
            {channel.label}
          </span>
        </div>
        
        {channel.type !== 'mic' && (
          <button
            onClick={onRemove}
            style={{
              padding: 4,
              borderRadius: 4,
              border: 'none',
              background: 'none',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#334155';
              e.currentTarget.style.color = '#f87171';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <VUMeter level={level} size="md" />

      <div style={{ position: 'relative', height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0 4px' }}>
        <div style={{
          position: 'absolute',
          height: '100%',
          width: 8,
          backgroundColor: '#334155',
          borderRadius: '999px',
          overflow: 'hidden',
          border: '1px solid #475569',
        }}>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#0ea5e9',
              height: `${channel.volume}%`,
            }}
          />
        </div>
        
        <input
          type="range"
          min="0"
          max="100"
          value={channel.volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          disabled={!isStreaming}
          style={{
            position: 'absolute',
            height: 96,
            width: 20,
            appearance: 'none',
            background: 'transparent',
            cursor: isStreaming ? 'pointer' : 'not-allowed',
            zIndex: 10,
            writingMode: 'vertical-lr',
            direction: 'rtl',
          }}
        />
      </div>

      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
        {channel.volume}%
      </div>

      <button
        onClick={onMuteToggle}
        disabled={!isStreaming}
        style={{
          padding: 8,
          borderRadius: 8,
          marginTop: 8,
          border: 'none',
          backgroundColor: channel.muted ? 'rgba(239, 68, 68, 0.2)' : '#1e293b',
          color: channel.muted ? '#f87171' : '#64748b',
          cursor: isStreaming ? 'pointer' : 'not-allowed',
          opacity: isStreaming ? 1 : 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {channel.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      <div style={{
        position: 'absolute',
        top: -4,
        right: -4,
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: color,
      }} />
    </div>
  );
}

export default ChannelStrip;
