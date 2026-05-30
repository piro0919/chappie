// Keep-awake control for the set_sleep_prevention tool. Single global slot —
// calling `start` again while one is active replaces it (so consecutive
// "stay awake for an hour" commands act as expected). An optional duration
// auto-ends; without it the keep-awake lasts until `stop` (or app exit).
//
// macOS drives a child `caffeinate` process; Windows holds the wake lock on a
// dedicated thread via `SetThreadExecutionState`. Both expose the same
// `start` / `stop` / `status` surface (until_unix_ms semantics identical).

#[cfg(target_os = "macos")]
mod imp {
    use once_cell::sync::Lazy;
    use std::process::{Child, Command};
    use std::sync::Mutex;

    struct Active {
        child: Child,
        until_unix_ms: Option<i64>,
    }

    static ACTIVE: Lazy<Mutex<Option<Active>>> = Lazy::new(|| Mutex::new(None));

    fn kill_locked(slot: &mut Option<Active>) {
        if let Some(mut a) = slot.take() {
            let _ = a.child.kill();
            let _ = a.child.wait();
        }
    }

    pub fn start(duration_minutes: Option<u64>) -> Result<Option<i64>, String> {
        let mut slot = ACTIVE.lock().unwrap();
        kill_locked(&mut slot);

        let mut cmd = Command::new("caffeinate");
        // -d: prevent display sleep, -i: prevent idle sleep, -m: prevent disk
        // sleep. Together this is "really stay awake".
        cmd.args(["-d", "-i", "-m"]);
        if let Some(mins) = duration_minutes {
            if mins > 0 {
                cmd.arg("-t").arg((mins * 60).to_string());
            }
        }
        let child = cmd.spawn().map_err(|e| format!("caffeinate spawn: {e}"))?;
        let until_unix_ms = duration_minutes
            .map(|mins| chrono::Local::now().timestamp_millis() + (mins as i64) * 60 * 1000);
        *slot = Some(Active {
            child,
            until_unix_ms,
        });
        Ok(until_unix_ms)
    }

    pub fn stop() -> bool {
        let mut slot = ACTIVE.lock().unwrap();
        let was_active = slot.is_some();
        kill_locked(&mut slot);
        was_active
    }

    pub fn status() -> Option<Option<i64>> {
        let mut slot = ACTIVE.lock().unwrap();
        let active = slot.as_mut()?;
        // If the child finished on its own (timer elapsed), clear it.
        match active.child.try_wait() {
            Ok(Some(_)) => {
                *slot = None;
                None
            }
            _ => Some(active.until_unix_ms),
        }
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use once_cell::sync::Lazy;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use windows::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
    };

    struct Active {
        stop: Arc<AtomicBool>,
        until_unix_ms: Option<i64>,
    }

    static ACTIVE: Lazy<Mutex<Option<Active>>> = Lazy::new(|| Mutex::new(None));

    /// Signal the current keep-awake thread to release its execution-state
    /// lock and exit, then drop it from the slot.
    fn clear_locked(slot: &mut Option<Active>) {
        if let Some(a) = slot.take() {
            a.stop.store(true, Ordering::SeqCst);
        }
    }

    pub fn start(duration_minutes: Option<u64>) -> Result<Option<i64>, String> {
        let mut slot = ACTIVE.lock().unwrap();
        clear_locked(&mut slot);

        let until_unix_ms = duration_minutes
            .filter(|m| *m > 0)
            .map(|mins| chrono::Local::now().timestamp_millis() + (mins as i64) * 60 * 1000);

        let stop = Arc::new(AtomicBool::new(false));
        let stop_thread = stop.clone();
        let deadline = until_unix_ms;
        // The execution-state flags are scoped to the thread that sets them
        // (with ES_CONTINUOUS they persist until cleared), so the wake lock
        // must live on a dedicated thread that stays alive for its duration.
        std::thread::spawn(move || {
            unsafe {
                SetThreadExecutionState(
                    ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED,
                );
            }
            loop {
                if stop_thread.load(Ordering::SeqCst) {
                    break;
                }
                if let Some(d) = deadline {
                    if chrono::Local::now().timestamp_millis() >= d {
                        break;
                    }
                }
                std::thread::sleep(Duration::from_millis(500));
            }
            // Release the lock so normal idle sleep resumes.
            unsafe {
                SetThreadExecutionState(ES_CONTINUOUS);
            }
        });

        *slot = Some(Active {
            stop,
            until_unix_ms,
        });
        Ok(until_unix_ms)
    }

    pub fn stop() -> bool {
        let mut slot = ACTIVE.lock().unwrap();
        let was_active = slot.is_some();
        clear_locked(&mut slot);
        was_active
    }

    pub fn status() -> Option<Option<i64>> {
        let mut slot = ACTIVE.lock().unwrap();
        let expired = match slot.as_ref() {
            Some(a) => a
                .until_unix_ms
                .map(|d| chrono::Local::now().timestamp_millis() >= d)
                .unwrap_or(false),
            None => return None,
        };
        if expired {
            // The worker thread has (or soon will have) released the lock and
            // exited on its own deadline; reflect that here.
            *slot = None;
            return None;
        }
        slot.as_ref().map(|a| a.until_unix_ms)
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    pub fn start(_duration_minutes: Option<u64>) -> Result<Option<i64>, String> {
        Err("sleep prevention is not supported on this platform".into())
    }
    pub fn stop() -> bool {
        false
    }
    pub fn status() -> Option<Option<i64>> {
        None
    }
}

pub use imp::{start, status, stop};
