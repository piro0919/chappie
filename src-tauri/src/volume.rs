// System output-volume controls. Three thin shells used by the
// get_volume / set_volume / set_mute tools (and `is_muted`):
//   - get(): read current output volume + mute state
//   - set_level(0-100): set absolute output volume
//   - set_muted(bool): set output muted flag
//
// macOS goes through `osascript` ("set volume output volume N" is officially
// supported AppleScript); Windows goes through Core Audio's
// `IAudioEndpointVolume` on the default render endpoint. The public surface
// is identical on both so callers don't branch.

pub struct VolumeState {
    pub level: u8,
    pub muted: bool,
}

#[cfg(target_os = "macos")]
mod imp {
    use super::VolumeState;
    use std::process::Command;

    fn run_osascript(script: &str) -> Result<String, String> {
        let out = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }

    pub fn get() -> Result<VolumeState, String> {
        let level_s = run_osascript("output volume of (get volume settings)")?;
        let muted_s = run_osascript("output muted of (get volume settings)")?;
        let level: u8 = level_s
            .parse()
            .map_err(|e| format!("parse level {level_s:?}: {e}"))?;
        let muted = muted_s == "true";
        Ok(VolumeState { level, muted })
    }

    pub fn set_level(level: u8) -> Result<(), String> {
        let level = level.min(100);
        run_osascript(&format!("set volume output volume {level}")).map(|_| ())
    }

    pub fn set_muted(muted: bool) -> Result<(), String> {
        run_osascript(&format!(
            "set volume output muted {}",
            if muted { "true" } else { "false" }
        ))
        .map(|_| ())
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use super::VolumeState;
    use windows::core::GUID;
    use windows::Win32::Foundation::BOOL;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    /// Acquire the default render endpoint's volume interface. COM is
    /// initialised per call (idempotent — a repeat init on the same thread
    /// just returns S_FALSE / RPC_E_CHANGED_MODE, both harmless here).
    fn endpoint() -> Result<IAudioEndpointVolume, String> {
        unsafe {
            // Ignore the HRESULT: already-initialised is fine, and a mode
            // clash means some other code already set this thread's apartment
            // which is equally usable for these calls.
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .map_err(|e| format!("CoCreateInstance(MMDeviceEnumerator): {e}"))?;
            let device = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|e| format!("GetDefaultAudioEndpoint: {e}"))?;
            let ep: IAudioEndpointVolume = device
                .Activate(CLSCTX_ALL, None)
                .map_err(|e| format!("Activate(IAudioEndpointVolume): {e}"))?;
            Ok(ep)
        }
    }

    pub fn get() -> Result<VolumeState, String> {
        let ep = endpoint()?;
        unsafe {
            let scalar = ep
                .GetMasterVolumeLevelScalar()
                .map_err(|e| format!("GetMasterVolumeLevelScalar: {e}"))?;
            let muted = ep.GetMute().map_err(|e| format!("GetMute: {e}"))?;
            let level = (scalar.clamp(0.0, 1.0) * 100.0).round() as u8;
            Ok(VolumeState {
                level,
                muted: muted.as_bool(),
            })
        }
    }

    pub fn set_level(level: u8) -> Result<(), String> {
        let ep = endpoint()?;
        let scalar = (level.min(100) as f32) / 100.0;
        unsafe {
            ep.SetMasterVolumeLevelScalar(scalar, std::ptr::null::<GUID>())
                .map_err(|e| format!("SetMasterVolumeLevelScalar: {e}"))
        }
    }

    pub fn set_muted(muted: bool) -> Result<(), String> {
        let ep = endpoint()?;
        unsafe {
            ep.SetMute(BOOL::from(muted), std::ptr::null::<GUID>())
                .map_err(|e| format!("SetMute: {e}"))
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    use super::VolumeState;

    pub fn get() -> Result<VolumeState, String> {
        Err("volume control is not supported on this platform".into())
    }
    pub fn set_level(_level: u8) -> Result<(), String> {
        Err("volume control is not supported on this platform".into())
    }
    pub fn set_muted(_muted: bool) -> Result<(), String> {
        Err("volume control is not supported on this platform".into())
    }
}

pub use imp::{get, set_level, set_muted};

#[tauri::command]
pub fn is_muted() -> Result<bool, String> {
    get().map(|v| v.muted)
}
