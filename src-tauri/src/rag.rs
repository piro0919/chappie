// RAG layer for the long-term memory stack.
//
// Holds an in-memory index of embedded session-log turns so the system
// prompt can be enriched with "related past episodes" relevant to what
// the user is currently saying. Embedding model lives in embedding.rs;
// this module just orchestrates index build / refresh / search.
//
// Index lifecycle:
//   1. `init()` on startup: load all jsonl logs (session_log.rs), look
//      up persisted embeddings in `~/.chappie/log/<date>.emb.bin`, and
//      compute any that are missing (if the embedding model is loaded).
//   2. On each new turn: `index_turn(ts, text)` computes a fresh
//      embedding (in-process, blocking — fast enough at ~50ms) and
//      appends to both the in-memory Vec and the on-disk emb.bin.
//   3. `recall(query, k)` linearly scans for top-K cosine matches,
//      excluding the most recent 7 days (covered by the daily summary
//      layer L2) and "today" entries (the LLM already has the in-flight
//      conversation context for today).

use chrono::{Duration, Local, NaiveDate};
use once_cell::sync::Lazy;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::RwLock;

use crate::embedding::{self, EMBEDDING_DIM};
use crate::session_log;

/// One indexed turn. We store the joined user+assistant text so recall
/// surface both halves to the LLM (assistant's reply often anchors the
/// topic, e.g. "you said you liked tonkotsu ramen").
#[derive(Clone)]
struct IndexedTurn {
    date: NaiveDate,
    ts: i64,
    text: String,
    embedding: Vec<f32>,
}

static INDEX: Lazy<RwLock<Vec<IndexedTurn>>> = Lazy::new(|| RwLock::new(Vec::new()));

fn emb_dir() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    p.push("log");
    let _ = std::fs::create_dir_all(&p);
    Some(p)
}

fn emb_file_for(date: NaiveDate) -> Option<PathBuf> {
    let mut p = emb_dir()?;
    p.push(format!("{}.emb.bin", date.format("%Y-%m-%d")));
    Some(p)
}

/// Binary record layout: 8 bytes BE i64 timestamp + EMBEDDING_DIM × f32
/// little-endian = 8 + 1536 = 1544 bytes per record. Append-only.
const RECORD_BYTES: usize = 8 + EMBEDDING_DIM * 4;

fn write_record(path: &std::path::Path, ts: i64, emb: &[f32]) -> std::io::Result<()> {
    use std::fs::OpenOptions;
    let mut f = OpenOptions::new().create(true).append(true).open(path)?;
    let mut buf = Vec::with_capacity(RECORD_BYTES);
    buf.extend_from_slice(&ts.to_le_bytes());
    for v in emb {
        buf.extend_from_slice(&v.to_le_bytes());
    }
    f.write_all(&buf)
}

fn read_all_records(path: &std::path::Path) -> std::collections::HashMap<i64, Vec<f32>> {
    let mut out = std::collections::HashMap::new();
    let Ok(mut f) = std::fs::File::open(path) else {
        return out;
    };
    let mut buf = vec![0u8; RECORD_BYTES];
    loop {
        match f.read_exact(&mut buf) {
            Ok(_) => {
                let mut ts_bytes = [0u8; 8];
                ts_bytes.copy_from_slice(&buf[..8]);
                let ts = i64::from_le_bytes(ts_bytes);
                let mut emb = Vec::with_capacity(EMBEDDING_DIM);
                for i in 0..EMBEDDING_DIM {
                    let off = 8 + i * 4;
                    let b: [u8; 4] = [
                        buf[off],
                        buf[off + 1],
                        buf[off + 2],
                        buf[off + 3],
                    ];
                    emb.push(f32::from_le_bytes(b));
                }
                out.insert(ts, emb);
            }
            Err(_) => break,
        }
    }
    out
}

/// Load all jsonl logs, fill embeddings from on-disk cache, and compute
/// any missing ones (if the embedding model is loaded). Safe to call
/// multiple times — it rebuilds the index from scratch each time, which
/// is cheap enough for the expected log sizes.
pub fn init() {
    if embedding::ensure_loaded().is_err() {
        // Model not downloaded yet; leave the index empty. The first
        // chat_complete that fires after the user opts in will trigger
        // a download and a subsequent init() rebuild.
        return;
    }
    let dates = session_log::dates_with_logs();
    let mut new_index: Vec<IndexedTurn> = Vec::new();
    for date in dates {
        let Some(emb_path) = emb_file_for(date) else {
            continue;
        };
        let mut cache = read_all_records(&emb_path);
        let turns = session_log::load_date(date);
        for t in turns {
            let combined = combined_text(&t.user, &t.assistant);
            if combined.is_empty() {
                continue;
            }
            let emb = if let Some(e) = cache.remove(&t.ts) {
                e
            } else {
                let Some(e) = embedding::embed(&combined, false) else {
                    continue;
                };
                if let Err(err) = write_record(&emb_path, t.ts, &e) {
                    eprintln!("[rag] write emb {emb_path:?}: {err}");
                }
                e
            };
            new_index.push(IndexedTurn {
                date,
                ts: t.ts,
                text: combined,
                embedding: emb,
            });
        }
    }
    if let Ok(mut guard) = INDEX.write() {
        *guard = new_index;
    }
    eprintln!(
        "[rag] index ready: {} turns",
        INDEX.read().map(|g| g.len()).unwrap_or(0)
    );
}

fn combined_text(user: &str, assistant: &str) -> String {
    let u = user.trim();
    let a = assistant.trim();
    if u.is_empty() && a.is_empty() {
        return String::new();
    }
    format!("User: {u}\nAssistant: {a}")
}

/// Add a freshly-saved turn to the index. Called from session_log
/// append path so each conversation immediately becomes recall-able.
/// No-op if the embedding model isn't loaded.
pub fn index_turn(ts: i64, user: &str, assistant: &str) {
    if embedding::ensure_loaded().is_err() {
        return;
    }
    let combined = combined_text(user, assistant);
    if combined.is_empty() {
        return;
    }
    let Some(emb) = embedding::embed(&combined, false) else {
        return;
    };
    let date = Local::now().date_naive();
    if let Some(p) = emb_file_for(date) {
        let _ = write_record(&p, ts, &emb);
    }
    if let Ok(mut guard) = INDEX.write() {
        guard.push(IndexedTurn {
            date,
            ts,
            text: combined,
            embedding: emb,
        });
    }
}

/// Recall `k` semantically related past turns. Excludes anything from
/// the last 7 days (covered by daily summaries) and from today
/// (the live conversation already has it). Returns oldest-first so the
/// system prompt reads chronologically.
fn recall(query: &str, k: usize) -> Vec<IndexedTurn> {
    if embedding::ensure_loaded().is_err() {
        return Vec::new();
    }
    let Some(q_emb) = embedding::embed(query, true) else {
        return Vec::new();
    };
    let cutoff = Local::now().date_naive() - Duration::days(7);
    let Ok(guard) = INDEX.read() else {
        return Vec::new();
    };
    let mut scored: Vec<(f32, &IndexedTurn)> = guard
        .iter()
        .filter(|t| t.date < cutoff)
        .map(|t| (embedding::cosine_normalized(&q_emb, &t.embedding), t))
        .collect();
    // Drop low-similarity hits — better to inject nothing than to inject
    // noise. 0.75 is conservative for e5 (which has very high baseline
    // similarity even between unrelated sentences).
    scored.retain(|(s, _)| *s >= 0.75);
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);
    // Re-sort chronologically for natural reading order in the prompt.
    scored.sort_by_key(|(_, t)| t.ts);
    scored.into_iter().map(|(_, t)| t.clone()).collect()
}

/// Format up to `k` related past turns as a system-message body.
/// Returns empty string when nothing meets the similarity threshold.
pub fn recall_prompt(query: &str, k: usize) -> String {
    let hits = recall(query, k);
    if hits.is_empty() {
        return String::new();
    }
    let body = hits
        .iter()
        .map(|t| format!("【{}】\n{}", t.date, t.text))
        .collect::<Vec<_>>()
        .join("\n\n");
    format!(
        "現在の話題と関連がありそうな過去のやり取り（自然な流れで活かして良いが、機械的に切り出さない）:\n\n{}",
        body
    )
}
