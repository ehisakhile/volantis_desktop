import { useState, useEffect, useCallback } from 'react';
import { Mic, Volume2, RefreshCw } from 'lucide-react';

interface MicrophonePickerPanelProps {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onDeviceSelect: (deviceId: string) => void;
  onTestMic: (deviceId: string) => void;
  isStreaming?: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
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
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 500,
    color: '#ffffff',
  },
  refreshBtn: {
    padding: 6,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDevices: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    padding: 16,
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 6,
    color: '#ffffff',
    fontSize: 14,
    outline: 'none',
  },
  testBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    border: 'none',
    marginTop: 8,
  },
  levelBar: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  levelFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    transition: 'width 0.075s',
  },
};

export function MicrophonePickerPanel({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  onTestMic,
  isStreaming = false,
}: MicrophonePickerPanelProps) {
  const [testLevel, setTestLevel] = useState(0);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = useCallback(async () => {
    if (isTesting || !selectedDeviceId) return;

    setIsTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedDeviceId } },
        video: false,
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkLevel = () => {
        if (!isTesting) return;
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setTestLevel(Math.min(rms / 128, 1));
        
        requestAnimationFrame(checkLevel);
      };

      checkLevel();

      setTimeout(() => {
        setIsTesting(false);
        setTestLevel(0);
        stream.getTracks().forEach(t => t.stop());
        audioContext.close();
      }, 3000);
    } catch (err) {
      console.error('Failed to test mic:', err);
      setIsTesting(false);
    }
  }, [isTesting, selectedDeviceId]);

  useEffect(() => {
    if (!isStreaming && devices.length > 0 && !selectedDeviceId) {
      onDeviceSelect(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId, onDeviceSelect, isStreaming]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <Mic size={16} color="#0ea5e9" />
          <span>Microphone</span>
        </div>
        <button
          onClick={() => {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
              navigator.mediaDevices.enumerateDevices();
            });
          }}
          style={styles.refreshBtn}
          title="Refresh devices"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {devices.length === 0 ? (
        <div style={styles.noDevices}>No microphones found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select
            value={selectedDeviceId}
            onChange={(e) => onDeviceSelect(e.target.value)}
            disabled={isStreaming}
            style={styles.select}
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>

          {!isStreaming && selectedDeviceId && (
            <button
              onClick={handleTest}
              disabled={isTesting}
              style={{
                ...styles.testBtn,
                backgroundColor: isTesting ? 'rgba(14, 165, 233, 0.2)' : '#1e293b',
                color: isTesting ? '#0ea5e9' : '#cbd5e1',
              }}
            >
              <Volume2 size={16} />
              {isTesting ? 'Testing...' : 'Test Microphone'}
            </button>
          )}

          {isTesting && (
            <div style={styles.levelBar}>
              <div
                style={{
                  ...styles.levelFill,
                  width: `${testLevel * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MicrophonePickerPanel;
