# Main Sequence AI Agents Surface

## Purpose

This directory owns the `Agents` surface for the `Main Sequence AI` app.

The page is now a canvas-style shell that mirrors the workspace canvas layout while staying
separate from the extension-local `assistant-ui/` runtime boundary.

## Entry Points

- `AgentsPage.tsx`
  Full-bleed agents surface with workspace-canvas background styling, a pinned left-side shared
  `AgentSessionExplorer`, and an open canvas area on the right.
- `extensions/main_sequence_ai/features/chat/AgentSessionExplorer.tsx`
  Shared agent quick-search and latest-session explorer reused from the chat surface.

## Dependencies

- `extensions/main_sequence_ai/app.ts`
  Registers the surface, marks it as full-bleed, and attaches the robot icon used in the app
  surface navigation.
- `extensions/main_sequence_ai/features/chat/`
  Supplies the shared AgentSession explorer UI used on this surface.

## Maintenance Notes

- Keep this surface isolated from `extensions/main_sequence_ai/assistant-ui/` until the agents
  workflow has its own owned runtime boundary.
- Reuse workspace-canvas visual language here, but keep the session explorer itself shared with the
  chat surface so agent search and latest-session behavior do not drift.
- Agent/session selection on this surface routes into the chat surface after updating the shared
  session state, so the canvas acts as a launcher rather than a second chat runtime.
