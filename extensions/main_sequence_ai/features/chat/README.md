# Main Sequence AI Chat Feature UI

## Purpose

This directory owns reusable page-level chat/session UI for the `Main Sequence AI` extension.

It sits outside `assistant-ui/` on purpose so page surfaces can share the same `AgentSession`
explorer without moving presentational shell chrome into the runtime boundary.

## Entry Points

- `AgentSessionExplorer.tsx`
  Shared explorer for agent quick-search and latest session selection. Used by both the `Chat`
  page rail and the `Agents` surface canvas.
- `SessionDetailRail.tsx`
  Shared right-side session metadata rail for the selected `AgentSession` on the chat page. The
  verbose session metadata is intentionally collapsed behind an in-rail disclosure so tool
  availability stays visible without scrolling past static identifiers first.
- `repo-diff-api.ts`
  Tool-specific fetch/normalization layer for the `repo_diff` session tool. It validates the
  backend diff payload before the UI renders it.

## Dependencies

- `extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx`
  Supplies the shared session list, active session state, normalized active session summary, and
  session-start/select actions.
- `extensions/main_sequence_ai/agent-search.ts`
  Supplies the shared quick-search transport helpers and result-label formatting.

## Maintenance Notes

- Keep reusable page UI here rather than under `assistant-ui/components/` when it should be shared
  by multiple app surfaces.
- This directory may depend on assistant-ui-owned state, but it should not take over assistant-ui
  runtime wiring, transport decoding, or overlay concerns.
- If the explorer behavior changes for both chat and agents, update this module first so the two
  surfaces do not drift apart.
- Session metadata presentation for the chat page lives here, not in the transcript pane.
- `repo_diff` uses the backend-provided tool `url` directly. The UI uses `diff.files` for the
  changed-file selector and `diff.patch` for the rendered unified diff body.
