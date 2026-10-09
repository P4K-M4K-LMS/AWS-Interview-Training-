import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { CRYPTO_EXERCISES, CRYPTO_EXERCISE_BY_ID, type CryptoExercise } from "../content/study/cryptoExercises";
import { nowIso } from "../data/db";
import { DIRECT_LIMIT_KB, parseProgram, runProgram, type CryptoState } from "../engine/crypto/envelope";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Envelope encryption lab. A program of one-line commands drives a simulated
 * key service: data keys in two forms, local sealing, storage with the wrapped
 * key beside the data, unwrapping under the key policy, rotation with
 * versions, grants across accounts. Every line is traced; the checks read the
 * final state and the trace. Passing credits the curated Study objectives
 * (Guided at most). Nothing here is real cryptography.
 */
export function CryptoLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = CRYPTO_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? CRYPTO_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

const COMMANDS: Array<[string, string]> = [
  ["datakey KEY as PRINCIPAL -> NAME", "ask the service for a data key: plaintext NAME in memory, a wrapped copy alongside"],
  ["encrypt OBJECT with NAME", "seal the object locally with the plaintext data key; the service never sees the data"],
  ["encrypt OBJECT with key KEY as PRINCIPAL", `seal a small object in the service itself (at most ${DIRECT_LIMIT_KB} KB)`],
  ["store OBJECT [with NAME]", "persist the sealed object, with the wrapped data key NAME beside it"],
  ["forget NAME", "drop the plaintext data key from memory"],
  ["unwrap OBJECT as PRINCIPAL -> NAME", "send the stored wrapped key to the service; the key policy decides; plaintext key lands in NAME"],
  ["decrypt OBJECT with NAME", "open a data-key-sealed object locally"],
  ["decrypt OBJECT as PRINCIPAL", "open a service-sealed object through the service"],
  ["rotate KEY as PRINCIPAL", "new key material; older versions stay for decryption"],
  ["allow PRINCIPAL ACTION[,ACTION] on KEY as ADMIN", "add a key-policy rule (encrypt, decrypt, generate-data-key, rotate, admin)"],
];

function ExerciseView({ exercise, fromPath, pick }: { exercise: CryptoExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [program, setProgram] = useState(exercise.start);
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState(false);
  const { state, errors, checks } = useMemo(() => {
    const { commands, errors } = parseProgram(program);
    const state = runProgram(exercise.initial, exercise.principals, commands);
    return { state, errors, checks: exercise.checks(state) };
  }, [exercise, program]);
  const allRight = errors.length === 0 && checks.every((c) => c.passed);
  const credited = objectivesCreditedByExercise(exercise.id);
  const next = CRYPTO_EXERCISES[CRYPTO_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Envelope encryption" subtitle="A simulated key service: keys with versions and a policy, data keys in two forms, objects sealed locally or in the service, rotation, grants across accounts. Write the steps one per line and read the trace: every refusal says why. No real cryptography runs here; what you learn is the protocol and who may do what. Vendor-neutral." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="crypto-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {CRYPTO_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`crypto-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="crypto-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        <p className="muted text-xs mt-1">Principals: {exercise.principals.map((p) => `${p.id} (${p.account})`).join(", ")}.</p>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="Program">
            <textarea className="input font-mono text-sm w-full" rows={9} spellCheck={false} value={program} onChange={(e) => setProgram(e.target.value)} aria-label="Program" data-testid="crypto-program" />
            {errors.length > 0 && (
              <ul className="text-sm text-amber-500 mt-2 space-y-1" data-testid="crypto-errors">
                {errors.map((e) => (
                  <li key={`${e.line}-${e.message}`}>
                    line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer muted">Command reference</summary>
              <dl className="mt-1 space-y-1">
                {COMMANDS.map(([syntax, what]) => (
                  <div key={syntax}>
                    <dt className="font-mono">{syntax}</dt>
                    <dd className="muted ml-3">{what}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </Panel>
          <Panel title="Trace">
            {state.trace.length === 0 ? (
              <p className="text-sm muted">Nothing ran yet.</p>
            ) : (
              <ol className="text-sm space-y-1 font-mono" data-testid="crypto-trace">
                {state.trace.map((t, i) => (
                  <li key={`${t.line}-${i}`} className={t.ok ? "" : "text-amber-500"} data-testid={`crypto-trace-${t.line}`} data-ok={t.ok ? "1" : "0"}>
                    <span className="muted">{t.line}.</span> {t.command}
                    <div className="muted font-sans text-xs ml-5">{t.detail}</div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
        <div className="space-y-3 min-w-0 break-words">
          <Panel title="Key service">
            <StateView state={state} />
          </Panel>
          <Panel title="Checks">
            <ul className="space-y-1 text-sm" data-testid="crypto-checks">
              {checks.map((c) => (
                <li key={c.id} className={`flex gap-2 ${c.passed ? "" : "text-amber-500"}`} data-testid={`crypto-check-${c.id}`} data-ok={c.passed ? "1" : "0"}>
                  <span className="shrink-0">{c.passed ? "✔" : "✖"}</span>
                  <span>
                    {c.label}
                    {c.detail && !c.passed ? <span className="muted">: {c.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed} onClick={() => void check()} data-testid="crypto-check">
              {passed ? "Passed" : allRight ? "Every check passes: mark as passed" : "Not yet: change the program"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="crypto-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="crypto-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="crypto-passed">{credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}</span>{" "}
              {next ? (
                <button type="button" className="underline" onClick={() => pick(next.id)}>
                  Next: {next.title}
                </button>
              ) : (
                "That was the last exercise."
              )}
              {fromPath && (
                <>
                  {" "}
                  <Link to={fromPath} className="underline">Back to the unit</Link>.
                </>
              )}
            </Callout>
          )}
        </div>
      </div>
    </div>
  );
}

function StateView({ state }: { state: CryptoState }) {
  const dk = Object.entries(state.memory.dataKeys);
  const wrapped = Object.entries(state.memory.wrapped);
  return (
    <div className="text-xs space-y-2" data-testid="crypto-state">
      {state.keys.map((k) => (
        <div key={k.id} className="panel-2 p-2">
          <div className="font-semibold">
            {k.id} <span className="muted font-normal">account {k.account}, current v{k.versions}{k.versions > 1 ? `, v1 to v${k.versions - 1} decrypt-only` : ""}</span>
          </div>
          <ul className="muted mt-1">
            {k.policy.map((r, i) => (
              <li key={i}>
                {r.effect} {r.principal}: {r.actions.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="panel-2 p-2">
        <div className="font-semibold">Objects</div>
        <ul className="muted mt-1" data-testid="crypto-objects">
          {state.objects.map((o) => (
            <li key={o.name} data-testid={`crypto-object-${o.name}`}>
              {o.name} ({o.sizeKb.toLocaleString()} KB): {o.state === "plaintext" ? "plaintext" : o.sealedBy?.kind === "service" ? `sealed by the service (${o.sealedBy.keyId} v${o.sealedBy.version})` : `sealed with data key ${o.sealedBy?.dataKeyName} (${o.sealedBy?.keyId} v${o.sealedBy?.version})`}
              {o.stored ? `, stored${o.storedWrapped ? ` with wrapped ${o.storedWrapped.dataKeyName}` : o.sealedBy?.kind === "data-key" ? " without its wrapped key" : ""}` : ", not stored"}
            </li>
          ))}
        </ul>
      </div>
      <div className="panel-2 p-2">
        <div className="font-semibold">Application memory</div>
        <div className="muted mt-1" data-testid="crypto-memory">
          Plaintext data keys: {dk.length ? dk.map(([n, v]) => `${n} (${v.keyId} v${v.version})`).join(", ") : "none"}. Wrapped copies: {wrapped.length ? wrapped.map(([n, v]) => `${n} (${v.keyId} v${v.version})`).join(", ") : "none"}.
        </div>
      </div>
    </div>
  );
}
