// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { loadPyodide } from "pyodide";
import { EXPECTED, SQL_EXERCISES, SQL_EXERCISE_BY_ID } from "../src/content/study/sqlExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { executeInPyodide, type PyodideLike } from "../src/engine/python/execute";
import { buildProgram, parseResult, planScans, planUsesIndex, sameRowsOrdered, sameRowsUnordered, type SqlRunResult } from "../src/engine/sql/harness";

let py: PyodideLike;
beforeAll(async () => {
  py = (await loadPyodide()) as unknown as PyodideLike;
}, 120_000);

function runSql(setup: string, sql: string): SqlRunResult {
  const r = executeInPyodide(py, { id: "sql", code: buildProgram(setup, sql) });
  expect(r.error, r.error ?? "").toBeNull();
  const parsed = parseResult(r.stdout);
  expect(parsed).not.toBeNull();
  return parsed!;
}

describe("SQL harness (real SQLite via Pyodide)", () => {
  it("returns rows, columns, the plan of the last query, created objects and table counts", () => {
    const r = runSql("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); INSERT INTO t VALUES (1, 'a'), (2, 'b');", "CREATE INDEX i_v ON t (v);\nCREATE VIEW vv AS SELECT * FROM t;\nSELECT id, v FROM t WHERE v = 'b';");
    expect(r.columns).toEqual(["id", "v"]);
    expect(r.rows).toEqual([[2, "b"]]);
    expect(r.statements).toBe(3);
    expect(planUsesIndex(r.plan, "t")).toBe(true);
    expect(r.indexes.map((i) => i.name)).toEqual(["i_v"]);
    expect(r.views).toEqual(["vv"]);
    expect(r.tables).toEqual([{ name: "t", rowCount: 2 }]);
  });

  it("reports an error with the statement number and keeps earlier statements' effects", () => {
    const r = runSql("CREATE TABLE t (id INTEGER PRIMARY KEY);", "INSERT INTO t VALUES (1);\nINSERT INTO t VALUES (1);\nSELECT * FROM t;");
    expect(r.error).toMatch(/UNIQUE constraint failed/);
    expect(r.errorStatement).toBe(2);
    expect(r.tables[0].rowCount).toBe(1);
  });

  it("skips comment lines and handles statements spanning several lines", () => {
    const r = runSql("CREATE TABLE t (id INTEGER PRIMARY KEY);", "-- a comment\nINSERT INTO t\nVALUES (7);\nSELECT id\nFROM t;");
    expect(r.rows).toEqual([[7]]);
    expect(r.statements).toBe(2);
  });

  it("a scan and a search are told apart in the plan", () => {
    const scan = runSql("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);", "SELECT * FROM t WHERE v = 'x';");
    expect(planScans(scan.plan, "t")).toBe(true);
    expect(planUsesIndex(scan.plan, "t")).toBe(false);
    const search = runSql("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); CREATE INDEX i ON t (v);", "SELECT * FROM t WHERE v = 'x';");
    expect(planScans(search.plan, "t")).toBe(false);
    expect(planUsesIndex(search.plan, "t")).toBe(true);
  });

  it("row comparison rounds numbers and ignores order only when asked", () => {
    expect(sameRowsUnordered([[1, 2.00001], [3, 4]], [[3, 4], [1, 2]])).toBe(true);
    expect(sameRowsOrdered([[1, 2], [3, 4]], [[3, 4], [1, 2]])).toBe(false);
    expect(sameRowsOrdered([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true);
  });
});

describe("SQL lab exercises (real SQLite via Pyodide)", () => {
  it("every exercise fails as given and passes with its reference program", () => {
    for (const e of SQL_EXERCISES) {
      const start = e.checks(runSql(e.setup, e.start));
      expect(start.every((c) => c.passed), `${e.id} must not pass as given`).toBe(false);
      const sol = e.checks(runSql(e.setup, e.solution));
      expect(sol.filter((c) => !c.passed).map((c) => `${c.id}: ${c.detail}`), e.id).toEqual([]);
      expect(e.hints.length).toBeGreaterThanOrEqual(2);
    }
  }, 60_000);

  it("the expected rows are exactly what the reference solutions produce", () => {
    for (const [id, rows] of Object.entries(EXPECTED)) {
      const e = SQL_EXERCISE_BY_ID.get(id)!;
      const r = runSql(e.setup, e.solution);
      expect(sameRowsOrdered(r.rows, rows), id).toBe(true);
    }
  }, 60_000);

  it("the index exercise rejects an index that the lookup cannot use, and the plan exercise rejects the function-wrapped column", () => {
    const idx = SQL_EXERCISE_BY_ID.get("sql-02-index")!;
    const wrong = idx.checks(runSql(idx.setup, "CREATE INDEX i_status ON orders (status);\nSELECT id, placed_at, status FROM orders WHERE customer_id = 17 ORDER BY placed_at;"));
    expect(wrong.filter((c) => !c.passed).map((c) => c.id)).toEqual(["index", "plan"]);
    const plan = SQL_EXERCISE_BY_ID.get("sql-06-plan")!;
    const wrapped = plan.checks(runSql(plan.setup, "SELECT COUNT(*) AS march_orders FROM orders WHERE strftime('%m', placed_at) = '03';"));
    expect(wrapped.filter((c) => !c.passed).map((c) => c.id)).toEqual(["plan"]);
  }, 30_000);

  it("the transaction exercise: a debit the CHECK rejects rolls the whole transaction back", () => {
    const e = SQL_EXERCISE_BY_ID.get("sql-04-transaction")!;
    const r = runSql(e.setup, "BEGIN;\nUPDATE accounts SET balance = balance + 500 WHERE id = 2;\nUPDATE accounts SET balance = balance - 500 WHERE id = 1;\nCOMMIT;");
    expect(r.error).toMatch(/CHECK constraint failed/);
    // The harness does not commit after an error, so bob's credit is gone too.
    const after = runSql(e.setup, "SELECT id, owner, balance FROM accounts ORDER BY id;");
    expect(after.rows).toEqual([[1, "alice", 100], [2, "bob", 20]]);
  }, 30_000);

  it("every exercise credits Study objectives, and exercise text stays vendor-neutral", () => {
    for (const e of SQL_EXERCISES) expect(LAB_LINKS[e.id]?.length ?? 0, e.id).toBeGreaterThan(0);
    const text = JSON.stringify(SQL_EXERCISES.map((e) => ({ title: e.title, brief: e.brief, teaches: e.teaches, hints: e.hints })));
    for (const word of ["AWS", "Amazon", "Athena", "Redshift", "Aurora", "RDS"]) expect(text, word).not.toContain(word);
  });
});
