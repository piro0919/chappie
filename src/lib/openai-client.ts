import { Channel, invoke } from "@tauri-apps/api/core";
import type { Message } from "./conversation-history";

export type ChatResult = {
  text: string;
  endConversation: boolean;
};

export type ChatClient = {
  complete: (
    messages: Message[],
    onChunk?: (chunk: string) => void,
  ) => Promise<ChatResult>;
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
    async complete(messages, onChunk) {
      // The Rust side streams text deltas through this Channel as soon as
      // they arrive from OpenAI; the renderer uses them to start TTS on
      // partial output. Tests can pass a mock invoker without a Channel.
      const channel = new Channel<string>();
      if (onChunk) {
        channel.onmessage = onChunk;
      }
      const result = await invoker<ChatResult>("chat_complete", {
        apiKey,
        model,
        messages,
        onChunk: channel,
      });
      if (!result || typeof result.text !== "string" || !result.text) {
        throw new Error("OpenAI returned no content");
      }
      return result;
    },
  };
}
