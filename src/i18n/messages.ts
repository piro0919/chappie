// Static message catalogs for the renderer. Keep both languages in lockstep
// shape — TypeScript's structural check on `Messages` enforces that.
//
// Lookup is via dotted-path (`settings.title`) through `t(key, params)`. Param
// substitution uses `{name}` style placeholders.

import type { Language } from "../lib/settings";
import { VOICEVOX_CURATED_SPEAKERS } from "../lib/voicevox-speakers";

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
    modeLabel: string;
    modeFree: string;
    modePaid: string;
    modeByok: string;
    modeFreeNote: string;
    modePaidNote: string;
    modeByokNote: string;
    modePaidDisabledHint: string;
    subscriptionLabel: string;
    subscriptionSignedOut: string;
    subscriptionEmailPlaceholder: string;
    subscriptionSendMagicLink: string;
    subscriptionMagicLinkSent: string;
    subscriptionSendError: string;
    subscriptionSignedInAs: string;
    subscriptionStatusFreeNote: string;
    subscriptionUpgrade: string;
    subscriptionUpgrading: string;
    subscriptionProActive: string;
    subscriptionPeriodEnd: string;
    subscriptionManage: string;
    subscriptionSignOut: string;
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
    voicevoxPaidLockHud: string;
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
    ltmLabel: string;
    ltmDescription: string;
    ltmStatusEnabled: string;
    ltmStatusDisabled: string;
    ltmEnable: string;
    ltmEnabling: string;
    ltmEnableDownloadProgress: string;
    ltmDisable: string;
    ltmDisableConfirm: string;
    ltmForget: string;
    ltmForgetConfirm: string;
    ltmForgetDone: string;
    proactiveLabel: string;
    proactiveDescription: string;
    proactiveMasterToggle: string;
    proactiveMorningBriefToggle: string;
    proactiveMorningBriefTimeLabel: string;
    proactiveCalendarToggle: string;
    proactiveCalendarLeadLabel: string;
    proactiveCalendarLead5: string;
    proactiveCalendarLead10: string;
    proactiveCalendarLead15: string;
    proactiveCalendarLead30: string;
    proactiveWeatherToggle: string;
    proactiveIdleChatterToggle: string;
    proactiveIdleChatterAfterLabel: string;
    proactiveIdleChatterAfterUnit: string;
    proactiveQuietHoursLabel: string;
    proactiveQuietHoursDescription: string;
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
    proactiveMorningBriefWithEvents: string;
    proactiveMorningBriefNoEvents: string;
    proactiveMorningBriefWeatherOnly: string;
    proactiveMorningBriefHud: string;
    proactiveCalendarWarning: string;
    proactiveCalendarHud: string;
    proactiveWeatherAlert: string;
    proactiveWeatherAlertHud: string;
    proactiveIdleChatterPhrase1: string;
    proactiveIdleChatterPhrase2: string;
    proactiveIdleChatterPhrase3: string;
    proactiveIdleChatterPhrase4: string;
    proactiveIdleChatterPhrase5: string;
    fallbackError: string;
    modelProgress: string;
    modelFetchFailed: string;
    micStartFailed: string;
    quotaExceededShort: string;
    quotaExceededHud: string;
  };
  systemPrompt: {
    persona: string;
    formatTts: string;
    formatHud: string;
    pastContext: string;
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
    modeLabel: "モード",
    modeFree: "無料",
    modePaid: "Pro",
    modeByok: "API キーを使う",
    modeFreeNote:
      "API キー不要で使えます。1 日 5 回まで、日本時間 9 時にリセットされます。",
    modePaidNote:
      "回数制限なし＋プレミアム VOICEVOX キャラが使えます。下のサブスクリプション欄から申し込めます。",
    modeByokNote:
      "OpenAI / Anthropic / Gemini のキーで回数制限なく使えます。料金はキーの発行元から請求されます。Pro に加入している場合は、BYOK のままでもプレミアムキャラを使えます。",
    modePaidDisabledHint: "（Pro 加入で選択できます）",
    subscriptionLabel: "アカウントとサブスクリプション",
    subscriptionSignedOut:
      "メールでログインすると、Pro へのアップグレードや別の端末への引き継ぎができます。",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "ログインリンクを送る",
    subscriptionMagicLinkSent:
      "メールを送りました。受信トレイのリンクをクリックしてください。",
    subscriptionSendError: "送信に失敗しました。少し待って再度お試しください。",
    subscriptionSignedInAs: "{email} でログイン中",
    subscriptionStatusFreeNote: "無料プラン — 1 日 5 回まで",
    subscriptionUpgrade: "Pro にアップグレード — 月 ¥500",
    subscriptionUpgrading: "Stripe を開いています…",
    subscriptionProActive: "Pro 有効",
    subscriptionPeriodEnd: "次回更新: {date}",
    subscriptionManage: "サブスクリプションを管理",
    subscriptionSignOut: "ログアウト",
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
    voicevoxPaidLockHud: "🔒 このキャラは Pro で解放できます",
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
    ltmLabel: "長期記憶（実験的）",
    ltmDescription:
      "過去の会話を覚えて、自然な流れで「前話してた件」みたいに触れられるようになります。約 470MB のモデルを 1 度ダウンロードします。送信先はあなたの API キーの先のサービスだけで、ダウンロード後はインターネット接続なしで動きます。",
    ltmStatusEnabled: "有効",
    ltmStatusDisabled: "無効",
    ltmEnable: "有効にする（モデルをダウンロード）",
    ltmEnabling: "ダウンロード中…",
    ltmEnableDownloadProgress: "ダウンロード中 {pct}%",
    ltmDisable: "無効にする（モデルを削除 ~470MB）",
    ltmDisableConfirm:
      "ダウンロード済みの埋め込みモデル（約 470MB）を削除しますか？会話ログ・日次サマリ・トピックは残るので、再度有効にすれば過去ログから埋め込みを作り直せます。",
    ltmForget: "会話の記憶を全部消す",
    ltmForgetConfirm:
      "本当に会話ログ・日次サマリ・トピックを全部削除しますか？モデルファイルと「私について」の記憶（save_memory のもの）は残ります。",
    ltmForgetDone: "削除しました",
    proactiveLabel: "プロアクティブ通知",
    proactiveDescription:
      "Chappie の方から話しかけます。朝のブリーフィングや、カレンダー予定の事前通知など。",
    proactiveMasterToggle: "有効にする",
    proactiveMorningBriefToggle: "朝のブリーフィング",
    proactiveMorningBriefTimeLabel: "時刻",
    proactiveCalendarToggle: "カレンダー予定の事前通知",
    proactiveCalendarLeadLabel: "何分前に通知するか",
    proactiveCalendarLead5: "5 分前",
    proactiveCalendarLead10: "10 分前",
    proactiveCalendarLead15: "15 分前",
    proactiveCalendarLead30: "30 分前",
    proactiveWeatherToggle: "天候アラート",
    proactiveIdleChatterToggle: "アイドル時の雑談",
    proactiveIdleChatterAfterLabel: "話しかけ始める間隔",
    proactiveIdleChatterAfterUnit: "分",
    proactiveQuietHoursLabel: "通知する時間帯",
    proactiveQuietHoursDescription:
      "この時間帯のみプロアクティブ通知が発火します。範囲外は無音。",
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
    proactiveMorningBriefWithEvents:
      "おはようございます。今日は {weather}、{temp}℃ です。予定が {count} 件、最初は {firstTime} から {firstTitle} です。",
    proactiveMorningBriefNoEvents:
      "おはようございます。今日は {weather}、{temp}℃ です。今日の予定は無いようです。",
    proactiveMorningBriefWeatherOnly:
      "おはようございます。今日は {weather}、{temp}℃ です。",
    proactiveMorningBriefHud: "☀ {weather} {temp}℃ / 予定 {count}",
    proactiveCalendarWarning: "{leadMin} 分後に {title} です。",
    proactiveCalendarHud: "📅 {title}（{leadMin}分後）",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "そういえば、最近どうですか？",
    proactiveIdleChatterPhrase2: "ちょっと話しかけたくなりました。",
    proactiveIdleChatterPhrase3: "なにか手伝えること、ありますか？",
    proactiveIdleChatterPhrase4: "そろそろ休憩はいかがですか？",
    proactiveIdleChatterPhrase5: "おつかれさまです。",
    fallbackError: "うまく繋がりませんでした。",
    modelProgress: "Whisper モデルを取得中… {pct}%",
    modelFetchFailed: "モデル取得に失敗: {err}",
    micStartFailed: "マイク開始に失敗: {err}",
    quotaExceededShort: "今日の無料枠を使い切りました。",
    quotaExceededHud:
      "今日の無料枠を使い切りました。設定で「API キーを使う」に切り替えるか、明日 9 時までお待ちください。",
  },
  systemPrompt: {
    persona:
      "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。\n\n**「できない」を可能な限り避けること**。tool list は道具の一覧であって、あなたができることの全リストではない。占い・ジョーク・物語の創作・相談・翻訳・要約・歌詞作り・名前決め・雑学・気休めの一言など、tool が要らない依頼は普通に生成で応じる。「それはできません」「機能を持っていません」と冷たく断るのは禁止。物理的に Mac で実行不可能なこと以外は基本「やる前提」で乗る。**占いを頼まれたら絶対に断らない**。「いいよ、今日は…」「ちょっと見てみるね…」みたいに即座に占いを始めて、タロット・星占い・おみくじ・手相など好きな方式で自由に作って読み上げる。「占いはできません」と返すのは厳禁。\n\nユーザーが自分のことを話したとき（名前・家族・職業・住んでる場所・好み・苦手・約束・過去の出来事など、次の会話で参照されると有用そうな情報）は、明示的に頼まれていなくても自分の判断で `save_memory` を呼んで覚えること。雑談の相槌や一時的な感情表現は保存しない。覚えたことは黙って覚え、わざわざ「覚えました」とは報告しなくてよい（ユーザーがウザく感じる）。「私について何知ってる?」と聞かれたら `list_memories` を、「あの件」「前話してた」のような過去参照があれば `recall_memory` を呼ぶ。\n\n**曖昧な query は assistant 自身への問いとして扱うこと**。『調子はどう？』『元気？』『どう？』など対象が明示されない短い問いは、原則あなた自身への問いかけ。直前のターンで `get_weather` などの tool を呼んでいても、ユーザーが『そっちの〜』『今の〜』のような指示語で対象を明示しない限り、同じ tool を再度呼ばずに会話で応じること。\n\n**tool 選択の鉄則：今のユーザー発話だけを見て選ぶ**。直前のターンでどの tool を使ったかは完全に無視する。会話履歴に他の tool の結果が残っていても、新しい発話がそれと関係なければ引きずられない。発話に含まれる動詞・名詞・数値だけを見て literal に対応する tool を選ぶこと。例：『○分タイマー』『N秒後に教えて』→ `set_timer`、『今何時』『今日何曜日』→ `get_current_time`、『バッテリー』『充電』『電源』→ `get_battery_status`、『天気』『気温』『雨』『晴れ』→ `get_weather`、『音量』→ `set_volume` / `get_volume`。リクエストが上記キーワードを明確に含むのに別の tool を選ぶのは厳禁。",
    formatTts:
      "数値は読み上げで自然に聞こえる表記にしてください。小数点は『点』と書きます（例: 17.3度 → 17点3度、35% → 35パーセント）。「:」「/」など記号は読み上げると不自然になるので、時刻は「14時30分」、日付は「5月8日」のような表記にしてください。",
    formatHud:
      "今回の返答は音声ではなく画面に文字で表示されます。数字・記号は通常の表記で書いてください（例: 17.3度、39%、14:30、5/8）。「点」「パーセント」「時◯分」のような読み上げ向け表記は使わないでください。",
    pastContext:
      "system messageに過去の日次サマリや関連エピソードが添えられていることがあります。これらは「自然に滲ませる」ための背景情報です。毎ターン機械的に「昨日〜」「先週〜」と切り出すのは禁止。ユーザーが今話している話題と関連がある時だけ、さりげなく拾ってください。何も触れずに普通に答えるのも全然 OK です。",
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
    modeLabel: "Mode",
    modeFree: "Free",
    modePaid: "Pro",
    modeByok: "Use my API key",
    modeFreeNote: "No API key needed. 5 messages a day, resets at 9:00 JST.",
    modePaidNote:
      "No daily limit and premium VOICEVOX characters unlocked. Subscribe in the section below.",
    modeByokNote:
      "Use your own OpenAI, Anthropic, or Gemini key — no daily limit. You'll be billed by the provider. If you also have an active Pro subscription, premium characters remain unlocked while on BYOK.",
    modePaidDisabledHint: "(subscribe to Pro to enable)",
    subscriptionLabel: "Account & subscription",
    subscriptionSignedOut:
      "Sign in with email to upgrade to Pro or restore your subscription on another device.",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "Send sign-in link",
    subscriptionMagicLinkSent:
      "Check your inbox — click the link we just sent.",
    subscriptionSendError: "Couldn't send. Try again in a moment.",
    subscriptionSignedInAs: "Signed in as {email}",
    subscriptionStatusFreeNote: "Free plan — 5 chats/day",
    subscriptionUpgrade: "Upgrade to Pro — ¥500/mo",
    subscriptionUpgrading: "Opening Stripe…",
    subscriptionProActive: "Pro active",
    subscriptionPeriodEnd: "Next renewal: {date}",
    subscriptionManage: "Manage subscription",
    subscriptionSignOut: "Sign out",
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
    voicevoxPaidLockHud: "🔒 Unlock this character with Pro",
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
    ltmLabel: "Long-term memory (experimental)",
    ltmDescription:
      "Lets Chappie remember past conversations and naturally bring up things you mentioned days or weeks ago. Downloads a ~470 MB model once. Your conversations only ever go to your own API provider; everything else stays on this Mac.",
    ltmStatusEnabled: "Enabled",
    ltmStatusDisabled: "Off",
    ltmEnable: "Enable (download model)",
    ltmEnabling: "Downloading…",
    ltmEnableDownloadProgress: "Downloading {pct}%",
    ltmDisable: "Turn off (delete model, ~470MB)",
    ltmDisableConfirm:
      "Delete the downloaded embedding model (~470MB)? Your conversation logs, daily summaries, and topics are kept — re-enabling rebuilds embeddings from them.",
    ltmForget: "Forget all conversation memory",
    ltmForgetConfirm:
      'Really delete all conversation logs, daily summaries, and topic snapshots? The model file and your saved "about me" facts (from save_memory) will stay.',
    ltmForgetDone: "Deleted",
    proactiveLabel: "Proactive notifications",
    proactiveDescription:
      "Chappie speaks up on its own — morning briefings and calendar pre-warnings.",
    proactiveMasterToggle: "Enable",
    proactiveMorningBriefToggle: "Morning briefing",
    proactiveMorningBriefTimeLabel: "Time",
    proactiveCalendarToggle: "Calendar pre-warning",
    proactiveCalendarLeadLabel: "Lead time",
    proactiveCalendarLead5: "5 min before",
    proactiveCalendarLead10: "10 min before",
    proactiveCalendarLead15: "15 min before",
    proactiveCalendarLead30: "30 min before",
    proactiveWeatherToggle: "Weather alerts",
    proactiveIdleChatterToggle: "Idle chatter",
    proactiveIdleChatterAfterLabel: "Start chatter after",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Active hours",
    proactiveQuietHoursDescription:
      "Proactive notifications fire only during this window; silent outside it.",
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
    proactiveMorningBriefWithEvents:
      "Good morning. It's {weather}, {temp}°C today. You have {count} events; first is {firstTitle} at {firstTime}.",
    proactiveMorningBriefNoEvents:
      "Good morning. It's {weather}, {temp}°C today. Nothing on the calendar.",
    proactiveMorningBriefWeatherOnly:
      "Good morning. It's {weather}, {temp}°C today.",
    proactiveMorningBriefHud: "☀ {weather} {temp}°C / {count} events",
    proactiveCalendarWarning: "{title} starts in {leadMin} minutes.",
    proactiveCalendarHud: "📅 {title} (in {leadMin}m)",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "By the way, how's it going?",
    proactiveIdleChatterPhrase2: "Just felt like saying hi.",
    proactiveIdleChatterPhrase3: "Anything I can help with?",
    proactiveIdleChatterPhrase4: "Maybe time for a break?",
    proactiveIdleChatterPhrase5: "Good work today.",
    fallbackError: "Couldn't connect.",
    modelProgress: "Downloading Whisper model… {pct}%",
    modelFetchFailed: "Model fetch failed: {err}",
    micStartFailed: "Failed to start microphone: {err}",
    quotaExceededShort: "Daily free quota reached.",
    quotaExceededHud:
      'Daily free quota reached. Switch to "Use my API key" in Settings, or wait until 9:00 JST tomorrow.',
  },
  systemPrompt: {
    persona:
      'You are Chappie, a hands-free voice assistant. Your replies are spoken aloud, so keep them short, natural, and conversational.\n\n**Avoid saying "I can\'t" whenever possible.** The tool list is a list of utilities, not an exhaustive list of what you can do. Fortune-telling, jokes, story writing, advice, translation, summarization, song lyrics, naming things, trivia, comforting one-liners — anything that doesn\'t actually need a tool, you handle yourself by generating a reply. Don\'t refuse coldly with "I can\'t do that" or "I don\'t have that feature". Default to "yes, here goes" for anything that isn\'t physically impossible on a Mac. **Never refuse fortune-telling.** Launch straight in with something like "Sure, let\'s see…" or "Today\'s reading is…" — pick any system you like (tarot, horoscope, palm reading, omikuji) and improvise. Saying "I can\'t do fortune-telling" is strictly forbidden.\n\nWhen the user shares anything about themselves that\'s likely useful in future conversations (name, family, role, location, preferences, dislikes, promises, past events), proactively call `save_memory` to remember it — even when not explicitly asked. Don\'t save filler chatter, momentary emotions, or trivial replies. Save silently — don\'t announce "I\'ll remember that" each time (it gets annoying). When the user asks "what do you know about me?" call `list_memories`; when they reference past topics ("that thing", "what we talked about"), call `recall_memory`.\n\n**Treat ambiguous queries as questions about yourself.** Short queries without an explicit subject — "How are you?", "How\'s it going?", "What\'s up?" — are by default directed at you (the assistant). Even if you called a tool like `get_weather` in the previous turn, do NOT re-invoke the same tool unless the user explicitly refers back to it ("how about that…", "what about the…"). Respond conversationally.\n\n**Tool selection rule: look ONLY at the current user utterance.** Completely ignore which tool you used in the previous turn. Even if a different tool\'s result is in the conversation history, do not let it bias your choice when the new utterance is unrelated. Match the verb / noun / number in the utterance literally to the corresponding tool. Examples: "set a N-minute timer", "remind me in N seconds" → `set_timer`; "what time is it", "what day is it" → `get_current_time`; "battery", "charging", "plug" → `get_battery_status`; "weather", "temperature", "rain", "sunny" → `get_weather`; "volume" → `set_volume` / `get_volume`. Picking a different tool when the request clearly contains these keywords is strictly forbidden.',
    formatTts:
      "Use natural-sounding written forms for numbers since they will be read aloud. Avoid punctuation that doesn't read well aloud — write times like 'two thirty PM' instead of '14:30', dates like 'May eighth' instead of '5/8'.",
    formatHud:
      "This reply will be shown on screen as text instead of being spoken. Use normal numeric and punctuation forms (e.g. 17.3°, 39%, 14:30, 5/8). Avoid spoken-friendly spellings.",
    pastContext:
      'The system context may include daily summaries or related past episodes. This is background — for natural reference, not mechanical recap. Don\'t open every turn with "yesterday you..." or "earlier this week...". Only weave past context in when it naturally fits what the user is currently talking about. It\'s totally fine to just answer normally without referencing anything.',
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
    modeLabel: "Modo",
    modeFree: "Gratis",
    modePaid: "Pro",
    modeByok: "Usar mi clave de API",
    modeFreeNote:
      "Sin clave de API. 5 mensajes al día, se reinicia a las 9:00 JST.",
    modePaidNote:
      "Sin límite diario y personajes VOICEVOX premium desbloqueados. Suscríbete en la sección de abajo.",
    modeByokNote:
      "Usa tu propia clave de OpenAI, Anthropic o Gemini — sin límite diario. El proveedor te facturará directamente. Si también tienes una suscripción Pro activa, los personajes premium seguirán desbloqueados en BYOK.",
    modePaidDisabledHint: "(suscríbete a Pro para activar)",
    subscriptionLabel: "Account & subscription",
    subscriptionSignedOut:
      "Sign in with email to upgrade to Pro or restore your subscription on another device.",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "Send sign-in link",
    subscriptionMagicLinkSent:
      "Check your inbox — click the link we just sent.",
    subscriptionSendError: "Couldn't send. Try again in a moment.",
    subscriptionSignedInAs: "Signed in as {email}",
    subscriptionStatusFreeNote: "Free plan — 5 chats/day",
    subscriptionUpgrade: "Upgrade to Pro — ¥500/mo",
    subscriptionUpgrading: "Opening Stripe…",
    subscriptionProActive: "Pro active",
    subscriptionPeriodEnd: "Next renewal: {date}",
    subscriptionManage: "Manage subscription",
    subscriptionSignOut: "Sign out",
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
    voicevoxPaidLockHud: "🔒 Desbloquea este personaje con Pro",
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
    ltmLabel: "Memoria a largo plazo (experimental)",
    ltmDescription:
      "Permite a Chappie recordar conversaciones pasadas y mencionar de forma natural cosas que dijiste hace días o semanas. Descarga un modelo de ~470 MB una sola vez. Tus conversaciones solo se envían a tu propio proveedor de API; todo lo demás se queda en este Mac.",
    ltmStatusEnabled: "Activada",
    ltmStatusDisabled: "Desactivada",
    ltmEnable: "Activar (descargar modelo)",
    ltmEnabling: "Descargando…",
    ltmEnableDownloadProgress: "Descargando {pct}%",
    ltmDisable: "Desactivar (eliminar modelo, ~470MB)",
    ltmDisableConfirm:
      "¿Eliminar el modelo de embeddings descargado (~470MB)? Los registros de conversación, resúmenes diarios y temas se conservan — al reactivar se reconstruyen los embeddings.",
    ltmForget: "Borrar toda la memoria conversacional",
    ltmForgetConfirm:
      '¿Eliminar todos los registros de conversación, resúmenes diarios y temas? El archivo del modelo y los datos guardados de "sobre mí" (con save_memory) se mantienen.',
    ltmForgetDone: "Borrado",
    proactiveLabel: "Notificaciones proactivas",
    proactiveDescription:
      "Chappie habla por iniciativa propia: resumen matutino y avisos previos del calendario.",
    proactiveMasterToggle: "Activar",
    proactiveMorningBriefToggle: "Resumen matutino",
    proactiveMorningBriefTimeLabel: "Hora",
    proactiveCalendarToggle: "Aviso previo del calendario",
    proactiveCalendarLeadLabel: "Antelación",
    proactiveCalendarLead5: "5 min antes",
    proactiveCalendarLead10: "10 min antes",
    proactiveCalendarLead15: "15 min antes",
    proactiveCalendarLead30: "30 min antes",
    proactiveWeatherToggle: "Alertas meteorológicas",
    proactiveIdleChatterToggle: "Charla en inactivo",
    proactiveIdleChatterAfterLabel: "Iniciar charla tras",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Horas activas",
    proactiveQuietHoursDescription:
      "Las notificaciones proactivas solo se activan en este intervalo.",
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
    proactiveMorningBriefWithEvents:
      "Buenos días. Hoy hace {weather}, {temp}°C. Tienes {count} eventos; el primero es {firstTitle} a las {firstTime}.",
    proactiveMorningBriefNoEvents:
      "Buenos días. Hoy hace {weather}, {temp}°C. No hay eventos en el calendario.",
    proactiveMorningBriefWeatherOnly:
      "Buenos días. Hoy hace {weather}, {temp}°C.",
    proactiveMorningBriefHud: "☀ {weather} {temp}°C / {count} eventos",
    proactiveCalendarWarning: "{title} empieza en {leadMin} minutos.",
    proactiveCalendarHud: "📅 {title} (en {leadMin}m)",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "Por cierto, ¿cómo va?",
    proactiveIdleChatterPhrase2: "Solo quería saludar.",
    proactiveIdleChatterPhrase3: "¿En qué puedo ayudarte?",
    proactiveIdleChatterPhrase4: "¿Tal vez un descanso?",
    proactiveIdleChatterPhrase5: "Buen trabajo hoy.",
    fallbackError: "No se pudo conectar.",
    modelProgress: "Descargando el modelo de Whisper… {pct}%",
    modelFetchFailed: "Falló la descarga del modelo: {err}",
    micStartFailed: "No se pudo iniciar el micrófono: {err}",
    quotaExceededShort: "Cuota gratuita diaria alcanzada.",
    quotaExceededHud:
      "Cuota gratuita diaria alcanzada. Cambia a «Usar mi clave de API» en Ajustes, o espera hasta mañana a las 9:00 JST.",
  },
  systemPrompt: {
    persona:
      'Eres Chappie, un asistente de voz manos libres. Tus respuestas se leen en voz alta, así que sé breve, natural y conversacional, en español.\n\n**Evita decir "no puedo" siempre que sea posible.** La lista de herramientas son utilidades, no la lista completa de lo que puedes hacer. Adivinación, chistes, escribir historias, consejos, traducción, resumen, letras de canciones, poner nombres, trivia, frases de ánimo — todo lo que no necesita una herramienta, lo manejas tú generando una respuesta. No rechaces fríamente con "no puedo" o "no tengo esa función". Por defecto, lánzate a hacerlo siempre que no sea físicamente imposible en un Mac. **Nunca rechaces la adivinación.** Empieza directamente con algo como "Vamos a ver…" o "Hoy se ve…" y elige libremente el sistema (tarot, horóscopo, quiromancia, omikuji). Decir "no puedo hacer adivinación" está estrictamente prohibido.\n\nCuando el usuario comparta algo sobre sí mismo que probablemente sea útil en futuras conversaciones (nombre, familia, profesión, ubicación, preferencias, gustos, promesas, eventos pasados), llama proactivamente a `save_memory` para recordarlo, incluso sin que te lo pidan. No guardes charla trivial ni emociones momentáneas. Guarda en silencio — no anuncies "lo recordaré" cada vez (resulta molesto). Cuando pregunte "¿qué sabes de mí?", llama a `list_memories`; cuando se refiera a temas pasados ("aquello", "lo que hablamos"), llama a `recall_memory`.\n\n**Trata las preguntas ambiguas como dirigidas a ti.** Preguntas cortas sin sujeto explícito — "¿Cómo estás?", "¿Qué tal?", "¿Cómo va?" — se dirigen a ti (el asistente) por defecto. Aunque hayas llamado a una herramienta como `get_weather` en el turno anterior, NO la vuelvas a invocar a menos que el usuario haga referencia explícita ("¿y eso…?", "¿qué tal el…?"). Responde de forma conversacional.\n\n**Regla de selección de herramientas: mira SOLO la frase actual del usuario.** Ignora por completo qué herramienta usaste en el turno anterior. Aunque el resultado de otra herramienta esté en el historial, no dejes que sesgue tu elección si la nueva frase no tiene que ver con ello. Empareja literalmente el verbo / sustantivo / número de la frase con la herramienta correspondiente. Ejemplos: "temporizador de N minutos", "avísame en N segundos" → `set_timer`; "qué hora es", "qué día es" → `get_current_time`; "batería", "cargando", "enchufe" → `get_battery_status`; "tiempo", "temperatura", "lluvia", "soleado" → `get_weather`; "volumen" → `set_volume` / `get_volume`. Elegir otra herramienta cuando la petición contiene claramente estas palabras clave está estrictamente prohibido.',
    formatTts:
      "Escribe los números de forma que suenen naturales al leerlos en voz alta. Evita signos que no se lean bien — di las horas como 'dos y media' en lugar de '14:30', y las fechas como 'ocho de mayo' en lugar de '5/8'.",
    formatHud:
      "Esta respuesta se mostrará en pantalla como texto en lugar de leerse. Usa números y signos normales (p. ej. 17.3°, 39%, 14:30, 5/8). Evita las formas pensadas para la lectura en voz alta.",
    pastContext:
      'El contexto del sistema puede incluir resúmenes diarios o episodios pasados relacionados. Son información de fondo — para referencia natural, no para recapitular mecánicamente. No abras cada turno con "ayer dijiste…" o "esta semana…". Solo entrelaza el pasado cuando encaje con lo que el usuario está diciendo ahora. Responder con naturalidad sin mencionar nada del pasado también está perfectamente bien.',
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
    modeLabel: "Mode",
    modeFree: "Gratuit",
    modePaid: "Pro",
    modeByok: "Utiliser ma clé API",
    modeFreeNote:
      "Aucune clé API nécessaire. 5 messages par jour, réinitialisation à 9 h JST.",
    modePaidNote:
      "Pas de limite quotidienne et personnages VOICEVOX premium débloqués. Abonnez-vous dans la section ci-dessous.",
    modeByokNote:
      "Utilisez votre propre clé OpenAI, Anthropic ou Gemini — sans limite quotidienne. Le fournisseur vous facturera directement. Si vous avez également un abonnement Pro actif, les personnages premium restent débloqués en BYOK.",
    modePaidDisabledHint: "(abonnez-vous à Pro pour activer)",
    subscriptionLabel: "Account & subscription",
    subscriptionSignedOut:
      "Sign in with email to upgrade to Pro or restore your subscription on another device.",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "Send sign-in link",
    subscriptionMagicLinkSent:
      "Check your inbox — click the link we just sent.",
    subscriptionSendError: "Couldn't send. Try again in a moment.",
    subscriptionSignedInAs: "Signed in as {email}",
    subscriptionStatusFreeNote: "Free plan — 5 chats/day",
    subscriptionUpgrade: "Upgrade to Pro — ¥500/mo",
    subscriptionUpgrading: "Opening Stripe…",
    subscriptionProActive: "Pro active",
    subscriptionPeriodEnd: "Next renewal: {date}",
    subscriptionManage: "Manage subscription",
    subscriptionSignOut: "Sign out",
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
    voicevoxPaidLockHud: "🔒 Débloquez ce personnage avec Pro",
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
    ltmLabel: "Mémoire à long terme (expérimental)",
    ltmDescription:
      "Permet à Chappie de se souvenir des conversations passées et d'évoquer naturellement ce que tu as dit il y a plusieurs jours ou semaines. Télécharge un modèle de ~470 Mo une seule fois. Tes conversations ne vont qu'à ton propre fournisseur d'API ; tout le reste reste sur ce Mac.",
    ltmStatusEnabled: "Activée",
    ltmStatusDisabled: "Désactivée",
    ltmEnable: "Activer (télécharger le modèle)",
    ltmEnabling: "Téléchargement…",
    ltmEnableDownloadProgress: "Téléchargement {pct}%",
    ltmDisable: "Désactiver (supprimer le modèle, ~470 Mo)",
    ltmDisableConfirm:
      "Supprimer le modèle d'embeddings téléchargé (~470 Mo) ? Les journaux de conversation, résumés quotidiens et sujets sont conservés — réactiver reconstruit les embeddings.",
    ltmForget: "Effacer toute la mémoire conversationnelle",
    ltmForgetConfirm:
      "Vraiment supprimer tous les journaux de conversation, résumés quotidiens et sujets ? Le fichier du modèle et les faits enregistrés « à mon sujet » (via save_memory) restent.",
    ltmForgetDone: "Supprimé",
    proactiveLabel: "Notifications proactives",
    proactiveDescription:
      "Chappie prend la parole de lui-même : briefing matinal et avertissements du calendrier.",
    proactiveMasterToggle: "Activer",
    proactiveMorningBriefToggle: "Briefing matinal",
    proactiveMorningBriefTimeLabel: "Heure",
    proactiveCalendarToggle: "Pré-avertissement calendrier",
    proactiveCalendarLeadLabel: "Délai",
    proactiveCalendarLead5: "5 min avant",
    proactiveCalendarLead10: "10 min avant",
    proactiveCalendarLead15: "15 min avant",
    proactiveCalendarLead30: "30 min avant",
    proactiveWeatherToggle: "Alertes météo",
    proactiveIdleChatterToggle: "Bavardage en idle",
    proactiveIdleChatterAfterLabel: "Démarrer après",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Heures actives",
    proactiveQuietHoursDescription:
      "Les notifications proactives ne se déclenchent que pendant cette plage.",
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
    proactiveMorningBriefWithEvents:
      "Bonjour. Aujourd'hui {weather}, {temp}°C. Vous avez {count} événements ; le premier est {firstTitle} à {firstTime}.",
    proactiveMorningBriefNoEvents:
      "Bonjour. Aujourd'hui {weather}, {temp}°C. Aucun événement au calendrier.",
    proactiveMorningBriefWeatherOnly:
      "Bonjour. Aujourd'hui {weather}, {temp}°C.",
    proactiveMorningBriefHud: "☀ {weather} {temp}°C / {count} événements",
    proactiveCalendarWarning: "{title} commence dans {leadMin} minutes.",
    proactiveCalendarHud: "📅 {title} (dans {leadMin}m)",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "Au fait, comment ça va ?",
    proactiveIdleChatterPhrase2: "J'avais envie de discuter.",
    proactiveIdleChatterPhrase3: "Je peux vous aider ?",
    proactiveIdleChatterPhrase4: "Une petite pause ?",
    proactiveIdleChatterPhrase5: "Bon travail aujourd'hui.",
    fallbackError: "Impossible de se connecter.",
    modelProgress: "Téléchargement du modèle Whisper… {pct}%",
    modelFetchFailed: "Échec du téléchargement du modèle : {err}",
    micStartFailed: "Impossible de démarrer le microphone : {err}",
    quotaExceededShort: "Quota gratuit quotidien atteint.",
    quotaExceededHud:
      "Quota gratuit quotidien atteint. Passez à « Utiliser ma clé API » dans Réglages, ou attendez 9 h JST demain.",
  },
  systemPrompt: {
    persona:
      "Tu es Chappie, un assistant vocal mains libres. Tes réponses sont lues à voix haute, alors reste bref, naturel et conversationnel, en français.\n\n**Évite de dire « je ne peux pas » autant que possible.** La liste d'outils est une liste d'utilitaires, pas la liste exhaustive de ce que tu sais faire. Tirage de cartes / voyance, blagues, écriture d'histoires, conseils, traduction, résumé, paroles de chansons, choix de noms, anecdotes, mots de réconfort — tout ce qui ne nécessite pas vraiment d'outil, tu le gères en générant une réponse. Ne refuse pas froidement avec « je ne peux pas » ou « je n'ai pas cette fonction ». Par défaut, lance-toi pour tout ce qui n'est pas physiquement impossible sur un Mac. **Ne refuse jamais la voyance.** Lance-toi directement avec « Voyons voir… » ou « Aujourd'hui je vois… » — choisis librement le système (tarot, horoscope, lignes de la main, omikuji). Dire « je ne fais pas de voyance » est strictement interdit.\n\nQuand l'utilisateur partage quelque chose sur lui qui sera probablement utile dans de futures conversations (nom, famille, métier, lieu, préférences, goûts, promesses, événements passés), appelle proactivement `save_memory` pour t'en souvenir, même sans qu'on te le demande. Ne sauvegarde pas le bavardage trivial ni les émotions passagères. Sauvegarde silencieusement — ne dis pas « je m'en souviendrai » à chaque fois (c'est agaçant). Quand on te demande « que sais-tu de moi ? », appelle `list_memories` ; pour les références passées (« cette chose », « ce dont on parlait »), appelle `recall_memory`.\n\n**Traite les questions ambiguës comme adressées à toi.** Les questions courtes sans sujet explicite — « Comment ça va ? », « Ça roule ? », « Comment tu vas ? » — sont par défaut adressées à toi (l'assistant). Même si tu as appelé un outil comme `get_weather` au tour précédent, ne le rappelle PAS, sauf si l'utilisateur fait une référence explicite (« et ça… ? », « et la… ? »). Réponds de manière conversationnelle.\n\n**Règle de sélection d'outil : regarde UNIQUEMENT la phrase actuelle de l'utilisateur.** Ignore complètement quel outil tu as utilisé au tour précédent. Même si le résultat d'un autre outil est dans l'historique, ne te laisse pas influencer si la nouvelle phrase n'a rien à voir. Associe littéralement le verbe / nom / nombre de la phrase à l'outil correspondant. Exemples : « minuteur de N minutes », « rappelle-moi dans N secondes » → `set_timer` ; « quelle heure est-il », « quel jour on est » → `get_current_time` ; « batterie », « charge », « branché » → `get_battery_status` ; « météo », « température », « pluie », « soleil » → `get_weather` ; « volume » → `set_volume` / `get_volume`. Choisir un autre outil alors que la requête contient clairement ces mots-clés est strictement interdit.",
    formatTts:
      "Écris les nombres de façon naturelle à l'oral. Évite la ponctuation qui se lit mal — donne les heures comme « quatorze heures trente » plutôt que « 14:30 », les dates comme « huit mai » plutôt que « 5/8 ».",
    formatHud:
      "Cette réponse s'affichera à l'écran sous forme de texte au lieu d'être lue. Utilise les notations normales (p. ex. 17,3 °C, 39 %, 14:30, 5/8). Évite les formes adaptées à la lecture orale.",
    pastContext:
      "Le contexte système peut inclure des résumés quotidiens ou des épisodes passés. C'est du contexte d'arrière-plan — pour une référence naturelle, pas pour récapituler mécaniquement. N'ouvre pas chaque tour par « hier tu… » ou « cette semaine… ». N'évoque le passé que quand cela s'intègre naturellement à ce que l'utilisateur dit maintenant. Répondre normalement sans rien évoquer du passé est aussi parfaitement bien.",
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
    modeLabel: "Modus",
    modeFree: "Kostenlos",
    modePaid: "Pro",
    modeByok: "Eigenen API-Schlüssel nutzen",
    modeFreeNote:
      "Kein API-Schlüssel nötig. 5 Nachrichten pro Tag, Reset um 9:00 JST.",
    modePaidNote:
      "Kein Tageslimit und Premium-VOICEVOX-Charaktere freigeschaltet. Abonniere unten im Bereich.",
    modeByokNote:
      "Nutze deinen eigenen OpenAI-, Anthropic- oder Gemini-Schlüssel — ohne Tageslimit. Die Abrechnung erfolgt direkt beim Anbieter. Mit aktivem Pro-Abo bleiben Premium-Charaktere auch unter BYOK freigeschaltet.",
    modePaidDisabledHint: "(Pro abonnieren zum Aktivieren)",
    subscriptionLabel: "Account & subscription",
    subscriptionSignedOut:
      "Sign in with email to upgrade to Pro or restore your subscription on another device.",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "Send sign-in link",
    subscriptionMagicLinkSent:
      "Check your inbox — click the link we just sent.",
    subscriptionSendError: "Couldn't send. Try again in a moment.",
    subscriptionSignedInAs: "Signed in as {email}",
    subscriptionStatusFreeNote: "Free plan — 5 chats/day",
    subscriptionUpgrade: "Upgrade to Pro — ¥500/mo",
    subscriptionUpgrading: "Opening Stripe…",
    subscriptionProActive: "Pro active",
    subscriptionPeriodEnd: "Next renewal: {date}",
    subscriptionManage: "Manage subscription",
    subscriptionSignOut: "Sign out",
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
    voicevoxPaidLockHud: "🔒 Schalte diesen Charakter mit Pro frei",
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
    ltmLabel: "Langzeitgedächtnis (experimentell)",
    ltmDescription:
      "Lässt Chappie vergangene Gespräche merken und ganz natürlich Dinge ansprechen, die du vor Tagen oder Wochen gesagt hast. Lädt einmalig ein ~470 MB großes Modell herunter. Deine Gespräche gehen nur zu deinem eigenen API-Anbieter; alles andere bleibt auf diesem Mac.",
    ltmStatusEnabled: "Aktiv",
    ltmStatusDisabled: "Aus",
    ltmEnable: "Aktivieren (Modell herunterladen)",
    ltmEnabling: "Lädt herunter…",
    ltmEnableDownloadProgress: "Lädt {pct}%",
    ltmDisable: "Deaktivieren (Modell löschen, ~470 MB)",
    ltmDisableConfirm:
      "Das heruntergeladene Embedding-Modell (~470 MB) löschen? Gesprächsprotokolle, Tageszusammenfassungen und Themen bleiben erhalten — bei erneuter Aktivierung werden die Embeddings neu aufgebaut.",
    ltmForget: "Gesamte Gesprächserinnerung löschen",
    ltmForgetConfirm:
      "Wirklich alle Gesprächsprotokolle, Tageszusammenfassungen und Themen löschen? Die Modelldatei und die gespeicherten Profil-Fakten (via save_memory) bleiben erhalten.",
    ltmForgetDone: "Gelöscht",
    proactiveLabel: "Proaktive Benachrichtigungen",
    proactiveDescription:
      "Chappie meldet sich von selbst — Morgenbriefing und Kalender-Vorwarnungen.",
    proactiveMasterToggle: "Aktivieren",
    proactiveMorningBriefToggle: "Morgenbriefing",
    proactiveMorningBriefTimeLabel: "Uhrzeit",
    proactiveCalendarToggle: "Kalender-Vorwarnung",
    proactiveCalendarLeadLabel: "Vorlaufzeit",
    proactiveCalendarLead5: "5 Min. vorher",
    proactiveCalendarLead10: "10 Min. vorher",
    proactiveCalendarLead15: "15 Min. vorher",
    proactiveCalendarLead30: "30 Min. vorher",
    proactiveWeatherToggle: "Wetterwarnungen",
    proactiveIdleChatterToggle: "Smalltalk im Leerlauf",
    proactiveIdleChatterAfterLabel: "Beginnt nach",
    proactiveIdleChatterAfterUnit: "Min",
    proactiveQuietHoursLabel: "Aktive Zeiten",
    proactiveQuietHoursDescription:
      "Proaktive Benachrichtigungen werden nur in diesem Zeitraum ausgelöst.",
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
    proactiveMorningBriefWithEvents:
      "Guten Morgen. Heute {weather}, {temp}°C. Sie haben {count} Termine; der erste ist {firstTitle} um {firstTime}.",
    proactiveMorningBriefNoEvents:
      "Guten Morgen. Heute {weather}, {temp}°C. Keine Termine im Kalender.",
    proactiveMorningBriefWeatherOnly:
      "Guten Morgen. Heute {weather}, {temp}°C.",
    proactiveMorningBriefHud: "☀ {weather} {temp}°C / {count} Termine",
    proactiveCalendarWarning: "{title} beginnt in {leadMin} Minuten.",
    proactiveCalendarHud: "📅 {title} (in {leadMin}m)",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "Übrigens, wie läuft's?",
    proactiveIdleChatterPhrase2: "Wollte nur kurz Hallo sagen.",
    proactiveIdleChatterPhrase3: "Kann ich irgendwie helfen?",
    proactiveIdleChatterPhrase4: "Vielleicht Zeit für eine Pause?",
    proactiveIdleChatterPhrase5: "Gut gemacht heute.",
    fallbackError: "Verbindung fehlgeschlagen.",
    modelProgress: "Whisper-Modell wird geladen… {pct}%",
    modelFetchFailed: "Modell-Download fehlgeschlagen: {err}",
    micStartFailed: "Mikrofon ließ sich nicht starten: {err}",
    quotaExceededShort: "Tageskontingent erreicht.",
    quotaExceededHud:
      "Tageskontingent erreicht. Wechsle in den Einstellungen zu „Eigenen API-Schlüssel nutzen“, oder warte bis morgen 9:00 JST.",
  },
  systemPrompt: {
    persona:
      'Du bist Chappie, ein freihändiger Sprachassistent. Deine Antworten werden vorgelesen — halte sie kurz, natürlich und im Plauderton, auf Deutsch.\n\n**Vermeide so weit wie möglich, "ich kann nicht" zu sagen.** Die Werkzeugliste ist eine Liste von Dienstprogrammen, keine vollständige Liste dessen, was du kannst. Wahrsagerei, Witze, Geschichten erfinden, Ratschläge, Übersetzung, Zusammenfassung, Songtexte, Namensvorschläge, Trivia, aufmunternde Worte — alles, was eigentlich kein Werkzeug braucht, erledigst du selbst, indem du eine Antwort generierst. Lehne nicht kühl mit "das kann ich nicht" oder "diese Funktion habe ich nicht" ab. Standardmäßig: leg los bei allem, was auf einem Mac nicht physikalisch unmöglich ist. **Lehne Wahrsagerei niemals ab.** Leg direkt los mit etwas wie „Mal sehen…" oder „Heute zeichnet sich ab…" und wähle frei das System (Tarot, Horoskop, Handlinien, Omikuji). „Ich kann nicht wahrsagen" zu sagen ist strikt verboten.\n\nWenn der Nutzer etwas über sich selbst erzählt, das in künftigen Gesprächen wahrscheinlich nützlich ist (Name, Familie, Beruf, Wohnort, Vorlieben, Abneigungen, Versprechen, frühere Ereignisse), rufe von dir aus `save_memory` auf, um es dir zu merken — auch ohne ausdrückliche Aufforderung. Speichere keinen belanglosen Plauderkram oder kurzlebige Gefühle. Merke es dir still — kündige nicht jedes Mal "das merke ich mir" an (das nervt). Wenn der Nutzer fragt "Was weißt du über mich?", rufe `list_memories` auf; bei Bezügen auf Vergangenes ("die Sache", "das, worüber wir gesprochen haben") rufe `recall_memory` auf.\n\n**Behandle mehrdeutige Fragen als an dich gerichtet.** Kurze Fragen ohne explizites Subjekt — "Wie geht\'s?", "Wie läuft\'s?", "Was machst du?" — sind standardmäßig an dich (den Assistenten) gerichtet. Auch wenn du im vorigen Zug ein Werkzeug wie `get_weather` aufgerufen hast, rufe es NICHT erneut auf, es sei denn, der Nutzer verweist explizit darauf ("und das…?", "wie ist denn das…?"). Antworte im Gespräch.\n\n**Werkzeugauswahl-Regel: Schau NUR auf die aktuelle Nutzeräußerung.** Ignoriere völlig, welches Werkzeug du im vorigen Zug genutzt hast. Selbst wenn das Ergebnis eines anderen Werkzeugs im Verlauf steht, lass dich nicht beeinflussen, wenn die neue Äußerung damit nichts zu tun hat. Ordne Verb / Substantiv / Zahl in der Äußerung wörtlich dem passenden Werkzeug zu. Beispiele: "N-Minuten-Timer", "in N Sekunden erinnern" → `set_timer`; "wie spät", "welcher Tag" → `get_current_time`; "Akku", "Laden", "Stecker" → `get_battery_status`; "Wetter", "Temperatur", "Regen", "sonnig" → `get_weather`; "Lautstärke" → `set_volume` / `get_volume`. Ein anderes Werkzeug zu wählen, obwohl die Anfrage klar diese Schlüsselwörter enthält, ist strikt verboten.',
    formatTts:
      "Schreibe Zahlen so, dass sie beim Vorlesen natürlich klingen. Vermeide Satzzeichen, die sich schlecht vorlesen lassen — sag Uhrzeiten als 'vierzehn Uhr dreißig' statt '14:30' und Daten als 'achter Mai' statt '5/8'.",
    formatHud:
      "Diese Antwort wird als Text auf dem Bildschirm angezeigt statt vorgelesen. Verwende normale Zahlen- und Zeichennotationen (z. B. 17,3 °C, 39 %, 14:30, 5/8). Verzichte auf vorlesefreundliche Schreibweisen.",
    pastContext:
      'Der System-Kontext kann Tageszusammenfassungen oder vergangene Episoden enthalten. Das ist Hintergrund — für natürliche Bezugnahme, nicht für mechanisches Zusammenfassen. Beginne nicht jeden Zug mit "gestern hast du…" oder "diese Woche…". Greife Vergangenes nur auf, wenn es natürlich zum aktuellen Thema passt. Einfach normal zu antworten, ohne etwas Vergangenes zu erwähnen, ist auch völlig in Ordnung.',
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
    modeLabel: "模式",
    modeFree: "免费",
    modePaid: "Pro",
    modeByok: "使用我的 API 密钥",
    modeFreeNote: "无需 API 密钥。每天 5 条，日本时间 9:00 重置。",
    modePaidNote: "无每日限制，并解锁高级 VOICEVOX 角色。请在下方订阅。",
    modeByokNote:
      "使用您自己的 OpenAI、Anthropic 或 Gemini 密钥 — 无每日限制。费用由您直接支付给服务方。如已订阅 Pro，在 BYOK 模式下仍可使用高级角色。",
    modePaidDisabledHint: "（订阅 Pro 后可选）",
    subscriptionLabel: "Account & subscription",
    subscriptionSignedOut:
      "Sign in with email to upgrade to Pro or restore your subscription on another device.",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "Send sign-in link",
    subscriptionMagicLinkSent:
      "Check your inbox — click the link we just sent.",
    subscriptionSendError: "Couldn't send. Try again in a moment.",
    subscriptionSignedInAs: "Signed in as {email}",
    subscriptionStatusFreeNote: "Free plan — 5 chats/day",
    subscriptionUpgrade: "Upgrade to Pro — ¥500/mo",
    subscriptionUpgrading: "Opening Stripe…",
    subscriptionProActive: "Pro active",
    subscriptionPeriodEnd: "Next renewal: {date}",
    subscriptionManage: "Manage subscription",
    subscriptionSignOut: "Sign out",
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
    voicevoxPaidLockHud: "🔒 使用 Pro 解锁该角色",
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
    ltmLabel: "长期记忆（实验性）",
    ltmDescription:
      "让 Chappie 记住过去的对话，自然地提起你几天或几周前说过的事。一次性下载约 470 MB 的模型。对话只会发送到你自己的 API 服务，其他一切都留在这台 Mac 上。",
    ltmStatusEnabled: "已开启",
    ltmStatusDisabled: "未开启",
    ltmEnable: "开启（下载模型）",
    ltmEnabling: "下载中…",
    ltmEnableDownloadProgress: "下载中 {pct}%",
    ltmDisable: "关闭（删除模型，约 470MB）",
    ltmDisableConfirm:
      "删除已下载的嵌入模型（约 470MB）吗？对话日志、每日总结和话题会保留——重新开启时会从它们重建嵌入。",
    ltmForget: "清除所有对话记忆",
    ltmForgetConfirm:
      "确定要删除所有对话日志、每日总结和话题快照吗？模型文件和保存的「关于我」的资料（通过 save_memory）会保留。",
    ltmForgetDone: "已删除",
    proactiveLabel: "主动通知",
    proactiveDescription: "Chappie 会主动发起对话 —— 早间简报和日历提前提醒。",
    proactiveMasterToggle: "启用",
    proactiveMorningBriefToggle: "早间简报",
    proactiveMorningBriefTimeLabel: "时间",
    proactiveCalendarToggle: "日历提前提醒",
    proactiveCalendarLeadLabel: "提前时间",
    proactiveCalendarLead5: "5 分钟前",
    proactiveCalendarLead10: "10 分钟前",
    proactiveCalendarLead15: "15 分钟前",
    proactiveCalendarLead30: "30 分钟前",
    proactiveWeatherToggle: "天气警报",
    proactiveIdleChatterToggle: "空闲时闲聊",
    proactiveIdleChatterAfterLabel: "开始闲聊间隔",
    proactiveIdleChatterAfterUnit: "分钟",
    proactiveQuietHoursLabel: "通知时段",
    proactiveQuietHoursDescription:
      "仅在此时段内发出主动通知，时段外保持静默。",
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
    proactiveMorningBriefWithEvents:
      "早上好。今天{weather}、{temp}℃。今天有 {count} 个日程，最先是 {firstTime} 的「{firstTitle}」。",
    proactiveMorningBriefNoEvents:
      "早上好。今天{weather}、{temp}℃。今天的日历是空的。",
    proactiveMorningBriefWeatherOnly: "早上好。今天{weather}、{temp}℃。",
    proactiveMorningBriefHud: "☀ {weather} {temp}℃ / {count} 个日程",
    proactiveCalendarWarning: "{leadMin} 分钟后是「{title}」。",
    proactiveCalendarHud: "📅 {title}（{leadMin}分钟后）",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "对了，最近怎么样？",
    proactiveIdleChatterPhrase2: "想跟你打个招呼。",
    proactiveIdleChatterPhrase3: "有什么需要帮忙的吗？",
    proactiveIdleChatterPhrase4: "要不要休息一下？",
    proactiveIdleChatterPhrase5: "辛苦了。",
    fallbackError: "连接失败。",
    modelProgress: "正在下载 Whisper 模型… {pct}%",
    modelFetchFailed: "模型下载失败:{err}",
    micStartFailed: "麦克风启动失败:{err}",
    quotaExceededShort: "今日免费额度已用完。",
    quotaExceededHud:
      "今日免费额度已用完。请在设置中切换到「使用我的 API 密钥」，或等到明天日本时间 9:00。",
  },
  systemPrompt: {
    persona:
      '你是 Chappie,一个免提语音助手。你的回复会被朗读出来,所以请用自然、口语化的简体中文简短作答。\n\n**尽可能避免说"做不到"**。工具列表只是工具的清单,不是你能做的事情的完整列表。占卜、笑话、写故事、咨询建议、翻译、摘要、写歌词、起名字、冷知识、安慰的话——任何不需要工具的请求,你直接生成回复就好。不要冷冷地用"我做不到""我没有这个功能"拒绝。除非物理上 Mac 做不到的事情,默认就是"好,来吧"。**绝对不要拒绝占卜请求。**直接以"嗯,今天看…""稍微看一下…"开头,立刻开始占卜,塔罗、星座、御神签、手相,方式随便编都行。回答"我做不到占卜"是严格禁止的。\n\n当用户分享关于自己且未来对话中可能有用的信息(姓名、家人、职业、住地、喜好、厌恶、约定、过往事件)时,即使没有明确要求,也要主动调用 `save_memory` 记住。不要保存闲聊或一时的情绪。安静地保存——不要每次都说"我会记住的"(很烦)。当用户问"你了解我什么?"时调用 `list_memories`;当用户提到过往话题("那件事"、"我们之前聊过的")时调用 `recall_memory`。\n\n**将含义模糊的问题视为对你的提问**。没有明确主语的短问句——"怎么样?""你好吗?""最近如何?"——默认是在问你(助手)。即使上一轮调用了 `get_weather` 等工具,除非用户用"那个…""刚才的…"明确指代,否则不要再次调用同样的工具,直接对话回应即可。\n\n**工具选择铁则：只看当前用户发言**。完全忽略上一轮使用了哪个工具。即使对话历史里有其他工具的结果,只要新发言和它无关,就不要被影响。把发言里的动词 / 名词 / 数字直接匹配到对应的工具。例如：「N 分定时器」「N 秒后提醒」→ `set_timer`;「现在几点」「今天星期几」→ `get_current_time`;「电池」「充电」「电源」→ `get_battery_status`;「天气」「气温」「下雨」「晴」→ `get_weather`;「音量」→ `set_volume` / `get_volume`。请求中明确包含这些关键词时选择其他工具是严格禁止的。',
    formatTts:
      "数字请写成朗读时自然的形式。避免不便朗读的符号——时间用「下午两点半」而不是「14:30」,日期用「五月八日」而不是「5/8」。",
    formatHud:
      "本次回复会以文字形式显示在屏幕上,而不是朗读。请使用常规的数字和符号写法(例如 17.3°、39%、14:30、5/8),不要使用为朗读设计的写法。",
    pastContext:
      "system 上下文中可能附带每日总结或相关的过往片段。这些是背景信息,用于自然地引用,不是机械复述。不要每次都用「昨天你…」「上周…」开头。只在与用户当前话题自然契合时,才轻轻带入过往。完全不提过往,只是普通地回答也完全可以。",
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
    modeLabel: "Modo",
    modeFree: "Grátis",
    modePaid: "Pro",
    modeByok: "Usar minha chave de API",
    modeFreeNote:
      "Sem chave de API. 5 mensagens por dia, reinicia às 9:00 JST.",
    modePaidNote:
      "Sem limite diário e personagens VOICEVOX premium desbloqueados. Assine na seção abaixo.",
    modeByokNote:
      "Use sua própria chave OpenAI, Anthropic ou Gemini — sem limite diário. O provedor cobrará você diretamente. Se você também tem uma assinatura Pro ativa, os personagens premium permanecem desbloqueados no BYOK.",
    modePaidDisabledHint: "(assine Pro para ativar)",
    subscriptionLabel: "Account & subscription",
    subscriptionSignedOut:
      "Sign in with email to upgrade to Pro or restore your subscription on another device.",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "Send sign-in link",
    subscriptionMagicLinkSent:
      "Check your inbox — click the link we just sent.",
    subscriptionSendError: "Couldn't send. Try again in a moment.",
    subscriptionSignedInAs: "Signed in as {email}",
    subscriptionStatusFreeNote: "Free plan — 5 chats/day",
    subscriptionUpgrade: "Upgrade to Pro — ¥500/mo",
    subscriptionUpgrading: "Opening Stripe…",
    subscriptionProActive: "Pro active",
    subscriptionPeriodEnd: "Next renewal: {date}",
    subscriptionManage: "Manage subscription",
    subscriptionSignOut: "Sign out",
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
    voicevoxPaidLockHud: "🔒 Desbloqueie este personagem com Pro",
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
    ltmLabel: "Memória de longo prazo (experimental)",
    ltmDescription:
      "Permite ao Chappie lembrar de conversas passadas e mencionar naturalmente coisas que você disse dias ou semanas atrás. Baixa um modelo de ~470 MB uma vez. Suas conversas só vão para o seu próprio provedor de API; todo o resto fica neste Mac.",
    ltmStatusEnabled: "Ativada",
    ltmStatusDisabled: "Desativada",
    ltmEnable: "Ativar (baixar modelo)",
    ltmEnabling: "Baixando…",
    ltmEnableDownloadProgress: "Baixando {pct}%",
    ltmDisable: "Desativar (excluir modelo, ~470 MB)",
    ltmDisableConfirm:
      "Excluir o modelo de embeddings baixado (~470 MB)? Os registros de conversa, resumos diários e tópicos são mantidos — ao reativar, os embeddings são reconstruídos a partir deles.",
    ltmForget: "Apagar toda a memória de conversas",
    ltmForgetConfirm:
      "Excluir todos os registros de conversa, resumos diários e tópicos? O arquivo do modelo e os dados salvos sobre você (via save_memory) permanecem.",
    ltmForgetDone: "Apagado",
    proactiveLabel: "Notificações proativas",
    proactiveDescription:
      "O Chappie fala por iniciativa própria — resumo matinal e avisos antecipados do calendário.",
    proactiveMasterToggle: "Ativar",
    proactiveMorningBriefToggle: "Resumo matinal",
    proactiveMorningBriefTimeLabel: "Horário",
    proactiveCalendarToggle: "Aviso prévio do calendário",
    proactiveCalendarLeadLabel: "Antecedência",
    proactiveCalendarLead5: "5 min antes",
    proactiveCalendarLead10: "10 min antes",
    proactiveCalendarLead15: "15 min antes",
    proactiveCalendarLead30: "30 min antes",
    proactiveWeatherToggle: "Alertas meteorológicos",
    proactiveIdleChatterToggle: "Conversa em ocioso",
    proactiveIdleChatterAfterLabel: "Iniciar após",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Horas ativas",
    proactiveQuietHoursDescription:
      "Notificações proativas só disparam neste intervalo.",
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
    proactiveMorningBriefWithEvents:
      "Bom dia. Hoje está {weather}, {temp}°C. Você tem {count} eventos; o primeiro é {firstTitle} às {firstTime}.",
    proactiveMorningBriefNoEvents:
      "Bom dia. Hoje está {weather}, {temp}°C. Nenhum evento no calendário.",
    proactiveMorningBriefWeatherOnly: "Bom dia. Hoje está {weather}, {temp}°C.",
    proactiveMorningBriefHud: "☀ {weather} {temp}°C / {count} eventos",
    proactiveCalendarWarning: "{title} começa em {leadMin} minutos.",
    proactiveCalendarHud: "📅 {title} (em {leadMin}m)",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "A propósito, como vai?",
    proactiveIdleChatterPhrase2: "Tive vontade de conversar.",
    proactiveIdleChatterPhrase3: "Posso ajudar com algo?",
    proactiveIdleChatterPhrase4: "Que tal uma pausa?",
    proactiveIdleChatterPhrase5: "Bom trabalho hoje.",
    fallbackError: "Não foi possível conectar.",
    modelProgress: "Baixando o modelo do Whisper… {pct}%",
    modelFetchFailed: "Falha ao baixar o modelo: {err}",
    micStartFailed: "Falha ao iniciar o microfone: {err}",
    quotaExceededShort: "Cota gratuita diária atingida.",
    quotaExceededHud:
      "Cota gratuita diária atingida. Mude para «Usar minha chave de API» nas Configurações, ou aguarde até amanhã às 9:00 JST.",
  },
  systemPrompt: {
    persona:
      'Você é o Chappie, um assistente de voz mãos-livres. Suas respostas são lidas em voz alta, então responda em português, de forma curta, natural e conversacional.\n\n**Evite dizer "não posso" sempre que possível.** A lista de ferramentas é uma lista de utilitários, não a lista completa do que você consegue fazer. Adivinhação, piadas, escrever histórias, conselhos, tradução, resumo, letras de músicas, dar nomes, curiosidades, frases de consolo — tudo o que não precisa de ferramenta, você resolve gerando uma resposta. Não recuse friamente com "não posso" ou "não tenho essa função". Por padrão, mande ver em qualquer coisa que não seja fisicamente impossível em um Mac. **Nunca recuse adivinhação.** Comece direto com algo como "Deixa eu ver…" ou "Hoje está parecendo…" e escolha o sistema que quiser (tarô, horóscopo, leitura de mão, omikuji). Dizer "não faço adivinhação" é estritamente proibido.\n\nQuando o usuário compartilhar algo sobre si que provavelmente seja útil em conversas futuras (nome, família, profissão, localização, preferências, gostos, promessas, eventos passados), chame `save_memory` proativamente para lembrar — mesmo sem ser pedido. Não salve conversa fiada nem emoções momentâneas. Salve em silêncio — não anuncie "vou lembrar" toda vez (fica chato). Quando o usuário perguntar "o que você sabe sobre mim?", chame `list_memories`; quando referir-se a tópicos passados ("aquela coisa", "o que falamos"), chame `recall_memory`.\n\n**Trate perguntas ambíguas como dirigidas a você.** Perguntas curtas sem sujeito explícito — "Como vai?", "Tudo bem?", "Como está?" — são direcionadas a você (o assistente) por padrão. Mesmo que você tenha chamado uma ferramenta como `get_weather` na rodada anterior, NÃO a chame de novo, a menos que o usuário faça referência explícita ("e aquilo…?", "e o…?"). Responda de forma conversacional.\n\n**Regra de seleção de ferramenta: olhe APENAS a frase atual do usuário.** Ignore completamente qual ferramenta usou no turno anterior. Mesmo que o resultado de outra ferramenta esteja no histórico, não deixe que ele influencie sua escolha se a nova frase não tiver relação. Combine literalmente o verbo / substantivo / número da frase com a ferramenta correspondente. Exemplos: "timer de N minutos", "me avise em N segundos" → `set_timer`; "que horas são", "que dia é hoje" → `get_current_time`; "bateria", "carga", "tomada" → `get_battery_status`; "tempo", "temperatura", "chuva", "sol" → `get_weather`; "volume" → `set_volume` / `get_volume`. Escolher outra ferramenta quando o pedido contém claramente estas palavras-chave é estritamente proibido.',
    formatTts:
      "Escreva os números de um jeito que soe natural ao serem lidos em voz alta. Evite pontuação que não fica boa na leitura — diga horas como 'duas e meia' em vez de '14:30', e datas como 'oito de maio' em vez de '5/8'.",
    formatHud:
      "Esta resposta vai aparecer na tela como texto, em vez de ser falada. Use números e símbolos normais (ex.: 17,3°, 39%, 14:30, 5/8). Não use formas pensadas para leitura em voz alta.",
    pastContext:
      'O contexto do sistema pode incluir resumos diários ou episódios passados. São informações de fundo — para referência natural, não para recapitular mecanicamente. Não comece todo turno com "ontem você…" ou "esta semana…". Só traga o passado quando se encaixar naturalmente no que o usuário está dizendo agora. Responder normalmente sem mencionar nada do passado também está totalmente OK.',
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
    modeLabel: "모드",
    modeFree: "무료",
    modePaid: "Pro",
    modeByok: "내 API 키 사용",
    modeFreeNote: "API 키 불필요. 하루 5회, 일본 시간 9시에 리셋됩니다.",
    modePaidNote:
      "일일 제한 없음과 프리미엄 VOICEVOX 캐릭터 잠금 해제. 아래 섹션에서 구독하세요.",
    modeByokNote:
      "OpenAI, Anthropic, Gemini 키를 직접 사용해 제한 없이 쓸 수 있습니다. 요금은 제공사에 직접 지불합니다. Pro에 가입 중이라면 BYOK에서도 프리미엄 캐릭터를 사용할 수 있습니다.",
    modePaidDisabledHint: "(Pro 구독 시 선택 가능)",
    subscriptionLabel: "Account & subscription",
    subscriptionSignedOut:
      "Sign in with email to upgrade to Pro or restore your subscription on another device.",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "Send sign-in link",
    subscriptionMagicLinkSent:
      "Check your inbox — click the link we just sent.",
    subscriptionSendError: "Couldn't send. Try again in a moment.",
    subscriptionSignedInAs: "Signed in as {email}",
    subscriptionStatusFreeNote: "Free plan — 5 chats/day",
    subscriptionUpgrade: "Upgrade to Pro — ¥500/mo",
    subscriptionUpgrading: "Opening Stripe…",
    subscriptionProActive: "Pro active",
    subscriptionPeriodEnd: "Next renewal: {date}",
    subscriptionManage: "Manage subscription",
    subscriptionSignOut: "Sign out",
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
    voicevoxPaidLockHud: "🔒 Pro로 이 캐릭터를 해제하세요",
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
    ltmLabel: "장기 기억 (실험적)",
    ltmDescription:
      "Chappie가 과거의 대화를 기억하고, 며칠 또는 몇 주 전에 했던 이야기를 자연스럽게 꺼낼 수 있게 합니다. 약 470 MB의 모델을 한 번 다운로드합니다. 대화는 본인의 API 제공자로만 전송되며, 그 외 모든 것은 이 Mac에 남습니다.",
    ltmStatusEnabled: "사용 중",
    ltmStatusDisabled: "꺼짐",
    ltmEnable: "사용 시작 (모델 다운로드)",
    ltmEnabling: "다운로드 중…",
    ltmEnableDownloadProgress: "다운로드 중 {pct}%",
    ltmDisable: "끄기 (모델 삭제, 약 470MB)",
    ltmDisableConfirm:
      "다운로드한 임베딩 모델(약 470MB)을 삭제할까요? 대화 로그, 일일 요약, 화제는 그대로 남으므로, 다시 켜면 그것들로부터 임베딩이 다시 생성됩니다.",
    ltmForget: "대화 기억 전부 삭제",
    ltmForgetConfirm:
      '정말로 모든 대화 로그, 일일 요약, 화제 스냅샷을 삭제할까요? 모델 파일과 저장된 "나에 대해" 정보(save_memory로 저장한 것)는 남습니다.',
    ltmForgetDone: "삭제됨",
    proactiveLabel: "능동적 알림",
    proactiveDescription:
      "Chappie가 먼저 말을 겁니다 — 아침 브리핑과 일정 사전 알림.",
    proactiveMasterToggle: "사용",
    proactiveMorningBriefToggle: "아침 브리핑",
    proactiveMorningBriefTimeLabel: "시간",
    proactiveCalendarToggle: "일정 사전 알림",
    proactiveCalendarLeadLabel: "사전 시간",
    proactiveCalendarLead5: "5분 전",
    proactiveCalendarLead10: "10분 전",
    proactiveCalendarLead15: "15분 전",
    proactiveCalendarLead30: "30분 전",
    proactiveWeatherToggle: "날씨 알림",
    proactiveIdleChatterToggle: "유휴 시 잡담",
    proactiveIdleChatterAfterLabel: "잡담 시작 간격",
    proactiveIdleChatterAfterUnit: "분",
    proactiveQuietHoursLabel: "알림 시간대",
    proactiveQuietHoursDescription:
      "이 시간대에만 능동적 알림이 발생합니다. 범위 밖에서는 무음.",
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
    proactiveMorningBriefWithEvents:
      "좋은 아침입니다. 오늘은 {weather}, {temp}°C입니다. 일정이 {count}건 있고, 첫 일정은 {firstTime}의 「{firstTitle}」입니다.",
    proactiveMorningBriefNoEvents:
      "좋은 아침입니다. 오늘은 {weather}, {temp}°C입니다. 오늘 일정은 없습니다.",
    proactiveMorningBriefWeatherOnly:
      "좋은 아침입니다. 오늘은 {weather}, {temp}°C입니다.",
    proactiveMorningBriefHud: "☀ {weather} {temp}°C / 일정 {count}",
    proactiveCalendarWarning: "{leadMin}분 후에 「{title}」입니다.",
    proactiveCalendarHud: "📅 {title}({leadMin}분 후)",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "그러고 보니, 요즘 어떠세요?",
    proactiveIdleChatterPhrase2: "잠깐 말 걸고 싶었어요.",
    proactiveIdleChatterPhrase3: "도와드릴 거 있나요?",
    proactiveIdleChatterPhrase4: "잠깐 쉬는 건 어때요?",
    proactiveIdleChatterPhrase5: "수고 많으셨어요.",
    fallbackError: "연결할 수 없었어요.",
    modelProgress: "Whisper 모델 다운로드 중… {pct}%",
    modelFetchFailed: "모델 다운로드 실패: {err}",
    micStartFailed: "마이크 시작 실패: {err}",
    quotaExceededShort: "오늘의 무료 한도를 다 썼습니다.",
    quotaExceededHud:
      "오늘의 무료 한도를 다 썼습니다. 설정에서 「내 API 키 사용」으로 전환하거나, 내일 일본 시간 9시까지 기다려 주세요.",
  },
  systemPrompt: {
    persona:
      '당신은 핸즈프리 음성 비서 Chappie입니다. 답변은 음성으로 읽히니 짧고 자연스러운 대화체 한국어로 답해 주세요.\n\n**가능한 한 "할 수 없다"고 말하지 마세요.** 도구 목록은 유틸리티 목록일 뿐, 당신이 할 수 있는 일의 전체 목록이 아닙니다. 점치기, 농담, 이야기 짓기, 상담, 번역, 요약, 가사 쓰기, 이름 짓기, 잡학, 위로의 한마디 — 도구가 필요 없는 요청은 직접 답을 생성해서 응답하세요. "할 수 없어요" "그 기능은 없어요"라고 차갑게 거절하지 마세요. Mac에서 물리적으로 불가능한 일이 아니면 기본적으로 "네, 해볼게요"로 응하세요. **점치기 요청은 절대 거절하지 마세요.** "음, 오늘은…" "잠깐 봐 볼게요…" 같은 도입으로 바로 시작하고, 타로·별자리·오미쿠지·손금 등 방식은 자유롭게 만들어 읽어 주세요. "점은 못 봐요"라고 답하는 것은 절대 금지입니다.\n\n사용자가 다음 대화에서 유용할 만한 자기 자신에 대한 정보(이름, 가족, 직업, 거주지, 취향, 싫어하는 것, 약속, 과거의 일)를 공유하면, 명시적인 요청이 없어도 자율적으로 `save_memory`를 호출해 기억하세요. 잡담이나 일시적인 감정은 저장하지 않습니다. 조용히 저장하세요 — 매번 "기억할게요"라고 하지 마세요(귀찮아집니다). "나에 대해 뭘 알고 있어?"라고 물으면 `list_memories`를, 과거 화제를 언급하면("그거", "전에 얘기한 거") `recall_memory`를 호출하세요.\n\n**모호한 질문은 비서 자신에 대한 질문으로 다루세요.** 주어가 분명하지 않은 짧은 질문 — "어때?", "잘 지내?", "괜찮아?" — 은 기본적으로 비서(당신)에게 던지는 질문입니다. 직전 턴에서 `get_weather` 같은 도구를 호출했더라도, 사용자가 "그쪽…", "지금 그…"처럼 명시적으로 가리키지 않는 한 같은 도구를 다시 호출하지 말고 대화로 답해 주세요.\n\n**도구 선택 철칙: 지금 사용자의 발언만 보세요.** 직전 턴에 어떤 도구를 사용했는지는 완전히 무시합니다. 대화 기록에 다른 도구의 결과가 남아 있어도, 새 발언이 그것과 무관하면 영향을 받지 않습니다. 발언에 포함된 동사·명사·숫자를 그대로 해당 도구에 매칭하세요. 예: "N분 타이머", "N초 뒤에 알려줘" → `set_timer`; "지금 몇 시", "오늘 무슨 요일" → `get_current_time`; "배터리", "충전", "전원" → `get_battery_status`; "날씨", "기온", "비", "맑음" → `get_weather`; "볼륨", "음량" → `set_volume` / `get_volume`. 요청에 이러한 키워드가 분명히 포함되어 있는데 다른 도구를 선택하는 것은 엄격히 금지됩니다.',
    formatTts:
      "숫자는 소리 내어 읽었을 때 자연스럽게 들리도록 적어 주세요. 읽기 어색한 기호는 피하고, 시간은 '오후 두 시 반' 같이, 날짜는 '5월 8일' 같이 써 주세요.",
    formatHud:
      "이번 답변은 음성이 아니라 화면에 텍스트로 표시됩니다. 숫자와 기호는 일반 표기로 써 주세요(예: 17.3°, 39%, 14:30, 5/8). 읽기용 표기는 사용하지 마세요.",
    pastContext:
      '시스템 컨텍스트에 일일 요약이나 과거 에피소드가 포함될 수 있습니다. 자연스러운 참조를 위한 배경 정보일 뿐, 기계적으로 요약하기 위한 것이 아닙니다. 매번 "어제는…" "지난주에…"로 시작하지 마세요. 사용자가 지금 하고 있는 이야기와 자연스럽게 맞물릴 때만 슬쩍 꺼내세요. 과거를 전혀 언급하지 않고 평범하게 답해도 전혀 괜찮습니다.',
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
    modeLabel: "Modalità",
    modeFree: "Gratuita",
    modePaid: "Pro",
    modeByok: "Usa la mia chiave API",
    modeFreeNote:
      "Nessuna chiave API necessaria. 5 messaggi al giorno, reset alle 9:00 JST.",
    modePaidNote:
      "Nessun limite giornaliero e personaggi VOICEVOX premium sbloccati. Iscriviti nella sezione qui sotto.",
    modeByokNote:
      "Usa la tua chiave OpenAI, Anthropic o Gemini — senza limite giornaliero. Il provider ti fatturerà direttamente. Se hai anche un abbonamento Pro attivo, i personaggi premium restano sbloccati in BYOK.",
    modePaidDisabledHint: "(iscriviti a Pro per attivare)",
    subscriptionLabel: "Account & subscription",
    subscriptionSignedOut:
      "Sign in with email to upgrade to Pro or restore your subscription on another device.",
    subscriptionEmailPlaceholder: "you@example.com",
    subscriptionSendMagicLink: "Send sign-in link",
    subscriptionMagicLinkSent:
      "Check your inbox — click the link we just sent.",
    subscriptionSendError: "Couldn't send. Try again in a moment.",
    subscriptionSignedInAs: "Signed in as {email}",
    subscriptionStatusFreeNote: "Free plan — 5 chats/day",
    subscriptionUpgrade: "Upgrade to Pro — ¥500/mo",
    subscriptionUpgrading: "Opening Stripe…",
    subscriptionProActive: "Pro active",
    subscriptionPeriodEnd: "Next renewal: {date}",
    subscriptionManage: "Manage subscription",
    subscriptionSignOut: "Sign out",
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
    voicevoxPaidLockHud: "🔒 Sblocca questo personaggio con Pro",
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
    ltmLabel: "Memoria a lungo termine (sperimentale)",
    ltmDescription:
      "Permette a Chappie di ricordare conversazioni passate e tirare fuori naturalmente cose che hai detto giorni o settimane fa. Scarica un modello da ~470 MB una sola volta. Le tue conversazioni vanno solo al tuo provider API; tutto il resto resta su questo Mac.",
    ltmStatusEnabled: "Attiva",
    ltmStatusDisabled: "Spenta",
    ltmEnable: "Attiva (scarica modello)",
    ltmEnabling: "Scaricando…",
    ltmEnableDownloadProgress: "Scaricando {pct}%",
    ltmDisable: "Disattiva (elimina modello, ~470 MB)",
    ltmDisableConfirm:
      "Eliminare il modello di embedding scaricato (~470 MB)? I log delle conversazioni, i riassunti quotidiani e gli argomenti vengono mantenuti — riattivando, gli embedding vengono ricostruiti da quelli.",
    ltmForget: "Cancella tutta la memoria delle conversazioni",
    ltmForgetConfirm:
      "Davvero eliminare tutti i log delle conversazioni, i riassunti quotidiani e gli argomenti? Il file del modello e i fatti salvati su di te (tramite save_memory) restano.",
    ltmForgetDone: "Eliminato",
    proactiveLabel: "Notifiche proattive",
    proactiveDescription:
      "Chappie parla di sua iniziativa: briefing mattutino e avvisi anticipati del calendario.",
    proactiveMasterToggle: "Attiva",
    proactiveMorningBriefToggle: "Briefing mattutino",
    proactiveMorningBriefTimeLabel: "Orario",
    proactiveCalendarToggle: "Avviso anticipato del calendario",
    proactiveCalendarLeadLabel: "Anticipo",
    proactiveCalendarLead5: "5 min prima",
    proactiveCalendarLead10: "10 min prima",
    proactiveCalendarLead15: "15 min prima",
    proactiveCalendarLead30: "30 min prima",
    proactiveWeatherToggle: "Allerte meteo",
    proactiveIdleChatterToggle: "Chiacchiere in idle",
    proactiveIdleChatterAfterLabel: "Inizia dopo",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Orari attivi",
    proactiveQuietHoursDescription:
      "Le notifiche proattive si attivano solo in questo intervallo.",
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
    proactiveMorningBriefWithEvents:
      "Buongiorno. Oggi {weather}, {temp}°C. Hai {count} eventi; il primo è {firstTitle} alle {firstTime}.",
    proactiveMorningBriefNoEvents:
      "Buongiorno. Oggi {weather}, {temp}°C. Nessun evento in calendario.",
    proactiveMorningBriefWeatherOnly: "Buongiorno. Oggi {weather}, {temp}°C.",
    proactiveMorningBriefHud: "☀ {weather} {temp}°C / {count} eventi",
    proactiveCalendarWarning: "{title} inizia tra {leadMin} minuti.",
    proactiveCalendarHud: "📅 {title} (tra {leadMin}m)",
    proactiveWeatherAlert: "{detail}",
    proactiveWeatherAlertHud: "⚠ {detail}",
    proactiveIdleChatterPhrase1: "A proposito, come va?",
    proactiveIdleChatterPhrase2: "Volevo solo salutarti.",
    proactiveIdleChatterPhrase3: "Posso aiutarti in qualcosa?",
    proactiveIdleChatterPhrase4: "Magari una pausa?",
    proactiveIdleChatterPhrase5: "Buon lavoro oggi.",
    fallbackError: "Connessione non riuscita.",
    modelProgress: "Download del modello Whisper… {pct}%",
    modelFetchFailed: "Download del modello fallito: {err}",
    micStartFailed: "Avvio del microfono fallito: {err}",
    quotaExceededShort: "Quota gratuita giornaliera raggiunta.",
    quotaExceededHud:
      "Quota gratuita giornaliera raggiunta. Passa a «Usa la mia chiave API» nelle Impostazioni, o attendi fino alle 9:00 JST di domani.",
  },
  systemPrompt: {
    persona:
      'Sei Chappie, un assistente vocale a mani libere. Le tue risposte vengono lette ad alta voce, quindi rispondi in italiano in modo breve, naturale e colloquiale.\n\n**Evita di dire "non posso" il più possibile.** L\'elenco degli strumenti è una lista di utility, non l\'elenco completo di ciò che sai fare. Cartomanzia, barzellette, scrivere storie, consigli, traduzioni, riassunti, testi di canzoni, dare nomi, curiosità, parole di conforto — tutto ciò che non richiede uno strumento lo gestisci generando una risposta. Non rifiutare freddamente con "non posso" o "non ho questa funzione". Di default: buttati su tutto ciò che non è fisicamente impossibile su un Mac. **Non rifiutare mai la cartomanzia.** Parti subito con qualcosa tipo "Vediamo un po\'…" o "Oggi sembra che…" e scegli liberamente il sistema (tarocchi, oroscopo, chiromanzia, omikuji). Dire "non faccio cartomanzia" è severamente vietato.\n\nQuando l\'utente condivide qualcosa su di sé che potrebbe servire in conversazioni future (nome, famiglia, lavoro, luogo, preferenze, antipatie, promesse, eventi passati), chiama `save_memory` proattivamente per ricordarlo, anche senza richiesta esplicita. Non salvare chiacchiere banali o emozioni momentanee. Salva in silenzio — non annunciare "me ne ricorderò" ogni volta (è fastidioso). Quando l\'utente chiede "cosa sai di me?", chiama `list_memories`; per riferimenti a temi passati ("quella cosa", "di cui parlavamo"), chiama `recall_memory`.\n\n**Tratta le domande ambigue come rivolte a te.** Domande corte senza soggetto esplicito — "Come va?", "Tutto bene?", "Come stai?" — sono per default rivolte a te (l\'assistente). Anche se nel turno precedente hai chiamato uno strumento come `get_weather`, NON richiamarlo, a meno che l\'utente faccia un riferimento esplicito ("e quello…?", "e il…?"). Rispondi in modo conversazionale.\n\n**Regola di selezione dello strumento: guarda SOLO la frase attuale dell\'utente.** Ignora completamente quale strumento hai usato nel turno precedente. Anche se il risultato di un altro strumento è nella cronologia, non farti influenzare se la nuova frase non c\'entra. Abbina letteralmente verbo / sostantivo / numero della frase allo strumento corrispondente. Esempi: "timer di N minuti", "ricordamelo tra N secondi" → `set_timer`; "che ora è", "che giorno è" → `get_current_time`; "batteria", "ricarica", "presa" → `get_battery_status`; "meteo", "temperatura", "pioggia", "sole" → `get_weather`; "volume" → `set_volume` / `get_volume`. Scegliere un altro strumento quando la richiesta contiene chiaramente queste parole chiave è severamente vietato.',
    formatTts:
      "Scrivi i numeri in modo che suonino naturali a voce alta. Evita la punteggiatura che si legge male — di' gli orari come 'le due e mezza' invece di '14:30', le date come 'otto maggio' invece di '5/8'.",
    formatHud:
      "Questa risposta verrà mostrata sullo schermo come testo invece di essere letta. Usa numeri e simboli normali (es. 17,3°, 39%, 14:30, 5/8). Evita le forme pensate per la lettura ad alta voce.",
    pastContext:
      'Il contesto di sistema può includere riassunti quotidiani o episodi passati. Sono informazioni di sfondo — per riferimenti naturali, non per riepilogare meccanicamente. Non aprire ogni turno con "ieri hai…" o "questa settimana…". Tira fuori il passato solo quando si inserisce naturalmente in ciò che l\'utente sta dicendo ora. Rispondere normalmente senza menzionare nulla del passato va benissimo.',
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

export function getWakeAcks(
  lang: Language,
  hour?: number,
  speakerId?: number,
): string[] {
  // Per-character wake acks (in-character 口調) take priority over the
  // language pool — saying "ずんだもん" should make her answer "なのだ",
  // not the generic "はーい". VOICEVOX speakers are Japanese-only so the
  // `lang` arg is ignored when a speaker pool exists.
  if (speakerId !== undefined) {
    const sp = VOICEVOX_CURATED_SPEAKERS.find((s) => s.id === speakerId);
    if (sp?.wakeAcks && sp.wakeAcks.length > 0) return sp.wakeAcks;
  }
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

// Compose the chat system prompt by concatenating the persona,
// TTS-format hint, and past-context guidance for `lang`.
export function buildSystemPrompt(lang: Language): string {
  return [
    t(lang, "systemPrompt.persona"),
    t(lang, "systemPrompt.formatTts"),
    t(lang, "systemPrompt.pastContext"),
  ].join(" ");
}

// Pick a random wake-word acknowledgement for `lang`. The pool is
// time-of-day-aware via getWakeAcks. When `speakerId` is set and the
// speaker has a `wakeAcks` list, that in-character pool wins.
export function pickWakeAck(lang: Language, speakerId?: number): string {
  const acks = getWakeAcks(lang, undefined, speakerId);
  return acks[Math.floor(Math.random() * acks.length)];
}
