import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  Channel: class {
    onmessage: ((msg: string) => void) | null = null;
  },
}));

import { createChatClient } from "./openai-client";

describe("openai-client", () => {
  it("returns text and endConversation flag", async () => {
    const invoker = vi
      .fn()
      .mockResolvedValue({ text: "hi back", endConversation: false });
    const client = createChatClient("sk-test", "gpt-4o-mini", "byok", invoker);
    const result = await client.complete([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
    expect(result).toEqual({ text: "hi back", endConversation: false });
    expect(invoker).toHaveBeenCalledWith(
      "chat_complete",
      expect.objectContaining({
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "sys" },
          { role: "user", content: "hi" },
        ],
      }),
    );
  });

  it("propagates endConversation = true", async () => {
    const invoker = vi
      .fn()
      .mockResolvedValue({ text: "またね", endConversation: true });
    const client = createChatClient("sk-test", "gpt-4o-mini", "byok", invoker);
    expect(await client.complete([])).toEqual({
      text: "またね",
      endConversation: true,
    });
  });

  it("throws when text is empty", async () => {
    const invoker = vi
      .fn()
      .mockResolvedValue({ text: "", endConversation: false });
    const client = createChatClient("sk-test", "gpt-4o-mini", "byok", invoker);
    await expect(client.complete([])).rejects.toThrow();
  });
});
