// Text embedding via multilingual-e5-small ONNX.
//
// Used by rag.rs to build a semantic index over the persistent session
// log so chappie can recall "that conversation 3 weeks ago about ramen"
// across all 9 supported languages (e5 puts all of them in a shared
// 384-dim vector space, so cross-lingual recall is natural too).
//
// Model + tokenizer are downloaded on first opt-in (≈470 MB fp32 +
// ≈17 MB tokenizer.json) into `~/.chappie/models/`. We mirror
// speaker.rs's `OnceLock` lazy-load pattern so the audio pipeline isn't
// the only place that knows how to host an ONNX model.
//
// Tract notes: BERT-style models have dynamic sequence length and three
// int64 inputs (input_ids, attention_mask, token_type_ids). We build
// the symbolic graph once and create concrete tensors per call.

use crate::download::{download_with_progress, file_exists_nonempty};
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Runtime};
use tokenizers::Tokenizer;
use tract_onnx::prelude::*;

pub const EMBEDDING_DIM: usize = 384;

const MODEL_URL: &str =
    "https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/onnx/model.onnx";
const TOKENIZER_URL: &str =
    "https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/tokenizer.json";

/// Cap input to 256 tokens. e5 was trained at 512 but voice-turn
/// transcripts rarely exceed 100 tokens, and shorter inputs keep the
/// per-call inference cost flat.
const MAX_SEQ_LEN: usize = 256;

type Model = SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>;

static MODEL: OnceLock<Option<Model>> = OnceLock::new();
static TOKENIZER: OnceLock<Option<Tokenizer>> = OnceLock::new();

pub fn model_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".chappie/models/multilingual-e5-small.onnx"))
}

pub fn tokenizer_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".chappie/models/multilingual-e5-small-tokenizer.json"))
}

pub fn is_downloaded() -> bool {
    model_path().map(|p| p.exists()).unwrap_or(false)
        && tokenizer_path().map(|p| p.exists()).unwrap_or(false)
}

/// Download model + tokenizer if missing. Emits progress events under
/// the `embedding_model:*` namespace (kept separate from `speaker_model:*`
/// and `model:*` so the renderer can render distinct download UIs).
pub async fn ensure_model<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let m_path = model_path().ok_or_else(|| "no home dir".to_string())?;
    let t_path = tokenizer_path().ok_or_else(|| "no home dir".to_string())?;
    if !file_exists_nonempty(&m_path).await {
        download_with_progress(
            &app,
            MODEL_URL,
            &m_path,
            "embedding_model",
            Some(serde_json::json!({ "kind": "model" })),
        )
        .await?;
    }
    if !file_exists_nonempty(&t_path).await {
        download_with_progress(
            &app,
            TOKENIZER_URL,
            &t_path,
            "embedding_model",
            Some(serde_json::json!({ "kind": "tokenizer" })),
        )
        .await?;
    }
    let _ = app.emit(
        "embedding_model:ready",
        serde_json::json!({ "model": m_path.to_string_lossy(), "tokenizer": t_path.to_string_lossy() }),
    );
    Ok(())
}

/// Load model + tokenizer into the global slots. Idempotent. Returns
/// Err if either file is missing or tract fails to parse / optimize the
/// graph.
pub fn ensure_loaded() -> Result<(), String> {
    if MODEL.get().and_then(|m| m.as_ref()).is_some()
        && TOKENIZER.get().and_then(|t| t.as_ref()).is_some()
    {
        return Ok(());
    }
    let m_path = model_path().ok_or_else(|| "no home dir".to_string())?;
    let t_path = tokenizer_path().ok_or_else(|| "no home dir".to_string())?;
    if !m_path.exists() || !t_path.exists() {
        return Err("embedding model not downloaded".into());
    }

    // Tokenizer load is independent and cheap.
    if TOKENIZER.get().and_then(|t| t.as_ref()).is_none() {
        let tok = Tokenizer::from_file(&t_path)
            .map_err(|e| format!("tokenizer load: {e}"))?;
        let _ = TOKENIZER.set(Some(tok));
    }

    if MODEL.get().and_then(|m| m.as_ref()).is_none() {
        let plan = build_plan(&m_path)?;
        let _ = MODEL.set(Some(plan));
    }
    Ok(())
}

fn build_plan(path: &std::path::Path) -> Result<Model, String> {
    // BERT-style ONNX takes (batch, seq_len) where seq_len is dynamic.
    // Earlier attempts padded inputs to a fixed MAX_SEQ_LEN and pinned
    // the graph to that shape, but that yielded near-identical
    // embeddings across all inputs (mean cosine ≈ 0.9998) — strong
    // evidence the attention layers were attending to padding tokens
    // because the masking wasn't honored once shapes were baked in.
    //
    // The fix is to feed the model only the real tokens (no padding)
    // every call. tract preserves the ONNX symbolic dims through
    // into_typed → into_decluttered, so runtime shape resolution works
    // without us having to manage symbols.
    let typed = tract_onnx::onnx()
        .model_for_path(path)
        .map_err(|e| format!("tract parse: {e}"))?
        .into_typed()
        .map_err(|e| format!("into_typed: {e}"))?
        .into_decluttered()
        .map_err(|e| format!("decluttered: {e}"))?;

    // Optimize the typed graph with its symbolic seq_len so per-call
    // inference is fast (without this each forward pass is multi-second).
    let plan = typed
        .into_optimized()
        .map_err(|e| format!("optimize: {e}"))?
        .into_runnable()
        .map_err(|e| format!("runnable: {e}"))?;
    Ok(plan)
}

/// Embed a single text into a 384-dim L2-normalized vector. Returns
/// None if the model isn't loaded, the input tokenises to nothing, or
/// inference fails. The `is_query` flag controls e5's required prompt
/// prefix: queries get "query: " and stored passages get "passage: " —
/// mixing them up degrades recall noticeably.
pub fn embed(text: &str, is_query: bool) -> Option<Vec<f32>> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    let model = MODEL.get()?.as_ref()?;
    let tokenizer = TOKENIZER.get()?.as_ref()?;

    let prefixed = if is_query {
        format!("query: {trimmed}")
    } else {
        format!("passage: {trimmed}")
    };

    let encoded = tokenizer.encode(prefixed, true).ok()?;
    let raw_ids = encoded.get_ids();
    let raw_mask = encoded.get_attention_mask();
    let raw_types = encoded.get_type_ids();
    if raw_ids.is_empty() {
        return None;
    }

    // Feed only real tokens (no padding) so the graph never sees pad
    // positions in the attention pattern — see build_plan for why.
    let seq = raw_ids.len().min(MAX_SEQ_LEN);
    let ids: Vec<i64> = raw_ids.iter().take(seq).map(|&v| v as i64).collect();
    let mask: Vec<i64> = raw_mask.iter().take(seq).map(|&v| v as i64).collect();
    let type_ids: Vec<i64> = raw_types.iter().take(seq).map(|&v| v as i64).collect();

    let ids_t: Tensor = tract_ndarray::Array2::from_shape_vec((1, seq), ids).ok()?.into();
    let mask_t: Tensor = tract_ndarray::Array2::from_shape_vec((1, seq), mask.clone())
        .ok()?
        .into();
    let type_t: Tensor = tract_ndarray::Array2::from_shape_vec((1, seq), type_ids).ok()?.into();

    // Input order matches the ONNX graph (input_ids, attention_mask,
    // token_type_ids). Xenova's e5 exports follow this convention.
    let inputs: TVec<TValue> = match model.model().inputs.len() {
        2 => tvec!(ids_t.into(), mask_t.into()),
        3 => tvec!(ids_t.into(), mask_t.into(), type_t.into()),
        _ => return None,
    };

    let outputs = model.run(inputs).ok()?;
    let last_hidden = outputs.first()?.to_array_view::<f32>().ok()?;
    let shape = last_hidden.shape();
    if shape.len() != 3 || shape[0] != 1 || shape[2] != EMBEDDING_DIM {
        return None;
    }

    // Mean-pool over the sequence dimension weighted by attention mask,
    // then L2 normalize. This is the standard sentence-transformers
    // recipe and what e5 was trained with.
    let mut sum = vec![0f32; EMBEDDING_DIM];
    let mut count = 0f32;
    for i in 0..seq {
        if mask[i] == 0 {
            continue;
        }
        for j in 0..EMBEDDING_DIM {
            sum[j] += last_hidden[[0, i, j]];
        }
        count += 1.0;
    }
    if count == 0.0 {
        return None;
    }
    for v in &mut sum {
        *v /= count;
    }
    let norm: f32 = sum.iter().map(|v| v * v).sum::<f32>().sqrt().max(f32::EPSILON);
    for v in &mut sum {
        *v /= norm;
    }
    Some(sum)
}

/// Cosine similarity between two L2-normalized vectors. Skips the norm
/// divide because both inputs are assumed normalized (we always produce
/// them that way in `embed`).
pub fn cosine_normalized(a: &[f32], b: &[f32]) -> f32 {
    let n = a.len().min(b.len());
    let mut dot = 0.0f32;
    for i in 0..n {
        dot += a[i] * b[i];
    }
    dot
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cosine_identical_vectors() {
        let v = [0.6f32, 0.8, 0.0];
        // |v| = 1, so cos(v, v) = 1.
        let s = cosine_normalized(&v, &v);
        assert!((s - 1.0).abs() < 1e-6, "got {s}");
    }

    #[test]
    fn cosine_orthogonal_vectors() {
        let a = [1.0f32, 0.0, 0.0];
        let b = [0.0f32, 1.0, 0.0];
        let s = cosine_normalized(&a, &b);
        assert!(s.abs() < 1e-6, "got {s}");
    }

    #[test]
    fn cosine_opposite_vectors() {
        let a = [1.0f32, 0.0];
        let b = [-1.0f32, 0.0];
        let s = cosine_normalized(&a, &b);
        assert!((s + 1.0).abs() < 1e-6, "got {s}");
    }

    #[test]
    fn cosine_handles_length_mismatch_by_truncating() {
        // Length mismatch shouldn't panic — it should silently use the
        // common prefix. The RAG path always feeds same-dim vectors but
        // this is a sharp edge worth pinning down.
        let a = [1.0f32, 0.0, 99.0];
        let b = [1.0f32, 0.0];
        let s = cosine_normalized(&a, &b);
        assert!((s - 1.0).abs() < 1e-6, "got {s}");
    }
}
