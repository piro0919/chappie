import { describe, expect, it } from "vitest";
import { buildPerTurnPrompt } from "./per-turn-prompt";
import { VOICEVOX_CURATED_SPEAKERS } from "./voicevox-speakers";

describe("buildPerTurnPrompt", () => {
  it("returns the chappie reset block for undefined speaker", () => {
    const out = buildPerTurnPrompt(undefined);
    expect(out).not.toBeNull();
    expect(out).toContain("チャッピー");
    expect(out).toContain("【共通ルール】");
  });

  it("returns the character persona + samples + identity rule for a known speaker", () => {
    const zundamon = VOICEVOX_CURATED_SPEAKERS.find(
      (s) => s.trayCharacter === "zundamon",
    );
    expect(zundamon).toBeDefined();
    if (!zundamon) return;

    const out = buildPerTurnPrompt(zundamon.id);
    expect(out).not.toBeNull();
    expect(out).toContain(zundamon.persona);
    expect(out).toContain("【素性に関する質問の扱い】");
    expect(out).toContain("【共通ルール】");
    if (zundamon.samples?.length) {
      expect(out).toContain(zundamon.samples[0]);
    }
  });

  it("returns null for an unknown speaker id", () => {
    expect(buildPerTurnPrompt(99999)).toBeNull();
  });
});
