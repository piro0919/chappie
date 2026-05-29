import { useT } from "../../i18n/useT";
import styles from "../SettingsView.module.css";

// SwitchBot credentials — optional, advanced. Collapsed because most users
// won't have SwitchBot hardware; those who do enter the token + secret from
// the app's Developer Options once. Both are password inputs (the secret in
// particular must not be shoulder-surfable). Read by Rust from the store; an
// empty value leaves the switchbot tools returning not_configured.
export function SwitchbotPanel({
  token,
  setToken,
  secret,
  setSecret,
}: {
  token: string;
  setToken: (v: string) => void;
  secret: string;
  setSecret: (v: string) => void;
}) {
  const { t } = useT();
  return (
    <div className={styles.group}>
      <details className={styles.groupBlock}>
        <summary className={styles.groupRowLabel}>
          {t("settings.switchbotLabel")}
        </summary>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <input
            type="password"
            className={styles.input}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("settings.switchbotTokenPlaceholder")}
          />
          <input
            type="password"
            className={styles.input}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("settings.switchbotSecretPlaceholder")}
          />
          <p className={styles.note} style={{ marginTop: 0 }}>
            {t("settings.switchbotDescription")}
          </p>
          {/* The token is obtained inside the SwitchBot phone app; surface
              the exact taps in a nested accordion so they're there when
              needed without cluttering the panel. */}
          <details>
            <summary className={styles.note} style={{ cursor: "pointer" }}>
              {t("settings.switchbotStepsLabel")}
            </summary>
            <p
              className={styles.note}
              style={{ marginTop: 4, whiteSpace: "pre-line" }}
            >
              {t("settings.switchbotSteps")}
            </p>
          </details>
        </div>
      </details>
    </div>
  );
}
