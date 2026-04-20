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
- [ADR: Incremental Workspace Normalization and Resource-Scoped Save](./adr-incremental-workspace-normalization.md)
- [ADR: Live Workspace Agent Snapshot Archive](./adr-live-workspace-agent-snapshot-archive.md)
- [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](./adr-widget-agent-context-bindings.md)

## Widget Contract And Execution ADRs

- [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
- [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
- [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
- [ADR: Source-Driven Downstream Execution After Manual Widget Actions](./adr-source-driven-downstream-execution.md)
- [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)
- [ADR: Organization-Scoped Widget Type Configurations](./adr-organization-widget-type-configurations.md)
- [ADR: Inline Canvas Editing Capability and Rich Text Widget](./adr-inline-canvas-rich-text-widget.md)

## AppComponent And API ADRs

- [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
- [ADR: Shared AppComponent Discovery and Safe-Response Caching](./adr-app-component-caching.md)
- [ADR: AppComponent Response Notification UI Contract](./adr-app-component-response-notification-ui.md)
- [ADR: AppComponent Mock JSON Target for Pipeline Prototyping](./adr-app-component-mock-json-target.md)

## Shell And Extension ADRs

- [ADR: Extension-Contributed Shell Settings Menus](./adr-extension-contributed-shell-settings-menus.md)

## Main Sequence AI ADRs

- [ADR: Main Sequence AI Command Center Base Session](./adr-main-sequence-ai-command-center-base-session.md)
- [ADR: Main Sequence AI Runtime Endpoint Resolution](./adr-main-sequence-ai-runtime-endpoint-resolution.md)

## Guidelines

- Write an ADR when the choice changes a shared contract, not for every implementation detail.
- Keep related investigative or remediation docs in the owning section, then link to them from the
  ADR when needed.
- Update the nearest implementation `README.md` when an accepted ADR changes authoring or runtime
  expectations.
