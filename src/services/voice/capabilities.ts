/**
 * Voice capabilities are detected separately and reported honestly.
 * - recognition: browser SpeechRecognition (Chrome/Edge/Safari; not Firefox)
 * - synthesis: SpeechSynthesis (most browsers)
 * - mediaDevices: raw microphone access (for optional local recordings)
 */
export interface VoiceCapabilities {
  recognition: boolean;
  synthesis: boolean;
  mediaDevices: boolean;
}

type SRConstructor = new () => SpeechRecognitionLike;

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>;
}

export function getRecognitionCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceCapabilities(): VoiceCapabilities {
  return {
    recognition: getRecognitionCtor() !== null,
    synthesis: typeof window !== "undefined" && "speechSynthesis" in window,
    mediaDevices: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
  };
}
