// Wikipedia summary lookup. Hits the REST `page/summary/{title}`
// endpoint, which follows redirects (so misspellings or alternative
// titles often still resolve). On a 404 we fall back to opensearch to
// resolve the canonical title, then re-fetch.

use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
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
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "summary" => summary(args).await,
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
