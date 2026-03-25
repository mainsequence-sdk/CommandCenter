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
import { draculaTheme } from "@/themes/presets/dracula";
import { grandpaTheme } from "@/themes/presets/grandpa";
import { graphiteTheme } from "@/themes/presets/graphite";
import { mainSequenceTheme } from "@/themes/presets/main-sequence";
import { mainSequenceSpaceTheme } from "@/themes/presets/main-sequence-space";
import { pandaTruenoTheme } from "@/themes/presets/panda-trueno";
import { quartzLightTheme } from "@/themes/presets/quartz-light";
import { sapphireTheme } from "@/themes/presets/sapphire";
import { newsFeedWidget } from "@/widgets/core/news-feed/definition";
import { workspaceRowWidget } from "@/widgets/core/workspace-row/definition";

const overviewDashboard: DashboardDefinition = {
  id: "overview",
  title: "Demo Overview",
  description: "Default demo dashboard using only shared widgets and theme primitives.",
  category: "Demo",
  source: "core",
  requiredPermissions: ["dashboard:view"],
  widgets: [
    {
      id: "overview-curve-ust",
      widgetId: "yield-curve-plot",
      title: "US Treasury Curve",
      props: { market: "ust", scenario: "desk", comparisonMode: "historical" },
      layout: { cols: 6, rows: 6 },
      position: { x: 0 },
    },
    {
      id: "overview-curve-bund",
      widgetId: "yield-curve-plot",
      title: "Bund Curve",
      props: { market: "bund", scenario: "desk", comparisonMode: "historical" },
      layout: { cols: 6, rows: 6 },
      position: { x: 6 },
    },
    {
      id: "overview-curve-sofr",
      widgetId: "yield-curve-plot",
      title: "SOFR Curve",
      props: { market: "sofr", scenario: "desk", comparisonMode: "session" },
      layout: { cols: 12, rows: 6 },
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
      id: "cross-asset-curve-ust",
      widgetId: "yield-curve-plot",
      title: "UST Historical Gradient",
      props: { market: "ust", scenario: "desk", comparisonMode: "historical" },
      layout: { cols: 4, rows: 6 },
      position: { x: 0 },
    },
    {
      id: "cross-asset-curve-bull",
      widgetId: "yield-curve-plot",
      title: "SOFR Bull Steepener",
      props: { market: "sofr", scenario: "bull-steepener", comparisonMode: "session" },
      layout: { cols: 4, rows: 6 },
      position: { x: 4 },
    },
    {
      id: "cross-asset-curve-flat",
      widgetId: "yield-curve-plot",
      title: "Bund Bear Flattener",
      props: { market: "bund", scenario: "bear-flattener", comparisonMode: "session" },
      layout: { cols: 4, rows: 6 },
      position: { x: 8 },
    },
    {
      id: "cross-asset-curve-inverted",
      widgetId: "yield-curve-plot",
      title: "UST Inverted",
      props: { market: "ust", scenario: "inverted", comparisonMode: "historical" },
      layout: { cols: 12, rows: 6 },
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
      id: "flow-positions",
      widgetId: "data-node-table-visualizer",
      title: "Data Node Table",
      props: {},
      layout: { cols: 12, rows: 7 },
      position: { x: 0 },
    },
    {
      id: "flow-rates",
      widgetId: "yield-curve-plot",
      title: "Rates Overlay",
      props: { market: "ust", scenario: "desk", comparisonMode: "historical" },
      layout: { cols: 12, rows: 6 },
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
      description: "Extension-backed demo dashboard narrowed to the strategy book and yield-curve widgets.",
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
  description: "Built-in terminal apps, dashboard surfaces, and theme presets.",
  widgets: [newsFeedWidget, workspaceRowWidget],
  apps: [demoApp, workspaceStudioApp, adminApp, accessRbacApp],
  themes: [
    mainSequenceSpaceTheme,
    mainSequenceTheme,
    cyberpunkTheme,
    draculaTheme,
    grandpaTheme,
    graphiteTheme,
    sapphireTheme,
    pandaTruenoTheme,
    quartzLightTheme,
  ],
};

export default coreExtension;
