mod anthropic;
mod audio;
mod battery;
mod caffeinate;
mod calendar;
mod capabilities;
mod clipboard;
mod finder;
mod gemini;
mod hud;
mod i18n;
mod log_event;
mod mcp;
mod mic_permission;
mod model;
mod location;
mod memory;
mod miniplayer;
mod music;
mod notes;
pub mod openai;
mod power;
mod provider;
mod reminder;
mod screen_permission;
mod screenshot;
mod timer;
mod tray;
mod updater;
mod voicevox;
mod volume;
mod weather;

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
        "チャッピー、はい、チャッピーです。ずんだもん、めたん、つむぎ、ひまり、さよ、うさぎ、ずんこ、きりたん、いたこ、あんこもん。",
    );
    params.set_no_speech_thold(0.6);
    params.set_temperature(0.0);

    state
        .full(params, &audio)
        .map_err(|e| format!("full inference: {e}"))?;

    let n = state
        .full_n_segments()
        .map_err(|e| format!("full_n_segments: {e}"))?;

    let mut out = String::new();
    for i in 0..n {
        let text = state
            .full_get_segment_text(i)
            .map_err(|e| format!("segment {i} text: {e}"))?;
        out.push_str(&text);
    }
    Ok(out.trim().to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // If a second instance launches, focus the existing settings window
            // (or just no-op for the hidden conversation worker).
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("settings") {
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::AppleScript,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            set_tray_state,
            open_settings,
            ensure_model,
            set_whisper_language,
            set_app_language,
            mic_permission::check_microphone_permission,
            mic_permission::request_microphone_access,
            screen_permission::check_screen_recording_permission,
            screen_permission::request_screen_recording_access,
            screen_permission::open_screen_recording_settings,
            calendar::calendar_status,
            calendar::request_calendar_access,
            audio::start_listening,
            audio::stop_listening,
            audio::pause_listening,
            audio::resume_listening,
            audio::enter_barge_in_mode,
            audio::exit_barge_in_mode,
            openai::chat_complete,
            hud::hud_dismiss,
            hud::hud_show,
            volume::is_muted,
            tray::set_update_available,
            tray::set_tray_character,
            voicevox::voicevox_speakers_list,
            voicevox::voicevox_synthesize,
            voicevox::voicevox_install_status,
            voicevox::voicevox_install,
            voicevox::voicevox_uninstall,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            init_tray(&app.handle())?;
            timer::start_tray_title_ticker(&app.handle());
            calendar::init();
            reminder::init(&app.handle());
            // Auto-spawn the bundled VOICEVOX engine if installed. No-op on
            // platforms without the .app bundle or when nothing is found —
            // the renderer falls back to the default 50021 endpoint in that
            // case (legacy manual-launch path).
            voicevox::init_engine(&app.handle());

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
