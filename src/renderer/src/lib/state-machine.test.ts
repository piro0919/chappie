import { describe, expect, it } from "vitest";
import { createMachine, transition } from "./state-machine";

describe("state-machine", () => {
  it("starts in idle", () => {
    expect(createMachine().state).toBe("idle");
  });

  it("idle → listening on wakeDetected", () => {
    const m = createMachine();
    expect(transition(m, { type: "wakeDetected" }).state).toBe("listening");
  });

  it("listening → thinking on speechCaptured", () => {
    const m = transition(createMachine(), { type: "wakeDetected" });
    expect(transition(m, { type: "speechCaptured", text: "hi" }).state).toBe(
      "thinking",
    );
  });

  it("listening → idle on speechTimeout", () => {
    const m = transition(createMachine(), { type: "wakeDetected" });
    expect(transition(m, { type: "speechTimeout" }).state).toBe("idle");
  });

  it("thinking → speaking on responseReady", () => {
    let m = transition(createMachine(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    expect(transition(m, { type: "responseReady", reply: "hello" }).state).toBe(
      "speaking",
    );
  });

  it("thinking → error on responseFailed", () => {
    let m = transition(createMachine(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    expect(
      transition(m, { type: "responseFailed", message: "oops" }).state,
    ).toBe("error");
  });

  it("speaking → idle on speechDone", () => {
    let m = transition(createMachine(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    m = transition(m, { type: "responseReady", reply: "hello" });
    expect(transition(m, { type: "speechDone" }).state).toBe("idle");
  });

  it("error → idle on errorAcknowledged", () => {
    let m = transition(createMachine(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    m = transition(m, { type: "responseFailed", message: "oops" });
    expect(transition(m, { type: "errorAcknowledged" }).state).toBe("idle");
  });

  it("ignores invalid transitions (returns same machine)", () => {
    const m = createMachine();
    expect(transition(m, { type: "speechDone" })).toBe(m);
  });
});
