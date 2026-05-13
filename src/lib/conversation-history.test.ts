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

  it("caps non-system messages at 4 (2 user/assistant pairs), dropping oldest", () => {
    let h = createHistory(SYSTEM);
    for (let i = 0; i < 5; i++) {
      h = addUser(h, `u${i}`);
      h = addAssistant(h, `a${i}`);
    }
    const msgs = messagesForRequest(h);
    expect(msgs[0]).toEqual({ role: "system", content: SYSTEM });
    expect(msgs.length).toBe(5); // system + 4
    // Last 2 pairs kept: u3 a3 u4 a4
    expect(msgs[1]).toEqual({ role: "user", content: "u3" });
    expect(msgs[4]).toEqual({ role: "assistant", content: "a4" });
  });
});
