import { describe, expect, it } from "vitest";
import { VOICEVOX_CURATED_SPEAKERS } from "../lib/voicevox-speakers";
import { getWakeAcks } from "./messages";

describe("getWakeAcks", () => {
  it("falls back to the language pool when no speaker is given", () => {
    const acks = getWakeAcks("ja", 12);
    expect(acks).toContain("はい");
  });

  it("returns the in-character pool when the speaker has wakeAcks", () => {
    const zundamon = VOICEVOX_CURATED_SPEAKERS.find((s) => s.id === 3)!;
    const acks = getWakeAcks("ja", 12, zundamon.id);
    expect(acks).toEqual(zundamon.wakeAcks);
    expect(
      acks.every((line) => line.includes("のだ") || line.includes("だ")),
    ).toBe(true);
  });

  it("ignores unknown speaker ids and uses the language pool", () => {
    const acks = getWakeAcks("ja", 12, 99999);
    expect(acks).toContain("はい");
  });

  it("every curated speaker has at least one wakeAck", () => {
    for (const sp of VOICEVOX_CURATED_SPEAKERS) {
      expect(sp.wakeAcks, `${sp.label} is missing wakeAcks`).toBeDefined();
      expect(sp.wakeAcks!.length).toBeGreaterThan(0);
    }
  });
});
