// macOS CoreLocation integration. Higher-precision alternative to the
// IP-based `location.rs` fallback — necessary because Japanese ISPs (and
// any with consolidated backbone routing) make IP geolocation default
// to Tokyo for users in Aichi / Osaka / etc.
//
// CLLocationManager isn't Send/Sync and its async APIs (requestWhenInUse-
// Authorization, didUpdateLocations) need a runloop on the thread that
// owns the manager. We run everything on a dedicated thread that drives
// its own CFRunLoop, mirroring the calendar.rs pattern.
//
// To avoid the complexity of a declare_class delegate, we use the polling
// approach: kick off the async API (requestWhenInUseAuthorization /
// startUpdatingLocation), then iterate CFRunLoopRunInMode in 100ms ticks
// while checking the synchronous accessors (authorizationStatus / location).
// Works because macOS updates those properties internally before/while
// the delegate would have been called.

#[cfg(target_os = "macos")]
mod imp {
    use block2::RcBlock;
    use objc2::rc::{Allocated, Retained};
    use objc2::{msg_send, AllocAnyThread};
    use objc2_core_location::{
        CLAuthorizationStatus, CLGeocoder, CLLocation, CLLocationManager, CLPlacemark,
    };
    use objc2_foundation::{NSArray, NSError, NSString};
    use std::collections::HashMap;
    use std::sync::mpsc;
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant};

    /// Coord → locality cache. Keyed by lat/lon rounded to ~110m
    /// buckets (3 decimal places × 1000) so a slightly drifting fix
    /// from CoreLocation doesn't trigger a fresh CLGeocoder call.
    /// TTL is long because cities don't move; the parent cache in
    /// `location.rs` already expires the full UserLocation every
    /// 30 min, but on its miss path we re-fetch the coord *and* the
    /// locality. The latter is the expensive part (network + Apple
    /// Maps round-trip, up to 5 s on timeout), and the user
    /// usually hasn't actually moved between cache expirations.
    static GEOCODE_CACHE: OnceLock<Mutex<HashMap<(i32, i32), (Option<String>, Instant)>>> =
        OnceLock::new();
    const GEOCODE_TTL: Duration = Duration::from_secs(24 * 60 * 60);

    fn coord_key(lat: f64, lon: f64) -> (i32, i32) {
        ((lat * 1000.0).round() as i32, (lon * 1000.0).round() as i32)
    }

    fn geocode_cache_lookup(lat: f64, lon: f64) -> Option<Option<String>> {
        let map = GEOCODE_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let guard = map.lock().ok()?;
        let (val, t) = guard.get(&coord_key(lat, lon))?;
        if t.elapsed() < GEOCODE_TTL {
            Some(val.clone())
        } else {
            None
        }
    }

    fn geocode_cache_store(lat: f64, lon: f64, name: Option<String>) {
        let map = GEOCODE_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        if let Ok(mut guard) = map.lock() {
            guard.insert(coord_key(lat, lon), (name, Instant::now()));
        }
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        static kCFRunLoopDefaultMode: *const std::ffi::c_void;
        fn CFRunLoopRunInMode(
            mode: *const std::ffi::c_void,
            seconds: f64,
            return_after_source_handled: u8,
        ) -> i32;
    }

    pub type LocationFix = (f64, f64, Option<String>);

    pub enum Cmd {
        CheckPermission(mpsc::Sender<Result<String, String>>),
        RequestPermission(mpsc::Sender<Result<bool, String>>),
        GetLocation(mpsc::Sender<Result<LocationFix, String>>),
    }

    pub struct State {
        pub tx: mpsc::Sender<Cmd>,
    }

    pub static STATE: OnceLock<State> = OnceLock::new();

    use crate::objc_util::guarded_result as guarded;

    /// Spin the thread's CFRunLoop for the given duration so async
    /// CoreLocation callbacks (authorization changes, location updates)
    /// can dispatch. Returns when the duration elapses.
    fn pump_runloop(seconds: f64) {
        unsafe {
            let _ = CFRunLoopRunInMode(kCFRunLoopDefaultMode, seconds, 0);
        }
    }

    fn status_to_str(s: CLAuthorizationStatus) -> &'static str {
        if s == CLAuthorizationStatus::AuthorizedAlways
            || s == CLAuthorizationStatus::AuthorizedWhenInUse
        {
            "granted"
        } else if s == CLAuthorizationStatus::Denied {
            "denied"
        } else if s == CLAuthorizationStatus::Restricted {
            "restricted"
        } else {
            "not_determined"
        }
    }

    fn check_permission_inner(manager: &CLLocationManager) -> Result<String, String> {
        // `-[CLLocationManager authorizationStatus]` instance method is the
        // long-term API (the class method form is deprecated since macOS 11).
        let status: CLAuthorizationStatus = unsafe { msg_send![manager, authorizationStatus] };
        Ok(status_to_str(status).to_string())
    }

    fn request_permission_inner(manager: &CLLocationManager) -> Result<bool, String> {
        let initial: CLAuthorizationStatus = unsafe { msg_send![manager, authorizationStatus] };
        if initial != CLAuthorizationStatus::NotDetermined {
            return Ok(initial == CLAuthorizationStatus::AuthorizedAlways
                || initial == CLAuthorizationStatus::AuthorizedWhenInUse);
        }
        unsafe {
            manager.requestWhenInUseAuthorization();
        }
        // Pump the runloop in 100 ms ticks until the status changes or
        // we hit the 60 s timeout (the user might leave the prompt
        // sitting).
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            pump_runloop(0.1);
            let now: CLAuthorizationStatus = unsafe { msg_send![manager, authorizationStatus] };
            if now != CLAuthorizationStatus::NotDetermined {
                return Ok(now == CLAuthorizationStatus::AuthorizedAlways
                    || now == CLAuthorizationStatus::AuthorizedWhenInUse);
            }
            if Instant::now() >= deadline {
                return Err("permission prompt timed out".into());
            }
        }
    }

    /// One-shot location fix via the polling pattern described at the top
    /// of this file. Returns (lat, lon, locality?) — locality is the city
    /// name from reverse geocoding when available.
    fn get_location_inner(
        manager: &CLLocationManager,
    ) -> Result<(f64, f64, Option<String>), String> {
        let status: CLAuthorizationStatus = unsafe { msg_send![manager, authorizationStatus] };
        if status != CLAuthorizationStatus::AuthorizedAlways
            && status != CLAuthorizationStatus::AuthorizedWhenInUse
        {
            return Err(format!("not authorized: {}", status_to_str(status)));
        }
        unsafe {
            manager.startUpdatingLocation();
        }
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut got: Option<(f64, f64)> = None;
        loop {
            pump_runloop(0.2);
            let loc: Option<Retained<CLLocation>> = unsafe { msg_send![manager, location] };
            if let Some(l) = loc {
                let coord = unsafe { l.coordinate() };
                got = Some((coord.latitude, coord.longitude));
                break;
            }
            if Instant::now() >= deadline {
                break;
            }
        }
        unsafe {
            manager.stopUpdatingLocation();
        }
        let (lat, lon) = got.ok_or_else(|| "no location fix within timeout".to_string())?;

        // Best-effort reverse geocoding. Pure cosmetic — if it fails we
        // still have lat/lon (the weather tool consumes those directly).
        // Cache hit skips the CLGeocoder round-trip entirely; on miss we
        // store the result (including None, so repeated geocode failures
        // don't keep hammering Apple Maps).
        let locality = if let Some(cached) = geocode_cache_lookup(lat, lon) {
            cached
        } else {
            let fresh = reverse_geocode(lat, lon).ok().flatten();
            geocode_cache_store(lat, lon, fresh.clone());
            fresh
        };
        Ok((lat, lon, locality))
    }

    fn reverse_geocode(lat: f64, lon: f64) -> Result<Option<String>, String> {
        let allocated: Allocated<CLLocation> = CLLocation::alloc();
        let location: Retained<CLLocation> =
            unsafe { CLLocation::initWithLatitude_longitude(allocated, lat, lon) };
        let geocoder: Retained<CLGeocoder> = unsafe { CLGeocoder::new() };

        let (tx, rx) = mpsc::channel::<Option<String>>();
        let tx_arc = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
        let tx_clone = tx_arc.clone();
        let block = RcBlock::new(
            move |placemarks: *mut NSArray<CLPlacemark>, _err: *mut NSError| {
                let name: Option<String> = unsafe {
                    if placemarks.is_null() {
                        None
                    } else {
                        let arr = &*placemarks;
                        let count = arr.count();
                        if count == 0 {
                            None
                        } else {
                            let first: Retained<CLPlacemark> = arr.objectAtIndex(0);
                            // Prefer locality (city), fall back to
                            // subAdministrativeArea (ward/region) then
                            // administrativeArea (prefecture).
                            let locality: Option<Retained<NSString>> = first.locality();
                            let sub_admin: Option<Retained<NSString>> =
                                first.subAdministrativeArea();
                            let admin: Option<Retained<NSString>> = first.administrativeArea();
                            locality
                                .or(sub_admin)
                                .or(admin)
                                .map(|s| s.to_string())
                        }
                    }
                };
                if let Some(sender) = tx_clone.lock().unwrap().take() {
                    let _ = sender.send(name);
                }
            },
        );
        // The generated bindings take the completion handler as a raw
        // mutable pointer to a block. Cast through `as_ptr` since RcBlock
        // owns the heap allocation and we just need to hand the pointer
        // to ObjC for the duration of the call.
        let block_ptr = RcBlock::as_ptr(&block) as *mut _;
        unsafe {
            geocoder.reverseGeocodeLocation_completionHandler(&location, block_ptr);
        }
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            pump_runloop(0.1);
            match rx.try_recv() {
                Ok(name) => return Ok(name),
                Err(mpsc::TryRecvError::Empty) => {}
                Err(mpsc::TryRecvError::Disconnected) => return Ok(None),
            }
            if Instant::now() >= deadline {
                return Err("reverse geocode timeout".into());
            }
        }
    }

    pub fn init() {
        let (tx, rx) = mpsc::channel::<Cmd>();
        std::thread::spawn(move || {
            // CLLocationManager must be created on a thread with a
            // runloop. We pump the runloop manually inside each command's
            // handler instead of running a long-lived CFRunLoopRun, so the
            // thread stays responsive to incoming mpsc commands.
            let manager: Retained<CLLocationManager> = unsafe { CLLocationManager::new() };
            for cmd in rx {
                match cmd {
                    Cmd::CheckPermission(reply) => {
                        let _ = reply.send(guarded(|| check_permission_inner(&manager)));
                    }
                    Cmd::RequestPermission(reply) => {
                        let _ = reply.send(guarded(|| request_permission_inner(&manager)));
                    }
                    Cmd::GetLocation(reply) => {
                        let _ = reply.send(guarded(|| get_location_inner(&manager)));
                    }
                }
            }
        });
        let _ = STATE.set(State { tx });
    }
}

#[cfg(target_os = "macos")]
pub fn init() {
    imp::init();
}

#[cfg(not(target_os = "macos"))]
pub fn init() {}

#[cfg(target_os = "macos")]
fn send<T>(
    make: impl FnOnce(std::sync::mpsc::Sender<Result<T, String>>) -> imp::Cmd,
) -> Result<T, String> {
    let state = imp::STATE
        .get()
        .ok_or_else(|| "location_native not initialized".to_string())?;
    let (tx, rx) = std::sync::mpsc::channel();
    state.tx.send(make(tx)).map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}

#[cfg(target_os = "macos")]
pub fn check_permission() -> Result<String, String> {
    send(imp::Cmd::CheckPermission)
}

#[cfg(target_os = "macos")]
pub fn request_permission() -> Result<bool, String> {
    send(imp::Cmd::RequestPermission)
}

/// Returns (latitude, longitude, optional_city_name) on success.
#[cfg(target_os = "macos")]
pub fn get_location() -> Result<(f64, f64, Option<String>), String> {
    send(imp::Cmd::GetLocation)
}

#[cfg(not(target_os = "macos"))]
pub fn check_permission() -> Result<String, String> {
    Ok("not_supported".into())
}

#[cfg(not(target_os = "macos"))]
pub fn request_permission() -> Result<bool, String> {
    Ok(false)
}

#[cfg(not(target_os = "macos"))]
pub fn get_location() -> Result<(f64, f64, Option<String>), String> {
    Err("not supported".into())
}
