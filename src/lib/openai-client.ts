import { invoke } from "@tauri-apps/api/core";
import type { Message } from "./conversation-history";

export type ChatClient = {
  complete: (messages: Message[]) => Promise<string>;
};

export type Invoker = <T>(
  cmd: string,
  args: Record<string, unknown>,
) => Promise<T>;

export function createChatClient(
  apiKey: string,
  model: string,
  invoker: Invoker = invoke,
): ChatClient {
  return {
    async complete(messages) {
      const reply = await invoker<string>("chat_complete", {
        apiKey,
        model,
        messages,
      });
      if (!reply) throw new Error("OpenAI returned no content");
      return reply;
    },
  };
}
