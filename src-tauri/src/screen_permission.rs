// Screen Recording (TCC) permission. macOS 14.4+ requires this for
// `screencapture` fullscreen mode (interactive selection still works
// without it).
//
// We initially tried `CGRequestScreenCaptureAccess()` but for ad-hoc
// signed Accessory-mode apps that synchronous API returns the cached
// boolean immediately and frequently never shows the dialog. The
// reliable alternative — same pattern the mic permission uses — is
// ScreenCaptureKit's
// `SCShareableContent.getShareableContentWithCompletionHandler:`,
// which is genuinely async (completion-handler-based) and fires the
// system TCC prompt on first call. macOS 12.3+.

#[cfg(target_os = "macos")]
mod imp {
    use crate::objc_util::guarded;
    use block2::RcBlock;
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    use std::sync::mpsc;
    use std::time::Duration;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGPreflightScreenCaptureAccess() -> bool;
    }

    #[link(name = "ScreenCaptureKit", kind = "framework")]
    extern "C" {}

    pub fn preflight() -> bool {
        guarded(|| unsafe { CGPreflightScreenCaptureAccess() }).unwrap_or(false)
    }

    /// Requests screen-recording permission via ScreenCaptureKit. Blocks
    /// up to 120 s waiting for the user to respond to the system prompt
    /// (which only appears the first time per binary). Returns whether
    /// permission is granted.
    pub fn request_blocking() -> bool {
        let (tx, rx) = mpsc::channel::<bool>();
        let tx_arc = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
        let tx_clone = tx_arc.clone();

        // SCShareableContent.getShareableContentWithCompletionHandler:
        //     (^)(SCShareableContent *content, NSError *error) -> void
        let block = RcBlock::new(
            move |content: *mut AnyObject, error: *mut AnyObject| {
                let granted = !content.is_null() && error.is_null();
                if !error.is_null() {
                    unsafe {
                        let desc: *mut AnyObject = msg_send![error, localizedDescription];
                        if !desc.is_null() {
                            let utf8: *const std::os::raw::c_char =
                                msg_send![desc, UTF8String];
                            if !utf8.is_null() {
                                let cstr = std::ffi::CStr::from_ptr(utf8);
                                eprintln!(
                                    "[screen] SCK error: {}",
                                    cstr.to_string_lossy()
                                );
                            }
                        }
                        let domain: *mut AnyObject = msg_send![error, domain];
                        let code: i64 = msg_send![error, code];
                        if !domain.is_null() {
                            let utf8: *const std::os::raw::c_char =
                                msg_send![domain, UTF8String];
                            if !utf8.is_null() {
                                let cstr = std::ffi::CStr::from_ptr(utf8);
                                eprintln!(
                                    "[screen] SCK error domain={} code={code}",
                                    cstr.to_string_lossy()
                                );
                            }
                        }
                    }
                }
                eprintln!(
                    "[screen] SCK callback: content={:?} error={:?} -> granted={granted}",
                    content, error
                );
                if let Some(sender) = tx_clone.lock().unwrap().take() {
                    let _ = sender.send(granted);
                }
            },
        );

        let invoke_result = guarded(|| unsafe {
            let cls = class!(SCShareableContent);
            let _: () = msg_send![
                cls,
                getShareableContentWithCompletionHandler: &*block,
            ];
        });
        if let Err(e) = invoke_result {
            eprintln!("[screen] getShareableContent failed: {e}");
            return false;
        }
        rx.recv_timeout(Duration::from_secs(120)).unwrap_or(false)
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    pub fn preflight() -> bool {
        true
    }
    pub fn request_blocking() -> bool {
        true
    }
}

/// "granted" / "denied". macOS doesn't surface a `not_determined` state
/// for screen recording the way it does for the camera/mic, so we map
/// the boolean preflight to a binary status.
#[tauri::command]
pub async fn check_screen_recording_permission() -> &'static str {
    if imp::preflight() {
        "granted"
    } else {
        "denied"
    }
}

/// Triggers the system TCC prompt the first time it's called for this
/// binary; subsequent calls just return the current grant state. After
/// denial only re-enabling through System Settings recovers.
#[tauri::command]
pub async fn request_screen_recording_access() -> Result<bool, String> {
    tokio::task::spawn_blocking(imp::request_blocking)
        .await
        .map_err(|e| e.to_string())
}

/// Opens System Settings → Privacy & Security → Screen Recording.
/// Bypasses tauri-plugin-opener's default URL scope (which is HTTP-only)
/// by shelling out to /usr/bin/open directly.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn open_screen_recording_settings() -> Result<(), String> {
    std::process::Command::new("/usr/bin/open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn open_screen_recording_settings() -> Result<(), String> {
    Ok(())
}
