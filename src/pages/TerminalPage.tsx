import { useState } from "react";
import { Shell, COMMAND_DOCS } from "../engine/terminal/shell";
import { Terminal } from "../components/Terminal";
import { FileEditor } from "../components/FileEditor";
import { Callout, PageHeader, Panel } from "../components/ui";
import type { TerminalWorld } from "../domain/types";

const SANDBOX: TerminalWorld = {
  hostname: "sandbox-01",
  user: "trainee",
  cwd: "/home/trainee",
  fs: {
    "/home/trainee/README.txt": { type: "file", content: "This is a free-play sandbox. Nothing you do here affects missions.\nTry: ls -la, cat README.txt, mkdir play, echo hi > play/a.txt, grep -r hi play\n" },
    "/home/trainee/data": { type: "dir" },
    "/home/trainee/data/servers.csv": { type: "file", content: "name,role,cpu\nweb-01,web,12\nweb-02,web,87\ndb-01,database,45\ncache-01,cache,5\n" },
    "/var/log/syslog": { type: "file", content: "Mar 09 09:00:01 sandbox-01 CRON[122]: (root) CMD (run-parts /etc/cron.hourly)\nMar 09 09:05:12 sandbox-01 kernel: [12345.678] Out of memory: Killed process 3321 (python3)\nMar 09 09:06:00 sandbox-01 sshd[412]: Accepted publickey for trainee\n", mode: 0o644, owner: "root", group: "root" },
    "/etc/motd": { type: "file", content: "Welcome to the OpsForge sandbox.\n", mode: 0o644, owner: "root", group: "root" },
  },
  processes: [
    { pid: 1, user: "root", cpu: 0, mem: 0.1, command: "/sbin/init" },
    { pid: 412, user: "root", cpu: 0.1, mem: 0.4, command: "/usr/sbin/sshd -D", service: "ssh" },
    { pid: 3390, user: "trainee", cpu: 42.0, mem: 6.1, command: "python3 crunch.py" },
  ],
  services: [{ name: "ssh", status: "running", description: "OpenSSH server" }],
};

export function TerminalPage() {
  const [shell, setShell] = useState(() => new Shell(SANDBOX));
  const [editing, setEditing] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Terminal"
        subtitle="A free-play sandbox of the OpsForge terminal simulator. Experiment safely: it is not connected to any real machine."
        actions={
          <button type="button" className="btn-secondary" onClick={() => { setShell(new Shell(SANDBOX)); setKey((k) => k + 1); }}>
            Reset sandbox
          </button>
        }
      />
      <Panel>
        <Terminal key={key} shell={shell} onEdit={setEditing} height="28rem" />
      </Panel>
      <Callout kind="warn" title="Simulator limits">
        Supported: {COMMAND_DOCS.length} commands with the most common flags, pipes, redirection, variables, permissions, processes and services. Not supported: real networking, package installation, scripting constructs (loops, functions), globbing (*), and anything not listed by <code>help</code>. Unsupported commands return "command not found" and tell you so.
      </Callout>
      <Panel title="Command reference">
        <div className="grid md:grid-cols-2 gap-x-6 text-sm">
          {COMMAND_DOCS.map((d) => (
            <div key={d.name} className="py-1 border-b" style={{ borderColor: "var(--border)" }}>
              <code className="font-mono text-amber-500">{d.usage}</code>
              <div className="muted text-xs">{d.summary}</div>
            </div>
          ))}
        </div>
      </Panel>
      {editing && <FileEditor shell={shell} path={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
