import { describe, expect, it } from "vitest";
import { resolveVoiceForWake } from "./voice-selection";
import { VOICEVOX_CURATED_SPEAKERS } from "./voicevox-speakers";

describe("resolveVoiceForWake", () => {
  it("returns Web Speech + chappie tray when speakerId is undefined", () => {
    const r = resolveVoiceForWake(undefined);
    expect(r.engineOpts.voicevox?.enabled).toBe(false);
    expect(r.trayCharacter).toBe("chappie");
  });

  it("enables VOICEVOX with the curated styles for a known speaker", () => {
    const zundamon = VOICEVOX_CURATED_SPEAKERS.find(
      (s) => s.trayCharacter === "zundamon",
    );
    expect(zundamon).toBeDefined();
    if (!zundamon) return;

    const r = resolveVoiceForWake(zundamon.id);
    expect(r.engineOpts.voicevox).toEqual({
      enabled: true,
      speakerId: zundamon.id,
      styles: zundamon.styles,
    });
    expect(r.trayCharacter).toBe("zundamon");
  });

  it("falls back to chappie tray for unknown speaker ids", () => {
    const r = resolveVoiceForWake(99999);
    expect(r.engineOpts.voicevox?.enabled).toBe(true);
    expect(r.engineOpts.voicevox?.speakerId).toBe(99999);
    expect(r.engineOpts.voicevox?.styles).toBeUndefined();
    expect(r.trayCharacter).toBe("chappie");
  });
});
