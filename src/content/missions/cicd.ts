import type { InvestigationMission, ProgramHost, SimProgram } from "../../domain/types";
import { makeCiProgram, type StepRunner } from "../../engine/cicd/pipeline";

const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. You are a trainee on the operations team.";

const CI_PATHS = { ymlPath: "/srv/fleet-api/.ci/pipeline.yml", logPath: "/var/ci/last-run.log", counterPath: "/var/ci/run-counter" };

const baseRepo = (pipelineYml: string) => ({
  "/srv/fleet-api": { type: "dir" as const, mode: 0o755, owner: "root", group: "root" },
  "/srv/fleet-api/README.md": { type: "file" as const, content: "# fleet-api\nCI: `ci run`, `ci log`, `ci status`. Tests: python -m pytest tests/\n", mode: 0o644, owner: "root", group: "root" },
  "/srv/fleet-api/requirements.txt": { type: "file" as const, content: "fastapi==0.115.0\npytest==8.3.0\n", mode: 0o644, owner: "root", group: "root" },
  "/srv/fleet-api/tests": { type: "dir" as const, mode: 0o755, owner: "root", group: "root" },
  "/srv/fleet-api/tests/test_api.py": { type: "file" as const, content: "def test_health():\n    assert True\n", mode: 0o644, owner: "root", group: "root" },
  "/srv/fleet-api/scripts": { type: "dir" as const, mode: 0o755, owner: "root", group: "root" },
  "/srv/fleet-api/scripts/deploy.sh": { type: "file" as const, content: '#!/bin/sh\n# Requires DEPLOY_TOKEN in the environment.\n[ -z "$DEPLOY_TOKEN" ] && echo "DEPLOY_TOKEN is empty" && exit 1\necho deploying fleet-api\n', mode: 0o755, owner: "root", group: "root" },
  "/srv/fleet-api/.ci": { type: "dir" as const, mode: 0o755, owner: "root", group: "root" },
  "/srv/fleet-api/.ci/pipeline.yml": { type: "file" as const, content: pipelineYml, mode: 0o644, owner: "root", group: "root" },
  "/var/ci": { type: "dir" as const, mode: 0o777, owner: "root", group: "root" },
});

/* ------------------------------------------------------------------ */
/* devops-02: green locally, red in CI                                  */
/* ------------------------------------------------------------------ */

const FLAKY_TEST = `import datetime


def test_next_dispatch_window():
    now = datetime.datetime.now()
    assert 0 <= now.hour <= 23


def test_report_date_is_today():
    # Compares the machine's local date with the UTC date.
    report_date = datetime.datetime.now().strftime("%Y-%m-%d")
    expected = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    assert report_date == expected
`;

const flakyRunner: StepRunner = (step, _pipeline, host) => {
  if (step.name === "install") return { ok: host.exists("/srv/fleet-api/requirements.txt"), lines: ["ok"] };
  if (step.name === "test") {
    const file = host.readFile("/srv/fleet-api/tests/test_schedule.py");
    if (file === null) return { ok: false, lines: ["ERROR: tests/test_schedule.py not found (tests must not be deleted)"] };
    const skipped = /skip|xfail/.test(file);
    const usesLocalTime = /datetime\.now\(\s*\)/.test(file) && !/datetime\.now\(\s*datetime\.timezone\.utc\s*\)/.test(file);
    const testCount = (file.match(/def test_/g) ?? []).length;
    if (skipped) return { ok: true, lines: [`collected ${testCount} items`, "test_schedule.py::test_report_date_is_today SKIPPED", `${testCount} passed/skipped in 0.04s (WARNING: a skipped test hides the defect)`] };
    if (usesLocalTime) return { ok: false, lines: ["collected 3 items", "test_api.py::test_health PASSED", "test_schedule.py::test_next_dispatch_window PASSED", "test_schedule.py::test_report_date_is_today FAILED", "    assert '2026-03-09' == '2026-03-10'", "    (runner clock: 00:40 UTC; datetime.now() uses the runner's local timezone, which is UTC on CI but America/Los_Angeles on your laptop, so the dates differ near midnight)", "1 failed, 2 passed in 0.05s"] };
    return { ok: true, lines: [`collected ${testCount + 1} items`, `${testCount + 1} passed in 0.05s`] };
  }
  if (step.name === "deploy") return { ok: true, lines: ["deploying fleet-api", "ok"] };
  return { ok: true, lines: ["ok"] };
};

/* ------------------------------------------------------------------ */
/* devops-03: bad release, roll back                                    */
/* ------------------------------------------------------------------ */

const RELEASES = ["v2.2.0", "v2.3.1", "v2.4.0"];

const deployctl: SimProgram = {
  summary: "Inspect and change which release is live",
  usage: "deployctl status | deployctl history | deployctl rollback VERSION",
  run: (args, host: ProgramHost) => {
    const current = (host.readFile("/srv/fleet-api/CURRENT") ?? "unknown").trim();
    if (args[0] === "status") return { stdout: `service: fleet-api\ncurrent: ${current} (deployed 2026-03-09 09:02 by deploy-bot)\nprevious: ${RELEASES[RELEASES.indexOf(current) - 1] ?? "n/a"}\nhealth: ${current === "v2.4.0" ? "DEGRADED (error rate 18%)" : "healthy"}\n`, stderr: "", exitCode: 0 };
    if (args[0] === "history") return { stdout: RELEASES.map((r, i) => `${r}  ${["2026-03-01 10:15", "2026-03-07 14:40", "2026-03-09 09:02"][i]}  ${r === current ? "<- live" : ""}`).join("\n") + "\n", stderr: "", exitCode: 0 };
    if (args[0] === "rollback") {
      const target = args[1];
      if (!target) return { stdout: "", stderr: "deployctl: rollback requires a VERSION (see 'deployctl history')\n", exitCode: 2 };
      if (!RELEASES.includes(target)) return { stdout: "", stderr: `deployctl: unknown release ${target}\n`, exitCode: 1 };
      if (host.user !== "root") return { stdout: "", stderr: "deployctl: permission denied (use sudo)\n", exitCode: 1 };
      host.writeFile("/srv/fleet-api/CURRENT", target + "\n", true);
      const log = host.readFile("/var/log/deploy.log") ?? "";
      host.writeFile("/var/log/deploy.log", log + `2026-03-09 09:31 rollback ${current} -> ${target} by ${host.env.USER ?? "trainee"}\n`, true);
      return { stdout: `rolling back fleet-api ${current} -> ${target}\n4/4 workers restarted on ${target}\ndone. verify with 'metrics errors'\n`, stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "usage: deployctl status | history | rollback VERSION\n", exitCode: 2 };
  },
};

const metrics: SimProgram = {
  summary: "Query live service metrics",
  usage: "metrics errors | metrics latency",
  run: (args, host) => {
    const current = (host.readFile("/srv/fleet-api/CURRENT") ?? "").trim();
    const bad = current === "v2.4.0";
    if (args[0] === "errors") return { stdout: `positions-api error_rate (last 5m): ${bad ? "18.2%" : "0.4%"}  release=${current}\n`, stderr: "", exitCode: 0 };
    if (args[0] === "latency") return { stdout: `positions-api p95 (last 5m): ${bad ? "410ms" : "120ms"}  release=${current}\n`, stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "usage: metrics errors | metrics latency\n", exitCode: 2 };
  },
};

/* ------------------------------------------------------------------ */
/* devops-04: broken secret wiring                                      */
/* ------------------------------------------------------------------ */

const SECRET_VALUE = "nf_live_7f3a9c2e1b";

const secretRunner: StepRunner = (step, pipeline, host) => {
  if (step.name === "install") return { ok: true, lines: ["ok"] };
  if (step.name === "test") return { ok: true, lines: ["collected 1 item", "1 passed in 0.02s"] };
  if (step.name === "deploy") {
    const yml = host.readFile("/srv/fleet-api/.ci/pipeline.yml") ?? "";
    if (yml.includes(SECRET_VALUE) || /nf_live_/.test(yml)) return { ok: false, lines: ["secret-scanning: a credential literal was committed in .ci/pipeline.yml; refusing to run", "rotate the token and reference the vault instead: ${{ secrets.NAME }}"] };
    const value = pipeline.env.DEPLOY_TOKEN ?? "";
    const m = value.match(/\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/);
    if (!m) return { ok: false, lines: ["DEPLOY_TOKEN is empty: pipeline env does not reference a vault secret", "exit code 1"] };
    const vault = host.readFile("/etc/ci/secrets.env") ?? "";
    const found = new RegExp(`^${m[1]}=`, "m").test(vault);
    if (!found) return { ok: false, lines: [`DEPLOY_TOKEN is empty: secret '${m[1]}' not found in vault`, "exit code 1"] };
    return { ok: true, lines: ["deploying fleet-api with DEPLOY_TOKEN=**** (from vault)", "ok"] };
  }
  return { ok: true, lines: ["ok"] };
};

/* ------------------------------------------------------------------ */

export const cicdMissions: InvestigationMission[] = [
  {
    id: "devops-02-green-locally-red-in-ci",
    kind: "investigation",
    trackId: "devops",
    stage: 4,
    title: "Green on my laptop, red in CI: fix a flaky test properly",
    summary: "A test passes locally and fails in CI. Find the environmental dependency, fix the test, and resist retrying or skipping.",
    briefing: `${COMPANY_INTRO}\n\nMarco's pull request is blocked: the pipeline fails on a test that passes on his laptop. He has asked whether you can just retry the job or mark the test as skipped so the release can go out. Read the CI log, understand why the test is environment-dependent, and fix the cause.`,
    objectives: [
      "Read the last CI run log and identify the failing test and its message",
      "Find the environmental dependency in tests/test_schedule.py",
      "Fix the test so it is correct on any machine and timezone, without deleting or skipping it",
      "Re-run the pipeline with ci run and confirm SUCCESS",
    ],
    skills: ["devops.testing", "devops.cicd"],
    prerequisites: ["devops-01-broken-pipeline"],
    estimatedMinutes: 20,
    commandsIntroduced: ["ci run", "ci log", "grep -n", "sed -i"],
    lesson: [
      { title: "Why CI disagrees with your laptop", body: "CI runners are clean machines: UTC clock, no cached files, no local config. A test that passes locally and fails in CI almost always depends on something that differs: timezone, locale, ordering, network, leftover files, or wall-clock time. The log tells you which." },
      { title: "Retry and skip are not fixes", body: "Retrying a failing job only works if the failure is random. A timezone bug fails every time the dates differ, and *passing* at other hours hides a real defect in the product. Skipping or deleting the test removes the only thing that would catch it. The fix is to make the test deterministic: use the same clock the code uses (UTC), or inject the time." },
      { title: "Fixing in place", body: "`datetime.datetime.now()` uses the machine's local timezone; `datetime.datetime.now(datetime.timezone.utc)` does not. Edit with `sudo sed -i 's/old/new/' FILE` or `sudo nano FILE`, then `ci run`." },
    ],
    glossary: [
      { term: "flaky test", definition: "A test whose result depends on something other than the code under test (time, order, environment)." },
      { term: "deterministic", definition: "Produces the same result every run given the same inputs." },
      { term: "CI runner", definition: "The machine that executes pipeline steps; typically ephemeral and set to UTC." },
    ],
    hints: [
      { level: 1, title: "Read the log", body: "`ci log` (or `cat /var/ci/last-run.log`). Which test failed and what do the two dates in the assertion tell you?" },
      { level: 2, title: "Local vs UTC", body: "`grep -n now /srv/fleet-api/tests/test_schedule.py`. One side of the comparison uses local time, the other UTC. Near midnight in Los Angeles they are different days." },
      { level: 3, title: "Make both sides UTC", body: "Replace the local-time call with a UTC one, keep the test, then `ci run`. Marco's retry idea will fail the same way at the same hours." },
      { level: 4, title: "Guided example", body: "```\nci log\ngrep -n now /srv/fleet-api/tests/test_schedule.py\nsudo sed -i 's/datetime.datetime.now()/datetime.datetime.now(datetime.timezone.utc)/' /srv/fleet-api/tests/test_schedule.py\ngrep -n now /srv/fleet-api/tests/test_schedule.py\nci run\n```" },
    ],
    reflectionPrompts: ["Explain how you proved the test was environment-dependent rather than random, and why you refused the retry-or-skip shortcut."],
    transferNote: "'Works on my machine' is the most common CI argument in real teams; being able to show the environmental cause ends it.",
    world: {
      hostname: "ci-runner-01",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        ...baseRepo("steps:\n  - name: install\n    run: pip install -r requirements.txt\n  - name: test\n    run: python -m pytest tests/\n  - name: deploy\n    run: ./scripts/deploy.sh\n"),
        "/srv/fleet-api/tests/test_schedule.py": { type: "file", content: FLAKY_TEST, mode: 0o644, owner: "root", group: "root" },
        "/srv/fleet-api/.git-log": { type: "file", content: "c41e90 2026-03-09 marco   feat: nightly report date helper + tests\na1f3c2 2026-03-07 priya   chore: rename test/ to tests/\n", mode: 0o644, owner: "root", group: "root" },
        "/var/ci/run-counter": { type: "file", content: "131", mode: 0o644, owner: "root", group: "root" },
        "/var/ci/last-run.log": { type: "file", content: "=== pipeline run #131 (2026-03-09 00:40) ===\n[install] pip install -r requirements.txt\n[install] ok\n[test] python -m pytest tests/\n[test] collected 3 items\n[test] test_api.py::test_health PASSED\n[test] test_schedule.py::test_next_dispatch_window PASSED\n[test] test_schedule.py::test_report_date_is_today FAILED\n[test]     assert '2026-03-09' == '2026-03-10'\n[test]     (runner clock: 00:40 UTC; datetime.now() uses the runner's local timezone, which is UTC on CI but America/Los_Angeles on your laptop, so the dates differ near midnight)\n[test] 1 failed, 2 passed in 0.05s\n=== RESULT: FAILURE at step 'test' ===\n", mode: 0o644, owner: "root", group: "root" },
        "/home/trainee/notes.txt": { type: "file", content: "Marco (Slack 00:52): the schedule tests pass on my laptop (TZ=America/Los_Angeles). Can we just retry the job, or @skip the test so the release can go out?\n" },
      },
      programs: { ci: makeCiProgram({ ...CI_PATHS, runner: flakyRunner }) },
    },
    steps: [
      {
        id: "diagnose",
        prompt: "Read the CI log and locate the environmental dependency.",
        checks: [
          { id: "read-log", label: "Read the failing CI log", test: (c) => c.outputs.some((o) => /ci\s+log|last-run\.log/.test(o.command) && o.stdout.includes("FAILED")) },
          { id: "inspected-test", label: "Inspected tests/test_schedule.py", test: (c) => c.outputs.some((o) => /test_schedule\.py/.test(o.command) && /now/.test(o.stdout)) },
        ],
      },
      {
        id: "fix",
        prompt: "Fix the test's cause, keep the test, and get the pipeline green.",
        checks: [
          { id: "utc", label: "The test compares UTC with UTC (no bare datetime.now())", test: (c) => { const f = c.readFile("/srv/fleet-api/tests/test_schedule.py") ?? ""; return !/datetime\.now\(\s*\)/.test(f) && /utc/i.test(f); } },
          { id: "kept", label: "Both tests still exist; nothing skipped or deleted", test: (c) => { const f = c.readFile("/srv/fleet-api/tests/test_schedule.py") ?? ""; return (f.match(/def test_/g) ?? []).length === 2 && !/skip|xfail/.test(f); } },
          { id: "green", label: "A new CI run (after #131) reports SUCCESS", test: (c) => { const log = c.readFile("/var/ci/last-run.log") ?? ""; const n = parseInt(log.match(/run #(\d+)/)?.[1] ?? "0", 10); return { passed: n > 131 && /RESULT: SUCCESS/.test(log), detail: n > 131 ? (/SUCCESS/.test(log) ? "green" : `run #${n} still failing`) : "run 'ci run'" }; } },
        ],
        question: {
          prompt: "Marco suggested retrying the job. Why is that not a fix?",
          options: [
            "Because the failure is deterministic for the runner's timezone and hour: retrying only passes at some hours and hides a real date bug",
            "Because CI jobs can only be run once",
            "Because retries cost too much money",
            "Because tests should never use dates",
          ],
          correctIndex: 0,
          explanation: "The test fails whenever local and UTC dates differ. A retry that happens to pass does not remove the defect; a deterministic test does.",
        },
      },
    ],
  },
  {
    id: "devops-03-bad-release-rollback",
    kind: "investigation",
    trackId: "devops",
    stage: 5,
    title: "Bad release: roll back fast, then fix forward",
    summary: "Errors spiked right after a deploy. Confirm the correlation, roll back to the last good release, verify, and record the incident.",
    briefing: `${COMPANY_INTRO}\n\nAt 09:02 deploy-bot shipped fleet-api v2.4.0. Since then the positions API error rate is 18%. Dispatchers are calling. Your job as responder: restore service first, investigate second, and leave a record so the fix-forward can be planned.`,
    objectives: [
      "Correlate the error spike with the deploy using the API log and metrics",
      "Roll back to the last known-good release with deployctl",
      "Verify recovery with the same metric that showed the problem",
      "Write ~/incident/rollback.md naming the bad and good releases and the next step",
    ],
    skills: ["devops.release", "devops.monitoring"],
    prerequisites: ["devops-02-green-locally-red-in-ci"],
    estimatedMinutes: 15,
    commandsIntroduced: ["deployctl", "metrics", "grep", "tail"],
    lesson: [
      { title: "Restore first, debug later", body: "When a deploy correlates with user-facing errors, the fastest safe action is a rollback to the previous release. You do not need to understand the bug to roll back; you need evidence that the deploy is the trigger (timing) and a known-good version to return to." },
      { title: "Verify with the signal that paged you", body: "After rolling back, check the same metric that showed the problem (error rate), not a different one. 'The deploy finished' is not recovery; 'error rate back to baseline' is." },
      { title: "Fix forward, with guards", body: "Rolling back buys time. The bad release needs a fix, a regression test that fails on the old behaviour, and a safer rollout (canary or staged) so the next attempt cannot take down everyone at once." },
    ],
    glossary: [
      { term: "rollback", definition: "Redeploying the previous known-good release." },
      { term: "canary", definition: "Rolling a release to a small slice of traffic first and watching metrics before continuing." },
      { term: "fix forward", definition: "Shipping a corrected new release instead of (or after) rolling back." },
    ],
    hints: [
      { level: 1, title: "Correlate", body: "`metrics errors` and `grep -c ERROR /var/log/fleet/api.log`. Do the errors start right after 09:02? `deployctl status` shows what is live." },
      { level: 2, title: "Roll back", body: "`deployctl history` lists releases. Rolling back needs root: `sudo deployctl rollback v2.3.1`." },
      { level: 3, title: "Verify and record", body: "Run `metrics errors` again and confirm 0.4%. Then `mkdir -p ~/incident` and write rollback.md naming v2.4.0, v2.3.1 and the next step." },
      { level: 4, title: "Guided example", body: "```\nmetrics errors\ngrep ERROR /var/log/fleet/api.log | head -n 3\ndeployctl status\ndeployctl history\nsudo deployctl rollback v2.3.1\nmetrics errors\nmkdir -p ~/incident\necho \"Rolled back fleet-api v2.4.0 to v2.3.1 at 09:31 after error rate hit 18% post-deploy; verified 0.4%. Next: fix PositionSerializer bug, add regression test, canary the re-release.\" > ~/incident/rollback.md\n```" },
    ],
    reflectionPrompts: ["Describe how you decided to roll back rather than debug live, how you verified recovery, and what you would require before re-releasing."],
    transferNote: "Release management interviews often ask exactly this: how do you decide to roll back, and how do you know you recovered?",
    world: {
      hostname: "deploy-01",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        "/srv/fleet-api": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/srv/fleet-api/CURRENT": { type: "file", content: "v2.4.0\n", mode: 0o644, owner: "root", group: "root" },
        "/srv/fleet-api/releases": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/srv/fleet-api/releases/v2.3.1": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/srv/fleet-api/releases/v2.3.1/RELEASE_NOTES": { type: "file", content: "v2.3.1: cache TTL jitter\n", mode: 0o644, owner: "root", group: "root" },
        "/srv/fleet-api/releases/v2.4.0": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/srv/fleet-api/releases/v2.4.0/RELEASE_NOTES": { type: "file", content: "v2.4.0: new PositionSerializer (faster JSON)\n", mode: 0o644, owner: "root", group: "root" },
        "/var/log/fleet": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/var/log/fleet/api.log": { type: "file", content: generateReleaseLog(), mode: 0o644, owner: "root", group: "root" },
        "/var/log/deploy.log": { type: "file", content: "2026-03-07 14:40 deploy v2.3.1 by deploy-bot\n2026-03-09 09:02 deploy v2.4.0 by deploy-bot\n", mode: 0o644, owner: "root", group: "root" },
        "/home/trainee/README-oncall.txt": { type: "file", content: "On-call tools: deployctl (status/history/rollback), metrics (errors/latency). Record incidents in ~/incident/.\n" },
      },
      programs: { deployctl, metrics },
    },
    steps: [
      {
        id: "correlate",
        prompt: "Confirm the deploy correlates with the error spike.",
        checks: [
          { id: "metrics-before", label: "Checked error metrics or the API log while v2.4.0 was live", test: (c) => c.outputs.some((o) => (/metrics\s+errors/.test(o.command) && o.stdout.includes("18.2%")) || (/api\.log/.test(o.command) && /ERROR/.test(o.stdout))) },
          { id: "status", label: "Checked which release is live (deployctl status/history)", test: (c) => c.history.some((h) => /deployctl\s+(status|history)/.test(h)) },
        ],
      },
      {
        id: "restore",
        prompt: "Roll back, verify, and record.",
        checks: [
          { id: "rolled-back", label: "Live release is v2.3.1", test: (c) => (c.readFile("/srv/fleet-api/CURRENT") ?? "").trim() === "v2.3.1" },
          { id: "verified", label: "Verified error rate back to 0.4% after the rollback", test: (c) => { const i = c.outputs.findIndex((o) => /deployctl\s+rollback\s+v2\.3\.1/.test(o.command) && o.exitCode === 0); return i >= 0 && c.outputs.slice(i + 1).some((o) => /metrics\s+errors/.test(o.command) && o.stdout.includes("0.4%")); } },
          { id: "note", label: "~/incident/rollback.md names v2.4.0, v2.3.1 and a next step (≥ 60 chars)", test: (c) => { const n = c.readFile("/home/trainee/incident/rollback.md") ?? ""; return n.includes("v2.4.0") && n.includes("v2.3.1") && n.trim().length >= 60; } },
        ],
        question: {
          prompt: "What should happen before v2.4.0 (or a fixed v2.4.1) ships again?",
          options: [
            "Fix the bug, add a regression test that fails on the old behaviour, and roll out gradually (canary) while watching error rate",
            "Deploy it again at a quieter time of day",
            "Nothing; the rollback fixed it",
            "Disable error alerts during the next deploy",
          ],
          correctIndex: 0,
          explanation: "Rollback restores service; it does not fix the code. A regression test and a staged rollout stop the same bug from paging everyone again.",
        },
      },
    ],
  },
  {
    id: "devops-04-secret-wiring",
    kind: "investigation",
    trackId: "devops",
    stage: 5,
    title: "Deploy cannot authenticate: fix the secret wiring without leaking the secret",
    summary: "The deploy step fails because the pipeline references a renamed vault secret. Fix the reference; never paste the token into the pipeline.",
    briefing: `${COMPANY_INTRO}\n\nEvery pipeline run since this morning fails at the deploy step with 'DEPLOY_TOKEN is empty'. A teammate pasted the token value from the vault into chat and suggested hardcoding it in pipeline.yml 'just to unblock the release'. Investigate why the deploy cannot find the token, fix the configuration properly, and get the pipeline green.`,
    objectives: [
      "Read the CI log and identify which secret the deploy step cannot find",
      "Find the recent change that renamed the secret",
      "Point the pipeline at the correct vault secret name; do not commit the token value",
      "Run ci run and confirm SUCCESS",
    ],
    skills: ["devops.config", "netsec.authz"],
    prerequisites: ["devops-03-bad-release-rollback"],
    estimatedMinutes: 15,
    commandsIntroduced: ["ci log", "sudo cat", "sed -i", "ci run"],
    lesson: [
      { title: "Secrets belong in a vault, referenced by name", body: "Pipelines should reference secrets by name (`${{ secrets.NAME }}`) so the value is injected at run time from a vault with access controls and audit logs. Pasting a value into a YAML file commits it to git history forever, exposes it to everyone who can read the repo or the logs, and makes rotation painful." },
      { title: "Renames break references", body: "When a secret is renamed in the vault, every pipeline that referenced the old name silently receives an empty value. The CI log names the missing secret; the repo's change log names the rename. The fix is a one-line reference update." },
      { title: "Least privilege applies to CI", body: "A deploy token should only be able to deploy. Store it in the vault, scope it narrowly, rotate it when it has been exposed (for example, pasted in chat)." },
    ],
    glossary: [
      { term: "vault", definition: "A service that stores secrets and injects them into jobs that are allowed to use them." },
      { term: "secret scanning", definition: "Tooling that refuses commits or runs containing credential-looking strings." },
      { term: "rotation", definition: "Replacing a credential with a new one and revoking the old." },
    ],
    hints: [
      { level: 1, title: "Read the log", body: "`ci log` tells you exactly which secret name the deploy step looked up." },
      { level: 2, title: "Find the rename", body: "`cat /srv/fleet-api/.git-log` and `sudo cat /etc/ci/secrets.env` (names only matter). The pipeline references DEPLOY_API_TOKEN; the vault now has DEPLOY_TOKEN." },
      { level: 3, title: "Fix the reference, not the value", body: "`sudo sed -i 's/secrets.DEPLOY_API_TOKEN/secrets.DEPLOY_TOKEN/' /srv/fleet-api/.ci/pipeline.yml` then `ci run`. If you paste the token value, secret scanning will fail the run and the token must be rotated." },
      { level: 4, title: "Guided example", body: "```\nci log\ncat /srv/fleet-api/.git-log\nsudo cat /etc/ci/secrets.env\ngrep -n secrets /srv/fleet-api/.ci/pipeline.yml\nsudo sed -i 's/secrets.DEPLOY_API_TOKEN/secrets.DEPLOY_TOKEN/' /srv/fleet-api/.ci/pipeline.yml\nci run\n```" },
    ],
    reflectionPrompts: ["Explain how you found the broken secret reference and why you refused to hardcode the token even under release pressure."],
    transferNote: "Secret handling under deadline pressure is a classic Earn Trust / Insist on the Highest Standards story when told honestly.",
    world: {
      hostname: "ci-runner-01",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        ...baseRepo("env:\n  DEPLOY_TOKEN: ${{ secrets.DEPLOY_API_TOKEN }}\nsteps:\n  - name: install\n    run: pip install -r requirements.txt\n  - name: test\n    run: python -m pytest tests/\n  - name: deploy\n    run: ./scripts/deploy.sh\n"),
        "/srv/fleet-api/.git-log": { type: "file", content: "e7b210 2026-03-08 priya   chore(ci): rename vault secret DEPLOY_API_TOKEN -> DEPLOY_TOKEN (old name removed)\nc41e90 2026-03-07 marco   feat: nightly report date helper\n", mode: 0o644, owner: "root", group: "root" },
        "/etc/ci": { type: "dir", mode: 0o700, owner: "root", group: "root" },
        "/etc/ci/secrets.env": { type: "file", content: `# CI vault export (root only). Values are injected at run time.\nDEPLOY_TOKEN=${SECRET_VALUE}\nSLACK_WEBHOOK=https://hooks.example.invalid/XXXX\n`, mode: 0o600, owner: "root", group: "root" },
        "/var/ci/run-counter": { type: "file", content: "140", mode: 0o644, owner: "root", group: "root" },
        "/var/ci/last-run.log": { type: "file", content: "=== pipeline run #140 (2026-03-09 08:10) ===\n[install] pip install -r requirements.txt\n[install] ok\n[test] python -m pytest tests/\n[test] collected 1 item\n[test] 1 passed in 0.02s\n[deploy] ./scripts/deploy.sh\n[deploy] DEPLOY_TOKEN is empty: secret 'DEPLOY_API_TOKEN' not found in vault\n[deploy] exit code 1\n=== RESULT: FAILURE at step 'deploy' ===\n", mode: 0o644, owner: "root", group: "root" },
        "/home/trainee/chat.txt": { type: "file", content: `Jordan (Slack 08:15): deploy is broken, token from the vault is ${SECRET_VALUE} - just put it in pipeline.yml so we can ship?\n`, mode: 0o644 },
      },
      programs: { ci: makeCiProgram({ ...CI_PATHS, runner: secretRunner }) },
    },
    steps: [
      {
        id: "diagnose",
        prompt: "Find out why the deploy step has no token.",
        checks: [
          { id: "read-log", label: "Read the failing CI log", test: (c) => c.outputs.some((o) => /ci\s+log|last-run\.log/.test(o.command) && o.stdout.includes("not found in vault")) },
          { id: "rename", label: "Found the rename (git log or vault names)", test: (c) => c.outputs.some((o) => (/\.git-log/.test(o.command) && /rename/.test(o.stdout)) || (/secrets\.env/.test(o.command) && /DEPLOY_TOKEN=/.test(o.stdout))) },
        ],
      },
      {
        id: "fix",
        prompt: "Fix the reference safely and get the pipeline green.",
        checks: [
          { id: "reference", label: "pipeline.yml references ${{ secrets.DEPLOY_TOKEN }}", test: (c) => /secrets\.DEPLOY_TOKEN\s*\}\}/.test(c.readFile("/srv/fleet-api/.ci/pipeline.yml") ?? "") },
          { id: "no-literal", label: "No token value committed in pipeline.yml", test: (c) => !/nf_live_/.test(c.readFile("/srv/fleet-api/.ci/pipeline.yml") ?? "") },
          { id: "green", label: "A new CI run reports SUCCESS", test: (c) => { const log = c.readFile("/var/ci/last-run.log") ?? ""; const n = parseInt(log.match(/run #(\d+)/)?.[1] ?? "0", 10); return { passed: n > 140 && /RESULT: SUCCESS/.test(log), detail: n > 140 ? (/SUCCESS/.test(log) ? "green" : `run #${n} still failing`) : "run 'ci run'" }; } },
        ],
        question: {
          prompt: "The token was pasted in chat. What else should happen besides fixing the reference?",
          options: [
            "Rotate the token in the vault, because a credential shared in chat must be treated as exposed",
            "Nothing; chat is private",
            "Add the token to the README so nobody loses it again",
            "Disable secret scanning so it does not block releases",
          ],
          correctIndex: 0,
          explanation: "A secret that has been copied into chat or a commit is exposed; rotate it and keep the only copy in the vault.",
        },
      },
    ],
  },
];

function generateReleaseLog(): string {
  const lines: string[] = [];
  for (let i = 0; i < 40; i++) {
    const m = String(Math.floor(i / 4)).padStart(2, "0");
    const s = String((i * 13) % 60).padStart(2, "0");
    const hour = i < 8 ? "08:5" + (i % 10) : "09:" + m;
    const ts = `2026-03-09T${hour}:${s}Z`;
    if (i < 8) lines.push(`${ts} INFO GET /v1/positions 200 11ms release=v2.3.1`);
    else if (i === 8) lines.push(`2026-03-09T09:02:00Z INFO deploy fleet-api v2.4.0 started`, `2026-03-09T09:02:40Z INFO deploy fleet-api v2.4.0 complete`);
    else if (i % 5 !== 0) lines.push(`${ts} ERROR PositionSerializer: 'NoneType' object has no attribute 'lat' (release=v2.4.0)`);
    else lines.push(`${ts} INFO GET /v1/positions 200 14ms release=v2.4.0`);
  }
  return lines.join("\n") + "\n";
}
