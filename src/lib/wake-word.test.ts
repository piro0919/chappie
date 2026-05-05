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
});
