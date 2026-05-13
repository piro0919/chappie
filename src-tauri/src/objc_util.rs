// Shared panic + Objective-C exception guard for ObjC interop.
//
// macOS frameworks (AVFoundation, EventKit, ScreenCaptureKit, CoreLocation)
// can throw NSExceptions on broken entitlements / unsupported configurations.
// Without a guard those propagate up and abort the whole process. Three
// modules (mic_permission, calendar, location_native) used to define
// near-identical helpers; this is the shared version.

#![cfg(target_os = "macos")]

/// Run `f` with panic + NSException protection. Returns Err on either,
/// otherwise the closure's return value.
pub fn guarded<R, F: FnOnce() -> R>(f: F) -> Result<R, String> {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
        objc2::exception::catch(std::panic::AssertUnwindSafe(f))
    }));
    match result {
        Ok(Ok(v)) => Ok(v),
        Ok(Err(e)) => Err(format!("ObjC exception: {:?}", e)),
        Err(_) => Err("panic in ObjC call".to_string()),
    }
}

/// Variant for closures that already return `Result<T, String>`. Flattens
/// the outer guard layer so callers don't have to.
pub fn guarded_result<T, F: FnOnce() -> Result<T, String>>(f: F) -> Result<T, String> {
    match guarded(f) {
        Ok(inner) => inner,
        Err(e) => Err(e),
    }
}
