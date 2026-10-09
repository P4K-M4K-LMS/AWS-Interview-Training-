import type { RouteObject } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { LearningPathsPage } from "./pages/LearningPathsPage";
import { MissionControlPage } from "./pages/MissionControlPage";
import { MissionPage } from "./pages/MissionPage";
import { TerminalPage } from "./pages/TerminalPage";
import { PythonLabPage } from "./pages/PythonLabPage";
import { GoLabPage } from "./pages/GoLabPage";
import { AlgorithmsLabPage } from "./pages/AlgorithmsLabPage";
import { SecurityOpsPage } from "./pages/SecurityOpsPage";
import { MonitoringPage } from "./pages/MonitoringPage";
import { InterviewHomePage } from "./pages/interview/InterviewHomePage";
import { StarAcademyPage } from "./pages/interview/StarAcademyPage";
import { PrinciplesPage } from "./pages/interview/PrinciplesPage";
import { StoryBankPage } from "./pages/interview/StoryBankPage";
import { PracticePage } from "./pages/interview/PracticePage";
import { HistoryPage } from "./pages/interview/HistoryPage";
import { SkillProgressPage } from "./pages/SkillProgressPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "paths", element: <LearningPathsPage /> },
      { path: "missions", element: <MissionControlPage /> },
      { path: "missions/:missionId", element: <MissionPage /> },
      { path: "terminal", element: <TerminalPage /> },
      { path: "python", element: <PythonLabPage /> },
      { path: "go", element: <GoLabPage /> },
      { path: "algorithms", element: <AlgorithmsLabPage /> },
      { path: "security", element: <SecurityOpsPage /> },
      { path: "monitoring", element: <MonitoringPage /> },
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
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
