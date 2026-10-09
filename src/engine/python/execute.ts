/**
 * Runs learner Python code inside a Pyodide interpreter and reports ONLY real
 * execution results. Shared by the browser Web Worker and the Node test suite.
 */

export interface PyRunRequest {
  id: string;
  code: string;
  stdin?: string;
  tests?: Array<{ id: string; code: string; stdin?: string }>;
}

export interface PyTestResult {
  id: string;
  passed: boolean;
  error?: string;
  stdout?: string;
}

export interface PyRunResult {
  id: string;
  stdout: string;
  stderr: string;
  /** Traceback text if the learner's code raised. */
  error: string | null;
  /** Short exception type, e.g. NameError. */
  errorType: string | null;
  durationMs: number;
  tests: PyTestResult[];
  timedOut?: boolean;
}

/** Minimal structural type of the Pyodide API we rely on. */
export interface PyodideLike {
  runPython: (code: string, options?: { globals?: unknown }) => unknown;
  globals: { get: (name: string) => unknown };
  setStdout: (opts: { batched?: (s: string) => void; raw?: (c: number) => void }) => void;
  setStderr: (opts: { batched?: (s: string) => void; raw?: (c: number) => void }) => void;
  setStdin?: (opts: { stdin?: () => string | null; isatty?: boolean }) => void;
}

const PRELUDE = `
import sys, builtins, traceback as _tb
def _opsforge_make_input(lines):
    it = iter(lines)
    def _input(prompt=""):
        if prompt:
            sys.stdout.write(str(prompt))
        try:
            return next(it)
        except StopIteration:
            raise EOFError("No more input available (the mission provided no further stdin lines).")
    return _input
`;

function formatException(e: unknown): { text: string; type: string } {
  const raw = e instanceof Error ? e.message : String(e);
  // Pyodide errors include the full Python traceback in `message`.
  const lines = raw.trimEnd().split("\n");
  // Drop pyodide-internal frames for readability.
  const cleaned = lines.filter((l) => !l.includes('File "/lib/python') && !l.includes("pyodide/") && !l.includes("_pyodide/"));
  const last = cleaned[cleaned.length - 1] ?? raw;
  const type = last.split(":")[0].trim() || "Error";
  return { text: cleaned.join("\n"), type };
}

export function executeInPyodide(py: PyodideLike, req: PyRunRequest): PyRunResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  let stdout = "";
  let stderr = "";
  py.setStdout({ batched: (s) => (stdout += s + "\n") });
  py.setStderr({ batched: (s) => (stderr += s + "\n") });

  const dictCtor = py.globals.get("dict") as () => unknown;
  const globals = dictCtor();
  let error: string | null = null;
  let errorType: string | null = null;

  const stdinLines = (req.stdin ?? "").split("\n");
  if (req.stdin === undefined) stdinLines.length = 0;

  try {
    py.runPython(PRELUDE, { globals });
    py.runPython(`builtins.input = _opsforge_make_input(${JSON.stringify(stdinLines)})`, { globals });
    py.runPython(req.code, { globals });
  } catch (e) {
    const f = formatException(e);
    error = f.text;
    errorType = f.type;
  }

  const userStdout = stdout;
  const tests: PyTestResult[] = [];
  if (!error && req.tests?.length) {
    for (const t of req.tests) {
      const before = stdout.length;
      try {
        if (t.stdin !== undefined) {
          py.runPython(`builtins.input = _opsforge_make_input(${JSON.stringify(t.stdin.split("\n"))})`, { globals });
        }
        py.runPython(t.code, { globals });
        tests.push({ id: t.id, passed: true, stdout: stdout.slice(before) });
      } catch (e) {
        const f = formatException(e);
        tests.push({ id: t.id, passed: false, error: f.text, stdout: stdout.slice(before) });
      }
    }
  } else if (error && req.tests?.length) {
    for (const t of req.tests) tests.push({ id: t.id, passed: false, error: "Not run: the program raised an error before tests could start." });
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  // Restore default streams so later runs do not keep capturing into old buffers.
  py.setStdout({});
  py.setStderr({});
  return {
    id: req.id,
    stdout: userStdout,
    stderr,
    error,
    errorType,
    durationMs: Math.round(t1 - t0),
    tests,
  };
}
