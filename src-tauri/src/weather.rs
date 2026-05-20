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

/// Minimal "current conditions" snapshot used by callers that need
/// structured data instead of the user-facing formatted forecast
/// (e.g. proactive weather alerts comparing current vs. prior state).
/// Always fetches via the same Open-Meteo endpoint so behavior matches
/// `lookup_by_coords`.
pub struct CurrentSnapshot {
    pub weather_code: u32,
    pub temp_c: f64,
}

pub async fn current_snapshot(lat: f64, lon: f64) -> Result<CurrentSnapshot, String> {
    let fc_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code&timezone=auto",
    );
    let fc: ForecastResp = HTTP
        .get(&fc_url)
        .send()
        .await
        .map_err(|e| format!("snapshot request: {e}"))?
        .json()
        .await
        .map_err(|e| format!("snapshot decode: {e}"))?;
    let c = fc.current.ok_or("no current weather in response")?;
    Ok(CurrentSnapshot {
        weather_code: c.weather_code.unwrap_or(0),
        temp_c: c.temperature_2m.unwrap_or(0.0),
    })
}

/// Localized name for a weather code. Re-exports `weather_code_to_jp`
/// under a stable public name so callers (proactive alerts) don't have
/// to reach into private helpers.
pub fn weather_code_label(code: u32) -> &'static str {
    weather_code_to_jp(code)
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

/// Open-Meteo's geocoder doesn't match Japanese place names that carry an
/// administrative suffix (`板橋区` finds nothing, `板橋` finds it). Strip a
/// single trailing 区/市/町/村 (or 特別区) so we can retry. Returns `None` when
/// there's nothing to strip — caller should not bother retrying then.
fn strip_jp_admin_suffix(name: &str) -> Option<String> {
    let trimmed = name.trim();
    for suffix in ["特別区", "区", "市", "町", "村"] {
        if let Some(base) = trimmed.strip_suffix(suffix) {
            if !base.is_empty() {
                return Some(base.to_string());
            }
        }
    }
    None
}

async fn geocode_one(name: &str) -> Result<Option<GeoHit>, String> {
    let geo_url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=ja&format=json",
        urlencoding::encode(name)
    );
    let geo: GeoResp = HTTP
        .get(&geo_url)
        .send()
        .await
        .map_err(|e| format!("geocoding request: {e}"))?
        .json()
        .await
        .map_err(|e| format!("geocoding decode: {e}"))?;
    Ok(geo.results.and_then(|v| v.into_iter().next()))
}

pub async fn lookup(location: &str) -> Result<String, String> {
    if location.trim().is_empty() {
        return Err("location is empty".into());
    }
    let mut hit = geocode_one(location).await?;
    // Fallback: retry once with the admin suffix stripped (板橋区 → 板橋).
    if hit.is_none() {
        if let Some(base) = strip_jp_admin_suffix(location) {
            hit = geocode_one(&base).await?;
        }
    }
    let hit = hit.ok_or_else(|| format!("no location matched \"{location}\""))?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_single_admin_suffix() {
        assert_eq!(strip_jp_admin_suffix("板橋区").as_deref(), Some("板橋"));
        assert_eq!(strip_jp_admin_suffix("横浜市").as_deref(), Some("横浜"));
        assert_eq!(strip_jp_admin_suffix("軽井沢町").as_deref(), Some("軽井沢"));
        assert_eq!(strip_jp_admin_suffix("白川村").as_deref(), Some("白川"));
    }

    #[test]
    fn prefers_tokubetsu_ku_over_bare_ku() {
        // "特別区" is checked first, so the full token is removed in one pass
        // rather than leaving a stray "特別".
        assert_eq!(strip_jp_admin_suffix("名古屋特別区").as_deref(), Some("名古屋"));
    }

    #[test]
    fn leaves_names_without_suffix_untouched() {
        assert_eq!(strip_jp_admin_suffix("渋谷"), None);
        assert_eq!(strip_jp_admin_suffix("Tokyo"), None);
    }

    #[test]
    fn never_strips_to_empty() {
        assert_eq!(strip_jp_admin_suffix("区"), None);
        assert_eq!(strip_jp_admin_suffix("市"), None);
    }

    #[test]
    fn formats_current_and_two_day_forecast() {
        let fc = ForecastResp {
            current: Some(Current {
                temperature_2m: Some(17.34),
                weather_code: Some(3),
                wind_speed_10m: Some(2.5),
            }),
            daily: Some(Daily {
                temperature_2m_max: vec![18.0, 20.0],
                temperature_2m_min: vec![9.0, 11.0],
                weather_code: vec![3, 61],
                precipitation_probability_max: Some(vec![10, 80]),
            }),
        };
        let out = format_forecast("板橋 (日本)", &fc);
        assert_eq!(
            out,
            "[板橋 (日本)]\n\
             現在: 曇り, 17.3℃, 風速 2.5m/s\n\
             今日: 曇り, 最高 18.0℃ / 最低 9.0℃, 降水確率 10%\n\
             明日: 弱い雨, 最高 20.0℃ / 最低 11.0℃, 降水確率 80%"
        );
    }

    #[test]
    fn formats_with_missing_optional_fields() {
        // No current block, single forecast day, and no precipitation array.
        let fc = ForecastResp {
            current: None,
            daily: Some(Daily {
                temperature_2m_max: vec![15.0],
                temperature_2m_min: vec![5.0],
                weather_code: vec![0],
                precipitation_probability_max: None,
            }),
        };
        let out = format_forecast("渋谷", &fc);
        assert_eq!(out, "[渋谷]\n今日: 快晴, 最高 15.0℃ / 最低 5.0℃");
    }
}
