import {
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  PanelsTopLeft,
  Shield,
  ShieldCheck,
} from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import type { AppDefinition } from "@/apps/types";
import type { DashboardDefinition } from "@/dashboards/types";
import { AccessRbacAssignmentsPage } from "@/extensions/core/apps/access-rbac/AccessRbacAssignmentsPage";
import { AccessRbacCoveragePage } from "@/extensions/core/apps/access-rbac/AccessRbacCoveragePage";
import { AccessRbacInspectorPage } from "@/extensions/core/apps/access-rbac/AccessRbacInspectorPage";
import { AccessRbacOverviewPage } from "@/extensions/core/apps/access-rbac/AccessRbacOverviewPage";
import { AccessRbacPoliciesPage } from "@/extensions/core/apps/access-rbac/AccessRbacPoliciesPage";
import { CustomDashboardStudioPage } from "@/features/dashboards/CustomDashboardStudioPage";
import { CustomWorkspaceSettingsPage } from "@/features/dashboards/CustomWorkspaceSettingsPage";
import { MarketBriefApp } from "@/features/applications/MarketBriefApp";
import { AdminPanelPage } from "@/features/admin/AdminPanelPage";
import { grandpaTheme } from "@/themes/presets/grandpa";
import { graphiteTheme } from "@/themes/presets/graphite";
import { mainSequenceTheme } from "@/themes/presets/main-sequence";
import { mainSequenceSpaceTheme } from "@/themes/presets/main-sequence-space";
import { quartzLightTheme } from "@/themes/presets/quartz-light";
import { sapphireTheme } from "@/themes/presets/sapphire";
import { activityFeedWidget } from "@/widgets/core/activity-feed/definition";
import { causalGraphWidget } from "@/widgets/core/causal-graph/definition";
import { distributionLabWidget } from "@/widgets/core/distribution-lab/definition";
import { factorHeatmapWidget } from "@/widgets/core/factor-heatmap/definition";
import { marketKpisWidget } from "@/widgets/core/market-kpis/definition";
import { newsFeedWidget } from "@/widgets/core/news-feed/definition";
import { scenarioConesWidget } from "@/widgets/core/scenario-cones/definition";

const overviewDashboard: DashboardDefinition = {
  id: "overview",
  title: "Market Overview",
  description: "Default monitoring dashboard using only core widgets and theme primitives.",
  category: "Market",
  source: "core",
  requiredPermissions: ["dashboard:view"],
  widgets: [
    {
      id: "overview-kpis",
      widgetId: "market-kpis",
      title: "Desk KPIs",
      props: { symbol: "AAPL" },
      layout: { cols: 4, rows: 4 },
      position: { x: 0 },
    },
    {
      id: "overview-news",
      widgetId: "news-feed",
      title: "Market News",
      props: { limit: 5 },
      layout: { cols: 4, rows: 5 },
      position: { x: 4 },
    },
    {
      id: "overview-activity",
      widgetId: "activity-feed",
      title: "Desk Activity",
      props: { limit: 6 },
      layout: { cols: 4, rows: 5 },
      position: { x: 8 },
    },
    {
      id: "overview-kpis-secondary",
      widgetId: "market-kpis",
      title: "Cross-Asset Snapshot",
      props: { symbol: "NVDA" },
      layout: { cols: 12, rows: 4 },
    },
  ],
};

const crossAssetDashboard: DashboardDefinition = {
  id: "cross-asset",
  title: "Cross-Asset",
  description: "Secondary market dashboard focused on macro pulse and desk-level cross-asset signals.",
  category: "Market",
  source: "core",
  requiredPermissions: ["dashboard:view"],
  widgets: [
    {
      id: "cross-asset-kpis",
      widgetId: "market-kpis",
      title: "Cross-Asset KPIs",
      props: { symbol: "MSFT" },
      layout: { cols: 4, rows: 4 },
      position: { x: 0 },
    },
    {
      id: "cross-asset-news",
      widgetId: "news-feed",
      title: "Macro Pulse",
      props: { limit: 4 },
      layout: { cols: 4, rows: 5 },
      position: { x: 4 },
    },
    {
      id: "cross-asset-activity",
      widgetId: "activity-feed",
      title: "Desk Signals",
      props: { limit: 5 },
      layout: { cols: 4, rows: 5 },
      position: { x: 8 },
    },
    {
      id: "cross-asset-kpis-secondary",
      widgetId: "market-kpis",
      title: "Rotation Snapshot",
      props: { symbol: "SPY" },
      layout: { cols: 12, rows: 4 },
    },
  ],
};

const signalAtlasDashboard: DashboardDefinition = {
  id: "signal-atlas",
  title: "Signal Atlas",
  description:
    "Quant showcase surface with causal transmission, lead-lag heatmaps, distribution diagnostics, and scenario cones.",
  category: "Quant",
  source: "core",
  requiredPermissions: ["dashboard:view"],
  grid: {
    columns: 12,
    rowHeight: 46,
    gap: 16,
  },
  widgets: [
    {
      id: "atlas-causal",
      widgetId: "causal-graph",
      title: "Causal Transmission Graph",
      layout: { cols: 7, rows: 8 },
      position: { x: 0, y: 0 },
    },
    {
      id: "atlas-heatmap",
      widgetId: "factor-heatmap",
      title: "Lead / Lag Heatmap",
      layout: { cols: 5, rows: 8 },
      position: { x: 7, y: 0 },
    },
    {
      id: "atlas-distribution",
      widgetId: "distribution-lab",
      title: "Distribution Lab",
      layout: { cols: 6, rows: 6 },
      position: { x: 0, y: 8 },
    },
    {
      id: "atlas-scenarios",
      widgetId: "scenario-cones",
      title: "Scenario Cones",
      layout: { cols: 6, rows: 6 },
      position: { x: 6, y: 8 },
    },
  ],
};

const tradingDeskDashboard: DashboardDefinition = {
  id: "trading-desk",
  title: "Trading Desk",
  description: "Execution-focused core dashboard without vendor-specific widgets.",
  category: "Execution",
  source: "core",
  requiredPermissions: ["orders:read"],
  widgets: [
    {
      id: "desk-kpis",
      widgetId: "market-kpis",
      title: "Execution KPIs",
      props: { symbol: "TSLA" },
      layout: { cols: 4, rows: 4 },
      position: { x: 0 },
    },
    {
      id: "desk-activity",
      widgetId: "activity-feed",
      title: "Desk Activity",
      props: { limit: 6 },
      layout: { cols: 4, rows: 5 },
      position: { x: 4 },
    },
    {
      id: "desk-news",
      widgetId: "news-feed",
      title: "Catalyst Watch",
      props: { limit: 6 },
      layout: { cols: 4, rows: 6 },
      position: { x: 8 },
    },
    {
      id: "desk-activity-secondary",
      widgetId: "activity-feed",
      title: "Ops Stream",
      props: { limit: 4 },
      layout: { cols: 6, rows: 5 },
      position: { x: 0 },
    },
    {
      id: "desk-news-secondary",
      widgetId: "news-feed",
      title: "Macro Tape",
      props: { limit: 4 },
      layout: { cols: 6, rows: 4 },
      position: { x: 6 },
    },
  ],
};

const adminConsoleDashboard: DashboardDefinition = {
  id: "admin-console",
  title: "Admin Console",
  description: "Operational view for platform owners and compliance admins.",
  category: "Operations",
  source: "core",
  requiredPermissions: ["rbac:view"],
  widgets: [
    {
      id: "admin-kpis",
      widgetId: "market-kpis",
      title: "Platform KPIs",
      props: { symbol: "NVDA" },
      layout: { cols: 4, rows: 4 },
      position: { x: 0 },
    },
    {
      id: "admin-activity",
      widgetId: "activity-feed",
      title: "Platform Events",
      props: { limit: 7 },
      layout: { cols: 4, rows: 5 },
      position: { x: 4 },
    },
    {
      id: "admin-news",
      widgetId: "news-feed",
      title: "External Signals",
      props: { limit: 5 },
      layout: { cols: 4, rows: 5 },
      position: { x: 8 },
    },
    {
      id: "admin-kpis-secondary",
      widgetId: "market-kpis",
      title: "Reference Metrics",
      props: { symbol: "AAPL" },
      layout: { cols: 12, rows: 4 },
    },
  ],
};

const marketsApp: AppDefinition = {
  id: "markets",
  title: "Markets",
  description: "Market monitoring, briefing, and high-level context surfaces.",
  source: "core",
  icon: LayoutDashboard,
  requiredPermissions: ["dashboard:view"],
  defaultSurfaceId: "overview",
  surfaces: [
    {
      id: "overview",
      title: "Overview",
      navLabel: "Overview",
      description: "Summary dashboard for market monitoring and desk awareness.",
      kind: "dashboard",
      requiredPermissions: ["dashboard:view"],
      dashboard: overviewDashboard,
    },
    {
      id: "cross-asset",
      title: "Cross-Asset",
      navLabel: "Cross-Asset",
      description: "Secondary market dashboard for macro pulse and cross-asset monitoring.",
      kind: "dashboard",
      requiredPermissions: ["dashboard:view"],
      dashboard: crossAssetDashboard,
    },
    {
      id: "signal-atlas",
      title: "Signal Atlas",
      navLabel: "Atlas",
      description: "Showcase quant dashboard with causal graph, distributions, heatmaps, and scenario cones.",
      kind: "dashboard",
      requiredPermissions: ["dashboard:view"],
      dashboard: signalAtlasDashboard,
    },
    {
      id: "market-brief",
      title: "Market Brief",
      navLabel: "Brief",
      description: "Narrative pre-open briefing with catalysts, notes, and operator context.",
      kind: "page",
      requiredPermissions: ["dashboard:view"],
      component: MarketBriefApp,
    },
  ],
};

const executionApp: AppDefinition = {
  id: "execution",
  title: "Execution",
  description: "Desk-facing execution monitoring and workflow surfaces.",
  source: "core",
  icon: PanelsTopLeft,
  requiredPermissions: ["orders:read"],
  defaultSurfaceId: "trading-desk",
  surfaces: [
    {
      id: "trading-desk",
      title: "Trading Desk",
      navLabel: "Desk",
      description: "Execution-focused monitoring dashboard for desk operators.",
      kind: "dashboard",
      requiredPermissions: ["orders:read"],
      dashboard: tradingDeskDashboard,
    },
  ],
};

const workspaceStudioApp: AppDefinition = {
  id: "workspace-studio",
  title: "Custom Workspace",
  description: "User-scoped workspace builder with local development persistence.",
  source: "core",
  icon: LayoutTemplate,
  requiredPermissions: ["dashboard:view"],
  defaultSurfaceId: "canvas",
  surfaces: [
    {
      id: "canvas",
      title: "Workspace Canvas",
      navLabel: "Canvas",
      description: "Build, arrange and save a custom workspace in browser local storage.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["dashboard:view"],
      component: CustomDashboardStudioPage,
    },
    {
      id: "settings",
      title: "Workspace Settings",
      navLabel: "Settings",
      description: "Dynamic configuration page for the selected custom workspace.",
      kind: "page",
      requiredPermissions: ["dashboard:view"],
      component: CustomWorkspaceSettingsPage,
    },
  ],
};

const adminApp: AppDefinition = {
  id: "admin",
  title: "Admin",
  description: "Platform operations, controls, and compliance-facing surfaces.",
  source: "core",
  icon: ShieldCheck,
  navigationPlacement: "admin-menu",
  requiredPermissions: ["rbac:view"],
  defaultSurfaceId: "admin-console",
  surfaces: [
    {
      id: "admin-console",
      title: "Admin Console",
      navLabel: "Console",
      description: "Operational dashboard for platform owners and compliance admins.",
      kind: "dashboard",
      requiredPermissions: ["rbac:view"],
      dashboard: adminConsoleDashboard,
    },
  ],
};

const accessInformationSection = {
  id: "information",
  label: "Concept & Help",
  description: "Reference surfaces that explain the current governance model.",
  order: 40,
};

const accessInspectionSection = {
  id: "inspection",
  label: "User access inspection",
  description: "Inspect effective access for specific users.",
  order: 30,
};

const accessRbacApp: AppDefinition = {
  id: "access-rbac",
  title: "Access & RBAC",
  description: "Administrative application for policy review, assignments, and entitlement coverage.",
  source: "core",
  icon: KeyRound,
  navigationPlacement: "admin-menu",
  topNavigationStyle: "hidden",
  requiredPermissions: ["rbac:view"],
  defaultSurfaceId: "overview",
  surfaces: [
    {
      id: "overview",
      title: "Overview",
      navLabel: "Overview",
      description: "Governance model, role layers, and how resource assignments fit into the platform.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: accessInformationSection,
      component: AccessRbacOverviewPage,
    },
    {
      id: "policies",
      title: "Policy model",
      navLabel: "Policies",
      description: "Built-in role matrix and platform permission contract.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: accessInformationSection,
      component: AccessRbacPoliciesPage,
    },
    {
      id: "assignments",
      title: "Main Sequence object access",
      navLabel: "Main Sequence access",
      description: "Reference how Main Sequence object-level access is assigned to users and teams.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: accessInformationSection,
      component: AccessRbacAssignmentsPage,
    },
    {
      id: "coverage",
      title: "Coverage",
      navLabel: "Coverage",
      description: "Inspect how current permissions resolve across apps, surfaces, widgets, and utilities.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: accessInformationSection,
      component: AccessRbacCoveragePage,
    },
    {
      id: "user-inspector",
      title: "User access inspector",
      navLabel: "Inspector",
      description: "Search users and inspect their effective shell access.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: accessInspectionSection,
      component: AccessRbacInspectorPage,
    },
  ],
};

const adminPanelApp: AppDefinition = {
  id: "admin-panel",
  title: "Admin Panel",
  description: "Reserved admin application shell for future operational tooling.",
  source: "core",
  icon: Shield,
  navigationPlacement: "admin-menu",
  requiredPermissions: ["rbac:view"],
  defaultSurfaceId: "panel",
  surfaces: [
    {
      id: "panel",
      title: "Admin Panel",
      navLabel: "Panel",
      description: "Empty admin application surface reserved for future implementation.",
      kind: "page",
      requiredPermissions: ["rbac:view"],
      component: AdminPanelPage,
    },
  ],
};

const coreExtension: AppExtension = {
  id: "core",
  title: "Core Extension",
  description: "Built-in terminal widgets, apps, dashboard surfaces, and theme presets.",
  widgets: [
    marketKpisWidget,
    newsFeedWidget,
    activityFeedWidget,
    causalGraphWidget,
    factorHeatmapWidget,
    distributionLabWidget,
    scenarioConesWidget,
  ],
  apps: [marketsApp, executionApp, workspaceStudioApp, adminApp, accessRbacApp, adminPanelApp],
  themes: [
    mainSequenceSpaceTheme,
    mainSequenceTheme,
    grandpaTheme,
    graphiteTheme,
    sapphireTheme,
    quartzLightTheme,
  ],
};

export default coreExtension;
