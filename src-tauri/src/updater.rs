use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

use crate::i18n::Lang;

struct UpdaterStrings {
    title: &'static str,
    init_failed: fn(&str) -> String,
    up_to_date: &'static str,
    check_failed: fn(&str) -> String,
    available: fn(&str) -> String,
    ok: &'static str,
    cancel: &'static str,
    download_failed: fn(&str) -> String,
    install_failed: fn(&str) -> String,
    install_done: &'static str,
}

fn strings(lang: Lang) -> UpdaterStrings {
    match lang {
        Lang::Ja => UpdaterStrings {
            title: "アップデート",
            init_failed: |e| format!("アップデーターを初期化できませんでした。\n{e}"),
            up_to_date: "お使いのバージョンは最新です。",
            check_failed: |e| format!("確認に失敗しました。\n{e}"),
            available: |v| {
                format!("新しいバージョン v{v} が利用可能です。\nアップデートしますか？")
            },
            ok: "OK",
            cancel: "キャンセル",
            download_failed: |e| format!("ダウンロードに失敗しました。\n{e}"),
            install_failed: |e| format!("インストールに失敗しました。\n{e}"),
            install_done: "アップデートが完了しました。\nアプリを自動で再起動します。",
        },
        Lang::En => UpdaterStrings {
            title: "Update",
            init_failed: |e| format!("Couldn't initialize the updater.\n{e}"),
            up_to_date: "You're on the latest version.",
            check_failed: |e| format!("Update check failed.\n{e}"),
            available: |v| format!("Version v{v} is available.\nUpdate now?"),
            ok: "OK",
            cancel: "Cancel",
            download_failed: |e| format!("Download failed.\n{e}"),
            install_failed: |e| format!("Installation failed.\n{e}"),
            install_done: "Update complete.\nThe app will restart automatically.",
        },
        Lang::Es => UpdaterStrings {
            title: "Actualización",
            init_failed: |e| format!("No se pudo iniciar el actualizador.\n{e}"),
            up_to_date: "Estás en la última versión.",
            check_failed: |e| format!("La comprobación falló.\n{e}"),
            available: |v| format!("La versión v{v} está disponible.\n¿Actualizar ahora?"),
            ok: "OK",
            cancel: "Cancelar",
            download_failed: |e| format!("La descarga falló.\n{e}"),
            install_failed: |e| format!("La instalación falló.\n{e}"),
            install_done: "Actualización completada.\nLa app se reiniciará automáticamente.",
        },
        Lang::Fr => UpdaterStrings {
            title: "Mise à jour",
            init_failed: |e| format!("Impossible d'initialiser la mise à jour.\n{e}"),
            up_to_date: "Vous utilisez la dernière version.",
            check_failed: |e| format!("La vérification a échoué.\n{e}"),
            available: |v| format!("La version v{v} est disponible.\nMettre à jour ?"),
            ok: "OK",
            cancel: "Annuler",
            download_failed: |e| format!("Le téléchargement a échoué.\n{e}"),
            install_failed: |e| format!("L'installation a échoué.\n{e}"),
            install_done: "Mise à jour terminée.\nL'app va redémarrer automatiquement.",
        },
        Lang::De => UpdaterStrings {
            title: "Update",
            init_failed: |e| format!("Updater konnte nicht initialisiert werden.\n{e}"),
            up_to_date: "Du verwendest bereits die neueste Version.",
            check_failed: |e| format!("Update-Prüfung fehlgeschlagen.\n{e}"),
            available: |v| format!("Version v{v} ist verfügbar.\nJetzt aktualisieren?"),
            ok: "OK",
            cancel: "Abbrechen",
            download_failed: |e| format!("Download fehlgeschlagen.\n{e}"),
            install_failed: |e| format!("Installation fehlgeschlagen.\n{e}"),
            install_done: "Update abgeschlossen.\nDie App wird automatisch neu gestartet.",
        },
        Lang::Zh => UpdaterStrings {
            title: "更新",
            init_failed: |e| format!("无法初始化更新器。\n{e}"),
            up_to_date: "您已使用最新版本。",
            check_failed: |e| format!("检查失败。\n{e}"),
            available: |v| format!("发现新版本 v{v}。\n现在更新吗?"),
            ok: "确定",
            cancel: "取消",
            download_failed: |e| format!("下载失败。\n{e}"),
            install_failed: |e| format!("安装失败。\n{e}"),
            install_done: "更新完成。\n应用将自动重启。",
        },
    }
}

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
    let s = strings(crate::i18n::current());
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[updater] init failed: {e}");
            if matches!(trigger, CheckTrigger::Manual) {
                app.dialog()
                    .message((s.init_failed)(&e.to_string()))
                    .title(s.title)
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
                    .message(s.up_to_date)
                    .title(s.title)
                    .blocking_show();
            }
            return;
        }
        Err(e) => {
            eprintln!("[updater] check failed: {e}");
            if matches!(trigger, CheckTrigger::Manual) {
                app.dialog()
                    .message((s.check_failed)(&e.to_string()))
                    .title(s.title)
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

    let confirmed = app
        .dialog()
        .message((s.available)(&update.version))
        .title(s.title)
        .buttons(MessageDialogButtons::OkCancelCustom(
            s.ok.to_string(),
            s.cancel.to_string(),
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
                .message((s.download_failed)(&e.to_string()))
                .title(s.title)
                .blocking_show();
            return;
        }
    };

    match update.install(bytes) {
        Ok(_) => {
            app.dialog()
                .message(s.install_done)
                .title(s.title)
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
                .message((s.install_failed)(&e.to_string()))
                .title(s.title)
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
