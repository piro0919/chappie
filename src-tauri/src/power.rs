// Lock screen / sleep helpers. Three escalating intents:
//   - lock         → lock the session to the login screen (system stays awake)
//   - display_off  → turn the display(s) off only
//   - sleep        → put the whole machine to sleep
//
// On macOS these map to CGSession / pmset; on Windows to LockWorkStation /
// SC_MONITORPOWER / SetSuspendState. Silently doing nothing on a "lock the
// screen" command is worse than an explicit error, so failures surface.

#[cfg(target_os = "macos")]
mod imp {
    use std::process::Command;

    // CGSession lives at a fixed path inside macOS; if Apple ever moves it the
    // command will fail and we'll surface the error.
    const CGSESSION_PATH: &str =
        "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession";

    pub fn run(mode: &str) -> Result<(), String> {
        let (program, args): (&str, &[&str]) = match mode {
            "lock" => (CGSESSION_PATH, &["-suspend"]),
            "display_off" => ("pmset", &["displaysleepnow"]),
            "sleep" => ("pmset", &["sleepnow"]),
            other => return Err(format!("unknown mode: {other}")),
        };
        let status = Command::new(program)
            .args(args)
            .status()
            .map_err(|e| format!("{program} spawn: {e}"))?;
        if !status.success() {
            return Err(format!("{program} exited {status}"));
        }
        Ok(())
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use windows::Win32::Foundation::{BOOLEAN, LPARAM, WPARAM};
    use windows::Win32::System::Power::SetSuspendState;
    use windows::Win32::System::Shutdown::LockWorkStation;
    use windows::Win32::UI::WindowsAndMessaging::{
        SendMessageW, HWND_BROADCAST, SC_MONITORPOWER, WM_SYSCOMMAND,
    };

    pub fn run(mode: &str) -> Result<(), String> {
        match mode {
            "lock" => unsafe { LockWorkStation().map_err(|e| format!("LockWorkStation: {e}")) },
            "display_off" => {
                // Broadcast "monitor power → off" (lParam 2). The returned
                // LRESULT is unused; the message is fire-and-forget.
                unsafe {
                    SendMessageW(
                        HWND_BROADCAST,
                        WM_SYSCOMMAND,
                        WPARAM(SC_MONITORPOWER as usize),
                        LPARAM(2),
                    );
                }
                Ok(())
            }
            "sleep" => {
                // SetSuspendState(hibernate=false, force=false,
                // wakeup-events-disabled=false): a normal sleep. Returns
                // BOOLEAN (non-zero on success).
                let ok = unsafe { SetSuspendState(BOOLEAN(0), BOOLEAN(0), BOOLEAN(0)) };
                if ok.as_bool() {
                    Ok(())
                } else {
                    Err("SetSuspendState failed".into())
                }
            }
            other => Err(format!("unknown mode: {other}")),
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    pub fn run(_mode: &str) -> Result<(), String> {
        Err("power control is not supported on this platform".into())
    }
}

pub use imp::run;
