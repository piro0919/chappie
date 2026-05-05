import OpenAI from "openai";
import { useEffect, useRef, useState } from "react";
import { useEar } from "use-ear";
import { api } from "../ipc";
import { captureCommand } from "../lib/command-recognition";
import {
  addAssistant,
  addUser,
  createHistory,
  type History,
  messagesForRequest,
} from "../lib/conversation-history";
import { createChatClient } from "../lib/openai-client";
import { speak } from "../lib/speech-synthesis";
import {
  createMachine,
  type Machine,
  type State,
  transition,
} from "../lib/state-machine";

const WAKE_WORD = "chappie";
const MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT =
  "You are Chappie, a friendly hands-free voice assistant. Keep replies short and conversational because they will be read aloud.";
const COMMAND_TIMEOUT_MS = 6000;
const COMMAND_LANGUAGE = "ja-JP";
const WAKE_LANGUAGE = "en-US";

type LoopState = { state: State; isSupported: boolean };

export function useConversationLoop(): LoopState {
  const [machine, setMachine] = useState<Machine>(createMachine());
  const historyRef = useRef<History>(createHistory(SYSTEM_PROMPT));
  const apiKeyRef = useRef<string>("");
  const voiceURIRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const earRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  // Load settings once.
  useEffect(() => {
    api()
      .getSettings()
      .then((s) => {
        apiKeyRef.current = s.openaiApiKey;
        voiceURIRef.current = s.voiceURI;
      });
  }, []);

  // Sync tray icon with machine state.
  useEffect(() => {
    api().setTrayState(machine.state);
  }, [machine.state]);

  const ear = useEar({
    wakeWords: [WAKE_WORD],
    language: WAKE_LANGUAGE,
    continuous: true,
    onWakeWord: () => {
      if (busyRef.current) return;
      busyRef.current = true;
      void runTurn();
    },
  });

  earRef.current = { start: ear.start, stop: ear.stop };

  // Start ear listening once supported. ear.start/stop refs change every render
  // so we intentionally only re-run on isSupported transitions.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (!ear.isSupported) return;
    ear.start();
    return () => ear.stop();
  }, [ear.isSupported]);

  async function runTurn(): Promise<void> {
    try {
      ear.stop();
      setMachine((m) => transition(m, { type: "wakeDetected" }));

      let userText: string;
      try {
        userText = await captureCommand({
          language: COMMAND_LANGUAGE,
          timeoutMs: COMMAND_TIMEOUT_MS,
        });
      } catch {
        setMachine((m) => transition(m, { type: "speechTimeout" }));
        return;
      }

      setMachine((m) =>
        transition(m, { type: "speechCaptured", text: userText }),
      );

      if (!apiKeyRef.current) {
        await speak(
          "OpenAI APIキーが未設定です。設定画面から登録してください。",
          voiceURIRef.current,
        );
        setMachine((m) =>
          transition(m, { type: "responseFailed", message: "no api key" }),
        );
        setMachine((m) => transition(m, { type: "errorAcknowledged" }));
        return;
      }

      const openai = new OpenAI({
        apiKey: apiKeyRef.current,
        dangerouslyAllowBrowser: true,
      });
      const client = createChatClient(openai, MODEL);

      historyRef.current = addUser(historyRef.current, userText);

      let reply: string;
      try {
        reply = await client.complete(messagesForRequest(historyRef.current));
      } catch (e) {
        await speak("うまく繋がりませんでした。", voiceURIRef.current);
        setMachine((m) =>
          transition(m, { type: "responseFailed", message: String(e) }),
        );
        setMachine((m) => transition(m, { type: "errorAcknowledged" }));
        return;
      }

      historyRef.current = addAssistant(historyRef.current, reply);
      setMachine((m) => transition(m, { type: "responseReady", reply }));

      try {
        await speak(reply, voiceURIRef.current);
      } catch {
        // Ignore TTS errors; still return to idle.
      }
      setMachine((m) => transition(m, { type: "speechDone" }));
    } finally {
      busyRef.current = false;
      try {
        ear.start();
      } catch {
        // ignore
      }
    }
  }

  return { state: machine.state, isSupported: ear.isSupported };
}
