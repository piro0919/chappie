// Battery percent / state / time-remaining for the get_battery_status tool.
//
// macOS parses `pmset -g batt`; Windows reads `GetSystemPowerStatus`. The
// `BatteryStatus` shape is shared so the tool handler doesn't branch.

use serde::Serialize;

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

#[cfg(target_os = "macos")]
mod imp {
    // Parses `pmset -g batt`. Output looks like:
    //   Now drawing from 'Battery Power'
    //    -InternalBattery-0 (id=12345)\t84%; discharging; 3:21 remaining present: true
    // or for desktops without a battery:
    //   Now drawing from 'AC Power'
    // (no InternalBattery line).
    use super::BatteryStatus;
    use std::process::Command;

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

        let power_source = text.lines().find_map(|l| {
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
}

#[cfg(target_os = "windows")]
mod imp {
    use super::BatteryStatus;
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

    // SYSTEM_POWER_STATUS sentinel values (winbase.h).
    const AC_ONLINE: u8 = 1;
    const BATTERY_FLAG_NO_SYSTEM_BATTERY: u8 = 128;
    const BATTERY_FLAG_CHARGING: u8 = 8;
    const PERCENT_UNKNOWN: u8 = 255;
    const LIFETIME_UNKNOWN: u32 = u32::MAX;

    /// Seconds → "H:MM" the way pmset prints the remaining estimate.
    fn fmt_remaining(secs: u32) -> Option<String> {
        if secs == LIFETIME_UNKNOWN || secs == 0 {
            return None;
        }
        let h = secs / 3600;
        let m = (secs % 3600) / 60;
        Some(format!("{h}:{m:02}"))
    }

    pub fn status() -> Result<BatteryStatus, String> {
        let mut sps = SYSTEM_POWER_STATUS::default();
        unsafe {
            GetSystemPowerStatus(&mut sps).map_err(|e| format!("GetSystemPowerStatus: {e}"))?;
        }

        let is_plugged_in = sps.ACLineStatus == AC_ONLINE;
        let has_battery = sps.BatteryFlag & BATTERY_FLAG_NO_SYSTEM_BATTERY == 0;
        let is_charging = sps.BatteryFlag & BATTERY_FLAG_CHARGING != 0;
        let percent = if sps.BatteryLifePercent <= 100 {
            Some(sps.BatteryLifePercent)
        } else {
            None
        };
        let _ = PERCENT_UNKNOWN; // documented sentinel; percent maps it to None above.

        let power_source = Some(
            if is_plugged_in {
                "AC Power"
            } else {
                "Battery Power"
            }
            .to_string(),
        );

        if !has_battery {
            return Ok(BatteryStatus {
                has_battery: false,
                percent: None,
                state: None,
                time_remaining: None,
                power_source,
                is_plugged_in,
                is_charging: false,
                is_full: false,
            });
        }

        let is_full = is_plugged_in && !is_charging && percent == Some(100);
        let state = Some(
            if is_charging {
                "charging"
            } else if is_full {
                "charged"
            } else if is_plugged_in {
                "not charging"
            } else {
                "discharging"
            }
            .to_string(),
        );
        // Time-remaining is only meaningful while running on battery.
        let time_remaining = if is_plugged_in {
            None
        } else {
            fmt_remaining(sps.BatteryLifeTime)
        };

        Ok(BatteryStatus {
            has_battery: true,
            percent,
            state,
            time_remaining,
            power_source,
            is_plugged_in,
            is_charging,
            is_full,
        })
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    use super::BatteryStatus;
    pub fn status() -> Result<BatteryStatus, String> {
        Err("battery status is not supported on this platform".into())
    }
}

pub use imp::status;
