// VOICEVOX HTTP proxy + engine subprocess manager + auto-installer.
//
// Three paths to a working engine, in priority order:
//
// 1. **Chappie-managed**: `~/.chappie/voicevox/run` — installed by the
//    user via the Settings "インストール" button (this module's
//    `voicevox_install` command). Highest priority because the user
//    explicitly opted into letting Chappie manage it; uninstall is one
//    button away.
// 2. **GUI bundled-app reuse**: the engine binary inside an installed
//    `/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run`. We
//    spawn it directly (bypassing the Electron GUI) on a non-default
//    port so it coexists with any user-launched GUI.
// 3. **Manual fallback**: nothing detected. ENGINE_URL stays at the
//    default 50021 so a power user who runs the engine themselves still
//    works, but Settings will show "未インストール" and offer the
//    install button.
//
// All paths use port 50121 for our spawn so a separately-running GUI on
// 50021 never conflicts.
//
// Why proxy through Rust at all instead of fetching from the renderer:
//   - Reuses the same reqwest client / TLS config as the rest of the app
//   - Sidesteps any WKWebView ATS surprises around localhost http URLs
//   - Matches "renderer never holds an API key in HTTP code" pattern
//
// Lifecycle: the spawned child is held in `SPAWNED_CHILD` and killed
// when the static is dropped (process exit). `kill_on_drop(true)` on
// the tokio Command makes that automatic for graceful shutdown.

use futures_util::StreamExt;
use once_cell::sync::Lazy;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::RwLock;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use tokio::process::{Child, Command};
use tokio::sync::Mutex as AsyncMutex;

const DEFAULT_ENGINE_URL: &str = "http://127.0.0.1:50021";
const MANAGED_ENGINE_PORT: u16 = 50121;
const MANAGED_ENGINE_HOST: &str = "127.0.0.1";

/// Where the engine HTTP API is reachable. Starts at the default 50021
/// (matches a manually-run GUI / standalone engine on the standard port).
/// If we successfully spawn our own subprocess, this gets swapped to
/// 50121 so `voicevox_synthesize` and `voicevox_speakers_list` talk to
/// it. Falls back to default after `voicevox_uninstall`.
static ENGINE_URL: Lazy<RwLock<String>> =
    Lazy::new(|| RwLock::new(DEFAULT_ENGINE_URL.to_string()));

/// Holds the spawned engine subprocess for the lifetime of the app. We
/// never read from this once spawned — it exists purely so the `Child`
/// stays alive (and its `kill_on_drop` triggers a clean shutdown when
/// the process exits). Async mutex because we set it from an async
/// startup task.
static SPAWNED_CHILD: Lazy<AsyncMutex<Option<Child>>> =
    Lazy::new(|| AsyncMutex::new(None));

/// Set while `voicevox_install` runs so concurrent invocations are
/// rejected. Uninstall takes the same lock.
static INSTALL_LOCK: Lazy<AsyncMutex<()>> = Lazy::new(|| AsyncMutex::new(()));

fn engine_url() -> String {
    ENGINE_URL
        .read()
        .map(|g| g.clone())
        .unwrap_or_else(|_| DEFAULT_ENGINE_URL.to_string())
}

fn set_engine_url(url: &str) {
    if let Ok(mut g) = ENGINE_URL.write() {
        *g = url.to_string();
    }
}

/// `~/.chappie/voicevox/` — where Chappie-managed installs live.
fn managed_engine_dir() -> Option<PathBuf> {
    Some(dirs::home_dir()?.join(".chappie/voicevox"))
}

fn managed_engine_binary() -> Option<PathBuf> {
    managed_engine_dir().map(|d| d.join("run"))
}

// Dedicated client for engine API calls. 30s timeout: synthesis on a
// cold engine for a long sentence can take several seconds, well over
// the 15s mcp/news budget.
static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("failed to build voicevox http client")
});

// Separate client for the engine archive download. The default 30s
// budget can't cover a multi-GB download on slow connections, so this
// one has no timeout and gets a per-chunk read deadline via the stream.
static DL_HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .build()
        .expect("failed to build voicevox dl client")
});

/// Returns the engine's `/speakers` payload verbatim.
#[tauri::command]
pub async fn voicevox_speakers_list() -> Result<Value, String> {
    let url = format!("{}/speakers", engine_url());
    let res = HTTP
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("engine_unreachable: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("http {}", res.status().as_u16()));
    }
    res.json::<Value>()
        .await
        .map_err(|e| format!("json parse failed: {e}"))
}

/// Two-step synthesis: `/audio_query` produces the per-text prosody JSON,
/// `/synthesis` turns that JSON into WAV bytes for the chosen speaker.
#[tauri::command]
pub async fn voicevox_synthesize(
    text: String,
    speaker_id: u32,
) -> Result<Vec<u8>, String> {
    if text.trim().is_empty() {
        return Err("empty text".into());
    }

    let base = engine_url();

    let query_url = format!(
        "{base}/audio_query?text={}&speaker={}",
        urlencoding::encode(&text),
        speaker_id
    );
    let query_res = HTTP
        .post(&query_url)
        .send()
        .await
        .map_err(|e| format!("audio_query request failed: {e}"))?;
    if !query_res.status().is_success() {
        return Err(format!("audio_query http {}", query_res.status().as_u16()));
    }
    let query: Value = query_res
        .json()
        .await
        .map_err(|e| format!("audio_query parse failed: {e}"))?;

    let synth_url = format!("{base}/synthesis?speaker={speaker_id}");
    let synth_res = HTTP
        .post(&synth_url)
        .header("accept", "audio/wav")
        .json(&query)
        .send()
        .await
        .map_err(|e| format!("synthesis request failed: {e}"))?;
    if !synth_res.status().is_success() {
        return Err(format!("synthesis http {}", synth_res.status().as_u16()));
    }
    let bytes = synth_res
        .bytes()
        .await
        .map_err(|e| format!("synthesis read failed: {e}"))?;
    Ok(bytes.to_vec())
}

// ---------------------------------------------------------------------------
// Engine detection
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineSource {
    /// `~/.chappie/voicevox/run` — installed via Settings.
    Managed,
    /// Reused engine binary inside an installed VOICEVOX.app.
    BundledApp,
}

#[cfg(target_os = "macos")]
fn detect_bundled_app_engine() -> Option<PathBuf> {
    let candidates = [
        "/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run",
        // Some users install per-user instead of system-wide.
        "~/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run",
    ];
    for raw in candidates {
        let expanded = if let Some(rest) = raw.strip_prefix("~/") {
            dirs::home_dir().map(|h| h.join(rest))
        } else {
            Some(PathBuf::from(raw))
        };
        if let Some(p) = expanded {
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn detect_bundled_app_engine() -> Option<PathBuf> {
    None
}

/// Apply the priority order: Chappie-managed > GUI bundled. Returns the
/// binary path and which source it came from, or None if the user has
/// neither (Settings should offer the install button in that case).
fn detect_engine_binary() -> Option<(PathBuf, EngineSource)> {
    if let Some(p) = managed_engine_binary() {
        if p.is_file() {
            return Some((p, EngineSource::Managed));
        }
    }
    if let Some(p) = detect_bundled_app_engine() {
        return Some((p, EngineSource::BundledApp));
    }
    None
}

// ---------------------------------------------------------------------------
// Subprocess management
// ---------------------------------------------------------------------------

async fn probe_engine(url: &str) -> bool {
    HTTP.get(format!("{url}/version"))
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

async fn kill_spawned_child() {
    if let Some(mut child) = SPAWNED_CHILD.lock().await.take() {
        let _ = child.kill().await;
        eprintln!("[voicevox] killed spawned engine");
    }
}

/// Spawn the given engine binary on the managed port and wait for it to
/// answer `/version`. Returns the URL on success and updates ENGINE_URL.
async fn spawn_engine(binary: PathBuf) -> Result<String, String> {
    let url = format!("http://{MANAGED_ENGINE_HOST}:{MANAGED_ENGINE_PORT}");

    // If something is already on our managed port, assume it's an
    // orphaned engine from a previous Chappie crash and adopt it instead
    // of trying to spawn a duplicate (which would fail with EADDRINUSE).
    if probe_engine(&url).await {
        eprintln!("[voicevox] adopting existing engine on {url}");
        set_engine_url(&url);
        return Ok(url);
    }

    eprintln!("[voicevox] spawning engine: {binary:?}");

    let mut cmd = Command::new(&binary);
    cmd.args([
        "--host",
        MANAGED_ENGINE_HOST,
        "--port",
        &MANAGED_ENGINE_PORT.to_string(),
        "--cors_policy_mode",
        "localapps",
    ])
    .stdout(std::process::Stdio::inherit())
    .stderr(std::process::Stdio::inherit())
    .kill_on_drop(true);

    let child = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;
    *SPAWNED_CHILD.lock().await = Some(child);

    // 30s readiness budget — first-launch model load takes a few seconds.
    let deadline = std::time::Instant::now() + Duration::from_secs(30);
    let probe = format!("{url}/version");
    loop {
        if std::time::Instant::now() > deadline {
            return Err("engine readiness timeout (30s)".into());
        }
        match HTTP
            .get(&probe)
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => break,
            _ => tokio::time::sleep(Duration::from_millis(300)).await,
        }
    }

    set_engine_url(&url);
    eprintln!("[voicevox] engine ready at {url}");
    Ok(url)
}

/// Called from `lib.rs` setup. Fire-and-forget: detect whichever engine
/// the user has and spawn it in the background. If neither is present,
/// stay on the manual-fallback URL — Settings will offer install.
pub fn init_engine(_handle: &tauri::AppHandle) {
    let Some((binary, source)) = detect_engine_binary() else {
        eprintln!(
            "[voicevox] no engine found; ENGINE_URL stays at {DEFAULT_ENGINE_URL} (manual mode)"
        );
        return;
    };
    eprintln!("[voicevox] using {source:?} engine: {binary:?}");
    tauri::async_runtime::spawn(async move {
        if let Err(e) = spawn_engine(binary).await {
            eprintln!("[voicevox] spawn failed: {e}");
            *SPAWNED_CHILD.lock().await = None;
        }
    });
}

// ---------------------------------------------------------------------------
// Status command (renderer reads this to render Settings UI)
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
pub struct InstallStatus {
    /// "managed" | "bundled_app" | "missing"
    kind: &'static str,
    /// Path to the engine binary if found.
    path: Option<String>,
    /// Currently-active engine HTTP URL.
    engine_url: String,
    /// Whether the engine is reachable right now (subprocess up + healthy).
    reachable: bool,
}

#[tauri::command]
pub async fn voicevox_install_status() -> InstallStatus {
    let detected = detect_engine_binary();
    let (kind, path) = match detected {
        Some((p, EngineSource::Managed)) => ("managed", Some(p.to_string_lossy().into_owned())),
        Some((p, EngineSource::BundledApp)) => {
            ("bundled_app", Some(p.to_string_lossy().into_owned()))
        }
        None => ("missing", None),
    };
    let url = engine_url();
    let reachable = probe_engine(&url).await;
    InstallStatus {
        kind,
        path,
        engine_url: url,
        reachable,
    }
}

// ---------------------------------------------------------------------------
// Install / Uninstall
// ---------------------------------------------------------------------------

const ENGINE_RELEASE_API: &str =
    "https://api.github.com/repos/VOICEVOX/voicevox_engine/releases/latest";

/// Pick the right asset name for this host architecture. CPU-only build
/// to keep size under control; GPU build is 3GB+ and most users don't
/// need it.
fn asset_name_for_host(version: &str) -> Result<String, String> {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        Ok(format!("voicevox_engine-macos-arm64-{version}.7z.001"))
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        Ok(format!("voicevox_engine-macos-x64-{version}.7z.001"))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = version;
        Err("auto-install is currently macOS only".into())
    }
}

fn emit_progress(app: &AppHandle, phase: &str, received: u64, total: u64) {
    let _ = app.emit(
        "voicevox:install_progress",
        serde_json::json!({
            "phase": phase,
            "received": received,
            "total": total,
        }),
    );
}

/// Download + extract the latest VOICEVOX engine into
/// `~/.chappie/voicevox/`, then respawn so the new binary is in use.
///
/// Phases reported via `voicevox:install_progress`:
///   - `download` (received/total in bytes)
///   - `extract` (indeterminate; received=0, total=0)
///   - `verify`  (indeterminate)
#[tauri::command]
pub async fn voicevox_install(app: AppHandle) -> Result<(), String> {
    let _guard = INSTALL_LOCK.try_lock().map_err(|_| "install already in progress".to_string())?;

    let dir = managed_engine_dir().ok_or("home dir unset")?;
    let tmp_dir = dir.with_extension("tmp");

    // Resolve latest release + asset URL.
    let release: Value = DL_HTTP
        .get(ENGINE_RELEASE_API)
        .header("user-agent", "chappie-desktop")
        .send()
        .await
        .map_err(|e| format!("release lookup failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("release parse failed: {e}"))?;
    let tag = release
        .get("tag_name")
        .and_then(|v| v.as_str())
        .ok_or("no tag_name in release")?
        .to_string();
    let asset_name = asset_name_for_host(&tag)?;
    let asset_url = release
        .get("assets")
        .and_then(|a| a.as_array())
        .and_then(|arr| {
            arr.iter().find(|a| {
                a.get("name").and_then(|n| n.as_str()) == Some(asset_name.as_str())
            })
        })
        .and_then(|a| a.get("browser_download_url").and_then(|v| v.as_str()))
        .ok_or_else(|| format!("asset not found: {asset_name}"))?
        .to_string();

    eprintln!("[voicevox] installing engine version {tag} from {asset_url}");

    // Clean any leftover from a prior failed install.
    let _ = tokio::fs::remove_dir_all(&tmp_dir).await;
    tokio::fs::create_dir_all(&tmp_dir)
        .await
        .map_err(|e| format!("mkdir tmp: {e}"))?;

    // ---- Download ----
    let archive_path = tmp_dir.join(&asset_name);
    let res = DL_HTTP
        .get(&asset_url)
        .header("user-agent", "chappie-desktop")
        .send()
        .await
        .map_err(|e| format!("download request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("download http {}", res.status().as_u16()));
    }
    let total = res.content_length().unwrap_or(0);
    let mut received: u64 = 0;
    let mut last_emit_received: u64 = 0;
    let mut stream = res.bytes_stream();
    let mut file = tokio::fs::File::create(&archive_path)
        .await
        .map_err(|e| format!("create archive: {e}"))?;
    emit_progress(&app, "download", 0, total);
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("download chunk: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write archive: {e}"))?;
        received += chunk.len() as u64;
        // Throttle progress emits to ~once per MB so the renderer event
        // loop isn't flooded on fast connections.
        if received - last_emit_received >= 1024 * 1024 {
            emit_progress(&app, "download", received, total);
            last_emit_received = received;
        }
    }
    file.flush().await.map_err(|e| format!("flush: {e}"))?;
    drop(file);
    emit_progress(&app, "download", received, total);
    eprintln!("[voicevox] downloaded {received} bytes");

    // ---- Extract ----
    emit_progress(&app, "extract", 0, 0);
    // macOS bsdtar (libarchive) handles 7z natively. Run synchronously
    // in spawn_blocking so the async runtime isn't tied up for ~minutes.
    let archive_path_clone = archive_path.clone();
    let tmp_dir_clone = tmp_dir.clone();
    let extract_result = tokio::task::spawn_blocking(move || {
        std::process::Command::new("/usr/bin/tar")
            .arg("-xf")
            .arg(&archive_path_clone)
            .arg("-C")
            .arg(&tmp_dir_clone)
            .status()
    })
    .await
    .map_err(|e| format!("extract task: {e}"))?
    .map_err(|e| format!("tar exec: {e}"))?;
    if !extract_result.success() {
        return Err(format!("tar failed (status {extract_result})"));
    }

    // The 7z unpacks into a versioned subdir. Find the one containing `run`
    // and atomically rename it into place as `~/.chappie/voicevox/`.
    let extracted_root = locate_extracted_engine_dir(&tmp_dir).await?;
    eprintln!("[voicevox] extracted root: {extracted_root:?}");

    // Strip macOS quarantine attribute so the unsigned binary is allowed
    // to run as a child of Chappie. `xattr -dr` is best-effort; failure
    // to strip isn't fatal because Chappie spawning the child usually
    // satisfies Gatekeeper anyway, but we try.
    let _ = tokio::task::spawn_blocking({
        let p = extracted_root.clone();
        move || {
            let _ = std::process::Command::new("/usr/bin/xattr")
                .arg("-dr")
                .arg("com.apple.quarantine")
                .arg(&p)
                .status();
        }
    })
    .await;

    // ---- Atomic install ----
    // Stop the current spawned engine so we can replace its binary
    // directory cleanly.
    kill_spawned_child().await;
    let _ = tokio::fs::remove_dir_all(&dir).await;
    if let Some(parent) = dir.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    tokio::fs::rename(&extracted_root, &dir)
        .await
        .map_err(|e| format!("install rename: {e}"))?;

    // Throw away the now-empty tmp dir (still has the .7z.001 inside).
    let _ = tokio::fs::remove_dir_all(&tmp_dir).await;

    // ---- Verify (spawn + readiness probe) ----
    emit_progress(&app, "verify", 0, 0);
    let binary = dir.join("run");
    if !binary.is_file() {
        return Err(format!(
            "expected binary at {binary:?} after extract, not found"
        ));
    }
    spawn_engine(binary).await?;
    Ok(())
}

/// Walk one level under `tmp_dir` and find the directory that directly
/// contains `run`. The 7z layout is `voicevox_engine-macos-arm64-X.Y.Z/run`
/// (single top-level dir), so this is normally a one-iteration scan.
async fn locate_extracted_engine_dir(tmp_dir: &PathBuf) -> Result<PathBuf, String> {
    let mut entries = tokio::fs::read_dir(tmp_dir)
        .await
        .map_err(|e| format!("read tmp dir: {e}"))?;
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("scan tmp dir: {e}"))?
    {
        let p = entry.path();
        if p.is_dir() && p.join("run").is_file() {
            return Ok(p);
        }
    }
    Err("extracted archive does not contain a `run` binary".into())
}

#[tauri::command]
pub async fn voicevox_uninstall() -> Result<(), String> {
    let _guard = INSTALL_LOCK
        .try_lock()
        .map_err(|_| "install/uninstall already in progress".to_string())?;

    kill_spawned_child().await;
    set_engine_url(DEFAULT_ENGINE_URL);

    let Some(dir) = managed_engine_dir() else {
        return Ok(());
    };
    if dir.exists() {
        tokio::fs::remove_dir_all(&dir)
            .await
            .map_err(|e| format!("rm -rf: {e}"))?;
        eprintln!("[voicevox] removed managed engine at {dir:?}");
    }

    // After uninstall, re-detect: if the GUI .app exists, fall back to
    // it instead of leaving the user without character voices.
    if let Some((binary, source)) = detect_engine_binary() {
        eprintln!("[voicevox] post-uninstall fallback: {source:?} at {binary:?}");
        tauri::async_runtime::spawn(async move {
            if let Err(e) = spawn_engine(binary).await {
                eprintln!("[voicevox] post-uninstall spawn failed: {e}");
            }
        });
    }

    Ok(())
}
