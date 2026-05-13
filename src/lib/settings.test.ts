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

  it("returns defaults when store is empty", async () => {
    expect(await loadSettings()).toEqual({
      openaiApiKey: "",
      language: "auto",
      autostart: false,
    });
  });

  it("returns persisted values when present", async () => {
    fakeStoreState.set("openaiApiKey", "sk-test");
    fakeStoreState.set("language", "en");
    expect(await loadSettings()).toEqual({
      openaiApiKey: "sk-test",
      language: "en",
      autostart: false,
    });
  });

  it("merges patch on save and persists", async () => {
    await saveSettings({ openaiApiKey: "sk-new" });
    expect(fakeStore.set).toHaveBeenCalledWith("openaiApiKey", "sk-new");
    expect(fakeStore.save).toHaveBeenCalled();
    expect(await loadSettings()).toEqual({
      openaiApiKey: "sk-new",
      language: "auto",
      autostart: false,
    });
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
