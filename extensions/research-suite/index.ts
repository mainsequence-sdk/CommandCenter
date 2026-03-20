import { FlaskConical } from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import type { AppDefinition } from "@/apps/types";
import type { DashboardDefinition } from "@/dashboards/types";

import { ResearchBriefingPage } from "./ResearchBriefingPage";
import { ScenarioLabTool } from "./ScenarioLabTool";

const researchPulseDashboard: DashboardDefinition = {
  id: "research-pulse",
  title: "Research Pulse",
  description: "Repo-root extension dashboard composed from shared registry widgets.",
  category: "Research",
  source: "research-suite",
  requiredPermissions: ["dashboard:view"],
  widgets: [
    {
      id: "research-pulse-kpis",
      widgetId: "market-kpis",
      title: "Signal Board",
      props: { symbol: "MSFT" },
      layout: { cols: 4, rows: 4 },
      position: { x: 0 },
    },
    {
      id: "research-pulse-news",
      widgetId: "news-feed",
      title: "Catalyst Tape",
      props: { limit: 5 },
      layout: { cols: 4, rows: 5 },
      position: { x: 4 },
    },
    {
      id: "research-pulse-activity",
      widgetId: "activity-feed",
      title: "Desk Notes",
      props: { limit: 6 },
      layout: { cols: 4, rows: 5 },
      position: { x: 8 },
    },
    {
      id: "research-pulse-kpis-secondary",
      widgetId: "market-kpis",
      title: "Earnings Rotation",
      props: { symbol: "AMD" },
      layout: { cols: 12, rows: 4 },
    },
  ],
};

const researchSuiteApp: AppDefinition = {
  id: "research-suite",
  title: "Research Suite",
  description: "Independent repo-root app showing how an external product module plugs into the shell.",
  source: "research-suite",
  icon: FlaskConical,
  requiredPermissions: ["dashboard:view"],
  defaultSurfaceId: "research-pulse",
  surfaces: [
    {
      id: "research-pulse",
      title: "Research Pulse",
      navLabel: "Pulse",
      description: "Dashboard surface owned by the repo-root extension.",
      kind: "dashboard",
      requiredPermissions: ["dashboard:view"],
      dashboard: researchPulseDashboard,
    },
    {
      id: "research-briefing",
      title: "Research Briefing",
      navLabel: "Briefing",
      description: "Free-form page surface owned by the repo-root extension.",
      kind: "page",
      requiredPermissions: ["dashboard:view"],
      component: ResearchBriefingPage,
    },
    {
      id: "scenario-lab",
      title: "Scenario Lab",
      navLabel: "Scenario Lab",
      description: "Action-oriented tool surface owned by the repo-root extension.",
      kind: "tool",
      requiredPermissions: ["dashboard:view"],
      component: ScenarioLabTool,
    },
  ],
};

const researchSuiteExtension: AppExtension = {
  id: "research-suite",
  title: "Research Suite",
  description: "Repo-root extension that ships an independent app with dashboard, page, and tool surfaces.",
  apps: [researchSuiteApp],
};

export default researchSuiteExtension;
