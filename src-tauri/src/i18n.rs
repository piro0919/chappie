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

/// Hint string injected into the system prompt of every chat_complete
/// call so the LLM can pitch greetings, news readouts, and weather
/// summaries against the right time of day without having to call the
/// `get_current_time` tool. Bucketed into 4 bands (not per-minute) so
/// it changes at most 4 times per day — keeps prompt-cache disruption
/// tiny. The text stays Japanese to match the persona's voice (the
/// model adjusts language for the user automatically).
pub fn time_band_hint() -> String {
    use chrono::Timelike;
    let h = chrono::Local::now().hour();
    let band = match h {
        5..=10 => "朝",
        11..=16 => "昼間",
        17..=21 => "夕方〜夜",
        _ => "深夜",
    };
    format!(
        "現在のおおよその時間帯は{band}です。挨拶・ニュース読み上げ・天気サマリ等のトーンや、デフォルトで言及する時間範囲をこの時間帯に合わせてください（朝なら明るめで今日の予定、夕方ならねぎらいつつ明日の予定、深夜なら控えめに）。",
    )
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
