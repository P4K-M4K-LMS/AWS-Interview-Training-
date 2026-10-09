import { useState } from "react";
import { PythonEditor } from "../components/PythonEditor";
import { RunOutput, RunnerStatusLine, usePythonRunner } from "../components/PythonRunPanel";
import type { PyRunResult } from "../engine/python/execute";
import { Callout, PageHeader, Panel } from "../components/ui";

const STARTER = `# Free-play Python laboratory. Real CPython runs in your browser (Pyodide).
servers = {"web-01": 12, "web-02": 87, "db-01": 45}

for name, cpu in servers.items():
    status = "HOT" if cpu > 80 else "ok"
    print(f"{name:8} cpu={cpu:3d}% {status}")

print("Average CPU:", sum(servers.values()) / len(servers))
`;

export function PythonLabPage() {
  const [code, setCode] = useState(STARTER);
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState<PyRunResult | null>(null);
  const { runner, status, detail } = usePythonRunner();
  return (
    <div className="space-y-4">
      <PageHeader title="Python" subtitle="Write and execute real Python. Code runs in an isolated Web Worker with a 10-second limit; only genuine results are shown." />
      <Panel actions={<RunnerStatusLine status={status} detail={detail} version={runner.version} />}>
        <PythonEditor value={code} onChange={setCode} height="22rem" />
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-3 items-end">
          <div>
            <label className="label" htmlFor="stdin">
              Standard input for input() (one value per line)
            </label>
            <textarea id="stdin" className="input h-16 font-mono" value={stdin} onChange={(e) => setStdin(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={status !== "ready"} onClick={() => void runner.run({ code, stdin: stdin || undefined }).then(setResult)} data-testid="python-run">
              ▶ Run
            </button>
            <button type="button" className="btn-ghost" onClick={() => setCode(STARTER)}>
              Reset
            </button>
          </div>
        </div>
        <div className="mt-3">
          <RunOutput result={result} />
        </div>
      </Panel>
      <Callout kind="info" title="What this lab can and cannot do">
        It runs the Python standard library (json, csv, re, math, datetime, collections, unittest...). It cannot access files on your computer, the network, or install packages. Output you see here is the interpreter's real output.
      </Callout>
    </div>
  );
}
