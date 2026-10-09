import { useEffect, useState } from "react";
import type { Shell } from "../engine/terminal/shell";

/** Simple modal editor used by `nano`/`vi` in the simulator. */
export function FileEditor({ shell, path, onClose, onSaved }: { shell: Shell; path: string; onClose: () => void; onSaved?: () => void }) {
  const [content, setContent] = useState(shell.readFile(path) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [asRoot, setAsRoot] = useState(false);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    const r = shell.writeFile(path, content, asRoot);
    if (!r.ok) {
      setError(r.error ?? "Could not save");
      return;
    }
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Editing ${path}`}>
      <div className="panel w-full max-w-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-mono text-sm">{path}</div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close editor">
            ✕
          </button>
        </div>
        <textarea className="input font-mono h-72" value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} aria-label="File contents" />
        {error && <div className="text-sm text-red-400">{error}. {error.includes("Permission") ? "Tick 'save as root (sudo)' if you are allowed to." : ""}</div>}
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={asRoot} onChange={(e) => setAsRoot(e.target.checked)} /> save as root (sudo)
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save}>
              Save (Ctrl+O equivalent)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
