// Public holiday lookup via the Nager.Date API (no key, no rate limit,
// 100+ countries). "次の祝日いつ?" → the next upcoming holidays for the
// user's country; an optional `year` switches to that whole year's list.
// Country defaults to the app language's home country but can be
// overridden with an ISO-3166 alpha-2 code.

use serde::Deserialize;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_holidays_next",
            "description": "祝日（祝祭日）を調べる。「次の祝日いつ？」「来月祝日ある？」「今年の祝日教えて」。country 未指定ならアプリの言語の国。year を指定するとその年の全祝日、未指定なら今後の祝日を返す。返り値の holidays（date と localName）を自然に読み上げる。",
            "parameters": {
                "type": "object",
                "properties": {
                    "country": {
                        "type": "string",
                        "description": "ISO-3166 alpha-2 の国コード（JP / US / GB など）。未指定ならアプリの言語に対応する国。"
                    },
                    "year": {
                        "type": "integer",
                        "description": "西暦。指定するとその年の全祝日。未指定なら今後の祝日のみ。"
                    }
                },
                "required": [],
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "next" => next(args).await,
        other => json!({ "error": format!("unknown holidays tool: {}", other) }).to_string(),
    }
}

#[derive(Deserialize)]
struct Holiday {
    date: String,
    #[serde(rename = "localName")]
    local_name: String,
    name: String,
}

async fn next(args: &Value) -> String {
    let country = args
        .get("country")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_uppercase())
        .filter(|s| s.len() == 2)
        .unwrap_or_else(default_country);
    let year = args.get("year").and_then(|v| v.as_i64());

    let url = match year {
        Some(y) => format!("https://date.nager.at/api/v3/PublicHolidays/{y}/{country}"),
        None => format!("https://date.nager.at/api/v3/NextPublicHolidays/{country}"),
    };

    let res = match super::HTTP.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("holidays request: {e}") }).to_string(),
    };
    if res.status().as_u16() == 404 {
        return json!({ "error": "country_not_supported", "country": country }).to_string();
    }
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let holidays: Vec<Holiday> = match res.json().await {
        Ok(h) => h,
        Err(e) => return json!({ "error": format!("holidays decode: {e}") }).to_string(),
    };

    // Cap so the prompt stays small; NextPublicHolidays already returns
    // a bounded window, but a full-year query can be 15+ entries.
    let trimmed: Vec<Value> = holidays
        .into_iter()
        .take(8)
        .map(|h| json!({ "date": h.date, "localName": h.local_name, "name": h.name }))
        .collect();

    json!({ "country": country, "holidays": trimmed }).to_string()
}

/// Home country for each supported app language. Best-effort default; the
/// user can always name a country explicitly.
fn default_country() -> String {
    use crate::i18n::Lang;
    match crate::i18n::current() {
        Lang::Ja => "JP",
        Lang::En => "US",
        Lang::Es => "ES",
        Lang::Fr => "FR",
        Lang::De => "DE",
        Lang::It => "IT",
        Lang::Pt => "PT",
        Lang::Ko => "KR",
        Lang::Zh => "CN",
    }
    .to_string()
}
