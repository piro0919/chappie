import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import {
  addAssistant,
  addUser,
  createHistory,
  type History,
  messagesForRequest,
} from "../lib/conversation-history";
import { type ChatClient, createChatClient } from "../lib/openai-client";
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

const DEFAULT_MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT =
  "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。";
const FOLLOWUP_TIMEOUT_MS = 6000;
// After Chappie finishes speaking, accept follow-up without requiring a fresh
// "チャッピー" wake-word for this window. Lets a multi-turn conversation flow.
const CONTINUE_WINDOW_MS = 6000;
// Time the tray "error" state stays visible before auto-recovering.
const ERROR_DISPLAY_MS = 1800;
// Cooldown after TTS finishes before the mic capture is re-enabled. Leaves
// room for speaker reverb and ensures Chappie doesn't re-trigger on its tail.
const POST_TTS_COOLDOWN_MS = 350;

// Common Whisper Japanese hallucinations on silence/noise. Drop these utterances
// instead of letting them flow to wake-word detection.
const HALLUCINATION_PATTERNS = [
  /^ご(視聴|清聴)(いただき)?ありがとうございました/,
  /^ご視聴ありがとうございます/,
  /^チャンネル登録/,
  /^字幕\s*by/i,
  /^Thank(s| you)( so much)? for watching/i,
  /^Subscribe/i,
  /^おやすみなさい[。!]?$/,
  /^ありがとうございました[。!]?$/,
  /^見てくださってありがとうございました/,
  /^お疲れ様でした[。!]?$/,
  /^バイバイ[。!]?$/,
  /^んー[。!]?$/,
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
  const modelRef = useRef<string>(DEFAULT_MODEL);
  const chatClientRef = useRef<ChatClient | null>(null);
  const voiceURIRef = useRef<string | null>(null);
  const awaitingBodyRef = useRef(false);
  const followupTimerRef = useRef<number | null>(null);
  const ttsActiveRef = useRef(false);
  const errorRecoveryTimerRef = useRef<number | null>(null);

  async function withMutedCapture<T>(fn: () => Promise<T>): Promise<T> {
    ttsActiveRef.current = true;
    await invoke("pause_listening").catch(() => {});
    try {
      return await fn();
    } finally {
      // Wait out speaker reverb before re-enabling capture so we don't
      // re-trigger on the tail of our own TTS.
      await new Promise((r) => setTimeout(r, POST_TTS_COOLDOWN_MS));
      await invoke("resume_listening").catch(() => {});
      ttsActiveRef.current = false;
    }
  }

  function scheduleErrorRecovery(message: string) {
    dispatch({ type: "responseFailed", message });
    if (errorRecoveryTimerRef.current !== null) {
      clearTimeout(errorRecoveryTimerRef.current);
    }
    errorRecoveryTimerRef.current = window.setTimeout(() => {
      errorRecoveryTimerRef.current = null;
      dispatch({ type: "errorAcknowledged" });
    }, ERROR_DISPLAY_MS);
  }

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

  async function runTurn(userText: string) {
    if (!apiKeyRef.current || !chatClientRef.current) {
      try {
        await withMutedCapture(() =>
          speak(
            "OpenAI APIキーが未設定です。設定画面から登録してください。",
            voiceURIRef.current,
          ),
        );
      } catch {}
      scheduleErrorRecovery("no api key");
      return;
    }

    historyRef.current = addUser(historyRef.current, userText);

    let reply: string;
    try {
      reply = await chatClientRef.current.complete(
        messagesForRequest(historyRef.current),
      );
    } catch (e) {
      console.error("openai failed", e);
      try {
        await withMutedCapture(() =>
          speak("うまく繋がりませんでした。", voiceURIRef.current),
        );
      } catch {}
      scheduleErrorRecovery(String(e));
      return;
    }

    historyRef.current = addAssistant(historyRef.current, reply);
    dispatch({ type: "responseReady", reply });

    try {
      await withMutedCapture(() => speak(reply, voiceURIRef.current));
    } catch (e) {
      console.error("tts failed", e);
    }
    dispatch({ type: "speechDone" });
    startContinuationWindow();
  }

  function startContinuationWindow() {
    clearFollowupTimer();
    dispatch({ type: "wakeDetected" });
    awaitingBodyRef.current = true;
    followupTimerRef.current = window.setTimeout(() => {
      awaitingBodyRef.current = false;
      followupTimerRef.current = null;
      dispatch({ type: "speechTimeout" });
    }, CONTINUE_WINDOW_MS);
  }

  async function handleSpeech(text: string) {
    if (ttsActiveRef.current) return;
    const cur = machineRef.current.state;
    if (cur === "thinking" || cur === "speaking" || cur === "error") return;

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
    let speechOff: (() => void) | undefined;
    void (async () => {
      try {
        const s = await loadSettings();
        apiKeyRef.current = s.openaiApiKey;
        voiceURIRef.current = s.voiceURI;
        modelRef.current = s.model || DEFAULT_MODEL;
        chatClientRef.current = s.openaiApiKey
          ? createChatClient(s.openaiApiKey, modelRef.current)
          : null;

        void invoke("set_tray_state", { state: "initializing" }).catch(
          () => {},
        );
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
          // Always request — the system prompt only fires through this path
          // for ad-hoc signed LSUIElement apps (cached status can be wrong).
          const granted = await invoke<boolean>(
            "request_microphone_access",
          ).catch(() => false);
          if (!granted) {
            setError(
              "マイクの使用が許可されていません。システム設定 → プライバシーとセキュリティ → マイク で Chappie を有効にしてください。",
            );
            void invoke("set_tray_state", { state: "error" }).catch(() => {});
            return;
          }
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

        speechOff = await listen<string>("speech", (e) => {
          void handleSpeech(e.payload);
        });

        try {
          await invoke("start_listening");
        } catch (e) {
          setError(`マイク開始に失敗: ${String(e)}`);
          void invoke("set_tray_state", { state: "error" }).catch(() => {});
          return;
        }

        if (cancelled) return;
        void invoke("set_tray_state", { state: "idle" }).catch(() => {});
      } catch (e) {
        console.error("conversation loop init failed", e);
        setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      progressOff?.();
      speechOff?.();
      clearFollowupTimer();
      if (errorRecoveryTimerRef.current !== null) {
        clearTimeout(errorRecoveryTimerRef.current);
        errorRecoveryTimerRef.current = null;
      }
      void invoke("stop_listening").catch(() => {});
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listen("settings:updated", async () => {
        const s = await loadSettings();
        apiKeyRef.current = s.openaiApiKey;
        voiceURIRef.current = s.voiceURI;
        modelRef.current = s.model || DEFAULT_MODEL;
        chatClientRef.current = s.openaiApiKey
          ? createChatClient(s.openaiApiKey, modelRef.current)
          : null;
      });
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  return { state, error };
}
