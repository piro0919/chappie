import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useConversationLoop } from "../hooks/useConversationLoop";

type LogEntry = { ts: string; text: string };

export function ConversationView() {
  const { state, error } = useConversationLoop();
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen<string>("speech", (e) => {
        const ts = new Date().toLocaleTimeString("ja-JP", { hour12: false });
        setLog((prev) => [{ ts, text: e.payload }, ...prev].slice(0, 50));
      });
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <main
      style={{
        padding: 12,
        fontFamily:
          "system-ui, -apple-system, 'Hiragino Sans', 'Yu Gothic', sans-serif",
        fontSize: 13,
        color: "#222",
        background: "#fafafa",
        height: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong>Chappie デバッグ</strong>
        <span style={{ color: "#666" }}>状態: {state}</span>
      </header>

      {error && (
        <div
          style={{
            color: "#b00020",
            whiteSpace: "pre-wrap",
            background: "#fff3f3",
            padding: 6,
            border: "1px solid #f3c2c2",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          flex: 1,
          overflowY: "auto",
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 4,
          padding: 6,
        }}
      >
        <div style={{ color: "#888", marginBottom: 4, fontSize: 11 }}>
          直近の文字起こし（新しいものが上）
        </div>
        {log.length === 0 && (
          <div style={{ color: "#aaa" }}>まだ何も検出されていません。</div>
        )}
        {log.map((e, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
            key={i}
            style={{
              padding: "4px 0",
              borderBottom: i === log.length - 1 ? "none" : "1px solid #eee",
            }}
          >
            <span
              style={{ color: "#999", fontFamily: "monospace", marginRight: 6 }}
            >
              {e.ts}
            </span>
            <span>{e.text}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
