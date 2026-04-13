# Main Sequence AI Agents Surface

## Purpose

This directory owns the `Agents` surface for the `Main Sequence AI` app.

The page is now a session-picker surface with an intentionally empty canvas area.

## Entry Points

- `AgentsPage.tsx`
  Full-bleed agents surface with a thin left icon rail that opens the shared
  `AgentSessionExplorer`. The remaining canvas stays empty on purpose.
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
- The agents page owns only the thin launcher rail and the shared session explorer. Do not add
  cards, launch actions, or other helper content into the canvas area.
- The actual workspace canvas lives on the sibling `Agents Monitor` surface.
