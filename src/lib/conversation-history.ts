export type Role = "system" | "user" | "assistant";
export type Message = { role: Role; content: string };
export type History = { systemPrompt: string; messages: Message[] };

const MAX_NON_SYSTEM = 20;

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
