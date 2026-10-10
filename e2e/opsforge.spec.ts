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
  await expect(page.getByTestId("study-group-nursing").getByRole("link")).toHaveCount(6);
  await expect(page.getByTestId("study-paths-aws")).toContainText("Solutions architect");
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

test("study: search finds courses and objectives, filters live in the address, and health courses ask for a disclaimer first", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study");
  await page.getByTestId("study-search").fill("peering");
  await expect(page).toHaveURL(/q=peering/);
  await expect(page.getByTestId("study-objective-results").getByRole("link").first()).toBeVisible();
  await page.getByTestId("study-search").fill("");
  await page.getByTestId("study-field-pm").click();
  await expect(page).toHaveURL(/field=pm/);
  await expect(page.getByTestId("study-results").getByRole("link")).toHaveCount(13);
  await page.getByTestId("study-level-filter").selectOption("fundamentals");
  await expect(page.getByTestId("study-results").getByRole("link")).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId("study-results").getByRole("link")).toHaveCount(2);

  await page.goto("/#/study/nclex-rn");
  await expect(page.getByTestId("study-health-gate")).toContainText("not clinical guidance");
  await expect(page.getByTestId("study-provenance")).toHaveCount(0);
  await page.getByTestId("study-health-accept").click();
  await expect(page.getByTestId("study-provenance")).toContainText("NCLEX-RN");
  await page.goto("/#/study/npte-pt");
  await expect(page.getByTestId("study-health-gate")).toBeVisible();
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

test("recovery planner: an over-provisioned plan fails the lean check, the right plan passes and credits the Study objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/saa-c03/2");
  const objective = page.getByTestId("study-objective-20");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-20").click();
  await expect(page).toHaveURL(/#\/labs\/dr\?exercise=dr-01-match-the-need/);
  await expect(page.getByRole("heading", { name: "Recovery planner" })).toBeVisible();
  // The starting plan is a hot standby with continuous replication: far over budget, restore never tested.
  await expect(page.getByTestId("dr-check-budget")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("dr-check-tested")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("dr-check-lean")).toContainText("cheapest plan that meets this requirement costs 60 credits");
  await expect(page.getByTestId("dr-check")).toBeDisabled();
  await page.getByTestId("dr-backup-daily-snapshot").check();
  await page.getByTestId("dr-standby-none").check();
  await page.getByTestId("dr-trigger-manual").check();
  await page.getByTestId("dr-tested").check();
  await expect(page.getByTestId("dr-cost")).toHaveText("60");
  await expect(page.getByTestId("dr-rpo")).toHaveText("24 h");
  await expect(page.getByTestId("dr-rto")).toHaveText("6 h 15 min");
  // The drill: name the dominant step (bringing up the standby takes four hours).
  await page.getByTestId("dr-drill").selectOption("restore");
  await expect(page.getByTestId("dr-drill-verdict")).toContainText("Not for this plan");
  await page.getByTestId("dr-drill").selectOption("provision");
  await expect(page.getByTestId("dr-drill-verdict")).toContainText("Right");
  await expect(page.getByTestId("dr-check")).toBeEnabled();
  await page.getByTestId("dr-check").click();
  await expect(page.getByTestId("dr-passed")).toContainText("Credited");
  await page.getByTestId("dr-back-link").click();
  await expect(page.getByTestId("study-status-20")).toHaveText("Guided");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-recovery").click();
  await expect(page.getByRole("heading", { name: "Recovery planner" })).toBeVisible();
});

test("alarm lab: a trigger-happy alarm pages on a deploy, the error-rate alarm catches the incident and credits the Study objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/soa-c03/1");
  const objective = page.getByTestId("study-objective-5");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-5").click();
  await expect(page).toHaveURL(/#\/labs\/alarms\?exercise=alarm-03-right-metric/);
  await expect(page.getByRole("heading", { name: "Metric alarms" })).toBeVisible();
  // Exercise 3 as given: the error-rate alarm never fires for the dead-consumer incident.
  await expect(page.getByTestId("alarm-check-dead-alert")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("alarm-check-dead-alert")).toContainText("never fired");
  await expect(page.getByTestId("alarm-check")).toBeDisabled();
  await page.getByTestId("alarm-chart-toggle-dead").click();
  await expect(page.getByTestId("alarm-charts")).toContainText("error rate");
  // A hair-trigger queue alarm catches the incident but also pages on the draining burst.
  await page.getByTestId("alarm-editable").fill("alert: queueDepth > 300 for 1 of 1");
  await expect(page.getByTestId("alarm-check-dead-alert")).toHaveAttribute("data-ok", "1");
  await expect(page.getByTestId("alarm-check-burst-alert")).toContainText("false alarm");
  // A bad line is reported by number.
  await page.getByTestId("alarm-editable").fill("alert: queueDepth > 300 for 15 of 15\nqueue is big");
  await expect(page.getByTestId("alarm-errors")).toContainText("line 2");
  // The sustained-queue alarm passes and credits the objective.
  await page.getByTestId("alarm-editable").fill("alert: queueDepth > 300 for 15 of 15");
  await expect(page.getByTestId("alarm-check")).toBeEnabled();
  await page.getByTestId("alarm-check").click();
  await expect(page.getByTestId("alarm-passed")).toContainText("Credited");
  await page.getByTestId("alarm-back-link").click();
  await expect(page.getByTestId("study-status-5")).toHaveText("Guided");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-alarms").click();
  await expect(page.getByRole("heading", { name: "Metric alarms" })).toBeVisible();
});

test("cost lab: commit to the floor, not the ceiling; the bill, the lean check and the Study credit", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/saa-c03/4");
  const objective = page.getByTestId("study-objective-9");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-9").click();
  await expect(page).toHaveURL(/#\/labs\/cost\?exercise=cost-02-commit-baseline/);
  await expect(page.getByRole("heading", { name: "Cost model" })).toBeVisible();
  await expect(page.getByTestId("cost-total")).toContainText("1738.17");
  await expect(page.getByTestId("cost-check-target")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("cost-check-lean")).toContainText("cheapest plan that meets the requirement costs 1338.17");
  await expect(page.getByTestId("cost-check")).toBeDisabled();
  // Committing to the peak passes the target but fails the lean check: idle commitment.
  await page.getByTestId("cost-commit").fill("30");
  await expect(page.getByTestId("cost-lines")).toContainText("sit idle");
  await expect(page.getByTestId("cost-check-lean")).toHaveAttribute("data-ok", "0");
  // Committing to the floor is the cheapest feasible plan.
  await page.getByTestId("cost-commit").fill("10");
  await expect(page.getByTestId("cost-total")).toContainText("1338.17");
  await expect(page.getByTestId("cost-check")).toBeEnabled();
  await page.getByTestId("cost-check").click();
  await expect(page.getByTestId("cost-passed")).toContainText("Credited");
  await page.getByTestId("cost-back-link").click();
  await expect(page.getByTestId("study-status-9")).toHaveText("Guided");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-cost").click();
  await expect(page.getByRole("heading", { name: "Cost model" })).toBeVisible();
});

test("deploy lab: a wide rollout of a bad release exposes a quarter of the traffic; a canary with a tight guard limits it and credits the Study objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/dva-c02/3");
  const objective = page.getByTestId("study-objective-21");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-21").click();
  await expect(page).toHaveURL(/#\/labs\/deploy\?exercise=deploy-02-canary/);
  await expect(page.getByRole("heading", { name: "Deployment strategies" })).toBeVisible();
  await expect(page.getByTestId("deploy-failed")).toHaveText("150");
  await expect(page.getByTestId("deploy-mincap")).toHaveText("75%");
  await expect(page.getByTestId("deploy-check-capacity")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("deploy-check")).toBeDisabled();
  await page.getByTestId("deploy-kind-canary").check();
  await page.getByTestId("deploy-canary").fill("5");
  await page.getByTestId("deploy-bake").fill("30");
  await page.getByTestId("deploy-batch").fill("25");
  // A loose alarm never fires: the canary is promoted and the defect reaches everyone.
  await page.getByTestId("deploy-alarm-rate").fill("50");
  await expect(page.getByTestId("deploy-alarm")).toHaveText("never fired");
  await expect(page.getByTestId("deploy-check-outcome")).toContainText("never fired");
  await page.getByTestId("deploy-alarm-rate").fill("1");
  await expect(page.getByTestId("deploy-alarm")).toHaveText("fired at 30 s");
  await expect(page.getByTestId("deploy-failed")).toHaveText("30");
  await expect(page.getByTestId("deploy-outcome")).toContainText("Rolled back at 50 s");
  await expect(page.getByTestId("deploy-check")).toBeEnabled();
  await page.getByTestId("deploy-check").click();
  await expect(page.getByTestId("deploy-passed")).toContainText("Credited");
  await page.getByTestId("deploy-back-link").click();
  await expect(page.getByTestId("study-status-21")).toHaveText("Guided");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-deploys").click();
  await expect(page.getByRole("heading", { name: "Deployment strategies" })).toBeVisible();
});

test("encryption lab: the key service refuses a large object, a data key seals it locally and the stored wrapped key credits the Study objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/dva-c02/2");
  const objective = page.getByTestId("study-objective-12");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-12").click();
  await expect(page).toHaveURL(/#\/labs\/crypto\?exercise=crypto-01-envelope/);
  await expect(page.getByRole("heading", { name: "Envelope encryption" })).toBeVisible();
  await expect(page.getByTestId("crypto-trace-1")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("crypto-trace-1")).toContainText("at most 4 KB");
  await expect(page.getByTestId("crypto-check-sealed")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("crypto-check")).toBeDisabled();
  // Seal with a data key but keep the plaintext key around: one check still fails.
  await page.getByTestId("crypto-program").fill("datakey orders-key as orders-app -> dk1\nencrypt orders-archive with dk1\nstore orders-archive with dk1");
  await expect(page.getByTestId("crypto-check-stored")).toHaveAttribute("data-ok", "1");
  await expect(page.getByTestId("crypto-check-forgotten")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("crypto-memory")).toContainText("dk1 (orders-key v1)");
  await page.getByTestId("crypto-program").fill("datakey orders-key as orders-app -> dk1\nencrypt orders-archive with dk1\nstore orders-archive with dk1\nforget dk1");
  await expect(page.getByTestId("crypto-object-orders-archive")).toContainText("stored with wrapped dk1");
  await expect(page.getByTestId("crypto-check")).toBeEnabled();
  await page.getByTestId("crypto-check").click();
  await expect(page.getByTestId("crypto-passed")).toContainText("Credited");
  await page.getByTestId("crypto-back-link").click();
  await expect(page.getByTestId("study-status-12")).toHaveText("Guided");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-encryption").click();
  await expect(page.getByRole("heading", { name: "Envelope encryption" })).toBeVisible();
});

test("messaging lab: direct calls lose the outage, a queue holds it; the poison exercise needs a receive limit and a dead-letter queue", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/saa-c03/3");
  const objective = page.getByTestId("study-objective-8");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-8").click();
  await expect(page).toHaveURL(/#\/labs\/messaging\?exercise=msg-01-decouple/);
  await expect(page.getByRole("heading", { name: "Messaging and events" })).toBeVisible();
  await expect(page.getByTestId("messaging-lost")).toHaveText("600");
  await expect(page.getByTestId("messaging-check-lost")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("messaging-check")).toBeDisabled();
  await page.getByTestId("messaging-kind-queue").click();
  await expect(page.getByTestId("messaging-kind-queue")).toBeChecked();
  await expect(page.getByTestId("messaging-lost")).toHaveText("0");
  await expect(page.getByTestId("messaging-age")).toHaveText("30 s");
  await expect(page.getByTestId("messaging-check")).toBeEnabled();
  await page.getByTestId("messaging-check").click();
  await expect(page.getByTestId("messaging-passed")).toContainText("Credited");
  await page.getByTestId("messaging-back-link").click();
  await expect(page.getByTestId("study-status-8")).toHaveText("Guided");
  // The poison exercise: a receive limit alone drops the poison; with a dead-letter queue it is parked.
  await page.goto("/#/labs/messaging?exercise=msg-02-poison");
  await expect(page.getByTestId("messaging-check-drained")).toContainText("never drained");
  await page.getByTestId("messaging-max-receives").fill("3");
  await expect(page.getByTestId("messaging-check-lost")).toHaveAttribute("data-ok", "0");
  await page.getByTestId("messaging-dead-letter").check();
  await expect(page.getByTestId("messaging-wasted")).toHaveText("33 (11 parked)");
  await expect(page.getByTestId("messaging-check")).toBeEnabled();
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-events").click();
  await expect(page.getByRole("heading", { name: "Messaging and events" })).toBeVisible();
});

test("autoscaling lab: a CPU target never fires on an I/O-bound service; requests per instance scales it and credits the Study objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/saa-c03/3");
  const objective = page.getByTestId("study-objective-7");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-7").click();
  await expect(page).toHaveURL(/#\/labs\/autoscale\?exercise=as-06-metric/);
  await expect(page.getByRole("heading", { name: "Autoscaling" })).toBeVisible();
  await expect(page.getByTestId("autoscale-actions")).toHaveText("0");
  await expect(page.getByTestId("autoscale-check-failed")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("autoscale-check")).toBeDisabled();
  await page.getByTestId("autoscale-metric").selectOption("requests");
  // The default target of 14 req/s per instance is a little tight for this ramp.
  await expect(page.getByTestId("autoscale-check-slow")).toHaveAttribute("data-ok", "0");
  await page.getByTestId("autoscale-target").fill("12");
  await expect(page.getByTestId("autoscale-failed")).toHaveText("0");
  await expect(page.getByTestId("autoscale-peak")).toHaveText("25");
  await expect(page.getByTestId("autoscale-check")).toBeEnabled();
  await page.getByTestId("autoscale-check").click();
  await expect(page.getByTestId("autoscale-passed")).toContainText("Credited");
  await page.getByTestId("autoscale-back-link").click();
  await expect(page.getByTestId("study-status-7")).toHaveText("Guided");
  // The health-check exercise: interval × threshold is the detection time.
  await page.goto("/#/labs/autoscale?exercise=as-05-health");
  await expect(page.getByTestId("autoscale-check-failed")).toContainText("detected after 120 s");
  await page.getByTestId("autoscale-hc-interval").fill("10");
  await page.getByTestId("autoscale-hc-threshold").fill("1");
  await expect(page.getByTestId("autoscale-check-churn")).toHaveAttribute("data-ok", "0");
  await page.getByTestId("autoscale-hc-threshold").fill("2");
  await expect(page.getByTestId("autoscale-check-failed")).toContainText("detected after 10 s");
  await expect(page.getByTestId("autoscale-check")).toBeEnabled();
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-scaling").click();
  await expect(page.getByRole("heading", { name: "Autoscaling" })).toBeVisible();
});

test("SQL lab: a lookup scans the table until an index exists; real SQLite shows the plan and the pass credits the Study objective", async ({ page }) => {
  await onboard(page);
  await page.goto("/#/study/mscs/9");
  const objective = page.getByTestId("study-objective-4");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-4").click();
  await expect(page).toHaveURL(/#\/labs\/sql\?exercise=sql-02-index/);
  await expect(page.getByRole("heading", { name: "SQL" })).toBeVisible();
  await expect(page.getByTestId("sql-run")).toBeEnabled({ timeout: 90_000 });
  await page.getByTestId("sql-run").click();
  await expect(page.getByTestId("sql-plan")).toContainText("SCAN orders", { timeout: 60_000 });
  await expect(page.getByTestId("sql-rows")).toContainText("2026-01-05");
  await expect(page.getByTestId("sql-check-plan")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("sql-check")).toBeDisabled();
  await page.getByTestId("sql-program").fill("CREATE INDEX idx_orders_customer ON orders (customer_id, placed_at);\nSELECT id, placed_at, status FROM orders WHERE customer_id = 17 ORDER BY placed_at;");
  await page.getByTestId("sql-run").click();
  await expect(page.getByTestId("sql-plan")).toContainText("SEARCH orders USING INDEX idx_orders_customer", { timeout: 60_000 });
  await expect(page.getByTestId("sql-objects")).toContainText("idx_orders_customer on orders");
  await expect(page.getByTestId("sql-check")).toBeEnabled();
  await page.getByTestId("sql-check").click();
  await expect(page.getByTestId("sql-passed")).toContainText("Credited");
  await page.getByTestId("sql-back-link").click();
  await expect(page.getByTestId("study-status-4")).toHaveText("Guided");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-sql").click();
  await expect(page.getByRole("heading", { name: "SQL" })).toBeVisible();
});

test("Python drills: the shared mutable default fails the interpreter's own test; the None idiom passes and credits the Study objective", async ({ page }) => {
  test.setTimeout(180_000);
  await onboard(page);
  await page.goto("/#/study/python/2");
  const objective = page.getByTestId("study-objective-6");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-6").click();
  await expect(page).toHaveURL(/#\/labs\/python-drills\?exercise=py-05-mutable-default/);
  await expect(page.getByRole("heading", { name: "Python drills" })).toBeVisible();
  await expect(page.getByTestId("pydrill-run")).toBeEnabled({ timeout: 120_000 });
  await page.getByTestId("pydrill-run").click();
  await expect(page.getByTestId("pydrill-test-second")).toHaveAttribute("data-ok", "0", { timeout: 60_000 });
  await expect(page.getByTestId("pydrill-test-first")).toHaveAttribute("data-ok", "1");
  await expect(page.getByTestId("python-tests")).toContainText("the default list is shared");
  await expect(page.getByTestId("pydrill-check")).toBeDisabled();
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("def add_tag(tag, tags=None):\n    if tags is None:\n        tags = []\n    tags.append(tag)\n    return tags\n");
  await page.getByTestId("pydrill-run").click();
  await expect(page.getByTestId("pydrill-summary")).toHaveText("4 of 4 passed.", { timeout: 60_000 });
  await expect(page.getByTestId("pydrill-check")).toBeEnabled();
  await page.getByTestId("pydrill-check").click();
  await expect(page.getByTestId("pydrill-passed")).toContainText("Credited");
  await page.getByTestId("pydrill-back-link").click();
  await expect(page.getByTestId("study-status-6")).toHaveText("Guided");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-drills").click();
  await expect(page.getByRole("heading", { name: "Python drills" })).toBeVisible();
});

test("JavaScript lab: var closures fail on the engine's own output, let fixes them and credits the Study objective; an infinite loop is stopped and the worker recovers", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.goto("/#/study/javascript/1");
  await expect(page.getByText("Lab: ")).toBeVisible();
  const objective = page.getByTestId("study-objective-1");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-1").click();
  await expect(page).toHaveURL(/#\/labs\/javascript\?exercise=js-01-hoisting/);
  await expect(page.getByRole("heading", { name: "JavaScript" })).toBeVisible();
  await expect(page.getByTestId("js-run")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-console")).toContainText("[ undefined, undefined, undefined ]");
  await expect(page.getByTestId("js-test-closures")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("js-test-closures")).toContainText("expected [ 'north', 'south', 'east' ]");
  await expect(page.getByTestId("js-check")).toBeDisabled();
  const editor = page.locator(".cm-content");
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    'const DEPOTS = ["north", "south", "east"];\nfunction makeCheckers() {\nconst checkers = [];\nfor (let i = 0; i < DEPOTS.length; i++) checkers.push(() => DEPOTS[i]);\nreturn checkers;\n}\nfunction describe() {\nconst label = "north";\nreturn "Depot " + label;\n}\nfunction tdzDemo() {\ntry {\nconst before = depot;\nlet depot = "north";\nreturn typeof before;\n} catch (e) {\nreturn e.name;\n}\n}\nconsole.log(makeCheckers().map((c) => c()));\n',
  );
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-summary")).toHaveText("4 of 4 passed.");
  await expect(page.getByTestId("js-console")).toContainText("[ 'north', 'south', 'east' ]");
  await page.getByTestId("js-check").click();
  await expect(page.getByTestId("js-passed")).toContainText("Credited");
  await page.getByTestId("js-back-link").click();
  await expect(page.getByTestId("study-status-1")).toHaveText("Guided");
  // An infinite loop cannot be interrupted from inside; the time limit terminates the worker.
  await page.goto("/#/labs/javascript?exercise=js-02-coercion");
  await expect(page.getByTestId("js-run")).toBeEnabled({ timeout: 30_000 });
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("while (true) {}\n");
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-error")).toContainText("Execution stopped after 6 s", { timeout: 15_000 });
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("console.log(typeof document, 0 == false, null == false);\n");
  await expect(page.getByTestId("js-run")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-console")).toContainText("undefined true false");
  // Module drills edit several files.
  await page.goto("/#/labs/javascript?exercise=js-13-modules");
  await expect(page.getByTestId("js-file-main.js")).toContainText("(runs first)");
  await page.getByTestId("js-file-config.js").click();
  await expect(page.locator(".cm-content")).toContainText("default export");
  await page.goto("/#/labs");
  await page.getByTestId("lab-tab-javascript").click();
  await expect(page.getByRole("heading", { name: "JavaScript" })).toBeVisible();
});

test("JavaScript lab, DOM and server units: delegation passes from a Study objective with a page preview; the testing drill checks your tests against the buggy and a correct version; the race shows on the starter", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.goto("/#/study/javascript/4");
  const objective = page.getByTestId("study-objective-3");
  await expect(objective).toContainText("Do it: mission or lab");
  await objective.getByTestId("study-practise-3").click();
  await expect(page).toHaveURL(/#\/labs\/javascript\?exercise=dom-03-delegation/);
  await expect(page.getByTestId("js-run")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-test-later")).toHaveAttribute("data-ok", "0");
  await expect(page.getByTestId("js-test-export")).toContainText("call event.preventDefault()");
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    'function addRow(id) {\nconst tr = document.createElement("tr");\ntr.dataset.id = id;\ntr.innerHTML = `<td>${id}</td><td><button class="remove">Remove</button></td>`;\ndocument.querySelector("#parcels tbody").append(tr);\n}\nfunction wire() {\ndocument.querySelector("#parcels tbody").addEventListener("click", (event) => {\nconst button = event.target.closest(".remove");\nif (button) button.closest("tr").remove();\n});\ndocument.getElementById("export").addEventListener("click", (event) => {\nevent.preventDefault();\nconsole.log("export requested");\n});\n}\nwire();\naddRow("P-3");\n',
  );
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-summary")).toHaveText("4 of 4 passed.");
  await expect(page.frameLocator('[data-testid="js-preview"]').locator("tr[data-id='P-3']")).toBeVisible();
  await page.getByTestId("js-check").click();
  await expect(page.getByTestId("js-passed")).toContainText("Credited");
  await page.getByTestId("js-back-link").click();
  await expect(page.getByTestId("study-status-3")).toHaveText("Guided");
  // Testing drill: the starter's one test passes everywhere, so it does not catch the bug.
  await page.goto("/#/labs/javascript?exercise=test-01-reproduce");
  await expect(page.getByTestId("js-run")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-console")).toContainText("✓ one box when the parcel fits");
  await expect(page.getByTestId("js-test-catches")).toHaveAttribute("data-ok", "0");
  await page.locator(".cm-content").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText('\ntest("an exact multiple needs no extra box", () => {\nexpect(boxesNeeded(10, 5)).toBe(2);\n});\n');
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-console")).toContainText("✗ an exact multiple needs no extra box: ExpectationError: expected 3 to be 2");
  await expect(page.getByTestId("js-test-catches")).toHaveAttribute("data-ok", "1");
  await expect(page.getByTestId("js-test-agree")).toHaveAttribute("data-ok", "1");
  await expect(page.getByTestId("js-test-fixed")).toHaveAttribute("data-ok", "0");
  // Server drill: two requests for the last five boxes both succeed on the starter.
  await page.goto("/#/labs/javascript?exercise=node-02-race");
  await expect(page.getByTestId("js-run")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-test-lastfive")).toContainText("both requests read the same stock before either wrote");
  await expect(page.getByTestId("js-test-alone")).toHaveAttribute("data-ok", "1");
});

test("lab layout: a long line in the editor wraps or scrolls inside its column, never widens the page", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  // An unbroken 300-character word: long enough to overflow any column at any viewport.
  const long = "x".repeat(300);
  // A string expression: the e2e tsconfig has no DOM lib.
  const overflow = () => page.evaluate<number>("document.documentElement.scrollWidth - document.documentElement.clientWidth");
  // Python drills: CodeMirror, on the drill with the widest starter code.
  await page.goto("/#/labs/python-drills?exercise=py-11-generators");
  await expect(page.getByRole("heading", { name: "Python drills" })).toBeVisible();
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText(`\n# ${long}`);
  await expect.poll(overflow).toBe(0);
  // A button below the editor must be clickable: the layout settles instead of oscillating.
  await page.getByTestId("pydrill-hint").click();
  await expect(page.getByTestId("pydrill-hints")).toBeVisible();
  // Alarms and encryption echo an unparseable line back in an error list.
  for (const [path, box] of [["/#/labs/alarms", "alarm-editable"], ["/#/labs/crypto", "crypto-program"]] as const) {
    await page.goto(path);
    await page.getByTestId(box).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.insertText(`\n${long}`);
    await expect.poll(overflow).toBe(0);
  }
  // The JavaScript lab prints what the program logs and throws.
  await page.goto("/#/labs/javascript");
  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText(`\nconsole.log("${long}");`);
  await expect(page.getByTestId("js-run")).toBeEnabled({ timeout: 60_000 });
  await page.getByTestId("js-run").click();
  await expect(page.getByTestId("js-console")).toContainText(long);
  await expect.poll(overflow).toBe(0);
});

test("labs fit a narrow phone: no lab page scrolls sideways at 320 px with an exercise open", async ({ page }) => {
  await onboard(page);
  await page.setViewportSize({ width: 320, height: 720 });
  const labs: [string, string][] = [
    ["terminal", "terminal-input"],
    ["policy?exercise=policy-01-default-deny", "policy-check"],
    ["network?exercise=net-main", "network-check"],
    ["dr?exercise=dr-01-match-the-need", "dr-check"],
    ["alarms?exercise=alarm-01-threshold", "alarm-check"],
    ["cost?exercise=cost-01-rightsize", "cost-check"],
    ["deploy?exercise=deploy-01-all-at-once", "deploy-check"],
    ["crypto?exercise=key-admin", "crypto-check"],
    ["messaging?exercise=msg-01-decouple", "messaging-check"],
    ["autoscale?exercise=as-01-elastic", "autoscale-check"],
    ["sql?exercise=sql-01-join", "sql-check"],
    ["python-drills?exercise=py-01-truthiness", "pydrill-check"],
    ["javascript?exercise=js-01-hoisting", "js-check"],
  ];
  for (const [lab, ready] of labs) {
    await page.goto(`/#/labs/${lab}`);
    await expect(page.getByTestId(ready)).toBeVisible();
    // Code editors scroll inside their own box; only the page itself must fit.
    const width = await page.evaluate<{ scroll: number; client: number }>(
      "({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })",
    );
    expect(width.scroll, `${lab} scrolls sideways`).toBeLessThanOrEqual(width.client);
  }
  // The terminal's command line is clipped rather than scrolled, so check the input box itself.
  await page.goto("/#/labs/terminal");
  const input = await page.getByTestId("terminal-input").boundingBox();
  expect(input!.x + input!.width).toBeLessThanOrEqual(320);
});

test("study, imported lessons: an Ascendra lesson plays without the explain-it-back step, says where it came from, and a generated lesson for the same objective wins", async ({ page }) => {
  await onboard(page);
  const question = (objectiveId: string, i: number, role: "fade" | "solo") => ({ id: `${objectiveId}:q${i}`, role, prompt: `Question ${i} on ${objectiveId}`, choices: [`wrong A ${i}`, `right ${i}`, `wrong C ${i}`, `wrong D ${i}`], correctIndex: 1, why: `Because ${i}.` });
  const imported = (objectiveId: string) => ({ objectiveId, sourceHash: "fixture", model: "ascendra-model", generatedAt: "2026-03-01T12:00:00.000Z", guessPrompt: `Guess for ${objectiveId}`, teach: `Imported teaching for ${objectiveId}.`, questions: [question(objectiveId, 1, "fade"), question(objectiveId, 2, "solo")] });
  const importedFile = { courseId: "saa-c03", imported: { source: "ascendra", importedAt: "2026-10-10", models: ["ascendra-model"] }, lessons: [imported("saa-c03:2:1"), imported("saa-c03:2:12")] };
  const generatedFile = {
    courseId: "saa-c03",
    generated: { scriptVersion: 1, promptVersion: 1, generatedAt: "2026-10-09T00:00:00.000Z", models: ["fixture-model"] },
    lessons: [
      {
        objectiveId: "saa-c03:2:12",
        sourceHash: "fixture",
        promptVersion: 1,
        model: "fixture-model",
        generatedAt: "2026-10-09T00:00:00.000Z",
        plain: "A plain paragraph.",
        guessPrompt: "Generated guess.",
        teach: "Generated teaching for read replicas.",
        questions: [1, 2, 3, 4].map((i) => question("saa-c03:2:12", i, i === 1 ? "fade" : "solo")),
        explainPrompt: "Explain it.",
        modelAnswer: "The model answer.",
        rubricPoints: ["One", "Two"],
      },
    ],
    scenarios: [],
  };
  await page.route("**/study/saa-c03.imported.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(importedFile) }));
  await page.route("**/study/saa-c03.lessons.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(generatedFile) }));
  await page.goto("/#/study/saa-c03/2");
  await expect(page.getByTestId("study-objective-1")).toContainText("lesson");
  await page.getByTestId("study-open-1").click();
  const loop = page.getByTestId("lesson-loop");
  await expect(loop).toHaveAttribute("data-step", "guess");
  await expect(page.getByTestId("guess-prompt")).toContainText("Guess for saa-c03:2:1");
  await expect(loop.getByText("Explain it back")).toHaveCount(0);
  await page.getByTestId("guess-skip").click();
  await expect(page.getByTestId("lesson-teach")).toContainText("Imported teaching");
  await expect(page.getByTestId("lesson-plain")).toHaveCount(0);
  await page.getByTestId("teach-next").click();
  await page.locator('[data-testid^="choice-"][data-correct="1"]').click();
  await page.getByTestId("another-question").click();
  await page.locator('[data-testid^="choice-"][data-correct="1"]').click();
  // Two questions in an imported lesson: no third.
  await expect(page.getByTestId("another-question")).toHaveCount(0);
  await expect(page.getByTestId("practice-next")).toHaveText("Finish");
  await page.getByTestId("practice-next").click();
  await expect(loop).toHaveAttribute("data-step", "summary");
  await expect(page.getByTestId("summary-status")).toContainText("Guided");
  await expect(page.getByTestId("summary-status")).toContainText("imported from Ascendra");
  await expect(page.getByTestId("lesson-origin")).toHaveAttribute("data-origin", "imported");
  await expect(page.getByTestId("lesson-origin")).toContainText("Imported from Ascendra: written there by ascendra-model on 2026-03-01");
  // The same objective in both files: the generated lesson is the one shown.
  await page.goto("/#/study/saa-c03/2/12");
  await expect(page.getByTestId("guess-prompt")).toContainText("Generated guess.");
  await expect(page.getByTestId("lesson-origin")).toHaveAttribute("data-origin", "generated");
});
