import {
  KeyRound,
  LayoutTemplate,
  ShieldCheck,
} from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import type { AppDefinition } from "@/apps/types";
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
import { SavedWidgetsPage } from "@/features/dashboards/SavedWidgetsPage";
import { WorkspacesPage } from "@/features/dashboards/WorkspacesPage";
import { cyberpunkTheme } from "@/themes/presets/cyberpunk";
import { draculaTheme } from "@/themes/presets/dracula";
import { grandpaTheme } from "@/themes/presets/grandpa";
import { graphiteTheme } from "@/themes/presets/graphite";
import { mainSequenceTheme } from "@/themes/presets/main-sequence";
import { mainSequenceSpaceTheme } from "@/themes/presets/main-sequence-space";
import { pandaTruenoTheme } from "@/themes/presets/panda-trueno";
import { quartzLightTheme } from "@/themes/presets/quartz-light";
import { sapphireTheme } from "@/themes/presets/sapphire";
import { markdownNoteWidget } from "@/widgets/core/markdown-note/definition";
import { newsFeedWidget } from "@/widgets/core/news-feed/definition";
import { appComponentWidget } from "@/widgets/core/app-component/definition";
import { workspaceRowWidget } from "@/widgets/core/workspace-row/definition";

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
    {
      id: "widgets",
      title: "Saved Widgets",
      navLabel: "Saved Widgets",
      description: "Browse reusable saved widget instances and widget groups.",
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["dashboard:view"],
      component: SavedWidgetsPage,
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
  widgets: [newsFeedWidget, markdownNoteWidget, appComponentWidget, workspaceRowWidget],
  apps: [workspaceStudioApp, adminApp, accessRbacApp],
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
