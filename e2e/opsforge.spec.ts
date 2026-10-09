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
  await expect(page.getByTestId("mission-lab-link")).toHaveText(/Terminal lab/);
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
  // The reflection becomes a draft story, and the page points at the next mission.
  await page.getByTestId("reflection-input").fill("I started with pwd and ls to orient myself, moved into ops and handover, read the runbook with cat, and wrote READY into ack.txt to confirm.");
  await page.getByTestId("save-reflection").click();
  await expect(page.getByTestId("reflection-saved")).toContainText("draft story");
  await expect(page.getByTestId("next-mission")).toContainText("Your first script: an uptime report");
  await page.reload();
  await page.goto("/#/missions");
  await expect(page.getByText("Completed").first()).toBeVisible();
  await page.goto("/#/interview/stories");
  await expect(page.getByTestId("story-list")).toContainText("Practice: Find your way around the server");
  await expect(page.getByTestId("story-mission-badge")).toBeVisible();
  // Curriculum: tracks lens shows the Linux track's skills once expanded; the role lens shows the gap map.
  await page.goto("/#/curriculum");
  await page.getByTestId("track-linux").click();
  await expect(page.getByTestId("track-linux-detail")).toContainText("Terminal navigation");
  await expect(page.getByTestId("track-linux-detail")).toContainText("Open the Terminal lab");
  await page.getByTestId("lens-role").click();
  await expect(page.getByTestId("gap-map")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Interview" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(page.getByText("Recent activity")).toBeVisible();
});

test("navigation: three groups, labs hub with tabs, old addresses redirect", async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  // On phones the sidebar is behind the menu button; roles only resolve visible elements.
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const label of ["Today", "Curriculum", "Missions", "Study", "Labs", "Interview", "Progress", "Settings"]) {
    await expect(nav.getByRole("link", { name: label })).toBeAttached();
  }
  await page.goto("/#/labs");
  await expect(page).toHaveURL(/#\/labs\/terminal/);
  await expect(page.getByRole("heading", { name: "Terminal" })).toBeVisible();
  await page.getByTestId("lab-tab-monitoring").click();
  await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible();
  await page.goto("/#/python");
  await expect(page).toHaveURL(/#\/labs\/python/);
  await expect(page.getByRole("heading", { name: "Python", exact: true })).toBeVisible();
  await page.goto("/#/paths");
  await expect(page).toHaveURL(/#\/curriculum/);
  await expect(page.getByRole("heading", { name: "Curriculum" })).toBeVisible();
});

test("stale deploy: a page whose code cannot load reloads once, then shows a readable error instead of a blank page", async ({ page }) => {
  await onboard(page);
  // Simulate the chunk files of the previous deploy having disappeared.
  await page.route(/\/assets\/CurriculumPage-.*\.js$/, (route) => route.abort());
  await page.goto("/#/curriculum");
  await expect(page.getByTestId("route-error")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("route-error")).toContainText(/updated while this page was open|could not be loaded/);
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
  // Once the files are reachable again, Reload recovers without losing progress.
  await page.unroute(/\/assets\/CurriculumPage-.*\.js$/);
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: "Curriculum" })).toBeVisible({ timeout: 20_000 });
});

test("keyboard navigation: skip link and nav are reachable", async ({ page }, testInfo) => {
  await onboard(page);
  const skip = page.getByText("Skip to content");
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible(); // visually hidden until focused
  if (testInfo.project.name === "desktop") {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Today" })).toBeFocused();
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
  await page.goto("/#/curriculum");
  await page.getByTestId("track-linux").click();
  await expect(page.getByTestId("track-linux-detail").getByText(/1 evidence item|2 evidence item/).first()).toBeVisible();
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
  await page.goto("/#/curriculum");
  await page.getByTestId("lens-role").click();
  await expect(page.getByTestId("role-title")).toHaveText("System Development Engineer II, Lambda/Serverless");
  await expect(page.getByTestId("gap-b6")).toContainText("Not addressable in OpsForge");
  await expect(page.getByTestId("gap-b6")).toContainText("Top Secret with SCI");
  await expect(page.getByTestId("gap-p2")).toContainText("Partly covered");
  await expect(page.getByTestId("gap-p3")).toContainText("Partly covered");
  await expect(page.getByTestId("gap-p3")).toContainText("Agile and Scrum for an operations engineer");
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
  // Study bridge: the SAA-C03 "read replicas" objective is credited to Guided by this completion.
  await page.goto("/#/study/saa-c03/2");
  await expect(page.getByTestId("study-status-12")).toHaveText("Guided");
  await expect(page.getByTestId("study-status-7")).toHaveText("Not started");
  await page.goto("/#/progress");
  await expect(page.getByTestId("study-progress")).toContainText("saa-c03");
});

test("serverless incident: size the function's concurrency from rate × duration, watch cold starts, recover", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  const now = new Date().toISOString();
  const done = (missionId: string) => ({ missionId, schemaVersion: 1, status: "completed", attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] });
  const bundle = { app: "opsforge", schemaVersion: 1, exportedAt: now, missions: ["linux-01-find-your-way", "linux-02-log-detective", "linux-03-locked-out", "devops-01-broken-pipeline", "incident-01-cache-stampede", "incident-02-traffic-surge"].map(done) };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*6 mission records/)).toBeVisible();

  await page.goto("/#/missions/serverless-01-throttled-function");
  await expect(page.getByText("Incident console")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("incident-health")).toHaveText("critical");
  await page.getByTestId("tab-metrics").click();
  await expect(page.getByTestId("stat-fn-concurrency")).toContainText("36 / 10");
  await expect(page.getByTestId("stat-fn-throttled")).toContainText("72%");
  await page.getByTestId("tab-logs").click();
  await expect(page.getByTestId("incident-logs")).toContainText("concurrency limit reached");
  await page.getByTestId("tab-diagram").click();
  await expect(page.getByTestId("node-fn-sync")).toContainText("72% throttled");
  await page.getByTestId("root-cause-1").check();
  await expect(page.getByText(/^Correct\./)).toBeVisible();
  await page.locator("#concurrency").fill("40");
  await page.getByTestId("act-concurrency").click();
  await page.locator("#provisioned").fill("36");
  await page.getByTestId("act-provisioned").click();
  await page.getByTestId("advance-10").click();
  await expect(page.getByTestId("incident-health")).toHaveText("healthy", { timeout: 20_000 });
  await page.getByTestId("postmortem").fill("What: positions function throttled after partner traffic tripled. Why: limit 10 vs 300/s × 120 ms = 36 needed. Fix: limit 40 and provisioned 36 to avoid cold starts. Prevention: alert on throttles and size limits from rate × duration.");
  await expect(page.getByText("Checks (5/5)")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
});

test("design exercise: choose components, see consequences, size, answer drills from the design, justify", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  const now = new Date().toISOString();
  const done = (missionId: string) => ({ missionId, schemaVersion: 1, status: "completed", attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] });
  const bundle = { app: "opsforge", schemaVersion: 1, exportedAt: now, missions: ["linux-01-find-your-way", "linux-02-log-detective", "linux-03-locked-out", "devops-01-broken-pipeline", "incident-01-cache-stampede", "incident-02-traffic-surge", "serverless-01-throttled-function", "serverless-02-poison-messages"].map(done) };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*8 mission records/)).toBeVisible();

  await page.goto("/#/missions/design-01-position-ingest");
  await expect(page.getByText("Consequences of your design")).toBeVisible({ timeout: 20_000 });
  // A wrong design first: the consequences panel names the single point of failure and the capacity shortfall.
  await page.getByTestId("opt-ingest-vm").check();
  await page.getByTestId("opt-buffer-direct").check();
  await page.getByTestId("opt-storage-single-db").check();
  await page.getByTestId("opt-read-direct-read").check();
  await expect(page.getByTestId("design-derived")).toContainText("Single VM running the API (write)");
  await expect(page.getByTestId("design-derived")).toContainText("800/s");
  await expect(page.getByTestId("mission-checks")).toContainText("capacity 800/s");
  // Fix the design.
  await page.getByTestId("opt-ingest-function").check();
  await page.getByTestId("opt-buffer-durable-queue").check();
  await page.getByTestId("opt-storage-kv-store").check();
  await page.getByTestId("opt-read-cache").check();
  await expect(page.getByTestId("design-derived")).toContainText("820");
  await expect(page.getByTestId("design-derived")).toContainText("none");
  await page.getByTestId("qty-concurrency").fill("300");
  await page.getByTestId("qty-consumers").fill("100");
  await page.getByTestId("qty-dlq").fill("3");
  await page.getByTestId("drill-storage-outage-0").check();
  await page.getByTestId("drill-primary-failover-0").check();
  await expect(page.getByText(/^Correct\. Only a durable queue/)).toBeVisible();
  await page.getByTestId("design-justification").fill("Ingest with a function behind an API gateway for scale at low cost; a durable queue so a storage failure delays writes instead of losing them; the key-value store is eventually consistent, fine for a map; the cache keeps read latency at 25 ms. Total cost 820.");
  await expect(page.getByText(/^Checks \((\d+)\/\1\)$/)).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
});

test("lesson mission: read the Scrum lesson, answer the scenario quiz, complete", async ({ page }) => {
  await onboard(page);
  const now = new Date().toISOString();
  const done = (missionId: string) => ({ missionId, schemaVersion: 1, status: "completed", attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] });
  const bundle = { app: "opsforge", schemaVersion: 1, exportedAt: now, missions: ["linux-01-find-your-way", "linux-02-log-detective", "linux-03-locked-out", "devops-01-broken-pipeline"].map(done) };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*4 mission records/)).toBeVisible();
  await page.goto("/#/missions/agile-01-scrum-for-engineers");
  await expect(page.getByText("Check yourself", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Sprint 14 at Nimbus Freight")).toBeVisible();
  // A wrong answer explains itself without giving the answer away.
  await page.getByTestId("quiz-q1-0").check();
  await expect(page.getByText(/^Not quite\./).first()).toBeVisible();
  await page.getByTestId("quiz-q1-1").check();
  await page.getByTestId("quiz-q2-1").check();
  await page.getByTestId("quiz-q3-1").check();
  await page.getByTestId("quiz-q4-1").check();
  await page.getByTestId("quiz-q5-0").check();
  await page.getByTestId("quiz-q6-2").check();
  await expect(page.getByText("Checks (6/6)")).toBeVisible();
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
  await page.goto("/#/labs/go");
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
  await page.goto("/#/labs/go");
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
  await expect(page.getByRole("heading", { name: "Go lab" })).toBeVisible();
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

test("beginner primers: open first on the unnamed-role track, collapsed after switching to standard", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/missions/linux-01-find-your-way");
  await expect(page.getByTestId("primer-nudge")).toBeVisible();
  await page.getByRole("tab", { name: /^Lesson/ }).click();
  const primer = page.getByTestId("primer");
  await expect(primer).toBeVisible();
  await expect(primer).toContainText("In plain words");
  await expect(primer).toContainText("Why it matters");
  await expect(primer).toContainText("Why this way");
  await expect(page.getByTestId("primer-first-step")).toContainText("pwd");
  // A glossary term named by the primer jumps to the Glossary tab.
  await page.getByTestId("primer-terms").getByRole("button", { name: "directory" }).click();
  await expect(page.getByRole("tab", { name: "Glossary" })).toHaveAttribute("aria-selected", "true");

  await page.goto("/#/settings");
  await expect(page.getByTestId("explain-beginner")).toBeChecked();
  await page.getByTestId("explain-standard").click();
  await expect(page.getByTestId("explain-standard")).toBeChecked();

  await page.goto("/#/missions/linux-01-find-your-way");
  await expect(page.getByTestId("primer-nudge")).toHaveCount(0);
  await page.getByRole("tab", { name: /^Lesson/ }).click();
  await expect(page.getByTestId("primer-collapsed")).toBeVisible();
  await expect(page.getByTestId("primer")).toHaveCount(0);
  await expect(page.getByTestId("primer-first-step")).toHaveCount(0);
});

test("role questions: pick the target role's set, start a session, see the cues; listed on the Curriculum role lens", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/interview/practice");
  await page.getByTestId("mode-practice").click();
  await page.getByTestId("question-set").selectOption("role");
  await expect(page.locator("#q")).toContainText("Walk me through a script you would write");
  await page.locator("#q").selectOption("oa-red-pipeline");
  await page.getByTestId("start-session").click();
  await expect(page).toHaveURL(/interview\/practice\/session_/);
  await expect(page.getByTestId("conversation")).toContainText("A CI pipeline is red");
  await expect(page.getByTestId("role-cues")).toContainText("Reads the failing step's log");

  await page.goto("/#/curriculum");
  await page.getByTestId("lens-role").click();
  await expect(page.getByTestId("role-questions")).toContainText("Prepares you: The build is red");
  await page.getByTestId("role-questions").getByRole("link", { name: /Explain retries with exponential backoff/ }).click();
  await expect(page.locator("#q")).toHaveValue("oa-retries");
});

test("redo after completion: fresh workstation, record kept, dependants stay unlocked", async ({ page }) => {
  await onboard(page);
  const now = new Date().toISOString();
  const bundle = {
    app: "opsforge",
    schemaVersion: 1,
    exportedAt: now,
    missions: ["linux-01-find-your-way"].map((missionId) => ({ missionId, schemaVersion: 1, status: "completed", attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] })),
  };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*1 mission records/)).toBeVisible();

  await page.goto("/#/missions/linux-01-find-your-way");
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
  await page.getByTestId("mission-redo").click();
  await expect(page.getByText("Redo in progress")).toBeVisible();
  await expect(page.getByTestId("mission-complete")).toBeDisabled();
  await expect(page.getByTestId("hint-1")).toBeEnabled();
  await expect(page.getByText("Mission complete: explain what you did")).toHaveCount(0);

  // The dependant mission is still open while the prerequisite is being redone.
  await page.goto("/#/missions");
  await expect(page.getByRole("listitem").filter({ hasText: "Find your way around the server" }).getByText("Resume")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Log detective" }).getByText("Start")).toBeVisible();
});

test("design exercise 2: strong consistency rules out the cache and the key-value store; idempotency slot drives a drill", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  const now = new Date().toISOString();
  const bundle = { app: "opsforge", schemaVersion: 1, exportedAt: now, missions: [{ missionId: "design-01-position-ingest", schemaVersion: 1, status: "completed", attempts: 1, hintsUsed: 0, maxHintLevel: 0, bestScore: 1, startedAt: now, completedAt: now, reflections: [] }] };
  await page.goto("/#/settings");
  await page.locator('input[type="file"]').setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.getByText(/Imported .*1 mission records/)).toBeVisible();

  await page.goto("/#/missions/design-02-command-ack");
  await expect(page.getByText("Consequences of your design")).toBeVisible({ timeout: 20_000 });
  // Last exercise's answer, applied here: cheap and fast, but eventually consistent.
  await page.getByTestId("opt-api-function").check();
  await page.getByTestId("opt-buffer-durable-queue").check();
  await page.getByTestId("opt-store-kv-store").check();
  await page.getByTestId("opt-read-cache").check();
  await page.getByTestId("opt-dedup-button").check();
  await expect(page.getByTestId("derived-consistency")).toHaveText("eventual");
  await expect(page.getByTestId("mission-checks")).toContainText("eventually consistent: Managed key-value store (replicated), Cache in front of the store");
  // The requirements decide: strongly consistent store, direct read, server-side idempotency.
  await page.getByTestId("opt-store-managed-db").check();
  await page.getByTestId("opt-read-direct-read").check();
  await page.getByTestId("opt-dedup-idempotency-key").check();
  await expect(page.getByTestId("derived-consistency")).toHaveText("strong");
  await expect(page.getByTestId("design-derived")).toContainText("1,110");
  await page.getByTestId("qty-concurrency").fill("60");
  await page.getByTestId("qty-workers").fill("20");
  await page.getByTestId("qty-ack-timeout").fill("8");
  await page.getByTestId("qty-idempotency-retention").fill("15");
  await page.getByTestId("drill-gateway-outage-0").check();
  await page.getByTestId("drill-status-after-failover-0").check();
  await page.getByTestId("drill-double-send-0").check();
  await page.getByTestId("design-justification").fill("The function behind an API gateway takes the 300 commands/s peak at low cost with no single point of failure. The durable queue holds commands through a gateway outage. The managed database with standby keeps status reads strongly consistent, which the cache would break, and the direct read keeps latency at 70 ms. The idempotency key makes a retry harmless.");
  await expect(page.getByText(/^Checks \((\d+)\/\1\)$/)).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("mission-complete").click();
  await expect(page.getByText("Mission complete: explain what you did")).toBeVisible();
});

test("study: browse the catalog from a course to a unit and into the mission that teaches an objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study");
  await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
  await expect(page.getByTestId("study-disclaimer")).toContainText("not affiliated");
  await expect(page.getByTestId("study-group-aws").getByRole("link")).toHaveCount(11);
  await expect(page.getByTestId("study-group-core").getByRole("link")).toHaveCount(9);
  await page.getByTestId("study-course-saa-c03").click();
  await expect(page.getByRole("heading", { name: "AWS Solutions Architect Associate" })).toBeVisible();
  await expect(page.getByTestId("study-provenance")).toContainText("Exam SAA-C03");
  await page.getByTestId("study-unit-2").click();
  await expect(page.getByRole("heading", { name: /Design Resilient Architectures/ })).toBeVisible();
  await expect(page.getByTestId("study-gate")).toContainText("RTO and RPO");
  await expect(page.getByTestId("study-objectives").getByRole("listitem")).toHaveCount(27);
  const replicas = page.getByTestId("study-objective-12");
  await expect(replicas).toContainText("Read replicas");
  await expect(replicas.getByText("Do it: mission or lab")).toBeVisible();
  await replicas.getByTestId("study-practise-12").click();
  await expect(page).toHaveURL(/missions\/incident-04-replica-lag/);
  await page.getByTestId("study-back-link").click();
  await expect(page).toHaveURL(/#\/study\/saa-c03\/2/);
  // Bookkeeping lines are kept but folded away.
  await page.goto("/#/study/cmpcbs/28");
  await expect(page.getByTestId("study-bookkeeping")).toContainText("6 degree-plan lines");
  await expect(page.getByTestId("study-objectives")).toHaveCount(0);
});

test("study lesson loop: guess, read, check, explain it back; status moves and the unit shows it", async ({ page }) => {
  await onboard(page);
  // The lessons file is generated by the owner's key and is not committed; serve a fixture for the SAA-C03 read-replicas objective.
  const sentence = "A read replica is a copy of the database that serves reads so the primary can spend its time on writes.";
  const para = (n: number) => Array.from({ length: n }, () => sentence).join(" ");
  const question = (i: number, role: "fade" | "solo") => ({ id: `saa-c03:2:12:q${i}`, role, prompt: `Question ${i}: which statement about read replicas is right?`, choices: [`wrong A ${i}`, `right ${i}`, `wrong C ${i}`, `wrong D ${i}`], correctIndex: 1, why: "Reads move to the replica; writes stay on the primary." });
  const fixture = {
    courseId: "saa-c03",
    generated: { scriptVersion: 1, promptVersion: 1, generatedAt: "2026-10-09T00:00:00.000Z", models: ["fixture-model"] },
    lessons: [
      {
        objectiveId: "saa-c03:2:12",
        sourceHash: "fixture",
        promptVersion: 1,
        model: "fixture-model",
        generatedAt: "2026-10-09T00:00:00.000Z",
        plain: para(4),
        guessPrompt: "Why might the map show a position that is a minute old while writes succeed?",
        teach: para(6),
        questions: [question(1, "fade"), question(2, "solo"), question(3, "solo"), question(4, "solo")],
        explainPrompt: "Explain to a teammate what a read replica buys you and one way it can mislead.",
        modelAnswer: para(2),
        rubricPoints: ["Reads move off the primary", "Replication lag means stale reads"],
      },
    ],
    scenarios: [
      {
        unitId: "saa-c03:2",
        promptVersion: 1,
        model: "fixture-model",
        generatedAt: "2026-10-09T00:00:00.000Z",
        title: "Stale map after a surge",
        scenario: "Dispatchers at a fictional courier see positions a minute old while writes succeed. 1. Name the likely cause. 2. Say what you would check first. 3. Say what you would not do.",
        subParts: ["Likely cause", "First check", "What not to do"],
        modelAnswer: ["Replication lag on the read replica.", "The replica's apply lag and any blocking statement.", "Fail over to the lagging replica."],
      },
    ],
  };
  await page.route("**/study/saa-c03.lessons.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) }));
  await page.goto("/#/study/saa-c03/2");
  await expect(page.getByTestId("study-objective-12")).toContainText("lesson");
  await page.getByTestId("study-open-12").click();
  await expect(page.getByRole("heading", { name: /Read replicas/ })).toBeVisible();
  const loop = page.getByTestId("lesson-loop");
  await expect(loop).toHaveAttribute("data-step", "guess");
  await page.getByTestId("guess-input").fill("The copy of the database is behind the main one.");
  await page.getByTestId("guess-submit").click();
  await expect(loop).toHaveAttribute("data-step", "teach");
  await expect(page.getByTestId("guess-echo")).toContainText("behind the main one");
  // The unnamed-role track is beginner-first: the plain paragraph is open, not folded.
  await expect(page.getByTestId("lesson-plain")).toBeVisible();
  await expect(page.getByTestId("lesson-teach")).toContainText("read replica");
  await page.getByTestId("teach-next").click();
  await expect(loop).toHaveAttribute("data-step", "practice");
  await expect(page.getByTestId("question-prompt")).toContainText("Question 1");
  // Answer the correct choice wherever the shuffle put it.
  await page.locator('[data-testid^="choice-"][data-correct="1"]').click();
  await expect(page.getByTestId("question-verdict")).toContainText("Correct.");
  await expect(page.getByTestId("loop-status")).toContainText("Introduced");
  await page.getByTestId("another-question").click();
  await expect(page.getByTestId("question-prompt")).toContainText("Question 2");
  await page.locator('[data-testid^="choice-"][data-correct="1"]').click();
  await expect(page.getByTestId("loop-status")).toContainText("Guided");
  await page.getByTestId("practice-next").click();
  await expect(loop).toHaveAttribute("data-step", "explain");
  await page.getByTestId("explain-input").fill("Reads go to a copy so the primary only handles writes; the copy can lag, so a dispatcher may see an old position.");
  await page.getByTestId("explain-submit").click();
  await expect(page.getByTestId("model-answer")).toBeVisible();
  await page.getByTestId("self-correct").click();
  await expect(loop).toHaveAttribute("data-step", "summary");
  await expect(page.getByTestId("summary-status")).toContainText("Independent");
  // A miss schedules a review and the unit page says so.
  await page.getByTestId("summary-practice").click();
  await page.locator('[data-testid^="choice-"][data-correct="0"]').first().click();
  await expect(page.getByTestId("question-verdict")).toContainText("scheduled for tomorrow");
  await page.goto("/#/study/saa-c03/2");
  await expect(page.getByTestId("study-status-12")).toContainText("Independent");
  // Unit scenario without a proxy: the model answers are revealed and the learner self-checks each sub-part.
  await expect(page.getByTestId("scenario-text")).toContainText("1. Name the likely cause");
  await page.getByTestId("scenario-input").fill("The replica is lagging behind the primary. I would look at the apply lag and whether a long query blocks it. I would not fail over to the lagging copy.");
  await page.getByTestId("scenario-submit").click();
  await expect(page.getByTestId("scenario-self-note")).toContainText("rate your own answer");
  await page.getByTestId("scenario-check-1").check();
  await page.getByTestId("scenario-check-2").check();
  await page.getByTestId("scenario-save").click();
  await expect(page.getByTestId("scenario-saved")).toContainText("partial");
  await page.reload();
  await expect(page.getByTestId("scenario-last")).toContainText("partial (self-checked)");
  // Study style reorders the unit: doing first puts the linked objectives at the top.
  await page.goto("/#/settings");
  await page.getByTestId("study-style-doing").click();
  await expect(page.getByTestId("study-style-doing")).toBeChecked();
  await page.goto("/#/study/saa-c03/2");
  await expect(page.getByTestId("study-objectives").getByRole("listitem").first()).toContainText("Decoupling with queues");
});

test("policy lab: default deny, fix the policy, read the trace, pass and credit the Study objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/saa-c03/1");
  const objective = page.getByTestId("study-objective-2");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-2").click();
  await expect(page).toHaveURL(/#\/labs\/policy\?exercise=policy-01-default-deny/);
  await expect(page.getByRole("heading", { name: "Authorization policies" })).toBeVisible();
  await expect(page.getByTestId("policy-back-link")).toBeVisible();
  // The update request is denied by default and the check button says so.
  await expect(page.getByTestId("policy-decision-write-order")).toHaveText("deny");
  await expect(page.getByTestId("policy-request-write-order")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("policy-check")).toBeDisabled();
  await page.getByTestId("policy-trace-toggle-write-order").click();
  await expect(page.getByTestId("policy-trace")).toContainText("Default deny");
  // A broad fix is caught: writing invoices must stay denied.
  await page.getByTestId("policy-text-dispatch").fill("allow store:Read, store:List on store/orders/*\nallow store:Write on store/*");
  await expect(page.getByTestId("policy-decision-write-order")).toHaveText("allow");
  await expect(page.getByTestId("policy-request-write-invoice")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("policy-check")).toBeDisabled();
  // A bad line is reported by number.
  await page.getByTestId("policy-text-dispatch").fill("allow store:Read on store/orders/*\nwrite please");
  await expect(page.getByTestId("policy-errors-dispatch")).toContainText("line 2");
  // The narrow fix passes and credits the objective.
  await page.getByTestId("policy-text-dispatch").fill("allow store:Read, store:List on store/orders/*\nallow store:Write on store/orders/*");
  await expect(page.getByTestId("policy-check")).toBeEnabled();
  await page.getByTestId("policy-check").click();
  await expect(page.getByTestId("policy-passed")).toContainText("Credited");
  await page.getByTestId("policy-back-link").click();
  await expect(page.getByTestId("study-status-2")).toHaveText("Guided");
  // The labs hub has the new tab.
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-policies").click();
  await expect(page.getByRole("heading", { name: "Authorization policies" })).toBeVisible();
});

test("network lab: trace a dropped packet to the hop, fix the filter, pass and credit the Study objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/saa-c03/1");
  const objective = page.getByTestId("study-objective-8");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-8").click();
  await expect(page).toHaveURL(/#\/labs\/network\?exercise=net-01-stateful-source/);
  await expect(page.getByRole("heading", { name: "Network path" })).toBeVisible();
  await expect(page.getByTestId("network-result-app-db")).toHaveText("dropped");
  await expect(page.getByTestId("network-flow-app-db")).toContainText("Dropped at db-1 stateful filter (inbound)");
  await expect(page.getByTestId("network-check")).toBeDisabled();
  await page.getByTestId("network-trace-toggle-app-db").click();
  await expect(page.getByTestId("network-trace")).toContainText("REJECT at db-1 stateful filter");
  // Opening the database to everyone is caught by the web host flow.
  await page.getByTestId("network-editable").fill("in tcp 5432 from 0.0.0.0/0\nout any any to 0.0.0.0/0");
  await expect(page.getByTestId("network-result-app-db")).toHaveText("reaches");
  await expect(page.getByTestId("network-flow-web-db")).toHaveAttribute("data-ok", "0");
  // A bad line is reported by number.
  await page.getByTestId("network-editable").fill("in tcp 5432 from filter:filter-app\nallow everything");
  await expect(page.getByTestId("network-errors")).toContainText("line 2");
  // The precise fix passes and credits the objective.
  await page.getByTestId("network-editable").fill("in tcp 5432 from filter:filter-app\nout any any to 0.0.0.0/0");
  await expect(page.getByTestId("network-check")).toBeEnabled();
  await page.getByTestId("network-check").click();
  await expect(page.getByTestId("network-passed")).toContainText("Credited");
  await page.getByTestId("network-back-link").click();
  await expect(page.getByTestId("study-status-8")).toHaveText("Guided");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-network").click();
  await expect(page.getByRole("heading", { name: "Network path" })).toBeVisible();
});
