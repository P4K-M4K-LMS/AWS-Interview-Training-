import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="muted text-sm mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = "", actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`panel p-4 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function ProgressBar({ value, label, color = "bg-amber-500" }: { value: number; label?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs mb-1">
          <span>{label}</span>
          <span className="muted">{v}%</span>
        </div>
      )}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--panel-2)" }} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full ${color} transition-all`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: "locked" | "available" | "in-progress" | "completed" }) {
  const map = {
    locked: ["Locked", "opacity-60"],
    available: ["Available", "border-amber-500/50 text-amber-500"],
    "in-progress": ["In progress", "border-sky-500/50 text-sky-400"],
    completed: ["Completed", "border-emerald-500/50 text-emerald-400"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Callout({ kind = "info", title, children }: { kind?: "info" | "warn" | "success" | "danger"; title?: string; children: ReactNode }) {
  const color = { info: "border-sky-500/40", warn: "border-amber-500/50", success: "border-emerald-500/50", danger: "border-red-500/50" }[kind];
  return (
    <div className={`rounded-md border-l-4 ${color} panel-2 px-3 py-2 text-sm`} role={kind === "danger" ? "alert" : undefined}>
      {title && <div className="font-semibold mb-0.5">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: { to: string; label: string } }) {
  return (
    <div className="panel p-8 text-center">
      <div className="font-semibold">{title}</div>
      <p className="muted text-sm mt-1">{body}</p>
      {cta && (
        <Link to={cta.to} className="btn-primary mt-4">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** Minimal markdown-ish renderer: paragraphs, **bold**, `code`, ``` blocks, - lists. No HTML injection. */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="prose-ops text-sm">
      {blocks.map((b, i) =>
        i % 2 === 1 ? (
          <pre key={i}>{b.replace(/^\n/, "").replace(/\n$/, "")}</pre>
        ) : (
          b
            .split(/\n\s*\n/)
            .filter((p) => p.trim())
            .map((p, j) => {
              const lines = p.split("\n");
              if (lines.every((l) => /^\s*-\s+/.test(l))) {
                return (
                  <ul key={`${i}-${j}`}>
                    {lines.map((l, k) => (
                      <li key={k}>{inline(l.replace(/^\s*-\s+/, ""))}</li>
                    ))}
                  </ul>
                );
              }
              return <p key={`${i}-${j}`}>{inline(p)}</p>;
            })
        ),
      )}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
