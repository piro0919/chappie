// Ad-hoc signed app + macOS TCC interaction: every release builds with a
// fresh cdhash, but TCC records permission grants under `{bundle ID,
// cdhash}`. After auto-update, the new binary doesn't match the granted
// cdhash and the permission silently "ghosts" — the System Settings
// toggle still shows ON, but the actual call returns nothing useful.
//
// Screen Recording is the worst offender (no re-prompt path; the user
// has to remove the app from the Privacy list and re-add it). Mic and
// Calendar self-heal via requestAccess, but Mic in particular has been
// observed to silently die after auto-update too (the "auto-update mic
// silence" bug).
//
// `tccutil reset <Service> <bundle_id>` wipes all records for that
// bundle ID (regardless of cdhash), forcing the system back to
// "not determined" so the next requestAccess produces a fresh prompt.
// It doesn't need sudo for user-scope TCC services.
//
// This module compares the running version against a stored "last seen
// version" file and, on detected upgrade, resets the three permissions
// we care about. It's a noop on first install and on re-launches of the
// same version.

use std::path::PathBuf;
use std::process::Command;

const SERVICES: &[&str] = &["ScreenCapture", "Calendar", "Microphone"];

fn state_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".chappie").join("last_seen_version.txt"))
}

fn read_last_seen() -> Option<String> {
    let p = state_path()?;
    std::fs::read_to_string(&p).ok().map(|s| s.trim().to_string())
}

fn write_last_seen(version: &str) {
    let Some(p) = state_path() else { return };
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&p, version);
}

#[cfg(target_os = "macos")]
fn reset_one(service: &str, bundle_id: &str) {
    let result = Command::new("tccutil")
        .args(["reset", service, bundle_id])
        .output();
    match result {
        Ok(out) if out.status.success() => {
            eprintln!("[tcc-reset] {service} cleared for {bundle_id}");
        }
        Ok(out) => {
            // Common cause: TCC service name not recognized on this macOS
            // version (e.g. old macOS without "Microphone" alias). Log but
            // don't fail — the user can still grant manually.
            let stderr = String::from_utf8_lossy(&out.stderr);
            eprintln!(
                "[tcc-reset] {service} reset returned status {}: {}",
                out.status, stderr
            );
        }
        Err(e) => {
            eprintln!("[tcc-reset] {service} reset failed to spawn: {e}");
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn reset_one(_service: &str, _bundle_id: &str) {}

/// Compare the running version against the last-seen file and, if the
/// version changed (or there's no record yet but the file existed —
/// meaning a previous Chappie ran but didn't track its version), reset
/// the TCC entries for our bundle. Writes the current version on every
/// call so subsequent launches with the same version are no-ops.
pub fn reset_on_upgrade(bundle_id: &str, current_version: &str) {
    let prev = read_last_seen();
    match prev.as_deref() {
        // Brand-new install — no upgrade to handle. Just record so the
        // *next* upgrade can detect a delta.
        None => {
            write_last_seen(current_version);
            return;
        }
        Some(p) if p == current_version => {
            // Same version, nothing to do.
            return;
        }
        Some(p) => {
            eprintln!(
                "[tcc-reset] detected upgrade {p} -> {current_version}; resetting TCC for {bundle_id}"
            );
        }
    }
    for svc in SERVICES {
        reset_one(svc, bundle_id);
    }
    write_last_seen(current_version);
}
