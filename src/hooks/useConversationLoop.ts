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
import {
  createStreamingSpeaker,
  speak,
  speakQueued,
} from "../lib/speech-synthesis";
import {
  createMachine,
  type Machine,
  type Event as MachineEvent,
  type State,
  transition,
} from "../lib/state-machine";
import { detectWake } from "../lib/wake-word";

const DEFAULT_MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT = [
  "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。",
  "数値は読み上げで自然に聞こえる表記にしてください。小数点は『点』と書きます（例: 17.3度 → 17点3度、35% → 35パーセント）。「:」「/」など記号は読み上げると不自然になるので、時刻は「14時30分」、日付は「5月8日」のような表記にしてください。",
].join(" ");
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
  /^ご(視聴|清聴)(いただき|くださり)?(誠に)?ありがとうございました?/,
  /^ご視聴ありがとうございます/,
  /^チャンネル登録/,
  /^高評価/,
  /^[\s\S]*[Ss]ubscrib/,
  /^字幕\s*by/i,
  /^字幕[製作製作]/,
  /^翻訳/,
  /^Thank(s| you)( so (much|very))? for watching/i,
  /^Bye[\s.!]?$/i,
  /^おやすみなさい[。!]?$/,
  /^ありがとう(ございました|ございます)?[。!]?$/,
  /^見てくださって/,
  /^見ていただき/,
  /^お疲れ様でした[。!]?$/,
  /^バイバイ[。!]?$/,
  /^じゃあ?ね[。!]?$/,
  /^んー[。!]?$/,
  /^ん+[。!]?$/,
  /^[ぁ-ん][。!]?$/, // single hiragana
  /^[、。!?\s]+$/, // punctuation only
  /^\(.*\)$/, // parenthetical only e.g. "(音楽)" "(笑)" "(拍手)"
  /^\[.*\]$/,
  /^[\d\s,.,。、]+$/, // digits + punctuation only
];

function isHallucination(text: string): boolean {
  const t = text.trim();
  // Anything 2 chars or less is almost certainly garbage from a half-second
  // VAD blip — except for legit short responses that could only follow a
  // wake-word, which the awaitingBody branch handles separately.
  if (t.length <= 2) return true;
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
    console.info(`[loop] runTurn: "${userText}"`);
    if (!apiKeyRef.current || !chatClientRef.current) {
      console.warn("[loop] no api key — speaking error message");
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

    // Streaming path: kick off the chat completion and start TTS on the
    // first sentence as soon as it arrives, so the user hears Chappie
    // before the full reply has been assembled. The `withMutedCapture`
    // wrapper holds the mic muted from the moment the first chunk lands
    // until all queued sentences have finished speaking.
    type Speaker = {
      feed: (chunk: string) => void;
      flush: () => Promise<void>;
    };

    let reply: string;
    let endConversation = false;
    let firstChunkSeen = false;
    let speaker: Speaker | null = null;

    const ensureSpeaker = () => {
      if (speaker) return;
      ttsActiveRef.current = true;
      void invoke("pause_listening").catch(() => {});
      dispatch({ type: "responseReady", reply: "" });
      speaker = createStreamingSpeaker(voiceURIRef.current);
    };

    try {
      const result = await chatClientRef.current.complete(
        messagesForRequest(historyRef.current),
        (chunk) => {
          if (!firstChunkSeen) {
            firstChunkSeen = true;
            ensureSpeaker();
          }
          speaker?.feed(chunk);
        },
      );
      reply = result.text;
      endConversation = result.endConversation;
    } catch (e) {
      console.error("openai failed", e);
      // Tear down a partial speaker if we got chunks before the error.
      if (speaker) {
        try {
          await (speaker as Speaker).flush();
        } catch {}
      }
      try {
        await withMutedCapture(() =>
          speak("うまく繋がりませんでした。", voiceURIRef.current),
        );
      } catch {}
      scheduleErrorRecovery(String(e));
      return;
    }

    historyRef.current = addAssistant(historyRef.current, reply);
    if (!firstChunkSeen) {
      // Non-streaming fallback: model returned everything before any chunks
      // landed (rare; possible if the round triggered tools and the final
      // answer was short). Speak the whole thing at once.
      try {
        await withMutedCapture(() => speak(reply, voiceURIRef.current));
      } catch (e) {
        console.error("tts failed", e);
      }
    } else if (speaker) {
      try {
        await (speaker as Speaker).flush();
      } catch (e) {
        console.error("tts flush failed", e);
      }
      // Cooldown + resume — match the contract of `withMutedCapture`.
      await new Promise((r) => setTimeout(r, POST_TTS_COOLDOWN_MS));
      await invoke("resume_listening").catch(() => {});
      ttsActiveRef.current = false;
    }
    dispatch({ type: "speechDone" });
    // The model can call end_conversation when the user signaled goodbye;
    // in that case skip the continuation window and require a fresh wake-word
    // for the next turn.
    if (!endConversation) {
      startContinuationWindow();
    }
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
    console.info(
      `[loop] speech recv: "${text}" tts=${ttsActiveRef.current} state=${machineRef.current.state} awaiting=${awaitingBodyRef.current}`,
    );
    if (ttsActiveRef.current) {
      console.info("[loop] dropped: tts active");
      return;
    }
    const cur = machineRef.current.state;
    if (cur === "thinking" || cur === "speaking" || cur === "error") {
      console.info(`[loop] dropped: state=${cur}`);
      return;
    }

    if (isHallucination(text)) {
      console.info(`[loop] dropped: hallucination`);
      return;
    }

    if (awaitingBodyRef.current) {
      console.info(`[loop] body received: "${text}"`);
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
    console.info(
      `[loop] wake match: matched=${m.matched} body="${m.matched ? m.body : ""}"`,
    );
    if (!m.matched) return;

    if (m.body === "") {
      dispatch({ type: "wakeDetected" });
      awaitingBodyRef.current = true;
      followupTimerRef.current = window.setTimeout(() => {
        awaitingBodyRef.current = false;
        followupTimerRef.current = null;
        dispatch({ type: "speechTimeout" });
      }, FOLLOWUP_TIMEOUT_MS);
      // Quick "はい" acknowledgement so the user knows we're listening.
      // Fire-and-forget — we don't await it because the user may start
      // speaking immediately, and `withMutedCapture` would block the
      // pipeline for the cooldown duration.
      void withMutedCapture(() => speak("はい", voiceURIRef.current)).catch(
        () => {},
      );
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

        const off = await listen<string>("speech", (e) => {
          void handleSpeech(e.payload);
        });
        if (cancelled) {
          off();
          return;
        }
        speechOff = off;

        try {
          await invoke("start_listening");
        } catch (e) {
          setError(`マイク開始に失敗: ${String(e)}`);
          void invoke("set_tray_state", { state: "error" }).catch(() => {});
          return;
        }

        if (cancelled) return;

        // Once init finishes, surface a missing API key explicitly: a red
        // tray + warning banner is far more discoverable than letting the
        // user wake Chappie and then hear an audio error.
        if (!apiKeyRef.current) {
          setError(
            "OpenAI API キーが設定されていません。tray メニュー → 設定を開く から登録してください。",
          );
          void invoke("set_tray_state", { state: "error" }).catch(() => {});
          return;
        }

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
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const off = await listen("settings:updated", async () => {
        const s = await loadSettings();
        const wasMissingKey = !apiKeyRef.current;
        apiKeyRef.current = s.openaiApiKey;
        voiceURIRef.current = s.voiceURI;
        modelRef.current = s.model || DEFAULT_MODEL;
        chatClientRef.current = s.openaiApiKey
          ? createChatClient(s.openaiApiKey, modelRef.current)
          : null;
        // Recover from the "no API key" startup error once the user fills
        // it in via Settings → 保存.
        if (wasMissingKey && s.openaiApiKey) {
          setError(null);
          void invoke("set_tray_state", { state: "idle" }).catch(() => {});
        }
      });
      if (cancelled) {
        off();
        return;
      }
      unlisten = off;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Timer fired announcement. Uses `speakQueued` so we don't cancel an
  // ongoing TTS turn — the announcement appends after whatever is currently
  // being spoken. Mic capture is paused while we speak so the announcement
  // doesn't loop back into Whisper.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const off = await listen<{ id: number; label: string }>(
        "timer:fired",
        async (e) => {
          const { label } = e.payload;
          const message = label
            ? `${label}のタイマーです。時間です。`
            : "タイマーです。時間です。";
          console.info(`[timer] fired: id=${e.payload.id} label="${label}"`);
          ttsActiveRef.current = true;
          await invoke("pause_listening").catch(() => {});
          try {
            await speakQueued(message, voiceURIRef.current);
          } catch (err) {
            console.error("[timer] tts failed", err);
          } finally {
            await new Promise((r) => setTimeout(r, POST_TTS_COOLDOWN_MS));
            await invoke("resume_listening").catch(() => {});
            ttsActiveRef.current = false;
          }
        },
      );
      if (cancelled) {
        off();
        return;
      }
      unlisten = off;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return { state, error };
}
