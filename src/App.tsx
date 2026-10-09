import { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { LabsPage } from "./pages/LabsPage";

// Heavy pages load on demand so the first screen does not carry CodeMirror,
// the simulation engine or the interview coach.
const CurriculumPage = lazy(() => import("./pages/CurriculumPage").then((m) => ({ default: m.CurriculumPage })));
const MissionControlPage = lazy(() => import("./pages/MissionControlPage").then((m) => ({ default: m.MissionControlPage })));
const MissionPage = lazy(() => import("./pages/MissionPage").then((m) => ({ default: m.MissionPage })));
const TerminalPage = lazy(() => import("./pages/TerminalPage").then((m) => ({ default: m.TerminalPage })));
const PythonLabPage = lazy(() => import("./pages/PythonLabPage").then((m) => ({ default: m.PythonLabPage })));
const GoLabPage = lazy(() => import("./pages/GoLabPage").then((m) => ({ default: m.GoLabPage })));
const AlgorithmsLabPage = lazy(() => import("./pages/AlgorithmsLabPage").then((m) => ({ default: m.AlgorithmsLabPage })));
const SecurityOpsPage = lazy(() => import("./pages/SecurityOpsPage").then((m) => ({ default: m.SecurityOpsPage })));
const PolicyLabPage = lazy(() => import("./pages/PolicyLabPage").then((m) => ({ default: m.PolicyLabPage })));
const NetworkLabPage = lazy(() => import("./pages/NetworkLabPage").then((m) => ({ default: m.NetworkLabPage })));
const DrLabPage = lazy(() => import("./pages/DrLabPage").then((m) => ({ default: m.DrLabPage })));
const AlarmLabPage = lazy(() => import("./pages/AlarmLabPage").then((m) => ({ default: m.AlarmLabPage })));
const CostLabPage = lazy(() => import("./pages/CostLabPage").then((m) => ({ default: m.CostLabPage })));
const MonitoringPage = lazy(() => import("./pages/MonitoringPage").then((m) => ({ default: m.MonitoringPage })));
const InterviewHomePage = lazy(() => import("./pages/interview/InterviewHomePage").then((m) => ({ default: m.InterviewHomePage })));
const StarAcademyPage = lazy(() => import("./pages/interview/StarAcademyPage").then((m) => ({ default: m.StarAcademyPage })));
const PrinciplesPage = lazy(() => import("./pages/interview/PrinciplesPage").then((m) => ({ default: m.PrinciplesPage })));
const StoryBankPage = lazy(() => import("./pages/interview/StoryBankPage").then((m) => ({ default: m.StoryBankPage })));
const PracticePage = lazy(() => import("./pages/interview/PracticePage").then((m) => ({ default: m.PracticePage })));
const HistoryPage = lazy(() => import("./pages/interview/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const SkillProgressPage = lazy(() => import("./pages/SkillProgressPage").then((m) => ({ default: m.SkillProgressPage })));
const StudyHomePage = lazy(() => import("./pages/study/StudyHomePage").then((m) => ({ default: m.StudyHomePage })));
const StudyCoursePage = lazy(() => import("./pages/study/StudyCoursePage").then((m) => ({ default: m.StudyCoursePage })));
const StudyUnitPage = lazy(() => import("./pages/study/StudyUnitPage").then((m) => ({ default: m.StudyUnitPage })));
const StudyObjectivePage = lazy(() => import("./pages/study/StudyObjectivePage").then((m) => ({ default: m.StudyObjectivePage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "curriculum", element: <CurriculumPage /> },
      { path: "missions", element: <MissionControlPage /> },
      { path: "missions/:missionId", element: <MissionPage /> },
      { path: "study", element: <StudyHomePage /> },
      { path: "study/:courseId", element: <StudyCoursePage /> },
      { path: "study/:courseId/:unitIndex", element: <StudyUnitPage /> },
      { path: "study/:courseId/:unitIndex/:objectiveIndex", element: <StudyObjectivePage /> },
      {
        path: "labs",
        element: <LabsPage />,
        children: [
          { index: true, element: <Navigate to="/labs/terminal" replace /> },
          { path: "terminal", element: <TerminalPage /> },
          { path: "python", element: <PythonLabPage /> },
          { path: "go", element: <GoLabPage /> },
          { path: "algorithms", element: <AlgorithmsLabPage /> },
          { path: "security", element: <SecurityOpsPage /> },
          { path: "monitoring", element: <MonitoringPage /> },
          { path: "policy", element: <PolicyLabPage /> },
          { path: "network", element: <NetworkLabPage /> },
          { path: "dr", element: <DrLabPage /> },
          { path: "alarms", element: <AlarmLabPage /> },
          { path: "cost", element: <CostLabPage /> },
        ],
      },
      { path: "interview", element: <InterviewHomePage /> },
      { path: "interview/star", element: <StarAcademyPage /> },
      { path: "interview/principles", element: <PrinciplesPage /> },
      { path: "interview/principles/:principleId", element: <PrinciplesPage /> },
      { path: "interview/stories", element: <StoryBankPage /> },
      { path: "interview/practice", element: <PracticePage /> },
      { path: "interview/practice/:sessionId", element: <PracticePage /> },
      { path: "interview/history", element: <HistoryPage /> },
      { path: "progress", element: <SkillProgressPage /> },
      { path: "settings", element: <SettingsPage /> },
      // Old addresses keep working.
      { path: "paths", element: <Navigate to="/curriculum" replace /> },
      { path: "terminal", element: <Navigate to="/labs/terminal" replace /> },
      { path: "python", element: <Navigate to="/labs/python" replace /> },
      { path: "go", element: <Navigate to="/labs/go" replace /> },
      { path: "algorithms", element: <Navigate to="/labs/algorithms" replace /> },
      { path: "security", element: <Navigate to="/labs/security" replace /> },
      { path: "monitoring", element: <Navigate to="/labs/monitoring" replace /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
