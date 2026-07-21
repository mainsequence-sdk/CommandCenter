import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs/',
    component: ComponentCreator('/docs/', '71f'),
    routes: [
      {
        path: '/docs/',
        component: ComponentCreator('/docs/', 'ec9'),
        routes: [
          {
            path: '/docs/',
            component: ComponentCreator('/docs/', '01e'),
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
                path: '/docs/adr/command_center',
                component: ComponentCreator('/docs/adr/command_center', '2f8'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-038-progressive-workspace-widget-hydration',
                component: ComponentCreator('/docs/adr/command_center/adr-038-progressive-workspace-widget-hydration', '06a'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-039-unified-upstream-consumer-state-contract',
                component: ComponentCreator('/docs/adr/command_center/adr-039-unified-upstream-consumer-state-contract', '5c4'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-040-dashboard-surface-return-hydration',
                component: ComponentCreator('/docs/adr/command_center/adr-040-dashboard-surface-return-hydration', 'ce4'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-041-connection-query-websocket-streaming',
                component: ComponentCreator('/docs/adr/command_center/adr-041-connection-query-websocket-streaming', 'cb2'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-042-tabular-transform-row-filtering',
                component: ComponentCreator('/docs/adr/command_center/adr-042-tabular-transform-row-filtering', 'a97'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-043-websocket-stream-preview-graphing-semantics',
                component: ComponentCreator('/docs/adr/command_center/adr-043-websocket-stream-preview-graphing-semantics', 'ee0'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-044-incremental-connection-publications-seed-live-roles',
                component: ComponentCreator('/docs/adr/command_center/adr-044-incremental-connection-publications-seed-live-roles', '7f1'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-045-agent-facing-workspace-snapshot-contract',
                component: ComponentCreator('/docs/adr/command_center/adr-045-agent-facing-workspace-snapshot-contract', 'e9f'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-046-websocket-stream-survivability-and-reconnect-supervision',
                component: ComponentCreator('/docs/adr/command_center/adr-046-websocket-stream-survivability-and-reconnect-supervision', '149'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-047-workspace-runtime-data-reference-store',
                component: ComponentCreator('/docs/adr/command_center/adr-047-workspace-runtime-data-reference-store', '1fa'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-048-alpaca-websocket-command-center-extension',
                component: ComponentCreator('/docs/adr/command_center/adr-048-alpaca-websocket-command-center-extension', '938'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-049-publication-driven-seed-live-runtime-reduction',
                component: ComponentCreator('/docs/adr/command_center/adr-049-publication-driven-seed-live-runtime-reduction', '620'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-050-workspace-slide-as-structural-container',
                component: ComponentCreator('/docs/adr/command_center/adr-050-workspace-slide-as-structural-container', '863'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-051-consistent-widget-chrome-between-edit-and-view-modes',
                component: ComponentCreator('/docs/adr/command_center/adr-051-consistent-widget-chrome-between-edit-and-view-modes', 'a39'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-052-slide-studio-slideshow-projection-mode',
                component: ComponentCreator('/docs/adr/command_center/adr-052-slide-studio-slideshow-projection-mode', '8eb'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-053-public-view-for-workspace-and-slide-studio',
                component: ComponentCreator('/docs/adr/command_center/adr-053-public-view-for-workspace-and-slide-studio', 'c9e'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-054-synthetic-public-workspace-render-permissions',
                component: ComponentCreator('/docs/adr/command_center/adr-054-synthetic-public-workspace-render-permissions', 'df2'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-055-simplify-slide-to-body-only-widget-hosting',
                component: ComponentCreator('/docs/adr/command_center/adr-055-simplify-slide-to-body-only-widget-hosting', 'c43'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-056-slide-structural-containment-in-workspace-graph',
                component: ComponentCreator('/docs/adr/command_center/adr-056-slide-structural-containment-in-workspace-graph', 'c6b'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-057-slide-studio-printable-pdf-projection',
                component: ComponentCreator('/docs/adr/command_center/adr-057-slide-studio-printable-pdf-projection', '331'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-058-cross-widget-references-and-variables',
                component: ComponentCreator('/docs/adr/command_center/adr-058-cross-widget-references-and-variables', '060'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-059-user-instance-canonical-workspace-controls',
                component: ComponentCreator('/docs/adr/command_center/adr-059-user-instance-canonical-workspace-controls', '373'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-060-instant-widget-settings-runtime',
                component: ComponentCreator('/docs/adr/command_center/adr-060-instant-widget-settings-runtime', '0d8'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-061-usage-documentation-app',
                component: ComponentCreator('/docs/adr/command_center/adr-061-usage-documentation-app', '41f'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-062-typed-widget-module-pattern',
                component: ComponentCreator('/docs/adr/command_center/adr-062-typed-widget-module-pattern', '64b'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-063-position-detail-widget-rename',
                component: ComponentCreator('/docs/adr/command_center/adr-063-position-detail-widget-rename', '69f'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-064-variable-reference-graph-integration',
                component: ComponentCreator('/docs/adr/command_center/adr-064-variable-reference-graph-integration', 'e77'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-065-shared-table-core-with-community-and-pro-table-widgets',
                component: ComponentCreator('/docs/adr/command_center/adr-065-shared-table-core-with-community-and-pro-table-widgets', 'f1e'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-066-shared-table-formula-contract-and-asset-screener-metric-despecialization',
                component: ComponentCreator('/docs/adr/command_center/adr-066-shared-table-formula-contract-and-asset-screener-metric-despecialization', 'cf9'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-067-tabular-transform-owns-shared-computed-column-authoring',
                component: ComponentCreator('/docs/adr/command_center/adr-067-tabular-transform-owns-shared-computed-column-authoring', 'bab'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-067b-websocket-stream-run-boundary-reset',
                component: ComponentCreator('/docs/adr/command_center/adr-067b-websocket-stream-run-boundary-reset', 'dbb'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-068-automatic-partial-websocket-row-patching-for-tabular-consumers',
                component: ComponentCreator('/docs/adr/command_center/adr-068-automatic-partial-websocket-row-patching-for-tabular-consumers', 'be1'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-069-websocket-stream-variable-resubscription',
                component: ComponentCreator('/docs/adr/command_center/adr-069-websocket-stream-variable-resubscription', 'd33'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-070-workspace-variable-explorer',
                component: ComponentCreator('/docs/adr/command_center/adr-070-workspace-variable-explorer', '7b9'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-071-atomic-widget-settings-workspace-save',
                component: ComponentCreator('/docs/adr/command_center/adr-071-atomic-widget-settings-workspace-save', '785'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-072-backend-variables-and-reference-defaults',
                component: ComponentCreator('/docs/adr/command_center/adr-072-backend-variables-and-reference-defaults', '79a'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-073-split-finite-execution-and-stream-publication-planning',
                component: ComponentCreator('/docs/adr/command_center/adr-073-split-finite-execution-and-stream-publication-planning', '8aa'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-074-adapter-from-api-debug-direct-mode',
                component: ComponentCreator('/docs/adr/command_center/adr-074-adapter-from-api-debug-direct-mode', '299'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-077-client-side-mysql-connection',
                component: ComponentCreator('/docs/adr/command_center/adr-077-client-side-mysql-connection', '417'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-078-client-side-sql-server-connection',
                component: ComponentCreator('/docs/adr/command_center/adr-078-client-side-sql-server-connection', '762'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-079-unified-routed-settings-module',
                component: ComponentCreator('/docs/adr/command_center/adr-079-unified-routed-settings-module', 'ecf'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-080-resolved-shell-access-as-visualization-gates',
                component: ComponentCreator('/docs/adr/command_center/adr-080-resolved-shell-access-as-visualization-gates', 'a1c'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-081-general-shell-access-scope-resolution',
                component: ComponentCreator('/docs/adr/command_center/adr-081-general-shell-access-scope-resolution', '985'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-adapter-from-api-connection',
                component: ComponentCreator('/docs/adr/command_center/adr-adapter-from-api-connection', 'eae'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-agent-ready-widget-type-registry-contract',
                component: ComponentCreator('/docs/adr/command_center/adr-agent-ready-widget-type-registry-contract', '06f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-app-component-binding-native-api-widget',
                component: ComponentCreator('/docs/adr/command_center/adr-app-component-binding-native-api-widget', '268'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-app-component-caching',
                component: ComponentCreator('/docs/adr/command_center/adr-app-component-caching', '682'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-app-component-mock-json-target',
                component: ComponentCreator('/docs/adr/command_center/adr-app-component-mock-json-target', '099'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-app-component-response-notification-ui',
                component: ComponentCreator('/docs/adr/command_center/adr-app-component-response-notification-ui', '48f'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-binding-output-transforms',
                component: ComponentCreator('/docs/adr/command_center/adr-binding-output-transforms', '865'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-connection-authoring-contract',
                component: ComponentCreator('/docs/adr/command_center/adr-connection-authoring-contract', 'cc0'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-connection-first-workspace-dataflow',
                component: ComponentCreator('/docs/adr/command_center/adr-connection-first-workspace-dataflow', '97a'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-executable-widget-graph-runner',
                component: ComponentCreator('/docs/adr/command_center/adr-executable-widget-graph-runner', 'a69'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-extension-contributed-shell-settings-menus',
                component: ComponentCreator('/docs/adr/command_center/adr-extension-contributed-shell-settings-menus', 'ea5'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-first-class-connection-model',
                component: ComponentCreator('/docs/adr/command_center/adr-first-class-connection-model', '9f1'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-headless-workspace-settings-runtime',
                component: ComponentCreator('/docs/adr/command_center/adr-headless-workspace-settings-runtime', 'eb1'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-incremental-connection-response-refresh',
                component: ComponentCreator('/docs/adr/command_center/adr-incremental-connection-response-refresh', 'ac9'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-incremental-workspace-normalization',
                component: ComponentCreator('/docs/adr/command_center/adr-incremental-workspace-normalization', '364'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-inline-canvas-rich-text-widget',
                component: ComponentCreator('/docs/adr/command_center/adr-inline-canvas-rich-text-widget', 'aa6'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-live-workspace-agent-snapshot-archive',
                component: ComponentCreator('/docs/adr/command_center/adr-live-workspace-agent-snapshot-archive', 'f60'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-main-sequence-simple-table-connection',
                component: ComponentCreator('/docs/adr/command_center/adr-main-sequence-simple-table-connection', 'fd3'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-managed-connection-query-widget-sources',
                component: ComponentCreator('/docs/adr/command_center/adr-managed-connection-query-widget-sources', 'bae'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-organization-widget-type-configurations',
                component: ComponentCreator('/docs/adr/command_center/adr-organization-widget-type-configurations', '716'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-postgresql-connection',
                component: ComponentCreator('/docs/adr/command_center/adr-postgresql-connection', 'cf0'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-rgl-v2-workspace-studio',
                component: ComponentCreator('/docs/adr/command_center/adr-rgl-v2-workspace-studio', '9a4'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-runtime-credential-browser-auth',
                component: ComponentCreator('/docs/adr/command_center/adr-runtime-credential-browser-auth', '34e'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-shared-workspace-state',
                component: ComponentCreator('/docs/adr/command_center/adr-shared-workspace-state', '51d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-single-runtime-owner-workspace-widgets',
                component: ComponentCreator('/docs/adr/command_center/adr-single-runtime-owner-workspace-widgets', 'a26'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-source-driven-downstream-execution',
                component: ComponentCreator('/docs/adr/command_center/adr-source-driven-downstream-execution', 'd4a'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-standardized-connection-result-contracts',
                component: ComponentCreator('/docs/adr/command_center/adr-standardized-connection-result-contracts', '79b'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-widget-agent-context-bindings',
                component: ComponentCreator('/docs/adr/command_center/adr-widget-agent-context-bindings', 'fe2'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-widget-bindings-and-dependency-graph',
                component: ComponentCreator('/docs/adr/command_center/adr-widget-bindings-and-dependency-graph', 'e81'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/command_center/adr-widget-settings-demo-preview-draft',
                component: ComponentCreator('/docs/adr/command_center/adr-widget-settings-demo-preview-draft', '7e7'),
                exact: true
              },
              {
                path: '/docs/adr/command_center/adr-workspace-widget-referenced-graph-expansion',
                component: ComponentCreator('/docs/adr/command_center/adr-workspace-widget-referenced-graph-expansion', 'f21'),
                exact: true
              },
              {
                path: '/docs/adr/main_sequence',
                component: ComponentCreator('/docs/adr/main_sequence', 'c79'),
                exact: true
              },
              {
                path: '/docs/adr/main_sequence/adr-074-uid-only-main-sequence-backend-identifier-contracts',
                component: ComponentCreator('/docs/adr/main_sequence/adr-074-uid-only-main-sequence-backend-identifier-contracts', '5de'),
                exact: true
              },
              {
                path: '/docs/adr/main_sequence/adr-075-ms-markets-api-binding',
                component: ComponentCreator('/docs/adr/main_sequence/adr-075-ms-markets-api-binding', 'cbd'),
                exact: true
              },
              {
                path: '/docs/adr/mainsequence_ai',
                component: ComponentCreator('/docs/adr/mainsequence_ai', '87c'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-058-refactor-project-agent-creation',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-058-refactor-project-agent-creation', '893'),
                exact: true
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-059-global-settings-runtime-resolution',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-059-global-settings-runtime-resolution', '497'),
                exact: true
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-060-session-backed-chat-request-contract',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-060-session-backed-chat-request-contract', 'dcd'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-062-remove-unused-agent-resource-models',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-062-remove-unused-agent-resource-models', '8fd'),
                exact: true
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-063-project-agent-configuration-source-of-truth',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-063-project-agent-configuration-source-of-truth', '8dd'),
                exact: true
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-076-agent-detail-capabilities-tab',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-076-agent-detail-capabilities-tab', '30c'),
                exact: true
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-077-unified-astro-coding-agent-bootstrap',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-077-unified-astro-coding-agent-bootstrap', 'c94'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-078-capability-registry-surface-and-editor-widget',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-078-capability-registry-surface-and-editor-widget', 'd5d'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-agent-monitor-workspace-reference-widget',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-agent-monitor-workspace-reference-widget', '95a'),
                exact: true
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-agent-session-interaction-readiness-gate',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-agent-session-interaction-readiness-gate', 'af8'),
                exact: true
              },
              {
                path: '/docs/adr/mainsequence_ai/adr-agent-terminal-managed-session-creation',
                component: ComponentCreator('/docs/adr/mainsequence_ai/adr-agent-terminal-managed-session-creation', '03a'),
                exact: true
              },
              {
                path: '/docs/adrs/mainsequence-ai/adr-063-user-ai-initialization',
                component: ComponentCreator('/docs/adrs/mainsequence-ai/adr-063-user-ai-initialization', '505'),
                exact: true
              },
              {
                path: '/docs/adrs/mainsequence-ai/adr-064-agent-type-identity',
                component: ComponentCreator('/docs/adrs/mainsequence-ai/adr-064-agent-type-identity', 'd04'),
                exact: true
              },
              {
                path: '/docs/adrs/mainsequence-markets/adrs/adr-001-market-asset-screener-data-contract',
                component: ComponentCreator('/docs/adrs/mainsequence-markets/adrs/adr-001-market-asset-screener-data-contract', '3ca'),
                exact: true
              },
              {
                path: '/docs/adrs/widgets/adr-001-table-selection-outputs',
                component: ComponentCreator('/docs/adrs/widgets/adr-001-table-selection-outputs', '914'),
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
                path: '/docs/connections/',
                component: ComponentCreator('/docs/connections/', '35f'),
                exact: true
              },
              {
                path: '/docs/connections/adapters/',
                component: ComponentCreator('/docs/connections/adapters/', '6b1'),
                exact: true
              },
              {
                path: '/docs/connections/extension-guide',
                component: ComponentCreator('/docs/connections/extension-guide', 'f00'),
                exact: true
              },
              {
                path: '/docs/connections/models-and-contracts',
                component: ComponentCreator('/docs/connections/models-and-contracts', '963'),
                exact: true
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
                path: '/docs/implementation_tasks/adapter-from-api-debug-direct/',
                component: ComponentCreator('/docs/implementation_tasks/adapter-from-api-debug-direct/', 'c35'),
                exact: true
              },
              {
                path: '/docs/implementation_tasks/adapter-from-api-debug-direct/task-001-backend-direct-mode-persistence',
                component: ComponentCreator('/docs/implementation_tasks/adapter-from-api-debug-direct/task-001-backend-direct-mode-persistence', '716'),
                exact: true
              },
              {
                path: '/docs/implementation_tasks/adapter-from-api-debug-direct/task-002-frontend-config-and-direct-discovery',
                component: ComponentCreator('/docs/implementation_tasks/adapter-from-api-debug-direct/task-002-frontend-config-and-direct-discovery', '733'),
                exact: true
              },
              {
                path: '/docs/implementation_tasks/adapter-from-api-debug-direct/task-003-direct-execution-runtime-and-workspace-routing',
                component: ComponentCreator('/docs/implementation_tasks/adapter-from-api-debug-direct/task-003-direct-execution-runtime-and-workspace-routing', '449'),
                exact: true
              },
              {
                path: '/docs/implementation_tasks/agent-capability-registry-surface/task-001-capability-registry-surface-and-shared-editor',
                component: ComponentCreator('/docs/implementation_tasks/agent-capability-registry-surface/task-001-capability-registry-surface-and-shared-editor', 'deb'),
                exact: true
              },
              {
                path: '/docs/implementation_tasks/coding-agent-deployment-unification/task-001-unify-coding-agent-deployment-workflow',
                component: ComponentCreator('/docs/implementation_tasks/coding-agent-deployment-unification/task-001-unify-coding-agent-deployment-workflow', '0e8'),
                exact: true
              },
              {
                path: '/docs/implementation_tasks/main-sequence-registry-pagination-problem/',
                component: ComponentCreator('/docs/implementation_tasks/main-sequence-registry-pagination-problem/', 'fe3'),
                exact: true
              },
              {
                path: '/docs/implementation_tasks/ms-markets-api-binding/',
                component: ComponentCreator('/docs/implementation_tasks/ms-markets-api-binding/', 'f4c'),
                exact: true
              },
              {
                path: '/docs/implementation_tasks/ms-markets-api-binding/task-001-bind-main-sequence-markets-to-adapter-from-api',
                component: ComponentCreator('/docs/implementation_tasks/ms-markets-api-binding/task-001-bind-main-sequence-markets-to-adapter-from-api', '11a'),
                exact: true
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
                path: '/docs/workspaces/reference-variables',
                component: ComponentCreator('/docs/workspaces/reference-variables', '159'),
                exact: true
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
