// Aurora / space-weather outlook via NOAA SWPC (no key). The planetary
// K-index forecast feed carries both recently observed and predicted Kp
// values, so one fetch covers "how active is it now" and "could I see
// aurora tonight". We pair the Kp outlook with the user's latitude to
// give an honest visibility hint — at Tokyo's ~35°N you essentially
// never see aurora, and pretending otherwise would be a lie.

use serde::Deserialize;
use serde_json::{json, Value};

pub fn tools() -> Vec<Value> {
    vec![json!({
        "type": "function",
        "function": {
            "name": "mcp_aurora_forecast",
            "description": "オーロラ・宇宙天気の見通しを返す。「今夜オーロラ見える？」「オーロラの予報は？」「磁気嵐きてる？」。NOAA の Kp 指数（地磁気活動の強さ、0-9）の現在値と今後の予測最大値、ユーザーの緯度をふまえた可視性のヒントを返す。引数なし。",
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
        "forecast" => forecast(args).await,
        other => json!({ "error": format!("unknown aurora tool: {}", other) }).to_string(),
    }
}

#[derive(Deserialize)]
struct KpRow {
    kp: f64,
    observed: String,
}

async fn forecast(_args: &Value) -> String {
    let url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
    let res = match super::HTTP.get(url).send().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("swpc request: {e}") }).to_string(),
    };
    if !res.status().is_success() {
        return json!({ "error": format!("http {}", res.status().as_u16()) }).to_string();
    }
    let rows: Vec<KpRow> = match res.json().await {
        Ok(r) => r,
        Err(e) => return json!({ "error": format!("swpc decode: {e}") }).to_string(),
    };

    // Latest observed Kp = the most recent row tagged "observed".
    let current_kp = rows
        .iter()
        .filter(|r| r.observed == "observed")
        .next_back()
        .map(|r| r.kp);
    // Outlook = highest predicted Kp still ahead of us.
    let max_forecast_kp = rows
        .iter()
        .filter(|r| r.observed == "predicted")
        .map(|r| r.kp)
        .fold(f64::MIN, f64::max);
    let max_forecast_kp = if max_forecast_kp == f64::MIN {
        None
    } else {
        Some(max_forecast_kp)
    };

    let lat = crate::location::cached().map(|l| l.latitude);
    let peak = max_forecast_kp.or(current_kp);
    let hint = visibility_hint(lat, peak);

    json!({
        "current_kp": current_kp,
        "max_forecast_kp": max_forecast_kp,
        "user_latitude": lat,
        "hint": hint,
    })
    .to_string()
}

/// Rough rule of thumb: aurora becomes visible at progressively lower
/// magnetic latitudes as Kp climbs. We approximate the equatorward edge
/// of the auroral oval by geographic latitude (good enough for a spoken
/// "probably not / maybe / good chance"). Without a known latitude we
/// stay non-committal.
fn visibility_hint(lat: Option<f64>, peak_kp: Option<f64>) -> &'static str {
    let (Some(lat), Some(kp)) = (lat, peak_kp) else {
        return "緯度が分からないため可視性は判断できません。Kp 指数の数値で活動度を伝えてください。";
    };
    let abs = lat.abs();
    // Approximate equatorward visibility latitude per Kp level.
    let needed = match kp {
        k if k >= 9.0 => 48.0,
        k if k >= 8.0 => 50.0,
        k if k >= 7.0 => 52.0,
        k if k >= 6.0 => 54.0,
        k if k >= 5.0 => 58.0,
        k if k >= 4.0 => 62.0,
        _ => 66.0,
    };
    if abs >= needed {
        "現在地の緯度なら見られる可能性があります。空の暗い場所で極方向を確認するとよいです。"
    } else if abs >= needed - 5.0 {
        "現在地の緯度では条件次第でかすかに見える程度。期待は控えめに。"
    } else {
        "現在地の緯度ではまず見られません（日本など中緯度では極端な磁気嵐のときだけ）。"
    }
}
