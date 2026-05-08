// IP-based geolocation for grounding casual chat in the user's
// approximate location. Uses ipapi.co's keyless free tier; results are
// cached in-process for 30 minutes. This is a city-level approximation —
// VPNs / mobile networks may report further away. A native CoreLocation
// path is the planned upgrade for higher precision.

use once_cell::sync::Lazy;
use serde::Deserialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Deserialize)]
struct IpwhoIsResp {
    success: bool,
    message: Option<String>,
    city: Option<String>,
    region: Option<String>,
    country: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    timezone: Option<TimezoneObj>,
}

#[derive(Debug, Clone, Deserialize)]
struct TimezoneObj {
    id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UserLocation {
    pub city: Option<String>,
    pub region: Option<String>,
    pub country_name: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: Option<String>,
}

static CACHE: Lazy<Mutex<Option<(UserLocation, Instant)>>> =
    Lazy::new(|| Mutex::new(None));
const TTL: Duration = Duration::from_secs(30 * 60);

static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .expect("failed to build reqwest client")
});

pub async fn get(force_refresh: bool) -> Result<UserLocation, String> {
    if !force_refresh {
        if let Some((loc, t)) = CACHE.lock().unwrap().as_ref() {
            if t.elapsed() < TTL {
                return Ok(loc.clone());
            }
        }
    }
    let raw: IpwhoIsResp = HTTP
        .get("https://ipwho.is/")
        .send()
        .await
        .map_err(|e| format!("ip request: {e}"))?
        .json()
        .await
        .map_err(|e| format!("ip decode: {e}"))?;
    if !raw.success {
        return Err(format!(
            "ip lookup failed: {}",
            raw.message.unwrap_or_else(|| "unknown".into())
        ));
    }
    let lat = raw
        .latitude
        .ok_or_else(|| "ip lookup missing latitude".to_string())?;
    let lon = raw
        .longitude
        .ok_or_else(|| "ip lookup missing longitude".to_string())?;
    let resp = UserLocation {
        city: raw.city,
        region: raw.region,
        country_name: raw.country,
        latitude: lat,
        longitude: lon,
        timezone: raw.timezone.and_then(|t| t.id),
    };
    *CACHE.lock().unwrap() = Some((resp.clone(), Instant::now()));
    Ok(resp)
}

pub fn cached() -> Option<UserLocation> {
    CACHE.lock().unwrap().as_ref().map(|(loc, _)| loc.clone())
}

pub fn format_for_prompt(loc: &UserLocation) -> String {
    let mut parts = Vec::new();
    if let Some(c) = &loc.city {
        parts.push(c.clone());
    }
    if let Some(r) = &loc.region {
        if loc.city.as_ref() != Some(r) {
            parts.push(r.clone());
        }
    }
    if let Some(c) = &loc.country_name {
        parts.push(c.clone());
    }
    if parts.is_empty() {
        format!("緯度 {:.2}, 経度 {:.2}", loc.latitude, loc.longitude)
    } else {
        parts.join(", ")
    }
}
