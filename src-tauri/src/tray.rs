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

/// Visual identity for the tray icon set. Driven by the wake-word: when
/// the user invokes a VOICEVOX character (e.g. ずんだもん), the renderer
/// calls `set_tray_character` so the tray glyph matches the voice the
/// user just summoned. Falls back to `Chappie` for every speaker we
/// don't yet ship dedicated icons for. Adding a new character pack:
/// (1) drop 7 PNGs into `src-tauri/icons/<name>-tray-*.png`,
/// (2) add the variant here, (3) wire it in `icon_bytes` /
/// `off_icon_bytes`, (4) extend the speakerId→character map in
/// `useConversationLoop.ts`.
#[derive(Clone, Copy, Debug, serde::Deserialize, serde::Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TrayCharacter {
    Chappie,
    Zundamon,
    Metan,
    Tsumugi,
    Himari,
    Sayo,
    Usagi,
    Zunko,
    Kiritan,
    Itako,
}

impl TrayCharacter {
    fn off_icon_bytes(self) -> &'static [u8] {
        match self {
            Self::Chappie => include_bytes!("../icons/tray-muted.png"),
            Self::Zundamon => include_bytes!("../icons/zundamon-tray-muted.png"),
            Self::Metan => include_bytes!("../icons/metan-tray-muted.png"),
            Self::Tsumugi => include_bytes!("../icons/tsumugi-tray-muted.png"),
            Self::Himari => include_bytes!("../icons/himari-tray-muted.png"),
            Self::Sayo => include_bytes!("../icons/sayo-tray-muted.png"),
            Self::Usagi => include_bytes!("../icons/usagi-tray-muted.png"),
            Self::Zunko => include_bytes!("../icons/zunko-tray-muted.png"),
            Self::Kiritan => include_bytes!("../icons/kiritan-tray-muted.png"),
            Self::Itako => include_bytes!("../icons/itako-tray-muted.png"),
        }
    }
}

// Active tray character. Default to Chappie until init_tray loads the
// persisted last-used character or the renderer pushes one via
// `set_tray_character`. Wake-word switching writes here every turn so
// the icon set always matches the voice currently in use.
static TRAY_CHARACTER: Mutex<TrayCharacter> = Mutex::new(TrayCharacter::Chappie);

pub fn current_character() -> TrayCharacter {
    TRAY_CHARACTER
        .lock()
        .map(|g| *g)
        .unwrap_or(TrayCharacter::Chappie)
}

// Where the active tray character is persisted across launches. Sits
// next to the other ~/.chappie/*.json state files (notes, reminders,
// memory). Single-key JSON to keep the schema cheap to extend later
// (e.g. for explicit "always-Chappie" / "always-zundamon" override
// modes).
fn tray_state_path() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".chappie").join("tray.json"))
}

fn character_to_str(c: TrayCharacter) -> &'static str {
    match c {
        TrayCharacter::Chappie => "chappie",
        TrayCharacter::Zundamon => "zundamon",
        TrayCharacter::Metan => "metan",
        TrayCharacter::Tsumugi => "tsumugi",
        TrayCharacter::Himari => "himari",
        TrayCharacter::Sayo => "sayo",
        TrayCharacter::Usagi => "usagi",
        TrayCharacter::Zunko => "zunko",
        TrayCharacter::Kiritan => "kiritan",
        TrayCharacter::Itako => "itako",
    }
}

fn character_from_str(s: &str) -> Option<TrayCharacter> {
    match s {
        "chappie" => Some(TrayCharacter::Chappie),
        "zundamon" => Some(TrayCharacter::Zundamon),
        "metan" => Some(TrayCharacter::Metan),
        "tsumugi" => Some(TrayCharacter::Tsumugi),
        "himari" => Some(TrayCharacter::Himari),
        "sayo" => Some(TrayCharacter::Sayo),
        "usagi" => Some(TrayCharacter::Usagi),
        "zunko" => Some(TrayCharacter::Zunko),
        "kiritan" => Some(TrayCharacter::Kiritan),
        "itako" => Some(TrayCharacter::Itako),
        _ => None,
    }
}

fn load_persisted_character() -> TrayCharacter {
    let path = match tray_state_path() {
        Some(p) => p,
        None => return TrayCharacter::Chappie,
    };
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(_) => return TrayCharacter::Chappie,
    };
    let v: serde_json::Value = match serde_json::from_slice(&bytes) {
        Ok(v) => v,
        Err(_) => return TrayCharacter::Chappie,
    };
    v.get("character")
        .and_then(|x| x.as_str())
        .and_then(character_from_str)
        .unwrap_or(TrayCharacter::Chappie)
}

fn save_persisted_character(c: TrayCharacter) {
    let path = match tray_state_path() {
        Some(p) => p,
        None => return,
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let payload = serde_json::json!({ "character": character_to_str(c) });
    if let Ok(s) = serde_json::to_string(&payload) {
        let _ = std::fs::write(&path, s);
    }
}

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
    fn icon_bytes(self, character: TrayCharacter) -> &'static [u8] {
        match (character, self) {
            (TrayCharacter::Chappie, Self::Initializing) => {
                include_bytes!("../icons/tray-initializing.png")
            }
            (TrayCharacter::Chappie, Self::Idle) => include_bytes!("../icons/tray-idle.png"),
            (TrayCharacter::Chappie, Self::Listening) => {
                include_bytes!("../icons/tray-listening.png")
            }
            (TrayCharacter::Chappie, Self::Thinking) => {
                include_bytes!("../icons/tray-thinking.png")
            }
            (TrayCharacter::Chappie, Self::Speaking) => {
                include_bytes!("../icons/tray-speaking.png")
            }
            (TrayCharacter::Chappie, Self::Error) => include_bytes!("../icons/tray-error.png"),
            (TrayCharacter::Zundamon, Self::Initializing) => {
                include_bytes!("../icons/zundamon-tray-initializing.png")
            }
            (TrayCharacter::Zundamon, Self::Idle) => {
                include_bytes!("../icons/zundamon-tray-idle.png")
            }
            (TrayCharacter::Zundamon, Self::Listening) => {
                include_bytes!("../icons/zundamon-tray-listening.png")
            }
            (TrayCharacter::Zundamon, Self::Thinking) => {
                include_bytes!("../icons/zundamon-tray-thinking.png")
            }
            (TrayCharacter::Zundamon, Self::Speaking) => {
                include_bytes!("../icons/zundamon-tray-speaking.png")
            }
            (TrayCharacter::Zundamon, Self::Error) => {
                include_bytes!("../icons/zundamon-tray-error.png")
            }
            (TrayCharacter::Metan, Self::Initializing) => {
                include_bytes!("../icons/metan-tray-initializing.png")
            }
            (TrayCharacter::Metan, Self::Idle) => {
                include_bytes!("../icons/metan-tray-idle.png")
            }
            (TrayCharacter::Metan, Self::Listening) => {
                include_bytes!("../icons/metan-tray-listening.png")
            }
            (TrayCharacter::Metan, Self::Thinking) => {
                include_bytes!("../icons/metan-tray-thinking.png")
            }
            (TrayCharacter::Metan, Self::Speaking) => {
                include_bytes!("../icons/metan-tray-speaking.png")
            }
            (TrayCharacter::Metan, Self::Error) => {
                include_bytes!("../icons/metan-tray-error.png")
            }
            (TrayCharacter::Tsumugi, Self::Initializing) => {
                include_bytes!("../icons/tsumugi-tray-initializing.png")
            }
            (TrayCharacter::Tsumugi, Self::Idle) => {
                include_bytes!("../icons/tsumugi-tray-idle.png")
            }
            (TrayCharacter::Tsumugi, Self::Listening) => {
                include_bytes!("../icons/tsumugi-tray-listening.png")
            }
            (TrayCharacter::Tsumugi, Self::Thinking) => {
                include_bytes!("../icons/tsumugi-tray-thinking.png")
            }
            (TrayCharacter::Tsumugi, Self::Speaking) => {
                include_bytes!("../icons/tsumugi-tray-speaking.png")
            }
            (TrayCharacter::Tsumugi, Self::Error) => {
                include_bytes!("../icons/tsumugi-tray-error.png")
            }
            (TrayCharacter::Himari, Self::Initializing) => {
                include_bytes!("../icons/himari-tray-initializing.png")
            }
            (TrayCharacter::Himari, Self::Idle) => {
                include_bytes!("../icons/himari-tray-idle.png")
            }
            (TrayCharacter::Himari, Self::Listening) => {
                include_bytes!("../icons/himari-tray-listening.png")
            }
            (TrayCharacter::Himari, Self::Thinking) => {
                include_bytes!("../icons/himari-tray-thinking.png")
            }
            (TrayCharacter::Himari, Self::Speaking) => {
                include_bytes!("../icons/himari-tray-speaking.png")
            }
            (TrayCharacter::Himari, Self::Error) => {
                include_bytes!("../icons/himari-tray-error.png")
            }
            (TrayCharacter::Sayo, Self::Initializing) => {
                include_bytes!("../icons/sayo-tray-initializing.png")
            }
            (TrayCharacter::Sayo, Self::Idle) => {
                include_bytes!("../icons/sayo-tray-idle.png")
            }
            (TrayCharacter::Sayo, Self::Listening) => {
                include_bytes!("../icons/sayo-tray-listening.png")
            }
            (TrayCharacter::Sayo, Self::Thinking) => {
                include_bytes!("../icons/sayo-tray-thinking.png")
            }
            (TrayCharacter::Sayo, Self::Speaking) => {
                include_bytes!("../icons/sayo-tray-speaking.png")
            }
            (TrayCharacter::Sayo, Self::Error) => {
                include_bytes!("../icons/sayo-tray-error.png")
            }
            (TrayCharacter::Usagi, Self::Initializing) => {
                include_bytes!("../icons/usagi-tray-initializing.png")
            }
            (TrayCharacter::Usagi, Self::Idle) => {
                include_bytes!("../icons/usagi-tray-idle.png")
            }
            (TrayCharacter::Usagi, Self::Listening) => {
                include_bytes!("../icons/usagi-tray-listening.png")
            }
            (TrayCharacter::Usagi, Self::Thinking) => {
                include_bytes!("../icons/usagi-tray-thinking.png")
            }
            (TrayCharacter::Usagi, Self::Speaking) => {
                include_bytes!("../icons/usagi-tray-speaking.png")
            }
            (TrayCharacter::Usagi, Self::Error) => {
                include_bytes!("../icons/usagi-tray-error.png")
            }
            (TrayCharacter::Zunko, Self::Initializing) => {
                include_bytes!("../icons/zunko-tray-initializing.png")
            }
            (TrayCharacter::Zunko, Self::Idle) => {
                include_bytes!("../icons/zunko-tray-idle.png")
            }
            (TrayCharacter::Zunko, Self::Listening) => {
                include_bytes!("../icons/zunko-tray-listening.png")
            }
            (TrayCharacter::Zunko, Self::Thinking) => {
                include_bytes!("../icons/zunko-tray-thinking.png")
            }
            (TrayCharacter::Zunko, Self::Speaking) => {
                include_bytes!("../icons/zunko-tray-speaking.png")
            }
            (TrayCharacter::Zunko, Self::Error) => {
                include_bytes!("../icons/zunko-tray-error.png")
            }
            (TrayCharacter::Kiritan, Self::Initializing) => {
                include_bytes!("../icons/kiritan-tray-initializing.png")
            }
            (TrayCharacter::Kiritan, Self::Idle) => {
                include_bytes!("../icons/kiritan-tray-idle.png")
            }
            (TrayCharacter::Kiritan, Self::Listening) => {
                include_bytes!("../icons/kiritan-tray-listening.png")
            }
            (TrayCharacter::Kiritan, Self::Thinking) => {
                include_bytes!("../icons/kiritan-tray-thinking.png")
            }
            (TrayCharacter::Kiritan, Self::Speaking) => {
                include_bytes!("../icons/kiritan-tray-speaking.png")
            }
            (TrayCharacter::Kiritan, Self::Error) => {
                include_bytes!("../icons/kiritan-tray-error.png")
            }
            (TrayCharacter::Itako, Self::Initializing) => {
                include_bytes!("../icons/itako-tray-initializing.png")
            }
            (TrayCharacter::Itako, Self::Idle) => {
                include_bytes!("../icons/itako-tray-idle.png")
            }
            (TrayCharacter::Itako, Self::Listening) => {
                include_bytes!("../icons/itako-tray-listening.png")
            }
            (TrayCharacter::Itako, Self::Thinking) => {
                include_bytes!("../icons/itako-tray-thinking.png")
            }
            (TrayCharacter::Itako, Self::Speaking) => {
                include_bytes!("../icons/itako-tray-speaking.png")
            }
            (TrayCharacter::Itako, Self::Error) => {
                include_bytes!("../icons/itako-tray-error.png")
            }
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

/// Switch the tray icon set to a character. Called by the renderer
/// from `applyVoiceForWake` whenever the active VOICEVOX speaker
/// changes (or back to Chappie on the chappie wake-word). Re-applies
/// the current state so the icon updates immediately without waiting
/// for the next state transition.
#[tauri::command]
pub fn set_tray_character(app: AppHandle, character: TrayCharacter) {
    {
        let mut g = match TRAY_CHARACTER.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        if *g == character {
            return;
        }
        *g = character;
    }
    save_persisted_character(character);
    let cur_state = current_tray_state(&app).unwrap_or(TrayState::Idle);
    let _ = apply_tray_state(&app, cur_state);
}

pub fn init_tray(app: &AppHandle) -> tauri::Result<()> {
    // Restore the last-used character before building the icon so the
    // initial glyph already matches the voice the user left off with,
    // even before any wake-word in this session.
    let persisted = load_persisted_character();
    if let Ok(mut g) = TRAY_CHARACTER.lock() {
        *g = persisted;
    }
    let lang = crate::i18n::current();
    let menu = build_menu(app, TrayState::Idle, true)?;
    let icon = Image::from_bytes(TrayState::Idle.icon_bytes(current_character()))?;
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
    let character = current_character();
    let (icon_bytes, tooltip) = if listening {
        (state.icon_bytes(character), state.label(lang))
    } else {
        (character.off_icon_bytes(), off_label(lang))
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
