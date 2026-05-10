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
const FRAME_SAMPLES: usize = 512;
// Probability threshold above which a frame is considered speech. Silero V5
// recommends 0.5 but real rooms with quieter speakers benefit from a much
// lower bar — we drop weak segments via MIN_SPEECH_FRAMES instead.
const VAD_THRESHOLD: f32 = 0.25;
// Higher VAD threshold used during barge-in mode (TTS playing; mic is
// hot but we want to ignore speaker reverb of Chappie's own voice). The
// gap to the normal threshold is what gives us the "echo rejection";
// genuine user speech still clears 0.6 easily, while loopback usually
// hovers around 0.3-0.5.
const VAD_THRESHOLD_BARGE_IN: f32 = 0.6;
// Consecutive non-speech frames to terminate an utterance (~700ms at 32ms/frame).
const SILENCE_FRAMES_TO_END: usize = 22;
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
// Higher RMS gate during barge-in mode. Speaker reverb at conversational
// volume usually peaks around 0.005-0.015; raising the bar to 0.02 keeps
// it out while genuine user speech (which is much closer to the mic and
// directional) typically lands at 0.04+.
const MIN_RMS_ENERGY_BARGE_IN: f32 = 0.02;
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
static STARTED: Mutex<bool> = Mutex::new(false);

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

    let in_rate = supported.sample_rate().0;
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
            let msg = format!("unsupported sample format {:?}", f);
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

    crate::linfo!(
        &app,
        "audio",
        "segmenter started: in_rate={in_rate} resample={} muted={}",
        needs_resample,
        is_effectively_muted()
    );

    let mut accum_in: Vec<f32> = Vec::new();
    let mut accum_out: Vec<f32> = Vec::new();
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
                "heartbeat: chunks={chunks_seen} muted={} in_speech={in_speech}",
                is_effectively_muted()
            );
            last_log = std::time::Instant::now();
        }

        // While muted (e.g. TTS playing or user toggled off from tray),
        // drop captured audio and reset segmentation state so we never
        // hand self-speech (or anything else) to Whisper.
        if is_effectively_muted() {
            accum_in.clear();
            accum_out.clear();
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

        let barge_in_now = is_barge_in_active();
        let vad_threshold = if barge_in_now {
            VAD_THRESHOLD_BARGE_IN
        } else {
            VAD_THRESHOLD
        };
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

        while accum_out.len() >= FRAME_SAMPLES {
            let frame: Vec<f32> = accum_out.drain(..FRAME_SAMPLES).collect();
            let prob = vad.predict(frame.iter().copied());
            let voiced = prob >= vad_threshold;

            if !in_speech {
                if voiced {
                    crate::linfo!(&app, "audio", "speech start prob={prob:.2}");
                    in_speech = true;
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
                if voiced {
                    speech_frames += 1;
                    silence_frames = 0;
                } else {
                    silence_frames += 1;
                }

                let too_long = speech_frames + silence_frames >= max_utterance_frames;
                let ended = silence_frames >= SILENCE_FRAMES_TO_END;
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
                    if frame_count_ok && rms_ok {
                        let app2 = app.clone();
                        std::thread::spawn(move || {
                            let started = std::time::Instant::now();
                            match crate::run_whisper(buf) {
                                Ok(text) if !text.is_empty() => {
                                    crate::linfo!(
                                        &app2,
                                        "whisper",
                                        "ok in {}ms: {text}",
                                        started.elapsed().as_millis()
                                    );
                                    let _ = app2.emit("speech", text);
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
