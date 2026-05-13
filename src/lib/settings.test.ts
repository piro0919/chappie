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

import { __resetForTests, loadSettings, saveSettings } from "./settings";

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

  it("returns defaults when store is empty", async () => {
    expect(await loadSettings()).toEqual({
      mode: "free",
      openaiApiKey: "",
      language: "auto",
      autostart: false,
      ...SUBSCRIPTION_DEFAULTS,
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
});
