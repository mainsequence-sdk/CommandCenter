# Main Sequence AI

## Purpose

This extension owns the Main Sequence AI application and the assistant-ui integration used by the shell chat experience.

It currently exposes one app with three visible surfaces plus one hidden deep-link surface:

- `Main Sequence AI`
- `Chat`
- `Agents`
- `Agents Monitor`
- `Agent Session` (hidden route surface)

It also ships three workspace widgets:

- `Agent Terminal`
- `WorkspaceReference`
- `Upstream Inspector`

The same feature also mounts the right-side shell chat rail used across the shell. On wide layouts
it now docks into the shell grid and pushes page content left; on narrower layouts it falls back to
an overlay rail.

## Entry Points

- `index.ts`
  Registers the extension. The app surfaces stay behind `VITE_INCLUDE_AUI`, but the workspace
  widgets are always registered so general workspace studio can place `Agent Terminal`,
  `WorkspaceReference`, and `Upstream Inspector` even when the full AI shell is hidden.
- `app.ts`
  Defines the `Main Sequence AI` app surfaces, including the hidden AgentSession deep-link page.
- `agent-search.ts`
  Shared backend quick-search contract for agent lookup. This is reused by the `Agents` surface and
  the page chat's AgentSession explorer.
- `runtime/`
  Shared assistant endpoint and AgentSession transport helpers used by both `assistant-ui`, the
  extension-owned widget layer, and workspace launchers.
- `agent-session-detail/`
  Shared AgentSession detail capability that composes backend core detail, insights, and runtime
  tools into one reusable model and renderer for any Main Sequence AI surface.
- `assistant-ui/`
  Explicit assistant-ui integration boundary: runtime, shell chat rail, adapters, context bridge,
  and shared chat state.
- `features/chat/`
  Shared AgentSession explorer and picker UI used by chat surfaces, widget settings, and the
  monitor launcher flow.
- `features/settings/`
  Extension-contributed shell settings sections, including global provider sign-in/sign-off,
  provider attempt workflows, and the full known model catalog.
- `widgets/`
  Extension-owned workspace widgets, including the session-bound terminal widget, the workspace
  reference widget, and related AI-only binding helpers.
- `surfaces/chat/`
  Thin page-surface layer for the `Chat` app surface.
- `surfaces/session/`
  Standalone AgentSession detail shell that chat and widgets deep-link into.
- `surfaces/agents/`
  Session picker surface with a left explorer and an intentionally empty canvas area.
- `surfaces/monitor/`
  Agent-monitor workspace surface that reuses the shared workspace studio canvas with a filtered
  widget catalog.

## Integration Boundary

This extension owns the assistant-ui runtime, but the shell still mounts it from:

- `src/app/layout/AppShell.tsx`
- `src/app/layout/Sidebar.tsx`
- `src/app/router.tsx`

Those files intentionally depend on this extension because the shell chat rail is global shell
chrome, not just a page-local feature.

## Behavior Notes

- The full-page chat surface lives at `/app/main_sequence_ai/chat`.
- The dedicated AgentSession detail surface lives at `/app/main_sequence_ai/session?session=<id>`
  and is intentionally hidden from top navigation while still remaining directly routable.
- The app now contributes a `Model Providers` user-settings section into the shared shell settings
  dialog through the registry-backed `shellMenuContributions` contract.
- The full-page chat now includes a hideable left explorer for local `AgentSessions`. Those
  sessions are browser-persisted per signed-in user until a backend session catalog exists.
- The agents surface lives at `/app/main_sequence_ai/agents` and uses a full-bleed workspace-style
  shell with a thin left icon rail that opens the same AgentSession explorer/search used by the
  chat page. The canvas area on that page stays empty on purpose.
- The agents monitor surface lives at `/app/main_sequence_ai/monitor` and reuses the full
  workspace studio canvas, filtered down to agent-monitor workspaces and the scoped agent-monitor
  widget set. It intentionally hides the global saved-widget library link because that library is
  not yet filtered by the same allowlist.
- `Agents Monitor` also exposes a direct agent launcher that creates a fresh session for a
  supported agent, then creates a new monitor workspace or inserts an Agent Terminal widget into
  the current monitor without going through the generic component browser first.
- The `main-sequence-ai-agent-terminal` widget is now agent-owned rather than session-picked. It
  persists `agentId`, `agentName`, and its widget-managed `agentSessionId`, then renders the same
  backend session stream as terminal output inside workspaces.
- The `main-sequence-ai-workspace` widget (`WorkspaceReference`) publishes a minimal workspace reference object shaped as
  `{"id": "<workspace-id>"}` and blocks self-selection so a workspace cannot point to itself.
- Full AgentSession detail is now a shared extension capability and standalone app surface instead
  of a chat-owned modal. Chat only consumes that shared detail layer for summary and deep-link
  behavior in its right-side rail.
- `Agent Terminal` now keeps its refresh prompt as a saved widget setting and consumes several
  upstream widget contexts through the shared `core.widget-agent-context@v1` binding contract,
  plus explicit workspace references through `main-sequence-ai.workspace-reference@v1`.
- `Agents Monitor` now limits its widget catalog to `Agent Terminal`, `WorkspaceReference`, and
  `Upstream Inspector`. The `WorkspaceReference` widget is still available outside monitor-specific
  workspaces through the broader Main Sequence AI catalog.
- Agent/session selection from the agents surface updates shared session state locally; the actual
  reusable workspace canvas lives on the `Agents Monitor` surface.
- The legacy `/app/chat` route is kept only as a redirect target for compatibility.
- When `VITE_INCLUDE_AUI=false`, the extension does not register the app and the shell does not
  mount the assistant runtime or shell chat rail. The extension-owned workspace widgets still
  register so they remain available in the normal workspace catalog.
