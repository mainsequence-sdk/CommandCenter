import {
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
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
import { AccessRbacTeamsPage } from "@/extensions/core/apps/access-rbac/AccessRbacTeamsPage";
import { AdminActivePlansPage } from "@/extensions/core/apps/admin/AdminActivePlansPage";
import { AdminBillingDetailsPage } from "@/extensions/core/apps/admin/AdminBillingDetailsPage";
import { AdminGithubOrganizationsPage } from "@/extensions/core/apps/admin/AdminGithubOrganizationsPage";
import { AdminInvoicesPage } from "@/extensions/core/apps/admin/AdminInvoicesPage";
import { AdminOrganizationUsersPage } from "@/extensions/core/apps/admin/AdminOrganizationUsersPage";
import { WorkspacesPage } from "@/features/dashboards/WorkspacesPage";
import { MarketBriefApp } from "@/features/applications/MarketBriefApp";
import { cyberpunkTheme } from "@/themes/presets/cyberpunk";
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
  title: "Demo Overview",
  description: "Default demo dashboard using only shared widgets and theme primitives.",
  category: "Demo",
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
  description: "Secondary demo dashboard focused on macro pulse and cross-asset signals.",
  category: "Demo",
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

const orderflowLabDashboard: DashboardDefinition = {
  id: "orderflow-lab",
  title: "Flow Lab",
  description: "Experimental demo dashboard that mixes extension-owned widgets into the core app.",
  category: "Demo",
  source: "core",
  requiredPermissions: ["orders:read"],
  controls: {
    enabled: false,
  },
  widgets: [
    {
      id: "flow-chart",
      widgetId: "price-chart",
      title: "TSLA - Micro Structure",
      props: { symbol: "TSLA" },
      layout: { cols: 8, rows: 5 },
      position: { x: 0 },
    },
    {
      id: "flow-orderbook",
      widgetId: "order-book",
      title: "Level II Snapshot",
      props: { symbol: "TSLA" },
      layout: { cols: 4, rows: 5 },
      position: { x: 8 },
    },
    {
      id: "flow-positions",
      widgetId: "strategy-book",
      title: "Strategy Book",
      props: {},
      layout: { cols: 8, rows: 6 },
      position: { x: 0 },
    },
    {
      id: "flow-activity",
      widgetId: "activity-feed",
      title: "Routing Events",
      props: { limit: 6 },
      layout: { cols: 4, rows: 6 },
      position: { x: 8 },
    },
  ],
};

const demoApp: AppDefinition = {
  id: "demo",
  title: "Demo",
  description: "Demo dashboards, briefing surfaces, and extension-backed shell examples.",
  source: "core",
  icon: LayoutDashboard,
  requiredPermissions: ["dashboard:view"],
  defaultSurfaceId: "overview",
  surfaces: [
    {
      id: "overview",
      title: "Overview",
      navLabel: "Overview",
      description: "Summary dashboard for the default demo monitoring surface.",
      kind: "dashboard",
      requiredPermissions: ["dashboard:view"],
      dashboard: overviewDashboard,
    },
    {
      id: "cross-asset",
      title: "Cross-Asset",
      navLabel: "Cross-Asset",
      description: "Secondary demo dashboard for macro pulse and cross-asset monitoring.",
      kind: "dashboard",
      requiredPermissions: ["dashboard:view"],
      dashboard: crossAssetDashboard,
    },
    {
      id: "orderflow-lab",
      title: "Flow Lab",
      navLabel: "Flow Lab",
      description: "Extension-backed demo dashboard with charting, book, positions, and routing events.",
      kind: "dashboard",
      requiredPermissions: ["orders:read"],
      dashboard: orderflowLabDashboard,
    },
    {
      id: "market-brief",
      title: "Demo Brief",
      navLabel: "Brief",
      description: "Narrative demo briefing with catalysts, notes, and operator context.",
      kind: "page",
      requiredPermissions: ["dashboard:view"],
      component: MarketBriefApp,
    },
  ],
};

const workspaceStudioApp: AppDefinition = {
  id: "workspace-studio",
  title: "Workspaces",
  description: "User-scoped workspace builder with local development persistence.",
  source: "core",
  icon: LayoutTemplate,
  topNavigationStyle: "hidden",
  requiredPermissions: ["dashboard:view"],
  defaultSurfaceId: "workspaces",
  surfaces: [
    {
      id: "workspaces",
      title: "Workspaces",
      navLabel: "Workspaces",
      description: "List, open, and manage workspaces stored in browser local storage.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["dashboard:view"],
      component: WorkspacesPage,
    },
  ],
};

const adminApp: AppDefinition = {
  id: "admin",
  title: "Admin",
  description: "Platform operations, controls, audit visibility, and compliance-facing surfaces.",
  source: "core",
  icon: ShieldCheck,
  navigationPlacement: "admin-menu",
  topNavigationStyle: "hidden",
  requiredPermissions: ["rbac:view"],
  defaultSurfaceId: "organization-users",
  surfaces: [
    {
      id: "organization-users",
      title: "Organization Users",
      navLabel: "Directory",
      description: "Browse organization-scoped users from the shared user endpoint.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: {
        id: "organization-users",
        label: "Organization Users",
        description: "Directory surfaces backed by organization-scoped user data.",
        order: 40,
      },
      component: AdminOrganizationUsersPage,
    },
    {
      id: "active-plans",
      title: "Active Plans",
      navLabel: "Active Plans",
      description: "Reserved surface for organization plan inventory and assignments.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: {
        id: "organization-users",
        label: "Organization Users",
        description: "Directory surfaces backed by organization-scoped user data.",
        order: 40,
      },
      component: AdminActivePlansPage,
    },
    {
      id: "github-organizations",
      title: "GitHub Organizations",
      navLabel: "GitHub Orgs",
      description: "Reserved surface for GitHub organization management.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: {
        id: "organization-users",
        label: "Organization Users",
        description: "Directory surfaces backed by organization-scoped user data.",
        order: 40,
      },
      component: AdminGithubOrganizationsPage,
    },
    {
      id: "invoices",
      title: "Invoices",
      navLabel: "Invoices",
      description: "Reserved surface for organization invoice history and statement downloads.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: {
        id: "billing",
        label: "Billing",
        description: "Organization billing records and payment configuration.",
        order: 45,
      },
      component: AdminInvoicesPage,
    },
    {
      id: "billing-details",
      title: "Billing Details",
      navLabel: "Billing Details",
      description: "Reserved surface for organization billing profile and invoice recipients.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: {
        id: "billing",
        label: "Billing",
        description: "Organization billing records and payment configuration.",
        order: 45,
      },
      component: AdminBillingDetailsPage,
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

const accessTeamsSection = {
  id: "teams",
  label: "Teams",
  description: "Organization team management and sharing.",
  order: 35,
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
    {
      id: "teams",
      title: "Teams",
      navLabel: "Registry",
      description: "Manage organization teams, memberships, and team sharing.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["rbac:view"],
      navigationSection: accessTeamsSection,
      component: AccessRbacTeamsPage,
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
  apps: [demoApp, workspaceStudioApp, adminApp, accessRbacApp],
  themes: [
    mainSequenceSpaceTheme,
    mainSequenceTheme,
    cyberpunkTheme,
    grandpaTheme,
    graphiteTheme,
    sapphireTheme,
    quartzLightTheme,
  ],
};

export default coreExtension;
