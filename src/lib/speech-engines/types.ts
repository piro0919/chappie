// Common interfaces every TTS backend implements. Engines may translate
// the semantics differently (Web Speech uses the browser's native queue,
// VOICEVOX fans out per-sentence HTTP calls and plays via Web Audio),
// but call sites only see these interfaces.

// Streaming speaker handle returned by `SpeechEngine.createStreamingSpeaker`.
// Feed it text chunks as they arrive; flush after no more chunks come.
export interface StreamingSpeaker {
  feed: (chunk: string) => void;
  flush: () => Promise<void>;
}

export interface SpeechEngine {
  speak(text: string, lang: string): Promise<void>;
  speakQueued(text: string, lang: string): Promise<void>;
  cancel(): void;
  createStreamingSpeaker(lang: string): StreamingSpeaker;
}
