import { useState, useRef, useCallback } from 'react';

export interface StreamRecorderOptions {
  onRecordingReady?: (blob: Blob, filename: string) => void;
  onUploadComplete?: (recordingUrl: string) => void;
  onUploadError?: (error: Error) => void;
  onAutoUploadComplete?: (recordingUrl: string) => void;
}

export interface StreamRecorderState {
  wantsToRecord: boolean | null;
  isRecording: boolean;
  recordingDuration: number;
  recordedBlob: Blob | null;
  recordedFilename: string | null;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  streamSlug: string | null;
  autoUpload: boolean;
  isUploaded: boolean;
}

export interface StreamRecorderReturn {
  state: StreamRecorderState;
  promptRecording: () => void;
  acceptRecording: () => void;
  acceptRecordingWithAutoUpload: () => void;
  declineRecording: () => void;
  startRecording: (stream: MediaStream, streamSlug: string, streamTitle: string) => void;
  stopRecording: () => void;
  uploadRecording: () => Promise<void>;
  downloadRecording: () => void;
  reset: () => void;
  shouldPromptRecording: boolean;
}

export function useStreamRecorder(options: StreamRecorderOptions = {}): StreamRecorderReturn {
  const { onRecordingReady, onUploadComplete, onUploadError, onAutoUploadComplete } = options;

  const [state, setState] = useState<StreamRecorderState>({
    wantsToRecord: null,
    isRecording: false,
    recordingDuration: 0,
    recordedBlob: null,
    recordedFilename: null,
    isUploading: false,
    uploadProgress: 0,
    error: null,
    streamSlug: null,
    autoUpload: false,
    isUploaded: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const recordedFilenameRef = useRef<string | null>(null);
  const streamTitleRef = useRef<string>('');
  const streamSlugRef = useRef<string | null>(null);

  const getSupportedMimeType = useCallback((): string => {
    const mimeTypes = [
      'audio/mp4',
      'audio/x-m4a',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/wav',
    ];

    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const promptRecording = useCallback(() => {
    setState(prev => ({
      ...prev,
      wantsToRecord: null,
      error: null,
    }));
  }, []);

  const acceptRecording = useCallback(() => {
    setState(prev => ({
      ...prev,
      wantsToRecord: true,
      autoUpload: false,
    }));
  }, []);

  const acceptRecordingWithAutoUpload = useCallback(() => {
    setState(prev => ({
      ...prev,
      wantsToRecord: true,
      autoUpload: true,
    }));
  }, []);

  const declineRecording = useCallback(() => {
    setState(prev => ({
      ...prev,
      wantsToRecord: false,
      autoUpload: false,
    }));
  }, []);

  const startRecording = useCallback((stream: MediaStream, streamSlug: string, streamTitle: string) => {
    if (state.wantsToRecord !== true) return;
    if (state.isRecording) return;

    try {
      streamSlugRef.current = streamSlug;
      streamTitleRef.current = streamTitle;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const destNode = audioContext.createMediaStreamDestination();
      destNodeRef.current = destNode;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(destNode);

      const recordingStream = destNode.stream;
      const mimeType = getSupportedMimeType();

      const mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        let extension = 'webm';
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
          extension = 'm4a';
        } else if (mimeType.includes('wav')) {
          extension = 'wav';
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeTitle = streamTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        const filename = `recording_${safeTitle}_${timestamp}.${extension}`;

        recordedBlobRef.current = blob;
        recordedFilenameRef.current = filename;

        setState(prev => ({
          ...prev,
          recordedBlob: blob,
          recordedFilename: filename,
          isRecording: false,
        }));

        onRecordingReady?.(blob, filename);

        if (!state.autoUpload) {
          downloadBlob(blob, filename);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;

      mediaRecorder.start(1000);

      timerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          recordingDuration: prev.recordingDuration + 1,
        }));
      }, 1000);

      setState(prev => ({
        ...prev,
        isRecording: true,
        recordingDuration: 0,
        streamSlug,
        error: null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        wantsToRecord: false,
      }));
    }
  }, [state.wantsToRecord, state.isRecording, state.autoUpload, getSupportedMimeType, onRecordingReady]);

  const stopRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const shouldAutoUpload = state.autoUpload;
    const currentStreamSlug = streamSlugRef.current;
    const currentStreamTitle = streamTitleRef.current;

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    destNodeRef.current = null;
    streamRef.current = null;

    setState(prev => ({
      ...prev,
      isRecording: false,
    }));

    if (shouldAutoUpload && currentStreamSlug) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const blob = recordedBlobRef.current;
      const filename = recordedFilenameRef.current;
      
      if (blob && filename && currentStreamSlug) {
        setState(prev => ({
          ...prev,
          isUploading: true,
          uploadProgress: 0,
        }));

        try {
          const blobType = blob.type || 'audio/mp4';
          const file = new File([blob], filename, { type: blobType });
          console.log('Auto-upload ready:', currentStreamSlug, currentStreamTitle, state.recordingDuration);
          onAutoUploadComplete?.('upload initiated');
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to auto-upload recording');
          setState(prev => ({
            ...prev,
            isUploading: false,
            uploadProgress: 0,
            error: error.message,
          }));
          onUploadError?.(error);
        }
      }
    }
  }, [state.autoUpload, state.recordingDuration, onUploadComplete, onUploadError, onAutoUploadComplete]);

  const downloadRecording = useCallback(() => {
    if (!state.recordedBlob || !state.recordedFilename) {
      setState(prev => ({
        ...prev,
        error: 'No recording available to download',
      }));
      return;
    }
    downloadBlob(state.recordedBlob, state.recordedFilename);
  }, [state.recordedBlob, state.recordedFilename]);

  const uploadRecording = useCallback(async () => {
    if (!state.recordedBlob || !state.recordedFilename || !state.streamSlug) {
      const error = new Error('No recording available or stream slug missing');
      setState(prev => ({ ...prev, error: error.message }));
      onUploadError?.(error);
      return;
    }

    setState(prev => ({
      ...prev,
      isUploading: true,
      uploadProgress: 0,
      error: null,
    }));

    try {
      const blobType = state.recordedBlob.type || 'audio/mp4';
      const file = new File([state.recordedBlob], state.recordedFilename, { type: blobType });
      console.log('Upload ready:', state.streamSlug);
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 100,
      }));
      onUploadComplete?.('upload completed');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to upload recording');
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
        error: error.message,
      }));
      onUploadError?.(error);
    }
  }, [state.recordedBlob, state.recordedFilename, state.streamSlug, onUploadComplete, onUploadError]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];
    streamRef.current = null;
    destNodeRef.current = null;

    setState({
      wantsToRecord: null,
      isRecording: false,
      recordingDuration: 0,
      recordedBlob: null,
      recordedFilename: null,
      isUploading: false,
      uploadProgress: 0,
      error: null,
      streamSlug: null,
      autoUpload: false,
      isUploaded: false,
    });
  }, []);

  const shouldPromptRecording = state.wantsToRecord === null;

  return {
    state,
    promptRecording,
    acceptRecording,
    acceptRecordingWithAutoUpload,
    declineRecording,
    startRecording,
    stopRecording,
    uploadRecording,
    downloadRecording,
    reset,
    shouldPromptRecording,
  };
}

export function formatRecordingDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default useStreamRecorder;
