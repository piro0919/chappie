// Centralized logging helper. Calls eprintln (visible in `pnpm tauri dev`'s
// terminal) AND emits a `log` Tauri event so the renderer can console.log it.
// This bridges the visibility gap: Web Inspector now sees Rust events too.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
pub struct LogEvent {
    pub level: &'static str, // "info" | "warn" | "error"
    pub tag: &'static str,
    pub message: String,
}

pub fn log(app: &AppHandle, level: &'static str, tag: &'static str, message: impl Into<String>) {
    let message = message.into();
    eprintln!("[{tag}] {message}");
    let _ = app.emit(
        "log",
        LogEvent {
            level,
            tag,
            message,
        },
    );
}

#[macro_export]
macro_rules! linfo {
    ($app:expr, $tag:expr, $($arg:tt)*) => {
        $crate::log_event::log($app, "info", $tag, format!($($arg)*))
    };
}

#[macro_export]
macro_rules! lwarn {
    ($app:expr, $tag:expr, $($arg:tt)*) => {
        $crate::log_event::log($app, "warn", $tag, format!($($arg)*))
    };
}

#[macro_export]
macro_rules! lerror {
    ($app:expr, $tag:expr, $($arg:tt)*) => {
        $crate::log_event::log($app, "error", $tag, format!($($arg)*))
    };
}
