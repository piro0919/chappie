import { beforeEach, describe, expect, it } from "vitest";
import {
  ABSOLUTE_LISTEN_MAX_MS,
  CONTINUE_WINDOW_MS,
  FOLLOWUP_TIMEOUT_MS,
  ListeningWindow,
  MAX_SPEECH_HOLD_MS,
  OTHER_VOICE_GRACE_MS,
} from "./listening-window";

// Controllable harness: a virtual clock plus capture of the last scheduled
// delay and fire callback. No real timers — we drive `now` by hand so the
// deadline-clamp math is asserted deterministically.
function harness(start = 1000) {
  let t = start;
  let scheduled: number | null = null;
  let fire: (() => void) | null = null;
  let expired = 0;
  const w = new ListeningWindow({
    now: () => t,
    setTimer: (ms, f) => {
      scheduled = ms;
      fire = f;
    },
    clearTimer: () => {
      scheduled = null;
      fire = null;
    },
    onExpire: () => {
      expired += 1;
    },
  });
  return {
    w,
    advance: (ms: number) => {
      t += ms;
    },
    nowAt: () => t,
    scheduled: () => scheduled,
    /** Absolute wall-clock time the currently-scheduled timer would fire. */
    firesAt: () => (scheduled === null ? null : t + scheduled),
    triggerFire: () => fire?.(),
    expired: () => expired,
  };
}

describe("ListeningWindow", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness(1000);
  });

  it("schedules the base timeout on open", () => {
    h.w.openContinuation();
    expect(h.scheduled()).toBe(CONTINUE_WINDOW_MS);
    expect(h.w.isOpen).toBe(true);

    h = harness(1000);
    h.w.openBareWake();
    expect(h.scheduled()).toBe(FOLLOWUP_TIMEOUT_MS);
  });

  it("fires onExpire and closes when the timer triggers", () => {
    h.w.openContinuation();
    h.advance(CONTINUE_WINDOW_MS);
    h.triggerFire();
    expect(h.expired()).toBe(1);
    expect(h.w.isOpen).toBe(false);
  });

  it("close() stops the window and re-arms become no-ops", () => {
    h.w.openContinuation();
    h.w.close();
    expect(h.w.isOpen).toBe(false);
    expect(h.scheduled()).toBeNull();
    // After close, ambient signals must not resurrect the window.
    h.w.onSpeechActive();
    h.w.onOtherVoice();
    h.w.onHallucination();
    expect(h.scheduled()).toBeNull();
  });

  it("extends the window on speech-active so a long user utterance isn't cut", () => {
    const open = h.nowAt();
    h.w.openContinuation(); // would fire at open + 6s
    h.advance(5000); // 1s before the base timeout
    h.w.onSpeechActive();
    // Re-armed well past the original 6s deadline (user still talking).
    expect(h.firesAt()).toBeGreaterThan(open + CONTINUE_WINDOW_MS);
  });

  it("never holds the window past the absolute cap, even under constant speech-active", () => {
    const open = h.nowAt();
    h.w.openContinuation();
    // Continuous background voice tripping VAD every 2s, up to the cap. The
    // scheduled fire time can never be pushed beyond the absolute deadline.
    for (let i = 0; i < 5; i++) {
      h.advance(2000); // 3000, 5000, 7000, 9000, 11000 — all before 13000
      h.w.onSpeechActive();
      expect(h.firesAt() as number).toBeLessThanOrEqual(
        open + ABSOLUTE_LISTEN_MAX_MS,
      );
    }
    // Once the clock reaches/passes the deadline, a re-arm schedules an
    // immediate (0ms) expiry rather than extending further.
    h.advance(2000); // 13000 — at the deadline
    h.w.onSpeechActive();
    expect(h.scheduled()).toBe(0);
  });

  it("collapses to the short grace when the speaker gate reports other voice", () => {
    h.w.openContinuation();
    h.advance(1000);
    h.w.onSpeechActive(); // extended toward the cap...
    expect(h.scheduled()).toBeGreaterThan(OTHER_VOICE_GRACE_MS);
    h.advance(500);
    h.w.onOtherVoice(); // ...but it wasn't the user — collapse.
    expect(h.scheduled()).toBe(OTHER_VOICE_GRACE_MS);
  });

  it("clamps the other-voice grace to the absolute cap near the deadline", () => {
    h.w.openContinuation(); // deadline = 1000 + 12000 = 13000
    h.advance(ABSOLUTE_LISTEN_MAX_MS - 2000); // now 11000, 2s of headroom left
    h.w.onOtherVoice();
    expect(h.scheduled()).toBe(2000); // min(3000, 2000)
  });

  it("keeps waiting a continuation grace on a hallucination/filler segment", () => {
    h.w.openContinuation();
    h.advance(1000);
    h.w.onOtherVoice(); // shrink to 3s
    expect(h.scheduled()).toBe(OTHER_VOICE_GRACE_MS);
    h.w.onHallucination(); // user filler — give it room again
    expect(h.scheduled()).toBe(CONTINUE_WINDOW_MS);
  });

  it("uses MAX_SPEECH_HOLD_MS as the speech-active target while headroom allows", () => {
    h.w.openBareWake();
    // Immediately after open there is ABSOLUTE_LISTEN_MAX_MS of headroom,
    // which is less than MAX_SPEECH_HOLD_MS, so the cap wins.
    h.w.onSpeechActive();
    expect(h.scheduled()).toBe(
      Math.min(MAX_SPEECH_HOLD_MS, ABSOLUTE_LISTEN_MAX_MS),
    );
  });
});
