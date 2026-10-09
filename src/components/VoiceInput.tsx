import { useEffect, useRef, useState } from "react";
import { Recognizer, deliveryObservations, type RecognitionState, type RecordingStats } from "../services/voice/recognition";
import { voiceCapabilities } from "../services/voice/capabilities";
import type { DeliveryObservations } from "../domain/types";
import { Callout } from "./ui";

interface Props {
  /** Called when the learner submits; `delivery` only exists when a real recording was captured. */
  onSubmit: (text: string, meta: { inputMode: "voice" | "text"; rawTranscript?: string; delivery?: DeliveryObservations; durationSec?: number }) => void;
  consent: boolean;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
}

/**
 * Answer input with microphone capture (browser speech recognition), an
 * editable transcript, and an always-available text fallback. Shows explicit
 * recording state. Delivery metrics are only produced from a real recording.
 */
export function VoiceInput({ onSubmit, consent, disabled, placeholder, submitLabel = "Submit answer", autoFocus }: Props) {
  const caps = voiceCapabilities();
  const [text, setText] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [state, setState] = useState<RecognitionState>(caps.recognition ? "idle" : "unsupported");
  const [detail, setDetail] = useState<string | undefined>();
  const [stats, setStats] = useState<RecordingStats | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<Recognizer | null>(null);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (state !== "listening") return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => () => recRef.current?.cancel(), []);

  const start = () => {
    const rec = new Recognizer({
      onState: (s, d) => {
        setState(s);
        setDetail(d);
      },
      onInterim: setInterim,
      onFinal: (seg) => {
        setText((t) => (t ? `${t} ${seg}` : seg));
        setRaw((r) => (r ? `${r} ${seg}` : seg));
      },
    });
    recRef.current = rec;
    setStats(null);
    void rec.start();
  };
  const stop = () => {
    const s = recRef.current?.stop() ?? null;
    setStats(s);
    setInterim("");
  };
  const cancel = () => {
    recRef.current?.cancel();
    setInterim("");
    setStats(null);
    setRaw(null);
    setText("");
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const usedVoice = raw !== null && stats !== null;
    onSubmit(trimmed, usedVoice ? { inputMode: "voice", rawTranscript: raw ?? undefined, delivery: deliveryObservations(trimmed, stats!), durationSec: Math.round((stats!.endedAt - stats!.startedAt) / 1000) } : { inputMode: "text" });
    setText("");
    setRaw(null);
    setStats(null);
    setInterim("");
    setState(caps.recognition ? "idle" : "unsupported");
  };

  const listening = state === "listening" || state === "requesting";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {caps.recognition ? (
          consent ? (
            listening ? (
              <>
                <button type="button" className="btn-danger" onClick={stop} data-testid="voice-stop">
                  ■ Stop recording
                </button>
                <button type="button" className="btn-ghost" onClick={cancel}>
                  Cancel
                </button>
                <span className="flex items-center gap-2 text-sm text-red-400" aria-live="polite">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" aria-hidden /> {state === "requesting" ? "Requesting microphone..." : `Listening · ${elapsed}s`}
                </span>
              </>
            ) : (
              <button type="button" className="btn-secondary" onClick={start} disabled={disabled} data-testid="voice-start">
                🎤 Answer by voice
              </button>
            )
          ) : (
            <span className="text-xs muted">Voice answers need microphone consent (Settings → Voice and privacy). Text input works now.</span>
          )
        ) : (
          <span className="text-xs muted">Speech recognition is not available in this browser; type your answer. (Chrome or Edge support voice input.)</span>
        )}
      </div>
      {state === "error" && detail && <Callout kind="danger">{detail}</Callout>}
      {interim && <div className="text-sm italic muted">{interim}…</div>}
      <label className="label" htmlFor="answer">
        {raw !== null ? "Transcript (review and correct any recognition errors before submitting)" : "Your answer"}
      </label>
      <textarea id="answer" className="input h-36" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder ?? "Speak or type your answer..."} disabled={disabled || listening} autoFocus={autoFocus} data-testid="answer-input" />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs muted">{text.trim().split(/\s+/).filter(Boolean).length} words{stats ? ` · recorded ${Math.round((stats.endedAt - stats.startedAt) / 1000)}s` : ""}</span>
        <button type="button" className="btn-primary" onClick={submit} disabled={disabled || listening || !text.trim()} data-testid="answer-submit">
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
