// Timing rules for the "listening" window (the 聞いてます tray state) in
// useConversationLoop, extracted as a pure controller so they can be
// unit-tested without React, Tauri, or real timers.
//
// The window opens on a bare wake ("チャッピー" with no body yet) or a
// post-turn continuation, and must close back to idle (待機中) when the
// user is done — but deciding "done" is subtle:
//
//   - A long *user* utterance must not be cut off mid-sentence. VAD reports
//     speech-active at the *start* of a segment, before the speaker gate can
//     say whose voice it is, so we extend the window on speech-active.
//   - But continuous background voice (a TV, other people — all later
//     rejected by the speaker gate) also trips speech-active. Left
//     unchecked it re-extends the window forever and the status never
//     returns to 待機中. So:
//       * an absolute wall-clock cap bounds the window no matter what
//         (also the only guard when no voiceprint is enrolled, since then
//         there is no speaker gate and no "other voice" signal), and
//       * when the speaker gate *does* reject a segment as other voice,
//         we collapse the window to a short grace immediately.
//
// The host owns the real timer (setTimeout); this owns *how long* to wait
// and the absolute deadline.

export const FOLLOWUP_TIMEOUT_MS = 6000; // bare wake: wait for the body
export const CONTINUE_WINDOW_MS = 6000; // post-turn: wait for a follow-up
export const MAX_SPEECH_HOLD_MS = 15000; // speech-active extension ceiling
export const ABSOLUTE_LISTEN_MAX_MS = 12000; // hard cap from window open
export const OTHER_VOICE_GRACE_MS = 3000; // collapse after "other voice"

export interface WindowDeps {
  /** Current wall-clock time in ms (Date.now in the host). */
  now(): number;
  /** Schedule `fire` after delayMs, cancelling any pending timer first. */
  setTimer(delayMs: number, fire: () => void): void;
  /** Cancel any pending timer. */
  clearTimer(): void;
  /** The window expired — host drops the state machine to idle. */
  onExpire(): void;
}

export class ListeningWindow {
  // Absolute wall-clock deadline (ms epoch); 0 means no window is open.
  private deadline = 0;

  constructor(private readonly deps: WindowDeps) {}

  get isOpen(): boolean {
    return this.deadline > 0;
  }

  /** Open after a bare wake word, waiting for the command body. */
  openBareWake(): void {
    this.openWith(FOLLOWUP_TIMEOUT_MS);
  }

  /** Open the post-turn continuation window. */
  openContinuation(): void {
    this.openWith(CONTINUE_WINDOW_MS);
  }

  /** VAD reported voice (before the speaker gate): extend, bounded by cap. */
  onSpeechActive(): void {
    if (this.isOpen) this.arm(MAX_SPEECH_HOLD_MS);
  }

  /** Speaker gate rejected the segment as other voice: collapse to grace. */
  onOtherVoice(): void {
    if (this.isOpen) this.arm(OTHER_VOICE_GRACE_MS);
  }

  /** A user filler / hallucination segment: keep waiting a bit longer. */
  onHallucination(): void {
    if (this.isOpen) this.arm(CONTINUE_WINDOW_MS);
  }

  /** Body consumed, or the host is closing the window. */
  close(): void {
    this.deadline = 0;
    this.deps.clearTimer();
  }

  private openWith(baseMs: number): void {
    this.deadline = this.deps.now() + ABSOLUTE_LISTEN_MAX_MS;
    this.arm(baseMs);
  }

  // Schedule the timeout `ms` from now, but never past the absolute
  // deadline — so re-arms from ambient voice cannot hold the window open
  // beyond ABSOLUTE_LISTEN_MAX_MS of opening.
  private arm(ms: number): void {
    const remaining = this.deadline - this.deps.now();
    const effective = Math.min(ms, Math.max(0, remaining));
    this.deps.setTimer(effective, () => {
      this.deadline = 0;
      this.deps.onExpire();
    });
  }
}
