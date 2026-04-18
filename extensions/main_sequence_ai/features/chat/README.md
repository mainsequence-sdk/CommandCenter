# Main Sequence AI Chat Feature UI

## Purpose

This directory owns reusable page-level chat/session UI for the `Main Sequence AI` extension.

It sits outside `assistant-ui/` on purpose so page surfaces can share the same `AgentSession`
explorer without moving presentational shell chrome into the runtime boundary.

## Entry Points

- `AgentSessionExplorer.tsx`
  Shared explorer for agent quick-search and latest session selection. Used by both the `Chat`
  page rail and the `Agents` surface canvas. It now surfaces backend session handles when
  `bound_handles` are present on session rows.
- `AgentSessionCatalogPicker.tsx`
  Reusable agent-first, session-second picker used by the Agent Terminal widget settings and the
  Agents Monitor workspace launcher. It now also surfaces backend session handles when present.
- `SessionDetailRail.tsx`
  Shared right-side session metadata rail for the selected `AgentSession` on the chat page. The
  verbose session metadata is intentionally collapsed behind an in-rail disclosure. Session
  insights now open in a modal instead of expanding inline, so the rail stays compact and tool
  availability remains visible.
- `repo-diff-api.ts`
  Tool-specific fetch/normalization layer for the `repo_diff` session tool. It validates the
  backend diff payload before the UI renders it.

## Dependencies

- `extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx`
  Supplies the shared session list, active session state, normalized active session summary, and
  session-start/select actions.
- `extensions/main_sequence_ai/agent-search.ts`
  Supplies the shared quick-search transport helpers and result-label formatting.
- `extensions/main_sequence_ai/runtime/agent-sessions-api.ts`
  Supplies the shared backend session-list transport used outside the assistant-ui runtime.

## Maintenance Notes

- Keep reusable page UI here rather than under `assistant-ui/components/` when it should be shared
  by multiple app surfaces.
- This directory may depend on assistant-ui-owned state, but transport shared by widgets or
  workspace launchers should stay in `runtime/`, not in assistant-ui.
- If the explorer behavior changes for both chat and agents, update this module first so the two
  surfaces do not drift apart.
- Session metadata presentation for the chat page lives here, not in the transcript pane.
- `SessionDetailRail.tsx` now owns the presentational rendering for provider-owned session insights
  fetched from `/api/chat/session-insights`, including the on-demand modal presentation and the
  writable session-config editor for the backend-supported editable subset.
- session-insights `info` metadata is used there as optional label/help text; missing info nodes
  fall back to the frontend’s existing labels instead of blocking rendering.
- `repo_diff` uses the backend-provided tool `url` directly. The UI uses `diff.files` for the
  changed-file selector and `diff.patch` for the rendered unified diff body. The actual diff
  explorer opens in a modal instead of expanding inside the session rail.
