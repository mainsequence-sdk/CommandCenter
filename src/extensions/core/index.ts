import { LayoutTemplate, Settings2 } from "lucide-react";

import type { AppExtension } from "@/app/registry/types";
import { defineSurfaceAssistantContext, type AppDefinition } from "@/apps/types";
import { SavedWidgetsPage } from "@/features/dashboards/SavedWidgetsPage";
import { SlideStudioPage } from "@/features/dashboards/SlideStudioPage";
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
import { markdownNoteWidget } from "@/widgets/core/markdown-note/definition";
import { richTextNoteWidget } from "@/widgets/core/rich-text-note/definition";
import { appComponentWidget } from "@/widgets/core/app-component/definition";
import { connectionQueryWidget } from "@/widgets/core/connection-query/definition";
import { connectionStreamQueryWidget } from "@/widgets/core/connection-stream-query/definition";
import { debugStreamWidget } from "@/widgets/core/debug-stream/definition";
import { graphWidget } from "@/widgets/core/graph/definition";
import { tabularTransformWidget } from "@/widgets/core/tabular-transform/definition";
import { statisticWidget } from "@/widgets/core/statistic/definition";
import { tableWidget } from "@/widgets/core/table/definition";
import { proTableWidget } from "@/widgets/core/table/proDefinition";
import { workspaceRowWidget } from "@/widgets/core/workspace-row/definition";
import { workspaceSlideWidget } from "@/widgets/core/workspace-slide/definition";

export const workspaceStudioApp: AppDefinition = {
  id: "workspace-studio",
  title: "Workspaces",
  description: "User-scoped workspace builder with local development persistence.",
  source: "core",
  icon: LayoutTemplate,
  navigationOrder: 100,
  topNavigationStyle: "hidden",
  permissionDefinitions: [
    {
      id: "workspaces:view",
      label: "Workspaces / view",
      description: "Open the Workspaces application and workspace-backed shell surfaces.",
      category: "Workspaces",
    },
    {
      id: "workspaces:publish",
      label: "Workspaces / publish",
      description: "Publish, unpublish, and rotate public workspace URLs.",
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
      component: WorkspacesPage,
    },
    {
      id: "slide-studio",
      title: "Slide Studio",
      navLabel: "Slide Studio",
      description: "List, open, and manage slide-studio workspaces for presentation decks.",
      ...defineSurfaceAssistantContext({
        summary:
          "User is on the Slide Studio surface. This area manages presentation-oriented slide deck workspaces built on the shared workspace studio.",
        availableActions: [
          "Open a slide deck workspace",
          "Create a new slide deck",
          "Copy a slide deck workspace",
          "Favorite a slide deck workspace",
        ],
      }),
      kind: "page",
      fullBleed: true,
      component: SlideStudioPage,
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
      component: SavedWidgetsPage,
    },
  ],
};

function HiddenSettingsCatalogPage() {
  return null;
}

const settingsAccountSection = {
  id: "account",
  label: "Account",
  order: 10,
};

const settingsBillingSection = {
  id: "billing",
  label: "Billing",
  order: 20,
};

const settingsOrganizationSection = {
  id: "organization",
  label: "Organization",
  order: 30,
};

const settingsAccessRbacSection = {
  id: "access-rbac",
  label: "Access & RBAC",
  order: 35,
};

const settingsApplicationsSection = {
  id: "applications",
  label: "Applications",
  order: 40,
};

const settingsPlatformSection = {
  id: "platform",
  label: "System",
  order: 50,
};

export const settingsApp: AppDefinition = {
  id: "settings",
  title: "Settings",
  description: "Unified account, billing, organization, application, and system settings.",
  source: "core",
  icon: Settings2,
  navigationPlacement: "admin-menu",
  navigationOrder: 980,
  topNavigationStyle: "hidden",
  shellAccess: {
    scopeMode: "navigation-section",
  },
  defaultSurfaceId: "account/profile",
  surfaces: [
    {
      id: "account/profile",
      title: "Profile",
      navLabel: "Profile",
      description: "Manage account identity, profile image, and display details.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsAccountSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "account/preferences",
      title: "Preferences",
      navLabel: "Preferences",
      description: "Manage theme, language, and local shell preferences.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsAccountSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "account/security",
      title: "Security",
      navLabel: "Security",
      description: "Manage password, MFA, account deletion, and active sessions.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsAccountSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "account/sessions",
      title: "Sessions",
      navLabel: "Sessions",
      description: "Review and revoke active account sessions.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsAccountSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "account/usage-detail",
      title: "Usage Detail",
      navLabel: "Usage Detail",
      description: "Review personal credit usage, balance, and spending policy.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsAccountSection,
      shellAccess: {
        sectionId: "billing",
        surfaceId: "billing/credits",
      },
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "organization/users",
      title: "Organization Users",
      navLabel: "Users",
      description: "Browse organization-scoped users and account state.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsOrganizationSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "organization/plans",
      title: "Active Plans",
      navLabel: "Plans",
      description: "Review organization plan inventory and assignments.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsOrganizationSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "organization/security-sessions",
      title: "Security Sessions",
      navLabel: "Security Sessions",
      description: "Review and revoke organization-scoped tracked login sessions.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsOrganizationSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "organization/github",
      title: "GitHub Organizations",
      navLabel: "GitHub",
      description: "Review linked GitHub organizations and integration status.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsOrganizationSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "organization/widgets",
      title: "Widget Configurations",
      navLabel: "Widgets",
      description: "Review backend-registered widget types with organization configuration.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsOrganizationSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "access-rbac/inspector",
      title: "Organization User Inspector",
      navLabel: "Inspector",
      description: "Search users and inspect their effective shell access.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsAccessRbacSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "access-rbac/teams",
      title: "Teams",
      navLabel: "Teams",
      description: "Manage organization teams, memberships, and team sharing.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsAccessRbacSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "applications/main-sequence-markets",
      title: "Main Sequence Markets",
      navLabel: "Main Sequence Markets",
      description: "Select the Adapter From API connection used by Main Sequence Markets.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsApplicationsSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "billing/invoices",
      title: "Invoices",
      navLabel: "Invoices",
      description: "Review organization invoice history and statements.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsBillingSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "billing/details",
      title: "Billing Details",
      navLabel: "Billing Details",
      description: "Review organization billing profile and invoice recipients.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsBillingSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "billing/hosted-resources",
      title: "Hosted Resources",
      navLabel: "Hosted Resources",
      description: "Review organization-hosted infrastructure inventory.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsBillingSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "billing/hosted-resources/databases",
      title: "Managed Databases",
      navLabel: "Databases",
      description: "Create and review organization-hosted managed databases.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsBillingSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "billing/manage-credits",
      title: "Manage Credits",
      navLabel: "Manage Credits",
      description: "Manage organization credit balance, auto-reload, and user budgets.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsBillingSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "platform/auth",
      title: "Authentication",
      navLabel: "Authentication",
      description: "System authentication settings and diagnostics.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsPlatformSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "platform/configuration",
      title: "Configuration",
      navLabel: "Configuration",
      description: "System environment and runtime configuration.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsPlatformSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "platform/widget-registry",
      title: "Widget Registry",
      navLabel: "Widget Registry",
      description: "Review frontend widget registry and backend sync state.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsPlatformSection,
      component: HiddenSettingsCatalogPage,
    },
    {
      id: "platform/connection-registry",
      title: "Connection Registry",
      navLabel: "Connection Registry",
      description: "Review available connection type definitions.",
      kind: "page",
      fullBleed: true,
      navigationSection: settingsPlatformSection,
      component: HiddenSettingsCatalogPage,
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
    connectionStreamQueryWidget,
    debugStreamWidget,
    tabularTransformWidget,
    tableWidget,
    proTableWidget,
    graphWidget,
    statisticWidget,
    workspaceRowWidget,
    workspaceSlideWidget,
  ],
  apps: [workspaceStudioApp, settingsApp],
  themes: [
    mainSequenceSpaceTheme,
    mainSequenceTheme,
    cyberpunkTheme,
    neonMintTheme,
    draculaTheme,
    grandpaTheme,
    graphiteTheme,
    pandaTruenoTheme,
    sakuraTheme,
    quartzLightTheme,
  ],
};

export default coreExtension;
