import { describe, expect, it } from "vitest";
import {
  isBargeInCommand,
  isExternalAudioCancelCommand,
  isHallucination,
} from "./speech-filters";

describe("isBargeInCommand", () => {
  it("matches Japanese stop variants", () => {
    expect(isBargeInCommand("ストップ")).toBe(true);
    expect(isBargeInCommand("もうやめて")).toBe(true);
    expect(isBargeInCommand("黙って")).toBe(true);
    expect(isBargeInCommand("もういい")).toBe(true);
  });

  it("matches English stop variants case-insensitively", () => {
    expect(isBargeInCommand("STOP")).toBe(true);
    expect(isBargeInCommand("please stop")).toBe(true);
    expect(isBargeInCommand("Be quiet")).toBe(true);
  });

  it("returns false for normal speech", () => {
    expect(isBargeInCommand("今日の天気は？")).toBe(false);
    expect(isBargeInCommand("how are you")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isBargeInCommand("")).toBe(false);
    expect(isBargeInCommand("   ")).toBe(false);
  });

  it("normalizes full-width characters", () => {
    expect(isBargeInCommand("ＳＴＯＰ")).toBe(true);
  });
});

describe("isExternalAudioCancelCommand", () => {
  it("is a superset of barge-in", () => {
    expect(isExternalAudioCancelCommand("ストップ")).toBe(true);
    expect(isExternalAudioCancelCommand("stop")).toBe(true);
  });

  it("matches dismissal phrases for the miniplayer", () => {
    expect(isExternalAudioCancelCommand("閉じて")).toBe(true);
    expect(isExternalAudioCancelCommand("消して")).toBe(true);
    expect(isExternalAudioCancelCommand("プレイヤー閉じて")).toBe(true);
    expect(isExternalAudioCancelCommand("close it")).toBe(true);
  });

  it("returns false for unrelated speech", () => {
    expect(isExternalAudioCancelCommand("天気どう？")).toBe(false);
  });
});

describe("isHallucination", () => {
  it("flags Whisper's ご視聴ありがとうございました family", () => {
    expect(isHallucination("ご視聴ありがとうございました")).toBe(true);
    expect(isHallucination("ご清聴ありがとうございました")).toBe(true);
    expect(isHallucination("ご視聴ありがとうございます")).toBe(true);
  });

  it("flags YouTube boilerplate", () => {
    expect(isHallucination("チャンネル登録お願いします")).toBe(true);
    expect(isHallucination("Please subscribe!")).toBe(true);
    expect(isHallucination("Thanks for watching")).toBe(true);
  });

  it("flags parenthetical-only and punctuation-only", () => {
    expect(isHallucination("(音楽)")).toBe(true);
    expect(isHallucination("[拍手]")).toBe(true);
    expect(isHallucination("。。。")).toBe(true);
  });

  it("flags very short utterances (≤2 chars)", () => {
    expect(isHallucination("あ")).toBe(true);
    expect(isHallucination("hi")).toBe(true);
  });

  it("passes through normal utterances", () => {
    expect(isHallucination("今日の天気を教えて")).toBe(false);
    expect(isHallucination("タイマーを3分セットして")).toBe(false);
  });
});
