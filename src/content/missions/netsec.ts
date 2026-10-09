import type { InvestigationMission } from "../../domain/types";

const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. You are a trainee on the operations team.";

/**
 * Introductory networking / defensive security investigation.
 * Everything here is a fictional, isolated system. No real hosts are contacted.
 */
export const netsecMissions: InvestigationMission[] = [
  {
    id: "netsec-01-brute-force",
    kind: "investigation",
    trackId: "netsec",
    stage: 2,
    title: "Who is knocking? Investigate failed SSH logins",
    summary: "Read an auth log, identify a brute-force source, confirm the firewall rule, and apply least privilege.",
    briefing: `${COMPANY_INTRO}\n\nThe jump host shows hundreds of failed SSH logins overnight. Your lead wants to know: which IP address is responsible, did any login from it succeed, and is the firewall actually blocking it? Then tighten one obvious permission problem you find along the way.`,
    objectives: [
      "Find the single IP address with the most 'Failed password' entries in /var/log/auth.log",
      "Determine whether that IP ever logged in successfully ('Accepted password')",
      "Write the attacker IP into ~/incident/attacker.txt and a one-line verdict into ~/incident/verdict.txt",
      "Lock down the world-readable private key /home/trainee/.ssh/id_ed25519 to mode 600",
      "Answer the short question about which port and protocol SSH uses",
    ],
    skills: ["netsec.dns-ports", "netsec.authz", "netsec.logs", "netsec.hardening"],
    prerequisites: ["linux-02-log-detective"],
    estimatedMinutes: 20,
    commandsIntroduced: ["grep", "cut", "sort", "uniq", "ss", "chmod", "ping"],
    lesson: [
      {
        title: "Ports, protocols and SSH",
        body: "Every network service listens on a **port** (a number 1-65535) using a transport protocol, usually **TCP** (reliable, ordered) or **UDP** (fast, no delivery guarantee). SSH, the secure remote shell, listens on TCP port 22 by default. `ss -tlnp` lists listening TCP ports on a host.",
      },
      {
        title: "Authentication vs authorization",
        body: "**Authentication** proves who you are (password, key). **Authorization** decides what you may do once identified. A brute-force attack guesses passwords repeatedly; the defence is keys instead of passwords, rate limiting, and firewalls. **Least privilege** means every file and account gets only the access it needs. A private key readable by everyone (`-rw-r--r--`) violates it: anyone on the host could steal it.",
      },
      {
        title: "Reading auth logs",
        body: "Lines like `sshd[412]: Failed password for invalid user admin from 203.0.113.42 port 51102 ssh2` record one failed attempt. Count attempts per IP: `grep 'Failed password' auth.log | grep -o 'from [0-9.]*' | sort | uniq -c | sort -rn`. (This simulator's grep has no -o, so use `cut -d' ' -f11` or `-f13` depending on the line; look first.) Then check for `Accepted` from the same IP.",
      },
    ],
    glossary: [
      { term: "brute force", definition: "Trying many passwords quickly until one works." },
      { term: "firewall", definition: "A filter that allows or blocks network connections by address, port and protocol." },
      { term: "least privilege", definition: "Grant the minimum access required and nothing more." },
      { term: "private key", definition: "The secret half of an SSH key pair. Must be readable only by its owner." },
    ],
    hints: [
      { level: 1, title: "Look at the shape", body: "`head -n 5 /var/log/auth.log` first. Notice the word after 'from' is the source IP." },
      { level: 2, title: "Count per IP", body: "Failed lines have the IP as the 11th or 13th space-separated field depending on 'invalid user'. Easiest: `grep 'Failed password' /var/log/auth.log | grep -c 203.0.113.42` for each candidate IP you see." },
      { level: 3, title: "Any success?", body: "`grep Accepted /var/log/auth.log` then check whether the attacker IP appears. Record your verdict in ~/incident/verdict.txt." },
      { level: 4, title: "Guided example", body: "```\nmkdir -p ~/incident\ngrep 'Failed password' /var/log/auth.log | grep -c 203.0.113.42\ngrep 'Failed password' /var/log/auth.log | grep -c 198.51.100.7\ngrep Accepted /var/log/auth.log\necho 203.0.113.42 > ~/incident/attacker.txt\necho \"no successful login from attacker; firewall rule present\" > ~/incident/verdict.txt\ncat /etc/firewall/rules\nchmod 600 ~/.ssh/id_ed25519\n```" },
    ],
    reflectionPrompts: ["Explain how you identified the attacking address and how you decided whether the attack succeeded. What evidence would have changed your verdict?"],
    transferNote: "This is the core loop of defensive work: evidence from logs, a clear verdict with its basis, and one hardening change that reduces future risk.",
    world: {
      hostname: "jump-01",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        "/var/log/auth.log": { type: "file", content: generateAuthLog(), mode: 0o644, owner: "root", group: "root" },
        "/etc/firewall": { type: "dir" },
        "/etc/firewall/rules": { type: "file", content: "# Nimbus jump host firewall (fictional format)\nallow tcp 22 from 10.0.0.0/8\nallow tcp 22 from 198.51.100.0/24\ndeny  tcp 22 from 203.0.113.42\ndeny  all\n", mode: 0o644, owner: "root", group: "root" },
        "/home/trainee/.ssh": { type: "dir", mode: 0o700 },
        "/home/trainee/.ssh/id_ed25519": { type: "file", content: "-----BEGIN OPENSSH PRIVATE KEY-----\n(fictional key material)\n-----END OPENSSH PRIVATE KEY-----\n", mode: 0o644 },
        "/home/trainee/.ssh/id_ed25519.pub": { type: "file", content: "ssh-ed25519 AAAA(fictional) trainee@jump-01\n", mode: 0o644 },
        "/home/trainee/README-incident.txt": { type: "file", content: "Create ~/incident and record findings there: attacker.txt (IP only) and verdict.txt (one line).\n" },
      },
      processes: [
        { pid: 1, user: "root", cpu: 0, mem: 0.1, command: "/sbin/init" },
        { pid: 412, user: "root", cpu: 0.2, mem: 0.4, command: "/usr/sbin/sshd -D", service: "ssh" },
      ],
      services: [{ name: "ssh", status: "running", description: "OpenSSH server" }],
    },
    steps: [
      {
        id: "identify",
        prompt: "Identify the attacking IP and whether it ever succeeded.",
        checks: [
          { id: "searched", label: "Searched auth.log for failed logins", test: (c) => c.history.some((h) => /grep/.test(h) && /auth\.log/.test(h)) },
          { id: "attacker", label: "~/incident/attacker.txt contains 203.0.113.42", test: (c) => (c.readFile("/home/trainee/incident/attacker.txt") ?? "").trim() === "203.0.113.42" },
          { id: "accepted", label: "Checked for successful logins (Accepted)", test: (c) => c.history.some((h) => /grep.*Accepted/.test(h)) },
          { id: "verdict", label: "~/incident/verdict.txt states no successful attacker login", test: (c) => /no|none|never|did not|didn't|0 success/i.test(c.readFile("/home/trainee/incident/verdict.txt") ?? "") },
        ],
      },
      {
        id: "harden",
        prompt: "Apply least privilege to the exposed private key.",
        checks: [
          { id: "key-mode", label: "~/.ssh/id_ed25519 is mode 600", test: (c) => c.mode("/home/trainee/.ssh/id_ed25519") === 0o600 },
          { id: "firewall", label: "Read the firewall rules", test: (c) => c.outputs.some((o) => /firewall\/rules/.test(o.command) && o.stdout.includes("deny")) },
        ],
        question: {
          prompt: "SSH normally listens on which port and transport protocol?",
          options: ["TCP 22", "UDP 22", "TCP 443", "UDP 53"],
          correctIndex: 0,
          explanation: "SSH uses TCP port 22 by default. 443 is HTTPS and UDP 53 is DNS.",
        },
      },
    ],
  },
];

function generateAuthLog(): string {
  const lines: string[] = [];
  const users = ["admin", "root", "ubuntu", "test", "oracle", "deploy", "pi"];
  let minute = 0;
  for (let i = 0; i < 120; i++) {
    minute += 1;
    const hh = String(2 + Math.floor(minute / 60)).padStart(2, "0");
    const mm = String(minute % 60).padStart(2, "0");
    const ts = `Mar 09 ${hh}:${mm}:${String((i * 7) % 60).padStart(2, "0")}`;
    if (i % 17 === 5) {
      lines.push(`${ts} jump-01 sshd[412]: Failed password for trainee from 198.51.100.7 port 50000 ssh2`);
    } else if (i % 23 === 11) {
      lines.push(`${ts} jump-01 sshd[412]: Accepted publickey for trainee from 198.51.100.7 port 50001 ssh2: ED25519 SHA256:(fictional)`);
    } else if (i % 31 === 20) {
      lines.push(`${ts} jump-01 sshd[412]: Failed password for root from 192.0.2.99 port 41000 ssh2`);
    } else {
      const u = users[i % users.length];
      lines.push(`${ts} jump-01 sshd[412]: Failed password for ${u === "root" ? "root" : "invalid user " + u} from 203.0.113.42 port ${51000 + i} ssh2`);
    }
  }
  lines.push("Mar 09 04:05:00 jump-01 sshd[412]: Connection closed by 203.0.113.42 port 51120 [preauth]");
  return lines.join("\n") + "\n";
}
