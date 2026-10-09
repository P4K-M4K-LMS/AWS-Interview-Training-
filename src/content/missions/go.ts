import type { CodeMission } from "../../domain/types";

/**
 * Go missions. They run in the Yaegi interpreter compiled to WebAssembly:
 * real Go semantics for goroutines, channels, select, sync and context, in a
 * single-threaded runtime: goroutines switch only at blocking points, so
 * check-then-act races around a blocking call reproduce, bare counter races
 * do not (the optional local race-detector service covers those).
 */
const COMPANY_INTRO = "Nimbus Freight (fictional) runs a small fleet-tracking platform. The team is adding Go services next to the Python tooling.";

const GO_ERROR_HELP: CodeMission["errorHelp"] = [
  { match: /undefined:/, explanation: "Go requires every name to be declared before use and names are case-sensitive. Check spelling; exported names from packages start with a capital letter (fmt.Println, strings.Split)." },
  { match: /declared and not used/, explanation: "Go refuses to compile unused variables. Remove it or use the blank identifier: _ = value." },
  { match: /imported and not used/, explanation: "Every import must be used. Remove the import or use the package." },
  { match: /cannot use|mismatched types|invalid operation/, explanation: "Go never converts types implicitly. Convert explicitly, e.g. float64(n), strconv.Itoa(n) or strconv.Atoi(s), and keep both sides of an operation the same type." },
  { match: /missing return/, explanation: "Every path through a function with return values must return. Add a return at the end (or in the else branch)." },
  { match: /expected|unexpected|syntax/, explanation: "Common causes: a missing brace, an opening brace on its own line (Go requires it on the same line as if/for/func), or a missing import." },
  { match: /deadlock/, explanation: "Every goroutine is blocked: usually a channel send with no receiver, a receive with no sender, or a WaitGroup that is never Done. Close channels when producers finish and pair every Add with a Done." },
  { match: /index out of range/, explanation: "You indexed past the end of a slice. Check len(s) or range over the slice." },
  { match: /nil pointer|nil map/, explanation: "You used a nil pointer or wrote to a nil map. Initialise maps with make(map[K]V) and check pointers before use." },
  { match: /panic/, explanation: "A test or your code panicked. Read the message: tests panic with the value they got and the value they wanted." },
];

const SHARED_GLOSSARY = [
  { term: "goroutine", definition: "A lightweight thread managed by the Go runtime; start one with the go keyword." },
  { term: "channel", definition: "A typed pipe for passing values between goroutines; sends block until a receiver is ready (or the buffer has room)." },
  { term: "error value", definition: "Go reports failures by returning an error as the last result instead of throwing an exception." },
];

export const goMissions: CodeMission[] = [
  {
    id: "go-01-config-parser",
    kind: "go",
    trackId: "distributed",
    stage: 4,
    title: "Go for a Python engineer: a config parser with real error values",
    summary: "Types, slices, maps, multiple return values and errors: port the Python config validator to Go.",
    briefing: `${COMPANY_INTRO}\n\nThe fleet API's config loader is being rewritten in Go. Port the Python validator you wrote earlier: parse KEY=VALUE lines into a map, skip blank lines and comments, and return clear errors instead of panicking when the file is malformed or the port is invalid.`,
    objectives: [
      "parseConfig(text) returns map[string]string and an error for malformed lines",
      "Blank lines and lines starting with # are skipped",
      "mustGetPort(cfg) converts the port with strconv and validates the 1-65535 range, returning errors with the bad value",
    ],
    skills: ["python.basics", "distributed.architecture"],
    prerequisites: ["python-03-config-validator"],
    estimatedMinutes: 25,
    lesson: [
      { title: "Go is explicit where Python is implicit", body: "Every variable has a static type; `:=` infers it from the right-hand side. Functions can return several values, and the Go convention for failure is to return an `error` as the last value: `value, err := f()` then `if err != nil { return ..., err }`. There are no exceptions for ordinary failures." },
      { title: "Strings, slices and maps", body: "`strings.Split(text, \"\\n\")` gives a `[]string` (a slice). `strings.TrimSpace`, `strings.HasPrefix` and `strings.Cut(line, \"=\")` cover most parsing. Maps are created with `make(map[string]string)` and read with `v, ok := m[key]` so you can tell a missing key from an empty value. `strconv.Atoi` converts text to int and returns an error for junk." },
      { title: "Building errors", body: "`fmt.Errorf(\"port must be a whole number, got %q\", raw)` creates an error with a formatted message; `%q` quotes the value, `%d` formats an int. `errors.New(\"port is required\")` for fixed messages." },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "slice", definition: "A dynamically-sized view over an array; Go's list type." }, { term: "map", definition: "Go's hash table: map[KeyType]ValueType, created with make." }],
    hints: [
      { level: 1, title: "Start with the loop", body: "`for _, line := range strings.Split(text, \"\\n\")`, then `line = strings.TrimSpace(line)`; `continue` on empty lines and lines with `strings.HasPrefix(line, \"#\")`." },
      { level: 2, title: "Split once", body: "`key, value, ok := strings.Cut(line, \"=\")`. If `!ok`, return `nil, fmt.Errorf(\"malformed line %q\", line)`. Trim both parts before storing." },
      { level: 3, title: "Port validation", body: "`raw, ok := cfg[\"port\"]`; missing → `errors.New(\"port is required\")`. `port, err := strconv.Atoi(raw)`; on error return `fmt.Errorf(\"port must be a whole number, got %q\", raw)`. Then check `port < 1 || port > 65535`." },
      { level: 4, title: "Guided example", body: "```\nfunc parseConfig(text string) (map[string]string, error) {\n\tcfg := make(map[string]string)\n\tfor _, line := range strings.Split(text, \"\\n\") {\n\t\tline = strings.TrimSpace(line)\n\t\tif line == \"\" || strings.HasPrefix(line, \"#\") {\n\t\t\tcontinue\n\t\t}\n\t\tkey, value, ok := strings.Cut(line, \"=\")\n\t\tif !ok {\n\t\t\treturn nil, fmt.Errorf(\"malformed line %q\", line)\n\t\t}\n\t\tcfg[strings.TrimSpace(key)] = strings.TrimSpace(value)\n\t}\n\treturn cfg, nil\n}\n```" },
    ],
    reflectionPrompts: ["Compare how you handled bad input in Python (exceptions) and in Go (error values). Which made the failure paths easier to see, and why?"],
    transferNote: "Reading Go error handling fluently is table stakes for any team running Go services; this is the pattern you will see in every function.",
    starterCode: `package main

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// parseConfig turns KEY=VALUE lines into a map. Blank lines and # comments are
// skipped. A line without '=' is an error.
func parseConfig(text string) (map[string]string, error) {
	cfg := make(map[string]string)
	// TODO: loop over the lines
	_ = strings.TrimSpace
	return cfg, nil
}

// mustGetPort returns the port as an int, or an error naming the problem:
// missing, not a whole number, or outside 1-65535.
func mustGetPort(cfg map[string]string) (int, error) {
	// TODO
	_ = errors.New
	_ = strconv.Atoi
	return 0, nil
}

func main() {
	cfg, err := parseConfig("port=8080\\nworkers=4")
	fmt.Println(cfg, err)
	port, err := mustGetPort(cfg)
	fmt.Println(port, err)
}
`,
    referenceSolution: `package main

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

func parseConfig(text string) (map[string]string, error) {
	cfg := make(map[string]string)
	for _, line := range strings.Split(text, "\\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return nil, fmt.Errorf("malformed line %q", line)
		}
		cfg[strings.TrimSpace(key)] = strings.TrimSpace(value)
	}
	return cfg, nil
}

func mustGetPort(cfg map[string]string) (int, error) {
	raw, ok := cfg["port"]
	if !ok {
		return 0, errors.New("port is required")
	}
	port, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("port must be a whole number, got %q", raw)
	}
	if port < 1 || port > 65535 {
		return 0, fmt.Errorf("port must be between 1 and 65535, got %d", port)
	}
	return port, nil
}

func main() {
	cfg, err := parseConfig("port=8080\\nworkers=4")
	fmt.Println(cfg, err)
	port, err := mustGetPort(cfg)
	fmt.Println(port, err)
}
`,
    tests: [
      { id: "t1", label: "parseConfig skips comments and blanks", code: `cfg, err := parseConfig("# c\\n\\nport=80\\nname = api\\n")\nif err != nil { panic(err) }\nif cfg["port"] != "80" || cfg["name"] != "api" || len(cfg) != 2 { panic(fmt.Sprintf("got %v", cfg)) }` },
      { id: "t2", label: "parseConfig returns an error for a malformed line", code: `if _, err := parseConfig("port=80\\njunk\\n"); err == nil { panic("expected an error for a line without '='") }` },
      { id: "t3", label: "mustGetPort returns the int port", code: `p, err := mustGetPort(map[string]string{"port": "8080"})\nif err != nil || p != 8080 { panic(fmt.Sprintf("got %d, %v", p, err)) }` },
      { id: "t4", label: "mustGetPort errors when port is missing", code: `if _, err := mustGetPort(map[string]string{}); err == nil { panic("expected error for missing port") }` },
      { id: "t5", label: "mustGetPort names a non-numeric value", code: `_, err := mustGetPort(map[string]string{"port": "eighty"})\nif err == nil || !strings.Contains(err.Error(), "eighty") { panic(fmt.Sprintf("got %v", err)) }` },
      { id: "t6", label: "mustGetPort rejects 0 and 65536", code: `_, errLow := mustGetPort(map[string]string{"port": "0"})\n_, errHigh := mustGetPort(map[string]string{"port": "65536"})\nif errLow == nil { panic("expected range error for 0") }\nif errHigh == nil { panic("expected range error for 65536") }` },
    ],
    errorHelp: GO_ERROR_HELP,
  },
  {
    id: "go-02-worker-pool",
    kind: "go",
    trackId: "distributed",
    stage: 5,
    title: "A worker pool: goroutines, channels and WaitGroups",
    summary: "Drain a queue of jobs with N concurrent workers and collect every result exactly once.",
    briefing: `${COMPANY_INTRO}\n\nAfter the dead-consumers incident, the team wants a simple, correct worker pool for the billing queue. Implement processJobs so N workers pull jobs from a channel, process them concurrently, and every result is collected exactly once with no deadlock.`,
    objectives: [
      "Start exactly `workers` goroutines that range over a jobs channel",
      "Use a sync.WaitGroup to know when all workers have finished",
      "Collect one result per job and return them sorted ascending",
      "Handle zero jobs and more workers than jobs without deadlocking",
    ],
    skills: ["distributed.concurrency", "distributed.queues"],
    prerequisites: ["go-01-config-parser"],
    estimatedMinutes: 25,
    lesson: [
      { title: "The shape of a worker pool", body: "Make a `jobs` channel and a `results` channel. Start `workers` goroutines, each doing `for j := range jobs { results <- process(j) }`. Send every job, then `close(jobs)` so the range loops end. Wait for the workers with a `sync.WaitGroup` (Add before starting each, `defer wg.Done()` inside), then `close(results)` and drain it." },
      { title: "Why deadlocks happen", body: "A send on an unbuffered channel blocks until someone receives. If the main goroutine sends all results before anyone reads them, or waits on the WaitGroup while workers are blocked sending into a full channel, everything stops. Give `results` a buffer of `len(jobs)`, or drain in a separate goroutine." },
      { title: "Exactly once", body: "Each job is received by exactly one worker because a channel delivers each value once. Closing the channel is how you tell the workers 'no more jobs'; never close it from a worker." },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "WaitGroup", definition: "A counter you Add to before starting goroutines and Done from inside them; Wait blocks until it reaches zero." }, { term: "buffered channel", definition: "A channel with capacity: sends only block when the buffer is full." }],
    hints: [
      { level: 1, title: "Channels first", body: "`jobs := make(chan int)` and `results := make(chan int, len(jobs))` (buffered so workers never block on send)." },
      { level: 2, title: "Workers", body: "`for w := 0; w < workers; w++ { wg.Add(1); go func() { defer wg.Done(); for j := range jobs { results <- j * j } }() }`." },
      { level: 3, title: "Feed, close, wait, drain", body: "Send all jobs, `close(jobs)`, `wg.Wait()`, `close(results)`, then `for r := range results { out = append(out, r) }` and `sort.Ints(out)`." },
      { level: 4, title: "Guided example", body: "```\nfunc processJobs(jobs []int, workers int) []int {\n\tif workers < 1 {\n\t\tworkers = 1\n\t}\n\tin := make(chan int)\n\tout := make(chan int, len(jobs))\n\tvar wg sync.WaitGroup\n\tfor w := 0; w < workers; w++ {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tfor j := range in {\n\t\t\t\tout <- process(j)\n\t\t\t}\n\t\t}()\n\t}\n\tfor _, j := range jobs {\n\t\tin <- j\n\t}\n\tclose(in)\n\twg.Wait()\n\tclose(out)\n\tresults := make([]int, 0, len(jobs))\n\tfor r := range out {\n\t\tresults = append(results, r)\n\t}\n\tsort.Ints(results)\n\treturn results\n}\n```" },
    ],
    reflectionPrompts: ["Explain how your pool guarantees each job is processed exactly once and how you avoided deadlock. What would you monitor in production?"],
    transferNote: "This is the consumer side of the dead-consumers incident, in code. Interviewers for high-throughput roles ask for exactly this pattern.",
    starterCode: `package main

import (
	"fmt"
	"sort"
	"sync"
)

// process simulates work on one job.
func process(job int) int {
	return job * job
}

// processJobs runs process over every job using 'workers' concurrent goroutines
// and returns all results sorted ascending. It must not deadlock, even with
// zero jobs or more workers than jobs.
func processJobs(jobs []int, workers int) []int {
	results := make([]int, 0, len(jobs))
	// TODO: channels + goroutines + WaitGroup
	_ = sync.WaitGroup{}
	sort.Ints(results)
	return results
}

func main() {
	fmt.Println(processJobs([]int{1, 2, 3, 4, 5}, 3))
}
`,
    referenceSolution: `package main

import (
	"fmt"
	"sort"
	"sync"
)

func process(job int) int {
	return job * job
}

func processJobs(jobs []int, workers int) []int {
	if workers < 1 {
		workers = 1
	}
	in := make(chan int)
	out := make(chan int, len(jobs))
	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range in {
				out <- process(j)
			}
		}()
	}
	for _, j := range jobs {
		in <- j
	}
	close(in)
	wg.Wait()
	close(out)
	results := make([]int, 0, len(jobs))
	for r := range out {
		results = append(results, r)
	}
	sort.Ints(results)
	return results
}

func main() {
	fmt.Println(processJobs([]int{1, 2, 3, 4, 5}, 3))
}
`,
    tests: [
      { id: "t1", label: "every job is processed exactly once (sorted results)", code: `got := processJobs([]int{3, 1, 2, 5, 4}, 3)\nwant := []int{1, 4, 9, 16, 25}\nif fmt.Sprint(got) != fmt.Sprint(want) { panic(fmt.Sprintf("got %v, want %v", got, want)) }` },
      { id: "t2", label: "zero jobs returns an empty slice without deadlock", code: `if got := processJobs([]int{}, 4); len(got) != 0 { panic(fmt.Sprintf("got %v", got)) }` },
      { id: "t3", label: "more workers than jobs still works", code: `if got := processJobs([]int{7}, 8); fmt.Sprint(got) != "[49]" { panic(fmt.Sprintf("got %v", got)) }` },
      { id: "t4", label: "1,000 jobs with 8 workers complete", code: `jobs := make([]int, 1000)\nfor i := range jobs { jobs[i] = i }\ngot := processJobs(jobs, 8)\nif len(got) != 1000 || got[999] != 999*999 || got[0] != 0 { panic(fmt.Sprintf("len %d, first %d, last %d", len(got), got[0], got[len(got)-1])) }` },
    ],
    errorHelp: GO_ERROR_HELP,
  },
  {
    id: "go-03-timeouts-context",
    kind: "go",
    trackId: "distributed",
    stage: 5,
    title: "Timeouts and cancellation with context and select",
    summary: "Never wait forever on a dependency: bound a call with a deadline and report the right error.",
    briefing: `${COMPANY_INTRO}\n\nThe positions API sometimes waits forever on a slow downstream call, pinning workers until the whole service stalls. Implement callWithTimeout so a slow dependency returns a clear deadline error quickly, while a fast one returns its value unchanged.`,
    objectives: [
      "Run the work in a goroutine and wait on either its result or the context's Done channel with select",
      "Return ctx.Err() (context.DeadlineExceeded) when the deadline passes first",
      "Return the value when the work finishes in time",
      "Do not leak: use a buffered result channel so the late goroutine can still finish",
    ],
    skills: ["distributed.resilience", "distributed.concurrency"],
    prerequisites: ["go-02-worker-pool"],
    estimatedMinutes: 20,
    lesson: [
      { title: "context carries deadlines", body: "`ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)`; always `defer cancel()`. `ctx.Done()` is a channel that closes when the deadline passes or cancel is called; `ctx.Err()` then tells you why (`context.DeadlineExceeded` or `context.Canceled`)." },
      { title: "select races two channels", body: "```\nselect {\ncase v := <-result:\n\treturn v, nil\ncase <-ctx.Done():\n\treturn 0, ctx.Err()\n}\n```\nWhichever is ready first wins. This is how Go code waits on 'the answer or the deadline'." },
      { title: "Do not leak goroutines", body: "If the deadline wins, the worker goroutine is still running. Give the result channel a buffer of 1 so its eventual send does not block forever. In real services you also pass ctx into the work so it can stop early." },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "context", definition: "Go's standard way to carry deadlines, cancellation and request-scoped values through a call chain." }, { term: "select", definition: "Waits on several channel operations and runs whichever is ready first." }],
    hints: [
      { level: 1, title: "Buffered result", body: "`result := make(chan int, 1)` then `go func() { result <- work() }()`." },
      { level: 2, title: "Race them", body: "A `select` with one case receiving from `result` and one receiving from `ctx.Done()`." },
      { level: 3, title: "Return the right error", body: "In the Done case return `0, ctx.Err()`; the tests check it equals `context.DeadlineExceeded` and that you returned quickly (well under the work's duration)." },
      { level: 4, title: "Guided example", body: "```\nfunc callWithTimeout(ctx context.Context, work func() int) (int, error) {\n\tresult := make(chan int, 1)\n\tgo func() { result <- work() }()\n\tselect {\n\tcase v := <-result:\n\t\treturn v, nil\n\tcase <-ctx.Done():\n\t\treturn 0, ctx.Err()\n\t}\n}\n```" },
    ],
    reflectionPrompts: ["Explain why unbounded waits on dependencies take down whole services, and how you verified your timeout returns the right error quickly."],
    transferNote: "Timeouts, deadlines and cancellation are the first thing reviewers look for in service code; this is the idiom.",
    starterCode: `package main

import (
	"context"
	"fmt"
	"time"
)

// callWithTimeout runs work and returns its value, unless ctx finishes first,
// in which case it returns ctx.Err() promptly.
func callWithTimeout(ctx context.Context, work func() int) (int, error) {
	// TODO: run work in a goroutine and select on result vs ctx.Done()
	return work(), nil
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	v, err := callWithTimeout(ctx, func() int { time.Sleep(10 * time.Millisecond); return 42 })
	fmt.Println(v, err)
}
`,
    referenceSolution: `package main

import (
	"context"
	"fmt"
	"time"
)

func callWithTimeout(ctx context.Context, work func() int) (int, error) {
	result := make(chan int, 1)
	go func() { result <- work() }()
	select {
	case v := <-result:
		return v, nil
	case <-ctx.Done():
		return 0, ctx.Err()
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	v, err := callWithTimeout(ctx, func() int { time.Sleep(10 * time.Millisecond); return 42 })
	fmt.Println(v, err)
}
`,
    tests: [
      { id: "t1", label: "fast work returns its value", code: `ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)\ndefer cancel()\nv, err := callWithTimeout(ctx, func() int { return 7 })\nif err != nil || v != 7 { panic(fmt.Sprintf("got %d, %v", v, err)) }` },
      { id: "t2", label: "slow work returns context.DeadlineExceeded promptly", code: `ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)\ndefer cancel()\nstart := time.Now()\n_, err := callWithTimeout(ctx, func() int { time.Sleep(400 * time.Millisecond); return 1 })\nelapsed := time.Since(start)\nif err != context.DeadlineExceeded { panic(fmt.Sprintf("got err %v, want DeadlineExceeded", err)) }\nif elapsed > 250*time.Millisecond { panic(fmt.Sprintf("took %v; the deadline should have returned first", elapsed)) }` },
      { id: "t3", label: "an already-cancelled context returns context.Canceled", code: `ctx, cancel := context.WithCancel(context.Background())\ncancel()\n_, err := callWithTimeout(ctx, func() int { time.Sleep(200 * time.Millisecond); return 1 })\nif err != context.Canceled { panic(fmt.Sprintf("got %v", err)) }` },
    ],
    errorHelp: GO_ERROR_HELP,
  },
  {
    id: "go-04-retries-idempotency",
    kind: "go",
    trackId: "distributed",
    stage: 6,
    title: "Retries with backoff, and idempotency keys so retries are safe",
    summary: "Retry transient failures with exponential backoff, and make the operation safe to repeat.",
    briefing: `${COMPANY_INTRO}\n\nBilling calls the payment provider, which fails transiently a few percent of the time. A naive retry double-charged a customer last month. Implement retry with exponential backoff, and an idempotent charge that performs each charge at most once per key, so retries become safe.`,
    objectives: [
      "retry calls op up to attempts times, sleeping base, 2*base, 4*base... between attempts via the injected sleep function",
      "retry returns nil on the first success and the last error after the final failure",
      "chargeOnce performs the charge at most once per idempotency key, returning whether it ran",
    ],
    skills: ["distributed.resilience", "distributed.queues"],
    prerequisites: ["go-03-timeouts-context"],
    estimatedMinutes: 25,
    lesson: [
      { title: "Retry only what is safe to retry", body: "Transient errors (timeouts, 503s) deserve a retry; a retry storm against a struggling dependency makes things worse, so wait longer each time: exponential backoff (base, 2×, 4×...). Injecting the sleep function keeps the code testable: tests capture the delays instead of waiting." },
      { title: "Idempotency makes retries safe", body: "If a request can be applied twice, retrying it is dangerous. An idempotency key (for example the invoice id) lets the receiver remember which requests it already applied and skip duplicates. A map from key to done is the simplest store; real systems persist it." },
      { title: "Returning the last error", body: "Keep the most recent error in a variable inside the loop; when attempts run out, return it so callers see the real cause, not a generic 'failed'." },
    ],
    glossary: [...SHARED_GLOSSARY, { term: "exponential backoff", definition: "Waiting progressively longer between retries (base, 2×base, 4×base...)." }, { term: "idempotent", definition: "An operation that has the same effect whether applied once or many times." }],
    hints: [
      { level: 1, title: "Loop with a remembered error", body: "`var last error; for i := 0; i < attempts; i++ { if err := op(); err == nil { return nil } else { last = err }; ... }`." },
      { level: 2, title: "Backoff between attempts only", body: "Sleep after a failure only if another attempt follows: `if i < attempts-1 { sleep(base << i) }` (base<<i doubles each time)." },
      { level: 3, title: "Charge once", body: "`if done[key] { return false }; charge(); done[key] = true; return true`." },
      { level: 4, title: "Guided example", body: "```\nfunc retry(attempts int, base time.Duration, sleep func(time.Duration), op func() error) error {\n\tvar last error\n\tfor i := 0; i < attempts; i++ {\n\t\tif err := op(); err == nil {\n\t\t\treturn nil\n\t\t} else {\n\t\t\tlast = err\n\t\t}\n\t\tif i < attempts-1 {\n\t\t\tsleep(base << i)\n\t\t}\n\t}\n\treturn last\n}\n\nfunc chargeOnce(done map[string]bool, key string, charge func()) bool {\n\tif done[key] {\n\t\treturn false\n\t}\n\tcharge()\n\tdone[key] = true\n\treturn true\n}\n```" },
    ],
    reflectionPrompts: ["Describe the double-charge failure mode, how idempotency keys prevent it, and how you tested the backoff schedule without sleeping in tests."],
    transferNote: "Retries plus idempotency is the canonical resilience pattern; being able to explain and test it is a strong distributed-systems interview answer.",
    starterCode: `package main

import (
	"errors"
	"fmt"
	"time"
)

// retry calls op up to 'attempts' times. Between attempts it waits
// base, 2*base, 4*base, ... using the provided sleep function.
// It returns nil on the first success, or the last error.
func retry(attempts int, base time.Duration, sleep func(time.Duration), op func() error) error {
	// TODO
	return op()
}

// chargeOnce performs charge() at most once per idempotency key, recording
// completed keys in done. It returns true if the charge ran.
func chargeOnce(done map[string]bool, key string, charge func()) bool {
	// TODO
	charge()
	return true
}

func main() {
	calls := 0
	err := retry(3, 10*time.Millisecond, time.Sleep, func() error {
		calls++
		if calls < 3 {
			return errors.New("transient failure")
		}
		return nil
	})
	fmt.Println("calls:", calls, "err:", err)
}
`,
    referenceSolution: `package main

import (
	"errors"
	"fmt"
	"time"
)

func retry(attempts int, base time.Duration, sleep func(time.Duration), op func() error) error {
	var last error
	for i := 0; i < attempts; i++ {
		if err := op(); err == nil {
			return nil
		} else {
			last = err
		}
		if i < attempts-1 {
			sleep(base << i)
		}
	}
	return last
}

func chargeOnce(done map[string]bool, key string, charge func()) bool {
	if done[key] {
		return false
	}
	charge()
	done[key] = true
	return true
}

func main() {
	calls := 0
	err := retry(3, 10*time.Millisecond, time.Sleep, func() error {
		calls++
		if calls < 3 {
			return errors.New("transient failure")
		}
		return nil
	})
	fmt.Println("calls:", calls, "err:", err)
}
`,
    tests: [
      { id: "t1", label: "succeeds on the third attempt with backoff 10ms, 20ms", code: `calls := 0\nvar waits []time.Duration\nerr := retry(5, 10*time.Millisecond, func(d time.Duration) { waits = append(waits, d) }, func() error { calls++; if calls < 3 { return errors.New("transient") }; return nil })\nif err != nil || calls != 3 { panic(fmt.Sprintf("err %v, calls %d", err, calls)) }\nif fmt.Sprint(waits) != fmt.Sprint([]time.Duration{10 * time.Millisecond, 20 * time.Millisecond}) { panic(fmt.Sprintf("waits %v", waits)) }` },
      { id: "t2", label: "returns the last error after exhausting attempts (no sleep after the last)", code: `calls := 0\nsleeps := 0\nerr := retry(4, time.Millisecond, func(time.Duration) { sleeps++ }, func() error { calls++; return fmt.Errorf("fail %d", calls) })\nif err == nil || err.Error() != "fail 4" || calls != 4 || sleeps != 3 { panic(fmt.Sprintf("err %v, calls %d, sleeps %d", err, calls, sleeps)) }` },
      { id: "t3", label: "chargeOnce charges a key only once", code: `done := map[string]bool{}\ncharged := 0\nfirst := chargeOnce(done, "inv-1", func() { charged++ })\nsecond := chargeOnce(done, "inv-1", func() { charged++ })\nother := chargeOnce(done, "inv-2", func() { charged++ })\nif !first || second || !other || charged != 2 { panic(fmt.Sprintf("first %v second %v other %v charged %d", first, second, other, charged)) }` },
    ],
    errorHelp: GO_ERROR_HELP,
  },
  {
    id: "go-05-data-race",
    kind: "go",
    trackId: "distributed",
    stage: 6,
    title: "A double spend: data races, critical sections and the race detector",
    summary: "Ten goroutines withdraw from one account and the balance goes negative. Make the check-and-withdraw atomic, then see what the race detector catches that the browser cannot.",
    briefing: `${COMPANY_INTRO}\n\nThe prepaid fuel-card service lets drivers withdraw credit. A fleet with ten drivers sharing one card ended the day with a negative balance: ten withdrawals of 10 succeeded from a balance of 50. Each withdrawal checks the balance, writes an audit record (a slow call), then deducts. Find the race, make the withdrawal atomic, and keep an exact count of successful withdrawals.`,
    objectives: [
      "Withdraw returns an error when the balance is insufficient and never lets Balance go negative, even with concurrent callers",
      "Concurrent withdrawals from one account succeed exactly as many times as the balance allows",
      "Withdrawals returns the number of successful withdrawals, counted safely across goroutines",
    ],
    skills: ["distributed.concurrency", "distributed.resilience"],
    prerequisites: ["go-04-retries-idempotency"],
    estimatedMinutes: 30,
    lesson: [
      { title: "A race is a lost assumption", body: "`Withdraw` assumes that between *checking* the balance and *deducting* it nothing else changed. With one goroutine that holds. With ten, every goroutine passes the check while the balance is still 50, each waits on the audit call, and each then deducts: the classic check-then-act race, and in this case a double spend. The fix is to make check and deduct one indivisible step: a **critical section** guarded by a `sync.Mutex`, held across both." },
      { title: "Counting across goroutines", body: "`count++` is a read, an add and a write. Two goroutines doing it at once can both read 5 and both write 6, losing an update. Protect the counter with the same mutex, a separate one, or `sync/atomic` (`atomic.AddInt64`). Share memory by communicating when you can; when you must share, lock." },
      { title: "Why the browser shows one race and not the other", body: "OpsForge runs Go on a single thread: goroutines switch only at blocking points. The audit call sleeps, so the scheduler switches goroutines *inside* the critical section and the double spend reproduces here. The bare `count++` race does not: no goroutine is interrupted mid-increment on one thread. On a real multi-core machine it is. The **race detector** (`go build -race`) instruments every memory access and reports conflicting unsynchronised accesses it observes. Run this mission's code through the optional local service (Settings) and compare the starter with your fix: the report names the goroutines, the file and the line." },
    ],
    glossary: [
      ...SHARED_GLOSSARY,
      { term: "data race", definition: "Two goroutines access the same memory at the same time, at least one writes, and nothing orders the accesses. Undefined behaviour in Go." },
      { term: "critical section", definition: "Code that must not run in two goroutines at once; guarded by a lock." },
      { term: "sync.Mutex", definition: "A mutual-exclusion lock: Lock() before the critical section, Unlock() after (usually with defer)." },
      { term: "race detector", definition: "Go's runtime instrumentation (-race) that reports unsynchronised conflicting memory accesses it observes while the program runs." },
    ],
    hints: [
      { level: 1, title: "Where is the gap?", body: "Between `if a.Balance < amount` and `a.Balance -= amount` there is a slow call. Every goroutine can pass the check before any of them deducts." },
      { level: 2, title: "One lock, held across check and deduct", body: "Add `mu sync.Mutex` to Account. In Withdraw: `a.mu.Lock(); defer a.mu.Unlock()` as the first statement, so the check, the audit record and the deduction happen as one unit." },
      { level: 3, title: "The counter", body: "Withdrawals launches goroutines that each increment a shared count on success. Guard the increment with a mutex (or use `atomic.AddInt64`) and wait for all goroutines with a WaitGroup before returning." },
      { level: 4, title: "Guided example", body: "```\ntype Account struct {\n\tmu      sync.Mutex\n\tBalance int\n}\n\nfunc (a *Account) Withdraw(amount int) error {\n\ta.mu.Lock()\n\tdefer a.mu.Unlock()\n\tif a.Balance < amount {\n\t\treturn errors.New(\"insufficient funds\")\n\t}\n\taudit(\"withdraw\")\n\ta.Balance -= amount\n\treturn nil\n}\n\nfunc Withdrawals(a *Account, drivers, amount int) int {\n\tvar wg sync.WaitGroup\n\tvar mu sync.Mutex\n\tok := 0\n\tfor i := 0; i < drivers; i++ {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tif a.Withdraw(amount) == nil {\n\t\t\t\tmu.Lock()\n\t\t\t\tok++\n\t\t\t\tmu.Unlock()\n\t\t\t}\n\t\t}()\n\t}\n\twg.Wait()\n\treturn ok\n}\n```" },
    ],
    reflectionPrompts: ["Explain the double-spend race to a product manager in two sentences, then explain why your tests in the browser could catch one of the two races in this program but not the other, and what tool catches both."],
    transferNote: "Check-then-act races, critical sections and the race detector are core concurrency interview material; being able to say which bugs a test can and cannot see is what separates a strong answer.",
    starterCode: `package main

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

// Account is a prepaid fuel card shared by a fleet's drivers.
type Account struct {
	Balance int
}

// audit records the operation in the audit log (a slow remote call).
func audit(op string) {
	time.Sleep(time.Millisecond)
}

// Withdraw deducts amount if the balance allows it.
// BUG: with concurrent callers the balance can go negative.
func (a *Account) Withdraw(amount int) error {
	if a.Balance < amount {
		return errors.New("insufficient funds")
	}
	audit("withdraw")
	a.Balance -= amount
	return nil
}

// Withdrawals has 'drivers' goroutines each withdraw 'amount' once and
// returns how many succeeded.
// BUG: the success count is shared without synchronisation.
func Withdrawals(a *Account, drivers, amount int) int {
	var wg sync.WaitGroup
	ok := 0
	for i := 0; i < drivers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if a.Withdraw(amount) == nil {
				ok++
			}
		}()
	}
	wg.Wait()
	return ok
}

func main() {
	card := &Account{Balance: 50}
	n := Withdrawals(card, 10, 10)
	fmt.Println("successful withdrawals:", n, "balance:", card.Balance)
}
`,
    referenceSolution: `package main

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

type Account struct {
	mu      sync.Mutex
	Balance int
}

func audit(op string) {
	time.Sleep(time.Millisecond)
}

func (a *Account) Withdraw(amount int) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.Balance < amount {
		return errors.New("insufficient funds")
	}
	audit("withdraw")
	a.Balance -= amount
	return nil
}

func Withdrawals(a *Account, drivers, amount int) int {
	var wg sync.WaitGroup
	var mu sync.Mutex
	ok := 0
	for i := 0; i < drivers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if a.Withdraw(amount) == nil {
				mu.Lock()
				ok++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	return ok
}

func main() {
	card := &Account{Balance: 50}
	n := Withdrawals(card, 10, 10)
	fmt.Println("successful withdrawals:", n, "balance:", card.Balance)
}
`,
    tests: [
      { id: "t1", label: "sequential withdrawals: succeeds while funds last, then errors, never negative", code: `a := &Account{Balance: 25}\nif err := a.Withdraw(10); err != nil { panic(fmt.Sprintf("first withdrawal failed: %v", err)) }\nif err := a.Withdraw(10); err != nil { panic(fmt.Sprintf("second withdrawal failed: %v", err)) }\nif err := a.Withdraw(10); err == nil { panic("third withdrawal should fail with insufficient funds") }\nif a.Balance != 5 { panic(fmt.Sprintf("balance %d, want 5", a.Balance)) }` },
      { id: "t2", label: "10 concurrent drivers, balance 50, amount 10: exactly 5 succeed and the balance is 0", code: `card := &Account{Balance: 50}\nn := Withdrawals(card, 10, 10)\nif card.Balance < 0 { panic(fmt.Sprintf("double spend: balance went negative (%d)", card.Balance)) }\nif n != 5 || card.Balance != 0 { panic(fmt.Sprintf("%d withdrawals succeeded and balance is %d; want 5 and 0", n, card.Balance)) }` },
      { id: "t3", label: "40 concurrent drivers, balance 95, amount 10: 9 succeed, balance 5", code: `card := &Account{Balance: 95}\nn := Withdrawals(card, 40, 10)\nif n != 9 || card.Balance != 5 { panic(fmt.Sprintf("%d succeeded, balance %d; want 9 and 5", n, card.Balance)) }` },
    ],
    errorHelp: GO_ERROR_HELP,
  },
];
