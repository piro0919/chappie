// Sun (sunrise/sunset/solar noon/day length) + moon phase. Sun data
// from sunrise-sunset.org (free, no key). Moon phase computed locally
// via Conway's algorithm — no extra HTTP call, no extra dep.

use chrono::Datelike;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_astro_sunmoon",
            "description": "日の出・日の入り・月齢を取得する。「今日の日の出何時？」「日の入りは？」「今夜の月は？」「満月いつ？」。緯度経度未指定なら chappie が把握している現在地を使う（取得できなければエラーになるので地名指定を促す）。date は YYYY-MM-DD（既定は今日）。返り値の sunrise/sunset は地元時刻、moon_phase_label は「新月 / 三日月 / 上弦 / 十三夜 / 満月 / 寝待月 / 下弦 / 有明月」のいずれか。",
            "parameters": {
                "type": "object",
                "properties": {
                    "lat": {
                        "type": "number",
                        "description": "緯度（任意、未指定なら現在地）。"
                    },
                    "lng": {
                        "type": "number",
                        "description": "経度（任意、未指定なら現在地）。"
                    },
                    "date": {
                        "type": "string",
                        "description": "YYYY-MM-DD 形式の対象日（任意、未指定なら今日）。"
                    }
                },
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "sunmoon" => sunmoon(args).await,
        other => json!({ "error": format!("unknown astro tool: {}", other) }).to_string(),
    }
}

async fn sunmoon(args: &Value) -> String {
    let (lat, lng, location_label) = match (
        args.get("lat").and_then(|v| v.as_f64()),
        args.get("lng").and_then(|v| v.as_f64()),
    ) {
        (Some(a), Some(b)) => (a, b, None),
        _ => match crate::location::cached() {
            Some(here) => (
                here.latitude,
                here.longitude,
                Some(crate::location::format_for_prompt(&here)),
            ),
            None => {
                return json!({
                    "error": "location_unavailable",
                    "hint": "現在地が取れていません。地名（緯度経度）を指定して呼び直してください。"
                })
                .to_string();
            }
        },
    };

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let date = args
        .get("date")
        .and_then(|v| v.as_str())
        .unwrap_or(&today)
        .to_string();

    // Sunrise/sunset: ask the API for unformatted UTC times so we can
    // convert to local TZ ourselves with chrono.
    let url = format!(
        "https://api.sunrise-sunset.org/json?lat={}&lng={}&date={}&formatted=0",
        lat, lng, date
    );
    let res = match super::HTTP.get(&url).send().await {
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
    if body.get("status").and_then(|v| v.as_str()) != Some("OK") {
        return json!({
            "error": "api_error",
            "detail": body.get("status").cloned().unwrap_or(Value::Null)
        })
        .to_string();
    }
    let results = body.get("results").cloned().unwrap_or(Value::Null);

    let sunrise = format_local(results.get("sunrise").and_then(|v| v.as_str()));
    let sunset = format_local(results.get("sunset").and_then(|v| v.as_str()));
    let solar_noon = format_local(results.get("solar_noon").and_then(|v| v.as_str()));
    let day_length = results
        .get("day_length")
        .and_then(|v| v.as_i64())
        .map(|s| format!("{}時間{}分", s / 3600, (s % 3600) / 60))
        .unwrap_or_default();

    let (phase_age, phase_label) = moon_phase_for_date(&date);

    json!({
        "lat": lat,
        "lng": lng,
        "location": location_label,
        "date": date,
        "sunrise_local": sunrise,
        "sunset_local": sunset,
        "solar_noon_local": solar_noon,
        "day_length": day_length,
        "moon_phase_age_days": phase_age,
        "moon_phase_label": phase_label,
        "source": "sunrise-sunset.org + local moon phase calc",
    })
    .to_string()
}

fn format_local(iso_utc: Option<&str>) -> String {
    let Some(s) = iso_utc else { return String::new() };
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| {
            dt.with_timezone(&chrono::Local)
                .format("%H:%M")
                .to_string()
        })
        .unwrap_or_default()
}

/// Conway-style moon age in days (0..29.53). Good enough for "what's
/// the phase tonight" — accurate to within a day.
fn moon_phase_for_date(ymd: &str) -> (f64, &'static str) {
    let date =
        chrono::NaiveDate::parse_from_str(ymd, "%Y-%m-%d").unwrap_or_else(|_| chrono::Local::now().date_naive());
    let (mut y, mut m, d) = (date.year(), date.month() as i32, date.day() as i32);
    if m < 3 {
        y -= 1;
        m += 12;
    }
    // Conway's approximation
    let mut r = (y % 100) as f64;
    r %= 19.0;
    if r > 9.5 {
        r -= 19.0;
    }
    r = (r * 11.0) % 30.0;
    let mut age = r + m as f64 + d as f64;
    if m < 3 {
        age += 2.0;
    }
    age -= if y < 2000 { 4.0 } else { 8.3 };
    age = ((age + 30.0) % 30.0).abs();

    // 8-bucket label tuned for JP voice; switch points at ~3.7 days.
    let label = match age {
        a if a < 1.84 => "新月",
        a if a < 5.53 => "三日月",
        a if a < 9.22 => "上弦の月",
        a if a < 12.91 => "十三夜月",
        a if a < 16.61 => "満月",
        a if a < 20.30 => "寝待月",
        a if a < 23.99 => "下弦の月",
        a if a < 27.68 => "有明月",
        _ => "新月",
    };
    (age, label)
}
