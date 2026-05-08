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
    apiKey: string;
    apiKeyPlaceholder: string;
    apiKeyNote: string;
    voice: string;
    voiceSystemDefault: string;
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
    apiKey: "API キー",
    apiKeyPlaceholder: "sk-... / xai-... / sk-or-... / sk-ant-... / AIza...",
    apiKeyNote: "OpenAI / xAI / OpenRouter / Anthropic / Gemini に対応。",
    voice: "読み上げ音声",
    voiceSystemDefault: "（システム既定）",
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
      "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。",
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
    apiKey: "API Key",
    apiKeyPlaceholder: "sk-... / xai-... / sk-or-... / sk-ant-... / AIza...",
    apiKeyNote: "Supports OpenAI / xAI / OpenRouter / Anthropic / Gemini.",
    voice: "Voice",
    voiceSystemDefault: "(System default)",
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
      "You are Chappie, a hands-free voice assistant. Your replies are spoken aloud, so keep them short, natural, and conversational.",
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
    apiKey: "Clave de API",
    apiKeyPlaceholder: "sk-... / xai-... / sk-or-... / sk-ant-... / AIza...",
    apiKeyNote:
      "Compatible con OpenAI / xAI / OpenRouter / Anthropic / Gemini.",
    voice: "Voz",
    voiceSystemDefault: "(Predeterminada del sistema)",
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
      "Eres Chappie, un asistente de voz manos libres. Tus respuestas se leen en voz alta, así que sé breve, natural y conversacional, en español.",
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
    apiKey: "Clé d'API",
    apiKeyPlaceholder: "sk-... / xai-... / sk-or-... / sk-ant-... / AIza...",
    apiKeyNote: "Compatible OpenAI / xAI / OpenRouter / Anthropic / Gemini.",
    voice: "Voix",
    voiceSystemDefault: "(Par défaut du système)",
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
      "Tu es Chappie, un assistant vocal mains libres. Tes réponses sont lues à voix haute, alors reste bref, naturel et conversationnel, en français.",
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
    apiKey: "API-Schlüssel",
    apiKeyPlaceholder: "sk-... / xai-... / sk-or-... / sk-ant-... / AIza...",
    apiKeyNote: "Unterstützt OpenAI / xAI / OpenRouter / Anthropic / Gemini.",
    voice: "Stimme",
    voiceSystemDefault: "(Systemstandard)",
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
      "Du bist Chappie, ein freihändiger Sprachassistent. Deine Antworten werden vorgelesen — halte sie kurz, natürlich und im Plauderton, auf Deutsch.",
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
    apiKey: "API 密钥",
    apiKeyPlaceholder: "sk-... / xai-... / sk-or-... / sk-ant-... / AIza...",
    apiKeyNote: "支持 OpenAI / xAI / OpenRouter / Anthropic / Gemini。",
    voice: "语音",
    voiceSystemDefault: "(系统默认)",
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
      "你是 Chappie,一个免提语音助手。你的回复会被朗读出来,所以请用自然、口语化的简体中文简短作答。",
    formatTts:
      "数字请写成朗读时自然的形式。避免不便朗读的符号——时间用「下午两点半」而不是「14:30」,日期用「五月八日」而不是「5/8」。",
    formatHud:
      "本次回复会以文字形式显示在屏幕上,而不是朗读。请使用常规的数字和符号写法(例如 17.3°、39%、14:30、5/8),不要使用为朗读设计的写法。",
  },
};

const CATALOGS: Record<Exclude<Language, "auto">, Messages> = {
  ja,
  en,
  es,
  fr,
  de,
  zh,
};

const WAKE_ACKS: Record<Exclude<Language, "auto">, string[]> = {
  ja: [
    "はい",
    "はーい",
    "はい、なに？",
    "なーに？",
    "どうしたの？",
    "呼んだ？",
    "なになに？",
  ],
  en: ["Yes?", "Yeah?", "What's up?", "Hmm?", "Mhm?", "Go ahead.", "I'm here."],
  es: ["¿Sí?", "¿Diga?", "¿Qué tal?", "Aquí estoy.", "¿Mande?", "Te escucho."],
  fr: ["Oui ?", "Hein ?", "Je t'écoute.", "Quoi ?", "Dis-moi.", "Présent."],
  de: ["Ja?", "Hm?", "Was gibt's?", "Ich höre.", "Sag mal.", "Bin da."],
  zh: ["嗯?", "什么事?", "我在。", "说吧。", "怎么了?", "嗯哼?"],
};

export function getWakeAcks(lang: Language): string[] {
  return WAKE_ACKS[resolveLanguage(lang)];
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
