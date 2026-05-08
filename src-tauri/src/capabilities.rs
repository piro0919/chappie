// Single source of truth for "what can Chappie do?". Exposed via a tool so
// the system prompt stays slim — the LLM only pulls this list when the user
// actually asks. Keep entries punchy, one or two examples each, in the
// user's voice (not API parlance). When you add a new tool, also add a
// matching entry here so users can discover it just by asking.

use crate::i18n::Lang;

pub fn capabilities_text() -> String {
    match crate::i18n::current() {
        Lang::Ja => capabilities_ja(),
        Lang::En => capabilities_en(),
        Lang::Es => capabilities_es(),
        Lang::Fr => capabilities_fr(),
        Lang::De => capabilities_de(),
        Lang::Zh => capabilities_zh(),
    }
}

fn capabilities_es() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Conversación", &["Charlar, consejos, preguntas (recuerda lo reciente)"]),
        (
            "Tiempo",
            &[
                "¿Qué hora es? / ¿Qué fecha es hoy?",
                "Pon un temporizador de 3 minutos (varios a la vez está bien)",
                "Despiértame mañana a las 7, recuérdame tomar la pastilla a las 8 (sobreviven al reinicio)",
            ],
        ),
        (
            "Clima",
            &["Tiempo aquí, ¿lloverá mañana?, tiempo en Madrid"],
        ),
        (
            "Web",
            &[
                "Abre YouTube, abre la web de Apple",
                "Busca ___ en Google (en el navegador por defecto)",
            ],
        ),
        (
            "Apps y carpetas",
            &[
                "Abre Slack, abre Spotify, abre Notas",
                "Abre Descargas, abre Aplicaciones, abre la Papelera",
            ],
        ),
        ("Volumen", &["Pon el volumen a 30, baja un poco, silenciar"]),
        (
            "Música",
            &[
                "Siguiente canción, pausa (controla Spotify o Apple Music abierto)",
                "¿Qué está sonando? (lee el título y artista)",
            ],
        ),
        (
            "Portapapeles",
            &["Léeme el portapapeles", "Escribe ___ y cópialo"],
        ),
        (
            "Capturas de pantalla",
            &[
                "Haz una captura (selección → portapapeles)",
                "Captura la pantalla y guárdala en el Escritorio",
            ],
        ),
        (
            "Notas",
            &["Apunta esto: ___", "Busca notas sobre ___, lee mis notas recientes"],
        ),
        (
            "Estado del Mac",
            &["¿Cuánta batería?, ¿cuánto falta para cargar?"],
        ),
        (
            "Bloqueo y suspensión",
            &[
                "Bloquea la pantalla, apaga la pantalla, suspender",
                "Que no se duerma, mantenlo despierto 30 min, libera eso",
            ],
        ),
        (
            "Salir",
            &["Di 'hasta luego' o 'gracias' para volver al modo de espera"],
        ),
    ];
    render(categories)
}

fn capabilities_fr() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Conversation", &["Discuter, conseils, questions (se souvient du récent)"]),
        (
            "Temps",
            &[
                "Quelle heure est-il ? / Quelle est la date ?",
                "Lance un minuteur de 3 minutes (plusieurs en même temps OK)",
                "Réveille-moi demain à 7 h, rappelle-moi de prendre mon médicament à 20 h (les rappels survivent au redémarrage)",
            ],
        ),
        (
            "Météo",
            &["Météo ici, faut-il un parapluie demain ?, météo à Paris"],
        ),
        (
            "Web",
            &[
                "Ouvre YouTube, ouvre le site d'Apple",
                "Cherche ___ sur Google (dans le navigateur par défaut)",
            ],
        ),
        (
            "Apps et dossiers",
            &[
                "Ouvre Slack, ouvre Spotify, ouvre Notes",
                "Ouvre Téléchargements, ouvre Applications, ouvre la Corbeille",
            ],
        ),
        ("Volume", &["Mets le volume à 30, baisse un peu, silence"]),
        (
            "Musique",
            &[
                "Piste suivante, pause (contrôle Spotify ou Apple Music ouvert)",
                "Qu'est-ce qui passe ? (lit le titre et l'artiste)",
            ],
        ),
        (
            "Presse-papiers",
            &["Lis le presse-papiers", "Écris ___ et copie-le"],
        ),
        (
            "Captures d'écran",
            &[
                "Fais une capture (sélection → presse-papiers)",
                "Capture tout l'écran et enregistre sur le Bureau",
            ],
        ),
        (
            "Notes",
            &["Note ceci : ___", "Cherche les notes sur ___, lis mes notes récentes"],
        ),
        (
            "État du Mac",
            &["Combien de batterie ?, combien avant la charge complète ?"],
        ),
        (
            "Verrouillage et veille",
            &[
                "Verrouille l'écran, éteins l'écran, mets en veille",
                "Empêche la veille, garde éveillé 30 minutes, annule",
            ],
        ),
        (
            "Fin",
            &["Dis « à plus tard » ou « merci » pour revenir en veille"],
        ),
    ];
    render(categories)
}

fn capabilities_de() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Plaudern", &["Smalltalk, Rat, Fragen (erinnert sich an Vorheriges)"]),
        (
            "Zeit",
            &[
                "Wie spät ist es? / Welches Datum ist heute?",
                "Stell einen 3-Minuten-Timer (mehrere parallel OK)",
                "Weck mich morgen um 7, erinnere mich um 20 Uhr an die Tabletten (überlebt Neustarts)",
            ],
        ),
        (
            "Wetter",
            &["Wetter hier, brauche ich morgen einen Regenschirm?, Wetter in Berlin"],
        ),
        (
            "Web",
            &[
                "Öffne YouTube, öffne Apples Webseite",
                "Google nach ___ (im Standardbrowser)",
            ],
        ),
        (
            "Apps & Ordner",
            &[
                "Öffne Slack, öffne Spotify, öffne Notizen",
                "Öffne Downloads, öffne Programme, öffne den Papierkorb",
            ],
        ),
        ("Lautstärke", &["Setz die Lautstärke auf 30, etwas leiser, stumm"]),
        (
            "Musik",
            &[
                "Nächster Song, Pause (steuert offenes Spotify oder Apple Music)",
                "Was läuft gerade? (liest Titel und Künstler vor)",
            ],
        ),
        (
            "Zwischenablage",
            &["Lies die Zwischenablage", "Schreib ___ und kopier's"],
        ),
        (
            "Screenshots",
            &[
                "Mach einen Screenshot (Auswahl → Zwischenablage)",
                "Ganzes Display aufnehmen, auf den Schreibtisch speichern",
            ],
        ),
        (
            "Notizen",
            &[
                "Notiere das: ___",
                "Suche Notizen zu ___, lies meine neuesten Notizen",
            ],
        ),
        (
            "Mac-Status",
            &["Wie viel Akku?, wie lange noch bis voll?"],
        ),
        (
            "Sperren & Schlaf",
            &[
                "Bildschirm sperren, Display ausschalten, schlafen legen",
                "Nicht einschlafen, 30 Minuten wach halten, aufheben",
            ],
        ),
        (
            "Ende",
            &["Sag 'bis später' oder 'danke', um in den Standby zurückzukehren"],
        ),
    ];
    render(categories)
}

fn capabilities_zh() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("聊天", &["闲聊、咨询、回答问题(记得最近的话题)"]),
        (
            "时间",
            &[
                "现在几点? / 今天日期?",
                "定一个 3 分钟计时器(可同时多个)",
                "明天 7 点叫我,晚上 8 点提醒我吃药(重启后保留)",
            ],
        ),
        ("天气", &["这里的天气, 明天要带伞吗?, 北京的天气"]),
        (
            "网页",
            &[
                "打开 YouTube, 打开 Apple 官网",
                "Google 搜索 ___(在默认浏览器中)",
            ],
        ),
        (
            "应用和文件夹",
            &[
                "打开 Slack, 启动 Spotify, 打开备忘录",
                "打开下载, 打开应用程序, 打开废纸篓",
            ],
        ),
        ("音量", &["音量调到 30, 再小一点, 静音"]),
        (
            "音乐",
            &[
                "下一首, 暂停(控制已打开的 Spotify 或 Apple Music)",
                "现在播放什么?(读出歌名和艺术家)",
            ],
        ),
        (
            "剪贴板",
            &["读一下剪贴板", "把 ___ 复制到剪贴板"],
        ),
        (
            "截图",
            &[
                "截图(框选 → 剪贴板)",
                "全屏截图并保存到桌面",
            ],
        ),
        (
            "备忘",
            &[
                "记一下: ___",
                "找一下关于 ___ 的备忘, 读最近的备忘",
            ],
        ),
        ("Mac 状态", &["电量多少?, 还要多久充满?"]),
        (
            "锁定和睡眠",
            &[
                "锁屏, 关闭显示器, 睡眠",
                "别睡, 保持 30 分钟唤醒, 解除",
            ],
        ),
        ("结束", &["说『再见』或『谢谢』回到待机模式"]),
    ];
    render(categories)
}

fn capabilities_ja() -> String {
    let categories: &[(&str, &[&str])] = &[
        (
            "おしゃべり",
            &["雑談、相談、質問への回答（直前の話題は覚えてる）"],
        ),
        (
            "時間",
            &[
                "今何時？／今日の日付",
                "3分タイマー、5分タイマー（複数同時 OK）",
                "明日7時に起こして、20時に薬って言って（リマインダーは再起動後も保持）",
            ],
        ),
        ("天気", &["現在地の天気、明日の傘いる？、東京の天気"]),
        (
            "ウェブ",
            &[
                "YouTube 開いて、Apple のサイト開いて",
                "○○ググって（既定ブラウザで Google 検索）",
            ],
        ),
        (
            "アプリ・フォルダ",
            &[
                "Slack 開いて、Spotify 起動して、メモ開いて",
                "ダウンロードフォルダ開いて、アプリケーションフォルダ開いて、ゴミ箱開いて",
            ],
        ),
        ("音量", &["音量30にして、もう少し下げて、ミュート"]),
        (
            "音楽",
            &[
                "次の曲、止めて（起動中の Spotify / Apple Music を操作）",
                "いま何の曲？（曲名・アーティスト読み上げ）",
            ],
        ),
        (
            "クリップボード",
            &["クリップボード読んで", "○○書いてコピーしといて"],
        ),
        (
            "スクリーンショット",
            &[
                "スクショ撮って（範囲選択 → クリップボード）",
                "全画面キャプチャして、デスクトップに保存して",
            ],
        ),
        (
            "メモ",
            &[
                "これメモして: ○○",
                "○○のメモ探して、最近のメモ読んで",
            ],
        ),
        (
            "Mac の状態",
            &["バッテリー何％？、充電あとどれくらい？"],
        ),
        (
            "ロック・スリープ",
            &[
                "画面ロック、ディスプレイ消して、スリープして",
                "スリープしないでおいて、30分起きてて、解除して",
            ],
        ),
        ("終了", &["「またね」「ありがとう」で待機モードに戻る"]),
    ];
    render(categories)
}

fn capabilities_en() -> String {
    let categories: &[(&str, &[&str])] = &[
        (
            "Chat",
            &["Casual chat, advice, Q&A (remembers the recent thread)"],
        ),
        (
            "Time",
            &[
                "What time is it? / What's today's date?",
                "Set a 3-minute timer, set a 5-minute timer (multiple at once is fine)",
                "Wake me at 7 tomorrow, remind me to take meds at 8 PM (reminders survive restart)",
            ],
        ),
        (
            "Weather",
            &["Weather here, do I need an umbrella tomorrow?, weather in Tokyo"],
        ),
        (
            "Web",
            &[
                "Open YouTube, open Apple's site",
                "Google ___ (searches in your default browser)",
            ],
        ),
        (
            "Apps & folders",
            &[
                "Open Slack, launch Spotify, open Notes",
                "Open Downloads, open Applications, open Trash",
            ],
        ),
        (
            "Volume",
            &["Set volume to 30, turn it down a bit, mute"],
        ),
        (
            "Music",
            &[
                "Next track, pause (controls a running Spotify or Apple Music)",
                "What's playing? (reads the track + artist)",
            ],
        ),
        (
            "Clipboard",
            &["Read the clipboard", "Write ___ and copy it for me"],
        ),
        (
            "Screenshots",
            &[
                "Take a screenshot (selection → clipboard)",
                "Capture the whole screen and save it to the desktop",
            ],
        ),
        (
            "Notes",
            &[
                "Make a note: ___",
                "Find notes about ___, read my recent notes",
            ],
        ),
        (
            "Mac status",
            &["What's the battery at? How long until it's charged?"],
        ),
        (
            "Lock & sleep",
            &[
                "Lock the screen, turn the display off, sleep",
                "Don't let it sleep, stay awake for 30 minutes, release that",
            ],
        ),
        (
            "End",
            &["Say 'see you' or 'thanks' to go back to standby"],
        ),
    ];
    render(categories)
}

fn render(categories: &[(&str, &[&str])]) -> String {
    let mut out = String::new();
    for (category, examples) in categories {
        out.push_str(&format!("【{category}】\n"));
        for ex in *examples {
            out.push_str(&format!("- {ex}\n"));
        }
    }
    out
}
