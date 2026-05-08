// OpenAI Chat Completions invoked from Rust so the API key never lives in
// the renderer process. The renderer passes the user-entered key from the
// Tauri store and we forward it as a Bearer token. The reqwest::Client is
// reused across calls to amortize TLS + connection setup.
//
// Streaming: the renderer hands us a `Channel<String>`; each text delta is
// pushed over the channel as soon as it arrives so the renderer can begin
// TTS on partial output. Tool calls are buffered (not streamed downstream)
// because they are executed locally before the model continues; the next
// round's text, however, streams again.

use chrono::TimeZone;
use futures_util::StreamExt;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
use tauri::ipc::Channel;

static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .expect("failed to build reqwest client")
});

const MAX_TOOL_ROUNDS: usize = 5;

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatResult {
    pub text: String,
    pub end_conversation: bool,
}

#[derive(Deserialize, Default)]
struct StreamDelta {
    content: Option<String>,
    tool_calls: Option<Vec<ToolCallDelta>>,
}

#[derive(Deserialize)]
struct ToolCallDelta {
    index: u32,
    id: Option<String>,
    function: Option<ToolFunctionDelta>,
}

#[derive(Deserialize)]
struct ToolFunctionDelta {
    name: Option<String>,
    arguments: Option<String>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
}

#[derive(Default, Clone)]
struct AccumulatedToolCall {
    id: String,
    name: String,
    arguments: String,
}

pub(crate) fn all_tools() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "end_conversation",
                "description": "ユーザーが会話の終了を示したとき（「ありがとう」「じゃあね」「またね」など）に呼び出してください。呼び出すとアシスタントは聞き取りを停止しウェイクワード待ちに戻ります。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_current_time",
                "description": "現在の日付と時刻（ローカルタイム）を取得します。「今何時？」「今日は何日？」「今日は何曜日？」のような質問に答えるとき必ず呼び出してください。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_timer",
                "description": "指定秒数後に発火するタイマーを設定します。「3分タイマー」「10分後に教えて」「1時間半セットして」のような指示で必ず呼び出してください。分・時間は秒に換算して duration_seconds に渡します（例: 3分 = 180）。label は「お茶」「会議」など用途のラベル（任意）。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "duration_seconds": {
                            "type": "integer",
                            "description": "発火までの秒数。最低1秒。",
                            "minimum": 1
                        },
                        "label": {
                            "type": "string",
                            "description": "タイマーの用途を示す短いラベル。指定がなければ省略可。"
                        }
                    },
                    "required": ["duration_seconds"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_timers",
                "description": "現在動いているタイマーの一覧を取得します。「タイマー残り何分?」「いまセットしてるタイマー教えて」などで呼び出してください。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "open_url",
                "description": "ユーザーの既定ブラウザで指定 URL を開きます。「○○のサイト開いて」「YouTube 開いて」「GitHub の chappie リポジトリ開いて」のような指示で呼び出してください。url は http:// または https:// で始まる完全な URL である必要があります。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "開く URL。http:// または https:// で始まる完全な URL。"
                        }
                    },
                    "required": ["url"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "web_search",
                "description": "ユーザーの既定ブラウザで Google 検索を開きます。「○○について調べて」「○○を検索して」「○○ググって」のような指示で呼び出してください。最新情報や Web 上の情報が必要なときに使用してください。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "検索クエリ。"
                        }
                    },
                    "required": ["query"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "天気予報を取得します。「東京の天気は？」「明日の大阪の天気教えて」「天気どう？」のような質問で呼び出してください。location を省略するか空文字にした場合はユーザーの現在地（IP 推定）の天気を返します。現在の気温・天候、今日と明日の最高 / 最低気温と降水確率を返します。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "天気を知りたい地名（例: 東京、大阪、Paris）。指定しなければユーザーの現在地。"
                        }
                    },
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_volume",
                "description": "現在のシステム音量とミュート状態を取得します。「いま音量いくつ？」のような質問や、「音量上げて」「もう少し下げて」のような相対指示で **set_volume を呼ぶ前に必ずこれを呼んで現在値を確認**してください。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_volume",
                "description": "システムの出力音量を 0〜100 で設定します。「音量30%」「音量50にして」のような絶対指示で呼び出してください。「上げて」「下げて」のような相対指示の場合は **先に get_volume で現在値を取り、適切な絶対値を計算してから呼ぶ**こと（目安: 1段階 = ±10）。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "level": {
                            "type": "integer",
                            "description": "音量レベル（0=無音, 100=最大）。",
                            "minimum": 0,
                            "maximum": 100
                        }
                    },
                    "required": ["level"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_mute",
                "description": "システム出力のミュートを切り替えます。「ミュート」「消音」→ muted=true、「ミュート解除」「音戻して」→ muted=false。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "muted": {
                            "type": "boolean",
                            "description": "true=ミュート, false=ミュート解除。"
                        }
                    },
                    "required": ["muted"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "open_finder",
                "description": "Finder で指定の場所を開きます。「ダウンロードフォルダ開いて」「デスクトップ開いて」「アプリケーションフォルダ開いて」「ゴミ箱開いて」のような指示で呼び出してください。target はキーワード（'downloads', 'desktop', 'documents', 'pictures', 'music', 'movies', 'applications', 'trash', 'home'）または絶対パス（先頭 '~/' は展開されます）。日本語キーワード（ダウンロード、デスクトップ等）も受け付けます。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target": {
                            "type": "string",
                            "description": "場所を示すキーワードまたはパス。"
                        }
                    },
                    "required": ["target"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "open_app",
                "description": "macOS の指定アプリを起動します。「Slack 開いて」「Spotify 起動して」「メモ開いて」「VSCode 立ち上げて」のような指示で呼び出してください。name にはユーザーが言ったアプリ名をそのまま渡します（例: 'Slack', 'Spotify', 'メモ', 'Visual Studio Code'）。`open -a` 経由で起動するので、Applications にインストールされていれば見つかります。\n\n**曖昧なケースの方針**: 名前がアプリでもウェブサービスでもありえる場合（Notion / Twitter / GitHub / YouTube / ChatGPT など）、まずこの open_app を試してください。失敗（not_installed=true）が返ってきたら、続けて open_url で公式 URL を開く、または web_search で検索するフォールバックを行います。失敗したことをユーザーに長々と説明する必要はなく、ウェブで開いた旨を一言伝える程度で OK。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "起動するアプリ名（macOS の Application 名）。"
                        }
                    },
                    "required": ["name"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_clipboard",
                "description": "ユーザーのクリップボード（コピー履歴の最新）の内容を取得します。「クリップボード読み上げて」「コピーしたやつ何だっけ」「これ何て書いてある？」（直前にコピーした想定）のような指示で呼び出してください。テキスト以外（画像など）が入っている場合はエラーが返ります。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "write_clipboard",
                "description": "指定したテキストをユーザーのクリップボードに書き込みます。「○○をコピーしといて」「それコピーして」「クリップボードに入れて」のような指示で呼び出してください。会話で生成した文章・コード・要約などを他のアプリに貼り付けたい場合に使います。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "クリップボードに書き込むテキスト。"
                        }
                    },
                    "required": ["text"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_capabilities",
                "description": "Chappie 自身ができることの一覧を返します。「何ができるの？」「Chappie って何？」「使い方教えて」「他には何ができる？」のような自己紹介系の質問で必ず呼び出してください。返ってきた内容は、ユーザーに自然な会話調で要約して伝えます（カテゴリ全部を読み上げず、興味ありそうな2〜3カテゴリに絞ってよい）。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_sleep_prevention",
                "description": "現在スリープ抑止が ON かどうかを取得します。「今スリープしないモード？」「カフェイン入ってる？」のような質問で呼び出してください。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_sleep_prevention",
                "description": "Mac がスリープに入らないようにする / 元に戻す（macOS の caffeinate コマンド）。「スリープしないようにして」「ずっと起きてて」「画面消さないで」→ enabled=true（duration_minutes 任意）、「もう寝てもいい」「スリープ戻して」「解除して」→ enabled=false。「30分起きてて」のような時間指定があれば duration_minutes に分単位で渡します（指定なしなら無制限）。**lock_screen との混同に注意**: 「画面ロック」「ロックして」は lock_screen を呼ぶこと。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "enabled": {
                            "type": "boolean",
                            "description": "true=スリープ抑止 ON, false=OFF（既定の挙動に戻す）。"
                        },
                        "duration_minutes": {
                            "type": "integer",
                            "description": "抑止する時間（分）。指定なしなら時間無制限（stop されるまで）。",
                            "minimum": 1
                        }
                    },
                    "required": ["enabled"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "lock_screen",
                "description": "Mac の画面ロック / ディスプレイオフ / スリープを実行します。「画面ロック」「ロックして」→ mode='lock'（ログイン画面に戻す。本体は起きたまま）、「画面消して」「ディスプレイ消して」→ mode='display_off'（画面だけオフ）、「スリープして」「眠らせて」→ mode='sleep'（本体ごとスリープ）。意図が曖昧なときは 'lock' を選んでください（一番安全で復帰も速い）。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "mode": {
                            "type": "string",
                            "enum": ["lock", "display_off", "sleep"],
                            "description": "lock=ログイン画面, display_off=画面だけオフ, sleep=本体スリープ。"
                        }
                    },
                    "required": ["mode"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_battery_status",
                "description": "Mac のバッテリー残量・充電状態・残り時間を取得します。「バッテリー何％？」「充電あとどれくらい？」「電源繋いでる？」のような質問で呼び出してください。デスクトップ Mac などバッテリーがない場合は has_battery=false で返ります。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_note",
                "description": "ユーザーの声でメモを残します。「これメモしといて: ○○」「○○を覚えておいて」「○○ってメモして」のような指示で呼び出してください。text にはユーザーがメモしたい内容そのもの（補足や前置きは付けない）。アプリ再起動後も保持されます。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "メモ本文。"
                        }
                    },
                    "required": ["text"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_notes",
                "description": "保存済みメモを取得します。「メモ何ある？」「最近のメモ読んで」「○○のメモ探して」のような指示で呼び出してください。query を渡すと部分一致（大文字小文字無視）でフィルタ、未指定なら直近 limit 件（既定 10）を新しい順で返します。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "検索語。空または未指定なら全件。"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "最大件数（既定 10）。",
                            "minimum": 1,
                            "maximum": 50
                        }
                    },
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "delete_note",
                "description": "メモを削除します。「○○のメモ消して」のような指示で呼び出してください。id が分からない場合は **先に list_notes で該当 id を特定**してから呼びます。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "削除するメモの ID。"
                        }
                    },
                    "required": ["id"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "control_music",
                "description": "起動中の Spotify または Apple Music を再生 / 停止 / 次の曲 / 前の曲に切り替えます。「音楽流して」「再生して」→ action='play'、「止めて」「ポーズ」→ 'pause'、「次の曲」「スキップ」→ 'next'、「前の曲」「戻して」→ 'previous'、「再生・停止切り替えて」→ 'toggle'。app は通常省略（auto = Spotify が起動していれば優先、なければ Music）。アプリが両方とも起動していない場合はエラーになります。**勝手にアプリを起動はしません。**",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["play", "pause", "toggle", "next", "previous"],
                            "description": "操作。"
                        },
                        "app": {
                            "type": "string",
                            "enum": ["auto", "spotify", "music"],
                            "description": "対象アプリ。省略すると auto。"
                        }
                    },
                    "required": ["action"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_now_playing",
                "description": "Spotify / Apple Music で再生中の曲情報（曲名・アーティスト・アルバム・再生状態）を取得します。「いま何の曲？」「これ誰の歌？」「再生中？」のような質問で呼び出してください。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "app": {
                            "type": "string",
                            "enum": ["auto", "spotify", "music"],
                            "description": "対象アプリ。省略すると auto。"
                        }
                    },
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_reminder_at",
                "description": "指定した絶対時刻にリマインダーを設定します。「明日7時に起こして」「20時に薬」「日曜日10時に会議って言って」のような **絶対時刻指定** で呼び出してください。秒単位の相対指定（「3分後」など）は set_timer を使ってください。**必ず先に get_current_time を呼んで現在の年月日と時刻を確認してから** at に未来の絶対時刻を組み立てて渡します。at は **ユーザーのローカルタイム** で `YYYY-MM-DD HH:MM` 形式（例: 2026-05-10 07:00）。「明日」「来週」などは現在時刻を基準に解決してください。リマインダーはアプリを再起動しても保持されます。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "at": {
                            "type": "string",
                            "description": "発火時刻。ユーザーのローカルタイムで `YYYY-MM-DD HH:MM`（例: 2026-05-10 07:00）。"
                        },
                        "label": {
                            "type": "string",
                            "description": "リマインダーの内容（例: 起床、薬、会議）。発火時に「○○の時間です」と読み上げられます。"
                        }
                    },
                    "required": ["at", "label"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_reminders",
                "description": "登録済みのリマインダー一覧（時刻順）を取得します。「リマインダー何ある？」「予定教えて」のような指示で呼び出してください。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "cancel_reminder",
                "description": "リマインダーを取り消します。id を指定すると該当のみ、未指定なら全件キャンセル。「明日の起床リマインダー消して」「リマインダー全部消して」などで使います。id が分からない場合は **先に list_reminders を呼んで該当 id を特定**してください。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "取り消すリマインダーの ID。未指定なら全件。"
                        }
                    },
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "take_screenshot",
                "description": "macOS の `screencapture` でスクリーンショットを撮ります。「スクショ撮って」「キャプチャお願い」「画面コピーして」のような指示で呼び出してください。mode='selection'（既定）はユーザーがマウスで範囲をドラッグ選択、mode='fullscreen' は全画面。destination='clipboard'（既定）はクリップボードに入れて貼り付けられる状態に、destination='file' は ~/Desktop に PNG で保存します。「デスクトップに保存して」「画像ファイルにして」のような指示なら destination='file'。範囲選択中にユーザーが Esc でキャンセルした場合は cancelled=true で返ります。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "mode": {
                            "type": "string",
                            "enum": ["selection", "fullscreen"],
                            "description": "selection=範囲選択（既定）, fullscreen=全画面。"
                        },
                        "destination": {
                            "type": "string",
                            "enum": ["clipboard", "file"],
                            "description": "clipboard=クリップボードに入れる（既定）, file=~/Desktop に PNG 保存。"
                        }
                    },
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "cancel_timer",
                "description": "タイマーを取り消します。id を指定すると該当タイマー、未指定なら全件取り消し。「タイマー消して」「全部キャンセル」などで呼び出してください。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "取り消すタイマーの ID。未指定なら全件キャンセル。"
                        }
                    },
                    "additionalProperties": false
                }
            }
        }
    ])
}

fn format_current_time() -> String {
    let now = chrono::Local::now();
    let weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    let weekday = weekdays[now.format("%w").to_string().parse::<usize>().unwrap_or(0)];
    now.format(&format!("%Y年%-m月%-d日（{weekday}）%-H時%M分"))
        .to_string()
}

pub(crate) async fn execute_tool(
    app: &tauri::AppHandle,
    name: &str,
    args: &Value,
    end_conversation: &mut bool,
) -> String {
    match name {
        "end_conversation" => {
            *end_conversation = true;
            "ok".to_string()
        }
        "get_current_time" => format_current_time(),
        "get_weather" => {
            let location = args
                .get("location")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            if location.is_empty() {
                if let Some(here) = crate::location::cached() {
                    let label = crate::location::format_for_prompt(&here);
                    match crate::weather::lookup_by_coords(
                        here.latitude,
                        here.longitude,
                        &label,
                        here.timezone.as_deref(),
                    )
                    .await
                    {
                        Ok(text) => text,
                        Err(e) => format!("error: {e}"),
                    }
                } else {
                    "error: ユーザーの現在地が取得できていません。地名を指定してもう一度呼んでください。".to_string()
                }
            } else {
                match crate::weather::lookup(location).await {
                    Ok(text) => text,
                    Err(e) => format!("error: {e}"),
                }
            }
        }
        "set_timer" => {
            let secs = args.get("duration_seconds").and_then(|v| v.as_u64());
            let Some(secs) = secs else {
                return "error: duration_seconds is required".to_string();
            };
            if secs == 0 {
                return "error: duration_seconds must be >= 1".to_string();
            }
            let label = args
                .get("label")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let info = crate::timer::set_timer(app, secs, label.clone());
            json!({
                "id": info.id,
                "label": info.label,
                "duration": crate::timer::format_duration(info.duration_seconds),
                "fires_at_unix_ms": info.fires_at_unix_ms
            })
            .to_string()
        }
        "list_timers" => {
            let timers = crate::timer::list_timers();
            let now_ms = chrono::Local::now().timestamp_millis();
            let entries: Vec<Value> = timers
                .into_iter()
                .map(|t| {
                    let remaining_secs = ((t.fires_at_unix_ms - now_ms).max(0) / 1000) as u64;
                    json!({
                        "id": t.id,
                        "label": t.label,
                        "remaining": crate::timer::format_duration(remaining_secs)
                    })
                })
                .collect();
            json!({ "timers": entries }).to_string()
        }
        "open_url" => {
            let url = args.get("url").and_then(|v| v.as_str()).unwrap_or("");
            if !(url.starts_with("https://") || url.starts_with("http://")) {
                return json!({ "ok": false, "error": "url must start with http:// or https://" }).to_string();
            }
            match tauri_plugin_opener::OpenerExt::opener(app).open_url(url, None::<&str>) {
                Ok(()) => json!({ "ok": true, "url": url }).to_string(),
                Err(e) => json!({ "ok": false, "error": e.to_string() }).to_string(),
            }
        }
        "web_search" => {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            if query.trim().is_empty() {
                return json!({ "ok": false, "error": "query is empty" }).to_string();
            }
            let url = format!(
                "https://www.google.com/search?q={}",
                urlencoding::encode(query)
            );
            match tauri_plugin_opener::OpenerExt::opener(app).open_url(&url, None::<&str>) {
                Ok(()) => json!({ "ok": true, "query": query }).to_string(),
                Err(e) => json!({ "ok": false, "error": e.to_string() }).to_string(),
            }
        }
        "get_volume" => match crate::volume::get() {
            Ok(v) => json!({ "ok": true, "level": v.level, "muted": v.muted }).to_string(),
            Err(e) => json!({ "ok": false, "error": e }).to_string(),
        },
        "set_volume" => {
            let level = args.get("level").and_then(|v| v.as_i64());
            let Some(level) = level else {
                return json!({ "ok": false, "error": "level is required" }).to_string();
            };
            let level = level.clamp(0, 100) as u8;
            match crate::volume::set_level(level) {
                Ok(()) => json!({ "ok": true, "level": level }).to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "set_mute" => {
            let muted = args.get("muted").and_then(|v| v.as_bool());
            let Some(muted) = muted else {
                return json!({ "ok": false, "error": "muted is required" }).to_string();
            };
            match crate::volume::set_muted(muted) {
                Ok(()) => {
                    if muted {
                        crate::hud::show(app, "🔇 ミュート", 2500);
                    } else {
                        crate::hud::show(app, "🔊 ミュート解除", 2000);
                    }
                    json!({ "ok": true, "muted": muted }).to_string()
                }
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "open_finder" => {
            let target = args
                .get("target")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if target.is_empty() {
                return json!({ "ok": false, "error": "target is required" }).to_string();
            }
            match crate::finder::open(&target) {
                Ok(path) => json!({
                    "ok": true,
                    "target": target,
                    "path": path.display().to_string()
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "open_app" => {
            let name = args
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            if name.is_empty() {
                return json!({ "ok": false, "error": "name is empty" }).to_string();
            }
            match std::process::Command::new("open")
                .arg("-a")
                .arg(name)
                .status()
            {
                Ok(s) if s.success() => json!({ "ok": true, "name": name }).to_string(),
                Ok(_) => json!({
                    "ok": false,
                    "not_installed": true,
                    "error": format!("'{name}' というアプリは見つかりませんでした（インストールされていない可能性があります）。"),
                    "fallback_hint": format!("ユーザーは '{name}' のウェブサイトを開きたかった可能性があります。Notion / Slack / GitHub / Twitter / YouTube など、ウェブサービスとしても存在する名前なら、open_url で公式 URL を開くか、web_search でその名前を検索するのが妥当なフォールバックです。ユーザーに『○○のサイトを開きますか？』と聞き返さず、自然にウェブで開いた旨を伝えてください。")
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e.to_string() }).to_string(),
            }
        }
        "read_clipboard" => match crate::clipboard::read() {
            Ok(text) => {
                if text.is_empty() {
                    json!({ "ok": false, "error": "clipboard is empty" }).to_string()
                } else {
                    json!({ "ok": true, "text": text }).to_string()
                }
            }
            Err(e) => json!({ "ok": false, "error": e }).to_string(),
        },
        "write_clipboard" => {
            let text = args.get("text").and_then(|v| v.as_str()).unwrap_or("");
            if text.is_empty() {
                return json!({ "ok": false, "error": "text is empty" }).to_string();
            }
            match crate::clipboard::write(text) {
                Ok(()) => json!({ "ok": true, "chars": text.chars().count() }).to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "list_capabilities" => crate::capabilities::capabilities_text(),
        "get_sleep_prevention" => match crate::caffeinate::status() {
            Some(until_ms) => {
                let until_local = until_ms.and_then(|ms| {
                    chrono::Local
                        .timestamp_millis_opt(ms)
                        .single()
                        .map(|d| d.format("%H:%M").to_string())
                });
                json!({ "ok": true, "enabled": true, "until_local": until_local }).to_string()
            }
            None => json!({ "ok": true, "enabled": false }).to_string(),
        },
        "set_sleep_prevention" => {
            let Some(enabled) = args.get("enabled").and_then(|v| v.as_bool()) else {
                return json!({ "ok": false, "error": "enabled is required" }).to_string();
            };
            if enabled {
                let mins = args
                    .get("duration_minutes")
                    .and_then(|v| v.as_u64());
                match crate::caffeinate::start(mins) {
                    Ok(until_ms) => {
                        let until_local = until_ms.and_then(|ms| {
                            chrono::Local
                                .timestamp_millis_opt(ms)
                                .single()
                                .map(|d| d.format("%H:%M").to_string())
                        });
                        json!({
                            "ok": true,
                            "enabled": true,
                            "duration_minutes": mins,
                            "until_local": until_local
                        })
                        .to_string()
                    }
                    Err(e) => json!({ "ok": false, "error": e }).to_string(),
                }
            } else {
                let was_active = crate::caffeinate::stop();
                json!({ "ok": true, "enabled": false, "was_active": was_active }).to_string()
            }
        }
        "lock_screen" => {
            let mode = args.get("mode").and_then(|v| v.as_str()).unwrap_or("");
            if mode.is_empty() {
                return json!({ "ok": false, "error": "mode is required" }).to_string();
            }
            match crate::power::run(mode) {
                Ok(()) => json!({ "ok": true, "mode": mode }).to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "get_battery_status" => match crate::battery::status() {
            Ok(b) => json!({
                "ok": true,
                "has_battery": b.has_battery,
                "percent": b.percent,
                "state": b.state,
                "time_remaining": b.time_remaining,
                "power_source": b.power_source
            })
            .to_string(),
            Err(e) => json!({ "ok": false, "error": e }).to_string(),
        },
        "add_note" => {
            let text = args
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::notes::add(text) {
                Ok(n) => json!({
                    "ok": true,
                    "id": n.id,
                    "text": n.text,
                    "created_at_unix_ms": n.created_at_unix_ms
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "list_notes" => {
            let query = args.get("query").and_then(|v| v.as_str());
            let limit = args
                .get("limit")
                .and_then(|v| v.as_u64())
                .map(|n| n as usize)
                .unwrap_or(10);
            let notes = crate::notes::list(query, limit);
            let entries: Vec<Value> = notes
                .into_iter()
                .map(|n| {
                    let local = chrono::Local
                        .timestamp_millis_opt(n.created_at_unix_ms)
                        .single()
                        .map(|d| d.format("%Y-%m-%d %H:%M").to_string())
                        .unwrap_or_default();
                    json!({
                        "id": n.id,
                        "text": n.text,
                        "created_at": local
                    })
                })
                .collect();
            json!({ "notes": entries }).to_string()
        }
        "delete_note" => {
            let Some(id) = args.get("id").and_then(|v| v.as_u64()) else {
                return json!({ "ok": false, "error": "id is required" }).to_string();
            };
            let deleted = crate::notes::delete(id as u32);
            json!({ "ok": deleted, "id": id }).to_string()
        }
        "control_music" => {
            let action = args.get("action").and_then(|v| v.as_str()).unwrap_or("");
            let app_arg = args.get("app").and_then(|v| v.as_str());
            if action.is_empty() {
                return json!({ "ok": false, "error": "action is required" }).to_string();
            }
            match crate::music::control(action, app_arg) {
                Ok(r) => json!({
                    "ok": true,
                    "player": r.player,
                    "action": r.action
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "get_now_playing" => {
            let app_arg = args.get("app").and_then(|v| v.as_str());
            match crate::music::now_playing(app_arg) {
                Ok(np) => json!({
                    "ok": true,
                    "player": np.player,
                    "state": np.state,
                    "track": np.track,
                    "artist": np.artist,
                    "album": np.album
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "add_reminder_at" => {
            let at = args.get("at").and_then(|v| v.as_str()).unwrap_or("");
            let label = args
                .get("label")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if at.is_empty() {
                return json!({ "ok": false, "error": "at is required" }).to_string();
            }
            let fires_at_unix_ms = match crate::reminder::parse_local_at(at) {
                Ok(v) => v,
                Err(e) => return json!({ "ok": false, "error": e }).to_string(),
            };
            match crate::reminder::add(app, fires_at_unix_ms, label) {
                Ok(r) => json!({
                    "ok": true,
                    "id": r.id,
                    "label": r.label,
                    "fires_at_unix_ms": r.fires_at_unix_ms,
                    "fires_at_local": chrono::Local
                        .timestamp_millis_opt(r.fires_at_unix_ms)
                        .single()
                        .map(|d| d.format("%Y-%m-%d %H:%M").to_string())
                        .unwrap_or_default()
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "list_reminders" => {
            let entries: Vec<Value> = crate::reminder::list()
                .into_iter()
                .map(|r| {
                    let local = chrono::Local
                        .timestamp_millis_opt(r.fires_at_unix_ms)
                        .single()
                        .map(|d| d.format("%Y-%m-%d %H:%M").to_string())
                        .unwrap_or_default();
                    json!({
                        "id": r.id,
                        "label": r.label,
                        "fires_at_local": local
                    })
                })
                .collect();
            json!({ "reminders": entries }).to_string()
        }
        "cancel_reminder" => {
            if let Some(id) = args.get("id").and_then(|v| v.as_u64()) {
                let ok = crate::reminder::cancel(id as u32);
                json!({ "cancelled": ok, "id": id }).to_string()
            } else {
                let n = crate::reminder::cancel_all();
                json!({ "cancelled_all": n }).to_string()
            }
        }
        "take_screenshot" => {
            let mode = args
                .get("mode")
                .and_then(|v| v.as_str())
                .unwrap_or("selection");
            let destination = args
                .get("destination")
                .and_then(|v| v.as_str())
                .unwrap_or("clipboard");
            match crate::screenshot::capture(mode, destination).await {
                Ok(r) => json!({
                    "ok": true,
                    "mode": mode,
                    "destination": destination,
                    "path": r.path,
                    "copied_to_clipboard": r.copied_to_clipboard,
                    "cancelled": r.cancelled
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "cancel_timer" => {
            if let Some(id) = args.get("id").and_then(|v| v.as_u64()) {
                let ok = crate::timer::cancel_timer(id as u32);
                json!({ "cancelled": ok, "id": id }).to_string()
            } else {
                let n = crate::timer::cancel_all();
                json!({ "cancelled_all": n }).to_string()
            }
        }
        other => format!("unknown tool: {other}"),
    }
}

#[tauri::command]
pub async fn chat_complete(
    app: tauri::AppHandle,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    on_chunk: Channel<String>,
) -> Result<ChatResult, String> {
    if api_key.trim().is_empty() {
        return Err("missing api key".into());
    }

    // Auto-detect provider from key prefix. OpenAI / xAI / OpenRouter speak
    // the same chat/completions wire format and only differ in base URL,
    // so they flow through this function. Gemini and Anthropic each have
    // their own API and are delegated to dedicated modules.
    let provider = crate::provider::detect_from_key(&api_key);
    let env_override = std::env::var("CHAPPIE_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty());
    if provider == crate::provider::Provider::Gemini {
        let model = env_override
            .clone()
            .unwrap_or_else(|| provider.default_model().to_string());
        return crate::gemini::chat_complete(app, api_key, model, messages, on_chunk).await;
    }
    if provider == crate::provider::Provider::Anthropic {
        let model = env_override
            .clone()
            .unwrap_or_else(|| provider.default_model().to_string());
        return crate::anthropic::chat_complete(app, api_key, model, messages, on_chunk).await;
    }
    if !provider.is_openai_compatible() {
        return Err(format!(
            "{} provider is not yet supported.",
            provider.label()
        ));
    }
    let endpoint = format!("{}/chat/completions", provider.base_url());

    // For OpenAI-compatible (xAI / OpenRouter): if the renderer sent us
    // an OpenAI-style default but the key isn't OpenAI, swap in the
    // provider's recommended model. CHAPPIE_MODEL env var wins over both.
    let model = env_override.unwrap_or_else(|| {
        if provider == crate::provider::Provider::OpenAI {
            model
        } else {
            provider.default_model().to_string()
        }
    });

    crate::linfo!(
        &app,
        "openai",
        "provider={} endpoint={} model={}",
        provider.label(),
        endpoint,
        model
    );

    let mut working: Vec<Value> = messages
        .into_iter()
        .map(|m| json!({"role": m.role, "content": m.content}))
        .collect();

    // Inject the user's approximate location as a system message so chat
    // replies can ground themselves in the right area without the user
    // having to repeat it every turn. Lookup is lazy: if the cache is cold
    // (first turn after launch faster than the startup fetch finished),
    // we trigger one synchronously here with a short timeout.
    let loc = if let Some(c) = crate::location::cached() {
        Some(c)
    } else {
        crate::location::get(false).await.ok()
    };
    if let Some(loc) = loc {
        let context = format!(
            "ユーザーのおおよその現在地は {} です。場所が指定されない天気・地理・地域に関する質問はここを既定として返答してください（IP ベース推定なので住所単位の精度はありません）。",
            crate::location::format_for_prompt(&loc)
        );
        working.insert(0, json!({"role": "system", "content": context}));
    }

    let mut end_conversation = false;
    let mut full_text = String::new();

    for round in 0..=MAX_TOOL_ROUNDS {
        let body = json!({
            "model": model,
            "messages": working,
            "tools": all_tools(),
            "tool_choice": "auto",
            "stream": true,
        });

        crate::linfo!(
            &app,
            "openai",
            "round {round}: model={model} messages={n}",
            n = working.len()
        );
        let resp = HTTP
            .post(&endpoint)
            .bearer_auth(&api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("request: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("openai {status}: {text}"));
        }

        // Accumulate this round's stream.
        let mut round_text = String::new();
        let mut tool_calls: HashMap<u32, AccumulatedToolCall> = HashMap::new();
        let mut finish_reason: Option<String> = None;

        let mut stream = resp.bytes_stream();
        let mut buf = String::new();
        'stream: while let Some(item) = stream.next().await {
            let bytes = item.map_err(|e| format!("stream: {e}"))?;
            buf.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(idx) = buf.find("\n\n") {
                let event: String = buf.drain(..idx + 2).collect();
                for line in event.lines() {
                    let Some(data) = line.strip_prefix("data: ") else {
                        continue;
                    };
                    let data = data.trim();
                    if data == "[DONE]" {
                        break 'stream;
                    }
                    let chunk: StreamChunk = match serde_json::from_str(data) {
                        Ok(c) => c,
                        Err(e) => {
                            crate::lwarn!(&app, "openai", "decode chunk failed: {e} on {data}");
                            continue;
                        }
                    };
                    let Some(choice) = chunk.choices.into_iter().next() else {
                        continue;
                    };
                    if let Some(content) = choice.delta.content {
                        if !content.is_empty() {
                            round_text.push_str(&content);
                            // Forward to renderer for live TTS. Errors here
                            // are non-fatal — the channel may close on cancel.
                            let _ = on_chunk.send(content);
                        }
                    }
                    if let Some(deltas) = choice.delta.tool_calls {
                        for delta in deltas {
                            let entry = tool_calls.entry(delta.index).or_default();
                            if let Some(id) = delta.id {
                                entry.id = id;
                            }
                            if let Some(func) = delta.function {
                                if let Some(name) = func.name {
                                    entry.name.push_str(&name);
                                }
                                if let Some(args) = func.arguments {
                                    entry.arguments.push_str(&args);
                                }
                            }
                        }
                    }
                    if let Some(reason) = choice.finish_reason {
                        finish_reason = Some(reason);
                    }
                }
            }
        }

        full_text.push_str(&round_text);

        // Build the assistant message we just received and append it.
        let assistant_msg = if tool_calls.is_empty() {
            json!({"role": "assistant", "content": round_text})
        } else {
            let mut sorted: Vec<_> = tool_calls.iter().collect();
            sorted.sort_by_key(|(k, _)| *k);
            let calls_json: Vec<Value> = sorted
                .iter()
                .map(|(_, c)| {
                    json!({
                        "id": c.id,
                        "type": "function",
                        "function": { "name": c.name, "arguments": c.arguments },
                    })
                })
                .collect();
            json!({
                "role": "assistant",
                "content": if round_text.is_empty() { Value::Null } else { Value::String(round_text.clone()) },
                "tool_calls": calls_json,
            })
        };
        working.push(assistant_msg);

        // Fast path: if every tool the model called is a "marker" tool (only
        // signals state, doesn't produce content the model needs to weave in),
        // and the model already produced text alongside, we can skip the
        // round-trip that would otherwise just regurgitate the same text.
        let all_marker_tools = !tool_calls.is_empty()
            && tool_calls
                .values()
                .all(|c| c.name == "end_conversation");
        let has_text = !round_text.is_empty();
        let stop_now = tool_calls.is_empty()
            || finish_reason.as_deref() == Some("stop")
            || (all_marker_tools && has_text);

        if stop_now {
            // Even if we short-circuited, run the marker tools so their
            // side effects (e.g. flipping `end_conversation`) take effect.
            for (_, call) in &tool_calls {
                let args: Value =
                    serde_json::from_str(&call.arguments).unwrap_or(json!({}));
                execute_tool(&app, &call.name, &args, &mut end_conversation).await;
            }
            let text = if full_text.is_empty() && end_conversation {
                "またね。".to_string()
            } else if full_text.is_empty() {
                return Err("openai returned no content".into());
            } else {
                full_text
            };
            crate::linfo!(
                &app,
                "openai",
                "done: chars={} end_conversation={end_conversation} reply={text:?}",
                text.chars().count()
            );
            return Ok(ChatResult {
                text,
                end_conversation,
            });
        }

        crate::linfo!(
            &app,
            "openai",
            "tool_calls: {names}",
            names = tool_calls
                .values()
                .map(|c| c.name.as_str())
                .collect::<Vec<_>>()
                .join(",")
        );

        // Execute each tool in deterministic order and append the results.
        let mut sorted: Vec<_> = tool_calls.into_iter().collect();
        sorted.sort_by_key(|(k, _)| *k);
        for (_, call) in sorted {
            let args: Value = serde_json::from_str(&call.arguments).unwrap_or(json!({}));
            let result = execute_tool(&app, &call.name, &args, &mut end_conversation).await;
            crate::linfo!(
                &app,
                "openai",
                "tool {name} args={args} -> {result:?}",
                name = call.name
            );
            working.push(json!({
                "role": "tool",
                "tool_call_id": call.id,
                "content": result,
            }));
        }

        if round == MAX_TOOL_ROUNDS {
            return Err("max tool rounds exceeded".into());
        }
    }

    Err("tool loop exited without final message".into())
}
