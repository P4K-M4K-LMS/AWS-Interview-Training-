/**
 * Hands-on engines the Study catalog would need and OpsForge does not have
 * yet. Honest one-liners in vendor-neutral words; the counts come from the
 * modality analysis in docs/SESSION_LOG_2026-10-09.md. "status" moves to
 * "built" when a lab tab exists and links.ts points at it.
 */
export interface StudyEngine {
  id: string;
  name: string;
  what: string;
  status: "planned" | "built";
  lab?: string; // route once built, e.g. "/labs/policy"
  approxObjectives: number;
}

export const ENGINES: StudyEngine[] = [
  { id: "policy-eval", name: "Authorization policy evaluator", what: "Write allow/deny statements for a fictional platform and watch the decision trace: default deny, explicit deny wins, ceilings, resource-based versus identity-based.", status: "built", lab: "/labs/policy", approxObjectives: 45 },
  { id: "net-trace", name: "Virtual network path tracer", what: "Send a packet through subnets, route tables, stateful and stateless filters, address translation and a hub router; the trace names the hop that dropped it.", status: "built", lab: "/labs/network", approxObjectives: 50 },
  { id: "dr-planner", name: "Disaster-recovery planner", what: "Given a recovery time and data-loss budget, pick backup, standby and failover pieces and see the recovery timeline and cost in fictional credits.", status: "built", lab: "/labs/dr", approxObjectives: 45 },
  { id: "alarm-builder", name: "Metric alarm builder", what: "Define thresholds and evaluation windows on the simulated platform's metrics and see which incidents they would have caught.", status: "built", lab: "/labs/alarms", approxObjectives: 55 },
  { id: "cost-model", name: "Cost model in fictional credits", what: "Size a design and watch the monthly bill move; purchasing options and right-sizing without any real price list.", status: "built", lab: "/labs/cost", approxObjectives: 50 },
  { id: "deploy-shift", name: "Deployment strategies", what: "All-at-once, rolling, canary and second-fleet releases on the simulated platform, with an alarm guard and automatic rollback, second by second.", status: "built", lab: "/labs/deploy", approxObjectives: 45 },
  { id: "messaging", name: "Messaging and events", what: "Direct calls, a job queue (redelivery, receive limit, dead-letter, ordered mode), a pub/sub topic with filters and buffered subscriptions, a partitioned stream; what each costs in loss, duplicates, order and wait, second by second.", status: "built", lab: "/labs/messaging", approxObjectives: 40 },
  { id: "workflow", name: "Workflow state machine", what: "A workflow runner with retries, timeouts and compensation on the shared engine.", status: "planned", approxObjectives: 12 },
  { id: "envelope-crypto", name: "Envelope encryption lab", what: "A simulated key service: data keys in two forms, sealing locally or in the service, key policies and cross-account grants, rotation with versions; every step traced.", status: "built", lab: "/labs/crypto", approxObjectives: 40 },
  { id: "autoscale", name: "Autoscaling policies", what: "Target-tracking and step policies on a fleet behind a load balancer: warm-up, cooldowns, scheduled minimums, the metric that measures the load, health-check detection and churn; what each costs, second by second.", status: "built", lab: "/labs/autoscale", approxObjectives: 30 },
  { id: "sql-lab", name: "SQL lab", what: "Real SQL on an in-memory SQLite inside the Python runtime: joins and aggregates, indexes and the plans that use or miss them, normalisation, transactions, views.", status: "built", lab: "/labs/sql", approxObjectives: 20 },
  { id: "python-drills", name: "Python drills", what: "One idea per drill on the real interpreter: arguments, closures, recursion, mutable defaults, slices, sets, comprehensions, classes, inheritance, generators, decorators, type hints, files and the standard library.", status: "built", lab: "/labs/python-drills", approxObjectives: 30 },
  { id: "js-runtime", name: "JavaScript lab", what: "The browser's own JavaScript engine in a Web Worker with a time limit: script and real ES-module drills, captured console output, the event loop's real order, and fetch against a simulated API. DOM drills on a page inside the worker, a Jest-style test API for writing your own tests, and request handlers with a simulated environment and async datastore.", status: "built", lab: "/labs/javascript", approxObjectives: 45 },
];

export const ENGINE_BY_ID = new Map(ENGINES.map((e) => [e.id, e]));
