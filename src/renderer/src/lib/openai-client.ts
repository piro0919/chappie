import type OpenAI from "openai";
import type { Message } from "./conversation-history";

export type ChatClient = {
  complete: (messages: Message[]) => Promise<string>;
};

export function createChatClient(
  openai: Pick<OpenAI, "chat">,
  model: string,
): ChatClient {
  return {
    async complete(messages) {
      const res = await openai.chat.completions.create({ model, messages });
      const reply = res.choices[0]?.message?.content;
      if (!reply) throw new Error("OpenAI returned no content");
      return reply;
    },
  };
}
