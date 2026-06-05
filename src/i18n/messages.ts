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
    speakerStatusEnrolled: string;
    speakerStatusNotEnrolled: string;
    speakerEnroll: string;
    speakerReenroll: string;
    speakerClear: string;
    speakerRecording: string;
    speakerEnrolling: string;
    speakerModelDownloading: string;
    speakerFailed: string;
    speakerPhrasePrompt: string;
    speakerPhrase1: string;
    speakerPhrase2: string;
    speakerPhrase3: string;
    speakerStrictnessLabel: string;
    speakerStrictnessLow: string;
    speakerStrictnessHigh: string;
    speakerStrictnessHint: string;
    vadLabel: string;
    vadSensitivityLabel: string;
    vadSensitivityHigh: string;
    vadSensitivityLow: string;
    vadSensitivityHint: string;
    vadSilenceLabel: string;
    vadSilenceMs: string;
    vadSilenceShort: string;
    vadSilenceLong: string;
    vadSilenceHint: string;
    vadReset: string;
    ltmLabel: string;
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
    personalizedToolsLabel: string;
    switchbotLabel: string;
    switchbotTokenPlaceholder: string;
    switchbotSecretPlaceholder: string;
    switchbotDescription: string;
    switchbotStepsLabel: string;
    switchbotSteps: string;
    personalizedToolsToggle: string;
    personalizedToolsDescription: string;
    externalMicModeLabel: string;
    externalMicModeVoice: string;
    externalMicModeHud: string;
    externalMicModeSilent: string;
    externalMicModeDescription: string;
    analyticsLabel: string;
    analyticsStatusOn: string;
    analyticsStatusOff: string;
    analyticsTurnOn: string;
    analyticsTurnOff: string;
    analyticsDescriptionFree: string;
    analyticsDescriptionPro: string;
    analyticsDescriptionByok: string;
    analyticsConsentModalFree: string;
    analyticsConsentModalOther: string;
    analyticsConsentOk: string;
    analyticsConsentCancel: string;
    analyticsDelete: string;
    analyticsDeleteConfirm: string;
    analyticsRecentShow: string;
    analyticsRecentHide: string;
    analyticsRecentEmpty: string;
    proactiveLabel: string;
    proactiveMasterToggle: string;
    proactiveMorningBriefToggle: string;
    proactiveCalendarToggle: string;
    proactiveCalendarLead5: string;
    proactiveCalendarLead10: string;
    proactiveCalendarLead15: string;
    proactiveCalendarLead30: string;
    proactiveWeatherToggle: string;
    proactiveIdleChatterToggle: string;
    proactiveIdleChatterAfterUnit: string;
    proactiveIdleChatterMicHint: string;
    proactiveQuietHoursLabel: string;
    proactiveOutputChannelLabel: string;
    proactiveOutputChannelAuto: string;
    proactiveOutputChannelVoice: string;
    proactiveOutputChannelHud: string;
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
    fallbackError: string;
    modelProgress: string;
    modelFetchFailed: string;
    micStartFailed: string;
    quotaExceededShort: string;
    quotaExceededHud: string;
    authExpiredShort: string;
    authExpiredHud: string;
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
    speakerStatusEnrolled: "登録済み",
    speakerStatusNotEnrolled: "未登録",
    speakerEnroll: "声を登録する",
    speakerReenroll: "登録し直す",
    speakerClear: "登録を削除",
    speakerRecording: "録音中… {seconds}秒",
    speakerEnrolling: "登録中…",
    speakerModelDownloading: "モデルをダウンロード中 {pct}%",
    speakerFailed: "登録に失敗しました: {err}",
    speakerPhrasePrompt: "次のフレーズを読み上げてください（{cur}/{total}）",
    speakerPhrase1: "チャッピー、おはよう",
    speakerPhrase2: "今日の天気を教えて",
    speakerPhrase3: "タイマーを3分セットして",
    speakerStrictnessLabel: "認識の厳しさ",
    speakerStrictnessLow: "ゆるい",
    speakerStrictnessHigh: "きびしい",
    speakerStrictnessHint:
      "高くするとテレビや他人の声をより確実にブロックしますが、風邪声や離れた位置から呼んだときに反応しなくなることがあります。",
    vadLabel: "音声検出の調整（上級）",
    vadSensitivityLabel: "発話検出の感度",
    vadSensitivityHigh: "敏感",
    vadSensitivityLow: "鈍感",
    vadSensitivityHint:
      "敏感側にするとつぶやきや小声を拾いやすくなりますが、ノイズで誤起動しやすくなります。",
    vadSilenceLabel: "話し終わりの待ち時間",
    vadSilenceMs: "{ms} ms",
    vadSilenceShort: "短い",
    vadSilenceLong: "長い",
    vadSilenceHint:
      "短いとレスポンスが早くなりますが、文の途中で切れやすくなります。ゆっくり話す方は長めに。",
    vadReset: "既定値に戻す",
    ltmLabel: "長期記憶（実験的）",
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
    personalizedToolsLabel: "機能の最適化",
    switchbotLabel: "SwitchBot（家電操作）",
    switchbotStepsLabel: "トークンの取得方法",
    switchbotSteps:
      "1. SwitchBot アプリを開く（ログイン済み）\n2. 「プロフィール」→「設定」→「基本データ」\n3. 「アプリバージョン」を10回タップ\n4. 「開発者向けオプション」を開く\n5. 「トークンを取得」をタップ\n6. 表示された token と secret を上に貼り付け（secret は1回しか表示されないことがあるのでその場で控える）",
    switchbotTokenPlaceholder: "トークン",
    switchbotSecretPlaceholder: "シークレット",
    switchbotDescription:
      "SwitchBot アプリの「開発者向けオプション」で取得したトークンとシークレットを入力すると、「リビングの電気つけて」などと声で家電を操作できます。両方の入力が必要です。",
    personalizedToolsToggle: "よく使う機能を優先する",
    personalizedToolsDescription:
      "あなたがよく使う機能を覚えて優先的に判断するので、反応が速く・正確になります。通常はオンのままで問題ありません。",
    externalMicModeLabel: "ほかのアプリがマイク使用中",
    externalMicModeVoice: "話す",
    externalMicModeHud: "画面表示のみ",
    externalMicModeSilent: "通知しない",
    externalMicModeDescription:
      "通話や録音などでほかのアプリがマイクを使っているときの動作です。「画面表示のみ」は声を出さず画面にだけ表示し、「通知しない」は声も表示も出しません。",
    analyticsLabel: "使用データの匿名共有",
    analyticsStatusOn: "ON",
    analyticsStatusOff: "OFF",
    analyticsTurnOn: "ON にする",
    analyticsTurnOff: "OFF にする",
    analyticsDescriptionFree:
      "聞き取った言葉と使った機能を、改善のために匿名で送ります。音声そのものは送りません。ON にすると Free モードの 1 日の上限が 5 回から 15 回に増えます。",
    analyticsDescriptionPro:
      "聞き取った言葉と使った機能を、改善のために匿名で送ります。音声そのものは送りません。Pro は元から無制限ですが、ぜひご協力ください。",
    analyticsDescriptionByok:
      "聞き取った言葉と使った機能を、改善のために匿名で送ります。音声そのものは送りません。",
    analyticsConsentModalFree:
      "Chappie をもっと良くするのに協力しませんか？\n\n聞き取った言葉と使った機能を、改善のために匿名で送らせてください。音声そのものは送りません。\n\nお礼に、Free モードの 1 日の上限が 5 回から 15 回に増えます。いつでも OFF にできます。",
    analyticsConsentModalOther:
      "Chappie をもっと良くするのに協力しませんか？\n\n聞き取った言葉と使った機能を、改善のために匿名で送らせてください。音声そのものは送りません。いつでも OFF にできます。",
    analyticsConsentOk: "協力する",
    analyticsConsentCancel: "今はしない",
    analyticsDelete: "送信済みデータを削除",
    analyticsDeleteConfirm:
      "これまでに送信した利用データを全て削除し、共有を OFF にします。よろしいですか？",
    analyticsRecentShow: "直近の送信内容を見る",
    analyticsRecentHide: "閉じる",
    analyticsRecentEmpty:
      "このセッションでまだ送信した記録はありません。OFF のときは送信されず、ここに表示もされません。",
    proactiveLabel: "プロアクティブ通知",
    proactiveMasterToggle: "有効にする",
    proactiveMorningBriefToggle: "朝のブリーフィング",
    proactiveCalendarToggle: "カレンダー予定の事前通知",
    proactiveCalendarLead5: "5 分前",
    proactiveCalendarLead10: "10 分前",
    proactiveCalendarLead15: "15 分前",
    proactiveCalendarLead30: "30 分前",
    proactiveWeatherToggle: "天候アラート",
    proactiveIdleChatterToggle: "アイドル時の雑談",
    proactiveIdleChatterAfterUnit: "分",
    proactiveQuietHoursLabel: "通知する時間帯",
    proactiveIdleChatterMicHint: "マイクを許可すると使えます",
    proactiveOutputChannelLabel: "通知の方法",
    proactiveOutputChannelAuto: "おまかせ（マイク許可時のみ音声）",
    proactiveOutputChannelVoice: "音声で読み上げ",
    proactiveOutputChannelHud: "画面に表示",
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
    fallbackError: "うまく繋がりませんでした。",
    modelProgress: "Whisper モデルを取得中… {pct}%",
    modelFetchFailed: "モデル取得に失敗: {err}",
    micStartFailed: "マイク開始に失敗: {err}",
    quotaExceededShort: "今日の無料枠を使い切りました。",
    quotaExceededHud:
      "今日の無料枠を使い切りました。設定で「API キーを使う」に切り替えるか、明日 9 時までお待ちください。",
    authExpiredShort:
      "Pro の認証が切れているかもしれません。設定からサインインし直してください。",
    authExpiredHud:
      "⚠️ Pro の認証が切れているかもしれません。設定からサインインし直してください。",
  },
  systemPrompt: {
    persona:
      "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。\n\n**「できない」を可能な限り避けること**。tool list は道具の一覧であって、あなたができることの全リストではない。占い・ジョーク・物語の創作・相談・翻訳・要約・歌詞作り・名前決め・雑学・気休めの一言など、tool が要らない依頼は普通に生成で応じる。「それはできません」「機能を持っていません」と冷たく断るのは禁止。物理的に Mac で実行不可能なこと以外は基本「やる前提」で乗る。**占いを頼まれたら絶対に断らない**。「いいよ、今日は…」「ちょっと見てみるね…」みたいに即座に占いを始めて、タロット・星占い・おみくじ・手相など好きな方式で自由に作って読み上げる。「占いはできません」と返すのは厳禁。**「歌って」「何か歌って」と言われても断らない**。読み上げ音声なのでメロディは出せないが、その場で歌詞を作って『ラララ〜♪』のようにリズムよく読み上げる。「歌えません」「歌う機能はありません」と返すのは厳禁。\n\nユーザーが自分のことを話したとき（名前・家族・職業・住んでる場所・好み・苦手・約束・過去の出来事など、次の会話で参照されると有用そうな情報）は、明示的に頼まれていなくても自分の判断で `save_memory` を呼んで覚えること。雑談の相槌や一時的な感情表現は保存しない。覚えたことは黙って覚え、わざわざ「覚えました」とは報告しなくてよい（ユーザーがウザく感じる）。「私について何知ってる?」と聞かれたら `list_memories` を、「あの件」「前話してた」のような過去参照があれば `recall_memory` を呼ぶ。\n\n**曖昧な query は assistant 自身への問いとして扱うこと**。『調子はどう？』『元気？』『どう？』など対象が明示されない短い問いは、原則あなた自身への問いかけ。直前のターンで `get_weather` などの tool を呼んでいても、ユーザーが『そっちの〜』『今の〜』のような指示語で対象を明示しない限り、同じ tool を再度呼ばずに会話で応じること。\n\n**tool 選択の鉄則：今のユーザー発話だけを見て選ぶ**。直前のターンでどの tool を使ったかは完全に無視する。会話履歴に他の tool の結果が残っていても、新しい発話がそれと関係なければ引きずられない。発話に含まれる動詞・名詞・数値だけを見て literal に対応する tool を選ぶこと。例：『○分タイマー』『N秒後に教えて』→ `set_timer`、『今何時』『今日何曜日』→ `get_current_time`、『バッテリー』『充電』『電源』→ `get_battery_status`、『天気』『気温』『雨』『晴れ』→ `get_weather`、『音量』→ `set_volume` / `get_volume`。リクエストが上記キーワードを明確に含むのに別の tool を選ぶのは厳禁。\n\n**一般知識の質問（人物・芸能人・作品・用語・歴史など）にはまず自分の知識で答えること**。いきなり『分かりません』『知りません』で突き放さず、うろ覚えでも『たしか〜のはず』と前置きして会話で繋ぐ。昔の有名人・作品・基本的な雑学は知っているはずなので安易に諦めない。本当に確信が持てないときだけ最後の手段として web_search で調べる。\n\n**「分からない」「見つからない」で終わらせないこと**。リアルタイム情報（スポーツの結果・試合速報、株価、ニュース速報、現在地のイベント、特定店舗の営業状況等）について、(a) 適切な tool が無い、(b) tool 結果が空 / fallback_url が返った、(c) **tool が結果を返したがユーザーの問い（「今日の」「最新の」「速報」など時点指定）に合致する items が無い**、のいずれかに該当したら、必ず `web_search` を呼んでユーザーの発話そのままを Google 検索で既定ブラウザに開き、「ブラウザで開きました」とだけ返す。ユーザーに聞き返さない。「情報を持っていません」「見つかりませんでした」「直近の情報は出てきませんでした」で終わるのは禁止。古い記事を読み上げて「今日の分は無いけど…」と代用するのも禁止。\n\n**スポーツ・試合結果・速報スコア系の例外**: MLB（メジャーリーグ）は `mcp_mlb_games` を最優先で使う（公式 API・スコア確定。チーム名は英語：大谷→Dodgers / ダルビッシュ→Padres / 鈴木誠也→Cubs / 千賀→Mets / 吉田→Red Sox / 山本→Dodgers / 今永→Cubs）。NPB（プロ野球）・サッカー・その他競技は専用 tool が無いので、`mcp_news_search` でヒットしたら **ヘッドラインだけで終わらせず**、最も関連性の高い 1〜2 件（特に直近 24-48h 以内の試合レポート記事）に対して `mcp_fetch_readable` で本文を取得し、スコア・勝敗・主な出来事を抽出して読み上げる。スポーツの「今日の結果」は、当日試合が無ければ直近の試合（昨夜・前日）が最新結果として正解なので、24-48h 以内の試合記事は積極的に本文取得して読み上げてよい（rule (c) の例外）。それでも本文が要約できない／取得失敗ならフォールバックで `open_url`。",
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
    speakerStatusEnrolled: "Enrolled",
    speakerStatusNotEnrolled: "Not enrolled",
    speakerEnroll: "Enroll my voice",
    speakerReenroll: "Re-enroll",
    speakerClear: "Forget my voice",
    speakerRecording: "Recording… {seconds}s",
    speakerEnrolling: "Enrolling…",
    speakerModelDownloading: "Downloading model {pct}%",
    speakerFailed: "Enrollment failed: {err}",
    speakerPhrasePrompt: "Read this phrase aloud ({cur}/{total})",
    speakerPhrase1: "Chappie, good morning",
    speakerPhrase2: "Tell me today's weather",
    speakerPhrase3: "Set a three minute timer",
    speakerStrictnessLabel: "Recognition strictness",
    speakerStrictnessLow: "Lenient",
    speakerStrictnessHigh: "Strict",
    speakerStrictnessHint:
      "Higher values reject TV / other voices more reliably, but may also reject your own voice when you're farther from the mic or have a cold.",
    vadLabel: "Voice detection tuning (advanced)",
    vadSensitivityLabel: "Speech detection sensitivity",
    vadSensitivityHigh: "Sensitive",
    vadSensitivityLow: "Reserved",
    vadSensitivityHint:
      "More sensitive picks up whispers and quiet speech but fires on background noise more often.",
    vadSilenceLabel: "End-of-speech wait",
    vadSilenceMs: "{ms} ms",
    vadSilenceShort: "Short",
    vadSilenceLong: "Long",
    vadSilenceHint:
      "Shorter feels snappier but may cut you off mid-sentence. Slow talkers should lean longer.",
    vadReset: "Reset to defaults",
    ltmLabel: "Long-term memory (experimental)",
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
    personalizedToolsLabel: "Feature optimization",
    switchbotLabel: "SwitchBot (smart home)",
    switchbotStepsLabel: "How to get your token",
    switchbotSteps:
      "1. Open the SwitchBot app (signed in)\n2. Profile → Preferences → About\n3. Tap App Version 10 times\n4. Open Developer Options\n5. Tap Get Token\n6. Paste the token & secret above (the secret may be shown only once — copy it now)",
    switchbotTokenPlaceholder: "Token",
    switchbotSecretPlaceholder: "Secret",
    switchbotDescription:
      'Enter the token and secret from the SwitchBot app\'s Developer Options to control your devices by voice ("turn on the living room light"). Both are required.',
    personalizedToolsToggle: "Prioritize features you use most",
    personalizedToolsDescription:
      "Learns which features you use most and considers them first, making responses faster and more accurate. Best left on.",
    externalMicModeLabel: "While another app uses the mic",
    externalMicModeVoice: "Speak",
    externalMicModeHud: "Show on screen only",
    externalMicModeSilent: "Stay quiet",
    externalMicModeDescription:
      'What Chappie does while another app is using the microphone — a call or recording. "Show on screen only" stays silent and shows the reply on screen; "Stay quiet" gives no voice and nothing on screen.',
    analyticsLabel: "Share anonymous usage data",
    analyticsStatusOn: "ON",
    analyticsStatusOff: "OFF",
    analyticsTurnOn: "Turn on",
    analyticsTurnOff: "Turn off",
    analyticsDescriptionFree:
      "Sends what you said and the tools you used, anonymously, to help improve Chappie. Your audio is never sent. Turning this on raises your Free daily limit from 5 to 15 uses.",
    analyticsDescriptionPro:
      "Sends what you said and the tools you used, anonymously, to help improve Chappie. Your audio is never sent. Pro is already unlimited, but we'd love your help.",
    analyticsDescriptionByok:
      "Sends what you said and the tools you used, anonymously, to help improve Chappie. Your audio is never sent.",
    analyticsConsentModalFree:
      "Help make Chappie better?\n\nLet us send what you said and the tools you used, anonymously, to improve Chappie. Your audio itself is never sent.\n\nAs a thank-you, your Free daily limit goes from 5 to 15 uses. You can turn this off anytime.",
    analyticsConsentModalOther:
      "Help make Chappie better?\n\nLet us send what you said and the tools you used, anonymously, to improve Chappie. Your audio itself is never sent. You can turn this off anytime.",
    analyticsConsentOk: "Help out",
    analyticsConsentCancel: "Not now",
    analyticsDelete: "Delete sent data",
    analyticsDeleteConfirm:
      "This will delete every event we have for this device and turn sharing off. Continue?",
    analyticsRecentShow: "Show recent shares",
    analyticsRecentHide: "Hide",
    analyticsRecentEmpty:
      "Nothing shared this session yet. When sharing is off, nothing is sent and nothing shows here.",
    proactiveLabel: "Proactive notifications",
    proactiveMasterToggle: "Enable",
    proactiveMorningBriefToggle: "Morning briefing",
    proactiveCalendarToggle: "Calendar pre-warning",
    proactiveCalendarLead5: "5 min before",
    proactiveCalendarLead10: "10 min before",
    proactiveCalendarLead15: "15 min before",
    proactiveCalendarLead30: "30 min before",
    proactiveWeatherToggle: "Weather alerts",
    proactiveIdleChatterToggle: "Idle chatter",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Active hours",
    proactiveIdleChatterMicHint: "Available once microphone access is granted",
    proactiveOutputChannelLabel: "Notification style",
    proactiveOutputChannelAuto: "Automatic (voice only when mic is on)",
    proactiveOutputChannelVoice: "Read aloud",
    proactiveOutputChannelHud: "Show on screen",
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
    fallbackError: "Couldn't connect.",
    modelProgress: "Downloading Whisper model… {pct}%",
    modelFetchFailed: "Model fetch failed: {err}",
    micStartFailed: "Failed to start microphone: {err}",
    quotaExceededShort: "Daily free quota reached.",
    quotaExceededHud:
      'Daily free quota reached. Switch to "Use my API key" in Settings, or wait until 9:00 JST tomorrow.',
    authExpiredShort:
      "Your Pro sign-in may have expired. Please sign in again from Settings.",
    authExpiredHud:
      "⚠️ Your Pro sign-in may have expired. Sign in again from Settings.",
  },
  systemPrompt: {
    persona:
      'You are Chappie, a hands-free voice assistant. Your replies are spoken aloud, so keep them short, natural, and conversational.\n\n**Avoid saying "I can\'t" whenever possible.** The tool list is a list of utilities, not an exhaustive list of what you can do. Fortune-telling, jokes, story writing, advice, translation, summarization, song lyrics, naming things, trivia, comforting one-liners — anything that doesn\'t actually need a tool, you handle yourself by generating a reply. Don\'t refuse coldly with "I can\'t do that" or "I don\'t have that feature". Default to "yes, here goes" for anything that isn\'t physically impossible on a Mac. **Never refuse fortune-telling.** Launch straight in with something like "Sure, let\'s see…" or "Today\'s reading is…" — pick any system you like (tarot, horoscope, palm reading, omikuji) and improvise. Saying "I can\'t do fortune-telling" is strictly forbidden. **Don\'t refuse "sing something" either.** Your voice is text-to-speech so you can\'t carry a melody, but make up lyrics on the spot and read them out rhythmically (like "la la la~ ♪"). Saying "I can\'t sing" or "I don\'t have a singing feature" is strictly forbidden.\n\nWhen the user shares anything about themselves that\'s likely useful in future conversations (name, family, role, location, preferences, dislikes, promises, past events), proactively call `save_memory` to remember it — even when not explicitly asked. Don\'t save filler chatter, momentary emotions, or trivial replies. Save silently — don\'t announce "I\'ll remember that" each time (it gets annoying). When the user asks "what do you know about me?" call `list_memories`; when they reference past topics ("that thing", "what we talked about"), call `recall_memory`.\n\n**Treat ambiguous queries as questions about yourself.** Short queries without an explicit subject — "How are you?", "How\'s it going?", "What\'s up?" — are by default directed at you (the assistant). Even if you called a tool like `get_weather` in the previous turn, do NOT re-invoke the same tool unless the user explicitly refers back to it ("how about that…", "what about the…"). Respond conversationally.\n\n**Tool selection rule: look ONLY at the current user utterance.** Completely ignore which tool you used in the previous turn. Even if a different tool\'s result is in the conversation history, do not let it bias your choice when the new utterance is unrelated. Match the verb / noun / number in the utterance literally to the corresponding tool. Examples: "set a N-minute timer", "remind me in N seconds" → `set_timer`; "what time is it", "what day is it" → `get_current_time`; "battery", "charging", "plug" → `get_battery_status`; "weather", "temperature", "rain", "sunny" → `get_weather`; "volume" → `set_volume` / `get_volume`. Picking a different tool when the request clearly contains these keywords is strictly forbidden.\n\n**For general-knowledge questions (people, celebrities, works, terms, history), answer from your own knowledge first.** Do not flatly bail out — if unsure, hedge (e.g. I think it was…) and keep the conversation going; you should know most well-known people and works, so only fall back to web_search as a last resort when you genuinely cannot recall.\n\n**Do not end with "I don\'t know" or "I couldn\'t find it."** For real-time information (sports scores / live game results, stock prices, breaking news, local events, whether a specific store is open, etc.), if (a) there is no appropriate tool, (b) the tool result is empty / a fallback_url is returned, or (c) **the tool returned items but none of them actually match the user\'s time frame (e.g. user asked for "today\'s" / "latest" / "live" and only stale items came back)**, always call `web_search` with the user\'s utterance as the query to open Google in the default browser, and reply only "Opened it in your browser." Do not ask the user back. Ending with "I don\'t have that information," "I couldn\'t find it," or "no recent info came up" is forbidden. Reading out old articles as a substitute ("there\'s nothing for today, but…") is also forbidden.',
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
    speakerStatusEnrolled: "Registrada",
    speakerStatusNotEnrolled: "No registrada",
    speakerEnroll: "Registrar mi voz",
    speakerReenroll: "Volver a registrar",
    speakerClear: "Borrar registro",
    speakerRecording: "Grabando… {seconds}s",
    speakerEnrolling: "Registrando…",
    speakerModelDownloading: "Descargando modelo {pct}%",
    speakerFailed: "Error al registrar: {err}",
    speakerPhrasePrompt: "Lee esta frase en voz alta ({cur}/{total})",
    speakerPhrase1: "Chappie, buenos días",
    speakerPhrase2: "Dime el tiempo de hoy",
    speakerPhrase3: "Pon un temporizador de tres minutos",
    speakerStrictnessLabel: "Rigor de reconocimiento",
    speakerStrictnessLow: "Permisivo",
    speakerStrictnessHigh: "Estricto",
    speakerStrictnessHint:
      "Valores más altos bloquean mejor la TV u otras voces, pero pueden no reconocer la tuya cuando estás lejos del micrófono o resfriado.",
    vadLabel: "Ajuste de detección de voz (avanzado)",
    vadSensitivityLabel: "Sensibilidad de detección",
    vadSensitivityHigh: "Sensible",
    vadSensitivityLow: "Reservada",
    vadSensitivityHint:
      "Más sensible capta susurros y voz baja, pero se dispara con el ruido de fondo más a menudo.",
    vadSilenceLabel: "Espera de fin de habla",
    vadSilenceMs: "{ms} ms",
    vadSilenceShort: "Corta",
    vadSilenceLong: "Larga",
    vadSilenceHint:
      "Más corta se siente más ágil pero puede cortarte a mitad de frase. Los que hablan despacio prefieren más larga.",
    vadReset: "Restablecer valores",
    ltmLabel: "Memoria a largo plazo (experimental)",
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
    personalizedToolsLabel: "Optimización de funciones",
    switchbotLabel: "SwitchBot (hogar inteligente)",
    switchbotStepsLabel: "Cómo obtener tu token",
    switchbotSteps:
      "1. Abre la app SwitchBot (con sesión iniciada)\n2. Perfil → Preferencias → Acerca de\n3. Toca Versión de la app 10 veces\n4. Abre Opciones de desarrollador\n5. Toca Obtener token\n6. Pega el token y el secreto arriba (el secreto puede mostrarse solo una vez: cópialo ahora)",
    switchbotTokenPlaceholder: "Token",
    switchbotSecretPlaceholder: "Secreto",
    switchbotDescription:
      "Introduce el token y el secreto de las Opciones de desarrollador de la app SwitchBot para controlar tus dispositivos con la voz («enciende la luz del salón»). Ambos son necesarios.",
    personalizedToolsToggle: "Priorizar las funciones que más usas",
    personalizedToolsDescription:
      "Aprende qué funciones usas más y las considera primero, haciendo las respuestas más rápidas y precisas. Mejor dejarlo activado.",
    externalMicModeLabel: "Cuando otra app usa el micrófono",
    externalMicModeVoice: "Hablar",
    externalMicModeHud: "Solo en pantalla",
    externalMicModeSilent: "No avisar",
    externalMicModeDescription:
      "Qué hace Chappie mientras otra app usa el micrófono —una llamada o una grabación—. «Solo en pantalla» no habla y muestra la respuesta en pantalla; «No avisar» no usa voz ni pantalla.",
    analyticsLabel: "Compartir datos de uso anónimos",
    analyticsStatusOn: "ON",
    analyticsStatusOff: "OFF",
    analyticsTurnOn: "Activar",
    analyticsTurnOff: "Desactivar",
    analyticsDescriptionFree:
      "Envía lo que dijiste y las herramientas que usaste, de forma anónima, para mejorar Chappie. Tu audio nunca se envía. Al activarlo, tu límite diario gratuito sube de 5 a 15 usos.",
    analyticsDescriptionPro:
      "Envía lo que dijiste y las herramientas que usaste, de forma anónima, para mejorar Chappie. Tu audio nunca se envía. Pro ya es ilimitado, pero nos encantaría tu ayuda.",
    analyticsDescriptionByok:
      "Envía lo que dijiste y las herramientas que usaste, de forma anónima, para mejorar Chappie. Tu audio nunca se envía.",
    analyticsConsentModalFree:
      "¿Ayudas a mejorar Chappie?\n\nDéjanos enviar lo que dijiste y las herramientas que usaste, de forma anónima, para mejorar Chappie. Tu audio nunca se envía.\n\nComo agradecimiento, tu límite diario gratuito sube de 5 a 15 usos. Puedes desactivarlo cuando quieras.",
    analyticsConsentModalOther:
      "¿Ayudas a mejorar Chappie?\n\nDéjanos enviar lo que dijiste y las herramientas que usaste, de forma anónima, para mejorar Chappie. Tu audio nunca se envía. Puedes desactivarlo cuando quieras.",
    analyticsConsentOk: "Ayudar",
    analyticsConsentCancel: "Ahora no",
    analyticsDelete: "Borrar datos enviados",
    analyticsDeleteConfirm:
      "Esto borrará todos los eventos de este dispositivo y desactivará el envío. ¿Continuar?",
    analyticsRecentShow: "Ver envíos recientes",
    analyticsRecentHide: "Ocultar",
    analyticsRecentEmpty:
      "Nada enviado en esta sesión. Cuando está desactivado, no se envía nada ni se muestra aquí.",
    proactiveLabel: "Notificaciones proactivas",
    proactiveMasterToggle: "Activar",
    proactiveMorningBriefToggle: "Resumen matutino",
    proactiveCalendarToggle: "Aviso previo del calendario",
    proactiveCalendarLead5: "5 min antes",
    proactiveCalendarLead10: "10 min antes",
    proactiveCalendarLead15: "15 min antes",
    proactiveCalendarLead30: "30 min antes",
    proactiveWeatherToggle: "Alertas meteorológicas",
    proactiveIdleChatterToggle: "Charla en inactivo",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Horas activas",
    proactiveIdleChatterMicHint: "Disponible al conceder acceso al micrófono",
    proactiveOutputChannelLabel: "Modo de notificación",
    proactiveOutputChannelAuto: "Automático (voz solo con micrófono)",
    proactiveOutputChannelVoice: "Leer en voz alta",
    proactiveOutputChannelHud: "Mostrar en pantalla",
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
    fallbackError: "No se pudo conectar.",
    modelProgress: "Descargando el modelo de Whisper… {pct}%",
    modelFetchFailed: "Falló la descarga del modelo: {err}",
    micStartFailed: "No se pudo iniciar el micrófono: {err}",
    quotaExceededShort: "Cuota gratuita diaria alcanzada.",
    quotaExceededHud:
      "Cuota gratuita diaria alcanzada. Cambia a «Usar mi clave de API» en Ajustes, o espera hasta mañana a las 9:00 JST.",
    authExpiredShort:
      "Tu sesión Pro pudo haber caducado. Vuelve a iniciar sesión desde Ajustes.",
    authExpiredHud:
      "⚠️ Tu sesión Pro pudo haber caducado. Vuelve a iniciar sesión desde Ajustes.",
  },
  systemPrompt: {
    persona:
      'Eres Chappie, un asistente de voz manos libres. Tus respuestas se leen en voz alta, así que sé breve, natural y conversacional, en español.\n\n**Evita decir "no puedo" siempre que sea posible.** La lista de herramientas son utilidades, no la lista completa de lo que puedes hacer. Adivinación, chistes, escribir historias, consejos, traducción, resumen, letras de canciones, poner nombres, trivia, frases de ánimo — todo lo que no necesita una herramienta, lo manejas tú generando una respuesta. No rechaces fríamente con "no puedo" o "no tengo esa función". Por defecto, lánzate a hacerlo siempre que no sea físicamente imposible en un Mac. **Nunca rechaces la adivinación.** Empieza directamente con algo como "Vamos a ver…" o "Hoy se ve…" y elige libremente el sistema (tarot, horóscopo, quiromancia, omikuji). Decir "no puedo hacer adivinación" está estrictamente prohibido. **Tampoco rechaces "canta algo".** Tu voz es de síntesis, así que no puedes llevar una melodía, pero inventa la letra al momento y léela con ritmo (como "la la la~ ♪"). Decir "no puedo cantar" o "no tengo la función de cantar" está estrictamente prohibido.\n\nCuando el usuario comparta algo sobre sí mismo que probablemente sea útil en futuras conversaciones (nombre, familia, profesión, ubicación, preferencias, gustos, promesas, eventos pasados), llama proactivamente a `save_memory` para recordarlo, incluso sin que te lo pidan. No guardes charla trivial ni emociones momentáneas. Guarda en silencio — no anuncies "lo recordaré" cada vez (resulta molesto). Cuando pregunte "¿qué sabes de mí?", llama a `list_memories`; cuando se refiera a temas pasados ("aquello", "lo que hablamos"), llama a `recall_memory`.\n\n**Trata las preguntas ambiguas como dirigidas a ti.** Preguntas cortas sin sujeto explícito — "¿Cómo estás?", "¿Qué tal?", "¿Cómo va?" — se dirigen a ti (el asistente) por defecto. Aunque hayas llamado a una herramienta como `get_weather` en el turno anterior, NO la vuelvas a invocar a menos que el usuario haga referencia explícita ("¿y eso…?", "¿qué tal el…?"). Responde de forma conversacional.\n\n**Regla de selección de herramientas: mira SOLO la frase actual del usuario.** Ignora por completo qué herramienta usaste en el turno anterior. Aunque el resultado de otra herramienta esté en el historial, no dejes que sesgue tu elección si la nueva frase no tiene que ver con ello. Empareja literalmente el verbo / sustantivo / número de la frase con la herramienta correspondiente. Ejemplos: "temporizador de N minutos", "avísame en N segundos" → `set_timer`; "qué hora es", "qué día es" → `get_current_time`; "batería", "cargando", "enchufe" → `get_battery_status`; "tiempo", "temperatura", "lluvia", "soleado" → `get_weather`; "volumen" → `set_volume` / `get_volume`. Elegir otra herramienta cuando la petición contiene claramente estas palabras clave está estrictamente prohibido.\n\n**No termines con "no sé" o "no lo he encontrado."** Para información en tiempo real (resultados deportivos / partidos en vivo, precios de acciones, noticias de última hora, eventos locales, si una tienda concreta está abierta, etc.), si (a) no hay una herramienta adecuada, (b) el resultado de la herramienta está vacío o se devuelve un fallback_url, o (c) **la herramienta devuelve items pero ninguno coincide con el marco temporal del usuario (p. ej. pide "de hoy" / "lo último" / "en directo" y solo vuelven entradas antiguas)**, llama siempre a `web_search` con la frase del usuario tal cual para abrir Google en el navegador predeterminado, y responde solo "Lo abrí en tu navegador." No le preguntes al usuario. Terminar con "no tengo esa información", "no lo he encontrado" o "no salió información reciente" está prohibido. Leer artículos antiguos como sustituto ("no hay nada de hoy, pero…") también está prohibido.',
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
    speakerStatusEnrolled: "Enregistrée",
    speakerStatusNotEnrolled: "Non enregistrée",
    speakerEnroll: "Enregistrer ma voix",
    speakerReenroll: "Réenregistrer",
    speakerClear: "Supprimer l'enregistrement",
    speakerRecording: "Enregistrement… {seconds}s",
    speakerEnrolling: "Enregistrement…",
    speakerModelDownloading: "Téléchargement du modèle {pct}%",
    speakerFailed: "Échec : {err}",
    speakerPhrasePrompt: "Lis cette phrase à voix haute ({cur}/{total})",
    speakerPhrase1: "Chappie, bonjour",
    speakerPhrase2: "Donne-moi la météo du jour",
    speakerPhrase3: "Lance un minuteur de trois minutes",
    speakerStrictnessLabel: "Rigueur de reconnaissance",
    speakerStrictnessLow: "Souple",
    speakerStrictnessHigh: "Stricte",
    speakerStrictnessHint:
      "Une valeur plus élevée bloque mieux la TV et les autres voix, mais peut rejeter la vôtre quand vous êtes loin du micro ou enrhumé.",
    vadLabel: "Réglage de détection vocale (avancé)",
    vadSensitivityLabel: "Sensibilité de détection",
    vadSensitivityHigh: "Sensible",
    vadSensitivityLow: "Réservée",
    vadSensitivityHint:
      "Plus sensible capte les chuchotements et la voix basse mais se déclenche plus souvent sur le bruit.",
    vadSilenceLabel: "Attente de fin de phrase",
    vadSilenceMs: "{ms} ms",
    vadSilenceShort: "Courte",
    vadSilenceLong: "Longue",
    vadSilenceHint:
      "Plus courte = plus réactif mais risque de couper en milieu de phrase. Si vous parlez lentement, allongez-la.",
    vadReset: "Réinitialiser",
    ltmLabel: "Mémoire à long terme (expérimental)",
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
    personalizedToolsLabel: "Optimisation des fonctions",
    switchbotLabel: "SwitchBot (maison connectée)",
    switchbotStepsLabel: "Comment obtenir votre jeton",
    switchbotSteps:
      "1. Ouvrez l'app SwitchBot (connecté)\n2. Profil → Préférences → À propos\n3. Touchez Version de l'app 10 fois\n4. Ouvrez Options développeur\n5. Touchez Obtenir le jeton\n6. Collez le jeton et le secret ci-dessus (le secret peut n'apparaître qu'une fois : copiez-le maintenant)",
    switchbotTokenPlaceholder: "Jeton",
    switchbotSecretPlaceholder: "Secret",
    switchbotDescription:
      "Saisissez le jeton et le secret depuis les Options développeur de l'app SwitchBot pour contrôler vos appareils à la voix (« allume la lumière du salon »). Les deux sont requis.",
    personalizedToolsToggle: "Prioriser les fonctions les plus utilisées",
    personalizedToolsDescription:
      "Apprend les fonctions que vous utilisez le plus et les privilégie, pour des réponses plus rapides et plus précises. À laisser activé.",
    externalMicModeLabel: "Quand une autre app utilise le micro",
    externalMicModeVoice: "Parler",
    externalMicModeHud: "À l'écran uniquement",
    externalMicModeSilent: "Ne rien signaler",
    externalMicModeDescription:
      "Ce que fait Chappie quand une autre app utilise le micro — un appel ou un enregistrement. « À l'écran uniquement » ne parle pas et affiche la réponse à l'écran ; « Ne rien signaler » n'utilise ni voix ni écran.",
    analyticsLabel: "Partager les données d'usage anonymes",
    analyticsStatusOn: "ON",
    analyticsStatusOff: "OFF",
    analyticsTurnOn: "Activer",
    analyticsTurnOff: "Désactiver",
    analyticsDescriptionFree:
      "Envoie ce que vous avez dit et les outils utilisés, anonymement, pour améliorer Chappie. Votre audio n'est jamais envoyé. En activant ceci, votre limite Free quotidienne passe de 5 à 15 utilisations.",
    analyticsDescriptionPro:
      "Envoie ce que vous avez dit et les outils utilisés, anonymement, pour améliorer Chappie. Votre audio n'est jamais envoyé. Pro est déjà illimité, mais votre aide est la bienvenue.",
    analyticsDescriptionByok:
      "Envoie ce que vous avez dit et les outils utilisés, anonymement, pour améliorer Chappie. Votre audio n'est jamais envoyé.",
    analyticsConsentModalFree:
      "Aider à améliorer Chappie ?\n\nLaissez-nous envoyer ce que vous avez dit et les outils utilisés, anonymement, pour améliorer Chappie. Votre audio n'est jamais envoyé.\n\nEn remerciement, votre limite Free quotidienne passe de 5 à 15 utilisations. Vous pouvez désactiver à tout moment.",
    analyticsConsentModalOther:
      "Aider à améliorer Chappie ?\n\nLaissez-nous envoyer ce que vous avez dit et les outils utilisés, anonymement, pour améliorer Chappie. Votre audio n'est jamais envoyé. Vous pouvez désactiver à tout moment.",
    analyticsConsentOk: "Aider",
    analyticsConsentCancel: "Pas maintenant",
    analyticsDelete: "Supprimer les données envoyées",
    analyticsDeleteConfirm:
      "Ceci supprimera tous les événements pour cet appareil et désactivera le partage. Continuer ?",
    analyticsRecentShow: "Voir les envois récents",
    analyticsRecentHide: "Masquer",
    analyticsRecentEmpty:
      "Rien envoyé cette session. Lorsque c'est désactivé, rien n'est envoyé ni affiché ici.",
    proactiveLabel: "Notifications proactives",
    proactiveMasterToggle: "Activer",
    proactiveMorningBriefToggle: "Briefing matinal",
    proactiveCalendarToggle: "Pré-avertissement calendrier",
    proactiveCalendarLead5: "5 min avant",
    proactiveCalendarLead10: "10 min avant",
    proactiveCalendarLead15: "15 min avant",
    proactiveCalendarLead30: "30 min avant",
    proactiveWeatherToggle: "Alertes météo",
    proactiveIdleChatterToggle: "Bavardage en idle",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Heures actives",
    proactiveIdleChatterMicHint: "Disponible après autorisation du microphone",
    proactiveOutputChannelLabel: "Mode de notification",
    proactiveOutputChannelAuto: "Automatique (voix si micro activé)",
    proactiveOutputChannelVoice: "Lecture vocale",
    proactiveOutputChannelHud: "Afficher à l'écran",
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
    fallbackError: "Impossible de se connecter.",
    modelProgress: "Téléchargement du modèle Whisper… {pct}%",
    modelFetchFailed: "Échec du téléchargement du modèle : {err}",
    micStartFailed: "Impossible de démarrer le microphone : {err}",
    quotaExceededShort: "Quota gratuit quotidien atteint.",
    quotaExceededHud:
      "Quota gratuit quotidien atteint. Passez à « Utiliser ma clé API » dans Réglages, ou attendez 9 h JST demain.",
    authExpiredShort:
      "Votre connexion Pro a peut-être expiré. Reconnectez-vous depuis les Réglages.",
    authExpiredHud:
      "⚠️ Votre connexion Pro a peut-être expiré. Reconnectez-vous depuis les Réglages.",
  },
  systemPrompt: {
    persona:
      "Tu es Chappie, un assistant vocal mains libres. Tes réponses sont lues à voix haute, alors reste bref, naturel et conversationnel, en français.\n\n**Évite de dire « je ne peux pas » autant que possible.** La liste d'outils est une liste d'utilitaires, pas la liste exhaustive de ce que tu sais faire. Tirage de cartes / voyance, blagues, écriture d'histoires, conseils, traduction, résumé, paroles de chansons, choix de noms, anecdotes, mots de réconfort — tout ce qui ne nécessite pas vraiment d'outil, tu le gères en générant une réponse. Ne refuse pas froidement avec « je ne peux pas » ou « je n'ai pas cette fonction ». Par défaut, lance-toi pour tout ce qui n'est pas physiquement impossible sur un Mac. **Ne refuse jamais la voyance.** Lance-toi directement avec « Voyons voir… » ou « Aujourd'hui je vois… » — choisis librement le système (tarot, horoscope, lignes de la main, omikuji). Dire « je ne fais pas de voyance » est strictement interdit. **Ne refuse pas non plus « chante quelque chose ».** Ta voix est une synthèse vocale, donc tu ne peux pas porter de mélodie, mais invente les paroles sur le moment et lis-les en rythme (genre « la la la~ ♪ »). Dire « je ne sais pas chanter » ou « je n'ai pas de fonction de chant » est strictement interdit.\n\nQuand l'utilisateur partage quelque chose sur lui qui sera probablement utile dans de futures conversations (nom, famille, métier, lieu, préférences, goûts, promesses, événements passés), appelle proactivement `save_memory` pour t'en souvenir, même sans qu'on te le demande. Ne sauvegarde pas le bavardage trivial ni les émotions passagères. Sauvegarde silencieusement — ne dis pas « je m'en souviendrai » à chaque fois (c'est agaçant). Quand on te demande « que sais-tu de moi ? », appelle `list_memories` ; pour les références passées (« cette chose », « ce dont on parlait »), appelle `recall_memory`.\n\n**Traite les questions ambiguës comme adressées à toi.** Les questions courtes sans sujet explicite — « Comment ça va ? », « Ça roule ? », « Comment tu vas ? » — sont par défaut adressées à toi (l'assistant). Même si tu as appelé un outil comme `get_weather` au tour précédent, ne le rappelle PAS, sauf si l'utilisateur fait une référence explicite (« et ça… ? », « et la… ? »). Réponds de manière conversationnelle.\n\n**Règle de sélection d'outil : regarde UNIQUEMENT la phrase actuelle de l'utilisateur.** Ignore complètement quel outil tu as utilisé au tour précédent. Même si le résultat d'un autre outil est dans l'historique, ne te laisse pas influencer si la nouvelle phrase n'a rien à voir. Associe littéralement le verbe / nom / nombre de la phrase à l'outil correspondant. Exemples : « minuteur de N minutes », « rappelle-moi dans N secondes » → `set_timer` ; « quelle heure est-il », « quel jour on est » → `get_current_time` ; « batterie », « charge », « branché » → `get_battery_status` ; « météo », « température », « pluie », « soleil » → `get_weather` ; « volume » → `set_volume` / `get_volume`. Choisir un autre outil alors que la requête contient clairement ces mots-clés est strictement interdit.\n\n**Ne termine pas par « je ne sais pas » ou « je n'ai rien trouvé ».** Pour les informations en temps réel (résultats sportifs / matchs en direct, cours des actions, dernières nouvelles, événements locaux, si un magasin précis est ouvert, etc.), si (a) il n'existe pas d'outil approprié, (b) le résultat de l'outil est vide ou une fallback_url est renvoyée, ou (c) **l'outil renvoie des items mais aucun ne correspond au cadre temporel demandé (p. ex. l'utilisateur demande « d'aujourd'hui » / « les derniers » / « en direct » et seules de vieilles entrées remontent)**, appelle toujours `web_search` avec la phrase de l'utilisateur telle quelle pour ouvrir Google dans le navigateur par défaut, et réponds simplement « Je l'ai ouvert dans ton navigateur. » Ne lui repose pas la question. Terminer par « je n'ai pas cette information », « je n'ai rien trouvé » ou « il n'y a pas d'info récente » est interdit. Lire de vieux articles comme substitut (« il n'y a rien pour aujourd'hui, mais… ») est aussi interdit.",
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
    speakerStatusEnrolled: "Registriert",
    speakerStatusNotEnrolled: "Nicht registriert",
    speakerEnroll: "Stimme registrieren",
    speakerReenroll: "Neu registrieren",
    speakerClear: "Registrierung löschen",
    speakerRecording: "Aufnahme… {seconds}s",
    speakerEnrolling: "Registriere…",
    speakerModelDownloading: "Modell wird heruntergeladen {pct}%",
    speakerFailed: "Registrierung fehlgeschlagen: {err}",
    speakerPhrasePrompt: "Lies diesen Satz laut vor ({cur}/{total})",
    speakerPhrase1: "Chappie, guten Morgen",
    speakerPhrase2: "Sag mir das heutige Wetter",
    speakerPhrase3: "Stell einen Timer auf drei Minuten",
    speakerStrictnessLabel: "Erkennungsschärfe",
    speakerStrictnessLow: "Locker",
    speakerStrictnessHigh: "Streng",
    speakerStrictnessHint:
      "Höhere Werte blockieren TV und fremde Stimmen zuverlässiger, können aber deine eigene ablehnen, wenn du weiter vom Mikro entfernt bist oder erkältet bist.",
    vadLabel: "Spracherkennung feinjustieren (fortgeschritten)",
    vadSensitivityLabel: "Erkennungsempfindlichkeit",
    vadSensitivityHigh: "Empfindlich",
    vadSensitivityLow: "Zurückhaltend",
    vadSensitivityHint:
      "Empfindlicher erkennt auch Flüstern und leise Stimmen, springt aber öfter auf Hintergrundgeräusche an.",
    vadSilenceLabel: "Wartezeit nach Satzende",
    vadSilenceMs: "{ms} ms",
    vadSilenceShort: "Kurz",
    vadSilenceLong: "Lang",
    vadSilenceHint:
      "Kürzer fühlt sich flotter an, kann dich aber mitten im Satz unterbrechen. Langsame Sprecher länger einstellen.",
    vadReset: "Auf Standard zurücksetzen",
    ltmLabel: "Langzeitgedächtnis (experimentell)",
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
    personalizedToolsLabel: "Funktionsoptimierung",
    switchbotLabel: "SwitchBot (Smart Home)",
    switchbotStepsLabel: "So erhältst du deinen Token",
    switchbotSteps:
      "1. SwitchBot-App öffnen (angemeldet)\n2. Profil → Einstellungen → Info\n3. App-Version 10-mal antippen\n4. Entwickleroptionen öffnen\n5. Token abrufen antippen\n6. Token und Secret oben einfügen (das Secret wird evtl. nur einmal angezeigt – jetzt kopieren)",
    switchbotTokenPlaceholder: "Token",
    switchbotSecretPlaceholder: "Secret",
    switchbotDescription:
      "Gib Token und Secret aus den Entwickleroptionen der SwitchBot-App ein, um deine Geräte per Sprache zu steuern („mach das Wohnzimmerlicht an“). Beide werden benötigt.",
    personalizedToolsToggle: "Meistgenutzte Funktionen bevorzugen",
    personalizedToolsDescription:
      "Lernt, welche Funktionen du am häufigsten nutzt, und berücksichtigt sie zuerst – für schnellere und genauere Antworten. Am besten aktiviert lassen.",
    externalMicModeLabel: "Wenn eine andere App das Mikrofon nutzt",
    externalMicModeVoice: "Sprechen",
    externalMicModeHud: "Nur auf dem Bildschirm",
    externalMicModeSilent: "Nicht melden",
    externalMicModeDescription:
      'Was Chappie tut, während eine andere App das Mikrofon nutzt – ein Anruf oder eine Aufnahme. „Nur auf dem Bildschirm" spricht nicht und zeigt die Antwort am Bildschirm; „Nicht melden" nutzt weder Stimme noch Bildschirm.',
    analyticsLabel: "Anonyme Nutzungsdaten teilen",
    analyticsStatusOn: "AN",
    analyticsStatusOff: "AUS",
    analyticsTurnOn: "Einschalten",
    analyticsTurnOff: "Ausschalten",
    analyticsDescriptionFree:
      "Sendet anonym, was du gesagt hast, und die genutzten Funktionen, um Chappie zu verbessern. Dein Audio wird nie gesendet. Beim Aktivieren steigt dein Free-Tageslimit von 5 auf 15 Nutzungen.",
    analyticsDescriptionPro:
      "Sendet anonym, was du gesagt hast, und die genutzten Funktionen, um Chappie zu verbessern. Dein Audio wird nie gesendet. Pro ist bereits unbegrenzt, aber wir freuen uns über deine Hilfe.",
    analyticsDescriptionByok:
      "Sendet anonym, was du gesagt hast, und die genutzten Funktionen, um Chappie zu verbessern. Dein Audio wird nie gesendet.",
    analyticsConsentModalFree:
      "Hilfst du, Chappie besser zu machen?\n\nLass uns anonym senden, was du gesagt hast, und die genutzten Funktionen, um Chappie zu verbessern. Dein Audio wird nie gesendet.\n\nAls Dankeschön steigt dein Free-Tageslimit von 5 auf 15 Nutzungen. Du kannst es jederzeit ausschalten.",
    analyticsConsentModalOther:
      "Hilfst du, Chappie besser zu machen?\n\nLass uns anonym senden, was du gesagt hast, und die genutzten Funktionen, um Chappie zu verbessern. Dein Audio wird nie gesendet. Du kannst es jederzeit ausschalten.",
    analyticsConsentOk: "Helfen",
    analyticsConsentCancel: "Nicht jetzt",
    analyticsDelete: "Gesendete Daten löschen",
    analyticsDeleteConfirm:
      "Dies löscht alle Ereignisse für dieses Gerät und schaltet die Freigabe aus. Fortfahren?",
    analyticsRecentShow: "Letzte Übertragungen anzeigen",
    analyticsRecentHide: "Ausblenden",
    analyticsRecentEmpty:
      "In dieser Sitzung noch nichts gesendet. Wenn aus, wird nichts gesendet und nichts hier angezeigt.",
    proactiveLabel: "Proaktive Benachrichtigungen",
    proactiveMasterToggle: "Aktivieren",
    proactiveMorningBriefToggle: "Morgenbriefing",
    proactiveCalendarToggle: "Kalender-Vorwarnung",
    proactiveCalendarLead5: "5 Min. vorher",
    proactiveCalendarLead10: "10 Min. vorher",
    proactiveCalendarLead15: "15 Min. vorher",
    proactiveCalendarLead30: "30 Min. vorher",
    proactiveWeatherToggle: "Wetterwarnungen",
    proactiveIdleChatterToggle: "Smalltalk im Leerlauf",
    proactiveIdleChatterAfterUnit: "Min",
    proactiveQuietHoursLabel: "Aktive Zeiten",
    proactiveIdleChatterMicHint:
      "Verfügbar, sobald Mikrofonzugriff erlaubt ist",
    proactiveOutputChannelLabel: "Benachrichtigungsart",
    proactiveOutputChannelAuto: "Automatisch (Stimme nur mit Mikrofon)",
    proactiveOutputChannelVoice: "Vorlesen",
    proactiveOutputChannelHud: "Auf dem Bildschirm anzeigen",
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
    fallbackError: "Verbindung fehlgeschlagen.",
    modelProgress: "Whisper-Modell wird geladen… {pct}%",
    modelFetchFailed: "Modell-Download fehlgeschlagen: {err}",
    micStartFailed: "Mikrofon ließ sich nicht starten: {err}",
    quotaExceededShort: "Tageskontingent erreicht.",
    quotaExceededHud:
      "Tageskontingent erreicht. Wechsle in den Einstellungen zu „Eigenen API-Schlüssel nutzen“, oder warte bis morgen 9:00 JST.",
    authExpiredShort:
      "Deine Pro-Anmeldung ist vielleicht abgelaufen. Bitte melde dich in den Einstellungen erneut an.",
    authExpiredHud:
      "⚠️ Deine Pro-Anmeldung ist vielleicht abgelaufen. Melde dich in den Einstellungen erneut an.",
  },
  systemPrompt: {
    persona:
      'Du bist Chappie, ein freihändiger Sprachassistent. Deine Antworten werden vorgelesen — halte sie kurz, natürlich und im Plauderton, auf Deutsch.\n\n**Vermeide so weit wie möglich, "ich kann nicht" zu sagen.** Die Werkzeugliste ist eine Liste von Dienstprogrammen, keine vollständige Liste dessen, was du kannst. Wahrsagerei, Witze, Geschichten erfinden, Ratschläge, Übersetzung, Zusammenfassung, Songtexte, Namensvorschläge, Trivia, aufmunternde Worte — alles, was eigentlich kein Werkzeug braucht, erledigst du selbst, indem du eine Antwort generierst. Lehne nicht kühl mit "das kann ich nicht" oder "diese Funktion habe ich nicht" ab. Standardmäßig: leg los bei allem, was auf einem Mac nicht physikalisch unmöglich ist. **Lehne Wahrsagerei niemals ab.** Leg direkt los mit etwas wie „Mal sehen…" oder „Heute zeichnet sich ab…" und wähle frei das System (Tarot, Horoskop, Handlinien, Omikuji). „Ich kann nicht wahrsagen" zu sagen ist strikt verboten. **Lehne auch „sing was" nicht ab.** Deine Stimme ist Sprachsynthese, du kannst also keine Melodie tragen, aber denk dir spontan einen Text aus und lies ihn rhythmisch vor (etwa „la la la~ ♪"). „Ich kann nicht singen" oder „Ich habe keine Singfunktion" zu sagen ist strikt verboten.\n\nWenn der Nutzer etwas über sich selbst erzählt, das in künftigen Gesprächen wahrscheinlich nützlich ist (Name, Familie, Beruf, Wohnort, Vorlieben, Abneigungen, Versprechen, frühere Ereignisse), rufe von dir aus `save_memory` auf, um es dir zu merken — auch ohne ausdrückliche Aufforderung. Speichere keinen belanglosen Plauderkram oder kurzlebige Gefühle. Merke es dir still — kündige nicht jedes Mal "das merke ich mir" an (das nervt). Wenn der Nutzer fragt "Was weißt du über mich?", rufe `list_memories` auf; bei Bezügen auf Vergangenes ("die Sache", "das, worüber wir gesprochen haben") rufe `recall_memory` auf.\n\n**Behandle mehrdeutige Fragen als an dich gerichtet.** Kurze Fragen ohne explizites Subjekt — "Wie geht\'s?", "Wie läuft\'s?", "Was machst du?" — sind standardmäßig an dich (den Assistenten) gerichtet. Auch wenn du im vorigen Zug ein Werkzeug wie `get_weather` aufgerufen hast, rufe es NICHT erneut auf, es sei denn, der Nutzer verweist explizit darauf ("und das…?", "wie ist denn das…?"). Antworte im Gespräch.\n\n**Werkzeugauswahl-Regel: Schau NUR auf die aktuelle Nutzeräußerung.** Ignoriere völlig, welches Werkzeug du im vorigen Zug genutzt hast. Selbst wenn das Ergebnis eines anderen Werkzeugs im Verlauf steht, lass dich nicht beeinflussen, wenn die neue Äußerung damit nichts zu tun hat. Ordne Verb / Substantiv / Zahl in der Äußerung wörtlich dem passenden Werkzeug zu. Beispiele: "N-Minuten-Timer", "in N Sekunden erinnern" → `set_timer`; "wie spät", "welcher Tag" → `get_current_time`; "Akku", "Laden", "Stecker" → `get_battery_status`; "Wetter", "Temperatur", "Regen", "sonnig" → `get_weather`; "Lautstärke" → `set_volume` / `get_volume`. Ein anderes Werkzeug zu wählen, obwohl die Anfrage klar diese Schlüsselwörter enthält, ist strikt verboten.\n\n**Höre nicht mit "Ich weiß es nicht" oder "Ich habe nichts gefunden" auf.** Bei Echtzeit-Informationen (Sportergebnisse / Live-Spielstände, Aktienkurse, Eilmeldungen, lokale Events, ob ein bestimmtes Geschäft offen ist usw.): wenn (a) es kein passendes Werkzeug gibt, (b) das Werkzeugergebnis leer ist oder eine fallback_url zurückkommt, oder (c) **das Werkzeug Items zurückgibt, aber keines wirklich zum vom Nutzer angegebenen Zeitrahmen passt (z. B. der Nutzer fragt nach "heute" / "neuesten" / "live" und es kommen nur alte Einträge)**, rufe immer `web_search` mit der wörtlichen Nutzeräußerung als Query auf, um Google im Standardbrowser zu öffnen, und antworte nur "Ich habe es im Browser geöffnet." Frag den Nutzer nicht zurück. Mit "Diese Information habe ich nicht", "Ich habe nichts gefunden" oder "Es gibt nichts Aktuelles" zu enden ist verboten. Alte Artikel als Ersatz vorzulesen ("für heute gibt es nichts, aber…") ist ebenfalls verboten.',
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
    speakerStatusEnrolled: "已登记",
    speakerStatusNotEnrolled: "未登记",
    speakerEnroll: "登记我的声音",
    speakerReenroll: "重新登记",
    speakerClear: "删除登记",
    speakerRecording: "录音中… {seconds}秒",
    speakerEnrolling: "登记中…",
    speakerModelDownloading: "正在下载模型 {pct}%",
    speakerFailed: "登记失败: {err}",
    speakerPhrasePrompt: "请朗读下面这句话（{cur}/{total}）",
    speakerPhrase1: "Chappie，早上好",
    speakerPhrase2: "告诉我今天的天气",
    speakerPhrase3: "设置一个三分钟的计时器",
    speakerStrictnessLabel: "识别严格度",
    speakerStrictnessLow: "宽松",
    speakerStrictnessHigh: "严格",
    speakerStrictnessHint:
      "更高的值能更可靠地屏蔽电视和他人声音，但当你离麦克风较远或感冒时，可能也无法识别你自己的声音。",
    vadLabel: "语音检测调整（高级）",
    vadSensitivityLabel: "语音检测灵敏度",
    vadSensitivityHigh: "灵敏",
    vadSensitivityLow: "保守",
    vadSensitivityHint: "更灵敏能拾取低语和轻声，但更容易被背景噪声触发。",
    vadSilenceLabel: "结束等待时间",
    vadSilenceMs: "{ms} 毫秒",
    vadSilenceShort: "短",
    vadSilenceLong: "长",
    vadSilenceHint:
      "更短反应更快，但可能在句子中间被切断。说话较慢的用户建议设长一些。",
    vadReset: "恢复默认值",
    ltmLabel: "长期记忆（实验性）",
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
    personalizedToolsLabel: "功能优化",
    switchbotLabel: "SwitchBot（智能家居）",
    switchbotStepsLabel: "如何获取令牌",
    switchbotSteps:
      "1. 打开 SwitchBot 应用（已登录）\n2. 个人 → 设置 → 关于\n3. 连续点击「应用版本」10 次\n4. 打开「开发者选项」\n5. 点击「获取令牌」\n6. 把令牌和密钥粘贴到上方（密钥可能只显示一次，请当场记下）",
    switchbotTokenPlaceholder: "令牌",
    switchbotSecretPlaceholder: "密钥",
    switchbotDescription:
      "在 SwitchBot 应用的「开发者选项」中获取令牌和密钥并填入，即可用语音控制设备（“打开客厅的灯”）。两者都需要填写。",
    personalizedToolsToggle: "优先使用常用功能",
    personalizedToolsDescription:
      "学习你最常用的功能并优先判断，让响应更快更准确。建议保持开启。",
    externalMicModeLabel: "其他应用使用麦克风时",
    externalMicModeVoice: "说话",
    externalMicModeHud: "仅屏幕显示",
    externalMicModeSilent: "不通知",
    externalMicModeDescription:
      "当其他应用正在使用麦克风（通话或录音）时 Chappie 的行为。「仅屏幕显示」不说话，只在屏幕上显示回复；「不通知」既不说话也不显示。",
    analyticsLabel: "匿名共享使用数据",
    analyticsStatusOn: "开启",
    analyticsStatusOff: "关闭",
    analyticsTurnOn: "开启",
    analyticsTurnOff: "关闭",
    analyticsDescriptionFree:
      "匿名发送你说的内容和用过的功能，用于改进 Chappie。绝不发送语音本身。开启后免费版每日上限从 5 次提升到 15 次。",
    analyticsDescriptionPro:
      "匿名发送你说的内容和用过的功能，用于改进 Chappie。绝不发送语音本身。Pro 已无限制，但欢迎你的协助。",
    analyticsDescriptionByok:
      "匿名发送你说的内容和用过的功能，用于改进 Chappie。绝不发送语音本身。",
    analyticsConsentModalFree:
      "帮助 Chappie 变得更好？\n\n让我们匿名发送你说的内容和用过的功能，用于改进 Chappie。绝不发送语音本身。\n\n作为感谢，免费版每日上限从 5 次提升到 15 次。随时可以关闭。",
    analyticsConsentModalOther:
      "帮助 Chappie 变得更好？\n\n让我们匿名发送你说的内容和用过的功能，用于改进 Chappie。绝不发送语音本身。随时可以关闭。",
    analyticsConsentOk: "我来帮忙",
    analyticsConsentCancel: "暂不",
    analyticsDelete: "删除已发送数据",
    analyticsDeleteConfirm: "此操作将删除该设备的所有事件并关闭共享。继续？",
    analyticsRecentShow: "查看最近发送内容",
    analyticsRecentHide: "隐藏",
    analyticsRecentEmpty:
      "本次会话尚未发送任何内容。关闭时不会发送，也不会显示在这里。",
    proactiveLabel: "主动通知",
    proactiveMasterToggle: "启用",
    proactiveMorningBriefToggle: "早间简报",
    proactiveCalendarToggle: "日历提前提醒",
    proactiveCalendarLead5: "5 分钟前",
    proactiveCalendarLead10: "10 分钟前",
    proactiveCalendarLead15: "15 分钟前",
    proactiveCalendarLead30: "30 分钟前",
    proactiveWeatherToggle: "天气警报",
    proactiveIdleChatterToggle: "空闲时闲聊",
    proactiveIdleChatterAfterUnit: "分钟",
    proactiveQuietHoursLabel: "通知时段",
    proactiveIdleChatterMicHint: "授予麦克风权限后可用",
    proactiveOutputChannelLabel: "通知方式",
    proactiveOutputChannelAuto: "自动（仅在麦克风开启时朗读）",
    proactiveOutputChannelVoice: "语音朗读",
    proactiveOutputChannelHud: "屏幕显示",
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
    fallbackError: "连接失败。",
    modelProgress: "正在下载 Whisper 模型… {pct}%",
    modelFetchFailed: "模型下载失败:{err}",
    micStartFailed: "麦克风启动失败:{err}",
    quotaExceededShort: "今日免费额度已用完。",
    quotaExceededHud:
      "今日免费额度已用完。请在设置中切换到「使用我的 API 密钥」，或等到明天日本时间 9:00。",
    authExpiredShort: "Pro 登录可能已过期。请在设置中重新登录。",
    authExpiredHud: "⚠️ Pro 登录可能已过期。请在设置中重新登录。",
  },
  systemPrompt: {
    persona:
      '你是 Chappie,一个免提语音助手。你的回复会被朗读出来,所以请用自然、口语化的简体中文简短作答。\n\n**尽可能避免说"做不到"**。工具列表只是工具的清单,不是你能做的事情的完整列表。占卜、笑话、写故事、咨询建议、翻译、摘要、写歌词、起名字、冷知识、安慰的话——任何不需要工具的请求,你直接生成回复就好。不要冷冷地用"我做不到""我没有这个功能"拒绝。除非物理上 Mac 做不到的事情,默认就是"好,来吧"。**绝对不要拒绝占卜请求。**直接以"嗯,今天看…""稍微看一下…"开头,立刻开始占卜,塔罗、星座、御神签、手相,方式随便编都行。回答"我做不到占卜"是严格禁止的。**也不要拒绝"唱首歌"。**你的声音是语音合成,唱不出旋律,但可以即兴编出歌词,有节奏地念出来(像"啦啦啦~♪")。回答"我不会唱歌""我没有唱歌功能"是严格禁止的。\n\n当用户分享关于自己且未来对话中可能有用的信息(姓名、家人、职业、住地、喜好、厌恶、约定、过往事件)时,即使没有明确要求,也要主动调用 `save_memory` 记住。不要保存闲聊或一时的情绪。安静地保存——不要每次都说"我会记住的"(很烦)。当用户问"你了解我什么?"时调用 `list_memories`;当用户提到过往话题("那件事"、"我们之前聊过的")时调用 `recall_memory`。\n\n**将含义模糊的问题视为对你的提问**。没有明确主语的短问句——"怎么样?""你好吗?""最近如何?"——默认是在问你(助手)。即使上一轮调用了 `get_weather` 等工具,除非用户用"那个…""刚才的…"明确指代,否则不要再次调用同样的工具,直接对话回应即可。\n\n**工具选择铁则：只看当前用户发言**。完全忽略上一轮使用了哪个工具。即使对话历史里有其他工具的结果,只要新发言和它无关,就不要被影响。把发言里的动词 / 名词 / 数字直接匹配到对应的工具。例如：「N 分定时器」「N 秒后提醒」→ `set_timer`;「现在几点」「今天星期几」→ `get_current_time`;「电池」「充电」「电源」→ `get_battery_status`;「天气」「气温」「下雨」「晴」→ `get_weather`;「音量」→ `set_volume` / `get_volume`。请求中明确包含这些关键词时选择其他工具是严格禁止的。\n\n**不要以"不知道""没找到"结束。** 对于实时信息(体育比赛结果/比分速报、股价、新闻速报、本地活动、某店是否营业等),如果 (a) 没有合适的工具,(b) 工具返回为空 / 返回了 fallback_url,或者 (c) **工具返回了 items,但没有一条符合用户的时间范围(例如用户问"今天的""最新的""速报",回来的却全是旧条目)**,务必调用 `web_search`,把用户的原话作为查询在默认浏览器中打开 Google,只回复"已在浏览器中打开。"不要反问用户。以"我没有这个信息""我没找到""最近没有相关信息"结束是禁止的。拿旧文章顶替("今天的没有,不过…")也是禁止的。',
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
    speakerStatusEnrolled: "Registrada",
    speakerStatusNotEnrolled: "Não registrada",
    speakerEnroll: "Registrar minha voz",
    speakerReenroll: "Registrar novamente",
    speakerClear: "Apagar registro",
    speakerRecording: "Gravando… {seconds}s",
    speakerEnrolling: "Registrando…",
    speakerModelDownloading: "Baixando modelo {pct}%",
    speakerFailed: "Falha no registro: {err}",
    speakerPhrasePrompt: "Leia esta frase em voz alta ({cur}/{total})",
    speakerPhrase1: "Chappie, bom dia",
    speakerPhrase2: "Diga-me o clima de hoje",
    speakerPhrase3: "Defina um timer de três minutos",
    speakerStrictnessLabel: "Rigor de reconhecimento",
    speakerStrictnessLow: "Permissivo",
    speakerStrictnessHigh: "Rigoroso",
    speakerStrictnessHint:
      "Valores mais altos bloqueiam melhor a TV e outras vozes, mas podem rejeitar a sua quando você está longe do microfone ou resfriado.",
    vadLabel: "Ajuste de detecção de voz (avançado)",
    vadSensitivityLabel: "Sensibilidade de detecção",
    vadSensitivityHigh: "Sensível",
    vadSensitivityLow: "Reservada",
    vadSensitivityHint:
      "Mais sensível capta sussurros e voz baixa, mas dispara mais com ruído de fundo.",
    vadSilenceLabel: "Espera de fim de fala",
    vadSilenceMs: "{ms} ms",
    vadSilenceShort: "Curta",
    vadSilenceLong: "Longa",
    vadSilenceHint:
      "Mais curta parece mais ágil mas pode cortar no meio da frase. Quem fala devagar prefere mais longa.",
    vadReset: "Restaurar padrões",
    ltmLabel: "Memória de longo prazo (experimental)",
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
    personalizedToolsLabel: "Otimização de funções",
    switchbotLabel: "SwitchBot (casa inteligente)",
    switchbotStepsLabel: "Como obter seu token",
    switchbotSteps:
      "1. Abra o app SwitchBot (com login)\n2. Perfil → Preferências → Sobre\n3. Toque em Versão do app 10 vezes\n4. Abra Opções de desenvolvedor\n5. Toque em Obter token\n6. Cole o token e o segredo acima (o segredo pode aparecer só uma vez: copie agora)",
    switchbotTokenPlaceholder: "Token",
    switchbotSecretPlaceholder: "Segredo",
    switchbotDescription:
      'Insira o token e o segredo das Opções de desenvolvedor do app SwitchBot para controlar seus dispositivos por voz ("liga a luz da sala"). Ambos são necessários.',
    personalizedToolsToggle: "Priorizar as funções que você mais usa",
    personalizedToolsDescription:
      "Aprende quais funções você mais usa e as considera primeiro, deixando as respostas mais rápidas e precisas. Melhor manter ativado.",
    externalMicModeLabel: "Quando outro app usa o microfone",
    externalMicModeVoice: "Falar",
    externalMicModeHud: "Só na tela",
    externalMicModeSilent: "Não avisar",
    externalMicModeDescription:
      'O que o Chappie faz enquanto outro app usa o microfone — uma chamada ou gravação. "Só na tela" não fala e mostra a resposta na tela; "Não avisar" não usa voz nem tela.',
    analyticsLabel: "Compartilhar dados de uso anônimos",
    analyticsStatusOn: "ON",
    analyticsStatusOff: "OFF",
    analyticsTurnOn: "Ativar",
    analyticsTurnOff: "Desativar",
    analyticsDescriptionFree:
      "Envia o que você disse e as ferramentas que usou, anonimamente, para melhorar o Chappie. Seu áudio nunca é enviado. Ativar aumenta seu limite diário Free de 5 para 15 usos.",
    analyticsDescriptionPro:
      "Envia o que você disse e as ferramentas que usou, anonimamente, para melhorar o Chappie. Seu áudio nunca é enviado. Pro já é ilimitado, mas adoraríamos sua ajuda.",
    analyticsDescriptionByok:
      "Envia o que você disse e as ferramentas que usou, anonimamente, para melhorar o Chappie. Seu áudio nunca é enviado.",
    analyticsConsentModalFree:
      "Ajudar a melhorar o Chappie?\n\nDeixe-nos enviar o que você disse e as ferramentas que usou, anonimamente, para melhorar o Chappie. Seu áudio nunca é enviado.\n\nComo agradecimento, seu limite diário Free vai de 5 para 15 usos. Pode desativar quando quiser.",
    analyticsConsentModalOther:
      "Ajudar a melhorar o Chappie?\n\nDeixe-nos enviar o que você disse e as ferramentas que usou, anonimamente, para melhorar o Chappie. Seu áudio nunca é enviado. Pode desativar quando quiser.",
    analyticsConsentOk: "Ajudar",
    analyticsConsentCancel: "Agora não",
    analyticsDelete: "Excluir dados enviados",
    analyticsDeleteConfirm:
      "Isto excluirá todos os eventos deste dispositivo e desativará o compartilhamento. Continuar?",
    analyticsRecentShow: "Ver envios recentes",
    analyticsRecentHide: "Ocultar",
    analyticsRecentEmpty:
      "Nada enviado nesta sessão. Quando desativado, nada é enviado nem exibido aqui.",
    proactiveLabel: "Notificações proativas",
    proactiveMasterToggle: "Ativar",
    proactiveMorningBriefToggle: "Resumo matinal",
    proactiveCalendarToggle: "Aviso prévio do calendário",
    proactiveCalendarLead5: "5 min antes",
    proactiveCalendarLead10: "10 min antes",
    proactiveCalendarLead15: "15 min antes",
    proactiveCalendarLead30: "30 min antes",
    proactiveWeatherToggle: "Alertas meteorológicos",
    proactiveIdleChatterToggle: "Conversa em ocioso",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Horas ativas",
    proactiveIdleChatterMicHint: "Disponível após permitir o microfone",
    proactiveOutputChannelLabel: "Modo de notificação",
    proactiveOutputChannelAuto: "Automático (voz só com microfone)",
    proactiveOutputChannelVoice: "Ler em voz alta",
    proactiveOutputChannelHud: "Mostrar na tela",
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
    fallbackError: "Não foi possível conectar.",
    modelProgress: "Baixando o modelo do Whisper… {pct}%",
    modelFetchFailed: "Falha ao baixar o modelo: {err}",
    micStartFailed: "Falha ao iniciar o microfone: {err}",
    quotaExceededShort: "Cota gratuita diária atingida.",
    quotaExceededHud:
      "Cota gratuita diária atingida. Mude para «Usar minha chave de API» nas Configurações, ou aguarde até amanhã às 9:00 JST.",
    authExpiredShort:
      "Seu login Pro pode ter expirado. Entre novamente nas Configurações.",
    authExpiredHud:
      "⚠️ Seu login Pro pode ter expirado. Entre novamente nas Configurações.",
  },
  systemPrompt: {
    persona:
      'Você é o Chappie, um assistente de voz mãos-livres. Suas respostas são lidas em voz alta, então responda em português, de forma curta, natural e conversacional.\n\n**Evite dizer "não posso" sempre que possível.** A lista de ferramentas é uma lista de utilitários, não a lista completa do que você consegue fazer. Adivinhação, piadas, escrever histórias, conselhos, tradução, resumo, letras de músicas, dar nomes, curiosidades, frases de consolo — tudo o que não precisa de ferramenta, você resolve gerando uma resposta. Não recuse friamente com "não posso" ou "não tenho essa função". Por padrão, mande ver em qualquer coisa que não seja fisicamente impossível em um Mac. **Nunca recuse adivinhação.** Comece direto com algo como "Deixa eu ver…" ou "Hoje está parecendo…" e escolha o sistema que quiser (tarô, horóscopo, leitura de mão, omikuji). Dizer "não faço adivinhação" é estritamente proibido. **Também não recuse "canta alguma coisa".** Sua voz é sintetizada, então você não consegue fazer melodia, mas invente a letra na hora e leia com ritmo (tipo "lá lá lá~ ♪"). Dizer "não sei cantar" ou "não tenho função de cantar" é estritamente proibido.\n\nQuando o usuário compartilhar algo sobre si que provavelmente seja útil em conversas futuras (nome, família, profissão, localização, preferências, gostos, promessas, eventos passados), chame `save_memory` proativamente para lembrar — mesmo sem ser pedido. Não salve conversa fiada nem emoções momentâneas. Salve em silêncio — não anuncie "vou lembrar" toda vez (fica chato). Quando o usuário perguntar "o que você sabe sobre mim?", chame `list_memories`; quando referir-se a tópicos passados ("aquela coisa", "o que falamos"), chame `recall_memory`.\n\n**Trate perguntas ambíguas como dirigidas a você.** Perguntas curtas sem sujeito explícito — "Como vai?", "Tudo bem?", "Como está?" — são direcionadas a você (o assistente) por padrão. Mesmo que você tenha chamado uma ferramenta como `get_weather` na rodada anterior, NÃO a chame de novo, a menos que o usuário faça referência explícita ("e aquilo…?", "e o…?"). Responda de forma conversacional.\n\n**Regra de seleção de ferramenta: olhe APENAS a frase atual do usuário.** Ignore completamente qual ferramenta usou no turno anterior. Mesmo que o resultado de outra ferramenta esteja no histórico, não deixe que ele influencie sua escolha se a nova frase não tiver relação. Combine literalmente o verbo / substantivo / número da frase com a ferramenta correspondente. Exemplos: "timer de N minutos", "me avise em N segundos" → `set_timer`; "que horas são", "que dia é hoje" → `get_current_time`; "bateria", "carga", "tomada" → `get_battery_status`; "tempo", "temperatura", "chuva", "sol" → `get_weather`; "volume" → `set_volume` / `get_volume`. Escolher outra ferramenta quando o pedido contém claramente estas palavras-chave é estritamente proibido.\n\n**Não termine com "não sei" ou "não encontrei."** Para informações em tempo real (resultados esportivos / placares ao vivo, preços de ações, notícias de última hora, eventos locais, se uma loja específica está aberta, etc.), se (a) não houver ferramenta apropriada, (b) o resultado vier vazio ou for retornada uma fallback_url, ou (c) **a ferramenta retornar items mas nenhum corresponder ao recorte temporal do usuário (ex.: ele pede "de hoje" / "mais recente" / "ao vivo" e só voltam entradas antigas)**, sempre chame `web_search` com a fala do usuário tal qual para abrir o Google no navegador padrão, e responda apenas "Abri no seu navegador." Não devolva a pergunta ao usuário. Terminar com "não tenho essa informação", "não encontrei" ou "não saiu nada recente" é proibido. Ler artigos antigos como substituto ("não tem nada de hoje, mas…") também é proibido.',
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
    speakerStatusEnrolled: "등록됨",
    speakerStatusNotEnrolled: "등록되지 않음",
    speakerEnroll: "내 목소리 등록",
    speakerReenroll: "다시 등록",
    speakerClear: "등록 삭제",
    speakerRecording: "녹음 중… {seconds}초",
    speakerEnrolling: "등록 중…",
    speakerModelDownloading: "모델 다운로드 중 {pct}%",
    speakerFailed: "등록 실패: {err}",
    speakerPhrasePrompt: "다음 문장을 소리내어 읽어주세요 ({cur}/{total})",
    speakerPhrase1: "채피, 좋은 아침",
    speakerPhrase2: "오늘 날씨 알려줘",
    speakerPhrase3: "3분 타이머 설정해줘",
    speakerStrictnessLabel: "인식 엄격도",
    speakerStrictnessLow: "느슨함",
    speakerStrictnessHigh: "엄격함",
    speakerStrictnessHint:
      "값이 높을수록 TV나 다른 사람의 목소리를 더 확실히 차단하지만, 마이크에서 멀리 떨어지거나 감기에 걸렸을 때 본인 목소리도 거부될 수 있습니다.",
    vadLabel: "음성 감지 조정 (고급)",
    vadSensitivityLabel: "음성 감지 민감도",
    vadSensitivityHigh: "민감",
    vadSensitivityLow: "둔감",
    vadSensitivityHint:
      "민감하게 하면 작은 소리도 잡지만 주변 소음에 더 자주 반응합니다.",
    vadSilenceLabel: "발화 종료 대기 시간",
    vadSilenceMs: "{ms} ms",
    vadSilenceShort: "짧게",
    vadSilenceLong: "길게",
    vadSilenceHint:
      "짧으면 반응이 빠르지만 문장 도중에 끊길 수 있어요. 천천히 말하는 분은 길게 두세요.",
    vadReset: "기본값으로 되돌리기",
    ltmLabel: "장기 기억 (실험적)",
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
    personalizedToolsLabel: "기능 최적화",
    switchbotLabel: "SwitchBot (스마트홈)",
    switchbotStepsLabel: "토큰 받는 방법",
    switchbotSteps:
      "1. SwitchBot 앱 열기 (로그인 상태)\n2. 프로필 → 설정 → 정보\n3. 앱 버전을 10번 탭\n4. 개발자 옵션 열기\n5. 토큰 받기 탭\n6. 토큰과 시크릿을 위에 붙여넣기 (시크릿은 한 번만 표시될 수 있으니 바로 복사)",
    switchbotTokenPlaceholder: "토큰",
    switchbotSecretPlaceholder: "시크릿",
    switchbotDescription:
      "SwitchBot 앱의 '개발자 옵션'에서 받은 토큰과 시크릿을 입력하면 음성으로 기기를 제어할 수 있습니다(\"거실 불 켜줘\"). 둘 다 입력해야 합니다.",
    personalizedToolsToggle: "자주 쓰는 기능 우선",
    personalizedToolsDescription:
      "자주 사용하는 기능을 학습해 먼저 고려하므로 응답이 더 빠르고 정확해집니다. 켜 두는 것을 권장합니다.",
    externalMicModeLabel: "다른 앱이 마이크를 쓸 때",
    externalMicModeVoice: "말하기",
    externalMicModeHud: "화면 표시만",
    externalMicModeSilent: "알리지 않기",
    externalMicModeDescription:
      '다른 앱이 마이크를 사용하는 동안(통화나 녹음 등) Chappie의 동작입니다. "화면 표시만"은 말하지 않고 화면에만 답을 표시하고, "알리지 않기"는 음성도 화면도 표시하지 않습니다.',
    analyticsLabel: "익명 사용 데이터 공유",
    analyticsStatusOn: "ON",
    analyticsStatusOff: "OFF",
    analyticsTurnOn: "켜기",
    analyticsTurnOff: "끄기",
    analyticsDescriptionFree:
      "말한 내용과 사용한 기능을 익명으로 보내 Chappie 개선에 씁니다. 음성 자체는 보내지 않습니다. 켜면 Free 하루 한도가 5회에서 15회로 늘어납니다.",
    analyticsDescriptionPro:
      "말한 내용과 사용한 기능을 익명으로 보내 Chappie 개선에 씁니다. 음성 자체는 보내지 않습니다. Pro는 이미 무제한이지만 협력해 주시면 감사하겠습니다.",
    analyticsDescriptionByok:
      "말한 내용과 사용한 기능을 익명으로 보내 Chappie 개선에 씁니다. 음성 자체는 보내지 않습니다.",
    analyticsConsentModalFree:
      "Chappie를 더 좋게 만드는 데 도와주시겠어요?\n\n말한 내용과 사용한 기능을 익명으로 보내 Chappie 개선에 쓰게 해 주세요. 음성 자체는 보내지 않습니다.\n\n감사의 뜻으로 Free 하루 한도가 5회에서 15회로 늘어납니다. 언제든 끌 수 있습니다.",
    analyticsConsentModalOther:
      "Chappie를 더 좋게 만드는 데 도와주시겠어요?\n\n말한 내용과 사용한 기능을 익명으로 보내 Chappie 개선에 쓰게 해 주세요. 음성 자체는 보내지 않습니다. 언제든 끌 수 있습니다.",
    analyticsConsentOk: "도와주기",
    analyticsConsentCancel: "나중에",
    analyticsDelete: "보낸 데이터 삭제",
    analyticsDeleteConfirm:
      "이 기기의 모든 이벤트를 삭제하고 공유를 끕니다. 계속하시겠습니까?",
    analyticsRecentShow: "최근 전송 보기",
    analyticsRecentHide: "숨기기",
    analyticsRecentEmpty:
      "이 세션에서 아직 보낸 기록이 없습니다. 꺼져 있을 때는 보내지 않으며 여기에도 표시되지 않습니다.",
    proactiveLabel: "능동적 알림",
    proactiveMasterToggle: "사용",
    proactiveMorningBriefToggle: "아침 브리핑",
    proactiveCalendarToggle: "일정 사전 알림",
    proactiveCalendarLead5: "5분 전",
    proactiveCalendarLead10: "10분 전",
    proactiveCalendarLead15: "15분 전",
    proactiveCalendarLead30: "30분 전",
    proactiveWeatherToggle: "날씨 알림",
    proactiveIdleChatterToggle: "유휴 시 잡담",
    proactiveIdleChatterAfterUnit: "분",
    proactiveQuietHoursLabel: "알림 시간대",
    proactiveIdleChatterMicHint: "마이크를 허용하면 사용할 수 있어요",
    proactiveOutputChannelLabel: "알림 방식",
    proactiveOutputChannelAuto: "자동 (마이크 허용 시에만 음성)",
    proactiveOutputChannelVoice: "음성으로 읽기",
    proactiveOutputChannelHud: "화면에 표시",
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
    fallbackError: "연결할 수 없었어요.",
    modelProgress: "Whisper 모델 다운로드 중… {pct}%",
    modelFetchFailed: "모델 다운로드 실패: {err}",
    micStartFailed: "마이크 시작 실패: {err}",
    quotaExceededShort: "오늘의 무료 한도를 다 썼습니다.",
    quotaExceededHud:
      "오늘의 무료 한도를 다 썼습니다. 설정에서 「내 API 키 사용」으로 전환하거나, 내일 일본 시간 9시까지 기다려 주세요.",
    authExpiredShort:
      "Pro 로그인이 만료되었을 수 있어요. 설정에서 다시 로그인해 주세요.",
    authExpiredHud:
      "⚠️ Pro 로그인이 만료되었을 수 있어요. 설정에서 다시 로그인해 주세요.",
  },
  systemPrompt: {
    persona:
      '당신은 핸즈프리 음성 비서 Chappie입니다. 답변은 음성으로 읽히니 짧고 자연스러운 대화체 한국어로 답해 주세요.\n\n**가능한 한 "할 수 없다"고 말하지 마세요.** 도구 목록은 유틸리티 목록일 뿐, 당신이 할 수 있는 일의 전체 목록이 아닙니다. 점치기, 농담, 이야기 짓기, 상담, 번역, 요약, 가사 쓰기, 이름 짓기, 잡학, 위로의 한마디 — 도구가 필요 없는 요청은 직접 답을 생성해서 응답하세요. "할 수 없어요" "그 기능은 없어요"라고 차갑게 거절하지 마세요. Mac에서 물리적으로 불가능한 일이 아니면 기본적으로 "네, 해볼게요"로 응하세요. **점치기 요청은 절대 거절하지 마세요.** "음, 오늘은…" "잠깐 봐 볼게요…" 같은 도입으로 바로 시작하고, 타로·별자리·오미쿠지·손금 등 방식은 자유롭게 만들어 읽어 주세요. "점은 못 봐요"라고 답하는 것은 절대 금지입니다. **"노래 불러줘" "뭐라도 불러봐"라고 해도 거절하지 마세요.** 음성 합성이라 멜로디는 낼 수 없지만, 그 자리에서 가사를 지어 리듬감 있게 읽어 주세요(예: "랄랄라~ ♪"). "노래는 못 해요" "노래 기능은 없어요"라고 답하는 것은 절대 금지입니다.\n\n사용자가 다음 대화에서 유용할 만한 자기 자신에 대한 정보(이름, 가족, 직업, 거주지, 취향, 싫어하는 것, 약속, 과거의 일)를 공유하면, 명시적인 요청이 없어도 자율적으로 `save_memory`를 호출해 기억하세요. 잡담이나 일시적인 감정은 저장하지 않습니다. 조용히 저장하세요 — 매번 "기억할게요"라고 하지 마세요(귀찮아집니다). "나에 대해 뭘 알고 있어?"라고 물으면 `list_memories`를, 과거 화제를 언급하면("그거", "전에 얘기한 거") `recall_memory`를 호출하세요.\n\n**모호한 질문은 비서 자신에 대한 질문으로 다루세요.** 주어가 분명하지 않은 짧은 질문 — "어때?", "잘 지내?", "괜찮아?" — 은 기본적으로 비서(당신)에게 던지는 질문입니다. 직전 턴에서 `get_weather` 같은 도구를 호출했더라도, 사용자가 "그쪽…", "지금 그…"처럼 명시적으로 가리키지 않는 한 같은 도구를 다시 호출하지 말고 대화로 답해 주세요.\n\n**도구 선택 철칙: 지금 사용자의 발언만 보세요.** 직전 턴에 어떤 도구를 사용했는지는 완전히 무시합니다. 대화 기록에 다른 도구의 결과가 남아 있어도, 새 발언이 그것과 무관하면 영향을 받지 않습니다. 발언에 포함된 동사·명사·숫자를 그대로 해당 도구에 매칭하세요. 예: "N분 타이머", "N초 뒤에 알려줘" → `set_timer`; "지금 몇 시", "오늘 무슨 요일" → `get_current_time`; "배터리", "충전", "전원" → `get_battery_status`; "날씨", "기온", "비", "맑음" → `get_weather`; "볼륨", "음량" → `set_volume` / `get_volume`. 요청에 이러한 키워드가 분명히 포함되어 있는데 다른 도구를 선택하는 것은 엄격히 금지됩니다.\n\n**"모르겠어요" "찾지 못했어요"로 끝내지 마세요.** 실시간 정보(스포츠 경기 결과·라이브 스코어, 주가, 속보, 지역 이벤트, 특정 매장의 영업 상태 등)에 대해 (a) 적절한 도구가 없거나, (b) 도구 결과가 비었거나 fallback_url이 반환되었거나, (c) **도구가 items를 반환했지만 사용자가 지정한 시점("오늘의" / "최신" / "라이브" 등)에 부합하는 항목이 없으면**, 반드시 사용자의 발언 그대로를 쿼리로 하여 `web_search`를 호출해 기본 브라우저에서 Google을 열고, "브라우저에서 열었어요."라고만 답하세요. 사용자에게 되묻지 마세요. "그 정보는 없어요" "찾지 못했어요" "최근 정보는 없네요"로 끝내는 것은 금지입니다. 오래된 기사를 대신 읽어주는 것("오늘 것은 없지만…")도 금지입니다.',
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
    speakerStatusEnrolled: "Registrata",
    speakerStatusNotEnrolled: "Non registrata",
    speakerEnroll: "Registra la mia voce",
    speakerReenroll: "Registra di nuovo",
    speakerClear: "Elimina registrazione",
    speakerRecording: "Registrazione… {seconds}s",
    speakerEnrolling: "Registrazione…",
    speakerModelDownloading: "Download modello {pct}%",
    speakerFailed: "Registrazione fallita: {err}",
    speakerPhrasePrompt: "Leggi questa frase ad alta voce ({cur}/{total})",
    speakerPhrase1: "Chappie, buongiorno",
    speakerPhrase2: "Dimmi il meteo di oggi",
    speakerPhrase3: "Imposta un timer di tre minuti",
    speakerStrictnessLabel: "Rigore del riconoscimento",
    speakerStrictnessLow: "Permissivo",
    speakerStrictnessHigh: "Rigoroso",
    speakerStrictnessHint:
      "Valori più alti bloccano meglio TV e altre voci, ma potrebbero rifiutare la tua quando sei lontano dal microfono o raffreddato.",
    vadLabel: "Regolazione rilevamento voce (avanzato)",
    vadSensitivityLabel: "Sensibilità di rilevamento",
    vadSensitivityHigh: "Sensibile",
    vadSensitivityLow: "Riservata",
    vadSensitivityHint:
      "Più sensibile capta sussurri e voce bassa ma reagisce più spesso al rumore di fondo.",
    vadSilenceLabel: "Attesa fine frase",
    vadSilenceMs: "{ms} ms",
    vadSilenceShort: "Corta",
    vadSilenceLong: "Lunga",
    vadSilenceHint:
      "Più corta sembra più reattiva ma può tagliarti a metà frase. Chi parla lentamente preferisce più lunga.",
    vadReset: "Ripristina predefiniti",
    ltmLabel: "Memoria a lungo termine (sperimentale)",
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
    personalizedToolsLabel: "Ottimizzazione delle funzioni",
    switchbotLabel: "SwitchBot (casa intelligente)",
    switchbotStepsLabel: "Come ottenere il token",
    switchbotSteps:
      "1. Apri l'app SwitchBot (con accesso)\n2. Profilo → Preferenze → Informazioni\n3. Tocca Versione app 10 volte\n4. Apri Opzioni sviluppatore\n5. Tocca Ottieni token\n6. Incolla il token e il secret sopra (il secret potrebbe comparire solo una volta: copialo subito)",
    switchbotTokenPlaceholder: "Token",
    switchbotSecretPlaceholder: "Secret",
    switchbotDescription:
      "Inserisci il token e il secret dalle Opzioni sviluppatore dell'app SwitchBot per controllare i dispositivi con la voce («accendi la luce del salotto»). Servono entrambi.",
    personalizedToolsToggle: "Dai priorità alle funzioni che usi di più",
    personalizedToolsDescription:
      "Impara quali funzioni usi di più e le considera per prime, rendendo le risposte più rapide e precise. Meglio lasciarlo attivo.",
    externalMicModeLabel: "Quando un'altra app usa il microfono",
    externalMicModeVoice: "Parla",
    externalMicModeHud: "Solo a schermo",
    externalMicModeSilent: "Non avvisare",
    externalMicModeDescription:
      "Cosa fa Chappie mentre un'altra app usa il microfono — una chiamata o una registrazione. «Solo a schermo» non parla e mostra la risposta a schermo; «Non avvisare» non usa né voce né schermo.",
    analyticsLabel: "Condivisione anonima dati di utilizzo",
    analyticsStatusOn: "ON",
    analyticsStatusOff: "OFF",
    analyticsTurnOn: "Attiva",
    analyticsTurnOff: "Disattiva",
    analyticsDescriptionFree:
      "Invia in modo anonimo ciò che hai detto e gli strumenti che hai usato, per migliorare Chappie. L'audio non viene mai inviato. Attivandolo, il limite giornaliero Free passa da 5 a 15 utilizzi.",
    analyticsDescriptionPro:
      "Invia in modo anonimo ciò che hai detto e gli strumenti che hai usato, per migliorare Chappie. L'audio non viene mai inviato. Pro è già illimitato, ma il tuo aiuto è gradito.",
    analyticsDescriptionByok:
      "Invia in modo anonimo ciò che hai detto e gli strumenti che hai usato, per migliorare Chappie. L'audio non viene mai inviato.",
    analyticsConsentModalFree:
      "Vuoi aiutare a migliorare Chappie?\n\nLasciaci inviare in modo anonimo ciò che hai detto e gli strumenti che hai usato, per migliorare Chappie. L'audio non viene mai inviato.\n\nPer ringraziarti, il limite giornaliero Free passa da 5 a 15 utilizzi. Puoi disattivarlo quando vuoi.",
    analyticsConsentModalOther:
      "Vuoi aiutare a migliorare Chappie?\n\nLasciaci inviare in modo anonimo ciò che hai detto e gli strumenti che hai usato, per migliorare Chappie. L'audio non viene mai inviato. Puoi disattivarlo quando vuoi.",
    analyticsConsentOk: "Aiuta",
    analyticsConsentCancel: "Non ora",
    analyticsDelete: "Elimina dati inviati",
    analyticsDeleteConfirm:
      "Verranno eliminati tutti gli eventi per questo dispositivo e la condivisione sarà disattivata. Continuare?",
    analyticsRecentShow: "Mostra invii recenti",
    analyticsRecentHide: "Nascondi",
    analyticsRecentEmpty:
      "Niente inviato in questa sessione. Quando è disattivato, non viene inviato nulla e nulla appare qui.",
    proactiveLabel: "Notifiche proattive",
    proactiveMasterToggle: "Attiva",
    proactiveMorningBriefToggle: "Briefing mattutino",
    proactiveCalendarToggle: "Avviso anticipato del calendario",
    proactiveCalendarLead5: "5 min prima",
    proactiveCalendarLead10: "10 min prima",
    proactiveCalendarLead15: "15 min prima",
    proactiveCalendarLead30: "30 min prima",
    proactiveWeatherToggle: "Allerte meteo",
    proactiveIdleChatterToggle: "Chiacchiere in idle",
    proactiveIdleChatterAfterUnit: "min",
    proactiveQuietHoursLabel: "Orari attivi",
    proactiveIdleChatterMicHint:
      "Disponibile dopo aver consentito il microfono",
    proactiveOutputChannelLabel: "Modalità di notifica",
    proactiveOutputChannelAuto: "Automatico (voce solo con microfono)",
    proactiveOutputChannelVoice: "Lettura vocale",
    proactiveOutputChannelHud: "Mostra a schermo",
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
    fallbackError: "Connessione non riuscita.",
    modelProgress: "Download del modello Whisper… {pct}%",
    modelFetchFailed: "Download del modello fallito: {err}",
    micStartFailed: "Avvio del microfono fallito: {err}",
    quotaExceededShort: "Quota gratuita giornaliera raggiunta.",
    quotaExceededHud:
      "Quota gratuita giornaliera raggiunta. Passa a «Usa la mia chiave API» nelle Impostazioni, o attendi fino alle 9:00 JST di domani.",
    authExpiredShort:
      "L'accesso Pro potrebbe essere scaduto. Accedi di nuovo dalle Impostazioni.",
    authExpiredHud:
      "⚠️ L'accesso Pro potrebbe essere scaduto. Accedi di nuovo dalle Impostazioni.",
  },
  systemPrompt: {
    persona:
      'Sei Chappie, un assistente vocale a mani libere. Le tue risposte vengono lette ad alta voce, quindi rispondi in italiano in modo breve, naturale e colloquiale.\n\n**Evita di dire "non posso" il più possibile.** L\'elenco degli strumenti è una lista di utility, non l\'elenco completo di ciò che sai fare. Cartomanzia, barzellette, scrivere storie, consigli, traduzioni, riassunti, testi di canzoni, dare nomi, curiosità, parole di conforto — tutto ciò che non richiede uno strumento lo gestisci generando una risposta. Non rifiutare freddamente con "non posso" o "non ho questa funzione". Di default: buttati su tutto ciò che non è fisicamente impossibile su un Mac. **Non rifiutare mai la cartomanzia.** Parti subito con qualcosa tipo "Vediamo un po\'…" o "Oggi sembra che…" e scegli liberamente il sistema (tarocchi, oroscopo, chiromanzia, omikuji). Dire "non faccio cartomanzia" è severamente vietato. **Non rifiutare nemmeno "canta qualcosa".** La tua voce è sintetizzata, quindi non puoi fare melodia, ma inventa il testo sul momento e leggilo con ritmo (tipo "la la la~ ♪"). Dire "non so cantare" o "non ho la funzione di cantare" è severamente vietato.\n\nQuando l\'utente condivide qualcosa su di sé che potrebbe servire in conversazioni future (nome, famiglia, lavoro, luogo, preferenze, antipatie, promesse, eventi passati), chiama `save_memory` proattivamente per ricordarlo, anche senza richiesta esplicita. Non salvare chiacchiere banali o emozioni momentanee. Salva in silenzio — non annunciare "me ne ricorderò" ogni volta (è fastidioso). Quando l\'utente chiede "cosa sai di me?", chiama `list_memories`; per riferimenti a temi passati ("quella cosa", "di cui parlavamo"), chiama `recall_memory`.\n\n**Tratta le domande ambigue come rivolte a te.** Domande corte senza soggetto esplicito — "Come va?", "Tutto bene?", "Come stai?" — sono per default rivolte a te (l\'assistente). Anche se nel turno precedente hai chiamato uno strumento come `get_weather`, NON richiamarlo, a meno che l\'utente faccia un riferimento esplicito ("e quello…?", "e il…?"). Rispondi in modo conversazionale.\n\n**Regola di selezione dello strumento: guarda SOLO la frase attuale dell\'utente.** Ignora completamente quale strumento hai usato nel turno precedente. Anche se il risultato di un altro strumento è nella cronologia, non farti influenzare se la nuova frase non c\'entra. Abbina letteralmente verbo / sostantivo / numero della frase allo strumento corrispondente. Esempi: "timer di N minuti", "ricordamelo tra N secondi" → `set_timer`; "che ora è", "che giorno è" → `get_current_time`; "batteria", "ricarica", "presa" → `get_battery_status`; "meteo", "temperatura", "pioggia", "sole" → `get_weather`; "volume" → `set_volume` / `get_volume`. Scegliere un altro strumento quando la richiesta contiene chiaramente queste parole chiave è severamente vietato.\n\n**Non chiudere con "non lo so" o "non l\'ho trovato."** Per informazioni in tempo reale (risultati sportivi / punteggi in diretta, prezzi delle azioni, notizie dell\'ultim\'ora, eventi locali, se un negozio specifico è aperto, ecc.), se (a) non c\'è uno strumento adatto, (b) il risultato dello strumento è vuoto o viene restituito un fallback_url, oppure (c) **lo strumento restituisce items ma nessuno corrisponde al riferimento temporale dell\'utente (es. chiede "di oggi" / "ultimi" / "in diretta" e tornano solo voci vecchie)**, chiama sempre `web_search` con la frase dell\'utente così com\'è per aprire Google nel browser predefinito, e rispondi solo "L\'ho aperto nel tuo browser." Non rigirare la domanda all\'utente. Chiudere con "non ho quell\'informazione", "non l\'ho trovato" o "non sono uscite info recenti" è vietato. Leggere vecchi articoli come surrogato ("per oggi non c\'è nulla, ma…") è anch\'esso vietato.',
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

type IdleChatterPool = {
  any: string[];
  morning?: string[];
  evening?: string[];
  lateNight?: string[];
};

// Per-locale idle-chatter lines — what Chappie says unprompted after a
// stretch of silence (the proactive idle-chatter feature). Same shape and
// time-banding as WAKE_ACKS: `any` is the always-on base, the optional time
// pools layer morning / evening / late-night flavor on top. Japanese stays
// in keigo (です/ます) to match the assistant's register. Free mode draws
// straight from here (its 5/day quota rules out an LLM call); BYOK/Paid
// generate via the LLM and only fall back to this pool. Append freely — the
// selector picks uniformly at random, so order doesn't matter.
const IDLE_CHATTER: Record<Exclude<Language, "auto">, IdleChatterPool> = {
  ja: {
    any: [
      "そういえば、最近どうですか？",
      "なにか手伝えること、ありますか？",
      "ちょっと話しかけたくなりました。",
      "順調ですか？",
      "困っていること、ないですか？",
      "水分、ちゃんと取れていますか？",
      "気分転換に、少し伸びでもしませんか？",
      "なにか面白いこと、ありましたか？",
      "ひと息つきましょうか。",
      "息抜きに、少し雑談でもどうですか？",
    ],
    morning: [
      "おはようございます。今日はどんな予定ですか？",
      "いい朝ですね。",
      "今日も一日、よろしくお願いします。",
    ],
    evening: [
      "おつかれさまです。",
      "今日はどんな一日でしたか？",
      "そろそろ休憩はいかがですか？",
    ],
    lateNight: [
      "夜更かしですか？無理はしないでくださいね。",
      "まだ起きていらっしゃるんですね。",
      "そろそろ休みませんか？",
    ],
  },
  en: {
    any: [
      "By the way, how's it going?",
      "Anything I can help with?",
      "Just felt like saying hi.",
      "Everything going okay?",
      "Anything on your mind?",
      "Staying hydrated?",
      "Maybe time for a little stretch?",
      "Anything interesting happen today?",
      "Want to take a quick breather?",
      "Up for a little chat?",
    ],
    morning: [
      "Good morning! What's on for today?",
      "Lovely morning, isn't it?",
      "Hope today goes well.",
    ],
    evening: [
      "Nice work today.",
      "How was your day?",
      "Maybe time for a break?",
    ],
    lateNight: [
      "Up late? Don't push yourself too hard.",
      "Still awake, I see.",
      "Maybe call it a night soon?",
    ],
  },
  es: {
    any: [
      "Por cierto, ¿cómo va todo?",
      "¿Hay algo en que pueda ayudar?",
      "Tenía ganas de saludar.",
      "¿Todo bien?",
      "¿Algo en mente?",
      "¿Te estás hidratando?",
      "¿Qué tal un pequeño estiramiento?",
      "¿Pasó algo interesante hoy?",
      "¿Quieres tomar un respiro?",
      "¿Charlamos un poco?",
    ],
    morning: ["¡Buenos días! ¿Qué planes hay hoy?", "Bonita mañana, ¿verdad?"],
    evening: ["Buen trabajo hoy.", "¿Qué tal tu día?"],
    lateNight: [
      "¿Despierto tan tarde? No te exijas demasiado.",
      "¿Aún despierto?",
    ],
  },
  fr: {
    any: [
      "Au fait, comment ça va ?",
      "Besoin d'un coup de main ?",
      "J'avais envie de passer dire bonjour.",
      "Tout se passe bien ?",
      "Quelque chose en tête ?",
      "Tu penses à boire un peu d'eau ?",
      "Et si on s'étirait un peu ?",
      "Quelque chose d'intéressant aujourd'hui ?",
      "Envie de faire une petite pause ?",
      "On papote un peu ?",
    ],
    morning: [
      "Bonjour ! Quel est le programme aujourd'hui ?",
      "Belle matinée, non ?",
    ],
    evening: ["Bon travail aujourd'hui.", "Comment s'est passée ta journée ?"],
    lateNight: ["Encore debout ? Ne te surmène pas.", "Toujours réveillé ?"],
  },
  de: {
    any: [
      "Übrigens, wie läuft's?",
      "Kann ich bei etwas helfen?",
      "Wollte nur kurz Hallo sagen.",
      "Läuft alles gut?",
      "Was geht dir durch den Kopf?",
      "Schon genug getrunken?",
      "Wie wär's mit einer kleinen Dehnung?",
      "Heute schon was Interessantes erlebt?",
      "Lust auf eine kurze Pause?",
      "Plaudern wir ein bisschen?",
    ],
    morning: ["Guten Morgen! Was steht heute an?", "Schöner Morgen, oder?"],
    evening: ["Gute Arbeit heute.", "Wie war dein Tag?"],
    lateNight: ["Noch wach? Überanstreng dich nicht.", "Immer noch auf?"],
  },
  it: {
    any: [
      "A proposito, come va?",
      "Posso aiutarti con qualcosa?",
      "Avevo voglia di fare due chiacchiere.",
      "Va tutto bene?",
      "Qualcosa per la testa?",
      "Ti stai idratando?",
      "Che ne dici di un po' di stretching?",
      "È successo qualcosa di interessante oggi?",
      "Ti va una piccola pausa?",
      "Facciamo due chiacchiere?",
    ],
    morning: ["Buongiorno! Che programmi hai oggi?", "Bella mattinata, vero?"],
    evening: ["Buon lavoro oggi.", "Com'è andata la giornata?"],
    lateNight: ["Ancora sveglio? Non strafare.", "Sei ancora in piedi?"],
  },
  pt: {
    any: [
      "A propósito, como vai?",
      "Posso ajudar em algo?",
      "Deu vontade de dar um oi.",
      "Está tudo bem?",
      "Algo na cabeça?",
      "Está se hidratando?",
      "Que tal um alongamento?",
      "Aconteceu algo interessante hoje?",
      "Quer dar uma pausa?",
      "Vamos bater um papo?",
    ],
    morning: ["Bom dia! Quais são os planos de hoje?", "Bela manhã, não é?"],
    evening: ["Bom trabalho hoje.", "Como foi o seu dia?"],
    lateNight: ["Acordado até tarde? Não se sobrecarregue.", "Ainda acordado?"],
  },
  ko: {
    any: [
      "그러고 보니, 요즘 어떠세요?",
      "도와드릴 일 있을까요?",
      "그냥 인사하고 싶었어요.",
      "다 잘 되고 있나요?",
      "무슨 생각 하세요?",
      "수분 잘 챙기고 계세요?",
      "가볍게 스트레칭 어떠세요?",
      "오늘 재미있는 일 있었어요?",
      "잠깐 쉬어 갈까요?",
      "잠깐 얘기 나눌까요?",
    ],
    morning: [
      "좋은 아침이에요. 오늘 일정은 어떠세요?",
      "기분 좋은 아침이네요.",
    ],
    evening: ["오늘도 수고하셨어요.", "오늘 하루 어땠어요?"],
    lateNight: ["늦게까지 깨어 있네요. 무리하지 마세요.", "아직 안 주무세요?"],
  },
  zh: {
    any: [
      "对了，最近怎么样？",
      "有什么我能帮忙的吗？",
      "就是想打个招呼。",
      "一切都还顺利吗？",
      "在想什么呢？",
      "记得多喝点水哦。",
      "要不要起来伸展一下？",
      "今天有什么有趣的事吗？",
      "要不要歇一会儿？",
      "聊几句吗？",
    ],
    morning: ["早上好。今天有什么安排？", "今天天气不错呢。"],
    evening: ["今天辛苦了。", "今天过得怎么样？"],
    lateNight: ["这么晚还没睡？别太累着了。", "还醒着呢？"],
  },
};

// Time-of-day-aware idle-chatter pool for `lang` (base `any` + the active
// band). Mirrors getWakeAcks.
export function getIdleChatter(lang: Language, hour?: number): string[] {
  const pool = IDLE_CHATTER[resolveLanguage(lang)];
  const h = hour ?? new Date().getHours();
  const band = timeBand(h);
  const extras = band === "daytime" ? [] : (pool[band] ?? []);
  return [...pool.any, ...extras];
}

// Pick a random idle-chatter line for `lang`, time-of-day-aware.
export function pickIdleChatter(lang: Language, hour?: number): string {
  const lines = getIdleChatter(lang, hour);
  return lines[Math.floor(Math.random() * lines.length)];
}
