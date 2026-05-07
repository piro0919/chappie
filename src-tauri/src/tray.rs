use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder,
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

pub struct TrayHandle<R: Runtime>(pub Mutex<TrayIcon<R>>);

pub fn init_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app, TrayState::Idle)?;
    let icon = Image::from_bytes(TrayState::Idle.icon_bytes())?;
    let tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(false)
        .tooltip(TrayState::Idle.label())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_settings" => {
                let _ = open_settings_window(app);
            }
            "show_debug" => {
                use tauri::Manager;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
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
    app.manage(TrayHandle(Mutex::new(tray)));
    Ok(())
}

fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    state: TrayState,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let status = MenuItemBuilder::with_id("status", state.label())
        .enabled(false)
        .build(app)?;
    let settings = MenuItemBuilder::with_id("open_settings", "設定を開く").build(app)?;
    let debug = MenuItemBuilder::with_id("show_debug", "デバッグウィンドウを開く").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "終了").build(app)?;
    MenuBuilder::new(app)
        .item(&status)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&settings)
        .item(&debug)
        .item(&quit)
        .build()
}

pub fn apply_tray_state<R: Runtime>(
    app: &AppHandle<R>,
    state: TrayState,
) -> tauri::Result<()> {
    let handle = app.state::<TrayHandle<R>>();
    let tray = handle.0.lock().unwrap();
    tray.set_icon(Some(Image::from_bytes(state.icon_bytes())?))?;
    tray.set_tooltip(Some(state.label()))?;
    let menu = build_menu(app, state)?;
    tray.set_menu(Some(menu))?;
    Ok(())
}

pub fn open_settings_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(
        app,
        "settings",
        WebviewUrl::App("index.html?view=settings".into()),
    )
    .title("Chappie 設定")
    .inner_size(480.0, 360.0)
    .resizable(false)
    .build()?;
    Ok(())
}
