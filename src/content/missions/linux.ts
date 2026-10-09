import type { TerminalMission } from "../../domain/types";

/**
 * Linux missions. All systems, companies and people are fictional.
 * Each mission has a world (filesystem, processes, services) and checks that
 * inspect the real simulator state, never just the clicked buttons.
 */

const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. You are a trainee on the operations team.";

export const linuxMissions: TerminalMission[] = [
  {
    id: "linux-01-find-your-way",
    kind: "terminal",
    trackId: "linux",
    stage: 1,
    title: "Find your way around the server",
    summary: "Learn pwd, ls, cd and cat by locating a runbook left by a colleague.",
    briefing: `${COMPANY_INTRO}\n\nYour teammate Priya left a runbook somewhere under your home directory before going on leave. Find it, read it, and leave a note confirming you have it.`,
    objectives: [
      "Discover where you are with pwd and what is around you with ls",
      "Move into the ops directory and find the runbook",
      "Read the runbook with cat",
      "Create ~/ops/ack.txt containing the word READY",
    ],
    skills: ["linux.navigation", "linux.files"],
    prerequisites: [],
    estimatedMinutes: 12,
    commandsIntroduced: ["pwd", "ls", "cd", "cat", "echo", "help"],
    lesson: [
      {
        title: "What is a terminal?",
        body: "A terminal is a text window where you type a command, press Enter, and the computer prints a reply. A **shell** (here, a bash-like simulator) reads the line and runs the program you named.\n\nEvery command has the same shape: `command [options] [arguments]`. Options start with `-` and change behaviour; arguments are the things to act on.",
      },
      {
        title: "Where am I? pwd, ls, cd",
        body: "`pwd` prints the working directory, which is the folder you are currently standing in. `ls` lists what is inside it (`ls -l` shows details). `cd NAME` moves into a folder, `cd ..` moves up one level, and `cd` alone returns home.\n\nA path starting with `/` is **absolute** (from the root of the disk). A path without a leading `/` is **relative** to where you are now. `~` means your home directory.",
      },
      {
        title: "Reading and writing files",
        body: "`cat FILE` prints a file. `echo TEXT > FILE` writes TEXT into FILE (creating or replacing it), and `>>` appends instead of replacing.\n\nTip: type `help` at any time to see the commands this simulator supports.",
      },
    ],
    glossary: [
      { term: "directory", definition: "A folder. Directories contain files and other directories." },
      { term: "working directory", definition: "The directory your shell is currently 'in'. Relative paths start from here." },
      { term: "home directory", definition: "Your personal folder, usually /home/USERNAME, shortened to ~." },
      { term: "redirection", definition: "Sending a command's output somewhere else, such as into a file with >." },
    ],
    hints: [
      { level: 1, title: "Start by looking around", body: "Run `pwd` and `ls` first. Directories end with `/` in the listing." },
      { level: 2, title: "Go deeper", body: "The runbook is inside `ops/` (maybe in a sub-folder). Use `cd ops` then `ls`, and keep going." },
      { level: 3, title: "Reading and writing", body: "`cat path/to/runbook.md` prints it. `echo READY > ~/ops/ack.txt` creates the acknowledgement file." },
      { level: 4, title: "Guided example", body: "```\ncd ~/ops\nls\ncd handover\ncat runbook.md\necho READY > ~/ops/ack.txt\ncat ~/ops/ack.txt\n```" },
    ],
    reflectionPrompts: ["Explain how you located the runbook. What did each command tell you?"],
    transferNote: "On a real server you will constantly orient yourself with pwd/ls/cd before touching anything. Reading before writing is the habit.",
    world: {
      hostname: "ops-jump-01",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        "/home/trainee/README.txt": { type: "file", content: "Welcome to Nimbus Freight operations.\nYour team's files live in ~/ops.\n" },
        "/home/trainee/ops": { type: "dir" },
        "/home/trainee/ops/archive": { type: "dir" },
        "/home/trainee/ops/archive/old-notes.txt": { type: "file", content: "Nothing to see here. Old notes from 2024.\n" },
        "/home/trainee/ops/handover": { type: "dir" },
        "/home/trainee/ops/handover/runbook.md": {
          type: "file",
          content: "# Fleet API runbook (handover from Priya)\n\n1. The API runs as the 'fleet-api' service.\n2. Logs: /var/log/fleet/api.log\n3. If you see 'disk full', check /var/log first.\n4. When you have read this, write READY into ~/ops/ack.txt.\n",
        },
        "/home/trainee/.bash_history": { type: "file", content: "ls\ncd ops\n" },
      },
    },
    checks: [
      { id: "cd-ops", label: "Changed into a directory under ~/ops", test: (c) => c.history.some((h) => /^cd\s+(~\/)?ops/.test(h) || /^cd\s+handover/.test(h) || /^cd\s+\/home\/trainee\/ops/.test(h)) },
      { id: "read-runbook", label: "Read the runbook with cat (or head/less)", test: (c) => c.outputs.some((o) => /^(cat|less|head|tail)\b.*runbook\.md/.test(o.command) && o.stdout.includes("Fleet API runbook")) },
      { id: "ack", label: "~/ops/ack.txt contains READY", test: (c) => (c.readFile("/home/trainee/ops/ack.txt") ?? "").trim().toUpperCase() === "READY" },
    ],
  },
  {
    id: "linux-02-log-detective",
    kind: "terminal",
    trackId: "linux",
    stage: 1,
    title: "Log detective: why is the API failing?",
    summary: "Use grep, pipes, sort and uniq to find the most common error in a log and report it.",
    briefing: `${COMPANY_INTRO}\n\nCustomers report that fleet positions stop updating for a few minutes at a time. The API log at /var/log/fleet/api.log is 200 lines long. Find out which error happens most, and write a short report.`,
    objectives: [
      "Count how many ERROR lines the log contains",
      "Find which error message occurs most often (hint: sort | uniq -c)",
      "Write the most common error message's key phrase into ~/report.txt",
      "Also save every ERROR line into ~/errors.log",
    ],
    skills: ["linux.reading", "linux.pipes", "linux.logs"],
    prerequisites: ["linux-01-find-your-way"],
    estimatedMinutes: 15,
    commandsIntroduced: ["grep", "wc", "sort", "uniq", "head", "tail", "|", ">"],
    lesson: [
      {
        title: "Searching text with grep",
        body: "`grep PATTERN FILE` prints only the lines containing PATTERN. Useful options: `-i` ignore case, `-n` show line numbers, `-c` count matching lines, `-v` show lines that do NOT match.",
      },
      {
        title: "Pipes chain commands",
        body: "The `|` (pipe) sends the output of one command into the next. `grep ERROR api.log | wc -l` counts error lines. `sort | uniq -c` groups identical lines and counts them, and `sort -rn` then puts the biggest counts first.\n\nLogs usually have a timestamp at the start of each line; cut it off (`cut -d' ' -f3-`) before grouping, otherwise every line looks unique.",
      },
      {
        title: "Saving results",
        body: "Redirect the final output to a file with `>`. For example `grep ERROR api.log > ~/errors.log`.",
      },
    ],
    glossary: [
      { term: "log file", definition: "A text file where a program appends one line per event, usually with a timestamp and a level (INFO, WARN, ERROR)." },
      { term: "pipe", definition: "The | character, which feeds one command's output to the next command's input." },
      { term: "root cause", definition: "The underlying reason for a failure, as opposed to the symptoms you first notice." },
    ],
    hints: [
      { level: 1, title: "Filter first", body: "Start with `grep ERROR /var/log/fleet/api.log` and look at the shape of the lines." },
      { level: 2, title: "Group and count", body: "Strip the timestamp and level, then `sort | uniq -c | sort -rn`. Try `cut -d' ' -f3- `." },
      { level: 3, title: "Write the report", body: "The most common error mentions a timeout to a specific host. Put that phrase (for example `database timeout`) into ~/report.txt with echo." },
      { level: 4, title: "Guided example", body: "```\ngrep -c ERROR /var/log/fleet/api.log\ngrep ERROR /var/log/fleet/api.log | cut -d' ' -f3- | sort | uniq -c | sort -rn | head -n 3\ngrep ERROR /var/log/fleet/api.log > ~/errors.log\necho \"database timeout\" > ~/report.txt\n```" },
    ],
    reflectionPrompts: ["Walk me through how you narrowed 200 lines down to a single root cause. What evidence did you rely on?"],
    transferNote: "Real logs are millions of lines, but the method is identical: filter, normalise, group, count, then read the top items.",
    world: {
      hostname: "fleet-api-02",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        "/var/log/fleet": { type: "dir" },
        "/var/log/fleet/api.log": { type: "file", content: generateApiLog() },
        "/home/trainee/notes.txt": { type: "file", content: "Customer complaint ticket #4411: positions freeze every few minutes.\n" },
      },
    },
    checks: [
      { id: "grep", label: "Used grep on the API log", test: (c) => c.history.some((h) => /grep/.test(h) && /api\.log/.test(h)) },
      { id: "pipe", label: "Used a pipeline with sort and uniq (or an equivalent count)", test: (c) => c.history.some((h) => h.includes("|") && /uniq|sort|wc/.test(h)) },
      { id: "errors", label: "~/errors.log contains all 23 ERROR lines", test: (c) => { const t = c.readFile("/home/trainee/errors.log") ?? ""; const n = t.split("\n").filter((l) => l.includes("ERROR")).length; return { passed: n === 23, detail: `found ${n} ERROR lines` }; } },
      { id: "report", label: "~/report.txt names the most common error (database timeout)", test: (c) => /database\s+timeout|timeout.*db-primary|db-primary/i.test(c.readFile("/home/trainee/report.txt") ?? "") },
    ],
  },
  {
    id: "linux-03-locked-out",
    kind: "terminal",
    trackId: "linux",
    stage: 1,
    title: "Locked out: fix a permission problem and restart the service",
    summary: "Read ls -l, repair ownership and mode, then bring a failed service back with systemctl.",
    briefing: `${COMPANY_INTRO}\n\nThe 'fleet-api' service failed to start after last night's deploy. The deploy script copied a new config file but got the permissions wrong, and the log directory is not writable by the service user. Investigate, fix, and restart.`,
    objectives: [
      "Check the service status and read its journal to understand why it fails",
      "Make /etc/fleet/api.conf readable by the service (owner fleet, mode 640)",
      "Make /var/lib/fleet writable by the service (owner fleet)",
      "Start the service and confirm it is active (running)",
    ],
    skills: ["linux.permissions", "linux.services", "linux.processes"],
    prerequisites: ["linux-02-log-detective"],
    estimatedMinutes: 18,
    commandsIntroduced: ["ls -l", "chmod", "chown", "sudo", "systemctl", "journalctl", "ps"],
    lesson: [
      {
        title: "Reading ls -l",
        body: "`-rw-r----- 1 fleet fleet 120 Mar 09 api.conf` reads: type (`-` file, `d` directory), then three triplets of permissions for **owner**, **group**, **others**: r = read, w = write, x = execute. Then owner and group names.\n\nNumeric modes add r=4, w=2, x=1 per triplet: 640 means owner rw, group r, others nothing.",
      },
      {
        title: "Changing permissions and owners",
        body: "`chmod 640 FILE` sets the mode. `chown USER:GROUP FILE` changes ownership. Files you do not own need `sudo` (run as the administrator).\n\nServices usually run as their own low-privilege user, so files they read must be readable by that user and directories they write must be writable by it.",
      },
      {
        title: "Services and their logs",
        body: "`systemctl status NAME` shows whether a service is running and the last error. `journalctl -u NAME` prints its log. `sudo systemctl start|restart NAME` starts it again after you fix the cause. `ps aux` lists running processes so you can confirm.",
      },
    ],
    glossary: [
      { term: "service / daemon", definition: "A long-running background program managed by the system (systemd), such as a web API." },
      { term: "owner / group", definition: "Every file belongs to one user and one group; permissions are granted separately to owner, group and everyone else." },
      { term: "sudo", definition: "Run one command with administrator (root) privileges." },
    ],
    hints: [
      { level: 1, title: "Ask the service", body: "`systemctl status fleet-api` and `journalctl -u fleet-api` tell you exactly which path is the problem." },
      { level: 2, title: "Inspect the paths", body: "`ls -l /etc/fleet/api.conf` and `ls -ld /var/lib/fleet`. Who owns them? Can user `fleet` read/write?" },
      { level: 3, title: "Repair", body: "`sudo chown fleet:fleet /etc/fleet/api.conf && sudo chmod 640 /etc/fleet/api.conf`, then the same ownership fix for `/var/lib/fleet`." },
      { level: 4, title: "Guided example", body: "```\nsystemctl status fleet-api\njournalctl -u fleet-api\nls -l /etc/fleet/api.conf\nsudo chown fleet:fleet /etc/fleet/api.conf\nsudo chmod 640 /etc/fleet/api.conf\nls -ld /var/lib/fleet\nsudo chown fleet:fleet /var/lib/fleet\nsudo systemctl start fleet-api\nsystemctl status fleet-api\n```" },
    ],
    reflectionPrompts: ["Describe how you identified why the service would not start, and how you verified the fix actually worked."],
    transferNote: "Permission problems after deploys are among the most common real incidents. The journal almost always names the path.",
    world: {
      hostname: "fleet-api-02",
      user: "trainee",
      cwd: "/home/trainee",
      fs: {
        "/etc/fleet": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/etc/fleet/api.conf": { type: "file", content: "listen=0.0.0.0:8080\ndata_dir=/var/lib/fleet\nlog_level=info\n", mode: 0o600, owner: "root", group: "root" },
        "/var/lib/fleet": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/var/log/journal": { type: "dir", mode: 0o755, owner: "root", group: "root" },
        "/var/log/journal/fleet-api.log": { type: "file", content: "Mar 09 02:14:03 fleet-api-02 systemd[1]: Starting Nimbus fleet API...\nMar 09 02:14:03 fleet-api-02 fleet-api[1881]: FATAL: cannot read /etc/fleet/api.conf: Permission denied (running as user fleet)\nMar 09 02:14:03 fleet-api-02 systemd[1]: fleet-api.service: Main process exited, code=exited, status=1/FAILURE\n", mode: 0o644, owner: "root", group: "root" },
        "/home/trainee/deploy-notes.txt": { type: "file", content: "Deploy 2026-03-09 02:13 by deploy-bot: copied api.conf, created /var/lib/fleet.\n" },
      },
      processes: [
        { pid: 1, user: "root", cpu: 0, mem: 0.1, command: "/sbin/init" },
        { pid: 644, user: "root", cpu: 0.1, mem: 0.5, command: "/usr/sbin/sshd" },
      ],
      services: [
        {
          name: "fleet-api",
          status: "failed",
          description: "Nimbus fleet API",
          failureReason: "cannot read /etc/fleet/api.conf: Permission denied (running as user fleet)",
          configPath: "/etc/fleet/api.conf",
          runAs: "fleet",
          requiredWritable: ["/var/lib/fleet"],
        },
      ],
    },
    checks: [
      { id: "status", label: "Checked the service status or journal", test: (c) => c.history.some((h) => /systemctl\s+status\s+fleet-api|journalctl\s+-u\s+fleet-api/.test(h)) },
      { id: "conf-owner", label: "/etc/fleet/api.conf owned by fleet with mode 640", test: (c) => ({ passed: c.mode("/etc/fleet/api.conf") === 0o640 && c.owner("/etc/fleet/api.conf") === "fleet", detail: `owner=${c.owner("/etc/fleet/api.conf")}, mode=${(c.mode("/etc/fleet/api.conf") ?? 0).toString(8)}` }) },
      { id: "dir-owner", label: "/var/lib/fleet owned by fleet", test: (c) => c.owner("/var/lib/fleet") === "fleet" },
      { id: "running", label: "fleet-api is active (running)", test: (c) => c.services["fleet-api"] === "running" },
    ],
  },
];

/** 200-line deterministic log with 23 ERROR lines, the most common being database timeouts. */
function generateApiLog(): string {
  const lines: string[] = [];
  const errorsAt = new Map<number, string>([
    [9, "ERROR database timeout after 5000ms connecting to db-primary"],
    [17, "ERROR cache miss storm: 412 keys expired simultaneously"],
    [23, "ERROR database timeout after 5000ms connecting to db-primary"],
    [31, "ERROR upstream gps-ingest returned 502"],
    [38, "ERROR database timeout after 5000ms connecting to db-primary"],
    [44, "ERROR database timeout after 5000ms connecting to db-primary"],
    [51, "ERROR upstream gps-ingest returned 502"],
    [59, "ERROR database timeout after 5000ms connecting to db-primary"],
    [66, "ERROR cache miss storm: 398 keys expired simultaneously"],
    [72, "ERROR database timeout after 5000ms connecting to db-primary"],
    [80, "ERROR database timeout after 5000ms connecting to db-primary"],
    [88, "ERROR upstream gps-ingest returned 502"],
    [95, "ERROR database timeout after 5000ms connecting to db-primary"],
    [103, "ERROR database timeout after 5000ms connecting to db-primary"],
    [111, "ERROR cache miss storm: 377 keys expired simultaneously"],
    [120, "ERROR database timeout after 5000ms connecting to db-primary"],
    [129, "ERROR upstream gps-ingest returned 502"],
    [137, "ERROR database timeout after 5000ms connecting to db-primary"],
    [146, "ERROR database timeout after 5000ms connecting to db-primary"],
    [155, "ERROR database timeout after 5000ms connecting to db-primary"],
    [164, "ERROR upstream gps-ingest returned 502"],
    [178, "ERROR database timeout after 5000ms connecting to db-primary"],
    [191, "ERROR database timeout after 5000ms connecting to db-primary"],
  ]);
  const infos = [
    "INFO GET /v1/positions 200 12ms",
    "INFO GET /v1/vehicles/{id} 200 8ms",
    "INFO POST /v1/positions 201 15ms",
    "INFO health check ok",
    "WARN slow query 1200ms SELECT * FROM positions WHERE ts > ?",
    "INFO GET /v1/positions 200 11ms",
    "INFO cache hit ratio 0.93",
  ];
  for (let i = 1; i <= 200; i++) {
    const m = String(9 + Math.floor(i / 60)).padStart(2, "0");
    const s = String(i % 60).padStart(2, "0");
    const ts = `2026-03-09T03:${m}:${s}Z`;
    lines.push(`${ts} ${errorsAt.get(i) ?? infos[i % infos.length]}`);
  }
  return lines.join("\n") + "\n";
}
