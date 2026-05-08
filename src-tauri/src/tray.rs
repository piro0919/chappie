use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};

#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TrayState {
    Initializing,
    Idle,
    Listening,
    Thinking,
    Speaking,
    Error,
}

// Used to override the normal state icon while the user has toggled mic
// input off from the tray menu. The cpal stream is fully released in this
// mode so macOS no longer shows its "in-use" microphone indicator.
const OFF_ICON_BYTES: &[u8] = include_bytes!("../icons/tray-muted.png");
const OFF_LABEL: &str = "Chappie: マイク入力オフ";

impl TrayState {
    fn icon_bytes(self) -> &'static [u8] {
        match self {
            Self::Initializing => include_bytes!("../icons/tray-initializing.png"),
            Self::Idle => include_bytes!("../icons/tray-idle.png"),
            Self::Listening => include_bytes!("../icons/tray-listening.png"),
            Self::Thinking => include_bytes!("../icons/tray-thinking.png"),
            Self::Speaking => include_bytes!("../icons/tray-speaking.png"),
            Self::Error => include_bytes!("../icons/tray-error.png"),
        }
    }
    fn label(self) -> &'static str {
        match self {
            Self::Initializing => "Chappie: 起動中",
            Self::Idle => "Chappie: 待機中",
            Self::Listening => "Chappie: 聞いています",
            Self::Thinking => "Chappie: 考え中",
            Self::Speaking => "Chappie: 喋っています",
            Self::Error => "Chappie: エラー",
        }
    }
}

pub struct TrayHandle {
    pub icon: Mutex<TrayIcon<tauri::Wry>>,
    pub last_state: Mutex<TrayState>,
}

// When an update is detected but the user dismisses the prompt, we surface
// a persistent 🔔 badge in the tray title so they don't forget. Cleared on
// successful update + relaunch.
pub static UPDATE_AVAILABLE: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
pub fn set_update_available(available: bool) {
    UPDATE_AVAILABLE.store(available, std::sync::atomic::Ordering::Relaxed);
}

pub fn init_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app, TrayState::Idle, true)?;
    let icon = Image::from_bytes(TrayState::Idle.icon_bytes())?;
    let tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(false)
        .tooltip(TrayState::Idle.label())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle_mic" => {
                // OFF really releases the mic (drops the cpal stream) so
                // macOS no longer reports Chappie as a mic-using app — the
                // system-level orange indicator goes away. ON re-acquires.
                let app_clone = app.clone();
                if crate::audio::is_listening() {
                    let _ = crate::audio::stop_listening();
                    let cur_state = current_tray_state(app).unwrap_or(TrayState::Idle);
                    let _ = apply_tray_state(app, cur_state);
                } else {
                    tauri::async_runtime::spawn(async move {
                        match crate::audio::start_listening(app_clone.clone()).await {
                            Ok(_) => {
                                let cur_state =
                                    current_tray_state(&app_clone).unwrap_or(TrayState::Idle);
                                let _ = apply_tray_state(&app_clone, cur_state);
                            }
                            Err(e) => {
                                eprintln!("[tray] re-start_listening failed: {e}");
                            }
                        }
                    });
                }
            }
            "open_settings" => {
                let _ = open_settings_window(app);
            }
            "quit" => {
                // Stop cpal cleanly so Core Audio releases the input device
                // before the process exits. Without this the tray exit can
                // leave the mic indicator stuck briefly on macOS.
                let _ = crate::audio::stop_listening();
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;
    app.manage(TrayHandle {
        icon: Mutex::new(tray),
        last_state: Mutex::new(TrayState::Idle),
    });
    Ok(())
}

fn build_menu(
    app: &AppHandle,
    state: TrayState,
    listening: bool,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let status_label = if listening { state.label() } else { OFF_LABEL };
    let status = MenuItemBuilder::with_id("status", status_label)
        .enabled(false)
        .build(app)?;
    let mic = CheckMenuItemBuilder::with_id("toggle_mic", "マイクを有効にする")
        .checked(listening)
        .build(app)?;
    let settings = MenuItemBuilder::with_id("open_settings", "設定を開く").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "終了").build(app)?;
    MenuBuilder::new(app)
        .item(&status)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&mic)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&settings)
        .item(&quit)
        .build()
}

// macOS-only: explicitly activate the app so an LSUIElement / Accessory
// process can bring its newly-shown window to the foreground. Without
// NSApp.activate(ignoringOtherApps:true) the window draws behind whatever
// is currently focused.
#[cfg(target_os = "macos")]
pub fn activate_app_for_window() {
    use objc2::{class, msg_send, runtime::AnyObject};
    unsafe {
        let app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        if !app.is_null() {
            let _: () = msg_send![app, activateIgnoringOtherApps: true];
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn activate_app_for_window() {}

fn current_tray_state(app: &AppHandle) -> Option<TrayState> {
    let handle = app.try_state::<TrayHandle>()?;
    let state = *handle.last_state.lock().ok()?;
    Some(state)
}

pub fn apply_tray_state(app: &AppHandle, state: TrayState) -> tauri::Result<()> {
    let handle = app.state::<TrayHandle>();
    let tray = handle.icon.lock().unwrap();
    *handle.last_state.lock().unwrap() = state;
    let listening = crate::audio::is_listening();
    let (icon_bytes, tooltip) = if listening {
        (state.icon_bytes(), state.label())
    } else {
        (OFF_ICON_BYTES, OFF_LABEL)
    };
    tray.set_icon(Some(Image::from_bytes(icon_bytes)?))?;
    tray.set_tooltip(Some(tooltip))?;
    let menu = build_menu(app, state, listening)?;
    tray.set_menu(Some(menu))?;
    Ok(())
}

pub fn open_settings_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return Ok(());
    }
    let win = WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html?view=settings".into()),
    )
    .title("Chappie 設定")
    .inner_size(480.0, 360.0)
    .resizable(false)
    .focused(true)
    .build()?;
    // Accessory-mode (LSUIElement) apps don't normally come to the front
    // when a window is created, so we explicitly raise it. show() + focus()
    // brings the window above other apps; on macOS we additionally need
    // the app to "activate" so the window can take key state.
    #[cfg(target_os = "macos")]
    activate_app_for_window();
    let _ = win.show();
    let _ = win.set_focus();
    #[cfg(debug_assertions)]
    win.open_devtools();
    let _ = win;
    Ok(())
}
