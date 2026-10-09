import { Link } from "react-router-dom";
import { useProfile, useSessions, useStories } from "../../data/hooks";
import { LEADERSHIP_PRINCIPLES } from "../../content/leadershipPrinciples";
import { roleQuestionsFor } from "../../content/roleQuestions";
import { roleFor } from "../../content/roles";
import { Callout, PageHeader, Panel } from "../../components/ui";

export function InterviewHomePage() {
  const profile = useProfile();
  const stories = useStories();
  const sessions = useSessions();
  const role = roleFor(profile?.targetRoleId);
  const roleQuestions = roleQuestionsFor(role.id);
  const withFeedback = sessions.filter((s) => s.feedback);
  const avg = withFeedback.length ? Math.round(withFeedback.reduce((a, s) => a + (s.feedback?.overall ?? 0), 0) / withFeedback.length) : null;
  const recent = withFeedback.slice(0, 5);
  const earlier = withFeedback.slice(5, 10);
  const trend = recent.length && earlier.length ? Math.round(recent.reduce((a, s) => a + s.feedback!.overall, 0) / recent.length - earlier.reduce((a, s) => a + s.feedback!.overall, 0) / earlier.length) : null;

  const cards = [
    { to: "/interview/star", title: "STAR Method Academy", body: "Situation, Task, Action, Result: how to structure an answer, strong vs weak examples, and how to talk about failures honestly." },
    { to: "/interview/principles", title: "Amazon Leadership Principles", body: `All ${LEADERSHIP_PRINCIPLES.length} principles with plain-language explanations, practice questions, evidence interviewers may seek, and follow-ups.` },
    { to: "/interview/stories", title: "Personal Story Bank", body: `${stories.length} private stor${stories.length === 1 ? "y" : "ies"} saved locally. Real experiences only; the simulator's missions are labelled fictional.` },
    { to: "/interview/practice?set=role", title: "Role questions", body: `${roleQuestions.length} technical questions drawn from the qualifications of "${role.title}", each tied to the missions that prepare you for it. Practice examples, not an official list.` },
    { to: "/interview/practice", title: "Mock interviews + Dive Deeper", body: "Guided, Practice and Realistic modes. Answer by voice or text, then get probed on vague claims and coached with a transparent rubric." },
    { to: "/interview/history", title: "Practice history", body: `${sessions.length} session(s). ${avg !== null ? `Average coaching score ${avg}/100.` : ""} ${trend !== null ? `Trend over the last 5: ${trend >= 0 ? "+" : ""}${trend}.` : ""}` },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Interview" subtitle="Prepare for Amazon/AWS-style behavioral and technical interviews. Unofficial practice: questions are examples, scores are coaching signals, and nothing here reproduces Amazon's private process." />
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="panel p-4 hover:border-amber-500 transition block">
            <div className="font-semibold">{c.title}</div>
            <div className="text-sm muted mt-1">{c.body}</div>
          </Link>
        ))}
      </div>
      <Panel title="Suggested path for a beginner">
        <ol className="list-decimal pl-5 text-sm space-y-1">
          <li>Read the STAR Academy (10 minutes) and study one Leadership Principle.</li>
          <li>Add two real stories to your Story Bank, even rough ones. School, volunteering and personal projects count.</li>
          <li>Run Guided Mode once to build an answer section by section.</li>
          <li>Use Practice Mode with Dive Deeper on the same story. Expect to be probed; that is the point.</li>
          <li>Record an improved answer and compare the two reports.</li>
        </ol>
      </Panel>
      <Callout kind="warn" title="Honesty rules built into the coach">
        The coach never invents details for you, accepts "I don't know", and does not pressure you for numbers you do not have. Fictional OpsForge missions are for practising technical explanations, not for claiming as work experience.
      </Callout>
    </div>
  );
}
