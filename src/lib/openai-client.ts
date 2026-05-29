import { Channel, invoke } from "@tauri-apps/api/core";
import type { Message } from "./conversation-history";
import type { Mode } from "./settings";

export type ChatResult = {
  text: string;
  endConversation: boolean;
};

export type CompleteOpts = {
  // Pure text generation: ask Rust to offer no tools and skip context
  // injection. Used for proactive persona rewrites / idle chatter so the
  // flavoring text can't make the model fire side-effecting tools (e.g. a
  // calendar warning being misread as a set_timer request).
  noTools?: boolean;
};

export type ChatClient = {
  complete: (
    messages: Message[],
    onChunk?: (chunk: string) => void,
    opts?: CompleteOpts,
  ) => Promise<ChatResult>;
};

export type Invoker = <T>(
  cmd: string,
  args: Record<string, unknown>,
) => Promise<T>;

/**
 * `subscriptionTokenGetter` is read on every call (not captured at
 * factory time) so a fresh Pro upgrade or sign-out is picked up on the
 * very next chat without rebuilding the loop. Empty string = anonymous.
 */
export function createChatClient(
  apiKey: string,
  model: string,
  mode: Mode = "byok",
  invoker: Invoker = invoke,
  subscriptionTokenGetter: () => string = () => "",
): ChatClient {
  return {
    async complete(messages, onChunk, opts) {
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
        mode,
        subscriptionToken: subscriptionTokenGetter(),
        messages,
        onChunk: channel,
        noTools: opts?.noTools ?? false,
      });
      if (!result || typeof result.text !== "string" || !result.text) {
        throw new Error("OpenAI returned no content");
      }
      return result;
    },
  };
}
