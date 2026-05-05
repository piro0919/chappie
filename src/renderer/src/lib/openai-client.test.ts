import { describe, expect, it, vi } from "vitest";
import { createChatClient } from "./openai-client";

describe("openai-client", () => {
  it("sends messages and returns assistant reply text", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "hi back" } }],
    });
    const fakeOpenAI = { chat: { completions: { create } } } as never;
    const client = createChatClient(fakeOpenAI, "gpt-4o-mini");
    const reply = await client.complete([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
    expect(reply).toBe("hi back");
    expect(create).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
    });
  });

  it("throws when no choices returned", async () => {
    const create = vi.fn().mockResolvedValue({ choices: [] });
    const fakeOpenAI = { chat: { completions: { create } } } as never;
    const client = createChatClient(fakeOpenAI, "gpt-4o-mini");
    await expect(client.complete([])).rejects.toThrow();
  });
});
