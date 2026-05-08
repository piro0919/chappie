use std::sync::Mutex;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lang {
    Ja,
    En,
    Es,
    Fr,
    De,
    Zh,
    Pt,
    Ko,
    It,
}

static APP_LANG: Mutex<Lang> = Mutex::new(Lang::Ja);

pub fn current() -> Lang {
    APP_LANG.lock().map(|g| *g).unwrap_or(Lang::Ja)
}

pub fn set(lang: &str) {
    let l = match lang {
        "en" => Lang::En,
        "es" => Lang::Es,
        "fr" => Lang::Fr,
        "de" => Lang::De,
        "zh" => Lang::Zh,
        "pt" => Lang::Pt,
        "ko" => Lang::Ko,
        "it" => Lang::It,
        _ => Lang::Ja,
    };
    if let Ok(mut g) = APP_LANG.lock() {
        *g = l;
    }
}
