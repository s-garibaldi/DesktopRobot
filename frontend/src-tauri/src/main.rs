// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
struct MemoryItem {
    id: String,
    timestamp: u64,
    agent_type: String,
    topic: String,
    content: String,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MemoryStore {
    memories: Vec<MemoryItem>,
}

fn get_memories_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    
    Ok(app_data_dir.join("memories.json"))
}

#[tauri::command]
fn save_memory(
    app: tauri::AppHandle,
    id: String,
    timestamp: u64,
    agent_type: String,
    topic: String,
    content: String,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    let file_path = get_memories_file_path(&app)?;
    
    // Load existing memories
    let mut memory_store = if file_path.exists() {
        let file_contents = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read memories file: {}", e))?;
        serde_json::from_str::<MemoryStore>(&file_contents)
            .unwrap_or_else(|_| MemoryStore { memories: vec![] })
    } else {
        MemoryStore { memories: vec![] }
    };
    
    // Check if memory with this ID already exists and update it, otherwise add new
    if let Some(existing) = memory_store.memories.iter_mut().find(|m| m.id == id) {
        existing.timestamp = timestamp;
        existing.agent_type = agent_type;
        existing.topic = topic;
        existing.content = content;
        existing.tags = tags;
    } else {
        memory_store.memories.push(MemoryItem {
            id,
            timestamp,
            agent_type,
            topic,
            content,
            tags,
        });
    }
    
    // Sort by timestamp (newest first)
    memory_store.memories.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    // Save to file
    let json = serde_json::to_string_pretty(&memory_store)
        .map_err(|e| format!("Failed to serialize memories: {}", e))?;
    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write memories file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn load_memories(
    app: tauri::AppHandle,
    agent_type: Option<String>,
    topic: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<MemoryItem>, String> {
    let file_path = get_memories_file_path(&app)?;
    
    if !file_path.exists() {
        return Ok(vec![]);
    }
    
    let file_contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read memories file: {}", e))?;
    
    let memory_store: MemoryStore = serde_json::from_str(&file_contents)
        .map_err(|e| format!("Failed to parse memories file: {}", e))?;
    
    let mut memories = memory_store.memories;
    
    // Filter by agent_type if provided
    if let Some(agent) = agent_type {
        memories.retain(|m| m.agent_type == agent);
    }
    
    // Filter by topic if provided
    if let Some(t) = topic {
        memories.retain(|m| m.topic == t);
    }
    
    // Apply limit if provided
    if let Some(l) = limit {
        memories.truncate(l);
    }
    
    Ok(memories)
}

#[tauri::command]
fn delete_memory(app: tauri::AppHandle, memory_id: String) -> Result<(), String> {
    let file_path = get_memories_file_path(&app)?;
    
    if !file_path.exists() {
        return Ok(());
    }
    
    let file_contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read memories file: {}", e))?;
    
    let mut memory_store: MemoryStore = serde_json::from_str(&file_contents)
        .map_err(|e| format!("Failed to parse memories file: {}", e))?;
    
    // Remove memory with matching ID
    memory_store.memories.retain(|m| m.id != memory_id);
    
    // Save updated memories
    let json = serde_json::to_string_pretty(&memory_store)
        .map_err(|e| format!("Failed to serialize memories: {}", e))?;
    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write memories file: {}", e))?;
    
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_memory, load_memories, delete_memory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
