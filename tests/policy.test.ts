import { beforeEach, describe, expect, it } from "vitest";
import { db, resetAll } from "../src/data/db";
import { POLICY_EXERCISES } from "../src/content/study/policyExercises";
import { LAB_LINKS } from "../src/content/study/missionLinks";
import { compilePolicies, evaluate, globMatch, parsePolicy, type AccessRequest, type Policy } from "../src/engine/policy/evaluate";
import { creditLabExercise } from "../src/engine/study/bridge";

const req = (over: { principal?: AccessRequest["principal"]; action: string; resource?: string | AccessRequest["resource"]; context?: AccessRequest["context"] }): AccessRequest => ({
  principal: over.principal ?? { id: "ana", account: "ops", tags: {} },
  action: over.action,
  resource: typeof over.resource === "string" ? { id: over.resource, account: "ops", tags: {} } : (over.resource ?? { id: "store/orders/1", account: "ops", tags: {} }),
  context: over.context ?? {},
});
const pol = (id: string, kind: Policy["kind"], text: string): Policy => ({ id, name: id, kind, statements: parsePolicy(text).statements });

describe("policy grammar", () => {
  it("parses statements with actions, resources, principals and conditions, and reports bad lines by number", () => {
    const { statements, errors } = parsePolicy("# comment\nallow store:Read, store:List on store/orders/* when principal.tag.team = dispatch and request.mfa = true\ndeny * on store/payroll/*\nallow queue:Send on queue/jobs for partner-*\nnonsense here\nallow x on y when team");
    expect(errors).toEqual([
      { line: 5, message: expect.stringMatching(/expected/) },
      { line: 6, message: expect.stringMatching(/cannot read condition/) },
    ]);
    expect(statements).toHaveLength(4);
    expect(statements[0]).toMatchObject({ effect: "allow", actions: ["store:Read", "store:List"], resources: ["store/orders/*"], line: 2 });
    expect(statements[0].conditions).toEqual([
      { key: "principal.tag.team", op: "=", value: "dispatch" },
      { key: "request.mfa", op: "=", value: "true" },
    ]);
    expect(statements[2].principals).toEqual(["partner-*"]);
    expect(globMatch("store:*", "store:Read")).toBe(true);
    expect(globMatch("store/orders/*", "store/invoices/1")).toBe(false);
    expect(globMatch("*", "anything")).toBe(true);
  });
});

describe("policy decisions", () => {
  it("denies by default and names the rule", () => {
    const d = evaluate([pol("id", "identity", "allow store:Read on store/orders/*")], req({ action: "store:Write" }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toMatch(/Default deny/);
    expect(d.trace).toHaveLength(1);
    expect(d.trace[0].matched).toBe(false);
  });

  it("allows on a matching identity statement and points at the line", () => {
    const d = evaluate([pol("id", "identity", "deny * on store/payroll/*\nallow store:Read on store/orders/*")], req({ action: "store:Read" }));
    expect(d.decision).toBe("allow");
    expect(d.decidedBy).toEqual({ policyId: "id", line: 2 });
  });

  it("explicit deny wins over any allow, from any policy kind", () => {
    const policies = [pol("id", "identity", "allow * on *"), pol("res", "resource", "deny store:Read on store/orders/*")];
    const d = evaluate(policies, req({ action: "store:Read" }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toMatch(/Explicit deny/);
    expect(d.decidedBy).toEqual({ policyId: "res", line: 1 });
  });

  it("a boundary is a ceiling: it blocks what it omits and grants nothing by itself", () => {
    const identity = pol("id", "identity", "allow queue:Send on queue/jobs");
    const boundary = pol("b", "boundary", "allow store:* on store/*");
    expect(evaluate([identity, boundary], req({ action: "queue:Send", resource: "queue/jobs" })).reason).toMatch(/boundary is a ceiling/);
    expect(evaluate([identity, boundary], req({ action: "store:Read" })).decision).toBe("deny");
    expect(evaluate([identity, pol("b", "boundary", "allow queue:Send on queue/jobs")], req({ action: "queue:Send", resource: "queue/jobs" })).decision).toBe("allow");
  });

  it("an organisation guardrail deny cannot be undone", () => {
    const policies = [pol("g", "guardrail", "allow * on *\ndeny keys:Delete on *"), pol("id", "identity", "allow keys:* on keys/*")];
    expect(evaluate(policies, req({ action: "keys:Delete", resource: "keys/k" })).decision).toBe("deny");
    expect(evaluate(policies, req({ action: "keys:Rotate", resource: "keys/k" })).decision).toBe("allow");
  });

  it("across accounts both sides must allow; within an account either side is enough", () => {
    const resource = pol("res", "resource", "allow store:Read on store/exports/* for partner-*");
    const partner = { id: "partner-acme", account: "partner", tags: {} };
    const exportFile = { id: "store/exports/a", account: "ops", tags: {} };
    expect(evaluate([resource], req({ principal: partner, action: "store:Read", resource: exportFile })).reason).toMatch(/resource policy allows, but the principal/);
    expect(evaluate([resource, pol("id", "identity", "allow store:Read on store/exports/*")], req({ principal: partner, action: "store:Read", resource: exportFile })).decision).toBe("allow");
    expect(evaluate([pol("id", "identity", "allow store:Read on store/exports/*")], req({ principal: partner, action: "store:Read", resource: exportFile })).reason).toMatch(/no resource policy/);
    // Same account: the resource policy alone is enough.
    expect(evaluate([resource], req({ principal: { id: "partner-local", account: "ops", tags: {} }, action: "store:Read", resource: exportFile })).decision).toBe("allow");
  });

  it("tag conditions compare both sides and fail closed on missing tags", () => {
    const p = pol("id", "identity", "allow fleet:Dispatch on fleet/* when principal.tag.region = ${resource.tag.region}");
    const north = { id: "d1", account: "ops", tags: { region: "north" } };
    expect(evaluate([p], req({ principal: north, action: "fleet:Dispatch", resource: { id: "fleet/v1", account: "ops", tags: { region: "north" } } })).decision).toBe("allow");
    expect(evaluate([p], req({ principal: north, action: "fleet:Dispatch", resource: { id: "fleet/v2", account: "ops", tags: { region: "south" } } })).decision).toBe("deny");
    const d = evaluate([p], req({ principal: north, action: "fleet:Dispatch", resource: { id: "fleet/v3", account: "ops", tags: {} } }));
    expect(d.decision).toBe("deny");
    expect(d.trace[0].why).toMatch(/condition fails/);
    const mfa = pol("id", "identity", "allow keys:Rotate on keys/* when request.mfa = true");
    expect(evaluate([mfa], req({ action: "keys:Rotate", resource: "keys/k", context: { mfa: false } })).decision).toBe("deny");
    expect(evaluate([mfa], req({ action: "keys:Rotate", resource: "keys/k", context: { mfa: true } })).decision).toBe("allow");
    const list = pol("id", "identity", "allow store:Read on store/* when request.network in office,vpn");
    expect(evaluate([list], req({ action: "store:Read", context: { network: "vpn" } })).decision).toBe("allow");
    expect(evaluate([list], req({ action: "store:Read", context: { network: "cafe" } })).decision).toBe("deny");
  });

  it("the trace lists every statement in policy order with its match reason", () => {
    const d = evaluate([pol("a", "identity", "allow store:Read on store/*\ndeny store:Read on store/payroll/*"), pol("b", "boundary", "allow * on *")], req({ action: "store:Read", resource: "store/payroll/x" }));
    expect(d.trace.map((t) => `${t.policyId}:${t.line}:${t.matched ? "m" : "-"}`)).toEqual(["a:1:m", "a:2:m", "b:1:m"]);
    expect(d.decision).toBe("deny");
  });
});

describe("policy lab exercises", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("every exercise starts failing and its reference solution passes, with no parse errors", () => {
    for (const ex of POLICY_EXERCISES) {
      const start = compilePolicies(ex.policies);
      expect(Object.keys(start.errors), `${ex.id} start parses`).toEqual([]);
      const startRight = ex.requests.every((r) => evaluate(start.policies, r.request).decision === r.expect);
      expect(startRight, `${ex.id} must not pass as given`).toBe(false);
      const solved = compilePolicies(ex.policies.map((p) => (p.id === ex.editable ? { ...p, text: ex.solution } : p)));
      expect(Object.keys(solved.errors), `${ex.id} solution parses`).toEqual([]);
      for (const r of ex.requests) expect(evaluate(solved.policies, r.request).decision, `${ex.id}/${r.id}`).toBe(r.expect);
      expect(ex.hints.length).toBeGreaterThanOrEqual(2);
      expect(ex.policies.some((p) => p.id === ex.editable)).toBe(true);
    }
  });

  it("every exercise credits at least one Study objective, and passing records a lab attempt at Guided", async () => {
    for (const ex of POLICY_EXERCISES) expect(LAB_LINKS[ex.id]?.length ?? 0, ex.id).toBeGreaterThan(0);
    const credited = await creditLabExercise("policy-06-tags", "2026-10-09T10:00:00.000Z");
    expect(credited.map((c) => c.objectiveId)).toEqual(LAB_LINKS["policy-06-tags"]);
    for (const c of credited) {
      expect(c.status).toBe("guided");
      expect(c.attempts[0]).toMatchObject({ format: "lab", verdict: "correct", source: "mission", ref: "policy-06-tags" });
    }
    expect(await db.studyObjectives.count()).toBe(LAB_LINKS["policy-06-tags"].length);
  });

  it("no exercise text uses a vendor's policy syntax", () => {
    const text = JSON.stringify(POLICY_EXERCISES);
    for (const word of ["Effect", "Principal", "Resource\":", "arn:", "iam:", "Statement", "sts:"]) expect(text, word).not.toContain(word);
  });
});
