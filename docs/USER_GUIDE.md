# OpsForge user guide

## First run

You are asked for a name and six quick placement questions. They only set a starting point; everything after that is earned by doing missions. You begin at Stage 1, Engineering Trainee, at Nimbus Freight, a fictional company.

## The daily loop (about 30 minutes)

**Today** (the home page) has one big **Continue Learning** button. The **Curriculum** page is the map: seven tracks you can expand to see their skills with mastery and evidence, their missions in order with Start/Resume/Review, and the lab each track uses; switch the lens to **By target role** to see the same data as a qualification gap map for the posting you chose. When you finish a mission, a **What next** panel offers the next mission you can start, and every mission links to its free-play lab. It takes you to the most useful thing right now: an unfinished mission, a retention check that is due, or the next mission in the recommended order. The suggested shape of a session is 3 minutes recall, 7 minutes new concept (the mission's Lesson tab), 15 minutes hands-on, 5 minutes reflection. Nothing penalises a missed day.

## Missions

Every mission page has:

- **Briefing / Lesson / Glossary** tabs. Read the lesson when a concept is new. Reading never earns mastery.
- A **primer** at the top of every lesson, written for someone new to engineering: *In plain words* (what the thing is, with an everyday analogy), *Why it matters* (what breaks in real work without it) and *Why this way* (why these steps beat the obvious alternative), followed by the terms it uses, linked to the Glossary. On the unnamed-role track the primer is open; on the SDE II track it is collapsed under "Start from the basics". Settings → Explanations switches either way.
- A **workstation**: the terminal, the code editor, the algorithms lab, the incident console or the design canvas.
- **Checks** on the right: live validation of the real state (files, permissions, services, test results, experiments). "Complete mission" only unlocks when every check passes.
- **Hints** in four levels: nudge, specific hint, concept explanation, guided example. Each level you reveal reduces the mastery gained, so try first. Beginner-first learners also see **Why start here**, one sentence on why the mission's first move is the first move, before any hint is revealed.
- **Reset mission environment** if you want a clean slate while you are working.
- After completion, **Redo this mission** reopens it with a fresh workstation and hints on. Your completion date, reflections and retention history stay, missions that depend on it stay unlocked, and finishing again changes no mastery; it is practice. **Start over (forgets this completion)** is the hard reset, which also makes dependants lock again.
- After completion, a **reflection prompt** asks you to explain what you did, interview-style. You can send that explanation to the interview coach.

### Linux Terminal

A simulator with a documented subset of commands (type `help`). It has a real filesystem model, permissions, `sudo`, processes, services (`systemctl`, `journalctl`), pipes and redirection. `nano FILE` opens a small editor. Unsupported commands say so. Use ↑/↓ for history, Tab to complete paths, Ctrl+L to clear.

### Python lab

Real CPython runs in your browser. Press **Run** to execute and see real output or a real traceback (with a plain-language explanation for common errors). Press **Run tests** to run the mission's test cases; they execute your functions directly, so names and return values matter. Infinite loops are stopped after 10 seconds.

### Go lab

Real Go runs in your browser through an interpreter compiled to WebAssembly. Goroutines, channels, select, WaitGroups, mutexes, generics and most of the standard library work; there is no network or filesystem, and goroutines interleave cooperatively because WebAssembly is single-threaded: races around a blocking call (a sleep, a channel, a lock) do reproduce, bare `counter++` races do not. Press Run for real output or a compiler error with a plain-language explanation. The runtime (about 8 MB compressed) downloads the first time you open the lab.

**Race detector.** The lab and every Go mission have a *Run with the race detector* button. It sends the current program to an optional service on your own machine (`npm run race-server`, URL in Settings) that runs it with `go build -race` and shows the detector's report: each conflicting access with its goroutine, function and line. A clean run means no race was observed, not that none exists, and the panel says so.

Go missions (on the Distributed track, unlocked after the Python config validator) work like Python missions: edit the program, Run to see output, Run tests to execute the mission's Go test snippets in the same interpreter. They cover a config parser with error values, a worker pool, timeouts with context and select, and retries with idempotency keys.

### Algorithms lab

Pick an algorithm and an input size, press Run. You get an **operation count** (deterministic, the thing Big O describes) and an **elapsed time** (measured on your device, noisy). For small n you can step through the algorithm. Growth tables and side-by-side comparison show how work scales.

### Security Operations, System Monitoring

Security investigations run on isolated fictional hosts. The monitoring page is a deterministic simulation: move the sliders, inject failures, and watch latency, error rate, queue depth, the logs and the architecture diagram respond coherently.

### CI/CD missions

Some missions ship their own command-line tools, listed at the end of `help`: `ci run` / `ci log` / `ci status` execute and inspect a simulated pipeline defined in `.ci/pipeline.yml`; `deployctl status` / `history` / `rollback VERSION` manage which release is live; `metrics errors` / `latency` query the live service. The pipeline runner reacts to the real repository state, and the checks reject shortcuts: a retry that happens to pass, a skipped test, a secret pasted into the pipeline file, or a rollback that is never verified.

### Lesson missions

Some topics are process rather than practice (Agile and Scrum). A lesson mission shows the lesson inline, gives a concrete fictional scenario, and checks understanding with a short quiz; a wrong answer tells you which section to re-read without giving the answer away. The interview cue at the bottom says how the topic comes up in interviews and how to shape a STAR answer.

### Design exercises

A design mission gives you requirements with numbers (peak load, latency budget, monthly budget, which paths may not have a single point of failure, what must never be lost) and a palette of components, each with its cost, capacity, latency and failure mode. Pick one per slot and the **Consequences** panel recomputes cost, capacity, read latency, single points of failure, durability and, where the requirements demand it, read consistency live. There are two exercises: the position ingest (staleness acceptable, write path must be durable) and the command and acknowledgement path (status reads must be strongly consistent, both paths must survive a failure, retries must not double-send). The second deliberately makes last time's right answer wrong. Then size the numbers the requirements imply (rate × duration, events ÷ throughput), answer **failure drills** whose correct answer depends on the components you chose, and write a justification. The rubric is transparent and structural: it checks the numbers and that you named your components and tradeoffs; it cannot judge whether the reasoning is good, and it says so. Use the reflection prompt and the interview coach for that.

### Incident console

Incident missions open with a ticket and a broken platform on a one-second clock. Tabs: **Ticket**, **Metrics** (live stats and sparklines), **Logs** (evidence that names the failing component), **Diagram** (each component coloured by its own health). **Runbook actions** change the platform; every action resets the recovery timer. Answer the **root cause** question, apply a remediation that removes the cause (symptom-only fixes such as shedding legitimate traffic are rejected with a reason), wait until health stays green for the required seconds (use Advance 10s to skip ahead), then write the **post-incident note**. All five checks must pass to complete. Serverless incidents add function stats (needed vs allowed concurrency, throttles, cold starts, dead-letter queue depth, duplicate and lost invocations) and runbook actions for the concurrency limit, provisioned concurrency, dead-letter queue, retries, the idempotent handler and the timeout. Some wrong actions cannot be undone inside the incident (failing over to a replica that is behind discards its missing writes); the check tells you why, and **Reset** restarts the incident.

## Study

Study (Learn group) holds exam-style objective catalogs taken from the Ascendra project: eleven AWS certification courses and nine core computer-science and security courses. Each course lists its units with the exam weight and a one-sentence "gate" that says what mastering the unit means, and each unit lists its objectives.

Every objective carries a label that says how it is best learned here: "Do it: existing mission" means an OpsForge mission already makes you do it, and the card links straight to that mission; "Read and check", "Read, then a scenario" and "Explain it back" describe the lesson formats that arrive with the generated content; "Do it: lab planned" names a hands-on lab that does not exist yet. Today only the mission links are live; the rest of each objective is a catalog entry.

Open an objective and, once the owner has generated the course's lessons, you get the lesson loop: guess from intuition, read the teaching (with the plain-words paragraph open on the unnamed-role track), answer one check question at a time (you never see the same one twice until you have seen them all, and the choices are reshuffled), explain the idea back and compare it with a model answer and the points a good answer covers, then rate yourself. A miss schedules a review after 1, 7 and 21 days; Today points you at it. In Settings, "Study style" puts hands-on objectives or reading first; nothing is hidden. If Claude coaching is on, consented and pointed at your local proxy, your explanation (and your answer to a unit's scenario) is graded by the proxy against the model answer, with feedback naming any missing point; those proxy verdicts are the only way to Transfer-ready. Without the proxy you compare with the model answer yourself and rate honestly.

Each objective also shows its status on Ascendra's 0–4 rubric: Introduced (recognises the terms), Guided (answers check questions, or did it in a mission), Independent (explains it back), Transfer-ready (handles scenarios, graded by the proxy), Needs review (recent misses; a review comes back after 1, 7 and 21 days). Completing a linked mission credits the objective to Guided. Each course page shows readiness weighted by the published exam-domain weights, which is a study measure, not a prediction. Progress lists every course you have started and Today surfaces due reviews.

Study material is unofficial: the objectives are paraphrased from public exam guides, OpsForge is not affiliated with any certification body, and finishing a course here is not a credential. Study status is separate from skill mastery, which still comes only from missions.

## Story Bank drafts from missions

Saving a mission's reflection also saves a draft story in the Story Bank, tagged "draft from a mission · practice, not experience": the mission summary is the Situation, its first objective the Task, your reflection the Action, with suggested Leadership Principles and the technical skills filled in. Edit it like any story; re-saving the reflection updates only the Action. The evidence line says it was a simulation so it is never mistaken for work experience.

## Progress

Mastery per skill (0 to 100) with evidence: completions, independent solves (no hints, two attempts or fewer), retention checks. Stage promotion requires the next stage's skills at 60 percent. Retention checks appear when spaced repetition says a skill is due. Opening one replays the completed mission from a fresh environment with hints disabled: passing adds mastery and doubles the review interval; "I need the lesson again" ends the check, lowers mastery a little and schedules a review for tomorrow.

## Interview

**Role questions**: Interview → Role questions (or the "Role questions" set in Practice) lists technical questions drawn from your target posting's qualifications, each naming the missions that prepare you for it and the cues an interviewer may listen for. They are practice examples written for this app, not a leaked question bank. In Realistic mode the technical follow-up is drawn from this set. The Curriculum page's role lens lists the same questions under the gap map.

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

Target role (which posting your gap map and recommendations are built around), theme, daily goal, voice consent and options, coaching engine (rules by default; optional Claude proxy with separate consent), the optional Go race-detector service URL, export/import/reset of all data, and the live list of what is verified, partial, unverified or planned.
