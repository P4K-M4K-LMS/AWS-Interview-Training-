import type { AccessRequest, PolicyKind } from "../../engine/policy/evaluate";

/**
 * Authorization policy lab exercises. Each gives a few policies on a
 * fictional platform, lets the learner edit one of them, and lists the
 * requests that must come out a certain way. Passing credits the Study
 * objectives listed (format "lab"). `solution` is the reference used by the
 * tests to prove each exercise is solvable; it is never shown to the learner.
 */
export interface PolicyDef {
  id: string;
  name: string;
  kind: PolicyKind;
  text: string;
}

export interface PolicyExercise {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  policies: PolicyDef[];
  editable: string; // policy id
  requests: Array<{ id: string; label: string; request: AccessRequest; expect: "allow" | "deny" }>;
  hints: string[];
  solution: string;
}

const p = (id: string, account = "ops", tags: Record<string, string> = {}) => ({ id, account, tags });
const r = (id: string, account = "ops", tags: Record<string, string> = {}) => ({ id, account, tags });

export const POLICY_EXERCISES: PolicyExercise[] = [
  {
    id: "policy-01-default-deny",
    title: "Nothing is allowed until something allows it",
    brief: "The dispatch team's identity policy lets them read orders. They now also need to update orders, and nothing else. Edit the identity policy so updating orders works while writing invoices stays denied.",
    teaches: "Default deny: a request with no matching allow statement is refused, and the fix is the narrowest allow that covers the need.",
    policies: [{ id: "dispatch", name: "Dispatch team (identity policy)", kind: "identity", text: "allow store:Read, store:List on store/orders/*" }],
    editable: "dispatch",
    requests: [
      { id: "read", label: "Read an order", request: { principal: p("dispatcher-ana"), action: "store:Read", resource: r("store/orders/1042"), context: {} }, expect: "allow" },
      { id: "write-order", label: "Update an order", request: { principal: p("dispatcher-ana"), action: "store:Write", resource: r("store/orders/1042"), context: {} }, expect: "allow" },
      { id: "write-invoice", label: "Write an invoice", request: { principal: p("dispatcher-ana"), action: "store:Write", resource: r("store/invoices/77"), context: {} }, expect: "deny" },
    ],
    hints: ["Each line is one statement: allow <actions> on <resources>.", "Add a second line for store:Write, scoped to store/orders/* only.", "allow store:Write on store/orders/*"],
    solution: "allow store:Read, store:List on store/orders/*\nallow store:Write on store/orders/*",
  },
  {
    id: "policy-02-deny-wins",
    title: "An explicit deny beats every allow",
    brief: "Finance has a broad allow and a deny on everything under payroll. They now need to read the payroll summary, but raw payroll files must stay denied. You cannot override a deny with an allow; change the deny instead.",
    teaches: "Explicit deny wins: when any matching statement denies, the request is denied no matter how many allows match. To open a path, narrow the deny.",
    policies: [{ id: "finance", name: "Finance team (identity policy)", kind: "identity", text: "allow store:* on store/*\ndeny * on store/payroll/*" }],
    editable: "finance",
    requests: [
      { id: "summary", label: "Read payroll summary", request: { principal: p("finance-raj"), action: "store:Read", resource: r("store/payroll/summary"), context: {} }, expect: "allow" },
      { id: "raw", label: "Read a raw payroll file", request: { principal: p("finance-raj"), action: "store:Read", resource: r("store/payroll/raw/2026-10"), context: {} }, expect: "deny" },
      { id: "invoices", label: "Read invoices", request: { principal: p("finance-raj"), action: "store:Read", resource: r("store/invoices/77"), context: {} }, expect: "allow" },
    ],
    hints: ["Adding 'allow store:Read on store/payroll/summary' changes nothing: the deny still matches.", "Make the deny match only the raw files.", "deny * on store/payroll/raw/*"],
    solution: "allow store:* on store/*\ndeny * on store/payroll/raw/*",
  },
  {
    id: "policy-03-boundary",
    title: "A boundary is a ceiling, not a grant",
    brief: "A contractor's identity policy allows queue:Send, yet sending fails: the permissions boundary attached to the contractor only lists the store. Edit the boundary so queue:Send on the jobs queue is possible, without letting the boundary itself grant anything the identity policy does not.",
    teaches: "A boundary sets the maximum a principal can ever have. The effective permissions are the overlap of the identity policy and the boundary; the boundary alone grants nothing.",
    policies: [
      { id: "contractor", name: "Contractor (identity policy)", kind: "identity", text: "allow store:Read on store/orders/*\nallow queue:Send on queue/jobs" },
      { id: "boundary", name: "Contractor boundary", kind: "boundary", text: "allow store:Read, store:List on store/*" },
    ],
    editable: "boundary",
    requests: [
      { id: "send", label: "Send a job", request: { principal: p("contractor-li"), action: "queue:Send", resource: r("queue/jobs"), context: {} }, expect: "allow" },
      { id: "read", label: "Read an order", request: { principal: p("contractor-li"), action: "store:Read", resource: r("store/orders/9"), context: {} }, expect: "allow" },
      { id: "list", label: "List the store (boundary allows, identity does not)", request: { principal: p("contractor-li"), action: "store:List", resource: r("store/orders"), context: {} }, expect: "deny" },
    ],
    hints: ["The identity policy already allows queue:Send; the boundary does not, so the ceiling blocks it.", "Add queue:Send on queue/jobs to the boundary.", "The third request shows the boundary cannot grant on its own: store:List is in the boundary but not in the identity policy, so it stays denied."],
    solution: "allow store:Read, store:List on store/*\nallow queue:Send on queue/jobs",
  },
  {
    id: "policy-04-guardrail",
    title: "An organisation guardrail nobody can argue with",
    brief: "The organisation guardrail denies deleting keys everywhere. The key administrators need to rotate keys. Edit their identity policy so rotation works; deleting must stay denied, and you cannot edit the guardrail.",
    teaches: "An organisation guardrail applies to every principal in the account, including administrators, and a deny in it cannot be undone by any identity or resource policy.",
    policies: [
      { id: "guardrail", name: "Organisation guardrail", kind: "guardrail", text: "allow * on *\ndeny keys:Delete on *" },
      { id: "keyadmins", name: "Key administrators (identity policy)", kind: "identity", text: "allow keys:Read on keys/*" },
    ],
    editable: "keyadmins",
    requests: [
      { id: "rotate", label: "Rotate a key", request: { principal: p("keyadmin-mo"), action: "keys:Rotate", resource: r("keys/orders-db"), context: {} }, expect: "allow" },
      { id: "delete", label: "Delete a key", request: { principal: p("keyadmin-mo"), action: "keys:Delete", resource: r("keys/orders-db"), context: {} }, expect: "deny" },
      { id: "read", label: "Read key metadata", request: { principal: p("keyadmin-mo"), action: "keys:Read", resource: r("keys/orders-db"), context: {} }, expect: "allow" },
    ],
    hints: ["Only the identity policy is editable; add the rotation permission there.", "allow keys:Rotate on keys/*", "If you write 'allow keys:*', the trace shows the guardrail's deny still wins for Delete; that is the point of a guardrail."],
    solution: "allow keys:Read on keys/*\nallow keys:Rotate on keys/*",
  },
  {
    id: "policy-05-cross-account",
    title: "Across accounts, both sides must say yes",
    brief: "A partner from another account must read the shared exports. The resource policy on the exports already names the partner, but the request is denied. Edit the partner's identity policy (in the partner's account) so the read works, and nothing else.",
    teaches: "A principal from another account needs an allow in its own policies and an allow in the resource policy. Within one account, either side is enough.",
    policies: [
      { id: "exports", name: "Exports bucket (resource policy)", kind: "resource", text: "allow store:Read on store/exports/* for partner-*" },
      { id: "partner", name: "Partner reader (identity policy, partner account)", kind: "identity", text: "# nothing yet" },
    ],
    editable: "partner",
    requests: [
      { id: "read", label: "Partner reads an export", request: { principal: p("partner-acme", "partner"), action: "store:Read", resource: r("store/exports/2026-10.csv"), context: {} }, expect: "allow" },
      { id: "write", label: "Partner writes an export", request: { principal: p("partner-acme", "partner"), action: "store:Write", resource: r("store/exports/2026-10.csv"), context: {} }, expect: "deny" },
      { id: "orders", label: "Partner reads an order (no resource policy)", request: { principal: p("partner-acme", "partner"), action: "store:Read", resource: r("store/orders/1"), context: {} }, expect: "deny" },
    ],
    hints: ["The resource policy already allows the partner; the partner's own side allows nothing.", "allow store:Read on store/exports/*", "Try 'allow store:Read on store/*' and watch the orders request stay denied: no resource policy on orders names the partner."],
    solution: "allow store:Read on store/exports/*",
  },
  {
    id: "policy-06-tags",
    title: "Attribute-based access: let the tags decide",
    brief: "Dispatchers may only dispatch vehicles in their own region. Instead of one statement per region, write one statement whose condition compares the principal's region tag with the vehicle's region tag.",
    teaches: "Attribute-based access control: a condition on tags scales to new regions without new statements, and a reference like ${resource.tag.region} compares the two sides.",
    policies: [{ id: "dispatchers", name: "Dispatchers (identity policy)", kind: "identity", text: "allow fleet:Dispatch on fleet/*" }],
    editable: "dispatchers",
    requests: [
      { id: "own", label: "North dispatcher, north vehicle", request: { principal: p("dispatcher-north-1", "ops", { region: "north" }), action: "fleet:Dispatch", resource: r("fleet/van-12", "ops", { region: "north" }), context: {} }, expect: "allow" },
      { id: "other", label: "North dispatcher, south vehicle", request: { principal: p("dispatcher-north-1", "ops", { region: "north" }), action: "fleet:Dispatch", resource: r("fleet/van-40", "ops", { region: "south" }), context: {} }, expect: "deny" },
      { id: "untagged", label: "Untagged vehicle", request: { principal: p("dispatcher-north-1", "ops", { region: "north" }), action: "fleet:Dispatch", resource: r("fleet/van-99"), context: {} }, expect: "deny" },
    ],
    hints: ["Conditions go after 'when'.", "Compare principal.tag.region with the resource's tag: when principal.tag.region = ${resource.tag.region}", "An untagged vehicle has no region, so the comparison fails and the request is denied, which is what you want."],
    solution: "allow fleet:Dispatch on fleet/* when principal.tag.region = ${resource.tag.region}",
  },
];

export const POLICY_EXERCISE_BY_ID = new Map(POLICY_EXERCISES.map((e) => [e.id, e]));
