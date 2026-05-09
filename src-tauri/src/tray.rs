use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};

use crate::i18n::Lang;

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

fn off_label(lang: Lang) -> &'static str {
    match lang {
        Lang::Ja => "Chappie: マイク入力オフ",
        Lang::En => "Chappie: Mic off",
        Lang::Es => "Chappie: Micrófono apagado",
        Lang::Fr => "Chappie: Micro désactivé",
        Lang::De => "Chappie: Mikrofon aus",
        Lang::Zh => "Chappie: 麦克风已关闭",
        Lang::Pt => "Chappie: Microfone desligado",
        Lang::Ko => "Chappie: 마이크 꺼짐",
        Lang::It => "Chappie: Microfono spento",
    }
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
    pub fn label(self, lang: Lang) -> &'static str {
        match (self, lang) {
            (Self::Initializing, Lang::Ja) => "Chappie: 起動中",
            (Self::Idle, Lang::Ja) => "Chappie: 待機中",
            (Self::Listening, Lang::Ja) => "Chappie: 聞いています",
            (Self::Thinking, Lang::Ja) => "Chappie: 考え中",
            (Self::Speaking, Lang::Ja) => "Chappie: 喋っています",
            (Self::Error, Lang::Ja) => "Chappie: エラー",
            (Self::Initializing, Lang::En) => "Chappie: Starting…",
            (Self::Idle, Lang::En) => "Chappie: Idle",
            (Self::Listening, Lang::En) => "Chappie: Listening",
            (Self::Thinking, Lang::En) => "Chappie: Thinking",
            (Self::Speaking, Lang::En) => "Chappie: Speaking",
            (Self::Error, Lang::En) => "Chappie: Error",
            (Self::Initializing, Lang::Es) => "Chappie: Iniciando…",
            (Self::Idle, Lang::Es) => "Chappie: En espera",
            (Self::Listening, Lang::Es) => "Chappie: Escuchando",
            (Self::Thinking, Lang::Es) => "Chappie: Pensando",
            (Self::Speaking, Lang::Es) => "Chappie: Hablando",
            (Self::Error, Lang::Es) => "Chappie: Error",
            (Self::Initializing, Lang::Fr) => "Chappie: Démarrage…",
            (Self::Idle, Lang::Fr) => "Chappie: En veille",
            (Self::Listening, Lang::Fr) => "Chappie: À l'écoute",
            (Self::Thinking, Lang::Fr) => "Chappie: Réflexion",
            (Self::Speaking, Lang::Fr) => "Chappie: Parle",
            (Self::Error, Lang::Fr) => "Chappie: Erreur",
            (Self::Initializing, Lang::De) => "Chappie: Startet…",
            (Self::Idle, Lang::De) => "Chappie: Bereit",
            (Self::Listening, Lang::De) => "Chappie: Hört zu",
            (Self::Thinking, Lang::De) => "Chappie: Denkt nach",
            (Self::Speaking, Lang::De) => "Chappie: Spricht",
            (Self::Error, Lang::De) => "Chappie: Fehler",
            (Self::Initializing, Lang::Zh) => "Chappie: 启动中…",
            (Self::Idle, Lang::Zh) => "Chappie: 待机中",
            (Self::Listening, Lang::Zh) => "Chappie: 正在聆听",
            (Self::Thinking, Lang::Zh) => "Chappie: 思考中",
            (Self::Speaking, Lang::Zh) => "Chappie: 说话中",
            (Self::Error, Lang::Zh) => "Chappie: 错误",
            (Self::Initializing, Lang::Pt) => "Chappie: Iniciando…",
            (Self::Idle, Lang::Pt) => "Chappie: Em espera",
            (Self::Listening, Lang::Pt) => "Chappie: Ouvindo",
            (Self::Thinking, Lang::Pt) => "Chappie: Pensando",
            (Self::Speaking, Lang::Pt) => "Chappie: Falando",
            (Self::Error, Lang::Pt) => "Chappie: Erro",
            (Self::Initializing, Lang::Ko) => "Chappie: 시작 중…",
            (Self::Idle, Lang::Ko) => "Chappie: 대기 중",
            (Self::Listening, Lang::Ko) => "Chappie: 듣는 중",
            (Self::Thinking, Lang::Ko) => "Chappie: 생각 중",
            (Self::Speaking, Lang::Ko) => "Chappie: 말하는 중",
            (Self::Error, Lang::Ko) => "Chappie: 오류",
            (Self::Initializing, Lang::It) => "Chappie: Avvio…",
            (Self::Idle, Lang::It) => "Chappie: In attesa",
            (Self::Listening, Lang::It) => "Chappie: In ascolto",
            (Self::Thinking, Lang::It) => "Chappie: Sto pensando",
            (Self::Speaking, Lang::It) => "Chappie: Sto parlando",
            (Self::Error, Lang::It) => "Chappie: Errore",
        }
    }
}

fn menu_label_mic(lang: Lang) -> &'static str {
    match lang {
        Lang::Ja => "マイクを有効にする",
        Lang::En => "Enable microphone",
        Lang::Es => "Activar micrófono",
        Lang::Fr => "Activer le microphone",
        Lang::De => "Mikrofon aktivieren",
        Lang::Zh => "启用麦克风",
        Lang::Pt => "Ativar microfone",
        Lang::Ko => "마이크 사용",
        Lang::It => "Attiva microfono",
    }
}

fn menu_label_settings(lang: Lang) -> &'static str {
    match lang {
        Lang::Ja => "設定を開く",
        Lang::En => "Open settings",
        Lang::Es => "Abrir ajustes",
        Lang::Fr => "Ouvrir les réglages",
        Lang::De => "Einstellungen öffnen",
        Lang::Zh => "打开设置",
        Lang::Pt => "Abrir ajustes",
        Lang::Ko => "설정 열기",
        Lang::It => "Apri impostazioni",
    }
}

fn menu_label_help(lang: Lang) -> &'static str {
    match lang {
        Lang::Ja => "使い方",
        Lang::En => "How to use",
        Lang::Es => "Cómo usar",
        Lang::Fr => "Comment l'utiliser",
        Lang::De => "Anleitung",
        Lang::Zh => "使用方法",
        Lang::Pt => "Como usar",
        Lang::Ko => "사용법",
        Lang::It => "Come si usa",
    }
}

fn help_url(lang: Lang) -> String {
    // LP routes en at the root, every other locale under /{locale}/.
    let segment: &str = match lang {
        Lang::En => "",
        Lang::Ja => "ja/",
        Lang::Es => "es/",
        Lang::Fr => "fr/",
        Lang::De => "de/",
        Lang::Zh => "zh/",
        Lang::Pt => "pt/",
        Lang::Ko => "ko/",
        Lang::It => "it/",
    };
    format!("https://chappie.kkweb.io/{segment}capabilities")
}

fn menu_label_check_update(lang: Lang) -> &'static str {
    match lang {
        Lang::Ja => "アップデートを確認",
        Lang::En => "Check for updates",
        Lang::Es => "Buscar actualizaciones",
        Lang::Fr => "Rechercher des mises à jour",
        Lang::De => "Nach Updates suchen",
        Lang::Zh => "检查更新",
        Lang::Pt => "Buscar atualizações",
        Lang::Ko => "업데이트 확인",
        Lang::It => "Controlla aggiornamenti",
    }
}

fn menu_label_quit(lang: Lang) -> &'static str {
    match lang {
        Lang::Ja => "終了",
        Lang::En => "Quit",
        Lang::Es => "Salir",
        Lang::Fr => "Quitter",
        Lang::De => "Beenden",
        Lang::Zh => "退出",
        Lang::Pt => "Sair",
        Lang::Ko => "종료",
        Lang::It => "Esci",
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
    let lang = crate::i18n::current();
    let menu = build_menu(app, TrayState::Idle, true)?;
    let icon = Image::from_bytes(TrayState::Idle.icon_bytes())?;
    let tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(false)
        .tooltip(TrayState::Idle.label(lang))
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
            "open_help" => {
                let url = help_url(crate::i18n::current());
                if let Err(e) =
                    tauri_plugin_opener::OpenerExt::opener(app).open_url(&url, None::<&str>)
                {
                    eprintln!("[tray] open_help failed: {e}");
                }
            }
            "check_update" => {
                let app_clone = app.clone();
                tauri::async_runtime::spawn(async move {
                    crate::updater::check_for_updates(
                        app_clone,
                        crate::updater::CheckTrigger::Manual,
                    )
                    .await;
                });
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
    let lang = crate::i18n::current();
    let status_label = if listening {
        state.label(lang)
    } else {
        off_label(lang)
    };
    let status = MenuItemBuilder::with_id("status", status_label)
        .enabled(false)
        .build(app)?;
    let mic = CheckMenuItemBuilder::with_id("toggle_mic", menu_label_mic(lang))
        .checked(listening)
        .build(app)?;
    let settings =
        MenuItemBuilder::with_id("open_settings", menu_label_settings(lang)).build(app)?;
    let help = MenuItemBuilder::with_id("open_help", menu_label_help(lang)).build(app)?;
    let check_update =
        MenuItemBuilder::with_id("check_update", menu_label_check_update(lang)).build(app)?;
    let quit = MenuItemBuilder::with_id("quit", menu_label_quit(lang)).build(app)?;
    MenuBuilder::new(app)
        .item(&status)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&mic)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&settings)
        .item(&help)
        .item(&check_update)
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
    let lang = crate::i18n::current();
    let (icon_bytes, tooltip) = if listening {
        (state.icon_bytes(), state.label(lang))
    } else {
        (OFF_ICON_BYTES, off_label(lang))
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
