// Detect whether an application OTHER than Chappie is currently capturing
// microphone input. Used to suppress Chappie's TTS while the user is on a
// call / recording so it doesn't talk over them (gated behind a Settings
// toggle on the renderer side).
//
// macOS-only. Uses the per-process Core Audio object API added in macOS 14
// (Sonoma): we enumerate every audio process object, skip our own PID, and
// check `kAudioProcessPropertyIsRunningInput`. The simpler device-level
// `kAudioDevicePropertyDeviceIsRunningSomewhere` can't work here because
// Chappie holds the input device open continuously — the cpal capture stream
// stays live even while the segmenter is MUTED during TTS — so it would
// always report "in use". The process-level check is the only way to tell
// "someone else" apart from "us".
//
// On macOS < 14 the process-object property list errors out (or returns an
// empty list); we treat any failure as "no external mic" so the feature
// degrades to a harmless no-op rather than wrongly silencing the assistant.

#[cfg(target_os = "macos")]
mod imp {
    use std::os::raw::c_void;

    type AudioObjectID = u32;
    type OSStatus = i32;

    #[repr(C)]
    struct AudioObjectPropertyAddress {
        m_selector: u32,
        m_scope: u32,
        m_element: u32,
    }

    const K_AUDIO_OBJECT_SYSTEM_OBJECT: AudioObjectID = 1;
    const K_ELEMENT_MAIN: u32 = 0;

    /// FourCharCode: char literals are big-endian (first byte = MSB).
    const fn fourcc(s: &[u8; 4]) -> u32 {
        ((s[0] as u32) << 24) | ((s[1] as u32) << 16) | ((s[2] as u32) << 8) | (s[3] as u32)
    }
    // kAudioHardwarePropertyProcessObjectList
    const K_PROCESS_OBJECT_LIST: u32 = fourcc(b"prs#");
    // kAudioProcessPropertyIsRunningInput
    const K_PROCESS_IS_RUNNING_INPUT: u32 = fourcc(b"piri");
    // kAudioProcessPropertyPID
    const K_PROCESS_PID: u32 = fourcc(b"ppid");
    // kAudioObjectPropertyScopeGlobal
    const K_SCOPE_GLOBAL: u32 = fourcc(b"glob");

    #[link(name = "CoreAudio", kind = "framework")]
    extern "C" {
        fn AudioObjectGetPropertyDataSize(
            in_object_id: AudioObjectID,
            in_address: *const AudioObjectPropertyAddress,
            in_qualifier_data_size: u32,
            in_qualifier_data: *const c_void,
            out_data_size: *mut u32,
        ) -> OSStatus;

        fn AudioObjectGetPropertyData(
            in_object_id: AudioObjectID,
            in_address: *const AudioObjectPropertyAddress,
            in_qualifier_data_size: u32,
            in_qualifier_data: *const c_void,
            io_data_size: *mut u32,
            out_data: *mut c_void,
        ) -> OSStatus;
    }

    /// Read a single `u32`-sized property off an audio object. Returns None
    /// on any non-zero OSStatus (unsupported selector, stale object, etc).
    fn get_u32(object: AudioObjectID, selector: u32) -> Option<u32> {
        let addr = AudioObjectPropertyAddress {
            m_selector: selector,
            m_scope: K_SCOPE_GLOBAL,
            m_element: K_ELEMENT_MAIN,
        };
        let mut value: u32 = 0;
        let mut size = std::mem::size_of::<u32>() as u32;
        let status = unsafe {
            AudioObjectGetPropertyData(
                object,
                &addr,
                0,
                std::ptr::null(),
                &mut size,
                &mut value as *mut u32 as *mut c_void,
            )
        };
        if status == 0 {
            Some(value)
        } else {
            None
        }
    }

    pub fn external_mic_active() -> bool {
        // pid_t is i32; for real (positive) PIDs the bit pattern matches u32,
        // so comparing the raw u32 we read against our own pid is correct.
        let own_pid = std::process::id();

        let list_addr = AudioObjectPropertyAddress {
            m_selector: K_PROCESS_OBJECT_LIST,
            m_scope: K_SCOPE_GLOBAL,
            m_element: K_ELEMENT_MAIN,
        };
        let mut data_size: u32 = 0;
        let status = unsafe {
            AudioObjectGetPropertyDataSize(
                K_AUDIO_OBJECT_SYSTEM_OBJECT,
                &list_addr,
                0,
                std::ptr::null(),
                &mut data_size,
            )
        };
        // macOS < 14 (selector unknown) or any failure → no external mic.
        if status != 0 || data_size == 0 {
            return false;
        }

        let count = data_size as usize / std::mem::size_of::<AudioObjectID>();
        let mut objects: Vec<AudioObjectID> = vec![0; count];
        let status = unsafe {
            AudioObjectGetPropertyData(
                K_AUDIO_OBJECT_SYSTEM_OBJECT,
                &list_addr,
                0,
                std::ptr::null(),
                &mut data_size,
                objects.as_mut_ptr() as *mut c_void,
            )
        };
        if status != 0 {
            return false;
        }

        for &obj in &objects {
            let Some(pid) = get_u32(obj, K_PROCESS_PID) else {
                continue;
            };
            if pid == own_pid {
                continue;
            }
            if get_u32(obj, K_PROCESS_IS_RUNNING_INPUT).unwrap_or(0) != 0 {
                return true;
            }
        }
        false
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    pub fn external_mic_active() -> bool {
        false
    }
}

/// True when some app other than Chappie is currently capturing mic input.
/// Cheap enough to poll on every TTS-routing decision.
#[tauri::command]
pub fn is_external_mic_active() -> bool {
    imp::external_mic_active()
}
