import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import {
  buildSystemPrompt,
  pickWakeAck,
  resolveLanguage,
  t as tRaw,
} from "../i18n/messages";
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
  isBargeInCommand,
  isExternalAudioCancelCommand,
  isHallucination,
} from "../lib/speech-filters";
import {
  cancelSpeech,
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
const FOLLOWUP_TIMEOUT_MS = 6000;
// After Chappie finishes speaking, accept follow-up without requiring a fresh
// "チャッピー" wake-word for this window. Lets a multi-turn conversation flow.
const CONTINUE_WINDOW_MS = 6000;
// Ceiling for a single in-flight utterance once VAD reports speech-active.
// Replaces the previous "clear timer on speech-active" approach: that left
// the renderer stranded in `listening` whenever Rust dropped the segment
// silently (too-short / low-rms / speaker-gate reject / empty Whisper) —
// the `speech` event never arrived to re-arm. Re-arming with this longer
// budget covers long utterances while still recovering to idle when no
// segment ever materialises.
const MAX_SPEECH_HOLD_MS = 15000;
// Time the tray "error" state stays visible before auto-recovering.
const ERROR_DISPLAY_MS = 1800;
// Cooldown after TTS finishes before the mic capture is re-enabled. Leaves
// room for speaker reverb and ensures Chappie doesn't re-trigger on its tail.
const POST_TTS_COOLDOWN_MS = 350;

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
  // True while the renderer is in voice-barge-in mode — TTS is playing,
  // mic stays hot via `enter_barge_in_mode` (audio.rs raises VAD/RMS
  // thresholds), and incoming speech events are filtered through
  // `isBargeInCommand`. Mutually exclusive with the wake-ack /
  // timer-announcement paths, which still use full pause_listening.
  const bargeInActiveRef = useRef(false);
  // True while any external audio source (YouTube miniplayer today,
  // Spotify / Apple Music in the future) is actively producing sound
  // that can leak into the mic. While set, handleSpeech drops everything
  // except `isExternalAudioCancelCommand` matches, which close / pause
  // the source and clear the flag. Backed by per-source listeners
  // (currently just `miniplayer:visible`); add another listener +
  // OR-merge here when wiring music control_music play/pause.
  const externalAudioActiveRef = useRef(false);
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

  // (Re-)arm the followup / continuation timer. After `ms` of inactivity
  // (no speech-active event, no segment), drop back to idle. Called both
  // when first entering "awaiting body" state and to extend the deadline
  // when VAD reports voice activity / when a segment gets filtered out.
  function armFollowupTimer(ms: number) {
    clearFollowupTimer();
    followupTimerRef.current = window.setTimeout(() => {
      awaitingBodyRef.current = false;
      followupTimerRef.current = null;
      dispatch({ type: "speechTimeout" });
    }, ms);
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
        // Identity-question rule: without this, "自己紹介して" / "誰？" /
        // "何歳？" gets answered as "I'm Chappie, the hands-free
        // assistant, with X character's voice" instead of as the
        // character themselves. The base persona keeps insisting the
        // assistant is Chappie, so we have to be explicit that for
        // identity-shaped questions, the character speaks as themselves.
        const identityRule =
          "【素性に関する質問の扱い】\n" +
          "「自己紹介して」「あなた誰？」「名前は？」「何歳？」など本人の属性を聞かれた場合は、**Chappie ではなく上記キャラ本人として** 答える（名前・年齢・性格・特徴を上記設定から拾う）。例：めたん→「わたくしは四国めたん、17歳の高校2年生よ」、ずんだもん→「僕、ずんだもんなのだ。ずんだ餅の精なのだ」。\n" +
          "Chappie 本体の機能紹介は「何ができるの？」「使い方教えて」と聞かれたときだけで、その場合もキャラの口調のまま喋る。";
        perTurnOverride = `${speaker.persona}${samplesBlock}\n\n${identityRule}\n\n${turnRules}\n\n（重要：前のターンが別キャラの口調だったとしても、このターンは上記の設定で答えてください。）`;
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
      // Voice barge-in: keep the mic active during this turn's TTS so
      // the user can interrupt by saying "ストップ / やめて / stop".
      // audio.rs raises VAD + RMS thresholds in this mode to reject
      // speaker reverb; the renderer further filters events through
      // `isBargeInCommand` in handleSpeech.
      bargeInActiveRef.current = true;
      void invoke("enter_barge_in_mode").catch(() => {});
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
      // Cooldown + exit barge-in mode — restores normal VAD/RMS bars
      // and lets full-length wake utterances through again.
      await new Promise((r) => setTimeout(r, POST_TTS_COOLDOWN_MS));
      bargeInActiveRef.current = false;
      await invoke("exit_barge_in_mode").catch(() => {});
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
      // Reset tray icon set to Chappie. Wake-driven, fire-and-forget.
      void invoke("set_tray_character", { character: "chappie" }).catch(
        () => {},
      );
    } else {
      const speaker = VOICEVOX_CURATED_SPEAKERS.find((s) => s.id === speakerId);
      console.info(
        `[loop] applyVoiceForWake -> VOICEVOX speaker=${speakerId} styles=${speaker?.styles ? Object.keys(speaker.styles).join(",") : "?"} tray=${speaker?.trayCharacter ?? "chappie"}`,
      );
      setEngineOpts({
        voicevox: {
          enabled: true,
          speakerId,
          styles: speaker?.styles,
        },
      });
      // Swap tray icons to the character's set if we ship them; otherwise
      // fall back to Chappie. The Rust side ignores unknown values via
      // serde so even a future typo here just keeps the default icons.
      const trayChar = speaker?.trayCharacter ?? "chappie";
      void invoke("set_tray_character", { character: trayChar }).catch(
        () => {},
      );
    }
  }

  function startContinuationWindow() {
    dispatch({ type: "wakeDetected" });
    awaitingBodyRef.current = true;
    armFollowupTimer(CONTINUE_WINDOW_MS);
  }

  async function handleSpeech(text: string) {
    console.info(
      `[loop] speech recv: "${text}" tts=${ttsActiveRef.current} state=${machineRef.current.state} awaiting=${awaitingBodyRef.current} ext=${externalAudioActiveRef.current}`,
    );
    // External audio (miniplayer today; music later) is producing sound
    // that's leaking into the mic. Honor only cancel/close commands;
    // drop everything else before it reaches wake-word detection or the
    // LLM. The flag is cleared by per-source events (miniplayer:visible
    // false on hide / close).
    if (externalAudioActiveRef.current) {
      if (isExternalAudioCancelCommand(text)) {
        console.info(`[loop] external-audio CANCEL matched: "${text}"`);
        // For now there's only one source. When more land, dispatch to
        // each active one here (close miniplayer if up, pause music if
        // playing, etc.).
        void invoke("close_youtube").catch(() => {});
      } else {
        console.info(
          `[loop] dropped: external audio active (text="${text.slice(0, 30)}")`,
        );
      }
      return;
    }
    if (ttsActiveRef.current) {
      // Voice barge-in: while runTurn's streaming TTS is playing the mic
      // stays hot, but only short whitelisted commands are honored as
      // "stop talking". Anything else is almost certainly Chappie's own
      // speaker reverb leaking through Whisper, so drop it silently.
      if (bargeInActiveRef.current && isBargeInCommand(text)) {
        console.info(`[loop] BARGE-IN matched: "${text}" — cancelling TTS`);
        cancelSpeech();
        bargeInActiveRef.current = false;
        ttsActiveRef.current = false;
        void invoke("exit_barge_in_mode").catch(() => {});
        // Drop into idle and arm a continuation window so the user can
        // re-issue without saying the wake-word again. The runTurn flow
        // will see the cancelled engine when it reaches `flush()` and
        // return promptly without producing any more audio.
        dispatch({ type: "speechDone" });
        startContinuationWindow();
        return;
      }
      console.info(`[loop] dropped: tts active (text="${text.slice(0, 30)}")`);
      return;
    }
    const cur = machineRef.current.state;
    if (cur === "thinking" || cur === "speaking" || cur === "error") {
      console.info(`[loop] dropped: state=${cur}`);
      return;
    }

    if (isHallucination(text)) {
      console.info(`[loop] dropped: hallucination`);
      // The user just finished a short / filler segment ("んー", "ありがとう"
      // alone, etc.) while we were waiting for the body of a continuation
      // turn. The speech-active listener already cleared the followup
      // timer when VAD picked the segment up; re-arm it now so we keep
      // waiting instead of silently ticking down toward idle.
      if (awaitingBodyRef.current) {
        armFollowupTimer(CONTINUE_WINDOW_MS);
      }
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
      armFollowupTimer(FOLLOWUP_TIMEOUT_MS);
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
          // Optional permissions (Screen Recording / Calendar / Location)
          // are NOT auto-prompted at startup anymore. Asking for everything
          // upfront produced a prompt cascade on every auto-update because
          // ad-hoc cdhash churn ghost-invalidates the existing grants. We
          // now ask in context: the tool handler triggers the request when
          // the user invokes a feature that needs it. Settings still has
          // proactive "Grant access" buttons for users who prefer to set
          // up everything in one go.
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
        // Segments captured while Chappie's own TTS was playing arrive on
        // a separate event so they CANNOT slip into the continuation
        // window body path — even when Whisper happens to finish
        // transcribing them after TTS ended and `ttsActiveRef` has
        // already flipped back to false. The only thing we honor here is
        // a barge-in command ("stop / やめて") matching the same
        // whitelist `handleSpeech` uses during active TTS. Everything
        // else is dropped silently — it's Chappie's voice echoing back.
        const offBargeIn = await listen<string>("speech-bargein", (e) => {
          const text = e.payload;
          if (bargeInActiveRef.current && isBargeInCommand(text)) {
            console.info(`[loop] BARGE-IN (echo-path) matched: "${text}"`);
            cancelSpeech();
            bargeInActiveRef.current = false;
            ttsActiveRef.current = false;
            void invoke("exit_barge_in_mode").catch(() => {});
            dispatch({ type: "speechDone" });
            startContinuationWindow();
          } else {
            console.info(
              `[loop] dropped: bargein-tagged (text="${text.slice(0, 30)}")`,
            );
          }
        });
        // VAD speech-start signal: pause the followup/continuation timer
        // while the user is actually talking. Without this, a >6s utterance
        // (or one preceded by a thinking pause) can outrun CONTINUE_WINDOW_MS
        // and drop state to idle before the segment is even transcribed.
        // The timer gets re-armed on hallucination drop or after the body
        // is consumed normally.
        const offActive = await listen("speech-active", () => {
          if (awaitingBodyRef.current) {
            // Don't clear — re-arm with a longer ceiling. Rust can drop the
            // segment silently (too-short / low-rms / speaker-gate reject /
            // Whisper empty) which means no `speech` event would ever arrive
            // to re-arm us back. The ceiling lets long utterances through
            // while still falling back to idle when the segment evaporates.
            armFollowupTimer(MAX_SPEECH_HOLD_MS);
          }
        });
        // Miniplayer visibility: while the YouTube player window is up,
        // handleSpeech drops everything except cancel commands so the
        // player's own audio leaking into the mic doesn't loop back into
        // the LLM. Rust emits true on show, false on hide (including
        // when the user closes the window via the OS X button).
        const offMiniplayer = await listen<boolean>(
          "miniplayer:visible",
          (e) => {
            externalAudioActiveRef.current = !!e.payload;
            console.info(
              `[loop] external-audio (miniplayer):active=${externalAudioActiveRef.current}`,
            );
          },
        );
        if (cancelled) {
          off();
          offBargeIn();
          offActive();
          offMiniplayer();
          return;
        }
        speechOff = () => {
          off();
          offBargeIn();
          offActive();
          offMiniplayer();
        };

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
