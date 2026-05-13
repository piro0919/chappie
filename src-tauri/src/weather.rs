// Weather lookup via Open-Meteo. No API key required.
// Two entry points:
//  - lookup(name)             — geocode a city name, then forecast by coords
//  - lookup_by_coords(lat,lon, label, tz?) — direct, used when we already
//    have the user's coordinates from IP-based location

use once_cell::sync::Lazy;
use serde::Deserialize;

static HTTP: Lazy<reqwest::Client> =
    Lazy::new(|| crate::http::build_client(Some(15), None));

#[derive(Deserialize)]
struct GeoResp {
    results: Option<Vec<GeoHit>>,
}

#[derive(Deserialize)]
struct GeoHit {
    name: String,
    country: Option<String>,
    latitude: f64,
    longitude: f64,
    timezone: Option<String>,
}

#[derive(Deserialize)]
struct ForecastResp {
    current: Option<Current>,
    daily: Option<Daily>,
}

#[derive(Deserialize)]
struct Current {
    temperature_2m: Option<f64>,
    weather_code: Option<u32>,
    wind_speed_10m: Option<f64>,
}

#[derive(Deserialize)]
struct Daily {
    temperature_2m_max: Vec<f64>,
    temperature_2m_min: Vec<f64>,
    weather_code: Vec<u32>,
    precipitation_probability_max: Option<Vec<u32>>,
}

fn weather_code_to_jp(code: u32) -> &'static str {
    match code {
        0 => "快晴",
        1 => "晴れ（おおむね晴れ）",
        2 => "晴れ時々曇り",
        3 => "曇り",
        45 | 48 => "霧",
        51 | 53 | 55 => "霧雨",
        56 | 57 => "凍る霧雨",
        61 => "弱い雨",
        63 => "雨",
        65 => "強い雨",
        66 | 67 => "凍る雨",
        71 => "弱い雪",
        73 => "雪",
        75 => "強い雪",
        77 => "霧雪",
        80 => "弱いにわか雨",
        81 => "にわか雨",
        82 => "強いにわか雨",
        85 | 86 => "にわか雪",
        95 => "雷雨",
        96 | 99 => "雹を伴う雷雨",
        _ => "不明",
    }
}

fn format_forecast(place: &str, fc: &ForecastResp) -> String {
    let mut out = format!("[{place}]\n");
    if let Some(c) = fc.current.as_ref() {
        let temp = c
            .temperature_2m
            .map(|t| format!("{t:.1}℃"))
            .unwrap_or_else(|| "?".into());
        let cond = c.weather_code.map(weather_code_to_jp).unwrap_or("不明");
        let wind = c
            .wind_speed_10m
            .map(|w| format!("{w:.1}m/s"))
            .unwrap_or_else(|| "?".into());
        out.push_str(&format!("現在: {cond}, {temp}, 風速 {wind}\n"));
    }
    if let Some(d) = fc.daily.as_ref() {
        for (i, label) in ["今日", "明日"].iter().enumerate() {
            if i >= d.temperature_2m_max.len() {
                break;
            }
            let max = d.temperature_2m_max[i];
            let min = d.temperature_2m_min[i];
            let cond = d
                .weather_code
                .get(i)
                .copied()
                .map(weather_code_to_jp)
                .unwrap_or("不明");
            let pop = d
                .precipitation_probability_max
                .as_ref()
                .and_then(|v| v.get(i).copied())
                .map(|p| format!(", 降水確率 {p}%"))
                .unwrap_or_default();
            out.push_str(&format!(
                "{label}: {cond}, 最高 {max:.1}℃ / 最低 {min:.1}℃{pop}\n"
            ));
        }
    }
    out.trim_end().to_string()
}

pub async fn lookup_by_coords(
    lat: f64,
    lon: f64,
    place_label: &str,
    timezone: Option<&str>,
) -> Result<String, String> {
    let tz = timezone.unwrap_or("auto");
    let fc_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone={tz}&forecast_days=2",
        tz = urlencoding::encode(tz),
    );
    let fc: ForecastResp = HTTP
        .get(&fc_url)
        .send()
        .await
        .map_err(|e| format!("forecast request: {e}"))?
        .json()
        .await
        .map_err(|e| format!("forecast decode: {e}"))?;
    Ok(format_forecast(place_label, &fc))
}

pub async fn lookup(location: &str) -> Result<String, String> {
    if location.trim().is_empty() {
        return Err("location is empty".into());
    }
    let geo_url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=ja&format=json",
        urlencoding::encode(location)
    );
    let geo: GeoResp = HTTP
        .get(&geo_url)
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
    lookup_by_coords(
        hit.latitude,
        hit.longitude,
        &place,
        hit.timezone.as_deref(),
    )
    .await
}
