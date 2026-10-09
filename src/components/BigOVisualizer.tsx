import { useMemo, useState } from "react";
import { ALGORITHMS, ALGORITHM_BY_KEY, COMPLEXITY_ORDER, growthTable, runAlgorithm, type AlgorithmKey, type AlgorithmRun } from "../engine/bigo/algorithms";
import { Callout } from "./ui";

export interface ExperimentRecord {
  key: AlgorithmKey;
  n: number;
  operations: number;
  elapsedMs: number;
}

const SIZE_PRESETS = [8, 16, 100, 1000, 10000, 100000, 1000000];

export function BigOVisualizer({ onExperiment, highlight }: { onExperiment?: (r: ExperimentRecord) => void; highlight?: AlgorithmKey[] }) {
  const [key, setKey] = useState<AlgorithmKey>(highlight?.[0] ?? "linear-search");
  const [n, setN] = useState(16);
  const [run, setRun] = useState<AlgorithmRun | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [compareKey, setCompareKey] = useState<AlgorithmKey | "">("");
  const info = ALGORITHM_BY_KEY.get(key)!;
  const sizes = useMemo(() => SIZE_PRESETS.filter((s) => s <= info.maxN), [info]);

  const doRun = () => {
    const r = runAlgorithm(key, n, 42, true);
    setRun(r);
    setStepIdx(0);
    onExperiment?.({ key, n: r.n, operations: r.operations, elapsedMs: r.elapsedMs });
  };

  const table = useMemo(() => growthTable(key, sizes.filter((s) => s >= 8)), [key, sizes]);
  const compareTable = useMemo(() => (compareKey ? growthTable(compareKey, sizes.filter((s) => s >= 8 && s <= ALGORITHM_BY_KEY.get(compareKey)!.maxN)) : null), [compareKey, sizes]);

  const step = run?.steps[stepIdx];
  const currentArray = useMemo(() => {
    if (!run) return null;
    let arr: number[] | undefined;
    for (let i = 0; i <= stepIdx; i++) if (run.steps[i]?.array) arr = run.steps[i].array;
    return arr ?? null;
  }, [run, stepIdx]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="label" htmlFor="algo">
            Algorithm
          </label>
          <select id="algo" className="input" value={key} onChange={(e) => { setKey(e.target.value as AlgorithmKey); setRun(null); }}>
            {ALGORITHMS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name} · {a.complexity}
                {highlight?.includes(a.key) ? " ★" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="n">
            Input size n (max {info.maxN.toLocaleString()})
          </label>
          <input id="n" type="number" className="input w-40" min={1} max={info.maxN} value={n} onChange={(e) => setN(Math.max(1, Math.min(info.maxN, Number(e.target.value) || 1)))} />
        </div>
        <button type="button" className="btn-primary" onClick={doRun} data-testid="bigo-run">
          Run
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {sizes.map((s) => (
          <button key={s} type="button" className={`badge ${n === s ? "border-amber-500 text-amber-500" : ""}`} onClick={() => setN(s)}>
            n = {s.toLocaleString()}
          </button>
        ))}
      </div>
      <p className="text-sm muted">{info.description}</p>

      {run && (
        <div className="panel-2 p-3 space-y-2" data-testid="bigo-result">
          <div className="grid sm:grid-cols-3 gap-2 text-sm">
            <div>
              <div className="label">Operations counted (theory)</div>
              <div className="text-xl font-bold font-mono">{run.operations.toLocaleString()}</div>
            </div>
            <div>
              <div className="label">Elapsed (measured, this device)</div>
              <div className="text-xl font-bold font-mono">{run.elapsedMs.toFixed(2)} ms</div>
            </div>
            <div>
              <div className="label">Result</div>
              <div className="text-sm">{run.result}</div>
            </div>
          </div>
          {run.steps.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" className="btn-secondary" onClick={() => setStepIdx(0)} disabled={stepIdx === 0}>
                  ⏮
                </button>
                <button type="button" className="btn-secondary" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0}>
                  ◀ Prev
                </button>
                <button type="button" className="btn-secondary" onClick={() => setStepIdx((i) => Math.min(run.steps.length - 1, i + 1))} disabled={stepIdx >= run.steps.length - 1} data-testid="bigo-step">
                  Step ▶
                </button>
                <span className="text-xs muted">
                  step {stepIdx + 1} / {run.steps.length}
                </span>
              </div>
              {currentArray && (
                <div className="flex gap-1 flex-wrap font-mono text-xs" aria-label="Array state">
                  {currentArray.map((v, i) => {
                    const focused = step?.focus.includes(i);
                    const inRange = step?.range ? i >= step.range[0] && i <= step.range[1] : true;
                    return (
                      <span key={i} className={`px-1.5 py-1 rounded border ${focused ? "bg-amber-500 text-slate-950 border-amber-500" : inRange ? "" : "opacity-30"}`} style={{ borderColor: focused ? undefined : "var(--border)" }}>
                        {v}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="text-sm">{step?.note}</div>
            </div>
          ) : (
            <div className="text-xs muted">Step-through is available for n ≤ {info.maxStepN}. Lower n to watch the algorithm work.</div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between">
            <div className="label">Growth table: {info.name}</div>
          </div>
          <GrowthTable rows={table} complexity={info.complexity} />
        </div>
        <div>
          <label className="label" htmlFor="cmp">
            Compare side-by-side with
          </label>
          <select id="cmp" className="input mb-2" value={compareKey} onChange={(e) => setCompareKey(e.target.value as AlgorithmKey | "")}>
            <option value="">(none)</option>
            {ALGORITHMS.filter((a) => a.key !== key).map((a) => (
              <option key={a.key} value={a.key}>
                {a.name} · {a.complexity}
              </option>
            ))}
          </select>
          {compareTable && compareKey && <GrowthTable rows={compareTable} complexity={ALGORITHM_BY_KEY.get(compareKey)!.complexity} />}
        </div>
      </div>
      <Callout kind="info" title="Theory vs measurement">
        Operation counts come from counting comparisons/visits inside the algorithm and are deterministic. Elapsed milliseconds are measured on your device and vary from run to run. Classify with the counts; use timing only as a sanity check.
      </Callout>
      <div className="text-xs muted">Complexity ladder: {COMPLEXITY_ORDER.join(" < ")}</div>
    </div>
  );
}

function GrowthTable({ rows, complexity }: { rows: ReturnType<typeof growthTable>; complexity: string }) {
  const max = Math.max(...rows.map((r) => r.operations), 1);
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="muted text-left">
          <th className="py-1">n</th>
          <th>operations</th>
          <th>{complexity} ref</th>
          <th>ms</th>
          <th className="w-24">growth</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.n} className="border-t" style={{ borderColor: "var(--border)" }}>
            <td className="py-1 font-mono">{r.n.toLocaleString()}</td>
            <td className="font-mono">{r.operations.toLocaleString()}</td>
            <td className="font-mono muted">{r.theoretical.toLocaleString()}</td>
            <td className="font-mono muted">{r.elapsedMs.toFixed(2)}</td>
            <td>
              <div className="h-2 bg-amber-500 rounded" style={{ width: `${Math.max(2, (Math.log10(r.operations + 1) / Math.log10(max + 1)) * 100)}%` }} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
