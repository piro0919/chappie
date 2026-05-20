// Aircraft currently overhead via the OpenSky Network REST API (no key,
// anonymous tier). We query /states/all with a small bounding box around
// the user's location and report the nearest few aircraft: callsign,
// origin country, altitude, speed. A playful "what's that plane?" tool
// that only a location-aware desktop assistant can answer.
//
// Anonymous access is rate-limited (credit budget per day) and the
// bounding box is kept small (~±0.5°) to keep the per-call cost low.

use serde::Deserialize;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_flights_overhead",
            "description": "今いる場所の上空を飛んでいる飛行機を返す。「今頭の上飛んでる飛行機なに？」「上空に飛行機いる？」「近くを飛んでる飛行機教えて」。返り値の flights（便名 callsign・出発国 origin_country・高度 altitude_m・速度 speed_kmh）を 1-2 機読み上げる。引数なし。現在地が必要。",
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
        "overhead" => overhead(args).await,
        other => json!({ "error": format!("unknown flights tool: {}", other) }).to_string(),
    }
}

#[derive(Deserialize)]
struct StatesResp {
    states: Option<Vec<Vec<Value>>>,
}

async fn overhead(_args: &Value) -> String {
    let Some(here) = crate::location::cached() else {
        return json!({
            "error": "ユーザーの現在地が取得できていません。設定から位置情報を許可してもう一度試してください。"
        })
        .to_string();
    };
    // ~±0.5° box ≈ 55 km N/S; keeps the OpenSky credit cost modest.
    let d = 0.5;
    let (lamin, lamax) = (here.latitude - d, here.latitude + d);
    let (lomin, lomax) = (here.longitude - d, here.longitude + d);
    let url = format!(
        "https://opensky-network.org/api/states/all?lamin={lamin}&lomin={lomin}&lamax={lamax}&lomax={lomax}"
    );

    let res = match super::HTTP.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("opensky request: {e}") }).to_string(),
    };
    if res.status().as_u16() == 429 {
        return json!({ "error": "rate_limited", "hint": "OpenSky の無料枠が一時的に上限です。少し時間をおいてください。" }).to_string();
    }
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let parsed: StatesResp = match res.json().await {
        Ok(p) => p,
        Err(e) => return json!({ "error": format!("opensky decode: {e}") }).to_string(),
    };
    let states = parsed.states.unwrap_or_default();
    if states.is_empty() {
        return json!({ "flights": [], "hint": "今この上空に補足できる飛行機はいません。" }).to_string();
    }

    // State vector layout (OpenSky): [0]=icao24 [1]=callsign [2]=origin_country
    // [5]=longitude [6]=latitude [7]=baro_altitude(m) [8]=on_ground
    // [9]=velocity(m/s). Sort by altitude descending so cruising aircraft
    // (the ones you'd actually spot) come first.
    let mut flights: Vec<(f64, Value)> = states
        .iter()
        .filter(|s| s.get(8).and_then(|v| v.as_bool()) != Some(true))
        .map(|s| {
            let alt = s.get(7).and_then(|v| v.as_f64());
            let speed_kmh = s
                .get(9)
                .and_then(|v| v.as_f64())
                .map(|ms| (ms * 3.6).round());
            let callsign = s
                .get(1)
                .and_then(|v| v.as_str())
                .map(|c| c.trim().to_string())
                .filter(|c| !c.is_empty());
            (
                alt.unwrap_or(0.0),
                json!({
                    "callsign": callsign,
                    "origin_country": s.get(2).cloned().unwrap_or(Value::Null),
                    "altitude_m": alt.map(|a| a.round()),
                    "speed_kmh": speed_kmh,
                }),
            )
        })
        .collect();
    flights.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    let top: Vec<Value> = flights.into_iter().take(3).map(|(_, v)| v).collect();
    json!({ "flights": top }).to_string()
}
