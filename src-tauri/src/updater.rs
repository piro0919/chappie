use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

/// How often the background ticker re-checks for updates while the app is running.
const PERIODIC_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

/// Trigger context for an update check. Decides whether a "no update" /
/// "found one" result should produce a dialog or just a tray badge.
#[derive(Clone, Copy)]
pub enum CheckTrigger {
    /// App startup. If an update exists, show the prompt immediately.
    /// If none, stay silent.
    Launch,
    /// 6h background timer. Never interrupts with a dialog — only flips the
    /// 🔔 tray badge so the user can act on their own time.
    Periodic,
    /// User clicked "アップデートを確認" in the tray menu. Always shows a
    /// dialog (including a "you're up to date" toast) since they asked.
    Manual,
}

pub async fn check_for_updates(app: AppHandle, trigger: CheckTrigger) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[updater] init failed: {e}");
            if matches!(trigger, CheckTrigger::Manual) {
                app.dialog()
                    .message(format!("アップデーターを初期化できませんでした。\n{e}"))
                    .title("アップデート")
                    .blocking_show();
            }
            return;
        }
    };

    let update = match updater.check().await {
        Ok(Some(u)) => u,
        Ok(None) => {
            crate::tray::set_update_available(false);
            if matches!(trigger, CheckTrigger::Manual) {
                app.dialog()
                    .message("お使いのバージョンは最新です。")
                    .title("アップデート")
                    .blocking_show();
            }
            return;
        }
        Err(e) => {
            eprintln!("[updater] check failed: {e}");
            if matches!(trigger, CheckTrigger::Manual) {
                app.dialog()
                    .message(format!("確認に失敗しました。\n{e}"))
                    .title("アップデート")
                    .blocking_show();
            }
            return;
        }
    };

    // Periodic ticks should never interrupt — just flag the tray and bail.
    if matches!(trigger, CheckTrigger::Periodic) {
        crate::tray::set_update_available(true);
        return;
    }

    let title = "アップデート";
    let msg = format!(
        "新しいバージョン v{} が利用可能です。\nアップデートしますか？",
        update.version
    );

    let confirmed = app
        .dialog()
        .message(msg)
        .title(title)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "OK".to_string(),
            "キャンセル".to_string(),
        ))
        .blocking_show();

    if !confirmed {
        crate::tray::set_update_available(true);
        return;
    }

    let bytes = match update.download(|_, _| {}, || {}).await {
        Ok(b) => b,
        Err(e) => {
            app.dialog()
                .message(format!("ダウンロードに失敗しました。\n{e}"))
                .title(title)
                .blocking_show();
            return;
        }
    };

    match update.install(bytes) {
        Ok(_) => {
            app.dialog()
                .message("アップデートが完了しました。\nアプリを自動で再起動します。")
                .title(title)
                .blocking_show();
            // Relaunch via `open` after exit — workaround for tauri macOS
            // restart bug (tauri-apps/tauri#13923). Mirrors Galopen.
            if let Ok(path) = std::env::current_exe() {
                if let Some(app_bundle) = path
                    .ancestors()
                    .find(|p| p.extension().is_some_and(|ext| ext == "app"))
                {
                    let _ = std::process::Command::new("sh")
                        .arg("-c")
                        .arg(format!("sleep 1 && open '{}'", app_bundle.display()))
                        .spawn();
                }
            }
            app.exit(0);
        }
        Err(e) => {
            app.dialog()
                .message(format!("インストールに失敗しました。\n{e}"))
                .title(title)
                .blocking_show();
        }
    }
}

/// Spawn a background task that re-checks for updates every `PERIODIC_INTERVAL`.
/// Found updates only set the tray badge; they never auto-prompt mid-session.
pub fn start_periodic_checker(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(PERIODIC_INTERVAL).await;
            check_for_updates(app.clone(), CheckTrigger::Periodic).await;
        }
    });
}
