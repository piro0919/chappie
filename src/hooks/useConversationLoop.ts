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
import { buildPerTurnPrompt } from "../lib/per-turn-prompt";
import { type Language, loadSettings, type Settings } from "../lib/settings";
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
import { isSystemMuted, showOnHud } from "../lib/tauri-bridge";
import { resolveVoiceForWake } from "../lib/voice-selection";
import {
  isPaidSpeaker,
  VOICEVOX_CURATED_SPEAKERS,
} from "../lib/voicevox-speakers";
import { detectWake } from "../lib/wake-word";
import { useTauriListener } from "./useTauriListener";

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

// Rewrite a template-based proactive line into the active VOICEVOX
// character's 口調. No-op when chappie's default voice is active, or
// when the user is on Free (the 5/day quota shouldn't be burned on
// proactive flavoring), or when the LLM call fails. Returns the
// original text in every fallback case so the caller can speak
// something regardless.
async function rewriteInPersona(
  speakText: string,
  lang: Language,
  speakerId: number | undefined,
  mode: string,
  chatClient: ChatClient | null,
): Promise<string> {
  if (speakerId === undefined || mode === "free" || !chatClient) {
    return speakText;
  }
  const persona = VOICEVOX_CURATED_SPEAKERS.find(
    (s) => s.id === speakerId,
  )?.persona;
  if (!persona) return speakText;
  const resolved = resolveLanguage(lang);
  const system = `You are Chappie, currently voiced as a VOICEVOX character. Rewrite the user-provided sentence in the character's 口調 (speech style) described below. Keep the meaning and information identical — do not add or drop facts. Output ONE sentence only in ${resolved}, no markdown, no quotes, no preamble. Output just the rewritten sentence.\n\n--- character ---\n${persona}`;
  try {
    const result = await chatClient.complete(
      [
        { role: "system", content: system },
        { role: "user", content: speakText },
      ],
      undefined,
      // No tools: this is a pure rephrase. Without this the model treats
      // the flavoring text (e.g. a calendar warning "15分後に〇〇です") as a
      // request and fires side-effecting tools like set_timer.
      { noTools: true },
    );
    const trimmed = result.text.trim().replace(/^[「『"']+|[」』"']+$/g, "");
    return trimmed || speakText;
  } catch (err) {
    console.warn("[proactive] persona rewrite failed, using template", err);
    return speakText;
  }
}

// One-shot system prompt for LLM-generated idle chatter. Kept separate
// from the conversation persona because we don't want tool calls,
// don't want history awareness, and want a single-sentence shape.
// Language is named explicitly so the model doesn't drift to English
// when the user is on JP/etc. The wording stays English regardless of
// `lang` — it's an instruction to the model, not user-facing text.
function buildIdleChatterPrompt(lang: Language): string {
  const resolved = resolveLanguage(lang);
  return `You are Chappie, a hands-free voice assistant. The user has been silent and idle for a while. Break the silence with ONE short casual remark in ${resolved} — an observation, a light greeting, or a gentle nudge. Do NOT ask big questions. Do NOT use markdown, code blocks, lists, or emoji. Just one natural spoken sentence as if you turned your head and said something off the cuff. Keep it under 25 words. Do not repeat a previous remark.`;
}

// Mirror the renderer's proactive settings into the Rust scheduler.
// Called once on startup and again whenever `settings:updated` fires so
// toggle changes apply on the very next tick without a restart.
async function pushProactiveConfig(s: Settings): Promise<void> {
  await invoke("set_proactive_config", {
    config: {
      morningBriefEnabled: s.proactiveMorningBriefEnabled,
      morningBriefTime: s.proactiveMorningBriefTime,
      calendarEnabled: s.proactiveCalendarEnabled,
      calendarLeadMin: s.proactiveCalendarLeadMin,
      weatherEnabled: s.proactiveWeatherEnabled,
      idleChatterEnabled: s.proactiveIdleChatterEnabled,
      idleChatterAfterMin: s.proactiveIdleChatterAfterMin,
      quietHoursStart: s.proactiveQuietHoursStart,
      quietHoursEnd: s.proactiveQuietHoursEnd,
    },
  }).catch((err) => {
    console.warn("[proactive] set_proactive_config failed", err);
  });
}

// Discriminated payload for `proactive:fired` (emitted by Rust
// `proactive::tick`). Matches the `#[serde(tag = "kind")]` enum on the
// Rust side; renderer composes the user-facing text from i18n.
type ProactiveFiredPayload =
  | {
      kind: "morningBrief";
      weather: string;
      temp: number;
      eventCount: number;
      firstTime: string | null;
      firstTitle: string | null;
    }
  | { kind: "calendarWarning"; leadMin: number; title: string }
  | { kind: "weatherAlert"; detail: string }
  | { kind: "idleChatter"; phraseIndex: number; context: string };

export function useConversationLoop(): { state: State; error: string | null } {
  const [state, setState] = useState<State>({ state: "initializing" });
  const [error, setError] = useState<string | null>(null);

  const machineRef = useRef<Machine>(createMachine());

  // Sub-flag helpers. These read the machine state instead of standalone
  // refs so the discriminated-union remains the source of truth.
  function isAwaitingContinuation(): boolean {
    const s = machineRef.current.state;
    return s.state === "listening" && s.awaitingContinuation;
  }
  function isBargeInActive(): boolean {
    const s = machineRef.current.state;
    return s.state === "speaking" && s.bargeIn;
  }
  const historyRef = useRef<History>(createHistory(buildSystemPrompt("auto")));
  const apiKeyRef = useRef<string>("");
  const subscriptionTokenRef = useRef<string>("");
  // Paid premium features (VOICEVOX premium speakers) gate on
  // `subscriptionStatus` rather than `mode`, so a paying user who has
  // chosen BYOK for LLM routing still gets the premium voices they
  // paid for. `mode` controls only the chat-path (free quota / proxy
  // bypass / direct provider call); entitlement to premium content is
  // an orthogonal concern decided by Stripe.
  const modeRef = useRef<"free" | "paid" | "byok">("free");
  const subscriptionEntitledRef = useRef<boolean>(false);
  const chatClientRef = useRef<ChatClient | null>(null);
  const langRef = useRef<Language>("auto");
  const proactiveOutputChannelRef =
    useRef<Settings["proactiveOutputChannel"]>("auto");
  const followupTimerRef = useRef<number | null>(null);
  const ttsActiveRef = useRef(false);
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
    const prevIdle = machineRef.current.state.state === "idle";
    machineRef.current = next;
    setState(next.state);
    // Tray's enum names match the top-level discriminator, so the
    // sub-flags (bargeIn / awaitingContinuation) stay JS-side.
    void invoke("set_tray_state", { state: next.state.state }).catch(() => {});
    // Push idle/busy state to the Rust proactive scheduler whenever
    // the boolean flips, so the v2 idle-chatter feature (and any
    // future "is it OK to interrupt?" check) sees an accurate signal
    // without polling.
    const nextIdle = next.state.state === "idle";
    if (nextIdle !== prevIdle) {
      void invoke("notify_idle_state", { idle: nextIdle }).catch(() => {});
    }
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
      followupTimerRef.current = null;
      // speechTimeout transitions listening → idle, which naturally
      // clears awaitingContinuation as part of the state change.
      dispatch({ type: "speechTimeout" });
    }, ms);
  }

  async function runTurn(userText: string) {
    console.info(`[loop] runTurn: "${userText}"`);
    // BYOK requires a key; Free mode runs without one (device id is loaded
    // server-side from ~/.chappie/device-id).
    const byokMissingKey = modeRef.current === "byok" && !apiKeyRef.current;
    if (byokMissingKey || !chatClientRef.current) {
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
    const perTurnOverride = buildPerTurnPrompt(voicevoxSpeakerIdRef.current);
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
      void invoke("enter_barge_in_mode").catch(() => {});
      // responseReady takes us thinking → speaking{bargeIn:false}; the
      // immediate bargeInStarted flips the sub-flag to true so handleSpeech
      // honours stop-commands during streaming TTS.
      dispatch({ type: "responseReady", reply: "" });
      dispatch({ type: "bargeInStarted" });
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
      // Distinct messaging for proxy quota exhaustion (Free mode): the
      // dispatch loop bubbles the upstream 429 body up as "proxy 429: …".
      //
      // Gate this on Free mode. The proxy only emits the device daily-quota
      // 429 on the unpaid path; for a Paid user `paid=true` skips quota
      // entirely, so any "quota"/"429" text reaching a paid/byok session is
      // an *upstream* transient (e.g. Gemini rate limit surfaced as a 502
      // whose detail contains "quota") — showing "free quota exhausted"
      // there is just wrong and alarming. Treat it as a generic error.
      const raw = String(e);
      const isQuota =
        modeRef.current === "free" &&
        (/\b429\b/.test(raw) || /quota/i.test(raw));
      const errMsg = isQuota
        ? tRaw(langRef.current, "conversation.quotaExceededShort")
        : tRaw(langRef.current, "conversation.fallbackError");
      const hudMsg = isQuota
        ? tRaw(langRef.current, "conversation.quotaExceededHud")
        : errMsg;
      const errMuted = await isSystemMuted();
      try {
        if (errMuted) await showOnHud(hudMsg);
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
      // and lets full-length wake utterances through again. The
      // bargeIn sub-flag is cleared by the speechDone transition below.
      await new Promise((r) => setTimeout(r, POST_TTS_COOLDOWN_MS));
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
  // Returns true if the wake should be ignored entirely (paid speaker
  // invoked without entitlement). Caller surfaces the HUD nudge and
  // skips the turn so chappie doesn't answer in the character's place.
  function isWakeBlocked(speakerId: number | undefined): boolean {
    if (
      speakerId !== undefined &&
      isPaidSpeaker(speakerId) &&
      !subscriptionEntitledRef.current
    ) {
      console.info(`[loop] wake blocked: paid speaker=${speakerId}`);
      void showOnHud(
        tRaw(langRef.current, "settings.voicevoxPaidLockHud"),
      ).catch(() => {});
      return true;
    }
    return false;
  }

  function applyVoiceForWake(speakerId: number | undefined): void {
    voicevoxSpeakerIdRef.current = speakerId;
    const { engineOpts, trayCharacter } = resolveVoiceForWake(speakerId);
    console.info(
      `[loop] applyVoiceForWake speaker=${speakerId ?? "chappie"} tray=${trayCharacter}`,
    );
    setEngineOpts(engineOpts);
    // Swap tray icons to the character's set if we ship them; otherwise
    // fall back to Chappie. Wake-driven, fire-and-forget. The Rust side
    // ignores unknown values via serde so even a future typo here just
    // keeps the default icons.
    void invoke("set_tray_character", { character: trayCharacter }).catch(
      () => {},
    );
  }

  function startContinuationWindow() {
    // continuationOpened goes idle → listening{awaitingContinuation:true}
    // — the machine now carries the "we're waiting for follow-up without
    // a fresh wake word" state directly.
    dispatch({ type: "continuationOpened" });
    armFollowupTimer(CONTINUE_WINDOW_MS);
  }

  async function handleSpeech(text: string) {
    console.info(
      `[loop] speech recv: "${text}" tts=${ttsActiveRef.current} state=${machineRef.current.state.state} awaiting=${isAwaitingContinuation()} ext=${externalAudioActiveRef.current}`,
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
      if (isBargeInActive() && isBargeInCommand(text)) {
        console.info(`[loop] BARGE-IN matched: "${text}" — cancelling TTS`);
        cancelSpeech();
        ttsActiveRef.current = false;
        void invoke("exit_barge_in_mode").catch(() => {});
        // Drop into idle and arm a continuation window so the user can
        // re-issue without saying the wake-word again. The runTurn flow
        // will see the cancelled engine when it reaches `flush()` and
        // return promptly without producing any more audio. speechDone
        // also clears the bargeIn sub-flag as part of the transition.
        dispatch({ type: "speechDone" });
        startContinuationWindow();
        return;
      }
      console.info(`[loop] dropped: tts active (text="${text.slice(0, 30)}")`);
      return;
    }
    const cur = machineRef.current.state.state;
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
      if (isAwaitingContinuation()) {
        armFollowupTimer(CONTINUE_WINDOW_MS);
      }
      return;
    }

    if (isAwaitingContinuation()) {
      console.info(`[loop] body received: "${text}"`);
      // speechCaptured below transitions listening → thinking which
      // naturally clears awaitingContinuation as the state changes.
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
        if (isWakeBlocked(cw.speakerId)) {
          dispatch({ type: "speechTimeout" });
          return;
        }
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

    // Paid speaker invoked without entitlement: HUD nudge, no response.
    if (isWakeBlocked(m.speakerId)) return;

    // Each wake-word picks the voice for this turn. Plain chappie wake
    // routes to Web Speech, a character-name wake routes to that
    // character's VOICEVOX voice. No persistence; the next wake decides
    // again.
    applyVoiceForWake(m.speakerId);

    if (m.body === "") {
      // Bare wake — we're waiting for the body. Use continuationOpened
      // so the machine carries the "awaiting body" sub-flag instead of
      // tracking it in a separate ref.
      dispatch({ type: "continuationOpened" });
      armFollowupTimer(FOLLOWUP_TIMEOUT_MS);
      // Quick "はい" acknowledgement so the user knows we're listening.
      // Fire-and-forget — we don't await it because the user may start
      // speaking immediately, and `withMutedCapture` would block the
      // pipeline for the cooldown duration.
      void (async () => {
        const ack = pickWakeAck(langRef.current, m.speakerId);
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
        subscriptionTokenRef.current = s.subscriptionAccessToken;
        modeRef.current = s.mode;
        subscriptionEntitledRef.current =
          s.subscriptionStatus === "active" ||
          s.subscriptionStatus === "trialing";
        langRef.current = s.language;
        proactiveOutputChannelRef.current = s.proactiveOutputChannel;
        historyRef.current = createHistory(buildSystemPrompt(s.language));
        const resolvedLang = resolveLanguage(s.language);
        void invoke("set_whisper_language", { lang: resolvedLang }).catch(
          () => {},
        );
        void invoke("set_app_language", { lang: resolvedLang }).catch(() => {});
        // Free / Paid both route through the proxy; the token getter
        // attaches the Bearer only when the user is on Paid (BYOK skips
        // the proxy entirely and uses the user's own provider key).
        chatClientRef.current =
          s.mode === "free" || s.mode === "paid"
            ? createChatClient(
                "",
                DEFAULT_MODEL,
                s.mode,
                undefined,
                () => subscriptionTokenRef.current,
              )
            : s.openaiApiKey
              ? createChatClient(s.openaiApiKey, DEFAULT_MODEL, "byok")
              : null;

        // Initial tray sync mirrors the machine's starting "initializing"
        // state (dispatch only fires on transitions, so the very first
        // tray push needs to be explicit).
        void invoke("set_tray_state", { state: "initializing" }).catch(
          () => {},
        );
        void pushProactiveConfig(s);
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
            dispatch({
              type: "initializationFailed",
              message: "mic denied",
            });
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
          dispatch({
            type: "initializationFailed",
            message: `model fetch failed: ${e}`,
          });
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
          if (isBargeInActive() && isBargeInCommand(text)) {
            console.info(`[loop] BARGE-IN (echo-path) matched: "${text}"`);
            cancelSpeech();
            ttsActiveRef.current = false;
            void invoke("exit_barge_in_mode").catch(() => {});
            // speechDone clears the bargeIn sub-flag via the state transition.
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
          if (isAwaitingContinuation()) {
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
        // Manual TTS interrupt from the tray menu. Same teardown as the
        // voice barge-in path so the user can stop Chappie when speaking
        // out loud isn't an option (meeting / quiet room / etc.).
        const offTrayStop = await listen("tray:stop_speaking", () => {
          if (!ttsActiveRef.current) {
            return;
          }
          console.info("[loop] BARGE-IN (tray menu) cancelling TTS");
          cancelSpeech();
          ttsActiveRef.current = false;
          void invoke("exit_barge_in_mode").catch(() => {});
          // speechDone clears the bargeIn sub-flag via the state transition.
          dispatch({ type: "speechDone" });
          startContinuationWindow();
        });
        if (cancelled) {
          off();
          offBargeIn();
          offActive();
          offMiniplayer();
          offTrayStop();
          return;
        }
        speechOff = () => {
          off();
          offBargeIn();
          offActive();
          offMiniplayer();
          offTrayStop();
        };

        try {
          await invoke("start_listening");
        } catch (e) {
          setError(
            tRaw(langRef.current, "conversation.micStartFailed", {
              err: String(e),
            }),
          );
          dispatch({
            type: "initializationFailed",
            message: `mic start failed: ${e}`,
          });
          return;
        }

        if (cancelled) return;

        // Once init finishes, surface a missing API key explicitly (BYOK
        // only): a red tray + warning banner is far more discoverable than
        // letting the user wake Chappie and then hear an audio error.
        // Free mode has no key requirement.
        if (modeRef.current === "byok" && !apiKeyRef.current) {
          setError(tRaw(langRef.current, "conversation.apiKeyMissingLong"));
          dispatch({
            type: "initializationFailed",
            message: "byok key missing",
          });
          return;
        }

        dispatch({ type: "initializationDone" });
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

  useTauriListener("settings:updated", async () => {
    const s = await loadSettings();
    const wasBlocked = modeRef.current === "byok" && !apiKeyRef.current;
    const langChanged = langRef.current !== s.language;
    const prevMode = modeRef.current;
    apiKeyRef.current = s.openaiApiKey;
    subscriptionTokenRef.current = s.subscriptionAccessToken;
    modeRef.current = s.mode;
    // Switching off Paid (→ Free or BYOK) snaps the tray icon + voice
    // back to chappie's default so the user sees a clean reset instead
    // of staying on the previous character until the next wake-word.
    if (prevMode !== s.mode && (s.mode === "free" || s.mode === "byok")) {
      applyVoiceForWake(undefined);
    }
    subscriptionEntitledRef.current =
      s.subscriptionStatus === "active" || s.subscriptionStatus === "trialing";
    langRef.current = s.language;
    proactiveOutputChannelRef.current = s.proactiveOutputChannel;
    if (langChanged) {
      historyRef.current = {
        ...historyRef.current,
        systemPrompt: buildSystemPrompt(s.language),
      };
      const resolvedLang = resolveLanguage(s.language);
      void invoke("set_whisper_language", { lang: resolvedLang }).catch(
        () => {},
      );
      void invoke("set_app_language", { lang: resolvedLang }).catch(() => {});
    }
    chatClientRef.current =
      s.mode === "free" || s.mode === "paid"
        ? createChatClient(
            "",
            DEFAULT_MODEL,
            s.mode,
            undefined,
            () => subscriptionTokenRef.current,
          )
        : s.openaiApiKey
          ? createChatClient(s.openaiApiKey, DEFAULT_MODEL, "byok")
          : null;
    // Recover from the "no API key" / startup-error state once the
    // user gives us a working configuration (added key, or switched
    // to Free / Paid mode).
    const nowOk =
      s.mode === "free" ||
      s.mode === "paid" ||
      (s.mode === "byok" && !!s.openaiApiKey);
    void pushProactiveConfig(s);
    if (wasBlocked && nowOk) {
      setError(null);
      // Machine is in `error` from the init-time initializationFailed
      // dispatch; errorAcknowledged drops us back to idle.
      dispatch({ type: "errorAcknowledged" });
    }
  });

  // Timer fired announcement. Uses `speakQueued` so we don't cancel an
  // ongoing TTS turn — the announcement appends after whatever is currently
  // being spoken. Mic capture is paused while we speak so the announcement
  // doesn't loop back into Whisper.
  useTauriListener<{ id: number; label: string }>("timer:fired", async (e) => {
    const { label } = e.payload;
    const message = label
      ? tRaw(langRef.current, "conversation.timerFiredWithLabel", { label })
      : tRaw(langRef.current, "conversation.timerFiredNoLabel");
    console.info(`[timer] fired: id=${e.payload.id} label="${label}"`);
    // When muted, the spoken alarm would be silent — surface it on
    // the HUD instead so the user actually notices the timer fired.
    const muted = await invoke<boolean>("is_muted").catch(() => false);
    if (muted) {
      const hudText = label
        ? tRaw(langRef.current, "conversation.timerHudWithLabel", { label })
        : tRaw(langRef.current, "conversation.timerHudNoLabel");
      await invoke("hud_show", { text: hudText, durationMs: 8000 }).catch(
        () => {},
      );
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
  });

  // reminder:fired (absolute-time reminders, persisted across restart).
  // Phrased as "○○の時間です" instead of timer's "○○のタイマーです".
  useTauriListener<{ id: number; label: string }>(
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
        await invoke("hud_show", { text: hudText, durationMs: 8000 }).catch(
          () => {},
        );
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

  // proactive:fired — Chappie speaks on its own initiative (morning
  // briefing or calendar pre-warning). Payload is tagged by `kind`;
  // the renderer composes the user-facing text from the i18n catalog
  // and routes to TTS or HUD via the same mute-aware path as the
  // other fire-and-forget announcements.
  useTauriListener<ProactiveFiredPayload>("proactive:fired", async (e) => {
    const p = e.payload;
    let speakText: string;
    let hudText: string;
    // Resolve the output surface up front so we can skip the
    // (sometimes LLM-backed) idle-chatter composition when it would
    // never actually be heard.
    const muted = await invoke<boolean>("is_muted").catch(() => false);
    const micGranted =
      (await invoke<string>("check_microphone_permission").catch(
        () => "denied",
      )) === "granted";
    const channel = proactiveOutputChannelRef.current;
    // HUD-only when the user picked "hud", the system is muted, or the
    // channel is "auto" and the mic permission is missing — a one-way
    // spoken nudge is odd when the user can't talk back.
    const useHud =
      channel === "hud" || muted || (channel === "auto" && !micGranted);
    // Idle chatter is conversational filler that only ever speaks. Drop
    // it before any compose work if it would land on the HUD, or if the
    // mic is missing (nothing for the user to reply with).
    if (p.kind === "idleChatter" && (useHud || !micGranted)) return;
    if (p.kind === "morningBrief") {
      const params: Record<string, string> = {
        weather: p.weather,
        temp: String(p.temp),
        count: String(p.eventCount),
      };
      if (p.firstTime && p.firstTitle) {
        params.firstTime = p.firstTime;
        params.firstTitle = p.firstTitle;
        speakText = tRaw(
          langRef.current,
          "conversation.proactiveMorningBriefWithEvents",
          params,
        );
      } else if (p.eventCount === 0) {
        speakText = tRaw(
          langRef.current,
          "conversation.proactiveMorningBriefNoEvents",
          params,
        );
      } else {
        speakText = tRaw(
          langRef.current,
          "conversation.proactiveMorningBriefWeatherOnly",
          params,
        );
      }
      hudText = tRaw(
        langRef.current,
        "conversation.proactiveMorningBriefHud",
        params,
      );
    } else if (p.kind === "calendarWarning") {
      const params = {
        leadMin: String(p.leadMin),
        title: p.title,
      };
      speakText = tRaw(
        langRef.current,
        "conversation.proactiveCalendarWarning",
        params,
      );
      hudText = tRaw(
        langRef.current,
        "conversation.proactiveCalendarHud",
        params,
      );
    } else if (p.kind === "weatherAlert") {
      const params = { detail: p.detail };
      speakText = tRaw(
        langRef.current,
        "conversation.proactiveWeatherAlert",
        params,
      );
      hudText = tRaw(
        langRef.current,
        "conversation.proactiveWeatherAlertHud",
        params,
      );
    } else {
      const slot = Math.min(Math.max(p.phraseIndex, 0), 4);
      // Static key list keeps t()'s string-literal union happy; the
      // Rust side bounds phrase_index to 0..IDLE_CHATTER_PHRASE_COUNT
      // which is wired to match this array length.
      const phraseKeys = [
        "conversation.proactiveIdleChatterPhrase1",
        "conversation.proactiveIdleChatterPhrase2",
        "conversation.proactiveIdleChatterPhrase3",
        "conversation.proactiveIdleChatterPhrase4",
        "conversation.proactiveIdleChatterPhrase5",
      ] as const;
      const fallback = tRaw(langRef.current, phraseKeys[slot]);
      // Free mode shares its 5/day quota with this — burning daily
      // calls on unsolicited chatter is anti-feature, so Free always
      // uses the static phrase. BYOK/Paid pay their own bill so
      // they can afford LLM-generated variety.
      let chatter = fallback;
      if (modeRef.current !== "free" && chatClientRef.current) {
        try {
          const basePrompt = buildIdleChatterPrompt(langRef.current);
          // If a VOICEVOX character is the current voice, prepend its
          // persona so the chatter matches the speaker's 口調 (e.g.
          // ずんだもん's "〜なのだ"). Default chappie voice = no
          // persona injection (chappie's neutral tone is the default).
          const speakerId = voicevoxSpeakerIdRef.current;
          const persona =
            speakerId !== undefined
              ? (VOICEVOX_CURATED_SPEAKERS.find((s) => s.id === speakerId)
                  ?.persona ?? "")
              : "";
          const systemContent = [
            basePrompt,
            persona ? `\n\n--- character ---\n${persona}` : "",
            p.context
              ? `\n\n--- context ---\n${p.context}\n--- end context ---\nUse the context naturally if relevant; do not list it back verbatim. Skip mentioning context that doesn't fit a casual remark.`
              : "",
          ].join("");
          const result = await chatClientRef.current.complete(
            [
              { role: "system", content: systemContent },
              { role: "user", content: "[idle]" },
            ],
            undefined,
            // Pure chatter generation — no tools, so an idle remark can't
            // spawn timers/reminders or other side effects.
            { noTools: true },
          );
          const trimmed = result.text.trim();
          if (trimmed) chatter = trimmed;
        } catch (err) {
          console.warn(
            "[proactive] idle chatter LLM call failed, using fallback",
            err,
          );
        }
      }
      speakText = chatter;
      hudText = chatter;
    }
    // Template-based fires (morning/calendar/weather) get rewritten
    // through the active character's 口調. Idle chatter already runs
    // through an LLM path with persona injected, so it skips this.
    if (p.kind !== "idleChatter") {
      speakText = await rewriteInPersona(
        speakText,
        langRef.current,
        voicevoxSpeakerIdRef.current,
        modeRef.current,
        chatClientRef.current,
      );
    }
    console.info(`[proactive] fired: kind=${p.kind}`);
    if (useHud) {
      // Idle chatter is low-priority filler and only ever speaks; it was
      // already dropped above for every HUD case, so this only routes
      // the notification kinds to the HUD.
      if (p.kind === "idleChatter") return;
      await invoke("hud_show", { text: hudText, durationMs: 10000 }).catch(
        () => {},
      );
      return;
    }
    // Calendar warnings + weather alerts also surface on the HUD even
    // when audible — the cue is time-critical and missing the spoken
    // form (e.g. user away from the desk) would defeat the feature.
    // Morning brief skips the HUD when audible to avoid double-clutter.
    if (p.kind === "calendarWarning" || p.kind === "weatherAlert") {
      void invoke("hud_show", { text: hudText, durationMs: 10000 }).catch(
        () => {},
      );
    }
    ttsActiveRef.current = true;
    await invoke("pause_listening").catch(() => {});
    try {
      await speakQueued(speakText, resolveLanguage(langRef.current));
    } catch (err) {
      console.error("[proactive] tts failed", err);
    } finally {
      await new Promise((r) => setTimeout(r, POST_TTS_COOLDOWN_MS));
      await invoke("resume_listening").catch(() => {});
      ttsActiveRef.current = false;
    }
  });

  return { state, error };
}
