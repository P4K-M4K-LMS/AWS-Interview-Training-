import type { CareerStage, SkillId, StageInfo, Track, TrackId } from "../domain/types";

/**
 * Curriculum: six tracks, each a list of skills with prerequisites.
 * Mastery is only earned through demonstrated work (missions, independent
 * solves, retention checks), never by reading lessons.
 */

const S = (id: SkillId, name: string, description: string, prerequisites: SkillId[] = []) => ({
  id,
  trackId: id.split(".")[0] as TrackId,
  name,
  description,
  prerequisites,
});

export const TRACKS: Track[] = [
  {
    id: "linux",
    name: "Linux Fundamentals and Administration",
    shortName: "Linux",
    summary:
      "Navigate, inspect and repair Linux systems from the terminal: files, permissions, processes, services and logs.",
    skills: [
      S("linux.navigation", "Terminal navigation", "Move around the filesystem with pwd, cd and ls; understand absolute and relative paths."),
      S("linux.files", "File creation and manipulation", "Create, copy, move and delete files and directories.", ["linux.navigation"]),
      S("linux.reading", "Reading and searching files", "Read files with cat/head/tail and search with grep.", ["linux.navigation"]),
      S("linux.pipes", "Pipes and redirection", "Chain commands with | and capture output with > and >>.", ["linux.reading"]),
      S("linux.env", "Environment variables", "Inspect and set variables with env, export and $VAR expansion.", ["linux.navigation"]),
      S("linux.permissions", "Permissions and ownership", "Read ls -l output; change modes with chmod and owners with chown.", ["linux.files"]),
      S("linux.processes", "Processes and signals", "Inspect processes with ps/top and stop them with kill.", ["linux.reading"]),
      S("linux.services", "Services and daemons", "Check, start and restart services with systemctl; read their logs.", ["linux.processes", "linux.reading"]),
      S("linux.logs", "Logs and troubleshooting", "Locate and interpret log files to find root causes.", ["linux.pipes"]),
      S("linux.performance", "Resource monitoring", "Diagnose CPU, memory and disk pressure with top, free, df and du.", ["linux.processes"]),
      S("linux.scripting", "Shell scripting basics", "Write small scripts that automate repetitive terminal work.", ["linux.pipes", "linux.env"]),
    ],
  },
  {
    id: "python",
    name: "Python Programming",
    shortName: "Python",
    summary:
      "Write real, executed Python: from variables and loops to file parsing, error handling, testing and automation scripts.",
    skills: [
      S("python.basics", "Variables, types and strings", "Store and transform numbers and strings."),
      S("python.control", "Conditions and loops", "Branch with if/elif/else and repeat with for/while.", ["python.basics"]),
      S("python.functions", "Functions", "Define reusable functions with parameters and return values.", ["python.control"]),
      S("python.collections", "Lists, dicts, sets and tuples", "Choose and use the right collection type.", ["python.control"]),
      S("python.errors", "Error handling", "Catch and raise exceptions deliberately.", ["python.functions"]),
      S("python.files", "File operations", "Read and write text files safely.", ["python.errors"]),
      S("python.data", "JSON and CSV", "Parse and produce structured data.", ["python.collections", "python.files"]),
      S("python.regex", "Regular expressions", "Extract patterns from text with the re module.", ["python.basics"]),
      S("python.testing", "Unit testing and debugging", "Write assertions and tests; read tracebacks.", ["python.functions"]),
      S("python.automation", "Automation scripts", "Combine parsing, logic and output into operational tools.", ["python.data", "python.testing"]),
      S("python.oop", "Object-oriented fundamentals", "Model data and behavior with classes.", ["python.functions"]),
      S("python.async", "Async and concurrency basics", "Understand coroutines, threads and when each helps.", ["python.oop"]),
    ],
  },
  {
    id: "algorithms",
    name: "Data Structures, Algorithms and Big O",
    shortName: "Algorithms",
    summary:
      "Reason about how work grows with input size, measure it, and pick data structures that keep systems fast.",
    skills: [
      S("algorithms.thinking", "Algorithmic thinking", "Describe a procedure as precise steps and count its operations."),
      S("algorithms.bigo", "Big O notation", "Classify growth as O(1), O(log n), O(n), O(n log n), O(n^2) or exponential.", ["algorithms.thinking"]),
      S("algorithms.search", "Linear and binary search", "Search sorted and unsorted data and compare costs.", ["algorithms.bigo"]),
      S("algorithms.sorting", "Sorting algorithms", "Compare bubble, insertion and merge sort behavior.", ["algorithms.bigo"]),
      S("algorithms.structures", "Arrays, lists, stacks, queues, hash tables", "Pick the structure whose operations fit the workload.", ["algorithms.bigo"]),
      S("algorithms.recursion", "Recursion", "Solve problems by self-similar decomposition.", ["algorithms.search"]),
      S("algorithms.trees-graphs", "Trees and graphs", "Traverse hierarchical and networked data.", ["algorithms.recursion", "algorithms.structures"]),
      S("algorithms.optimization", "Optimization and tradeoffs", "Trade time for space and theory for measured runtime.", ["algorithms.sorting", "algorithms.structures"]),
    ],
  },
  {
    id: "netsec",
    name: "Networking and Defensive Security",
    shortName: "Network & Security",
    summary:
      "Understand how machines talk, where failures and attacks show up, and how to harden and investigate systems.",
    skills: [
      S("netsec.addressing", "IP addressing and subnets", "Read addresses, masks and routes."),
      S("netsec.dns-ports", "DNS, ports and protocols", "Resolve names; distinguish TCP/UDP; recognise well-known ports.", ["netsec.addressing"]),
      S("netsec.http", "HTTP and HTTPS", "Read requests, responses, status codes and TLS basics.", ["netsec.dns-ports"]),
      S("netsec.troubleshooting", "Network troubleshooting", "Isolate failures layer by layer with ping, dig and curl.", ["netsec.http"]),
      S("netsec.authz", "Authentication, authorization, least privilege", "Separate who you are from what you may do.", []),
      S("netsec.hardening", "Linux hardening basics", "Reduce attack surface: permissions, services, SSH and firewalls.", ["netsec.authz"]),
      S("netsec.logs", "Security logging and monitoring", "Spot suspicious activity in auth and web logs.", ["netsec.hardening"]),
      S("netsec.incident", "Security incident response", "Contain, investigate, remediate and document.", ["netsec.logs"]),
    ],
  },
  {
    id: "devops",
    name: "Automation, DevOps and Monitoring",
    shortName: "DevOps",
    summary:
      "Ship changes safely: version control, automated tests, CI/CD pipelines, monitoring, rollbacks and incident documentation.",
    skills: [
      S("devops.git", "Git and version control", "Commit, branch, inspect history and recover mistakes."),
      S("devops.testing", "Automated tests", "Make a pipeline fail fast on real defects.", ["devops.git"]),
      S("devops.cicd", "CI/CD pipelines", "Read and repair build and deployment pipelines.", ["devops.testing"]),
      S("devops.config", "Configuration management", "Keep environments consistent and changes reviewable.", ["devops.git"]),
      S("devops.containers", "Containers and infrastructure as code", "Package services and declare infrastructure.", ["devops.config"]),
      S("devops.monitoring", "Monitoring, metrics and alerts", "Turn metrics into actionable alerts.", ["devops.cicd"]),
      S("devops.release", "Rollbacks and release management", "Recover quickly and document incidents.", ["devops.monitoring"]),
      S("devops.agile", "Agile and Scrum practice", "Work in sprints: backlog, planning, daily scrum, review, retrospective; bring operational work into the process.", []),
    ],
  },
  {
    id: "distributed",
    name: "Concurrency and Distributed Systems",
    shortName: "Distributed",
    summary:
      "Reason about throughput, latency, failure and consistency in systems made of many cooperating services.",
    skills: [
      S("distributed.architecture", "Client/server and dependencies", "Map services, dependencies and traffic flow."),
      S("distributed.concurrency", "Concurrency vs parallelism", "Threads, processes, async, race conditions and locks.", ["distributed.architecture"]),
      S("distributed.queues", "Queues and workers", "Decouple producers and consumers; watch queue depth.", ["distributed.concurrency"]),
      S("distributed.performance", "Throughput, latency and bottlenecks", "Measure and locate the slowest stage.", ["distributed.queues"]),
      S("distributed.scaling", "Load balancing, caching and scaling", "Add capacity without adding failure.", ["distributed.performance"]),
      S("distributed.resilience", "Retries, timeouts and idempotency", "Fail safely and recover predictably.", ["distributed.scaling"]),
      S("distributed.consistency", "Replication and consistency tradeoffs", "Choose what to sacrifice when partitions happen.", ["distributed.resilience"]),
      S("distributed.observability", "Observability", "Logs, metrics and traces that explain distributed failures.", ["distributed.performance"]),
    ],
  },
  {
    id: "serverless",
    name: "Serverless and Event-Driven Systems",
    shortName: "Serverless",
    summary:
      "Functions that scale per request and queues that feed them: concurrency limits, cold starts, retries, dead-letter queues and idempotent handlers, on a simulated platform (not an emulation of any vendor).",
    skills: [
      S("serverless.functions", "Functions and the invocation model", "Synchronous vs asynchronous invocations, timeouts, and what a concurrency limit means.", ["distributed.architecture"]),
      S("serverless.scaling", "Concurrency, throttling and cold starts", "Size reserved concurrency from rate × duration; use provisioned concurrency for latency.", ["serverless.functions", "distributed.scaling"]),
      S("serverless.events", "Event sources, retries and dead-letter queues", "Queue-triggered functions, receive counts, poison messages and the DLQ.", ["serverless.functions", "distributed.queues"]),
      S("serverless.idempotency", "Idempotent handlers", "Make retries safe with idempotency keys and at-most-once side effects.", ["serverless.events", "distributed.resilience"]),
      S("serverless.observability", "Function observability", "Throttles, cold starts, DLQ depth and duplicate side effects as the signals that matter.", ["serverless.scaling", "distributed.observability"]),
    ],
  },
];

export const STAGES: StageInfo[] = [
  {
    stage: 1,
    title: "Engineering Trainee",
    focus: "Linux, programming and systems foundations.",
    requiredMastery: 0,
    requiredSkills: [],
  },
  {
    stage: 2,
    title: "Junior Operations Engineer",
    focus: "Basic troubleshooting and automation.",
    requiredMastery: 60,
    requiredSkills: ["linux.navigation", "linux.files", "linux.reading", "python.basics", "python.control", "algorithms.bigo"],
  },
  {
    stage: 3,
    title: "Systems Troubleshooter",
    focus: "Logs, processes, networking and debugging.",
    requiredMastery: 60,
    requiredSkills: ["linux.pipes", "linux.permissions", "linux.processes", "linux.logs", "python.functions", "python.collections", "netsec.authz"],
  },
  {
    stage: 4,
    title: "Automation Engineer",
    focus: "Python scripting, testing and CI/CD workflows.",
    requiredMastery: 60,
    requiredSkills: ["python.errors", "python.files", "python.data", "python.testing", "python.automation", "devops.git", "devops.testing"],
  },
  {
    stage: 5,
    title: "Reliability & Security Engineer",
    focus: "Defensive investigations and operational reliability.",
    requiredMastery: 60,
    requiredSkills: ["netsec.hardening", "netsec.logs", "netsec.incident", "devops.cicd", "devops.monitoring", "linux.services"],
  },
  {
    stage: 6,
    title: "Distributed Systems Engineer",
    focus: "Concurrency, scalability, high throughput and system architecture.",
    requiredMastery: 60,
    requiredSkills: ["distributed.concurrency", "distributed.queues", "distributed.performance", "distributed.scaling", "distributed.resilience"],
  },
];

export const ALL_SKILLS = TRACKS.flatMap((t) => t.skills);
export const SKILL_BY_ID = new Map(ALL_SKILLS.map((s) => [s.id, s]));
export const TRACK_BY_ID = new Map(TRACKS.map((t) => [t.id, t]));

export function stageInfo(stage: CareerStage): StageInfo {
  return STAGES[stage - 1];
}
