import { useConversationLoop } from "../hooks/useConversationLoop";

export function ConversationView() {
  const { state, error } = useConversationLoop();
  return (
    <main style={{ padding: 8, fontFamily: "system-ui, sans-serif" }}>
      <div>Chappie worker</div>
      <div>状態: {state}</div>
      {error && (
        <div style={{ color: "red", whiteSpace: "pre-wrap", marginTop: 4 }}>
          {error}
        </div>
      )}
    </main>
  );
}
