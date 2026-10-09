import type { MissionPrimer } from "../domain/types";

/**
 * Beginner primers: one per mission, written for a learner with no engineering
 * background. Each primer answers three questions before the lesson gets to
 * the how: what is this thing in plain words, why does it matter in real work,
 * and why do we do it this way rather than the obvious alternative. The
 * `firstStep` sentence explains why the mission's first move is the first move;
 * it sits next to the hint ladder. Plain-words text uses no code spans on
 * purpose: the lesson and glossary carry the exact commands and terms.
 *
 * Shown expanded for the unnamed-role track (new engineers) and collapsed under
 * "Start from the basics" for the SDE II track; Settings overrides either.
 */
export const PRIMERS: Record<string, MissionPrimer> = {
  "linux-01-find-your-way": {
    plain:
      "A server is just a computer in a data centre with no screen attached. You talk to it by typing commands into a terminal, one line at a time, and it answers in text. Think of it as texting with a very literal assistant: it does exactly what you type and nothing more. Folders are called directories, and at any moment you are standing in one of them, the way you are always in one room of a building.",
    why:
      "Almost every operations task starts with finding something on a machine: a log, a configuration file, a script a colleague left behind. If you cannot tell where you are and what is around you, every later command is a guess, and guesses on production servers break things. Orientation is the habit that makes everything else safe.",
    whyThisWay:
      "You could click around a graphical file browser if one existed, but servers rarely have one, and the terminal works the same over a slow remote connection, inside a script, and on a thousand machines at once. Reading first (`pwd`, `ls`, `cat`) and writing last (`echo` into a file) is deliberate: looking is free and reversible, writing is not.",
    firstStep: "You start with pwd and ls because you cannot plan a route without knowing where you stand. Both commands only read, so they can never damage anything.",
  },
  "linux-02-log-detective": {
    plain:
      "A log is a diary a program writes for itself: one line per thing that happened, with a time stamp and how serious it was. When something breaks, the log is usually the only witness. The problem is volume: hundreds or millions of lines, most of them boring. This mission teaches you to filter the noise, group what is left and count it, so a wall of text turns into one sentence: the most common error is this.",
    why:
      "Engineers are judged on how fast they get from 'the API is failing' to 'because of this'. Reading a log line by line does not scale past a few dozen lines. Filtering and counting does, and it gives you evidence you can show a teammate or an interviewer instead of a hunch.",
    whyThisWay:
      "Small tools chained with pipes beat one giant tool because each step does one simple thing you can check: `grep` keeps matching lines, `sort` puts identical lines together, `uniq -c` counts them. If the result looks wrong, you run the chain one step shorter and see where it went astray. The time stamp is cut off first because otherwise every line is unique and nothing groups.",
    firstStep: "Filtering to ERROR lines first shrinks the problem before you do anything clever, and looking at the shape of a few lines tells you which columns to cut later.",
  },
  "linux-03-locked-out": {
    plain:
      "Every file on a Linux machine has an owner and a set of permissions that say who may read it, change it or run it, a bit like a door that opens for some badges and not others. Programs that run in the background, called services, usually run as their own low-powered user. If a file the service needs is locked to a different owner, the service fails to start and says so in its own log, the journal.",
    why:
      "A permission mistake after a deploy is one of the most common real outages, and it looks scary: the service is down and the error is cryptic. Knowing how to read the long listing and the journal turns it into a two-minute fix. It is also the foundation of security: the same rules keep strangers out of files they should not see.",
    whyThisWay:
      "Asking the service why it failed (`systemctl status` and the journal) comes before touching any file, because the journal names the exact path and the exact problem; guessing which file to loosen can open holes you did not intend. Fixing ownership and a precise mode such as 640, instead of making the file readable by everyone, keeps least privilege: only the owner and the group get in.",
    firstStep: "You start with the service status and its journal because they tell you which path is the problem, so you repair one thing on purpose instead of changing permissions until something works.",
  },
  "linux-04-disk-full": {
    plain:
      "A disk is a bucket, and when the bucket is full, programs that need to write anything start failing in confusing ways. Two tools answer two different questions: one says how full each bucket is, the other says what inside it is big. Most of the space is usually taken by old copies of logs, crash dumps, or a log that was left in extra-chatty mode. The trap is that deleting a file a running program still has open frees no space at all.",
    why:
      "Disk-full pages are routine on-call work, and the wrong move is expensive: deleting application data to make room destroys something real, and deleting an open log appears to do nothing, which tempts people into deleting more. Knowing what is safe and how to free an open file is the difference between a quick fix and a bad night.",
    whyThisWay:
      "Measure first (`df`), then walk down the tree (`du`), then look at individual files (`ls -lh`), because each step narrows where the space went, and deleting only what you have identified is the only way to be sure you deleted the right thing. Truncating the open log instead of deleting it keeps the program's handle valid while giving the space back.",
    firstStep: "You start with df -h because it confirms the alarm and tells you which filesystem is full; without it you might clean the wrong disk entirely.",
  },
  "linux-05-runaway-process": {
    plain:
      "Everything running on a machine is a process, and each has a number called a PID. Sometimes one process goes wild and eats all the processor time, so everything else crawls. Tools like top and ps show who is busy. You can ask a process to stop with kill, which despite the name is a polite request first. Then you have to find what started it, often a scheduled job called a cron entry, or it will come back tonight.",
    why:
      "A machine that is slow for everyone because of one stuck job is a daily occurrence. The fast reflex is to kill something, and killing the wrong thing turns a slow service into a dead one. Identifying carefully, stopping the right process and fixing the trigger is what separates a tidy fix from an incident you caused.",
    whyThisWay:
      "Look first (`top`, `ps`, `free`) to get the PID, the user and the command line, because the command line usually tells you why the process is misbehaving. Use the gentle `kill` before the forced one so the program can clean up. Then edit the cron entry, because stopping a job that is scheduled to restart is not a fix; it is a pause.",
    firstStep: "You start with top because it sorts by processor use and shows the PID you need; everything after depends on knowing exactly which process is the problem.",
  },
  "python-01-uptime-report": {
    plain:
      "A program is a list of instructions a computer follows in order. Python is a language for writing those instructions that reads close to English. This first script takes a big number of seconds and turns it into something a person can read, like 3d 4h 5m. You will meet variables (names for values), two kinds of division, text formatting, and functions, which are named, reusable chunks of instructions.",
    why:
      "Operations engineers write small scripts constantly: to convert machine numbers into human ones, to format a report, to check a value. The posting you are training toward asks for programming experience, and this is where it starts. Every later Python mission builds on functions, variables and strings.",
    whyThisWay:
      "Splitting the seconds with integer division and remainder is how you convert any unit into bigger units, and it is a pattern you will reuse for bytes, timestamps and money. Writing the logic as functions rather than a loose script lets tests call it directly, which is how real teams check that code works before it runs anywhere important.",
    firstStep: "You start by writing down the unit sizes (86,400 seconds in a day, and so on) because the whole conversion is peeling off the biggest unit first; with the numbers in front of you, the code is just arithmetic.",
  },
  "python-02-log-parser": {
    plain:
      "This is the log detective mission again, but in code instead of commands. Each log line is split into its parts, lines that are not errors are skipped, and a dictionary, which is a lookup table from a name to a value, counts how often each error message appears. Loops repeat work for every line, and conditions decide what to do with each one.",
    why:
      "The grep and sort chain from the terminal mission is great for a one-off. When you need the same answer every day, or a thousand machines need it, you write it as a program. Parse, filter and aggregate is the shape of almost every operations script you will write or read on the job.",
    whyThisWay:
      "Getting one line right first, then looping, is deliberate: a function that handles a single line is easy to test and reason about, and the loop then adds nothing new. Counting with a dictionary instead of a list of pairs is both simpler to write and much faster, which matters when logs are large.",
    firstStep: "You start with parse_line on a single line because every other function depends on it; once one line splits correctly, counting is just repeating that over all lines.",
  },
  "python-03-config-validator": {
    plain:
      "Programs read settings from configuration files, and people type mistakes into those files. A program that crashes on a typo with a wall of error text is scary; one that says the port must be a whole number is helpful. Exceptions are Python's way of saying it cannot continue. Raising your own with a clear message, and catching them in the right place, turns crashes into helpful errors. Tests check that both the good and the bad paths behave.",
    why:
      "Tools other people trust fail early and explain themselves. In operations, a configuration mistake caught at startup costs seconds; one discovered at 3 a.m. when the service misbehaves costs hours. Being able to read a failing test and a traceback is also how you will debug everything else from here on.",
    whyThisWay:
      "Raising a specific error type with a specific message, instead of returning nothing or printing, lets the caller decide what to do and keeps the message next to the fact it describes. Catching the narrowest exception possible is deliberate: catching everything hides real bugs. Letting the tests drive you tells you exactly which behaviour is still missing.",
    firstStep: "You start by running the tests as they are because the failures are a to-do list written for you; reading them tells you where the planted bugs are instead of guessing.",
  },
  "python-04-fleet-report": {
    plain:
      "A CSV is a spreadsheet saved as plain text: one row per line, columns separated by commas. Exports from real systems are messy: rows with missing columns, numbers that are not numbers. This mission reads such a file properly, adds up kilometres and fuel per vehicle, skips bad rows on purpose while counting them, and writes the result as JSON, a text format other programs can read.",
    why:
      "Turning messy exports into clean, stable summaries is the bread and butter of operations tooling, and it is the kind of script you will be asked to write on the job. Doing it carelessly produces reports that crash on one bad line, or worse, that silently drop data nobody notices is missing.",
    whyThisWay:
      "The `csv` module instead of splitting on commas, because real fields can contain commas inside quotes. Skipping bad rows and returning how many you skipped, rather than crashing or swallowing them, gives the reader both a result and a data-quality signal. Sorted keys and fixed indentation in the output make two runs on the same data produce identical text, which makes tests and diffs meaningful.",
    firstStep: "You start with DictReader because it hands you each row as a dictionary keyed by the header, so the rest of the code can talk about the km column by name instead of by position.",
  },
  "bigo-01-growth": {
    plain:
      "Big O is a way of saying how much more work a program does as its input gets bigger, without caring which computer it runs on. Some tasks take the same time whatever the size. Some grow in step with the size: twice the data, twice the work. Some grow with the square: twice the data, four times the work. This mission lets you run real algorithms, count their steps at different sizes and watch the pattern appear.",
    why:
      "Systems that work fine in testing and fall over in production often hide a loop whose work grows with the square of the data. Knowing the growth classes lets you predict that before it happens, and 'what is the complexity of your approach?' is one of the most common interview questions for any engineering role.",
    whyThisWay:
      "Counting operations instead of seconds is deliberate: seconds depend on the machine, the browser and whatever else is running, while the step count depends only on the algorithm. Changing one thing at a time, the input size, with the algorithm fixed, is the only way to see the growth pattern cleanly.",
    firstStep: "You start by running the same algorithm at several sizes because the pattern lives in the comparison between runs; a single measurement tells you nothing about growth.",
  },
  "bigo-02-search-sort": {
    plain:
      "Finding one item in a sorted list by repeatedly halving where it could be takes about twenty steps for a million items, where checking each item would take up to a million. Sorting has a similar split: methods that compare neighbours over and over grow with the square of the size, while methods that divide the list and merge the halves grow only a little faster than the size itself. This mission lets you step through both and measure the difference.",
    why:
      "Choosing the right algorithm is often the difference between a nightly job that finishes in seconds and one that never finishes. Knowing why halving is so powerful, and what it requires (sorted data), lets you reason about databases, indexes and search features you will meet everywhere.",
    whyThisWay:
      "Stepping through binary search on a tiny array first, before measuring at a million, is deliberate: you need to see the window halve with your own eyes before the step count means anything. Comparing operation counts rather than milliseconds keeps the classification honest, and the elapsed time is only a sanity check.",
    firstStep: "You start with step-through on a small array because watching the search window shrink is what makes halving concrete; the big measurement afterwards just confirms it.",
  },
  "bigo-03-structures": {
    plain:
      "A list is like a stack of papers you flip through from the top to find a name. A hash table is like a filing cabinet with labelled drawers: you work out which drawer from the name and go straight there. Checking whether a vehicle is known thousands of times a second is slow with the stack and nearly instant with the cabinet. This mission measures both and asks you to choose for a real workload.",
    why:
      "'Which data structure and why' is the most common follow-up in coding interviews, and in real systems the wrong choice is the hidden reason a service cannot keep up. Being able to say 'a set, because we do many membership checks and order does not matter', with measured counts behind it, is a strong answer.",
    whyThisWay:
      "Measuring both structures at the same large size makes the difference impossible to argue with. Asking which operation dominates the workload before choosing is the method: lists win for appending and walking in order, hash tables for lookups by key, and the mission makes you state that reasoning rather than memorise a rule.",
    firstStep: "You start by running both structures at the same size because the comparison is the evidence; measured side by side, constant time against a scan speaks for itself.",
  },
  "netsec-01-brute-force": {
    plain:
      "Servers listen for connections on numbered doors called ports; SSH, the tool engineers use to log in remotely, listens on port 22. Attackers try thousands of passwords against it, and each try leaves a line in the authentication log. This mission has you count failed attempts per source address, check whether the attacker ever got in, write a clear verdict, and lock down a private key file that anyone on the machine could read.",
    why:
      "Every internet-facing server is attacked like this constantly. Being able to read an authentication log, name the source and state whether a login succeeded is the first thing a security team needs from you. Least privilege, giving every file and account only the access it needs, is the single idea behind most hardening work.",
    whyThisWay:
      "Evidence first, verdict second: counting attempts per address with the same filter, group and count chain from the log mission gives you a number you can defend, and checking for an accepted login from that address answers the question that actually matters. Fixing the key's permissions is chosen because it is a concrete reduction in risk you can verify, unlike vague advice.",
    firstStep: "You start by looking at a few raw lines because the log's shape tells you which word is the source address; counting the wrong column gives a confident wrong answer.",
  },
  "netsec-02-suspicious-cron": {
    plain:
      "Once an attacker gets into a machine they want to stay, so they leave something that restarts their program, often a scheduled job called a cron entry. Finding it means reading three places: where jobs are scheduled, what is running right now, and which network connections are open. The attacker's address and file paths are indicators of compromise: concrete facts other teams can block on. Then you stop the program, remove the scheduler entry and the dropped files, in that order.",
    why:
      "Incident response is a core part of the security qualification, and the order of operations is what people get wrong under pressure. Kill the process but leave the cron job and it is back in five minutes; delete the files first and you lose the evidence. Recording exact indicators is how one person's finding protects a whole fleet.",
    whyThisWay:
      "Three angles because any one can be fooled: a cron file shows intent, the process list shows what is live, the socket table shows who it talks to. The containment order (process, persistence, files, verify) is chosen so nothing comes back while you work. Hardening addresses how they got in, password logins from the internet, rather than symptoms like one port.",
    firstStep: "You start where things are scheduled because persistence is the attacker's foothold; finding the cron entry tells you what to look for in the process list and the connections.",
  },
  "devops-01-broken-pipeline": {
    plain:
      "A pipeline is a robot that runs the same steps on every code change: install, test, build, deploy. Each step is a command, and if any command fails the robot stops and turns the build red. Here the pipeline is red for two ordinary reasons: a test command points at a folder that was renamed, and a deploy script is not marked as runnable. You read the log, fix both, and run it again.",
    why:
      "Automation for building, testing and releasing is a named qualification for the role, and the daily reality of it is reading a red build and fixing the cause. Teams that leave pipelines red stop trusting them, and then bugs reach customers. Fixing the cause rather than deleting the failing step is the habit employers look for.",
    whyThisWay:
      "The log comes first because it names the failing step and prints what the command said; changing anything before reading it is guessing. Fixing the path in the configuration and the script's permission are both cause fixes, and re-running the pipeline is the only proof that counts. Deleting the step would make the build green and the product untested.",
    firstStep: "You start by reading the last run's log because it names the failing step and shows the exact error; every fix follows from that, and nothing else does.",
  },
  "devops-02-green-locally-red-in-ci": {
    plain:
      "CI runners are clean machines with their own clock, usually set to UTC, and none of your local files. A test that passes on your laptop and fails there depends on something that differs: the time zone, the order of files, the network. This mission has you find that dependency in a date test and fix the test so it is correct everywhere, instead of retrying the job or skipping the test.",
    why:
      "'Works on my machine' is the most common argument in real teams, and the role asks for experience with automated testing. Being the person who finds the environmental cause and fixes it properly ends the argument. Skipping or retrying teaches a team to ignore red builds, and then a real failure gets ignored too.",
    whyThisWay:
      "Retrying only helps when a failure is random, and a time-zone bug fails every time the dates differ. Skipping removes the only thing that would catch the bug. Making the test use the same clock the code uses (UTC) fixes the real defect, and the pipeline run afterwards proves it on the machine that was failing.",
    firstStep: "You start with the CI log because the assertion message shows the two dates that disagree, and the gap between them is the time zone pointing straight at the cause.",
  },
  "devops-03-bad-release-rollback": {
    plain:
      "A deploy puts a new version of the software live. Minutes later, errors spike. You do not yet know what the bug is, and you do not need to: if the timing lines up, the fastest safe move is to put the previous version back, called a rollback. Then you check the same measurement that showed the problem to confirm it is really gone, and write down what happened so the bug gets fixed properly.",
    why:
      "Release management interviews ask exactly this: how do you decide to roll back, and how do you know you recovered? Customers do not care why the error happened; they care how long it lasted. Restoring service first and debugging second is a professional habit, not a shortcut.",
    whyThisWay:
      "Correlating the error spike with the deploy time is what justifies rolling back without a diagnosis: evidence of the trigger plus a known-good version. Verifying with the error rate rather than 'the rollback finished' is deliberate, because a finished rollback that did not fix the errors means the deploy was not the cause. The incident note turns time bought into a real fix.",
    firstStep: "You start by correlating errors with the deploy time because that evidence is what makes a rollback the right call rather than a reflex; without it you might roll back a release that was not the cause.",
  },
  "devops-04-secret-wiring": {
    plain:
      "Pipelines need passwords and tokens to deploy, called secrets. They live in a vault, and the pipeline refers to them by name so the real value is only inserted at run time. Someone renamed a secret in the vault, so the pipeline now asks for a name that no longer exists and the deploy fails. The fix is to update the name. The trap is pasting the real token into the pipeline file to make it work.",
    why:
      "A secret pasted into a repository is in its history forever, visible to everyone who can read the repository or the logs. This is one of the most common and most damaging security mistakes made under deadline pressure, and handling it right is a strong Earn Trust story. The role's automation qualification includes knowing how pipelines handle credentials.",
    whyThisWay:
      "Reading the CI log first tells you which name is missing; the change log tells you about the rename; together they make the fix a one-line reference update you can defend. Keeping the value in the vault preserves access control, audit trails and easy rotation. Scoping the token to deploying only is least privilege applied to machines.",
    firstStep: "You start with the CI log because it names the exact secret the deploy step looked up and could not find, which points you at the rename rather than at the token itself.",
  },
  "go-01-config-parser": {
    plain:
      "Go is a second programming language, used for many services and tools. It is stricter than Python: every value has a declared type, and functions that can fail hand back an error value you must check, instead of throwing an exception you might forget about. This mission ports the Python configuration validator to Go, so you learn the new language on a problem you already understand.",
    why:
      "The posting lists Go among its accepted languages, and many infrastructure tools are written in it. Reading Go's error handling fluently is table stakes on such teams: you will see the value-and-error pattern in every function. Learning it on a familiar problem lets you focus on the language, not the task.",
    whyThisWay:
      "Returning an error as a second value, and checking it immediately, is Go's way of making failure visible at every call; it feels verbose, but it is why Go programs rarely crash on unexpected input. Using the standard library's string and conversion helpers instead of hand-rolled parsing keeps the code short and matches what you will read in real codebases.",
    firstStep: "You start with the loop over lines because the whole parser is 'for each line, skip or split', and getting that skeleton compiling teaches you Go's syntax before any logic.",
  },
  "go-02-worker-pool": {
    plain:
      "Imagine a queue of jobs and a few workers taking jobs from it. In Go, workers are goroutines, lightweight threads you start with one keyword, and the queue is a channel, a pipe that safely passes values between them. A WaitGroup is a counter that lets you wait until every worker has finished. The challenge is making sure every job is handled exactly once and nothing waits forever.",
    why:
      "This pattern is the code behind the dead-consumers incident and behind most high-throughput systems: many workers draining a shared queue. The posting's preferred qualification about concurrent, high-throughput systems is tested in interviews with exactly this kind of exercise. Understanding why channels prevent double-handling is the core idea.",
    whyThisWay:
      "Channels instead of shared lists with locks, because a channel delivers each value to exactly one receiver by construction, so exactly-once comes for free. Closing the jobs channel is how workers learn there is no more work. Buffering the results channel is chosen so a worker never blocks waiting for the main routine to read, which is the usual cause of deadlocks.",
    firstStep: "You start by creating the channels because every other piece, the workers, the sends and the WaitGroup, is defined by how data flows through them; getting the plumbing right prevents the deadlocks later.",
  },
  "go-03-timeouts-context": {
    plain:
      "When your program calls another service, that service might never answer. Without a deadline your program waits forever, and so does everyone waiting on it. Go uses a context to carry a deadline, and a select statement to wait on whichever happens first: the answer or the deadline. This mission makes a call give up after a set time and report the right error, without leaving a stuck background routine behind.",
    why:
      "Timeouts are the first thing reviewers look for in service code, because a single dependency that hangs can take down an entire system. Interviewers for distributed-systems roles ask how you bound a call and what you do with the work that is still running. This is the idiom you will use and read constantly.",
    whyThisWay:
      "A context rather than a bare timer, because the same context can be passed down through every call, so a deadline set at the top cancels everything below it. `select` on two channels is how Go expresses 'the first of these to happen'. Giving the result channel a buffer of one is deliberate: the late routine can finish and exit instead of being stuck forever.",
    firstStep: "You start by making the result channel buffered because a stuck goroutine is the subtle bug here, and designing the exit path first keeps the rest honest.",
  },
  "go-04-retries-idempotency": {
    plain:
      "Networks hiccup. A request that fails once often works a second later, so programs retry. But retrying blindly can hammer a struggling service, so each wait grows: one second, two, four. And some actions must not happen twice, like charging a card. An idempotency key is a label on the request so the receiver can recognise a repeat and skip it. This mission builds both pieces.",
    why:
      "Retries plus idempotency is the canonical resilience pattern; nearly every reliable distributed system is built on it, and it is a standard interview topic. Getting it wrong produces either outages made worse by retry storms or customers charged twice. Being able to explain and test the pattern is a strong signal for the role.",
    whyThisWay:
      "Exponential backoff rather than fixed waits, because doubling gives a struggling dependency room to recover. Injecting the sleep function is deliberate so tests can check the delays instead of waiting for them. Remembering the last error means the caller sees the real cause after retries run out, not a generic failure.",
    firstStep: "You start with the retry loop and a remembered last error because the structure 'try, wait longer, try again, report the last failure' is the skeleton everything else hangs on.",
  },
  "go-05-data-race": {
    plain:
      "Ten customers withdraw from one account at the same moment. Each one checks the balance, sees enough money, and takes it, so the account goes negative: a double spend. The problem is the gap between checking and acting, during which another withdrawal slipped in. The fix is a lock, called a mutex, that makes check-and-deduct one indivisible step. Go also ships a race detector that spots unprotected shared memory a test might miss.",
    why:
      "Races are the hardest bugs in concurrent code because they appear rarely and vanish when you look. Interviewers for high-throughput roles ask about critical sections and the race detector precisely because so many engineers cannot explain them. Knowing which bugs a test can see and which only the detector can see is what separates a strong answer.",
    whyThisWay:
      "A mutex held across both the check and the deduction, rather than around each separately, because the bug is the gap between them. Watching the balance go negative in the browser before fixing it is deliberate: you need to see the race to believe it. The optional race-detector service exists because the browser runs Go on one thread and cannot see the second kind of race.",
    firstStep: "You start by finding the gap between the check and the deduction because that is where every race lives; once you can point at it, the lock's boundaries are obvious.",
  },
  "incident-01-cache-stampede": {
    plain:
      "A cache is a fast memory that keeps recent answers so the database does not have to work them out again. If a deploy sets every cached answer to expire at the same instant, they all vanish together, every request goes to the database at once, and the database buckles. Users see a slow API, but the API is not the problem. This mission puts you in an incident console with live metrics and logs to find that out.",
    why:
      "Incidents are where operations engineers earn their keep, and cache stampedes after deploys are a classic. The lesson that matters is general: the component showing the symptom is often not the one causing it. Fixing symptoms, like adding API workers, burns time while the real cause keeps hurting.",
    whyThisWay:
      "Reading the ticket, metrics and logs before changing anything is deliberate: a hypothesis built on evidence beats a reflex. Following the pressure from the API to the cache hit ratio to database load is the path that reveals the cause. Re-warming the cache with staggered expiry times fixes it durably; anything else is a bandage, and the console rejects bandages on purpose.",
    firstStep: "You start by asking whether the slow component is actually the bottleneck because the API is where the pain shows, not where it comes from; the cache hit ratio answers that in one glance.",
  },
  "incident-02-traffic-surge": {
    plain:
      "Traffic quadruples. Each API worker can handle about sixty requests a second, and when workers are near full, requests queue and then get rejected. Behind the API, each request also creates background jobs that consumers must drain. This mission is arithmetic under pressure: how many workers and consumers does this load need, and how do you prove the system recovered without turning legitimate customers away?",
    why:
      "Capacity incidents are solved with measurement and arithmetic, then verified, and interviewers ask exactly that: how did you size it, and how did you know it worked? Shedding real customer traffic to hide a capacity gap is a common bad reflex, and knowing when adding capacity is the right lever is a core skill for the role.",
    whyThisWay:
      "Working out load as requests divided by workers times sixty gives you a number, not a feeling, and the same arithmetic applies to the queue. Adding workers rather than rate limiting is chosen because the traffic is legitimate and the tier is stateless, so more copies simply work. Checking every tier is deliberate: surges rarely hit only one.",
    firstStep: "You start by computing the load figure because it turns 'everything is slow' into 'this tier is at 130 percent', which tells you both what to fix and by how much.",
  },
  "incident-03-dead-consumers": {
    plain:
      "A queue is a waiting line for background jobs. Producers add jobs, consumers take them off and do the work. If the consumers die, the line grows silently while the API keeps answering normally, so nobody notices until the backlog is huge. This mission has you read the logs to learn what killed the consumers, bring enough back to drain the backlog, and propose the alert that would have caught it.",
    why:
      "Silent failures are the most dangerous kind: everything looks green while work piles up. Queues are everywhere in real systems, and knowing to watch queue depth and consumer count, not just the API, is a lesson that transfers to every job. It is also a typical interview question about observability.",
    whyThisWay:
      "Logs first, because consumers do not vanish without a reason, and restarting them without knowing why means they die again. Sizing the recovery with drain-rate arithmetic (depth divided by consumers times rate, minus production) tells you how long recovery takes and whether you added enough. The prevention step is required because an incident without one repeats.",
    firstStep: "You start by asking why nothing is draining because the first log lines explain where the consumers went, and that reason decides whether simply restarting them is safe.",
  },
  "incident-04-replica-lag": {
    plain:
      "Writes go to a main database called the primary, and a copy called a read replica replays them a moment later so reads can be spread out. If something blocks the replica from replaying, its data gets older by one second every second. Writes succeed, the API is fast, yet the map shows positions from a minute ago. That is staleness: a correctness problem that no error counter will show you.",
    why:
      "Replication lag and stale reads are standard distributed-systems interview topics, and they are a daily reality in any system with replicas. The dangerous reflex is to fail over to the replica, which permanently loses the writes it never received. Knowing to remove the cause instead is what protects data.",
    whyThisWay:
      "Looking at the lag metric and the replica logs rather than error rates is deliberate: green dashboards are the symptom here. Killing the blocking statement removes the cause and lets the replica catch up. Pinning reads to the primary only hides staleness while loading the primary, so it is allowed as a mitigation but not accepted as the fix.",
    firstStep: "You start by looking at the replica lag figure because every usual signal is green; lag is the one number that shows the problem, and its trend tells you whether your fix worked.",
  },
  "serverless-01-throttled-function": {
    plain:
      "A function platform runs your code on demand and scales by starting more copies, called environments. There is a cap on how many can run at once, the concurrency limit. If traffic needs more than the cap, the extra requests are rejected, which is throttling. Starting a new environment also takes time, a cold start. This mission has you size the limit from traffic and duration, and weigh pre-warming against cost.",
    why:
      "The serverless posting asks about building with managed function platforms, and rate times duration is the one formula every capacity conversation about them comes back to. Separating throttling, a limit problem, from cold starts, a warm-up problem, is what makes an answer sound like experience rather than reading.",
    whyThisWay:
      "Checking the function's own statistics before touching workers or the database is deliberate, because those tiers are healthy and changing them wastes time. Raising the limit to what 300 invocations a second times 120 milliseconds needs fixes the rejections; provisioned concurrency is offered as a tradeoff, because it removes cold starts at a standing cost that must be justified.",
    firstStep: "You start by comparing needed concurrency with the limit because that single comparison proves which tier is rejecting, and it gives you the number the fix must reach.",
  },
  "serverless-02-poison-messages": {
    plain:
      "A poison message is one that fails every time it is processed, usually because its contents are malformed. Without a safety valve the platform puts it back in the queue after every failure, so it is retried forever and eats a processing slot each time. Sixty of them can consume all your consumers while good messages wait. A dead-letter queue moves a message aside after a few failures so you can inspect it later.",
    why:
      "Retry semantics and dead-letter queues come up in nearly every event-driven design interview, and in real systems the capacity reasoning, that each retry costs a slot, is what makes the answer concrete. Adding consumers to outrun poison is a common wrong fix: it just burns more capacity on the same bad messages.",
    whyThisWay:
      "Finding the messages with high receive counts in the logs identifies the cause rather than the symptom. A receive count around three is chosen deliberately: one would send every transient hiccup to the dead-letter queue, and no limit lets poison run forever. Then capacity drains the backlog, and an alert on dead-letter depth turns rejected data into a signal.",
    firstStep: "You start by looking at the receive counts because a message received twenty times is the fingerprint of poison, and that evidence tells you a dead-letter queue, not more consumers, is the fix.",
  },
  "serverless-03-duplicate-charges": {
    plain:
      "A function records a charge, then runs out of time before it can report success. The platform assumes it failed and runs it again, so the customer is charged twice. Turning retries off stops the duplicates but loses every event that times out. The real fix is to make the handler idempotent: safe to run twice. It remembers which events it already handled by a key, and on a repeat returns the stored result.",
    why:
      "At-least-once delivery plus idempotent handlers is the pattern behind every reliable event-driven system, and this incident is the interview story for it. Engineers who disable retries to stop duplicates trade a visible problem for silent data loss, and knowing why that is worse is a sign of real understanding.",
    whyThisWay:
      "Connecting the timeouts, the retries and the duplicate charges in the logs is what turns a hunch into a diagnosis. Keeping retries while making the handler idempotent is chosen because retries are what guarantee no event is lost. Raising the timeout budget reduces how often this happens, so it is a good complement, but it never makes a non-idempotent handler safe.",
    firstStep: "You start by following the retries in the logs because the sequence 'timed out, retried, charged twice' is the mechanism, and seeing it rules out blaming the payment service.",
  },
  "serverless-04-idempotent-handler": {
    plain:
      "This mission writes, in Python, the fix from the duplicate-charges incident. The handler first validates the incoming event, then checks a table of events it has already handled, then performs the charge once and records it, and on a repeat returns the stored result instead of charging again. A batch processor runs many events and counts how many were charged, duplicated or rejected, without ever crashing.",
    why:
      "Having actually written and tested an idempotent handler lets you answer design questions with specifics instead of vocabulary. The order of operations, check then act then record, is the part people get wrong, and getting it right in code is how it sticks.",
    whyThisWay:
      "Validating before touching money is deliberate: a malformed event must be rejected cleanly, not half-processed. Checking the table before the side effect is the whole point of idempotency. Counting rejected events instead of raising in the batch is chosen because one poison event must not stop the other 999.",
    firstStep: "You start with validation because every later step assumes the event has the right shape and a positive amount; rejecting bad events first keeps the money-touching code simple.",
  },
  "design-01-position-ingest": {
    plain:
      "A design exercise is the interview's whiteboard round: here are the requirements, with numbers; now choose components and defend the choice. You pick how events get in, where they wait, where they are stored and how the map reads them, then size the pieces with arithmetic and predict what happens when something fails. A rubric computes cost, capacity, latency and single points of failure from your own choices.",
    why:
      "The serverless posting requires designing or architecting systems for reliability and scaling, and this is the shape of the system-design interview for any senior role. Candidates who can say the capacity arithmetic out loud and reason about failure from their own drawing stand out from those who only name products.",
    whyThisWay:
      "Requirements first, components second, because a component that is better on a dimension nobody asked for is just more expensive. Capacity arithmetic (events per second times duration) is required because it shows you have run systems. The failure drills reason from your design rather than a textbook, so the right answer changes with your choices.",
    firstStep: "You start by eliminating components that violate a hard requirement because that shrinks the choice from dozens of combinations to a few, and the budget arithmetic then decides among them.",
  },
  "design-02-command-ack": {
    plain:
      "The first design exercise moved vehicle positions, where a few seconds of staleness was fine. This one moves commands from a dispatcher to a vehicle and the vehicle's confirmation back, and here stale is dangerous: a dispatcher who sees a command flip back from acknowledged to pending will send it again. You choose the components once more, but with two new requirements: every status read must be current, and a retried request must never send a command twice.",
    why:
      "Interviewers love to ask the same design question twice with one requirement changed, because it shows whether you reason from requirements or from habit. The serverless posting asks for designing systems for reliability, and in real work the cache that saved you last month is the bug that double-sends a command this month.",
    whyThisWay:
      "Starting from the two hard requirements, strong consistency and no single point of failure on either path, is deliberate: they eliminate most options before cost enters, and the budget then forces the last choice. Idempotency is a component slot rather than a note because where duplicate prevention lives decides whether it works: a disabled button cannot see a network retry.",
    firstStep: "You start by eliminating every option marked eventual or SPOF because the consistency and availability requirements are hard, and what survives them is a short list the budget can settle.",
  },
  "agile-01-scrum-for-engineers": {
    plain:
      "Scrum is a way teams organise work into short fixed cycles called sprints, usually two weeks. Each sprint has a planning meeting, a short daily check-in, a review where the team shows what it built, and a retrospective about how the work went. Three roles share responsibility and three artifacts track the work. This lesson explains the loop and how unplanned operational work, like incidents, fits in without wrecking it.",
    why:
      "The posting lists Agile experience with Scrum as a preferred qualification, and nearly every engineering team uses some version of it. A lesson cannot give you the experience, but it gives you precise vocabulary to describe the experience you do have, and the interview question 'tell me about working in an Agile team' is almost guaranteed.",
    whyThisWay:
      "Learning the events in order first, then the roles and artifacts, matches how a sprint actually unfolds, so the structure sticks. The failure modes are included because interviewers probe for them: a daily scrum that became a status report, work carried over every sprint. The STAR cue at the end exists so the knowledge turns into a story you can tell.",
    firstStep: "You start with the events in order because the sprint is a loop, and everything else, roles and artifacts, only makes sense as what happens inside that loop.",
  },
};
