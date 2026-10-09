//go:build js && wasm

// OpsForge Go runner: the Yaegi interpreter compiled to WebAssembly and
// exposed to JavaScript as goRun(code, testsJSON). Learner code runs inside
// the interpreter with no filesystem or network access; the surrounding Web
// Worker enforces the wall-clock timeout by terminating the worker.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"syscall/js"
	"time"

	"github.com/traefik/yaegi/interp"
	"github.com/traefik/yaegi/stdlib"
)

type testCase struct {
	ID   string `json:"id"`
	Code string `json:"code"`
}

type testResult struct {
	ID     string `json:"id"`
	Passed bool   `json:"passed"`
	Error  string `json:"error,omitempty"`
	Stdout string `json:"stdout,omitempty"`
}

type result struct {
	Stdout string       `json:"stdout"`
	Stderr string       `json:"stderr"`
	Error  string       `json:"error"`
	Millis int64        `json:"millis"`
	Tests  []testResult `json:"tests"`
}

func evalSafely(i *interp.Interpreter, code string) (err error) {
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("panic: %v", p)
		}
	}()
	_, err = i.Eval(code)
	return err
}

func run(code string, tests []testCase) result {
	var out, errb bytes.Buffer
	start := time.Now()
	r := result{Tests: []testResult{}}
	i := interp.New(interp.Options{Stdout: &out, Stderr: &errb})
	if err := i.Use(stdlib.Symbols); err != nil {
		r.Error = err.Error()
		return r
	}
	// Yaegi runs main() itself when the source is a complete package main program.
	if err := evalSafely(i, code); err != nil {
		r.Error = err.Error()
	}
	r.Stdout = out.String()
	userLen := out.Len()
	if r.Error == "" {
		for _, t := range tests {
			before := out.Len()
			if err := evalSafely(i, t.Code); err != nil {
				r.Tests = append(r.Tests, testResult{ID: t.ID, Passed: false, Error: err.Error(), Stdout: out.String()[before:]})
			} else {
				r.Tests = append(r.Tests, testResult{ID: t.ID, Passed: true, Stdout: out.String()[before:]})
			}
		}
	} else {
		for _, t := range tests {
			r.Tests = append(r.Tests, testResult{ID: t.ID, Passed: false, Error: "Not run: the program failed before tests could start."})
		}
	}
	r.Stdout = out.String()[:userLen]
	r.Stderr = errb.String()
	r.Millis = time.Since(start).Milliseconds()
	return r
}

func main() {
	js.Global().Set("goRun", js.FuncOf(func(this js.Value, args []js.Value) any {
		var tests []testCase
		if len(args) > 1 && args[1].Type() == js.TypeString && args[1].String() != "" {
			_ = json.Unmarshal([]byte(args[1].String()), &tests)
		}
		r := run(args[0].String(), tests)
		b, _ := json.Marshal(r)
		return string(b)
	}))
	js.Global().Set("goRunnerReady", js.ValueOf(true))
	select {}
}
