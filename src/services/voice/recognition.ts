import { getRecognitionCtor, type SpeechRecognitionLike } from "./capabilities";

export type RecognitionState = "idle" | "requesting" | "listening" | "stopped" | "error" | "unsupported";

export interface RecognitionCallbacks {
  onState: (s: RecognitionState, detail?: string) => void;
  onInterim: (text: string) => void;
  onFinal: (segment: string) => void;
}

export interface RecordingStats {
  startedAt: number;
  endedAt: number;
  /** Timestamps (ms) when final segments arrived; used for pause detection. */
  segmentTimes: number[];
}

/**
 * Thin wrapper around the browser SpeechRecognition API with explicit
 * states, so the UI can show listening indicators and handle denial,
 * unavailability, and cancellation. Transcription quality is the browser's.
 */
export class Recognizer {
  private rec: SpeechRecognitionLike | null = null;
  private cb: RecognitionCallbacks;
  private stats: RecordingStats | null = null;
  private userStopped = false;
  state: RecognitionState = "idle";

  constructor(cb: RecognitionCallbacks) {
    this.cb = cb;
    if (!getRecognitionCtor()) this.setState("unsupported");
  }

  private setState(s: RecognitionState, detail?: string) {
    this.state = s;
    this.cb.onState(s, detail);
  }

  async start(lang = "en-US") {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.setState("unsupported", "Speech recognition is not available in this browser. Use text input.");
      return;
    }
    this.setState("requesting");
    // Ask for the microphone explicitly so permission denial is reported clearly.
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {
      const name = (e as DOMException).name;
      this.setState("error", name === "NotAllowedError" ? "Microphone permission denied. Allow the microphone in your browser, or use text input." : name === "NotFoundError" ? "No microphone found. Use text input." : `Microphone error: ${name}`);
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.userStopped = false;
    this.stats = { startedAt: Date.now(), endedAt: 0, segmentTimes: [] };
    rec.onstart = () => this.setState("listening");
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) {
          this.stats?.segmentTimes.push(Date.now());
          this.cb.onFinal(text.trim());
        } else interim += text;
      }
      this.cb.onInterim(interim);
    };
    rec.onerror = (ev) => {
      if (ev.error === "no-speech") return; // keep listening
      if (ev.error === "aborted" && this.userStopped) return;
      this.setState("error", ev.error === "not-allowed" ? "Microphone permission denied." : ev.error === "network" ? "The browser's speech service could not be reached (network)." : `Recognition error: ${ev.error}`);
    };
    rec.onend = () => {
      if (this.stats) this.stats.endedAt = Date.now();
      if (this.state === "listening" && !this.userStopped) {
        // Some browsers end sessions after silence; restart to keep listening.
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      if (this.state !== "error") this.setState("stopped");
    };
    this.rec = rec;
    try {
      rec.start();
    } catch (e) {
      this.setState("error", (e as Error).message);
    }
  }

  stop(): RecordingStats | null {
    this.userStopped = true;
    if (this.stats) this.stats.endedAt = Date.now();
    try {
      this.rec?.stop();
    } catch {
      /* ignore */
    }
    this.setState("stopped");
    return this.stats;
  }

  cancel() {
    this.userStopped = true;
    try {
      this.rec?.abort();
    } catch {
      /* ignore */
    }
    this.stats = null;
    this.setState("idle");
  }
}

const FILLERS = ["um", "uh", "like", "you know", "basically", "literally", "kind of", "sort of", "actually", "so yeah"];

/**
 * Delivery observations computed ONLY from a real recording's timing and the
 * recognised transcript. Never call this for typed answers.
 */
export function deliveryObservations(transcript: string, stats: RecordingStats) {
  const durationSec = Math.max(1, (stats.endedAt - stats.startedAt) / 1000);
  const words = transcript.split(/\s+/).filter(Boolean).length;
  const lower = ` ${transcript.toLowerCase().replace(/[.,!?]/g, "")} `;
  const fillerWords = FILLERS.map((f) => ({ word: f, count: (lower.match(new RegExp(` ${f} `, "g")) ?? []).length })).filter((f) => f.count > 0);
  let longPauses = 0;
  for (let i = 1; i < stats.segmentTimes.length; i++) if (stats.segmentTimes[i] - stats.segmentTimes[i - 1] > 4000) longPauses++;
  return {
    wordsPerMinute: Math.round((words / durationSec) * 60),
    fillerWords,
    longPauses,
    durationSec: Math.round(durationSec),
    note: "Derived from recording duration, recognised words and gaps between recognised segments. Not an acoustic analysis; says nothing about confidence, emotion or competence.",
  };
}
