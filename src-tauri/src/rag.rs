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

/// Binary record layout: 8 bytes LE i64 timestamp + EMBEDDING_DIM × f32
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
    while f.read_exact(&mut buf).is_ok() {
        let mut ts_bytes = [0u8; 8];
        ts_bytes.copy_from_slice(&buf[..8]);
        let ts = i64::from_le_bytes(ts_bytes);
        let mut emb = Vec::with_capacity(EMBEDDING_DIM);
        for i in 0..EMBEDDING_DIM {
            let off = 8 + i * 4;
            let b: [u8; 4] = [buf[off], buf[off + 1], buf[off + 2], buf[off + 3]];
            emb.push(f32::from_le_bytes(b));
        }
        out.insert(ts, emb);
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

/// Minimum cosine similarity for a past turn to be worth injecting.
/// Better to inject nothing than to inject noise. 0.75 is conservative
/// for e5, which has a very high baseline similarity even between
/// unrelated sentences.
const SIM_THRESHOLD: f32 = 0.75;

/// Days of recent history owned by the L2 daily-summary layer. Turns
/// newer than this are already in the prompt by another route, so RAG
/// skips them (`today` included).
const RECENT_DAYS: i64 = 7;

/// Whether a turn from `date` belongs to RAG rather than to the daily
/// summaries. Split out from `recall` so the boundary is testable
/// without an embedding model.
fn is_recallable(date: NaiveDate, today: NaiveDate) -> bool {
    date < today - Duration::days(RECENT_DAYS)
}

/// Take scored candidates and pick what actually goes in the prompt:
/// drop anything under the threshold, keep the `k` best, then restore
/// chronological order so the prompt reads oldest-first.
fn select_recalls(mut scored: Vec<(f32, &IndexedTurn)>, k: usize) -> Vec<&IndexedTurn> {
    scored.retain(|(s, _)| *s >= SIM_THRESHOLD);
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);
    scored.sort_by_key(|(_, t)| t.ts);
    scored.into_iter().map(|(_, t)| t).collect()
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
    let today = Local::now().date_naive();
    let Ok(guard) = INDEX.read() else {
        return Vec::new();
    };
    let scored: Vec<(f32, &IndexedTurn)> = guard
        .iter()
        .filter(|t| is_recallable(t.date, today))
        .map(|t| (embedding::cosine_normalized(&q_emb, &t.embedding), t))
        .collect();
    select_recalls(scored, k).into_iter().cloned().collect()
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
        "現在の話題と関連がありそうな過去のやり取り（自然な流れで活かして良いが、機械的に切り出さない）:\n\n{body}"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).expect("valid date")
    }

    fn turn(ts: i64, date: NaiveDate) -> IndexedTurn {
        IndexedTurn {
            date,
            ts,
            text: format!("turn {ts}"),
            embedding: vec![0.0; EMBEDDING_DIM],
        }
    }

    #[test]
    fn combined_text_trims_and_labels_both_halves() {
        assert_eq!(
            combined_text("  ラーメン食べたい  ", "\nとんこつですね\n"),
            "User: ラーメン食べたい\nAssistant: とんこつですね"
        );
    }

    #[test]
    fn combined_text_keeps_a_half_that_is_empty() {
        // A turn with only one side still carries topic signal, so it is
        // indexed rather than dropped.
        assert_eq!(combined_text("hello", "   "), "User: hello\nAssistant: ");
    }

    #[test]
    fn combined_text_is_empty_only_when_both_halves_are() {
        assert_eq!(combined_text("   ", "\n\t"), "");
    }

    #[test]
    fn is_recallable_excludes_the_window_owned_by_daily_summaries() {
        let today = day(2026, 8, 24);
        // Exactly RECENT_DAYS back is still the summary layer's.
        assert!(!is_recallable(day(2026, 8, 17), today));
        assert!(is_recallable(day(2026, 8, 16), today));
        assert!(!is_recallable(today, today));
    }

    #[test]
    fn select_recalls_drops_hits_under_the_threshold() {
        let a = turn(1, day(2026, 1, 1));
        let b = turn(2, day(2026, 1, 2));
        let picked = select_recalls(vec![(0.74, &a), (SIM_THRESHOLD, &b)], 5);
        assert_eq!(picked.iter().map(|t| t.ts).collect::<Vec<_>>(), vec![2]);
    }

    #[test]
    fn select_recalls_keeps_the_k_best_then_restores_chronological_order() {
        let old_weak = turn(10, day(2026, 1, 1));
        let mid_best = turn(20, day(2026, 1, 2));
        let new_good = turn(30, day(2026, 1, 3));
        let picked = select_recalls(
            vec![(0.80, &old_weak), (0.99, &mid_best), (0.90, &new_good)],
            2,
        );
        // 0.80 loses to the other two; survivors come back oldest-first.
        assert_eq!(
            picked.iter().map(|t| t.ts).collect::<Vec<_>>(),
            vec![20, 30]
        );
    }

    #[test]
    fn select_recalls_returns_nothing_when_all_hits_are_noise() {
        let a = turn(1, day(2026, 1, 1));
        assert!(select_recalls(vec![(0.1, &a)], 3).is_empty());
    }

    #[test]
    fn records_survive_a_write_read_roundtrip() {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "chappie-rag-roundtrip-{}.emb.bin",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&path);

        let mut first = vec![0.0f32; EMBEDDING_DIM];
        first[0] = 0.5;
        first[EMBEDDING_DIM - 1] = -0.25;
        let mut second = vec![0.0f32; EMBEDDING_DIM];
        second[1] = 1.0;

        write_record(&path, 1_700_000_000_000, &first).expect("write first");
        write_record(&path, 1_700_000_001_000, &second).expect("append second");

        let back = read_all_records(&path);
        let _ = std::fs::remove_file(&path);

        assert_eq!(back.len(), 2);
        assert_eq!(back.get(&1_700_000_000_000), Some(&first));
        assert_eq!(back.get(&1_700_000_001_000), Some(&second));
    }

    #[test]
    fn read_all_records_is_empty_for_a_missing_file() {
        let mut path = std::env::temp_dir();
        path.push(format!("chappie-rag-absent-{}.emb.bin", std::process::id()));
        let _ = std::fs::remove_file(&path);
        assert!(read_all_records(&path).is_empty());
    }
}
