// Local voice-memo store. Persists to ~/.chappie/notes.json as a flat array
// so users can hand-edit if needed. Newest-first ordering, naive case-fold
// substring search — good enough for an MVP voice memo. Embedding/RAG can
// come later if recall quality becomes the bottleneck.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: u32,
    pub text: String,
    pub created_at_unix_ms: i64,
}

static NOTES: Lazy<Mutex<Vec<Note>>> = Lazy::new(|| Mutex::new(Vec::new()));
static NEXT_ID: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(1));
static LOADED: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

fn store_path() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    let _ = std::fs::create_dir_all(&p);
    p.push("notes.json");
    Some(p)
}

fn ensure_loaded() {
    let mut loaded = LOADED.lock().unwrap();
    if *loaded {
        return;
    }
    *loaded = true;
    let Some(path) = store_path() else { return };
    let Ok(bytes) = std::fs::read(&path) else {
        return;
    };
    let Ok(entries): Result<Vec<Note>, _> = serde_json::from_slice(&bytes) else {
        eprintln!("[notes] failed to parse {}", path.display());
        return;
    };
    let max_id = entries.iter().map(|n| n.id).max().unwrap_or(0);
    *NEXT_ID.lock().unwrap() = max_id + 1;
    *NOTES.lock().unwrap() = entries;
}

fn persist_locked(notes: &[Note]) {
    let Some(path) = store_path() else { return };
    if let Ok(json) = serde_json::to_string_pretty(notes) {
        let _ = std::fs::write(path, json);
    }
}

pub fn add(text: String) -> Result<Note, String> {
    if text.trim().is_empty() {
        return Err("note text is empty".into());
    }
    ensure_loaded();
    let id = {
        let mut n = NEXT_ID.lock().unwrap();
        let v = *n;
        *n += 1;
        v
    };
    let note = Note {
        id,
        text,
        created_at_unix_ms: chrono::Local::now().timestamp_millis(),
    };
    let mut list = NOTES.lock().unwrap();
    list.push(note.clone());
    persist_locked(&list);
    Ok(note)
}

pub fn list(query: Option<&str>, limit: usize) -> Vec<Note> {
    ensure_loaded();
    let list = NOTES.lock().unwrap();
    let needle = query.map(|q| q.to_lowercase());
    let mut filtered: Vec<Note> = list
        .iter()
        .filter(|n| match &needle {
            Some(q) if !q.trim().is_empty() => n.text.to_lowercase().contains(q),
            _ => true,
        })
        .cloned()
        .collect();
    filtered.sort_by(|a, b| b.created_at_unix_ms.cmp(&a.created_at_unix_ms));
    filtered.truncate(limit);
    filtered
}

pub fn delete(id: u32) -> bool {
    ensure_loaded();
    let mut list = NOTES.lock().unwrap();
    let before = list.len();
    list.retain(|n| n.id != id);
    let removed = list.len() != before;
    if removed {
        persist_locked(&list);
    }
    removed
}
