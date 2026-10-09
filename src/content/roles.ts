import type { RoleId, TargetRole } from "../domain/types";

/**
 * Target roles: the job postings a learner can train toward. Every
 * qualification is quoted from the posting as provided; coverage states
 * honestly what OpsForge can and cannot do about it. No title, duty or
 * requirement is invented, and nothing here is an official Amazon statement.
 */
export const DEFAULT_ROLE_ID: RoleId = "ops-automation";

const SHARED_DISCLAIMER =
  "OpsForge develops skills related to these qualifications. Completing missions does not satisfy any degree, certification, tenure or clearance requirement, and nothing here is presented as an official Amazon requirement.";

export const ROLES: TargetRole[] = [
  {
    id: "ops-automation",
    title: "Target posting (title not provided)",
    source: "Qualifications supplied in the OpsForge master build prompt; the posting's title and responsibilities were not available.",
    qualifications: [
      { id: "b1", kind: "basic", text: "Associate's degree or above, or CND (Certified Network Defender), or GSEC (GIAC Security Essentials).", coverage: "partial", skills: ["netsec.addressing", "netsec.dns-ports", "netsec.authz", "netsec.hardening", "netsec.logs", "netsec.incident"], note: "The Networking and Defensive Security track teaches related foundations. It is not a degree or a certification." },
      { id: "b2", kind: "basic", text: "Experience programming with at least one modern language such as C++, C#, Java, Python, Go, PowerShell, or Ruby.", coverage: "trainable", skills: ["python.basics", "python.control", "python.functions", "python.collections", "python.errors", "python.testing"], note: "Real Python runs in the browser; the Go missions on the Distributed track add a second language." },
      { id: "b3", kind: "basic", text: "Experience using automation tools for building, testing, releasing, or monitoring.", coverage: "trainable", skills: ["devops.git", "devops.testing", "devops.cicd", "devops.config", "devops.monitoring", "devops.release"], note: "Pipeline, rollback, secret-wiring and monitoring missions on a simulated CI/CD system." },
      { id: "p1", kind: "preferred", text: "Knowledge of and proficiency with Python scripting.", coverage: "trainable", skills: ["python.files", "python.data", "python.regex", "python.automation"], note: "Parsing, reporting and validation scripts; regex and automation missions are still planned." },
      { id: "p2", kind: "preferred", text: "Experience with highly concurrent, high-throughput systems.", coverage: "trainable", skills: ["distributed.concurrency", "distributed.queues", "distributed.performance", "distributed.scaling", "algorithms.optimization"], note: "Go concurrency missions, the capacity incidents and the Big O labs." },
      { id: "p3", kind: "preferred", text: "Knowledge of complex distributed systems.", coverage: "trainable", skills: ["distributed.architecture", "distributed.resilience", "distributed.consistency", "distributed.observability"], note: "Incident console on the shared platform simulation: cache stampede, surge, dead consumers, replication lag." },
    ],
    trackAlignment: {
      linux: "Supporting area chosen by the learner. Linux skills underpin automation, monitoring and troubleshooting work.",
      python: "Basic qualification: programming experience in a modern language. Preferred qualification: proficiency with Python scripting.",
      algorithms: "Supporting area chosen by the learner. Underpins the preferred qualification about high-throughput systems.",
      netsec: "Basic qualification alternative: CND or GSEC. OpsForge teaches related foundations but is not a certification.",
      devops: "Basic qualification: experience using automation tools for building, testing, releasing or monitoring.",
      distributed: "Preferred qualifications: experience with highly concurrent, high-throughput systems and complex distributed systems.",
      serverless: "Supporting area: event-driven designs extend the distributed-systems qualifications.",
    },
    interviewFocus: ["Automation and CI/CD stories (building, testing, releasing, monitoring)", "Python scripting decisions and tradeoffs", "Throughput, concurrency and distributed-system failure stories", "Security foundations: least privilege, logs, incidents"],
    disclaimer: SHARED_DISCLAIMER,
  },
  {
    id: "sde2-serverless",
    title: "System Development Engineer II, Lambda/Serverless",
    team: "Amazon Dedicated Cloud (ADC) Serverless (Government Cloud)",
    location: "US, WA, Seattle",
    updated: "09/19/2026",
    source: "Posting text pasted by the learner on 2026-10-09; the description was truncated in what was provided.",
    descriptionExcerpt: "The Amazon Dedicated Cloud (ADC) Serverless team is hiring a cleared Systems Development Engineer to join the team. This is an exciting opportunity to use the latest cloud computing technologies to help [excerpt ends here]",
    qualifications: [
      { id: "b1", kind: "basic", text: "Bachelor's degree, or CSSLP (Certified Secure Software Lifecycle Professional)", coverage: "not-addressable", skills: [], note: "A degree or certification cannot be earned here." },
      { id: "b2", kind: "basic", text: "2+ years of non-internship professional software development experience", coverage: "not-addressable", skills: [], note: "Professional tenure cannot be trained; missions build the skills that experience would show." },
      { id: "b3", kind: "basic", text: "1+ years of designing or architecting (design patterns, reliability and scaling) of new and existing systems experience", coverage: "partial", skills: ["distributed.architecture", "distributed.scaling", "distributed.resilience", "distributed.consistency", "devops.monitoring"], note: "Incidents and the architecture visualizer exercise reliability and scaling reasoning, and the design exercise (requirements in, justified design out, transparent rubric) practises the architecture conversation. One exercise exists; a year of design experience cannot be trained here." },
      { id: "b4", kind: "basic", text: "Experience programming with at least one modern language such as C++, C#, Java, Python, Golang, PowerShell, Ruby", coverage: "trainable", skills: ["python.basics", "python.functions", "python.errors", "python.testing", "python.data", "distributed.concurrency"], note: "Python and Go both run for real in the browser; the Go missions cover error values, worker pools, context, retries and data races." },
      { id: "b5", kind: "basic", text: "Knowledge of systems engineering fundamentals (networking, storage, operating systems)", coverage: "partial", skills: ["linux.permissions", "linux.processes", "linux.services", "linux.performance", "linux.logs", "netsec.dns-ports", "netsec.troubleshooting"], note: "Operating-system and networking foundations exist (processes, services, disk pressure, ports, DNS). Storage beyond disk usage is thin; network troubleshooting missions are planned." },
      { id: "b6", kind: "basic", text: "Current, active US Government Security Clearance of Top Secret with SCI eligibility or above", coverage: "not-addressable", skills: [], note: "A clearance is granted by the government, not by training." },
      { id: "p1", kind: "preferred", text: "Experience with distributed systems at scale", coverage: "trainable", skills: ["distributed.concurrency", "distributed.queues", "distributed.performance", "distributed.scaling", "distributed.resilience", "distributed.consistency", "distributed.observability"], note: "Go concurrency missions and four incidents on the shared platform simulation." },
      { id: "p2", kind: "preferred", text: "Experience building services using AWS products", coverage: "partial", skills: ["serverless.functions", "serverless.scaling", "serverless.events", "serverless.idempotency", "serverless.observability"], note: "The Serverless track teaches the concepts behind function platforms (concurrency limits, cold starts, event retries, dead-letter queues, idempotent handlers) on a simulated platform. OpsForge does not emulate AWS, grants no AWS experience, and makes no claims about ADC internals." },
      { id: "p3", kind: "preferred", text: "Experience working in an Agile environment using the Scrum methodology", coverage: "partial", skills: ["devops.agile"], note: "A lesson with a check quiz teaches the Scrum loop, roles, artifacts and how operational work fits a sprint, plus an interview cue. Experience itself cannot be trained here; the lesson gives you the vocabulary to describe yours precisely." },
    ],
    trackAlignment: {
      linux: "Basic qualification: systems engineering fundamentals (operating systems).",
      python: "Basic qualification: programming with a modern language (Python; Go on the Distributed track).",
      algorithms: "Supporting area: reasoning about scaling and throughput.",
      netsec: "Basic qualification: systems engineering fundamentals (networking).",
      devops: "Supporting area: reliability practices (monitoring, rollbacks) behind the design and architecture qualification.",
      distributed: "Basic qualification: designing or architecting for reliability and scaling. Preferred: distributed systems at scale.",
      serverless: "Preferred qualification: building services with managed function platforms (concepts only, simulated).",
    },
    interviewFocus: ["Design and architecture stories: reliability and scaling decisions you made and verified", "Distributed-systems failure handling: retries, idempotency, timeouts, consistency", "Operating-system and networking fundamentals explained from first principles", "Serverless concepts (concurrency limits, cold starts, event-driven retries) stated as knowledge, not claimed experience"],
    disclaimer: SHARED_DISCLAIMER,
  },
];

export const ROLE_BY_ID = new Map(ROLES.map((r) => [r.id, r]));

export function roleFor(id: RoleId | undefined): TargetRole {
  return ROLE_BY_ID.get(id ?? DEFAULT_ROLE_ID) ?? ROLES[0];
}

export const COVERAGE_LABELS: Record<TargetRole["qualifications"][number]["coverage"], string> = {
  trainable: "Trainable here",
  partial: "Partly covered",
  planned: "Planned, not built",
  "not-addressable": "Not addressable in OpsForge",
};
