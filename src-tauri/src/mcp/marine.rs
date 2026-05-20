// Marine / wave conditions via the Open-Meteo Marine API (no key, same
// provider family as weather.rs). Reports wave height / period /
// direction for a coastal point. Location resolution mirrors get_weather
// and airquality: cached current location, or a geocoded place name.
//
// Note: the wave model only covers ocean/coastal points. Inland
// coordinates come back with null values — we surface that as a hint
// rather than pretending there's surf in Nagano.

use serde::Deserialize;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_marine_current",
            "description": "海の波の状況を取得する。「今日の波どう？」「波高い？」「サーフィンできそう？」「釣り行けるかな？」。location 未指定なら現在地、海沿いの地名指定もできる。波高(m)・周期(s)・向きを返す。内陸では波データが無い旨を返す。",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "調べたい海沿いの地名（「湘南」「鎌倉」「サンディエゴ」など）。未指定ならユーザーの現在地。"
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
        other => json!({ "error": format!("unknown marine tool: {}", other) }).to_string(),
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
                    "error": "ユーザーの現在地が取得できていません。海沿いの地名を指定してもう一度呼んでください。"
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
struct MarineResp {
    current: Option<MarineCurrent>,
}

#[derive(Deserialize)]
struct MarineCurrent {
    wave_height: Option<f64>,
    wave_period: Option<f64>,
    wave_direction: Option<f64>,
}

async fn fetch(lat: f64, lon: f64) -> Result<Value, String> {
    let url = format!(
        "https://marine-api.open-meteo.com/v1/marine?latitude={lat}&longitude={lon}&current=wave_height,wave_period,wave_direction&timezone=auto"
    );
    let res = super::HTTP
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("marine request: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("http {}", res.status().as_u16()));
    }
    let parsed: MarineResp = res
        .json()
        .await
        .map_err(|e| format!("marine decode: {e}"))?;
    let cur = parsed
        .current
        .ok_or_else(|| "marine response missing current".to_string())?;

    // The wave model returns nulls for inland points. Tell the LLM
    // plainly so it doesn't invent surf conditions.
    if cur.wave_height.is_none() {
        return Ok(json!({
            "available": false,
            "hint": "この地点は内陸または波モデルの対象外で、波のデータがありません。"
        }));
    }

    Ok(json!({
        "available": true,
        "wave_height_m": cur.wave_height,
        "wave_period_s": cur.wave_period,
        "wave_direction_deg": cur.wave_direction,
        "level_hint": cur.wave_height.map(wave_level).unwrap_or("不明"),
    }))
}

/// Coarse wave-height band (meters) so the LLM can speak it naturally
/// without interpreting the raw number.
fn wave_level(h: f64) -> &'static str {
    if h < 0.5 {
        "穏やか"
    } else if h < 1.25 {
        "やや穏やか"
    } else if h < 2.5 {
        "やや高い"
    } else {
        "高い"
    }
}
