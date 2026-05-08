// macOS system volume controls via osascript. Three thin shells:
//   - get(): read current output volume + mute state
//   - set_level(0-100): set absolute output volume
//   - set_muted(bool): set output muted flag
// We use osascript because AppKit/CoreAudio bindings would require objc2 +
// AudioToolbox plumbing for a feature that doesn't need that level of
// precision; "set volume output volume N" is officially supported AppleScript.

use std::process::Command;

pub struct VolumeState {
    pub level: u8,
    pub muted: bool,
}

fn run_osascript(script: &str) -> Result<String, String> {
    let out = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

pub fn get() -> Result<VolumeState, String> {
    let level_s = run_osascript("output volume of (get volume settings)")?;
    let muted_s = run_osascript("output muted of (get volume settings)")?;
    let level: u8 = level_s
        .parse()
        .map_err(|e| format!("parse level {level_s:?}: {e}"))?;
    let muted = muted_s == "true";
    Ok(VolumeState { level, muted })
}

pub fn set_level(level: u8) -> Result<(), String> {
    let level = level.min(100);
    run_osascript(&format!("set volume output volume {level}")).map(|_| ())
}

pub fn set_muted(muted: bool) -> Result<(), String> {
    run_osascript(&format!(
        "set volume output muted {}",
        if muted { "true" } else { "false" }
    ))
    .map(|_| ())
}

#[tauri::command]
pub fn is_muted() -> Result<bool, String> {
    get().map(|v| v.muted)
}
