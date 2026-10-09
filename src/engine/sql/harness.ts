/**
 * SQL lab harness. The learner's SQL runs in the Python runtime's bundled
 * SQLite (real SQL, nothing simulated): a Python program seeds the exercise's
 * schema and data into an in-memory database, executes the learner's
 * statements one by one, and prints one JSON document with the rows of the
 * last query, the query plan SQLite chose for it, the indexes and views that
 * exist afterwards, and any error. The page and the checks read that JSON.
 * Nothing here parses SQL; SQLite does.
 */
export interface SqlRunResult {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  /** EXPLAIN QUERY PLAN lines for the last SELECT. */
  plan: string[];
  /** Names of the indexes present after the program ran (user-created ones only). */
  indexes: Array<{ name: string; table: string; sql: string }>;
  views: string[];
  tables: Array<{ name: string; rowCount: number }>;
  /** Statements run, in order. */
  statements: number;
  /** The last SELECT the program ran, if any. */
  lastQuery: string | null;
  error: string | null;
  errorStatement: number | null;
}

export const EMPTY_RESULT: SqlRunResult = { columns: [], rows: [], plan: [], indexes: [], views: [], tables: [], statements: 0, lastQuery: null, error: null, errorStatement: null };

/** Python source that seeds `setupSql`, runs `learnerSql`, and prints the JSON result on the last line of stdout. */
export function buildProgram(setupSql: string, learnerSql: string): string {
  return `
import sqlite3, json
_con = sqlite3.connect(":memory:")
_con.executescript(${JSON.stringify(setupSql)})
_seed_indexes = {r[0] for r in _con.execute("select name from sqlite_master where type='index' and name not like 'sqlite_%'")}
_seed_views = {r[0] for r in _con.execute("select name from sqlite_master where type='view'")}
_out = {"columns": [], "rows": [], "plan": [], "indexes": [], "views": [], "tables": [], "statements": 0, "lastQuery": None, "error": None, "errorStatement": None}
_src = ${JSON.stringify(learnerSql)}
_stmts = []
_buf = ""
for _line in _src.split("\\n"):
    _s = _line.strip()
    if _s.startswith("--"):
        continue
    _buf += _line + "\\n"
    if sqlite3.complete_statement(_buf):
        _stmts.append(_buf.strip())
        _buf = ""
if _buf.strip():
    _stmts.append(_buf.strip())
try:
    for _i, _stmt in enumerate(_stmts):
        _cur = _con.execute(_stmt)
        _out["statements"] = _i + 1
        if _cur.description is not None:
            _out["columns"] = [d[0] for d in _cur.description]
            _out["rows"] = [list(r) for r in _cur.fetchmany(200)]
            _out["lastQuery"] = _stmt
            try:
                _out["plan"] = [r[3] for r in _con.execute("EXPLAIN QUERY PLAN " + _stmt)]
            except Exception:
                _out["plan"] = []
    _con.commit()
except Exception as _e:
    _out["error"] = str(_e)
    _out["errorStatement"] = _out["statements"] + 1
for _name, _tbl, _sql in _con.execute("select name, tbl_name, sql from sqlite_master where type='index' and name not like 'sqlite_%'"):
    if _name not in _seed_indexes:
        _out["indexes"].append({"name": _name, "table": _tbl, "sql": _sql or ""})
_out["views"] = [r[0] for r in _con.execute("select name from sqlite_master where type='view'") if r[0] not in _seed_views]
for (_t,) in _con.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name"):
    _out["tables"].append({"name": _t, "rowCount": _con.execute(f'select count(*) from "{_t}"').fetchone()[0]})
print("@@OPSFORGE_SQL@@" + json.dumps(_out, default=str))
`;
}

/** Pulls the JSON document out of the program's stdout. */
export function parseResult(stdout: string): SqlRunResult | null {
  const line = stdout.split("\n").find((l) => l.startsWith("@@OPSFORGE_SQL@@"));
  if (!line) return null;
  try {
    return JSON.parse(line.slice("@@OPSFORGE_SQL@@".length)) as SqlRunResult;
  } catch {
    return null;
  }
}

/** Rows compared without regard to order, as JSON strings. */
export function sameRowsUnordered(a: SqlRunResult["rows"], b: SqlRunResult["rows"]): boolean {
  if (a.length !== b.length) return false;
  const key = (r: SqlRunResult["rows"][number]) => JSON.stringify(r.map((v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)));
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}

export function sameRowsOrdered(a: SqlRunResult["rows"], b: SqlRunResult["rows"]): boolean {
  if (a.length !== b.length) return false;
  const key = (r: SqlRunResult["rows"][number]) => JSON.stringify(r.map((v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)));
  return a.every((r, i) => key(r) === key(b[i]));
}

export function planUsesIndex(plan: string[], table?: string): boolean {
  return plan.some((p) => /USING (COVERING )?INDEX/i.test(p) && (!table || new RegExp(`\\b${table}\\b`, "i").test(p)));
}

export function planScans(plan: string[], table: string): boolean {
  return plan.some((p) => new RegExp(`^SCAN ${table}\\b`, "i").test(p));
}
