// Voice control for the current media session (control_music / get_now_playing).
//
// macOS drives Spotify / Apple Music via osascript, acting only on apps that
// are already running. Windows uses the System Media Transport Controls (SMTC)
// WinRT API, which exposes whatever app currently owns media playback
// (Spotify, the Music app, a browser, etc.) — so the `app` hint is honoured on
// macOS but ignored on Windows, where there's a single system-wide session.

use serde::Serialize;

#[derive(Serialize)]
pub struct ControlResult {
    pub ok: bool,
    pub player: String,
    pub action: String,
}

#[derive(Serialize)]
pub struct NowPlaying {
    pub player: String,
    pub state: String,
    pub track: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
}

#[cfg(target_os = "macos")]
mod imp {
    use super::{ControlResult, NowPlaying};
    use std::process::Command;

    #[derive(Clone, Copy)]
    enum Player {
        Spotify,
        Music,
    }

    impl Player {
        fn app_name(self) -> &'static str {
            match self {
                Self::Spotify => "Spotify",
                Self::Music => "Music",
            }
        }
    }

    fn run_osascript(script: &str) -> Result<String, String> {
        let out = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("osascript spawn: {e}"))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }

    fn is_running(player: Player) -> bool {
        let script = format!(
            "tell application \"System Events\" to (name of processes) contains \"{}\"",
            player.app_name()
        );
        matches!(run_osascript(&script).as_deref(), Ok("true"))
    }

    fn pick_running(preferred: Option<Player>) -> Option<Player> {
        if let Some(p) = preferred {
            return is_running(p).then_some(p);
        }
        if is_running(Player::Spotify) {
            return Some(Player::Spotify);
        }
        if is_running(Player::Music) {
            return Some(Player::Music);
        }
        None
    }

    fn parse_app(name: Option<&str>) -> Option<Player> {
        let name = name?.trim().to_ascii_lowercase();
        match name.as_str() {
            "" | "auto" => None,
            "spotify" => Some(Player::Spotify),
            "music" | "apple music" | "itunes" => Some(Player::Music),
            _ => None,
        }
    }

    pub fn control(action: &str, app: Option<&str>) -> Result<ControlResult, String> {
        let player = pick_running(parse_app(app))
            .ok_or_else(|| "no music player is running (Spotify / Music)".to_string())?;
        let app_name = player.app_name();
        let cmd = match action {
            "play" => "play",
            "pause" => "pause",
            "toggle" | "playpause" => "playpause",
            "next" | "skip" => "next track",
            "previous" | "prev" | "back" => "previous track",
            other => return Err(format!("unknown action: {other}")),
        };
        let script = format!("tell application \"{app_name}\" to {cmd}");
        run_osascript(&script)?;
        Ok(ControlResult {
            ok: true,
            player: app_name.to_string(),
            action: action.to_string(),
        })
    }

    pub fn now_playing(app: Option<&str>) -> Result<NowPlaying, String> {
        let player = pick_running(parse_app(app))
            .ok_or_else(|| "no music player is running (Spotify / Music)".to_string())?;
        let app_name = player.app_name();
        // Returns: state || \t || name || \t || artist || \t || album
        let script = format!(
            "tell application \"{app_name}\"\n\
                set s to player state as string\n\
                try\n\
                    set n to name of current track\n\
                    set a to artist of current track\n\
                    set b to album of current track\n\
                    return s & \"\\t\" & n & \"\\t\" & a & \"\\t\" & b\n\
                on error\n\
                    return s & \"\\t\\t\\t\"\n\
                end try\n\
            end tell"
        );
        let out = run_osascript(&script)?;
        let parts: Vec<&str> = out.splitn(4, '\t').collect();
        let state = parts.first().copied().unwrap_or("").to_string();
        let track = parts.get(1).filter(|s| !s.is_empty()).map(|s| s.to_string());
        let artist = parts.get(2).filter(|s| !s.is_empty()).map(|s| s.to_string());
        let album = parts.get(3).filter(|s| !s.is_empty()).map(|s| s.to_string());
        Ok(NowPlaying {
            player: app_name.to_string(),
            state,
            track,
            artist,
            album,
        })
    }
}

#[cfg(target_os = "windows")]
mod imp {
    use super::{ControlResult, NowPlaying};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as SessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
    };

    /// The session that currently owns media playback, or an error if nothing
    /// is playing. SMTC is system-wide, so the `app` hint can't select between
    /// players here — whatever is active wins.
    fn current_session() -> Result<Session, String> {
        let manager = SessionManager::RequestAsync()
            .map_err(|e| format!("SMTC RequestAsync: {e}"))?
            .get()
            .map_err(|e| format!("SMTC manager: {e}"))?;
        manager
            .GetCurrentSession()
            .map_err(|_| "no active media session".to_string())
    }

    /// "Spotify.exe" → "Spotify"; otherwise the raw app-user-model id.
    fn app_label(session: &Session) -> String {
        session
            .SourceAppUserModelId()
            .map(|h| {
                let s = h.to_string();
                s.strip_suffix(".exe").unwrap_or(&s).to_string()
            })
            .unwrap_or_default()
    }

    pub fn control(action: &str, _app: Option<&str>) -> Result<ControlResult, String> {
        let session = current_session()?;
        let op = match action {
            "play" => session.TryPlayAsync(),
            "pause" => session.TryPauseAsync(),
            "toggle" | "playpause" => session.TryTogglePlayPauseAsync(),
            "next" | "skip" => session.TrySkipNextAsync(),
            "previous" | "prev" | "back" => session.TrySkipPreviousAsync(),
            other => return Err(format!("unknown action: {other}")),
        }
        .map_err(|e| format!("SMTC {action}: {e}"))?;
        let ok = op.get().map_err(|e| format!("SMTC {action} await: {e}"))?;
        Ok(ControlResult {
            ok,
            player: app_label(&session),
            action: action.to_string(),
        })
    }

    pub fn now_playing(_app: Option<&str>) -> Result<NowPlaying, String> {
        let session = current_session()?;
        let props = session
            .TryGetMediaPropertiesAsync()
            .map_err(|e| format!("SMTC media props: {e}"))?
            .get()
            .map_err(|e| format!("SMTC media props await: {e}"))?;

        let non_empty = |h: windows::core::HSTRING| {
            let s = h.to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        };
        let track = props.Title().ok().and_then(non_empty);
        let artist = props.Artist().ok().and_then(non_empty);
        let album = props.AlbumTitle().ok().and_then(non_empty);

        let status = session
            .GetPlaybackInfo()
            .and_then(|i| i.PlaybackStatus())
            .unwrap_or(PlaybackStatus::Closed);
        let state = if status == PlaybackStatus::Playing {
            "playing"
        } else if status == PlaybackStatus::Paused {
            "paused"
        } else if status == PlaybackStatus::Stopped {
            "stopped"
        } else {
            "unknown"
        }
        .to_string();

        Ok(NowPlaying {
            player: app_label(&session),
            state,
            track,
            artist,
            album,
        })
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod imp {
    use super::{ControlResult, NowPlaying};
    pub fn control(_action: &str, _app: Option<&str>) -> Result<ControlResult, String> {
        Err("music control is not supported on this platform".into())
    }
    pub fn now_playing(_app: Option<&str>) -> Result<NowPlaying, String> {
        Err("music status is not supported on this platform".into())
    }
}

pub use imp::{control, now_playing};
