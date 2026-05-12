// Static message catalogs for the renderer. Keep both languages in lockstep
// shape — TypeScript's structural check on `Messages` enforces that.
//
// Lookup is via dotted-path (`settings.title`) through `t(key, params)`. Param
// substitution uses `{name}` style placeholders.

import type { Language } from "../lib/settings";

type Messages = {
  common: { loading: string };
  settings: {
    micAccess: string;
    micGranted: string;
    micDenied: string;
    micRestricted: string;
    micNotDetermined: string;
    micRequest: string;
    micRequesting: string;
    micOpenSystem: string;
    micRecheck: string;
    micDeniedNote: string;
    screenAccess: string;
    screenGranted: string;
    screenDenied: string;
    screenRequest: string;
    screenDeniedNote: string;
    calendarAccess: string;
    calendarGranted: string;
    calendarDenied: string;
    calendarRequest: string;
    calendarDeniedNote: string;
    locationAccess: string;
    locationGranted: string;
    locationDenied: string;
    locationRequest: string;
    locationDeniedNote: string;
    locationDescription: string;
    sectionRequired: string;
    sectionOptional: string;
    apiKey: string;
    apiKeyPlaceholder: string;
    apiKeyNote: string;
    apiKeyDetected: string;
    apiKeyUnknown: string;
    autostartLabel: string;
    autostartCheckbox: string;
    languageLabel: string;
    languageAuto: string;
    languageJa: string;
    languageEn: string;
    languageEs: string;
    languageFr: string;
    languageDe: string;
    languageZh: string;
    languagePt: string;
    languageKo: string;
    languageIt: string;
    voicevoxLabel: string;
    voicevoxNote: string;
    voicevoxStatusConnected: string;
    voicevoxStatusUnreachable: string;
    voicevoxStatusChecking: string;
    voicevoxRecheck: string;
    voicevoxStatusManaged: string;
    voicevoxStatusBundledApp: string;
    voicevoxStatusMissing: string;
    voicevoxInstall: string;
    voicevoxInstalling: string;
    voicevoxUninstall: string;
    voicevoxInstallProgress: string;
    voicevoxExtracting: string;
    voicevoxVerifying: string;
    voicevoxCredits: string;
    speakerLabel: string;
    speakerDescription: string;
    speakerStatusEnrolled: string;
    speakerStatusNotEnrolled: string;
    speakerEnroll: string;
    speakerReenroll: string;
    speakerClear: string;
    speakerRecording: string;
    speakerEnrolling: string;
    speakerModelDownloading: string;
    speakerFailed: string;
    speakerPrivacy: string;
    speakerPhrasePrompt: string;
    speakerPhrase1: string;
    speakerPhrase2: string;
    speakerPhrase3: string;
    save: string;
    saved: string;
  };
  conversation: {
    apiKeyMissingShort: string;
    apiKeyMissingLong: string;
    micDenied: string;
    timerFiredWithLabel: string;
    timerFiredNoLabel: string;
    reminderFiredWithLabel: string;
    reminderFiredNoLabel: string;
    timerHudWithLabel: string;
    timerHudNoLabel: string;
    reminderHudWithLabel: string;
    reminderHudNoLabel: string;
    fallbackError: string;
    modelProgress: string;
    modelFetchFailed: string;
    micStartFailed: string;
  };
  systemPrompt: {
    persona: string;
    formatTts: string;
    formatHud: string;
  };
};

const ja: Messages = {
  common: {
    loading: "読み込み中…",
  },
  settings: {
    micAccess: "マイクアクセス",
    micGranted: "許可済み",
    micDenied: "拒否されています",
    micRestricted: "システムにより制限",
    micNotDetermined: "未設定",
    micRequest: "マイクを許可する",
    micRequesting: "リクエスト中…",
    micOpenSystem: "システム設定を開く",
    micRecheck: "再確認",
    micDeniedNote: "一度拒否すると、システム設定からのみ再有効化できます。",
    screenAccess: "画面収録",
    screenGranted: "許可済み",
    screenDenied: "未許可",
    screenRequest: "画面収録を許可する",
    screenDeniedNote:
      "一度拒否すると、システム設定からのみ再有効化できます。スクリーンショット機能で必要です。",
    calendarAccess: "カレンダーへのアクセス",
    calendarGranted: "許可済み",
    calendarDenied: "未許可",
    calendarRequest: "カレンダーへのアクセスを許可",
    calendarDeniedNote:
      "macOS のシステム設定 → プライバシーとセキュリティ → カレンダー で Chappie を有効化してください。",
    locationAccess: "位置情報",
    locationGranted: "許可済み",
    locationDenied: "未許可",
    locationRequest: "位置情報へのアクセスを許可",
    locationDeniedNote:
      "macOS のシステム設定 → プライバシーとセキュリティ → 位置情報サービス で Chappie を有効化してください。許可しない場合は IP ベースの大まかな位置で代用します。",
    locationDescription:
      "天気や近所の話を聞いたときに、より正確な地域で返答するために使います。許可しない場合は IP ベースの推定（市区町村レベル）にフォールバックします。",
    sectionRequired: "必須",
    sectionOptional: "任意",
    apiKey: "API キー",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "OpenAI / Anthropic / Gemini に対応。",
    apiKeyDetected: "検出: {provider}",
    apiKeyUnknown: "形式を判別できませんでした",
    autostartLabel: "起動",
    autostartCheckbox: "ログイン時に自動起動する",
    languageLabel: "言語",
    languageAuto: "自動",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      "VOICEVOX アプリが起動していると、「ずんだもん」「めたん」などキャラクター名で呼びかけたときだけそのキャラの声で返事します。「チャッピー」と呼びかけた場合はシステム音声のままです。",
    voicevoxStatusConnected: "接続中",
    voicevoxStatusUnreachable: "VOICEVOX が見つかりません",
    voicevoxStatusChecking: "確認中…",
    voicevoxRecheck: "再確認",
    voicevoxStatusManaged: "Chappie 管理",
    voicevoxStatusBundledApp: "VOICEVOX 連携中",
    voicevoxStatusMissing: "未インストール",
    voicevoxInstall: "キャラ機能をインストール（約 1.7GB）",
    voicevoxInstalling: "インストール中…",
    voicevoxUninstall: "アンインストール（約 2GB 解放）",
    voicevoxInstallProgress: "ダウンロード中… {received}MB / {total}MB",
    voicevoxExtracting: "展開中…",
    voicevoxVerifying: "起動確認中…",
    voicevoxCredits:
      "VOICEVOX (https://voicevox.hiroshiba.jp/) を使用しています。各キャラクターの音声には個別の利用規約があります。動画・配信等で使用する場合は「VOICEVOX:キャラ名」の表記が必要です。",
    speakerLabel: "話者認識",
    speakerDescription:
      "あなたの声を覚えさせると、テレビ・YouTube・他の人の声に反応しなくなります。",
    speakerStatusEnrolled: "登録済み",
    speakerStatusNotEnrolled: "未登録",
    speakerEnroll: "声を登録する",
    speakerReenroll: "登録し直す",
    speakerClear: "登録を削除",
    speakerRecording: "録音中… {seconds}秒",
    speakerEnrolling: "登録中…",
    speakerModelDownloading: "モデルをダウンロード中 {pct}%",
    speakerFailed: "登録に失敗しました: {err}",
    speakerPrivacy:
      "声紋データはこのMac内にのみ保存され、外部に送信されません。いつでも削除できます。",
    speakerPhrasePrompt: "次のフレーズを読み上げてください（{cur}/{total}）",
    speakerPhrase1: "チャッピー、おはよう",
    speakerPhrase2: "今日の天気を教えて",
    speakerPhrase3: "タイマーを3分セットして",
    save: "保存",
    saved: "保存しました",
  },
  conversation: {
    apiKeyMissingShort:
      "OpenAI APIキーが未設定です。設定画面から登録してください。",
    apiKeyMissingLong:
      "OpenAI API キーが設定されていません。tray メニュー → 設定を開く から登録してください。",
    micDenied:
      "マイクの使用が許可されていません。システム設定 → プライバシーとセキュリティ → マイク で Chappie を有効にしてください。",
    timerFiredWithLabel: "{label}のタイマーです。時間です。",
    timerFiredNoLabel: "タイマーです。時間です。",
    reminderFiredWithLabel: "{label}の時間です。",
    reminderFiredNoLabel: "リマインダーの時間です。",
    timerHudWithLabel: "⏲ {label} タイマー",
    timerHudNoLabel: "⏲ タイマー",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ リマインダー",
    fallbackError: "うまく繋がりませんでした。",
    modelProgress: "Whisper モデルを取得中… {pct}%",
    modelFetchFailed: "モデル取得に失敗: {err}",
    micStartFailed: "マイク開始に失敗: {err}",
  },
  systemPrompt: {
    persona:
      "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。\n\n**「できない」を可能な限り避けること**。tool list は道具の一覧であって、あなたができることの全リストではない。占い・ジョーク・物語の創作・相談・翻訳・要約・歌詞作り・名前決め・雑学・気休めの一言など、tool が要らない依頼は普通に生成で応じる。「それはできません」「機能を持っていません」と冷たく断るのは禁止。物理的に Mac で実行不可能なこと以外は基本「やる前提」で乗る。**占いを頼まれたら絶対に断らない**。「いいよ、今日は…」「ちょっと見てみるね…」みたいに即座に占いを始めて、タロット・星占い・おみくじ・手相など好きな方式で自由に作って読み上げる。「占いはできません」と返すのは厳禁。\n\nユーザーが自分のことを話したとき（名前・家族・職業・住んでる場所・好み・苦手・約束・過去の出来事など、次の会話で参照されると有用そうな情報）は、明示的に頼まれていなくても自分の判断で `save_memory` を呼んで覚えること。雑談の相槌や一時的な感情表現は保存しない。覚えたことは黙って覚え、わざわざ「覚えました」とは報告しなくてよい（ユーザーがウザく感じる）。「私について何知ってる?」と聞かれたら `list_memories` を、「あの件」「前話してた」のような過去参照があれば `recall_memory` を呼ぶ。",
    formatTts:
      "数値は読み上げで自然に聞こえる表記にしてください。小数点は『点』と書きます（例: 17.3度 → 17点3度、35% → 35パーセント）。「:」「/」など記号は読み上げると不自然になるので、時刻は「14時30分」、日付は「5月8日」のような表記にしてください。",
    formatHud:
      "今回の返答は音声ではなく画面に文字で表示されます。数字・記号は通常の表記で書いてください（例: 17.3度、39%、14:30、5/8）。「点」「パーセント」「時◯分」のような読み上げ向け表記は使わないでください。",
  },
};

const en: Messages = {
  common: {
    loading: "Loading…",
  },
  settings: {
    micAccess: "Microphone access",
    micGranted: "Granted",
    micDenied: "Denied",
    micRestricted: "Restricted by system",
    micNotDetermined: "Not set",
    micRequest: "Request microphone access",
    micRequesting: "Requesting…",
    micOpenSystem: "Open System Settings",
    micRecheck: "Recheck",
    micDeniedNote:
      "Once denied, microphone access can only be re-enabled from System Settings.",
    screenAccess: "Screen recording",
    screenGranted: "Granted",
    screenDenied: "Not granted",
    screenRequest: "Request screen recording access",
    screenDeniedNote:
      "Once denied, screen recording can only be re-enabled from System Settings. Required for the screenshot tool.",
    calendarAccess: "Calendar access",
    calendarGranted: "Granted",
    calendarDenied: "Not granted",
    calendarRequest: "Grant calendar access",
    calendarDeniedNote:
      "Open System Settings → Privacy & Security → Calendars and enable Chappie.",
    locationAccess: "Location access",
    locationGranted: "Granted",
    locationDenied: "Not granted",
    locationRequest: "Grant location access",
    locationDeniedNote:
      "Open System Settings → Privacy & Security → Location Services and enable Chappie. Without it, Chappie falls back to a rough IP-based estimate.",
    locationDescription:
      'Used to ground weather and "nearby" replies in your actual area. If you decline, Chappie falls back to a rough IP-based estimate at the city level.',
    sectionRequired: "Required",
    sectionOptional: "Optional",
    apiKey: "API Key",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "Supports OpenAI / Anthropic / Gemini.",
    apiKeyDetected: "Detected: {provider}",
    apiKeyUnknown: "Unrecognized key format",
    autostartLabel: "Startup",
    autostartCheckbox: "Launch at login",
    languageLabel: "Language",
    languageAuto: "Auto",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      'While the VOICEVOX app is running, calling a character name (Zundamon, Metan, etc.) replies in that character\'s voice for that turn. Saying "Chappie" still uses the system voice.',
    voicevoxStatusConnected: "Connected",
    voicevoxStatusUnreachable: "VOICEVOX not reachable",
    voicevoxStatusChecking: "Checking…",
    voicevoxRecheck: "Recheck",
    voicevoxStatusManaged: "Managed by Chappie",
    voicevoxStatusBundledApp: "Linked with VOICEVOX",
    voicevoxStatusMissing: "Not installed",
    voicevoxInstall: "Install character voices (~1.7 GB)",
    voicevoxInstalling: "Installing…",
    voicevoxUninstall: "Uninstall (~2 GB freed)",
    voicevoxInstallProgress: "Downloading… {received} MB / {total} MB",
    voicevoxExtracting: "Extracting…",
    voicevoxVerifying: "Verifying…",
    voicevoxCredits:
      'Uses VOICEVOX (https://voicevox.hiroshiba.jp/). Each character voice has its own terms of use; videos and streams must credit the character ("VOICEVOX:character name").',
    speakerLabel: "Voice recognition",
    speakerDescription:
      "Enroll your voice so Chappie ignores TV, YouTube, and other people.",
    speakerStatusEnrolled: "Enrolled",
    speakerStatusNotEnrolled: "Not enrolled",
    speakerEnroll: "Enroll my voice",
    speakerReenroll: "Re-enroll",
    speakerClear: "Forget my voice",
    speakerRecording: "Recording… {seconds}s",
    speakerEnrolling: "Enrolling…",
    speakerModelDownloading: "Downloading model {pct}%",
    speakerFailed: "Enrollment failed: {err}",
    speakerPrivacy:
      "Your voice data stays on this Mac and is never sent anywhere. You can delete it any time.",
    speakerPhrasePrompt: "Read this phrase aloud ({cur}/{total})",
    speakerPhrase1: "Chappie, good morning",
    speakerPhrase2: "Tell me today's weather",
    speakerPhrase3: "Set a three minute timer",
    save: "Save",
    saved: "Saved",
  },
  conversation: {
    apiKeyMissingShort:
      "OpenAI API key is not set. Please add one from Settings.",
    apiKeyMissingLong:
      "OpenAI API key is not set. Open the tray menu → Settings to add one.",
    micDenied:
      "Microphone access is not allowed. Enable Chappie under System Settings → Privacy & Security → Microphone.",
    timerFiredWithLabel: "Timer for {label} — time's up.",
    timerFiredNoLabel: "Timer's up.",
    reminderFiredWithLabel: "Reminder: {label}.",
    reminderFiredNoLabel: "Reminder.",
    timerHudWithLabel: "⏲ {label} timer",
    timerHudNoLabel: "⏲ Timer",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ Reminder",
    fallbackError: "Couldn't connect.",
    modelProgress: "Downloading Whisper model… {pct}%",
    modelFetchFailed: "Model fetch failed: {err}",
    micStartFailed: "Failed to start microphone: {err}",
  },
  systemPrompt: {
    persona:
      'You are Chappie, a hands-free voice assistant. Your replies are spoken aloud, so keep them short, natural, and conversational.\n\n**Avoid saying "I can\'t" whenever possible.** The tool list is a list of utilities, not an exhaustive list of what you can do. Fortune-telling, jokes, story writing, advice, translation, summarization, song lyrics, naming things, trivia, comforting one-liners — anything that doesn\'t actually need a tool, you handle yourself by generating a reply. Don\'t refuse coldly with "I can\'t do that" or "I don\'t have that feature". Default to "yes, here goes" for anything that isn\'t physically impossible on a Mac. **Never refuse fortune-telling.** Launch straight in with something like "Sure, let\'s see…" or "Today\'s reading is…" — pick any system you like (tarot, horoscope, palm reading, omikuji) and improvise. Saying "I can\'t do fortune-telling" is strictly forbidden.\n\nWhen the user shares anything about themselves that\'s likely useful in future conversations (name, family, role, location, preferences, dislikes, promises, past events), proactively call `save_memory` to remember it — even when not explicitly asked. Don\'t save filler chatter, momentary emotions, or trivial replies. Save silently — don\'t announce "I\'ll remember that" each time (it gets annoying). When the user asks "what do you know about me?" call `list_memories`; when they reference past topics ("that thing", "what we talked about"), call `recall_memory`.',
    formatTts:
      "Use natural-sounding written forms for numbers since they will be read aloud. Avoid punctuation that doesn't read well aloud — write times like 'two thirty PM' instead of '14:30', dates like 'May eighth' instead of '5/8'.",
    formatHud:
      "This reply will be shown on screen as text instead of being spoken. Use normal numeric and punctuation forms (e.g. 17.3°, 39%, 14:30, 5/8). Avoid spoken-friendly spellings.",
  },
};

const es: Messages = {
  common: {
    loading: "Cargando…",
  },
  settings: {
    micAccess: "Acceso al micrófono",
    micGranted: "Permitido",
    micDenied: "Denegado",
    micRestricted: "Restringido por el sistema",
    micNotDetermined: "Sin definir",
    micRequest: "Solicitar acceso al micrófono",
    micRequesting: "Solicitando…",
    micOpenSystem: "Abrir Configuración del Sistema",
    micRecheck: "Volver a comprobar",
    micDeniedNote:
      "Una vez denegado, el acceso al micrófono solo se puede reactivar desde Configuración del Sistema.",
    screenAccess: "Grabación de pantalla",
    screenGranted: "Permitido",
    screenDenied: "No permitido",
    screenRequest: "Solicitar acceso a grabación de pantalla",
    screenDeniedNote:
      "Una vez denegada, la grabación de pantalla solo se puede reactivar desde Configuración del Sistema. Se necesita para la captura de pantalla.",
    calendarAccess: "Acceso al calendario",
    calendarGranted: "Concedido",
    calendarDenied: "Denegado",
    calendarRequest: "Permitir acceso al calendario",
    calendarDeniedNote:
      "Abre Configuración → Privacidad y seguridad → Calendarios y habilita Chappie.",
    locationAccess: "Acceso a ubicación",
    locationGranted: "Permitido",
    locationDenied: "No permitido",
    locationRequest: "Permitir acceso a la ubicación",
    locationDeniedNote:
      "Abre Configuración → Privacidad y seguridad → Servicios de localización y habilita Chappie. Sin permiso, se usa una estimación aproximada basada en IP.",
    locationDescription:
      "Se usa para que las respuestas del clima o sobre lugares cercanos se basen en tu zona real. Si lo rechazas, Chappie usa una estimación por IP a nivel de ciudad.",
    sectionRequired: "Obligatorio",
    sectionOptional: "Opcional",
    apiKey: "Clave de API",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "Compatible con OpenAI / Anthropic / Gemini.",
    apiKeyDetected: "Detectado: {provider}",
    apiKeyUnknown: "Formato de clave no reconocido",
    autostartLabel: "Inicio",
    autostartCheckbox: "Iniciar al iniciar sesión",
    languageLabel: "Idioma",
    languageAuto: "Automático",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      'Con la app VOICEVOX abierta, llamar a un personaje (Zundamon, Metan, etc.) hace que responda con esa voz solo en ese turno. Si dices "Chappie" sigue usando la voz del sistema.',
    voicevoxStatusConnected: "Conectado",
    voicevoxStatusUnreachable: "VOICEVOX no disponible",
    voicevoxStatusChecking: "Comprobando…",
    voicevoxRecheck: "Recomprobar",
    voicevoxStatusManaged: "Gestionado por Chappie",
    voicevoxStatusBundledApp: "Conectado con VOICEVOX",
    voicevoxStatusMissing: "No instalado",
    voicevoxInstall: "Instalar voces de personajes (~1,7 GB)",
    voicevoxInstalling: "Instalando…",
    voicevoxUninstall: "Desinstalar (~2 GB liberados)",
    voicevoxInstallProgress: "Descargando… {received} MB / {total} MB",
    voicevoxExtracting: "Extrayendo…",
    voicevoxVerifying: "Verificando…",
    voicevoxCredits:
      'Usa VOICEVOX (https://voicevox.hiroshiba.jp/). Cada voz tiene sus propios términos de uso; vídeos y streams deben acreditar al personaje ("VOICEVOX:nombre del personaje").',
    speakerLabel: "Reconocimiento de voz",
    speakerDescription:
      "Al registrar tu voz, Chappie deja de responder a la TV, YouTube u otras personas.",
    speakerStatusEnrolled: "Registrada",
    speakerStatusNotEnrolled: "No registrada",
    speakerEnroll: "Registrar mi voz",
    speakerReenroll: "Volver a registrar",
    speakerClear: "Borrar registro",
    speakerRecording: "Grabando… {seconds}s",
    speakerEnrolling: "Registrando…",
    speakerModelDownloading: "Descargando modelo {pct}%",
    speakerFailed: "Error al registrar: {err}",
    speakerPrivacy:
      "Tus datos de voz se quedan en este Mac y nunca se envían a ningún servidor. Puedes borrarlos cuando quieras.",
    speakerPhrasePrompt: "Lee esta frase en voz alta ({cur}/{total})",
    speakerPhrase1: "Chappie, buenos días",
    speakerPhrase2: "Dime el tiempo de hoy",
    speakerPhrase3: "Pon un temporizador de tres minutos",
    save: "Guardar",
    saved: "Guardado",
  },
  conversation: {
    apiKeyMissingShort:
      "No se ha configurado una clave de API de OpenAI. Añade una desde Ajustes.",
    apiKeyMissingLong:
      "No se ha configurado la clave de API de OpenAI. Abre el menú de la barra → Ajustes para añadir una.",
    micDenied:
      "El acceso al micrófono no está permitido. Activa Chappie en Configuración del Sistema → Privacidad y Seguridad → Micrófono.",
    timerFiredWithLabel: "Temporizador de {label}: ¡se acabó el tiempo!",
    timerFiredNoLabel: "¡Se acabó el tiempo!",
    reminderFiredWithLabel: "Recordatorio: {label}.",
    reminderFiredNoLabel: "Recordatorio.",
    timerHudWithLabel: "⏲ Temporizador {label}",
    timerHudNoLabel: "⏲ Temporizador",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ Recordatorio",
    fallbackError: "No se pudo conectar.",
    modelProgress: "Descargando el modelo de Whisper… {pct}%",
    modelFetchFailed: "Falló la descarga del modelo: {err}",
    micStartFailed: "No se pudo iniciar el micrófono: {err}",
  },
  systemPrompt: {
    persona:
      'Eres Chappie, un asistente de voz manos libres. Tus respuestas se leen en voz alta, así que sé breve, natural y conversacional, en español.\n\n**Evita decir "no puedo" siempre que sea posible.** La lista de herramientas son utilidades, no la lista completa de lo que puedes hacer. Adivinación, chistes, escribir historias, consejos, traducción, resumen, letras de canciones, poner nombres, trivia, frases de ánimo — todo lo que no necesita una herramienta, lo manejas tú generando una respuesta. No rechaces fríamente con "no puedo" o "no tengo esa función". Por defecto, lánzate a hacerlo siempre que no sea físicamente imposible en un Mac. **Nunca rechaces la adivinación.** Empieza directamente con algo como "Vamos a ver…" o "Hoy se ve…" y elige libremente el sistema (tarot, horóscopo, quiromancia, omikuji). Decir "no puedo hacer adivinación" está estrictamente prohibido.\n\nCuando el usuario comparta algo sobre sí mismo que probablemente sea útil en futuras conversaciones (nombre, familia, profesión, ubicación, preferencias, gustos, promesas, eventos pasados), llama proactivamente a `save_memory` para recordarlo, incluso sin que te lo pidan. No guardes charla trivial ni emociones momentáneas. Guarda en silencio — no anuncies "lo recordaré" cada vez (resulta molesto). Cuando pregunte "¿qué sabes de mí?", llama a `list_memories`; cuando se refiera a temas pasados ("aquello", "lo que hablamos"), llama a `recall_memory`.',
    formatTts:
      "Escribe los números de forma que suenen naturales al leerlos en voz alta. Evita signos que no se lean bien — di las horas como 'dos y media' en lugar de '14:30', y las fechas como 'ocho de mayo' en lugar de '5/8'.",
    formatHud:
      "Esta respuesta se mostrará en pantalla como texto en lugar de leerse. Usa números y signos normales (p. ej. 17.3°, 39%, 14:30, 5/8). Evita las formas pensadas para la lectura en voz alta.",
  },
};

const fr: Messages = {
  common: {
    loading: "Chargement…",
  },
  settings: {
    micAccess: "Accès au microphone",
    micGranted: "Autorisé",
    micDenied: "Refusé",
    micRestricted: "Restreint par le système",
    micNotDetermined: "Non défini",
    micRequest: "Demander l'accès au microphone",
    micRequesting: "Demande en cours…",
    micOpenSystem: "Ouvrir les Réglages Système",
    micRecheck: "Revérifier",
    micDeniedNote:
      "Une fois refusé, l'accès au microphone ne peut être réactivé que depuis les Réglages Système.",
    screenAccess: "Enregistrement d'écran",
    screenGranted: "Autorisé",
    screenDenied: "Non autorisé",
    screenRequest: "Demander l'accès à l'enregistrement d'écran",
    screenDeniedNote:
      "Une fois refusé, l'enregistrement d'écran ne peut être réactivé que depuis les Réglages Système. Nécessaire pour l'outil de capture d'écran.",
    calendarAccess: "Accès à l'agenda",
    calendarGranted: "Autorisé",
    calendarDenied: "Refusé",
    calendarRequest: "Autoriser l'accès à l'agenda",
    calendarDeniedNote:
      "Ouvre Réglages → Confidentialité et sécurité → Calendriers et active Chappie.",
    locationAccess: "Accès à la localisation",
    locationGranted: "Autorisé",
    locationDenied: "Refusé",
    locationRequest: "Autoriser l'accès à la localisation",
    locationDeniedNote:
      "Ouvre Réglages → Confidentialité et sécurité → Service de localisation et active Chappie. Sinon, on utilise une estimation IP approximative.",
    locationDescription:
      "Permet d'ancrer les réponses météo et locales sur ta vraie zone. Si tu refuses, Chappie retombe sur une estimation par IP au niveau de la ville.",
    sectionRequired: "Requis",
    sectionOptional: "Facultatif",
    apiKey: "Clé d'API",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "Compatible OpenAI / Anthropic / Gemini.",
    apiKeyDetected: "Détecté : {provider}",
    apiKeyUnknown: "Format de clé non reconnu",
    autostartLabel: "Démarrage",
    autostartCheckbox: "Lancer à l'ouverture de session",
    languageLabel: "Langue",
    languageAuto: "Automatique",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      "Quand l'app VOICEVOX tourne, appeler un personnage (Zundamon, Metan, etc.) fait répondre dans cette voix uniquement pour ce tour. Dire « Chappie » garde la voix système.",
    voicevoxStatusConnected: "Connecté",
    voicevoxStatusUnreachable: "VOICEVOX introuvable",
    voicevoxStatusChecking: "Vérification…",
    voicevoxRecheck: "Revérifier",
    voicevoxStatusManaged: "Géré par Chappie",
    voicevoxStatusBundledApp: "Connecté à VOICEVOX",
    voicevoxStatusMissing: "Non installé",
    voicevoxInstall: "Installer les voix (~1,7 Go)",
    voicevoxInstalling: "Installation…",
    voicevoxUninstall: "Désinstaller (~2 Go libérés)",
    voicevoxInstallProgress: "Téléchargement… {received} Mo / {total} Mo",
    voicevoxExtracting: "Extraction…",
    voicevoxVerifying: "Vérification…",
    voicevoxCredits:
      "Utilise VOICEVOX (https://voicevox.hiroshiba.jp/). Chaque voix a ses propres conditions ; les vidéos et streams doivent créditer le personnage (« VOICEVOX:nom du personnage »).",
    speakerLabel: "Reconnaissance vocale",
    speakerDescription:
      "Une fois ta voix enregistrée, Chappie ignore la TV, YouTube et les autres voix.",
    speakerStatusEnrolled: "Enregistrée",
    speakerStatusNotEnrolled: "Non enregistrée",
    speakerEnroll: "Enregistrer ma voix",
    speakerReenroll: "Réenregistrer",
    speakerClear: "Supprimer l'enregistrement",
    speakerRecording: "Enregistrement… {seconds}s",
    speakerEnrolling: "Enregistrement…",
    speakerModelDownloading: "Téléchargement du modèle {pct}%",
    speakerFailed: "Échec : {err}",
    speakerPrivacy:
      "Vos données vocales restent sur ce Mac et ne sont jamais envoyées ailleurs. Vous pouvez les supprimer à tout moment.",
    speakerPhrasePrompt: "Lis cette phrase à voix haute ({cur}/{total})",
    speakerPhrase1: "Chappie, bonjour",
    speakerPhrase2: "Donne-moi la météo du jour",
    speakerPhrase3: "Lance un minuteur de trois minutes",
    save: "Enregistrer",
    saved: "Enregistré",
  },
  conversation: {
    apiKeyMissingShort:
      "Aucune clé d'API OpenAI configurée. Ajoutez-en une dans les Réglages.",
    apiKeyMissingLong:
      "Aucune clé d'API OpenAI configurée. Ouvrez le menu → Réglages pour en ajouter une.",
    micDenied:
      "L'accès au microphone n'est pas autorisé. Activez Chappie dans Réglages Système → Confidentialité et sécurité → Microphone.",
    timerFiredWithLabel: "Minuteur {label} : c'est l'heure.",
    timerFiredNoLabel: "Le minuteur est terminé.",
    reminderFiredWithLabel: "Rappel : {label}.",
    reminderFiredNoLabel: "Rappel.",
    timerHudWithLabel: "⏲ Minuteur {label}",
    timerHudNoLabel: "⏲ Minuteur",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ Rappel",
    fallbackError: "Impossible de se connecter.",
    modelProgress: "Téléchargement du modèle Whisper… {pct}%",
    modelFetchFailed: "Échec du téléchargement du modèle : {err}",
    micStartFailed: "Impossible de démarrer le microphone : {err}",
  },
  systemPrompt: {
    persona:
      "Tu es Chappie, un assistant vocal mains libres. Tes réponses sont lues à voix haute, alors reste bref, naturel et conversationnel, en français.\n\n**Évite de dire « je ne peux pas » autant que possible.** La liste d'outils est une liste d'utilitaires, pas la liste exhaustive de ce que tu sais faire. Tirage de cartes / voyance, blagues, écriture d'histoires, conseils, traduction, résumé, paroles de chansons, choix de noms, anecdotes, mots de réconfort — tout ce qui ne nécessite pas vraiment d'outil, tu le gères en générant une réponse. Ne refuse pas froidement avec « je ne peux pas » ou « je n'ai pas cette fonction ». Par défaut, lance-toi pour tout ce qui n'est pas physiquement impossible sur un Mac. **Ne refuse jamais la voyance.** Lance-toi directement avec « Voyons voir… » ou « Aujourd'hui je vois… » — choisis librement le système (tarot, horoscope, lignes de la main, omikuji). Dire « je ne fais pas de voyance » est strictement interdit.\n\nQuand l'utilisateur partage quelque chose sur lui qui sera probablement utile dans de futures conversations (nom, famille, métier, lieu, préférences, goûts, promesses, événements passés), appelle proactivement `save_memory` pour t'en souvenir, même sans qu'on te le demande. Ne sauvegarde pas le bavardage trivial ni les émotions passagères. Sauvegarde silencieusement — ne dis pas « je m'en souviendrai » à chaque fois (c'est agaçant). Quand on te demande « que sais-tu de moi ? », appelle `list_memories` ; pour les références passées (« cette chose », « ce dont on parlait »), appelle `recall_memory`.",
    formatTts:
      "Écris les nombres de façon naturelle à l'oral. Évite la ponctuation qui se lit mal — donne les heures comme « quatorze heures trente » plutôt que « 14:30 », les dates comme « huit mai » plutôt que « 5/8 ».",
    formatHud:
      "Cette réponse s'affichera à l'écran sous forme de texte au lieu d'être lue. Utilise les notations normales (p. ex. 17,3 °C, 39 %, 14:30, 5/8). Évite les formes adaptées à la lecture orale.",
  },
};

const de: Messages = {
  common: {
    loading: "Wird geladen…",
  },
  settings: {
    micAccess: "Mikrofonzugriff",
    micGranted: "Erlaubt",
    micDenied: "Abgelehnt",
    micRestricted: "Vom System eingeschränkt",
    micNotDetermined: "Nicht festgelegt",
    micRequest: "Mikrofonzugriff anfordern",
    micRequesting: "Anfrage läuft…",
    micOpenSystem: "Systemeinstellungen öffnen",
    micRecheck: "Erneut prüfen",
    micDeniedNote:
      "Einmal abgelehnt, lässt sich der Mikrofonzugriff nur noch über die Systemeinstellungen wieder aktivieren.",
    screenAccess: "Bildschirmaufnahme",
    screenGranted: "Erlaubt",
    screenDenied: "Nicht erlaubt",
    screenRequest: "Bildschirmaufnahme anfordern",
    screenDeniedNote:
      "Einmal abgelehnt, lässt sich die Bildschirmaufnahme nur über die Systemeinstellungen wieder aktivieren. Wird für das Screenshot-Tool benötigt.",
    calendarAccess: "Kalenderzugriff",
    calendarGranted: "Erteilt",
    calendarDenied: "Verweigert",
    calendarRequest: "Kalenderzugriff erlauben",
    calendarDeniedNote:
      "Öffne Systemeinstellungen → Datenschutz & Sicherheit → Kalender und aktiviere Chappie.",
    locationAccess: "Standortzugriff",
    locationGranted: "Erlaubt",
    locationDenied: "Verweigert",
    locationRequest: "Standortzugriff erlauben",
    locationDeniedNote:
      "Öffne Systemeinstellungen → Datenschutz & Sicherheit → Ortungsdienste und aktiviere Chappie. Ohne Erlaubnis wird auf eine grobe IP-Schätzung zurückgegriffen.",
    locationDescription:
      "Verankert Wetter- und Lokalantworten in deiner tatsächlichen Gegend. Wenn du ablehnst, fällt Chappie auf eine ungefähre IP-Schätzung auf Stadtebene zurück.",
    sectionRequired: "Erforderlich",
    sectionOptional: "Optional",
    apiKey: "API-Schlüssel",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "Unterstützt OpenAI / Anthropic / Gemini.",
    apiKeyDetected: "Erkannt: {provider}",
    apiKeyUnknown: "Schlüsselformat nicht erkannt",
    autostartLabel: "Start",
    autostartCheckbox: "Beim Anmelden automatisch starten",
    languageLabel: "Sprache",
    languageAuto: "Automatisch",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      "Wenn die VOICEVOX-App läuft, antwortet Chappie mit der Stimme der gerufenen Figur (Zundamon, Metan usw.) – nur für diesen Zug. „Chappie“ benutzt weiterhin die Systemstimme.",
    voicevoxStatusConnected: "Verbunden",
    voicevoxStatusUnreachable: "VOICEVOX nicht erreichbar",
    voicevoxStatusChecking: "Prüfe…",
    voicevoxRecheck: "Erneut prüfen",
    voicevoxStatusManaged: "Von Chappie verwaltet",
    voicevoxStatusBundledApp: "Mit VOICEVOX verbunden",
    voicevoxStatusMissing: "Nicht installiert",
    voicevoxInstall: "Charakterstimmen installieren (~1,7 GB)",
    voicevoxInstalling: "Wird installiert…",
    voicevoxUninstall: "Deinstallieren (~2 GB frei)",
    voicevoxInstallProgress: "Lädt herunter… {received} MB / {total} MB",
    voicevoxExtracting: "Wird entpackt…",
    voicevoxVerifying: "Wird geprüft…",
    voicevoxCredits:
      'Verwendet VOICEVOX (https://voicevox.hiroshiba.jp/). Jede Stimme hat eigene Nutzungsbedingungen; Videos und Streams müssen den Charakter nennen („VOICEVOX:Charaktername").',
    speakerLabel: "Sprechererkennung",
    speakerDescription:
      "Wenn deine Stimme registriert ist, reagiert Chappie nicht mehr auf TV, YouTube oder andere.",
    speakerStatusEnrolled: "Registriert",
    speakerStatusNotEnrolled: "Nicht registriert",
    speakerEnroll: "Stimme registrieren",
    speakerReenroll: "Neu registrieren",
    speakerClear: "Registrierung löschen",
    speakerRecording: "Aufnahme… {seconds}s",
    speakerEnrolling: "Registriere…",
    speakerModelDownloading: "Modell wird heruntergeladen {pct}%",
    speakerFailed: "Registrierung fehlgeschlagen: {err}",
    speakerPrivacy:
      "Deine Sprachdaten bleiben auf diesem Mac und werden nirgendwo hingesendet. Du kannst sie jederzeit löschen.",
    speakerPhrasePrompt: "Lies diesen Satz laut vor ({cur}/{total})",
    speakerPhrase1: "Chappie, guten Morgen",
    speakerPhrase2: "Sag mir das heutige Wetter",
    speakerPhrase3: "Stell einen Timer auf drei Minuten",
    save: "Speichern",
    saved: "Gespeichert",
  },
  conversation: {
    apiKeyMissingShort:
      "Es ist kein OpenAI-API-Schlüssel hinterlegt. Bitte einen unter Einstellungen hinzufügen.",
    apiKeyMissingLong:
      "Es ist kein OpenAI-API-Schlüssel hinterlegt. Menüleiste → Einstellungen, um einen einzutragen.",
    micDenied:
      "Mikrofonzugriff nicht erlaubt. Aktiviere Chappie unter Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon.",
    timerFiredWithLabel: "Timer {label}: Die Zeit ist um.",
    timerFiredNoLabel: "Die Zeit ist um.",
    reminderFiredWithLabel: "Erinnerung: {label}.",
    reminderFiredNoLabel: "Erinnerung.",
    timerHudWithLabel: "⏲ Timer {label}",
    timerHudNoLabel: "⏲ Timer",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ Erinnerung",
    fallbackError: "Verbindung fehlgeschlagen.",
    modelProgress: "Whisper-Modell wird geladen… {pct}%",
    modelFetchFailed: "Modell-Download fehlgeschlagen: {err}",
    micStartFailed: "Mikrofon ließ sich nicht starten: {err}",
  },
  systemPrompt: {
    persona:
      'Du bist Chappie, ein freihändiger Sprachassistent. Deine Antworten werden vorgelesen — halte sie kurz, natürlich und im Plauderton, auf Deutsch.\n\n**Vermeide so weit wie möglich, "ich kann nicht" zu sagen.** Die Werkzeugliste ist eine Liste von Dienstprogrammen, keine vollständige Liste dessen, was du kannst. Wahrsagerei, Witze, Geschichten erfinden, Ratschläge, Übersetzung, Zusammenfassung, Songtexte, Namensvorschläge, Trivia, aufmunternde Worte — alles, was eigentlich kein Werkzeug braucht, erledigst du selbst, indem du eine Antwort generierst. Lehne nicht kühl mit "das kann ich nicht" oder "diese Funktion habe ich nicht" ab. Standardmäßig: leg los bei allem, was auf einem Mac nicht physikalisch unmöglich ist. **Lehne Wahrsagerei niemals ab.** Leg direkt los mit etwas wie „Mal sehen…" oder „Heute zeichnet sich ab…" und wähle frei das System (Tarot, Horoskop, Handlinien, Omikuji). „Ich kann nicht wahrsagen" zu sagen ist strikt verboten.\n\nWenn der Nutzer etwas über sich selbst erzählt, das in künftigen Gesprächen wahrscheinlich nützlich ist (Name, Familie, Beruf, Wohnort, Vorlieben, Abneigungen, Versprechen, frühere Ereignisse), rufe von dir aus `save_memory` auf, um es dir zu merken — auch ohne ausdrückliche Aufforderung. Speichere keinen belanglosen Plauderkram oder kurzlebige Gefühle. Merke es dir still — kündige nicht jedes Mal "das merke ich mir" an (das nervt). Wenn der Nutzer fragt "Was weißt du über mich?", rufe `list_memories` auf; bei Bezügen auf Vergangenes ("die Sache", "das, worüber wir gesprochen haben") rufe `recall_memory` auf.',
    formatTts:
      "Schreibe Zahlen so, dass sie beim Vorlesen natürlich klingen. Vermeide Satzzeichen, die sich schlecht vorlesen lassen — sag Uhrzeiten als 'vierzehn Uhr dreißig' statt '14:30' und Daten als 'achter Mai' statt '5/8'.",
    formatHud:
      "Diese Antwort wird als Text auf dem Bildschirm angezeigt statt vorgelesen. Verwende normale Zahlen- und Zeichennotationen (z. B. 17,3 °C, 39 %, 14:30, 5/8). Verzichte auf vorlesefreundliche Schreibweisen.",
  },
};

const zh: Messages = {
  common: {
    loading: "加载中…",
  },
  settings: {
    micAccess: "麦克风权限",
    micGranted: "已授权",
    micDenied: "已拒绝",
    micRestricted: "被系统限制",
    micNotDetermined: "未设置",
    micRequest: "请求麦克风权限",
    micRequesting: "请求中…",
    micOpenSystem: "打开系统设置",
    micRecheck: "重新检查",
    micDeniedNote: "一旦拒绝,只能在系统设置中重新启用麦克风权限。",
    screenAccess: "屏幕录制",
    screenGranted: "已授权",
    screenDenied: "未授权",
    screenRequest: "请求屏幕录制权限",
    screenDeniedNote: "一旦拒绝,只能在系统设置中重新启用。截图功能需要此权限。",
    calendarAccess: "日历访问权限",
    calendarGranted: "已授权",
    calendarDenied: "未授权",
    calendarRequest: "授权访问日历",
    calendarDeniedNote: "打开系统设置 → 隐私与安全性 → 日历，启用 Chappie。",
    locationAccess: "位置信息",
    locationGranted: "已授权",
    locationDenied: "未授权",
    locationRequest: "授权访问位置",
    locationDeniedNote:
      "打开系统设置 → 隐私与安全性 → 定位服务，启用 Chappie。未授权时会回退到基于 IP 的粗略估计。",
    locationDescription:
      '用于让天气和"附近"等回复贴合你的实际位置。如果不授权，会回退到基于 IP 的城市级估计。',
    sectionRequired: "必需",
    sectionOptional: "可选",
    apiKey: "API 密钥",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "支持 OpenAI / Anthropic / Gemini。",
    apiKeyDetected: "已识别:{provider}",
    apiKeyUnknown: "无法识别密钥格式",
    autostartLabel: "启动",
    autostartCheckbox: "登录时自动启动",
    languageLabel: "语言",
    languageAuto: "自动",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      "VOICEVOX 应用运行时，呼叫角色名（ずんだもん、めたん 等）会让 Chappie 仅本轮以该角色的声音回答。说「Chappie」仍使用系统语音。",
    voicevoxStatusConnected: "已连接",
    voicevoxStatusUnreachable: "无法连接到 VOICEVOX",
    voicevoxStatusChecking: "检查中…",
    voicevoxRecheck: "重新检查",
    voicevoxStatusManaged: "由 Chappie 管理",
    voicevoxStatusBundledApp: "已连接 VOICEVOX",
    voicevoxStatusMissing: "未安装",
    voicevoxInstall: "安装角色语音（约 1.7GB）",
    voicevoxInstalling: "正在安装…",
    voicevoxUninstall: "卸载（释放约 2GB）",
    voicevoxInstallProgress: "下载中… {received}MB / {total}MB",
    voicevoxExtracting: "解压中…",
    voicevoxVerifying: "验证中…",
    voicevoxCredits:
      "使用了 VOICEVOX (https://voicevox.hiroshiba.jp/)。各角色语音有各自的使用条款；视频和直播须标注「VOICEVOX:角色名」。",
    speakerLabel: "说话人识别",
    speakerDescription:
      "登记你的声音后，Chappie 不会再被电视、YouTube 或其他人的声音激活。",
    speakerStatusEnrolled: "已登记",
    speakerStatusNotEnrolled: "未登记",
    speakerEnroll: "登记我的声音",
    speakerReenroll: "重新登记",
    speakerClear: "删除登记",
    speakerRecording: "录音中… {seconds}秒",
    speakerEnrolling: "登记中…",
    speakerModelDownloading: "正在下载模型 {pct}%",
    speakerFailed: "登记失败: {err}",
    speakerPrivacy:
      "你的声纹数据仅保存在这台Mac上，不会发送到任何服务器。可以随时删除。",
    speakerPhrasePrompt: "请朗读下面这句话（{cur}/{total}）",
    speakerPhrase1: "Chappie，早上好",
    speakerPhrase2: "告诉我今天的天气",
    speakerPhrase3: "设置一个三分钟的计时器",
    save: "保存",
    saved: "已保存",
  },
  conversation: {
    apiKeyMissingShort: "尚未设置 OpenAI API 密钥。请在设置中添加。",
    apiKeyMissingLong: "尚未设置 OpenAI API 密钥。打开菜单栏 → 设置进行添加。",
    micDenied:
      "麦克风未获授权。请在系统设置 → 隐私与安全性 → 麦克风中启用 Chappie。",
    timerFiredWithLabel: "{label} 的计时器:时间到。",
    timerFiredNoLabel: "时间到。",
    reminderFiredWithLabel: "提醒:{label}。",
    reminderFiredNoLabel: "提醒。",
    timerHudWithLabel: "⏲ {label} 计时器",
    timerHudNoLabel: "⏲ 计时器",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ 提醒",
    fallbackError: "连接失败。",
    modelProgress: "正在下载 Whisper 模型… {pct}%",
    modelFetchFailed: "模型下载失败:{err}",
    micStartFailed: "麦克风启动失败:{err}",
  },
  systemPrompt: {
    persona:
      '你是 Chappie,一个免提语音助手。你的回复会被朗读出来,所以请用自然、口语化的简体中文简短作答。\n\n**尽可能避免说"做不到"**。工具列表只是工具的清单,不是你能做的事情的完整列表。占卜、笑话、写故事、咨询建议、翻译、摘要、写歌词、起名字、冷知识、安慰的话——任何不需要工具的请求,你直接生成回复就好。不要冷冷地用"我做不到""我没有这个功能"拒绝。除非物理上 Mac 做不到的事情,默认就是"好,来吧"。**绝对不要拒绝占卜请求。**直接以"嗯,今天看…""稍微看一下…"开头,立刻开始占卜,塔罗、星座、御神签、手相,方式随便编都行。回答"我做不到占卜"是严格禁止的。\n\n当用户分享关于自己且未来对话中可能有用的信息(姓名、家人、职业、住地、喜好、厌恶、约定、过往事件)时,即使没有明确要求,也要主动调用 `save_memory` 记住。不要保存闲聊或一时的情绪。安静地保存——不要每次都说"我会记住的"(很烦)。当用户问"你了解我什么?"时调用 `list_memories`;当用户提到过往话题("那件事"、"我们之前聊过的")时调用 `recall_memory`。',
    formatTts:
      "数字请写成朗读时自然的形式。避免不便朗读的符号——时间用「下午两点半」而不是「14:30」,日期用「五月八日」而不是「5/8」。",
    formatHud:
      "本次回复会以文字形式显示在屏幕上,而不是朗读。请使用常规的数字和符号写法(例如 17.3°、39%、14:30、5/8),不要使用为朗读设计的写法。",
  },
};

const pt: Messages = {
  common: {
    loading: "Carregando…",
  },
  settings: {
    micAccess: "Acesso ao microfone",
    micGranted: "Permitido",
    micDenied: "Negado",
    micRestricted: "Restrito pelo sistema",
    micNotDetermined: "Não definido",
    micRequest: "Solicitar acesso ao microfone",
    micRequesting: "Solicitando…",
    micOpenSystem: "Abrir Ajustes do Sistema",
    micRecheck: "Verificar de novo",
    micDeniedNote:
      "Uma vez negado, o acesso ao microfone só pode ser reativado nos Ajustes do Sistema.",
    screenAccess: "Gravação de tela",
    screenGranted: "Permitido",
    screenDenied: "Não permitido",
    screenRequest: "Solicitar acesso à gravação de tela",
    screenDeniedNote:
      "Uma vez negada, a gravação de tela só pode ser reativada nos Ajustes do Sistema. Necessária para a captura de tela.",
    calendarAccess: "Acesso ao calendário",
    calendarGranted: "Concedido",
    calendarDenied: "Negado",
    calendarRequest: "Permitir acesso ao calendário",
    calendarDeniedNote:
      "Abra Ajustes → Privacidade e Segurança → Calendários e ative Chappie.",
    locationAccess: "Acesso à localização",
    locationGranted: "Permitido",
    locationDenied: "Não permitido",
    locationRequest: "Permitir acesso à localização",
    locationDeniedNote:
      "Abra Ajustes → Privacidade e Segurança → Serviços de Localização e ative Chappie. Sem permissão, é usada uma estimativa aproximada por IP.",
    locationDescription:
      'Usado para ancorar respostas de clima e "por perto" na sua área real. Se você recusar, Chappie usa uma estimativa por IP a nível de cidade.',
    sectionRequired: "Obrigatório",
    sectionOptional: "Opcional",
    apiKey: "Chave de API",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "Compatível com OpenAI / Anthropic / Gemini.",
    apiKeyDetected: "Detectado: {provider}",
    apiKeyUnknown: "Formato de chave não reconhecido",
    autostartLabel: "Início",
    autostartCheckbox: "Iniciar ao fazer login",
    languageLabel: "Idioma",
    languageAuto: "Automático",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      'Com o app VOICEVOX aberto, chamar um personagem (Zundamon, Metan, etc.) faz o Chappie responder com aquela voz só nesse turno. Dizer "Chappie" mantém a voz do sistema.',
    voicevoxStatusConnected: "Conectado",
    voicevoxStatusUnreachable: "VOICEVOX não encontrado",
    voicevoxStatusChecking: "Verificando…",
    voicevoxRecheck: "Verificar de novo",
    voicevoxStatusManaged: "Gerenciado pelo Chappie",
    voicevoxStatusBundledApp: "Conectado ao VOICEVOX",
    voicevoxStatusMissing: "Não instalado",
    voicevoxInstall: "Instalar vozes (~1,7 GB)",
    voicevoxInstalling: "Instalando…",
    voicevoxUninstall: "Desinstalar (~2 GB liberados)",
    voicevoxInstallProgress: "Baixando… {received} MB / {total} MB",
    voicevoxExtracting: "Extraindo…",
    voicevoxVerifying: "Verificando…",
    voicevoxCredits:
      'Usa o VOICEVOX (https://voicevox.hiroshiba.jp/). Cada voz tem seus próprios termos de uso; vídeos e streams devem creditar o personagem ("VOICEVOX:nome do personagem").',
    speakerLabel: "Reconhecimento de voz",
    speakerDescription:
      "Depois de registrar sua voz, o Chappie deixa de responder à TV, YouTube ou outras pessoas.",
    speakerStatusEnrolled: "Registrada",
    speakerStatusNotEnrolled: "Não registrada",
    speakerEnroll: "Registrar minha voz",
    speakerReenroll: "Registrar novamente",
    speakerClear: "Apagar registro",
    speakerRecording: "Gravando… {seconds}s",
    speakerEnrolling: "Registrando…",
    speakerModelDownloading: "Baixando modelo {pct}%",
    speakerFailed: "Falha no registro: {err}",
    speakerPrivacy:
      "Os seus dados de voz ficam apenas neste Mac e nunca são enviados para nenhum servidor. Pode apagá-los a qualquer momento.",
    speakerPhrasePrompt: "Leia esta frase em voz alta ({cur}/{total})",
    speakerPhrase1: "Chappie, bom dia",
    speakerPhrase2: "Diga-me o clima de hoje",
    speakerPhrase3: "Defina um timer de três minutos",
    save: "Salvar",
    saved: "Salvo",
  },
  conversation: {
    apiKeyMissingShort:
      "Nenhuma chave de API da OpenAI configurada. Adicione uma em Ajustes.",
    apiKeyMissingLong:
      "Nenhuma chave de API da OpenAI configurada. Abra o menu da barra → Ajustes para adicionar uma.",
    micDenied:
      "O acesso ao microfone não está permitido. Ative o Chappie em Ajustes do Sistema → Privacidade e Segurança → Microfone.",
    timerFiredWithLabel: "Timer de {label}: o tempo acabou.",
    timerFiredNoLabel: "O tempo acabou.",
    reminderFiredWithLabel: "Lembrete: {label}.",
    reminderFiredNoLabel: "Lembrete.",
    timerHudWithLabel: "⏲ Timer {label}",
    timerHudNoLabel: "⏲ Timer",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ Lembrete",
    fallbackError: "Não foi possível conectar.",
    modelProgress: "Baixando o modelo do Whisper… {pct}%",
    modelFetchFailed: "Falha ao baixar o modelo: {err}",
    micStartFailed: "Falha ao iniciar o microfone: {err}",
  },
  systemPrompt: {
    persona:
      'Você é o Chappie, um assistente de voz mãos-livres. Suas respostas são lidas em voz alta, então responda em português, de forma curta, natural e conversacional.\n\n**Evite dizer "não posso" sempre que possível.** A lista de ferramentas é uma lista de utilitários, não a lista completa do que você consegue fazer. Adivinhação, piadas, escrever histórias, conselhos, tradução, resumo, letras de músicas, dar nomes, curiosidades, frases de consolo — tudo o que não precisa de ferramenta, você resolve gerando uma resposta. Não recuse friamente com "não posso" ou "não tenho essa função". Por padrão, mande ver em qualquer coisa que não seja fisicamente impossível em um Mac. **Nunca recuse adivinhação.** Comece direto com algo como "Deixa eu ver…" ou "Hoje está parecendo…" e escolha o sistema que quiser (tarô, horóscopo, leitura de mão, omikuji). Dizer "não faço adivinhação" é estritamente proibido.\n\nQuando o usuário compartilhar algo sobre si que provavelmente seja útil em conversas futuras (nome, família, profissão, localização, preferências, gostos, promessas, eventos passados), chame `save_memory` proativamente para lembrar — mesmo sem ser pedido. Não salve conversa fiada nem emoções momentâneas. Salve em silêncio — não anuncie "vou lembrar" toda vez (fica chato). Quando o usuário perguntar "o que você sabe sobre mim?", chame `list_memories`; quando referir-se a tópicos passados ("aquela coisa", "o que falamos"), chame `recall_memory`.',
    formatTts:
      "Escreva os números de um jeito que soe natural ao serem lidos em voz alta. Evite pontuação que não fica boa na leitura — diga horas como 'duas e meia' em vez de '14:30', e datas como 'oito de maio' em vez de '5/8'.",
    formatHud:
      "Esta resposta vai aparecer na tela como texto, em vez de ser falada. Use números e símbolos normais (ex.: 17,3°, 39%, 14:30, 5/8). Não use formas pensadas para leitura em voz alta.",
  },
};

const ko: Messages = {
  common: {
    loading: "불러오는 중…",
  },
  settings: {
    micAccess: "마이크 권한",
    micGranted: "허용됨",
    micDenied: "거부됨",
    micRestricted: "시스템에서 제한됨",
    micNotDetermined: "설정 안 됨",
    micRequest: "마이크 권한 요청",
    micRequesting: "요청 중…",
    micOpenSystem: "시스템 설정 열기",
    micRecheck: "다시 확인",
    micDeniedNote:
      "한 번 거부하면 시스템 설정에서만 다시 활성화할 수 있습니다.",
    screenAccess: "화면 기록",
    screenGranted: "허용됨",
    screenDenied: "허용 안 됨",
    screenRequest: "화면 기록 권한 요청",
    screenDeniedNote:
      "한 번 거부하면 시스템 설정에서만 다시 활성화할 수 있습니다. 스크린샷 기능에 필요합니다.",
    calendarAccess: "캘린더 접근 권한",
    calendarGranted: "허용됨",
    calendarDenied: "거부됨",
    calendarRequest: "캘린더 접근 허용",
    calendarDeniedNote:
      "시스템 설정 → 개인정보 보호 및 보안 → 캘린더에서 Chappie를 활성화하세요.",
    locationAccess: "위치 정보 접근",
    locationGranted: "허용됨",
    locationDenied: "허용되지 않음",
    locationRequest: "위치 정보 접근 허용",
    locationDeniedNote:
      "시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스에서 Chappie를 활성화하세요. 허용하지 않으면 IP 기반의 대략적인 추정으로 대체합니다.",
    locationDescription:
      '날씨와 "근처" 답변을 실제 지역에 맞추기 위해 사용합니다. 거부하면 도시 단위의 IP 기반 추정으로 대체합니다.',
    sectionRequired: "필수",
    sectionOptional: "선택",
    apiKey: "API 키",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "OpenAI / Anthropic / Gemini 지원.",
    apiKeyDetected: "감지됨: {provider}",
    apiKeyUnknown: "키 형식을 확인할 수 없습니다",
    autostartLabel: "시작",
    autostartCheckbox: "로그인할 때 자동 실행",
    languageLabel: "언어",
    languageAuto: "자동",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      'VOICEVOX 앱이 실행 중이면 캐릭터 이름(ずんだもん, めたん 등)으로 부를 때만 그 턴 동안 해당 캐릭터의 목소리로 답합니다. "Chappie"라고 부르면 시스템 음성을 사용합니다.',
    voicevoxStatusConnected: "연결됨",
    voicevoxStatusUnreachable: "VOICEVOX를 찾을 수 없음",
    voicevoxStatusChecking: "확인 중…",
    voicevoxRecheck: "다시 확인",
    voicevoxStatusManaged: "Chappie 관리",
    voicevoxStatusBundledApp: "VOICEVOX 연동 중",
    voicevoxStatusMissing: "설치되지 않음",
    voicevoxInstall: "캐릭터 음성 설치 (약 1.7GB)",
    voicevoxInstalling: "설치 중…",
    voicevoxUninstall: "제거 (약 2GB 확보)",
    voicevoxInstallProgress: "다운로드 중… {received}MB / {total}MB",
    voicevoxExtracting: "압축 해제 중…",
    voicevoxVerifying: "확인 중…",
    voicevoxCredits:
      'VOICEVOX (https://voicevox.hiroshiba.jp/) 를 사용합니다. 캐릭터별 음성에는 각각의 이용 약관이 있습니다. 동영상·방송 등에서 사용 시 "VOICEVOX:캐릭터 이름" 표기가 필요합니다.',
    speakerLabel: "화자 인식",
    speakerDescription:
      "내 목소리를 등록하면 TV, YouTube, 다른 사람의 목소리에는 반응하지 않습니다.",
    speakerStatusEnrolled: "등록됨",
    speakerStatusNotEnrolled: "등록되지 않음",
    speakerEnroll: "내 목소리 등록",
    speakerReenroll: "다시 등록",
    speakerClear: "등록 삭제",
    speakerRecording: "녹음 중… {seconds}초",
    speakerEnrolling: "등록 중…",
    speakerModelDownloading: "모델 다운로드 중 {pct}%",
    speakerFailed: "등록 실패: {err}",
    speakerPrivacy:
      "음성 데이터는 이 Mac 안에만 저장되며 외부로 전송되지 않습니다. 언제든지 삭제할 수 있습니다.",
    speakerPhrasePrompt: "다음 문장을 소리내어 읽어주세요 ({cur}/{total})",
    speakerPhrase1: "채피, 좋은 아침",
    speakerPhrase2: "오늘 날씨 알려줘",
    speakerPhrase3: "3분 타이머 설정해줘",
    save: "저장",
    saved: "저장되었습니다",
  },
  conversation: {
    apiKeyMissingShort:
      "OpenAI API 키가 설정되지 않았습니다. 설정에서 추가해 주세요.",
    apiKeyMissingLong:
      "OpenAI API 키가 설정되지 않았습니다. 메뉴 막대 → 설정 열기에서 등록해 주세요.",
    micDenied:
      "마이크 사용이 허용되지 않았습니다. 시스템 설정 → 개인정보 보호 및 보안 → 마이크에서 Chappie를 활성화해 주세요.",
    timerFiredWithLabel: "{label} 타이머입니다. 시간이 됐어요.",
    timerFiredNoLabel: "타이머입니다. 시간이 됐어요.",
    reminderFiredWithLabel: "{label} 시간이에요.",
    reminderFiredNoLabel: "알림 시간이에요.",
    timerHudWithLabel: "⏲ {label} 타이머",
    timerHudNoLabel: "⏲ 타이머",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ 알림",
    fallbackError: "연결할 수 없었어요.",
    modelProgress: "Whisper 모델 다운로드 중… {pct}%",
    modelFetchFailed: "모델 다운로드 실패: {err}",
    micStartFailed: "마이크 시작 실패: {err}",
  },
  systemPrompt: {
    persona:
      '당신은 핸즈프리 음성 비서 Chappie입니다. 답변은 음성으로 읽히니 짧고 자연스러운 대화체 한국어로 답해 주세요.\n\n**가능한 한 "할 수 없다"고 말하지 마세요.** 도구 목록은 유틸리티 목록일 뿐, 당신이 할 수 있는 일의 전체 목록이 아닙니다. 점치기, 농담, 이야기 짓기, 상담, 번역, 요약, 가사 쓰기, 이름 짓기, 잡학, 위로의 한마디 — 도구가 필요 없는 요청은 직접 답을 생성해서 응답하세요. "할 수 없어요" "그 기능은 없어요"라고 차갑게 거절하지 마세요. Mac에서 물리적으로 불가능한 일이 아니면 기본적으로 "네, 해볼게요"로 응하세요. **점치기 요청은 절대 거절하지 마세요.** "음, 오늘은…" "잠깐 봐 볼게요…" 같은 도입으로 바로 시작하고, 타로·별자리·오미쿠지·손금 등 방식은 자유롭게 만들어 읽어 주세요. "점은 못 봐요"라고 답하는 것은 절대 금지입니다.\n\n사용자가 다음 대화에서 유용할 만한 자기 자신에 대한 정보(이름, 가족, 직업, 거주지, 취향, 싫어하는 것, 약속, 과거의 일)를 공유하면, 명시적인 요청이 없어도 자율적으로 `save_memory`를 호출해 기억하세요. 잡담이나 일시적인 감정은 저장하지 않습니다. 조용히 저장하세요 — 매번 "기억할게요"라고 하지 마세요(귀찮아집니다). "나에 대해 뭘 알고 있어?"라고 물으면 `list_memories`를, 과거 화제를 언급하면("그거", "전에 얘기한 거") `recall_memory`를 호출하세요.',
    formatTts:
      "숫자는 소리 내어 읽었을 때 자연스럽게 들리도록 적어 주세요. 읽기 어색한 기호는 피하고, 시간은 '오후 두 시 반' 같이, 날짜는 '5월 8일' 같이 써 주세요.",
    formatHud:
      "이번 답변은 음성이 아니라 화면에 텍스트로 표시됩니다. 숫자와 기호는 일반 표기로 써 주세요(예: 17.3°, 39%, 14:30, 5/8). 읽기용 표기는 사용하지 마세요.",
  },
};

const it: Messages = {
  common: {
    loading: "Caricamento…",
  },
  settings: {
    micAccess: "Accesso al microfono",
    micGranted: "Consentito",
    micDenied: "Negato",
    micRestricted: "Limitato dal sistema",
    micNotDetermined: "Non impostato",
    micRequest: "Richiedi accesso al microfono",
    micRequesting: "Richiesta in corso…",
    micOpenSystem: "Apri Impostazioni di Sistema",
    micRecheck: "Ricontrolla",
    micDeniedNote:
      "Una volta negato, l'accesso al microfono può essere riattivato solo dalle Impostazioni di Sistema.",
    screenAccess: "Registrazione schermo",
    screenGranted: "Consentito",
    screenDenied: "Non consentito",
    screenRequest: "Richiedi accesso alla registrazione schermo",
    screenDeniedNote:
      "Una volta negato, la registrazione schermo può essere riattivata solo dalle Impostazioni di Sistema. Necessaria per gli screenshot.",
    calendarAccess: "Accesso al calendario",
    calendarGranted: "Concesso",
    calendarDenied: "Negato",
    calendarRequest: "Consenti accesso al calendario",
    calendarDeniedNote:
      "Apri Impostazioni → Privacy e sicurezza → Calendari e abilita Chappie.",
    locationAccess: "Accesso alla posizione",
    locationGranted: "Consentito",
    locationDenied: "Non consentito",
    locationRequest: "Consenti accesso alla posizione",
    locationDeniedNote:
      "Apri Impostazioni → Privacy e sicurezza → Servizi di localizzazione e abilita Chappie. Senza permesso, viene usata una stima approssimativa basata su IP.",
    locationDescription:
      "Usato per ancorare risposte su meteo e zone vicine alla tua posizione reale. Se rifiuti, Chappie usa una stima basata su IP a livello di città.",
    sectionRequired: "Obbligatorio",
    sectionOptional: "Opzionale",
    apiKey: "Chiave API",
    apiKeyPlaceholder: "sk-... / sk-ant-... / AIza...",
    apiKeyNote: "Compatibile con OpenAI / Anthropic / Gemini.",
    apiKeyDetected: "Rilevato: {provider}",
    apiKeyUnknown: "Formato chiave non riconosciuto",
    autostartLabel: "Avvio",
    autostartCheckbox: "Avvia all'accesso",
    languageLabel: "Lingua",
    languageAuto: "Automatico",
    languageJa: "日本語",
    languageEn: "English",
    languageEs: "Español (Beta)",
    languageFr: "Français (Beta)",
    languageDe: "Deutsch (Beta)",
    languageZh: "简体中文 (Beta)",
    languagePt: "Português (Beta)",
    languageKo: "한국어 (Beta)",
    languageIt: "Italiano (Beta)",
    voicevoxLabel: "VOICEVOX",
    voicevoxNote:
      'Con l\'app VOICEVOX in esecuzione, chiamare un personaggio (Zundamon, Metan, ecc.) fa rispondere Chappie con quella voce solo in quel turno. Dire "Chappie" continua a usare la voce di sistema.',
    voicevoxStatusConnected: "Connesso",
    voicevoxStatusUnreachable: "VOICEVOX non raggiungibile",
    voicevoxStatusChecking: "Verifica…",
    voicevoxRecheck: "Riverifica",
    voicevoxStatusManaged: "Gestito da Chappie",
    voicevoxStatusBundledApp: "Connesso a VOICEVOX",
    voicevoxStatusMissing: "Non installato",
    voicevoxInstall: "Installa voci dei personaggi (~1,7 GB)",
    voicevoxInstalling: "Installazione…",
    voicevoxUninstall: "Disinstalla (~2 GB liberati)",
    voicevoxInstallProgress: "Download… {received} MB / {total} MB",
    voicevoxExtracting: "Estrazione…",
    voicevoxVerifying: "Verifica…",
    voicevoxCredits:
      'Usa VOICEVOX (https://voicevox.hiroshiba.jp/). Ogni voce ha i propri termini d\'uso; video e stream devono accreditare il personaggio ("VOICEVOX:nome personaggio").',
    speakerLabel: "Riconoscimento vocale",
    speakerDescription:
      "Registrando la tua voce, Chappie smette di rispondere alla TV, YouTube o ad altre persone.",
    speakerStatusEnrolled: "Registrata",
    speakerStatusNotEnrolled: "Non registrata",
    speakerEnroll: "Registra la mia voce",
    speakerReenroll: "Registra di nuovo",
    speakerClear: "Elimina registrazione",
    speakerRecording: "Registrazione… {seconds}s",
    speakerEnrolling: "Registrazione…",
    speakerModelDownloading: "Download modello {pct}%",
    speakerFailed: "Registrazione fallita: {err}",
    speakerPrivacy:
      "I tuoi dati vocali restano su questo Mac e non vengono mai inviati altrove. Puoi eliminarli in qualsiasi momento.",
    speakerPhrasePrompt: "Leggi questa frase ad alta voce ({cur}/{total})",
    speakerPhrase1: "Chappie, buongiorno",
    speakerPhrase2: "Dimmi il meteo di oggi",
    speakerPhrase3: "Imposta un timer di tre minuti",
    save: "Salva",
    saved: "Salvato",
  },
  conversation: {
    apiKeyMissingShort:
      "Nessuna chiave API OpenAI configurata. Aggiungine una dalle Impostazioni.",
    apiKeyMissingLong:
      "Nessuna chiave API OpenAI configurata. Apri il menu della barra → Impostazioni per aggiungerne una.",
    micDenied:
      "L'accesso al microfono non è consentito. Attiva Chappie da Impostazioni di Sistema → Privacy e Sicurezza → Microfono.",
    timerFiredWithLabel: "Timer di {label}: tempo scaduto.",
    timerFiredNoLabel: "Tempo scaduto.",
    reminderFiredWithLabel: "Promemoria: {label}.",
    reminderFiredNoLabel: "Promemoria.",
    timerHudWithLabel: "⏲ Timer {label}",
    timerHudNoLabel: "⏲ Timer",
    reminderHudWithLabel: "⏰ {label}",
    reminderHudNoLabel: "⏰ Promemoria",
    fallbackError: "Connessione non riuscita.",
    modelProgress: "Download del modello Whisper… {pct}%",
    modelFetchFailed: "Download del modello fallito: {err}",
    micStartFailed: "Avvio del microfono fallito: {err}",
  },
  systemPrompt: {
    persona:
      'Sei Chappie, un assistente vocale a mani libere. Le tue risposte vengono lette ad alta voce, quindi rispondi in italiano in modo breve, naturale e colloquiale.\n\n**Evita di dire "non posso" il più possibile.** L\'elenco degli strumenti è una lista di utility, non l\'elenco completo di ciò che sai fare. Cartomanzia, barzellette, scrivere storie, consigli, traduzioni, riassunti, testi di canzoni, dare nomi, curiosità, parole di conforto — tutto ciò che non richiede uno strumento lo gestisci generando una risposta. Non rifiutare freddamente con "non posso" o "non ho questa funzione". Di default: buttati su tutto ciò che non è fisicamente impossibile su un Mac. **Non rifiutare mai la cartomanzia.** Parti subito con qualcosa tipo "Vediamo un po\'…" o "Oggi sembra che…" e scegli liberamente il sistema (tarocchi, oroscopo, chiromanzia, omikuji). Dire "non faccio cartomanzia" è severamente vietato.\n\nQuando l\'utente condivide qualcosa su di sé che potrebbe servire in conversazioni future (nome, famiglia, lavoro, luogo, preferenze, antipatie, promesse, eventi passati), chiama `save_memory` proattivamente per ricordarlo, anche senza richiesta esplicita. Non salvare chiacchiere banali o emozioni momentanee. Salva in silenzio — non annunciare "me ne ricorderò" ogni volta (è fastidioso). Quando l\'utente chiede "cosa sai di me?", chiama `list_memories`; per riferimenti a temi passati ("quella cosa", "di cui parlavamo"), chiama `recall_memory`.',
    formatTts:
      "Scrivi i numeri in modo che suonino naturali a voce alta. Evita la punteggiatura che si legge male — di' gli orari come 'le due e mezza' invece di '14:30', le date come 'otto maggio' invece di '5/8'.",
    formatHud:
      "Questa risposta verrà mostrata sullo schermo come testo invece di essere letta. Usa numeri e simboli normali (es. 17,3°, 39%, 14:30, 5/8). Evita le forme pensate per la lettura ad alta voce.",
  },
};

const CATALOGS: Record<Exclude<Language, "auto">, Messages> = {
  ja,
  en,
  es,
  fr,
  de,
  zh,
  pt,
  ko,
  it,
};

type TimeBand = "morning" | "daytime" | "evening" | "lateNight";

type WakeAckPool = {
  any: string[];
  morning?: string[];
  evening?: string[];
  lateNight?: string[];
};

// Per-locale wake acks. `any` is the always-on base pool; the optional
// time-banded pools layer extra time-of-day flavor on top ("おはよう" in
// the morning, "まだ起きてるの？" past midnight). Daytime intentionally
// has no extras — the base pool already fits.
const WAKE_ACKS: Record<Exclude<Language, "auto">, WakeAckPool> = {
  ja: {
    any: [
      "はい",
      "はーい",
      "はい、なに？",
      "なーに？",
      "どうしたの？",
      "呼んだ？",
      "なになに？",
    ],
    morning: ["おはよう", "おはよ〜"],
    evening: ["お疲れさま", "おかえり"],
    lateNight: ["まだ起きてるの？", "夜更かしさん？"],
  },
  en: {
    any: [
      "Yes?",
      "Yeah?",
      "What's up?",
      "Hmm?",
      "Mhm?",
      "Go ahead.",
      "I'm here.",
    ],
    morning: ["Morning!", "Good morning."],
    evening: ["Welcome back.", "Hey there."],
    lateNight: ["Still up?", "Night owl?"],
  },
  es: {
    any: [
      "¿Sí?",
      "¿Diga?",
      "¿Qué tal?",
      "Aquí estoy.",
      "¿Mande?",
      "Te escucho.",
    ],
    morning: ["¡Buenos días!"],
    evening: ["Buenas tardes."],
    lateNight: ["¿Aún despierto?"],
  },
  fr: {
    any: ["Oui ?", "Hein ?", "Je t'écoute.", "Quoi ?", "Dis-moi.", "Présent."],
    morning: ["Bonjour !"],
    evening: ["Bonsoir."],
    lateNight: ["Encore debout ?"],
  },
  de: {
    any: ["Ja?", "Hm?", "Was gibt's?", "Ich höre.", "Sag mal.", "Bin da."],
    morning: ["Guten Morgen!"],
    evening: ["Guten Abend."],
    lateNight: ["Noch wach?"],
  },
  zh: {
    any: ["嗯?", "什么事?", "我在。", "说吧。", "怎么了?", "嗯哼?"],
    morning: ["早上好。"],
    evening: ["晚上好。"],
    lateNight: ["还醒着?"],
  },
  pt: {
    any: ["Sim?", "Oi?", "Pode falar.", "Diga.", "Tô aqui.", "E aí?"],
    morning: ["Bom dia!"],
    evening: ["Boa noite."],
    lateNight: ["Ainda acordado?"],
  },
  ko: {
    any: ["네?", "응?", "왜요?", "말해 봐요.", "듣고 있어요.", "뭐예요?"],
    morning: ["좋은 아침."],
    evening: ["좋은 저녁."],
    lateNight: ["아직 안 자요?"],
  },
  it: {
    any: ["Sì?", "Eh?", "Dimmi.", "Che c'è?", "Sono qui.", "Ti ascolto."],
    morning: ["Buongiorno!"],
    evening: ["Buonasera."],
    lateNight: ["Ancora sveglio?"],
  },
};

function timeBand(hour: number): TimeBand {
  if (hour >= 5 && hour <= 10) return "morning";
  if (hour >= 11 && hour <= 16) return "daytime";
  if (hour >= 17 && hour <= 21) return "evening";
  return "lateNight";
}

export function getWakeAcks(lang: Language, hour?: number): string[] {
  const pool = WAKE_ACKS[resolveLanguage(lang)];
  const h = hour ?? new Date().getHours();
  const band = timeBand(h);
  const extras = band === "daytime" ? [] : (pool[band] ?? []);
  return [...pool.any, ...extras];
}

export function resolveLanguage(lang: Language): Exclude<Language, "auto"> {
  if (lang !== "auto") return lang;
  const nav =
    typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "ja";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("ko")) return "ko";
  if (nav.startsWith("it")) return "it";
  return "en";
}

type Path<T, P extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: P extends ""
        ? Path<T[K], K>
        : Path<T[K], `${P}.${K}`>;
    }[keyof T & string]
  : P;

export type MessageKey = Path<Messages>;

function lookup(obj: unknown, key: string): string {
  const parts = key.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (
      cur &&
      typeof cur === "object" &&
      p in (cur as Record<string, unknown>)
    ) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof cur === "string" ? cur : key;
}

export function t(
  lang: Language,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const resolved = resolveLanguage(lang);
  let s = lookup(CATALOGS[resolved], key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
