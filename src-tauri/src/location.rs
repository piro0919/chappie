// Geolocation for grounding casual chat in the user's approximate
// location. Two-tier:
//
//   1. macOS CoreLocation via `location_native.rs` — Wi-Fi-based fix
//      with ~30-100 m accuracy. Requires the user to grant location
//      permission. Necessary because IP-based lookups in Japan resolve
//      most consumer ISPs (NTT, SoftBank, etc.) to Tokyo regardless of
//      where the user actually is — so an Aichi user gets weather for
//      Tokyo without this path.
//
//   2. IP-based via ipwho.is keyless tier — always available, city-level
//      precision, and good enough when the user hasn't granted location
//      permission or CoreLocation timed out.
//
// Results from either path are cached in-process for 30 minutes.

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

static HTTP: Lazy<reqwest::Client> =
    Lazy::new(|| crate::http::build_client(Some(8), None));

pub async fn get(force_refresh: bool) -> Result<UserLocation, String> {
    if !force_refresh {
        if let Some((loc, t)) = CACHE.lock().unwrap().as_ref() {
            if t.elapsed() < TTL {
                return Ok(loc.clone());
            }
        }
    }
    // Try CoreLocation first when authorized. We never trigger the
    // permission prompt here — that's done explicitly from Settings.
    #[cfg(target_os = "macos")]
    {
        if let Ok(status) = crate::location_native::check_permission() {
            if status == "granted" {
                let native = tokio::task::spawn_blocking(crate::location_native::get_location).await;
                if let Ok(Ok((lat, lon, locality))) = native {
                    let resp = UserLocation {
                        city: locality,
                        region: None,
                        country_name: None,
                        latitude: lat,
                        longitude: lon,
                        timezone: None,
                    };
                    *CACHE.lock().unwrap() = Some((resp.clone(), Instant::now()));
                    return Ok(resp);
                }
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
