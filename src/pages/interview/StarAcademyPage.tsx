import { Link } from "react-router-dom";
import { Callout, PageHeader, Panel } from "../../components/ui";

const SECTIONS = [
  { k: "Situation", what: "Set the scene in two or three sentences: when, where, what was going on, what was at stake.", weak: "\"We had a project once.\"", strong: "\"In my second semester, our capstone team's demo server went down the evening before the presentation, and I was the only one who had set it up.\"" },
  { k: "Task", what: "Your specific responsibility or goal, not the team's. One sentence.", weak: "\"We needed to fix it.\"", strong: "\"My job was to get the demo back online within two hours without losing the data we had collected.\"" },
  { k: "Action", what: "What YOU did, in order, with reasoning. This is 60% of the answer. Name tools, evidence, decisions and alternatives you rejected.", weak: "\"I worked on it and fixed the problem.\"", strong: "\"I checked the logs first and saw the disk was full. I considered just deleting old logs, but I didn't know what was safe, so I moved them to another partition instead and freed 4 GB. Then I restarted the service and verified the demo page loaded.\"" },
  { k: "Result", what: "The outcome, with a measure or verification. If you do not know a number, say what you observed. Include what you learned.", weak: "\"It worked out well.\"", strong: "\"The demo ran the next day without issues; I added a disk-space alert so it could not silently fill again. I learned to check basic resources before assuming a complex cause.\"" },
];

export function StarAcademyPage() {
  return (
    <div className="space-y-4 max-w-4xl">
      <PageHeader title="STAR Method Academy" subtitle="The structure interviewers expect for behavioral questions, and the habits that make answers credible." />
      <Panel title="Why structure matters">
        <p className="text-sm">
          Behavioral questions ("Tell me about a time when...") are asking for evidence of how you actually behave. STAR keeps the story complete and lets the interviewer follow it. Interviewers then <strong>dive deeper</strong>: they ask what you personally did, why, and how you know it worked. Answers that survive follow-ups are specific, first-person and measured.
        </p>
      </Panel>
      {SECTIONS.map((s) => (
        <Panel key={s.k} title={s.k}>
          <p className="text-sm">{s.what}</p>
          <div className="grid md:grid-cols-2 gap-3 mt-3 text-sm">
            <div className="rounded-md border border-red-500/40 p-3">
              <div className="label text-red-400">Weak</div>
              {s.weak}
            </div>
            <div className="rounded-md border border-emerald-500/40 p-3">
              <div className="label text-emerald-400">Strong</div>
              {s.strong}
            </div>
          </div>
        </Panel>
      ))}
      <Panel title="Talking about failures and mistakes">
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>State plainly what went wrong and your part in it. Interviewers trust candidates who own mistakes more than those who have none.</li>
          <li>Spend most of the time on what you did next and what changed because of it.</li>
          <li>Do not exaggerate the recovery or invent a happy ending. "The project was cancelled, and here is what I carried forward" is a complete, strong answer.</li>
        </ul>
      </Panel>
      <Panel title="Ownership language">
        <p className="text-sm">
          Use "I" for what you did and "we" for what the team did, and keep them distinct. "We fixed it" invites the question "what did <em>you</em> do?". Say "I proposed X, and Marcus implemented the client side" rather than claiming the whole thing or hiding inside the team.
        </p>
      </Panel>
      <Callout kind="warn" title="Never fabricate">
        Interviewers probe for detail, and invented stories collapse under follow-ups. Use real experiences from work, school, volunteering, customer service or personal projects. OpsForge's missions are fictional practice; use them to rehearse technical explanations, not as claimed experience.
      </Callout>
      <div className="flex gap-2">
        <Link to="/interview/stories" className="btn-primary">
          Build your Story Bank
        </Link>
        <Link to="/interview/practice?mode=guided" className="btn-secondary">
          Try Guided Mode
        </Link>
      </div>
    </div>
  );
}
