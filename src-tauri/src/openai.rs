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

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChatResult {
    pub text: String,
    pub end_conversation: bool,
    /// Names of tools the LLM called during this turn, in the order they
    /// were invoked (across all rounds). Used by the golden tool-routing
    /// test to verify tool selection stability; renderer ignores it.
    #[serde(default)]
    pub tool_calls: Vec<String>,
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
    #[serde(default)]
    usage: Option<Value>,
}

#[derive(Default, Clone)]
struct AccumulatedToolCall {
    id: String,
    name: String,
    arguments: String,
}

pub fn all_tools() -> Value {
    let mut tools = native_tools();
    if let Some(arr) = tools.as_array_mut() {
        arr.extend(crate::mcp::tools_openai_schema());
    }
    tools
}

fn native_tools() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "end_conversation",
                "description": "ユーザーが**会話そのものを終わらせた**とき（「ありがとう」「またね」「じゃあね」「おやすみ」）に呼ぶ。アシスタントは聞き取りを停止しウェイクワード待ちに戻る。**音楽・タイマー・メモ等の操作を「止めて／キャンセル」する指示には絶対に使わない**（それらは control_music / cancel_timer 等の専用 tool を使う）。",
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
                "description": "現在の日付と時刻（ローカル）を返す。「今何時?」「今日何曜日?」など時刻系質問では必ず先にこれを呼ぶ。",
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
                "description": "指定秒数後に発火するタイマー。「3分タイマー」「10分後に教えて」「1時間半セットして」。分・時間は秒換算（3分=180）。label は用途名（任意）。",
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
                            "description": "用途ラベル（任意）。"
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
                "description": "動いているタイマー一覧。「残り何分?」「いまセットしてるタイマー?」",
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
                "description": "既定ブラウザで URL を開く。「○○のサイト開いて」「YouTube 開いて」など、**サイト/サービスを開きたい指示**で使う。url は http(s):// で始まる完全な URL。**特定の動画/ジャンルを見たい意図がある**とき（「YouTube で○○の動画」「作業用 BGM 流して」など）は open_url ではなく open_youtube を使う。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "http(s):// で始まる完全な URL。"
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
                "name": "open_youtube",
                "description": "YouTube の**特定の動画やジャンルを見たい/流したい**指示で使う。常に手前に出る小窓（ミニプレイヤー）で再生する。「YouTube で猫の動画」「作業用 BGM 流して」「○○のレシピ動画見ながら作業したい」のように **何を見たいか具体的に決まっている**とき。**「YouTube 開いて」のように単にサイトを開くだけの指示は open_url を使う**。\n\n**呼び方**: `candidates` には自分の知識から **3〜5 個の YouTube 動画 URL / ID 候補**を入れる（例: lofi なら `https://www.youtube.com/watch?v=jfKfPfyJRdk` 等）。Rust 側で oEmbed API で「存在 + 埋め込み可能」を順に確認 → 最初に通ったやつを再生する。**自信ある具体的な定番 URL から並べる**こと。`fallback_search_query` には全候補が外れた時用のユーザー意図に近い検索語を入れる（その場合既定ブラウザで YouTube 検索を開く）。**自分が一切知らないジャンル**なら candidates は空配列でも OK（その場合 fallback_search_query だけが使われる）。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "candidates": {
                            "type": "array",
                            "items": { "type": "string" },
                            "description": "自分が知ってる関連 YouTube 動画 URL or 動画 ID。3〜5 個推奨。確信度が高い順に並べる。"
                        },
                        "fallback_search_query": {
                            "type": "string",
                            "description": "全候補が embed 不可だった時に既定ブラウザで開く YouTube 検索語。ユーザーが言った内容そのまま or 短く要約。"
                        }
                    },
                    "required": ["candidates", "fallback_search_query"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "close_youtube",
                "description": "ミニプレイヤーを閉じる（「YouTube 閉じて」「ミニプレイヤー消して」「動画もういい」）。",
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
                "name": "web_search",
                "description": "既定ブラウザで Google 検索を開く。「○○について調べて」「○○ググって」。最新情報や Web 上の情報が必要なとき。",
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
                "description": "天気予報を取得。「東京の天気?」「明日の大阪の天気」。location 省略でユーザー現在地（IP 推定）。現在の気温・天候 + 今日と明日の最高/最低気温・降水確率。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "地名（例: 東京、Paris）。省略でユーザー現在地。"
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
                "description": "現在のシステム音量とミュート状態を取得。「上げて」「下げて」など相対指示では **set_volume の前に必ずこれで現在値を確認**。",
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
                "description": "システム音量を 0〜100 で設定。絶対指示「音量30」「音量50にして」など。相対指示「上げて」「下げて」は **先に get_volume で現在値を取り絶対値を計算**（1段階=±10）。",
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
                "description": "出力ミュート切り替え。「ミュート」「消音」=true、「解除」「音戻して」=false。",
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
                "description": "Finder で場所を開く。「ダウンロード開いて」「ゴミ箱開いて」など。target はキーワード（downloads / desktop / documents / pictures / music / movies / applications / trash / home、日本語エイリアス可）または絶対パス（~/ 展開可）。",
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
                "description": "macOS のアプリを起動。「Slack 開いて」「メモ開いて」など。name はユーザが言った名前そのまま（'Slack', 'メモ', 'Visual Studio Code'）。`open -a` 経由。アプリでもウェブでもありえる名前（Notion / Twitter / GitHub / YouTube / ChatGPT 等）は **まず open_app を試す** → 失敗（not_installed=true）なら open_url か web_search にフォールバック。ウェブで開いた旨を一言伝えれば OK、失敗を長々説明しない。",
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
                "description": "クリップボードのテキストを取得。「クリップボード読んで」「コピーしたやつ何だっけ?」など。テキスト以外（画像）はエラー。",
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
                "description": "テキストをクリップボードに書き込む。「○○コピーしといて」「クリップボードに入れて」。生成した文章・コード・要約を他アプリに貼りたいとき。",
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
                "description": "Chappie ができることの一覧を返す。「何ができるの?」「使い方教えて」「どんな機能があるの?」など**自己紹介系の質問だけ**この tool を先に呼んで答える（自分の記憶で適当に答えない）。応答は 2〜3 カテゴリに絞って自然な会話調で。**呼ばない場面**: 占い・ジョーク・創作・翻訳・要約・雑談・相談・気休めなど tool 不要のリクエストにはこの tool を呼ばず**直接生成で応じる**（リストに無い＝対応してない、ではない）。",
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
                "description": "スリープ抑止が ON か確認。「スリープしないモード?」「カフェイン入ってる?」",
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
                "description": "Mac のスリープ抑止 ON/OFF（caffeinate）。「スリープしないで」「ずっと起きてて」=true、「もう寝ていい」「解除」=false。「30分起きてて」など時間指定は duration_minutes（分、未指定で無制限）。**lock_screen と混同注意**: 「画面ロック」は lock_screen を使う。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "enabled": {
                            "type": "boolean",
                            "description": "true=抑止 ON、false=OFF。"
                        },
                        "duration_minutes": {
                            "type": "integer",
                            "description": "抑止する時間（分）。未指定で無制限。",
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
                "description": "Mac の画面ロック / ディスプレイオフ / スリープ。「ロックして」=lock（ログイン画面、本体は起動）、「画面消して」=display_off（画面だけオフ）、「スリープして」=sleep（本体スリープ）。曖昧なら lock（最安全で復帰も速い）。",
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
                "description": "バッテリー残量・充電状態・残り時間。「バッテリー何%?」「充電あとどれくらい?」「電源繋いでる?」。状態判定は必ず is_plugged_in / is_charging / is_full の真偽値を見る（state は pmset 生文字列で曖昧）。time_remaining が null は「残り時間不明」であって「切れかけ」ではない。バッテリーなしの Mac は has_battery=false。",
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
                "description": "**ボイスメモ**を保存（買い物リスト・アイデア書き留め・引用文など、ユーザーが書き取らせる本文）。「これメモして: ○○」のような明示指示で呼ぶ。text は本文そのもの（前置き付けない）。再起動後も保持。**ユーザー自身の継続的なプロフィール（名前・好み・家族・職業など）を覚えるなら add_note ではなく save_memory を使う**。",
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
                "description": "保存メモを取得。「メモ何ある?」「○○のメモ探して」。query で部分一致（大小無視）、未指定で直近 limit 件（既定 10）を新しい順。",
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
                "description": "メモを削除。id 不明なら **先に list_notes で特定**。",
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
                "name": "save_memory",
                "description": "ユーザーに関する**継続的な事実**を記憶（次回以降の会話でも参照される）。例: 「私は piro です」→ kind=profile、「息子の名前は太郎」→ profile、「コーヒーより紅茶派」→ preference、「来週の月曜に歯医者の予約」→ episode。**ボイスメモ（買い物リスト・アイデア・引用）は add_note を使う**。明示指示（「○○って覚えといて」）でも、ユーザーが自然に語った重要そうな情報でも、自分の判断で能動的に保存してよい（**遠慮せず使う**）。重複する事実は自動でデデュープされる。text は短く簡潔に（一文で要約）。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "覚える事実を一文で要約。例: \"息子の誕生日は 6/15\""
                        },
                        "kind": {
                            "type": "string",
                            "enum": ["profile", "preference", "episode"],
                            "description": "profile=身元/家族/職業/住んでる場所など恒常的事実、preference=好み/嗜好、episode=一度きりの出来事や約束。"
                        }
                    },
                    "required": ["text", "kind"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "recall_memory",
                "description": "保存済みの記憶を検索して返す。profile / preference は system prompt で常時見えているので普段は recall 不要だが、**episode（過去の約束・出来事）や言い回しがズレて埋もれている可能性のある情報**を引きたい時に呼ぶ。例: ユーザーが「あの件どうなった?」「前話してた○○」と参照してきた時。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "検索クエリ。ユーザー発話そのまま or キーワードに要約でもよい。"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "最大件数（既定 5）。",
                            "minimum": 1,
                            "maximum": 20
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
                "name": "list_memories",
                "description": "保存済み記憶の一覧。「何覚えてる?」「私について何知ってる?」と聞かれた時に呼ぶ。kind で種別絞り込み可能。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "kind": {
                            "type": "string",
                            "enum": ["profile", "preference", "episode"],
                            "description": "種別フィルタ。未指定で全種別。"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "最大件数（既定 20）。",
                            "minimum": 1,
                            "maximum": 100
                        }
                    },
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "forget_memory",
                "description": "記憶を削除。「○○忘れて」「あの記憶消して」。id 不明なら **先に list_memories で特定** してから呼ぶ。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "削除する記憶の ID。"
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
                "description": "起動中の Spotify / Apple Music を操作。「再生して」「流して」=play、「音楽止めて」「曲止めて」「一時停止」=pause、「次の曲」「スキップ」=next、「前の曲」「戻して」=previous、「切り替え」=toggle。**「止めて」が音楽文脈ならこの tool（end_conversation ではない）**。app=auto は Spotify 優先、なければ Music。**勝手にアプリは起動しない**ので両方未起動ならエラー。**直接呼ぶこと**: 何が再生中かや他のタイマー類を事前に確認する必要は一切ない（get_now_playing / list_timers / list_reminders を先に呼ばない）。",
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
                "description": "再生中の曲情報（曲名・アーティスト・アルバム・状態）。「いま何の曲?」「これ誰の歌?」「再生中?」",
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
                "description": "絶対時刻のリマインダー。「明日7時に起こして」「20時に薬」「毎朝7時に起こして」「毎週月曜9時にミーティング」など。**先に get_current_time で現在時刻を確認**してから at に未来の絶対時刻を組み立てる。at はローカルタイムで `YYYY-MM-DD HH:MM`。「明日」「来週」は現在時刻基準で解決。**繰り返し**指示（「毎朝」「毎日」「毎週○曜」「毎月○日」）があれば recurrence を設定: daily（毎日同時刻）/ weekly（毎週同曜日同時刻）/ monthly（毎月同日同時刻）。一度きりは省略 or once。再起動後も保持。秒単位の相対（「3分後」）は set_timer。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "at": {
                            "type": "string",
                            "description": "ローカルタイム `YYYY-MM-DD HH:MM`（例: 2026-05-10 07:00）。recurrence ありでも最初の発火時刻として未来の絶対時刻を入れる。"
                        },
                        "label": {
                            "type": "string",
                            "description": "内容ラベル（例: 起床、薬、会議）。発火時「○○の時間です」と読み上げ。"
                        },
                        "recurrence": {
                            "type": "string",
                            "enum": ["once", "daily", "weekly", "monthly"],
                            "description": "繰り返し種別。once=一度きり（既定）、daily=毎日同時刻、weekly=毎週同曜日同時刻、monthly=毎月同日同時刻。"
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
                "description": "登録済みリマインダー一覧（時刻順）。「リマインダー何ある?」",
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
                "description": "リマインダーを取り消す。id 指定で該当のみ、未指定で全件。id 不明なら **先に list_reminders で特定**。",
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
                "description": "screencapture でスクショ撮影。「スクショ撮って」「画面コピーして」。mode=selection（既定、ドラッグ選択）/ fullscreen。destination=clipboard（既定）/ file（~/Desktop に PNG）。「デスクトップに保存」なら file。Esc キャンセルで cancelled=true。",
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
                "name": "list_events",
                "description": "macOS カレンダーから予定取得。「今日の予定?」「明日のスケジュール」「次の予定?」。range=today（現在から今日終端）/ tomorrow（明日丸一日）/ upcoming（今から1週間、先頭10件）。空配列=予定なし。permission_denied なら『設定 → カレンダー権限を許可』と案内。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "range": {
                            "type": "string",
                            "enum": ["today", "tomorrow", "upcoming"],
                            "description": "today=現在以降の今日、tomorrow=明日、upcoming=今から1週間。"
                        }
                    },
                    "required": ["range"],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "cancel_timer",
                "description": "タイマーを取り消す。id 指定で該当のみ、未指定で全件。「タイマー消して」「全部キャンセル」。",
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
    if let Some(result) = crate::mcp::try_execute(name, args).await {
        return result;
    }
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
        "list_events" => {
            let range = args
                .get("range")
                .and_then(|v| v.as_str())
                .unwrap_or("today");
            match crate::calendar::calendar_status_sync() {
                Ok(s) if s == "granted" => {}
                Ok(s) if s == "not_determined" => {
                    // First in-context invocation: fire the prompt right
                    // now so the user can grant inline. Returns once the
                    // user decides (or after the 120s EventKit timeout).
                    // Wrapped in spawn_blocking because the inner mpsc
                    // recv would block this tokio worker otherwise.
                    let granted = tokio::task::spawn_blocking(
                        crate::calendar::request_access_sync,
                    )
                    .await
                    .ok()
                    .and_then(|r| r.ok())
                    .unwrap_or(false);
                    if !granted {
                        return json!({
                            "error": "permission_denied",
                            "status": "denied",
                            "hint": "カレンダーへのアクセスが必要です。設定から有効化するか、もう一度試してください。"
                        })
                        .to_string();
                    }
                }
                Ok(s) => {
                    return json!({
                        "error": "permission_denied",
                        "status": s,
                        "hint": "設定からカレンダーへのアクセスを許可してください。"
                    })
                    .to_string();
                }
                Err(e) => {
                    return json!({ "error": "calendar_unavailable", "detail": e })
                        .to_string();
                }
            }
            let parsed_range = match range {
                "tomorrow" => crate::calendar::Range::Tomorrow,
                "upcoming" => crate::calendar::Range::Upcoming,
                _ => crate::calendar::Range::Today,
            };
            match crate::calendar::fetch_events(parsed_range) {
                Ok(events) => json!({ "events": events }).to_string(),
                Err(e) => json!({ "error": "calendar_unavailable", "detail": e })
                    .to_string(),
            }
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
        "open_youtube" => {
            let candidates: Vec<String> = args
                .get("candidates")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            let fallback = args
                .get("fallback_search_query")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();

            if let Some(played_id) = crate::miniplayer::show_first_playable(app, &candidates).await
            {
                return json!({
                    "ok": true,
                    "mode": "miniplayer",
                    "played_video_id": played_id,
                    "tried": candidates.len()
                })
                .to_string();
            }

            // The LLM's candidates didn't pan out (typical for niche /
            // Japanese channels the model doesn't know real IDs for, e.g.
            // オモコロ). Before kicking the user out to the browser, do
            // our own YouTube search and feed the top hits back through
            // the same oEmbed-validate → miniplayer path. This keeps the
            // UX promise of "say a thing, watch it in the small window"
            // even when the LLM is guessing.
            if !fallback.is_empty() {
                if let Some(played_id) =
                    crate::miniplayer::show_first_search_hit(app, &fallback).await
                {
                    return json!({
                        "ok": true,
                        "mode": "miniplayer",
                        "played_video_id": played_id,
                        "tried": candidates.len(),
                        "via": "search"
                    })
                    .to_string();
                }
            }

            // Everything failed — fall back to opening YouTube search
            // results in the user's default browser. This preserves the
            // intent ("user wanted to find something on YouTube") even
            // when neither the LLM's candidates nor our scraper turned
            // up anything embeddable.
            if fallback.is_empty() {
                return json!({
                    "ok": false,
                    "error": "no playable candidate and no fallback query"
                })
                .to_string();
            }
            let url = format!(
                "https://www.youtube.com/results?search_query={}",
                urlencoding::encode(&fallback)
            );
            match tauri_plugin_opener::OpenerExt::opener(app).open_url(&url, None::<&str>) {
                Ok(()) => json!({
                    "ok": true,
                    "mode": "browser_search",
                    "fallback_query": fallback,
                    "tried": candidates.len()
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e.to_string() }).to_string(),
            }
        }
        "close_youtube" => {
            let was_open = crate::miniplayer::hide(app);
            json!({ "ok": true, "was_open": was_open }).to_string()
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
                "power_source": b.power_source,
                "is_plugged_in": b.is_plugged_in,
                "is_charging": b.is_charging,
                "is_full": b.is_full
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
        "save_memory" => {
            let Some(text) = args.get("text").and_then(|v| v.as_str()) else {
                return json!({ "ok": false, "error": "text is required" }).to_string();
            };
            let kind = args.get("kind").and_then(|v| v.as_str()).unwrap_or("profile");
            match crate::memory::save(text.to_string(), kind) {
                Ok(m) => json!({
                    "ok": true,
                    "id": m.id,
                    "text": m.text,
                    "kind": crate::memory::kind_label(m.kind)
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "recall_memory" => {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            if query.trim().is_empty() {
                return json!({ "ok": false, "error": "query is required" }).to_string();
            }
            let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(5) as usize;
            let entries = crate::memory::recall(query, limit.clamp(1, 20));
            json!({
                "ok": true,
                "entries": entries.iter().map(|m| json!({
                    "id": m.id,
                    "text": m.text,
                    "kind": crate::memory::kind_label(m.kind)
                })).collect::<Vec<_>>()
            })
            .to_string()
        }
        "list_memories" => {
            let kind = args.get("kind").and_then(|v| v.as_str());
            let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as usize;
            let entries = crate::memory::list_all(kind, limit.clamp(1, 100));
            json!({
                "ok": true,
                "entries": entries.iter().map(|m| json!({
                    "id": m.id,
                    "text": m.text,
                    "kind": crate::memory::kind_label(m.kind)
                })).collect::<Vec<_>>()
            })
            .to_string()
        }
        "forget_memory" => {
            let Some(id) = args.get("id").and_then(|v| v.as_u64()) else {
                return json!({ "ok": false, "error": "id is required" }).to_string();
            };
            let deleted = crate::memory::forget(id as u32);
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
            let recurrence = match args.get("recurrence").and_then(|v| v.as_str()).unwrap_or("once")
            {
                "daily" => crate::reminder::Recurrence::Daily,
                "weekly" => crate::reminder::Recurrence::Weekly,
                "monthly" => crate::reminder::Recurrence::Monthly,
                _ => crate::reminder::Recurrence::Once,
            };
            let fires_at_unix_ms = match crate::reminder::parse_local_at(at) {
                Ok(v) => v,
                Err(e) => return json!({ "ok": false, "error": e }).to_string(),
            };
            match crate::reminder::add(app, fires_at_unix_ms, label, recurrence) {
                Ok(r) => json!({
                    "ok": true,
                    "id": r.id,
                    "label": r.label,
                    "recurrence": match r.recurrence {
                        crate::reminder::Recurrence::Once => "once",
                        crate::reminder::Recurrence::Daily => "daily",
                        crate::reminder::Recurrence::Weekly => "weekly",
                        crate::reminder::Recurrence::Monthly => "monthly",
                    },
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
                        "recurrence": match r.recurrence {
                            crate::reminder::Recurrence::Once => "once",
                            crate::reminder::Recurrence::Daily => "daily",
                            crate::reminder::Recurrence::Weekly => "weekly",
                            crate::reminder::Recurrence::Monthly => "monthly",
                        },
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
            // Fullscreen mode needs the Screen Recording permission;
            // selection mode (`screencapture -i`) does not. Only ask
            // when we actually need it. Selection still works without.
            if mode == "fullscreen" {
                let status = crate::screen_permission::check_screen_recording_permission().await;
                if status != "granted" {
                    let granted = crate::screen_permission::request_screen_recording_access()
                        .await
                        .unwrap_or(false);
                    if !granted {
                        return json!({
                            "ok": false,
                            "error": "permission_denied",
                            "hint": "画面収録の権限が必要です。設定から有効化するか、もう一度試してください。"
                        })
                        .to_string();
                    }
                }
            }
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

    // Auto-detect provider from key prefix. Three providers supported:
    // OpenAI (chat/completions), Anthropic (Messages API), Gemini
    // (generativelanguage). Anthropic and Gemini have their own modules.
    let provider = match crate::provider::detect_from_key(&api_key) {
        Some(p) => p,
        None => {
            return Err(
                "Unrecognized API key format. Use OpenAI (sk-...), Anthropic (sk-ant-...), or Gemini (AIza...).".into(),
            );
        }
    };
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
    // OpenAI from here on. CHAPPIE_MODEL env var wins over the renderer-
    // supplied default.
    let endpoint = format!("{}/chat/completions", provider.base_url());
    let model = env_override.unwrap_or(model);

    crate::linfo!(
        &app,
        "openai",
        "provider={} endpoint={} model={}",
        provider.label(),
        endpoint,
        model
    );

    // Capture the latest user utterance for session_log before we start
    // mutating `working` with injected system messages.
    let last_user_text: String = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_default();

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
        // Insert AFTER the static persona system prompt at index 0 so the
        // persona + tools prefix stays identical across turns (prompt
        // caching keys off the leading prefix). Location can change between
        // sessions but is stable within a session.
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": context}));
    }

    // Inject the user's saved profile / preferences. Goes AFTER the
    // persona prompt so the leading prefix used for prompt caching stays
    // stable; the profile changes only when save_memory / forget_memory
    // is called, which causes a single cache miss and then warms again.
    let profile = crate::memory::profile_summary();
    if !profile.is_empty() {
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": profile}));
    }

    // Long-term memory L3: longitudinal topic / preference snapshot.
    // Refreshes weekly (or when missing) — a much slower cadence than
    // L2 summaries, so this layer is the most cache-friendly piece of
    // the dynamic prefix.
    let topics = crate::topics::prompt_section();
    if !topics.is_empty() {
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": topics}));
    }

    // Long-term memory L2: past N days of conversation summaries so the
    // model can drop "そういえば先週〜" naturally. The summaries change
    // once per day, which is fine for prompt caching: each new day causes
    // one cache miss and then the prefix warms for the rest of the day.
    let recent = crate::summarizer::recent_summaries_prompt(7);
    if !recent.is_empty() {
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": recent}));
    }

    // Long-term memory L1: semantically related past turns (older than
    // the 7-day summary window). Injected AFTER L2 / profile so the
    // cached prefix is persona → profile → L2 summaries → L1 episodes,
    // each layer added on top of the cached one above it.
    let rag = crate::rag::recall_prompt(&last_user_text, 3);
    if !rag.is_empty() {
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": rag}));
    }

    // Kick off backfill of any missing past-N-day summaries in the
    // background. Once-per-process gate inside maybe_backfill.
    crate::summarizer::maybe_backfill(api_key.clone());
    // Same pattern for L3 topics — refreshes weekly so this is mostly
    // a no-op after the first run of the week.
    crate::topics::maybe_refresh(api_key.clone());

    // Time-band hint goes at the END of the system block so the prefix
    // (persona + profile + location) stays cache-stable. Only this trailing
    // line flips between 4 bands per day.
    let band_hint = crate::i18n::time_band_hint();
    let sys_end = working
        .iter()
        .position(|m| m.get("role").and_then(|r| r.as_str()) != Some("system"))
        .unwrap_or(working.len());
    working.insert(sys_end, json!({"role": "system", "content": band_hint}));

    let mut end_conversation = false;
    let mut full_text = String::new();
    let mut called_tools: Vec<String> = Vec::new();

    for round in 0..=MAX_TOOL_ROUNDS {
        let body = json!({
            "model": model,
            "messages": working,
            "tools": all_tools(),
            "tool_choice": "auto",
            "stream": true,
            // Include usage info in the final stream chunk so we can log
            // cached_tokens and verify prompt caching is hitting. OpenAI
            // auto-caches prompts >=1024 tokens; tools + system reach this
            // easily so we expect strong cache hit rates after the first
            // turn of a session.
            "stream_options": { "include_usage": true },
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
                    if let Some(usage) = &chunk.usage {
                        let prompt = usage
                            .get("prompt_tokens")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        let cached = usage
                            .get("prompt_tokens_details")
                            .and_then(|d| d.get("cached_tokens"))
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        let completion = usage
                            .get("completion_tokens")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        crate::linfo!(
                            &app,
                            "openai",
                            "usage: prompt={prompt} cached={cached} completion={completion}"
                        );
                    }
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
            for call in tool_calls.values() {
                called_tools.push(call.name.clone());
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
            crate::session_log::append_turn(&last_user_text, &text, "openai", &model);
            return Ok(ChatResult {
                text,
                end_conversation,
                tool_calls: called_tools,
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
            called_tools.push(call.name.clone());
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
