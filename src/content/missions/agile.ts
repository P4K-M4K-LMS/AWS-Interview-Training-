import type { LessonMission } from "../../domain/types";

/**
 * Process lessons: knowledge with a check quiz. Scrum has no meaningful
 * hands-on simulation, so this mission teaches the vocabulary, the loop and
 * how an operations engineer takes part, then checks understanding against a
 * concrete fictional sprint.
 */
export const agileMissions: LessonMission[] = [
  {
    id: "agile-01-scrum-for-engineers",
    kind: "lesson",
    trackId: "devops",
    stage: 2,
    title: "Agile and Scrum for an operations engineer",
    summary: "The sprint loop, the three roles, the three artifacts and the five events, and how on-call work and incident follow-ups fit into a Scrum team without wrecking the sprint.",
    briefing: "Nimbus Freight (fictional) runs its platform team in two-week sprints. You are joining the team. Before your first sprint planning, learn the vocabulary, the loop and the rules of thumb, then check yourself against a concrete sprint scenario. This lesson describes common Scrum practice as the 2020 Scrum Guide and most teams use it; teams vary, and your interviewer will care more about how you worked within it than about definitions.",
    objectives: [
      "Name the Scrum roles, artifacts and events and what each is for",
      "Explain how unplanned operational work (incidents, follow-ups) enters a sprint without destroying it",
      "Recognise the common failure modes: the daily scrum as a status report, carrying work over every sprint, skipping the retrospective",
      "Answer the interview question 'Tell me about working in an Agile team' with a STAR story",
    ],
    skills: ["devops.agile"],
    prerequisites: ["devops-01-broken-pipeline"],
    estimatedMinutes: 20,
    lesson: [
      {
        title: "The loop",
        body: "Scrum is a loop of fixed-length **sprints** (one to four weeks, most teams use two). Each sprint starts with **sprint planning** (what will we deliver, and how), has a **daily scrum** (15 minutes, the developers re-plan the next 24 hours), and ends with a **sprint review** (show the increment to stakeholders, adjust the backlog) and a **sprint retrospective** (how we worked, one or two improvements for next time). The sprint itself is the fifth event: the container for the other four.\n\nThe point of the loop is feedback: a working, inspected increment every sprint, and a team that adjusts both what it builds and how it builds it.",
      },
      {
        title: "Roles and artifacts",
        body: "Three accountabilities: the **product owner** orders the product backlog and owns what is worth doing; the **scrum master** owns the process working (coaching, removing impediments, protecting the sprint); the **developers** (everyone who builds, including operations engineers on a platform team) own how the work gets done and commit to the sprint goal together.\n\nThree artifacts: the **product backlog** (everything the product might need, ordered), the **sprint backlog** (the items chosen for this sprint plus the plan to deliver them, owned by the developers), and the **increment** (the working, usable result at the end of the sprint). Each has a commitment: the product goal, the sprint goal, and the **definition of done**, the shared checklist that makes 'done' mean the same thing for everyone (tested, reviewed, deployed, documented, monitored).",
      },
      {
        title: "Operations work inside a sprint",
        body: "Incidents do not wait for sprint planning. Healthy teams handle this explicitly rather than pretending it does not happen: reserve capacity for unplanned work (an on-call rotation whose sprint commitment is smaller, or a fixed percentage), make interrupts visible on the board the moment they arrive, and turn **postmortem actions into backlog items** with the product owner ordering them against features. If interrupts regularly eat the sprint, that is data for the retrospective and a reason to invest in reliability, not a reason to hide the work.\n\nEstimation is relative (story points or t-shirt sizes), and **velocity** (points completed per sprint) is a planning aid for the team, never a performance score for individuals.",
      },
      {
        title: "Failure modes to recognise",
        body: "The daily scrum becomes a status report to a manager instead of the developers re-planning together. Work is carried over sprint after sprint because items are too large or the definition of done is vague. The retrospective is skipped when the team is busy, which is exactly when it is needed. The sprint goal is a list of tickets rather than an outcome. 'Agile' is used to mean 'no planning'. Naming one of these, and what you did about it, is a strong interview story.",
      },
    ],
    glossary: [
      { term: "sprint", definition: "A fixed-length iteration (usually two weeks) that produces a usable increment." },
      { term: "sprint goal", definition: "The single outcome the sprint commits to; the backlog items are the means." },
      { term: "definition of done", definition: "The team's shared checklist for what 'done' includes (tested, reviewed, deployed, monitored)." },
      { term: "velocity", definition: "Points completed per sprint, used by the team to forecast; not an individual metric." },
      { term: "retrospective", definition: "The end-of-sprint meeting about how the team worked and what to change next sprint." },
      { term: "impediment", definition: "Anything blocking the developers that the scrum master works to remove." },
    ],
    hints: [
      { level: 1, title: "Events in order", body: "Planning → daily scrum (every day) → review → retrospective. The sprint contains them all." },
      { level: 2, title: "Who owns what", body: "Product owner: the ordered product backlog and what is worth doing. Developers: the sprint backlog and how. Scrum master: the process and the impediments." },
      { level: 3, title: "Unplanned work", body: "Make it visible, reserve capacity for it, and turn postmortem actions into ordered backlog items. Do not hide it and do not let it silently replace the sprint goal." },
      { level: 4, title: "Guided example", body: "Scenario answers: the incident follow-ups go into the product backlog for the product owner to order (not quietly into this sprint, not ignored); the daily scrum is for the developers to re-plan; carrying the same item over three sprints means it is too big or 'done' is unclear, so split it and fix the definition of done; the retrospective is where the 'on-call ate the sprint' problem belongs; velocity is a team forecast." },
    ],
    reflectionPrompts: ["Tell me about a time you worked in a sprint-based team. What was the sprint goal, what unplanned work hit the team, what did you personally do about it, and what changed afterwards?"],
    transferNote: "The posting asks for experience working in an Agile environment using Scrum. A lesson cannot give you that experience, but it gives you the vocabulary to describe the experience you do have precisely, and a STAR story structure to tell it.",
    scenario:
      "Sprint 14 at Nimbus Freight: two-week sprint, goal 'dispatchers can filter the map by vehicle status'. On day 3 a replication-lag incident takes the on-call engineer (you) out for a day and the postmortem lists four follow-up actions. On day 6 the product owner asks for a 'small' new report. The map-filter story has been carried over from sprints 12 and 13. The retrospective is usually skipped because the team is busy.",
    quiz: [
      { id: "q1", prompt: "Where should the four postmortem follow-up actions go?", options: ["Added quietly to the current sprint backlog by you, since you know the system", "Into the product backlog as items the product owner orders against the other work", "Ignored until the next incident proves they matter", "Assigned to the scrum master to complete"], correctIndex: 1, explanation: "Follow-ups are product work with a cost and a value; the product owner orders them in the product backlog. Hiding them in the sprint hides the cost of the incident." },
      { id: "q2", prompt: "What is the daily scrum for?", options: ["A status report so the manager knows who did what", "The developers inspecting progress toward the sprint goal and re-planning the next 24 hours", "The product owner adding new items", "Reviewing the increment with stakeholders"], correctIndex: 1, explanation: "The daily scrum belongs to the developers and is about adapting the plan, not reporting upward." },
      { id: "q3", prompt: "The map-filter story has been carried over from sprints 12 and 13. What does that most likely indicate?", options: ["The developers are slow and velocity should be used to flag who", "The story is too large or 'done' is unclear; split it and sharpen the definition of done", "Sprints should be longer", "The story should be dropped"], correctIndex: 1, explanation: "Repeated carry-over usually means the item is too big to finish in a sprint or nobody agrees what finished means. Velocity is a team forecast, not an individual score." },
      { id: "q4", prompt: "The product owner asks for a 'small' new report on day 6. What is the healthy response?", options: ["Add it; the product owner decides what the developers build during the sprint", "Discuss whether it fits the sprint goal; if it does not, it goes to the product backlog for the next planning, unless the team agrees to swap something out", "Refuse all changes until the sprint ends", "Have the scrum master build it"], correctIndex: 1, explanation: "The sprint goal is protected, but scope can be renegotiated with the developers. New work that does not serve the goal waits for the backlog and the next planning." },
      { id: "q5", prompt: "On-call took you out for a day and the team keeps missing sprint goals because of interrupts. Where does this belong?", options: ["In the retrospective, with a change such as reserved on-call capacity or reliability work ordered higher", "Nowhere; incidents are not part of Scrum", "In the sprint review, so stakeholders can blame the on-call engineer", "In a longer sprint"], correctIndex: 0, explanation: "The retrospective is where the team changes how it works: reserve capacity for interrupts, make them visible, and invest in reliability if they keep eating the sprint." },
      { id: "q6", prompt: "Who orders the product backlog?", options: ["The scrum master", "The developers by vote", "The product owner", "Whoever is on call"], correctIndex: 2, explanation: "The product owner is accountable for the ordered product backlog; developers own the sprint backlog and how the work gets done." },
    ],
    interviewCue:
      "Expect 'Tell me about working in an Agile team' or 'How do you handle unplanned work in a sprint'. Answer with STAR: the sprint goal (situation), your role in the team (task), what you personally did when the interrupt or the carried-over story hit (action: made it visible, split it, took the follow-ups to the backlog, raised it in the retrospective), and what changed in the next sprint (result). Use the vocabulary precisely and name one failure mode you helped fix.",
  },
];
