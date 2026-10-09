import { describe, expect, it } from "vitest";
import { Shell } from "../src/engine/terminal/shell";
import { makeCiProgram, parsePipeline, runPipeline, type StepRunner } from "../src/engine/cicd/pipeline";
import { cicdMissions } from "../src/content/missions/cicd";
import { runTerminalChecks } from "../src/engine/missions/engine";
import type { TerminalWorld } from "../src/domain/types";

const byId = (id: string) => cicdMissions.find((m) => m.id === id)!;

describe("pipeline engine", () => {
  it("parses env and steps, ignoring comments", () => {
    const p = parsePipeline("# nightly\nenv:\n  DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}\nsteps:\n  - name: install\n    run: pip install -r requirements.txt\n  - name: test\n    run: \"python -m pytest tests/\"\n");
    expect(p.env.DEPLOY_TOKEN).toBe("${{ secrets.DEPLOY_TOKEN }}");
    expect(p.steps.map((s) => s.name)).toEqual(["install", "test"]);
    expect(p.steps[1].run).toBe("python -m pytest tests/");
  });

  it("stops at the first failing step and writes a readable log via the ci program", () => {
    const runner: StepRunner = (step) => (step.name === "test" ? { ok: false, lines: ["1 failed"] } : { ok: true, lines: ["ok"] });
    const world: TerminalWorld = {
      hostname: "ci",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        "/repo/.ci/pipeline.yml": { type: "file", content: "steps:\n  - name: install\n    run: pip install\n  - name: test\n    run: pytest\n  - name: deploy\n    run: ./deploy.sh\n" },
        "/var/ci": { type: "dir", mode: 0o777 },
      },
      programs: { ci: makeCiProgram({ ymlPath: "/repo/.ci/pipeline.yml", logPath: "/var/ci/last-run.log", counterPath: "/var/ci/run-counter", runner, firstRunNumber: 7 }) },
    };
    const sh = new Shell(world);
    expect(sh.execute("ci status").stdout).toBe("no runs yet\n");
    const r = sh.execute("ci run");
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toContain("run #8");
    expect(r.stdout).toContain("RESULT: FAILURE at step 'test'");
    expect(r.stdout).not.toContain("[deploy]");
    expect(sh.execute("ci log").stdout).toContain("[test] 1 failed");
    expect(sh.execute("ci status").stdout).toBe("run #8: FAILURE at step 'test'\n");
    expect(sh.execute("help").stdout).toContain("ci          Run the CI pipeline");
    expect(sh.execute("which ci").exitCode).toBe(0);
    const direct = runPipeline(sh.programHost(), "/repo/.ci/pipeline.yml", () => ({ ok: true, lines: [] }), 9);
    expect(direct.success).toBe(true);
  });
});

describe("CI/CD failure-mode missions reject shortcuts", () => {
  it("flaky test: skipping the test makes CI green but fails the mission; a UTC fix passes", () => {
    const m = byId("devops-02-green-locally-red-in-ci");
    const sh = new Shell(m.world);
    expect(sh.execute("ci run").exitCode).toBe(1); // retry does not help
    sh.execute("sudo sed -i 's/def test_report_date_is_today/@pytest.mark.skip\\ndef test_report_date_is_today/' /srv/fleet-api/tests/test_schedule.py");
    expect(sh.execute("ci run").exitCode).toBe(0);
    const checks = runTerminalChecks(m, sh.checkContext());
    expect(checks.find((c) => c.id === "kept")?.passed).toBe(false);
    expect(checks.find((c) => c.id === "utc")?.passed).toBe(false);
  });

  it("secret wiring: pasting the token value is refused by secret scanning; fixing the reference passes", () => {
    const m = byId("devops-04-secret-wiring");
    const sh = new Shell(m.world);
    expect(sh.execute("cat /etc/ci/secrets.env").stderr).toContain("Permission denied");
    sh.execute("sudo sed -i 's/secrets.DEPLOY_API_TOKEN }}/nf_live_7f3a9c2e1b/' /srv/fleet-api/.ci/pipeline.yml");
    expect(sh.execute("cat /srv/fleet-api/.ci/pipeline.yml").stdout).toContain("nf_live_");
    const bad = sh.execute("ci run");
    expect(bad.exitCode).toBe(1);
    expect(bad.stdout).toContain("secret-scanning");
    expect(runTerminalChecks(m, sh.checkContext()).find((c) => c.id === "no-literal")?.passed).toBe(false);
    sh.execute("sudo sed -i 's/nf_live_7f3a9c2e1b/secrets.DEPLOY_TOKEN }}/' /srv/fleet-api/.ci/pipeline.yml");
    expect(sh.execute("ci run").exitCode).toBe(0);
    expect(runTerminalChecks(m, sh.checkContext()).find((c) => c.id === "reference")?.passed).toBe(true);
  });

  it("bad release: rollback requires sudo and metrics reflect the live release", () => {
    const m = byId("devops-03-bad-release-rollback");
    const sh = new Shell(m.world);
    expect(sh.execute("metrics errors").stdout).toContain("18.2%");
    expect(sh.execute("deployctl rollback v2.3.1").stderr).toContain("permission denied");
    expect(sh.execute("sudo deployctl rollback v9.9.9").stderr).toContain("unknown release");
    expect(sh.execute("sudo deployctl rollback v2.3.1").exitCode).toBe(0);
    expect(sh.execute("metrics errors").stdout).toContain("0.4%");
    expect(sh.execute("cat /var/log/deploy.log").stdout).toContain("rollback v2.4.0 -> v2.3.1");
  });
});
