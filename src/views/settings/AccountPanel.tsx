import type { UseSubscriptionResult } from "../../hooks/useSubscription";
import { useT } from "../../i18n/useT";
import { detectProvider, providerLabel } from "../../lib/provider";
import type { Mode } from "../../lib/settings";
import styles from "../SettingsView.module.css";

// Account group — everything tied to the user's identity: Pro sign-in /
// status (visible when on the Paid radio OR already signed in), plus the
// BYOK API key input. Both panels can coexist for a Pro subscriber who
// prefers BYOK for chat.
export function AccountPanel({
  mode,
  apiKey,
  setApiKey,
  sub,
}: {
  mode: Mode;
  apiKey: string;
  setApiKey: (v: string) => void;
  sub: UseSubscriptionResult;
}) {
  const { t } = useT();
  if (!(mode === "paid" || mode === "byok" || !!sub.email)) return null;

  return (
    <div className={styles.group}>
      {(mode === "paid" || !!sub.email) && (
        <div
          className={styles.groupBlock}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {!sub.email ? (
            <>
              <p className={styles.note} style={{ marginTop: 0 }}>
                {t("settings.subscriptionSignedOut")}
              </p>
              <input
                type="email"
                className={styles.input}
                value={sub.emailInput}
                onChange={(e) => sub.setEmailInput(e.target.value)}
                placeholder={t("settings.subscriptionEmailPlaceholder")}
                autoComplete="email"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={sub.sendMagicLink}
                disabled={
                  sub.busy === "sending" || !sub.emailInput.includes("@")
                }
                style={{ alignSelf: "flex-end" }}
              >
                {t("settings.subscriptionSendMagicLink")}
              </button>
              {sub.notice === "sent" && (
                <p className={styles.note} style={{ marginTop: 0 }}>
                  {t("settings.subscriptionMagicLinkSent")}
                </p>
              )}
              {sub.notice === "send_error" && (
                <p className={styles.note} style={{ marginTop: 0 }}>
                  {t("settings.subscriptionSendError")}
                </p>
              )}
            </>
          ) : sub.status === "active" || sub.status === "trialing" ? (
            /* Active subscriber: collapse status + buttons into a single
               row. Email on the left, Pro badge + renewal date next to
               it, manage / sign-out buttons right-aligned. */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13 }}>{sub.email}</span>
                <span
                  className={styles.note}
                  style={{ marginTop: 2, color: "#2a7a2a" }}
                >
                  ✓ {t("settings.subscriptionProActive")}
                  {sub.periodEnd &&
                    ` · ${t("settings.subscriptionPeriodEnd", {
                      date: sub.periodEnd.slice(0, 10),
                    })}`}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={sub.manage}
                  disabled={sub.busy === "portal"}
                >
                  {t("settings.subscriptionManage")}
                </button>
                <button
                  type="button"
                  onClick={sub.signOut}
                  disabled={sub.busy !== "idle"}
                >
                  {t("settings.subscriptionSignOut")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className={styles.note} style={{ marginTop: 0 }}>
                {t("settings.subscriptionStatusFreeNote")}
              </p>
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <button
                  type="button"
                  onClick={sub.upgrade}
                  disabled={sub.busy === "checkout"}
                >
                  {sub.busy === "checkout"
                    ? t("settings.subscriptionUpgrading")
                    : t("settings.subscriptionUpgrade")}
                </button>
                <button
                  type="button"
                  onClick={sub.signOut}
                  disabled={sub.busy !== "idle"}
                >
                  {t("settings.subscriptionSignOut")}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* BYOK panel: API key input + provider detection hint. */}
      {mode === "byok" && (
        <div className={styles.groupBlock}>
          <input
            id="api-key"
            type="password"
            className={styles.input}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("settings.apiKeyPlaceholder")}
          />
          {(() => {
            const trimmed = apiKey.trim();
            if (!trimmed) {
              return <p className={styles.note}>{t("settings.apiKeyNote")}</p>;
            }
            const provider = detectProvider(trimmed);
            if (provider) {
              return (
                <p className={styles.note}>
                  {t("settings.apiKeyDetected", {
                    provider: providerLabel(provider),
                  })}
                </p>
              );
            }
            return <p className={styles.note}>{t("settings.apiKeyUnknown")}</p>;
          })()}
        </div>
      )}
    </div>
  );
}
