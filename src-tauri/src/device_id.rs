// Persistent per-install identifier for Free mode quota tracking.
//
// On macOS the id is derived deterministically from `IOPlatformUUID` —
// the hardware-bound identifier exposed by ioreg — via UUIDv5 with an
// app-specific namespace. This means:
//
//   - Deleting `~/.chappie/device-id` no longer resets the Free-mode
//     quota; the next get_or_init re-derives the same value.
//   - The raw hardware UUID never leaves the machine (UUIDv5 = SHA-1 of
//     namespace + hardware UUID, one-way).
//   - The file is still written as a cache so subsequent reads avoid
//     spawning ioreg, and as a portable fallback for non-macOS targets.
//
// If the IOPlatformUUID lookup fails for any reason (broken `ioreg`,
// future sandboxing change), we fall back to the original UUIDv4 file
// behavior so Free mode keeps working. The previous-format ids stored
// on disk are also accepted as-is; we only re-derive when the file is
// missing or empty.
//
// Cross-device quota will still arrive with auth in Phase 3 — this is
// a hardening step, not a replacement.

use once_cell::sync::OnceCell;
use std::path::PathBuf;
use uuid::Uuid;

static CACHED: OnceCell<String> = OnceCell::new();

// Random namespace UUID for the chappie device-id derivation. Treat as
// an app-wide salt — changing it would re-roll every existing device's
// id and reset everyone's quota, so leave it alone.
const NAMESPACE: Uuid = Uuid::from_bytes([
    0x9c, 0x2e, 0x4f, 0x17, 0x6b, 0xa1, 0x4d, 0x88, 0x9e, 0xf3, 0x6a, 0x2b, 0x55, 0x8c, 0x1d, 0x90,
]);

fn path() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    let _ = std::fs::create_dir_all(&p);
    p.push("device-id");
    Some(p)
}

/// Look up the macOS hardware UUID via ioreg. Returns None on non-macOS
/// or if the lookup fails for any reason.
#[cfg(target_os = "macos")]
fn hardware_uuid() -> Option<String> {
    let out = std::process::Command::new("ioreg")
        .args(["-d2", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    parse_ioreg_output(&stdout)
}

#[cfg(not(target_os = "macos"))]
fn hardware_uuid() -> Option<String> {
    None
}

/// Pull the IOPlatformUUID value out of `ioreg -d2 -c IOPlatformExpertDevice`.
/// Format: `"IOPlatformUUID" = "AAAA-BBBB-..."`. Extracted as a separate
/// function so it can be unit-tested without spawning ioreg.
fn parse_ioreg_output(stdout: &str) -> Option<String> {
    for line in stdout.lines() {
        if !line.contains("IOPlatformUUID") {
            continue;
        }
        // Take everything after the '=' and pull out the quoted value.
        let after_eq = line.split('=').nth(1)?.trim();
        let trimmed = after_eq.trim_matches('"').trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    None
}

/// Derive a stable per-device id. On macOS this is UUIDv5(NAMESPACE,
/// IOPlatformUUID), so deleting the cached file doesn't reset it. On
/// other platforms (and on macOS when ioreg fails) this returns None
/// and the caller falls back to a stored UUIDv4.
fn derive_stable_id() -> Option<String> {
    let hw = hardware_uuid()?;
    Some(Uuid::new_v5(&NAMESPACE, hw.as_bytes()).to_string())
}

/// Return the persisted device id.
///
/// Order of preference:
///   1. In-process cache.
///   2. Existing valid file contents (preserves legacy v4 ids so
///      existing users don't lose their proxy quota state).
///   3. Hardware-derived id on macOS (UUIDv5 from IOPlatformUUID) —
///      written to the file so a subsequent delete re-derives the same
///      value instead of minting a fresh v4.
///   4. Freshly generated UUIDv4 (non-macOS, or when ioreg fails).
///
/// Hardening note: with step 3 in place, deleting `~/.chappie/device-id`
/// on macOS no longer resets the Free-mode quota — the next call
/// re-derives the same id from the hardware UUID. The legacy v4 path
/// is kept so users who already have a file don't get a one-time quota
/// reset on upgrade.
pub fn get_or_init() -> Result<String, String> {
    if let Some(v) = CACHED.get() {
        return Ok(v.clone());
    }
    let p = path().ok_or_else(|| "cannot resolve home dir".to_string())?;

    // 2. Existing valid file wins — don't perturb upgraded users.
    if p.exists() {
        if let Ok(contents) = std::fs::read_to_string(&p) {
            let trimmed = contents.trim();
            if !trimmed.is_empty() {
                let id = trimmed.to_string();
                let _ = CACHED.set(id.clone());
                return Ok(id);
            }
        }
    }

    // 3. Fresh install / corrupted file: prefer hardware-derived id
    //    on macOS so a deletion can't trivially reset the quota.
    if let Some(stable) = derive_stable_id() {
        std::fs::write(&p, &stable).map_err(|e| format!("write device-id: {e}"))?;
        let _ = CACHED.set(stable.clone());
        return Ok(stable);
    }

    // 4. Final fallback: random v4.
    let new_id = Uuid::new_v4().to_string();
    std::fs::write(&p, &new_id).map_err(|e| format!("write device-id: {e}"))?;
    let _ = CACHED.set(new_id.clone());
    Ok(new_id)
}

#[tauri::command]
pub fn get_device_id() -> Result<String, String> {
    get_or_init()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ioreg_uuid_line() {
        let stdout = r#"
+-o Root  <class IORegistryEntry, id 0x100000100, retain 33>
  +-o J274AP  <class IOPlatformExpertDevice, id 0x100000122, retain 50>
    | {
    |   "IOPlatformSerialNumber" = "ABCDEFGHIJK"
    |   "IOPlatformUUID" = "12345678-ABCD-1234-EF00-1234567890AB"
    |   "manufacturer" = <"Apple Inc.">
    | }
"#;
        assert_eq!(
            parse_ioreg_output(stdout),
            Some("12345678-ABCD-1234-EF00-1234567890AB".to_string())
        );
    }

    #[test]
    fn parses_returns_none_when_uuid_missing() {
        let stdout = "+-o Root\n+-o nothing here\n";
        assert_eq!(parse_ioreg_output(stdout), None);
    }

    #[test]
    fn uuidv5_is_deterministic_for_same_hardware() {
        // The whole point: same hardware UUID → same device id every
        // time, so deleting ~/.chappie/device-id doesn't reset quota.
        let hw = "12345678-ABCD-1234-EF00-1234567890AB";
        let a = Uuid::new_v5(&NAMESPACE, hw.as_bytes()).to_string();
        let b = Uuid::new_v5(&NAMESPACE, hw.as_bytes()).to_string();
        assert_eq!(a, b);
    }

    #[test]
    fn uuidv5_differs_across_hardware() {
        let a = Uuid::new_v5(&NAMESPACE, b"hardware-A").to_string();
        let b = Uuid::new_v5(&NAMESPACE, b"hardware-B").to_string();
        assert_ne!(a, b);
    }

    #[test]
    fn derived_id_does_not_leak_raw_hardware_uuid() {
        // Sanity check that UUIDv5 actually obscures the input — i.e.
        // the proxy server can't reverse the device id back to the
        // hardware UUID. (UUIDv5 is SHA-1-based, one-way.)
        let hw = "12345678-ABCD-1234-EF00-1234567890AB";
        let derived = Uuid::new_v5(&NAMESPACE, hw.as_bytes()).to_string();
        assert_ne!(derived, hw);
        assert!(!derived.contains("12345678"));
    }
}
