import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end acceptance checks (Part 20). Runs against the production build.
 * Voice features cannot be exercised headlessly; the text fallback is used.
 */

async function onboard(page: Page, name = "Sam") {
  await page.goto("/#/");
  await expect(page).toHaveURL(/#\/onboarding/);
  await page.getByLabel("What should we call you?").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  // Answer the placement check (pick the first option each time; correctness does not matter).
  for (let i = 1; i <= 6; i++) {
    await page.locator(`input[name="q${i}"]`).first().check();
  }
  await page.getByRole("button", { name: "See results" }).click();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.getByText(`Welcome back, ${name}`)).toBeVisible();
}

test("1-2: opens in a browser and starts as a beginner with guidance", async ({ page }) => {
  await onboard(page);
  await expect(page.getByTestId("continue-learning")).toBeVisible();
  await expect(page.getByText("Recommended next")).toBeVisible();
});

test("3, 7: completes a real Linux terminal mission and progress survives reload", async ({ page }) => {
  await onboard(page);
  await page.getByTestId("continue-learning").click();
  await expect(page).toHaveURL(/missions\/linux-01-find-your-way/);
  const input = page.getByTestId("terminal-input");
  for (const cmd of ["pwd", "ls", "cd ops", "ls", "cd handover", "cat runbook.md", "echo READY > ~/ops/ack.txt"]) {
    await input.fill(cmd);
    await input.press("Enter");
  }
  await expect(page.getByText("Checks (3/3)")).toBeVisible();
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
  await page.reload();
  await page.goto("/#/missions");
  await expect(page.getByText("Completed").first()).toBeVisible();
  await page.goto("/#/progress");
  await expect(page.getByText("Terminal navigation").first()).toBeVisible();
});

test("4, 6: writes and runs real Python code with assessment feedback", async ({ page }) => {
  test.setTimeout(180_000);
  await onboard(page);
  await page.goto("/#/missions/python-01-uptime-report");
  await expect(page.getByText(/Python .*ready/)).toBeVisible({ timeout: 120_000 });
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    'def format_uptime(seconds):\n    days = seconds // 86400\n    hours = (seconds % 86400) // 3600\n    minutes = (seconds % 3600) // 60\n    return f"{days}d {hours}h {minutes}m"\n\ndef report(name, seconds):\n    return f"{name}: up {format_uptime(seconds)}"\n\nprint(report("fleet-api-02", 273900))\n',
  );
  await page.getByTestId("python-run").click();
  await expect(page.getByTestId("python-stdout")).toContainText("fleet-api-02: up 3d 4h 5m", { timeout: 60_000 });
  await page.getByTestId("python-run-tests").click();
  await expect(page.getByText("Checks (4/4)")).toBeVisible({ timeout: 60_000 });
  // Error feedback path
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("print(undefined_name)\n");
  await page.getByTestId("python-run").click();
  await expect(page.getByTestId("python-error")).toContainText("NameError", { timeout: 60_000 });
  await expect(page.getByText("About this NameError")).toBeVisible();
});

test("5: explores Big O interactively", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/algorithms");
  await page.getByLabel("Algorithm").selectOption("binary-search");
  await page.getByLabel(/Input size n/).fill("16");
  await page.getByTestId("bigo-run").click();
  await expect(page.getByTestId("bigo-result")).toBeVisible();
  await page.getByTestId("bigo-step").click();
  await expect(page.getByText(/step 2 \//)).toBeVisible();
});

test("8-17: Interview Command Center, STAR, voice/text answer, Dive Deeper, feedback, stories", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/interview");
  await expect(page.getByRole("heading", { name: "Interview Command Center" })).toBeVisible();
  await page.goto("/#/interview/principles/ownership");
  await expect(page.getByText("Official description")).toBeVisible();

  // Story bank
  await page.goto("/#/interview/stories");
  await page.getByTestId("story-new").click();
  await page.getByTestId("story-title").fill("Recovered the capstone demo server");
  await page.getByTestId("story-situation").fill("The night before our capstone demo the server went down.");
  await page.getByTestId("story-action").fill("I checked the logs, found the disk was full, moved old logs and restarted the service.");
  await page.getByTestId("story-save").click();
  await expect(page.getByTestId("story-list")).toContainText("Recovered the capstone demo server");

  // Practice with Dive Deeper (text fallback)
  await page.goto("/#/interview/practice?mode=practice");
  await page.getByTestId("mode-practice").click();
  await page.getByTestId("start-session").click();
  await expect(page).toHaveURL(/interview\/practice\/session_/);
  await page.getByTestId("answer-input").fill("Our system stopped working, and we fixed it. Everything worked out.");
  await page.getByTestId("answer-submit").click();
  await expect(page.getByText(/Dive Deeper follow-up/)).toBeVisible();
  await page.getByTestId("answer-input").fill("I was responsible for checking the server. I checked the logs first and saw database timeout errors, so I traced them to cache expiry.");
  await page.getByTestId("answer-submit").click();
  await page.getByTestId("stop-probing").click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await expect(page.getByText("Revised answer outline")).toBeVisible();
  await expect(page.getByText(/cannot verify/)).toBeVisible();

  // History
  await page.goto("/#/interview/history");
  await expect(page.getByTestId("history-list")).toContainText("practice");
});

test("18-20: progress history and feature status are visible; mobile layout renders", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/settings");
  await expect(page.getByText("About: what works today")).toBeVisible();
  await expect(page.getByText("Terminal simulator")).toBeVisible();
  await page.goto("/#/progress");
  await expect(page.getByRole("heading", { name: "Skill Progress" })).toBeVisible();
});

test("keyboard navigation: skip link and nav are reachable", async ({ page }, testInfo) => {
  await onboard(page);
  const skip = page.getByText("Skip to content");
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible(); // visually hidden until focused
  if (testInfo.project.name === "desktop") {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeVisible();
});

test("retention check: fresh replay without hints raises mastery", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/missions/linux-01-find-your-way");
  const input = page.getByTestId("terminal-input");
  for (const cmd of ["cd ops/handover", "cat runbook.md", "echo READY > ~/ops/ack.txt"]) {
    await input.fill(cmd);
    await input.press("Enter");
  }
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();

  await page.goto("/#/missions/linux-01-find-your-way?retention=1");
  await expect(page.getByText("Retention check", { exact: true })).toBeVisible();
  await expect(page.getByTestId("hints-disabled")).toBeVisible();
  await expect(page.getByText("Checks (0/3)")).toBeVisible(); // fresh environment
  for (const cmd of ["cd ops/handover", "cat runbook.md", "echo READY > ~/ops/ack.txt"]) {
    await input.fill(cmd);
    await input.press("Enter");
  }
  await expect(page.getByText("Checks (3/3)")).toBeVisible();
  await page.getByRole("button", { name: "Confirm retention check" }).click();
  await expect(page.getByText("Retention check passed")).toBeVisible();
  await page.goto("/#/progress");
  await expect(page.getByText(/1 evidence item|2 evidence item/).first()).toBeVisible();
});

test("target role: pick the serverless posting, see its gap map, switch roles in Settings", async ({ page }) => {
  await page.goto("/#/");
  await expect(page).toHaveURL(/#\/onboarding/);
  await page.getByLabel("What should we call you?").fill("Sam");
  await page.getByTestId("role-sde2-serverless").check();
  await page.getByRole("button", { name: "Continue" }).click();
  for (let i = 1; i <= 6; i++) await page.locator(`input[name="q${i}"]`).first().check();
  await page.getByRole("button", { name: "See results" }).click();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.getByText("Target role: System Development Engineer II, Lambda/Serverless")).toBeVisible();
  await expect(page.getByTestId("role-weakest")).toBeVisible();
  await page.goto("/#/paths");
  await expect(page.getByTestId("role-title")).toHaveText("System Development Engineer II, Lambda/Serverless");
  await expect(page.getByTestId("gap-b6")).toContainText("Not addressable in OpsForge");
  await expect(page.getByTestId("gap-b6")).toContainText("Top Secret with SCI");
  await expect(page.getByTestId("gap-p2")).toContainText("Planned, not built");
  await expect(page.getByTestId("gap-b4")).toContainText("Trainable here");
  await expect(page.getByTestId("gap-b4")).toContainText("Your first script: an uptime report");
  await page.getByTestId("role-select").selectOption("ops-automation");
  await expect(page.getByTestId("role-title")).toHaveText("Target posting (title not provided)");
  await page.goto("/#/settings");
  await expect(page.getByTestId("settings-role-ops-automation")).toBeChecked();
  // Controlled radio: the checked state follows the persisted profile, so click and wait for it.
  await page.getByTestId("settings-role-sde2-serverless").click();
  await expect(page.getByTestId("settings-role-sde2-serverless")).toBeChecked();
  await page.goto("/#/");
  await expect(page.getByText("Target role: System Development Engineer II, Lambda/Serverless")).toBeVisible();
});

test("incident console: investigate, remediate the cause, verify recovery, write the note", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.goto("/#/missions/incident-01-cache-stampede");
  await expect(page.getByText("Locked")).toBeVisible();

  // Unlock the incident by importing a progress bundle through Settings (the app's own import path).
  const now = new Date().toISOString();
  const bundle = {
    app: "opsforge",
    schemaVersion: 1,
    exportedAt: now,
    missions: ["linux-01-find-your-way", "linux-02-log-detective", "linux-03-locked-out", "devops-01-broken-pipeline"].map((missionId) => ({
      missionId,
      schemaVersion: 1,
      status: "completed",
      attempts: 1,
      hintsUsed: 0,
      maxHintLevel: 0,
      bestScore: 1,
      startedAt: now,
      completedAt: now,
      reflections: [],
    })),
  };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*4 mission records/)).toBeVisible();

  await page.goto("/#/missions/incident-01-cache-stampede");
  await expect(page.getByText("Incident console")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("incident-health")).not.toHaveText("healthy");
  await page.getByTestId("tab-logs").click();
  await expect(page.getByTestId("incident-logs")).toContainText("keys expired");
  await page.getByTestId("tab-metrics").click();
  await expect(page.getByTestId("metrics-grid")).toBeVisible();
  await page.getByTestId("tab-diagram").click();
  await expect(page.getByTestId("node-cache")).toBeVisible();
  await page.getByTestId("root-cause-1").check();
  await expect(page.getByText(/^Correct\./)).toBeVisible();
  await page.getByTestId("act-cache").click();
  await page.getByTestId("advance-10").click();
  await expect(page.getByTestId("incident-health")).toHaveText("healthy", { timeout: 20_000 });
  await page.getByTestId("postmortem").fill("What: positions API slow after deploy. Why: cache keys expired together, overloading the database. Fix: re-warmed cache with jittered TTLs. Prevention: jitter TTLs in the deploy and alert on hit ratio.");
  await expect(page.getByText("Checks (5/5)")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
});

test("incident console: replication lag is fixed at the cause without failing over", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  const now = new Date().toISOString();
  const done = (missionId: string) => ({ missionId, schemaVersion: 1, status: "completed", attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] });
  const bundle = { app: "opsforge", schemaVersion: 1, exportedAt: now, missions: ["linux-01-find-your-way", "linux-02-log-detective", "linux-03-locked-out", "devops-01-broken-pipeline", "incident-01-cache-stampede", "incident-02-traffic-surge", "incident-03-dead-consumers"].map(done) };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*7 mission records/)).toBeVisible();

  await page.goto("/#/missions/incident-04-replica-lag");
  await expect(page.getByText("Incident console")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("incident-health")).toHaveText("degraded");
  await page.getByTestId("tab-logs").click();
  await expect(page.getByTestId("incident-logs")).toContainText("apply thread waiting for lock");
  await expect(page.getByTestId("incident-logs")).toContainText("data age");
  await page.getByTestId("tab-metrics").click();
  await expect(page.getByTestId("stat-replica")).toContainText(/[4-9][0-9]s/);
  await page.getByTestId("tab-diagram").click();
  await expect(page.getByTestId("node-replica")).toContainText("apply BLOCKED");
  await page.getByTestId("root-cause-2").check();
  await expect(page.getByText(/^Correct\./)).toBeVisible();
  await page.getByTestId("act-kill-query").click();
  for (let i = 0; i < 3; i++) await page.getByTestId("advance-10").click();
  await expect(page.getByTestId("incident-health")).toHaveText("healthy", { timeout: 20_000 });
  await page.getByTestId("postmortem").fill("What: live map a minute stale. Why: an analytics query held a lock the replica apply thread needed, so replication stalled. Fix: killed the statement; did not fail over because the standby was behind. Prevention: statement timeout on the replica, alert on lag.");
  await expect(page.getByText("Checks (5/5)")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
});

test("CI/CD: a flaky test is fixed at the cause, not retried or skipped", async ({ page }) => {
  await onboard(page);
  const now = new Date().toISOString();
  const done = (missionId: string) => ({ missionId, schemaVersion: 1, status: "completed", attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] });
  const bundle = { app: "opsforge", schemaVersion: 1, exportedAt: now, missions: ["linux-01-find-your-way", "linux-02-log-detective", "linux-03-locked-out", "devops-01-broken-pipeline"].map(done) };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*4 mission records/)).toBeVisible();

  await page.goto("/#/missions/devops-02-green-locally-red-in-ci");
  const input = page.getByTestId("terminal-input");
  const run = async (cmd: string) => {
    await input.fill(cmd);
    await input.press("Enter");
  };
  await run("ci log");
  await run("ci run"); // retrying does not help
  await run("grep -n now /srv/fleet-api/tests/test_schedule.py");
  await expect(page.getByText("Checks (3/6)")).toBeVisible();
  await run("sudo sed -i 's/datetime.datetime.now()/datetime.datetime.now(datetime.timezone.utc)/' /srv/fleet-api/tests/test_schedule.py");
  await run("ci run");
  await page.getByLabel(/Because the failure is deterministic/).check();
  await expect(page.getByText("Checks (6/6)")).toBeVisible();
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
});

test("Go Laboratory: runs real Go with goroutines in the browser and reports compile errors", async ({ page }) => {
  test.setTimeout(180_000);
  await onboard(page);
  await page.goto("/#/go");
  await expect(page.getByTestId("go-status")).toContainText("Go ready", { timeout: 120_000 });
  await page.getByTestId("go-run").click();
  await expect(page.getByTestId("python-stdout")).toContainText("processed 5 jobs with 3 workers", { timeout: 60_000 });
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText('package main\nimport "fmt"\nfunc main() { fmt.Println(nope) }\n');
  await page.getByTestId("go-run").click();
  await expect(page.getByTestId("python-error")).toContainText("undefined: nope", { timeout: 60_000 });
  await expect(page.getByText("About this undefined identifier")).toBeVisible();
  // Race detector panel: disabled until the local service is configured in Settings.
  await expect(page.getByTestId("race-unconfigured")).toBeVisible();
  await expect(page.getByTestId("race-run")).toBeDisabled();
  await page.goto("/#/settings");
  await page.getByTestId("race-url").fill("http://127.0.0.1:9");
  await page.goto("/#/go");
  await expect(page.getByTestId("go-status")).toContainText("Go ready", { timeout: 120_000 });
  await expect(page.getByTestId("race-run")).toBeEnabled();
  await page.getByTestId("race-run").click();
  await expect(page.getByText(/Could not reach the service|Service returned HTTP/)).toBeVisible({ timeout: 30_000 });
});

test("Go mission: write Go, run the mission tests in the browser, complete", async ({ page }) => {
  test.setTimeout(180_000);
  await onboard(page);
  const now = new Date().toISOString();
  const done = (missionId: string) => ({ missionId, schemaVersion: 1, status: "completed", attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] });
  const bundle = { app: "opsforge", schemaVersion: 1, exportedAt: now, missions: ["python-01-uptime-report", "python-02-log-parser", "python-03-config-validator", "go-01-config-parser", "go-02-worker-pool", "go-03-timeouts-context"].map(done) };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*6 mission records/)).toBeVisible();

  await page.goto("/#/missions/go-04-retries-idempotency");
  await expect(page.getByRole("heading", { name: "Go Laboratory" })).toBeVisible();
  await expect(page.getByText(/Go .*ready/)).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("python-run-tests").click();
  await expect(page.getByTestId("python-tests")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Checks (0/3)")).toBeVisible();
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(`package main

import (
	"errors"
	"fmt"
	"time"
)

func retry(attempts int, base time.Duration, sleep func(time.Duration), op func() error) error {
	var last error
	for i := 0; i < attempts; i++ {
		if err := op(); err == nil {
			return nil
		} else {
			last = err
		}
		if i < attempts-1 {
			sleep(base << i)
		}
	}
	return last
}

func chargeOnce(done map[string]bool, key string, charge func()) bool {
	if done[key] {
		return false
	}
	charge()
	done[key] = true
	return true
}

func main() {
	fmt.Println(retry(1, time.Millisecond, time.Sleep, func() error { return errors.New("x") }))
}
`);
  await page.getByTestId("python-run-tests").click();
  await expect(page.getByText("Checks (3/3)")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
});
