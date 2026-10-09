import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { ALARM_EXERCISES } from "../src/content/study/alarmExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { evaluateExercise, evaluateRun, metricValue, parseAlarms, replay, type Run } from "../src/engine/alarms/evaluate";
import { BASELINE_CONFIG } from "../src/engine/sim/model";
import { creditLabExercise } from "../src/engine/study/bridge";

describe("alarm grammar", () => {
  it("parses named alarms with conditions and composites, and reports bad lines by number", () => {
    const { alarms, errors } = parseAlarms("# comment\nalert: errorRate > 0.03 for 3 of 3\npage: errorRate > 0.2 for 3 of 3 and latencyP95 >= 1000 for 2 of 5\nbad line\nx: nope > 1 for 1 of 1\ny: cpu > 50 for 5 of 2\nalert: cpu > 1 for 1 of 1");
    expect(alarms).toHaveLength(2);
    expect(alarms[0]).toMatchObject({ name: "alert", line: 2, conditions: [{ metric: "errorRate", op: ">", threshold: 0.03, n: 3, m: 3 }] });
    expect(alarms[1].conditions).toHaveLength(2);
    expect(alarms[1].conditions[1]).toMatchObject({ metric: "latencyP95", op: ">=", threshold: 1000, n: 2, m: 5 });
    expect(errors.map((e) => e.line)).toEqual([4, 5, 6, 7]);
    expect(errors[1].message).toMatch(/unknown metric nope/);
    expect(errors[3].message).toMatch(/defined twice/);
  });
});

describe("alarm evaluation", () => {
  const run = (over: Partial<Run>): Run => ({ id: "r", label: "r", kind: "healthy", config: BASELINE_CONFIG, ticks: 30, expect: {}, why: "", ...over });

  it("replays a run with timed configuration changes", () => {
    const series = replay(run({ changes: [{ atTick: 10, patch: { requestsPerSec: 400 } }, { atTick: 12, patch: { requestsPerSec: 120 } }] }));
    expect(series).toHaveLength(30);
    expect(series[9].errorRate).toBe(0);
    expect(series[10].errorRate).toBeGreaterThan(0.5);
    expect(series[12].errorRate).toBe(0);
    expect(metricValue(series[0], "fn.throttleRate")).toBeUndefined();
    expect(metricValue(series[0], "staleReads")).toBe(0);
  });

  it("fires only when n of the last m ticks breach, and composites need every condition at once", () => {
    const series = replay(run({ changes: [{ atTick: 10, patch: { requestsPerSec: 400 } }, { atTick: 12, patch: { requestsPerSec: 120 } }] }));
    const one = parseAlarms("a: errorRate > 0.03 for 1 of 1").alarms;
    expect(evaluateRun(one, series)[0]).toMatchObject({ firedAt: 10, alarmTicks: 2 });
    const three = parseAlarms("a: errorRate > 0.03 for 3 of 3").alarms;
    expect(evaluateRun(three, series)[0].firedAt).toBeNull();
    const twoOfFive = parseAlarms("a: errorRate > 0.03 for 2 of 5").alarms;
    expect(evaluateRun(twoOfFive, series)[0].firedAt).toBe(11);
    const sustained = replay(run({ config: { ...BASELINE_CONFIG, requestsPerSec: 500 } }));
    expect(evaluateRun(three, sustained)[0].firedAt).toBe(2);
    const composite = parseAlarms("p: errorRate > 0.2 for 3 of 3 and queueDepth > 100000 for 1 of 1").alarms;
    expect(evaluateRun(composite, sustained)[0].firedAt).toBeNull();
  });

  it("verdicts name a missing alarm, a late alarm and a false alarm", () => {
    const runs: Run[] = [run({ id: "inc", kind: "incident", config: { ...BASELINE_CONFIG, requestsPerSec: 500 }, expect: { alert: "fire", other: "fire" }, deadline: 2 }), run({ id: "noise", kind: "noise", expect: { alert: "quiet" }, changes: [{ atTick: 3, patch: { requestsPerSec: 500 } }] })];
    const v = evaluateExercise(parseAlarms("alert: errorRate > 0.03 for 3 of 3").alarms, runs);
    expect(v[0].checks.map((c) => c.passed)).toEqual([false, false]);
    expect(v[0].checks[0].detail).toMatch(/after the 2 s deadline/);
    expect(v[0].checks[1].detail).toMatch(/define an alarm named "other"/);
    expect(v[1].checks[0].detail).toMatch(/false alarm/);
  });
});

describe("alarm lab exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise fails as given and passes with its reference alarms, which parse cleanly", () => {
    for (const e of ALARM_EXERCISES) {
      const start = parseAlarms(e.start);
      expect(start.errors, `${e.id} start parses`).toEqual([]);
      expect(evaluateExercise(start.alarms, e.runs).every((v) => v.ok), `${e.id} must not pass as given`).toBe(false);
      const sol = parseAlarms(e.solution);
      expect(sol.errors, `${e.id} solution parses`).toEqual([]);
      for (const v of evaluateExercise(sol.alarms, e.runs)) expect(v.ok, `${e.id}/${v.run.id}: ${v.checks.map((c) => c.detail).join("; ")}`).toBe(true);
      expect(e.runs.some((r) => r.kind === "incident")).toBe(true);
      expect(e.runs.some((r) => r.kind !== "incident")).toBe(true);
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every exercise credits Study objectives, and passing records a lab attempt at Guided", async () => {
    for (const e of ALARM_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("alarm-03-right-metric", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["alarm-03-right-metric"]);
    for (const c of credited) expect(c.status).toBe("guided");
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["alarm-03-right-metric"].length);
  });

  it("exercise text stays vendor-neutral", () => {
    const text = JSON.stringify(ALARM_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints, runs: e.runs.map((r) => [r.label, r.why]) })));
    for (const word of ["CloudWatch", "AWS", "Amazon", "Lambda", "SNS"]) expect(text, word).not.toContain(word);
  });
});
