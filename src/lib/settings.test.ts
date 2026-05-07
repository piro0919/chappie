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
      voiceURI: null,
      model: "gpt-4o-mini",
    });
  });

  it("returns persisted values when present", async () => {
    fakeStoreState.set("openaiApiKey", "sk-test");
    fakeStoreState.set("voiceURI", "com.apple.voice.Kyoko");
    fakeStoreState.set("model", "gpt-4o");
    expect(await loadSettings()).toEqual({
      openaiApiKey: "sk-test",
      voiceURI: "com.apple.voice.Kyoko",
      model: "gpt-4o",
    });
  });

  it("merges patch on save and persists", async () => {
    await saveSettings({ openaiApiKey: "sk-new" });
    expect(fakeStore.set).toHaveBeenCalledWith("openaiApiKey", "sk-new");
    expect(fakeStore.save).toHaveBeenCalled();
    expect(await loadSettings()).toEqual({
      openaiApiKey: "sk-new",
      voiceURI: null,
      model: "gpt-4o-mini",
    });
  });

  it("allows clearing voiceURI to null", async () => {
    fakeStoreState.set("voiceURI", "abc");
    await saveSettings({ voiceURI: null });
    expect(fakeStore.set).toHaveBeenCalledWith("voiceURI", null);
    expect((await loadSettings()).voiceURI).toBeNull();
  });

  it("ignores undefined fields in patch", async () => {
    await saveSettings({ openaiApiKey: undefined, voiceURI: "v1" });
    expect(fakeStore.set).not.toHaveBeenCalledWith(
      "openaiApiKey",
      expect.anything(),
    );
    expect(fakeStore.set).toHaveBeenCalledWith("voiceURI", "v1");
  });
});
