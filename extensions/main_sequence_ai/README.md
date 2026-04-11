# Main Sequence AI

## Purpose

This extension owns the Main Sequence AI application and the assistant-ui integration used by the shell chat experience.

It currently exposes one app with one surface:

- `Main Sequence AI`
- `Chat`

It also includes one agent workspace surface:

- `Agents`

The same feature also mounts the right-side overlay chat rail used across the shell.

## Entry Points

- `index.ts`
  Registers the extension and conditionally exposes the app when `VITE_INCLUDE_AUI` is enabled.
- `app.ts`
  Defines the `Main Sequence AI` app and its `Chat` surface.
- `agent-search.ts`
  Shared backend quick-search contract for agent lookup. This is reused by the `Agents` surface and
  the page chat's AgentSession explorer.
- `assistant-ui/`
  Explicit assistant-ui integration boundary: runtime, overlay shell, adapters, context bridge, and shared chat state.
- `features/chat/`
  Shared page-level AgentSession explorer UI used by both the `Chat` and `Agents` surfaces.
- `surfaces/chat/`
  Thin page-surface layer for the `Chat` app surface.
- `surfaces/agents/`
  Canvas-style page shell that now mounts the shared AgentSession explorer instead of a
  surface-specific search widget.

## Integration Boundary

This extension owns the assistant-ui runtime, but the shell still mounts it from:

- `src/app/layout/AppShell.tsx`
- `src/app/layout/Sidebar.tsx`
- `src/app/router.tsx`

Those files intentionally depend on this extension because the overlay chat is global shell chrome, not just a page-local feature.

## Behavior Notes

- The full-page chat surface lives at `/app/main_sequence_ai/chat`.
- The full-page chat now includes a hideable left explorer for local `AgentSessions`. Those
  sessions are browser-persisted per signed-in user until a backend session catalog exists.
- The agents surface lives at `/app/main_sequence_ai/agents` and uses a full-bleed workspace-style
  canvas shell with the same AgentSession explorer/search pinned on the left, matching the chat
  page layout more closely.
- Agent and session selection from the agents surface promotes shared chat-session state and then
  routes into `/app/main_sequence_ai/chat`.
- The legacy `/app/chat` route is kept only as a redirect target for compatibility.
- When `VITE_INCLUDE_AUI=false`, the extension does not register the app and the shell does not mount the overlay runtime.
