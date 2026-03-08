import { invoke } from '@tauri-apps/api/core';

export interface RecordingFileInfo {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

// Get the recordings directory path
export async function getRecordingsDir(): Promise<string> {
  return invoke<string>('get_recordings_dir');
}

// Save a recording to the recordings directory
export async function saveRecording(filename: string, data: Uint8Array): Promise<string> {
  return invoke<string>('save_recording', { filename, data: Array.from(data) });
}

// List all recordings in the recordings directory
export async function listRecordings(): Promise<RecordingFileInfo[]> {
  return invoke<RecordingFileInfo[]>('list_recordings');
}

// Delete a recording from the recordings directory
export async function deleteRecording(filename: string): Promise<void> {
  return invoke<void>('delete_recording', { filename });
}

// Save recording from Blob
export async function saveRecordingFromBlob(blob: Blob, filename: string): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  return saveRecording(filename, uint8Array);
}

export default {
  getRecordingsDir,
  saveRecording,
  saveRecordingFromBlob,
  listRecordings,
  deleteRecording,
};