interface SRResult {
  0: { transcript: string };
}
interface SREvent extends Event {
  results: { 0: SRResult };
}
interface SRErrorEvent extends Event {
  error: string;
}
interface SR {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: ((e: Event) => void) | null;
  start: () => void;
  stop: () => void;
}
type SRCtor = new () => SR;

type SRWindow = typeof window & {
  SpeechRecognition?: SRCtor;
  webkitSpeechRecognition?: SRCtor;
};

export function captureCommand(opts: {
  language: string;
  timeoutMs: number;
}): Promise<string> {
  const Ctor: SRCtor | undefined =
    (window as SRWindow).SpeechRecognition ??
    (window as SRWindow).webkitSpeechRecognition;
  if (!Ctor) return Promise.reject(new Error("SpeechRecognition unsupported"));

  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = opts.language;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      try {
        rec.stop();
      } catch {
        // ignore
      }
      fn();
    };

    const timer = setTimeout(
      () => settle(() => reject(new Error("timeout"))),
      opts.timeoutMs,
    );

    rec.onresult = (e) => {
      clearTimeout(timer);
      const text = e.results[0]?.[0]?.transcript ?? "";
      settle(() => (text ? resolve(text) : reject(new Error("empty"))));
    };
    rec.onerror = (e) => {
      clearTimeout(timer);
      settle(() => reject(new Error(`recognition error: ${e.error}`)));
    };
    rec.onend = () => {
      clearTimeout(timer);
      settle(() => reject(new Error("ended without result")));
    };

    rec.start();
  });
}
