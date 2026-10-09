import type { StudyModality } from "../../domain/types.ts";

/**
 * Curated links between Ascendra objectives and the OpsForge work that already
 * teaches them. Entries match an objective by course code and a fragment of
 * its text (case-insensitive); the catalog build fails if a fragment matches
 * no objective or more than one, so a catalog refresh cannot silently drop a
 * link. Only this table decides a "do-existing" label; everything else is
 * "read" until the generation script suggests otherwise and the owner
 * promotes the suggestion here.
 *
 * `coverage` is honest about how much of the objective the mission covers.
 * This file has no runtime imports so the catalog build script (Node) can
 * load it as well as the app.
 */
export interface StudyMissionLink {
  course: string; // Ascendra track code, e.g. "AWSSAA"
  text: string; // fragment of the objective text, matched case-insensitively
  mission: string; // OpsForge mission id
  coverage: "full" | "partial";
  note?: string;
}

/** Objectives a lab exercise makes the learner do. Passing the exercise credits them (format "lab"). */
export interface StudyLabLink {
  course: string;
  text: string;
  lab: string; // lab id, e.g. "policy"
  exerciseId?: string;
  coverage: "full" | "partial";
  note?: string;
}

export interface StudyEngineGate {
  course: string;
  gateText: string; // fragment of the unit's gate sentence
  engine: string; // id in ENGINES (src/content/study/engines.ts)
}

export const STUDY_LINKS: StudyMissionLink[] = [
  // AWS
  { course: "AWSSAA", text: "Caching strategies, including edge caching", mission: "incident-01-cache-stampede", coverage: "partial", note: "cache stampede on the shared engine; no CDN" },
  { course: "AWSSAA", text: "Horizontal scaling versus vertical scaling", mission: "incident-02-traffic-surge", coverage: "full" },
  { course: "AWSSAA", text: "Decoupling with queues and pub/sub", mission: "incident-03-dead-consumers", coverage: "partial", note: "queues only" },
  { course: "AWSSAA", text: "Read replicas, and the specific problem they solve", mission: "incident-04-replica-lag", coverage: "full" },
  { course: "AWSSAA", text: "Designing out single points of failure", mission: "design-01-position-ingest", coverage: "full" },
  { course: "AWSSAA", text: "Service quotas and throttling", mission: "serverless-01-throttled-function", coverage: "full" },
  { course: "AWSDVA", text: "strongly consistent versus eventually consistent", mission: "design-02-command-ack", coverage: "full" },
  { course: "AWSDVA", text: "dead-letter queues", mission: "serverless-02-poison-messages", coverage: "full" },
  { course: "AWSDOP", text: "Building event processing workflows", mission: "serverless-03-duplicate-charges", coverage: "partial", note: "retries and duplicate side effects" },
  { course: "AWSDVA", text: "Writing code against messaging services", mission: "serverless-04-idempotent-handler", coverage: "full" },
  { course: "AWSDVA", text: "retry logic, circuit breakers", mission: "go-04-retries-idempotency", coverage: "partial", note: "retries with backoff and idempotency; timeouts in go-03" },
  { course: "AWSDVA", text: "Synchronous versus asynchronous patterns", mission: "go-02-worker-pool", coverage: "partial" },
  { course: "AWSDVA", text: "Concurrency, defined and then configured", mission: "go-05-data-race", coverage: "partial", note: "defined here; configured in serverless-01" },
  { course: "AWSDVA", text: "Query versus scan", mission: "bigo-03-structures", coverage: "partial", note: "hash lookup versus a full list walk" },
  { course: "AWSDEA", text: "Optimizing code to cut ingestion and transformation runtime", mission: "bigo-01-growth", coverage: "partial" },
  { course: "AWSDVA", text: "Serializing and deserializing data", mission: "python-04-fleet-report", coverage: "full" },
  { course: "AWSDVA", text: "Writing and running unit tests", mission: "python-03-config-validator", coverage: "full" },
  { course: "AWSDOP", text: "metrics from log events with metric filters", mission: "python-02-log-parser", coverage: "partial", note: "the concept, in Python; no metric-filter syntax" },
  { course: "AWSDVA", text: "Querying logs to find the relevant data", mission: "linux-02-log-detective", coverage: "full" },
  { course: "AWSDVA", text: "secret management services rather than secrets in code", mission: "devops-04-secret-wiring", coverage: "full" },
  { course: "AWSDVA", text: "Committing code to a repository to invoke build", mission: "devops-01-broken-pipeline", coverage: "full" },
  { course: "AWSDOP", text: "Running builds and tests on pull requests", mission: "devops-02-green-locally-red-in-ci", coverage: "full" },
  { course: "AWSDVA", text: "Rolling an application back", mission: "devops-03-bad-release-rollback", coverage: "full" },
  { course: "AWSSCS", text: "Containing and eradicating threats", mission: "netsec-02-suspicious-cron", coverage: "full" },
  { course: "AWSSCS", text: "Searching and correlating logs for security events", mission: "netsec-01-brute-force", coverage: "full" },
  // Linux
  { course: "LINUXPLUS", text: "systemd service management", mission: "linux-03-locked-out", coverage: "full" },
  { course: "LINUXPLUS", text: "File permissions and ownership", mission: "linux-03-locked-out", coverage: "partial", note: "no umask" },
  { course: "LINUXPLUS", text: "Diagnosing storage issues", mission: "linux-04-disk-full", coverage: "partial", note: "full disk only" },
  { course: "LINUXPLUS", text: "Diagnosing performance issues", mission: "linux-05-runaway-process", coverage: "full" },
  { course: "LINUXPLUS", text: "Reading and interpreting system logs", mission: "linux-02-log-detective", coverage: "full" },
  { course: "LINUXPLUS", text: "Basic regular expressions with grep", mission: "linux-02-log-detective", coverage: "partial", note: "no awk" },
  { course: "LINUXPLUS", text: "Shell automation scheduling", mission: "linux-05-runaway-process", coverage: "partial", note: "fixes one cron entry" },
  // Python
  { course: "PYTHON", text: "Variables, dynamic typing", mission: "python-01-uptime-report", coverage: "partial" },
  { course: "PYTHON", text: "Input/output with input() and print()", mission: "python-01-uptime-report", coverage: "partial" },
  { course: "PYTHON", text: "Loops: for, while, range()", mission: "python-02-log-parser", coverage: "partial" },
  { course: "PYTHON", text: "Dictionaries: keys, values, items", mission: "python-02-log-parser", coverage: "full" },
  { course: "PYTHON", text: "String methods: splitting, joining", mission: "python-02-log-parser", coverage: "full" },
  { course: "PYTHON", text: "Working with CSV and JSON data", mission: "python-04-fleet-report", coverage: "full" },
  { course: "PYTHON", text: "Exceptions: try/except/else/finally", mission: "python-03-config-validator", coverage: "full" },
  { course: "PYTHON", text: "Catching specific exception types", mission: "python-03-config-validator", coverage: "full" },
  // Algorithms
  { course: "MSCS", text: "Compare constant, logarithmic, linear", mission: "bigo-01-growth", coverage: "partial", note: "no factorial" },
  { course: "MSCS", text: "Analyze simple loop and recursive patterns", mission: "bigo-01-growth", coverage: "partial" },
  { course: "MSCS", text: "hash-table ops are average-case O(1)", mission: "bigo-03-structures", coverage: "full" },
  { course: "MSCS", text: "Compare insertion/merge/quick/heap sort", mission: "bigo-02-search-sort", coverage: "partial" },
  { course: "MSCS", text: "Compare access/search/insert/delete/space cost", mission: "bigo-03-structures", coverage: "partial", note: "search only" },
  { course: "CMPCBS", text: "Internal searching algorithms", mission: "bigo-02-search-sort", coverage: "full" },
  { course: "CMPCBS", text: "Hashing and tree-based searching", mission: "bigo-03-structures", coverage: "partial" },
  // Security
  { course: "SECPLUS", text: "Indicators of compromise and threat-hunting", mission: "netsec-02-suspicious-cron", coverage: "full" },
  { course: "CYSAPLUS", text: "Identity and access monitoring", mission: "netsec-01-brute-force", coverage: "partial" },
  { course: "SECPLUS", text: "Access control models", mission: "netsec-01-brute-force", coverage: "partial", note: "least privilege" },
  { course: "CYSAPLUS", text: "Incident response lifecycle", mission: "netsec-02-suspicious-cron", coverage: "partial" },
  { course: "PENTESTPLUS", text: "Persistence mechanisms", mission: "netsec-02-suspicious-cron", coverage: "partial", note: "the defender's view" },
  { course: "LINUXPLUS", text: "SSH hardening", mission: "netsec-02-suspicious-cron", coverage: "partial", note: "one quiz question" },
  { course: "CYSAPLUS", text: "Threat intelligence", mission: "netsec-02-suspicious-cron", coverage: "partial" },
  { course: "CMPCBS", text: "Defensive strategies and countermeasures", mission: "netsec-02-suspicious-cron", coverage: "partial" },
  // DevOps
  { course: "LINUXPLUS", text: "Version control basics with git", mission: "devops-01-broken-pipeline", coverage: "partial", note: "no git command in the terminal" },
  { course: "SECURITYX", text: "Secure software development lifecycle", mission: "devops-04-secret-wiring", coverage: "partial" },
  { course: "CYSAPLUS", text: "Root cause analysis and post-incident reporting", mission: "devops-03-bad-release-rollback", coverage: "partial" },
  { course: "SECPLUS", text: "Change management and configuration management", mission: "devops-03-bad-release-rollback", coverage: "partial" },
  // Distributed
  { course: "MSCS", text: "Race conditions", mission: "go-05-data-race", coverage: "full" },
  { course: "MSCS", text: "Locks and mutexes", mission: "go-05-data-race", coverage: "full" },
  { course: "MSCS", text: "Threads", mission: "go-02-worker-pool", coverage: "partial", note: "goroutines" },
  { course: "MSCS", text: "Deadlocks and the four necessary conditions", mission: "go-02-worker-pool", coverage: "partial", note: "the four conditions are not taught" },
  { course: "MSCS", text: "Replication and partitioning", mission: "incident-04-replica-lag", coverage: "partial", note: "replication only" },
  { course: "MSCS", text: "Consistency/latency tradeoffs", mission: "design-02-command-ack", coverage: "full" },
  { course: "SECPLUS", text: "High availability and resilience design", mission: "design-01-position-ingest", coverage: "full" },
];

export const STUDY_LAB_LINKS: StudyLabLink[] = [
  // Authorization policy lab (/labs/policy)
  { course: "AWSSAA", text: "A flexible authorization model built from IAM users, groups, roles, and policies", lab: "policy", exerciseId: "policy-01-default-deny", coverage: "partial", note: "policies and the evaluation rules; no users, groups or roles" },
  { course: "AWSSAA", text: "Resource-based policies, and when they beat an identity-based policy", lab: "policy", exerciseId: "policy-05-cross-account", coverage: "full" },
  { course: "AWSSAA", text: "Security across many accounts: AWS Organizations", lab: "policy", exerciseId: "policy-04-guardrail", coverage: "partial", note: "guardrail policies only" },
  { course: "AWSCLF", text: "Managed policies versus custom policies, written to least privilege", lab: "policy", exerciseId: "policy-01-default-deny", coverage: "partial", note: "writing a narrow allow" },
  { course: "AWSDEA", text: "Constructing custom policies that hold to least privilege", lab: "policy", exerciseId: "policy-02-deny-wins", coverage: "partial" },
  { course: "AWSDOP", text: "Service control policies in AWS Organizations", lab: "policy", exerciseId: "policy-04-guardrail", coverage: "full" },
  { course: "AWSDOP", text: "Designing policies that enforce least privilege access", lab: "policy", exerciseId: "policy-03-boundary", coverage: "partial" },
  { course: "AWSSOA", text: "Implementing IAM features: password policies, MFA, roles, federated identity, resource policies, policy conditions", lab: "policy", exerciseId: "policy-06-tags", coverage: "partial", note: "resource policies and conditions" },
  { course: "AWSSOA", text: "Troubleshooting and auditing access with CloudTrail, IAM Access Analyzer, and the IAM policy simulator", lab: "policy", exerciseId: "policy-02-deny-wins", coverage: "partial", note: "the decision trace plays the simulator's part" },
  { course: "AWSSOA", text: "Implementing multi-account strategies securely", lab: "policy", exerciseId: "policy-04-guardrail", coverage: "partial", note: "guardrails only" },
  { course: "AWSSCS", text: "Designing authorization controls", lab: "policy", exerciseId: "policy-05-cross-account", coverage: "partial", note: "resource policies for cross-account access" },
  { course: "AWSSCS", text: "Designing attribute-based and role-based access control", lab: "policy", exerciseId: "policy-06-tags", coverage: "full" },
  { course: "AWSSCS", text: "implementing IAM policies to least privilege, including permissions boundaries", lab: "policy", exerciseId: "policy-03-boundary", coverage: "full" },
  { course: "AWSSCS", text: "Analyzing authorization failures with the IAM policy simulator", lab: "policy", exerciseId: "policy-02-deny-wins", coverage: "full" },
  { course: "AWSSCS", text: "Investigating and correcting unintended permissions granted to a resource", lab: "policy", exerciseId: "policy-03-boundary", coverage: "partial" },
  { course: "AWSSCS", text: "Organization policies that manage permissions: service control policies", lab: "policy", exerciseId: "policy-04-guardrail", coverage: "partial" },
  { course: "AWSSAP", text: "Specifying IAM users and roles that hold to least privilege", lab: "policy", exerciseId: "policy-01-default-deny", coverage: "partial" },
  { course: "AWSMLA", text: "Configuring IAM policies and roles for users and applications in ML", lab: "policy", exerciseId: "policy-01-default-deny", coverage: "partial" },
];

/**
 * Unit gates that a planned engine would make playable. The gate sentence
 * is Ascendra's; the engine id names the OpsForge lab that would answer it.
 */
export const UNIT_ENGINE_GATES: StudyEngineGate[] = [
  { course: "AWSSAA", gateText: "Given an RTO and RPO, pick the disaster recovery strategy", engine: "dr-planner" },
  { course: "AWSSOA", gateText: "Given an RTO and an RPO, configure the backup and failover", engine: "dr-planner" },
  { course: "AWSSOA", gateText: "work the path -- security group, network ACL, route table", engine: "net-trace" },
  { course: "AWSANS", gateText: "find it with flow logs", engine: "net-trace" },
  { course: "AWSSOA", gateText: "Given an access denial or an audit finding, trace it to the policy", engine: "policy-eval" },
  { course: "AWSSCS", gateText: "find the policy that allowed it", engine: "policy-eval" },
];

/**
 * Units whose lines are degree-plan bookkeeping (credit minimums, electives,
 * graduation paperwork), not something to learn. Kept for fidelity to the
 * source, collapsed in the UI, excluded from generation and readiness.
 */
export const BOOKKEEPING_UNITS: Array<{ course: string; unit: string }> = [
  { course: "CMPCBS", unit: "Communication & Information Literacy" },
  { course: "CMPCBS", unit: "Technological Solutions & Quantitative Reasoning" },
  { course: "CMPCBS", unit: "Critical Thinking" },
  { course: "CMPCBS", unit: "Civic & Global Engagement" },
  { course: "CMPCBS", unit: "Social & Scientific Inquiry" },
  { course: "CMPCBS", unit: "Christianity & Contexts" },
  { course: "CMPCBS", unit: "Free Electives" },
  { course: "CMPCBS", unit: "Graduation Requirements" },
];

export const MODALITY_LABELS: Record<StudyModality, string> = {
  "do-existing": "Do it: mission or lab",
  "do-new": "Do it: lab planned",
  read: "Read and check",
  combo: "Read, then a scenario",
  explain: "Explain it back",
};

export const MODALITY_HELP: Record<StudyModality, string> = {
  "do-existing": "An OpsForge mission or lab exercise already makes you do this. Finish it and the objective is credited.",
  "do-new": "Best learned by doing, but the lab that would let you is not built yet. Lessons teach the idea; the hands-on part is planned.",
  read: "A plain-words explanation and a check question. Reading alone never counts as mastery here.",
  combo: "An explanation plus a situation to reason through, the way the exam asks it.",
  explain: "You explain the idea in your own words and compare with a model answer.",
};
