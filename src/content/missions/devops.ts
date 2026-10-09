import type { InvestigationMission } from "../../domain/types";

const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. You are a trainee on the operations team.";

/**
 * Introductory automation mission: a broken CI pipeline configuration and a
 * flaky deploy script. The "pipeline" is a simulated file-based runner.
 */
export const devopsMissions: InvestigationMission[] = [
  {
    id: "devops-01-broken-pipeline",
    kind: "investigation",
    trackId: "devops",
    stage: 2,
    title: "The build is red: repair a CI pipeline",
    summary: "Read a failed pipeline log, fix the test command and a non-executable deploy script, then re-run the pipeline.",
    briefing: `${COMPANY_INTRO}\n\nThe nightly pipeline for the fleet API has been failing for two days and nobody looked. The pipeline runner leaves a log in /var/ci/last-run.log and reads its steps from /srv/fleet-api/.ci/pipeline.yml. Find why it fails, fix the causes (not the symptoms), and trigger a new run by writing 'run' into /var/ci/trigger.`,
    objectives: [
      "Read the last pipeline run log and identify the failing step",
      "Fix the test step in pipeline.yml so it runs the tests directory that actually exists",
      "Make scripts/deploy.sh executable (it is currently mode 644)",
      "Trigger a new run and confirm /var/ci/last-run.log reports SUCCESS",
    ],
    skills: ["devops.git", "devops.testing", "devops.cicd", "linux.permissions"],
    prerequisites: ["linux-03-locked-out"],
    estimatedMinutes: 20,
    commandsIntroduced: ["cat", "ls -l", "sed -i", "chmod +x", "echo >"],
    lesson: [
      {
        title: "What a pipeline is",
        body: "A CI/CD pipeline is a list of steps run automatically on every change: install, test, build, deploy. Each step is a shell command; if any command exits non-zero the pipeline stops and reports failure. Pipelines live in a config file in the repository (here `.ci/pipeline.yml`).",
      },
      {
        title: "Read the log before touching anything",
        body: "The log tells you which step failed and prints that command's output. Two classic causes: the command references a path that moved (a test directory renamed), and a script that is not executable (`Permission denied` when run as `./scripts/deploy.sh`). Fix the cause in the config or permissions; do not just delete the failing step.",
      },
      {
        title: "Version control mindset",
        body: "In a real repo you would make these fixes on a branch, commit with a message explaining the why (`fix(ci): tests moved to tests/`), and open a pull request. Here the simulator stores a tiny history in /srv/fleet-api/.git-log so you can read what changed recently.",
      },
    ],
    glossary: [
      { term: "CI/CD", definition: "Continuous Integration / Continuous Delivery: automatically testing and shipping every change." },
      { term: "exit code", definition: "A number a command returns when it finishes; 0 means success, anything else means failure." },
      { term: "executable bit", definition: "The x permission that lets a file be run as a program." },
    ],
    hints: [
      { level: 1, title: "Start with the log", body: "`cat /var/ci/last-run.log`. Which step failed and what did it print?" },
      { level: 2, title: "Compare with reality", body: "`ls /srv/fleet-api` shows the real directory names. `cat /srv/fleet-api/.git-log` shows a recent rename." },
      { level: 3, title: "Fix the config and the bit", body: "`sudo sed -i 's#python -m pytest test/#python -m pytest tests/#' /srv/fleet-api/.ci/pipeline.yml` and `sudo chmod +x /srv/fleet-api/scripts/deploy.sh`." },
      { level: 4, title: "Guided example", body: "```\ncat /var/ci/last-run.log\nls -l /srv/fleet-api /srv/fleet-api/scripts\ncat /srv/fleet-api/.git-log\ncat /srv/fleet-api/.ci/pipeline.yml\nsudo sed -i 's#pytest test/#pytest tests/#' /srv/fleet-api/.ci/pipeline.yml\nsudo chmod +x /srv/fleet-api/scripts/deploy.sh\necho run > /var/ci/trigger\ncat /var/ci/last-run.log\n```" },
    ],
    reflectionPrompts: ["Describe how you diagnosed the pipeline failure, why you fixed the config rather than removing the step, and how you verified the pipeline was green."],
    transferNote: "Red pipelines rot fast. Reading the log, fixing the cause and confirming green is a daily task for automation engineers.",
    world: {
      hostname: "ci-runner-01",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        "/srv/fleet-api": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/srv/fleet-api/README.md": { type: "file", content: "# fleet-api\nRun tests with: python -m pytest tests/\n", mode: 0o644, owner: "root", group: "root" },
        "/srv/fleet-api/tests": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/srv/fleet-api/tests/test_api.py": { type: "file", content: "def test_health():\n    assert True\n", mode: 0o644, owner: "root", group: "root" },
        "/srv/fleet-api/scripts": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/srv/fleet-api/scripts/deploy.sh": { type: "file", content: "#!/bin/sh\necho deploying fleet-api\n", mode: 0o644, owner: "root", group: "root" },
        "/srv/fleet-api/.ci": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/srv/fleet-api/.ci/pipeline.yml": { type: "file", content: "steps:\n  - name: install\n    run: pip install -r requirements.txt\n  - name: test\n    run: python -m pytest test/\n  - name: deploy\n    run: ./scripts/deploy.sh\n", mode: 0o644, owner: "root", group: "root" },
        "/srv/fleet-api/.git-log": { type: "file", content: "a1f3c2 2026-03-07 priya   chore: rename test/ to tests/ to match pytest convention\n9be001 2026-03-06 marco   feat: add deploy script\n7c0d11 2026-03-05 priya   ci: add nightly pipeline\n", mode: 0o644, owner: "root", group: "root" },
        "/var/ci": { type: "dir", mode: 0o777, owner: "root", group: "root" },
        "/var/ci/last-run.log": { type: "file", content: "=== pipeline run #118 (2026-03-08 02:00) ===\n[install] pip install -r requirements.txt\n[install] ok\n[test] python -m pytest test/\n[test] ERROR: file or directory not found: test/\n[test] exit code 4\n=== RESULT: FAILURE at step 'test' ===\n", mode: 0o644, owner: "root", group: "root" },
      },
    },
    steps: [
      {
        id: "diagnose",
        prompt: "Diagnose the failure from the log and repository.",
        checks: [
          { id: "read-log", label: "Read /var/ci/last-run.log", test: (c) => c.outputs.some((o) => /last-run\.log/.test(o.command) && o.stdout.includes("RESULT")) },
          { id: "test-path", label: "pipeline.yml test step points at tests/", test: (c) => /pytest\s+tests\/?\s*$/m.test(c.readFile("/srv/fleet-api/.ci/pipeline.yml") ?? "") && !/pytest\s+test\//.test(c.readFile("/srv/fleet-api/.ci/pipeline.yml") ?? "") },
          { id: "exec", label: "scripts/deploy.sh is executable", test: (c) => ((c.mode("/srv/fleet-api/scripts/deploy.sh") ?? 0) & 0o100) !== 0 },
        ],
      },
      {
        id: "rerun",
        prompt: "Trigger a new run and confirm success.",
        checks: [
          { id: "green", label: "A new run was triggered and the log reports SUCCESS", test: (c) => { const log = c.readFile("/var/ci/last-run.log") ?? ""; return { passed: /run #119/.test(log) && /RESULT: SUCCESS/.test(log), detail: /run #119/.test(log) ? (/SUCCESS/.test(log) ? "run #119 succeeded" : "run #119 failed; read the log") : "no new run yet" }; } },
        ],
        question: {
          prompt: "Why is fixing the config better than deleting the failing test step?",
          options: [
            "Because deleting the step removes the safety check that catches real defects before deploy",
            "Because YAML files cannot have steps removed",
            "Because the pipeline runner requires exactly three steps",
            "Because tests always pass anyway",
          ],
          correctIndex: 0,
          explanation: "The test step exists to stop broken code reaching production. Removing it makes the pipeline green by making it blind.",
        },
      },
    ],
  },
];

/**
 * Simulated pipeline runner used by the mission UI: called after every command
 * so writing 'run' into /var/ci/trigger produces a new last-run.log.
 */
export function simulatePipelineRun(read: (p: string) => string | null, write: (p: string, c: string) => void, mode: (p: string) => number | null) {
  const trigger = (read("/var/ci/trigger") ?? "").trim();
  if (trigger !== "run") return;
  const yml = read("/srv/fleet-api/.ci/pipeline.yml") ?? "";
  const steps = [...yml.matchAll(/- name: (\S+)\n\s+run: (.+)/g)].map((m) => ({ name: m[1], run: m[2].trim() }));
  const lines = [`=== pipeline run #119 (2026-03-09 09:20) ===`];
  let failed: string | null = null;
  for (const s of steps) {
    lines.push(`[${s.name}] ${s.run}`);
    if (s.name === "test") {
      const dir = s.run.match(/pytest\s+(\S+)/)?.[1]?.replace(/\/$/, "");
      const exists = dir ? read(`/srv/fleet-api/${dir}/test_api.py`) !== null : false;
      if (!exists) {
        lines.push(`[test] ERROR: file or directory not found: ${dir ?? "?"}/`, `[test] exit code 4`);
        failed = "test";
        break;
      }
      lines.push(`[test] 1 passed in 0.02s`);
    } else if (s.name === "deploy") {
      const m = mode("/srv/fleet-api/scripts/deploy.sh") ?? 0;
      if ((m & 0o100) === 0) {
        lines.push(`[deploy] sh: ./scripts/deploy.sh: Permission denied`, `[deploy] exit code 126`);
        failed = "deploy";
        break;
      }
      lines.push(`[deploy] deploying fleet-api`, `[deploy] ok`);
    } else lines.push(`[${s.name}] ok`);
  }
  lines.push(failed ? `=== RESULT: FAILURE at step '${failed}' ===` : `=== RESULT: SUCCESS ===`);
  write("/var/ci/last-run.log", lines.join("\n") + "\n");
  write("/var/ci/trigger", "");
}
