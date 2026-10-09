import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "../data/hooks";
import { updateProfile } from "../data/db";
import { stageInfo } from "../content/curriculum";

/**
 * Navigation in three groups that follow the learning loop: learn (what to do
 * now, the curriculum, the missions, the study catalog), practise (free-play labs and the
 * interview coach), you (progress and settings). Plain names throughout.
 */
export const NAV_GROUPS: Array<{ title: string; items: Array<{ to: string; label: string; icon: string; end?: boolean }> }> = [
  {
    title: "Learn",
    items: [
      { to: "/", label: "Today", icon: "⌂", end: true },
      { to: "/curriculum", label: "Curriculum", icon: "⇶" },
      { to: "/missions", label: "Missions", icon: "◎" },
      { to: "/study", label: "Study", icon: "▤" },
    ],
  },
  {
    title: "Practise",
    items: [
      { to: "/labs", label: "Labs", icon: ">_" },
      { to: "/interview", label: "Interview", icon: "✦" },
    ],
  },
  {
    title: "You",
    items: [
      { to: "/progress", label: "Progress", icon: "▲" },
      { to: "/settings", label: "Settings", icon: "⚙" },
    ],
  },
];

export const NAV = NAV_GROUPS.flatMap((g) => g.items);

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
        className={`${open ? "block" : "hidden"} md:block md:w-60 shrink-0 border-r md:min-h-screen`}
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
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="px-2 pb-3">
            <div className="label px-3 pb-1">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map((n) => (
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
          </div>
        ))}
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
        <Suspense fallback={<div className="text-sm muted py-8" role="status">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
