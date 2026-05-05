import { useConversationLoop } from "../hooks/useConversationLoop";

export function ConversationView(): React.JSX.Element {
  const { state, isSupported } = useConversationLoop();
  return (
    <div style={{ padding: 8, fontFamily: "system-ui, sans-serif" }}>
      <div>Chappie worker</div>
      <div>状態: {state}</div>
      {!isSupported && (
        <div style={{ color: "red" }}>Web Speech API 非対応の環境です</div>
      )}
    </div>
  );
}
