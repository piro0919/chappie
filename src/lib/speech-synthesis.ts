export function speak(text: string, voiceURI: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceURI) {
      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => v.voiceURI === voiceURI);
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      }
    }
    utter.onend = () => resolve();
    utter.onerror = (e) =>
      reject(new Error(`speech synthesis error: ${e.error}`));
    window.speechSynthesis.speak(utter);
  });
}
