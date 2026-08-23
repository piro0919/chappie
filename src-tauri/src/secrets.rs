// Credentials live in the login Keychain, not in `settings.json`.
//
// The settings store is a plain JSON file in Application Support, readable
// by anything running as the user. That is fine for a VAD threshold and
// wrong for a SwitchBot token — that pair alone is enough to operate the
// devices on the account. The subscription tokens are the same class of
// thing: a JWT and its refresh token.
//
// So the four credentials move to a generic-password Keychain item each,
// under this app's bundle id as the service and the old settings key as
// the account. `migrate_from_store` runs once at startup and carries over
// whatever the plaintext file already held. Everything that is not a
// credential stays in the store.
//
// The renderer reaches these through `secret_get` / `secret_set`, which
// only accept the four names below — the commands are not a general
// Keychain door for the web layer.

const SERVICE: &str = "io.kkweb.chappie";

/// The settings keys that moved to the Keychain. Also the account names of
/// the Keychain items, so an entry stays recognisable in Keychain Access.
pub const KEYS: [&str; 4] = [
    "subscriptionAccessToken",
    "subscriptionRefreshToken",
    "switchbotToken",
    "switchbotSecret",
];

fn is_allowed(key: &str) -> bool {
    KEYS.contains(&key)
}

#[cfg(target_os = "macos")]
pub fn get(key: &str) -> Option<String> {
    // Any failure — no such item, keychain locked, denied — reads as
    // "not configured". The callers all treat absence as the feature
    // being off, which is the right behaviour for a credential we
    // cannot produce.
    security_framework::passwords::get_generic_password(SERVICE, key)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// An empty value deletes the item rather than storing a blank string, so
/// signing out and clearing a token leave nothing behind.
#[cfg(target_os = "macos")]
pub fn set(key: &str, value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() {
        return delete(key);
    }
    security_framework::passwords::set_generic_password(SERVICE, key, value.as_bytes())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
pub fn delete(key: &str) -> Result<(), String> {
    match security_framework::passwords::delete_generic_password(SERVICE, key) {
        Ok(()) => Ok(()),
        // Deleting what is not there is the state the caller asked for.
        Err(_) => Ok(()),
    }
}

#[cfg(not(target_os = "macos"))]
pub fn get(_key: &str) -> Option<String> {
    None
}

#[cfg(not(target_os = "macos"))]
pub fn set(_key: &str, _value: &str) -> Result<(), String> {
    Err("the keychain is only available on macOS".into())
}

#[cfg(not(target_os = "macos"))]
pub fn delete(_key: &str) -> Result<(), String> {
    Ok(())
}

/// Moves any credential still sitting in `settings.json` into the Keychain
/// and strips it from the file. Runs at startup, before anything reads a
/// credential, and is a no-op once there is nothing left to move.
///
/// A key is only removed from the store after the Keychain write returns
/// Ok, so a failure leaves the user logged in on the old path rather than
/// losing the value.
pub fn migrate_from_store<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    use tauri_plugin_store::StoreExt;

    let Ok(store) = app.store("settings.json") else {
        return;
    };
    let mut moved = false;
    for key in KEYS {
        let Some(value) = store
            .get(key)
            .and_then(|v| v.as_str().map(|s| s.trim().to_string()))
        else {
            continue;
        };
        if value.is_empty() {
            store.delete(key);
            moved = true;
            continue;
        }
        if set(key, &value).is_ok() {
            store.delete(key);
            moved = true;
        }
    }
    if moved {
        let _ = store.save();
    }
}

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    if !is_allowed(&key) {
        return Err(format!("{key} is not a credential"));
    }
    Ok(get(&key))
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    if !is_allowed(&key) {
        return Err(format!("{key} is not a credential"));
    }
    set(&key, &value)
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    /// Not one of `KEYS`, so the round-trip never touches the account
    /// names the app actually uses on the machine running the tests.
    const SCRATCH: &str = "chappie-test-scratch";

    #[test]
    fn round_trips_through_the_keychain() {
        let _ = delete(SCRATCH);

        assert_eq!(get(SCRATCH), None, "nothing stored yet");

        set(SCRATCH, "  hunter2  ").expect("write");
        assert_eq!(get(SCRATCH).as_deref(), Some("hunter2"), "trimmed on read");

        set(SCRATCH, "second").expect("overwrite");
        assert_eq!(get(SCRATCH).as_deref(), Some("second"));

        // Empty means "clear", not "store a blank string".
        set(SCRATCH, "").expect("clear");
        assert_eq!(get(SCRATCH), None);

        // Deleting what is already gone is not an error.
        delete(SCRATCH).expect("idempotent delete");
    }

    /// Runs the real migration against a real store file: a mock app with
    /// the store plugin, a settings file holding a credential and an
    /// ordinary setting, and the assertion that only the credential moves.
    #[test]
    fn migration_moves_credentials_out_of_the_settings_file() {
        use tauri::Manager;
        use tauri_plugin_store::StoreExt;

        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_store::Builder::default().build())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("mock app");
        let handle = app.handle().clone();

        // The mock app's own data dir, not the installed app's.
        let dir = handle.path().app_data_dir().expect("data dir");
        let _ = std::fs::remove_file(dir.join("settings.json"));

        let store = handle.store("settings.json").expect("store");
        store.set("switchbotToken", "plaintext-token");
        store.set("subscriptionRefreshToken", "");
        store.set("vadThreshold", 0.25);
        store.save().expect("seed");

        migrate_from_store(&handle);

        assert!(store.get("switchbotToken").is_none(), "credential removed");
        assert!(
            store.get("subscriptionRefreshToken").is_none(),
            "empty credential removed too"
        );
        assert!(store.get("vadThreshold").is_some(), "settings left alone");
        assert_eq!(
            get("switchbotToken").as_deref(),
            Some("plaintext-token"),
            "value landed in the keychain"
        );

        let _ = delete("switchbotToken");
        let _ = std::fs::remove_file(dir.join("settings.json"));
    }

    #[test]
    fn only_credentials_are_reachable_from_the_renderer() {
        assert!(is_allowed("switchbotSecret"));
        assert!(!is_allowed("vadThreshold"));
        assert!(secret_get("openaiApiKey".into()).is_err());
        assert!(secret_set("anything".into(), "x".into()).is_err());
    }
}
