---
id: adr-index
title: Architecture Decision Records
slug: /adr
---

This section is the decision log for architectural choices that affect more than one file or one
feature folder.

## Read This Section First

- Start with the ADRs closest to the area you are changing.
- If you are working on workspace runtime, start with the workspace/runtime ADRs below.
- If you are changing widget contracts or binding behavior, start with the widget contract ADRs.

## Workspace And Runtime ADRs

- [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)
- [ADR: Use React Grid Layout v2 API in Workspace Studio](./adr-rgl-v2-workspace-studio.md)
- [ADR: Headless Workspace Widget Settings Runtime](./adr-headless-workspace-settings-runtime.md)
- [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)
- [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
- [ADR: Incremental Workspace Normalization and Resource-Scoped Save](./adr-incremental-workspace-normalization.md)
- [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
- [ADR: Query-Shaped WebSocket Streaming for Connections](./adr-connection-query-websocket-streaming.md)
- [ADR: Live Workspace Agent Snapshot Archive](./adr-live-workspace-agent-snapshot-archive.md)
- [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](./adr-widget-agent-context-bindings.md)
- [ADR: Workspace Widget Referenced Workspace Graph Expansion](./adr-workspace-widget-referenced-graph-expansion.md)

## Widget Contract And Execution ADRs

- [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
- [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
- [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
- [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
- [ADR: Query-Shaped WebSocket Streaming for Connections](./adr-connection-query-websocket-streaming.md)
- [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
- [ADR: Source-Driven Downstream Execution After Manual Widget Actions](./adr-source-driven-downstream-execution.md)
- [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
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

- [ADR: Extension-Contributed Shell Settings Menus](./adr-extension-contributed-shell-settings-menus.md)
- [ADR: Runtime Credential Browser Auth](./adr-runtime-credential-browser-auth.md)
- [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
- [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
- [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
- [ADR: Query-Shaped WebSocket Streaming for Connections](./adr-connection-query-websocket-streaming.md)
- [ADR: Main Sequence Simple Table Connection](./adr-main-sequence-simple-table-connection.md)
- [ADR: PostgreSQL Custom Connection](./adr-postgresql-connection.md)

## Main Sequence AI ADRs

- [ADR: Main Sequence AI Command Center Base Session](./adr-main-sequence-ai-command-center-base-session.md)
- [ADR: Main Sequence AI Runtime Endpoint Resolution](./adr-main-sequence-ai-runtime-endpoint-resolution.md)
- [ADR: Agent Terminal Managed Session Creation and Agent Allowlist](./adr-agent-terminal-managed-session-creation.md)
- [ADR: Main Sequence AI Workspace Reference Widget](./adr-agent-monitor-workspace-reference-widget.md)

## Guidelines

- Write an ADR when the choice changes a shared contract, not for every implementation detail.
- Keep related investigative or remediation docs in the owning section, then link to them from the
  ADR when needed.
- Update the nearest implementation `README.md` when an accepted ADR changes authoring or runtime
  expectations.
