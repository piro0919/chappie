import { MicVAD } from "@ricky0123/vad-web";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

type Status =
  | "init"
  | "loading-vad"
  | "ready"
  | "listening"
  | "transcribing"
  | "error";

function App() {
  const [status, setStatus] = useState<Status>("init");
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const vadRef = useRef<MicVAD | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading-vad");
        const vad = await MicVAD.new({
          baseAssetPath: "/",
          onnxWASMBasePath: "/",
          onSpeechStart: () => {
            console.log("[vad] speech start");
          },
          onSpeechEnd: async (audio: Float32Array) => {
            console.log("[vad] speech end, samples:", audio.length);
            setStatus("transcribing");
            try {
              const text = await invoke<string>("transcribe", {
                audio: Array.from(audio),
                language: "ja",
              });
              setTranscripts((prev) => [...prev, text]);
              console.log("[whisper-rs]", text);
            } catch (err) {
              console.error("transcribe failed", err);
              setError(String(err));
            } finally {
              setStatus("listening");
            }
          },
          onVADMisfire: () => {
            console.log("[vad] misfire");
          },
        });
        if (cancelled) {
          vad.destroy();
          return;
        }
        vadRef.current = vad;
        setStatus("ready");
      } catch (e) {
        console.error("VAD init failed", e);
        setError(String(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      vadRef.current?.destroy();
    };
  }, []);

  const startListening = (): void => {
    if (!vadRef.current) return;
    vadRef.current.start();
    setStatus("listening");
  };

  const stopListening = (): void => {
    if (!vadRef.current) return;
    vadRef.current.pause();
    setStatus("ready");
  };

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18 }}>Chappie PoC: VAD + whisper-rs</h1>
      <div>状態: {status}</div>
      {error && (
        <div style={{ color: "red", whiteSpace: "pre-wrap", marginTop: 4 }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={startListening}
          disabled={status !== "ready"}
        >
          開始
        </button>
        <button
          type="button"
          onClick={stopListening}
          disabled={status !== "listening" && status !== "transcribing"}
          style={{ marginLeft: 8 }}
        >
          停止
        </button>
      </div>
      <h2 style={{ fontSize: 14, marginTop: 20 }}>文字起こし</h2>
      <ul>
        {transcripts.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: PoC list, replaced in Task 3
          <li key={`${i}-${t.length}`}>{t}</li>
        ))}
      </ul>
    </main>
  );
}

export default App;
