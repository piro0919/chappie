// JMA (気象庁) earthquake feed. Reads the public list.json and returns
// the most recent N quakes with magnitude, max intensity, epicenter,
// and time. JP-specific; English UI users still get the data but it's
// dominated by Japanese epicenters.

use serde_json::{json, Value};

const FEED_URL: &str = "https://www.jma.go.jp/bosai/quake/data/list.json";

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_quake_recent",
            "description": "気象庁の最新地震情報を取得する。「最近の地震は？」「さっき揺れたけど震度いくつ？」「最近大きい地震あった？」。日本国内の地震が中心。limit=取得件数（既定 5、最大 10）。返り値の items から、震源・マグニチュード・最大震度・発生時刻を簡潔に読み上げる。震度ゼロや遠地の小さな地震ばかりなら「最近は静か」と一言でまとめてよい。",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "取得件数（既定 5、最大 10）。",
                        "minimum": 1,
                        "maximum": 10
                    }
                },
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "recent" => recent(args).await,
        other => json!({ "error": format!("unknown quake tool: {}", other) }).to_string(),
    }
}

async fn recent(args: &Value) -> String {
    let limit = args
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(5)
        .clamp(1, 10) as usize;

    let res = match super::HTTP.get(FEED_URL).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("fetch failed: {}", e) }).to_string(),
    };
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let body: Value = match res.json().await {
        Ok(v) => v,
        Err(e) => return json!({ "error": format!("json parse failed: {}", e) }).to_string(),
    };

    let arr = match body.as_array() {
        Some(a) => a,
        None => return json!({ "error": "unexpected feed shape" }).to_string(),
    };

    let items: Vec<Value> = arr
        .iter()
        .take(limit)
        .map(|q| {
            // ctt is yyyymmddhhmmss in JST; reformat for voice clarity.
            let ctt = q.get("ctt").and_then(|v| v.as_str()).unwrap_or("");
            let when = format_jma_time(ctt);
            json!({
                "epicenter": q.get("anm").and_then(|v| v.as_str()).unwrap_or(""),
                "magnitude": q.get("mag").and_then(|v| v.as_str()).unwrap_or(""),
                "max_intensity": q.get("maxi").and_then(|v| v.as_str()).unwrap_or(""),
                "title": q.get("ttl").and_then(|v| v.as_str()).unwrap_or(""),
                "when": when,
                "raw_time": ctt,
            })
        })
        .collect();

    json!({
        "source": "気象庁 地震情報",
        "fetched_at": chrono::Local::now().to_rfc3339(),
        "items": items,
    })
    .to_string()
}

/// Reformat JMA's compact `yyyymmddhhmmss` into `M月D日 H時M分` so the
/// LLM can read it naturally without parsing.
fn format_jma_time(ctt: &str) -> String {
    if ctt.len() < 12 {
        return ctt.to_string();
    }
    let month = &ctt[4..6];
    let day = &ctt[6..8];
    let hour = &ctt[8..10];
    let minute = &ctt[10..12];
    format!(
        "{}月{}日 {}時{}分",
        month.trim_start_matches('0'),
        day.trim_start_matches('0'),
        hour.trim_start_matches('0'),
        minute,
    )
}
