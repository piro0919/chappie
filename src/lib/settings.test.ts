import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeStoreState = new Map<string, unknown>();
const fakeStore = {
  get: vi.fn(async (k: string) => fakeStoreState.get(k)),
  set: vi.fn(async (k: string, v: unknown) => {
    fakeStoreState.set(k, v);
  }),
  save: vi.fn(async () => {}),
};

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(async () => fakeStore),
}));

import {
  __resetForTests,
  loadSettings,
  resolveMode,
  saveSettings,
} from "./settings";

describe("settings", () => {
  beforeEach(() => {
    fakeStoreState.clear();
    vi.clearAllMocks();
    __resetForTests();
  });

  const SUBSCRIPTION_DEFAULTS = {
    subscriptionAccessToken: "",
    subscriptionRefreshToken: "",
    subscriptionEmail: "",
    subscriptionStatus: "inactive",
    subscriptionPeriodEnd: "",
  } as const;

  const PROACTIVE_DEFAULTS = {
    proactiveMorningBriefEnabled: false,
    proactiveMorningBriefTime: "07:00",
    proactiveCalendarEnabled: false,
    proactiveCalendarLeadMin: 15,
    proactiveWeatherEnabled: false,
    proactiveIdleChatterEnabled: false,
    proactiveIdleChatterAfterMin: 60,
    proactiveQuietHoursStart: "07:00",
    proactiveQuietHoursEnd: "22:00",
  } as const;

  const SPEAKER_DEFAULTS = {
    speakerThreshold: 0.4,
  } as const;

  const VAD_DEFAULTS = {
    vadThreshold: 0.25,
    vadSilenceFrames: 22,
  } as const;

  const ANALYTICS_DEFAULTS = {
    analyticsConsent: false,
    personalizedToolsEnabled: true,
  } as const;

  it("returns defaults when store is empty", async () => {
    expect(await loadSettings()).toEqual({
      mode: "free",
      openaiApiKey: "",
      language: "auto",
      autostart: false,
      ...SUBSCRIPTION_DEFAULTS,
      ...PROACTIVE_DEFAULTS,
      ...SPEAKER_DEFAULTS,
      ...VAD_DEFAULTS,
      ...ANALYTICS_DEFAULTS,
    });
  });

  it("returns persisted values when present", async () => {
    fakeStoreState.set("openaiApiKey", "sk-test");
    fakeStoreState.set("language", "en");
    // No persisted `mode`: existing user with a saved key migrates to BYOK.
    expect(await loadSettings()).toEqual({
      mode: "byok",
      openaiApiKey: "sk-test",
      language: "en",
      autostart: false,
      ...SUBSCRIPTION_DEFAULTS,
      ...PROACTIVE_DEFAULTS,
      ...SPEAKER_DEFAULTS,
      ...VAD_DEFAULTS,
      ...ANALYTICS_DEFAULTS,
    });
  });

  it("merges patch on save and persists", async () => {
    await saveSettings({ openaiApiKey: "sk-new" });
    expect(fakeStore.set).toHaveBeenCalledWith("openaiApiKey", "sk-new");
    expect(fakeStore.save).toHaveBeenCalled();
    // No persisted mode + saved key → BYOK via migration.
    expect(await loadSettings()).toEqual({
      mode: "byok",
      openaiApiKey: "sk-new",
      language: "auto",
      autostart: false,
      ...SUBSCRIPTION_DEFAULTS,
      ...PROACTIVE_DEFAULTS,
      ...SPEAKER_DEFAULTS,
      ...VAD_DEFAULTS,
      ...ANALYTICS_DEFAULTS,
    });
  });

  it("persists explicit mode override", async () => {
    await saveSettings({ mode: "free", openaiApiKey: "sk-old" });
    expect(fakeStore.set).toHaveBeenCalledWith("mode", "free");
    // Explicit "free" wins over the BYOK migration heuristic.
    expect((await loadSettings()).mode).toBe("free");
  });

  it("persists language changes", async () => {
    await saveSettings({ language: "ja" });
    expect(fakeStore.set).toHaveBeenCalledWith("language", "ja");
    expect((await loadSettings()).language).toBe("ja");
  });

  it("ignores undefined fields in patch", async () => {
    await saveSettings({ openaiApiKey: undefined, language: "fr" });
    expect(fakeStore.set).not.toHaveBeenCalledWith(
      "openaiApiKey",
      expect.anything(),
    );
    expect(fakeStore.set).toHaveBeenCalledWith("language", "fr");
  });

  it("demotes stale paid → free when subscription is no longer active", async () => {
    fakeStoreState.set("mode", "paid");
    fakeStoreState.set("subscriptionStatus", "canceled");
    const s = await loadSettings();
    expect(s.mode).toBe("free");
    // The demote is persisted so the next read agrees without re-running
    // the resolve, and other windows pick it up on settings:updated.
    expect(fakeStore.set).toHaveBeenCalledWith("mode", "free");
  });

  it("keeps paid when subscription is active", async () => {
    fakeStoreState.set("mode", "paid");
    fakeStoreState.set("subscriptionStatus", "active");
    expect((await loadSettings()).mode).toBe("paid");
  });

  it("keeps paid when subscription is trialing", async () => {
    fakeStoreState.set("mode", "paid");
    fakeStoreState.set("subscriptionStatus", "trialing");
    expect((await loadSettings()).mode).toBe("paid");
  });
});

describe("resolveMode", () => {
  it("first-time install with no key → free", () => {
    expect(resolveMode(undefined, "", "inactive", "")).toBe("free");
  });

  it("first-time migration: saved key + no stored mode → byok", () => {
    expect(resolveMode(undefined, "sk-test", "inactive", "")).toBe("byok");
  });

  it("stored byok wins over BYOK heuristic absence", () => {
    expect(resolveMode("byok", "", "inactive", "")).toBe("byok");
  });

  it("stored paid with active subscription stays paid", () => {
    expect(resolveMode("paid", "", "active", "u@x.test")).toBe("paid");
  });

  it("stored paid with trialing subscription stays paid", () => {
    expect(resolveMode("paid", "", "trialing", "u@x.test")).toBe("paid");
  });

  it("stored paid + canceled + signed out demotes to free", () => {
    expect(resolveMode("paid", "", "canceled", "")).toBe("free");
  });

  it("stored paid + inactive + signed out demotes to free", () => {
    expect(resolveMode("paid", "", "inactive", "")).toBe("free");
  });

  it("stored paid + inactive + signed in stays paid (mid-checkout)", () => {
    // A user who has signed in but not yet completed Stripe checkout
    // is in a transient state — we must keep mode=paid so the Pro
    // panel renders the Upgrade button.
    expect(resolveMode("paid", "", "inactive", "u@x.test")).toBe("paid");
  });

  it("stored paid + canceled + signed in stays paid (lapsed sub)", () => {
    // Lapsed sub: user is still signed in, sees Upgrade to re-subscribe.
    expect(resolveMode("paid", "", "canceled", "u@x.test")).toBe("paid");
  });

  it("free + active + signed in promotes to paid (legacy bug recovery)", () => {
    // Pre-v0.12 had a resolveMode that demoted paid → free during the
    // post-signin-pre-checkout window. Affected users had their mode
    // persisted as "free" even after a successful payment. The combo
    // (free + signed-in + entitled) has no legitimate UI path —
    // sign-out always clears email/status — so promoting is safe.
    expect(resolveMode("free", "", "active", "u@x.test")).toBe("paid");
  });

  it("free + trialing + signed in also promotes to paid", () => {
    expect(resolveMode("free", "", "trialing", "u@x.test")).toBe("paid");
  });

  it("free + signed out + active stays free (impossible legit state)", () => {
    // Defensive: if subscriptionEmail is empty, treat as a fresh free
    // user even when status somehow reports active. Sign-out always
    // empties the email so this is the only safe choice.
    expect(resolveMode("free", "", "active", "")).toBe("free");
  });

  it("free + inactive + signed in stays free", () => {
    // Mid-signin before checkout: subscriptionEmail is set but no
    // subscription exists yet. Free is the correct mode until they
    // explicitly opt into paid via the radio.
    expect(resolveMode("free", "", "inactive", "u@x.test")).toBe("free");
  });

  it("byok + active + signed in stays byok", () => {
    // BYOK users who happen to have a subscription (e.g. paid in the
    // past, then switched to their own key) keep their explicit choice.
    expect(resolveMode("byok", "sk-key", "active", "u@x.test")).toBe("byok");
  });
});
