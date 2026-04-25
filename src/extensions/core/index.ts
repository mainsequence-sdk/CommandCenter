import {
  KeyRound,
  LayoutTemplate,
  ShieldCheck,
} from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import { defineSurfaceAssistantContext, type AppDefinition } from "@/apps/types";
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
import { AdminLoginSessionsPage } from "@/extensions/core/apps/admin/AdminLoginSessionsPage";
import { AdminOrganizationUsersPage } from "@/extensions/core/apps/admin/AdminOrganizationUsersPage";
import { AdminWidgetConfigurationsPage } from "@/extensions/core/apps/admin/AdminWidgetConfigurationsPage";
import { SavedWidgetsPage } from "@/features/dashboards/SavedWidgetsPage";
import { WorkspacesPage } from "@/features/dashboards/WorkspacesPage";
import { WidgetCatalogPage } from "@/features/widgets/WidgetCatalogPage";
import { cyberpunkTheme } from "@/themes/presets/cyberpunk";
import { draculaTheme } from "@/themes/presets/dracula";
import { grandpaTheme } from "@/themes/presets/grandpa";
import { graphiteTheme } from "@/themes/presets/graphite";
import { mainSequenceTheme } from "@/themes/presets/main-sequence";
import { mainSequenceSpaceTheme } from "@/themes/presets/main-sequence-space";
import { neonMintTheme } from "@/themes/presets/neon-mint";
import { pandaTruenoTheme } from "@/themes/presets/panda-trueno";
import { quartzLightTheme } from "@/themes/presets/quartz-light";
import { sakuraTheme } from "@/themes/presets/sakura";
import { sapphireTheme } from "@/themes/presets/sapphire";
import { markdownNoteWidget } from "@/widgets/core/markdown-note/definition";
import { richTextNoteWidget } from "@/widgets/core/rich-text-note/definition";
import { appComponentWidget } from "@/widgets/core/app-component/definition";
import { connectionQueryWidget } from "@/widgets/core/connection-query/definition";
import { debugStreamWidget } from "@/widgets/core/debug-stream/definition";
import { graphWidget } from "@/widgets/core/graph/definition";
import { tabularTransformWidget } from "@/widgets/core/tabular-transform/definition";
import { statisticWidget } from "@/widgets/core/statistic/definition";
import { tableWidget } from "@/widgets/core/table/definition";
import { workspaceRowWidget } from "@/widgets/core/workspace-row/definition";

const workspaceStudioApp: AppDefinition = {
  id: "workspace-studio",
  title: "Workspaces",
  description: "User-scoped workspace builder with local development persistence.",
  source: "core",
  icon: LayoutTemplate,
  navigationOrder: 100,
  topNavigationStyle: "hidden",
  requiredPermissions: ["workspaces:view"],
  permissionDefinitions: [
    {
      id: "workspaces:view",
      label: "Workspaces / view",
      description: "Open the Workspaces application and workspace-backed shell surfaces.",
      category: "Workspaces",
    },
  ],
  defaultSurfaceId: "workspaces",
  surfaces: [
    {
      id: "workspaces",
      title: "Workspaces",
      navLabel: "Workspaces",
      description: "List, open, and manage workspaces stored in browser local storage.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Workspaces surface. This area manages saved Main Sequence Command Center workspaces.",
        availableActions: [
          "Open a workspace",
          "Create a workspace",
          "Copy a workspace",
          "Favorite a workspace",
        ],
        resolve: ({ searchParams }) => {
          const workspaceId = searchParams.get("workspace");
          const view = searchParams.get("view");
          const widgetId = searchParams.get("widget");

          if (!workspaceId) {
            return {
              summary:
                "User is in the Workspaces index. This view shows the list of saved Main Sequence Command Center workspaces.",
              details: {
                View: "Workspace index",
              },
            };
          }

          if (view === "settings") {
            return {
              summary:
                "User is in workspace settings for a specific workspace.",
              availableActions: [
                "Review workspace metadata",
                "Change layout and control settings",
                "Manage labels and import/export",
                "Review sharing permissions",
              ],
              details: {
                View: "Workspace settings",
                "Workspace ID": workspaceId,
              },
            };
          }

          if (view === "widget-settings") {
            return {
              summary:
                "User is configuring one widget instance inside a workspace.",
              availableActions: [
                "Change widget settings",
                "Review or edit bindings",
                "Save widget configuration",
                "Return to the workspace canvas",
              ],
              details: {
                View: "Widget settings",
                "Workspace ID": workspaceId,
                "Widget ID": widgetId,
              },
            };
          }

          if (view === "graph") {
            return {
              summary:
                "User is in the workspace graph editor. This view shows widget dependencies and bindings for one workspace.",
              availableActions: [
                "Inspect widget dependencies",
                "Create or remove bindings",
                "Add widgets from the component browser",
                "Return to the workspace canvas",
              ],
              details: {
                View: "Workspace graph",
                "Workspace ID": workspaceId,
              },
            };
          }

          return {
            summary:
              "User is on the workspace canvas for one saved workspace.",
            availableActions: [
              "Inspect widgets on the canvas",
              "Enter edit mode",
              "Open workspace settings",
              "Open graph view",
            ],
            details: {
              View: "Workspace canvas",
              "Workspace ID": workspaceId,
            },
          };
        },
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["workspaces:view"],
      component: WorkspacesPage,
    },
    {
      id: "widget-catalog",
      title: "Widget Catalog",
      navLabel: "Widget Catalog",
      description:
        "Browse the registered widget catalog available for workspace design.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Widget Catalog surface inside Workspaces. This view lists registered widgets available for workspace design.",
        availableActions: [
          "Browse available widget types",
          "Inspect widget descriptions and permissions",
          "Open widget detail screens",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["widget.catalog:view"],
      component: WidgetCatalogPage,
    },
    {
      id: "widgets",
      title: "Saved Widgets",
      navLabel: "Saved Widgets",
      description: "Browse reusable saved widget instances and widget groups.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Saved Widgets surface. This view shows reusable saved widget instances and widget groups.",
        availableActions: [
          "Browse saved widgets",
          "Inspect saved widget groups",
          "Reuse a saved widget in a workspace",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["workspaces:view"],
      component: SavedWidgetsPage,
    },
  ],
};

const adminApp: AppDefinition = {
  id: "admin",
  title: "Organization Admin",
  description: "Organization-scoped administration for users, plans, billing, and provider integrations.",
  source: "core",
  icon: ShieldCheck,
  navigationPlacement: "admin-menu",
  topNavigationStyle: "hidden",
  requiredPermissions: ["org_admin:view"],
  defaultSurfaceId: "organization-users",
  surfaces: [
    {
      id: "organization-users",
      title: "Organization Users",
      navLabel: "Directory",
      description: "Browse organization-scoped users from the shared user endpoint.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Organization Users. This page shows organization-scoped users and their account state.",
        availableActions: [
          "Search organization users",
          "Inspect user records",
          "Review account and access-related fields",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
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
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Active Plans. This page is intended for reviewing organization plans and assignments.",
        availableActions: [
          "Review active plan inventory",
          "Inspect current plan assignments",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: {
        id: "organization-users",
        label: "Organization Users",
        description: "Directory surfaces backed by organization-scoped user data.",
        order: 40,
      },
      component: AdminActivePlansPage,
    },
    {
      id: "security-sessions",
      title: "Security Sessions",
      navLabel: "Security",
      description: "Review and revoke organization-scoped tracked login sessions.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Security Sessions. This page lists tracked organization login sessions and allows scoped revocation.",
        availableActions: [
          "Search tracked sessions",
          "Filter by auth source and state",
          "Revoke a session in organization scope",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: {
        id: "organization-users",
        label: "Organization Users",
        description: "Directory surfaces backed by organization-scoped user data.",
        order: 40,
      },
      component: AdminLoginSessionsPage,
    },
    {
      id: "widget-configurations",
      title: "Widget Configurations",
      navLabel: "Widgets",
      description: "Review backend-registered widget types that support organization-scoped configuration.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Widget Configurations. This page lists backend-registered widget types that can be configured per organization.",
        availableActions: [
          "Review configurable widget types",
          "Inspect which widgets already have organization override rows",
          "Confirm whether a configurable widget is present in the current frontend build",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: {
        id: "widgets",
        label: "Widgets",
        description: "Organization-scoped widget availability and configuration capability.",
        order: 42,
      },
      component: AdminWidgetConfigurationsPage,
    },
    {
      id: "github-organizations",
      title: "GitHub Organizations",
      navLabel: "GitHub Orgs",
      description: "Reserved surface for GitHub organization management.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on GitHub Organizations. This page is intended for reviewing and managing linked GitHub organizations.",
        availableActions: [
          "Review linked GitHub organizations",
          "Inspect integration status",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
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
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Invoices. This page is intended for reviewing organization invoice history and statements.",
        availableActions: [
          "Review invoice history",
          "Inspect billing records",
          "Download or reference statements",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
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
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Billing Details. This page is intended for reviewing the organization billing profile and invoice recipients.",
        availableActions: [
          "Review billing profile details",
          "Inspect invoice recipient settings",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
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
  description: "Organization access governance for policy review, assignments, inspection, and entitlement coverage.",
  source: "core",
  icon: KeyRound,
  navigationPlacement: "admin-menu",
  topNavigationStyle: "hidden",
  requiredPermissions: ["org_admin:view"],
  defaultSurfaceId: "overview",
  surfaces: [
    {
      id: "overview",
      title: "Overview",
      navLabel: "Overview",
      description: "Governance model, role layers, and how resource assignments fit into the platform.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Access & RBAC overview. This page explains the governance model, role layers, and platform access structure.",
        availableActions: [
          "Review the governance model",
          "Inspect role-layer concepts",
          "Navigate to policy and coverage pages",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: accessInformationSection,
      component: AccessRbacOverviewPage,
    },
    {
      id: "policies",
      title: "Policy model",
      navLabel: "Policies",
      description: "Built-in role matrix and platform permission contract.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Access & RBAC policy model page. This view explains built-in roles and the permission contract.",
        availableActions: [
          "Review built-in role definitions",
          "Inspect the permission contract",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: accessInformationSection,
      component: AccessRbacPoliciesPage,
    },
    {
      id: "assignments",
      title: "Main Sequence object access",
      navLabel: "Main Sequence access",
      description: "Reference how Main Sequence object-level access is assigned to users and teams.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Main Sequence object access. This page explains how object-level access is assigned to users and teams.",
        availableActions: [
          "Review assignment rules",
          "Inspect user and team access concepts",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: accessInformationSection,
      component: AccessRbacAssignmentsPage,
    },
    {
      id: "coverage",
      title: "Coverage",
      navLabel: "Coverage",
      description: "Inspect how current permissions resolve across apps, surfaces, widgets, and utilities.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on Coverage. This page shows how permissions resolve across apps, surfaces, widgets, and utilities.",
        availableActions: [
          "Inspect permission coverage",
          "Review effective access across the shell",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: accessInformationSection,
      component: AccessRbacCoveragePage,
    },
    {
      id: "user-inspector",
      title: "Organization user inspector",
      navLabel: "Inspector",
      description: "Search users and inspect their effective shell access.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Organization user inspector. This page is used to search users and inspect their effective shell access.",
        availableActions: [
          "Search for a user",
          "Inspect a user's effective access",
          "Review role and permission resolution",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: accessInspectionSection,
      component: AccessRbacInspectorPage,
    },
    {
      id: "teams",
      title: "Teams",
      navLabel: "Registry",
      description: "Manage organization teams, memberships, and team sharing.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Teams registry. This page shows organization teams, memberships, and team sharing state.",
        availableActions: [
          "Browse teams",
          "Inspect memberships",
          "Review or manage team sharing",
        ],
      }),
      kind: "page",
      fullBleed: true,
      requiredPermissions: ["org_admin:view"],
      navigationSection: accessTeamsSection,
      component: AccessRbacTeamsPage,
    },
  ],
};

const coreExtension: AppExtension = {
  id: "core",
  title: "Core Extension",
  description: "Built-in terminal apps, dashboard surfaces, and theme presets.",
  widgets: [
    markdownNoteWidget,
    richTextNoteWidget,
    appComponentWidget,
    connectionQueryWidget,
    debugStreamWidget,
    tabularTransformWidget,
    tableWidget,
    graphWidget,
    statisticWidget,
    workspaceRowWidget,
  ],
  apps: [workspaceStudioApp, adminApp, accessRbacApp],
  themes: [
    mainSequenceSpaceTheme,
    mainSequenceTheme,
    cyberpunkTheme,
    neonMintTheme,
    draculaTheme,
    grandpaTheme,
    graphiteTheme,
    sapphireTheme,
    pandaTruenoTheme,
    sakuraTheme,
    quartzLightTheme,
  ],
};

export default coreExtension;
