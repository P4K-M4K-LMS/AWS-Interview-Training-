import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../components/ui";
import { POLICY_EXERCISES, POLICY_EXERCISE_BY_ID, type PolicyExercise } from "../content/study/policyExercises";
import { nowIso } from "../data/db";
import { compilePolicies, evaluate, type Decision } from "../engine/policy/evaluate";
import { creditLabExercise, objectivesCreditedByExercise } from "../engine/study/bridge";

/**
 * Authorization policy lab. A fictional platform's policy language, a set of
 * requests that must come out right, and a decision trace for every request
 * that names the statement which decided it. Passing an exercise credits the
 * Study objectives curated as taught by it (Guided at most).
 */
export function PolicyLabPage() {
  const [params, setParams] = useSearchParams();
  const exercise = POLICY_EXERCISE_BY_ID.get(params.get("exercise") ?? "") ?? POLICY_EXERCISES[0];
  const from = params.get("from");
  const fromPath = from && /^[a-z0-9-]+:\d+:\d+$/.test(from) ? `/study/${from.split(":")[0]}/${from.split(":")[1]}` : null;
  const pick = (id: string) =>
    setParams((p) => {
      p.set("exercise", id);
      return p;
    });
  // Keyed on the exercise so every piece of state starts fresh when it changes.
  return <ExerciseView key={exercise.id} exercise={exercise} fromPath={fromPath} pick={pick} />;
}

function ExerciseView({ exercise, fromPath, pick }: { exercise: PolicyExercise; fromPath: string | null; pick: (id: string) => void }) {
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(exercise.policies.map((p) => [p.id, p.text])));
  const [hint, setHint] = useState(0);
  const [passed, setPassed] = useState<string | null>(null);
  const [openTrace, setOpenTrace] = useState<string | null>(null);

  const compiled = useMemo(() => compilePolicies(exercise.policies.map((p) => ({ ...p, text: texts[p.id] ?? p.text }))), [exercise, texts]);
  const results = useMemo(() => exercise.requests.map((r) => ({ ...r, decision: evaluate(compiled.policies, r.request) })), [exercise, compiled]);
  const allRight = results.every((r) => r.decision.decision === r.expect) && Object.keys(compiled.errors).length === 0;
  const credited = objectivesCreditedByExercise(exercise.id);

  async function check() {
    if (!allRight) return;
    await creditLabExercise(exercise.id, nowIso());
    setPassed(exercise.id);
  }

  const next = POLICY_EXERCISES[POLICY_EXERCISES.findIndex((e) => e.id === exercise.id) + 1];

  return (
    <div className="space-y-4">
      <PageHeader title="Authorization policies" subtitle="A fictional platform's policy language with the rules every cloud policy system shares: default deny, explicit deny wins, boundaries and organisation guardrails are ceilings, and a principal from another account needs both sides to allow. Every decision shows the statement that made it. No vendor's syntax is used." />
      {fromPath && (
        <Callout kind="info" title="From Study">
          Passing this exercise credits the objective you came from (to "Guided"). <Link to={fromPath} className="underline" data-testid="policy-back-link">Back to the unit</Link>.
        </Callout>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Exercises">
        {POLICY_EXERCISES.map((e, i) => (
          <button key={e.id} type="button" role="tab" aria-selected={e.id === exercise.id} className={`badge ${e.id === exercise.id ? "text-amber-500" : ""}`} onClick={() => pick(e.id)} data-testid={`policy-exercise-${i + 1}`}>
            {i + 1}. {e.title}
          </button>
        ))}
      </div>
      <Panel title={exercise.title}>
        <p className="text-sm" data-testid="policy-brief">{exercise.brief}</p>
        <p className="muted text-xs mt-2">Teaches: {exercise.teaches}</p>
        {credited.length > 0 && <p className="muted text-xs mt-1">Counts toward {credited.length} Study objective{credited.length === 1 ? "" : "s"}.</p>}
      </Panel>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {exercise.policies.map((p) => {
            const editable = p.id === exercise.editable;
            const errs = compiled.errors[p.id] ?? [];
            return (
              <Panel key={p.id} title={`${p.name}${editable ? "" : " (read-only)"}`}>
                <div className="muted text-xs mb-1">{KIND_HELP[p.kind]}</div>
                <textarea className="input font-mono text-xs min-h-24" value={texts[p.id] ?? p.text} readOnly={!editable} onChange={(e) => setTexts((t) => ({ ...t, [p.id]: e.target.value }))} data-testid={`policy-text-${p.id}`} aria-label={p.name} />
                {errs.length > 0 && (
                  <ul className="text-xs text-red-500 mt-1" data-testid={`policy-errors-${p.id}`}>
                    {errs.map((e) => (
                      <li key={`${e.line}-${e.message}`}>
                        line {e.line}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
          <Panel title="Grammar">
            <pre className="text-xs whitespace-pre-wrap">{GRAMMAR}</pre>
          </Panel>
        </div>
        <div className="space-y-3">
          <Panel title="Requests that must come out right">
            <ul className="space-y-2" data-testid="policy-requests">
              {results.map((r) => {
                const ok = r.decision.decision === r.expect;
                return (
                  <li key={r.id} className={`panel-2 p-2 text-sm border ${ok ? "border-emerald-500/60" : "border-red-500/60"}`} data-testid={`policy-request-${r.id}`} data-ok={ok ? "1" : "0"}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="muted text-xs">
                          {r.request.principal.id}
                          {r.request.principal.account !== r.request.resource.account ? ` (account ${r.request.principal.account})` : ""} → {r.request.action} on {r.request.resource.id}
                          {Object.keys(r.request.resource.tags).length ? ` [${Object.entries(r.request.resource.tags).map(([k, v]) => `${k}=${v}`).join(", ")}]` : ""}
                        </div>
                      </div>
                      <div className="text-right text-xs shrink-0">
                        <div>
                          now: <strong data-testid={`policy-decision-${r.id}`}>{r.decision.decision}</strong>
                        </div>
                        <div className="muted">want: {r.expect}</div>
                      </div>
                    </div>
                    <p className="text-xs mt-1">{r.decision.reason}</p>
                    <button type="button" className="btn-ghost text-xs mt-1" onClick={() => setOpenTrace(openTrace === r.id ? null : r.id)} data-testid={`policy-trace-toggle-${r.id}`}>
                      {openTrace === r.id ? "Hide trace" : "Show trace"}
                    </button>
                    {openTrace === r.id && <Trace decision={r.decision} />}
                  </li>
                );
              })}
            </ul>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={!allRight || passed === exercise.id} onClick={() => void check()} data-testid="policy-check">
              {passed === exercise.id ? "Passed" : allRight ? "Every request is right: mark as passed" : "Not yet: fix the policy until every request matches"}
            </button>
            {hint < exercise.hints.length && (
              <button type="button" className="btn-secondary" onClick={() => setHint((h) => h + 1)} data-testid="policy-hint">
                Hint {hint + 1} of {exercise.hints.length}
              </button>
            )}
          </div>
          {hint > 0 && (
            <ul className="text-sm space-y-1" data-testid="policy-hints">
              {exercise.hints.slice(0, hint).map((h) => (
                <li key={h} className="panel-2 p-2">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {passed === exercise.id && (
            <Callout kind="success" title="Exercise passed">
              <span data-testid="policy-passed">
                {credited.length ? `Credited ${credited.length} Study objective${credited.length === 1 ? "" : "s"} (Guided at most).` : "Nothing in Study is linked to this exercise yet."}
              </span>{" "}
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

const KIND_HELP: Record<PolicyExercise["policies"][number]["kind"], string> = {
  identity: "Attached to the principal: what they may do.",
  resource: "Attached to the resource: who may do what to it; names principals with \"for\".",
  boundary: "A ceiling on one principal: the most they can ever have, grants nothing by itself.",
  guardrail: "An organisation-wide ceiling: applies to everyone, including administrators.",
};

const GRAMMAR = `allow|deny <action[, action]> on <resource[, resource]> [for <principal[, principal]>] [when <condition> [and <condition>]]
actions and resources take * as a wildcard: store:*, store/orders/*
conditions: key = value, key != value, key in a,b,c, key exists
keys: principal.id, principal.account, principal.tag.<name>, resource.id, resource.account, resource.tag.<name>, request.mfa, request.network
a value may reference the other side: \${resource.tag.team}
# starts a comment`;

function Trace({ decision }: { decision: Decision }) {
  return (
    <ol className="mt-2 space-y-1 text-xs" data-testid="policy-trace">
      {decision.trace.map((t, i) => (
        <li key={i} className={`flex gap-2 ${t.matched ? "" : "muted"}`}>
          <span className="shrink-0">{t.matched ? (t.effect === "deny" ? "✖" : "✔") : "·"}</span>
          <span>
            <strong>{t.policyName}</strong> line {t.line} ({t.effect}): {t.why}
            {decision.decidedBy && decision.decidedBy.policyId === t.policyId && decision.decidedBy.line === t.line ? " ← decided" : ""}
          </span>
        </li>
      ))}
      <li className="font-medium">Result: {decision.decision}. {decision.reason}</li>
    </ol>
  );
}
