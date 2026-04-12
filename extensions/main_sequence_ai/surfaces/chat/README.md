# Main Sequence AI Chat Surface

## Purpose

This directory owns the `Chat` app surface for the `Main Sequence AI` app.

The page itself is intentionally thin. It renders the full-page assistant surface while delegating the actual assistant-ui runtime, overlay state, and shell integration to the extension-local `assistant-ui/` boundary.

## Entry Points

- `ChatPage.tsx`
  Full-page chat surface registered by `extensions/main_sequence_ai/app.ts`. It now owns the
  top-level page layout for the chat shell, including the left icon-only action rail, the optional
  AgentSession explorer column, the optional session-detail rail, and the optional right-side
  raw-context panel.
- `extensions/main_sequence_ai/features/chat/`
  Shared page-level AgentSession explorer UI reused by both the chat and agents surfaces.

## Dependencies

- `extensions/main_sequence_ai/assistant-ui/`
  Owns the assistant-ui runtime, AgentSession persistence, chat thread primitives, overlay shell,
  and shared chat state.
- `extensions/main_sequence_ai/features/chat/`
  Owns the shared AgentSession explorer presentation used in this page layout.

## Maintenance Notes

- Keep app-surface concerns here.
- Keep assistant-ui runtime and adapter concerns under `assistant-ui/`.
- The page shell now uses a slim left icon rail for chat actions instead of a top toolbar.
- The AgentSession explorer remains page-level shell chrome rendered from
  `features/chat/AgentSessionExplorer.tsx`. It should stay outside the global overlay shell and
  outside assistant-ui runtime wiring.
- Static selected-session metadata should not be rendered above the transcript. That information
  now belongs in the dedicated session-detail rail.
- The visible AgentSession list is backend-bootstrapped from the current latest-sessions endpoint,
  while local cached transcripts still live under the assistant-ui boundary.
- If more AI surfaces are added later, add them as siblings under `surfaces/` instead of mixing them into the assistant-ui integration layer.
- The sibling `surfaces/agents/` directory now reuses the same shared AgentSession explorer in a
  canvas layout instead of duplicating its own search UI.
