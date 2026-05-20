---
id: adr-command-center-index
title: Command Center Architecture Decision Records
slug: /adr/command_center
---

This section is the decision log for `Command Center` architectural choices that affect more than
one file or one feature folder.

## Read This Section First

- Start with the ADRs closest to the area you are changing.
- If you are working on workspace runtime, start with the workspace/runtime ADRs below.
- If you are changing widget contracts or binding behavior, start with the widget contract ADRs.

## Workspace And Runtime ADRs

- [ADR 064: Variable References as Widget Graph Edges](./adr-064-variable-reference-graph-integration.md)
- [ADR 060: Instant Widget Settings Runtime](./adr-060-instant-widget-settings-runtime.md)
- [ADR 059: User-Instance Canonical Workspace Controls](./adr-059-user-instance-canonical-workspace-controls.md)
- [ADR 058: Cross-Widget References And Variables](./adr-058-cross-widget-references-and-variables.md)
- [ADR 057: Slide Studio Printable PDF Projection](./adr-057-slide-studio-printable-pdf-projection.md)
- [ADR 056: Slide Structural Containment in Workspace Graph](./adr-056-slide-structural-containment-in-workspace-graph.md)
- [ADR 055: Simplify Slide To Body-Only Widget Hosting](./adr-055-simplify-slide-to-body-only-widget-hosting.md)
- [ADR 054: Synthetic Public Workspace Render Permissions](./adr-054-synthetic-public-workspace-render-permissions.md)
- [ADR 053: Public View For Workspace And Slide Studio](./adr-053-public-view-for-workspace-and-slide-studio.md)
- [ADR 052: Slide Studio Slideshow Projection Mode](./adr-052-slide-studio-slideshow-projection-mode.md)
- [ADR 051: Consistent Widget Chrome Between Edit And View Modes](./adr-051-consistent-widget-chrome-between-edit-and-view-modes.md)
- [ADR 049: Publication-Driven Seed/Live Runtime Reduction](./adr-049-publication-driven-seed-live-runtime-reduction.md)
- [ADR 047: Workspace Runtime Data Reference Store](./adr-047-workspace-runtime-data-reference-store.md)
- [ADR 046: WebSocket Stream Survivability And Reconnect Supervision](./adr-046-websocket-stream-survivability-and-reconnect-supervision.md)
- [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
- [ADR 043: WebSocket Stream Preview And Graphing Semantics](./adr-043-websocket-stream-preview-graphing-semantics.md)
- [ADR 042: Lightweight Row Filtering in Tabular Transform](./adr-042-tabular-transform-row-filtering.md)
- [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
- [ADR 040: Dashboard Surface Return Hydration](./adr-040-dashboard-surface-return-hydration.md)
- [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
- [ADR 038: Progressive Workspace Initial Rendering and Per-Widget Hydration](./adr-038-progressive-workspace-widget-hydration.md)
- [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)
- [ADR: Use React Grid Layout v2 API in Workspace Studio](./adr-rgl-v2-workspace-studio.md)
- [ADR: Headless Workspace Widget Settings Runtime](./adr-headless-workspace-settings-runtime.md)
- [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)
- [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
- [ADR: Shared Connection Authoring Contract](./adr-connection-authoring-contract.md)
- [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)
- [ADR: Incremental Workspace Normalization and Resource-Scoped Save](./adr-incremental-workspace-normalization.md)
- [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
- [ADR: Live Workspace Agent Snapshot Archive](./adr-live-workspace-agent-snapshot-archive.md)
- [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](./adr-widget-agent-context-bindings.md)
- [ADR: Workspace Widget Referenced Workspace Graph Expansion](./adr-workspace-widget-referenced-graph-expansion.md)

## Widget Contract And Execution ADRs

- [ADR 067: Tabular Transform Owns Shared Computed Column Authoring](./adr-067-tabular-transform-owns-shared-computed-column-authoring.md)
- [ADR 065: Shared Table Core With Community And Pro Table Widgets](./adr-065-shared-table-core-with-community-and-pro-table-widgets.md)
- [ADR 066: Pro Table Formula Enablement And Asset Screener Pro Inheritance](./adr-066-shared-table-formula-contract-and-asset-screener-metric-despecialization.md)
- [ADR 064: Variable References as Widget Graph Edges](./adr-064-variable-reference-graph-integration.md)
- [ADR 063: Rename Portfolio Weights Widget To Position Detail](./adr-063-position-detail-widget-rename.md)
- [ADR 062: Typed Widget Module Pattern](./adr-062-typed-widget-module-pattern.md)
- [ADR 060: Instant Widget Settings Runtime](./adr-060-instant-widget-settings-runtime.md)
- [ADR 058: Cross-Widget References And Variables](./adr-058-cross-widget-references-and-variables.md)
- [ADR 056: Slide Structural Containment in Workspace Graph](./adr-056-slide-structural-containment-in-workspace-graph.md)
- [ADR 051: Consistent Widget Chrome Between Edit And View Modes](./adr-051-consistent-widget-chrome-between-edit-and-view-modes.md)
- [ADR 049: Publication-Driven Seed/Live Runtime Reduction](./adr-049-publication-driven-seed-live-runtime-reduction.md)
- [ADR 047: Workspace Runtime Data Reference Store](./adr-047-workspace-runtime-data-reference-store.md)
- [ADR 046: WebSocket Stream Survivability And Reconnect Supervision](./adr-046-websocket-stream-survivability-and-reconnect-supervision.md)
- [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
- [ADR 043: WebSocket Stream Preview And Graphing Semantics](./adr-043-websocket-stream-preview-graphing-semantics.md)
- [ADR 042: Lightweight Row Filtering in Tabular Transform](./adr-042-tabular-transform-row-filtering.md)
- [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
- [ADR 040: Dashboard Surface Return Hydration](./adr-040-dashboard-surface-return-hydration.md)
- [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
- [ADR 038: Progressive Workspace Initial Rendering and Per-Widget Hydration](./adr-038-progressive-workspace-widget-hydration.md)
- [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
- [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
- [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
- [ADR: Shared Connection Authoring Contract](./adr-connection-authoring-contract.md)
- [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
- [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
- [ADR: Source-Driven Downstream Execution After Manual Widget Actions](./adr-source-driven-downstream-execution.md)
- [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
- [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)
- [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)
- [ADR: Organization-Scoped Widget Type Configurations](./adr-organization-widget-type-configurations.md)
- [ADR: Inline Canvas Editing Capability and Rich Text Widget](./adr-inline-canvas-rich-text-widget.md)
- [ADR: Preview-Only Demo Drafts for Widget Settings](./adr-widget-settings-demo-preview-draft.md)

## AppComponent And API ADRs

- [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
- [ADR: Shared AppComponent Discovery and Safe-Response Caching](./adr-app-component-caching.md)
- [ADR: AppComponent Response Notification UI Contract](./adr-app-component-response-notification-ui.md)
- [ADR: AppComponent Mock JSON Target for Pipeline Prototyping](./adr-app-component-mock-json-target.md)
- [ADR: AdapterFromApi Dynamic OpenAPI Connection](./adr-adapter-from-api-connection.md)

## Shell And Extension ADRs

- [ADR 061: Usage Documentation App](./adr-061-usage-documentation-app.md)
- [ADR 057: Slide Studio Printable PDF Projection](./adr-057-slide-studio-printable-pdf-projection.md)
- [ADR 056: Slide Structural Containment in Workspace Graph](./adr-056-slide-structural-containment-in-workspace-graph.md)
- [ADR 055: Simplify Slide To Body-Only Widget Hosting](./adr-055-simplify-slide-to-body-only-widget-hosting.md)
- [ADR 054: Synthetic Public Workspace Render Permissions](./adr-054-synthetic-public-workspace-render-permissions.md)
- [ADR 053: Public View For Workspace And Slide Studio](./adr-053-public-view-for-workspace-and-slide-studio.md)
- [ADR 052: Slide Studio Slideshow Projection Mode](./adr-052-slide-studio-slideshow-projection-mode.md)
- [ADR 050: Workspace Slide As Structural Container](./adr-050-workspace-slide-as-structural-container.md)
- [ADR 049: Publication-Driven Seed/Live Runtime Reduction](./adr-049-publication-driven-seed-live-runtime-reduction.md)
- [ADR 047: Workspace Runtime Data Reference Store](./adr-047-workspace-runtime-data-reference-store.md)
- [ADR 046: WebSocket Stream Survivability And Reconnect Supervision](./adr-046-websocket-stream-survivability-and-reconnect-supervision.md)
- [ADR: Extension-Contributed Shell Settings Menus](./adr-extension-contributed-shell-settings-menus.md)
- [ADR: Runtime Credential Browser Auth](./adr-runtime-credential-browser-auth.md)
- [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
- [ADR: Shared Connection Authoring Contract](./adr-connection-authoring-contract.md)
- [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
- [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
- [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
- [ADR 043: WebSocket Stream Preview And Graphing Semantics](./adr-043-websocket-stream-preview-graphing-semantics.md)
- [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
- [ADR: Main Sequence Simple Table Connection](./adr-main-sequence-simple-table-connection.md)
- [ADR: PostgreSQL Custom Connection](./adr-postgresql-connection.md)

## Guidelines

- Write an ADR when the choice changes a shared contract, not for every implementation detail.
- New ADRs should use the next available sequential number in both the filename and title so
  chronology stays visible, for example `adr-038-short-name.md` with a heading like
  `# ADR 038: Title` when `038` is the next slot.
- Keep related investigative or remediation docs in the owning section, then link to them from the
  ADR when needed.
- Update the nearest implementation `README.md` when an accepted ADR changes authoring or runtime
  expectations.
- `Main Sequence AI` ADRs now live in [../mainsequence_ai/README.md](../mainsequence_ai/README.md).
