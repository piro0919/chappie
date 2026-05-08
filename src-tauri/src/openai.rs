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

fn all_tools() -> Value {
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
                "name": "open_app",
                "description": "macOS の指定アプリを起動します。「Slack 開いて」「Spotify 起動して」「メモ開いて」「VSCode 立ち上げて」のような指示で呼び出してください。name にはユーザーが言ったアプリ名をそのまま渡します（例: 'Slack', 'Spotify', 'メモ', 'Visual Studio Code'）。`open -a` 経由で起動するので、Applications にインストールされていれば見つかります。",
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

async fn execute_tool(
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
                Ok(()) => json!({ "ok": true, "muted": muted }).to_string(),
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
                Ok(s) => json!({
                    "ok": false,
                    "error": format!("`open -a` exited with status {s}; the app may not be installed")
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
            .post("https://api.openai.com/v1/chat/completions")
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
