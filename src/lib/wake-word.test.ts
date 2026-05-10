import { describe, expect, it } from "vitest";
import { detectWake } from "./wake-word";

describe("detectWake", () => {
  it("returns matched=false when no wake word", () => {
    expect(detectWake("今日の天気は？")).toEqual({ matched: false });
  });

  it("matches English 'chappie' and returns body after it", () => {
    expect(detectWake("Chappie, what time is it?")).toEqual({
      matched: true,
      body: "what time is it?",
    });
  });

  it("matches Japanese 'チャッピー' and returns body after it (NFKC normalizes ？ to ?)", () => {
    expect(detectWake("チャッピー、今何時？")).toEqual({
      matched: true,
      body: "今何時?",
    });
  });

  it("matches case-insensitively", () => {
    expect(detectWake("CHAPPIE tell me a joke")).toEqual({
      matched: true,
      body: "tell me a joke",
    });
  });

  it("matches fullwidth via NFKC normalization", () => {
    expect(detectWake("ｃｈａｐｐｉｅ こんにちは")).toEqual({
      matched: true,
      body: "こんにちは",
    });
  });

  it("returns body='' when only the wake word is uttered", () => {
    expect(detectWake("チャッピー。")).toEqual({ matched: true, body: "" });
    expect(detectWake("Chappie!")).toEqual({ matched: true, body: "" });
  });

  it("trims punctuation/whitespace from body", () => {
    expect(detectWake("チャッピー  、  明日の予定教えて  ")).toEqual({
      matched: true,
      body: "明日の予定教えて",
    });
  });

  it("uses the earliest match when multiple wake words appear", () => {
    expect(detectWake("Chappie チャッピー hi")).toEqual({
      matched: true,
      body: "チャッピー hi",
    });
  });

  it("returns matched=false on empty/whitespace input", () => {
    expect(detectWake("")).toEqual({ matched: false });
    expect(detectWake("   ")).toEqual({ matched: false });
  });

  // VOICEVOX speaker names act as wake-words and additionally request a
  // speaker switch — see voicevox-speakers.ts for the curated list.

  it("matches 'ずんだもん' as a wake-word and includes speakerId=3", () => {
    expect(detectWake("ずんだもん、最新ニュース教えて")).toEqual({
      matched: true,
      body: "最新ニュース教えて",
      speakerId: 3,
    });
  });

  it("matches the alias 'めたん' and includes speakerId=2", () => {
    expect(detectWake("めたん、明日の予定")).toEqual({
      matched: true,
      body: "明日の予定",
      speakerId: 2,
    });
  });

  it("prefers the longer name '四国めたん' over the alias 'めたん' on tie", () => {
    expect(detectWake("四国めたん、こんにちは")).toEqual({
      matched: true,
      body: "こんにちは",
      speakerId: 2,
    });
  });

  it("matches a speaker name uttered alone (body empty)", () => {
    expect(detectWake("つむぎ")).toEqual({
      matched: true,
      body: "",
      speakerId: 8,
    });
  });

  it("does not include speakerId for plain 'チャッピー'", () => {
    const result = detectWake("チャッピー、何時？");
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.speakerId).toBeUndefined();
      expect(result.body).toBe("何時?");
    }
  });

  // Natural greeting forms: honorific / nickname suffixes ("ちゃん", "さん"
  // etc.) right after the wake-word are trimmed so they don't leak into
  // the body sent to the LLM.

  it("trims 'ちゃん' suffix after a speaker name", () => {
    expect(detectWake("つむぎちゃん、最新ニュース教えて")).toEqual({
      matched: true,
      body: "最新ニュース教えて",
      speakerId: 8,
    });
  });

  it("trims 'さん' suffix after a speaker name", () => {
    expect(detectWake("めたんさん、明日の予定")).toEqual({
      matched: true,
      body: "明日の予定",
      speakerId: 2,
    });
  });

  it("matches a polite-prefix form like 'ねぇ ずんだもん'", () => {
    expect(detectWake("ねぇ ずんだもん、天気どう？")).toEqual({
      matched: true,
      body: "天気どう?",
      speakerId: 3,
    });
  });

  it("trims honorifics on the chappie wake-word too", () => {
    const r = detectWake("チャッピーちゃん、ありがとう");
    expect(r.matched).toBe(true);
    if (r.matched) {
      expect(r.speakerId).toBeUndefined();
      expect(r.body).toBe("ありがとう");
    }
  });
});
