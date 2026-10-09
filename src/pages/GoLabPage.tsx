import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { go } from "@codemirror/lang-go";
import { oneDark } from "@codemirror/theme-one-dark";
import { getGoRunner, GoRunner } from "../engine/go/runner";
import type { RunnerStatus } from "../engine/python/runner";
import type { PyRunResult } from "../engine/python/execute";
import { RunOutput } from "../components/PythonRunPanel";
import { useProfile } from "../data/hooks";
import { Callout, PageHeader, Panel } from "../components/ui";
import { RaceDetectorPanel } from "../components/RaceDetectorPanel";

const STARTER = `package main

import (
	"fmt"
	"sync"
)

// A worker pool: three goroutines drain a channel of jobs and report results.
func worker(id int, jobs <-chan int, results chan<- string, wg *sync.WaitGroup) {
	defer wg.Done()
	for j := range jobs {
		results <- fmt.Sprintf("worker %d processed job %d", id, j)
	}
}

func main() {
	jobs := make(chan int, 10)
	results := make(chan string, 10)
	var wg sync.WaitGroup

	for w := 1; w <= 3; w++ {
		wg.Add(1)
		go worker(w, jobs, results, &wg)
	}
	for j := 1; j <= 5; j++ {
		jobs <- j
	}
	close(jobs)
	wg.Wait()
	close(results)

	count := 0
	for range results {
		count++
	}
	fmt.Println("processed", count, "jobs with 3 workers")
}
`;

const GO_ERROR_HELP = [
  { match: /undefined:/, explanation: "Go requires every name to be declared before use, and names are case-sensitive. Check spelling, and remember exported names from packages start with a capital letter (fmt.Println)." },
  { match: /cannot use|mismatched types|invalid operation/, explanation: "Go does not convert types implicitly. Convert explicitly, e.g. float64(n) or strconv.Itoa(n), and make sure both sides of an operation have the same type." },
  { match: /expected|unexpected|syntax/, explanation: "Common causes: a missing brace, an opening brace on its own line (Go requires it on the same line as if/for/func), or a missing import." },
  { match: /deadlock/, explanation: "All goroutines are blocked: usually a channel send with no receiver, a receive with no sender, or a WaitGroup that is never Done. Close channels when producers finish and make sure every Add has a Done." },
  { match: /index out of range/, explanation: "You indexed past the end of a slice or array. Check len(s) first, or range over the slice." },
  { match: /nil pointer|nil map/, explanation: "You used a nil pointer or wrote to a nil map. Initialise maps with make(map[K]V) and check pointers before use." },
];

export function GoLabPage() {
  const profile = useProfile();
  const dark = (profile?.settings.theme ?? "dark") === "dark";
  const [code, setCode] = useState(STARTER);
  const [result, setResult] = useState<PyRunResult | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const runner = getGoRunner();
  const [status, setStatus] = useState<RunnerStatus>(runner.status);
  const [detail, setDetail] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    void GoRunner.available().then((ok) => {
      if (cancelled) return;
      setAvailable(ok);
      if (ok) void runner.warmup().catch(() => undefined);
    });
    const off = runner.onStatus((s, d) => {
      setStatus(s);
      setDetail(d);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [runner]);

  return (
    <div className="space-y-4">
      <PageHeader title="Go Laboratory" subtitle="Write and run real Go, including goroutines and channels. Code runs in the Yaegi interpreter compiled to WebAssembly, inside an isolated Web Worker with a 10-second limit." />
      {available === false && (
        <Callout kind="warn" title="Go runtime not available in this deployment">
          The Go runner is built from <code>go/runner</code> with <code>npm run build:go</code> (requires a Go toolchain) and deployed alongside the app. It was not found at this address, so the lab cannot run code here. Everything else in OpsForge works without it.
        </Callout>
      )}
      <Panel
        actions={
          <div className="text-xs muted flex items-center gap-2" aria-live="polite" data-testid="go-status">
            <span className={`inline-block w-2 h-2 rounded-full ${status === "ready" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-amber-500 animate-pulse"}`} />
            {status === "loading" ? "Loading the Go runtime (about 8 MB compressed, cached after the first load)..." : status === "ready" ? `Go ready (${runner.version}). Runs in an isolated Web Worker.` : status === "running" ? "Running..." : status === "error" ? `Runtime failed to load: ${detail ?? "unknown error"}` : "Go runtime idle."}
          </div>
        }
      >
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }} data-testid="go-editor">
          <CodeMirror value={code} height="24rem" extensions={[go()]} theme={dark ? oneDark : "light"} onChange={setCode} basicSetup={{ lineNumbers: true, foldGutter: false, tabSize: 4 }} aria-label="Go code editor" />
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <button type="button" className="btn-primary" disabled={status !== "ready"} onClick={() => void runner.run({ code }).then(setResult)} data-testid="go-run">
            ▶ Run
          </button>
          <button type="button" className="btn-ghost" onClick={() => setCode(STARTER)}>
            Reset
          </button>
        </div>
        <div className="mt-3">
          <RunOutput result={result} errorHelp={GO_ERROR_HELP} />
        </div>
      </Panel>
      <Panel title="Data races: the race detector (optional local service)">
        <p className="text-sm muted mb-2">
          Goroutines here interleave cooperatively on one thread, so an unsynchronised <code>counter++</code> from many goroutines still adds up correctly in this lab, while on a real multi-core machine it loses updates. The Go race detector instruments memory accesses and reports such conflicts. Run the current program through it on your own machine.
        </p>
        <RaceDetectorPanel code={code} serviceUrl={profile?.settings.raceServiceUrl ?? ""} />
      </Panel>
      <Callout kind="info" title="What this lab can and cannot do">
        Real Go semantics for goroutines, channels, select, sync primitives, generics and most of the standard library (fmt, strings, sort, encoding/json, time, context, errors). No network, filesystem or cgo. WebAssembly is single-threaded, so goroutines interleave cooperatively: concurrency semantics are faithful, but true data races cannot be reproduced here. Races whose critical section contains a blocking call (a sleep, a channel operation, a lock) do show up, because the scheduler switches goroutines there. For everything else use the race detector panel above with the local service.
      </Callout>
    </div>
  );
}
