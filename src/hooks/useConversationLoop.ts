import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { getWakeAcks, resolveLanguage, t as tRaw } from "../i18n/messages";
import {
  addAssistant,
  addUser,
  createHistory,
  type History,
  messagesForRequest,
} from "../lib/conversation-history";
import { type ChatClient, createChatClient } from "../lib/openai-client";
import { type Language, loadSettings } from "../lib/settings";
import {
  createStreamingSpeaker,
  setEngineOpts,
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
import { VOICEVOX_CURATED_SPEAKERS } from "../lib/voicevox-speakers";
import { detectWake } from "../lib/wake-word";

const DEFAULT_MODEL = "gpt-4o-mini";
function buildSystemPrompt(lang: Language): string {
  return [
    tRaw(lang, "systemPrompt.persona"),
    tRaw(lang, "systemPrompt.formatTts"),
  ].join(" ");
}
const FOLLOWUP_TIMEOUT_MS = 6000;
// After Chappie finishes speaking, accept follow-up without requiring a fresh
// "チャッピー" wake-word for this window. Lets a multi-turn conversation flow.
const CONTINUE_WINDOW_MS = 6000;
// Time the tray "error" state stays visible before auto-recovering.
const ERROR_DISPLAY_MS = 1800;
function pickWakeAck(lang: Language): string {
  const acks = getWakeAcks(lang);
  return acks[Math.floor(Math.random() * acks.length)];
}
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
  const historyRef = useRef<History>(createHistory(buildSystemPrompt("auto")));
  const apiKeyRef = useRef<string>("");
  const chatClientRef = useRef<ChatClient | null>(null);
  const langRef = useRef<Language>("auto");
  const awaitingBodyRef = useRef(false);
  const followupTimerRef = useRef<number | null>(null);
  const ttsActiveRef = useRef(false);
  const errorRecoveryTimerRef = useRef<number | null>(null);
  // VOICEVOX speaker active for the current/next turn (set by
  // applyVoiceForWake). undefined = use chappie's own voice/persona, no
  // 口調 override. Used by runTurn to inject the per-character persona as a
  // 2nd system message.
  const voicevoxSpeakerIdRef = useRef<number | undefined>(undefined);

  // When the system is muted, Chappie's TTS is inaudible — route the reply
  // to the HUD as text instead. Duration scales with length so longer text
  // stays up long enough to read; clamped to 3-30s.
  async function showOnHud(text: string) {
    const duration = Math.max(5000, Math.min(45000, text.length * 200));
    console.info(`[loop] hud_show chars=${text.length} dur=${duration}`);
    try {
      await invoke("hud_show", { text, durationMs: duration });
    } catch (e) {
      console.error("[loop] hud_show invoke failed", e);
    }
  }

  async function isSystemMuted(): Promise<boolean> {
    try {
      const m = (await invoke<boolean>("is_muted")) === true;
      console.info(`[loop] is_muted -> ${m}`);
      return m;
    } catch (e) {
      console.warn("[loop] is_muted failed", e);
      return false;
    }
  }

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
      const msg = tRaw(langRef.current, "conversation.apiKeyMissingShort");
      try {
        if (await isSystemMuted()) await showOnHud(msg);
        else
          await withMutedCapture(() =>
            speak(msg, resolveLanguage(langRef.current)),
          );
      } catch {}
      scheduleErrorRecovery("no api key");
      return;
    }

    historyRef.current = addUser(historyRef.current, userText);

    // Pre-turn mute check — used to pick the right number-formatting hint
    // in the prompt (TTS-friendly "17点3度" vs display-friendly "17.3度").
    // The mid-turn mute case (user says "ミュート" right now) won't be caught
    // here, but those replies are short ("ミュートしました") and rarely
    // contain numbers, so the cosmetic miss is acceptable.
    const mutedAtTurnStart = await isSystemMuted();
    const requestMessages = messagesForRequest(historyRef.current);
    if (mutedAtTurnStart) {
      requestMessages.splice(1, 0, {
        role: "system",
        content: tRaw(langRef.current, "systemPrompt.formatHud"),
      });
    }
    // Per-character 口調 override for VOICEVOX wake-words. Inserted
    // immediately BEFORE the current user message (not at the top, after
    // base persona) so it sits as the most recent context. Putting it at
    // index 1 instead lets prior-turn assistant messages (still in the
    // sliding window with the previous character's 口調) drown it out —
    // we measured the model continuing the previous character's voice
    // with only the new character's 二人称 mixed in. Right before the
    // user message, it dominates.
    const vvSpeakerId = voicevoxSpeakerIdRef.current;
    let perTurnOverride: string | null = null;
    // Common rules for every per-turn persona injection (both character
    // and chappie reset). Prevents two failure modes we observed:
    //  - meta acknowledgments like 「もう一回聞いてくれたんだ」 when the user
    //    repeats a question — the model picks up the repetition from
    //    history and comments on it.
    //  - overly long replies (especially Anthropic) that bury the answer
    //    in flavor text.
    const turnRules =
      "【共通ルール】\n" +
      "・直前のターンや繰り返し質問への meta コメント（「また」「もう一回」「さっきも」等）はしない。新しい質問として答える。\n" +
      "・返答は短く、原則 1〜2 文。占い・ニュース要約など内容上必要な場合のみ伸ばしてよい。\n" +
      "・前置き（「うーんとね」「ちょっと待ってよ」等のフィラー）は不要。本題から入る。";
    if (vvSpeakerId !== undefined) {
      const speaker = VOICEVOX_CURATED_SPEAKERS.find(
        (s) => s.id === vvSpeakerId,
      );
      if (speaker) {
        // Few-shot example utterances grounded in the character's official
        // /calls/ page voice. Concrete instances keep weaker models
        // (Gemini Flash / Anthropic Haiku) in character on long answers
        // where a one-line description alone tends to drift back to neutral.
        const samplesBlock = speaker.samples?.length
          ? `\n\n【話し方の例（このキャラのトーン・語尾・一人称が自然に出るよう参考にしてください）】\n${speaker.samples.map((s) => `・「${s}」`).join("\n")}`
          : "";
        perTurnOverride = `${speaker.persona}${samplesBlock}\n\n${turnRules}\n\n（重要：前のターンが別キャラの口調だったとしても、このターンは上記の設定で答えてください。）`;
      }
    } else {
      // Chappie wake: history may still contain assistant messages from a
      // prior VOICEVOX-character turn (e.g. ずんだもん's 「〜なのだ」). Without
      // a reset, the model bleeds that 口調 into the next chappie reply.
      // Reinforce the base persona right before the user message so it
      // outweighs the recent character-style assistant turns.
      perTurnOverride =
        "このターンは「チャッピー」本来の口調で答えてください。直前のターンが別キャラ（ずんだもんやめたん等）の口調だったとしても、その口調・一人称・語尾を引き継がないでください。冒頭のチャッピーのペルソナに従って、フラットで親しみやすい話し方に戻してください。\n\n" +
        turnRules;
    }
    if (perTurnOverride) {
      requestMessages.splice(requestMessages.length - 1, 0, {
        role: "system",
        content: perTurnOverride,
      });
    }

    // Output routing (TTS vs HUD) is decided when the first text chunk
    // arrives, not at turn start — the model may mute the system mid-turn
    // via a tool call (e.g. set_mute), and we want that turn's reply to
    // already render as text since the user can't hear TTS anymore.
    type Speaker = {
      feed: (chunk: string) => void;
      flush: () => Promise<void>;
    };

    let reply: string;
    let endConversation = false;
    let firstChunkSeen = false;
    // null = routing not yet decided (still awaiting is_muted check at first
    // chunk). false = TTS, true = HUD. While null we buffer chunks so the
    // first ~50ms of streaming isn't dropped.
    let routeToHud: boolean | null = null;
    let speaker: Speaker | null = null;
    const pendingChunks: string[] = [];
    // Track total characters fed into the streaming pipeline (pending +
    // direct). After complete() resolves we compare this to the
    // authoritative reply length to detect chunks that landed via
    // Tauri Channel AFTER the invoke response — in that case we feed the
    // missing tail before flush so it isn't dropped.
    let fedText = "";

    const ensureSpeaker = () => {
      if (speaker) return;
      ttsActiveRef.current = true;
      void invoke("pause_listening").catch(() => {});
      dispatch({ type: "responseReady", reply: "" });
      speaker = createStreamingSpeaker(resolveLanguage(langRef.current));
    };

    const flushPendingToSpeaker = () => {
      if (!speaker) return;
      for (const chunk of pendingChunks.splice(0)) speaker.feed(chunk);
    };

    try {
      const result = await chatClientRef.current.complete(
        requestMessages,
        (chunk) => {
          fedText += chunk;
          if (!firstChunkSeen) {
            firstChunkSeen = true;
            // Decide routing once. Mid-turn toggling would strand us with
            // a half-spoken / half-written reply.
            void isSystemMuted().then((muted) => {
              routeToHud = muted;
              if (!muted) {
                ensureSpeaker();
                flushPendingToSpeaker();
              } else {
                dispatch({ type: "responseReady", reply: "" });
                pendingChunks.length = 0;
              }
            });
          }
          if (routeToHud === null) {
            pendingChunks.push(chunk);
          } else if (routeToHud === false) {
            speaker?.feed(chunk);
          }
        },
      );
      reply = result.text;
      endConversation = result.endConversation;
      // Recover from a Channel-vs-invoke-response race: if the trailing
      // chunks arrived AFTER complete() resolved (so they hit the queue
      // post-flush), feed the missing tail now so it's part of this turn's
      // audio. The authoritative reply is in result.text.
      if (speaker && fedText !== reply) {
        if (reply.startsWith(fedText)) {
          const missing = reply.slice(fedText.length);
          if (missing) {
            console.info(
              `[loop] late-chunk recovery: feeding ${missing.length} missed chars`,
            );
            (speaker as Speaker).feed(missing);
            fedText = reply;
          }
        } else {
          // Diverged (rare; would mean reply was edited after the fact —
          // e.g. tool-call rounds rewrote things). Log so we notice.
          console.warn(
            `[loop] reply mismatch: fed=${fedText.length}chars, reply=${reply.length}chars — not safe to recover`,
          );
        }
      }
    } catch (e) {
      console.error("openai failed", e);
      // Tear down a partial speaker if we got chunks before the error.
      if (speaker) {
        try {
          await (speaker as Speaker).flush();
        } catch {}
      }
      const errMsg = tRaw(langRef.current, "conversation.fallbackError");
      const errMuted = await isSystemMuted();
      try {
        if (errMuted) await showOnHud(errMsg);
        else
          await withMutedCapture(() =>
            speak(errMsg, resolveLanguage(langRef.current)),
          );
      } catch {}
      scheduleErrorRecovery(String(e));
      return;
    }

    historyRef.current = addAssistant(historyRef.current, reply);

    // If the routing decision never resolved (no chunks → no first-chunk
    // callback fired), check now so the non-streaming fallback also
    // respects mute state.
    if (routeToHud === null) routeToHud = await isSystemMuted();

    if (routeToHud) {
      // Muted: surface the whole reply as text, no audio.
      try {
        await showOnHud(reply);
      } catch (e) {
        console.error("hud show failed", e);
      }
    } else if (!firstChunkSeen) {
      // Non-streaming fallback: model returned everything before any chunks
      // landed (rare; possible if the round triggered tools and the final
      // answer was short). Speak the whole thing at once.
      try {
        await withMutedCapture(() =>
          speak(reply, resolveLanguage(langRef.current)),
        );
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

  // Wake-word determines voice per turn. No Settings persistence:
  //   chappie / チャッピー   → Web Speech (Chappie's own voice)
  //   ずんだもん / めたん etc → VOICEVOX with that speaker
  // The next wake overwrites whatever the previous turn set.
  function applyVoiceForWake(speakerId: number | undefined): void {
    voicevoxSpeakerIdRef.current = speakerId;
    if (speakerId === undefined) {
      console.info("[loop] applyVoiceForWake -> WebSpeech (chappie)");
      setEngineOpts({ voicevox: { enabled: false, speakerId: 0 } });
    } else {
      const speaker = VOICEVOX_CURATED_SPEAKERS.find((s) => s.id === speakerId);
      console.info(
        `[loop] applyVoiceForWake -> VOICEVOX speaker=${speakerId} styles=${speaker?.styles ? Object.keys(speaker.styles).join(",") : "?"}`,
      );
      setEngineOpts({
        voicevox: {
          enabled: true,
          speakerId,
          styles: speaker?.styles,
        },
      });
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
      // Continuation window: a character-name prefix in the body still
      // switches the voice for this turn. A plain body (no wake-word)
      // keeps whichever voice the previous wake set — the conversation
      // continues with the same speaker.
      const cw = detectWake(body);
      let promptText = body;
      if (cw.matched) {
        applyVoiceForWake(cw.speakerId);
        if (cw.body) promptText = cw.body;
      }
      dispatch({ type: "speechCaptured", text: promptText });
      await runTurn(promptText);
      return;
    }

    const m = detectWake(text);
    console.info(
      `[loop] wake match: matched=${m.matched} body="${m.matched ? m.body : ""}"${m.matched && m.speakerId !== undefined ? ` speakerId=${m.speakerId}` : ""}`,
    );
    if (!m.matched) return;

    // Each wake-word picks the voice for this turn. Plain chappie wake
    // routes to Web Speech, a character-name wake routes to that
    // character's VOICEVOX voice. No persistence; the next wake decides
    // again.
    applyVoiceForWake(m.speakerId);

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
      void (async () => {
        const ack = pickWakeAck(langRef.current);
        if (await isSystemMuted()) {
          await invoke("hud_show", {
            text: `👂 ${ack}`,
            durationMs: 2200,
          }).catch(() => {});
        } else {
          await withMutedCapture(() =>
            speak(ack, resolveLanguage(langRef.current)),
          ).catch(() => {});
        }
      })();
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
        langRef.current = s.language;
        historyRef.current = createHistory(buildSystemPrompt(s.language));
        const resolvedLang = resolveLanguage(s.language);
        void invoke("set_whisper_language", { lang: resolvedLang }).catch(
          () => {},
        );
        void invoke("set_app_language", { lang: resolvedLang }).catch(() => {});
        chatClientRef.current = s.openaiApiKey
          ? createChatClient(s.openaiApiKey, DEFAULT_MODEL)
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
            setError(
              tRaw(langRef.current, "conversation.modelProgress", { pct }),
            );
          },
        );
        try {
          // Always request — the system prompt only fires through this path
          // for ad-hoc signed LSUIElement apps (cached status can be wrong).
          const granted = await invoke<boolean>(
            "request_microphone_access",
          ).catch(() => false);
          if (!granted) {
            setError(tRaw(langRef.current, "conversation.micDenied"));
            void invoke("set_tray_state", { state: "error" }).catch(() => {});
            return;
          }
          // Fire-and-forget: prompt for Screen Recording too so the
          // `take_screenshot` tool works on first invocation. macOS only
          // shows the dialog the first time per binary; we don't gate
          // startup on the result because the rest of Chappie works
          // fine without it.
          void invoke("request_screen_recording_access").catch(() => {});
          await invoke<string>("ensure_model");
        } catch (e) {
          setError(
            tRaw(langRef.current, "conversation.modelFetchFailed", {
              err: String(e),
            }),
          );
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
          setError(
            tRaw(langRef.current, "conversation.micStartFailed", {
              err: String(e),
            }),
          );
          void invoke("set_tray_state", { state: "error" }).catch(() => {});
          return;
        }

        if (cancelled) return;

        // Once init finishes, surface a missing API key explicitly: a red
        // tray + warning banner is far more discoverable than letting the
        // user wake Chappie and then hear an audio error.
        if (!apiKeyRef.current) {
          setError(tRaw(langRef.current, "conversation.apiKeyMissingLong"));
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
        const langChanged = langRef.current !== s.language;
        apiKeyRef.current = s.openaiApiKey;
        langRef.current = s.language;
        if (langChanged) {
          historyRef.current = {
            ...historyRef.current,
            systemPrompt: buildSystemPrompt(s.language),
          };
          const resolvedLang = resolveLanguage(s.language);
          void invoke("set_whisper_language", { lang: resolvedLang }).catch(
            () => {},
          );
          void invoke("set_app_language", { lang: resolvedLang }).catch(
            () => {},
          );
        }
        chatClientRef.current = s.openaiApiKey
          ? createChatClient(s.openaiApiKey, DEFAULT_MODEL)
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
            ? tRaw(langRef.current, "conversation.timerFiredWithLabel", {
                label,
              })
            : tRaw(langRef.current, "conversation.timerFiredNoLabel");
          console.info(`[timer] fired: id=${e.payload.id} label="${label}"`);
          // When muted, the spoken alarm would be silent — surface it on
          // the HUD instead so the user actually notices the timer fired.
          const muted = await invoke<boolean>("is_muted").catch(() => false);
          if (muted) {
            const hudText = label
              ? tRaw(langRef.current, "conversation.timerHudWithLabel", {
                  label,
                })
              : tRaw(langRef.current, "conversation.timerHudNoLabel");
            await invoke("hud_show", {
              text: hudText,
              durationMs: 8000,
            }).catch(() => {});
            return;
          }
          ttsActiveRef.current = true;
          await invoke("pause_listening").catch(() => {});
          try {
            await speakQueued(message, resolveLanguage(langRef.current));
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

  // reminder:fired (absolute-time reminders, persisted across restart).
  // Phrased as "○○の時間です" instead of timer's "○○のタイマーです".
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const off = await listen<{ id: number; label: string }>(
        "reminder:fired",
        async (e) => {
          const { label } = e.payload;
          const message = label
            ? tRaw(langRef.current, "conversation.reminderFiredWithLabel", {
                label,
              })
            : tRaw(langRef.current, "conversation.reminderFiredNoLabel");
          console.info(`[reminder] fired: id=${e.payload.id} label="${label}"`);
          const muted = await invoke<boolean>("is_muted").catch(() => false);
          if (muted) {
            const hudText = label
              ? tRaw(langRef.current, "conversation.reminderHudWithLabel", {
                  label,
                })
              : tRaw(langRef.current, "conversation.reminderHudNoLabel");
            await invoke("hud_show", {
              text: hudText,
              durationMs: 8000,
            }).catch(() => {});
            return;
          }
          ttsActiveRef.current = true;
          await invoke("pause_listening").catch(() => {});
          try {
            await speakQueued(message, resolveLanguage(langRef.current));
          } catch (err) {
            console.error("[reminder] tts failed", err);
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
