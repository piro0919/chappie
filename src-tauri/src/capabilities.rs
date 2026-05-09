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
        Lang::Pt => capabilities_pt(),
        Lang::Ko => capabilities_ko(),
        Lang::It => capabilities_it(),
    }
}

fn capabilities_pt() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Conversa", &["Bate-papo, conselhos, perguntas (lembra do recente)"]),
        (
            "Tempo",
            &[
                "Que horas são? / Que dia é hoje?",
                "Põe um timer de 3 minutos (vários ao mesmo tempo OK)",
                "Me acorda amanhã às 7, lembra de tomar o remédio às 20h (sobrevivem ao reinício)",
            ],
        ),
        (
            "Agenda",
            &[
                "O que tenho hoje?",
                "Minha agenda de amanhã",
                "Qual é o próximo?",
            ],
        ),
        ("Clima", &["Clima aqui, vai chover amanhã?, clima em São Paulo"]),
        (
            "Web",
            &[
                "Abre o YouTube, abre o site da Apple",
                "Pesquisa ___ no Google (no navegador padrão)",
            ],
        ),
        (
            "Apps e pastas",
            &[
                "Abre o Slack, abre o Spotify, abre o Notas",
                "Abre Downloads, abre Aplicativos, abre o Lixo",
            ],
        ),
        ("Volume", &["Volume 30, abaixa um pouco, mudo"]),
        (
            "Música",
            &[
                "Próxima, pausa (controla Spotify ou Apple Music aberto)",
                "O que está tocando? (lê título e artista)",
            ],
        ),
        (
            "Área de transferência",
            &["Lê a área de transferência", "Escreve ___ e copia"],
        ),
        (
            "Capturas de tela",
            &[
                "Tira um screenshot (seleção → área de transferência)",
                "Captura a tela toda e salva na Mesa",
            ],
        ),
        (
            "Notas",
            &["Anota isso: ___", "Acha as notas sobre ___, lê as notas recentes"],
        ),
        (
            "Memória de longo prazo",
            &[
                "Lembra de você (nome, família, preferências, profissão)",
                "\"Lembra que ___\", \"O que você sabe sobre mim?\", \"Esquece isso\"",
            ],
        ),
        (
            "Status do Mac",
            &["Quanta bateria?, quanto falta para carregar?"],
        ),
        (
            "Bloquear e dormir",
            &[
                "Bloqueia a tela, desliga a tela, dorme",
                "Não deixa dormir, mantém acordado por 30 minutos, libera",
            ],
        ),
        (
            "Encerrar",
            &["Diz 'até mais' ou 'obrigado' para voltar ao modo de espera"],
        ),
    ];
    render(categories)
}

fn capabilities_ko() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("수다", &["잡담, 상담, 질문 답변 (최근 흐름 기억)"]),
        (
            "시간",
            &[
                "지금 몇 시? / 오늘 날짜",
                "3분 타이머, 5분 타이머 (동시에 여러 개 OK)",
                "내일 7시에 깨워줘, 8시에 약 먹으라고 알려줘 (재시작 후에도 유지)",
            ],
        ),
        (
            "캘린더",
            &[
                "오늘 일정은?",
                "내일 스케줄 알려줘",
                "다음 일정은?",
            ],
        ),
        ("날씨", &["여기 날씨, 내일 우산 필요해?, 서울 날씨"]),
        (
            "웹",
            &[
                "유튜브 열어, 애플 사이트 열어",
                "구글에서 ___ 검색해 (기본 브라우저로)",
            ],
        ),
        (
            "앱과 폴더",
            &[
                "Slack 열어, Spotify 열어, 메모 열어",
                "다운로드 폴더 열어, 응용 프로그램 열어, 휴지통 열어",
            ],
        ),
        ("볼륨", &["볼륨 30으로, 조금 낮춰, 음소거"]),
        (
            "음악",
            &[
                "다음 곡, 정지 (실행 중인 Spotify / Apple Music 제어)",
                "지금 무슨 곡? (곡명과 아티스트 읽어줌)",
            ],
        ),
        (
            "클립보드",
            &["클립보드 읽어줘", "___ 적어서 클립보드에 복사해 줘"],
        ),
        (
            "스크린샷",
            &[
                "스크린샷 찍어 (영역 선택 → 클립보드)",
                "전체 화면 캡처해서 데스크탑에 저장해",
            ],
        ),
        (
            "메모",
            &["이거 메모해 줘: ___", "___ 관련 메모 찾아줘, 최근 메모 읽어줘"],
        ),
        (
            "장기 기억",
            &[
                "당신을 기억해요 (이름, 가족, 취향, 직업)",
                "\"___ 기억해 줘\", \"나에 대해 뭐 알고 있어?\", \"그거 잊어\"",
            ],
        ),
        ("Mac 상태", &["배터리 몇 %?, 충전 얼마나 남았어?"]),
        (
            "잠금과 절전",
            &[
                "화면 잠금, 디스플레이 끄기, 절전 모드",
                "절전 안 되게 해, 30분 깨어 있게 해, 해제",
            ],
        ),
        (
            "종료",
            &["'또 봐' 또는 '고마워'라고 하면 대기 모드로 돌아감"],
        ),
    ];
    render(categories)
}

fn capabilities_it() -> String {
    let categories: &[(&str, &[&str])] = &[
        ("Chiacchiere", &["Conversazione, consigli, domande (ricorda il recente)"]),
        (
            "Tempo",
            &[
                "Che ore sono? / Che data è oggi?",
                "Fai un timer di 3 minuti (più timer insieme va bene)",
                "Svegliami domani alle 7, ricordami di prendere la medicina alle 20 (sopravvive al riavvio)",
            ],
        ),
        (
            "Calendario",
            &[
                "Cos'ho in agenda oggi?",
                "L'agenda di domani",
                "Qual è il prossimo?",
            ],
        ),
        ("Meteo", &["Meteo qui, devo prendere l'ombrello domani?, meteo a Roma"]),
        (
            "Web",
            &[
                "Apri YouTube, apri il sito di Apple",
                "Cerca ___ su Google (nel browser predefinito)",
            ],
        ),
        (
            "App e cartelle",
            &[
                "Apri Slack, apri Spotify, apri Note",
                "Apri Download, apri Applicazioni, apri il Cestino",
            ],
        ),
        ("Volume", &["Metti il volume a 30, abbassa un po', muto"]),
        (
            "Musica",
            &[
                "Prossimo brano, pausa (controlla Spotify o Apple Music aperto)",
                "Cosa sta suonando? (legge titolo e artista)",
            ],
        ),
        (
            "Appunti",
            &["Leggi gli appunti", "Scrivi ___ e copialo"],
        ),
        (
            "Schermate",
            &[
                "Fai uno screenshot (selezione → appunti)",
                "Cattura tutto lo schermo e salva sulla Scrivania",
            ],
        ),
        (
            "Note",
            &["Annota questo: ___", "Trova le note su ___, leggi le note recenti"],
        ),
        (
            "Memoria a lungo termine",
            &[
                "Si ricorda di te (nome, famiglia, preferenze, lavoro)",
                "\"Ricorda che ___\", \"Cosa sai di me?\", \"Dimentica quello\"",
            ],
        ),
        (
            "Stato Mac",
            &["Quanta batteria?, quanto manca alla carica completa?"],
        ),
        (
            "Blocco e stop",
            &[
                "Blocca lo schermo, spegni il display, vai in stop",
                "Non andare in stop, resta sveglio per 30 minuti, rilascia",
            ],
        ),
        (
            "Fine",
            &["Di' 'a dopo' o 'grazie' per tornare in standby"],
        ),
    ];
    render(categories)
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
            "Calendario",
            &[
                "¿Qué tengo hoy?",
                "Agenda de mañana",
                "¿Qué sigue?",
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
            "Memoria a largo plazo",
            &[
                "Te recuerda (nombre, familia, preferencias, profesión)",
                "\"Recuerda que ___\", \"¿Qué sabes de mí?\", \"Olvida eso\"",
            ],
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
            "Agenda",
            &[
                "Quel est mon planning aujourd'hui ?",
                "Mon agenda de demain",
                "Et après ?",
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
            "Mémoire à long terme",
            &[
                "Se souvient de toi (nom, famille, préférences, métier)",
                "\"Souviens-toi que ___\", \"Que sais-tu de moi ?\", \"Oublie ça\"",
            ],
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
            "Kalender",
            &[
                "Was steht heute an?",
                "Mein Plan für morgen",
                "Was kommt als Nächstes?",
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
            "Langzeitgedächtnis",
            &[
                "Merkt sich Dinge über dich (Name, Familie, Vorlieben, Beruf)",
                "\"Merk dir ___\", \"Was weißt du über mich?\", \"Vergiss das\"",
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
        (
            "日历",
            &[
                "我今天有什么安排？",
                "明天的日程",
                "下一个安排是什么？",
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
        (
            "长期记忆",
            &[
                "记住你的事(名字、家人、喜好、职业)",
                "\"记住 ___\", \"你了解我什么?\", \"忘掉那个\"",
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
        (
            "カレンダー",
            &[
                "今日の予定は？",
                "明日のスケジュール教えて",
                "次の予定は？",
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
            "長期記憶",
            &[
                "私のことを覚えてくれる（名前、家族、好み、職業など）",
                "「○○って覚えといて」「私について何知ってる？」「あの記憶忘れて」",
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
            "Calendar",
            &[
                "What's on my calendar today?",
                "Tomorrow's schedule?",
                "What's next?",
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
            "Long-term memory",
            &[
                "Remembers things about you (name, family, preferences, role)",
                "\"Remember that ___\", \"What do you know about me?\", \"Forget that\"",
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
