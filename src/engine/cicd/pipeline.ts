import type { ProgramHost, ProgramResult, SimProgram } from "../../domain/types";

/**
 * A small simulated CI runner. Pipelines are YAML-like files with an optional
 * top-level `env:` block and a `steps:` list of `name` / `run` pairs. Each
 * mission supplies a step runner that decides what its commands do against
 * the virtual filesystem, so failure modes are realistic and inspectable.
 */
export interface PipelineStep {
  name: string;
  run: string;
}

export interface Pipeline {
  env: Record<string, string>;
  steps: PipelineStep[];
}

export interface StepOutcome {
  ok: boolean;
  lines: string[];
}

export type StepRunner = (step: PipelineStep, pipeline: Pipeline, host: ProgramHost) => StepOutcome;

export function parsePipeline(text: string): Pipeline {
  const env: Record<string, string> = {};
  const steps: PipelineStep[] = [];
  let section: "env" | "steps" | null = null;
  let current: Partial<PipelineStep> | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    if (/^env:\s*$/.test(line)) {
      section = "env";
      continue;
    }
    if (/^steps:\s*$/.test(line)) {
      section = "steps";
      continue;
    }
    if (section === "env") {
      const m = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      continue;
    }
    if (section === "steps") {
      const nameM = line.match(/^\s*-\s*name:\s*(.+)$/);
      if (nameM) {
        if (current?.name && current.run) steps.push(current as PipelineStep);
        current = { name: nameM[1].trim() };
        continue;
      }
      const runM = line.match(/^\s+run:\s*(.+)$/);
      if (runM && current) current.run = runM[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  if (current?.name && current.run) steps.push(current as PipelineStep);
  return { env, steps };
}

export interface RunResult {
  success: boolean;
  failedStep: string | null;
  log: string;
  runNumber: number;
}

export function runPipeline(host: ProgramHost, ymlPath: string, runner: StepRunner, runNumber: number, stamp = "2026-03-09 09:20"): RunResult {
  const yml = host.readFile(ymlPath);
  const lines = [`=== pipeline run #${runNumber} (${stamp}) ===`];
  if (yml === null) {
    lines.push(`[setup] ERROR: ${ymlPath} not found`, `=== RESULT: FAILURE at step 'setup' ===`);
    return { success: false, failedStep: "setup", log: lines.join("\n") + "\n", runNumber };
  }
  const pipeline = parsePipeline(yml);
  if (pipeline.steps.length === 0) {
    lines.push(`[setup] ERROR: no steps found in ${ymlPath}`, `=== RESULT: FAILURE at step 'setup' ===`);
    return { success: false, failedStep: "setup", log: lines.join("\n") + "\n", runNumber };
  }
  for (const step of pipeline.steps) {
    lines.push(`[${step.name}] ${step.run}`);
    const out = runner(step, pipeline, host);
    for (const l of out.lines) lines.push(`[${step.name}] ${l}`);
    if (!out.ok) {
      lines.push(`=== RESULT: FAILURE at step '${step.name}' ===`);
      return { success: false, failedStep: step.name, log: lines.join("\n") + "\n", runNumber };
    }
  }
  lines.push(`=== RESULT: SUCCESS ===`);
  return { success: true, failedStep: null, log: lines.join("\n") + "\n", runNumber };
}

/**
 * The `ci` program: `ci run` executes the pipeline and writes the log,
 * `ci log` prints the last run, `ci status` summarises it.
 */
export function makeCiProgram(opts: { ymlPath: string; logPath: string; counterPath: string; runner: StepRunner; firstRunNumber?: number }): SimProgram {
  return {
    summary: "Run the CI pipeline or show its last run",
    usage: "ci run | ci log | ci status",
    run: (args, host): ProgramResult => {
      const sub = args[0];
      if (sub === "log") {
        const log = host.readFile(opts.logPath);
        return log === null ? { stdout: "", stderr: "ci: no runs yet\n", exitCode: 1 } : { stdout: log, stderr: "", exitCode: 0 };
      }
      if (sub === "status") {
        const log = host.readFile(opts.logPath) ?? "";
        const m = log.match(/=== pipeline run #(\d+).*?===[\s\S]*?=== RESULT: (\w+)(?: at step '([^']+)')? ===/);
        if (!m) return { stdout: "no runs yet\n", stderr: "", exitCode: 0 };
        return { stdout: `run #${m[1]}: ${m[2]}${m[3] ? ` at step '${m[3]}'` : ""}\n`, stderr: "", exitCode: m[2] === "SUCCESS" ? 0 : 1 };
      }
      if (sub === "run" || sub === "retry") {
        const prev = parseInt(host.readFile(opts.counterPath) ?? String(opts.firstRunNumber ?? 100), 10);
        const runNumber = (Number.isNaN(prev) ? 100 : prev) + 1;
        const result = runPipeline(host, opts.ymlPath, opts.runner, runNumber);
        host.writeFile(opts.logPath, result.log, true);
        host.writeFile(opts.counterPath, String(runNumber), true);
        const summary = result.success ? `run #${runNumber}: SUCCESS\n` : `run #${runNumber}: FAILURE at step '${result.failedStep}' (see 'ci log')\n`;
        return { stdout: result.log + summary, stderr: "", exitCode: result.success ? 0 : 1 };
      }
      return { stdout: "", stderr: "usage: ci run | ci log | ci status\n", exitCode: 2 };
    },
  };
}
