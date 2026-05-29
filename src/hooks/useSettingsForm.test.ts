import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the tauri-plugin-store so the real
// loadSettings / saveSettings round-trip through it. Mirrors the pattern
// in settings.test.ts.
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
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
}));
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(async () => {}),
  listen: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/plugin-autostart", () => ({
  isEnabled: vi.fn(async () => false),
  enable: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
}));

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { __resetForTests } from "../lib/settings";
import { useSettingsForm } from "./useSettingsForm";

describe("useSettingsForm", () => {
  beforeEach(() => {
    fakeStoreState.clear();
    vi.clearAllMocks();
    __resetForTests();
  });

  it("hydrates form state from the persisted store", async () => {
    fakeStoreState.set("vadThreshold", 0.33);
    fakeStoreState.set("language", "ja");
    const { result } = renderHook(() => useSettingsForm());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.vadThreshold).toBe(0.33);
    expect(result.current.language).toBe("ja");
    // No key / no subscription → resolveMode lands on free.
    expect(result.current.mode).toBe("free");
  });

  it("debounce-persists a changed field and notifies the running loop", async () => {
    const { result } = renderHook(() => useSettingsForm());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.setVadThreshold(0.4);
    });

    // The 300ms-debounced auto-save writes the store, mirrors the value
    // into the Rust audio config, and emits settings:updated.
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("set_vad_threshold", {
        value: 0.4,
      });
    });
    expect(fakeStoreState.get("vadThreshold")).toBe(0.4);
    expect(vi.mocked(emit)).toHaveBeenCalledWith("settings:updated");
  });
});
