import { emit, listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { IpcEvent } from "../lib/ipc-events";
import { loadSettings, type SubscriptionStatus } from "../lib/settings";
import {
  installDeepLinkHandler,
  openCheckout,
  openPortal,
  refreshStatus,
  restoreSession,
  sendMagicLink,
  signOut as supabaseSignOut,
} from "../lib/supabase-client";

// Owns everything about the user's Pro identity: the cached email /
// status / renewal date, the magic-link sign-in flow, checkout / portal
// launches, and sign-out. Also keeps the cached state fresh by listening
// for settings:updated (the post-checkout deep link is handled by
// ConversationWorker, webhooks update Supabase) and by installing a
// window-scoped deep-link handler.
//
// Lifted out of SettingsView because subscription state is read across
// several panels (the Mode radio disables Free while entitled, the
// Account panel renders sign-in / status, the Analytics copy is
// tier-aware) and is never part of the auto-save form payload.

export type SubscriptionBusy = "idle" | "sending" | "checkout" | "portal";
export type SubscriptionNotice = "sent" | "send_error" | null;

export interface UseSubscriptionResult {
  email: string;
  status: SubscriptionStatus;
  periodEnd: string;
  entitled: boolean;
  emailInput: string;
  setEmailInput: (v: string) => void;
  busy: SubscriptionBusy;
  notice: SubscriptionNotice;
  sendMagicLink: () => Promise<void>;
  upgrade: () => Promise<void>;
  manage: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionResult {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus>("inactive");
  const [periodEnd, setPeriodEnd] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [busy, setBusy] = useState<SubscriptionBusy>("idle");
  const [notice, setNotice] = useState<SubscriptionNotice>(null);

  const entitled = status === "active" || status === "trialing";

  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      setEmail(s.subscriptionEmail);
      setStatus(s.subscriptionStatus);
      setPeriodEnd(s.subscriptionPeriodEnd);
      // Hydrate supabase-js and pull live subscription state in the
      // background. If the network is down we'll just keep showing the
      // cached values from settings.json.
      try {
        await restoreSession();
        const me = await refreshStatus();
        if (me) {
          setEmail(me.email);
          setPeriodEnd(me.current_period_end ?? "");
          setStatus(
            me.paid
              ? me.status === "trialing"
                ? "trialing"
                : "active"
              : me.status === "canceled"
                ? "canceled"
                : "inactive",
          );
        }
      } catch {
        // network / token errors are non-fatal; the UI already shows cached state
      }
    })();

    // Subscription state can change without us doing anything (post-checkout
    // deep link handled by ConversationWorker, webhook updates in Supabase).
    // Listen to settings:updated and refresh from settings.json.
    let unlistenSettings: (() => void) | undefined;
    void listen(IpcEvent.settingsUpdated, async () => {
      const s = await loadSettings();
      setEmail(s.subscriptionEmail);
      setStatus(s.subscriptionStatus);
      setPeriodEnd(s.subscriptionPeriodEnd);
    }).then((u) => {
      unlistenSettings = u;
    });
    // Also install a deep-link handler scoped to this window so a
    // chappie://refresh that arrives while Settings is foregrounded
    // triggers immediate refresh.
    let unlistenDeepLink: (() => void) | undefined;
    void installDeepLinkHandler().then((u) => {
      unlistenDeepLink = u;
    });
    return () => {
      unlistenSettings?.();
      unlistenDeepLink?.();
    };
  }, []);

  return {
    email,
    status,
    periodEnd,
    entitled,
    emailInput,
    setEmailInput,
    busy,
    notice,
    sendMagicLink: async () => {
      setNotice(null);
      setBusy("sending");
      try {
        await sendMagicLink(emailInput.trim());
        setNotice("sent");
      } catch (e) {
        console.warn("[settings] magic link send failed", e);
        setNotice("send_error");
      } finally {
        setBusy("idle");
      }
    },
    upgrade: async () => {
      setBusy("checkout");
      try {
        const url = await openCheckout();
        if (url) await openUrl(url);
      } catch (e) {
        console.warn("[settings] checkout open failed", e);
      } finally {
        setBusy("idle");
      }
    },
    manage: async () => {
      setBusy("portal");
      try {
        const url = await openPortal();
        if (url) await openUrl(url);
      } catch (e) {
        console.warn("[settings] portal open failed", e);
      } finally {
        setBusy("idle");
      }
    },
    signOut: async () => {
      await supabaseSignOut();
      setEmail("");
      setStatus("inactive");
      setPeriodEnd("");
      setEmailInput("");
      setNotice(null);
      // Tell the conversation loop to drop the token.
      await emit(IpcEvent.settingsUpdated, {});
    },
  };
}
