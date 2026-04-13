# Main Sequence AI Widgets

This folder owns widget modules shipped by the Main Sequence AI extension.

## Widgets

- `agent-terminal/`: terminal-style AgentSession widget that reuses the chat session endpoints.
- `upstream-inspector/`: lightweight sink/debug widget for inspecting bound upstream values inside
  agent-monitor workspaces.

## Maintenance Notes

- Keep widget ids stable so saved workspaces continue to resolve existing instances.
- Shared transport should stay in `../runtime/`; widget folders should focus on presentation and
  widget-specific state only.
- Every registered widget definition in this folder now publishes `widgetVersion` plus an explicit
  backend-facing `registryContract` so admin registry sync can describe configuration, runtime
  behavior, IO semantics, and agent authoring guidance consistently.
- Widget authors must bump `widgetVersion` when widget behavior, configuration semantics, or
  machine-readable authoring guidance changes materially.
