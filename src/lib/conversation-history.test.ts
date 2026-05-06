import { describe, expect, it } from "vitest";
import {
  addAssistant,
  addUser,
  createHistory,
  messagesForRequest,
} from "./conversation-history";

const SYSTEM = "You are Chappie.";

describe("conversation-history", () => {
  it("starts empty (system prompt only)", () => {
    const h = createHistory(SYSTEM);
    expect(messagesForRequest(h)).toEqual([
      { role: "system", content: SYSTEM },
    ]);
  });

  it("adds user and assistant messages in order", () => {
    let h = createHistory(SYSTEM);
    h = addUser(h, "hi");
    h = addAssistant(h, "hello");
    expect(messagesForRequest(h)).toEqual([
      { role: "system", content: SYSTEM },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("caps non-system messages at 20, dropping oldest", () => {
    let h = createHistory(SYSTEM);
    for (let i = 0; i < 15; i++) {
      h = addUser(h, `u${i}`);
      h = addAssistant(h, `a${i}`);
    }
    const msgs = messagesForRequest(h);
    expect(msgs[0]).toEqual({ role: "system", content: SYSTEM });
    expect(msgs.length).toBe(21); // system + 20
    expect(msgs[1]).toEqual({ role: "user", content: "u5" }); // first 10 (u0..u4 + a0..a4) dropped
  });
});
