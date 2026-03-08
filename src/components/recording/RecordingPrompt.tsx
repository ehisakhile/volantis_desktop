import React from 'react';
import { CircleDot, Upload, X, Cloud, HardDrive } from 'lucide-react';

interface RecordingPromptProps {
  isOpen: boolean;
  onAccept: (autoUpload: boolean) => void;
  onDecline: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 24,
    maxWidth: 448,
    width: '100%',
    margin: '0 16px',
    border: '1px solid #1e293b',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: '#ffffff',
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    margin: 0,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 8,
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    transition: 'all 0.15s',
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  optionContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  optionIcon: {
    width: 20,
    height: 20,
    marginTop: 2,
  },
  optionText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: '#ffffff',
    margin: 0,
  },
  optionDesc: {
    fontSize: 11,
    color: '#64748b',
    margin: 0,
  },
  buttonGroup: {
    display: 'flex',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
  },
};

export function RecordingPrompt({ isOpen, onAccept, onDecline }: RecordingPromptProps) {
  // Log when isOpen changes to true
  React.useEffect(() => {
    if (isOpen) {
      console.log('[RecordingPrompt] ✅ Prompt is now OPEN');
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  console.log('[RecordingPrompt] ✅ Rendering modal (isOpen=true)');
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.iconContainer}>
              <CircleDot size={24} color="#ef4444" />
            </div>
            <div style={styles.headerText}>
              <h2 style={styles.title}>Record Stream?</h2>
              <p style={styles.subtitle}>Save your stream for later</p>
            </div>
          </div>
          <button
            onClick={onDecline}
            style={styles.closeButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1e293b';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={styles.optionsContainer}>
          <div style={styles.optionCard}>
            <div style={styles.optionContent}>
              <HardDrive size={20} color="#64748b" style={styles.optionIcon} />
              <div style={styles.optionText}>
                <p style={styles.optionTitle}>Save Locally</p>
                <p style={styles.optionDesc}>Download recording after stream ends</p>
              </div>
            </div>
          </div>

          <div style={styles.optionCard}>
            <div style={styles.optionContent}>
              <Cloud size={20} color="#38bdf8" style={styles.optionIcon} />
              <div style={styles.optionText}>
                <p style={styles.optionTitle}>Auto-Upload</p>
                <p style={styles.optionDesc}>Upload to platform after stream ends</p>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.buttonGroup}>
          <button
            onClick={() => onAccept(false)}
            style={{
              ...styles.button,
              ...styles.secondaryButton,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
          >
            Save Locally
          </button>
          <button
            onClick={() => onAccept(true)}
            style={{
              ...styles.button,
              ...styles.primaryButton,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0ea5e9')}
          >
            <Upload size={16} style={{ marginRight: 8 }} />
            Auto-Upload
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecordingPrompt;
