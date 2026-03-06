const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Recording {
  id: number;
  title: string;
  description?: string;
  duration_seconds?: number;
  created_at: string;
  recording_url?: string;
}

interface RecordingsResponse {
  recordings: Recording[];
}

interface UploadResponse {
  recording_url: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');
  
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
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export const recordingsApi = {
  async getRecordings(limit = 50, offset = 0): Promise<Recording[]> {
    const data = await request<RecordingsResponse>(
      `/api/recordings?limit=${limit}&offset=${offset}`
    );
    return data.recordings;
  },

  async getRecording(recordingId: number): Promise<Recording> {
    return request<Recording>(`/api/recordings/${recordingId}`);
  },

  async uploadRecording(
    file: File,
    title: string,
    description?: string,
    durationSeconds?: number
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (durationSeconds) formData.append('duration_seconds', durationSeconds.toString());
    formData.append('file', file);

    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(`${API_BASE_URL}/api/recordings/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  },

  async deleteRecording(recordingId: number): Promise<void> {
    await request(`/api/recordings/${recordingId}`, { method: 'DELETE' });
  },
};

export default recordingsApi;
