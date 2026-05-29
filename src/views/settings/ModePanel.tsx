import { useT } from "../../i18n/useT";
import type { Mode } from "../../lib/settings";
import styles from "../SettingsView.module.css";

// Mode (Free / Pro / BYOK). The selected mode reveals its own config in
// AccountPanel below the radio — Pro shows magic-link sign-in /
// subscription status, BYOK shows the API key input, Free has nothing
// else to configure.
export function ModePanel({
  mode,
  setMode,
  entitled,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  entitled: boolean;
}) {
  const { t } = useT();
  return (
    <div className={styles.group}>
      {/* Horizontal radios — 3 mutually-exclusive options fit
          comfortably on one row and visually weigh less than the
          stacked layout. Free is disabled while the user has an entitled
          subscription — paying and falling back to the 5/day quota would
          be a UX foot-gun. */}
      <div className={styles.groupRow}>
        <span className={styles.groupRowLabel}>{t("settings.modeLabel")}</span>
        <div
          className={styles.groupRowActions}
          style={{ gap: 16, flexWrap: "wrap" }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              opacity: entitled ? 0.5 : 1,
            }}
          >
            <input
              type="radio"
              name="mode"
              value="free"
              checked={mode === "free"}
              disabled={entitled}
              onChange={() => setMode("free")}
            />
            {t("settings.modeFree")}
          </label>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <input
              type="radio"
              name="mode"
              value="paid"
              checked={mode === "paid"}
              onChange={() => setMode("paid")}
            />
            {t("settings.modePaid")}
          </label>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <input
              type="radio"
              name="mode"
              value="byok"
              checked={mode === "byok"}
              onChange={() => setMode("byok")}
            />
            {t("settings.modeByok")}
          </label>
        </div>
      </div>
      <div className={styles.groupBlock}>
        <p className={styles.note} style={{ marginTop: 0 }}>
          {mode === "free"
            ? t("settings.modeFreeNote")
            : mode === "paid"
              ? t("settings.modePaidNote")
              : t("settings.modeByokNote")}
        </p>
      </div>
    </div>
  );
}
