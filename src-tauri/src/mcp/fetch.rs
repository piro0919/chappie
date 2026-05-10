// Generic URL → readable text. Uses the `readability` crate (Mozilla
// Readability port) to extract the main article body, dropping nav /
// ads / boilerplate. Voice users hit this via "クリップボードの URL
// 読んで" or by handing chappie a URL directly. Returned `text` should
// be summarized by the LLM, not read verbatim — articles are too long
// for TTS.

use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_fetch_readable",
            "description": "任意の URL から本文だけ抽出して返す。「このページ読んで」「クリップボードの URL 要約して」「○○のリンク先まとめて」。url=取得する URL（http/https のみ）。max_chars=本文の最大文字数（既定 4000、上限 10000）。返り値の text を **2-4 文に要約して読み上げる**（生のまま読み上げない、長すぎる）。クリップボードに URL があれば read_clipboard を先に呼ぶ。",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "取得する URL（http:// または https:// で始まること）。"
                    },
                    "max_chars": {
                        "type": "integer",
                        "description": "本文の最大文字数（既定 4000、上限 10000）。",
                        "minimum": 200,
                        "maximum": 10000
                    }
                },
                "required": ["url"],
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "readable" => readable(args).await,
        other => json!({ "error": format!("unknown fetch tool: {}", other) }).to_string(),
    }
}

async fn readable(args: &Value) -> String {
    let url = args.get("url").and_then(|v| v.as_str()).unwrap_or("").trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return json!({ "error": "url must start with http:// or https://" }).to_string();
    }
    let max_chars = args
        .get("max_chars")
        .and_then(|v| v.as_u64())
        .unwrap_or(4000)
        .clamp(200, 10000) as usize;

    let res = match super::HTTP.get(url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("fetch failed: {}", e) }).to_string(),
    };
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let final_url = res.url().to_string();
    let html = match res.text().await {
        Ok(s) => s,
        Err(e) => return json!({ "error": format!("read failed: {}", e) }).to_string(),
    };

    // readability::extract takes a Read + base url. Run on the blocking
    // pool because it parses HTML (CPU-bound).
    let parsed_url = match url::Url::parse(&final_url) {
        Ok(u) => u,
        Err(e) => return json!({ "error": format!("bad url: {}", e) }).to_string(),
    };
    let extracted = tokio::task::spawn_blocking(move || {
        readability::extractor::extract(&mut html.as_bytes(), &parsed_url)
    })
    .await;

    let product = match extracted {
        Ok(Ok(p)) => p,
        Ok(Err(e)) => return json!({ "error": format!("extract failed: {}", e) }).to_string(),
    Err(e) => return json!({ "error": format!("task join failed: {}", e) }).to_string(),
    };

    let text = product
        .text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    let truncated = if text.chars().count() > max_chars {
        let mut acc = String::new();
        for c in text.chars().take(max_chars) {
            acc.push(c);
        }
        acc.push('…');
        acc
    } else {
        text
    };

    json!({
        "url": final_url,
        "title": product.title,
        "text": truncated,
        "fetched_at": chrono::Local::now().to_rfc3339(),
    })
    .to_string()
}
