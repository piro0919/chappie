import { useConversationLoop } from "../hooks/useConversationLoop";

/** Headless worker for the hidden main window. Mounts the conversation loop
 *  (mic capture init, wake-word handling, OpenAI streaming, TTS) and renders
 *  nothing visible — diagnostics live in the Web Inspector console via the
 *  log bridge. The window itself is hidden by lib.rs. */
export function ConversationWorker(): null {
  useConversationLoop();
  return null;
}
