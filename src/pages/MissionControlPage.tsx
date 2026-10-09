import { Link } from "react-router-dom";
import { MISSIONS, RECOMMENDED_ORDER } from "../content/missions";
import { TRACK_BY_ID } from "../content/curriculum";
import { useMissionStatuses } from "../data/hooks";
import { PageHeader, Panel, StatusBadge } from "../components/ui";

export function MissionControlPage() {
  const { statuses, progress } = useMissionStatuses();
  const ordered = RECOMMENDED_ORDER.map((id) => MISSIONS.find((m) => m.id === id)!).filter(Boolean);
  return (
    <div className="space-y-5">
      <PageHeader title="Missions" subtitle="All missions in recommended order. A locked mission unlocks when its prerequisite missions are completed." />
      <Panel>
        <ol className="divide-y" style={{ borderColor: "var(--border)" }}>
          {ordered.map((m, i) => {
            const status = statuses.get(m.id) ?? "locked";
            const p = progress.get(m.id);
            return (
              <li key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs muted font-mono">{String(i + 1).padStart(2, "0")}</span>
                    <Link to={`/missions/${m.id}`} className="font-medium hover:underline">
                      {m.title}
                    </Link>
                    <span className="badge">{TRACK_BY_ID.get(m.trackId)?.shortName}</span>
                    <span className="badge">{m.kind}</span>
                    <span className="badge">~{m.estimatedMinutes} min</span>
                  </div>
                  <div className="text-sm muted mt-0.5">{m.summary}</div>
                  {p && p.attempts > 0 && (
                    <div className="text-xs muted mt-0.5">
                      {p.attempts} attempt(s) · {p.hintsUsed} hint(s)
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  <Link to={`/missions/${m.id}`} className={status === "locked" ? "btn-secondary" : "btn-primary"}>
                    {status === "completed" ? "Review" : status === "in-progress" ? "Resume" : status === "locked" ? "View" : "Start"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </div>
  );
}
