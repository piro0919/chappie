export type State = "idle" | "listening" | "thinking" | "speaking" | "error";

export type Event =
  | { type: "wakeDetected" }
  | { type: "speechCaptured"; text: string }
  | { type: "speechTimeout" }
  | { type: "responseReady"; reply: string }
  | { type: "responseFailed"; message: string }
  | { type: "speechDone" }
  | { type: "errorAcknowledged" };

export type Machine = { state: State };

export function createMachine(): Machine {
  return { state: "idle" };
}

export function transition(m: Machine, e: Event): Machine {
  switch (m.state) {
    case "idle":
      if (e.type === "wakeDetected") return { state: "listening" };
      return m;
    case "listening":
      if (e.type === "speechCaptured") return { state: "thinking" };
      if (e.type === "speechTimeout") return { state: "idle" };
      return m;
    case "thinking":
      if (e.type === "responseReady") return { state: "speaking" };
      if (e.type === "responseFailed") return { state: "error" };
      return m;
    case "speaking":
      if (e.type === "speechDone") return { state: "idle" };
      return m;
    case "error":
      if (e.type === "errorAcknowledged") return { state: "idle" };
      return m;
  }
}
