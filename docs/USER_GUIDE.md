# OpsForge user guide

## First run

You are asked for a name and six quick placement questions. They only set a starting point; everything after that is earned by doing missions. You begin at Stage 1, Engineering Trainee, at Nimbus Freight, a fictional company.

## The daily loop (about 30 minutes)

The Dashboard has one big **Continue Learning** button. It takes you to the most useful thing right now: an unfinished mission, a retention check that is due, or the next mission in the recommended order. The suggested shape of a session is 3 minutes recall, 7 minutes new concept (the mission's Lesson tab), 15 minutes hands-on, 5 minutes reflection. Nothing penalises a missed day.

## Missions

Every mission page has:

- **Briefing / Lesson / Glossary** tabs. Read the lesson when a concept is new. Reading never earns mastery.
- A **workstation**: the terminal, the Python editor, or the Algorithms Laboratory.
- **Checks** on the right: live validation of the real state (files, permissions, services, test results, experiments). "Complete mission" only unlocks when every check passes.
- **Hints** in four levels: nudge, specific hint, concept explanation, guided example. Each level you reveal reduces the mastery gained, so try first.
- **Reset mission environment** if you want a clean slate.
- After completion, a **reflection prompt** asks you to explain what you did, interview-style. You can send that explanation to the interview coach.

### Linux Terminal

A simulator with a documented subset of commands (type `help`). It has a real filesystem model, permissions, `sudo`, processes, services (`systemctl`, `journalctl`), pipes and redirection. `nano FILE` opens a small editor. Unsupported commands say so. Use ↑/↓ for history, Tab to complete paths, Ctrl+L to clear.

### Python Laboratory

Real CPython runs in your browser. Press **Run** to execute and see real output or a real traceback (with a plain-language explanation for common errors). Press **Run tests** to run the mission's test cases; they execute your functions directly, so names and return values matter. Infinite loops are stopped after 10 seconds.

### Go Laboratory

Real Go runs in your browser through an interpreter compiled to WebAssembly. Goroutines, channels, select, WaitGroups, mutexes, generics and most of the standard library work; there is no network, filesystem or race detector, and goroutines interleave cooperatively because WebAssembly is single-threaded. Press Run for real output or a compiler error with a plain-language explanation. The runtime (about 8 MB compressed) downloads the first time you open the lab.

### Algorithms Laboratory

Pick an algorithm and an input size, press Run. You get an **operation count** (deterministic, the thing Big O describes) and an **elapsed time** (measured on your device, noisy). For small n you can step through the algorithm. Growth tables and side-by-side comparison show how work scales.

### Security Operations, System Monitoring

Security investigations run on isolated fictional hosts. The monitoring page is a deterministic simulation: move the sliders, inject failures, and watch latency, error rate, queue depth, the logs and the architecture diagram respond coherently.

### CI/CD missions

Some missions ship their own command-line tools, listed at the end of `help`: `ci run` / `ci log` / `ci status` execute and inspect a simulated pipeline defined in `.ci/pipeline.yml`; `deployctl status` / `history` / `rollback VERSION` manage which release is live; `metrics errors` / `latency` query the live service. The pipeline runner reacts to the real repository state, and the checks reject shortcuts: a retry that happens to pass, a skipped test, a secret pasted into the pipeline file, or a rollback that is never verified.

### Incident console

Incident missions open with a ticket and a broken platform on a one-second clock. Tabs: **Ticket**, **Metrics** (live stats and sparklines), **Logs** (evidence that names the failing component), **Diagram** (each component coloured by its own health). **Runbook actions** change the platform; every action resets the recovery timer. Answer the **root cause** question, apply a remediation that removes the cause (symptom-only fixes such as shedding legitimate traffic are rejected with a reason), wait until health stays green for the required seconds (use Advance 10s to skip ahead), then write the **post-incident note**. All five checks must pass to complete.

## Skill Progress

Mastery per skill (0 to 100) with evidence: completions, independent solves (no hints, two attempts or fewer), retention checks. Stage promotion requires the next stage's skills at 60 percent. Retention checks appear when spaced repetition says a skill is due. Opening one replays the completed mission from a fresh environment with hints disabled: passing adds mastery and doubles the review interval; "I need the lesson again" ends the check, lowers mastery a little and schedules a review for tomorrow.

## Interview Command Center

- **STAR Academy**: what each part of a STAR answer needs, weak vs strong examples, how to talk about failures, ownership language.
- **Leadership Principles**: all 16, each with an explanation, evidence to show, practice questions, follow-ups and examples.
- **Story Bank**: your real experiences, structured as STAR, tagged with principles and skills, with a note on where the facts can be checked and how confident you are. Export it for backup.
- **Mock interview**:
  - *Guided* builds the answer one section at a time with examples.
  - *Practice* asks the question, then runs **Dive Deeper**: it detects ownership, technical-detail, decision, results, learning and principle gaps and asks one focused follow-up at a time at increasing depth. "I don't know" is accepted. Press "Stop and get coaching" at any time.
  - *Realistic* is timed with several questions and a technical follow-up, and holds all coaching until the end.
- **Voice**: in Chrome or Edge, with consent given in Settings, press "Answer by voice". The red indicator shows recording; stop, then review and correct the transcript before submitting. Text input is always available. The interviewer reads questions aloud when speech synthesis exists.
- **Feedback report**: scores on six transparent categories with quoted evidence and gaps, strongest examples, missing details, vague statements, recommendations, follow-ups to prepare for, a revised outline built only from what you said, and the next practice step. Every report states its limitations. Delivery metrics appear only when a real recording was made.
- **Improved answer**: record a second version. The app only declares improvement when the evidence got stronger.
- **History** keeps every session and tracks category averages over your last ten.

## Settings

Theme, daily goal, voice consent and options, coaching engine (rules by default; optional Claude proxy with separate consent), export/import/reset of all data, and the live list of what is verified, partial, unverified or planned.
