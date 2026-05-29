import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(async () => {}),
  listen: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(async () => {}),
}));
vi.mock("../lib/supabase-client", () => ({
  restoreSession: vi.fn(async () => {}),
  refreshStatus: vi.fn(async () => null),
  sendMagicLink: vi.fn(async () => {}),
  openCheckout: vi.fn(async () => null),
  openPortal: vi.fn(async () => null),
  signOut: vi.fn(async () => {}),
  installDeepLinkHandler: vi.fn(async () => () => {}),
}));
const loadSettings = vi.fn();
vi.mock("../lib/settings", () => ({ loadSettings: () => loadSettings() }));

import { emit } from "@tauri-apps/api/event";
import { signOut as supabaseSignOut } from "../lib/supabase-client";
import { useSubscription } from "./useSubscription";

describe("useSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSettings.mockResolvedValue({
      subscriptionEmail: "a@b.com",
      subscriptionStatus: "active",
      subscriptionPeriodEnd: "2026-06-01",
    });
  });

  it("hydrates the cached Pro identity and derives entitlement", async () => {
    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.email).toBe("a@b.com"));
    expect(result.current.status).toBe("active");
    expect(result.current.entitled).toBe(true);
  });

  it("signOut clears identity and notifies the loop to drop the token", async () => {
    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.email).toBe("a@b.com"));

    await act(async () => {
      await result.current.signOut();
    });

    expect(vi.mocked(supabaseSignOut)).toHaveBeenCalled();
    expect(result.current.email).toBe("");
    expect(result.current.status).toBe("inactive");
    expect(result.current.entitled).toBe(false);
    expect(vi.mocked(emit)).toHaveBeenCalledWith("settings:updated", {});
  });
});
