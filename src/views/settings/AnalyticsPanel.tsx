import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useT } from "../../i18n/useT";
import type { Mode } from "../../lib/settings";
import styles from "../SettingsView.module.css";

interface AnalyticsEvent {
  ts_unix: number;
  utterance: string;
  tool_calls: string[];
  lang: string;
  mode: string;
  success: boolean;
}

// Usage analytics — opt-in voice utterance + tool name sharing. Default
// OFF. Free-tier users get +10 daily quota as a thank-you; Pro / BYOK
// get the toggle for altruistic feedback. The consent value is persisted
// by the settings form, so it's a prop + setter; the recent-events
// preview and busy flag are local. Toggling fires the network consent
// invoke, then the form setter (which triggers the auto-save persist).
export function AnalyticsPanel({
  mode,
  entitled,
  analyticsConsent,
  setAnalyticsConsent,
}: {
  mode: Mode;
  entitled: boolean;
  analyticsConsent: boolean;
  setAnalyticsConsent: (v: boolean) => void;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<AnalyticsEvent[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);

  async function onToggleConsent(next: boolean) {
    // ON: explicit consent step before the toggle commits. Tier-aware
    // copy (Free gets the quota perk line, others get the plain ask),
    // with button labels matching the inviting tone instead of the
    // default OK / Cancel.
    if (next) {
      const msg =
        mode === "free"
          ? t("settings.analyticsConsentModalFree")
          : t("settings.analyticsConsentModalOther");
      const agreed = await ask(msg, {
        okLabel: t("settings.analyticsConsentOk"),
        cancelLabel: t("settings.analyticsConsentCancel"),
      });
      if (!agreed) return;
    }
    setBusy(true);
    try {
      await invoke("analytics_set_consent", { consent: next });
      setAnalyticsConsent(next);
    } catch (e) {
      console.warn("[settings] analytics consent toggle failed", e);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteHistory() {
    if (!(await ask(t("settings.analyticsDeleteConfirm")))) return;
    setBusy(true);
    try {
      await invoke("analytics_delete_history");
      setAnalyticsConsent(false);
      setRecent([]);
    } catch (e) {
      console.warn("[settings] analytics delete failed", e);
    } finally {
      setBusy(false);
    }
  }

  async function onRefreshRecent() {
    try {
      const r = await invoke<AnalyticsEvent[]>("analytics_recent_events");
      setRecent(r);
    } catch (e) {
      console.warn("[settings] analytics recent failed", e);
    }
  }

  return (
    <div className={styles.group}>
      <div className={styles.groupRow}>
        <span className={styles.groupRowLabel}>
          {t("settings.analyticsLabel")}
        </span>
        <div className={styles.groupRowActions}>
          <span
            className={`${styles.badge} ${
              analyticsConsent ? styles.badgeGranted : styles.badgeNeutral
            }`}
          >
            <span className={styles.badgeDot} />
            {analyticsConsent
              ? t("settings.analyticsStatusOn")
              : t("settings.analyticsStatusOff")}
          </span>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onToggleConsent(!analyticsConsent)}
            disabled={busy}
          >
            {analyticsConsent
              ? t("settings.analyticsTurnOff")
              : t("settings.analyticsTurnOn")}
          </button>
        </div>
      </div>
      <div className={styles.groupBlock}>
        <p className={styles.note}>
          {mode === "free"
            ? t("settings.analyticsDescriptionFree")
            : entitled
              ? t("settings.analyticsDescriptionPro")
              : t("settings.analyticsDescriptionByok")}
        </p>
        <div className={styles.actions} style={{ marginTop: 8, gap: 12 }}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              const next = !recentOpen;
              setRecentOpen(next);
              if (next) void onRefreshRecent();
            }}
          >
            {recentOpen
              ? t("settings.analyticsRecentHide")
              : t("settings.analyticsRecentShow")}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onDeleteHistory}
            disabled={busy}
          >
            {t("settings.analyticsDelete")}
          </button>
        </div>
        {recentOpen && (
          <div style={{ marginTop: 12 }}>
            {recent.length === 0 ? (
              <p className={styles.note}>
                {t("settings.analyticsRecentEmpty")}
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  fontSize: 12,
                }}
              >
                {recent.map((e) => (
                  <li
                    key={e.ts_unix}
                    style={{
                      padding: "6px 0",
                      borderTop: "1px solid var(--border-color, #eee)",
                    }}
                  >
                    <div style={{ opacity: 0.7 }}>
                      {new Date(e.ts_unix * 1000).toLocaleTimeString()} ·{" "}
                      {e.lang} · {e.mode} ·{" "}
                      {e.tool_calls.length === 0
                        ? "(chitchat)"
                        : e.tool_calls.join(", ")}
                    </div>
                    <div>{e.utterance}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
