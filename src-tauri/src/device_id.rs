// Persistent per-install identifier for Free mode quota tracking.
//
// Stored as a plain UUID v4 string in ~/.chappie/device-id. Created on
// first access. The renderer never sees it directly — only the proxy
// HTTP path in `llm::proxy_impl` does, via `X-Chappie-Device-Id`.
//
// Reinstall / homedir-wipe resets the quota (acceptable trade-off for
// MVP; cross-device quota will arrive with auth in Phase 3).

use once_cell::sync::OnceCell;
use std::path::PathBuf;
use uuid::Uuid;

static CACHED: OnceCell<String> = OnceCell::new();

fn path() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    let _ = std::fs::create_dir_all(&p);
    p.push("device-id");
    Some(p)
}

/// Return the persisted device id, generating one on first access.
///
/// Returns `Err` only on filesystem failures (home dir unresolvable, write
/// permission denied). Read-then-write race is benign: two concurrent
/// callers would generate distinct UUIDs but `OnceCell::get_or_init`
/// in-process serializes, and the on-disk last writer wins. We re-read
/// after writing so all callers in this process settle on the same id.
pub fn get_or_init() -> Result<String, String> {
    if let Some(v) = CACHED.get() {
        return Ok(v.clone());
    }
    let p = path().ok_or_else(|| "cannot resolve home dir".to_string())?;
    let id = if p.exists() {
        std::fs::read_to_string(&p)
            .map_err(|e| format!("read device-id: {e}"))?
            .trim()
            .to_string()
    } else {
        let new_id = Uuid::new_v4().to_string();
        std::fs::write(&p, &new_id).map_err(|e| format!("write device-id: {e}"))?;
        new_id
    };
    if id.is_empty() {
        // File existed but was empty (corrupted). Recreate.
        let new_id = Uuid::new_v4().to_string();
        std::fs::write(&p, &new_id).map_err(|e| format!("write device-id: {e}"))?;
        let _ = CACHED.set(new_id.clone());
        return Ok(new_id);
    }
    let _ = CACHED.set(id.clone());
    Ok(id)
}

#[tauri::command]
pub fn get_device_id() -> Result<String, String> {
    get_or_init()
}
