// Tool definitions and dispatcher for the chat providers.
//
// `all_tools()` returns the canonical OpenAI-shape tool list that all
// three providers translate from (Anthropic/Gemini have their own wire
// format wrappers that consume this). `execute_tool` is the single
// dispatch site — when an LLM calls a tool by name, this is where it
// actually runs against the rest of the app.
//
// Lives in its own module rather than openai.rs because both
// anthropic.rs and gemini.rs delegate here too; keeping it under
// `openai::` was a structural lie about ownership.

use chrono::TimeZone;
use serde_json::{json, Value};

pub fn all_tools() -> Value {
    let mut tools = native_tools();
    if let Some(arr) = tools.as_array_mut() {
        arr.extend(crate::mcp::tools_openai_schema());
    }
    tools
}

/// Tool list used when the chitchat classifier (see `llm::chitchat`)
/// flags an utterance as pure small-talk. The LLM still needs
/// `end_conversation` so it can hang up the session ("ありがとう、また
/// ね" → wake-word standby), but every other tool is dropped from the
/// payload — saving ~8k input tokens per chitchat turn. Looked up by
/// name rather than by index so reordering `native_tools()` stays safe.
pub fn minimal_tools() -> Value {
    let all = native_tools();
    let end_conv = all
        .as_array()
        .and_then(|a| {
            a.iter().find(|t| {
                t.pointer("/function/name")
                    == Some(&Value::String("end_conversation".into()))
            })
        })
        .cloned()
        .expect("end_conversation must exist in native_tools()");
    json!([end_conv])
}

/// Escape tool injected into the personalized (hot-set) payload. The model
/// calls this when none of the trimmed tools can satisfy the request; the
/// dispatcher then swaps in `all_tools()` on the next round. Never executed
/// directly (handled specially in `llm::dispatch`).
pub const NEED_MORE_TOOLS: &str = "need_more_tools";

fn need_more_tools_def() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": NEED_MORE_TOOLS,
            "description": "リクエストを満たせる道具がこの一覧に**見当たらないとき**に呼ぶ。呼ぶと利用可能な全機能が解放され、続けて適切な道具を選べるようになる。一覧の中に使える道具があるなら呼ばない。",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }
    })
}

/// Generic "catch-all" search tools deliberately kept OUT of the
/// personalized hot set even when frequently used. They accept a free-text
/// query and can be applied to *anything*, so if they're in the trimmed
/// payload the model reaches for them instead of calling `need_more_tools`
/// — e.g. routing "ピカチュウのステータス" to news_search rather than
/// escaping to the dedicated mcp_pokemon_stats. Excluding them forces a
/// clean escape when no *specific* hot tool matches; they remain available
/// in the full set (post-escape) for genuine free-text searches.
const CATCH_ALL_TOOLS: &[&str] = &["web_search", "mcp_news_search"];

/// Native tools that ARE safe to trim from the personalized payload when
/// not in the hot set: visual novelties + meta + approximate-able lookups.
/// If absent, the outcome degrades gracefully (the model answers from
/// knowledge, approximates, or the escape tool kicks in) rather than
/// failing. Everything else native operates on live device/system/local
/// state the model cannot substitute, so it's always kept (see below).
const TRIMMABLE_NATIVE_TOOLS: &[&str] = &[
    "set_wallpaper",
    "set_wallpaper_potd",
    "set_artwork_wallpaper",
    "get_world_time",
    "list_capabilities",
];

/// True for tools that must stay in the personalized payload regardless of
/// usage frequency. Rationale (validated by golden_personalized_routing):
/// the escape tool fires unreliably on weaker models (Gemini Flash never
/// called it in testing), so any tool that (a) the model can't answer from
/// knowledge and (b) has no search/direct-answer fallback would become
/// unreachable if trimmed. That's the native device/system/local-state
/// core — battery, screenshot, volume, timers, notes, calendar, etc. We
/// only trim the MCP info long-tail (the growth area) and a few native
/// novelties; everything else native is always kept.
fn is_always_keep(name: &str) -> bool {
    !name.starts_with("mcp_") && !TRIMMABLE_NATIVE_TOOLS.contains(&name)
}

/// Personalized tool payload: the per-user hot set UNION the always-keep
/// native core, minus the catch-all search tools, with the
/// `need_more_tools` escape tool appended (best-effort fallback for the
/// trimmed MCP long-tail on models that honor it).
pub fn personalized_tools(hot: &std::collections::HashSet<String>) -> Value {
    let mut arr: Vec<Value> = all_tools()
        .as_array()
        .map(|a| {
            a.iter()
                .filter(|t| {
                    t.pointer("/function/name")
                        .and_then(|v| v.as_str())
                        .map(|n| {
                            !CATCH_ALL_TOOLS.contains(&n)
                                && (hot.contains(n) || is_always_keep(n))
                        })
                        .unwrap_or(false)
                })
                .cloned()
                .collect()
        })
        .unwrap_or_default();
    arr.push(need_more_tools_def());
    Value::Array(arr)
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
                "name": "get_world_time",
                "description": "指定した都市・国の現在時刻を返す。「ロンドン今何時？」「ニューヨークの時間は？」「パリは今何時？」。現在地の時刻は get_current_time、他の地域はこちら。location=都市名や国名。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "時刻を知りたい都市名・国名。例: ロンドン, New York, パリ, ハワイ。"
                        }
                    },
                    "required": ["location"],
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
                "description": "YouTube の特定動画やジャンルを**ミニプレイヤー**で見たい時に使う（「YouTube で猫の動画」「作業用 BGM 流して」など、見たい内容が具体的に決まっているケース）。candidates には自分の知識から 3〜5 個の動画 URL/ID を確信度が高い順で（例: lofi なら https://www.youtube.com/watch?v=jfKfPfyJRdk のような定番）。Rust 側で oEmbed 確認の上、最初に通った候補を再生する。知らないジャンルなら空配列でも可。fallback_search_query は全候補外れ時に既定ブラウザで開く検索語。単にサイトを開くだけの「YouTube 開いて」は open_url。",
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
                "name": "set_wallpaper",
                "description": "デスクトップの壁紙を query に合う写真に変える。「壁紙を森に」「夜空にして」「おしゃれな壁紙にして」。複数モニターには異なる写真を設定。Pixabay の写真を使う。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "壁紙のテーマ。例: forest, night sky, cat, minimal, aesthetic。日本語も可だが英語の方がヒット率が高い。"
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
                "name": "set_artwork_wallpaper",
                "description": "シカゴ美術館（Art Institute of Chicago）の名画・所蔵作品をデスクトップの壁紙にする。「名画を壁紙にして」「ゴッホの絵を壁紙に」「浮世絵の壁紙にして」。query で画家名・作風・題材を指定（空なら日替わりの名作）。Pixabay の写真は set_wallpaper、今日の一枚は set_wallpaper_potd。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "画家名・作風・題材。例: ゴッホ, モネ, 浮世絵, landscape, impressionism。空でも可。"
                        }
                    },
                    "required": [],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_wallpaper_potd",
                "description": "Wikipedia（Wikimedia Commons）の「今日の一枚（Picture of the Day）」をデスクトップの壁紙にする。「今日の一枚を壁紙に」「ウィキペディアの今日の写真を壁紙にして」「今日のおすすめ写真にして」。テーマ指定の壁紙は set_wallpaper、日替わりの厳選写真はこちら。引数なし。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_switchbot_devices",
                "description": "ユーザーの SwitchBot デバイス一覧（名前・種類）を返す。「SwitchBot に何があるか教えて」「操作できる家電は？」のときや、switchbot_control の前にどんな名前で登録されているか確認したいときに呼ぶ。引数なし。未設定なら error=not_configured を返す。",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                    "additionalProperties": false
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "switchbot_control",
                "description": "SwitchBot デバイスを操作する。「リビングの電気つけて」「エアコン消して」「カーテン開けて」など家電・照明・カーテン・プラグ・ロボット掃除機の物理操作。device はユーザーが言ったデバイス名（登録名に曖昧一致させる）。command は SwitchBot のコマンド: 入/オンは turnOn、切/オフは turnOff、ボタンを押すは press、カーテンは setPosition（parameter 例 \"0,ff,50\"=半開）、エアコン等の赤外線は setAll（parameter 例 \"26,2,1,on\"=26度/冷房/風量自動/オン）。parameter 省略時は default。device_not_found が返ったら available の名前を読み上げて聞き直す。未設定なら not_configured。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "device": {
                            "type": "string",
                            "description": "操作するデバイス名。ユーザーの言い方そのままでよい（登録名に曖昧一致する）。例: リビングの電気, 寝室のエアコン, カーテン。"
                        },
                        "command": {
                            "type": "string",
                            "description": "SwitchBot コマンド。turnOn / turnOff / press / setPosition / setAll など。"
                        },
                        "parameter": {
                            "type": "string",
                            "description": "コマンド引数。省略時 default。setAll なら \"温度,モード,風量,電源\"、setPosition なら \"index,mode,position\"。"
                        },
                        "command_type": {
                            "type": "string",
                            "description": "通常は省略（command）。赤外線リモコンのカスタムボタンを使うときだけ customize を指定。"
                        }
                    },
                    "required": ["device", "command"],
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
                "description": "macOS のアプリを起動。「Slack 開いて」「メモ開いて」など。name はユーザが言った名前そのまま（'Slack', 'メモ', 'Visual Studio Code'）。`open -a` 経由。Notion / GitHub / Twitter / YouTube / ChatGPT などウェブにも存在する名前は **まず open_app を試す** → 失敗（not_installed=true）なら open_url / web_search にフォールバックして、自然にウェブで開いた旨を一言伝える（聞き返さず・失敗を長々説明しない）。",
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
                "description": "Chappie の機能一覧を返す。「何ができる?」「使い方教えて」「どんな機能?」など自己紹介系の質問にだけ呼ぶ。応答は 2〜3 カテゴリに絞って自然な会話調で。占い・ジョーク・創作・翻訳・要約・雑談・相談など tool 不要のリクエストでは呼ばず直接生成で応じる。",
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
                "description": "起動中の Spotify / Apple Music を操作。「再生」「流して」=play、「止めて」「一時停止」=pause、「次の曲」=next、「前の曲」=previous、「切り替え」=toggle。app=auto は Spotify 優先。直接呼ぶ（get_now_playing / list_timers / list_reminders を先に確認しない）。勝手にアプリ起動はしないので両方未起動だとエラー。",
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
                "description": "絶対時刻のリマインダー（「明日7時に起こして」「毎週月曜9時に会議」など）。先に get_current_time で現在時刻を取り、at に未来のローカル `YYYY-MM-DD HH:MM` を組み立てる（「明日」「来週」は現在時刻基準で解決）。繰り返し指示は recurrence: daily=毎日同時刻 / weekly=毎週同曜日同時刻 / monthly=毎月同日同時刻。秒単位の相対（「3分後」）は set_timer。再起動後も保持される。",
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

// --- argument extraction helpers ---
// `args` is the untyped JSON object the LLM supplies. These collapse the
// `.get(k).and_then(|v| v.as_str()).unwrap_or("")` chains that every tool
// arm would otherwise hand-roll. `arg_str` returns "" for a missing /
// wrong-type field (matching the previous `unwrap_or("")` default) and
// `arg_trim` additionally trims; behavior is byte-identical to the inline
// forms they replace.
fn arg_str<'a>(args: &'a Value, key: &str) -> &'a str {
    args.get(key).and_then(|v| v.as_str()).unwrap_or("")
}
fn arg_trim<'a>(args: &'a Value, key: &str) -> &'a str {
    arg_str(args, key).trim()
}
fn arg_u64(args: &Value, key: &str) -> Option<u64> {
    args.get(key).and_then(|v| v.as_u64())
}
fn arg_bool(args: &Value, key: &str) -> Option<bool> {
    args.get(key).and_then(|v| v.as_bool())
}

pub(crate) async fn execute_tool(
    app: &tauri::AppHandle,
    name: &str,
    args: &Value,
    end_conversation: &mut bool,
) -> String {
    crate::tool_usage::record(name);
    if let Some(result) = crate::mcp::try_execute(name, args).await {
        return result;
    }
    match name {
        "end_conversation" => {
            *end_conversation = true;
            "ok".to_string()
        }
        "get_current_time" => format_current_time(),
        "get_world_time" => tool_get_world_time(args).await,
        "get_weather" => tool_get_weather(args).await,
        "set_timer" => {
            let Some(secs) = arg_u64(args, "duration_seconds") else {
                return "error: duration_seconds is required".to_string();
            };
            if secs == 0 {
                return "error: duration_seconds must be >= 1".to_string();
            }
            let label = arg_str(args, "label").to_string();
            let info = crate::timer::set_timer(app, secs, label.clone());
            json!({
                "id": info.id,
                "label": info.label,
                "duration": crate::timer::format_duration(info.duration_seconds),
                "fires_at_unix_ms": info.fires_at_unix_ms
            })
            .to_string()
        }
        "list_events" => tool_list_events(args).await,
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
            let url = arg_str(args, "url");
            if !(url.starts_with("https://") || url.starts_with("http://")) {
                return json!({ "ok": false, "error": "url must start with http:// or https://" }).to_string();
            }
            match tauri_plugin_opener::OpenerExt::opener(app).open_url(url, None::<&str>) {
                Ok(()) => json!({ "ok": true, "url": url }).to_string(),
                Err(e) => json!({ "ok": false, "error": e.to_string() }).to_string(),
            }
        }
        "open_youtube" => tool_open_youtube(app, args).await,
        "close_youtube" => {
            let was_open = crate::miniplayer::hide(app);
            json!({ "ok": true, "was_open": was_open }).to_string()
        }
        "web_search" => {
            let query = arg_str(args, "query");
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
            let Some(muted) = arg_bool(args, "muted") else {
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
        "set_wallpaper" => {
            let q = arg_str(args, "query").to_string();
            if q.trim().is_empty() {
                return json!({ "ok": false, "error": "query is required" }).to_string();
            }
            // No explicit HUD here — the wallpaper change itself is the
            // visual confirmation. The LLM's spoken response (or HUD
            // routing when muted) covers messaging for both success and
            // failure paths via the existing pipeline.
            match crate::wallpaper::set_wallpaper(app, &q).await {
                Ok(r) => json!({ "ok": true, "monitors": r.monitors }).to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "set_artwork_wallpaper" => {
            let q = arg_str(args, "query").to_string();
            match crate::wallpaper::set_artwork_wallpaper(app, &q).await {
                Ok(r) => json!({
                    "ok": true,
                    "monitors": r.monitors,
                    "title": r.title,
                    "artist": r.artist
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "set_wallpaper_potd" => {
            // Like set_wallpaper, the change itself is the confirmation;
            // title/description are returned so the LLM can mention what
            // the photo is.
            match crate::wallpaper::set_wallpaper_potd(app).await {
                Ok(r) => json!({
                    "ok": true,
                    "monitors": r.monitors,
                    "title": r.title,
                    "description": r.description
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "list_switchbot_devices" => {
            if !crate::switchbot::is_configured(app) {
                return json!({
                    "ok": false,
                    "error": "not_configured",
                    "hint": "SwitchBot のトークンとシークレットが未設定です。設定画面で SwitchBot アプリの Developer Options から取得した値を入力するよう案内してください。"
                })
                .to_string();
            }
            match crate::switchbot::list_devices(app).await {
                Ok(devices) => json!({
                    "ok": true,
                    "devices": devices
                        .iter()
                        .map(|d| json!({
                            "name": d.name,
                            "type": d.kind,
                            "infrared": d.is_infrared
                        }))
                        .collect::<Vec<_>>()
                })
                .to_string(),
                Err(e) => json!({ "ok": false, "error": e }).to_string(),
            }
        }
        "switchbot_control" => {
            if !crate::switchbot::is_configured(app) {
                return json!({
                    "ok": false,
                    "error": "not_configured",
                    "hint": "SwitchBot が未設定です。設定画面でトークンとシークレットの入力を案内してください。"
                })
                .to_string();
            }
            let device_query = arg_str(args, "device").to_string();
            if device_query.trim().is_empty() {
                return json!({ "ok": false, "error": "device is required" }).to_string();
            }
            let command = arg_str(args, "command").to_string();
            if command.trim().is_empty() {
                return json!({ "ok": false, "error": "command is required" }).to_string();
            }
            let parameter = {
                let p = arg_str(args, "parameter");
                if p.is_empty() {
                    "default".to_string()
                } else {
                    p.to_string()
                }
            };
            let command_type = {
                let c = arg_str(args, "command_type");
                if c.is_empty() {
                    "command".to_string()
                } else {
                    c.to_string()
                }
            };
            let devices = match crate::switchbot::list_devices(app).await {
                Ok(d) => d,
                Err(e) => return json!({ "ok": false, "error": e }).to_string(),
            };
            let Some(device) = crate::switchbot::resolve_device(&devices, &device_query) else {
                // Hand the model the real names so it can re-ask / inform.
                return json!({
                    "ok": false,
                    "error": "device_not_found",
                    "query": device_query,
                    "available": devices.iter().map(|d| d.name.clone()).collect::<Vec<_>>()
                })
                .to_string();
            };
            match crate::switchbot::send_command(
                app,
                &device.id,
                &command,
                &parameter,
                &command_type,
            )
            .await
            {
                Ok(()) => json!({
                    "ok": true,
                    "device": device.name,
                    "command": command
                })
                .to_string(),
                Err(e) => {
                    json!({ "ok": false, "device": device.name, "error": e }).to_string()
                }
            }
        }
        "open_finder" => {
            let target = arg_str(args, "target").to_string();
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
            let name = arg_trim(args, "name");
            if name.is_empty() {
                return json!({ "ok": false, "error": "name is empty" }).to_string();
            }
            // Launch a GUI app by name. macOS: `open -a`. Windows: the shell's
            // `start`, which resolves App Paths / Start-menu names (Slack,
            // Spotify, etc. that aren't on PATH). A non-zero exit means the
            // name didn't resolve → the not_installed / web-fallback branch.
            #[cfg(target_os = "macos")]
            let launch = std::process::Command::new("open")
                .arg("-a")
                .arg(name)
                .status();
            #[cfg(target_os = "windows")]
            let launch = std::process::Command::new("cmd")
                .args(["/C", "start", "", name])
                .status();
            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            let launch = std::process::Command::new("xdg-open").arg(name).status();
            match launch {
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
            let text = arg_str(args, "text");
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
            let Some(enabled) = arg_bool(args, "enabled") else {
                return json!({ "ok": false, "error": "enabled is required" }).to_string();
            };
            if enabled {
                let mins = arg_u64(args, "duration_minutes");
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
            let mode = arg_str(args, "mode");
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
            let text = arg_str(args, "text").to_string();
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
            let Some(id) = arg_u64(args, "id") else {
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
            let query = arg_str(args, "query");
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
            let Some(id) = arg_u64(args, "id") else {
                return json!({ "ok": false, "error": "id is required" }).to_string();
            };
            let deleted = crate::memory::forget(id as u32);
            json!({ "ok": deleted, "id": id }).to_string()
        }
        "control_music" => {
            let action = arg_str(args, "action");
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
        "add_reminder_at" => tool_add_reminder_at(app, args),
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
            if let Some(id) = arg_u64(args, "id") {
                let ok = crate::reminder::cancel(id as u32);
                json!({ "cancelled": ok, "id": id }).to_string()
            } else {
                let n = crate::reminder::cancel_all();
                json!({ "cancelled_all": n }).to_string()
            }
        }
        "take_screenshot" => tool_take_screenshot(args).await,
        "cancel_timer" => {
            if let Some(id) = arg_u64(args, "id") {
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

// --- extracted tool bodies ---
// The heavier `execute_tool` arms live here so the match above stays a
// scannable routing table. Each fn owns exactly one tool and returns the
// same JSON string the inline arm did.

async fn tool_get_world_time(args: &Value) -> String {
    let location = arg_trim(args, "location");
    if location.is_empty() {
        return json!({ "error": "location is required" }).to_string();
    }
    match crate::worldtime::lookup(location).await {
        Ok(text) => text,
        Err(e) => json!({ "error": e }).to_string(),
    }
}

async fn tool_get_weather(args: &Value) -> String {
    let location = arg_trim(args, "location");
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

async fn tool_list_events(args: &Value) -> String {
    let range = args.get("range").and_then(|v| v.as_str()).unwrap_or("today");
    match crate::calendar::calendar_status_sync() {
        Ok(s) if s == "granted" => {}
        Ok(s) if s == "not_determined" => {
            // First in-context invocation: fire the prompt right now so the
            // user can grant inline. Returns once the user decides (or after
            // the 120s EventKit timeout). Wrapped in spawn_blocking because
            // the inner mpsc recv would block this tokio worker otherwise.
            let granted = tokio::task::spawn_blocking(crate::calendar::request_access_sync)
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
            return json!({ "error": "calendar_unavailable", "detail": e }).to_string();
        }
    }
    let parsed_range = match range {
        "tomorrow" => crate::calendar::Range::Tomorrow,
        "upcoming" => crate::calendar::Range::Upcoming,
        _ => crate::calendar::Range::Today,
    };
    match crate::calendar::fetch_events(parsed_range) {
        Ok(events) => json!({ "events": events }).to_string(),
        Err(e) => json!({ "error": "calendar_unavailable", "detail": e }).to_string(),
    }
}

async fn tool_open_youtube(app: &tauri::AppHandle, args: &Value) -> String {
    let candidates: Vec<String> = args
        .get("candidates")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    let fallback = arg_trim(args, "fallback_search_query").to_string();

    if let Some(played_id) = crate::miniplayer::show_first_playable(app, &candidates).await {
        return json!({
            "ok": true,
            "mode": "miniplayer",
            "played_video_id": played_id,
            "tried": candidates.len()
        })
        .to_string();
    }

    // The LLM's candidates didn't pan out (typical for niche / Japanese
    // channels the model doesn't know real IDs for, e.g. オモコロ). Before
    // kicking the user out to the browser, do our own YouTube search and
    // feed the top hits back through the same oEmbed-validate → miniplayer
    // path. This keeps the UX promise of "say a thing, watch it in the
    // small window" even when the LLM is guessing.
    if !fallback.is_empty() {
        if let Some(played_id) = crate::miniplayer::show_first_search_hit(app, &fallback).await {
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

    // Everything failed — fall back to opening YouTube search results in the
    // user's default browser. This preserves the intent ("user wanted to
    // find something on YouTube") even when neither the LLM's candidates nor
    // our scraper turned up anything embeddable.
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

fn tool_add_reminder_at(app: &tauri::AppHandle, args: &Value) -> String {
    let at = arg_str(args, "at");
    let label = arg_str(args, "label").to_string();
    if at.is_empty() {
        return json!({ "ok": false, "error": "at is required" }).to_string();
    }
    let recurrence = match args.get("recurrence").and_then(|v| v.as_str()).unwrap_or("once") {
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

async fn tool_take_screenshot(args: &Value) -> String {
    let mode = args.get("mode").and_then(|v| v.as_str()).unwrap_or("selection");
    let destination = args
        .get("destination")
        .and_then(|v| v.as_str())
        .unwrap_or("clipboard");
    // Fullscreen mode needs the Screen Recording permission; selection mode
    // (`screencapture -i`) does not. Only ask when we actually need it.
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn names(v: &Value) -> HashSet<String> {
        v.as_array()
            .unwrap()
            .iter()
            .filter_map(|t| {
                t.pointer("/function/name")
                    .and_then(|n| n.as_str())
                    .map(|s| s.to_string())
            })
            .collect()
    }

    #[test]
    fn personalized_keeps_core_trims_mcp_tail() {
        let hot: HashSet<String> =
            ["mcp_news_latest".to_string(), "set_timer".to_string()].into_iter().collect();
        let got = names(&personalized_tools(&hot));

        // Always-keep native core present even though cold (not in hot).
        assert!(got.contains("get_battery_status"));
        assert!(got.contains("take_screenshot"));
        assert!(got.contains("end_conversation"));
        // Escape tool appended.
        assert!(got.contains(NEED_MORE_TOOLS));
        // Hot MCP tool kept.
        assert!(got.contains("mcp_news_latest"));
        // Cold MCP tool trimmed.
        assert!(!got.contains("mcp_pokemon_stats"));
        // Trimmable native novelty (cold) trimmed.
        assert!(!got.contains("set_wallpaper"));
        // Catch-all search dropped even though native.
        assert!(!got.contains("web_search"));
    }

    #[test]
    fn personalized_smaller_than_full() {
        let hot: HashSet<String> = ["mcp_news_latest".to_string()].into_iter().collect();
        let p = personalized_tools(&hot).as_array().unwrap().len();
        let full = all_tools().as_array().unwrap().len();
        assert!(p < full, "personalized {p} should be < full {full}");
    }

    // Lock the argument-extraction helpers so the boilerplate they replaced
    // across the tool arms stays byte-identical: missing / wrong-type →
    // default, present → value, and arg_trim trims.
    #[test]
    fn arg_helpers_match_inline_semantics() {
        let v = json!({ "s": "  hi  ", "n": 7, "b": true, "wrong": 1 });
        // arg_str: present → value, missing → "", wrong type → ""
        assert_eq!(arg_str(&v, "s"), "  hi  ");
        assert_eq!(arg_str(&v, "missing"), "");
        assert_eq!(arg_str(&v, "n"), "");
        // arg_trim trims the same value
        assert_eq!(arg_trim(&v, "s"), "hi");
        assert_eq!(arg_trim(&v, "missing"), "");
        // arg_u64: present number → Some, missing / wrong type → None
        assert_eq!(arg_u64(&v, "n"), Some(7));
        assert_eq!(arg_u64(&v, "missing"), None);
        assert_eq!(arg_u64(&v, "s"), None);
        // arg_bool: present bool → Some, missing / wrong type → None
        assert_eq!(arg_bool(&v, "b"), Some(true));
        assert_eq!(arg_bool(&v, "missing"), None);
        assert_eq!(arg_bool(&v, "wrong"), None);
    }

    // The one extracted tool body whose validation branch needs neither an
    // AppHandle nor network: empty/missing location must short-circuit to
    // the same error envelope the inline arm returned.
    #[tokio::test]
    async fn world_time_requires_location() {
        assert_eq!(
            tool_get_world_time(&json!({})).await,
            json!({ "error": "location is required" }).to_string()
        );
        assert_eq!(
            tool_get_world_time(&json!({ "location": "   " })).await,
            json!({ "error": "location is required" }).to_string()
        );
    }
}
