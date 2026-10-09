/**
 * Authorization policy evaluator for a fictional platform. Vendor-neutral by
 * design: the grammar is OpsForge's own, but the decision rules are the ones
 * every cloud policy system shares and the exam objectives ask about:
 * default deny, explicit deny wins, a boundary or organisation guardrail
 * is a ceiling that cannot grant on its own, and a principal from another
 * account needs both sides to allow. Every decision comes with a trace
 * naming the statement that decided it.
 */
export type Effect = "allow" | "deny";
export type PolicyKind = "identity" | "resource" | "boundary" | "guardrail";

export interface Condition {
  key: string; // principal.tag.<k>, resource.tag.<k>, principal.id, request.mfa, request.network
  op: "=" | "!=" | "in" | "exists";
  /** Literal, list for "in", or a reference like ${resource.tag.team}. */
  value?: string | string[];
}

export interface Statement {
  effect: Effect;
  actions: string[]; // globs: "store:Read", "store:*", "*"
  resources: string[]; // globs: "store/orders/*", "*"
  conditions: Condition[];
  /** Only for resource policies: which principals the statement is about (globs). Empty = any. */
  principals: string[];
  line: number;
}

export interface Policy {
  id: string;
  name: string;
  kind: PolicyKind;
  statements: Statement[];
}

export interface AccessRequest {
  principal: { id: string; account: string; tags: Record<string, string> };
  action: string;
  resource: { id: string; account: string; tags: Record<string, string> };
  context: { mfa?: boolean; network?: string };
}

export interface TraceStep {
  policyId: string;
  policyName: string;
  kind: PolicyKind;
  line: number;
  effect: Effect;
  matched: boolean;
  why: string;
}

export interface Decision {
  decision: Effect;
  /** The rule that settled it, in plain words. */
  reason: string;
  /** The statement that decided, when one did. */
  decidedBy?: { policyId: string; line: number };
  trace: TraceStep[];
}

/* ---------------- grammar ---------------- */

export interface ParseError {
  line: number;
  message: string;
}

/**
 * One statement per line:
 *   allow store:Read, store:List on store/orders/* when principal.tag.team = dispatch and request.mfa = true
 *   deny * on store/payroll/*
 *   allow queue:Send on queue/jobs for principal partner-*      (resource policies name principals with "for")
 * Blank lines and lines starting with # are ignored.
 */
export function parsePolicy(text: string): { statements: Statement[]; errors: ParseError[] } {
  const statements: Statement[] = [];
  const errors: ParseError[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith("#")) return;
    const m = /^(allow|deny)\s+(.+?)\s+on\s+(.+?)(?:\s+for\s+(.+?))?(?:\s+when\s+(.+))?$/i.exec(s);
    if (!m) {
      errors.push({ line, message: 'expected "allow|deny <actions> on <resources> [for <principals>] [when <conditions>]"' });
      return;
    }
    const [, effect, actions, resources, principals, when] = m;
    const conditions: Condition[] = [];
    if (when) {
      for (const part of when.split(/\s+and\s+/i)) {
        const c = /^([a-z.]+(?:\.[a-z0-9_-]+)*)\s*(=|!=|in|exists)\s*(.*)$/i.exec(part.trim());
        if (!c) {
          errors.push({ line, message: `cannot read condition "${part.trim()}"; use key = value, key != value, key in a,b or key exists` });
          continue;
        }
        const [, key, op, rest] = c;
        const value = rest.trim();
        if (op.toLowerCase() === "exists") conditions.push({ key, op: "exists" });
        else if (op.toLowerCase() === "in") conditions.push({ key, op: "in", value: value.split(",").map((v) => v.trim()).filter(Boolean) });
        else {
          if (!value) {
            errors.push({ line, message: `condition "${key} ${op}" needs a value` });
            continue;
          }
          conditions.push({ key, op: op as "=" | "!=", value });
        }
      }
    }
    statements.push({
      effect: effect.toLowerCase() as Effect,
      actions: actions.split(",").map((a) => a.trim()).filter(Boolean),
      resources: resources.split(",").map((r) => r.trim()).filter(Boolean),
      principals: principals ? principals.split(",").map((p) => p.trim()).filter(Boolean) : [],
      conditions,
      line,
    });
  });
  return { statements, errors };
}

/* ---------------- matching ---------------- */

export function globMatch(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  const re = new RegExp(`^${pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "i");
  return re.test(value);
}

function lookup(key: string, req: AccessRequest): string | undefined {
  const k = key.toLowerCase();
  if (k === "principal.id") return req.principal.id;
  if (k === "principal.account") return req.principal.account;
  if (k === "resource.id") return req.resource.id;
  if (k === "resource.account") return req.resource.account;
  if (k === "request.mfa") return req.context.mfa ? "true" : "false";
  if (k === "request.network") return req.context.network;
  if (k.startsWith("principal.tag.")) return req.principal.tags[key.slice("principal.tag.".length)];
  if (k.startsWith("resource.tag.")) return req.resource.tags[key.slice("resource.tag.".length)];
  return undefined;
}

function resolveValue(v: string, req: AccessRequest): string | undefined {
  const ref = /^\$\{(.+)\}$/.exec(v.trim());
  return ref ? lookup(ref[1], req) : v;
}

export function conditionHolds(c: Condition, req: AccessRequest): { holds: boolean; why: string } {
  const actual = lookup(c.key, req);
  if (c.op === "exists") return { holds: actual !== undefined, why: `${c.key} ${actual !== undefined ? "is set" : "is not set"}` };
  if (c.op === "in") {
    const list = (c.value as string[]).map((v) => resolveValue(v, req));
    const holds = actual !== undefined && list.includes(actual);
    return { holds, why: `${c.key} is ${actual ?? "unset"}, ${holds ? "which is in" : "not in"} [${(c.value as string[]).join(", ")}]` };
  }
  const expected = resolveValue(c.value as string, req);
  const eq = actual !== undefined && expected !== undefined && actual.toLowerCase() === expected.toLowerCase();
  const holds = c.op === "=" ? eq : !eq;
  return { holds, why: `${c.key} is ${actual ?? "unset"}, ${c.op === "=" ? "needs" : "must not be"} ${expected ?? "unset"}${c.value !== expected ? ` (${c.value})` : ""}` };
}

function statementMatches(st: Statement, req: AccessRequest): { matched: boolean; why: string } {
  if (!st.actions.some((a) => globMatch(a, req.action))) return { matched: false, why: `action ${req.action} is not in [${st.actions.join(", ")}]` };
  if (!st.resources.some((r) => globMatch(r, req.resource.id))) return { matched: false, why: `resource ${req.resource.id} is not in [${st.resources.join(", ")}]` };
  if (st.principals.length && !st.principals.some((p) => globMatch(p, req.principal.id))) return { matched: false, why: `principal ${req.principal.id} is not in [${st.principals.join(", ")}]` };
  for (const c of st.conditions) {
    const r = conditionHolds(c, req);
    if (!r.holds) return { matched: false, why: `condition fails: ${r.why}` };
  }
  return { matched: true, why: st.conditions.length ? `action, resource and every condition match` : `action and resource match` };
}

/* ---------------- decision ---------------- */

export function evaluate(policies: Policy[], req: AccessRequest): Decision {
  const trace: TraceStep[] = [];
  const hits: Array<{ policy: Policy; st: Statement }> = [];
  for (const policy of policies) {
    for (const st of policy.statements) {
      const m = statementMatches(st, req);
      trace.push({ policyId: policy.id, policyName: policy.name, kind: policy.kind, line: st.line, effect: st.effect, matched: m.matched, why: m.why });
      if (m.matched) hits.push({ policy, st });
    }
  }
  const deny = hits.find((h) => h.st.effect === "deny");
  if (deny) return { decision: "deny", reason: `Explicit deny in ${deny.policy.name} (line ${deny.st.line}) wins over every allow.`, decidedBy: { policyId: deny.policy.id, line: deny.st.line }, trace };

  const allowsOf = (kind: PolicyKind) => hits.filter((h) => h.policy.kind === kind && h.st.effect === "allow");
  const hasKind = (kind: PolicyKind) => policies.some((p) => p.kind === kind);
  for (const kind of ["guardrail", "boundary"] as const) {
    if (hasKind(kind) && allowsOf(kind).length === 0) {
      const name = kind === "guardrail" ? "organisation guardrail" : "permissions boundary";
      return { decision: "deny", reason: `The ${name} is a ceiling: nothing in it allows ${req.action} on ${req.resource.id}, so no identity or resource policy can grant it.`, trace };
    }
  }
  const identityAllow = allowsOf("identity")[0];
  const resourceAllow = allowsOf("resource")[0];
  const crossAccount = req.principal.account !== req.resource.account;
  if (crossAccount) {
    if (identityAllow && resourceAllow) return { decision: "allow", reason: `Principal from another account: its own policy allows (${identityAllow.policy.name}, line ${identityAllow.st.line}) and the resource policy allows (${resourceAllow.policy.name}, line ${resourceAllow.st.line}).`, decidedBy: { policyId: resourceAllow.policy.id, line: resourceAllow.st.line }, trace };
    if (identityAllow) return { decision: "deny", reason: `Principal from another account: its own policy allows, but no resource policy on ${req.resource.id} allows ${req.principal.id}. Both sides must allow across accounts.`, trace };
    if (resourceAllow) return { decision: "deny", reason: `Principal from another account: the resource policy allows, but the principal's own policies do not. Both sides must allow across accounts.`, trace };
    return { decision: "deny", reason: "Default deny: no statement allows this request.", trace };
  }
  const allow = identityAllow ?? resourceAllow;
  if (allow) return { decision: "allow", reason: `Allowed by ${allow.policy.name} (line ${allow.st.line}); no deny matched${hasKind("boundary") || hasKind("guardrail") ? " and the ceiling allows it" : ""}.`, decidedBy: { policyId: allow.policy.id, line: allow.st.line }, trace };
  return { decision: "deny", reason: "Default deny: no statement allows this request.", trace };
}

/** Builds policies from editable text, keeping kind and name. */
export function compilePolicies(defs: Array<{ id: string; name: string; kind: PolicyKind; text: string }>): { policies: Policy[]; errors: Record<string, ParseError[]> } {
  const policies: Policy[] = [];
  const errors: Record<string, ParseError[]> = {};
  for (const d of defs) {
    const { statements, errors: errs } = parsePolicy(d.text);
    if (errs.length) errors[d.id] = errs;
    policies.push({ id: d.id, name: d.name, kind: d.kind, statements });
  }
  return { policies, errors };
}
