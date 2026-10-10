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

### Policies lab

A fictional platform's authorization policy language, one statement per line (`allow store:Read on store/orders/* when principal.tag.team = dispatch`). Each exercise gives you a few policies, lets you edit one, and lists requests that must come out a certain way; every request shows a trace naming the statement that decided it. The rules are the ones every cloud policy system shares, with no vendor's syntax: nothing is allowed until something allows it, an explicit deny beats every allow, a boundary or organisation guardrail is a ceiling that grants nothing by itself, a principal from another account needs both sides to allow, and tag conditions can compare the two sides. Passing an exercise credits the Study objectives linked to it.

### Network lab

A fictional virtual network: subnets with route tables, stateful filters on hosts (they allow the reply automatically), numbered stateless filters on subnets (the first matching number wins, and the reply needs its own outbound rule on ports 1024-65535), an address translator for private hosts, private endpoints for platform services, and a hub router between networks. Each exercise lets you edit one component in a one-line-per-rule grammar and lists flows that must reach or be dropped; every flow has a hop-by-hop trace that names the hop which dropped the packet and why, with flow-log style ACCEPT and REJECT lines. Passing credits the linked Study objectives.

### Recovery lab

A planner for recovery to a stated time, point and budget. Pick a backup cadence (daily snapshot, hourly snapshot, continuous replication), a standby tier (none, cold, warm, hot), a failover trigger (manual, automatic) and whether the restore is drilled monthly. The recovery point is the backup interval; the recovery time is detection plus bringing up the standby plus restoring the data plus switching traffic, shown as a timeline with the dominant step; the cost is in fictional credits. The checks compare the plan with the requirement and name the cheapest plan that meets it, so spending more than needed fails just like falling short. Each exercise also asks which step dominates your plan. Passing credits the linked Study objectives.

### Alarms lab

Write alarms over the simulated platform's own metrics, one per line (`alert: errorRate > 0.03 for 3 of 3`, or a composite with `and`), and replay incidents and harmless moments second by second. Each run says what must happen (fire within the deadline, or stay quiet) and what your alarms did: never fired, fired late, fired for nothing, with sparklines of the metrics you alarmed on. The exercises cover thresholds above normal variation, evaluation periods against blips, choosing the metric that measures the failure, replica lag, throttling versus cold starts on the function platform, and severity tiers. Passing credits the linked Study objectives.

### Cost lab

A monthly bill for the fleet platform in fictional credits; every price is invented and listed on the page, so what you learn is the shape, not a price list. Choose how many capacity units to commit to (cheaper per unit, paid while idle), the instance size relative to need, the compute model for batch work (interruptible only if the job tolerates it), the cold storage tier against the retrieval speed you need, a private endpoint or the address translator for service traffic, one translator per zone or a shared one, an edge cache in front of egress, a spend alarm and allocation tags. The bill breaks down line by line, the checks compare it with the requirement, and the cheapest plan that meets the requirement is named, so spending more than needed fails just like falling short. Passing credits the linked Study objectives.

### Deploys lab

How a release reaches the fleet, simulated second by second: all at once, rolling batches, a canary first, or a second fleet with a traffic switch, plus a guard (an error-rate alarm with an evaluation window and automatic rollback). Restarting instances serve nothing and the rest absorb the load up to the fleet's headroom; a defective release fails its share of the traffic it serves, sometimes only after a delay, and sometimes in a way synthetic checks can see before any customer does. Three sparklines show traffic on the new version, the fleet in service and the error rate customers see, with the alarm marked; the checks compare the run with the requirement (capacity floor, failed-request budget, time, second-fleet cost). Passing credits the linked Study objectives.

### Encryption lab

A simulated key service, driven by a program of one-line commands: ask a key for a data key (plaintext in memory, a wrapped copy alongside), seal an object locally with it, store the object with the wrapped key beside it, forget the plaintext key, unwrap later as whoever needs to read, rotate the key, grant a principal from another account. Small objects can be sealed in the service directly; anything over 4 KB cannot, which is what forces envelope encryption. Every line is traced and every refusal says why (no rule in the key policy, another account, the wrong data key, a plaintext object). The checks read the final state and the trace. No real cryptography runs; what you learn is the protocol and who may do what. Passing credits the linked Study objectives.

### Events lab

How messages get from a producer to its consumers, simulated second by second. Choose direct calls, a job queue (redelivery delay, receive limit, dead-letter queue, ordered mode, idempotent consumers), a pub/sub topic (a filter and a buffer per subscription) or a partitioned stream (shards and the partition key). The producer may retry and send duplicates, some messages may be poison, consumers may be down for a while or finish in a different order than they started. The outcome counts what the choice costs: messages lost, processed twice, out of order within an entity, attempts wasted on poison, the backlog and the oldest wait; a per-subscriber line says what each one received, what was noise and what was lost. The exercises cover decoupling an outage, poison messages, the redelivery delay against the service time, exactly-once and order for a ledger, fan-out with filters, and a hot key on a stream. Passing credits the linked Study objectives.

### Scaling lab

A fleet behind a load balancer, scaled by a policy, second by second. Set the fleet's bounds, choose no policy, target tracking or step scaling on CPU or requests per instance, decide whether instances still warming up count as capacity, set evaluation periods and cooldowns, schedule a minimum ahead of a known surge, and tune the health checks (interval and unhealthy threshold). Demand is a curve; each instance serves a fixed rate once warm; the balancer keeps sending traffic to a hung instance until the health check gives up on it. Two charts show demand against capacity and the instance count with warming instances; the outcome counts failed requests, slow seconds, instance-seconds, scaling actions and healthy instances thrown away by over-eager health checks. The exercises cover elasticity against a fixed fleet, the runaway fleet when warm-up is ignored, a scheduled minimum for a flash sale, thrash on a wobbling demand, health-check detection time against churn, and the metric an I/O-bound service actually needs. Passing credits the linked Study objectives.

### SQL lab

Real SQL on a real engine: each exercise's schema and fictional data are loaded into an in-memory SQLite inside the Python runtime (so the first run waits for the interpreter, like the Python lab), your statements run one by one, and you see the rows of the last query, the query plan SQLite chose for it (SCAN against SEARCH ... USING INDEX), and the indexes and views you created. The exercises cover a four-table join with aggregates, an index that turns a lookup from a scan into a search, splitting a repeating table into customers and products (third normal form), an atomic transfer with a CHECK that rolls the whole transaction back, a view for a shared report, and a function-wrapped column that hides an index from the planner. Passing credits the linked Study objectives.

### Python drills

Fourteen short drills, one idea each, on the real interpreter: write the functions the brief asks for, run the tests, and read the interpreter's own messages when one fails. They cover operators and truthiness, positional and keyword arguments with *args and **kwargs, scope and closures, recursion, the mutable default argument, slices and tuples, sets, comprehensions over nested data, classes with dunder methods, inheritance and super() against composition, generators, decorators, type hints with a custom exception, and files with the with statement and the standard library. Three hints per drill, the last a full program. Passing credits the linked Study objectives.

### JavaScript lab

Seventeen drills, one idea each, on your browser's own JavaScript engine. Code runs in a Web Worker that cannot touch the page, with a 6-second limit: an infinite loop is stopped and a fresh worker takes over. Most drills are one program, run in strict mode with top-level await allowed; the modules drill is real ES modules split over three files, with tabs to switch between them. The console shows what your code logged (warnings and errors marked), errors give the line they came from, timers run to completion before the tests start, and `fetch` reaches only a simulated API at `https://api.fleet.example` with the courier company's shipments and drivers. The drills cover var/let/const and the temporal dead zone, coercion and ===, loops, parameters and arrow functions, this, closures, the array methods, destructuring and spread, shallow and deep copies, the event loop (predict the order, then run it), promises and Promise.all, async/await with fetch, ES modules and template literals, classes with static and private members, Map/Set with ?. and ??, the prototype chain, and higher-order functions with the observer pattern. Three hints per drill, the last a complete answer. Passing credits the linked Study objectives.

The DOM drills run against a small page of their own inside the worker (a standard DOM library, so querySelector, closest, createElement, classList, events with bubbling and preventDefault all work), and the panel underneath shows that page after your program ran, rendered with scripts disabled. The library computes no layout or styles, does not model the capture phase, and has no built-in form validity checks, so the form drill validates in code. The testing drill gives you `test(name, fn)`, `expect(value)` with the usual matchers (`toBe`, `toEqual`, `toThrow`, `toHaveBeenCalledWith`, `.not`, `.resolves`, `.rejects`) and `mock()`: Jest's shape, not Jest. Your tests are run three times: against the original buggy file (at least one must fail), against a correct file (all must pass) and against your fix. The server drills call a request handler directly with `{ method, path, headers, body }`; `process.env` holds a simulated environment and `db` is an async datastore where every call takes about 10 ms, which is enough for two concurrent requests to interleave at their awaits.

### CI/CD missions

Some missions ship their own command-line tools, listed at the end of `help`: `ci run` / `ci log` / `ci status` execute and inspect a simulated pipeline defined in `.ci/pipeline.yml`; `deployctl status` / `history` / `rollback VERSION` manage which release is live; `metrics errors` / `latency` query the live service. The pipeline runner reacts to the real repository state, and the checks reject shortcuts: a retry that happens to pass, a skipped test, a secret pasted into the pipeline file, or a rollback that is never verified.

### Lesson missions

Some topics are process rather than practice (Agile and Scrum). A lesson mission shows the lesson inline, gives a concrete fictional scenario, and checks understanding with a short quiz; a wrong answer tells you which section to re-read without giving the answer away. The interview cue at the bottom says how the topic comes up in interviews and how to shape a STAR answer.

### Design exercises

A design mission gives you requirements with numbers (peak load, latency budget, monthly budget, which paths may not have a single point of failure, what must never be lost) and a palette of components, each with its cost, capacity, latency and failure mode. Pick one per slot and the **Consequences** panel recomputes cost, capacity, read latency, single points of failure, durability and, where the requirements demand it, read consistency live. There are two exercises: the position ingest (staleness acceptable, write path must be durable) and the command and acknowledgement path (status reads must be strongly consistent, both paths must survive a failure, retries must not double-send). The second deliberately makes last time's right answer wrong. Then size the numbers the requirements imply (rate × duration, events ÷ throughput), answer **failure drills** whose correct answer depends on the components you chose, and write a justification. The rubric is transparent and structural: it checks the numbers and that you named your components and tradeoffs; it cannot judge whether the reasoning is good, and it says so. Use the reflection prompt and the interview coach for that.

### Incident console

Incident missions open with a ticket and a broken platform on a one-second clock. Tabs: **Ticket**, **Metrics** (live stats and sparklines), **Logs** (evidence that names the failing component), **Diagram** (each component coloured by its own health). **Runbook actions** change the platform; every action resets the recovery timer. Answer the **root cause** question, apply a remediation that removes the cause (symptom-only fixes such as shedding legitimate traffic are rejected with a reason), wait until health stays green for the required seconds (use Advance 10s to skip ahead), then write the **post-incident note**. All five checks must pass to complete. Serverless incidents add function stats (needed vs allowed concurrency, throttles, cold starts, dead-letter queue depth, duplicate and lost invocations) and runbook actions for the concurrency limit, provisioned concurrency, dead-letter queue, retries, the idempotent handler and the timeout. Some wrong actions cannot be undone inside the incident (failing over to a replica that is behind discards its missing writes); the check tells you why, and **Reset** restarts the incident.

## Study

Study (Learn group) holds exam-style objective catalogs taken from the Ascendra project: 90 courses across cloud (AWS, Azure, Google Cloud), technology (security, IT and networking, computer science), project management and health (nursing, physical therapy, fitness).

The Study home opens on the courses you have started, then lists every course by area and field. Each field shows a few suggested learning paths, with the first course marked "start here", and its courses grouped by level (fundamentals, associate, degree, licensure, professional, specialty). Each course card says whether its lessons are ready. The search box finds courses by name or exam code and, from three letters, every objective whose text mentions your words, each one a link straight to the objective. The field buttons, the level list and "Only courses with lessons" narrow everything; they are kept in the address, so a filtered view can be bookmarked.

Nursing and physical therapy courses open on a disclaimer: the material is exam preparation, not clinical guidance, and must not be used for a real patient. Nothing in the course shows until you accept it, once per field; if the wording ever changes in meaning, you are asked again.

Each course lists its units with the exam weight and a one-sentence "gate" that says what mastering the unit means, and each unit lists its objectives.

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
