import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordingsApi } from '../lib/api/recordings';
import { listRecordings, deleteRecording as deleteRecordingFile, getRecordingsDir } from '../lib/tauri-recording';
import { useAuthStore } from '../store/authStore';
import {
  Play, Trash2, Upload, FolderOpen, FileAudio, Loader2, RefreshCw,
  ArrowLeft, Plus, Cloud, HardDrive, CheckCircle, AlertCircle, X
} from 'lucide-react';

interface CloudRecording {
  id: number;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  created_at: string;
  recording_url?: string;
  thumbnail_url?: string | null;
  streaming_url?: string;
  replay_count?: number;
}

interface LocalRecording {
  id: string;
  filename: string;
  title: string;
  duration: number;
  createdAt: string;
  size: number;
  blob?: Blob;
  uploaded?: boolean;
}

const API_URL = 'https://api-dev.volantislive.com';

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0a0e14',
    color: '#ffffff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #1e293b',
    background: '#0f172a',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: '#0ea5e9',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  refreshButton: {
    padding: '8px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    transition: 'all 0.15s',
  },
  main: {
    padding: '24px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: '#1e293b',
    border: 'none',
    borderRadius: '8px',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#0ea5e9',
    color: '#ffffff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  grid: {
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  },
  card: {
    background: '#0f172a',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  thumbnail: {
    width: '64px',
    height: '64px',
    background: 'rgba(14, 165, 233, 0.2)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 500,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748b',
    margin: '4px 0 0 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: 12,
    color: '#475569',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '1px solid #1e293b',
  },
  actionButton: {
    padding: '8px',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    transition: 'all 0.15s',
  },
  uploadLocalButton: {
    flex: 1,
    padding: '8px',
    background: 'transparent',
    border: '1px dashed #334155',
    borderRadius: '6px',
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.15s',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: 11,
    fontWeight: 500,
  },
  statusUploaded: {
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
  },
  statusPending: {
    background: 'rgba(234, 179, 8, 0.2)',
    color: '#eab308',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '256px',
  },
  spinner: {
    width: 32,
    height: 32,
    color: '#0ea5e9',
    animation: 'spin 1s linear infinite',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    color: '#475569',
    margin: '0 auto 16px',
  },
  emptyText: {
    color: '#64748b',
    margin: 0,
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  errorText: {
    color: '#fca5a5',
    margin: 0,
  },
  // Upload Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#0f172a',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    border: '1px solid #1e293b',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
  },
  modalClose: {
    padding: '4px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: '#64748b',
    cursor: 'pointer',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 500,
    color: '#e2e8f0',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  fileDropzone: {
    border: '2px dashed #334155',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  fileDropzoneActive: {
    borderColor: '#0ea5e9',
    background: 'rgba(14, 165, 233, 0.1)',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#1e293b',
    borderRadius: '8px',
  },
  progressBar: {
    height: '8px',
    background: '#1e293b',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: {
    height: '100%',
    background: '#0ea5e9',
    transition: 'width 0.3s',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#94a3b8',
    fontWeight: 500,
    cursor: 'pointer',
  },
  submitButton: {
    flex: 1,
    padding: '12px',
    background: '#0ea5e9',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  submitButtonDisabled: {
    background: '#334155',
    cursor: 'not-allowed',
  },
};

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

export function RecordingsPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  
  // State
  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>('cloud');
  const [cloudRecordings, setCloudRecordings] = useState<CloudRecording[]>([]);
  const [localRecordings, setLocalRecordings] = useState<LocalRecording[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(true);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDuration, setUploadDuration] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);

  // Load cloud recordings
  useEffect(() => {
    loadCloudRecordings();
  }, []);

  // Load local recordings from localStorage
  useEffect(() => {
    loadLocalRecordings();
  }, []);

  const loadCloudRecordings = async () => {
    setIsLoadingCloud(true);
    setError(null);
    try {
      const data = await recordingsApi.getRecordings();
      setCloudRecordings(data);
    } catch (err) {
      console.error('Failed to load cloud recordings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recordings');
    } finally {
      setIsLoadingCloud(false);
    }
  };

  const loadLocalRecordings = () => {
    setIsLoadingLocal(true);
    try {
      const stored = localStorage.getItem('local_recordings');
      if (stored) {
        const recordings = JSON.parse(stored);
        // Convert stored data back to LocalRecording format
        const localRecs: LocalRecording[] = recordings.map((r: LocalRecording & { blobData?: string }) => ({
          id: r.id,
          filename: r.filename,
          title: r.title,
          duration: r.duration,
          createdAt: r.createdAt,
          size: r.size,
          uploaded: r.uploaded,
        }));
        setLocalRecordings(localRecs);
      }
    } catch (err) {
      console.error('Failed to load local recordings:', err);
    } finally {
      setIsLoadingLocal(false);
    }
  };

  const saveLocalRecordings = (recordings: LocalRecording[]) => {
    // Store without blob (can't serialize)
    const toStore = recordings.map(r => ({
      ...r,
      blob: undefined,
    }));
    localStorage.setItem('local_recordings', JSON.stringify(toStore));
  };

  const handleDeleteCloud = async (id: number) => {
    if (!confirm('Are you sure you want to delete this recording from the cloud?')) return;
    
    try {
      await recordingsApi.deleteRecording(id);
      setCloudRecordings(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete recording');
    }
  };

  const handleDeleteLocal = (id: string) => {
    if (!confirm('Are you sure you want to delete this local recording?')) return;
    
    const updated = localRecordings.filter(r => r.id !== id);
    setLocalRecordings(updated);
    saveLocalRecordings(updated);
  };

  const handleUploadLocal = () => {
    setShowUploadModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select a valid audio file (MP3, WAV, OGG, WebM, M4A)');
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('File size must be less than 500MB');
      return;
    }

    setUploadError(null);
    setUploadFile(file);

    // Get duration
    const audio = new Audio(URL.createObjectURL(file));
    audio.addEventListener('loadedmetadata', () => {
      setUploadDuration(Math.floor(audio.duration));
    });
  };

  const handleSubmitUpload = async () => {
    if (!uploadTitle.trim() || !uploadFile || uploadDuration <= 0) {
      setUploadError('Please fill in all required fields');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const result = await recordingsApi.uploadRecording(
        uploadFile,
        uploadTitle.trim(),
        uploadDescription.trim(),
        uploadDuration
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Add to cloud recordings
      const newCloudRecording: CloudRecording = {
        id: Date.now(),
        title: uploadTitle.trim(),
        description: uploadDescription.trim(),
        duration_seconds: uploadDuration,
        created_at: new Date().toISOString(),
        recording_url: result.recording_url,
      };

      setCloudRecordings(prev => [newCloudRecording, ...prev]);

      // Close modal and reset
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadTitle('');
        setUploadDescription('');
        setUploadFile(null);
        setUploadDuration(0);
        setUploadProgress(0);
      }, 500);

    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload recording');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderCloudRecordings = () => {
    if (isLoadingCloud) {
      return (
        <div style={styles.loadingContainer}>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
          <Loader2 style={styles.spinner} />
        </div>
      );
    }

    if (cloudRecordings.length === 0) {
      return (
        <div style={styles.emptyState}>
          <Cloud style={styles.emptyIcon} />
          <p style={styles.emptyText}>No recordings in the cloud</p>
        </div>
      );
    }

    return (
      <div style={styles.grid}>
        {cloudRecordings.map((recording) => (
          <div key={recording.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.thumbnail}>
                <FileAudio size={32} color="#38bdf8" />
              </div>
              <div style={styles.cardContent}>
                <h3 style={styles.cardTitle}>{recording.title}</h3>
                {recording.description && (
                  <p style={styles.cardDescription}>{recording.description}</p>
                )}
                <div style={styles.cardMeta}>
                  <span>{formatDate(recording.created_at)}</span>
                  <span>{formatDuration(recording.duration_seconds)}</span>
                  {recording.replay_count !== undefined && (
                    <span>{recording.replay_count} plays</span>
                  )}
                </div>
              </div>
            </div>
            <div style={styles.cardActions}>
              {recording.recording_url && (
                <button
                  onClick={() => window.open(recording.recording_url, '_blank')}
                  style={styles.actionButton}
                  title="Play"
                >
                  <Play size={18} />
                </button>
              )}
              <button
                onClick={() => handleDeleteCloud(recording.id)}
                style={styles.actionButton}
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLocalRecordings = () => {
    if (isLoadingLocal) {
      return (
        <div style={styles.loadingContainer}>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
          <Loader2 style={styles.spinner} />
        </div>
      );
    }

    if (localRecordings.length === 0) {
      return (
        <div style={styles.emptyState}>
          <HardDrive style={styles.emptyIcon} />
          <p style={styles.emptyText}>No local recordings</p>
          <button
            onClick={handleUploadLocal}
            style={{ ...styles.uploadButton, marginTop: '16px' }}
          >
            <Plus size={18} />
            Upload Recording
          </button>
        </div>
      );
    }

    return (
      <div style={styles.grid}>
        {localRecordings.map((recording) => (
          <div key={recording.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.thumbnail}>
                <FileAudio size={32} color="#38bdf8" />
              </div>
              <div style={styles.cardContent}>
                <h3 style={styles.cardTitle}>{recording.title}</h3>
                <p style={styles.cardDescription}>{recording.filename}</p>
                <div style={styles.cardMeta}>
                  <span>{formatDate(recording.createdAt)}</span>
                  <span>{formatDuration(recording.duration)}</span>
                  <span>{formatFileSize(recording.size)}</span>
                </div>
              </div>
            </div>
            <div style={styles.cardActions}>
              <span style={{
                ...styles.statusBadge,
                ...(recording.uploaded ? styles.statusUploaded : styles.statusPending),
              }}>
                {recording.uploaded ? (
                  <><CheckCircle size={12} /> Uploaded</>
                ) : (
                  <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Pending</>
                )}
              </span>
              <button
                onClick={() => handleDeleteLocal(recording.id)}
                style={styles.actionButton}
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={handleUploadLocal}
          style={styles.uploadLocalButton}
        >
          <Plus size={18} />
          Upload Recording
        </button>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            onClick={() => navigate('/')}
            style={styles.backButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1e293b';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={styles.title}>Recordings</h1>
        </div>
        <div style={styles.headerRight}>
          <button
            onClick={() => activeTab === 'cloud' ? loadCloudRecordings() : loadLocalRecordings()}
            style={styles.refreshButton}
            title="Refresh"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={handleUploadLocal}
            style={styles.uploadButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0284c7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0ea5e9';
            }}
          >
            <Upload size={18} />
            Upload
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Error Message */}
        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={20} color="#fca5a5" />
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab('cloud')}
            style={{
              ...styles.tab,
              ...(activeTab === 'cloud' ? styles.tabActive : {}),
            }}
          >
            <Cloud size={18} />
            Cloud Recordings
            <span style={{
              background: activeTab === 'cloud' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
            }}>
              {cloudRecordings.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('local')}
            style={{
              ...styles.tab,
              ...(activeTab === 'local' ? styles.tabActive : {}),
            }}
          >
            <HardDrive size={18} />
            Local Recordings
            <span style={{
              background: activeTab === 'local' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
            }}>
              {localRecordings.length}
            </span>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'cloud' ? renderCloudRecordings() : renderLocalRecordings()}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Upload Recording</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                style={styles.modalClose}
              >
                <X size={20} />
              </button>
            </div>

            {uploadError && (
              <div style={styles.errorBox}>
                <AlertCircle size={18} color="#fca5a5" />
                <p style={styles.errorText}>{uploadError}</p>
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Audio File *</label>
              {!uploadFile ? (
                <div
                  style={styles.fileDropzone}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0ea5e9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#334155';
                  }}
                >
                  <FileAudio size={32} color="#64748b" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: '#94a3b8', margin: 0 }}>
                    Click to select audio file
                  </p>
                  <p style={{ color: '#475569', fontSize: '12px', margin: '8px 0 0' }}>
                    MP3, WAV, OGG, WebM, M4A (max 500MB)
                  </p>
                </div>
              ) : (
                <div style={styles.fileInfo}>
                  <FileAudio size={24} color="#38bdf8" />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#e2e8f0' }}>
                      {uploadFile.name}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                      {formatFileSize(uploadFile.size)} • {formatDuration(uploadDuration)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setUploadFile(null);
                      setUploadDuration(0);
                    }}
                    style={styles.modalClose}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Title *</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Enter recording title"
                style={styles.input}
                maxLength={100}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Describe your recording..."
                style={{ ...styles.input, resize: 'vertical', minHeight: '80px' }}
                maxLength={500}
              />
            </div>

            {isUploading && (
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${uploadProgress}%` }} />
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowUploadModal(false)}
                style={styles.cancelButton}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitUpload}
                style={{
                  ...styles.submitButton,
                  ...(isUploading || !uploadFile || !uploadTitle.trim() ? styles.submitButtonDisabled : {}),
                }}
                disabled={isUploading || !uploadFile || !uploadTitle.trim()}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecordingsPage;