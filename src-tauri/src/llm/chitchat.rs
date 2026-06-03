// Ultra-conservative chitchat classifier. When the user's utterance
// looks like pure small-talk (greeting / thanks / feelings / casual
// question / joke / fortune / story / translation), we swap the full
// ~45 tool definitions for a minimal set (just `end_conversation`)
// before the LLM call. Drops ~7-8k input tokens per chitchat turn.
//
// "Conservative" = three AND conditions:
//   1. no_tool_keyword:        none of the tool-domain words appear
//   2. is_short:               utterance fits in a brief sentence
//   3. matches_chitchat_pattern: at least one greeting/feeling/casual phrase hits
//
// False positives (classifying a tool-needing utterance as chitchat)
// would cause the LLM to answer "I can't do that" — UX broken. False
// negatives (classifying chitchat as Full) are merely a missed savings
// opportunity. The 3-AND gate keeps false positives near-zero while
// still catching the bulk of pure chitchat.
//
// JP + EN dictionaries are comprehensive. The other 7 languages
// (es/fr/de/it/pt/ko/zh) ship with a baseline ~15-word tool keyword
// list and ~10 chitchat patterns — enough to start saving on the most
// common phrases without breaking tool routing. Future PRs can expand
// these from real usage telemetry.

use crate::i18n::Lang;

pub fn is_chitchat(utterance: &str, lang: Lang) -> bool {
    let trimmed = utterance.trim();
    if trimmed.is_empty() {
        return false;
    }
    no_tool_keyword(trimmed, lang)
        && is_short(trimmed, lang)
        && matches_chitchat_pattern(trimmed, lang)
}

/// True when none of the tool-domain keywords appear in the utterance.
/// CJK substring match is direct; Latin scripts are lowercased first.
fn no_tool_keyword(utterance: &str, lang: Lang) -> bool {
    let (kw, latin) = tool_keywords(lang);
    let hay = if latin {
        utterance.to_lowercase()
    } else {
        utterance.to_string()
    };
    !kw.iter().any(|k| hay.contains(k))
}

/// Length budget in Unicode scalar values. CJK languages get a tighter
/// cap because each character carries more meaning; Latin scripts get
/// a looser cap because a "thanks for that" greeting can easily run
/// 30-40 chars.
fn is_short(utterance: &str, lang: Lang) -> bool {
    let n = utterance.chars().count();
    let cap = match lang {
        Lang::Ja | Lang::Zh | Lang::Ko => 25,
        _ => 80,
    };
    n <= cap
}

fn matches_chitchat_pattern(utterance: &str, lang: Lang) -> bool {
    let (patterns, latin) = chitchat_patterns(lang);
    let hay = if latin {
        utterance.to_lowercase()
    } else {
        utterance.to_string()
    };
    patterns.iter().any(|p| hay.contains(p))
}

/// Returns (keywords, is_latin_script). Latin-script languages get
/// case-folded comparison; CJK does not (case folding is a no-op for
/// ideographs and breaks katakana/hiragana shape).
fn tool_keywords(lang: Lang) -> (&'static [&'static str], bool) {
    match lang {
        Lang::Ja => (JA_TOOL_KEYWORDS, false),
        Lang::En => (EN_TOOL_KEYWORDS, true),
        Lang::Es => (ES_TOOL_KEYWORDS, true),
        Lang::Fr => (FR_TOOL_KEYWORDS, true),
        Lang::De => (DE_TOOL_KEYWORDS, true),
        Lang::It => (IT_TOOL_KEYWORDS, true),
        Lang::Pt => (PT_TOOL_KEYWORDS, true),
        Lang::Ko => (KO_TOOL_KEYWORDS, false),
        Lang::Zh => (ZH_TOOL_KEYWORDS, false),
    }
}

fn chitchat_patterns(lang: Lang) -> (&'static [&'static str], bool) {
    match lang {
        Lang::Ja => (JA_CHITCHAT, false),
        Lang::En => (EN_CHITCHAT, true),
        Lang::Es => (ES_CHITCHAT, true),
        Lang::Fr => (FR_CHITCHAT, true),
        Lang::De => (DE_CHITCHAT, true),
        Lang::It => (IT_CHITCHAT, true),
        Lang::Pt => (PT_CHITCHAT, true),
        Lang::Ko => (KO_CHITCHAT, false),
        Lang::Zh => (ZH_CHITCHAT, false),
    }
}

// ===== JP (comprehensive) =====

const JA_TOOL_KEYWORDS: &[&str] = &[
    // time / timer / reminder / calendar
    "タイマー", "アラーム", "リマインダー", "リマインド", "リマインド", "目覚まし",
    "何時", "今何時", "時刻", "予定", "カレンダー", "スケジュール",
    // weather / location
    "天気", "気温", "雨", "雪", "湿度", "風速", "降水", "台風",
    // volume / mute / battery / sleep
    "音量", "ボリューム", "ミュート", "消音", "バッテリー", "残量", "充電",
    "ロック", "スリープ", "スクリーン", "起きてて",
    // music / youtube / media
    "音楽", "曲", "再生", "停止", "一時停止", "次の曲", "前の曲", "止めて",
    "YouTube", "ユーチューブ", "動画",
    // notes / memory / clipboard
    "メモ", "ノート", "覚え", "記憶", "忘れ", "知っ", "クリップボード", "コピー",
    // capabilities
    "何ができ", "何できる", "なにできる",
    // web / apps
    "開い", "起動", "立ち上げ", "検索", "ググ", "サイト", "アプリ",
    // screenshot
    "スクショ", "スクリーンショット", "キャプチャ",
    // sports / fx / stocks / news / wiki / quake / units / mlb
    "試合", "スコア", "野球", "MLB", "大谷", "ドジャース", "ヤンキース",
    "為替", "ドル", "ユーロ", "円", "レート", "株価", "株式", "日経", "ナスダック", "S&P",
    "ニュース", "速報", "見出し",
    "Wikipedia", "ウィキペディア", "ウィキ",
    "地震", "震度", "震源",
    "単位", "換算", "華氏", "摂氏", "マイル", "ヤード", "フィート", "ポンド",
    "オンス", "カップ", "ガロン", "リットル", "キログラム",
    // sunrise / moon
    "日の出", "日の入り", "月齢", "満月",
    // fetch / page summary
    "要約", "URL", "リンク",
];

const JA_CHITCHAT: &[&str] = &[
    // greetings
    "ありがとう", "ありがと", "サンキュー", "おはよう", "こんにちは", "こんばんは",
    "おやすみ", "またね", "じゃあね", "さようなら", "バイバイ",
    // feelings
    "元気", "疲れた", "嬉しい", "悲しい", "楽しい", "つらい", "しんどい", "眠い",
    "退屈", "お腹すいた", "好き", "嫌い",
    // small reactions
    "そっか", "なるほど", "へえ", "へー", "ふーん", "そうなんだ", "すごい", "やった",
    "うん", "はい", "いいね", "OK", "オッケー",
    // chitchat triggers
    "ねえ", "ちょっと聞いて", "話そう", "話したい",
    "ジョーク", "面白い話", "占い", "物語", "創作", "歌詞", "詩",
    "翻訳", "雑学", "気休め", "相談", "どう思",
    // weather feeling (no "天気" keyword)
    "寒い", "暑い", "暖か",
];

// ===== EN (comprehensive) =====

const EN_TOOL_KEYWORDS: &[&str] = &[
    "timer", "alarm", "reminder", "remind", "wake me", "schedule", "calendar",
    "what time", "the time",
    "weather", "temperature", "rain", "snow", "humidity", "forecast", "typhoon",
    "volume", "mute", "louder", "quieter", "battery", "charge",
    "lock", "sleep", "screen", "stay awake",
    "music", "song", "play ", "pause", "next track", "previous track",
    "youtube", "video",
    "note ", "memo", "remember ", "forget", "clipboard", "copy ",
    "what can you", "what do you do", "capabilit",
    "open ", "launch", "start ", "search", "google", "website",
    "screenshot", "capture",
    "stock", "stocks", "nasdaq", "dow", "nikkei", "s&p", "apple stock",
    "fx", "forex", "currency", "dollar", "euro", "yen", "exchange rate",
    "news", "headline",
    "wiki", "wikipedia",
    "earthquake", "quake", "magnitude",
    "convert", "conversion", "fahrenheit", "celsius", "kelvin",
    "miles", "mile", "kilometer", "km", "pound", "ounce", "gallon", "liter",
    "score", "game", "mlb", "dodgers", "yankees", "ohtani",
    "sunrise", "sunset", "moon",
    "summarize", "url ", "link",
];

const EN_CHITCHAT: &[&str] = &[
    "thanks", "thank you", "thx", "appreciate",
    "hello", "hi ", "hi!", "hi.", "hey", "good morning", "good night", "good evening",
    "bye", "see you", "goodbye", "see ya",
    "how are you", "how's it going", "how do you feel",
    "tired", "happy", "sad", "bored", "lonely", "sleepy", "hungry",
    "i love", "i hate", "i like",
    "okay", "ok ", "alright", "sure", "really", "wow", "oh ",
    "nice", "cool", "great", "awesome",
    "joke", "fortune", "tell me a story", "translate", "trivia",
    "what do you think", "i'm bored",
    "it's cold", "it's hot", "warm",
];

// ===== ES (baseline) =====

const ES_TOOL_KEYWORDS: &[&str] = &[
    "temporizador", "alarma", "recordar", "calendario", "hora",
    "tiempo", "clima", "temperatura",
    "volumen", "silenciar", "música", "canción", "youtube",
    "nota", "recordatorio", "abrir", "buscar",
    "batería", "captura",
    "dólar", "euro", "yen", "cambio", "bolsa", "acción",
    "noticias", "wikipedia", "terremoto", "convertir",
];

const ES_CHITCHAT: &[&str] = &[
    "gracias", "hola", "buenos días", "buenas noches", "adiós",
    "cómo estás", "estoy cansado", "feliz", "triste", "aburrido",
    "chiste", "broma", "cuéntame", "traduce",
];

// ===== FR (baseline) =====

const FR_TOOL_KEYWORDS: &[&str] = &[
    "minuteur", "alarme", "rappel", "calendrier", "heure",
    "météo", "température",
    "volume", "muet", "musique", "chanson", "youtube",
    "note", "rappel", "ouvrir", "rechercher",
    "batterie", "capture",
    "dollar", "euro", "yen", "change", "bourse", "action",
    "actualités", "wikipédia", "tremblement", "convertir",
];

const FR_CHITCHAT: &[&str] = &[
    "merci", "bonjour", "bonsoir", "bonne nuit", "au revoir",
    "comment vas-tu", "ça va", "fatigué", "heureux", "triste", "ennuyé",
    "blague", "raconte", "traduis",
];

// ===== DE (baseline) =====

const DE_TOOL_KEYWORDS: &[&str] = &[
    "timer", "wecker", "erinnerung", "kalender", "uhrzeit",
    "wetter", "temperatur",
    "lautstärke", "stumm", "musik", "lied", "youtube",
    "notiz", "öffne", "suche",
    "akku", "screenshot",
    "dollar", "euro", "yen", "wechselkurs", "aktie", "börse",
    "nachrichten", "wikipedia", "erdbeben", "umrechnen",
];

const DE_CHITCHAT: &[&str] = &[
    "danke", "hallo", "guten morgen", "gute nacht", "tschüss", "auf wiedersehen",
    "wie geht's", "müde", "glücklich", "traurig", "gelangweilt",
    "witz", "erzähl", "übersetze",
];

// ===== IT (baseline) =====

const IT_TOOL_KEYWORDS: &[&str] = &[
    "timer", "sveglia", "promemoria", "calendario", "ora",
    "tempo", "meteo", "temperatura",
    "volume", "muto", "musica", "canzone", "youtube",
    "nota", "apri", "cerca",
    "batteria", "screenshot",
    "dollaro", "euro", "yen", "cambio", "borsa", "azione",
    "notizie", "wikipedia", "terremoto", "convertire",
];

const IT_CHITCHAT: &[&str] = &[
    "grazie", "ciao", "buongiorno", "buonanotte", "arrivederci",
    "come stai", "stanco", "felice", "triste", "annoiato",
    "barzelletta", "racconta", "traduci",
];

// ===== PT (baseline) =====

const PT_TOOL_KEYWORDS: &[&str] = &[
    "temporizador", "alarme", "lembrete", "calendário", "hora",
    "tempo", "clima", "temperatura",
    "volume", "silenciar", "música", "canção", "youtube",
    "nota", "abrir", "buscar",
    "bateria", "captura",
    "dólar", "euro", "iene", "câmbio", "ação", "bolsa",
    "notícias", "wikipédia", "terremoto", "converter",
];

const PT_CHITCHAT: &[&str] = &[
    "obrigado", "obrigada", "olá", "bom dia", "boa noite", "tchau",
    "como vai", "cansado", "feliz", "triste", "entediado",
    "piada", "conta", "traduz",
];

// ===== KO (baseline) =====

const KO_TOOL_KEYWORDS: &[&str] = &[
    "타이머", "알람", "리마인더", "일정", "캘린더", "시간", "몇 시",
    "날씨", "기온", "비", "눈",
    "볼륨", "음소거", "음악", "노래", "유튜브",
    "메모", "열어", "검색",
    "배터리", "스크린샷",
    "달러", "유로", "엔", "환율", "주식", "주가", "닛케이",
    "뉴스", "위키", "지진", "변환", "환산",
];

const KO_CHITCHAT: &[&str] = &[
    "고마워", "감사", "안녕", "잘 자", "잘자", "안녕히",
    "어떻게", "피곤", "행복", "슬퍼", "심심",
    "농담", "이야기", "번역",
];

// ===== ZH (baseline) =====

const ZH_TOOL_KEYWORDS: &[&str] = &[
    "计时", "定时", "闹钟", "提醒", "日历", "几点", "时间",
    "天气", "温度", "下雨",
    "音量", "静音", "音乐", "歌", "YouTube", "优酷",
    "记事", "笔记", "打开", "搜索",
    "电池", "截图",
    "美元", "欧元", "日元", "汇率", "股票", "股价", "日经",
    "新闻", "维基", "地震", "换算", "转换",
];

const ZH_CHITCHAT: &[&str] = &[
    "谢谢", "你好", "早安", "晚安", "再见",
    "怎么样", "累", "开心", "难过", "无聊",
    "笑话", "讲个", "翻译",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_is_not_chitchat() {
        assert!(!is_chitchat("", Lang::Ja));
        assert!(!is_chitchat("   ", Lang::Ja));
    }

    // 30 positive cases — must classify as Chitchat (minimal tools).
    #[test]
    fn positives_classify_as_chitchat() {
        let cases: &[(&str, Lang)] = &[
            // JP 15
            ("ありがとう", Lang::Ja),
            ("ありがとー", Lang::Ja),
            ("おはよう", Lang::Ja),
            ("こんにちは", Lang::Ja),
            ("おやすみ", Lang::Ja),
            ("またね", Lang::Ja),
            ("元気？", Lang::Ja),
            ("疲れた…", Lang::Ja),
            ("ねえ", Lang::Ja),
            ("すごい！", Lang::Ja),
            ("そっか", Lang::Ja),
            ("楽しい", Lang::Ja),
            ("ジョーク言って", Lang::Ja),
            ("占いして", Lang::Ja),
            ("寒いね", Lang::Ja),
            // EN 10
            ("thanks", Lang::En),
            ("thank you", Lang::En),
            ("hi there", Lang::En),
            ("good morning", Lang::En),
            ("how are you?", Lang::En),
            ("i'm tired", Lang::En),
            ("tell me a joke", Lang::En),
            ("i'm bored", Lang::En),
            ("really?", Lang::En),
            ("i love it", Lang::En),
            // Others 5
            ("gracias", Lang::Es),
            ("bonjour", Lang::Fr),
            ("danke", Lang::De),
            ("谢谢", Lang::Zh),
            ("고마워", Lang::Ko),
        ];
        for (utt, lang) in cases {
            assert!(
                is_chitchat(utt, *lang),
                "expected Chitchat for {:?} ({:?})",
                utt,
                lang
            );
        }
    }

    // 30 negative cases — must classify as Full (every tool available).
    #[test]
    fn negatives_classify_as_full() {
        let cases: &[(&str, Lang)] = &[
            // JP 15 — covers every tool family
            ("タイマー 5 分", Lang::Ja),
            ("天気は？", Lang::Ja),
            ("音量下げて", Lang::Ja),
            ("YouTube で猫", Lang::Ja),
            ("メモして", Lang::Ja),
            ("7 時に起こして", Lang::Ja),
            ("ドル円教えて", Lang::Ja),
            ("明日の予定", Lang::Ja),
            ("アップルの株価", Lang::Ja),
            ("華氏 70 度って何度？", Lang::Ja),
            ("Wikipedia でアインシュタイン", Lang::Ja),
            ("地震は？", Lang::Ja),
            ("何ができる？", Lang::Ja),
            ("日経平均", Lang::Ja),
            ("5 マイル何キロ？", Lang::Ja),
            // EN 10
            ("set a 5 min timer", Lang::En),
            ("what's the weather", Lang::En),
            ("turn down the volume", Lang::En),
            ("play music", Lang::En),
            ("add a note", Lang::En),
            ("wake me up at 7", Lang::En),
            ("USD to JPY", Lang::En),
            ("what's on my calendar", Lang::En),
            ("apple stock", Lang::En),
            ("70 fahrenheit in celsius", Lang::En),
            // Others 5
            ("temporizador 5 minutos", Lang::Es),
            ("quel temps fait-il", Lang::Fr),
            ("wie spät ist es", Lang::De),
            ("打开 YouTube", Lang::Zh),
            ("타이머 5 분", Lang::Ko),
        ];
        for (utt, lang) in cases {
            assert!(
                !is_chitchat(utt, *lang),
                "expected Full for {:?} ({:?})",
                utt,
                lang
            );
        }
    }

    #[test]
    fn jp_long_chitchat_falls_to_full() {
        // Pure chitchat content, but length cap kicks in → Full.
        let long = "ありがとう、本当に助かったよ。これからもずっとよろしくお願いします。";
        assert!(!is_chitchat(long, Lang::Ja));
    }

    #[test]
    fn en_case_insensitive() {
        assert!(is_chitchat("THANKS!", Lang::En));
        assert!(!is_chitchat("Set a Timer", Lang::En));
    }
}
