// @vitest-environment node
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseRaceReport, probeGo, runWithRaceDetector } from "../server/race-core";
import { goMissions } from "../src/content/missions/go";

const SAMPLE = `==================
WARNING: DATA RACE
Write at 0x00c000012178 by goroutine 8:
  main.main.func1()
      /tmp/racecheck/main.go:13 +0x96

Previous write at 0x00c000012178 by goroutine 7:
  main.main.func1()
      /tmp/racecheck/main.go:13 +0x96

Goroutine 8 (running) created at:
  main.main()
      /tmp/racecheck/main.go:13 +0x7d

Goroutine 7 (finished) created at:
  main.main()
      /tmp/racecheck/main.go:13 +0x7d
==================
==================
WARNING: DATA RACE
Read at 0x00c00001c0a8 by goroutine 9:
  main.(*Account).Withdraw()
      /tmp/x/main.go:21 +0x44

Previous write at 0x00c00001c0a8 by goroutine 10:
  main.(*Account).Withdraw()
      /tmp/x/main.go:25 +0x9a
==================
counter: 94
Found 2 data race(s)
`;

describe("race report parser", () => {
  it("extracts each race with its conflicting accesses", () => {
    const { races, raceCount } = parseRaceReport(SAMPLE);
    expect(raceCount).toBe(2);
    expect(races).toHaveLength(2);
    expect(races[0].current).toEqual({ kind: "write", goroutine: "8", frame: "main.main.func1() /tmp/racecheck/main.go:13" });
    expect(races[0].previous).toEqual({ kind: "write", goroutine: "7", frame: "main.main.func1() /tmp/racecheck/main.go:13" });
    expect(races[1].current.kind).toBe("read");
    expect(races[1].previous.frame).toBe("main.(*Account).Withdraw() /tmp/x/main.go:25");
    expect(races[1].raw).toMatch(/^WARNING: DATA RACE/);
  });
  it("reports zero races for a clean run", () => {
    expect(parseRaceReport("hello\n")).toEqual({ races: [], raceCount: 0 });
  });
});

const hasGo = spawnSync("go", ["version"]).status === 0;

describe.skipIf(!hasGo)("race detector service core (real go build -race)", () => {
  it("probes the toolchain", async () => {
    const p = await probeGo();
    expect(p.goVersion).toMatch(/^go version/);
    expect(typeof p.raceSupported).toBe("boolean");
  }, 120_000);

  it("reports races in the data-race mission starter and none in the reference solution", async () => {
    const p = await probeGo();
    if (!p.raceSupported) return; // no C compiler on this machine: covered by the parser test
    const m = goMissions.find((x) => x.id === "go-05-data-race")!;
    const starter = await runWithRaceDetector(m.starterCode, { timeoutMs: 120_000 });
    expect(starter.buildError).toBeNull();
    expect(starter.raceCount).toBeGreaterThan(0);
    expect(starter.races.some((r) => /Withdraw/.test(r.current.frame) || /Withdrawals/.test(r.current.frame))).toBe(true);
    const fixed = await runWithRaceDetector(m.referenceSolution, { timeoutMs: 120_000 });
    expect(fixed.buildError).toBeNull();
    expect(fixed.raceCount).toBe(0);
    expect(fixed.stdout).toContain("successful withdrawals: 5 balance: 0");
  }, 300_000);

  it("returns compiler output for a program that does not build", async () => {
    const r = await runWithRaceDetector("package main\nfunc main() { x := 1 }\n", { timeoutMs: 120_000 });
    expect(r.buildError).toMatch(/declared and not used/);
    expect(r.races).toEqual([]);
  }, 120_000);
});
