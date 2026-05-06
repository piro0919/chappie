import { MicVAD } from "@ricky0123/vad-web";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import OpenAI from "openai";
import { useEffect, useRef, useState } from "react";
import {
  addAssistant,
  addUser,
  createHistory,
  type History,
  messagesForRequest,
} from "../lib/conversation-history";
import { createChatClient } from "../lib/openai-client";
import { loadSettings } from "../lib/settings";
import { speak } from "../lib/speech-synthesis";
import {
  createMachine,
  type Machine,
  type Event as MachineEvent,
  type State,
  transition,
} from "../lib/state-machine";
import { detectWake } from "../lib/wake-word";

const MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT =
  "You are Chappie, a friendly hands-free voice assistant. Keep replies short and conversational because they will be read aloud.";
const FOLLOWUP_TIMEOUT_MS = 6000;
const WHISPER_LANG = "ja";

// Common Whisper Japanese hallucinations on silence/noise. Drop these utterances
// instead of letting them flow to wake-word detection.
const HALLUCINATION_PATTERNS = [
  /^ご視聴ありがとうございました/,
  /^チャンネル登録/,
  /^字幕by/i,
  /^Thank you for watching/i,
];

function isHallucination(text: string): boolean {
  const t = text.trim();
  return HALLUCINATION_PATTERNS.some((p) => p.test(t));
}

export function useConversationLoop(): { state: State; error: string | null } {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  const machineRef = useRef<Machine>(createMachine());
  const historyRef = useRef<History>(createHistory(SYSTEM_PROMPT));
  const apiKeyRef = useRef<string>("");
  const voiceURIRef = useRef<string | null>(null);
  const vadRef = useRef<MicVAD | null>(null);
  const awaitingBodyRef = useRef(false);
  const followupTimerRef = useRef<number | null>(null);

  function dispatch(event: MachineEvent) {
    const next = transition(machineRef.current, event);
    if (next === machineRef.current) return;
    machineRef.current = next;
    setState(next.state);
    void invoke("set_tray_state", { state: next.state }).catch(() => {});
  }

  function clearFollowupTimer() {
    if (followupTimerRef.current !== null) {
      clearTimeout(followupTimerRef.current);
      followupTimerRef.current = null;
    }
  }

  async function transcribe(audio: Float32Array): Promise<string> {
    return invoke<string>("transcribe", {
      audio: Array.from(audio),
      language: WHISPER_LANG,
    });
  }

  async function runTurn(userText: string) {
    vadRef.current?.pause();
    try {
      if (!apiKeyRef.current) {
        try {
          await speak(
            "OpenAI APIキーが未設定です。設定画面から登録してください。",
            voiceURIRef.current,
          );
        } catch {}
        dispatch({ type: "responseFailed", message: "no api key" });
        dispatch({ type: "errorAcknowledged" });
        return;
      }

      historyRef.current = addUser(historyRef.current, userText);

      let reply: string;
      try {
        const openai = new OpenAI({
          apiKey: apiKeyRef.current,
          dangerouslyAllowBrowser: true,
        });
        const client = createChatClient(openai, MODEL);
        reply = await client.complete(messagesForRequest(historyRef.current));
      } catch (e) {
        console.error("openai failed", e);
        try {
          await speak("うまく繋がりませんでした。", voiceURIRef.current);
        } catch {}
        dispatch({ type: "responseFailed", message: String(e) });
        dispatch({ type: "errorAcknowledged" });
        return;
      }

      historyRef.current = addAssistant(historyRef.current, reply);
      dispatch({ type: "responseReady", reply });

      try {
        await speak(reply, voiceURIRef.current);
      } catch (e) {
        console.error("tts failed", e);
      }
      dispatch({ type: "speechDone" });
    } finally {
      try {
        vadRef.current?.start();
      } catch {}
    }
  }

  async function handleUtterance(audio: Float32Array) {
    const cur = machineRef.current.state;
    if (cur === "thinking" || cur === "speaking" || cur === "error") return;

    let text = "";
    try {
      text = await transcribe(audio);
    } catch (e) {
      console.error("transcribe failed", e);
      return;
    }
    console.log("[whisper]", text);

    if (isHallucination(text)) {
      console.log("[whisper] hallucination filtered");
      return;
    }

    if (awaitingBodyRef.current) {
      awaitingBodyRef.current = false;
      clearFollowupTimer();
      const body = text.trim();
      if (!body) {
        dispatch({ type: "speechTimeout" });
        return;
      }
      dispatch({ type: "speechCaptured", text: body });
      await runTurn(body);
      return;
    }

    const m = detectWake(text);
    if (!m.matched) return;

    if (m.body === "") {
      dispatch({ type: "wakeDetected" });
      awaitingBodyRef.current = true;
      followupTimerRef.current = window.setTimeout(() => {
        awaitingBodyRef.current = false;
        followupTimerRef.current = null;
        dispatch({ type: "speechTimeout" });
      }, FOLLOWUP_TIMEOUT_MS);
      return;
    }

    dispatch({ type: "wakeDetected" });
    dispatch({ type: "speechCaptured", text: m.body });
    await runTurn(m.body);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: init runs once; handlers read refs
  useEffect(() => {
    let cancelled = false;
    let progressOff: (() => void) | undefined;
    void (async () => {
      try {
        const s = await loadSettings();
        apiKeyRef.current = s.openaiApiKey;
        voiceURIRef.current = s.voiceURI;

        // Show download progress in tray while model is fetched.
        void invoke("set_tray_state", { state: "thinking" }).catch(() => {});
        progressOff = await listen<{ received: number; total: number }>(
          "model:progress",
          (e) => {
            const pct = e.payload.total
              ? Math.floor((e.payload.received / e.payload.total) * 100)
              : 0;
            setError(`Whisper モデルを取得中… ${pct}%`);
          },
        );
        try {
          await invoke<string>("ensure_model");
        } catch (e) {
          setError(`モデル取得に失敗: ${String(e)}`);
          void invoke("set_tray_state", { state: "error" }).catch(() => {});
          return;
        } finally {
          progressOff?.();
          progressOff = undefined;
        }
        setError(null);

        const vad = await MicVAD.new({
          baseAssetPath: "/",
          onnxWASMBasePath: "/",
          onSpeechEnd: (audio) => {
            void handleUtterance(audio);
          },
        });
        if (cancelled) {
          vad.destroy();
          return;
        }
        vadRef.current = vad;
        vad.start();
        void invoke("set_tray_state", { state: "idle" }).catch(() => {});
      } catch (e) {
        console.error("conversation loop init failed", e);
        setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      progressOff?.();
      clearFollowupTimer();
      vadRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen("settings:updated", async () => {
        const s = await loadSettings();
        apiKeyRef.current = s.openaiApiKey;
        voiceURIRef.current = s.voiceURI;
      });
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  return { state, error };
}
