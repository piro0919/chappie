import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ask } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { useT } from "../../i18n/useT";
import { IpcEvent } from "../../lib/ipc-events";
import styles from "../SettingsView.module.css";

// Long-term memory (RAG) — opt-in download + privacy-safe wipe. The
// description is retained because the 470MB download is a real decision
// the user needs context on. Fully self-contained: enabled status,
// download progress, and the forget / disable actions all live here.
type LtmPhase =
  | { kind: "idle" }
  | { kind: "downloading"; pct: number }
  | { kind: "wiping" };

export function LtmPanel() {
  const { t } = useT();
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<LtmPhase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [forgetDoneAt, setForgetDoneAt] = useState(0);

  async function refresh() {
    try {
      setEnabled(await invoke<boolean>("embedding_model_status"));
    } catch {}
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: init runs once
  useEffect(() => {
    void refresh();
    // Long-term-memory model download progress. Two files (model +
    // tokenizer) stream over the same channel; the model file is the
    // overwhelming majority of bytes so we just track aggregate pct.
    let unlisten: (() => void) | undefined;
    void listen<{ kind: string; received: number; total: number }>(
      IpcEvent.embeddingModelProgress,
      (e) => {
        const { received, total } = e.payload;
        const pct = total > 0 ? Math.round((received / total) * 100) : 0;
        setPhase({ kind: "downloading", pct });
      },
    ).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  async function onEnable() {
    setError(null);
    setPhase({ kind: "downloading", pct: 0 });
    try {
      await invoke("ensure_embedding_model");
      await refresh();
      setPhase({ kind: "idle" });
    } catch (e) {
      setError(String(e));
      setPhase({ kind: "idle" });
    }
  }

  async function onForget() {
    if (!(await ask(t("settings.ltmForgetConfirm")))) return;
    setError(null);
    setPhase({ kind: "wiping" });
    try {
      await invoke("forget_long_term_memory");
      setForgetDoneAt(Date.now());
      setPhase({ kind: "idle" });
    } catch (e) {
      setError(String(e));
      setPhase({ kind: "idle" });
    }
  }

  async function onDisable() {
    if (!(await ask(t("settings.ltmDisableConfirm")))) return;
    setError(null);
    try {
      await invoke("remove_embedding_model");
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className={styles.group}>
      <div className={styles.groupRow}>
        <span className={styles.groupRowLabel}>{t("settings.ltmLabel")}</span>
        <div className={styles.groupRowActions}>
          <span
            className={`${styles.badge} ${
              enabled ? styles.badgeGranted : styles.badgeNeutral
            }`}
          >
            <span className={styles.badgeDot} />
            {enabled
              ? t("settings.ltmStatusEnabled")
              : t("settings.ltmStatusDisabled")}
          </span>
          {!enabled ? (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onEnable}
              disabled={phase.kind !== "idle"}
            >
              {phase.kind === "downloading"
                ? t("settings.ltmEnabling")
                : t("settings.ltmEnable")}
            </button>
          ) : (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onDisable}
              disabled={phase.kind !== "idle"}
            >
              {t("settings.ltmDisable")}
            </button>
          )}
        </div>
      </div>
      <div className={styles.groupBlock}>
        {phase.kind === "downloading" && (
          <p className={styles.note}>
            {t("settings.ltmEnableDownloadProgress", {
              pct: String(phase.pct),
            })}
          </p>
        )}
        {error && <p className={styles.note}>{error}</p>}
        {forgetDoneAt > 0 && Date.now() - forgetDoneAt < 5000 && (
          <p className={styles.note}>{t("settings.ltmForgetDone")}</p>
        )}
        <div className={styles.actions} style={{ marginTop: 8 }}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onForget}
            disabled={phase.kind !== "idle"}
          >
            {t("settings.ltmForget")}
          </button>
        </div>
      </div>
    </div>
  );
}
