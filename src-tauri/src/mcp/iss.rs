// International Space Station position via wheretheiss.at (no key). "今
// ISS どこ?" → current latitude/longitude, altitude and ground speed,
// plus a rough "over which ocean/region" descriptor derived locally so
// the reply isn't just two numbers.

use serde::Deserialize;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_iss_location",
            "description": "国際宇宙ステーション（ISS）の現在位置を返す。「宇宙ステーション今どこ？」「ISS どこ飛んでる？」「ISS の高度は？」。返り値の latitude/longitude/region（おおまかな海域・地域）・altitude_km・speed_kmh を自然に読み上げる。引数なし。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": false
            }
        }
    })]
}

pub async fn execute(tool: &str, args: &Value) -> String {
    match tool {
        "location" => location(args).await,
        other => json!({ "error": format!("unknown iss tool: {}", other) }).to_string(),
    }
}

#[derive(Deserialize)]
struct IssResp {
    latitude: f64,
    longitude: f64,
    altitude: f64,
    velocity: f64,
}

async fn location(_args: &Value) -> String {
    let url = "https://api.wheretheiss.at/v1/satellites/25544";
    let res = match super::HTTP.get(url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("iss request: {e}") }).to_string(),
    };
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let iss: IssResp = match res.json().await {
        Ok(v) => v,
        Err(e) => return json!({ "error": format!("iss decode: {e}") }).to_string(),
    };

    json!({
        "latitude": (iss.latitude * 100.0).round() / 100.0,
        "longitude": (iss.longitude * 100.0).round() / 100.0,
        "region": region_hint(iss.latitude, iss.longitude),
        "altitude_km": iss.altitude.round(),
        "speed_kmh": iss.velocity.round(),
    })
    .to_string()
}

/// Very rough "where on Earth" descriptor from longitude. The ISS is over
/// ocean ~70% of the time, so a coarse ocean/continent label is enough to
/// make the spoken reply concrete without a reverse-geocode call.
fn region_hint(_lat: f64, lon: f64) -> &'static str {
    match lon {
        x if (-30.0..20.0).contains(&x) => "大西洋〜アフリカ・ヨーロッパ上空",
        x if (20.0..60.0).contains(&x) => "アフリカ東部〜中東上空",
        x if (60.0..100.0).contains(&x) => "インド洋〜南アジア上空",
        x if (100.0..150.0).contains(&x) => "東アジア〜東南アジア上空",
        x if (150.0..=180.0).contains(&x) || (-180.0..-150.0).contains(&x) => {
            "西太平洋〜オセアニア上空"
        }
        x if (-150.0..-100.0).contains(&x) => "太平洋〜北米西部上空",
        _ => "南北アメリカ〜大西洋西部上空",
    }
}
