import { describe, expect, it } from "vitest";
import { FOLLOWUP_MIN_CHARS, takeReadySegment } from "./sentence-buffer";

describe("takeReadySegment", () => {
  it("returns null when no terminator is present", () => {
    expect(takeReadySegment("こんにちは", false)).toBeNull();
    expect(takeReadySegment("hello there", false)).toBeNull();
  });

  it("splits at the first terminator on the first utterance", () => {
    expect(takeReadySegment("こんにちは。元気？", false)).toEqual({
      segment: "こんにちは。",
      remaining: "元気？",
    });
  });

  it("supports both fullwidth and ASCII terminators", () => {
    expect(takeReadySegment("ok!rest", false)?.segment).toBe("ok!");
    expect(takeReadySegment("ok?rest", false)?.segment).toBe("ok?");
    expect(takeReadySegment("done. rest", false)?.segment).toBe("done.");
  });

  it("does NOT split decimals like 39.6", () => {
    expect(takeReadySegment("気温は39.6度", false)).toBeNull();
    expect(takeReadySegment("気温は39.6度。さあ寒いね。", false)).toEqual({
      segment: "気温は39.6度。",
      remaining: "さあ寒いね。",
    });
  });

  it("after the first utterance, batches until FOLLOWUP_MIN_CHARS", () => {
    // 50 chars, first terminator at 5 — alreadySpoken=true should NOT cut
    // here, it should wait for another terminator past FOLLOWUP_MIN_CHARS.
    const short = "abc。short";
    expect(takeReadySegment(short, true)).toBeNull();

    // Long enough to satisfy the threshold.
    const long = `${"a".repeat(50)}。${"b".repeat(80)}。tail`;
    const result = takeReadySegment(long, true);
    expect(result).not.toBeNull();
    expect(result?.segment.length).toBeGreaterThanOrEqual(FOLLOWUP_MIN_CHARS);
    expect(result?.remaining).toBe("tail");
  });

  it("treats consecutive terminators as one", () => {
    expect(takeReadySegment("やった！！次", false)).toEqual({
      segment: "やった！！",
      remaining: "次",
    });
  });

  it("trims whitespace around the segment", () => {
    expect(takeReadySegment("  hello.  rest", false)).toEqual({
      segment: "hello.",
      remaining: "  rest",
    });
  });
});
