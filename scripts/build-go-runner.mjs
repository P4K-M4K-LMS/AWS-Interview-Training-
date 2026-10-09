#!/usr/bin/env node
/**
 * Builds the Go runner (Yaegi interpreter) to WebAssembly into public/go/.
 * Requires a Go toolchain (1.22+). If `go` is not installed the build is
 * skipped with a warning and the Go Laboratory reports that the runtime is
 * unavailable; everything else in OpsForge still works.
 */
import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const outDir = path.resolve("public/go");
const wasmOut = path.join(outDir, "gorunner.wasm");
const which = spawnSync("go", ["version"], { encoding: "utf8" });
if (which.status !== 0) {
  console.warn("[go-runner] Go toolchain not found; skipping WebAssembly build. Install Go 1.22+ and run `npm run build:go` to enable the Go Laboratory.");
  process.exit(0);
}
if (process.env.SKIP_GO_BUILD === "1") {
  console.log("[go-runner] SKIP_GO_BUILD=1; skipping.");
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });
const srcNewer = !existsSync(wasmOut) || statSync(path.resolve("go/runner/main.go")).mtimeMs > statSync(wasmOut).mtimeMs || statSync(path.resolve("go/runner/go.mod")).mtimeMs > statSync(wasmOut).mtimeMs;
if (!srcNewer && process.env.FORCE_GO_BUILD !== "1") {
  console.log("[go-runner] public/go/gorunner.wasm is up to date.");
} else {
  console.log(`[go-runner] building with ${which.stdout.trim()} ...`);
  execSync(`go build -trimpath -ldflags="-s -w" -o "${wasmOut}" .`, { cwd: path.resolve("go/runner"), stdio: "inherit", env: { ...process.env, GOOS: "js", GOARCH: "wasm", CGO_ENABLED: "0" } });
  console.log(`[go-runner] wrote ${wasmOut} (${(statSync(wasmOut).size / 1048576).toFixed(1)} MB)`);
}
const goroot = execSync("go env GOROOT", { encoding: "utf8" }).trim();
const shim = [path.join(goroot, "lib/wasm/wasm_exec.js"), path.join(goroot, "misc/wasm/wasm_exec.js")].find((p) => existsSync(p));
if (!shim) {
  console.error("[go-runner] wasm_exec.js not found in GOROOT");
  process.exit(1);
}
copyFileSync(shim, path.join(outDir, "wasm_exec.js"));
console.log("[go-runner] copied wasm_exec.js");
