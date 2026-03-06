import { useState, useEffect } from 'react';
import { Play, Trash2, Upload, FolderOpen, FileAudio, Loader2, RefreshCw } from 'lucide-react';
import { recordingsApi } from '../../lib/api/recordings';

interface Recording {
  id: number;
  title: string;
  description?: string;
  duration_seconds?: number;
  created_at: string;
  recording_url?: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 8,
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    transition: 'all 0.15s',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#fca5a5',
    margin: 0,
  },
  emptyState: {
    textAlign: 'center',
    padding: 48,
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
  grid: {
    display: 'grid',
    gap: 16,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 16,
    border: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  thumbnail: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbnailIcon: {
    width: 32,
    height: 32,
    color: '#38bdf8',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: '#ffffff',
    fontWeight: 500,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748b',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
    fontSize: 11,
    color: '#475569',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 8,
    color: '#64748b',
    cursor: 'pointer',
    display: 'flex',
    transition: 'all 0.15s',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 256,
  },
  spinner: {
    width: 32,
    height: 32,
    color: '#0ea5e9',
    animation: 'spin 1s linear infinite',
  },
};

export function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await recordingsApi.getRecordings();
      setRecordings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    
    try {
      await recordingsApi.deleteRecording(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
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

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <Loader2 style={styles.spinner} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Recordings</h1>
        <button
          onClick={loadRecordings}
          style={styles.refreshButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1e293b';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <p style={styles.errorText}>{error}</p>
        </div>
      )}

      {recordings.length === 0 ? (
        <div style={styles.emptyState}>
          <FileAudio style={styles.emptyIcon} />
          <p style={styles.emptyText}>No recordings yet</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {recordings.map((recording) => (
            <div
              key={recording.id}
              style={styles.card}
            >
              <div style={styles.thumbnail}>
                <FileAudio style={styles.thumbnailIcon} />
              </div>
              
              <div style={styles.content}>
                <h3 style={styles.cardTitle}>{recording.title}</h3>
                {recording.description && (
                  <p style={styles.cardDescription}>{recording.description}</p>
                )}
                <div style={styles.cardMeta}>
                  <span>{formatDate(recording.created_at)}</span>
                  <span>{formatDuration(recording.duration_seconds)}</span>
                </div>
              </div>

              <div style={styles.actions}>
                {recording.recording_url && (
                  <button
                    onClick={() => window.open(recording.recording_url, '_blank')}
                    style={styles.actionButton}
                    title="Play"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#1e293b';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    <Play size={20} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(recording.id)}
                  style={styles.actionButton}
                  title="Delete"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1e293b';
                    e.currentTarget.style.color = '#f87171';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecordingsPage;
