export type Role = "system" | "user" | "assistant";
export type Message = { role: Role; content: string };
export type History = { systemPrompt: string; messages: Message[] };

// Was 20. Lowered to 4 (= 2 user/assistant pairs) because Gemini 2.5 Flash
// gets context-poisoned by recent tool calls in conversation history: e.g.
// after a successful get_battery_status turn, a follow-up "set a 10-second
// timer" gets routed back to get_battery_status. Keeping the window tight
// makes each turn more self-contained at the cost of multi-turn continuity
// (which Free-mode users will feel as "Chappie forgets fast"). Trade-off
// accepted for the locked-in Gemini Flash model.
const MAX_NON_SYSTEM = 4;

export function createHistory(systemPrompt: string): History {
  return { systemPrompt, messages: [] };
}

export function addUser(h: History, content: string): History {
  return cap({ ...h, messages: [...h.messages, { role: "user", content }] });
}

export function addAssistant(h: History, content: string): History {
  return cap({
    ...h,
    messages: [...h.messages, { role: "assistant", content }],
  });
}

export function messagesForRequest(h: History): Message[] {
  return [{ role: "system", content: h.systemPrompt }, ...h.messages];
}

function cap(h: History): History {
  if (h.messages.length <= MAX_NON_SYSTEM) return h;
  return {
    ...h,
    messages: h.messages.slice(h.messages.length - MAX_NON_SYSTEM),
  };
}
