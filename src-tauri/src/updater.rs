use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

/// Check for an update, prompt the user via a window-independent dialog,
/// and download/install if confirmed. Mirrors Galopen's pattern: doing this
/// in Rust avoids the JS `ask()` API forcing the hidden main window visible
/// (it attaches to `getCurrentWindow()` as a sheet on macOS).
pub async fn check_for_updates(app: AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[updater] init failed: {e}");
            return;
        }
    };

    let update = match updater.check().await {
        Ok(Some(u)) => u,
        Ok(None) => {
            crate::tray::set_update_available(false);
            return;
        }
        Err(e) => {
            eprintln!("[updater] check failed: {e}");
            return;
        }
    };

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
        // Leave a 🔔 in the tray title so the user doesn't lose track of it.
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
