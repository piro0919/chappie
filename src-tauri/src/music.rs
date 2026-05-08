// Voice control for Spotify / Apple Music via osascript. We deliberately
// only act on apps that are already running — saying "play" shouldn't
// silently launch Spotify if it wasn't open. Auto mode picks Spotify first
// (since users usually default to it), then Music.

use serde::Serialize;
use std::process::Command;

#[derive(Clone, Copy)]
pub enum Player {
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

#[derive(Serialize)]
pub struct ControlResult {
    pub ok: bool,
    pub player: String,
    pub action: String,
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

#[derive(Serialize)]
pub struct NowPlaying {
    pub player: String,
    pub state: String,
    pub track: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
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
