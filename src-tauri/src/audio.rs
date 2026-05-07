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
// Probability threshold above which a frame is considered speech.
const VAD_THRESHOLD: f32 = 0.5;
// Consecutive non-speech frames to terminate an utterance (~700ms at 32ms/frame).
const SILENCE_FRAMES_TO_END: usize = 22;
// Minimum speech frames before accepting an utterance (~250ms) — filters clicks.
const MIN_SPEECH_FRAMES: usize = 8;
// Maximum utterance length cap (~30s). Whisper's own context is ~30s, so going
// beyond this is pointless; below 30s avoids clipping reasonable spoken queries.
const MAX_UTTERANCE_FRAMES: usize = 940;
// Pre-roll frames prepended so we don't clip the start of the utterance.
const PREROLL_FRAMES: usize = 5;
// Minimum average VAD probability across voiced frames in a segment.
// Filters segments that barely cleared VAD_THRESHOLD — the dominant source
// of Whisper hallucinations on near-silence.
const MIN_AVG_VOICED_PROB: f32 = 0.65;
// Minimum peak VAD probability — at least one frame must be confidently voiced.
const MIN_PEAK_PROB: f32 = 0.85;

static RUNNING: once_cell::sync::OnceCell<Arc<AtomicBool>> = once_cell::sync::OnceCell::new();
static MUTED: once_cell::sync::OnceCell<Arc<AtomicBool>> = once_cell::sync::OnceCell::new();
static STARTED: Mutex<bool> = Mutex::new(false);

fn muted_flag() -> Arc<AtomicBool> {
    MUTED
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone()
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
    let _ = RUNNING.set(running.clone());

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
    if let Some(r) = RUNNING.get() {
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

    run_segmenter(in_rate, rx, running, muted_flag(), app)?;
    drop(stream);
    Ok(())
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
    muted: Arc<AtomicBool>,
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

    let mut accum_in: Vec<f32> = Vec::new();
    let mut accum_out: Vec<f32> = Vec::new();
    let mut preroll: std::collections::VecDeque<Vec<f32>> =
        std::collections::VecDeque::with_capacity(PREROLL_FRAMES);
    let mut speech_buf: Vec<f32> = Vec::new();
    let mut in_speech = false;
    let mut speech_frames = 0usize;
    let mut silence_frames = 0usize;
    let mut voiced_prob_sum = 0.0f32;
    let mut max_prob = 0.0f32;

    while running.load(Ordering::SeqCst) {
        let chunk = match rx.recv_timeout(std::time::Duration::from_millis(500)) {
            Ok(c) => c,
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            Err(_) => break,
        };

        // While muted (e.g. TTS playing), drop captured audio and reset
        // segmentation state so we never hand self-speech to Whisper.
        if muted.load(Ordering::SeqCst) {
            accum_in.clear();
            accum_out.clear();
            preroll.clear();
            speech_buf.clear();
            in_speech = false;
            speech_frames = 0;
            silence_frames = 0;
            voiced_prob_sum = 0.0;
            max_prob = 0.0;
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

        while accum_out.len() >= FRAME_SAMPLES {
            let frame: Vec<f32> = accum_out.drain(..FRAME_SAMPLES).collect();
            let prob = vad.predict(frame.iter().copied());
            let voiced = prob >= VAD_THRESHOLD;

            if !in_speech {
                if voiced {
                    in_speech = true;
                    speech_frames = 1;
                    silence_frames = 0;
                    voiced_prob_sum = prob;
                    max_prob = prob;
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
                    voiced_prob_sum += prob;
                    if prob > max_prob {
                        max_prob = prob;
                    }
                } else {
                    silence_frames += 1;
                }

                let too_long = speech_frames + silence_frames >= MAX_UTTERANCE_FRAMES;
                let ended = silence_frames >= SILENCE_FRAMES_TO_END;
                if ended || too_long {
                    let avg_prob = if speech_frames > 0 {
                        voiced_prob_sum / speech_frames as f32
                    } else {
                        0.0
                    };
                    // Drop weak / low-confidence segments before paying for
                    // Whisper inference. These are the main source of
                    // hallucinated transcripts on near-silence.
                    let usable = speech_frames >= MIN_SPEECH_FRAMES
                        && avg_prob >= MIN_AVG_VOICED_PROB
                        && max_prob >= MIN_PEAK_PROB;
                    let buf = std::mem::take(&mut speech_buf);
                    in_speech = false;
                    speech_frames = 0;
                    silence_frames = 0;
                    voiced_prob_sum = 0.0;
                    max_prob = 0.0;
                    preroll.clear();
                    if usable {
                        let app2 = app.clone();
                        std::thread::spawn(move || match crate::run_whisper(buf) {
                            Ok(text) if !text.is_empty() => {
                                let _ = app2.emit("speech", text);
                            }
                            Ok(_) => {}
                            Err(e) => eprintln!("[audio] transcribe error: {e}"),
                        });
                    }
                }
            }
        }
    }
    Ok(())
}

