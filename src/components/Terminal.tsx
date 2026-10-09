import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Shell, ExecResult } from "../engine/terminal/shell";

export interface TerminalLine {
  kind: "prompt" | "out" | "err" | "info";
  text: string;
}

interface Props {
  shell: Shell;
  /** Called after every executed command with the result (for validation, persistence). */
  onCommand?: (command: string, result: ExecResult) => void;
  onEdit?: (path: string) => void;
  height?: string;
  initialLines?: TerminalLine[];
  ariaLabel?: string;
}

/**
 * A simple, accessible terminal view: a scrollback log plus a single input
 * line with history navigation (↑/↓), Tab completion for paths and commands,
 * and Ctrl+L to clear.
 */
export function Terminal({ shell, onCommand, onEdit, height = "22rem", initialLines, ariaLabel = "Virtual Linux terminal" }: Props) {
  const [lines, setLines] = useState<TerminalLine[]>(initialLines ?? [{ kind: "info", text: "OpsForge terminal simulator. Type 'help' to list supported commands." }]);
  const [input, setInput] = useState("");
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

  const run = (cmd: string) => {
    const prompt = shell.prompt();
    const result = shell.execute(cmd);
    const next: TerminalLine[] = [{ kind: "prompt", text: prompt + cmd }];
    if (result.stdout) next.push({ kind: "out", text: result.stdout.replace(/\n$/, "") });
    if (result.stderr) next.push({ kind: "err", text: result.stderr.replace(/\n$/, "") });
    if (result.action?.type === "clear") setLines([]);
    else setLines((l) => [...l, ...next].slice(-600));
    if (result.action?.type === "edit") onEdit?.(result.action.path);
    onCommand?.(cmd, result);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run(input);
      setInput("");
      setHistIdx(null);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = shell.history;
      if (!h.length) return;
      const idx = histIdx === null ? h.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(h[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const h = shell.history;
      if (histIdx === null) return;
      const idx = histIdx + 1;
      if (idx >= h.length) {
        setHistIdx(null);
        setInput("");
      } else {
        setHistIdx(idx);
        setInput(h[idx]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      setInput(complete(shell, input));
    }
  };

  return (
    <div className="terminal rounded-lg border overflow-hidden flex flex-col" style={{ borderColor: "var(--border)", height }} onClick={() => inputRef.current?.focus()}>
      <div ref={bodyRef} className="flex-1 overflow-auto p-3 whitespace-pre-wrap break-words" role="log" aria-live="polite" aria-label={`${ariaLabel} output`}>
        {lines.map((l, i) => (
          <div key={i} className={l.kind === "err" ? "text-red-300" : l.kind === "prompt" ? "text-emerald-200" : l.kind === "info" ? "text-slate-400" : "text-slate-100"}>
            {l.text}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-800">
        <span className="text-emerald-300 shrink-0" aria-hidden>
          {shell.prompt()}
        </span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none text-slate-100 font-mono"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          aria-label={`${ariaLabel} command input`}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          data-testid="terminal-input"
        />
      </div>
    </div>
  );
}

function complete(shell: Shell, input: string): string {
  const parts = input.split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  if (parts.length === 1) {
    const cmds = ["pwd", "ls", "cd", "cat", "grep", "echo", "mkdir", "touch", "rm", "cp", "mv", "head", "tail", "chmod", "chown", "systemctl", "journalctl", "sudo", "ps", "top", "kill", "find", "sort", "uniq", "wc", "history", "help", "nano"];
    const m = cmds.filter((c) => c.startsWith(last));
    return m.length === 1 ? m[0] + " " : input;
  }
  const slash = last.lastIndexOf("/");
  const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
  const base = slash >= 0 ? last.slice(slash + 1) : last;
  const dirAbs = shell.abs(dirPart || ".");
  const candidates = Object.keys(shell.fs)
    .filter((k) => k !== dirAbs && k.startsWith(dirAbs === "/" ? "/" : dirAbs + "/") && !k.slice(dirAbs.length + (dirAbs === "/" ? 0 : 1)).includes("/"))
    .map((k) => k.slice(k.lastIndexOf("/") + 1))
    .filter((n) => n.startsWith(base));
  if (candidates.length === 1) {
    const full = dirPart + candidates[0] + (shell.fs[shell.abs(dirPart + candidates[0])]?.type === "dir" ? "/" : " ");
    return [...parts.slice(0, -1), full].join(" ");
  }
  return input;
}
