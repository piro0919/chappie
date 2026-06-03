// JMA (気象庁) typhoon feed. Reads targetTc.json for the currently active
// tropical cyclones, then per-TC specifications.json for the analysis
// (実況) — center position, pressure, max wind, course, speed, size — plus
// a short outlook from the furthest forecast step (which is where the
// category often shifts to 熱帯低気圧 / 温帯低気圧). Returns an empty list
// cleanly when nothing is active (the common case outside typhoon season),
// so the model can just say "今は台風は発生していません". JP/Pacific-basin
// focused; the location strings are already natural Japanese ("志摩市の
// 東南東約40km") so the LLM reads them without any coordinate parsing.

use serde_json::{json, Value};

const TARGET_URL: &str = "https://www.jma.go.jp/bosai/typhoon/data/targetTc.json";

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_typhoon_current",
            "description": "気象庁の台風情報を取得する。「台風どうなってる？」「台風来てる？」「今の台風の進路は？」「台風何号？」「台風情報教えて」。発生中の台風の番号・名前・中心位置・進行方向・速度・中心気圧・最大風速・大きさ・強さを返す。返り値の items が空なら発生中の台風は無し（その場合は『今は台風は発生していません』と一言）。各 item の location（例: 志摩市の東南東約40km）と course/speed_kmh/pressure_hpa を中心に簡潔に読み上げ、outlook があれば今後の見込みを一言添える。日本に関係する太平洋域の台風が対象。",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, _args: &Value) -> String {
    match tool {
        "current" => current().await,
        other => json!({ "error": format!("unknown typhoon tool: {}", other) }).to_string(),
    }
}

async fn current() -> String {
    let list = match fetch_json(TARGET_URL).await {
        Ok(v) => v,
        Err(e) => return json!({ "error": e }).to_string(),
    };
    let arr = match list.as_array() {
        Some(a) => a,
        None => return json!({ "error": "unexpected targetTc shape" }).to_string(),
    };

    if arr.is_empty() {
        return json!({
            "source": "気象庁 台風情報",
            "fetched_at": chrono::Local::now().to_rfc3339(),
            "active": false,
            "items": [],
            "note": "現在発生中の台風はありません。",
        })
        .to_string();
    }

    // Usually 0–2 active; cap at 3 so a rare swarm can't blow up the payload.
    let mut items = Vec::new();
    for tc in arr.iter().take(3) {
        let id = match tc.get("tropicalCyclone").and_then(|v| v.as_str()) {
            Some(s) if !s.is_empty() => s,
            _ => continue,
        };
        let url = format!(
            "https://www.jma.go.jp/bosai/typhoon/data/{}/specifications.json",
            id
        );
        if let Ok(spec) = fetch_json(&url).await {
            if let Some(item) = summarize(&spec) {
                items.push(item);
            }
        }
    }

    json!({
        "source": "気象庁 台風情報",
        "fetched_at": chrono::Local::now().to_rfc3339(),
        "active": !items.is_empty(),
        "items": items,
    })
    .to_string()
}

/// Collapse one TC's specifications.json (title + a series of time-step
/// parts) into a single voice-readable summary: the 実況 (analysis) step
/// for "now", plus the furthest 予報 step as a one-line outlook.
fn summarize(spec: &Value) -> Option<Value> {
    let parts = spec.as_array()?;

    // Title part carries the typhoon number + name.
    let title = parts
        .iter()
        .find(|p| p.get("part").and_then(|v| v.as_str()) == Some("title"))?;
    let number_raw = title
        .get("typhoonNumber")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    // typhoonNumber is YYNN (e.g. "2606" → 6号); last two digits are the count.
    let number = number_raw.parse::<u32>().ok().map(|n| n % 100);
    let name = title
        .get("name")
        .and_then(|n| n.get("jp"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Analysis ("実況") is the present-time step.
    let now = parts
        .iter()
        .find(|p| part_jp(p) == Some("実況"))?;

    let intensity = match now.get("intensity").and_then(|v| v.as_str()) {
        Some("-") | None => "",
        Some(s) => s,
    };
    let max_wind = now.get("maximumWind");

    // Outlook: the last "予報" step (furthest ahead) — its category is where
    // weakening to 熱帯低気圧 / 温帯低気圧 shows up.
    let outlook = parts
        .iter()
        .rev()
        .find(|p| part_jp(p).map(|s| s.starts_with("予報")).unwrap_or(false))
        .map(|p| {
            json!({
                "when": jst_of(p),
                "category": cat_jp(p),
                "pressure_hpa": p.get("pressure").and_then(|v| v.as_str()).unwrap_or(""),
            })
        });

    Some(json!({
        "number": number,
        "name": name,
        "category": cat_jp(now),
        "scale": now.get("scale").and_then(|v| v.as_str()).unwrap_or(""),
        "intensity": intensity,
        "location": now.get("location").and_then(|v| v.as_str()).unwrap_or(""),
        "course": now.get("course").and_then(|v| v.as_str()).unwrap_or(""),
        "speed_kmh": now.get("speed").and_then(|s| s.get("km/h")).and_then(|v| v.as_str()).unwrap_or(""),
        "pressure_hpa": now.get("pressure").and_then(|v| v.as_str()).unwrap_or(""),
        "max_wind_ms": max_wind.and_then(|w| w.get("sustained")).and_then(|s| s.get("m/s")).and_then(|v| v.as_str()).unwrap_or(""),
        "gust_ms": max_wind.and_then(|w| w.get("gust")).and_then(|g| g.get("m/s")).and_then(|v| v.as_str()).unwrap_or(""),
        "when": jst_of(now),
        "outlook": outlook,
    }))
}

/// `part.jp` for the time-step parts (title part stores `part` as a plain
/// string, so this returns None there — which is what callers want).
fn part_jp(p: &Value) -> Option<&str> {
    p.get("part").and_then(|v| v.get("jp")).and_then(|v| v.as_str())
}

fn cat_jp(p: &Value) -> &str {
    p.get("category")
        .and_then(|c| c.get("jp"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
}

/// Reformat a part's `validtime.JST` ISO string into `M月D日 H時M分` for
/// natural reading. Input shape is fixed ("2026-06-03T08:00:00+09:00").
fn jst_of(p: &Value) -> String {
    let iso = p
        .get("validtime")
        .and_then(|t| t.get("JST"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if iso.len() < 16 {
        return iso.to_string();
    }
    let month = &iso[5..7];
    let day = &iso[8..10];
    let hour = &iso[11..13];
    let minute = &iso[14..16];
    format!(
        "{}月{}日 {}時{}分",
        month.trim_start_matches('0'),
        day.trim_start_matches('0'),
        hour.trim_start_matches('0'),
        minute,
    )
}

async fn fetch_json(url: &str) -> Result<Value, String> {
    let res = super::HTTP
        .get(url)
        .send()
        .await
        .map_err(|e| format!("fetch failed: {}", e))?;
    if !res.status().is_success() {
        return Err(format!("http {}", res.status().as_u16()));
    }
    res.json()
        .await
        .map_err(|e| format!("json parse failed: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Trimmed from a real JMA specifications.json (TC2606 / 台風6号 チャンミー,
    // 2026-06-03): title + analysis + a couple of forecast steps.
    fn fixture() -> Value {
        json!([
            {
                "part": "title",
                "typhoonNumber": "2606",
                "name": { "jp": "チャンミー", "en": "Jangmi" },
                "category": { "jp": "台風", "en": "STS" }
            },
            {
                "part": { "jp": "実況", "en": "Analysis" },
                "maximumWind": {
                    "sustained": { "m/s": "25", "kt": "50" },
                    "gust": { "m/s": "35", "kt": "70" }
                },
                "category": { "jp": "台風", "en": "STS" },
                "scale": "大型",
                "intensity": "-",
                "position": { "deg": [34.2, 137.2] },
                "location": "志摩市の東南東約40km",
                "course": "東北東",
                "speed": { "km/h": "40", "kt": "22" },
                "pressure": "980",
                "validtime": { "JST": "2026-06-03T08:00:00+09:00" }
            },
            {
                "part": { "jp": "予報　４時間後", "en": "Forecast for 4 hours ahead" },
                "category": { "jp": "台風", "en": "STS" },
                "pressure": "980",
                "validtime": { "JST": "2026-06-03T12:00:00+09:00" }
            },
            {
                "part": { "jp": "予報　１日後", "en": "Forecast for 1 day ahead" },
                "category": { "jp": "温帯低気圧", "en": "L" },
                "pressure": "990",
                "validtime": { "JST": "2026-06-04T09:00:00+09:00" }
            }
        ])
    }

    #[test]
    fn summarize_reads_analysis_and_outlook() {
        let s = summarize(&fixture()).expect("should summarize");
        assert_eq!(s["number"], 6); // 2606 → 台風6号
        assert_eq!(s["name"], "チャンミー");
        assert_eq!(s["category"], "台風");
        assert_eq!(s["scale"], "大型");
        assert_eq!(s["intensity"], ""); // "-" collapses to empty
        assert_eq!(s["location"], "志摩市の東南東約40km");
        assert_eq!(s["course"], "東北東");
        assert_eq!(s["speed_kmh"], "40");
        assert_eq!(s["pressure_hpa"], "980");
        assert_eq!(s["max_wind_ms"], "25");
        assert_eq!(s["gust_ms"], "35");
        assert_eq!(s["when"], "6月3日 8時00分");
        // Outlook is the furthest forecast step — where it weakens.
        assert_eq!(s["outlook"]["category"], "温帯低気圧");
        assert_eq!(s["outlook"]["when"], "6月4日 9時00分");
    }

    // Hits the live JMA feed. Ignored by default; run with
    // `cargo test --lib mcp::typhoon -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn live_current_smoke() {
        let out = current().await;
        println!("{out}");
        assert!(out.contains("気象庁 台風情報"));
    }
}
