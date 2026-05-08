// Screen Recording (TCC) permission. macOS 14.4+ requires this for
// `screencapture` to work in fullscreen mode (interactive selection still
// works without it). We mirror the mic_permission.rs pattern: always call
// the request API on startup so first-launch users get the prompt; after
// denial only System Settings can re-enable.

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[cfg(target_os = "macos")]
fn preflight() -> bool {
    unsafe { CGPreflightScreenCaptureAccess() }
}

#[cfg(target_os = "macos")]
fn request() -> bool {
    unsafe { CGRequestScreenCaptureAccess() }
}

#[cfg(not(target_os = "macos"))]
fn preflight() -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
fn request() -> bool {
    true
}

/// "granted" / "denied" — the same shape we use for mic so the renderer
/// can reuse its permission UI conventions. macOS doesn't expose a
/// `not_determined` state for screen recording the way it does for the
/// camera/mic, so we map the boolean preflight to a binary status.
#[tauri::command]
pub fn check_screen_recording_permission() -> &'static str {
    if preflight() {
        "granted"
    } else {
        "denied"
    }
}

/// Triggers the system permission prompt the first time it's called for
/// this binary. After denial it returns `false` without prompting again —
/// only re-enabling through System Settings recovers.
#[tauri::command]
pub fn request_screen_recording_access() -> bool {
    request()
}
