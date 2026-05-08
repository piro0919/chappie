// Lock screen / sleep helpers. Three escalating intents:
//   - lock         → CGSession -suspend (login screen, system stays awake)
//   - display_off  → pmset displaysleepnow (display off only)
//   - sleep        → pmset sleepnow (whole machine to sleep)
//
// CGSession lives at a fixed path inside macOS; if Apple ever moves it the
// command will fail and we'll surface the error. No graceful fallback —
// silently doing nothing on a "lock the screen" command is worse than
// returning an explicit error the assistant can read aloud.

use std::process::Command;

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
