// Audio capture in Rust via cpal, with Silero VAD running on each frame.
// WKWebView's getUserMedia hangs on macOS for hidden windows without user
// gestures, so we bypass it entirely and capture from the OS layer.
//
// Capture loop:
//   1. cpal opens default input device, pushes interleaved samples on a callback
//   2. callback downmixes to mono and feeds the segmenter
//   3. segmenter resamples to 16kHz, slices into 512-sample (32ms) frames,
//      runs Silero VAD inference, and segments utterances by speech probability
//   4. on speech-end, accumulated PCM is handed to whisper and emitted as `speech`
//
// Wake-word detection lives in the renderer (string match against the Whisper
// transcript). An openWakeWord-based pipeline was tried and reverted — see
// git history if you want it back.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SampleFormat, StreamConfig};
use rubato::{FftFixedIn, Resampler};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use voice_activity_detector::VoiceActivityDetector;

const TARGET_RATE: u32 = 16_000;
// Silero VAD V5 requires exactly 512 samples per chunk at 16kHz (~32ms).
pub const FRAME_SAMPLES: usize = 512;
// Frame duration in milliseconds — derived from FRAME_SAMPLES / 16 kHz.
// Renderer-side UI converts user-facing milliseconds into frame counts
// using this constant, so the silence-end slider stays meaningful even
// if the frame size ever changes.
pub const FRAME_MS: usize = 32;
// Probability threshold above which a frame is considered speech. Silero V5
// recommends 0.5 but real rooms with quieter speakers benefit from a much
// lower bar — we drop weak segments via MIN_SPEECH_FRAMES instead. Now
// runtime-adjustable via Settings; this is the default + lower bound of
// the slider range.
pub const DEFAULT_VAD_THRESHOLD: f32 = 0.25;
pub const MIN_VAD_THRESHOLD: f32 = 0.15;
pub const MAX_VAD_THRESHOLD: f32 = 0.50;
// Higher VAD threshold used during barge-in mode (TTS playing; mic is
// hot but we want to ignore speaker reverb of Chappie's own voice). The
// gap to the normal threshold is what gives us the "echo rejection";
// genuine user speech still clears 0.6 easily, while loopback usually
// hovers around 0.3-0.5.
const VAD_THRESHOLD_BARGE_IN: f32 = 0.6;
// Consecutive non-speech frames to terminate an utterance. 22 ≈ 700ms
// at 32ms/frame — fast enough to feel responsive but long enough to
// survive natural mid-sentence pauses. Runtime-adjustable via Settings.
pub const DEFAULT_SILENCE_FRAMES_TO_END: usize = 22;
pub const MIN_SILENCE_FRAMES_TO_END: usize = 12; // ~380ms
pub const MAX_SILENCE_FRAMES_TO_END: usize = 38; // ~1200ms
// Minimum speech frames before accepting an utterance (~95ms) — filters
// clicks but keeps short utterances ("はい", "うん") and quiet talkers.
const MIN_SPEECH_FRAMES: usize = 3;
// Maximum utterance length cap (~30s). Whisper's own context is ~30s, so going
// beyond this is pointless; below 30s avoids clipping reasonable spoken queries.
const MAX_UTTERANCE_FRAMES: usize = 940;
// Pre-roll frames prepended so we don't clip the start of the utterance.
const PREROLL_FRAMES: usize = 5;
// Minimum RMS energy of an accepted segment (linear scale, audio normalised
// to ~[-1, 1]). Below this the segment is treated as background noise and
// dropped before Whisper inference, since whisper-small Japanese is prone to
// hallucinating phrases like "ご視聴ありがとうございました" on near-silence.
const MIN_RMS_ENERGY: f32 = 0.003;
// RMS gate during barge-in mode. Initially set higher (0.02) on the
// hypothesis that user voice would tower over reverb, but real-world
// mic levels for normal speech come in around 0.006-0.012 — same range
// as TTS reverb — so a raised gate just rejected the user. Keep the
// default 0.003 here and rely on the much higher VAD threshold (0.6)
// plus the keyword whitelist for echo rejection. (The wake-word
// hallucinations whisper sometimes produces from quiet TTS reverb are
// blocked one layer above by `isBargeInCommand` in the renderer.)
const MIN_RMS_ENERGY_BARGE_IN: f32 = MIN_RMS_ENERGY;
// Cap utterance length during barge-in. Real interrupt commands are
// short ("ストップ", "やめて", "もういい") — anything longer is
// almost certainly transcribed Chappie-output, drop it early.
const MAX_UTTERANCE_FRAMES_BARGE_IN: usize = 110; // ~3.5s

// Replaceable handle to the current capture thread's "keep running" flag.
// Re-assigned every time start_listening kicks off a new capture run, so
// stop_listening always points the new thread (not a leftover Arc from a
// prior session) at false.
static RUNNING: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);
// Transient mute, flipped on/off by the conversation loop while TTS is
// playing so we don't transcribe Chappie's own voice.
static MUTED: once_cell::sync::OnceCell<Arc<AtomicBool>> = once_cell::sync::OnceCell::new();
// Barge-in mode: TTS is playing and the renderer wants the mic to stay
// hot to catch a "stop / やめて" interrupt. Mutually exclusive with MUTED
// — pause_listening / enter_barge_in_mode pick one of the two paths.
// When set, the segmenter uses the BARGE_IN-suffixed thresholds and keeps
// emitting `speech` events; the renderer filters them through a keyword
// whitelist.
static BARGE_IN: once_cell::sync::OnceCell<Arc<AtomicBool>> = once_cell::sync::OnceCell::new();
// Speaker-enrollment recording mode. While true the segmenter accumulates
// post-APM 16 kHz mono samples into `ENROLLMENT_BUF` and skips wake-word /
// VAD / Whisper entirely — the renderer wants ~5 s of contiguous voice
// for centroid extraction, not segmented utterances.
static ENROLLING: once_cell::sync::OnceCell<Arc<AtomicBool>> = once_cell::sync::OnceCell::new();
static ENROLLMENT_BUF: Mutex<Vec<f32>> = Mutex::new(Vec::new());
static STARTED: Mutex<bool> = Mutex::new(false);

// Runtime-adjustable VAD parameters. Settings pushes values here via
// `set_vad_threshold` / `set_vad_silence_frames`; the segmenter reads
// `current_*` on each utterance start. f32 stored as u32 bits because
// there's no AtomicF32. 0 sentinel = "not set" → use the default.
static VAD_THRESHOLD_BITS: std::sync::atomic::AtomicU32 =
    std::sync::atomic::AtomicU32::new(0);
static VAD_SILENCE_FRAMES: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

pub fn current_vad_threshold() -> f32 {
    let bits = VAD_THRESHOLD_BITS.load(Ordering::Relaxed);
    if bits == 0 {
        DEFAULT_VAD_THRESHOLD
    } else {
        f32::from_bits(bits)
    }
}

pub fn set_vad_threshold_value(value: f32) {
    let clamped = value.clamp(MIN_VAD_THRESHOLD, MAX_VAD_THRESHOLD);
    VAD_THRESHOLD_BITS.store(clamped.to_bits(), Ordering::Relaxed);
}

pub fn current_silence_frames_to_end() -> usize {
    let v = VAD_SILENCE_FRAMES.load(Ordering::Relaxed);
    if v == 0 {
        DEFAULT_SILENCE_FRAMES_TO_END
    } else {
        v
    }
}

pub fn set_silence_frames_to_end_value(frames: usize) {
    let clamped = frames.clamp(MIN_SILENCE_FRAMES_TO_END, MAX_SILENCE_FRAMES_TO_END);
    VAD_SILENCE_FRAMES.store(clamped, Ordering::Relaxed);
}

fn muted_flag() -> Arc<AtomicBool> {
    MUTED
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone()
}

fn barge_in_flag() -> Arc<AtomicBool> {
    BARGE_IN
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone()
}

pub fn is_effectively_muted() -> bool {
    muted_flag().load(Ordering::SeqCst)
}

pub fn is_barge_in_active() -> bool {
    barge_in_flag().load(Ordering::SeqCst)
}

fn enrolling_flag() -> Arc<AtomicBool> {
    ENROLLING
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone()
}

pub fn is_enrolling() -> bool {
    enrolling_flag().load(Ordering::SeqCst)
}

/// Start an enrollment recording. Clears any prior buffer and flips the
/// segmenter into enrollment mode. The renderer is expected to wait the
/// desired duration (~5 s) and then call `finish_enrollment_recording`.
#[tauri::command]
pub fn start_enrollment_recording() -> Result<(), String> {
    if let Ok(mut buf) = ENROLLMENT_BUF.lock() {
        buf.clear();
    }
    enrolling_flag().store(true, Ordering::SeqCst);
    Ok(())
}

/// Stop enrollment mode and return the buffered 16 kHz mono samples.
/// Empty vec is returned (not an error) if the recording was truncated
/// or no samples landed — the caller can decide whether that's worth
/// surfacing as a UX message.
#[tauri::command]
pub fn finish_enrollment_recording() -> Result<Vec<f32>, String> {
    enrolling_flag().store(false, Ordering::SeqCst);
    let buf = ENROLLMENT_BUF
        .lock()
        .map(|mut g| std::mem::take(&mut *g))
        .unwrap_or_default();
    Ok(buf)
}

pub fn is_listening() -> bool {
    *STARTED.lock().unwrap()
}

#[tauri::command]
pub fn pause_listening() -> Result<(), String> {
    muted_flag().store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn resume_listening() -> Result<(), String> {
    muted_flag().store(false, Ordering::SeqCst);
    Ok(())
}

/// Enter barge-in mode: mic stays active during TTS but the segmenter
/// uses raised VAD / RMS thresholds and a shorter utterance cap so
/// Chappie's own speaker reverb is rejected. Only short, loud user
/// utterances make it through to the renderer's keyword filter.
#[tauri::command]
pub fn enter_barge_in_mode() -> Result<(), String> {
    barge_in_flag().store(true, Ordering::SeqCst);
    // Make sure MUTED isn't lingering from a previous TTS — they're
    // exclusive. If both got set we'd silently end up muted.
    muted_flag().store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn exit_barge_in_mode() -> Result<(), String> {
    barge_in_flag().store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn start_listening(app: tauri::AppHandle) -> Result<(), String> {
    {
        let mut started = STARTED.lock().unwrap();
        if *started {
            return Ok(());
        }
        *started = true;
    }
    let running = Arc::new(AtomicBool::new(true));
    *RUNNING.lock().unwrap() = Some(running.clone());

    let (ready_tx, ready_rx) = std::sync::mpsc::channel::<Result<(), String>>();
    std::thread::spawn(move || {
        if let Err(e) = run_capture(app, running, ready_tx) {
            eprintln!("[audio] capture thread exited: {e}");
        }
    });
    ready_rx
        .recv()
        .map_err(|e| format!("capture thread did not signal: {e}"))?
}

#[tauri::command]
pub fn stop_listening() -> Result<(), String> {
    if let Some(r) = RUNNING.lock().unwrap().take() {
        r.store(false, Ordering::SeqCst);
    }
    *STARTED.lock().unwrap() = false;
    Ok(())
}

fn run_capture(
    app: tauri::AppHandle,
    running: Arc<AtomicBool>,
    ready_tx: std::sync::mpsc::Sender<Result<(), String>>,
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = match host.default_input_device() {
        Some(d) => d,
        None => {
            let _ = ready_tx.send(Err("no default input device".into()));
            return Err("no default input device".into());
        }
    };
    let supported = match device.default_input_config() {
        Ok(c) => c,
        Err(e) => {
            let msg = format!("default_input_config: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };

    let in_rate = supported.sample_rate();
    let in_channels = supported.channels() as usize;
    let sample_format = supported.sample_format();
    let config: StreamConfig = supported.config();

    let (tx, rx) = std::sync::mpsc::sync_channel::<Vec<f32>>(64);
    let err_fn = |e| eprintln!("[audio] cpal error: {e}");

    let stream = match sample_format {
        SampleFormat::F32 => device.build_input_stream(
            &config,
            make_data_callback::<f32>(in_channels, tx.clone()),
            err_fn,
            None,
        ),
        SampleFormat::I16 => device.build_input_stream(
            &config,
            make_data_callback::<i16>(in_channels, tx.clone()),
            err_fn,
            None,
        ),
        SampleFormat::U16 => device.build_input_stream(
            &config,
            make_data_callback::<u16>(in_channels, tx.clone()),
            err_fn,
            None,
        ),
        f => {
            let msg = format!("unsupported sample format {f:?}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    let stream = match stream {
        Ok(s) => s,
        Err(e) => {
            let msg = format!("build_input_stream: {e}");
            let _ = ready_tx.send(Err(msg.clone()));
            return Err(msg);
        }
    };
    if let Err(e) = stream.play() {
        let msg = format!("play: {e}");
        let _ = ready_tx.send(Err(msg.clone()));
        return Err(msg);
    }
    let _ = ready_tx.send(Ok(()));

    run_segmenter(in_rate, rx, running, app)?;
    drop(stream);
    Ok(())
}

fn rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}

fn make_data_callback<T>(
    channels: usize,
    tx: std::sync::mpsc::SyncSender<Vec<f32>>,
) -> impl FnMut(&[T], &cpal::InputCallbackInfo) + Send + 'static
where
    T: cpal::Sample + cpal::SizedSample,
    f32: cpal::FromSample<T>,
{
    move |data: &[T], _: &cpal::InputCallbackInfo| {
        let mut mono = Vec::with_capacity(data.len() / channels.max(1));
        if channels <= 1 {
            mono.extend(data.iter().map(|s| f32::from_sample_(*s)));
        } else {
            for chunk in data.chunks(channels) {
                let mut sum = 0.0f32;
                for s in chunk {
                    sum += f32::from_sample_(*s);
                }
                mono.push(sum / channels as f32);
            }
        }
        let _ = tx.try_send(mono);
    }
}

fn run_segmenter(
    in_rate: u32,
    rx: std::sync::mpsc::Receiver<Vec<f32>>,
    running: Arc<AtomicBool>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let needs_resample = in_rate != TARGET_RATE;
    let in_frame_size = if needs_resample {
        ((FRAME_SAMPLES as u64 * in_rate as u64) / TARGET_RATE as u64) as usize
    } else {
        FRAME_SAMPLES
    };
    let mut resampler: Option<FftFixedIn<f32>> = if needs_resample {
        Some(
            FftFixedIn::<f32>::new(in_rate as usize, TARGET_RATE as usize, in_frame_size, 2, 1)
                .map_err(|e| format!("rubato init: {e}"))?,
        )
    } else {
        None
    };
    let mut vad = VoiceActivityDetector::builder()
        .sample_rate(TARGET_RATE)
        .chunk_size(FRAME_SAMPLES)
        .build()
        .map_err(|e| format!("vad init: {e}"))?;

    // WebRTC APM sits between resample (48k → 16k) and VAD. Best-effort:
    // if construction fails we keep running with the raw path and log a
    // warning, since echo/AGC are quality-of-life rather than required
    // for basic capture to work.
    let apm = match crate::apm::build() {
        Ok(p) => Some(p),
        Err(e) => {
            crate::lwarn!(&app, "audio", "apm disabled: {e}");
            None
        }
    };

    crate::linfo!(
        &app,
        "audio",
        "segmenter started: in_rate={in_rate} resample={} muted={} apm={}",
        needs_resample,
        is_effectively_muted(),
        apm.is_some()
    );

    let mut accum_in: Vec<f32> = Vec::new();
    let mut accum_out: Vec<f32> = Vec::new();
    // Output of APM, waiting to be drained into VAD frames. APM writes
    // 160-sample frames; VAD reads 512. Keeping them separate avoids
    // mixing pre- and post-APM audio across one VAD frame boundary.
    let mut apm_out: Vec<f32> = Vec::new();
    // Tracks whether the current segment was ever captured while barge-in
    // mode was active (i.e. Chappie's TTS was playing). Set true the
    // moment a single in-speech frame coincides with `is_barge_in_active`,
    // cleared on segment end. If true at segment end, the segment is
    // emitted via `speech-bargein` instead of `speech` so the renderer
    // never treats it as a user body — even when Whisper finishes
    // processing it AFTER TTS ended and the continuation window has
    // already armed. That race is what produces the echo loop.
    let mut barge_in_seen_in_segment = false;
    let mut preroll: std::collections::VecDeque<Vec<f32>> =
        std::collections::VecDeque::with_capacity(PREROLL_FRAMES);
    let mut speech_buf: Vec<f32> = Vec::new();
    let mut in_speech = false;
    let mut speech_frames = 0usize;
    let mut silence_frames = 0usize;
    let mut chunks_seen: u64 = 0;
    let mut last_log = std::time::Instant::now();

    while running.load(Ordering::SeqCst) {
        let chunk = match rx.recv_timeout(std::time::Duration::from_millis(500)) {
            Ok(c) => c,
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            Err(_) => break,
        };
        chunks_seen += 1;
        if last_log.elapsed() >= std::time::Duration::from_secs(10) {
            crate::linfo!(
                &app,
                "audio",
                "heartbeat: chunks={chunks_seen} muted={} barge_in={} in_speech={in_speech}",
                is_effectively_muted(),
                is_barge_in_active()
            );
            last_log = std::time::Instant::now();
        }

        // While muted (e.g. TTS playing or user toggled off from tray),
        // drop captured audio and reset segmentation state so we never
        // hand self-speech (or anything else) to Whisper.
        if is_effectively_muted() {
            accum_in.clear();
            accum_out.clear();
            apm_out.clear();
            preroll.clear();
            speech_buf.clear();
            in_speech = false;
            speech_frames = 0;
            silence_frames = 0;
            continue;
        }

        accum_in.extend_from_slice(&chunk);

        // Resample (or pass-through) to TARGET_RATE in fixed input chunks.
        while accum_in.len() >= in_frame_size {
            let input_frame: Vec<f32> = accum_in.drain(..in_frame_size).collect();
            if let Some(rs) = resampler.as_mut() {
                let out = rs
                    .process(&[input_frame], None)
                    .map_err(|e| format!("rubato process: {e}"))?;
                accum_out.extend_from_slice(&out[0]);
            } else {
                accum_out.extend_from_slice(&input_frame);
            }
        }

        // APM in fixed 10 ms (160-sample @ 16 kHz) chunks. When APM is
        // unavailable (build failure on the user's machine, future runtime
        // disable, etc.) we fall through to copying samples straight from
        // accum_out to apm_out so the rest of the pipeline doesn't care.
        //
        // **Skip APM while barge-in mode is active.** During TTS playback
        // the speakers leak Chappie's own voice into the mic; AGC then
        // pumps that echo up by 15-30 dB and it sails past the
        // barge-in RMS gate, gets transcribed, and lands in the
        // continuation window after TTS ends — re-running the same tool
        // in a loop. Until v0.11 ships a proper AEC + system loopback,
        // disabling the APM stage during barge-in keeps the echo at
        // its natural low level so the existing RMS gate catches it.
        let apm_skip = is_barge_in_active();
        while accum_out.len() >= crate::apm::APM_FRAME_SAMPLES {
            let mut frame: Vec<f32> = accum_out
                .drain(..crate::apm::APM_FRAME_SAMPLES)
                .collect();
            if !apm_skip {
                if let Some(p) = apm.as_ref() {
                    if let Err(e) = crate::apm::process_mono(p, &mut frame) {
                        // Don't spam logs frame-by-frame if APM starts erroring;
                        // the first heartbeat after will surface it.
                        crate::lwarn!(&app, "audio", "apm frame: {e}");
                    }
                }
            }
            apm_out.extend_from_slice(&frame);
        }

        // Enrollment recording: pull the APM-processed samples straight
        // into the enrollment buffer and skip the VAD / wake / whisper
        // path entirely. We use the SAME post-APM 16 kHz audio that the
        // speaker gate scores at runtime — important for consistency
        // between the centroid we save and the embeddings we'll compare
        // against later.
        if is_enrolling() {
            // Emit a coarse RMS level so the Settings UI can render a
            // live amplitude meter while we accumulate samples. ~20 Hz
            // by virtue of the chunk arrival rate, which is plenty for
            // a "yes, the mic is hearing you" indicator.
            if !apm_out.is_empty() {
                let rms = (apm_out.iter().map(|x| x * x).sum::<f32>()
                    / apm_out.len() as f32)
                    .sqrt();
                let _ = app.emit("speaker_enroll:level", rms);
            }
            if let Ok(mut g) = ENROLLMENT_BUF.lock() {
                g.extend_from_slice(&apm_out);
            }
            apm_out.clear();
            preroll.clear();
            speech_buf.clear();
            in_speech = false;
            speech_frames = 0;
            silence_frames = 0;
            barge_in_seen_in_segment = false;
            continue;
        }

        let barge_in_now = is_barge_in_active();
        let vad_threshold = if barge_in_now {
            VAD_THRESHOLD_BARGE_IN
        } else {
            current_vad_threshold()
        };
        let silence_frames_to_end = current_silence_frames_to_end();
        let min_rms = if barge_in_now {
            MIN_RMS_ENERGY_BARGE_IN
        } else {
            MIN_RMS_ENERGY
        };
        let max_utterance_frames = if barge_in_now {
            MAX_UTTERANCE_FRAMES_BARGE_IN
        } else {
            MAX_UTTERANCE_FRAMES
        };

        while apm_out.len() >= FRAME_SAMPLES {
            let frame: Vec<f32> = apm_out.drain(..FRAME_SAMPLES).collect();
            let prob = vad.predict(frame.iter().copied());
            let voiced = prob >= vad_threshold;

            if !in_speech {
                if voiced {
                    crate::linfo!(&app, "audio", "speech start prob={prob:.2}");
                    // Notify renderer that voice activity has started so it
                    // can pause any pending followup/continuation timer —
                    // without this, a long mid-utterance can outrun the 6s
                    // continuation window and drop state to idle before
                    // Whisper ever sees the segment.
                    let _ = app.emit("speech-active", ());
                    in_speech = true;
                    barge_in_seen_in_segment = barge_in_now;
                    speech_frames = 1;
                    silence_frames = 0;
                    speech_buf.clear();
                    for f in preroll.iter() {
                        speech_buf.extend_from_slice(f);
                    }
                    speech_buf.extend_from_slice(&frame);
                } else {
                    if preroll.len() >= PREROLL_FRAMES {
                        preroll.pop_front();
                    }
                    preroll.push_back(frame);
                }
            } else {
                speech_buf.extend_from_slice(&frame);
                // Even one in-segment frame overlapping with TTS playback
                // means this segment is suspect (might be Chappie's own
                // voice echoing back). Sticky for the rest of the segment.
                if barge_in_now {
                    barge_in_seen_in_segment = true;
                }
                if voiced {
                    speech_frames += 1;
                    silence_frames = 0;
                } else {
                    silence_frames += 1;
                }

                let too_long = speech_frames + silence_frames >= max_utterance_frames;
                let ended = silence_frames >= silence_frames_to_end;
                if ended || too_long {
                    let buf = std::mem::take(&mut speech_buf);
                    let frame_count_ok = speech_frames >= MIN_SPEECH_FRAMES;
                    let rms_value = rms(&buf);
                    let rms_ok = rms_value >= min_rms;
                    let decision = if frame_count_ok && rms_ok {
                        "transcribe"
                    } else if !frame_count_ok {
                        "skip(too-short)"
                    } else {
                        "skip(low-rms)"
                    };
                    crate::linfo!(
                        &app,
                        "audio",
                        "segment end: frames={speech_frames} rms={rms_value:.4} samples={} -> {decision}",
                        buf.len()
                    );
                    in_speech = false;
                    speech_frames = 0;
                    silence_frames = 0;
                    preroll.clear();
                    let bargein = std::mem::take(&mut barge_in_seen_in_segment);
                    if frame_count_ok && rms_ok {
                        let app2 = app.clone();
                        std::thread::spawn(move || {
                            // Speaker gate: score against the enrolled
                            // user's centroid (if any). When enrolled and
                            // similarity falls below the threshold, this
                            // is either Chappie's own TTS leaking back,
                            // YouTube / TV audio, or another person —
                            // skip Whisper entirely. When NOT enrolled,
                            // score_against_enrolled returns None and we
                            // fall through to the existing pipeline.
                            if let Some(score) =
                                crate::speaker::score_against_enrolled(&buf)
                            {
                                let threshold = crate::speaker::current_threshold();
                                if score < threshold {
                                    crate::linfo!(
                                        &app2,
                                        "speaker",
                                        "drop: cos={score:.3} < {threshold:.2} (other voice)"
                                    );
                                    return;
                                }
                                crate::linfo!(
                                    &app2,
                                    "speaker",
                                    "accept: cos={score:.3}"
                                );
                            }
                            let started = std::time::Instant::now();
                            match crate::run_whisper(buf) {
                                Ok(text) if !text.is_empty() => {
                                    crate::linfo!(
                                        &app2,
                                        "whisper",
                                        "ok in {}ms{}: {text}",
                                        started.elapsed().as_millis(),
                                        if bargein { " [bargein]" } else { "" }
                                    );
                                    // Segments captured while Chappie was
                                    // speaking ride a separate event so the
                                    // renderer never feeds them into the
                                    // continuation-window body path. Live
                                    // user commands ("stop / やめて") still
                                    // get to vote because the renderer's
                                    // speech-bargein handler runs the same
                                    // isBargeInCommand filter.
                                    let topic = if bargein { "speech-bargein" } else { "speech" };
                                    let _ = app2.emit(topic, text);
                                }
                                Ok(_) => {
                                    crate::linfo!(&app2, "whisper", "empty result");
                                }
                                Err(e) => {
                                    crate::lerror!(&app2, "whisper", "error: {e}");
                                }
                            }
                        });
                    }
                }
            }
        }
    }
    Ok(())
}
