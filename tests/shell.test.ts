import { describe, expect, it } from "vitest";
import { Shell, tokenize } from "../src/engine/terminal/shell";
import type { TerminalWorld } from "../src/domain/types";

const world: TerminalWorld = {
  hostname: "web-01",
  user: "trainee",
  cwd: "/home/trainee",
  fs: {
    "/home/trainee/notes.txt": { type: "file", content: "alpha\nbeta\ngamma\n" },
    "/home/trainee/projects": { type: "dir" },
    "/var/log/app.log": { type: "file", content: "INFO started\nERROR disk full\nINFO retry\nERROR disk full\n" },
    "/etc/secret.conf": { type: "file", content: "token=abc\n", mode: 0o600, owner: "root", group: "root" },
    "/etc/app/app.conf": { type: "file", content: "port=8080\nworkers=4\n", mode: 0o644, owner: "root", group: "root" },
  },
  processes: [
    { pid: 1, user: "root", cpu: 0.0, mem: 0.1, command: "/sbin/init" },
    { pid: 812, user: "root", cpu: 97.5, mem: 3.2, command: "/usr/bin/python3 /opt/report.py", service: "report" },
  ],
  services: [
    { name: "report", status: "running", description: "Nightly report generator" },
    {
      name: "app",
      status: "failed",
      description: "OpsForge web app",
      failureReason: "invalid port in /etc/app/app.conf",
      configPath: "/etc/app/app.conf",
      configCheck: (c) => (/^port=\d+$/m.test(c) && !/port=99999/.test(c) ? null : "invalid port in /etc/app/app.conf"),
    },
  ],
};

describe("tokenize", () => {
  it("handles quotes and operators", () => {
    expect(tokenize(`echo "hello world" 'it''s' > out.txt`).map((t) => t.value)).toEqual(["echo", "hello world", "its", ">", "out.txt"]);
    expect(tokenize("cat a | grep b && ls").map((t) => t.value)).toEqual(["cat", "a", "|", "grep", "b", "&&", "ls"]);
  });
  it("rejects unterminated quotes", () => {
    expect(() => tokenize("echo 'oops")).toThrow();
  });
});

describe("Shell basics", () => {
  it("navigates and lists", () => {
    const sh = new Shell(world);
    expect(sh.execute("pwd").stdout).toBe("/home/trainee\n");
    expect(sh.execute("ls").stdout).toBe("notes.txt  projects/\n");
    expect(sh.execute("cd projects").exitCode).toBe(0);
    expect(sh.execute("pwd").stdout).toBe("/home/trainee/projects\n");
    expect(sh.execute("cd ..; pwd").stdout).toBe("/home/trainee\n");
    expect(sh.execute("cd /var/log && pwd").stdout).toBe("/var/log\n");
    expect(sh.execute("cd ~").exitCode).toBe(0);
    expect(sh.execute("cd nope").stderr).toContain("No such file or directory");
    expect(sh.prompt()).toBe("trainee@web-01:~$ ");
  });

  it("reads, pipes and redirects", () => {
    const sh = new Shell(world);
    expect(sh.execute("cat notes.txt").stdout).toBe("alpha\nbeta\ngamma\n");
    expect(sh.execute("grep -c ERROR /var/log/app.log").stdout).toBe("2\n");
    expect(sh.execute("cat /var/log/app.log | grep ERROR | sort | uniq -c").stdout).toContain("2 ERROR disk full");
    expect(sh.execute("echo hello > out.txt && cat out.txt").stdout).toBe("hello\n");
    expect(sh.execute("echo again >> out.txt; wc -l out.txt").stdout.trim()).toMatch(/^2 out.txt$/);
    expect(sh.execute("head -n 1 notes.txt").stdout).toBe("alpha\n");
    expect(sh.execute("tail -n 1 notes.txt").stdout).toBe("gamma\n");
    expect(sh.execute("grep -n beta notes.txt").stdout).toBe("2:beta\n");
    expect(sh.execute("grep zzz notes.txt").exitCode).toBe(1);
  });

  it("creates, moves and removes files", () => {
    const sh = new Shell(world);
    expect(sh.execute("mkdir -p a/b/c && touch a/b/c/f.txt && find a -type f").stdout).toBe("a/b/c/f.txt\n");
    expect(sh.execute("mv a/b/c/f.txt a/renamed.txt && ls a").stdout).toBe("b/  renamed.txt\n");
    expect(sh.execute("cp a/renamed.txt copy.txt && cat copy.txt").exitCode).toBe(0);
    expect(sh.execute("rm a").stderr).toContain("Is a directory");
    expect(sh.execute("rm -r a && ls").stdout).toBe("copy.txt  notes.txt  projects/\n");
  });

  it("enforces permissions and sudo", () => {
    const sh = new Shell(world);
    expect(sh.execute("cat /etc/secret.conf").stderr).toContain("Permission denied");
    expect(sh.execute("sudo cat /etc/secret.conf").stdout).toBe("token=abc\n");
    expect(sh.execute("echo x > /etc/new.conf").stderr).toContain("Permission denied");
    expect(sh.execute("chmod 600 notes.txt && stat notes.txt").stdout).toContain("0600/-rw-------");
    expect(sh.execute("chmod go+r notes.txt && ls -l notes.txt").stdout).toContain("-rw-r--r--");
    expect(sh.execute("chmod +x notes.txt && ls -l notes.txt").stdout).toContain("-rwxr-xr-x");
    expect(sh.execute("whoami").stdout).toBe("trainee\n");
    expect(sh.execute("sudo whoami").stdout).toBe("root\n");
  });

  it("expands environment variables", () => {
    const sh = new Shell(world);
    expect(sh.execute("echo $HOME").stdout).toBe("/home/trainee\n");
    expect(sh.execute("export APP_ENV=prod; echo $APP_ENV").stdout).toBe("prod\n");
    expect(sh.execute("env | grep APP_ENV").stdout).toBe("APP_ENV=prod\n");
    expect(sh.execute("echo '$HOME'").stdout).toBe("$HOME\n");
  });

  it("inspects and kills processes, affecting services", () => {
    const sh = new Shell(world);
    expect(sh.execute("top").stdout.split("\n")[4]).toContain("812");
    expect(sh.execute("kill 812").stderr).toContain("Operation not permitted");
    expect(sh.execute("sudo kill 812").exitCode).toBe(0);
    expect(sh.execute("ps aux").stdout).not.toContain("report.py");
    expect(sh.execute("systemctl status report").stdout).toContain("inactive (dead)");
  });

  it("manages services with config validation", () => {
    const sh = new Shell(world);
    expect(sh.execute("systemctl status app").stdout).toContain("failed");
    expect(sh.execute("systemctl start app").stderr).toContain("Access denied");
    sh.execute("sudo sed -i 's/port=8080/port=99999/' /etc/app/app.conf");
    const bad = sh.execute("sudo systemctl start app");
    expect(bad.exitCode).toBe(1);
    expect(sh.execute("journalctl -u app").stdout).toContain("invalid port");
    sh.execute("sudo sed -i 's/port=99999/port=8080/' /etc/app/app.conf");
    expect(sh.execute("sudo systemctl restart app").exitCode).toBe(0);
    expect(sh.execute("systemctl status app").stdout).toContain("active (running)");
    expect(sh.execute("ps aux").stdout).toContain("/usr/sbin/app");
  });

  it("sed uses basic regular expressions and substitutes once per line like real sed", () => {
    const sh = new Shell(world);
    sh.execute("echo 'x = now()' > s.py; echo 'y = now()' >> s.py; echo 'z = now() + now()' >> s.py");
    expect(sh.execute("sed -i 's/now()/now(utc)/' s.py && cat s.py").stdout).toBe("x = now(utc)\ny = now(utc)\nz = now(utc) + now()\n");
    expect(sh.execute("sed 's/now(utc)/T/g' s.py").stdout).toBe("x = T\ny = T\nz = T + now()\n");
    expect(sh.execute("echo 'a{1}' | sed 's/a{1}/ok/'").stdout).toBe("ok\n");
    expect(sh.execute("echo 'aaa' | sed 's/a\\+/b/'").stdout).toBe("b\n");
    expect(sh.execute("echo 'ab' | sed 's/\\(a\\)b/\\1c/'").stdout).toBe("ac\n");
  });

  it("reports unsupported commands honestly and documents the subset", () => {
    const sh = new Shell(world);
    const r = sh.execute("docker ps");
    expect(r.exitCode).toBe(127);
    expect(r.stderr).toContain("command not found");
    expect(sh.execute("help").stdout).toContain("simulation");
    expect(sh.execute("help grep").stdout).toContain("grep [-i]");
  });

  it("snapshots and restores state", () => {
    const sh = new Shell(world);
    sh.execute("mkdir work && cd work && echo hi > a.txt");
    const snap = sh.snapshot();
    const sh2 = new Shell(world, {}, snap);
    expect(sh2.execute("pwd").stdout).toBe("/home/trainee/work\n");
    expect(sh2.execute("cat a.txt").stdout).toBe("hi\n");
    expect(sh2.history.length).toBe(3);
  });

  it("exposes a check context for mission validators", () => {
    const sh = new Shell(world);
    sh.execute("echo ok > done.txt");
    const ctx = sh.checkContext();
    expect(ctx.readFile("/home/trainee/done.txt")).toBe("ok\n");
    expect(ctx.exists("done.txt")).toBe(true);
    expect(ctx.history).toContain("echo ok > done.txt");
    expect(ctx.services.app).toBe("failed");
  });

  it("opens the editor for nano/vi", () => {
    const sh = new Shell(world);
    const r = sh.execute("nano notes.txt");
    expect(r.action).toEqual({ type: "edit", path: "/home/trainee/notes.txt" });
    expect(sh.writeFile("notes.txt", "new\n").ok).toBe(true);
    expect(sh.readFile("notes.txt")).toBe("new\n");
  });

  it("simulates network tools from a network table", () => {
    const sh = new Shell(world, {
      hosts: { "db.internal": { ip: "10.0.2.15", reachable: false }, "api.internal": { ip: "10.0.1.7", reachable: true } },
      http: { "http://api.internal/health": { status: 200, body: '{"status":"ok"}' } },
      listening: [{ proto: "tcp", port: 8080, process: "app" }],
    });
    expect(sh.execute("ping -c 1 db.internal").exitCode).toBe(1);
    expect(sh.execute("ping -c 2 api.internal").stdout).toContain("2 received");
    expect(sh.execute("curl http://api.internal/health").stdout).toContain("ok");
    expect(sh.execute("dig db.internal").stdout).toContain("10.0.2.15");
    expect(sh.execute("ss -tlnp").stdout).toContain("8080");
  });
});
