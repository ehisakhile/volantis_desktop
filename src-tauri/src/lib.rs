use std::path::PathBuf;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Get the recordings directory path (Documents/Volantislive/myRecordings)
#[tauri::command]
fn get_recordings_dir() -> Result<String, String> {
    let documents_dir = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?;
    
    let recordings_dir = documents_dir.join("Volantislive").join("myRecordings");
    
    // Create directory if it doesn't exist
    if !recordings_dir.exists() {
        std::fs::create_dir_all(&recordings_dir)
            .map_err(|e| format!("Failed to create recordings directory: {}", e))?;
    }
    
    recordings_dir.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path".to_string())
}

/// Save a recording blob to the recordings directory
#[tauri::command]
fn save_recording(filename: String, data: Vec<u8>) -> Result<String, String> {
    let documents_dir = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?;
    
    let recordings_dir = documents_dir.join("Volantislive").join("myRecordings");
    
    // Create directory if it doesn't exist
    if !recordings_dir.exists() {
        std::fs::create_dir_all(&recordings_dir)
            .map_err(|e| format!("Failed to create recordings directory: {}", e))?;
    }
    
    let file_path = recordings_dir.join(&filename);
    
    std::fs::write(&file_path, data)
        .map_err(|e| format!("Failed to save recording: {}", e))?;
    
    file_path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid path".to_string())
}

/// List all recordings in the recordings directory
#[tauri::command]
fn list_recordings() -> Result<Vec<RecordingInfo>, String> {
    let documents_dir = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?;
    
    let recordings_dir = documents_dir.join("Volantislive").join("myRecordings");
    
    if !recordings_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut recordings = Vec::new();
    
    let entries = std::fs::read_dir(&recordings_dir)
        .map_err(|e| format!("Failed to read recordings directory: {}", e))?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(extension) = path.extension() {
                    let ext = extension.to_string_lossy().to_lowercase();
                    if ["webm", "wav", "mp3", "m4a", "ogg"].contains(&ext.as_str()) {
                        if let Some(filename) = path.file_name() {
                            let metadata = std::fs::metadata(&path)
                                .ok()
                                .map(|m| m.len())
                                .unwrap_or(0);
                            
                            let created = std::fs::metadata(&path)
                                .ok()
                                .and_then(|m| m.created().ok())
                                .map(|t| {
                                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                                    datetime.format("%Y-%m-%dT%H:%M:%S").to_string()
                                })
                                .unwrap_or_default();
                            
                            recordings.push(RecordingInfo {
                                filename: filename.to_string_lossy().to_string(),
                                path: path.to_string_lossy().to_string(),
                                size_bytes: metadata,
                                created_at: created,
                            });
                        }
                    }
                }
            }
        }
    }
    
    Ok(recordings)
}

/// Delete a recording file
#[tauri::command]
fn delete_recording(filename: String) -> Result<(), String> {
    let documents_dir = dirs::document_dir()
        .ok_or_else(|| "Could not find documents directory".to_string())?;
    
    let file_path = documents_dir.join("Volantislive").join("myRecordings").join(&filename);
    
    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete recording: {}", e))?;
    }
    
    Ok(())
}

#[derive(serde::Serialize)]
struct RecordingInfo {
    filename: String,
    path: String,
    size_bytes: u64,
    created_at: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_recordings_dir,
            save_recording,
            list_recordings,
            delete_recording
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
