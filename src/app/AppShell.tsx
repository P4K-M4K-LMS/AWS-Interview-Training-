import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "../data/hooks";
import { updateProfile } from "../data/db";
import { stageInfo } from "../content/curriculum";

export const NAV = [
  { to: "/", label: "Dashboard", icon: "⌂", end: true },
  { to: "/paths", label: "Learning Paths", icon: "⇶" },
  { to: "/missions", label: "Mission Control", icon: "◎" },
  { to: "/terminal", label: "Linux Terminal", icon: ">_" },
  { to: "/python", label: "Python Laboratory", icon: "py" },
  { to: "/go", label: "Go Laboratory", icon: "go" },
  { to: "/algorithms", label: "Algorithms Laboratory", icon: "∑" },
  { to: "/security", label: "Security Operations", icon: "⛨" },
  { to: "/monitoring", label: "System Monitoring", icon: "▥" },
  { to: "/interview", label: "Interview Command Center", icon: "✦" },
  { to: "/progress", label: "Skill Progress", icon: "▲" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function AppShell() {
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const theme = profile?.settings.theme ?? "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [profile?.settings.theme]);

  useEffect(() => {
    if (profile && !profile.onboardingComplete && location.pathname !== "/onboarding") navigate("/onboarding", { replace: true });
  }, [profile, location.pathname, navigate]);

  const stage = profile ? stageInfo(profile.stage) : null;

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 btn-primary">
        Skip to content
      </a>
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <button type="button" className="btn-ghost" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          ☰
        </button>
        <span className="font-semibold">OpsForge</span>
        <NavLink to="/settings" className="btn-ghost" aria-label="Settings">
          ⚙
        </NavLink>
      </header>
      <nav
        aria-label="Main navigation"
        className={`${open ? "block" : "hidden"} md:block md:w-64 shrink-0 border-r md:min-h-screen`}
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
      >
        <div className="hidden md:block px-5 pt-5 pb-3">
          <div className="text-lg font-bold tracking-tight">
            Ops<span className="accent">Forge</span>
          </div>
          <div className="text-xs muted">Engineer in Training</div>
        </div>
        {profile && stage && (
          <div className="mx-4 mb-3 panel-2 px-3 py-2 text-xs">
            <div className="font-semibold truncate">{profile.displayName}</div>
            <div className="muted">
              Stage {stage.stage}: {stage.title}
            </div>
          </div>
        )}
        <ul className="px-2 pb-4 space-y-0.5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${isActive ? "bg-amber-500/15 text-amber-500 font-medium" : "hover:bg-[var(--panel-2)]"}`
                }
              >
                <span className="w-6 text-center text-xs font-mono muted" aria-hidden>
                  {n.icon}
                </span>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="px-4 pb-4 text-[11px] muted">
          <button
            type="button"
            className="underline"
            onClick={() => void updateProfile({ settings: { ...(profile?.settings ?? ({} as never)), theme: profile?.settings.theme === "dark" ? "light" : "dark" } })}
          >
            Switch to {profile?.settings.theme === "dark" ? "light" : "dark"} mode
          </button>
          <div className="mt-2">Fictional training environment. Not affiliated with Amazon.</div>
        </div>
      </nav>
      <main id="main" className="flex-1 min-w-0 px-4 py-5 md:px-8 md:py-6 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
