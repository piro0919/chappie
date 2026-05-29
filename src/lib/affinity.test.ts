import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  buildAffinityStance,
  getAffinity,
  initAffinity,
  markMilestoneCelebrated,
  recordTurn,
} from "./affinity";

// 2026-05-29 12:00 local — fixed so day math is deterministic.
const DAY0 = new Date(2026, 4, 29, 12, 0, 0);

describe("affinity", () => {
  beforeEach(() => {
    fakeStoreState.clear();
    vi.clearAllMocks();
    __resetForTests();
    vi.useFakeTimers();
    vi.setSystemTime(DAY0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts neutral (fresh = polite) with no record", () => {
    const a = getAffinity(undefined);
    expect(a).toEqual({
      score: 0,
      dayCount: 0,
      daysSinceLast: 0,
      milestone: null,
    });
  });

  it("score rises with dayCount, stays in 0..1, and never decreases", () => {
    let prev = -1;
    for (const days of [1, 5, 10, 30, 60, 120, 365, 3650]) {
      // Seed a record at `days` distinct days by recording across days.
      __resetForTests();
      vi.setSystemTime(DAY0);
      for (let i = 0; i < days; i++) {
        vi.setSystemTime(new Date(2026, 4, 29 + i, 12));
        recordTurn(undefined);
      }
      const { score } = getAffinity(undefined);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeGreaterThan(prev); // strictly monotonic in dayCount
      prev = score;
    }
  });

  it("counts one day per distinct local date, not per turn", () => {
    recordTurn(undefined);
    recordTurn(undefined);
    recordTurn(undefined);
    expect(getAffinity(undefined).dayCount).toBe(1); // same day → 1

    vi.setSystemTime(new Date(2026, 4, 30, 9)); // next day
    recordTurn(undefined);
    expect(getAffinity(undefined).dayCount).toBe(2);
  });

  it("tracks affinity per character independently", () => {
    recordTurn(undefined); // chappie
    recordTurn(3); // zundamon
    recordTurn(3);
    expect(getAffinity(undefined).dayCount).toBe(1);
    expect(getAffinity(3).dayCount).toBe(1);
    // zundamon has more turns but same single day
    expect(getAffinity(2).dayCount).toBe(0); // untouched character
  });

  it("daysSinceLast reflects the gap and does NOT affect score", () => {
    recordTurn(undefined);
    const fresh = getAffinity(undefined);
    expect(fresh.daysSinceLast).toBe(0);

    vi.setSystemTime(new Date(2026, 5, 5, 12)); // 7 days later, no new turn
    const later = getAffinity(undefined);
    expect(later.daysSinceLast).toBe(7);
    // score unchanged — absence never decays the bond
    expect(later.score).toBe(fresh.score);
    expect(later.dayCount).toBe(1);
  });

  it("surfaces a milestone once, then not again after celebrated", () => {
    for (let i = 0; i < 7; i++) {
      vi.setSystemTime(new Date(2026, 4, 29 + i, 12));
      recordTurn(undefined);
    }
    expect(getAffinity(undefined).milestone).toBe(7);
    markMilestoneCelebrated(undefined, 7);
    expect(getAffinity(undefined).milestone).toBeNull();
  });

  it("buildAffinityStance includes score, sulk line on a gap, milestone line", () => {
    const plain = buildAffinityStance({
      score: 0.42,
      dayCount: 12,
      daysSinceLast: 0,
      milestone: null,
    });
    expect(plain).toContain("0.42");
    expect(plain).not.toContain("ぶり"); // no sulk line when fresh
    expect(plain).not.toContain("通算");

    const sulky = buildAffinityStance({
      score: 0.42,
      dayCount: 12,
      daysSinceLast: 5,
      milestone: 30,
    });
    expect(sulky).toContain("5 日ぶり");
    expect(sulky).toContain("通算 30 日");
  });

  it("loads persisted records into memory via initAffinity", async () => {
    fakeStoreState.set("records", {
      chappie: {
        firstDay: "2026-01-01",
        lastDay: "2026-05-29",
        dayCount: 50,
        turnCount: 200,
        lastMilestone: 30,
      },
    });
    await initAffinity();
    const a = getAffinity(undefined);
    expect(a.dayCount).toBe(50);
    expect(a.score).toBeGreaterThan(0.7);
    expect(a.milestone).toBeNull(); // 30 already celebrated; 100 not reached
  });
});
