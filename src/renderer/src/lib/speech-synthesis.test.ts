import { beforeEach, describe, expect, it, vi } from "vitest";
import { speak } from "./speech-synthesis";

describe("speak", () => {
  beforeEach(() => {
    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn((u: SpeechSynthesisUtterance) => {
        setTimeout(() => u.onend?.(new Event("end") as never), 0);
      }),
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

  it("resolves when utterance ends", async () => {
    await expect(speak("hello", null)).resolves.toBeUndefined();
  });
});
