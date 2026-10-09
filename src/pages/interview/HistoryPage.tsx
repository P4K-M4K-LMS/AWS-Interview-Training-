import { Link } from "react-router-dom";
import { useSessions } from "../../data/hooks";
import { LP_BY_ID } from "../../content/leadershipPrinciples";
import { db } from "../../data/db";
import { PageHeader, Panel, ProgressBar } from "../../components/ui";
import { RUBRIC } from "../../engine/interview/scoring";

export function HistoryPage() {
  const sessions = useSessions();
  const scored = sessions.filter((s) => s.feedback);
  const byCategory = RUBRIC.map((r) => {
    const vals = scored.slice(0, 10).map((s) => s.feedback!.categories.find((c) => c.category === r.category)?.score ?? 0);
    return { ...r, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 };
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Practice history" subtitle="Every saved session with its coaching report. Improvement tracking compares your last 10 sessions by rubric category." />
      {scored.length > 0 && (
        <Panel title="Improvement tracking (average of last 10 scored sessions)">
          <div className="space-y-2">
            {byCategory.map((c) => (
              <ProgressBar key={c.category} value={c.avg} label={`${c.label} (weight ${c.weight}%)`} />
            ))}
          </div>
        </Panel>
      )}
      {sessions.length === 0 ? (
        <Panel>
          <p className="text-sm muted">
            No sessions yet. <Link to="/interview/practice" className="underline">Start one</Link>.
          </p>
        </Panel>
      ) : (
        <Panel>
          <ul className="divide-y" style={{ borderColor: "var(--border)" }} data-testid="history-list">
            {sessions.map((s) => (
              <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.questionText}</div>
                  <div className="text-xs muted">
                    {new Date(s.startedAt).toLocaleString()} · {s.mode} · {s.inputMode} · {s.principleId ? LP_BY_ID.get(s.principleId)?.name : "general"} · {s.turns.filter((t) => t.role === "learner").length} answer(s)
                    {s.feedback ? ` · score ${s.feedback.overall}/100 (${s.feedback.source})` : " · no feedback"}
                    {s.revisedFeedback ? ` · revised ${s.revisedFeedback.overall}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/interview/practice/${s.id}`} className="btn-secondary">
                    Open
                  </Link>
                  <button type="button" className="btn-ghost text-red-400" onClick={() => window.confirm("Delete this session?") && void db.sessions.delete(s.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
