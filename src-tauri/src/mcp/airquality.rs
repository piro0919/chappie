// Air quality lookup via the Open-Meteo Air Quality API (no key, same
// provider family as weather.rs). Reports PM2.5 / PM10 / dust (黄砂) /
// UV index and the US AQI index. Location resolution mirrors get_weather:
// fall back to the cached current location when no place name is given,
// otherwise geocode the name through Open-Meteo's geocoding endpoint.
//
// Note: CAMS pollen variables are Europe-only (no Japanese cedar/スギ),
// so this tool intentionally exposes PM / dust / UV rather than pollen.

use serde::Deserialize;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_airquality_current",
            "description": "現在の空気の質を取得する。「今日の空気どう？」「PM2.5は？」「黄砂きてる？」「紫外線強い？」。location 未指定なら現在地、地名指定もできる。返り値の level_hint（良好/普通/やや悪い/悪い）と pm2_5・dust(黄砂)・uv_index を自然に読み上げる。花粉（スギ）には非対応。",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "調べたい地名（「大阪」「ロンドン」など）。未指定ならユーザーの現在地。"
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
        "current" => current(args).await,
        other => json!({ "error": format!("unknown airquality tool: {}", other) }).to_string(),
    }
}

async fn current(args: &Value) -> String {
    let location = args
        .get("location")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    let (lat, lon, place) = if location.is_empty() {
        match crate::location::cached() {
            Some(here) => (
                here.latitude,
                here.longitude,
                crate::location::format_for_prompt(&here),
            ),
            None => {
                return json!({
                    "error": "ユーザーの現在地が取得できていません。地名を指定してもう一度呼んでください。"
                })
                .to_string();
            }
        }
    } else {
        match geocode(location).await {
            Ok(hit) => hit,
            Err(e) => return json!({ "error": e }).to_string(),
        }
    };

    match fetch(lat, lon).await {
        Ok(mut v) => {
            if let Value::Object(ref mut m) = v {
                m.insert("place".into(), json!(place));
            }
            v.to_string()
        }
        Err(e) => json!({ "error": e }).to_string(),
    }
}

#[derive(Deserialize)]
struct GeoResp {
    results: Option<Vec<GeoHit>>,
}

#[derive(Deserialize)]
struct GeoHit {
    name: String,
    latitude: f64,
    longitude: f64,
    country: Option<String>,
}

async fn geocode(location: &str) -> Result<(f64, f64, String), String> {
    let url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=ja&format=json",
        urlencoding::encode(location)
    );
    let geo: GeoResp = super::HTTP
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("geocoding request: {e}"))?
        .json()
        .await
        .map_err(|e| format!("geocoding decode: {e}"))?;
    let hit = geo
        .results
        .and_then(|v| v.into_iter().next())
        .ok_or_else(|| format!("no location matched \"{location}\""))?;
    let place = match &hit.country {
        Some(c) => format!("{} ({})", hit.name, c),
        None => hit.name.clone(),
    };
    Ok((hit.latitude, hit.longitude, place))
}

#[derive(Deserialize)]
struct AqResp {
    current: Option<AqCurrent>,
}

#[derive(Deserialize)]
struct AqCurrent {
    pm2_5: Option<f64>,
    pm10: Option<f64>,
    dust: Option<f64>,
    uv_index: Option<f64>,
    us_aqi: Option<f64>,
}

async fn fetch(lat: f64, lon: f64) -> Result<Value, String> {
    let url = format!(
        "https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=pm2_5,pm10,dust,uv_index,us_aqi&timezone=auto"
    );
    let res = super::HTTP
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("air-quality request: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("http {}", res.status().as_u16()));
    }
    let parsed: AqResp = res
        .json()
        .await
        .map_err(|e| format!("air-quality decode: {e}"))?;
    let cur = parsed
        .current
        .ok_or_else(|| "air-quality response missing current".to_string())?;

    Ok(json!({
        "pm2_5": cur.pm2_5,
        "pm10": cur.pm10,
        "dust": cur.dust,
        "uv_index": cur.uv_index,
        "us_aqi": cur.us_aqi,
        "level_hint": cur.pm2_5.map(pm25_level).unwrap_or("不明"),
    }))
}

/// Coarse PM2.5 (μg/m³) band so the LLM doesn't have to interpret the raw
/// number. Boundaries follow the US AQI breakpoints for PM2.5 collapsed
/// into 4 spoken buckets.
fn pm25_level(pm25: f64) -> &'static str {
    if pm25 <= 12.0 {
        "良好"
    } else if pm25 <= 35.4 {
        "普通"
    } else if pm25 <= 55.4 {
        "やや悪い"
    } else {
        "悪い"
    }
}
