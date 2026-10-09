/** Text-to-speech via the browser's SpeechSynthesis API, with graceful absence. */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, opts: { rate?: number; onEnd?: () => void } = {}): () => void {
  if (!canSpeak()) {
    opts.onEnd?.();
    return () => undefined;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 1;
  u.lang = "en-US";
  const voices = synth.getVoices();
  const preferred = voices.find((v) => v.lang.startsWith("en") && /Google|Natural|Samantha|Daniel/.test(v.name)) ?? voices.find((v) => v.lang.startsWith("en"));
  if (preferred) u.voice = preferred;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  synth.speak(u);
  return () => synth.cancel();
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
