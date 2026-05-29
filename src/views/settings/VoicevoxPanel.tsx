import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useT } from "../../i18n/useT";
import {
  getInstallStatus,
  type InstallKind,
  type InstallProgress,
  onInstallProgress,
  startInstall,
  uninstall,
} from "../../lib/voicevox-install";
import styles from "../SettingsView.module.css";

// VOICEVOX — Japanese only; the container only mounts this panel when
// the resolved UI language is Japanese. Self-contained: engine
// reachability, install kind, install/uninstall actions, and download
// progress all live here.
export function VoicevoxPanel() {
  const { t } = useT();
  const [status, setStatus] = useState<
    "checking" | "connected" | "unreachable"
  >("checking");
  const [installKind, setInstallKind] = useState<InstallKind | "checking">(
    "checking",
  );
  // null = idle. Otherwise the active install phase + progress.
  const [installProgress, setInstallProgress] =
    useState<InstallProgress | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setStatus("checking");
    try {
      await invoke("voicevox_speakers_list");
      setStatus("connected");
    } catch {
      setStatus("unreachable");
    }
    try {
      const s = await getInstallStatus();
      setInstallKind(s.kind);
    } catch {
      setInstallKind("missing");
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: init runs once
  useEffect(() => {
    void refresh();
    let unlisten: (() => void) | undefined;
    void onInstallProgress((p) => {
      setInstallProgress(p);
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  async function onInstall() {
    setBusy(true);
    setInstallError(null);
    setInstallProgress({ phase: "download", received: 0, total: 0 });
    try {
      await startInstall();
      await refresh();
    } catch (e) {
      setInstallError(String(e));
    } finally {
      setInstallProgress(null);
      setBusy(false);
    }
  }

  async function onUninstall() {
    setBusy(true);
    setInstallError(null);
    try {
      await uninstall();
      await refresh();
    } catch (e) {
      setInstallError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.group}>
      <div className={styles.groupRow}>
        <span className={styles.groupRowLabel}>
          {t("settings.voicevoxLabel")}
        </span>
        <div className={styles.groupRowActions}>
          <span
            className={`${styles.badge} ${
              installKind === "managed" || installKind === "bundled_app"
                ? styles.badgeGranted
                : styles.badgeNeutral
            }`}
          >
            <span className={styles.badgeDot} />
            {installKind === "managed"
              ? t("settings.voicevoxStatusManaged")
              : installKind === "bundled_app"
                ? t("settings.voicevoxStatusBundledApp")
                : installKind === "missing"
                  ? t("settings.voicevoxStatusMissing")
                  : t("settings.voicevoxStatusChecking")}
          </span>
          {installKind === "missing" && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onInstall}
              disabled={busy}
            >
              {busy
                ? t("settings.voicevoxInstalling")
                : t("settings.voicevoxInstall")}
            </button>
          )}
          {installKind === "managed" && (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onUninstall}
              disabled={busy}
            >
              {t("settings.voicevoxUninstall")}
            </button>
          )}
        </div>
      </div>
      {(installProgress || installError || status === "unreachable") && (
        <div className={styles.groupBlock}>
          {installProgress && (
            <p className={styles.note} style={{ marginTop: 0 }}>
              {installProgress.phase === "download"
                ? t("settings.voicevoxInstallProgress", {
                    received: (installProgress.received / 1024 / 1024).toFixed(
                      0,
                    ),
                    total:
                      installProgress.total > 0
                        ? (installProgress.total / 1024 / 1024).toFixed(0)
                        : "?",
                  })
                : installProgress.phase === "extract"
                  ? t("settings.voicevoxExtracting")
                  : t("settings.voicevoxVerifying")}
            </p>
          )}
          {installError && (
            <p className={styles.note} style={{ marginTop: 0 }}>
              {installError}
            </p>
          )}
          {status === "unreachable" && (
            <p className={styles.note} style={{ marginTop: 0 }}>
              {t("settings.voicevoxStatusUnreachable")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
