/**
 * OpsForge virtual Linux terminal.
 *
 * A deterministic, stateful simulator with an in-memory filesystem, a
 * documented command subset, pipes, redirection, environment variables, a
 * simple permission model, simulated processes and services.
 *
 * It is NOT a real shell. Learners never reach the host operating system.
 * See `COMMAND_DOCS` for the exact supported surface and `help` in-app.
 */
import type { FsSpec, ProgramHost, SimProcessSpec, SimServiceSpec, TerminalCheckContext, TerminalWorld } from "../../domain/types";

export interface FsNode {
  type: "file" | "dir";
  content: string;
  mode: number;
  owner: string;
  group: string;
  mtime: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** Side effects the UI should perform (e.g. open the file editor, clear screen). */
  action?: { type: "clear" } | { type: "edit"; path: string } | { type: "exit" };
}

export interface ShellSnapshot {
  fs: Record<string, FsNode>;
  cwd: string;
  env: Record<string, string>;
  history: string[];
  outputs: Array<{ command: string; stdout: string; stderr: string; exitCode: number }>;
  processes: SimProcessSpec[];
  serviceStatus: Record<string, SimServiceSpec["status"]>;
  serviceReason: Record<string, string | undefined>;
  clock: number;
  nextPid: number;
}

export const ROOT_USER = "root";

/* ------------------------------------------------------------------ */
/* Path helpers                                                        */
/* ------------------------------------------------------------------ */

export function normalizePath(cwd: string, p: string, home: string): string {
  if (!p) return cwd;
  if (p === "~") p = home;
  else if (p.startsWith("~/")) p = home + p.slice(1);
  const abs = p.startsWith("/") ? p : `${cwd === "/" ? "" : cwd}/${p}`;
  const parts: string[] = [];
  for (const seg of abs.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

export function dirname(p: string): string {
  if (p === "/") return "/";
  const i = p.lastIndexOf("/");
  return i <= 0 ? "/" : p.slice(0, i);
}

export function basename(p: string): string {
  if (p === "/") return "/";
  return p.slice(p.lastIndexOf("/") + 1);
}

function modeString(node: FsNode): string {
  const t = node.type === "dir" ? "d" : "-";
  const bits = ["r", "w", "x"];
  let s = t;
  for (let who = 2; who >= 0; who--) {
    for (let b = 0; b < 3; b++) {
      const mask = 1 << (who * 3 + (2 - b));
      s += node.mode & mask ? bits[b] : "-";
    }
  }
  return s;
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, " ")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function humanSize(n: number): string {
  if (n < 1024) return `${n}`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`;
  return `${(n / 1024 / 1024).toFixed(1)}M`;
}

/**
 * Converts a POSIX basic regular expression (what sed uses) to a JavaScript
 * one: in BRE, ( ) { } + ? | are literal unless backslash-escaped.
 */
export function breToJs(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) {
      const n = pattern[i + 1];
      if ("(){}+?|".includes(n)) {
        out += n;
        i++;
        continue;
      }
      out += c + n;
      i++;
      continue;
    }
    if ("(){}+?|".includes(c)) {
      out += "\\" + c;
      continue;
    }
    out += c;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

interface Token {
  value: string;
  quoted: boolean;
}

export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let cur = "";
  let quoted = false;
  let inSingle = false;
  let inDouble = false;
  let hasToken = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inSingle) {
      if (c === "'") inSingle = false;
      else cur += c;
      continue;
    }
    if (inDouble) {
      if (c === '"') inDouble = false;
      else if (c === "\\" && i + 1 < line.length && '"\\$'.includes(line[i + 1])) cur += line[++i];
      else cur += c;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      quoted = true;
      hasToken = true;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      quoted = true;
      hasToken = true;
      continue;
    }
    if (c === "\\" && i + 1 < line.length) {
      cur += line[++i];
      hasToken = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (hasToken) tokens.push({ value: cur, quoted });
      cur = "";
      quoted = false;
      hasToken = false;
      continue;
    }
    if (c === "|" || c === ">" || c === "<") {
      if (hasToken) tokens.push({ value: cur, quoted });
      cur = "";
      quoted = false;
      hasToken = false;
      if (c === ">" && line[i + 1] === ">") {
        tokens.push({ value: ">>", quoted: false });
        i++;
      } else if (c === "|" && line[i + 1] === "|") {
        tokens.push({ value: "||", quoted: false });
        i++;
      } else tokens.push({ value: c, quoted: false });
      continue;
    }
    if (c === "&" && line[i + 1] === "&") {
      if (hasToken) tokens.push({ value: cur, quoted });
      cur = "";
      quoted = false;
      hasToken = false;
      tokens.push({ value: "&&", quoted: false });
      i++;
      continue;
    }
    if (c === ";") {
      if (hasToken) tokens.push({ value: cur, quoted });
      cur = "";
      quoted = false;
      hasToken = false;
      tokens.push({ value: ";", quoted: false });
      continue;
    }
    cur += c;
    hasToken = true;
  }
  if (inSingle || inDouble) throw new Error("syntax error: unterminated quote");
  if (hasToken) tokens.push({ value: cur, quoted });
  return tokens;
}

/* ------------------------------------------------------------------ */
/* Command documentation (the supported subset)                        */
/* ------------------------------------------------------------------ */

export interface CommandDoc {
  name: string;
  usage: string;
  summary: string;
  flags?: string[];
}

export const COMMAND_DOCS: CommandDoc[] = [
  { name: "help", usage: "help [command]", summary: "List supported commands or show one command's usage." },
  { name: "pwd", usage: "pwd", summary: "Print the current working directory." },
  { name: "cd", usage: "cd [dir]", summary: "Change directory. `cd` alone goes home; `cd ..` goes up; `cd -` goes back." },
  { name: "ls", usage: "ls [-l] [-a] [-h] [path...]", summary: "List directory contents.", flags: ["-l long format", "-a include hidden", "-h human sizes"] },
  { name: "cat", usage: "cat file...", summary: "Print file contents." },
  { name: "head", usage: "head [-n N] file", summary: "Print the first N lines (default 10)." },
  { name: "tail", usage: "tail [-n N] file", summary: "Print the last N lines (default 10)." },
  { name: "less", usage: "less file", summary: "Same as cat in this simulator." },
  { name: "echo", usage: "echo [-n] text...", summary: "Print text. Supports $VAR and redirection to files." },
  { name: "touch", usage: "touch file...", summary: "Create an empty file or update its timestamp." },
  { name: "mkdir", usage: "mkdir [-p] dir...", summary: "Create directories.", flags: ["-p create parents"] },
  { name: "rm", usage: "rm [-r] [-f] path...", summary: "Remove files (and directories with -r)." },
  { name: "cp", usage: "cp [-r] src dest", summary: "Copy a file or directory." },
  { name: "mv", usage: "mv src dest", summary: "Move or rename." },
  { name: "grep", usage: "grep [-i] [-n] [-v] [-c] [-r] pattern [file...]", summary: "Search text with a regular expression.", flags: ["-i ignore case", "-n line numbers", "-v invert", "-c count", "-r recursive"] },
  { name: "wc", usage: "wc [-l] [-w] [-c] [file]", summary: "Count lines, words and bytes." },
  { name: "sort", usage: "sort [-r] [-n] [-u] [file]", summary: "Sort lines." },
  { name: "uniq", usage: "uniq [-c] [file]", summary: "Collapse adjacent duplicate lines (use after sort)." },
  { name: "cut", usage: "cut -d DELIM -f N [file]", summary: "Extract a delimited field." },
  { name: "find", usage: "find [path] [-name PATTERN] [-type f|d]", summary: "Find files by name or type." },
  { name: "sed", usage: "sed [-i] 's/old/new/[g]' file", summary: "Substitute text (only the s/// form is supported)." },
  { name: "chmod", usage: "chmod MODE file", summary: "Change permissions: numeric (644) or symbolic (u+x, go-w)." },
  { name: "chown", usage: "chown USER[:GROUP] file", summary: "Change owner (requires sudo for files you do not own)." },
  { name: "stat", usage: "stat file", summary: "Show mode, owner and size." },
  { name: "file", usage: "file path", summary: "Describe a path (text, directory, empty)." },
  { name: "whoami", usage: "whoami", summary: "Print the current user." },
  { name: "id", usage: "id", summary: "Print user and group identity." },
  { name: "hostname", usage: "hostname", summary: "Print the machine name." },
  { name: "env", usage: "env | printenv [VAR]", summary: "Show environment variables." },
  { name: "export", usage: "export NAME=value", summary: "Set an environment variable for this session." },
  { name: "history", usage: "history", summary: "Show commands entered in this session." },
  { name: "clear", usage: "clear", summary: "Clear the screen." },
  { name: "date", usage: "date", summary: "Print the simulated date and time." },
  { name: "uptime", usage: "uptime", summary: "Show uptime and load averages." },
  { name: "ps", usage: "ps [aux]", summary: "List processes." },
  { name: "top", usage: "top", summary: "Snapshot of processes sorted by CPU." },
  { name: "kill", usage: "kill [-9] PID", summary: "Send a signal to a process (stops it in this simulator)." },
  { name: "free", usage: "free [-m] [-h]", summary: "Memory usage." },
  { name: "df", usage: "df [-h]", summary: "Disk space by filesystem." },
  { name: "du", usage: "du [-s] [-h] [path]", summary: "Disk usage of a path." },
  { name: "systemctl", usage: "systemctl status|start|stop|restart SERVICE", summary: "Manage simulated services." },
  { name: "journalctl", usage: "journalctl -u SERVICE [-n N]", summary: "Show a service's log entries." },
  { name: "nano", usage: "nano file (also vi, vim)", summary: "Open the file in the built-in editor pane." },
  { name: "sudo", usage: "sudo command", summary: "Run a command as root (allowed in the simulator)." },
  { name: "which", usage: "which command", summary: "Show whether a command is supported." },
  { name: "man", usage: "man command", summary: "Same as help." },
  { name: "ping", usage: "ping [-c N] host", summary: "Simulated reachability check against the mission's network table." },
  { name: "curl", usage: "curl [-I] URL", summary: "Simulated HTTP request against the mission's network table." },
  { name: "dig", usage: "dig NAME (also nslookup)", summary: "Simulated DNS lookup." },
  { name: "ss", usage: "ss -tlnp (also netstat)", summary: "Simulated listening sockets." },
  { name: "exit", usage: "exit", summary: "Reset the prompt (does nothing harmful)." },
];

export const SUPPORTED_COMMANDS = new Set(COMMAND_DOCS.map((d) => d.name).concat(["vi", "vim", "printenv", "nslookup", "netstat"]));

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

const BASE_FS: FsSpec = {
  "/": { type: "dir", mode: 0o755, owner: "root", group: "root" },
  "/bin": { type: "dir", mode: 0o755, owner: "root", group: "root" },
  "/etc": { type: "dir", mode: 0o755, owner: "root", group: "root" },
  "/home": { type: "dir", mode: 0o755, owner: "root", group: "root" },
  "/tmp": { type: "dir", mode: 0o777, owner: "root", group: "root" },
  "/var": { type: "dir", mode: 0o755, owner: "root", group: "root" },
  "/var/log": { type: "dir", mode: 0o755, owner: "root", group: "root" },
  "/etc/hostname": { type: "file", content: "opsforge\n", mode: 0o644, owner: "root", group: "root" },
};

export interface NetworkTable {
  hosts?: Record<string, { ip: string; reachable: boolean; latencyMs?: number }>;
  http?: Record<string, { status: number; body: string; headers?: Record<string, string> }>;
  listening?: Array<{ proto: "tcp" | "udp"; port: number; process: string; address?: string }>;
}

export class Shell {
  fs: Record<string, FsNode> = {};
  cwd: string;
  env: Record<string, string>;
  history: string[] = [];
  outputs: ShellSnapshot["outputs"] = [];
  processes: SimProcessSpec[];
  serviceStatus: Record<string, SimServiceSpec["status"]> = {};
  serviceReason: Record<string, string | undefined> = {};
  clock: number;
  nextPid = 2000;
  private prevCwd: string;
  readonly world: TerminalWorld;
  readonly network: NetworkTable;
  private user: string;
  private sudo = false;
  readonly home: string;

  constructor(world: TerminalWorld, network: NetworkTable = {}, snapshot?: ShellSnapshot) {
    this.world = world;
    this.network = network;
    this.user = world.user;
    this.home = world.user === ROOT_USER ? "/root" : `/home/${world.user}`;
    this.clock = Date.UTC(2026, 2, 9, 9, 15, 0);
    this.env = { HOME: this.home, USER: world.user, SHELL: "/bin/bash", PATH: "/usr/local/bin:/usr/bin:/bin", HOSTNAME: world.hostname, PWD: world.cwd, ...(world.env ?? {}) };
    this.cwd = world.cwd;
    this.prevCwd = world.cwd;
    this.processes = (world.processes ?? []).map((p) => ({ ...p }));
    for (const s of world.services ?? []) {
      this.serviceStatus[s.name] = s.status;
      this.serviceReason[s.name] = s.failureReason;
    }
    if (snapshot) {
      this.restore(snapshot);
    } else {
      this.loadFs({ ...BASE_FS, [this.home]: { type: "dir", mode: 0o755, owner: world.user, group: world.user }, ...world.fs });
    }
  }

  /* ---------------- persistence ---------------- */

  snapshot(): ShellSnapshot {
    return {
      fs: structuredClone(this.fs),
      cwd: this.cwd,
      env: { ...this.env },
      history: [...this.history],
      outputs: [...this.outputs],
      processes: structuredClone(this.processes),
      serviceStatus: { ...this.serviceStatus },
      serviceReason: { ...this.serviceReason },
      clock: this.clock,
      nextPid: this.nextPid,
    };
  }

  restore(s: ShellSnapshot) {
    this.fs = structuredClone(s.fs);
    this.cwd = s.cwd;
    this.env = { ...s.env };
    this.history = [...s.history];
    this.outputs = [...s.outputs];
    this.processes = structuredClone(s.processes);
    this.serviceStatus = { ...s.serviceStatus };
    this.serviceReason = { ...s.serviceReason };
    this.clock = s.clock;
    this.nextPid = s.nextPid;
  }

  private loadFs(spec: FsSpec) {
    for (const [path, node] of Object.entries(spec)) {
      // ensure parents exist
      const parts = path.split("/").filter(Boolean);
      let cur = "";
      for (let i = 0; i < parts.length - 1; i++) {
        cur += "/" + parts[i];
        if (!this.fs[cur]) this.fs[cur] = { type: "dir", content: "", mode: 0o755, owner: "root", group: "root", mtime: this.clock };
      }
      this.fs[path] = {
        type: node.type,
        content: node.type === "file" ? node.content : "",
        mode: node.mode ?? (node.type === "dir" ? 0o755 : 0o644),
        owner: node.owner ?? (path.startsWith(this.home) ? this.world.user : "root"),
        group: node.group ?? (path.startsWith(this.home) ? this.world.user : "root"),
        mtime: this.clock,
      };
    }
    if (!this.fs["/"]) this.fs["/"] = { type: "dir", content: "", mode: 0o755, owner: "root", group: "root", mtime: this.clock };
  }

  /* ---------------- helpers used by validators ---------------- */

  prompt(): string {
    const short = this.cwd === this.home ? "~" : this.cwd.startsWith(this.home + "/") ? "~" + this.cwd.slice(this.home.length) : this.cwd;
    return `${this.user}@${this.world.hostname}:${short}$ `;
  }

  checkContext(): TerminalCheckContext {
    return {
      readFile: (p) => {
        const n = this.fs[this.abs(p)];
        return n && n.type === "file" ? n.content : null;
      },
      exists: (p) => Boolean(this.fs[this.abs(p)]),
      isDir: (p) => this.fs[this.abs(p)]?.type === "dir",
      mode: (p) => this.fs[this.abs(p)]?.mode ?? null,
      owner: (p) => this.fs[this.abs(p)]?.owner ?? null,
      history: this.history,
      outputs: this.outputs,
      services: { ...this.serviceStatus },
      processes: this.processes,
      cwd: this.cwd,
    };
  }

  abs(p: string): string {
    return normalizePath(this.cwd, p, this.home);
  }

  /** Capability view handed to mission-specific programs. */
  programHost(): ProgramHost {
    return {
      readFile: (p) => this.readFile(p),
      writeFile: (p, content, asRoot = false) => this.writeFile(p, content, asRoot || this.sudo),
      exists: (p) => Boolean(this.fs[this.abs(p)]),
      mode: (p) => this.fs[this.abs(p)]?.mode ?? null,
      env: this.env,
      cwd: this.cwd,
      user: this.effectiveUser(),
      history: this.history,
    };
  }

  readFile(p: string): string | null {
    const n = this.fs[this.abs(p)];
    return n && n.type === "file" ? n.content : null;
  }

  /** Used by the GUI editor. */
  writeFile(p: string, content: string, asRoot = false): { ok: boolean; error?: string } {
    const path = this.abs(p);
    const existing = this.fs[path];
    if (existing?.type === "dir") return { ok: false, error: `${p}: Is a directory` };
    const parent = this.fs[dirname(path)];
    if (!parent || parent.type !== "dir") return { ok: false, error: `${p}: No such file or directory` };
    const effectiveUser = asRoot ? ROOT_USER : this.user;
    if (existing) {
      if (!this.can(existing, "w", effectiveUser)) return { ok: false, error: `${p}: Permission denied` };
      existing.content = content;
      existing.mtime = this.tick();
    } else {
      if (!this.can(parent, "w", effectiveUser)) return { ok: false, error: `${p}: Permission denied` };
      this.fs[path] = { type: "file", content, mode: 0o644, owner: effectiveUser, group: effectiveUser, mtime: this.tick() };
    }
    return { ok: true };
  }

  private tick(): number {
    this.clock += 37_000;
    return this.clock;
  }

  private can(node: FsNode, what: "r" | "w" | "x", user = this.effectiveUser()): boolean {
    if (user === ROOT_USER) return true;
    const bit = what === "r" ? 4 : what === "w" ? 2 : 1;
    const shift = node.owner === user ? 6 : node.group === user ? 3 : 0;
    return Boolean((node.mode >> shift) & bit);
  }

  private effectiveUser(): string {
    return this.sudo ? ROOT_USER : this.user;
  }

  /* ---------------- execution ---------------- */

  /** Execute one input line (may contain pipes, &&, ;, redirection). */
  execute(line: string): ExecResult {
    const trimmed = line.trim();
    if (trimmed) this.history.push(trimmed);
    if (!trimmed) return { stdout: "", stderr: "", exitCode: 0 };
    let tokens: Token[];
    try {
      tokens = tokenize(trimmed);
    } catch (e) {
      const r = { stdout: "", stderr: `bash: ${(e as Error).message}\n`, exitCode: 2 };
      this.outputs.push({ command: trimmed, ...r });
      return r;
    }
    // split into command lists by ; && ||
    const lists: Array<{ op: ";" | "&&" | "||"; tokens: Token[] }> = [];
    let current: Token[] = [];
    let op: ";" | "&&" | "||" = ";";
    for (const t of tokens) {
      if (!t.quoted && (t.value === ";" || t.value === "&&" || t.value === "||")) {
        lists.push({ op, tokens: current });
        current = [];
        op = t.value;
      } else current.push(t);
    }
    lists.push({ op, tokens: current });

    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let action: ExecResult["action"];
    for (const { op: listOp, tokens: ts } of lists) {
      if (listOp === "&&" && exitCode !== 0) continue;
      if (listOp === "||" && exitCode === 0) continue;
      if (ts.length === 0) continue;
      const r = this.runPipeline(ts);
      stdout += r.stdout;
      stderr += r.stderr;
      exitCode = r.exitCode;
      if (r.action) action = r.action;
    }
    const result: ExecResult = { stdout, stderr, exitCode, action };
    this.outputs.push({ command: trimmed, stdout, stderr, exitCode });
    return result;
  }

  private runPipeline(tokens: Token[]): ExecResult {
    const stages: Token[][] = [];
    let cur: Token[] = [];
    for (const t of tokens) {
      if (!t.quoted && t.value === "|") {
        stages.push(cur);
        cur = [];
      } else cur.push(t);
    }
    stages.push(cur);
    let stdin = "";
    let last: ExecResult = { stdout: "", stderr: "", exitCode: 0 };
    let errors = "";
    for (const stage of stages) {
      if (stage.length === 0) return { stdout: "", stderr: "bash: syntax error near unexpected token `|'\n", exitCode: 2 };
      last = this.runSimple(stage, stdin);
      errors += last.stderr;
      stdin = last.stdout;
    }
    return { ...last, stderr: errors };
  }

  private expand(t: Token): string {
    // $VAR expansion (not inside single quotes, which the tokenizer already handled by marking quoted; we still expand for double quotes)
    return t.value.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_, name: string) => this.env[name] ?? "");
  }

  private runSimple(tokens: Token[], stdin: string): ExecResult {
    // redirection
    let redirect: { path: string; append: boolean } | null = null;
    let stdinFile: string | null = null;
    const args: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (!t.quoted && (t.value === ">" || t.value === ">>")) {
        const target = tokens[i + 1];
        if (!target) return { stdout: "", stderr: "bash: syntax error near unexpected token `newline'\n", exitCode: 2 };
        redirect = { path: this.expand(target), append: t.value === ">>" };
        i++;
        continue;
      }
      if (!t.quoted && t.value === "<") {
        const target = tokens[i + 1];
        if (!target) return { stdout: "", stderr: "bash: syntax error near unexpected token `newline'\n", exitCode: 2 };
        stdinFile = this.expand(target);
        i++;
        continue;
      }
      if (!t.quoted && t.value === "2>&1") continue;
      // single-quoted tokens should not expand; tokenizer loses that distinction, so treat quoted tokens containing $ literally only when they came from single quotes - approximated: expand all except when value includes '$' and quoted; keep simple: expand unquoted and double-quoted.
      args.push(t.quoted && t.value.includes("$") && tokens.length > 0 && this.wasSingleQuoted(t) ? t.value : this.expand(t));
    }
    if (stdinFile) {
      const content = this.readFile(stdinFile);
      if (content === null) return { stdout: "", stderr: `bash: ${stdinFile}: No such file or directory\n`, exitCode: 1 };
      stdin = content;
    }
    if (args.length === 0) return { stdout: "", stderr: "", exitCode: 0 };

    let result: ExecResult;
    if (args[0] === "sudo") {
      if (args.length === 1) return { stdout: "", stderr: "usage: sudo command\n", exitCode: 1 };
      this.sudo = true;
      try {
        result = this.dispatch(args.slice(1), stdin);
      } finally {
        this.sudo = false;
      }
    } else {
      result = this.dispatch(args, stdin);
    }

    if (redirect) {
      const path = this.abs(redirect.path);
      const existing = this.fs[path];
      const content = (redirect.append && existing?.type === "file" ? existing.content : "") + result.stdout;
      const w = this.writeFile(path, content, this.sudo);
      if (!w.ok) return { stdout: "", stderr: `bash: ${w.error}\n`, exitCode: 1 };
      return { ...result, stdout: "" };
    }
    return result;
  }

  // The tokenizer marks quoted tokens; we approximate "single-quoted" as quoted tokens whose raw value still contains a `$`.
  private wasSingleQuoted(t: Token): boolean {
    return t.quoted;
  }

  private dispatch(args: string[], stdin: string): ExecResult {
    const [cmd, ...rest] = args;
    const ok = (stdout: string): ExecResult => ({ stdout, stderr: "", exitCode: 0 });
    const fail = (msg: string, code = 1): ExecResult => ({ stdout: "", stderr: msg.endsWith("\n") ? msg : msg + "\n", exitCode: code });
    const nl = (s: string) => (s.length === 0 || s.endsWith("\n") ? s : s + "\n");

    switch (cmd) {
      case "help":
      case "man": {
        if (rest[0]) {
          const prog = this.world.programs?.[rest[0]];
          if (prog) return ok(`${prog.usage}\n  ${prog.summary}\n`);
          const d = COMMAND_DOCS.find((x) => x.name === rest[0]);
          if (!d) return fail(`help: no documentation for '${rest[0]}'. This simulator supports a documented subset; run 'help' to list it.`);
          return ok(`${d.usage}\n  ${d.summary}\n${(d.flags ?? []).map((f) => `  ${f}`).join("\n")}${d.flags ? "\n" : ""}`);
        }
        const lines = COMMAND_DOCS.map((d) => `${d.name.padEnd(11)} ${d.summary}`);
        const progs = Object.entries(this.world.programs ?? {}).map(([n, p]) => `${n.padEnd(11)} ${p.summary} (mission tool)`);
        return ok(`OpsForge terminal simulator. Supported commands (type 'help NAME' for usage):\n${lines.join("\n")}${progs.length ? "\n" + progs.join("\n") : ""}\nThis is a simulation: it is not connected to a real operating system.\n`);
      }
      case "pwd":
        return ok(this.cwd + "\n");
      case "whoami":
        return ok(this.effectiveUser() + "\n");
      case "id": {
        const u = this.effectiveUser();
        return ok(u === ROOT_USER ? "uid=0(root) gid=0(root) groups=0(root)\n" : `uid=1000(${u}) gid=1000(${u}) groups=1000(${u}),27(sudo)\n`);
      }
      case "hostname":
        return ok(this.world.hostname + "\n");
      case "date":
        return ok(new Date(this.clock).toUTCString().replace("GMT", "UTC") + "\n");
      case "uptime": {
        const load = this.processes.reduce((a, p) => a + p.cpu, 0) / 100;
        return ok(` 09:15:00 up 12 days,  3:41,  1 user,  load average: ${load.toFixed(2)}, ${(load * 0.8).toFixed(2)}, ${(load * 0.6).toFixed(2)}\n`);
      }
      case "clear":
        return { stdout: "", stderr: "", exitCode: 0, action: { type: "clear" } };
      case "exit":
        return { stdout: "", stderr: "", exitCode: 0, action: { type: "exit" } };
      case "history":
        return ok(this.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join("\n") + "\n");
      case "which":
        return rest[0] && (SUPPORTED_COMMANDS.has(rest[0]) || this.world.programs?.[rest[0]]) ? ok(`/usr/bin/${rest[0]}\n`) : fail(`${rest[0] ?? ""} not found`, 1);
      case "env":
      case "printenv": {
        if (rest[0]) return this.env[rest[0]] !== undefined ? ok(this.env[rest[0]] + "\n") : fail("", 1);
        return ok(Object.entries(this.env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
      }
      case "export": {
        for (const a of rest) {
          const m = a.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
          if (!m) return fail(`export: '${a}': not a valid identifier`);
          this.env[m[1]] = m[2];
        }
        return ok("");
      }
      case "echo": {
        const noNl = rest[0] === "-n";
        const text = (noNl ? rest.slice(1) : rest).join(" ");
        return ok(noNl ? text : text + "\n");
      }
      case "cd": {
        const target = rest[0] === "-" ? this.prevCwd : rest[0] ? this.abs(rest[0]) : this.home;
        const node = this.fs[target];
        if (!node) return fail(`bash: cd: ${rest[0]}: No such file or directory`);
        if (node.type !== "dir") return fail(`bash: cd: ${rest[0]}: Not a directory`);
        if (!this.can(node, "x")) return fail(`bash: cd: ${rest[0]}: Permission denied`);
        this.prevCwd = this.cwd;
        this.cwd = target;
        this.env.PWD = target;
        return ok("");
      }
      case "ls":
        return this.cmdLs(rest);
      case "cat":
      case "less": {
        if (rest.length === 0) return ok(stdin);
        let out = "";
        let code = 0;
        let err = "";
        for (const f of rest) {
          const r = this.readForUser(f);
          if (r.error) {
            err += `cat: ${r.error}\n`;
            code = 1;
          } else out += r.content;
        }
        return { stdout: out, stderr: err, exitCode: code };
      }
      case "head":
      case "tail": {
        let n = 10;
        const files: string[] = [];
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === "-n") n = parseInt(rest[++i] ?? "10", 10);
          else if (/^-\d+$/.test(rest[i])) n = parseInt(rest[i].slice(1), 10);
          else if (rest[i] === "-f") continue;
          else files.push(rest[i]);
        }
        if (Number.isNaN(n)) return fail(`${cmd}: invalid number of lines`);
        const content = files.length ? this.readForUser(files[0]) : { content: stdin };
        if ("error" in content && content.error) return fail(`${cmd}: ${content.error}`);
        const lines = nl(content.content ?? "").split("\n");
        lines.pop();
        const picked = cmd === "head" ? lines.slice(0, n) : lines.slice(-n);
        return ok(picked.length ? picked.join("\n") + "\n" : "");
      }
      case "touch": {
        if (!rest.length) return fail("touch: missing file operand");
        for (const f of rest) {
          const path = this.abs(f);
          const n = this.fs[path];
          if (n) n.mtime = this.tick();
          else {
            const w = this.writeFile(path, "", this.sudo);
            if (!w.ok) return fail(`touch: cannot touch '${f}': ${w.error?.split(": ").pop()}`);
          }
        }
        return ok("");
      }
      case "mkdir": {
        const parents = rest.includes("-p");
        const dirs = rest.filter((a) => a !== "-p");
        if (!dirs.length) return fail("mkdir: missing operand");
        for (const d of dirs) {
          const path = this.abs(d);
          if (this.fs[path]) {
            if (parents) continue;
            return fail(`mkdir: cannot create directory '${d}': File exists`);
          }
          const parts = path.split("/").filter(Boolean);
          let cur = "";
          for (let i = 0; i < parts.length; i++) {
            cur += "/" + parts[i];
            if (this.fs[cur]) continue;
            if (i < parts.length - 1 && !parents) return fail(`mkdir: cannot create directory '${d}': No such file or directory`);
            const parent = this.fs[dirname(cur)];
            if (!this.can(parent, "w")) return fail(`mkdir: cannot create directory '${d}': Permission denied`);
            this.fs[cur] = { type: "dir", content: "", mode: 0o755, owner: this.effectiveUser(), group: this.effectiveUser(), mtime: this.tick() };
          }
        }
        return ok("");
      }
      case "rm": {
        const recursive = rest.includes("-r") || rest.includes("-rf") || rest.includes("-fr") || rest.includes("-R");
        const force = rest.includes("-f") || rest.includes("-rf") || rest.includes("-fr");
        const targets = rest.filter((a) => !a.startsWith("-"));
        if (!targets.length) return fail("rm: missing operand");
        for (const t of targets) {
          const path = this.abs(t);
          const n = this.fs[path];
          if (!n) {
            if (force) continue;
            return fail(`rm: cannot remove '${t}': No such file or directory`);
          }
          if (path === "/" || path === this.home) return fail(`rm: refusing to remove '${t}': protected in this simulator`);
          if (n.type === "dir" && !recursive) return fail(`rm: cannot remove '${t}': Is a directory`);
          if (!this.can(this.fs[dirname(path)], "w")) return fail(`rm: cannot remove '${t}': Permission denied`);
          for (const k of Object.keys(this.fs)) if (k === path || k.startsWith(path + "/")) delete this.fs[k];
        }
        return ok("");
      }
      case "cp": {
        const recursive = rest.includes("-r") || rest.includes("-R");
        const t = rest.filter((a) => !a.startsWith("-"));
        if (t.length < 2) return fail("cp: missing destination file operand");
        const src = this.abs(t[0]);
        let dest = this.abs(t[1]);
        const sn = this.fs[src];
        if (!sn) return fail(`cp: cannot stat '${t[0]}': No such file or directory`);
        if (sn.type === "dir" && !recursive) return fail(`cp: -r not specified; omitting directory '${t[0]}'`);
        if (!this.can(sn, "r")) return fail(`cp: cannot open '${t[0]}' for reading: Permission denied`);
        if (this.fs[dest]?.type === "dir") dest = dest + "/" + basename(src);
        const parent = this.fs[dirname(dest)];
        if (!parent || parent.type !== "dir") return fail(`cp: cannot create '${t[1]}': No such file or directory`);
        if (!this.can(parent, "w")) return fail(`cp: cannot create '${t[1]}': Permission denied`);
        for (const k of Object.keys(this.fs)) {
          if (k === src || k.startsWith(src + "/")) {
            const nk = dest + k.slice(src.length);
            this.fs[nk] = { ...this.fs[k], owner: this.effectiveUser(), group: this.effectiveUser(), mtime: this.tick() };
          }
        }
        return ok("");
      }
      case "mv": {
        const t = rest.filter((a) => !a.startsWith("-"));
        if (t.length < 2) return fail("mv: missing destination file operand");
        const src = this.abs(t[0]);
        let dest = this.abs(t[1]);
        const sn = this.fs[src];
        if (!sn) return fail(`mv: cannot stat '${t[0]}': No such file or directory`);
        if (this.fs[dest]?.type === "dir") dest = dest + "/" + basename(src);
        const parent = this.fs[dirname(dest)];
        if (!parent || parent.type !== "dir") return fail(`mv: cannot move '${t[0]}' to '${t[1]}': No such file or directory`);
        if (!this.can(parent, "w") || !this.can(this.fs[dirname(src)], "w")) return fail(`mv: cannot move '${t[0]}': Permission denied`);
        const keys = Object.keys(this.fs).filter((k) => k === src || k.startsWith(src + "/"));
        for (const k of keys) {
          const nk = dest + k.slice(src.length);
          this.fs[nk] = { ...this.fs[k], mtime: this.tick() };
          delete this.fs[k];
        }
        return ok("");
      }
      case "grep":
        return this.cmdGrep(rest, stdin);
      case "wc": {
        const flags = rest.filter((a) => a.startsWith("-"));
        const files = rest.filter((a) => !a.startsWith("-"));
        const content = files.length ? this.readForUser(files[0]) : { content: stdin };
        if ("error" in content && content.error) return fail(`wc: ${content.error}`);
        const text = content.content ?? "";
        const l = (text.match(/\n/g) ?? []).length;
        const w = text.split(/\s+/).filter(Boolean).length;
        const c = text.length;
        const parts: string[] = [];
        if (!flags.length || flags.includes("-l")) parts.push(String(l));
        if (!flags.length || flags.includes("-w")) parts.push(String(w));
        if (!flags.length || flags.includes("-c")) parts.push(String(c));
        return ok(parts.map((p) => p.padStart(6)).join("") + (files.length ? " " + files[0] : "") + "\n");
      }
      case "sort": {
        const files = rest.filter((a) => !a.startsWith("-"));
        const content = files.length ? this.readForUser(files[0]) : { content: stdin };
        if ("error" in content && content.error) return fail(`sort: ${content.error}`);
        let lines = nl(content.content ?? "").split("\n");
        lines.pop();
        const numeric = rest.includes("-n") || rest.includes("-rn") || rest.includes("-nr");
        lines.sort((a, b) => (numeric ? parseFloat(a) - parseFloat(b) || a.localeCompare(b) : a.localeCompare(b)));
        if (rest.includes("-r") || rest.includes("-rn") || rest.includes("-nr")) lines.reverse();
        if (rest.includes("-u")) lines = lines.filter((x, i) => i === 0 || x !== lines[i - 1]);
        return ok(lines.length ? lines.join("\n") + "\n" : "");
      }
      case "uniq": {
        const files = rest.filter((a) => !a.startsWith("-"));
        const content = files.length ? this.readForUser(files[0]) : { content: stdin };
        if ("error" in content && content.error) return fail(`uniq: ${content.error}`);
        const lines = nl(content.content ?? "").split("\n");
        lines.pop();
        const out: string[] = [];
        let prev: string | null = null;
        let count = 0;
        const flush = () => {
          if (prev !== null) out.push(rest.includes("-c") ? `${String(count).padStart(7)} ${prev}` : prev);
        };
        for (const l of lines) {
          if (l === prev) count++;
          else {
            flush();
            prev = l;
            count = 1;
          }
        }
        flush();
        return ok(out.length ? out.join("\n") + "\n" : "");
      }
      case "cut": {
        let delim = "\t";
        let field = 1;
        const files: string[] = [];
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === "-d") delim = rest[++i] ?? "\t";
          else if (rest[i].startsWith("-d")) delim = rest[i].slice(2);
          else if (rest[i] === "-f") field = parseInt(rest[++i] ?? "1", 10);
          else if (rest[i].startsWith("-f")) field = parseInt(rest[i].slice(2), 10);
          else files.push(rest[i]);
        }
        const content = files.length ? this.readForUser(files[0]) : { content: stdin };
        if ("error" in content && content.error) return fail(`cut: ${content.error}`);
        const lines = nl(content.content ?? "").split("\n");
        lines.pop();
        return ok(lines.map((l) => l.split(delim)[field - 1] ?? "").join("\n") + (lines.length ? "\n" : ""));
      }
      case "find": {
        let start = ".";
        let name: string | null = null;
        let type: string | null = null;
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === "-name") name = rest[++i] ?? null;
          else if (rest[i] === "-type") type = rest[++i] ?? null;
          else if (!rest[i].startsWith("-")) start = rest[i];
        }
        const base = this.abs(start);
        if (!this.fs[base]) return fail(`find: '${start}': No such file or directory`);
        const re = name ? new RegExp("^" + name.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$") : null;
        const out = Object.keys(this.fs)
          .filter((k) => k === base || k.startsWith(base === "/" ? "/" : base + "/"))
          .filter((k) => (!re || re.test(basename(k))) && (!type || (type === "f" ? this.fs[k].type === "file" : this.fs[k].type === "dir")))
          .sort()
          .map((k) => (start === "." ? "." + (k === this.cwd ? "" : k.slice(this.cwd === "/" ? 0 : this.cwd.length)) : k.replace(base, start)));
        return ok(out.length ? out.join("\n") + "\n" : "");
      }
      case "sed": {
        const inPlace = rest.includes("-i");
        const a = rest.filter((x) => x !== "-i" && x !== "-e");
        const expr = a[0];
        const file = a[1];
        const m = expr?.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/);
        if (!m) return fail("sed: only the substitution form s/old/new/[g] is supported in this simulator");
        let re: RegExp;
        try {
          re = new RegExp(breToJs(m[2]), (m[4].includes("g") ? "g" : "") + (m[4].includes("i") ? "i" : ""));
        } catch {
          return fail("sed: invalid regular expression");
        }
        const content = file ? this.readForUser(file) : { content: stdin };
        if ("error" in content && content.error) return fail(`sed: can't read ${file}: ${content.error.split(": ").pop()}`);
        const replacement = m[3].replace(/\\n/g, "\n").replace(/\\(\d)/g, "$$$1");
        // Like real sed: the substitution applies to each line independently.
        const replaced = (content.content ?? "").split("\n").map((line) => line.replace(re, replacement)).join("\n");
        if (inPlace) {
          if (!file) return fail("sed: no input files");
          const w = this.writeFile(file, replaced, this.sudo);
          if (!w.ok) return fail(`sed: couldn't open file ${file}: ${w.error?.split(": ").pop()}`);
          return ok("");
        }
        return ok(replaced);
      }
      case "chmod": {
        if (rest.length < 2) return fail("chmod: missing operand");
        const [mode, ...files] = rest.filter((x) => x !== "-R");
        for (const f of files) {
          const n = this.fs[this.abs(f)];
          if (!n) return fail(`chmod: cannot access '${f}': No such file or directory`);
          if (n.owner !== this.effectiveUser() && this.effectiveUser() !== ROOT_USER) return fail(`chmod: changing permissions of '${f}': Operation not permitted`);
          if (/^[0-7]{3,4}$/.test(mode)) n.mode = parseInt(mode.slice(-3), 8);
          else {
            const sm = mode.match(/^([ugoa]*)([+-=])([rwx]+)$/);
            if (!sm) return fail(`chmod: invalid mode: '${mode}'`);
            const who = sm[1] || "a";
            let bits = 0;
            if (sm[3].includes("r")) bits |= 4;
            if (sm[3].includes("w")) bits |= 2;
            if (sm[3].includes("x")) bits |= 1;
            const shifts = [...(who.includes("a") ? "ugo" : who)].map((c) => (c === "u" ? 6 : c === "g" ? 3 : 0));
            for (const s of shifts) {
              if (sm[2] === "+") n.mode |= bits << s;
              else if (sm[2] === "-") n.mode &= ~(bits << s);
              else n.mode = (n.mode & ~(7 << s)) | (bits << s);
            }
          }
          n.mtime = this.tick();
        }
        return ok("");
      }
      case "chown": {
        if (rest.length < 2) return fail("chown: missing operand");
        const [spec, ...files] = rest.filter((x) => x !== "-R");
        const [owner, group] = spec.split(":");
        for (const f of files) {
          const n = this.fs[this.abs(f)];
          if (!n) return fail(`chown: cannot access '${f}': No such file or directory`);
          if (this.effectiveUser() !== ROOT_USER) return fail(`chown: changing ownership of '${f}': Operation not permitted`);
          n.owner = owner;
          if (group) n.group = group;
          n.mtime = this.tick();
        }
        return ok("");
      }
      case "stat": {
        const n = this.fs[this.abs(rest[0] ?? "")];
        if (!n) return fail(`stat: cannot stat '${rest[0] ?? ""}': No such file or directory`);
        return ok(`  File: ${rest[0]}\n  Size: ${n.content.length}\tType: ${n.type === "dir" ? "directory" : "regular file"}\nAccess: (0${n.mode.toString(8)}/${modeString(n)})  Uid: ${n.owner}   Gid: ${n.group}\nModify: ${new Date(n.mtime).toISOString()}\n`);
      }
      case "file": {
        const n = this.fs[this.abs(rest[0] ?? "")];
        if (!n) return fail(`file: cannot open '${rest[0] ?? ""}' (No such file or directory)`);
        return ok(`${rest[0]}: ${n.type === "dir" ? "directory" : n.content.length === 0 ? "empty" : n.content.startsWith("#!") ? "script text executable" : "ASCII text"}\n`);
      }
      case "ps":
      case "top": {
        const procs = [...this.processes].sort((a, b) => (cmd === "top" ? b.cpu - a.cpu : a.pid - b.pid));
        const header = cmd === "top" ? `top - 09:15:00 up 12 days, load average: ${(procs.reduce((a, p) => a + p.cpu, 0) / 100).toFixed(2)}\nTasks: ${procs.length} total\n\n` : "";
        const rows = procs.map((p) => `${p.user.padEnd(10)}${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${p.command}`);
        return ok(`${header}USER         PID  %CPU  %MEM COMMAND\n${rows.join("\n")}\n`);
      }
      case "kill": {
        const pidStr = rest.find((a) => /^\d+$/.test(a));
        if (!pidStr) return fail("kill: usage: kill [-9] PID");
        const pid = parseInt(pidStr, 10);
        const idx = this.processes.findIndex((p) => p.pid === pid);
        if (idx < 0) return fail(`bash: kill: (${pid}) - No such process`);
        const proc = this.processes[idx];
        if (proc.user !== this.effectiveUser() && this.effectiveUser() !== ROOT_USER) return fail(`bash: kill: (${pid}) - Operation not permitted`);
        this.processes.splice(idx, 1);
        if (proc.service && this.serviceStatus[proc.service] !== undefined) {
          this.serviceStatus[proc.service] = "stopped";
          this.serviceReason[proc.service] = `Main process exited, code=killed, status=${rest.includes("-9") ? "9/KILL" : "15/TERM"}`;
        }
        return ok("");
      }
      case "free": {
        const usedMb = Math.round(this.processes.reduce((a, p) => a + p.mem, 0) * 40 + 600);
        const total = 4096;
        if (rest.includes("-h")) return ok(`               total        used        free\nMem:            4.0Gi      ${(usedMb / 1024).toFixed(1)}Gi      ${((total - usedMb) / 1024).toFixed(1)}Gi\nSwap:           1.0Gi       0.0Gi      1.0Gi\n`);
        return ok(`               total        used        free\nMem:            ${total}        ${usedMb}        ${total - usedMb}\nSwap:           1024           0        1024\n`);
      }
      case "df": {
        const used = Object.values(this.fs).reduce((a, n) => a + n.content.length, 0);
        const pct = Math.min(99, Math.round(((used + 6_000_000_000) / 20_000_000_000) * 100));
        return ok(rest.includes("-h")
          ? `Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        20G  ${((used + 6_000_000_000) / 1e9).toFixed(1)}G   ${(20 - (used + 6_000_000_000) / 1e9).toFixed(1)}G  ${pct}% /\ntmpfs           2.0G     0  2.0G   0% /tmp\n`
          : `Filesystem     1K-blocks     Used Available Use% Mounted on\n/dev/sda1       20971520 ${Math.round((used + 6_000_000_000) / 1024)} ${Math.round(20971520 - (used + 6_000_000_000) / 1024)}  ${pct}% /\n`);
      }
      case "du": {
        const target = rest.find((a) => !a.startsWith("-")) ?? ".";
        const base = this.abs(target);
        if (!this.fs[base]) return fail(`du: cannot access '${target}': No such file or directory`);
        const summarize = rest.includes("-s") || rest.includes("-sh") || rest.includes("-hs");
        const human = rest.includes("-h") || rest.includes("-sh") || rest.includes("-hs");
        const entries = Object.keys(this.fs).filter((k) => k === base || k.startsWith(base === "/" ? "/" : base + "/"));
        const sizeOf = (p: string) => entries.filter((k) => k === p || k.startsWith(p + "/")).reduce((a, k) => a + this.fs[k].content.length, 0);
        const fmt = (n: number) => (human ? humanSize(n) : String(Math.ceil(n / 1024)));
        if (summarize) return ok(`${fmt(sizeOf(base))}\t${target}\n`);
        const dirs = entries.filter((k) => this.fs[k].type === "dir").sort((a, b) => b.length - a.length);
        return ok(dirs.map((d) => `${fmt(sizeOf(d))}\t${d === base ? target : target.replace(/\/$/, "") + d.slice(base.length)}`).join("\n") + "\n");
      }
      case "systemctl":
        return this.cmdSystemctl(rest);
      case "journalctl": {
        const ui = rest.indexOf("-u");
        const svc = ui >= 0 ? rest[ui + 1] : undefined;
        if (!svc) return fail("journalctl: specify a service with -u NAME");
        const def = this.world.services?.find((s) => s.name === svc);
        if (!def) return fail(`-- No entries for unit ${svc} --`);
        const log = this.readFile(`/var/log/journal/${svc}.log`) ?? "";
        const ni = rest.indexOf("-n");
        const n = ni >= 0 ? parseInt(rest[ni + 1] ?? "20", 10) : 20;
        const lines = nl(log).split("\n");
        lines.pop();
        const extra = this.serviceReason[svc] && this.serviceStatus[svc] !== "running" ? [`${this.stamp()} ${this.world.hostname} systemd[1]: ${svc}.service: ${this.serviceReason[svc]}`] : [];
        const all = [...lines, ...extra];
        return ok(`-- Logs begin at ${new Date(this.clock - 86400_000 * 12).toUTCString()} --\n${all.slice(-n).join("\n")}${all.length ? "\n" : "-- No entries --\n"}`);
      }
      case "nano":
      case "vi":
      case "vim": {
        if (!rest[0]) return fail(`${cmd}: specify a file to edit`);
        const path = this.abs(rest[0]);
        const n = this.fs[path];
        if (n?.type === "dir") return fail(`${cmd}: ${rest[0]}: Is a directory`);
        if (n && !this.can(n, "r")) return fail(`${cmd}: ${rest[0]}: Permission denied`);
        return { stdout: `Opening ${rest[0]} in the editor pane...\n`, stderr: "", exitCode: 0, action: { type: "edit", path } };
      }
      case "ping": {
        let host: string | undefined;
        for (let i = 0; i < rest.length; i++) {
          if (rest[i] === "-c") i++;
          else if (!rest[i].startsWith("-")) host = rest[i];
        }
        if (!host) return fail("ping: usage error: Destination address required", 2);
        const entry = this.network.hosts?.[host];
        if (!entry) return fail(`ping: ${host}: Name or service not known`, 2);
        const ci = rest.indexOf("-c");
        const count = ci >= 0 ? parseInt(rest[ci + 1] ?? "3", 10) : 3;
        if (!entry.reachable) return { stdout: `PING ${host} (${entry.ip}) 56(84) bytes of data.\n\n--- ${host} ping statistics ---\n${count} packets transmitted, 0 received, 100% packet loss\n`, stderr: "", exitCode: 1 };
        const lat = entry.latencyMs ?? 0.4;
        const lines = Array.from({ length: count }, (_, i) => `64 bytes from ${entry.ip}: icmp_seq=${i + 1} ttl=64 time=${(lat + i * 0.01).toFixed(2)} ms`);
        return ok(`PING ${host} (${entry.ip}) 56(84) bytes of data.\n${lines.join("\n")}\n\n--- ${host} ping statistics ---\n${count} packets transmitted, ${count} received, 0% packet loss\n`);
      }
      case "dig":
      case "nslookup": {
        const name = rest.find((a) => !a.startsWith("-") && !a.startsWith("+"));
        if (!name) return fail(`${cmd}: missing name`);
        const entry = this.network.hosts?.[name];
        if (!entry) return ok(`; <<>> OpsForge dig <<>> ${name}\n;; status: NXDOMAIN\n`);
        return ok(`; <<>> OpsForge dig <<>> ${name}\n;; ANSWER SECTION:\n${name}.\t300\tIN\tA\t${entry.ip}\n`);
      }
      case "curl": {
        const url = rest.find((a) => !a.startsWith("-"));
        if (!url) return fail("curl: no URL specified", 2);
        const headersOnly = rest.includes("-I");
        const entry = this.network.http?.[url] ?? this.network.http?.[url.replace(/\/$/, "")];
        if (!entry) {
          const host = url.replace(/^https?:\/\//, "").split(/[/:]/)[0];
          const h = this.network.hosts?.[host];
          if (!h) return fail(`curl: (6) Could not resolve host: ${host}`, 6);
          if (!h.reachable) return fail(`curl: (7) Failed to connect to ${host} port 80: Connection refused`, 7);
          return fail(`curl: (22) The requested URL returned error: 404`, 22);
        }
        const hdrs = Object.entries(entry.headers ?? { "Content-Type": "text/plain" }).map(([k, v]) => `${k}: ${v}`).join("\n");
        return ok(headersOnly ? `HTTP/1.1 ${entry.status}\n${hdrs}\n` : nl(entry.body));
      }
      case "ss":
      case "netstat": {
        const rows = (this.network.listening ?? []).map((l) => `${l.proto.padEnd(6)}LISTEN 0      128    ${(l.address ?? "0.0.0.0") + ":" + l.port}`.padEnd(45) + `users:(("${l.process}"))`);
        return ok(`Netid State  Recv-Q Send-Q Local Address:Port   Process\n${rows.join("\n")}${rows.length ? "\n" : ""}`);
      }
      default: {
        const prog = this.world.programs?.[cmd];
        if (prog) {
          const r = prog.run(rest, this.programHost());
          return { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode };
        }
        return fail(`bash: ${cmd}: command not found (this simulator supports a documented subset; type 'help')`, 127);
      }
    }
  }

  private stamp(): string {
    const d = new Date(this.clock);
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")} ${d.toISOString().slice(11, 19)}`;
  }

  private readForUser(f: string): { content: string; error?: string } {
    const path = this.abs(f);
    const n = this.fs[path];
    if (!n) return { content: "", error: `${f}: No such file or directory` };
    if (n.type === "dir") return { content: "", error: `${f}: Is a directory` };
    if (!this.can(n, "r")) return { content: "", error: `${f}: Permission denied` };
    return { content: n.content };
  }

  private cmdLs(rest: string[]): ExecResult {
    const flags = rest.filter((a) => a.startsWith("-")).join("");
    const long = flags.includes("l");
    const all = flags.includes("a");
    const human = flags.includes("h");
    const paths = rest.filter((a) => !a.startsWith("-"));
    if (!paths.length) paths.push(".");
    let out = "";
    let err = "";
    for (const p of paths) {
      const path = this.abs(p);
      const n = this.fs[path];
      if (!n) {
        err += `ls: cannot access '${p}': No such file or directory\n`;
        continue;
      }
      if (!this.can(n, "r")) {
        err += `ls: cannot open directory '${p}': Permission denied\n`;
        continue;
      }
      const entries: Array<[string, FsNode]> =
        n.type === "file"
          ? [[p, n]]
          : Object.keys(this.fs)
              .filter((k) => k !== path && dirname(k) === path && (all || !basename(k).startsWith(".")))
              .sort()
              .map((k) => [basename(k), this.fs[k]]);
      if (paths.length > 1 && n.type === "dir") out += `${p}:\n`;
      if (long) {
        if (n.type === "dir") out += `total ${entries.length}\n`;
        for (const [name, node] of entries) {
          const size = human ? humanSize(node.content.length) : String(node.content.length);
          out += `${modeString(node)} 1 ${node.owner.padEnd(8)} ${node.group.padEnd(8)} ${size.padStart(6)} ${fmtDate(node.mtime)} ${name}${node.type === "dir" ? "/" : ""}\n`;
        }
      } else {
        out += entries.map(([name, node]) => name + (node.type === "dir" ? "/" : "")).join("  ") + (entries.length ? "\n" : "");
      }
      if (paths.length > 1) out += "\n";
    }
    return { stdout: out, stderr: err, exitCode: err ? 2 : 0 };
  }

  private cmdGrep(rest: string[], stdin: string): ExecResult {
    const flags: string[] = [];
    const positional: string[] = [];
    for (const a of rest) {
      if (a.startsWith("-") && a.length > 1 && !positional.length) flags.push(...a.slice(1).split(""));
      else positional.push(a);
    }
    const [pattern, ...files] = positional;
    if (pattern === undefined) return { stdout: "", stderr: "Usage: grep [OPTION]... PATTERNS [FILE]...\n", exitCode: 2 };
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags.includes("i") ? "i" : "");
    } catch {
      return { stdout: "", stderr: `grep: invalid regular expression '${pattern}'\n`, exitCode: 2 };
    }
    const invert = flags.includes("v");
    const count = flags.includes("c");
    const numbers = flags.includes("n");
    const recursive = flags.includes("r") || flags.includes("R");
    const sources: Array<{ name: string; content: string }> = [];
    let err = "";
    if (!files.length) sources.push({ name: "(standard input)", content: stdin });
    for (const f of files) {
      const path = this.abs(f);
      const n = this.fs[path];
      if (!n) {
        err += `grep: ${f}: No such file or directory\n`;
        continue;
      }
      if (n.type === "dir") {
        if (!recursive) {
          err += `grep: ${f}: Is a directory\n`;
          continue;
        }
        for (const k of Object.keys(this.fs).filter((k) => k.startsWith(path + "/") && this.fs[k].type === "file").sort()) {
          if (this.can(this.fs[k], "r")) sources.push({ name: f.replace(/\/$/, "") + k.slice(path.length), content: this.fs[k].content });
        }
        continue;
      }
      if (!this.can(n, "r")) {
        err += `grep: ${f}: Permission denied\n`;
        continue;
      }
      sources.push({ name: f, content: n.content });
    }
    let out = "";
    let matched = false;
    const prefixName = sources.length > 1;
    for (const s of sources) {
      const lines = s.content.split("\n");
      if (lines[lines.length - 1] === "") lines.pop();
      const hits: string[] = [];
      lines.forEach((l, i) => {
        if (re.test(l) !== invert) hits.push(`${prefixName ? s.name + ":" : ""}${numbers ? i + 1 + ":" : ""}${l}`);
      });
      if (count) out += `${prefixName ? s.name + ":" : ""}${hits.length}\n`;
      else if (hits.length) out += hits.join("\n") + "\n";
      if (hits.length) matched = true;
    }
    return { stdout: out, stderr: err, exitCode: err ? 2 : matched ? 0 : 1 };
  }

  private cmdSystemctl(rest: string[]): ExecResult {
    const [action, name] = rest;
    const fail = (msg: string, code = 1): ExecResult => ({ stdout: "", stderr: msg + "\n", exitCode: code });
    if (!action) return fail("systemctl: usage: systemctl status|start|stop|restart SERVICE");
    if (action === "list-units" || action === "list") {
      const rows = (this.world.services ?? []).map((s) => `${(s.name + ".service").padEnd(24)} loaded ${this.serviceStatus[s.name] === "running" ? "active   running" : this.serviceStatus[s.name] === "failed" ? "failed   failed " : "inactive dead   "} ${s.description}`);
      return { stdout: `UNIT                     LOAD   ACTIVE   SUB     DESCRIPTION\n${rows.join("\n")}\n`, stderr: "", exitCode: 0 };
    }
    if (!name) return fail(`systemctl: missing service name for '${action}'`);
    const svcName = name.replace(/\.service$/, "");
    const def = this.world.services?.find((s) => s.name === svcName);
    if (!def) return fail(`Unit ${svcName}.service could not be found.`, 4);
    const status = this.serviceStatus[svcName];
    const start = (): ExecResult => {
      if (this.effectiveUser() !== ROOT_USER) return fail(`Failed to start ${svcName}.service: Access denied\nSee system logs and 'systemctl status ${svcName}.service' for details. (Hint: use sudo)`, 1);
      const failWith = (problem: string): ExecResult => {
        this.serviceStatus[svcName] = "failed";
        this.serviceReason[svcName] = problem;
        this.appendJournal(svcName, `${svcName}[${this.nextPid}]: ${problem}`);
        this.appendJournal(svcName, `systemd[1]: ${svcName}.service: Main process exited, code=exited, status=1/FAILURE`);
        return fail(`Job for ${svcName}.service failed because the control process exited with error code.\nSee "systemctl status ${svcName}.service" and "journalctl -u ${svcName}" for details.`);
      };
      if (def.runAs && def.configPath) {
        const node = this.fs[def.configPath];
        if (!node) return failWith(`FATAL: cannot read ${def.configPath}: No such file or directory (running as user ${def.runAs})`);
        if (!this.can(node, "r", def.runAs)) return failWith(`FATAL: cannot read ${def.configPath}: Permission denied (running as user ${def.runAs})`);
      }
      if (def.runAs) {
        for (const dir of def.requiredWritable ?? []) {
          const node = this.fs[dir];
          if (!node) return failWith(`FATAL: ${dir} does not exist (running as user ${def.runAs})`);
          if (!this.can(node, "w", def.runAs)) return failWith(`FATAL: cannot write to ${dir}: Permission denied (running as user ${def.runAs})`);
        }
      }
      if (def.configPath && def.configCheck) {
        const content = this.readFile(def.configPath);
        const problem = content === null ? `Failed to open ${def.configPath}: No such file or directory` : def.configCheck(content);
        if (problem) {
          this.serviceStatus[svcName] = "failed";
          this.serviceReason[svcName] = problem;
          this.appendJournal(svcName, `${svcName}[${this.nextPid}]: ${problem}`);
          this.appendJournal(svcName, `systemd[1]: ${svcName}.service: Main process exited, code=exited, status=1/FAILURE`);
          return fail(`Job for ${svcName}.service failed because the control process exited with error code.\nSee "systemctl status ${svcName}.service" and "journalctl -u ${svcName}" for details.`);
        }
      }
      this.serviceStatus[svcName] = "running";
      this.serviceReason[svcName] = undefined;
      if (!this.processes.some((p) => p.service === svcName)) {
        this.processes.push({ pid: this.nextPid++, user: "root", cpu: 0.3, mem: 1.2, command: `/usr/sbin/${svcName}`, service: svcName });
      }
      this.appendJournal(svcName, `systemd[1]: Started ${def.description}.`);
      return { stdout: "", stderr: "", exitCode: 0 };
    };
    switch (action) {
      case "status": {
        const active = status === "running" ? "active (running)" : status === "failed" ? "failed (Result: exit-code)" : "inactive (dead)";
        const reason = status !== "running" && this.serviceReason[svcName] ? `\n   Error: ${this.serviceReason[svcName]}` : "";
        const proc = this.processes.find((p) => p.service === svcName);
        return { stdout: `● ${svcName}.service - ${def.description}\n     Loaded: loaded (/etc/systemd/system/${svcName}.service; enabled)\n     Active: ${active}${proc ? `\n   Main PID: ${proc.pid} (${svcName})` : ""}${reason}\n`, stderr: "", exitCode: status === "running" ? 0 : 3 };
      }
      case "start":
        if (status === "running") return { stdout: "", stderr: "", exitCode: 0 };
        return start();
      case "stop": {
        if (this.effectiveUser() !== ROOT_USER) return fail(`Failed to stop ${svcName}.service: Access denied (Hint: use sudo)`);
        this.serviceStatus[svcName] = "stopped";
        this.serviceReason[svcName] = undefined;
        this.processes = this.processes.filter((p) => p.service !== svcName);
        this.appendJournal(svcName, `systemd[1]: Stopped ${def.description}.`);
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      case "restart": {
        if (this.effectiveUser() !== ROOT_USER) return fail(`Failed to restart ${svcName}.service: Access denied (Hint: use sudo)`);
        this.processes = this.processes.filter((p) => p.service !== svcName);
        this.serviceStatus[svcName] = "stopped";
        return start();
      }
      case "enable":
      case "disable":
      case "daemon-reload":
        return { stdout: "", stderr: "", exitCode: 0 };
      default:
        return fail(`Unknown command verb ${action}.`);
    }
  }

  private appendJournal(svc: string, line: string) {
    const path = `/var/log/journal/${svc}.log`;
    const existing = this.fs[path]?.content ?? "";
    if (!this.fs["/var/log/journal"]) this.fs["/var/log/journal"] = { type: "dir", content: "", mode: 0o755, owner: "root", group: "root", mtime: this.clock };
    this.fs[path] = { type: "file", content: existing + `${this.stamp()} ${this.world.hostname} ${line}\n`, mode: 0o640, owner: "root", group: "root", mtime: this.tick() };
  }
}
