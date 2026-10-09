import { Link, useParams } from "react-router-dom";
import { LEADERSHIP_PRINCIPLES, LP_BY_ID } from "../../content/leadershipPrinciples";
import type { LeadershipPrincipleId } from "../../domain/types";
import { useSessions } from "../../data/hooks";
import { Callout, PageHeader, Panel } from "../../components/ui";

export function PrinciplesPage() {
  const { principleId } = useParams();
  const sessions = useSessions();
  const selected = principleId ? LP_BY_ID.get(principleId as LeadershipPrincipleId) : undefined;

  if (selected) {
    const practised = sessions.filter((s) => s.principleId === selected.id);
    const best = practised.reduce((m, s) => Math.max(m, s.feedback?.overall ?? 0), 0);
    return (
      <div className="space-y-4 max-w-4xl">
        <Link to="/interview/principles" className="text-xs muted hover:underline">
          ← All principles
        </Link>
        <PageHeader title={selected.name} subtitle={selected.plain} />
        <Panel title="Official description">
          <blockquote className="text-sm border-l-2 pl-3" style={{ borderColor: "var(--border)" }}>
            {selected.official}
          </blockquote>
          <p className="text-xs muted mt-2">Wording from Amazon's published list of Leadership Principles (amazon.jobs), verified on 2026-10-09. Amazon may revise it; the live page is authoritative.</p>
        </Panel>
        <Panel title="What to show in an interview">
          <p className="text-sm">{selected.interviewCue}</p>
        </Panel>
        <Panel title="Evidence interviewers may look for (practice guidance)">
          <ul className="list-disc pl-5 text-sm space-y-1">
            {selected.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Practice questions (examples, not official)">
          <ul className="space-y-2">
            {selected.questions.map((q) => (
              <li key={q.id} className="panel-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{q.text}</div>
                    <div className="text-xs muted mt-1">Listening for: {q.listeningFor.join(" · ")}</div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Link to={`/interview/practice?mode=practice&question=${q.id}`} className="btn-primary text-xs">
                      Practice
                    </Link>
                    <Link to={`/interview/practice?mode=guided&question=${q.id}`} className="btn-secondary text-xs">
                      Guided
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="Weak answer">
            <p className="text-sm">{selected.weakExample}</p>
          </Panel>
          <Panel title="Strong answer (fictional example)">
            <p className="text-sm">{selected.strongExample}</p>
          </Panel>
        </div>
        <Panel title="Typical follow-ups">
          <ul className="list-disc pl-5 text-sm space-y-1">
            {selected.followUps.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Panel>
        <Callout kind="info" title="Your progress on this principle">
          {practised.length ? `${practised.length} session(s); best coaching score ${best}/100.` : "Not practised yet."}
        </Callout>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Amazon Leadership Principles" subtitle="All 16 principles. Each has an explanation, example questions, evidence to show, STAR and voice practice, follow-ups and feedback." />
      <div className="grid md:grid-cols-2 gap-3">
        {LEADERSHIP_PRINCIPLES.map((p, i) => {
          const n = sessions.filter((s) => s.principleId === p.id).length;
          return (
            <Link key={p.id} to={`/interview/principles/${p.id}`} className="panel p-4 hover:border-amber-500 transition block">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {i + 1}. {p.name}
                </div>
                {n > 0 && <span className="badge">{n} practised</span>}
              </div>
              <div className="text-sm muted mt-1 line-clamp-2">{p.plain}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
