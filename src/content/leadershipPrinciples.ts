/**
 * Amazon Leadership Principles content for OpsForge interview practice.
 *
 * SOURCE: https://www.amazon.jobs/content/en/our-workplace/leadership-principles
 * (fallback: https://www.aboutamazon.com/about-us/leadership-principles)
 *
 * VERIFICATION STATUS (2026-10-08): UNVERIFIED. Both source URLs were
 * unreachable from the authoring environment (outbound network policy blocked
 * the request), so the `official` text below is reproduced from memory of the
 * published wording and SHOULD BE CHECKED against the live page before relying
 * on it. The principle names, order and count (16) match the published list.
 *
 * All questions, "listening for" notes, follow-ups and sample answers in this
 * file are PRACTICE EXAMPLES written for this app. They are not official or
 * guaranteed interview questions, and they are not Amazon guidance.
 *
 * Sample answers are fictional and generic. Never fabricate stories; use your
 * own real experience when practicing.
 */

import type { InterviewQuestion, LeadershipPrinciple } from "../domain/types";

export const LEADERSHIP_PRINCIPLES: LeadershipPrinciple[] = [
  {
    id: "customer-obsession",
    name: "Customer Obsession",
    official:
      "Leaders start with the customer and work backwards. They work vigorously to earn and keep customer trust. Although leaders pay attention to competitors, they obsess over customers.",
    plain:
      "Begin every decision by asking what the person who uses your work actually needs. Protect their trust, even when it is inconvenient for you. Watching competitors is fine, but the customer is the point.",
    evidence: [
      "You identified who the customer was (internal or external) and what they needed",
      "You went beyond the literal request to solve the real problem",
      "You made a trade-off in the customer's favor at some cost to yourself or your team",
      "You measured the outcome from the customer's point of view",
      "You followed up to confirm the fix actually helped",
    ],
    questions: [
      {
        id: "lp-customer-obsession-1",
        principleId: "customer-obsession",
        text: "Tell me about a time you went out of your way to help a customer or user.",
        listeningFor: ["Who the customer was", "What you personally did", "Observable result for the customer", "Why it mattered"],
        kind: "behavioral",
      },
      {
        id: "lp-customer-obsession-2",
        principleId: "customer-obsession",
        text: "Describe a time you had to balance what a customer asked for against what they actually needed.",
        listeningFor: ["How you discovered the real need", "How you handled the disagreement", "Outcome", "What you would do again"],
        kind: "behavioral",
      },
      {
        id: "lp-customer-obsession-3",
        principleId: "customer-obsession",
        text: "Tell me about a time a system or service you supported was failing for users. How did you find out and what did you do?",
        listeningFor: ["How you detected impact", "Prioritization of user impact over convenience", "Communication during the incident", "Follow-up to prevent recurrence"],
        kind: "technical",
      },
    ],
    followUps: [
      "Who exactly was the customer, and how did you know what they needed?",
      "What did you personally do, as opposed to the team?",
      "What did it cost you or your team to do that?",
      "How did you know the customer was better off afterward?",
    ],
    weakExample:
      "We had some unhappy users so we worked on it as a team and improved things. It went well and people seemed happier afterward.",
    strongExample:
      "At a small help desk, several staff kept reopening tickets about a shared printer that we had marked as fixed. I was asked to close the backlog, but I noticed the same three people were affected, so I walked over and watched them print. The real problem was a driver default that silently sent jobs to the wrong tray, not the hardware. I wrote a one-page fix, changed the default on their machines, and added the step to our setup checklist so new machines would not repeat it. Reopened tickets for that printer dropped from about five a week to zero over the next month. The lesson I took was that closing a ticket is not the same as solving the customer's problem, and five minutes of watching the user can replace hours of guessing.",
  },
  {
    id: "ownership",
    name: "Ownership",
    official:
      "Leaders are owners. They think long term and don't sacrifice long-term value for short-term results. They act on behalf of the entire company, beyond just their own team. They never say \"that's not my job.\"",
    plain:
      "Treat problems as yours even when they are not assigned to you. Think about what is best over months and years, not just this week. Do not pass a problem along just because it belongs to another team.",
    evidence: [
      "You took responsibility for something outside your formal role",
      "You stayed with a problem until it was actually resolved",
      "You chose a durable fix over a quick patch, or explained why not",
      "You considered impact on other teams or the whole organization",
      "You owned a mistake rather than deflecting it",
    ],
    questions: [
      {
        id: "lp-ownership-1",
        principleId: "ownership",
        text: "Tell me about a time you took on something that was not your responsibility.",
        listeningFor: ["Why you stepped in", "Specific actions you took", "Result", "How you balanced it with your own work"],
        kind: "behavioral",
      },
      {
        id: "lp-ownership-2",
        principleId: "ownership",
        text: "Describe a time you chose a long-term solution even though a short-term one was easier.",
        listeningFor: ["The trade-off you saw", "How you justified the extra effort", "Outcome over time", "Lesson"],
        kind: "behavioral",
      },
      {
        id: "lp-ownership-3",
        principleId: "ownership",
        text: "Tell me about a recurring operational issue you decided to fix permanently rather than keep working around.",
        listeningFor: ["Root cause you identified", "What you changed (script, config, process)", "Measurable reduction in recurrence", "Documentation or handoff"],
        kind: "technical",
      },
    ],
    followUps: [
      "What did you personally do?",
      "Why was this not someone else's job, and what made you take it on?",
      "What would have happened if you had done nothing?",
      "How did you make sure it stayed fixed after you moved on?",
    ],
    weakExample:
      "There was a problem nobody wanted to deal with, so we handled it. It was not really our job but we got it done and moved on.",
    strongExample:
      "In a volunteer group I was part of, the shared laptop used for sign-ins kept failing on event days, and everyone just rebooted it and hoped. Nobody was assigned to it, but I was tired of watching people line up, so I took it on. I checked the logs after one failure, found the disk was nearly full from old photo exports, and cleaned it up. Then I wrote a short monthly checklist and a small script that warned when free space dropped below a threshold. The laptop did not fail at any of the next eight events, and another volunteer was able to follow the checklist without me. I learned that owning a problem means leaving behind something that works when you are not there.",
  },
  {
    id: "invent-and-simplify",
    name: "Invent and Simplify",
    official:
      "Leaders expect and require innovation and invention from their teams and always find ways to simplify. They are externally aware, look for new ideas from everywhere, and are not limited by \"not invented here.\" As we do new things, we accept that we may be misunderstood for long periods of time.",
    plain:
      "Look for ways to do things better and with fewer steps. Borrow good ideas from anywhere instead of insisting on building your own. Expect that a genuinely new approach may not be understood at first.",
    evidence: [
      "You removed steps, tools or complexity from a process",
      "You adopted an idea from outside your team rather than reinventing it",
      "You tried something new and handled the uncertainty",
      "The simplification had a measurable effect (time, errors, cost)",
      "You explained the change to people who did not understand it at first",
    ],
    questions: [
      {
        id: "lp-invent-and-simplify-1",
        principleId: "invent-and-simplify",
        text: "Tell me about a time you simplified a process or a system.",
        listeningFor: ["What was complex and why", "Your specific change", "Measured improvement", "Resistance you handled"],
        kind: "behavioral",
      },
      {
        id: "lp-invent-and-simplify-2",
        principleId: "invent-and-simplify",
        text: "Describe a time you found a new approach to an old problem.",
        listeningFor: ["Where the idea came from", "How you tested it", "Outcome", "What you would change"],
        kind: "behavioral",
      },
      {
        id: "lp-invent-and-simplify-3",
        principleId: "invent-and-simplify",
        text: "Tell me about a manual task you automated. How did you decide it was worth automating?",
        listeningFor: ["Frequency and cost of the manual task", "Tool or script you built", "Time saved or errors removed", "How you handled failure cases"],
        kind: "technical",
      },
    ],
    followUps: [
      "What alternatives did you consider before choosing that approach?",
      "How did you measure that it was actually simpler?",
      "What did you remove, not just add?",
      "Who pushed back, and how did you respond?",
    ],
    weakExample:
      "Our process was slow, so we came up with a better way of doing it. The new way was simpler and everyone liked it more.",
    strongExample:
      "In a school lab job I was asked to reimage about thirty machines each term, and the written procedure had fourteen manual steps. I had to finish within two days each term, and I was making mistakes on the last few machines because of fatigue. I timed each step, found that nine of them could be scripted, and borrowed a free imaging tool another campus already used instead of writing my own. I cut the procedure to five steps, tested it on three machines, then rolled it out. The next term I finished in one afternoon with zero machines needing rework, down from four the previous term. I learned to measure before simplifying so I could prove the change worked instead of just feeling it was better.",
  },
  {
    id: "are-right-a-lot",
    name: "Are Right, A Lot",
    official:
      "Leaders are right a lot. They have strong judgment and good instincts. They seek diverse perspectives and work to disconfirm their beliefs.",
    plain:
      "Make good decisions, and get better at it by checking your own assumptions. Ask people who see things differently. Being right a lot comes from testing your beliefs, not from being stubborn.",
    evidence: [
      "You made a judgment call with incomplete information and explained your reasoning",
      "You actively looked for evidence that you were wrong",
      "You changed your mind when the data said to",
      "You asked people with different views before deciding",
      "The decision turned out well, or you learned clearly from it",
    ],
    questions: [
      {
        id: "lp-are-right-a-lot-1",
        principleId: "are-right-a-lot",
        text: "Tell me about a time you had to make a decision without all the information you wanted.",
        listeningFor: ["What you knew and did not know", "How you reasoned", "Outcome", "What you would do differently"],
        kind: "behavioral",
      },
      {
        id: "lp-are-right-a-lot-2",
        principleId: "are-right-a-lot",
        text: "Describe a time you were wrong about something and how you found out.",
        listeningFor: ["Honesty about the error", "How you discovered it", "What you changed", "Lesson about judgment"],
        kind: "behavioral",
      },
      {
        id: "lp-are-right-a-lot-3",
        principleId: "are-right-a-lot",
        text: "Tell me about a time you diagnosed a technical problem and your first theory was wrong.",
        listeningFor: ["Your initial hypothesis and why", "How you tested it", "How you reached the real cause", "What you changed in your approach"],
        kind: "technical",
      },
    ],
    followUps: [
      "What evidence did you base that on?",
      "Who did you ask, and did anyone disagree?",
      "What would have changed your mind?",
      "Looking back, was it the right call? How do you know?",
    ],
    weakExample:
      "I usually have good instincts, so I went with my gut and it worked out. The team agreed it was the right decision.",
    strongExample:
      "While helping a small business with its network, the owner was sure a slow website was caused by the internet provider and wanted to switch plans. I was asked to confirm that, but I was not convinced, so I ran speed tests at several times of day and checked the router logs. The connection was fine; the slowness came from a backup job that ran every afternoon and saturated the uplink. I showed the owner the timing match and suggested moving the backup to overnight before spending money on a new plan. After the change, afternoon page loads went from roughly eight seconds to under two, and no plan change was needed. The lesson for me was to test the most popular theory first rather than accept it, because the obvious answer is often wrong.",
  },
  {
    id: "learn-and-be-curious",
    name: "Learn and Be Curious",
    official:
      "Leaders are never done learning and always seek to improve themselves. They are curious about new possibilities and act to explore them.",
    plain:
      "Keep learning, on purpose, even when nobody requires it. Be curious about how things work and about ideas outside your current job. Curiosity should turn into action, not just interest.",
    evidence: [
      "You learned a new skill or tool to solve a real problem",
      "You can describe how you learn (resources, practice, feedback)",
      "You explored something beyond your immediate task",
      "You applied what you learned and can show the result",
      "You admit what you still do not know",
    ],
    questions: [
      {
        id: "lp-learn-and-be-curious-1",
        principleId: "learn-and-be-curious",
        text: "Tell me about a time you had to learn something quickly to get a job done.",
        listeningFor: ["What you needed to learn and why", "How you learned it", "How fast and how well", "What you did with it"],
        kind: "behavioral",
      },
      {
        id: "lp-learn-and-be-curious-2",
        principleId: "learn-and-be-curious",
        text: "What is something you taught yourself recently, and how did you go about it?",
        listeningFor: ["Self-direction", "Concrete method", "Evidence of progress", "Honesty about gaps"],
        kind: "behavioral",
      },
      {
        id: "lp-learn-and-be-curious-3",
        principleId: "learn-and-be-curious",
        text: "Tell me about a time you dug into a technology you did not understand because something was behaving strangely.",
        listeningFor: ["What triggered your curiosity", "How you investigated", "What you discovered", "How it changed your work"],
        kind: "technical",
      },
    ],
    followUps: [
      "How did you decide what to learn first?",
      "What resources did you use, and which were actually useful?",
      "How do you know you learned it well enough?",
      "What are you learning right now?",
    ],
    weakExample:
      "I am always learning new things and I like to stay curious. When something new comes up we figure it out together as a team.",
    strongExample:
      "In a part-time support role I was asked to help with a Linux file server even though I had only ever used Windows. The task was to find out why a shared folder kept losing permissions after each reboot, and nobody else was available. I spent two evenings working through a free Linux basics course, then read the documentation for the specific permission system the server used. I found that a startup script was resetting ownership, and I wrote down each command I ran so I could explain it. I fixed the script, the folder kept its permissions through the next ten reboots, and my notes became the team's first Linux troubleshooting page. I learned that I could pick up an unfamiliar system quickly if I focused on the one problem in front of me rather than trying to learn everything first.",
  },
  {
    id: "hire-and-develop-the-best",
    name: "Hire and Develop the Best",
    official:
      "Leaders raise the performance bar with every hire and promotion. They recognize exceptional talent, and willingly move them throughout the organization. Leaders develop leaders and take seriously their role in coaching others. We work on behalf of our people to invent mechanisms for development like Career Choice.",
    plain:
      "Help the people around you get better, and hold a high bar for who joins the team. Even if you are not a manager, you can coach, mentor and share what you know. Recognize talent and help it grow, even if that means it moves elsewhere.",
    evidence: [
      "You helped someone else improve a skill, with a visible result",
      "You gave honest, specific feedback",
      "You shared knowledge so others did not depend on you",
      "You recognized someone's strength and created an opportunity for them",
      "You took feedback yourself and acted on it",
    ],
    questions: [
      {
        id: "lp-hire-and-develop-the-best-1",
        principleId: "hire-and-develop-the-best",
        text: "Tell me about a time you helped someone else grow or learn.",
        listeningFor: ["What they needed", "Your specific coaching actions", "Their observable improvement", "What you learned about teaching"],
        kind: "behavioral",
      },
      {
        id: "lp-hire-and-develop-the-best-2",
        principleId: "hire-and-develop-the-best",
        text: "Describe a time you gave difficult feedback to a peer.",
        listeningFor: ["Why it was needed", "How you delivered it", "How they responded", "Outcome"],
        kind: "behavioral",
      },
      {
        id: "lp-hire-and-develop-the-best-3",
        principleId: "hire-and-develop-the-best",
        text: "Tell me about a time you onboarded or trained someone on a technical system or runbook.",
        listeningFor: ["How you structured the training", "How you checked understanding", "Whether they could work independently afterward", "Improvements you made to the material"],
        kind: "technical",
      },
    ],
    followUps: [
      "What specifically did you do to help them, beyond answering questions?",
      "How did you know they had improved?",
      "What feedback have you received about your own coaching?",
      "What would you do differently next time?",
    ],
    weakExample:
      "I enjoy helping teammates and I am always willing to answer questions. The new people on our team picked things up pretty fast.",
    strongExample:
      "When a new volunteer joined our community tech-help table, she was nervous about resetting passwords and kept asking me to do it for her. I was responsible for the table that month, and I realized that doing it for her would keep her dependent on me. I wrote a short checklist, sat beside her for her first three resets without touching the keyboard, and gave one specific piece of feedback after each. By the fourth session she handled a reset alone, and by the end of the month she was teaching the checklist to the next newcomer. Reset requests at the table were handled about twice as fast because two of us could take them. I learned that the fastest way to help someone is often to stop doing the task for them.",
  },
  {
    id: "insist-on-the-highest-standards",
    name: "Insist on the Highest Standards",
    official:
      "Leaders have relentlessly high standards — many people may think these standards are unreasonably high. Leaders are continually raising the bar and drive their teams to deliver high quality products, services, and processes. Leaders ensure that defects do not get sent down the line and that problems are fixed so they stay fixed.",
    plain:
      "Do not accept work that is almost right. Catch problems before they reach the next person, and fix them so they do not come back. Keep raising what counts as good enough.",
    evidence: [
      "You caught a defect before it reached users or the next step",
      "You refused to ship or sign off on something that was not ready, and explained why",
      "You fixed a root cause rather than a symptom",
      "You raised a standard (checklist, test, review) for the whole team",
      "You balanced high standards with deadlines in a reasonable way",
    ],
    questions: [
      {
        id: "lp-insist-on-the-highest-standards-1",
        principleId: "insist-on-the-highest-standards",
        text: "Tell me about a time you were not satisfied with the quality of something and pushed to improve it.",
        listeningFor: ["What the standard was and why it mattered", "Your actions", "Result", "How others reacted"],
        kind: "behavioral",
      },
      {
        id: "lp-insist-on-the-highest-standards-2",
        principleId: "insist-on-the-highest-standards",
        text: "Describe a time you had to choose between meeting a deadline and doing it right.",
        listeningFor: ["How you weighed the trade-off", "Who you involved", "Outcome", "Lesson"],
        kind: "behavioral",
      },
      {
        id: "lp-insist-on-the-highest-standards-3",
        principleId: "insist-on-the-highest-standards",
        text: "Tell me about a time you added a check, test or review step that stopped a recurring class of errors.",
        listeningFor: ["The defect pattern you saw", "The mechanism you added", "Error rate before and after", "Whether it is still in use"],
        kind: "technical",
      },
    ],
    followUps: [
      "What was the standard, and who set it?",
      "What would have happened if you had let it go?",
      "How did you make sure the problem stayed fixed?",
      "Did anyone think you were being unreasonable? How did you handle that?",
    ],
    weakExample:
      "I have high standards and I always try to do quality work. We double-checked everything before release and it went smoothly.",
    strongExample:
      "In a student project, I was responsible for the deployment script, and twice in one month a deploy broke because someone committed a config file with a missing value. The rest of the group wanted to just be more careful, but I did not think careful was a plan. I wrote a small validation script that checked every required key before a deploy could start, and I added it as a required step so nobody could skip it. It failed the very next deploy attempt, caught the missing value, and the fix took two minutes instead of an evening of debugging. We had zero config-related deploy failures for the remaining four months of the project. What I took away is that a standard is only real when there is a mechanism enforcing it, not just a reminder to be careful.",
  },
  {
    id: "think-big",
    name: "Think Big",
    official:
      "Thinking small is a self-fulfilling prophecy. Leaders create and communicate a bold direction that inspires results. They think differently and look around corners for ways to serve customers.",
    plain:
      "Aim higher than the obvious next step. Ask what the best possible outcome would look like, then work toward it. Share that direction so others can rally around it.",
    evidence: [
      "You proposed something bigger than what was asked",
      "You connected a small task to a larger goal",
      "You anticipated a future need and acted early",
      "You communicated a direction that others followed",
      "You balanced ambition with a realistic first step",
    ],
    questions: [
      {
        id: "lp-think-big-1",
        principleId: "think-big",
        text: "Tell me about a time you proposed an idea that was bigger than what was expected of you.",
        listeningFor: ["What you saw that others did not", "How you made the case", "What happened", "What you learned about ambition"],
        kind: "behavioral",
      },
      {
        id: "lp-think-big-2",
        principleId: "think-big",
        text: "Describe a goal you set for yourself that seemed out of reach at the time.",
        listeningFor: ["Why you chose it", "The plan you made", "Progress and outcome", "What you would tell someone else"],
        kind: "behavioral",
      },
      {
        id: "lp-think-big-3",
        principleId: "think-big",
        text: "Tell me about a time you solved a problem for one user or system in a way that could scale to many.",
        listeningFor: ["The one-off problem", "How you generalized it", "Who else benefited", "Trade-offs of the broader solution"],
        kind: "technical",
      },
    ],
    followUps: [
      "What was the smallest version you could have done, and why did you go bigger?",
      "How did you convince others?",
      "What risks did the bigger plan bring, and how did you handle them?",
      "What is the long-term impact?",
    ],
    weakExample:
      "I like to think big and dream about where things could go. We had a lot of ambitious ideas on the team and some of them worked out.",
    strongExample:
      "I was asked to write a one-page guide to help a single coworker set up her development laptop. While writing it, I realized every new person on our small team had the same two days of setup pain, and nobody had fixed it. I proposed turning the guide into a setup script plus a checklist for the whole team, and I spent two extra evenings building and testing it on a clean machine. I showed my lead a before-and-after: two days of manual setup versus about forty minutes with the script. The team adopted it, the next three hires used it, and one of them improved it further. I learned that the request in front of you is often a sample of a bigger problem, and solving the bigger one can cost only a little more.",
  },
  {
    id: "bias-for-action",
    name: "Bias for Action",
    official:
      "Speed matters in business. Many decisions and actions are reversible and do not need extensive study. We value calculated risk taking.",
    plain:
      "Do not wait for perfect information when a decision is easy to undo. Move quickly on reversible choices, and save careful study for the ones that are hard to reverse. Take sensible risks on purpose.",
    evidence: [
      "You acted quickly when waiting had a real cost",
      "You distinguished reversible from irreversible decisions",
      "You took a calculated risk and explained the calculation",
      "You moved forward with incomplete information and adjusted as you learned",
      "You can describe what you would have done if it went wrong",
    ],
    questions: [
      {
        id: "lp-bias-for-action-1",
        principleId: "bias-for-action",
        text: "Tell me about a time you had to act quickly without complete information.",
        listeningFor: ["What was at stake", "Why waiting was worse", "Your decision and safeguards", "Outcome"],
        kind: "behavioral",
      },
      {
        id: "lp-bias-for-action-2",
        principleId: "bias-for-action",
        text: "Describe a time you took a calculated risk.",
        listeningFor: ["What the risk was", "How you sized it", "Your backup plan", "Result and lesson"],
        kind: "behavioral",
      },
      {
        id: "lp-bias-for-action-3",
        principleId: "bias-for-action",
        text: "Tell me about an outage or urgent issue where you had to decide between investigating further and restoring service.",
        listeningFor: ["How you judged user impact", "What you did first and why", "How you preserved evidence for later", "Time to recovery"],
        kind: "technical",
      },
    ],
    followUps: [
      "What made this decision reversible or not?",
      "What was your plan if it did not work?",
      "How long did you wait before acting, and why that long?",
      "Was there a case where you should have slowed down instead?",
    ],
    weakExample:
      "I am a fast mover and I do not like to overthink things. When the issue came up we just jumped on it and it got resolved.",
    strongExample:
      "During a weekend shift at a small shop, the point-of-sale system stopped syncing with the inventory service and the line was growing. I was the only technical person there and had no documentation for the sync. I quickly confirmed that the sales themselves were still being recorded locally, which meant restarting the sync service was low risk and reversible. I saved a copy of the log first, restarted the service, and sales started syncing again within two minutes. Later I used the saved log to find that a certificate had expired, and I wrote a reminder so it would be renewed before the next expiry. I learned to ask what the worst case of acting is, and when it is small, to act and investigate afterward.",
  },
  {
    id: "frugality",
    name: "Frugality",
    official:
      "Accomplish more with less. Constraints breed resourcefulness, self-sufficiency, and invention. There are no extra points for growing headcount, budget size, or fixed expense.",
    plain:
      "Get results without reaching for more money, people or tools first. Treat limits as a reason to be creative. Spending more is not an achievement by itself.",
    evidence: [
      "You solved a problem with existing tools instead of buying new ones",
      "You reduced cost, waste or effort with a measurable number",
      "You questioned whether a resource was really needed",
      "A constraint pushed you to a better solution",
      "You distinguished saving money from cutting corners",
    ],
    questions: [
      {
        id: "lp-frugality-1",
        principleId: "frugality",
        text: "Tell me about a time you accomplished something with limited resources.",
        listeningFor: ["What the constraint was", "Creative approach", "Result", "What you would not cut"],
        kind: "behavioral",
      },
      {
        id: "lp-frugality-2",
        principleId: "frugality",
        text: "Describe a time you found a way to save money, time or effort.",
        listeningFor: ["How you spotted the waste", "Your change", "Measured savings", "Any trade-offs"],
        kind: "behavioral",
      },
      {
        id: "lp-frugality-3",
        principleId: "frugality",
        text: "Tell me about a time you avoided buying or building a new tool by making better use of what you already had.",
        listeningFor: ["What was proposed", "What existing capability you used instead", "Result", "When buying would have been right"],
        kind: "technical",
      },
    ],
    followUps: [
      "What would it have cost to do it the expensive way?",
      "How did you measure the saving?",
      "Did the cheaper approach have downsides?",
      "When is spending more the right call?",
    ],
    weakExample:
      "We did not have a big budget, so we made do with what we had. It was a bit of a struggle but we managed to finish.",
    strongExample:
      "A club I helped run wanted to buy a monitoring subscription for its small website after it went down unnoticed for a weekend. I was asked to price options, and the cheapest plan would have used most of our yearly tech budget. Instead, I set up a free scheduled job that checked the site every ten minutes and sent an email to two of us if it failed, and I tested it by taking the site down on purpose. The check caught the next real outage within ten minutes and we restored it within the hour. We spent nothing, and the remaining budget covered a needed hosting upgrade instead. I learned that the first question is not which product to buy, but whether the problem can be solved with something already available.",
  },
  {
    id: "earn-trust",
    name: "Earn Trust",
    official:
      "Leaders listen attentively, speak candidly, and treat others respectfully. They are vocally self-critical, even when doing so is awkward or embarrassing. Leaders do not believe their or their team's body odor smells of perfume. They benchmark themselves and their teams against the best.",
    plain:
      "Be honest, including about your own mistakes, and listen to others properly. Treat people with respect even in disagreement. Compare your work to the best, not just to what is comfortable.",
    evidence: [
      "You admitted a mistake openly and early",
      "You delivered unwelcome news honestly and respectfully",
      "You listened and changed your view based on what you heard",
      "You kept a commitment, or communicated early when you could not",
      "You gave credit accurately",
    ],
    questions: [
      {
        id: "lp-earn-trust-1",
        principleId: "earn-trust",
        text: "Tell me about a time you had to admit a mistake to your team or a customer.",
        listeningFor: ["What went wrong and your role in it", "How quickly and how you disclosed it", "What you did to fix it", "Effect on the relationship"],
        kind: "behavioral",
      },
      {
        id: "lp-earn-trust-2",
        principleId: "earn-trust",
        text: "Describe a time you had to build trust with someone who was skeptical of you.",
        listeningFor: ["Why they were skeptical", "Concrete actions over time", "Signs trust improved", "Lesson"],
        kind: "behavioral",
      },
      {
        id: "lp-earn-trust-3",
        principleId: "earn-trust",
        text: "Tell me about a time you had to tell stakeholders that a system was less reliable or further behind than they believed.",
        listeningFor: ["Evidence you gathered", "How you communicated the bad news", "How you proposed to fix it", "Reaction and outcome"],
        kind: "technical",
      },
    ],
    followUps: [
      "What did you say, as close to word-for-word as you can remember?",
      "What was the hardest part of being honest in that moment?",
      "How did the other person respond?",
      "How do you know trust was actually earned?",
    ],
    weakExample:
      "I think I am a pretty trustworthy person and people generally rely on me. We had a few bumps on the team but we worked through them.",
    strongExample:
      "While updating a spreadsheet of user accounts for a small nonprofit, I accidentally overwrote a column with stale data and did not notice until the next morning. I was responsible for the file and nobody else would have known it was me. I told the coordinator right away, explained exactly what had happened, and showed her the backup copy from the previous day that I had already restored. I then added a simple step of exporting a dated copy before every edit and shared it with the two other people who touched the file. The data was back within an hour, and a few weeks later she asked me to take over the accounts process entirely. I learned that owning a mistake quickly and with a fix in hand builds more trust than never being seen to make one.",
  },
  {
    id: "dive-deep",
    name: "Dive Deep",
    official:
      "Leaders operate at all levels, stay connected to the details, audit frequently, and are skeptical when metrics and anecdote differ. No task is beneath them.",
    plain:
      "Know the details of your own work, and check them yourself. When the numbers and the stories do not match, dig in until you understand why. Be willing to do the unglamorous work.",
    evidence: [
      "You went to the raw data, logs or source rather than trusting a summary",
      "You noticed a mismatch between a metric and what people were saying",
      "You found a root cause several layers below the symptom",
      "You can explain the details of your own work clearly",
      "You did a tedious task yourself because it mattered",
    ],
    questions: [
      {
        id: "lp-dive-deep-1",
        principleId: "dive-deep",
        text: "Tell me about a time you discovered a problem by looking closely at the details.",
        listeningFor: ["What prompted you to look", "What you examined", "What you found", "Impact"],
        kind: "behavioral",
      },
      {
        id: "lp-dive-deep-2",
        principleId: "dive-deep",
        text: "Describe a time the data told a different story than what people believed.",
        listeningFor: ["The mismatch you noticed", "How you investigated", "What was true", "How you communicated it"],
        kind: "behavioral",
      },
      {
        id: "lp-dive-deep-3",
        principleId: "dive-deep",
        text: "Walk me through the most difficult technical problem you have debugged. How did you find the root cause?",
        listeningFor: ["Systematic method", "Tools and evidence used (logs, metrics, reproduction)", "Root cause, not just symptom", "Prevention afterward"],
        kind: "technical",
      },
    ],
    followUps: [
      "What exactly did you look at? Which logs, numbers or files?",
      "What did you rule out, and how?",
      "How deep did you go, and when did you decide you had gone deep enough?",
      "Could you explain the root cause to me right now?",
    ],
    weakExample:
      "There was a tricky bug and we dug into it and eventually found the problem. It took a while but we sorted it out.",
    strongExample:
      "A report I maintained for a small team showed that our ticket response time had improved to under an hour, but the people submitting tickets kept saying it felt slower. I was asked to confirm the metric was right, and I could have just pointed to the dashboard. Instead I pulled the raw ticket exports for the month and read through about two hundred rows. I found that an auto-reply was being counted as the first response, so the metric measured a bot, not a person. I corrected the query to count the first human reply, which showed the real average was closer to four hours, and I shared both numbers openly. With the true number visible, the team changed its rota and brought the human response time down to under two hours within six weeks. I learned to be most suspicious of a metric when it disagrees with what people are experiencing.",
  },
  {
    id: "have-backbone-disagree-and-commit",
    name: "Have Backbone; Disagree and Commit",
    official:
      "Leaders are obligated to respectfully challenge decisions when they disagree, even when doing so is uncomfortable or exhausting. Leaders have conviction and are tenacious. They do not compromise for the sake of social cohesion. Once a decision is determined, they commit wholly.",
    plain:
      "Speak up when you disagree, with reasons, even if it is uncomfortable. Do not go quiet just to keep the peace. Once the decision is made, support it fully instead of undermining it.",
    evidence: [
      "You disagreed with someone senior or with the group, respectfully and with reasons",
      "You used data or evidence rather than just opinion",
      "You committed fully after losing the argument",
      "You separated the disagreement from the relationship",
      "You can say whether you were right, honestly",
    ],
    questions: [
      {
        id: "lp-have-backbone-disagree-and-commit-1",
        principleId: "have-backbone-disagree-and-commit",
        text: "Tell me about a time you disagreed with a decision and how you handled it.",
        listeningFor: ["What you disagreed with and why", "How you raised it", "What was decided", "How you behaved afterward"],
        kind: "behavioral",
      },
      {
        id: "lp-have-backbone-disagree-and-commit-2",
        principleId: "have-backbone-disagree-and-commit",
        text: "Describe a time you had to commit to a plan you did not agree with.",
        listeningFor: ["Your objection", "Why you committed anyway", "How fully you supported it", "What you learned"],
        kind: "behavioral",
      },
      {
        id: "lp-have-backbone-disagree-and-commit-3",
        principleId: "have-backbone-disagree-and-commit",
        text: "Tell me about a time you pushed back on a technical approach you believed was risky.",
        listeningFor: ["The specific risk you saw", "Evidence you brought", "How the decision was made", "Outcome and whether your concern was valid"],
        kind: "technical",
      },
    ],
    followUps: [
      "What exactly did you say, and to whom?",
      "What evidence did you bring to the disagreement?",
      "After the decision went against you, what did you do?",
      "Were you right? How do you know?",
    ],
    weakExample:
      "I did not really agree with the plan, but I did not want to cause problems so I went along with it. In the end it worked out okay I guess.",
    strongExample:
      "In a group project, the team lead wanted to store user passwords in plain text in a database to save time before a demo. I was responsible for the login feature, and I said I thought that was a serious risk even for a demo. I showed the group how a standard hashing library would take about an hour to add, and offered to do it myself that evening. The lead still decided the demo came first and we would fix it afterward, so I agreed, delivered the demo version on time, and did not complain about it to others. Immediately after the demo I added the hashing, and it took about ninety minutes. I learned that I can disagree clearly and still be a reliable teammate, and that offering to do the work makes a disagreement much easier to hear.",
  },
  {
    id: "deliver-results",
    name: "Deliver Results",
    official:
      "Leaders focus on the key inputs for their business and deliver them with the right quality and in a timely fashion. Despite setbacks, they rise to the occasion and never settle.",
    plain:
      "Finish what matters, on time and at the right quality. Identify the few inputs that drive the outcome and focus on those. When things go wrong, push through rather than lowering the bar.",
    evidence: [
      "You delivered something concrete, with a date and a measurable outcome",
      "You identified the key inputs and focused on them",
      "You overcame a setback without quietly dropping scope or quality",
      "You communicated honestly about risks to delivery",
      "You can state the result in numbers or observable facts",
    ],
    questions: [
      {
        id: "lp-deliver-results-1",
        principleId: "deliver-results",
        text: "Tell me about a time you delivered something important under a tight deadline.",
        listeningFor: ["What was at stake", "How you prioritized", "What you delivered and when", "Quality of the result"],
        kind: "behavioral",
      },
      {
        id: "lp-deliver-results-2",
        principleId: "deliver-results",
        text: "Describe a time you faced a major setback and still achieved your goal.",
        listeningFor: ["The setback", "Your response", "Adjustments you made", "Final result"],
        kind: "behavioral",
      },
      {
        id: "lp-deliver-results-3",
        principleId: "deliver-results",
        text: "Tell me about a migration, rollout or project you completed. How did you measure that it was done?",
        listeningFor: ["Clear definition of done", "Milestones and how you tracked them", "Measured result", "What slipped and why"],
        kind: "technical",
      },
    ],
    followUps: [
      "What was the measurable result?",
      "What did you personally deliver versus the team?",
      "What did you have to give up or deprioritize?",
      "What was the biggest obstacle, and what did you do about it?",
    ],
    weakExample:
      "We had a big project with a tight timeline and we worked hard to get it done. It launched and the stakeholders were happy with the result.",
    strongExample:
      "I was responsible for moving a community group's member records from an old spreadsheet into a new sign-up system before the renewal drive, with three weeks to do it. A week in, I found that about a third of the email addresses were in an inconsistent format and would fail import. Rather than push the date, I wrote a small cleanup script, ran it on a copy, and fixed the remaining forty records by hand over two evenings. I sent a short status note each week so the organizers knew exactly where I was. The import completed two days early with all 612 records loaded and only three needing manual follow-up afterward. I learned to define done in numbers up front, because it made every decision about what to cut or keep much simpler.",
  },
  {
    id: "strive-to-be-earths-best-employer",
    name: "Strive to be Earth's Best Employer",
    official:
      "Leaders work every day to create a safer, more productive, higher performing, more diverse, and more just work environment. They lead with empathy, have fun at work, and make it easy for others to have fun. Leaders ask themselves: Are my fellow employees growing? Are they empowered? Are they ready for what's next? Leaders have a vision for and commitment to their employees' personal success, whether that be at Amazon or elsewhere.",
    plain:
      "Help make the place you work safer, fairer and better for the people around you. Care about whether your colleagues are growing and feel able to act. You do not need to be a manager to make work better for others.",
    evidence: [
      "You improved safety, fairness or wellbeing for colleagues in a concrete way",
      "You noticed someone struggling and acted with empathy",
      "You made it easier for others to speak up or contribute",
      "You supported a colleague's growth even when it did not benefit you",
      "You helped make work more enjoyable without lowering the bar",
    ],
    questions: [
      {
        id: "lp-strive-to-be-earths-best-employer-1",
        principleId: "strive-to-be-earths-best-employer",
        text: "Tell me about a time you made your team or workplace better for the people in it.",
        listeningFor: ["What you noticed", "What you did", "Effect on others", "Why it mattered to you"],
        kind: "behavioral",
      },
      {
        id: "lp-strive-to-be-earths-best-employer-2",
        principleId: "strive-to-be-earths-best-employer",
        text: "Describe a time you supported a colleague who was struggling.",
        listeningFor: ["How you noticed", "Empathy and respect", "Practical help you gave", "Outcome for them"],
        kind: "behavioral",
      },
      {
        id: "lp-strive-to-be-earths-best-employer-3",
        principleId: "strive-to-be-earths-best-employer",
        text: "Tell me about a time you changed a process, on-call rota or tooling to reduce stress or risk for the people doing the work.",
        listeningFor: ["The burden you saw", "Your change", "Measured or observed relief", "Whether quality held"],
        kind: "technical",
      },
    ],
    followUps: [
      "How did you know this was a problem for others and not just for you?",
      "What did you personally change?",
      "How did people respond?",
      "What did it cost, and was it worth it?",
    ],
    weakExample:
      "I try to be a positive presence on the team and keep morale up. We have a good culture and everyone gets along well.",
    strongExample:
      "On a small support team, the person on the late shift was expected to handle every alert alone, and I noticed one colleague looked exhausted and had started making small mistakes. I was not her manager, but I was the one who maintained the alerting rules. I reviewed a month of alerts and found that about sixty percent were noise from a test system, so I proposed silencing those and documented why each one was safe to drop. I also suggested a simple rule that nobody works two late shifts in a row, which the lead accepted. Late-shift alerts dropped from roughly twenty a night to eight, and my colleague told me a few weeks later that she was sleeping properly again. I learned that the most useful thing I can do for a teammate is often to fix the system that is wearing them down.",
  },
  {
    id: "success-and-scale-bring-broad-responsibility",
    name: "Success and Scale Bring Broad Responsibility",
    official:
      "We started in a garage, but we're not there anymore. We are big, we impact the world, and we are far from perfect. We must be humble and thoughtful about even the secondary effects of our actions. Our local communities, planet, and future generations need us to be better every day. We must begin each day with a determination to make better, do better, and be better for our customers, our employees, our partners, and the world at large. And we must end every day knowing we can do even more tomorrow. Leaders create more than they consume and always leave things better than how they found them.",
    plain:
      "When your work affects many people, think about the side effects, not just the main goal. Be humble about mistakes and their reach. Leave every system, team and community better than you found it.",
    evidence: [
      "You considered the secondary effects of a change before making it",
      "You thought about people outside your immediate team or customer",
      "You left something (code, docs, process, community) better than you found it",
      "You showed humility about the impact of a mistake",
      "You weighed ethics or sustainability, not just speed",
    ],
    questions: [
      {
        id: "lp-success-and-scale-bring-broad-responsibility-1",
        principleId: "success-and-scale-bring-broad-responsibility",
        text: "Tell me about a time you considered the wider impact of a decision beyond your immediate goal.",
        listeningFor: ["Who else was affected", "How you weighed it", "What you changed", "Outcome"],
        kind: "behavioral",
      },
      {
        id: "lp-success-and-scale-bring-broad-responsibility-2",
        principleId: "success-and-scale-bring-broad-responsibility",
        text: "Describe a time you left something better than you found it, even though you did not have to.",
        listeningFor: ["What state it was in", "What you improved", "Who benefited afterward", "Why you did it"],
        kind: "behavioral",
      },
      {
        id: "lp-success-and-scale-bring-broad-responsibility-3",
        principleId: "success-and-scale-bring-broad-responsibility",
        text: "Tell me about a time a change you made had an unexpected side effect on another system or group. What did you do?",
        listeningFor: ["How you discovered the side effect", "How you took responsibility", "Remediation", "What you changed about how you plan changes"],
        kind: "technical",
      },
    ],
    followUps: [
      "Who else was affected, and did you talk to them?",
      "What secondary effects did you consider, and which did you miss?",
      "What did you leave behind for the next person?",
      "If you could do it again, what would you weigh differently?",
    ],
    weakExample:
      "I think it is important to be responsible and consider the bigger picture. We always try to do the right thing as a team.",
    strongExample:
      "I was asked to clean up old accounts on a shared server for a student organization to free disk space, and I had a list of users who had not logged in for a year. Before deleting anything, I checked what those accounts owned and found that two of them held scripts that the finance volunteer still ran every month without knowing whose they were. I paused, contacted the finance volunteer, moved the scripts to a shared service account, and documented what each one did. Only then did I remove the dormant accounts, which freed about forty percent of the disk. I also wrote a short policy so future cleanups would check ownership first. I learned that a cleanup task can quietly break people who are nowhere near the task list, so I now ask who depends on this before I ask how to remove it.",
  },
];

export const LP_BY_ID = new Map(LEADERSHIP_PRINCIPLES.map((p) => [p.id, p]));

/** General behavioral questions not tied to a single principle (practice examples, not official). */
export const GENERAL_QUESTIONS: InterviewQuestion[] = [
  {
    id: "general-1",
    principleId: null,
    text: "Tell me about a time you solved a difficult technical problem.",
    listeningFor: ["Clear description of the problem", "Your systematic approach", "Root cause and fix", "What you learned"],
    kind: "technical",
  },
  {
    id: "general-2",
    principleId: null,
    text: "Tell me about a time you made a mistake.",
    listeningFor: ["Honest ownership", "What you did to fix it", "Impact on others", "What you changed afterward"],
    kind: "behavioral",
  },
  {
    id: "general-3",
    principleId: null,
    text: "Tell me about a time you had to learn something quickly.",
    listeningFor: ["Why it was needed", "How you learned", "How you applied it", "Evidence it worked"],
    kind: "behavioral",
  },
  {
    id: "general-4",
    principleId: null,
    text: "Tell me about a time you disagreed with a teammate.",
    listeningFor: ["The substance of the disagreement", "How you raised it respectfully", "How it was resolved", "State of the relationship afterward"],
    kind: "behavioral",
  },
  {
    id: "general-5",
    principleId: null,
    text: "Describe a time you had too much to do and had to prioritize.",
    listeningFor: ["How you decided what mattered most", "What you dropped or delayed and how you communicated it", "Outcome", "Lesson about planning"],
    kind: "behavioral",
  },
  {
    id: "general-6",
    principleId: null,
    text: "Tell me about a time you helped a customer or user.",
    listeningFor: ["Who the user was and what they needed", "What you personally did", "Observable result for them", "Follow-up"],
    kind: "behavioral",
  },
];
