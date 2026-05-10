// RSS news reader. Curated feed list per category; the LLM picks a
// category based on the user's voice query and we read N headlines.

use serde_json::{json, Value};

// (category, source label, RSS feed url). Order is irrelevant.
const FEEDS: &[(&str, &str, &str)] = &[
    (
        "general",
        "NHK ニュース",
        "https://www.nhk.or.jp/rss/news/cat0.xml",
    ),
    ("tech", "Hacker News", "https://hnrss.org/frontpage"),
    (
        "world",
        "BBC News",
        "https://feeds.bbci.co.uk/news/world/rss.xml",
    ),
];

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_news_latest",
            "description": "最新ニュースの見出しを取得する。「最新ニュース教えて」「ニュース読んで」「テックニュース」「海外ニュース」など。category=general（NHK 主要ニュース、既定）/ tech（Hacker News、IT・スタートアップ）/ world（BBC News 海外）。limit=取得件数（既定 5、最大 10）。返り値の items から見出しを簡潔に読み上げる。リンクは読み上げない。",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["general", "tech", "world"],
                        "description": "general=NHK 主要ニュース（既定）, tech=Hacker News, world=BBC News 海外。"
                    },
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
        "latest" => latest(args).await,
        other => json!({ "error": format!("unknown news tool: {}", other) }).to_string(),
    }
}

async fn latest(args: &Value) -> String {
    let category = args
        .get("category")
        .and_then(|v| v.as_str())
        .unwrap_or("general");
    let limit = args
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(5)
        .clamp(1, 10) as usize;

    let Some((_, label, url)) = FEEDS.iter().find(|(c, _, _)| *c == category) else {
        return json!({ "error": format!("unknown category: {}", category) }).to_string();
    };

    let res = match super::HTTP.get(*url).send().await {
        Ok(r) => r,
        Err(e) => {
            return json!({ "error": format!("fetch failed: {}", e) }).to_string();
        }
    };
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let bytes = match res.bytes().await {
        Ok(b) => b,
        Err(e) => {
            return json!({ "error": format!("read failed: {}", e) }).to_string();
        }
    };

    let channel = match rss::Channel::read_from(&bytes[..]) {
        Ok(c) => c,
        Err(e) => {
            return json!({ "error": format!("rss parse failed: {}", e) }).to_string();
        }
    };

    let items: Vec<Value> = channel
        .items()
        .iter()
        .take(limit)
        .map(|item| {
            json!({
                "title": item.title().unwrap_or("").trim(),
                "link": item.link().unwrap_or(""),
                "published": item.pub_date().unwrap_or(""),
                "source": label,
            })
        })
        .collect();

    json!({
        "category": category,
        "source": label,
        "fetched_at": chrono::Local::now().to_rfc3339(),
        "items": items,
    })
    .to_string()
}
