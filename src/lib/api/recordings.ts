import { useAuthStore } from '../../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api-dev.volantislive.com';

// Helper to get the access token from auth store
const getAccessToken = (): string | null => {
  return useAuthStore.getState().accessToken;
};

interface Recording {
  id: number;
  company_id: number;
  company_slug?: string | null;
  company_name?: string | null;
  company_logo_url?: string | null;
  livestream_id: number | null;
  title: string;
  description: string | null;
  s3_url: string;
  streaming_url: string;
  duration_seconds: number | null;
  file_size_bytes: number;
  is_processed: boolean;
  thumbnail_url: string | null;
  created_at: string;
  replay_count?: number;
  recording_url?: string;
}

interface UploadResponse {
  recording_url: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();
  
  const headers: HeadersInit = {
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

async function requestFormData<T>(
  endpoint: string,
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<T> {
  const token = getAccessToken();
  
  const headers: HeadersInit = {};
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Failed to parse response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed: Network error'));
    });
    
    xhr.open('POST', `${API_BASE_URL}${endpoint}`);
    
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    xhr.send(formData);
  });
}

export const recordingsApi = {
  async getRecordings(limit = 50, offset = 0): Promise<Recording[]> {
    return request<Recording[]>(
      `/recordings?limit=${limit}&offset=${offset}`
    );
  },

  async getRecording(recordingId: number): Promise<Recording> {
    return request<Recording>(`/recordings/${recordingId}`);
  },

  async uploadRecording(
    file: File,
    title: string,
    description?: string,
    durationSeconds?: number,
    thumbnail?: File
  ): Promise<Recording> {
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (durationSeconds) formData.append('duration_seconds', durationSeconds.toString());
    formData.append('file', file);
    if (thumbnail) formData.append('thumbnail', thumbnail);

    return requestFormData<Recording>('/recordings/upload', formData);
  },

  async deleteRecording(recordingId: number): Promise<void> {
    await request(`/recordings/${recordingId}`, { method: 'DELETE' });
  },

  async getRecordingStats(recordingId: number): Promise<{ recording_id: number; replay_count: number }> {
    return request(`/recordings/public/${recordingId}/stats`);
  },

  async getRecordingForPlayback(recordingId: number): Promise<Recording & { replay_count: number }> {
    return request(`/recordings/public/${recordingId}`);
  },
};

export default recordingsApi;
