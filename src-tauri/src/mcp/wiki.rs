// Wikipedia summary lookup. Hits the REST `page/summary/{title}`
// endpoint, which follows redirects (so misspellings or alternative
// titles often still resolve). On a 404 we fall back to opensearch to
// resolve the canonical title, then re-fetch.

use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "mcp_wiki_summary",
                "description": "Wikipedia の要約を取得する。「○○ってなに？」「○○について教えて」「Wikipedia で○○調べて」。LLM の知識カットオフ後の人物・出来事や、固有名詞の正確な定義に強い。query=調べたい語（人名・地名・用語・作品名など）。lang=言語コード（ja/en/es/fr/de/it/pt/ko/zh のいずれか、未指定なら ja）。返り値の extract を 2-3 文で要約して読み上げる。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "調べたい語。「東京タワー」「Rust（プログラミング言語）」「アインシュタイン」など。"
                        },
                        "lang": {
                            "type": "string",
                            "enum": ["ja", "en", "es", "fr", "de", "it", "pt", "ko", "zh"],
                            "description": "Wikipedia の言語版。未指定なら ja。"
                        }
                    },
                    "required": ["query"],
                    "additionalProperties": false
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "mcp_wiki_onthisday",
                "description": "「今日は何の日？」「N月N日は何があった日？」。指定日（未指定なら今日）の歴史上の主要な出来事を返す。返り値の events を 2-3 件、年号を添えて簡潔に読み上げる。month/day は任意（未指定なら今日）、lang は言語コード（未指定なら ja、その言語版にデータが無ければ自動で英語版にフォールバック）。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "month": {
                            "type": "integer",
                            "description": "月（1-12）。未指定なら今日。",
                            "minimum": 1,
                            "maximum": 12
                        },
                        "day": {
                            "type": "integer",
                            "description": "日（1-31）。未指定なら今日。",
                            "minimum": 1,
                            "maximum": 31
                        },
                        "lang": {
                            "type": "string",
                            "enum": ["ja", "en", "es", "fr", "de", "it", "pt", "ko", "zh"],
                            "description": "Wikipedia の言語版。未指定なら ja。"
                        }
                    },
                    "required": [],
                    "additionalProperties": false
                }
            }
        }),
    ]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "summary" => summary(args).await,
        "onthisday" => onthisday(args).await,
        other => json!({ "error": format!("unknown wiki tool: {}", other) }).to_string(),
    }
}

async fn summary(args: &Value) -> String {
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if query.is_empty() {
        return json!({ "error": "query is empty" }).to_string();
    }
    let lang = args.get("lang").and_then(|v| v.as_str()).unwrap_or("ja");

    // Try the title as given; REST follows redirects so this often
    // resolves naturally. On 404, use opensearch to find the canonical
    // title.
    match fetch_summary(lang, query).await {
        Ok(v) => v,
        Err(_) => match resolve_title(lang, query).await {
            Some(canonical) => fetch_summary(lang, &canonical)
                .await
                .unwrap_or_else(|e| json!({ "error": e }).to_string()),
            None => json!({ "error": "not_found", "query": query }).to_string(),
        },
    }
}

/// "On this day" — historical events for a given month/day from the
/// Wikimedia onthisday feed. The feed only exists for languages that
/// built their own day-page structure, so non-en often comes back empty
/// or 404; we fall back to en in that case so the user always gets
/// something to read.
async fn onthisday(args: &Value) -> String {
    use chrono::Datelike;

    let now = chrono::Local::now();
    let month = args
        .get("month")
        .and_then(|v| v.as_u64())
        .map(|m| m as u32)
        .filter(|m| (1..=12).contains(m))
        .unwrap_or_else(|| now.month());
    let day = args
        .get("day")
        .and_then(|v| v.as_u64())
        .map(|d| d as u32)
        .filter(|d| (1..=31).contains(d))
        .unwrap_or_else(|| now.day());
    let lang = args.get("lang").and_then(|v| v.as_str()).unwrap_or("ja");

    // Try the requested language first; fall back to en when the feed is
    // missing or returns no curated events.
    let events = match fetch_onthisday(lang, month, day).await {
        Ok(ev) if !ev.is_empty() => (ev, lang.to_string()),
        _ if lang != "en" => match fetch_onthisday("en", month, day).await {
            Ok(ev) => (ev, "en".to_string()),
            Err(e) => return json!({ "error": e }).to_string(),
        },
        Ok(_) => (Vec::new(), lang.to_string()),
        Err(e) => return json!({ "error": e }).to_string(),
    };
    let (events, used_lang) = events;

    json!({
        "date": format!("{:02}-{:02}", month, day),
        "lang": used_lang,
        "events": events,
    })
    .to_string()
}

/// Fetch the curated ("selected") events for MM/DD from the onthisday
/// feed, trimmed to the 3 most recent so the prompt stays small.
async fn fetch_onthisday(lang: &str, month: u32, day: u32) -> Result<Vec<Value>, String> {
    let url = format!(
        "https://{}.wikipedia.org/api/rest_v1/feed/onthisday/selected/{:02}/{:02}",
        lang, month, day
    );
    let res = super::HTTP
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("fetch failed: {e}"))?;
    if res.status().as_u16() == 404 {
        return Ok(Vec::new());
    }
    if !res.status().is_success() {
        return Err(format!("http {}", res.status().as_u16()));
    }
    let v: Value = res
        .json()
        .await
        .map_err(|e| format!("json parse failed: {e}"))?;
    let selected = v
        .get("selected")
        .and_then(|s| s.as_array())
        .cloned()
        .unwrap_or_default();
    // Newest events first — more likely to be recognizable / relevant.
    let mut items: Vec<(i64, Value)> = selected
        .iter()
        .map(|e| {
            let year = e.get("year").and_then(|y| y.as_i64()).unwrap_or(i64::MIN);
            let text = e.get("text").cloned().unwrap_or(Value::Null);
            let page_url = e
                .get("pages")
                .and_then(|p| p.as_array())
                .and_then(|a| a.first())
                .and_then(|p| p.get("content_urls"))
                .and_then(|c| c.get("desktop"))
                .and_then(|d| d.get("page"))
                .cloned()
                .unwrap_or(Value::Null);
            (
                year,
                json!({ "year": e.get("year").cloned().unwrap_or(Value::Null), "text": text, "page_url": page_url }),
            )
        })
        .collect();
    items.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(items.into_iter().take(3).map(|(_, v)| v).collect())
}

async fn fetch_summary(lang: &str, title: &str) -> Result<String, String> {
    let url = format!(
        "https://{}.wikipedia.org/api/rest_v1/page/summary/{}",
        lang,
        urlencoding::encode(title)
    );
    let res = super::HTTP
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("fetch failed: {e}"))?;
    if res.status().as_u16() == 404 {
        return Err("not_found".into());
    }
    if !res.status().is_success() {
        return Err(format!("http {}", res.status().as_u16()));
    }
    let v: Value = res
        .json()
        .await
        .map_err(|e| format!("json parse failed: {e}"))?;
    Ok(json!({
        "title": v.get("title").cloned().unwrap_or(Value::Null),
        "description": v.get("description").cloned().unwrap_or(Value::Null),
        "extract": v.get("extract").cloned().unwrap_or(Value::Null),
        "url": v
            .get("content_urls")
            .and_then(|c| c.get("desktop"))
            .and_then(|d| d.get("page"))
            .cloned()
            .unwrap_or(Value::Null),
        "lang": lang,
    })
    .to_string())
}

/// Use Wikipedia's opensearch endpoint to resolve a fuzzy query to the
/// most likely canonical page title. Returns None if there is no hit.
async fn resolve_title(lang: &str, query: &str) -> Option<String> {
    let url = format!(
        "https://{}.wikipedia.org/w/api.php?action=opensearch&limit=1&format=json&search={}",
        lang,
        urlencoding::encode(query)
    );
    let res = super::HTTP.get(&url).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    // opensearch returns a 4-tuple [query, [titles], [descriptions], [urls]]
    let v: Value = res.json().await.ok()?;
    v.get(1)
        .and_then(|titles| titles.get(0))
        .and_then(|t| t.as_str())
        .map(String::from)
}
