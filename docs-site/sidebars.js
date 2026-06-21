/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: "doc",
      id: "README",
      label: "Overview",
    },
    {
      type: "category",
      label: "Platform",
      collapsed: false,
      items: [
        "platform/platform-index",
        "platform/architecture",
        "platform/configuration",
        "platform/theming",
        "platform/internationalization",
        "platform/notifications",
      ],
    },
    {
      type: "category",
      label: "Apps",
      collapsed: false,
      items: ["apps/apps-index", "apps/overview"],
    },
    {
      type: "category",
      label: "Widgets",
      collapsed: false,
      items: ["widgets/widgets-index", "widgets/core-widgets"],
    },
    {
      type: "category",
      label: "Workspaces",
      collapsed: false,
      items: [
        "workspaces/workspaces-index",
        "workspaces/overview",
        "workspaces/dashboard-layouts",
        "workspaces/backend-model",
        "workspaces/runtime-performance-remediation",
        "workspaces/settings-headless-runtime-investigation",
      ],
    },
    {
      type: "category",
      label: "Extensions",
      collapsed: false,
      items: ["extensions/extensions-index", "extensions/overview"],
    },
    {
      type: "category",
      label: "Auth",
      collapsed: false,
      items: ["auth/auth-index", "auth/backend-and-auth"],
    },
    {
      type: "category",
      label: "Access Control",
      collapsed: false,
      items: [
        "access-control/access-control-index",
        "access-control/rbac-assignment-matrix",
        "access-control/access-rbac-app",
      ],
    },
    {
      type: "category",
      label: "Operations",
      collapsed: false,
      items: ["operations/operations-index", "operations/deployment"],
    },
    {
      type: "category",
      label: "ADRs",
      collapsed: true,
      items: [
        "adr/adr-index",
        {
          type: "category",
          label: "Workspace And Runtime",
          collapsed: true,
          items: [
            "adr/command_center/adr-shared-workspace-state",
            "adr/command_center/adr-rgl-v2-workspace-studio",
            "adr/command_center/adr-headless-workspace-settings-runtime",
            "adr/command_center/adr-single-runtime-owner-workspace-widgets",
            "adr/command_center/adr-incremental-workspace-normalization",
            "adr/command_center/adr-live-workspace-agent-snapshot-archive",
            "adr/command_center/adr-widget-agent-context-bindings",
          ],
        },
        {
          type: "category",
          label: "Widget Contracts",
          collapsed: true,
          items: [
            "adr/command_center/adr-widget-bindings-and-dependency-graph",
            "adr/command_center/adr-binding-output-transforms",
            "adr/command_center/adr-executable-widget-graph-runner",
            "adr/command_center/adr-source-driven-downstream-execution",
            "adr/command_center/adr-agent-ready-widget-type-registry-contract",
            "adr/command_center/adr-organization-widget-type-configurations",
            "adr/command_center/adr-inline-canvas-rich-text-widget",
          ],
        },
        {
          type: "category",
          label: "AppComponent And API",
          collapsed: true,
          items: [
            "adr/command_center/adr-078-client-side-sql-server-connection",
            "adr/command_center/adr-077-client-side-mysql-connection",
            "adr/command_center/adr-app-component-binding-native-api-widget",
            "adr/command_center/adr-app-component-caching",
            "adr/command_center/adr-app-component-response-notification-ui",
            "adr/command_center/adr-app-component-mock-json-target",
          ],
        },
        {
          type: "category",
          label: "Shell And Extensions",
          collapsed: true,
          items: [
            "adr/command_center/adr-extension-contributed-shell-settings-menus",
            "adr/command_center/adr-runtime-credential-browser-auth",
          ],
        },
        {
          type: "category",
          label: "Main Sequence AI",
          collapsed: true,
          items: [
            "adr/mainsequence_ai/adr-main-sequence-ai-command-center-base-session",
            "adr/mainsequence_ai/adr-main-sequence-ai-runtime-endpoint-resolution",
          ],
        },
      ],
    },
  ],
};

module.exports = sidebars;
