# Main Sequence AI Agents Monitor Surface

## Purpose

This directory owns the `Agents Monitor` surface for the `Main Sequence AI` app.

The surface reuses the core workspace studio canvas instead of introducing a second agent-specific
canvas implementation. It filters that studio down to agent-monitor workspaces and the scoped
agent-monitor widgets: `Agent Terminal`, `WorkspaceReference`, and `Upstream Inspector`. It also exposes a
direct launcher flow that selects an allowlisted agent, creates a fresh session for it, and
inserts session-bound terminals without going through the generic widget settings path first. The
shared studio bindings inspector is also available here through each widget action menu, so
agent-monitor terminals can be wired through upstream bindings without leaving the monitor
surface. Open monitor workspaces also auto-enter edit mode on first load so the authoring chrome
is immediately available. The global saved-widget library link is intentionally hidden here until
saved-widget browsing can be constrained by the same agent-studio widget allowlist. The
`WorkspaceReference` widget is included in this curated surface list, but it is also available in the
broader Main Sequence AI widget catalog.

## Entry Points

- `AgentsMonitorPage.tsx`
  Agent-monitor workspace index plus selected-workspace host. It mounts the shared workspace
  studio/runtime stack through the reusable dashboard host and exposes the session launcher on both
  the landing page and the selected workspace toolbar.

## Dependencies

- `src/features/dashboards/WorkspaceStudioCanvasHost.tsx`
  Reusable selected-workspace host for the shared workspace studio providers and canvas pages.
- `src/features/dashboards/workspace-studio-surface-config.tsx`
  Surface-level studio configuration for widget-catalog filtering and route targets.
- `extensions/main_sequence_ai/agent-monitor-workspaces.ts`
  Agent-monitor workspace labels, creation helpers, and route helpers.
- `extensions/main_sequence_ai/widgets/agent-terminal/AgentTerminalWorkspaceLauncher.tsx`
  Reusable launcher dialog that selects an allowlisted agent, creates a fresh session, and inserts
  or creates terminal widgets.

## Maintenance Notes

- Keep this surface focused on agent-monitor workspaces only. General-purpose workspace behavior
  still belongs to the core `workspace-studio` app.
- If the monitor needs new AI-only widgets later, add them through the shared studio filter config
  instead of forking the canvas implementation.
- Prefer the direct launcher flow here over asking users to add a blank widget and then configure
  the widget manually. The launcher is now the canonical place to create a fresh managed session
  before inserting a terminal.
- Keep the surface allowlist narrow: `Agent Terminal`, `WorkspaceReference`, and `Upstream Inspector`
  only. Do not reintroduce general-purpose context widgets here unless the monitor workflow
  explicitly requires them.
