import type { CheckResult, DesignMission } from "../../domain/types";

/**
 * Transparent rubric for design exercises. Everything here is computed from
 * the learner's choices and the mission's numbers: cost is a sum, capacity
 * and latency follow the chosen options, single points of failure are the
 * options flagged as such, drills are answered against the design itself.
 * The justification check looks for structure (length and the required
 * terms), never for quality: the reflection prompt and the interview coach
 * cover that, and the UI says so.
 */
export interface DesignState {
  choices: Record<string, string>;
  quantities: Record<string, number>;
  drills: Record<string, number>;
  justification: string;
}

export interface DesignDerived {
  cost: number;
  ingestCapacity: number;
  readLatencyMs: number;
  spofs: Array<{ path: "write" | "read"; option: string }>;
  durable: boolean;
  complete: boolean;
}

export function emptyDesign(): DesignState {
  return { choices: {}, quantities: {}, drills: {}, justification: "" };
}

export function deriveDesign(mission: DesignMission, state: DesignState): DesignDerived {
  let cost = 0;
  let ingestCapacity = Infinity;
  let readLatencyMs = 0;
  let durable = false;
  const spofs: DesignDerived["spofs"] = [];
  let complete = true;
  for (const slot of mission.slots) {
    const opt = slot.options.find((o) => o.id === state.choices[slot.id]);
    if (!opt) {
      complete = false;
      continue;
    }
    cost += opt.cost;
    if (slot.paths.includes("write") && opt.capacity !== undefined) ingestCapacity = Math.min(ingestCapacity, opt.capacity);
    if (slot.paths.includes("read") && opt.latencyMs !== undefined) readLatencyMs += opt.latencyMs;
    if (opt.durable) durable = true;
    if (opt.spof) for (const p of slot.paths) spofs.push({ path: p, option: opt.name });
  }
  return { cost, ingestCapacity: ingestCapacity === Infinity ? 0 : ingestCapacity, readLatencyMs, spofs, durable, complete };
}

export function evaluateDesign(mission: DesignMission, state: DesignState): { checks: CheckResult[]; derived: DesignDerived } {
  const r = mission.requirements;
  const d = deriveDesign(mission, state);
  const checks: CheckResult[] = [];
  const missing = mission.slots.filter((s) => !s.options.some((o) => o.id === state.choices[s.id])).map((s) => s.label);
  checks.push({ id: "complete", label: "A component chosen for every slot", passed: d.complete, detail: missing.length ? `missing: ${missing.join(", ")}` : undefined });
  checks.push({ id: "throughput", label: `Write path sustains ${r.peakIngestPerSec.toLocaleString()} events/s`, passed: d.complete && d.ingestCapacity >= r.peakIngestPerSec, detail: d.complete ? `capacity ${d.ingestCapacity.toLocaleString()}/s` : "choose every component first" });
  checks.push({ id: "latency", label: `Read path p95 within ${r.maxReadLatencyMs} ms`, passed: d.complete && d.readLatencyMs <= r.maxReadLatencyMs, detail: d.complete ? `${d.readLatencyMs} ms` : "choose every component first" });
  checks.push({ id: "budget", label: `Monthly cost within ${r.budget.toLocaleString()}`, passed: d.complete && d.cost <= r.budget, detail: `${d.cost.toLocaleString()} / month` });
  for (const path of r.noSpofOn) {
    const bad = d.spofs.filter((s) => s.path === path).map((s) => s.option);
    checks.push({ id: `spof-${path}`, label: `No single point of failure on the ${path} path`, passed: d.complete && bad.length === 0, detail: bad.length ? `single points of failure: ${bad.join(", ")}` : undefined });
  }
  if (r.durableWrites) checks.push({ id: "durable", label: "Events survive a storage outage (durable buffer)", passed: d.complete && d.durable, detail: d.complete && !d.durable ? "nothing holds events while storage is down" : undefined });
  for (const q of mission.quantities) {
    const v = state.quantities[q.id];
    const ok = typeof v === "number" && Number.isFinite(v) && v >= q.min && v <= q.max;
    checks.push({ id: `qty-${q.id}`, label: q.label, passed: ok, detail: typeof v === "number" ? `${v} ${q.unit}` : "not answered" });
  }
  for (const drill of mission.drills) {
    const answered = state.drills[drill.id];
    const correct = d.complete ? drill.answerFor(state.choices) : -1;
    checks.push({ id: `drill-${drill.id}`, label: drill.prompt, passed: d.complete && answered === correct, detail: answered === undefined ? "not answered" : d.complete && answered !== correct ? "re-check the consequence against the components you chose" : undefined });
  }
  const text = state.justification.toLowerCase();
  const terms = r.justificationTerms.filter((t) => text.includes(t.toLowerCase()));
  const names = mission.slots.map((s) => s.options.find((o) => o.id === state.choices[s.id])?.name).filter((n): n is string => Boolean(n));
  const named = names.filter((n) => text.includes(n.toLowerCase().split(" ")[0]));
  const justOk = state.justification.trim().length >= r.justificationMinChars && terms.length >= r.justificationMinTerms && named.length >= Math.min(2, names.length);
  checks.push({
    id: "justification",
    label: `Justification names your components and at least ${r.justificationMinTerms} of: ${r.justificationTerms.join(", ")}`,
    passed: justOk,
    detail: `${state.justification.trim().length}/${r.justificationMinChars} chars, ${terms.length}/${r.justificationMinTerms} terms, ${named.length} components named (structure only; quality is for you and your interviewer to judge)`,
  });
  return { checks, derived: d };
}
