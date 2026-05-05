mod tray;

use once_cell::sync::OnceCell;
use std::sync::Mutex;
use tray::{apply_tray_state, init_tray, open_settings_window, TrayState};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

static WHISPER_CTX: OnceCell<Mutex<WhisperContext>> = OnceCell::new();

fn model_path() -> std::path::PathBuf {
    // PoC: read from a fixed location in the user's home dir.
    let home = std::env::var("HOME").expect("HOME unset");
    std::path::PathBuf::from(home).join(".chappie/models/ggml-tiny.bin")
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

#[tauri::command]
fn transcribe(audio: Vec<f32>, language: Option<String>) -> Result<String, String> {
    let ctx = get_ctx()?;
    let ctx = ctx.lock().map_err(|e| format!("lock poisoned: {e}"))?;

    let mut state = ctx.create_state().map_err(|e| format!("create_state: {e}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(language.as_deref().or(Some("ja")));
    params.set_translate(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_special(false);
    params.set_print_timestamps(false);

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            transcribe,
            set_tray_state,
            open_settings
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            init_tray(&app.handle())?;

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
