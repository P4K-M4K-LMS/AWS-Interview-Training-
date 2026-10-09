import type { RoleId, RoleQuestion } from "../domain/types";

/**
 * Role-specific technical interview questions. Each question probes one
 * qualification quoted from the target posting (see roles.ts) and names the
 * missions that prepare you for it. The "listening for" cues are practice
 * examples drawn from the lessons, not an official rubric, and the questions
 * use generic terms (a function platform, a queue) rather than product names
 * because OpsForge simulates concepts, not vendors.
 */
export const ROLE_QUESTIONS: Record<RoleId, RoleQuestion[]> = {
  "ops-automation": [
    {
      id: "oa-log-report-script",
      roleId: "ops-automation",
      qualificationId: "b2",
      principleId: null,
      kind: "technical",
      text: "Walk me through a script you would write to turn a raw log file into a daily report. What could break it, and how would you handle that?",
      listeningFor: ["Parse, filter and aggregate as distinct steps", "Bad lines handled without crashing or silently dropping data", "Stable, machine-readable output", "How you would test it"],
      missionIds: ["python-02-log-parser", "python-04-fleet-report"],
    },
    {
      id: "oa-red-pipeline",
      roleId: "ops-automation",
      qualificationId: "b3",
      principleId: null,
      kind: "technical",
      text: "A CI pipeline is red. What do you do first, and what would you refuse to do just to make it green?",
      listeningFor: ["Reads the failing step's log before changing anything", "Fixes the cause: a path, a permission, an environment dependency", "Will not delete, skip or blindly retry the failing test", "Confirms with a new green run"],
      missionIds: ["devops-01-broken-pipeline", "devops-02-green-locally-red-in-ci"],
    },
    {
      id: "oa-rollback",
      roleId: "ops-automation",
      qualificationId: "b3",
      principleId: null,
      kind: "technical",
      text: "Errors spike minutes after a deploy. How do you decide to roll back, and how do you know the rollback worked?",
      listeningFor: ["Correlates the spike with the deploy time", "Rolls back to a known-good release before debugging", "Verifies with the same metric that showed the problem", "Follows up with a fix and a regression test"],
      missionIds: ["devops-03-bad-release-rollback"],
    },
    {
      id: "oa-secret-wiring",
      roleId: "ops-automation",
      qualificationId: "b3",
      principleId: null,
      kind: "technical",
      text: "How should a deploy pipeline get the token it needs, and what goes wrong when someone pastes it into the pipeline file?",
      listeningFor: ["Secrets referenced by name from a vault and injected at run time", "A pasted value lives in git history and logs forever", "Rotate anything that was exposed", "Least privilege: the token can only deploy"],
      missionIds: ["devops-04-secret-wiring"],
    },
    {
      id: "oa-trustworthy-script",
      roleId: "ops-automation",
      qualificationId: "p1",
      principleId: null,
      kind: "technical",
      text: "How do you make a script safe to hand to other people, in terms of input validation and error handling?",
      listeningFor: ["Validates early and fails with a clear message", "Catches specific exceptions, never everything", "Tests cover good and bad input", "Reads tracebacks instead of suppressing them"],
      missionIds: ["python-03-config-validator"],
    },
    {
      id: "oa-traffic-surge",
      roleId: "ops-automation",
      qualificationId: "p2",
      principleId: null,
      kind: "technical",
      text: "Traffic quadruples. How do you decide between shedding load and adding capacity, and how do you size the change?",
      listeningFor: ["Measures load per tier with arithmetic, requests per worker", "Legitimate traffic calls for capacity, not rate limiting", "Checks every tier, including the queue behind the API", "Verifies recovery and writes it down"],
      missionIds: ["incident-02-traffic-surge"],
    },
    {
      id: "oa-silent-queue",
      roleId: "ops-automation",
      qualificationId: "p3",
      principleId: null,
      kind: "technical",
      text: "A queue keeps growing while the API dashboard is green. What do you check, in what order, and what would you alert on afterwards?",
      listeningFor: ["Consumer count and queue depth before anything else", "Logs for why the consumers died, before restarting them", "Drain-rate arithmetic to size the recovery", "Alerts on consumer count and depth, not only on the API"],
      missionIds: ["incident-03-dead-consumers", "go-02-worker-pool"],
    },
    {
      id: "oa-retries",
      roleId: "ops-automation",
      qualificationId: "p3",
      principleId: null,
      kind: "technical",
      text: "Explain retries with exponential backoff. When are retries dangerous, and what makes them safe?",
      listeningFor: ["Retries transient failures only, waiting longer each time", "Retry storms make a struggling dependency worse", "Idempotency keys make a repeated request harmless", "The caller sees the real last error"],
      missionIds: ["go-04-retries-idempotency"],
    },
    {
      id: "oa-least-privilege",
      roleId: "ops-automation",
      qualificationId: "b1",
      principleId: null,
      kind: "technical",
      text: "What does least privilege mean on a Linux host? Give a concrete example of a violation and how you fixed it.",
      listeningFor: ["Each file and account gets only the access it needs", "A concrete example, such as a world-readable private key", "Fixed with precise ownership and mode, not blanket permissions", "Verified afterwards"],
      missionIds: ["netsec-01-brute-force", "linux-03-locked-out"],
    },
  ],
  "sde2-serverless": [
    {
      id: "ss-ingest-design",
      roleId: "sde2-serverless",
      qualificationId: "b3",
      principleId: null,
      kind: "technical",
      text: "How would you design the ingest path for 2,000 events per second with a read that must stay under 100 milliseconds? Walk me through the components, the sizing arithmetic and what fails first.",
      listeningFor: ["States the requirements and numbers before naming components", "Capacity arithmetic: rate times duration, consumers from throughput", "No single point of failure on the write path, a buffer in front of storage", "Failure drills reasoned from the design, tradeoffs named"],
      missionIds: ["design-01-position-ingest"],
    },
    {
      id: "ss-throttled-function",
      roleId: "sde2-serverless",
      qualificationId: "p2",
      principleId: null,
      kind: "technical",
      text: "A function is throttling under a traffic surge while the rest of the system looks healthy. How do you size its concurrency, and when is pre-warming worth paying for?",
      listeningFor: ["Needed concurrency equals invocation rate times duration", "Throttling is a limit problem; cold starts are a warm-up problem", "Provisioned concurrency trades a standing cost for latency", "Does not add capacity to tiers that are not the bottleneck"],
      missionIds: ["serverless-01-throttled-function"],
    },
    {
      id: "ss-duplicate-charges",
      roleId: "sde2-serverless",
      qualificationId: "p1",
      principleId: null,
      kind: "technical",
      text: "Customers were charged twice after some invocations timed out. What happened, and how do you fix it without dropping work?",
      listeningFor: ["At-least-once delivery: a timed-out invocation is retried after its side effect", "Turning retries off trades duplicates for lost events", "An idempotency key checked and stored with the side effect", "A larger timeout budget as a complement, not the fix"],
      missionIds: ["serverless-03-duplicate-charges", "serverless-04-idempotent-handler"],
    },
    {
      id: "ss-poison-messages",
      roleId: "sde2-serverless",
      qualificationId: "p1",
      principleId: null,
      kind: "technical",
      text: "What is a poison message, and how do you stop it from consuming all of your processing capacity?",
      listeningFor: ["Fails on every attempt and is redelivered without a limit", "Each retry burns a slot, so adding consumers does not help", "A dead-letter queue with a sensible receive count", "Alert on dead-letter depth and validate at the producer"],
      missionIds: ["serverless-02-poison-messages"],
    },
    {
      id: "ss-stale-reads",
      roleId: "sde2-serverless",
      qualificationId: "b3",
      principleId: null,
      kind: "technical",
      text: "Writes succeed and the API is fast, yet users see data that is a minute old. Where do you look, and why is failing over to the replica dangerous?",
      listeningFor: ["The replica lag metric and the replica's apply thread", "Finds and removes the blocking statement", "Pinning reads to the primary is a mitigation, not the fix", "Failing over to a lagging replica loses committed writes"],
      missionIds: ["incident-04-replica-lag"],
    },
    {
      id: "ss-data-race",
      roleId: "sde2-serverless",
      qualificationId: "b4",
      principleId: null,
      kind: "technical",
      text: "Explain a data race with a concrete example, how you would fix it, and how you would prove the fix.",
      listeningFor: ["The check-then-act gap between reading and writing shared state", "A mutex held across the whole critical section", "Why a single-threaded test can miss it", "The race detector or a stress test as proof"],
      missionIds: ["go-05-data-race"],
    },
    {
      id: "ss-bounded-call",
      roleId: "sde2-serverless",
      qualificationId: "b4",
      principleId: null,
      kind: "technical",
      text: "How do you bound a call to a dependency that might never answer, and what happens to the work still in flight?",
      listeningFor: ["A deadline carried in a context passed down the call chain", "Waits on the result or the deadline, whichever comes first", "Returns the right error on timeout", "No leaked goroutine: a buffered result or propagated cancellation"],
      missionIds: ["go-03-timeouts-context"],
    },
    {
      id: "ss-full-disk-runaway",
      roleId: "sde2-serverless",
      qualificationId: "b5",
      principleId: null,
      kind: "technical",
      text: "A production host's disk is full and one process is pinning the CPU. What is safe to delete, what is not, and why can deleting a log free no space?",
      listeningFor: ["Measures first, then narrows down, then deletes only identified safe files", "Application data is never a space-recovery target", "An open file's blocks stay allocated until it is closed, so truncate instead", "Identifies the process by PID and command line, stops it gently, fixes the trigger"],
      missionIds: ["linux-04-disk-full", "linux-05-runaway-process"],
    },
    {
      id: "ss-sprint-interrupts",
      roleId: "sde2-serverless",
      qualificationId: "p3",
      principleId: null,
      kind: "technical",
      text: "How does unplanned operational work, like an incident, enter a sprint without wrecking it?",
      listeningFor: ["Names the Scrum roles, events and artifacts correctly", "Capacity reserved, or the product owner re-prioritises explicitly", "Follow-ups become backlog items, not silent side work", "The retrospective examines the interruption"],
      missionIds: ["agile-01-scrum-for-engineers"],
    },
  ],
};

export const ALL_ROLE_QUESTIONS: RoleQuestion[] = Object.values(ROLE_QUESTIONS).flat();
const BY_ID = new Map(ALL_ROLE_QUESTIONS.map((q) => [q.id, q]));

export function roleQuestionsFor(roleId: RoleId | undefined): RoleQuestion[] {
  return (roleId && ROLE_QUESTIONS[roleId]) || ROLE_QUESTIONS["ops-automation"];
}

export function roleQuestionById(id: string | null | undefined): RoleQuestion | undefined {
  return id ? BY_ID.get(id) : undefined;
}
