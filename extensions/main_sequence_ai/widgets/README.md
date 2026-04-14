# Main Sequence AI Widgets

This folder owns widget modules shipped by the Main Sequence AI extension.

## Widgets

- `agent-terminal/`: terminal-style AgentSession widget that reuses the chat session endpoints and
  can compose a saved refresh prompt with several bound upstream widget contexts.
- `upstream-inspector/`: lightweight sink/debug widget for inspecting bound upstream values inside
  shared workspaces, including the agent-monitor surface.

## Maintenance Notes

- These widgets are now registered independently from the full `Main Sequence AI` app surfaces so
  they remain available in the shared workspace studio catalog.
- Keep widget ids stable so saved workspaces continue to resolve existing instances.
- Shared transport should stay in `../runtime/`; widget folders should focus on presentation and
  widget-specific state only.
- Agent-context bindings derived from widget live snapshots are now the preferred composition path
  for this extension. `Agent Terminal` consumes bound widget context instead of a bindable prompt
  string. See
  [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](../../../docs/adr/adr-widget-agent-context-bindings.md).
- Every registered widget definition in this folder now publishes `widgetVersion` plus an explicit
  backend-facing `registryContract` so admin registry sync can describe configuration, runtime
  behavior, IO semantics, and agent authoring guidance consistently.
- Widget authors must bump `widgetVersion` when widget behavior, configuration semantics, or
  machine-readable authoring guidance changes materially.
