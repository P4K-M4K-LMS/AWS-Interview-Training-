import { describe, expect, it } from "vitest";
import { ALGORITHMS, growthTable, runAlgorithm, theoreticalOps } from "../src/engine/bigo/algorithms";

describe("Big O engine", () => {
  it("counts operations that grow with the expected class", () => {
    const lin = growthTable("linear-search", [100, 1000, 10000]);
    expect(lin[1].operations / lin[0].operations).toBeCloseTo(10, 0);
    const bin = growthTable("binary-search", [1000, 1_000_000]);
    expect(bin[1].operations).toBeLessThan(25);
    const bub = growthTable("bubble-sort", [100, 1000]);
    expect(bub[1].operations / bub[0].operations).toBeGreaterThan(50);
    const con = growthTable("constant-index", [10, 1_000_000]);
    expect(con[0].operations).toBe(con[1].operations);
  });

  it("caps exponential inputs so the browser never freezes", () => {
    const r = runAlgorithm("fibonacci-recursive", 1000);
    expect(r.n).toBe(28);
    expect(r.result).toContain("fib(28) = 317811");
  });

  it("records step-through for small inputs only", () => {
    expect(runAlgorithm("bubble-sort", 6, 1, true).steps.length).toBeGreaterThan(3);
    expect(runAlgorithm("bubble-sort", 500, 1, true).steps.length).toBe(0);
  });

  it("sorts correctly", () => {
    for (const key of ["bubble-sort", "insertion-sort", "merge-sort"] as const) {
      const r = runAlgorithm(key, 50, 7, true);
      expect(r.result).toContain("sorted 50");
    }
    const steps = runAlgorithm("insertion-sort", 8, 3, true).steps;
    const final = steps[steps.length - 1].array!;
    expect([...final].sort((a, b) => a - b)).toEqual(final);
  });

  it("has theoretical references for every algorithm", () => {
    for (const a of ALGORITHMS) expect(theoreticalOps(a.complexity, 16)).toBeGreaterThan(0);
  });
});
