import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelSpeech, speak } from "./speech-synthesis";

const cancelMock = vi.fn();

beforeEach(() => {
  cancelMock.mockClear();
  vi.stubGlobal("speechSynthesis", {
    speak: vi.fn((u: SpeechSynthesisUtterance) => {
      setTimeout(() => u.onend?.(new Event("end") as never), 0);
    }),
    cancel: cancelMock,
    getVoices: () => [],
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      voice: SpeechSynthesisVoice | null = null;
      lang = "";
      onend?: (e: Event) => void;
      onerror?: (e: SpeechSynthesisErrorEvent) => void;
      constructor(t: string) {
        this.text = t;
      }
    },
  );
});

describe("speak", () => {
  it("resolves when utterance ends", async () => {
    await expect(speak("hello", "en")).resolves.toBeUndefined();
  });

  it("calls cancel() before speaking to clear any wedged queue", async () => {
    await speak("hello", "en");
    expect(cancelMock).toHaveBeenCalled();
  });

  it("resolves on interrupted/canceled error (treated as barge-in)", async () => {
    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn((u: SpeechSynthesisUtterance) => {
        setTimeout(() => u.onerror?.({ error: "interrupted" } as never), 0);
      }),
      cancel: cancelMock,
      getVoices: () => [],
    });
    await expect(speak("hello", "en")).resolves.toBeUndefined();
  });

  it("rejects on real errors", async () => {
    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn((u: SpeechSynthesisUtterance) => {
        setTimeout(
          () => u.onerror?.({ error: "synthesis-failed" } as never),
          0,
        );
      }),
      cancel: cancelMock,
      getVoices: () => [],
    });
    await expect(speak("hello", "en")).rejects.toThrow();
  });
});

describe("cancelSpeech", () => {
  it("calls speechSynthesis.cancel()", () => {
    cancelSpeech();
    expect(cancelMock).toHaveBeenCalled();
  });
});
