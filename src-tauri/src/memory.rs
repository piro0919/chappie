// Long-term memory store. Persists to ~/.chappie/memory.json so chappie
// can remember user-stated facts across sessions ("私は piro です",
// "息子の誕生日は 6/15"). Newest-first ordering, char-bigram overlap
// scoring for recall — good enough for the substring-RAG first pass.
// Embedding-based search can swap in behind the same `recall` signature
// later if recall quality becomes the bottleneck.
//
// Distinction from notes.rs: notes are explicit voice memos the user
// asked to keep verbatim. memory entries are LLM-curated profile bits
// the assistant decided are worth carrying forward — names, prefs,
// relationships, durable facts. Different stores so users can wipe one
// without losing the other.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// Durable identity facts (name, role, family, location).
    Profile,
    /// Preferences and dislikes.
    Preference,
    /// One-off events / promises / past statements worth recalling.
    Episode,
}

impl Kind {
    fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "profile" => Some(Self::Profile),
            "preference" => Some(Self::Preference),
            "episode" => Some(Self::Episode),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Profile => "profile",
            Self::Preference => "preference",
            Self::Episode => "episode",
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: u32,
    pub text: String,
    pub kind: Kind,
    pub created_at_unix_ms: i64,
    /// Last time `recall` returned this entry. Used to lightly boost
    /// memories the LLM has actually leaned on so they keep surfacing.
    pub last_recalled_at_unix_ms: Option<i64>,
}

static MEMORIES: Lazy<Mutex<Vec<Memory>>> = Lazy::new(|| Mutex::new(Vec::new()));
static NEXT_ID: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(1));
static LOADED: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

fn store_path() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    let _ = std::fs::create_dir_all(&p);
    p.push("memory.json");
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
    let Ok(entries): Result<Vec<Memory>, _> = serde_json::from_slice(&bytes) else {
        eprintln!("[memory] failed to parse {}", path.display());
        return;
    };
    let max_id = entries.iter().map(|m| m.id).max().unwrap_or(0);
    *NEXT_ID.lock().unwrap() = max_id + 1;
    *MEMORIES.lock().unwrap() = entries;
}

fn persist_locked(memories: &[Memory]) {
    let Some(path) = store_path() else { return };
    if let Ok(json) = serde_json::to_string_pretty(memories) {
        let _ = std::fs::write(path, json);
    }
}

/// Save a new memory. Dedupes on case-fold identical `text` to keep the
/// LLM from re-saving the same fact twice.
pub fn save(text: String, kind_str: &str) -> Result<Memory, String> {
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Err("memory text is empty".into());
    }
    let kind = Kind::parse(kind_str)
        .ok_or_else(|| format!("unknown kind: {kind_str} (expected profile|preference|episode)"))?;
    ensure_loaded();
    let mut list = MEMORIES.lock().unwrap();
    let folded = trimmed.to_lowercase();
    if let Some(existing) = list.iter().find(|m| m.text.to_lowercase() == folded) {
        return Ok(existing.clone());
    }
    let id = {
        let mut n = NEXT_ID.lock().unwrap();
        let v = *n;
        *n += 1;
        v
    };
    let memory = Memory {
        id,
        text: trimmed,
        kind,
        created_at_unix_ms: chrono::Local::now().timestamp_millis(),
        last_recalled_at_unix_ms: None,
    };
    list.push(memory.clone());
    persist_locked(&list);
    Ok(memory)
}

/// Char-bigram overlap. Works for both Japanese (no spaces) and English
/// without language detection. Returns a score in [0, 1] where 1 is
/// perfect overlap of all of `query`'s bigrams.
fn bigram_score(query_lc: &str, text_lc: &str) -> f32 {
    let qb = char_bigrams(query_lc);
    if qb.is_empty() {
        return 0.0;
    }
    let tb = char_bigrams(text_lc);
    if tb.is_empty() {
        return 0.0;
    }
    let hit = qb.iter().filter(|b| tb.contains(*b)).count();
    hit as f32 / qb.len() as f32
}

fn char_bigrams(s: &str) -> HashSet<[char; 2]> {
    let chars: Vec<char> = s.chars().filter(|c| !c.is_whitespace()).collect();
    if chars.len() < 2 {
        return HashSet::new();
    }
    chars.windows(2).map(|w| [w[0], w[1]]).collect()
}

/// Recall up to `limit` entries most relevant to `query`. Bumps each
/// returned entry's `last_recalled_at` timestamp so frequently-used
/// memories slowly drift to the top.
pub fn recall(query: &str, limit: usize) -> Vec<Memory> {
    ensure_loaded();
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Vec::new();
    }
    let mut list = MEMORIES.lock().unwrap();
    let now = chrono::Local::now().timestamp_millis();
    let mut scored: Vec<(f32, usize)> = list
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let base = bigram_score(&q, &m.text.to_lowercase());
            // Mild recency / recall-frequency bonus so two equally
            // relevant memories surface the more recently-touched one.
            // Small enough that a stronger semantic match always wins.
            let touched = m.last_recalled_at_unix_ms.unwrap_or(m.created_at_unix_ms);
            let age_days = ((now - touched) as f32 / 86_400_000.0).max(0.0);
            let recency_bonus = (-age_days / 30.0).exp() * 0.05;
            (base + recency_bonus, i)
        })
        .filter(|(s, _)| *s > 0.0)
        .collect();
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    let mut out = Vec::with_capacity(scored.len());
    for (_, idx) in &scored {
        list[*idx].last_recalled_at_unix_ms = Some(now);
        out.push(list[*idx].clone());
    }
    if !scored.is_empty() {
        persist_locked(&list);
    }
    out
}

/// All memories of a given kind (or all kinds if `None`), newest first.
pub fn list_all(kind: Option<&str>, limit: usize) -> Vec<Memory> {
    ensure_loaded();
    let kind_filter = kind.and_then(Kind::parse);
    let list = MEMORIES.lock().unwrap();
    let mut filtered: Vec<Memory> = list
        .iter()
        .filter(|m| kind_filter.map(|k| m.kind == k).unwrap_or(true))
        .cloned()
        .collect();
    filtered.sort_by(|a, b| b.created_at_unix_ms.cmp(&a.created_at_unix_ms));
    filtered.truncate(limit);
    filtered
}

pub fn forget(id: u32) -> bool {
    ensure_loaded();
    let mut list = MEMORIES.lock().unwrap();
    let before = list.len();
    list.retain(|m| m.id != id);
    let removed = list.len() != before;
    if removed {
        persist_locked(&list);
    }
    removed
}

/// Compact text summary of stable identity facts, suitable for injecting
/// into the LLM system prompt every turn. Only profile + preference are
/// included since episodes are too noisy to dump in the prompt — those
/// surface via `recall` instead. Returns an empty string if there's
/// nothing worth injecting.
pub fn profile_summary() -> String {
    ensure_loaded();
    let list = MEMORIES.lock().unwrap();
    let mut lines: Vec<&str> = list
        .iter()
        .filter(|m| matches!(m.kind, Kind::Profile | Kind::Preference))
        .map(|m| m.text.as_str())
        .collect();
    if lines.is_empty() {
        return String::new();
    }
    // Cap to keep the system prompt bounded — anything past this is
    // probably noise and should fall back to recall lookup.
    lines.truncate(40);
    let body = lines
        .iter()
        .map(|t| format!("- {t}"))
        .collect::<Vec<_>>()
        .join("\n");
    format!("ユーザーについて記憶していること（save_memory で蓄積）:\n{body}")
}

pub fn kind_label(k: Kind) -> &'static str {
    k.as_str()
}
