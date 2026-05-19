// Speaker recognition front-end.
//
// Loads the WeSpeaker ECAPA-TDNN-512-LM ONNX model and computes 192-dim
// speaker embeddings from 16 kHz mono PCM. Used by `audio.rs` to gate
// transcribed segments: an enrolled user produces a similar embedding
// every time, while Chappie's own TTS / leaked YouTube audio / other
// people in the room produce different embeddings. Segments whose
// cosine similarity to the enrolled embedding falls below the
// configured threshold are dropped before reaching Whisper.
//
// Preprocessing exactly mirrors WeSpeaker's `infer_onnx.py`:
//   * 80-dim kaldi-compatible mel filterbank
//   * 25 ms frame, 10 ms shift, Hamming window, no energy
//   * Per-frequency CMN (subtract mean across frames)
//   * Input tensor shape: (1, T, 80) with input name `feats`
//   * Output tensor: `embs` shape (1, 192)
//
// The model file is fetched on first run from Hugging Face into
// `~/.chappie/models/voxceleb_ECAPA512_LM.onnx`, matching how the
// Whisper model is handled in `model.rs`. CC-BY-4.0 license; we ship
// attribution in the LP / README.

use crate::download::{download_with_progress, file_exists_nonempty};
use kaldi_fbank_rust_kautism::{FbankOptions, FrameExtractionOptions, MelBanksOptions, OnlineFbank};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Runtime};
use tract_onnx::prelude::*;

pub const EMBEDDING_DIM: usize = 192;
pub const TARGET_RATE: u32 = 16_000;

const MODEL_URL: &str =
    "https://huggingface.co/Wespeaker/wespeaker-ecapa-tdnn512-LM/resolve/main/voxceleb_ECAPA512_LM.onnx";

/// Cosine similarity threshold above which a segment is considered the
/// enrolled user. Tuned permissive to start — false-reject of the real
/// user is a bigger UX issue than the occasional echo slipping through.
/// Settings exposes a slider that overrides this at runtime via
/// `set_threshold`; this constant is the default and the lower bound of
/// the slider range.
pub const DEFAULT_THRESHOLD: f32 = 0.40;
pub const MIN_THRESHOLD: f32 = 0.30;
pub const MAX_THRESHOLD: f32 = 0.55;

/// Runtime-adjustable threshold. f32 bits stored as u32 because there is
/// no AtomicF32. 0 sentinel = "not set", treated as DEFAULT_THRESHOLD.
static THRESHOLD_BITS: AtomicU32 = AtomicU32::new(0);

pub fn current_threshold() -> f32 {
    let bits = THRESHOLD_BITS.load(Ordering::Relaxed);
    if bits == 0 {
        DEFAULT_THRESHOLD
    } else {
        f32::from_bits(bits)
    }
}

pub fn set_threshold(value: f32) {
    let clamped = value.clamp(MIN_THRESHOLD, MAX_THRESHOLD);
    THRESHOLD_BITS.store(clamped.to_bits(), Ordering::Relaxed);
}

type Model = SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>;

/// Lazily-loaded singleton model. Tract models are Send + Sync once
/// finalized; we hold the plan behind a OnceLock so the segmenter can
/// borrow it without locking.
static MODEL: OnceLock<Option<Model>> = OnceLock::new();

pub fn model_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".chappie/models/voxceleb_ECAPA512_LM.onnx"))
}

/// Download the speaker ONNX model into `~/.chappie/models/` if it's not
/// already there. Emits progress events under the `speaker_model:*`
/// namespace (separate from `model:*` so the renderer's existing
/// Whisper download progress UI doesn't try to track both at once).
pub async fn ensure_model<R: Runtime>(app: AppHandle<R>) -> Result<PathBuf, String> {
    let path = model_path().ok_or_else(|| "no home dir".to_string())?;
    if !file_exists_nonempty(&path).await {
        download_with_progress(&app, MODEL_URL, &path, "speaker_model", None).await?;
    }
    let _ = app.emit(
        "speaker_model:ready",
        serde_json::json!({ "path": path.to_string_lossy() }),
    );
    Ok(path)
}

/// Load the ONNX model from disk into the global slot. Best-effort:
/// returns Err if the file is missing or tract can't parse it. Safe to
/// call multiple times — only the first load actually does work.
pub fn ensure_loaded() -> Result<(), String> {
    if MODEL.get().is_some() {
        return MODEL
            .get()
            .unwrap()
            .as_ref()
            .map(|_| ())
            .ok_or_else(|| "model previously failed to load".to_string());
    }
    let path = model_path().ok_or_else(|| "no home dir".to_string())?;
    if !path.exists() {
        // Don't poison the OnceLock here — the model just hasn't been
        // downloaded yet. The user can hit Enroll later, which triggers
        // the download and re-enters this function.
        return Err(format!("model not downloaded at {path:?}"));
    }
    let model = tract_onnx::onnx()
        .model_for_path(&path)
        .map_err(|e| format!("tract parse: {e}"))?
        .into_optimized()
        .map_err(|e| format!("tract optimize: {e}"))?
        .into_runnable()
        .map_err(|e| format!("tract finalize: {e}"))?;
    let _ = MODEL.set(Some(model));
    Ok(())
}

/// Compute an embedding from a mono 16 kHz f32 PCM buffer. Returns
/// None if the model isn't loaded, the audio is too short to make any
/// fbank frames, or inference fails.
pub fn compute_embedding(samples: &[f32]) -> Option<Vec<f32>> {
    let model = MODEL.get()?.as_ref()?;
    let feats = compute_fbank(samples)?;
    let (n_frames, feat_dim) = (feats.len() / 80, 80);
    if n_frames == 0 {
        return None;
    }
    // Reshape into (1, T, 80) for the model. tract wants Vec<f32> +
    // shape spec.
    let input: Tensor = tract_ndarray::Array3::from_shape_vec(
        (1, n_frames, feat_dim),
        feats,
    )
    .ok()?
    .into();
    let output = model.run(tvec!(input.into())).ok()?;
    let emb_view = output.first()?.to_array_view::<f32>().ok()?;
    Some(emb_view.as_slice()?.to_vec())
}

/// Run kaldi-compatible 80-dim mel filterbank with per-mel mean
/// subtraction (CMN, no CVN — matches WeSpeaker's `compute_fbank`).
/// Output is a flat row-major Vec<f32> of length n_frames * 80.
fn compute_fbank(samples: &[f32]) -> Option<Vec<f32>> {
    let opts = FbankOptions {
        frame_opts: FrameExtractionOptions {
            samp_freq: TARGET_RATE as f32,
            frame_length_ms: 25.0,
            frame_shift_ms: 10.0,
            dither: 0.0,
            window_type: c"hamming".as_ptr(),
            ..Default::default()
        },
        mel_opts: MelBanksOptions { num_bins: 80, ..Default::default() },
        ..Default::default()
    };
    let mut fbank = OnlineFbank::new(opts);
    fbank.accept_waveform(TARGET_RATE as f32, samples);
    fbank.input_finished();
    let n = fbank.num_ready_frames();
    if n <= 0 {
        return None;
    }
    let mut out = Vec::with_capacity((n as usize) * 80);
    for i in 0..n {
        let row = fbank.get_frame(i)?;
        out.extend_from_slice(row);
    }
    // Per-mel mean subtraction (CMN). Compute mean along the time axis
    // for each of the 80 bins, then subtract.
    let mut means = [0.0f32; 80];
    for frame in out.chunks(80) {
        for (i, v) in frame.iter().enumerate() {
            means[i] += *v;
        }
    }
    let scale = 1.0 / (n as f32);
    for m in &mut means {
        *m *= scale;
    }
    for frame in out.chunks_mut(80) {
        for (i, v) in frame.iter_mut().enumerate() {
            *v -= means[i];
        }
    }
    Some(out)
}

/// Where the enrolled user embedding is persisted. One 192-dim f32
/// vector in little-endian binary, no header. Trivially regenerable by
/// re-enrolling, so we don't bother with versioning.
fn enrollment_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".chappie/voice.bin"))
}

/// In-memory cache of the enrolled embedding so the audio thread can
/// score every segment without hitting disk. None when nothing is
/// enrolled or the file is corrupted.
static ENROLLED: OnceLock<std::sync::RwLock<Option<Vec<f32>>>> = OnceLock::new();

fn enrolled_slot() -> &'static std::sync::RwLock<Option<Vec<f32>>> {
    ENROLLED.get_or_init(|| std::sync::RwLock::new(None))
}

/// Read `~/.chappie/voice.bin` from disk into the in-memory slot. Call
/// once at startup; cheap (192 * 4 bytes).
pub fn load_enrollment_from_disk() {
    let Some(path) = enrollment_path() else { return };
    let Ok(bytes) = std::fs::read(&path) else { return };
    if bytes.len() != EMBEDDING_DIM * 4 {
        return;
    }
    let mut v = Vec::with_capacity(EMBEDDING_DIM);
    for chunk in bytes.chunks(4) {
        v.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    if let Ok(mut guard) = enrolled_slot().write() {
        *guard = Some(v);
    }
}

pub fn is_enrolled() -> bool {
    enrolled_slot()
        .read()
        .map(|g| g.is_some())
        .unwrap_or(false)
}

pub fn clear_enrollment() -> Result<(), String> {
    if let Ok(mut guard) = enrolled_slot().write() {
        *guard = None;
    }
    let Some(path) = enrollment_path() else { return Ok(()) };
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("remove: {e}"))?;
    }
    Ok(())
}

/// Save the enrolled embedding both to disk and the in-memory slot.
/// Replaces any previous enrollment. The input is the AVERAGED embedding
/// computed from the user's enrollment recording — averaging across
/// several utterances helps the stored centroid generalise better than
/// a single sample.
pub fn save_enrollment(embedding: Vec<f32>) -> Result<(), String> {
    if embedding.len() != EMBEDDING_DIM {
        return Err(format!(
            "embedding dim mismatch: got {}, want {EMBEDDING_DIM}",
            embedding.len()
        ));
    }
    let path = enrollment_path().ok_or_else(|| "no home dir".to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
    }
    let mut bytes = Vec::with_capacity(EMBEDDING_DIM * 4);
    for v in &embedding {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    std::fs::write(&path, &bytes).map_err(|e| format!("write: {e}"))?;
    if let Ok(mut guard) = enrolled_slot().write() {
        *guard = Some(embedding);
    }
    Ok(())
}

/// Score a segment against the enrolled user. Returns `Some(similarity)`
/// when an enrollment exists, or `None` to mean "no enrollment, accept
/// everything" (the audio pipeline treats None as a permissive bypass).
pub fn score_against_enrolled(samples: &[f32]) -> Option<f32> {
    let enrolled = enrolled_slot().read().ok()?.clone()?;
    let embedding = compute_embedding(samples)?;
    Some(cosine_similarity(&embedding, &enrolled))
}

/// Cosine similarity between two embedding vectors. Standard formula
/// `dot(a, b) / (||a|| ||b||)`. Returns 0.0 if either vector is
/// degenerate (zero norm) — treated as "no match".
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len().min(b.len());
    let mut dot = 0.0f32;
    let mut na = 0.0f32;
    let mut nb = 0.0f32;
    for i in 0..len {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    let denom = (na.sqrt() * nb.sqrt()).max(f32::EPSILON);
    if denom <= f32::EPSILON {
        return 0.0;
    }
    dot / denom
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cosine_identical_normalized() {
        // The enrolled centroid is stored L2-normalized; same embedding
        // back in should score 1.0.
        let v = [0.6f32, 0.8, 0.0];
        let s = cosine_similarity(&v, &v);
        assert!((s - 1.0).abs() < 1e-6, "got {s}");
    }

    #[test]
    fn cosine_identical_unnormalized() {
        // Function does its own L2 divide, so unnormalized identical
        // vectors must also score 1.0 — guards against an upstream
        // change that stops pre-normalizing embeddings.
        let a = [3.0f32, 4.0, 0.0];
        let b = [3.0f32, 4.0, 0.0];
        let s = cosine_similarity(&a, &b);
        assert!((s - 1.0).abs() < 1e-6, "got {s}");
    }

    #[test]
    fn cosine_scale_invariant() {
        // Scaling one side by a positive factor must not change cosine.
        // If this regresses, the speaker gate would start rejecting the
        // enrolled user whenever their mic gain drifts.
        let a = [1.0f32, 2.0, 3.0];
        let b = [10.0f32, 20.0, 30.0];
        let s = cosine_similarity(&a, &b);
        assert!((s - 1.0).abs() < 1e-6, "got {s}");
    }

    #[test]
    fn cosine_orthogonal_is_zero() {
        let a = [1.0f32, 0.0, 0.0];
        let b = [0.0f32, 1.0, 0.0];
        let s = cosine_similarity(&a, &b);
        assert!(s.abs() < 1e-6, "got {s}");
    }

    #[test]
    fn cosine_opposite_is_minus_one() {
        let a = [1.0f32, 0.0];
        let b = [-1.0f32, 0.0];
        let s = cosine_similarity(&a, &b);
        assert!((s + 1.0).abs() < 1e-6, "got {s}");
    }

    #[test]
    fn cosine_zero_vector_is_zero_not_nan() {
        // Degenerate case — without the guard this would be 0/0 = NaN
        // and the speaker gate's `>= ENROLL_THRESHOLD` check would
        // silently fail-closed on every segment.
        let a = [0.0f32, 0.0, 0.0];
        let b = [1.0f32, 2.0, 3.0];
        let s = cosine_similarity(&a, &b);
        assert!(s.abs() < 1e-6, "got {s}");
        assert!(!s.is_nan());
    }

    #[test]
    fn default_threshold_is_lenient_by_design() {
        // Lock the default in — bumping it silently above ~0.5 would
        // make the gate reject legitimate user speech once mic /
        // distance conditions drift from enrollment. The slider in
        // Settings can go higher, but the default stays permissive.
        assert!(DEFAULT_THRESHOLD >= 0.30 && DEFAULT_THRESHOLD <= 0.50);
        assert!(MIN_THRESHOLD <= DEFAULT_THRESHOLD);
        assert!(MAX_THRESHOLD >= DEFAULT_THRESHOLD);
    }

    #[test]
    fn threshold_override_round_trips_and_clamps() {
        super::set_threshold(0.42);
        assert!((super::current_threshold() - 0.42).abs() < 1e-6);
        super::set_threshold(0.99);
        assert!((super::current_threshold() - MAX_THRESHOLD).abs() < 1e-6);
        super::set_threshold(0.10);
        assert!((super::current_threshold() - MIN_THRESHOLD).abs() < 1e-6);
        // Reset for any subsequent test relying on the default.
        super::set_threshold(DEFAULT_THRESHOLD);
    }
}
