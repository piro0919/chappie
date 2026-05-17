import { describe, expect, it } from "vitest";
import { createMachine, type Machine, transition } from "./state-machine";

function ready(): Machine {
  return transition(createMachine(), { type: "initializationDone" });
}

describe("state-machine", () => {
  it("starts in initializing", () => {
    expect(createMachine().state.state).toBe("initializing");
  });

  it("initializing → idle on initializationDone", () => {
    const m = createMachine();
    expect(transition(m, { type: "initializationDone" }).state.state).toBe(
      "idle",
    );
  });

  it("initializing → error on initializationFailed", () => {
    const m = createMachine();
    const next = transition(m, {
      type: "initializationFailed",
      message: "x",
    });
    expect(next.state.state).toBe("error");
  });

  it("idle → listening (no continuation) on wakeDetected", () => {
    const next = transition(ready(), { type: "wakeDetected" });
    expect(next.state).toEqual({
      state: "listening",
      awaitingContinuation: false,
    });
  });

  it("idle → listening (awaiting continuation) on continuationOpened", () => {
    const next = transition(ready(), { type: "continuationOpened" });
    expect(next.state).toEqual({
      state: "listening",
      awaitingContinuation: true,
    });
  });

  it("listening → thinking on speechCaptured", () => {
    const m = transition(ready(), { type: "wakeDetected" });
    expect(
      transition(m, { type: "speechCaptured", text: "hi" }).state.state,
    ).toBe("thinking");
  });

  it("continuation-listening → thinking on speechCaptured", () => {
    const m = transition(ready(), { type: "continuationOpened" });
    expect(
      transition(m, { type: "speechCaptured", text: "hi" }).state.state,
    ).toBe("thinking");
  });

  it("listening → idle on speechTimeout", () => {
    const m = transition(ready(), { type: "wakeDetected" });
    expect(transition(m, { type: "speechTimeout" }).state.state).toBe("idle");
  });

  it("thinking → speaking (bargeIn false) on responseReady", () => {
    let m = transition(ready(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    const next = transition(m, { type: "responseReady", reply: "hello" });
    expect(next.state).toEqual({ state: "speaking", bargeIn: false });
  });

  it("speaking gains bargeIn on bargeInStarted", () => {
    let m = transition(ready(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    m = transition(m, { type: "responseReady", reply: "hello" });
    const next = transition(m, { type: "bargeInStarted" });
    expect(next.state).toEqual({ state: "speaking", bargeIn: true });
  });

  it("ignores duplicate bargeInStarted (returns same machine)", () => {
    let m = transition(ready(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    m = transition(m, { type: "responseReady", reply: "hello" });
    m = transition(m, { type: "bargeInStarted" });
    expect(transition(m, { type: "bargeInStarted" })).toBe(m);
  });

  it("thinking → error on responseFailed", () => {
    let m = transition(ready(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    expect(
      transition(m, { type: "responseFailed", message: "oops" }).state.state,
    ).toBe("error");
  });

  it("speaking → idle on speechDone (clears bargeIn)", () => {
    let m = transition(ready(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    m = transition(m, { type: "responseReady", reply: "hello" });
    m = transition(m, { type: "bargeInStarted" });
    const next = transition(m, { type: "speechDone" });
    expect(next.state.state).toBe("idle");
  });

  it("error → idle on errorAcknowledged", () => {
    let m = transition(ready(), { type: "wakeDetected" });
    m = transition(m, { type: "speechCaptured", text: "hi" });
    m = transition(m, { type: "responseFailed", message: "oops" });
    expect(transition(m, { type: "errorAcknowledged" }).state.state).toBe(
      "idle",
    );
  });

  it("ignores invalid transitions (returns same machine)", () => {
    const m = createMachine();
    expect(transition(m, { type: "speechDone" })).toBe(m);
  });
});
