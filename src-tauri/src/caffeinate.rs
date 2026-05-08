// Manages a child `caffeinate` process to prevent the Mac from sleeping
// while the user is mid-task. Single global slot — calling `start` again
// while one is running replaces it (so consecutive "stay awake for an hour"
// commands act as expected). Optional duration auto-ends; without it the
// process runs until `stop` (or app exit, since caffeinate dies with us).

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
    let until_unix_ms = duration_minutes.map(|mins| {
        chrono::Local::now().timestamp_millis() + (mins as i64) * 60 * 1000
    });
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
