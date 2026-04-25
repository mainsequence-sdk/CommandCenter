# Main Sequence AI Widgets

This folder owns widget modules shipped by the Main Sequence AI extension.

## Widgets

- `agent-terminal/`: terminal-style managed AgentSession widget that creates or reuses one
  widget-owned session for an allowlisted agent and can compose a saved refresh prompt with
  several bound upstream widget contexts or workspace references.
- `upstream-inspector/`: lightweight sink/debug widget for inspecting bound upstream values inside
  shared workspaces, including the agent-monitor surface.
- `workspace/`: `Workspace`, a minimal reference widget that publishes one selected workspace id as
  `main-sequence-ai.workspace-reference@v1` and blocks self-selection.

## Maintenance Notes

- These widgets are now registered independently from the full `Main Sequence AI` app surfaces so
  they remain available in the shared workspace studio catalog.
- Keep widget ids stable so saved workspaces continue to resolve existing instances.
- Shared transport should stay in `../runtime/`; widget folders should focus on presentation and
  widget-specific state only.
- Agent-context bindings derived from widget live snapshots remain a primary composition path for
  this extension, and the `Workspace` widget adds an explicit workspace-id reference path.
  `Agent Terminal` consumes these bound upstream sources instead of a bindable prompt string. See
  [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](../../../docs/adr/adr-widget-agent-context-bindings.md).
- Every registered widget definition in this folder now publishes `widgetVersion` plus an explicit
  backend-facing `registryContract` so admin registry sync can describe configuration, runtime
  behavior, IO semantics, and agent authoring guidance consistently.
- Widget authors must bump `widgetVersion` when widget behavior, configuration semantics, or
  machine-readable authoring guidance changes materially.
