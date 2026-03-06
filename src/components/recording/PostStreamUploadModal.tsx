import { Upload, FileAudio, X, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

interface PostStreamUploadModalProps {
  isOpen: boolean;
  recordingBlob: Blob | null;
  recordingFilename: string | null;
  onUpload: () => void;
  onDownload: () => void;
  onClose: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string | null;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
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
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: '#ffffff',
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
  fileCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 14,
    fontWeight: 500,
    color: '#ffffff',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileSize: {
    fontSize: 11,
    color: '#64748b',
    margin: 0,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#fca5a5',
    margin: 0,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    transition: 'all 0.3s',
  },
  buttonGroup: {
    display: 'flex',
    gap: 12,
  },
  button: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s',
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export function PostStreamUploadModal({
  isOpen,
  recordingBlob,
  recordingFilename,
  onUpload,
  onDownload,
  onClose,
  isUploading = false,
  uploadProgress = 0,
  error = null,
}: PostStreamUploadModalProps) {
  if (!isOpen) return null;

  const fileSize = recordingBlob ? (recordingBlob.size / (1024 * 1024)).toFixed(2) : '0';

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Recording Ready</h2>
          <button
            onClick={onClose}
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

        <div style={styles.fileCard}>
          <div style={styles.fileInfo}>
            <div style={styles.fileIcon}>
              <FileAudio size={24} color="#38bdf8" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={styles.fileName}>
                {recordingFilename || 'Recording'}
              </p>
              <p style={styles.fileSize}>{fileSize} MB</p>
            </div>
          </div>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0 }} />
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {isUploading && (
          <div style={styles.progressSection}>
            <div style={styles.progressHeader}>
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${uploadProgress}%`,
                }}
              />
            </div>
          </div>
        )}

        <div style={styles.buttonGroup}>
          <button
            onClick={onDownload}
            disabled={isUploading}
            style={{
              ...styles.button,
              ...styles.secondaryButton,
              ...(isUploading ? styles.disabledButton : {}),
            }}
          >
            <Download size={16} />
            Download
          </button>
          <button
            onClick={onUpload}
            disabled={isUploading}
            style={{
              ...styles.button,
              ...styles.primaryButton,
              ...(isUploading ? styles.disabledButton : {}),
            }}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default PostStreamUploadModal;
