import { describe, expect, it, vi } from "vitest";
import { createChatClient } from "./openai-client";

describe("openai-client", () => {
  it("invokes chat_complete with apiKey/model/messages and returns reply", async () => {
    const invoker = vi.fn().mockResolvedValue("hi back");
    const client = createChatClient("sk-test", "gpt-4o-mini", invoker);
    const reply = await client.complete([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
    expect(reply).toBe("hi back");
    expect(invoker).toHaveBeenCalledWith("chat_complete", {
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
    });
  });

  it("throws when invoker returns empty content", async () => {
    const invoker = vi.fn().mockResolvedValue("");
    const client = createChatClient("sk-test", "gpt-4o-mini", invoker);
    await expect(client.complete([])).rejects.toThrow();
  });
});
