// Anime lookup via the Jikan API (unofficial MyAnimeList, no key). "進撃の
// 巨人って何話まで?" / "この作品の評価は?". We take the most popular match
// for the query (order by members) and return the headline facts —
// episode count, status, score, year, genres and a trimmed synopsis —
// for the LLM to read out.

use serde::Deserialize;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_anime_info",
            "description": "アニメ作品の情報を返す。「進撃の巨人って何話まで？」「鬼滅の刃の評価は？」「チェンソーマンってどんな話？」。query=作品名（日本語でも英語でも可）。返り値の title・episodes・status・score・genres・synopsis を自然に読み上げる。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "調べたいアニメ作品名。「進撃の巨人」「Attack on Titan」など。"
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
        "info" => info(args).await,
        other => json!({ "error": format!("unknown anime tool: {}", other) }).to_string(),
    }
}

#[derive(Deserialize)]
struct JikanResp {
    data: Vec<Anime>,
}

#[derive(Deserialize)]
struct Anime {
    title: Option<String>,
    title_japanese: Option<String>,
    #[serde(rename = "type")]
    type_: Option<String>,
    episodes: Option<u32>,
    status: Option<String>,
    score: Option<f64>,
    year: Option<u32>,
    genres: Option<Vec<NamedRef>>,
    synopsis: Option<String>,
}

#[derive(Deserialize)]
struct NamedRef {
    name: String,
}

async fn info(args: &Value) -> String {
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if query.is_empty() {
        return json!({ "error": "query is empty" }).to_string();
    }
    // Most-popular match keeps "進撃の巨人" landing on the main series
    // rather than a spin-off / OVA.
    let url = format!(
        "https://api.jikan.moe/v4/anime?q={}&limit=1&order_by=members&sort=desc",
        urlencoding::encode(query)
    );
    let res = match super::HTTP.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("jikan request: {e}") }).to_string(),
    };
    if res.status().as_u16() == 429 {
        return json!({ "error": "rate_limited", "hint": "アニメ情報サービスが一時的に混雑しています。少し待ってください。" }).to_string();
    }
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let parsed: JikanResp = match res.json().await {
        Ok(p) => p,
        Err(e) => return json!({ "error": format!("jikan decode: {e}") }).to_string(),
    };
    let Some(a) = parsed.data.into_iter().next() else {
        return json!({ "error": "not_found", "query": query }).to_string();
    };

    let genres: Vec<String> = a
        .genres
        .unwrap_or_default()
        .into_iter()
        .map(|g| g.name)
        .collect();
    // Trim the synopsis so it doesn't dominate the prompt / TTS.
    let synopsis = a.synopsis.map(|s| {
        if s.chars().count() > 300 {
            format!("{}…", s.chars().take(300).collect::<String>())
        } else {
            s
        }
    });

    json!({
        "title": a.title,
        "title_japanese": a.title_japanese,
        "type": a.type_,
        "episodes": a.episodes,
        "status": a.status,
        "score": a.score,
        "year": a.year,
        "genres": genres,
        "synopsis": synopsis,
    })
    .to_string()
}
