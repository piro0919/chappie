// World clock: "ロンドン今何時?" / "what time is it in New York?".
// get_current_time only knows the user's local time; this fills the gap
// for other cities. We geocode the place through Open-Meteo (which
// returns an IANA timezone for each hit), then compute the wall-clock
// time there with chrono-tz. No dedicated time API needed.

use chrono::Utc;
use chrono_tz::Tz;
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
struct GeoResp {
    results: Option<Vec<GeoHit>>,
}

#[derive(Deserialize)]
struct GeoHit {
    name: String,
    country: Option<String>,
    timezone: Option<String>,
}

pub async fn lookup(location: &str) -> Result<String, String> {
    let loc = location.trim();
    if loc.is_empty() {
        return Err("location is empty".into());
    }
    let url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=ja&format=json",
        urlencoding::encode(loc)
    );
    let geo: GeoResp = crate::mcp::HTTP
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
    let tz_name = hit
        .timezone
        .ok_or_else(|| "no timezone for that location".to_string())?;
    let tz: Tz = tz_name
        .parse()
        .map_err(|_| format!("unknown timezone: {tz_name}"))?;

    let now = Utc::now().with_timezone(&tz);
    let place = match &hit.country {
        Some(c) => format!("{} ({})", hit.name, c),
        None => hit.name.clone(),
    };

    Ok(json!({
        "place": place,
        "timezone": tz_name,
        "time": now.format("%H:%M").to_string(),
        "date": now.format("%Y-%m-%d").to_string(),
        "weekday": now.format("%A").to_string(),
        "utc_offset": now.format("%:z").to_string(),
    })
    .to_string())
}
