import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs/',
    component: ComponentCreator('/docs/', 'c39'),
    routes: [
      {
        path: '/docs/',
        component: ComponentCreator('/docs/', '6d1'),
        routes: [
          {
            path: '/docs/',
            component: ComponentCreator('/docs/', '517'),
            routes: [
              {
                path: '/docs/access-control',
                component: ComponentCreator('/docs/access-control', '073'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/access-control/access-rbac-app',
                component: ComponentCreator('/docs/access-control/access-rbac-app', '868'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/access-control/rbac-assignment-matrix',
                component: ComponentCreator('/docs/access-control/rbac-assignment-matrix', '1cc'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr',
                component: ComponentCreator('/docs/adr', '265'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-agent-monitor-workspace-reference-widget',
                component: ComponentCreator('/docs/adr/adr-agent-monitor-workspace-reference-widget', '29b'),
                exact: true
              },
              {
                path: '/docs/adr/adr-agent-ready-widget-type-registry-contract',
                component: ComponentCreator('/docs/adr/adr-agent-ready-widget-type-registry-contract', '005'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-agent-terminal-managed-session-creation',
                component: ComponentCreator('/docs/adr/adr-agent-terminal-managed-session-creation', 'bfa'),
                exact: true
              },
              {
                path: '/docs/adr/adr-app-component-binding-native-api-widget',
                component: ComponentCreator('/docs/adr/adr-app-component-binding-native-api-widget', '7f0'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-app-component-caching',
                component: ComponentCreator('/docs/adr/adr-app-component-caching', '222'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-app-component-mock-json-target',
                component: ComponentCreator('/docs/adr/adr-app-component-mock-json-target', 'da1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-app-component-response-notification-ui',
                component: ComponentCreator('/docs/adr/adr-app-component-response-notification-ui', 'ce1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-binding-output-transforms',
                component: ComponentCreator('/docs/adr/adr-binding-output-transforms', 'cbb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-executable-widget-graph-runner',
                component: ComponentCreator('/docs/adr/adr-executable-widget-graph-runner', '4e5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-extension-contributed-shell-settings-menus',
                component: ComponentCreator('/docs/adr/adr-extension-contributed-shell-settings-menus', '05f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-first-class-connection-model',
                component: ComponentCreator('/docs/adr/adr-first-class-connection-model', 'e3f'),
                exact: true
              },
              {
                path: '/docs/adr/adr-headless-workspace-settings-runtime',
                component: ComponentCreator('/docs/adr/adr-headless-workspace-settings-runtime', '609'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-incremental-workspace-normalization',
                component: ComponentCreator('/docs/adr/adr-incremental-workspace-normalization', 'c0c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-inline-canvas-rich-text-widget',
                component: ComponentCreator('/docs/adr/adr-inline-canvas-rich-text-widget', '905'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-live-workspace-agent-snapshot-archive',
                component: ComponentCreator('/docs/adr/adr-live-workspace-agent-snapshot-archive', '478'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-main-sequence-ai-command-center-base-session',
                component: ComponentCreator('/docs/adr/adr-main-sequence-ai-command-center-base-session', 'e22'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-main-sequence-ai-runtime-endpoint-resolution',
                component: ComponentCreator('/docs/adr/adr-main-sequence-ai-runtime-endpoint-resolution', '278'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-organization-widget-type-configurations',
                component: ComponentCreator('/docs/adr/adr-organization-widget-type-configurations', '286'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-rgl-v2-workspace-studio',
                component: ComponentCreator('/docs/adr/adr-rgl-v2-workspace-studio', '563'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-runtime-credential-browser-auth',
                component: ComponentCreator('/docs/adr/adr-runtime-credential-browser-auth', '4ee'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-shared-workspace-state',
                component: ComponentCreator('/docs/adr/adr-shared-workspace-state', 'a15'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-single-runtime-owner-workspace-widgets',
                component: ComponentCreator('/docs/adr/adr-single-runtime-owner-workspace-widgets', '9e4'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-source-driven-downstream-execution',
                component: ComponentCreator('/docs/adr/adr-source-driven-downstream-execution', '84c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-widget-agent-context-bindings',
                component: ComponentCreator('/docs/adr/adr-widget-agent-context-bindings', 'bbe'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-widget-bindings-and-dependency-graph',
                component: ComponentCreator('/docs/adr/adr-widget-bindings-and-dependency-graph', 'acd'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/adr-widget-settings-demo-preview-draft',
                component: ComponentCreator('/docs/adr/adr-widget-settings-demo-preview-draft', 'a0f'),
                exact: true
              },
              {
                path: '/docs/adr/adr-workspace-widget-referenced-graph-expansion',
                component: ComponentCreator('/docs/adr/adr-workspace-widget-referenced-graph-expansion', 'e3c'),
                exact: true
              },
              {
                path: '/docs/apps',
                component: ComponentCreator('/docs/apps', '6d0'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/apps/overview',
                component: ComponentCreator('/docs/apps/overview', '77e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/auth',
                component: ComponentCreator('/docs/auth', '075'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/auth/backend-and-auth',
                component: ComponentCreator('/docs/auth/backend-and-auth', '2b0'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/extensions',
                component: ComponentCreator('/docs/extensions', '40c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/extensions/overview',
                component: ComponentCreator('/docs/extensions/overview', '77e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/operations',
                component: ComponentCreator('/docs/operations', 'cba'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/operations/deployment',
                component: ComponentCreator('/docs/operations/deployment', 'cdb'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/platform',
                component: ComponentCreator('/docs/platform', 'ca8'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/platform/architecture',
                component: ComponentCreator('/docs/platform/architecture', '77c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/platform/configuration',
                component: ComponentCreator('/docs/platform/configuration', '22b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/platform/internationalization',
                component: ComponentCreator('/docs/platform/internationalization', 'd6b'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/platform/notifications',
                component: ComponentCreator('/docs/platform/notifications', 'ae2'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/platform/theming',
                component: ComponentCreator('/docs/platform/theming', 'bbf'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/widgets',
                component: ComponentCreator('/docs/widgets', '66d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/widgets/core-widgets',
                component: ComponentCreator('/docs/widgets/core-widgets', '2f5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/workspaces',
                component: ComponentCreator('/docs/workspaces', 'b5c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/workspaces/agent-monitor-workspace-widget-plan',
                component: ComponentCreator('/docs/workspaces/agent-monitor-workspace-widget-plan', 'df1'),
                exact: true
              },
              {
                path: '/docs/workspaces/backend-model',
                component: ComponentCreator('/docs/workspaces/backend-model', 'cf0'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/workspaces/dashboard-layouts',
                component: ComponentCreator('/docs/workspaces/dashboard-layouts', 'f86'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/workspaces/overview',
                component: ComponentCreator('/docs/workspaces/overview', '41f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/workspaces/runtime-performance-remediation',
                component: ComponentCreator('/docs/workspaces/runtime-performance-remediation', '627'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/workspaces/settings-headless-runtime-investigation',
                component: ComponentCreator('/docs/workspaces/settings-headless-runtime-investigation', 'b50'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/',
                component: ComponentCreator('/docs/', '597'),
                exact: true,
                sidebar: "docsSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
