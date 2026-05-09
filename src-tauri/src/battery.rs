// Parses `pmset -g batt` to surface battery percent / state / time-remaining.
// Output looks like:
//   Now drawing from 'Battery Power'
//    -InternalBattery-0 (id=12345)\t84%; discharging; 3:21 remaining present: true
// or for desktops without a battery:
//   Now drawing from 'AC Power'
// (no InternalBattery line).

use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct BatteryStatus {
    pub has_battery: bool,
    pub percent: Option<u8>,
    pub state: Option<String>,
    pub time_remaining: Option<String>,
    pub power_source: Option<String>,
    pub is_plugged_in: bool,
    pub is_charging: bool,
    pub is_full: bool,
}

pub fn status() -> Result<BatteryStatus, String> {
    let out = Command::new("pmset")
        .args(["-g", "batt"])
        .output()
        .map_err(|e| format!("pmset spawn: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "pmset exited {}: {}",
            out.status,
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    let text = String::from_utf8_lossy(&out.stdout).into_owned();

    let power_source = text
        .lines()
        .find_map(|l| {
            l.trim()
                .strip_prefix("Now drawing from '")
                .and_then(|s| s.strip_suffix("'"))
                .map(|s| s.to_string())
        });

    let battery_line = text.lines().find(|l| l.contains("InternalBattery"));
    let is_plugged_in_top = power_source
        .as_deref()
        .map(|s| s.eq_ignore_ascii_case("AC Power"))
        .unwrap_or(false);

    let Some(line) = battery_line else {
        return Ok(BatteryStatus {
            has_battery: false,
            percent: None,
            state: None,
            time_remaining: None,
            power_source,
            is_plugged_in: is_plugged_in_top,
            is_charging: false,
            is_full: false,
        });
    };

    let after_tab = line.split('\t').nth(1).unwrap_or(line);
    let parts: Vec<&str> = after_tab.split(';').map(|s| s.trim()).collect();

    let percent = parts
        .first()
        .and_then(|s| s.trim_end_matches('%').parse::<u8>().ok());
    let state = parts.get(1).map(|s| s.to_string());
    let time_remaining = parts.get(2).and_then(|s| {
        let token = s.split_whitespace().next()?;
        if token == "(no" || token == "0:00" {
            None
        } else if token.contains(':') {
            Some(token.to_string())
        } else {
            None
        }
    });

    let state_lower = state.as_deref().unwrap_or("").to_ascii_lowercase();
    let is_charging = state_lower.contains("charging") && !state_lower.contains("not charging")
        || state_lower.contains("finishing charge");
    let is_full = state_lower.contains("charged")
        || (is_plugged_in_top && percent == Some(100))
        || state_lower.contains("not charging") && is_plugged_in_top;

    Ok(BatteryStatus {
        has_battery: true,
        percent,
        state,
        time_remaining,
        power_source,
        is_plugged_in: is_plugged_in_top,
        is_charging,
        is_full,
    })
}
