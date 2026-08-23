// The native tool definitions in tools.rs are one large `json!([...])`
// literal; each added tool deepens the macro expansion, so lift the
// recursion limit above the default 128.
#![recursion_limit = "512"]

mod analytics;
mod apm;
mod audio;
mod speaker;
mod tcc_reset;
mod battery;
mod caffeinate;
mod calendar;
mod capabilities;
mod clipboard;
mod device_id;
mod download;
mod finder;
mod http;
mod hud;
pub mod i18n;
pub mod llm;
mod log_event;
mod mcp;
mod mic_activity;
mod mic_permission;
mod model;
mod location;
mod location_native;
mod memory;
mod miniplayer;
mod music;
mod notes;
#[cfg(target_os = "macos")]
mod objc_util;
pub mod openai;
mod power;
mod proactive;
mod provider;
pub mod embedding;
pub mod rag;
mod reminder;
mod screen_permission;
mod screenshot;
pub mod secrets;
pub mod session_log;
pub mod summarizer;
pub mod switchbot;
mod timer;
pub mod tool_usage;
pub mod tools;
pub mod topics;
mod tray;
mod updater;
mod voicevox;
mod volume;
mod wallpaper;
mod weather;
mod worldtime;

use once_cell::sync::OnceCell;
use std::sync::Mutex;
use tray::{apply_tray_state, init_tray, open_settings_window, TrayState};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

static WHISPER_CTX: OnceCell<Mutex<WhisperContext>> = OnceCell::new();

/// Language hint for Whisper. `None` means auto-detect.
/// Settings on the renderer side push updates via `set_whisper_language`.
static WHISPER_LANG: Mutex<Option<&'static str>> = Mutex::new(Some("ja"));

#[tauri::command]
fn set_whisper_language(lang: Option<String>) {
    let mapped: Option<&'static str> = match lang.as_deref() {
        Some("ja") => Some("ja"),
        Some("en") => Some("en"),
        Some("es") => Some("es"),
        Some("fr") => Some("fr"),
        Some("de") => Some("de"),
        Some("zh") => Some("zh"),
        Some("pt") => Some("pt"),
        Some("ko") => Some("ko"),
        Some("it") => Some("it"),
        _ => None,
    };
    if let Ok(mut g) = WHISPER_LANG.lock() {
        *g = mapped;
    }
}

#[tauri::command]
fn set_app_language(app: tauri::AppHandle, lang: String) {
    use tauri::Manager;
    i18n::set(&lang);
    // Rebuild tray menu / labels in the new language. We don't change the
    // actual TrayState — just want the strings to refresh.
    if let Some(handle) = app.try_state::<tray::TrayHandle>() {
        let state = handle
            .last_state
            .lock()
            .map(|g| *g)
            .unwrap_or(tray::TrayState::Idle);
        let _ = tray::apply_tray_state(&app, state);
    }
}

fn model_path() -> std::path::PathBuf {
    model::model_path()
}

fn get_ctx() -> Result<&'static Mutex<WhisperContext>, String> {
    WHISPER_CTX.get_or_try_init(|| {
        let path = model_path();
        let path_str = path
            .to_str()
            .ok_or_else(|| "model path has invalid UTF-8".to_string())?;
        WhisperContext::new_with_params(path_str, WhisperContextParameters::default())
            .map(Mutex::new)
            .map_err(|e| format!("failed to load whisper model at {path_str}: {e}"))
    })
}

pub(crate) fn run_whisper(audio: Vec<f32>) -> Result<String, String> {
    let ctx = get_ctx()?;
    let ctx = ctx.lock().map_err(|e| format!("lock poisoned: {e}"))?;

    let mut state = ctx.create_state().map_err(|e| format!("create_state: {e}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    let lang = WHISPER_LANG.lock().ok().and_then(|g| *g);
    params.set_language(lang);
    params.set_translate(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_special(false);
    params.set_print_timestamps(false);
    // The initial prompt biases Whisper toward our wake-words. The
    // character names are listed so saying "めたん" / "ずんだもん" /
    // "つむぎ" doesn't get mistranscribed as 目玉 / 目タン / 紬 etc.
    // Order doesn't matter much; total length kept under a few dozen
    // tokens to avoid biasing real content.
    params.set_initial_prompt(
        "チャッピー、はい、チャッピーです。ずんだもん、めたん、つむぎ、ひまり、さよ、うさぎ、ずんこ、きりたん、いたこ。",
    );
    params.set_no_speech_thold(0.6);
    params.set_temperature(0.0);

    state
        .full(params, &audio)
        .map_err(|e| format!("full inference: {e}"))?;

    let n = state.full_n_segments();

    let mut out = String::new();
    for i in 0..n {
        let segment = state
            .get_segment(i)
            .ok_or_else(|| format!("segment {i}: missing"))?;
        let text = segment
            .to_str()
            .map_err(|e| format!("segment {i} text: {e}"))?;
        out.push_str(text);
    }
    Ok(out.trim().to_string())
}

#[tauri::command]
async fn location_permission_status() -> Result<String, String> {
    tokio::task::spawn_blocking(location_native::check_permission)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn request_location_permission() -> Result<bool, String> {
    tokio::task::spawn_blocking(location_native::request_permission)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn set_tray_state(app: tauri::AppHandle, state: TrayState) -> Result<(), String> {
    apply_tray_state(&app, state).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    open_settings_window(&app).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ensure_model(app: tauri::AppHandle) -> Result<String, String> {
    model::ensure_model(app)
        .await
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
async fn ensure_embedding_model(app: tauri::AppHandle) -> Result<(), String> {
    embedding::ensure_model(app).await?;
    let _ = embedding::ensure_loaded();
    // Re-index now that the model is available so previously-logged
    // turns become recall-able without needing a restart.
    tokio::task::spawn_blocking(rag::init);
    Ok(())
}

#[tauri::command]
fn embedding_model_status() -> bool {
    embedding::is_downloaded()
}

/// Delete the downloaded embedding model + tokenizer files so the user
/// can reclaim ~470 MB. Leaves all conversation data in place — if RAG
/// gets re-enabled later, `rag::init` re-embeds the existing logs.
///
/// Caveat: the in-process tract MODEL OnceLock still holds the parsed
/// model for the current session, so new turns continue to be embedded
/// until next launch. That's a minor wart (a bit of extra disk write
/// to .emb.bin files) but not user-facing — full disable takes effect
/// on the next restart.
#[tauri::command]
fn remove_embedding_model() -> Result<(), String> {
    if let Some(p) = embedding::model_path() {
        if p.exists() {
            std::fs::remove_file(&p).map_err(|e| format!("remove model: {e}"))?;
        }
    }
    if let Some(p) = embedding::tokenizer_path() {
        if p.exists() {
            std::fs::remove_file(&p).map_err(|e| format!("remove tokenizer: {e}"))?;
        }
    }
    Ok(())
}

/// Wipe every artefact of the long-term memory stack:
///   - raw conversation logs (`~/.chappie/log/*.jsonl`)
///   - embedding caches (`~/.chappie/log/*.emb.bin`)
///   - daily summaries (`~/.chappie/summaries/*.json`)
///   - topic snapshot (`~/.chappie/topics.json`)
/// Leaves the embedding model file in place so re-enabling RAG doesn't
/// re-download 470 MB. Also leaves memory.json / notes.json untouched —
/// those are independent user-curated stores with their own forget UIs.
#[tauri::command]
fn forget_long_term_memory() -> Result<(), String> {
    use std::fs;
    if !session_log::clear_all() {
        // clear_all returns false if any individual file failed; we
        // still continue to wipe the rest before reporting.
    }
    // The embedding cache lives alongside jsonl in ~/.chappie/log/.
    if let Some(home) = dirs::home_dir() {
        let log_dir = home.join(".chappie/log");
        if let Ok(entries) = fs::read_dir(&log_dir) {
            for e in entries.flatten() {
                if e.path()
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.ends_with(".emb.bin"))
                    .unwrap_or(false)
                {
                    let _ = fs::remove_file(e.path());
                }
            }
        }
        let summary_dir = home.join(".chappie/summaries");
        if let Ok(entries) = fs::read_dir(&summary_dir) {
            for e in entries.flatten() {
                let _ = fs::remove_file(e.path());
            }
        }
    }
    topics::forget();
    // Best-effort: rebuild the (now empty) rag index in memory.
    tauri::async_runtime::spawn_blocking(rag::init);
    Ok(())
}

#[tauri::command]
async fn ensure_speaker_model(app: tauri::AppHandle) -> Result<String, String> {
    let path = speaker::ensure_model(app)
        .await
        .map(|p| p.to_string_lossy().into_owned())?;
    // Best-effort: load the model into memory right away so the first
    // enroll / score call doesn't have to. ensure_loaded() is idempotent.
    let _ = speaker::ensure_loaded();
    Ok(path)
}

#[tauri::command]
fn speaker_is_enrolled() -> bool {
    speaker::is_enrolled()
}

#[tauri::command]
fn speaker_clear_enrollment() -> Result<(), String> {
    speaker::clear_enrollment()
}

#[tauri::command]
fn get_speaker_threshold() -> f32 {
    speaker::current_threshold()
}

#[tauri::command]
fn set_speaker_threshold(value: f32) {
    speaker::set_threshold(value);
}

#[tauri::command]
fn speaker_threshold_range() -> (f32, f32, f32) {
    (
        speaker::MIN_THRESHOLD,
        speaker::MAX_THRESHOLD,
        speaker::DEFAULT_THRESHOLD,
    )
}

#[tauri::command]
fn set_vad_threshold(value: f32) {
    audio::set_vad_threshold_value(value);
}

#[tauri::command]
fn set_vad_silence_frames(frames: usize) {
    audio::set_silence_frames_to_end_value(frames);
}

/// (min, max, default, frame_ms) for both VAD sliders. `frame_ms` lets
/// the renderer convert the frame-count silence range into milliseconds
/// for display without hardcoding the audio frame size.
#[tauri::command]
fn vad_config_range() -> serde_json::Value {
    serde_json::json!({
        "threshold": {
            "min": audio::MIN_VAD_THRESHOLD,
            "max": audio::MAX_VAD_THRESHOLD,
            "default": audio::DEFAULT_VAD_THRESHOLD,
        },
        "silenceFrames": {
            "min": audio::MIN_SILENCE_FRAMES_TO_END,
            "max": audio::MAX_SILENCE_FRAMES_TO_END,
            "default": audio::DEFAULT_SILENCE_FRAMES_TO_END,
        },
        "frameMs": audio::FRAME_MS,
    })
}

/// Enroll the current user's voice from a 16 kHz mono PCM buffer.
/// `samples` is expected to be ~5-10 s of clean speech (the renderer
/// records and passes raw f32 PCM). We chunk it into ~3 s windows,
/// compute an embedding per window, average them (after L2-normalising
/// each, which is the standard centroid recipe for x-vector / ECAPA),
/// and persist the result as the enrolled centroid.
#[tauri::command]
fn speaker_enroll(samples: Vec<f32>) -> Result<(), String> {
    speaker::ensure_loaded()?;
    const WINDOW_SAMPLES: usize = (speaker::TARGET_RATE as usize) * 3;
    const STRIDE_SAMPLES: usize = (speaker::TARGET_RATE as usize) * 2;
    let mut centroid = vec![0.0f32; speaker::EMBEDDING_DIM];
    let mut counted = 0usize;
    let mut start = 0usize;
    while start + WINDOW_SAMPLES <= samples.len() {
        let win = &samples[start..start + WINDOW_SAMPLES];
        if let Some(emb) = speaker::compute_embedding(win) {
            // L2-normalise before averaging — without this the loudest
            // window dominates the centroid regardless of how speaker-
            // distinctive it actually is.
            let norm = emb.iter().map(|x| x * x).sum::<f32>().sqrt();
            if norm > 0.0 {
                for (i, v) in emb.iter().enumerate() {
                    centroid[i] += v / norm;
                }
                counted += 1;
            }
        }
        start += STRIDE_SAMPLES;
    }
    // Fall back to a single full-clip embedding if the audio was too
    // short to even cover one window — better than refusing to enroll.
    if counted == 0 {
        if let Some(emb) = speaker::compute_embedding(&samples) {
            return speaker::save_enrollment(emb);
        }
        return Err("could not extract any embedding from the recording".to_string());
    }
    let inv = 1.0 / (counted as f32);
    for v in &mut centroid {
        *v *= inv;
    }
    speaker::save_enrollment(centroid)
}

/// Replace the proactive scheduler's config snapshot. Called by the
/// renderer on startup and whenever the user saves Settings, so the
/// 30-second tick loop picks up changes without a process restart.
#[tauri::command]
fn set_proactive_config(config: proactive::Config) {
    proactive::set_config(config);
}

/// Push the renderer's idle/busy state into the proactive scheduler.
/// Currently stored but unused — v2 reads it for the idle-chatter
/// feature. Called on every state-machine transition.
#[tauri::command]
fn notify_idle_state(idle: bool) {
    proactive::notify_idle(idle);
}

/// Set the user's opt-in state for usage analytics. The renderer calls
/// this when the toggle changes in Settings. We POST the new state to
/// the proxy, then update the cached flag that the dispatch hot path
/// reads each turn.
#[tauri::command]
async fn analytics_set_consent(consent: bool) -> Result<(), String> {
    analytics::set_consent_server(consent).await
}

/// Cheaper variant that only updates the in-process cache without
/// hitting the proxy — the renderer calls this on launch with the
/// already-persisted consent state so the Rust side doesn't reflect a
/// stale default of `false` while waiting for a server round-trip.
#[tauri::command]
fn analytics_set_consent_cached(consent: bool) {
    analytics::set_consent_cached(consent);
}

/// Delete every analytics row + the consent row for this device. Also
/// flips the local cache off. Renderer calls this from the Settings UI
/// "Delete sent data" button.
#[tauri::command]
async fn analytics_delete_history() -> Result<(), String> {
    analytics::delete_history().await
}

/// Returns the last few events the desktop has reported, so the
/// Settings UI can preview "what gets shared". The ring is in-memory
/// per-launch; this is intentional — the goal is to show what's
/// flowing right now, not a permanent audit trail.
#[tauri::command]
fn analytics_recent_events() -> Vec<analytics::RecentEvent> {
    analytics::recent_events()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// Persist every panic to `~/.chappie/panic.log` before the process aborts.
///
/// Release builds are stripped (`strip = true`) and ship no panic message
/// anywhere, so a main-thread panic during AppKit event handling shows up in
/// the macOS crash report as bare addresses with no cause. This hook captures
/// the panic message, source location, thread name, and a backtrace so the
/// next freeze is diagnosable without symbols. We chain to the default hook so
/// stderr behavior in `tauri dev` is unchanged.
fn install_panic_logger() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown>".into());
        let msg = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "<non-string panic payload>".into());
        let thread = std::thread::current();
        let thread_name = thread.name().unwrap_or("<unnamed>").to_string();
        let backtrace = std::backtrace::Backtrace::force_capture();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let entry = format!(
            "\n===== PANIC {now} =====\nthread: {thread_name}\nlocation: {location}\nmessage: {msg}\nbacktrace:\n{backtrace}\n"
        );
        if let Some(home) = dirs::home_dir() {
            let dir = home.join(".chappie");
            let _ = std::fs::create_dir_all(&dir);
            if let Ok(mut f) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(dir.join("panic.log"))
            {
                use std::io::Write;
                let _ = f.write_all(entry.as_bytes());
            }
        }
        default_hook(info);
    }));
}

pub fn run() {
    install_panic_logger();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // If a second instance launches, focus the existing settings window
            // (or just no-op for the hidden conversation worker).
            use tauri::{Emitter, Manager};
            if let Some(win) = app.get_webview_window("settings") {
                let _ = win.set_focus();
            }
            // Forward any chappie:// URL passed on the relaunch command line
            // to the deep-link plugin so the renderer hears about it. macOS
            // delivers deep links via Apple Events in normal cases, but
            // single-instance dispatch catches the rare path where the OS
            // spawns a second process before the running one can intercept.
            for arg in args.iter().filter(|a| a.starts_with("chappie://")) {
                let _ = app.emit("deep-link", arg);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            set_tray_state,
            open_settings,
            ensure_model,
            ensure_embedding_model,
            embedding_model_status,
            remove_embedding_model,
            forget_long_term_memory,
            ensure_speaker_model,
            speaker_is_enrolled,
            speaker_clear_enrollment,
            speaker_enroll,
            get_speaker_threshold,
            set_speaker_threshold,
            speaker_threshold_range,
            set_vad_threshold,
            set_vad_silence_frames,
            vad_config_range,
            set_whisper_language,
            set_app_language,
            mic_permission::check_microphone_permission,
            mic_permission::request_microphone_access,
            screen_permission::check_screen_recording_permission,
            screen_permission::request_screen_recording_access,
            screen_permission::open_screen_recording_settings,
            calendar::calendar_status,
            calendar::request_calendar_access,
            location_permission_status,
            request_location_permission,
            audio::start_listening,
            audio::stop_listening,
            audio::pause_listening,
            audio::resume_listening,
            audio::enter_barge_in_mode,
            audio::exit_barge_in_mode,
            audio::start_enrollment_recording,
            audio::finish_enrollment_recording,
            openai::chat_complete,
            device_id::get_device_id,
            hud::hud_dismiss,
            hud::hud_show,
            volume::is_muted,
            mic_activity::is_external_mic_active,
            tray::set_update_available,
            tray::set_tray_character,
            voicevox::voicevox_speakers_list,
            voicevox::voicevox_synthesize,
            voicevox::voicevox_install_status,
            voicevox::voicevox_install,
            voicevox::voicevox_uninstall,
            tool_usage::list_tool_usage,
            tool_usage::set_personalized_routing_cached,
            set_proactive_config,
            notify_idle_state,
            analytics_set_consent,
            analytics_set_consent_cached,
            analytics_delete_history,
            analytics_recent_events,
            secrets::secret_get,
            secrets::secret_set,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Carry any credential still in the plaintext settings file
            // over to the Keychain. Must run before switchbot.rs or the
            // renderer reads one, so both only ever see the new home.
            secrets::migrate_from_store(app.handle());

            // Detect upgrade and reset the TCC entries that ad-hoc
            // signing's cdhash churn tends to ghost (Screen Recording
            // worst, Calendar / Microphone secondary). Must run before
            // anything that requests those permissions on launch.
            #[cfg(target_os = "macos")]
            {
                let info = app.package_info();
                let bundle_id = app.config().identifier.clone();
                let current = info.version.to_string();
                tcc_reset::reset_on_upgrade(&bundle_id, &current);
            }

            // One-time autostart migration: we used to register login via
            // MacosLauncher::AppleScript, which adds a System Events login
            // item that pops a Terminal/script window on every boot. We've
            // since switched to MacosLauncher::LaunchAgent (silent launchd
            // plist). The LaunchAgent self-heal in ConversationWorker.tsx
            // recreates the new mechanism, but the stale AppleScript login
            // item lingers and keeps showing the Terminal — so delete it
            // once here. Guarded by a marker file so it runs a single time.
            #[cfg(target_os = "macos")]
            {
                if let Some(home) = std::env::var_os("HOME") {
                    let marker = std::path::Path::new(&home)
                        .join(".chappie")
                        .join(".autostart_launchagent_migrated");
                    if !marker.exists() {
                        let _ = std::process::Command::new("osascript")
                            .arg("-e")
                            .arg(
                                "tell application \"System Events\" to \
                                 delete login item \"Chappie\"",
                            )
                            .output();
                        if let Some(dir) = marker.parent() {
                            let _ = std::fs::create_dir_all(dir);
                        }
                        let _ = std::fs::write(&marker, b"1");
                    }
                }
            }

            // Deep-link handler: chappie://auth#access_token=…&refresh_token=…
            // (magic-link sign-in) and chappie://refresh (post-checkout
            // "Open Chappie" button on the LP success page). The renderer
            // listens for the `deep-link` event and routes by URL.
            {
                use tauri::Emitter;
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let _ = handle.emit("deep-link", url.to_string());
                    }
                });
            }

            init_tray(app.handle())?;
            timer::start_tray_title_ticker(app.handle());
            calendar::init();
            location_native::init();
            reminder::init(app.handle());
            // Proactive scheduler: ticks every 30s and emits
            // `proactive:fired` for morning brief / calendar pre-warning.
            // No-op until the renderer pushes a config via
            // `set_proactive_config`, so first-run installs stay silent.
            proactive::init(app.handle());
            // Speaker recognition: load any prior enrollment + lazily load
            // the ONNX model. Both are best-effort; the audio pipeline
            // treats "no enrollment" / "model missing" as permissive
            // bypass so the rest of the app keeps working when these
            // fail (e.g. on first run before the user enrolls).
            speaker::load_enrollment_from_disk();
            let _ = speaker::ensure_loaded();

            // RAG index: opt-in long-term memory. ensure_loaded fails
            // silently if the embedding model hasn't been downloaded,
            // and rag::init bails before doing any work in that case.
            // When opted-in this can take a few seconds to embed any
            // backlog of un-indexed turns, so it runs in a worker thread.
            if embedding::is_downloaded() {
                tauri::async_runtime::spawn_blocking(|| {
                    let _ = embedding::ensure_loaded();
                    rag::init();
                });
            }
            // Auto-spawn the bundled VOICEVOX engine if installed. No-op on
            // platforms without the .app bundle or when nothing is found —
            // the renderer falls back to the default 50021 endpoint in that
            // case (legacy manual-launch path).
            voicevox::init_engine(app.handle());

            // Auto-update check in Rust so the dialog is window-independent
            // (the JS `ask()` API attaches to the current window as a sheet,
            // which would force the hidden main/debug window to become visible).
            // Launch check shows a dialog immediately; a separate periodic
            // ticker only flips the tray badge so it never interrupts.
            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    updater::check_for_updates(app_handle, updater::CheckTrigger::Launch)
                        .await;
                });
                updater::start_periodic_checker(app.handle());
            }

            // Fire-and-forget IP-based location lookup so by the time the
            // user starts talking we already have a city to ground replies in.
            tauri::async_runtime::spawn(async {
                match location::get(false).await {
                    Ok(loc) => eprintln!(
                        "[location] resolved: {}",
                        location::format_for_prompt(&loc)
                    ),
                    Err(e) => eprintln!("[location] lookup failed: {e}"),
                }
            });

            // Prevent the debug ('main') window's close button from destroying
            // the conversation worker; hide it instead so the loop keeps running.
            {
                use tauri::Manager;
                if let Some(win) = app.get_webview_window("main") {
                    let win_clone = win.clone();
                    win.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = win_clone.hide();
                        }
                    });
                }
            }

            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(w) = app.get_webview_window("main") {
                    w.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
