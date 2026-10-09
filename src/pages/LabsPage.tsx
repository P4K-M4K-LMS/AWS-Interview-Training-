import { NavLink, Outlet } from "react-router-dom";

/**
 * Labs hub: the free-play workstations behind one navigation entry. Each lab
 * keeps its own page and header; this layout only adds the tab strip.
 */
export const LABS = [
  { to: "/labs/terminal", label: "Terminal", hint: "Linux simulator sandbox" },
  { to: "/labs/python", label: "Python", hint: "Real CPython in the browser" },
  { to: "/labs/go", label: "Go", hint: "Real Go with goroutines" },
  { to: "/labs/algorithms", label: "Algorithms", hint: "Big O, instrumented" },
  { to: "/labs/security", label: "Security", hint: "Defensive investigations" },
  { to: "/labs/monitoring", label: "Monitoring", hint: "The simulated platform" },
];

export function LabsPage() {
  return (
    <div className="space-y-4">
      <nav aria-label="Labs" className="flex gap-1 flex-wrap border-b" style={{ borderColor: "var(--border)" }}>
        {LABS.map((l) => (
          <NavLink key={l.to} to={l.to} title={l.hint} className={({ isActive }) => `px-3 py-1.5 text-sm -mb-px border-b-2 ${isActive ? "border-amber-500 text-amber-500" : "border-transparent muted hover:text-[var(--text)]"}`} data-testid={`lab-tab-${l.label.toLowerCase()}`}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
