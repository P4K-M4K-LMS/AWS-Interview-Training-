/**
 * Core of the optional race-detector service: runs a Go program on the
 * learner's machine under `go run -race` and turns the detector's report into
 * structured data. Kept free of HTTP so it can be unit-tested directly.
 *
 * The race detector instruments memory accesses at runtime and reports
 * conflicting unsynchronised accesses it actually observed. Absence of a
 * report is not proof of absence of races: it only means none were hit in
 * this run.
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface RaceAccess {
  /** "write" or "read" */
  kind: string;
  /** Goroutine number as reported by the detector. */
  goroutine: string;
  /** First frame: function name and file:line. */
  frame: string;
}

export interface RaceReport {
  current: RaceAccess;
  previous: RaceAccess;
  raw: string;
}

export interface RaceRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  /** Compile or toolchain failure text, if the program did not run. */
  buildError: string | null;
  races: RaceReport[];
  /** Number the detector itself reported ("Found N data race(s)"). */
  raceCount: number;
}

const BLOCK_RE = /==================\nWARNING: DATA RACE\n([\s\S]*?)\n==================/g;

function parseAccess(section: string | undefined): RaceAccess {
  if (!section) return { kind: "unknown", goroutine: "?", frame: "" };
  const head = section.match(/^(?:Previous )?(Write|Read) at 0x[0-9a-f]+ by (?:main )?goroutine (\d+):/im);
  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  const fn = lines[1] ?? "";
  const loc = lines[2] ?? "";
  return { kind: head ? head[1].toLowerCase() : "unknown", goroutine: head ? head[2] : "?", frame: [fn, loc.replace(/ \+0x[0-9a-f]+$/, "")].filter(Boolean).join(" ") };
}

/** Parses `go run -race` stderr into one entry per reported race. */
export function parseRaceReport(stderr: string): { races: RaceReport[]; raceCount: number } {
  const races: RaceReport[] = [];
  for (const m of stderr.matchAll(BLOCK_RE)) {
    const body = m[1];
    const parts = body.split(/\n\n/);
    const current = parts.find((p) => /^(Write|Read) at/m.test(p));
    const previous = parts.find((p) => /^Previous (Write|Read) at/im.test(p));
    races.push({ current: parseAccess(current), previous: parseAccess(previous), raw: `WARNING: DATA RACE\n${body}` });
  }
  const count = stderr.match(/Found (\d+) data race\(s\)/);
  return { races, raceCount: count ? Number(count[1]) : races.length };
}

export interface RunOptions {
  timeoutMs?: number;
  /** Override the Go binary (tests). */
  goBinary?: string;
}

function run(cmd: string, args: string[], cwd: string, timeoutMs: number, env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += String(d)).length > 200_000 && child.kill("SIGKILL"));
    child.stderr.on("data", (d) => (stderr += String(d)).length > 400_000 && child.kill("SIGKILL"));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: `${stderr}\n${e.message}`, code: null, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });
  });
}

/** Reports whether `go` is on PATH and the race detector can be used (needs cgo, i.e. a C compiler). */
export async function probeGo(goBinary = "go"): Promise<{ goVersion: string | null; raceSupported: boolean; detail: string }> {
  const v = await run(goBinary, ["version"], tmpdir(), 10_000, process.env);
  if (v.code !== 0) return { goVersion: null, raceSupported: false, detail: `go not found: ${v.stderr.trim() || "install Go 1.22+ and put it on PATH"}` };
  const goVersion = v.stdout.trim();
  const dir = await mkdtemp(path.join(tmpdir(), "opsforge-race-probe-"));
  try {
    await writeFile(path.join(dir, "go.mod"), "module probe\n\ngo 1.22\n");
    await writeFile(path.join(dir, "main.go"), "package main\n\nfunc main() {}\n");
    const r = await run(goBinary, ["build", "-race", "-o", path.join(dir, "probe"), "."], dir, 120_000, { ...process.env, CGO_ENABLED: "1", GOFLAGS: "-mod=mod" });
    if (r.code !== 0) return { goVersion, raceSupported: false, detail: `race detector unavailable: ${r.stderr.trim().split("\n").slice(-1)[0]} (it needs cgo, so install a C compiler such as gcc or clang)` };
    return { goVersion, raceSupported: true, detail: "race detector ready" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Runs the program under the race detector in a throwaway module directory. */
export async function runWithRaceDetector(code: string, opts: RunOptions = {}): Promise<RaceRunResult> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const goBinary = opts.goBinary ?? "go";
  const t0 = Date.now();
  const dir = await mkdtemp(path.join(tmpdir(), "opsforge-race-"));
  try {
    await writeFile(path.join(dir, "go.mod"), "module learner\n\ngo 1.22\n");
    await writeFile(path.join(dir, "main.go"), code);
    const env = { ...process.env, CGO_ENABLED: "1", GOFLAGS: "-mod=mod", GOTRACEBACK: "single" };
    const build = await run(goBinary, ["build", "-race", "-o", path.join(dir, "prog"), "."], dir, timeoutMs, env);
    if (build.code !== 0) {
      return { stdout: "", stderr: build.stderr, exitCode: build.code, timedOut: build.timedOut, durationMs: Date.now() - t0, buildError: build.stderr.replace(/^# learner\n/, "").trim() || (build.timedOut ? "build timed out" : "build failed"), races: [], raceCount: 0 };
    }
    const r = await run(path.join(dir, "prog"), [], dir, timeoutMs, { ...env, GORACE: "halt_on_error=0" });
    const { races, raceCount } = parseRaceReport(r.stderr);
    return { stdout: r.stdout, stderr: r.stderr, exitCode: r.code, timedOut: r.timedOut, durationMs: Date.now() - t0, buildError: null, races, raceCount };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
