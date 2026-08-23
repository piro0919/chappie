// SwitchBot Cloud API v1.1 client — "voice → physical world" control.
//
// Lets the user drive real SwitchBot devices (lights, plugs, curtains,
// locks, IR-blasted AC, …) by voice: "リビングの電気つけて" → turnOn.
// This is the differentiation axis Alexa/Siri own on hardware but no Mac
// tray app touches — see the visual/physical-impact design note.
//
// Credentials are the user's own (free for personal use). Token + secret
// come from the SwitchBot app's Developer Options and live in the login
// Keychain (see secrets.rs); we read them here so the secret never rides
// the renderer's per-call path. Nothing works until the user enters both.
//
// Auth (official v1.1): every request carries
//   Authorization: <token>
//   t:     13-digit epoch milliseconds
//   nonce: a random UUID
//   sign:  Base64( HMAC-SHA256( token + t + nonce , secret ) )
// The official Python/Java samples do NOT upper-case the Base64 sign (only
// the Go sample does); we follow the primary samples. If the live API ever
// rejects with 401, flipping SIGN_UPPERCASE is the one-line escape hatch.

use base64::Engine;
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

const HOST: &str = "https://api.switch-bot.com";
const TOKEN_KEY: &str = "switchbotToken";
const SECRET_KEY: &str = "switchbotSecret";
/// The official Python/Java reference samples leave the Base64 sign as-is.
/// Set true only if the live API rejects requests with 401 unauthorized.
const SIGN_UPPERCASE: bool = false;

static HTTP: once_cell::sync::Lazy<reqwest::Client> =
    once_cell::sync::Lazy::new(|| crate::http::build_client(Some(20), None));

struct Creds {
    token: String,
    secret: String,
}

/// A controllable device, flattened from both `deviceList` (physical) and
/// `infraredRemoteList` (IR virtual remotes behind a Hub).
#[derive(Clone)]
pub struct Device {
    pub id: String,
    pub name: String,
    /// `deviceType` for physical devices, `remoteType` for IR remotes.
    pub kind: String,
    pub is_infrared: bool,
}

fn read_creds(_app: &tauri::AppHandle) -> Option<Creds> {
    Some(Creds {
        token: crate::secrets::get(TOKEN_KEY)?,
        secret: crate::secrets::get(SECRET_KEY)?,
    })
}

pub fn is_configured(app: &tauri::AppHandle) -> bool {
    read_creds(app).is_some()
}

/// Build the (sign, t, nonce) triple for a request. `t` is epoch ms.
fn sign(creds: &Creds) -> (String, String, String) {
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
        .to_string();
    let nonce = uuid::Uuid::new_v4().to_string();
    let sign = sign_with(&creds.token, &creds.secret, &t, &nonce);
    (sign, t, nonce)
}

/// Pure signing function, split out so it can be unit-tested against a
/// known vector without any clock/UUID nondeterminism.
fn sign_with(token: &str, secret: &str, t: &str, nonce: &str) -> String {
    let data = format!("{token}{t}{nonce}");
    let mut mac =
        Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts keys of any size");
    mac.update(data.as_bytes());
    let raw = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
    if SIGN_UPPERCASE {
        raw.to_uppercase()
    } else {
        raw
    }
}

fn apply_auth(req: reqwest::RequestBuilder, creds: &Creds) -> reqwest::RequestBuilder {
    let (sign, t, nonce) = sign(creds);
    req.header("Authorization", &creds.token)
        .header("sign", sign)
        .header("t", t)
        .header("nonce", nonce)
        .header("Content-Type", "application/json; charset=utf-8")
}

/// GET /v1.1/devices → flattened controllable device list.
pub async fn list_devices(app: &tauri::AppHandle) -> Result<Vec<Device>, String> {
    let creds = read_creds(app).ok_or("not_configured")?;
    let url = format!("{HOST}/v1.1/devices");
    let resp = apply_auth(HTTP.get(&url), &creds)
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;
    let status = resp.status();
    let body: Value = resp.json().await.map_err(|e| format!("json: {e}"))?;
    if !status.is_success() || body.get("statusCode").and_then(|c| c.as_i64()) != Some(100) {
        return Err(format!(
            "switchbot api: status={} code={:?} msg={:?}",
            status.as_u16(),
            body.get("statusCode"),
            body.get("message")
        ));
    }
    let mut out = Vec::new();
    let b = body.get("body");
    if let Some(list) = b
        .and_then(|b| b.get("deviceList"))
        .and_then(|v| v.as_array())
    {
        for d in list {
            if let (Some(id), Some(name)) = (
                d.get("deviceId").and_then(|v| v.as_str()),
                d.get("deviceName").and_then(|v| v.as_str()),
            ) {
                out.push(Device {
                    id: id.to_string(),
                    name: name.to_string(),
                    kind: d
                        .get("deviceType")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    is_infrared: false,
                });
            }
        }
    }
    if let Some(list) = b
        .and_then(|b| b.get("infraredRemoteList"))
        .and_then(|v| v.as_array())
    {
        for d in list {
            if let (Some(id), Some(name)) = (
                d.get("deviceId").and_then(|v| v.as_str()),
                d.get("deviceName").and_then(|v| v.as_str()),
            ) {
                out.push(Device {
                    id: id.to_string(),
                    name: name.to_string(),
                    kind: d
                        .get("remoteType")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    is_infrared: true,
                });
            }
        }
    }
    Ok(out)
}

/// POST a control command to a device. Returns Ok on statusCode 100.
pub async fn send_command(
    app: &tauri::AppHandle,
    device_id: &str,
    command: &str,
    parameter: &str,
    command_type: &str,
) -> Result<(), String> {
    let creds = read_creds(app).ok_or("not_configured")?;
    let url = format!("{HOST}/v1.1/devices/{device_id}/commands");
    let payload = json!({
        "command": command,
        "parameter": parameter,
        "commandType": command_type,
    });
    let resp = apply_auth(HTTP.post(&url), &creds)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;
    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    if status.is_success() && body.get("statusCode").and_then(|c| c.as_i64()) == Some(100) {
        Ok(())
    } else {
        Err(format!(
            "switchbot command failed: status={} code={:?} msg={:?}",
            status.as_u16(),
            body.get("statusCode"),
            body.get("message")
        ))
    }
}

/// Resolve a spoken device name to a device. Voice transcripts won't match
/// the registered name exactly, so: case-fold, then prefer exact, then
/// bidirectional substring (query in name OR name in query), then a loose
/// token-overlap fallback. Returns None if nothing is close.
pub fn resolve_device<'a>(devices: &'a [Device], query: &str) -> Option<&'a Device> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return None;
    }
    let norm = |s: &str| s.to_lowercase();
    // Exact (case-folded).
    if let Some(d) = devices.iter().find(|d| norm(&d.name) == q) {
        return Some(d);
    }
    // Bidirectional substring.
    if let Some(d) = devices
        .iter()
        .find(|d| norm(&d.name).contains(&q) || q.contains(&norm(&d.name)))
    {
        return Some(d);
    }
    // Loose: any device whose name shares a 2+ char run with the query.
    devices.iter().find(|d| {
        let n = norm(&d.name);
        n.chars()
            .collect::<Vec<_>>()
            .windows(2)
            .any(|w| q.contains(&w.iter().collect::<String>()))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_matches_known_vector() {
        // Expected value computed independently with Python (the official
        // reference language), proving the Rust HMAC is byte-exact:
        //   import hmac, hashlib, base64
        //   data = "TOKEN" + "1234567890123" + "nonce-abc"
        //   base64.b64encode(hmac.new(b"SECRET", data.encode(),
        //                             hashlib.sha256).digest()).decode()
        let got = sign_with("TOKEN", "SECRET", "1234567890123", "nonce-abc");
        assert_eq!(got, "XcTkc9jMHWdDdUE891dEdZaNNWxWX7LEzjY7jz+WAhk=");
    }

    fn dev(name: &str) -> Device {
        Device {
            id: format!("id-{name}"),
            name: name.to_string(),
            kind: "Plug".into(),
            is_infrared: false,
        }
    }

    #[test]
    fn resolve_matches_loosely() {
        let devices = vec![
            dev("リビングの電気"),
            dev("寝室のエアコン"),
            dev("Bedroom Lamp"),
        ];
        assert_eq!(
            resolve_device(&devices, "リビングの電気").map(|d| d.name.as_str()),
            Some("リビングの電気")
        );
        // Substring both ways.
        assert_eq!(
            resolve_device(&devices, "リビング").map(|d| d.name.as_str()),
            Some("リビングの電気")
        );
        assert_eq!(
            resolve_device(&devices, "bedroom lamp please").map(|d| d.name.as_str()),
            Some("Bedroom Lamp")
        );
        assert!(resolve_device(&devices, "").is_none());
    }
}
