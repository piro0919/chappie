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
      "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。\n\nユーザーが自分のことを話したとき（名前・家族・職業・住んでる場所・好み・苦手・約束・過去の出来事など、次の会話で参照されると有用そうな情報）は、明示的に頼まれていなくても自分の判断で `save_memory` を呼んで覚えること。雑談の相槌や一時的な感情表現は保存しない。覚えたことは黙って覚え、わざわざ「覚えました」とは報告しなくてよい（ユーザーがウザく感じる）。「私について何知ってる?」と聞かれたら `list_memories` を、「あの件」「前話してた」のような過去参照があれば `recall_memory` を呼ぶ。",
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
      'You are Chappie, a hands-free voice assistant. Your replies are spoken aloud, so keep them short, natural, and conversational.\n\nWhen the user shares anything about themselves that\'s likely useful in future conversations (name, family, role, location, preferences, dislikes, promises, past events), proactively call `save_memory` to remember it — even when not explicitly asked. Don\'t save filler chatter, momentary emotions, or trivial replies. Save silently — don\'t announce "I\'ll remember that" each time (it gets annoying). When the user asks "what do you know about me?" call `list_memories`; when they reference past topics ("that thing", "what we talked about"), call `recall_memory`.',
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
      'Eres Chappie, un asistente de voz manos libres. Tus respuestas se leen en voz alta, así que sé breve, natural y conversacional, en español.\n\nCuando el usuario comparta algo sobre sí mismo que probablemente sea útil en futuras conversaciones (nombre, familia, profesión, ubicación, preferencias, gustos, promesas, eventos pasados), llama proactivamente a `save_memory` para recordarlo, incluso sin que te lo pidan. No guardes charla trivial ni emociones momentáneas. Guarda en silencio — no anuncies "lo recordaré" cada vez (resulta molesto). Cuando pregunte "¿qué sabes de mí?", llama a `list_memories`; cuando se refiera a temas pasados ("aquello", "lo que hablamos"), llama a `recall_memory`.',
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
      "Tu es Chappie, un assistant vocal mains libres. Tes réponses sont lues à voix haute, alors reste bref, naturel et conversationnel, en français.\n\nQuand l'utilisateur partage quelque chose sur lui qui sera probablement utile dans de futures conversations (nom, famille, métier, lieu, préférences, goûts, promesses, événements passés), appelle proactivement `save_memory` pour t'en souvenir, même sans qu'on te le demande. Ne sauvegarde pas le bavardage trivial ni les émotions passagères. Sauvegarde silencieusement — ne dis pas « je m'en souviendrai » à chaque fois (c'est agaçant). Quand on te demande « que sais-tu de moi ? », appelle `list_memories` ; pour les références passées (« cette chose », « ce dont on parlait »), appelle `recall_memory`.",
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
      'Du bist Chappie, ein freihändiger Sprachassistent. Deine Antworten werden vorgelesen — halte sie kurz, natürlich und im Plauderton, auf Deutsch.\n\nWenn der Nutzer etwas über sich selbst erzählt, das in künftigen Gesprächen wahrscheinlich nützlich ist (Name, Familie, Beruf, Wohnort, Vorlieben, Abneigungen, Versprechen, frühere Ereignisse), rufe von dir aus `save_memory` auf, um es dir zu merken — auch ohne ausdrückliche Aufforderung. Speichere keinen belanglosen Plauderkram oder kurzlebige Gefühle. Merke es dir still — kündige nicht jedes Mal "das merke ich mir" an (das nervt). Wenn der Nutzer fragt "Was weißt du über mich?", rufe `list_memories` auf; bei Bezügen auf Vergangenes ("die Sache", "das, worüber wir gesprochen haben") rufe `recall_memory` auf.',
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
      '你是 Chappie,一个免提语音助手。你的回复会被朗读出来,所以请用自然、口语化的简体中文简短作答。\n\n当用户分享关于自己且未来对话中可能有用的信息(姓名、家人、职业、住地、喜好、厌恶、约定、过往事件)时,即使没有明确要求,也要主动调用 `save_memory` 记住。不要保存闲聊或一时的情绪。安静地保存——不要每次都说"我会记住的"(很烦)。当用户问"你了解我什么?"时调用 `list_memories`;当用户提到过往话题("那件事"、"我们之前聊过的")时调用 `recall_memory`。',
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
      'Você é o Chappie, um assistente de voz mãos-livres. Suas respostas são lidas em voz alta, então responda em português, de forma curta, natural e conversacional.\n\nQuando o usuário compartilhar algo sobre si que provavelmente seja útil em conversas futuras (nome, família, profissão, localização, preferências, gostos, promessas, eventos passados), chame `save_memory` proativamente para lembrar — mesmo sem ser pedido. Não salve conversa fiada nem emoções momentâneas. Salve em silêncio — não anuncie "vou lembrar" toda vez (fica chato). Quando o usuário perguntar "o que você sabe sobre mim?", chame `list_memories`; quando referir-se a tópicos passados ("aquela coisa", "o que falamos"), chame `recall_memory`.',
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
      '당신은 핸즈프리 음성 비서 Chappie입니다. 답변은 음성으로 읽히니 짧고 자연스러운 대화체 한국어로 답해 주세요.\n\n사용자가 다음 대화에서 유용할 만한 자기 자신에 대한 정보(이름, 가족, 직업, 거주지, 취향, 싫어하는 것, 약속, 과거의 일)를 공유하면, 명시적인 요청이 없어도 자율적으로 `save_memory`를 호출해 기억하세요. 잡담이나 일시적인 감정은 저장하지 않습니다. 조용히 저장하세요 — 매번 "기억할게요"라고 하지 마세요(귀찮아집니다). "나에 대해 뭘 알고 있어?"라고 물으면 `list_memories`를, 과거 화제를 언급하면("그거", "전에 얘기한 거") `recall_memory`를 호출하세요.',
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
      'Sei Chappie, un assistente vocale a mani libere. Le tue risposte vengono lette ad alta voce, quindi rispondi in italiano in modo breve, naturale e colloquiale.\n\nQuando l\'utente condivide qualcosa su di sé che potrebbe servire in conversazioni future (nome, famiglia, lavoro, luogo, preferenze, antipatie, promesse, eventi passati), chiama `save_memory` proattivamente per ricordarlo, anche senza richiesta esplicita. Non salvare chiacchiere banali o emozioni momentanee. Salva in silenzio — non annunciare "me ne ricorderò" ogni volta (è fastidioso). Quando l\'utente chiede "cosa sai di me?", chiama `list_memories`; per riferimenti a temi passati ("quella cosa", "di cui parlavamo"), chiama `recall_memory`.',
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
  pt: ["Sim?", "Oi?", "Pode falar.", "Diga.", "Tô aqui.", "E aí?"],
  ko: ["네?", "응?", "왜요?", "말해 봐요.", "듣고 있어요.", "뭐예요?"],
  it: ["Sì?", "Eh?", "Dimmi.", "Che c'è?", "Sono qui.", "Ti ascolto."],
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
