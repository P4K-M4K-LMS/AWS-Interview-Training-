import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db, nowIso, uid } from "../../data/db";
import { useStories } from "../../data/hooks";
import { LEADERSHIP_PRINCIPLES } from "../../content/leadershipPrinciples";
import { SCHEMA_VERSION, type FactualConfidence, type LeadershipPrincipleId, type Story, type StorySource } from "../../domain/types";
import { Callout, PageHeader, Panel } from "../../components/ui";

const SOURCES: Array<[StorySource, string]> = [
  ["employment", "Employment"],
  ["school", "School"],
  ["volunteer", "Volunteer"],
  ["personal-project", "Personal project"],
  ["customer-service", "Customer service"],
  ["technical-learning", "Technical learning"],
  ["teamwork", "Teamwork"],
  ["troubleshooting", "Troubleshooting"],
  ["mistake", "Mistake"],
  ["process-improvement", "Process improvement"],
];

function blank(): Story {
  return {
    id: uid("story"),
    schemaVersion: SCHEMA_VERSION,
    title: "",
    source: "employment",
    situation: "",
    task: "",
    action: "",
    result: "",
    lessons: "",
    principles: [],
    technicalSkills: [],
    evidence: "",
    confidence: "high",
    practiceHistory: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function StoryBankPage() {
  const stories = useStories();
  const [editing, setEditing] = useState<Story | null>(null);
  const [filter, setFilter] = useState<LeadershipPrincipleId | "">("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    if (!editing) return;
    await db.stories.put({ ...editing, title: editing.title.trim() || "Untitled story", updatedAt: nowIso() });
    await db.activity.add({ at: nowIso(), type: "story-saved", detail: editing.title });
    setEditing(null);
  };
  const remove = async (s: Story) => {
    if (window.confirm(`Delete "${s.title}"? This cannot be undone.`)) await db.stories.delete(s.id);
  };
  const exportStories = () => {
    const blob = new Blob([JSON.stringify({ app: "opsforge", schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), stories }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "opsforge-stories.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importStories = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { stories?: Story[] };
      if (!Array.isArray(data.stories)) throw new Error("No stories array in file");
      await db.stories.bulkPut(data.stories.map((s) => ({ ...s, schemaVersion: SCHEMA_VERSION })));
      setMsg(`Imported ${data.stories.length} stories.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  const shown = filter ? stories.filter((s) => s.principles.includes(filter)) : stories;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Personal Story Bank"
        subtitle="Your real experiences, structured as STAR. Stored only in this browser. Export to keep a backup."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={exportStories} disabled={!stories.length}>
              Export
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              Import
            </button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void importStories(e.target.files[0])} />
            <button type="button" className="btn-primary" onClick={() => setEditing(blank())} data-testid="story-new">
              + New story
            </button>
          </>
        }
      />
      {msg && <Callout kind="info">{msg}</Callout>}
      <Callout kind="warn" title="Authentic experiences only">
        Sources can be employment, school, volunteering, personal projects, customer service, technical learning, teamwork, troubleshooting, mistakes or process improvements. Never turn an OpsForge simulation into a claimed professional experience.
      </Callout>

      {editing && (
        <Panel title={stories.some((s) => s.id === editing.id) ? "Edit story" : "New story"}>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="label" htmlFor="title">
                Title
              </label>
              <input id="title" className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Recovered the capstone demo server" data-testid="story-title" />
            </div>
            <div>
              <label className="label" htmlFor="source">
                Source
              </label>
              <select id="source" className="input" value={editing.source} onChange={(e) => setEditing({ ...editing, source: e.target.value as StorySource })}>
                {SOURCES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="conf">
                Confidence in factual accuracy
              </label>
              <select id="conf" className="input" value={editing.confidence} onChange={(e) => setEditing({ ...editing, confidence: e.target.value as FactualConfidence })}>
                <option value="high">High: I remember details and could verify them</option>
                <option value="medium">Medium: broadly right, some details fuzzy</option>
                <option value="low">Low: needs checking before I use it</option>
              </select>
            </div>
            {(["situation", "task", "action", "result", "lessons"] as const).map((k) => (
              <div key={k} className={k === "action" ? "md:col-span-2" : ""}>
                <label className="label" htmlFor={k}>
                  {k === "lessons" ? "Lessons learned" : k}
                </label>
                <textarea id={k} className={`input ${k === "action" ? "h-28" : "h-20"}`} value={editing[k]} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} data-testid={`story-${k}`} />
              </div>
            ))}
            <div>
              <label className="label" htmlFor="skills">
                Technical skills (comma separated)
              </label>
              <input id="skills" className="input" value={editing.technicalSkills.join(", ")} onChange={(e) => setEditing({ ...editing, technicalSkills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </div>
            <div>
              <label className="label" htmlFor="evidence">
                Supporting evidence (where facts can be checked)
              </label>
              <input id="evidence" className="input" value={editing.evidence} onChange={(e) => setEditing({ ...editing, evidence: e.target.value })} placeholder="e.g. project report May 2025, commit history, email from Priya" />
            </div>
            <fieldset className="md:col-span-2">
              <legend className="label">Leadership Principles this story demonstrates</legend>
              <div className="flex flex-wrap gap-1">
                {LEADERSHIP_PRINCIPLES.map((p) => {
                  const on = editing.principles.includes(p.id);
                  return (
                    <button key={p.id} type="button" className={`badge ${on ? "border-amber-500 text-amber-500" : ""}`} aria-pressed={on} onClick={() => setEditing({ ...editing, principles: on ? editing.principles.filter((x) => x !== p.id) : [...editing.principles, p.id] })}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={() => void save()} data-testid="story-save">
              Save story
            </button>
          </div>
        </Panel>
      )}

      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="filter" className="muted">
          Filter by principle
        </label>
        <select id="filter" className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value as LeadershipPrincipleId | "")}>
          <option value="">All</option>
          {LEADERSHIP_PRINCIPLES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <Panel>
          <p className="text-sm muted">No stories yet. Start with a rough one; you can refine it after practising.</p>
        </Panel>
      ) : (
        <div className="grid md:grid-cols-2 gap-3" data-testid="story-list">
          {shown.map((s) => (
            <Panel key={s.id} title={s.title}>
              <div className="text-xs muted mb-2">
                {SOURCES.find(([v]) => v === s.source)?.[1]} · confidence {s.confidence} · practised {s.practiceHistory.length}× · updated {new Date(s.updatedAt).toLocaleDateString()}
              </div>
              <p className="text-sm line-clamp-3">{s.situation || s.action}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {s.principles.map((p) => (
                  <span key={p} className="badge">
                    {LEADERSHIP_PRINCIPLES.find((x) => x.id === p)?.name}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button type="button" className="btn-secondary" onClick={() => setEditing(s)}>
                  Edit
                </button>
                <Link to={`/interview/practice?mode=practice&story=${s.id}`} className="btn-secondary">
                  Practise with it
                </Link>
                <button type="button" className="btn-ghost text-red-400" onClick={() => void remove(s)}>
                  Delete
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
