import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  loadSettings,
  type SubscriptionStatus,
  saveSettings,
} from "./settings";

// Safe to expose publicly: row-level security on the Postgres side is the
// real authorization boundary. The anon key is signed by Supabase and
// scoped to the "anon" role.
const SUPABASE_URL = "https://gnxadmwmjelpqvwsfgly.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdueGFkbXdtamVscHF2d3NmZ2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTkzNDQsImV4cCI6MjA5NDI3NTM0NH0.9hmouTFzH16A-KiF3sD0mmGWUAuTkOlEKJFTEFUo66g";

// We persist tokens ourselves in tauri-plugin-store and feed them back
// via setSession() — disable supabase-js's built-in localStorage path
// since the Tauri webview shares an origin across windows but settings.json
// is what survives restart and the deep-link handler.
let clientPromise: Promise<SupabaseClient> | null = null;
function getClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = Promise.resolve(
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    );
  }
  return clientPromise;
}

/**
 * Restores the persisted session into the supabase-js client so calls
 * like `auth.getUser()` work after relaunch. Safe to call repeatedly —
 * no network if the local tokens are still valid; `setSession` will
 * trigger a refresh request when the access token has expired.
 */
export async function restoreSession(): Promise<Session | null> {
  const settings = await loadSettings();
  if (!settings.subscriptionAccessToken || !settings.subscriptionRefreshToken) {
    return null;
  }
  const client = await getClient();
  const { data, error } = await client.auth.setSession({
    access_token: settings.subscriptionAccessToken,
    refresh_token: settings.subscriptionRefreshToken,
  });
  if (error) {
    // Refresh token rejected — wipe persisted creds so the UI shows
    // the signed-out state instead of looping on a dead session.
    await saveSettings({
      subscriptionAccessToken: "",
      subscriptionRefreshToken: "",
      subscriptionStatus: "inactive",
    });
    return null;
  }
  return data.session;
}

export async function sendMagicLink(email: string): Promise<void> {
  const client = await getClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "chappie://auth",
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

/**
 * Called by the deep-link handler after receiving `chappie://auth#access_token=…&refresh_token=…`.
 * Persists the tokens and email; subscription status will be filled in by `refreshStatus()`.
 */
export async function applyAuthCallback(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const client = await getClient();
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  await saveSettings({
    subscriptionAccessToken: accessToken,
    subscriptionRefreshToken: refreshToken,
    subscriptionEmail: data.user?.email ?? "",
  });
}

/**
 * Hits `/api/me` to pull live subscription state and writes the relevant
 * fields back into settings. Returns the parsed status so callers (e.g.
 * the post-checkout "refresh" deep link) can react immediately.
 */
export type MeResponse = {
  email: string;
  user_id: string;
  paid: boolean;
  status: SubscriptionStatus | null;
  current_period_end: string | null;
};

export async function refreshStatus(): Promise<MeResponse | null> {
  const settings = await loadSettings();
  if (!settings.subscriptionAccessToken) return null;
  const base = appBaseUrl();
  const res = await fetch(`${base}/api/me`, {
    headers: { Authorization: `Bearer ${settings.subscriptionAccessToken}` },
  });
  if (res.status === 401) {
    // Access token expired — try refresh once.
    const client = await getClient();
    const { data, error } = await client.auth.refreshSession({
      refresh_token: settings.subscriptionRefreshToken,
    });
    if (error || !data.session) {
      await signOut();
      return null;
    }
    await saveSettings({
      subscriptionAccessToken: data.session.access_token,
      subscriptionRefreshToken: data.session.refresh_token,
    });
    return refreshStatus();
  }
  if (!res.ok) return null;
  const me = (await res.json()) as MeResponse;
  const status: SubscriptionStatus = me.paid
    ? me.status === "trialing"
      ? "trialing"
      : "active"
    : me.status === "canceled"
      ? "canceled"
      : "inactive";
  await saveSettings({
    subscriptionEmail: me.email,
    subscriptionStatus: status,
    subscriptionPeriodEnd: me.current_period_end ?? "",
  });
  return me;
}

export async function openCheckout(): Promise<string | null> {
  const settings = await loadSettings();
  if (!settings.subscriptionAccessToken) return null;
  const base = appBaseUrl();
  const res = await fetch(`${base}/api/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.subscriptionAccessToken}` },
  });
  if (!res.ok) return null;
  const { url } = (await res.json()) as { url?: string };
  return url ?? null;
}

export async function openPortal(): Promise<string | null> {
  const settings = await loadSettings();
  if (!settings.subscriptionAccessToken) return null;
  const base = appBaseUrl();
  const res = await fetch(`${base}/api/billing/portal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.subscriptionAccessToken}` },
  });
  if (!res.ok) return null;
  const { url } = (await res.json()) as { url?: string };
  return url ?? null;
}

export async function signOut(): Promise<void> {
  const client = await getClient();
  await client.auth.signOut().catch(() => {});
  await saveSettings({
    subscriptionAccessToken: "",
    subscriptionRefreshToken: "",
    subscriptionEmail: "",
    subscriptionStatus: "inactive",
    subscriptionPeriodEnd: "",
  });
}

/**
 * Wire the Tauri `deep-link` event (emitted by `lib.rs` for every
 * `chappie://…` URL the OS hands us) into our subscription state.
 *
 *   `chappie://auth#access_token=…&refresh_token=…`
 *       → applyAuthCallback() then a `settings:updated` window event so
 *         the conversation loop reloads with the new tokens
 *   `chappie://refresh`
 *       → refreshStatus() then `settings:updated`
 *
 * Both windows (SettingsView and ConversationWorker) install this on
 * mount; the listener self-deduplicates on cleanup.
 */
export async function installDeepLinkHandler(): Promise<UnlistenFn> {
  return listen<string>("deep-link", async (event) => {
    const raw = event.payload;
    if (!raw) return;
    try {
      const url = new URL(raw);
      if (url.protocol !== "chappie:") return;
      if (
        url.hostname === "auth" ||
        url.pathname.replace(/^\//, "") === "auth"
      ) {
        // Supabase puts the tokens in the URL *fragment*, not the query.
        const frag = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
        const params = new URLSearchParams(frag);
        const access = params.get("access_token");
        const refresh = params.get("refresh_token");
        if (access && refresh) {
          await applyAuthCallback(access, refresh);
          await refreshStatus().catch(() => {});
          window.dispatchEvent(new Event("settings:updated"));
        }
      } else if (
        url.hostname === "refresh" ||
        url.pathname.replace(/^\//, "") === "refresh"
      ) {
        await refreshStatus().catch(() => {});
        window.dispatchEvent(new Event("settings:updated"));
      }
    } catch {
      // Ignore malformed URLs.
    }
  });
}

function appBaseUrl(): string {
  // CHAPPIE_PROXY_URL is set by Tauri build / dev for self-hosting; if
  // present, strip the trailing `/api/chat` to recover the LP base.
  // Falls back to the production LP host.
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};
  const proxy = env.VITE_CHAPPIE_PROXY_URL;
  if (proxy) return proxy.replace(/\/api\/chat\/?$/, "");
  return "https://chappie.kkweb.io";
}
