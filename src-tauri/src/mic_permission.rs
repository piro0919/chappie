// macOS microphone permission via AVCaptureDevice.requestAccess(for: .audio).
// Mirrors Galopen's calendar permission pattern: always invoke requestAccess
// from a dedicated thread regardless of the cached authorization status.
// On ad-hoc-signed LSUIElement apps the system prompt only fires through
// requestAccess; the cached status can lie ("ghost permission").

#[cfg(target_os = "macos")]
mod imp {
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2::{class, msg_send};
    use objc2_foundation::NSString;
    use std::sync::mpsc;
    use std::time::Duration;

    #[link(name = "AVFoundation", kind = "framework")]
    extern "C" {}

    const AV_MEDIA_TYPE_AUDIO: &str = "soun";

    // Wrap every ObjC call in panic::catch_unwind + objc2::exception::catch.
    // Without this, an NSException from AVFoundation (e.g. due to a broken
    // entitlement on a dev build) terminates the whole process. Modeled after
    // galopen/src-tauri/src/calendar.rs.
    fn guarded_objc<R, F>(f: F) -> Result<R, String>
    where
        F: FnOnce() -> R,
    {
        let f = std::panic::AssertUnwindSafe(f);
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            objc2::exception::catch(f)
        })) {
            Ok(Ok(v)) => Ok(v),
            Ok(Err(e)) => Err(format!("ObjC exception: {:?}", e)),
            Err(_) => Err("AVFoundation panic".to_string()),
        }
    }

    pub fn authorization_status() -> i32 {
        guarded_objc(|| unsafe {
            let cls = class!(AVCaptureDevice);
            let media_type = NSString::from_str(AV_MEDIA_TYPE_AUDIO);
            msg_send![cls, authorizationStatusForMediaType: &*media_type]
        })
        .unwrap_or_else(|e| {
            eprintln!("[mic] authorizationStatusForMediaType failed: {e}");
            // Treat as not_determined so the caller still tries requestAccess.
            0
        })
    }

    pub fn request_access_blocking() -> bool {
        let (tx, rx) = mpsc::channel::<bool>();
        let tx_arc = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
        let tx_clone = tx_arc.clone();
        let block = RcBlock::new(move |granted: Bool| {
            if let Some(sender) = tx_clone.lock().unwrap().take() {
                let _ = sender.send(granted.as_bool());
            }
        });
        let invoke_result = guarded_objc(|| unsafe {
            let cls = class!(AVCaptureDevice);
            let media_type = NSString::from_str(AV_MEDIA_TYPE_AUDIO);
            let _: () = msg_send![
                cls,
                requestAccessForMediaType: &*media_type,
                completionHandler: &*block,
            ];
        });
        if let Err(e) = invoke_result {
            eprintln!("[mic] requestAccessForMediaType failed: {e}");
            return false;
        }
        rx.recv_timeout(Duration::from_secs(120)).unwrap_or(false)
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn check_microphone_permission() -> Result<String, String> {
    // 0 = NotDetermined, 1 = Restricted, 2 = Denied, 3 = Authorized
    let s = match imp::authorization_status() {
        3 => "granted",
        2 => "denied",
        1 => "restricted",
        _ => "not_determined",
    };
    Ok(s.to_string())
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn request_microphone_access() -> Result<bool, String> {
    tokio::task::spawn_blocking(imp::request_access_blocking)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn check_microphone_permission() -> Result<String, String> {
    Ok("granted".into())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn request_microphone_access() -> Result<bool, String> {
    Ok(true)
}
