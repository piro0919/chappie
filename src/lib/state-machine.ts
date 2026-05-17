// Discriminated-union state for the conversation loop. Two states carry
// sub-flags that used to live as standalone refs in useConversationLoop:
//
//   listening.awaitingContinuation
//     True during the post-turn continuation window (and during the
//     wake-without-body "waiting for body" path) where we accept the
//     next utterance as the body without requiring a fresh wake word.
//     Replaces the former `awaitingBodyRef`.
//
//   speaking.bargeIn
//     True while TTS is playing AND the mic is intentionally hot so
//     stop-commands ("ストップ" / "stop") can interrupt. The audio.rs
//     side raises VAD/RMS thresholds in this mode; renderer filters
//     incoming events through `isBargeInCommand`. Replaces the former
//     `bargeInActiveRef`.
//
// The top-level state name (the inner `state` discriminator) is what
// gets pushed to the Rust tray icon — keeping the 6 names stable
// (initializing / idle / listening / thinking / speaking / error)
// means the tray mapping doesn't change.

export type State =
  | { state: "initializing" }
  | { state: "idle" }
  | { state: "listening"; awaitingContinuation: boolean }
  | { state: "thinking" }
  | { state: "speaking"; bargeIn: boolean }
  | { state: "error" };

export type Event =
  | { type: "initializationDone" }
  | { type: "initializationFailed"; message: string }
  | { type: "wakeDetected" }
  | { type: "continuationOpened" }
  | { type: "speechCaptured"; text: string }
  | { type: "speechTimeout" }
  | { type: "responseReady"; reply: string }
  | { type: "responseFailed"; message: string }
  | { type: "bargeInStarted" }
  | { type: "speechDone" }
  | { type: "errorAcknowledged" };

export type Machine = { state: State };

export function createMachine(): Machine {
  return { state: { state: "initializing" } };
}

export function transition(m: Machine, e: Event): Machine {
  switch (m.state.state) {
    case "initializing":
      if (e.type === "initializationDone") return { state: { state: "idle" } };
      if (e.type === "initializationFailed")
        return { state: { state: "error" } };
      return m;
    case "idle":
      if (e.type === "wakeDetected")
        return { state: { state: "listening", awaitingContinuation: false } };
      if (e.type === "continuationOpened")
        return { state: { state: "listening", awaitingContinuation: true } };
      return m;
    case "listening":
      if (e.type === "speechCaptured") return { state: { state: "thinking" } };
      if (e.type === "speechTimeout") return { state: { state: "idle" } };
      return m;
    case "thinking":
      if (e.type === "responseReady")
        return { state: { state: "speaking", bargeIn: false } };
      if (e.type === "responseFailed") return { state: { state: "error" } };
      return m;
    case "speaking":
      if (e.type === "bargeInStarted") {
        if (m.state.bargeIn) return m;
        return { state: { state: "speaking", bargeIn: true } };
      }
      if (e.type === "speechDone") return { state: { state: "idle" } };
      return m;
    case "error":
      if (e.type === "errorAcknowledged") return { state: { state: "idle" } };
      return m;
  }
}
