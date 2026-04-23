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
  Shared right-side session rail for the selected `AgentSession` on the chat page. It renders the
  session-summary launcher into the standalone AgentSession detail surface and still surfaces
  runtime tool availability.
- `repo-diff-api.ts`
  Tool-specific fetch/normalization layer for the `repo_diff` session tool. It validates the
  backend diff payload before the UI renders it.

## Dependencies

- `extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx`
  Supplies the shared session list, active session state, normalized active session summary,
  shared detail snapshot, and session-start/select actions.
- `extensions/main_sequence_ai/agent-search.ts`
  Supplies the shared quick-search transport helpers and result-label formatting.
- `extensions/main_sequence_ai/agent-session-detail/`
  Supplies the canonical AgentSession detail model/controller and the reusable detail sections that
  the rail renders.
- `extensions/main_sequence_ai/runtime/agent-sessions-api.ts`
  Supplies the shared backend session-list transport used outside the assistant-ui runtime.

## Maintenance Notes

- Keep reusable page UI here rather than under `assistant-ui/components/` when it should be shared
  by multiple app surfaces.
- This directory may depend on assistant-ui-owned state, but transport shared by widgets or
  workspace launchers should stay in `runtime/`, not in assistant-ui.
- If the explorer behavior changes for both chat and agents, update this module first so the two
  surfaces do not drift apart.
- Full AgentSession detail ownership does not live here. This directory only owns the chat-page
  presentation of the shared detail capability.
- `SessionDetailRail.tsx` must stay thin. The full AgentSession shell now lives on the dedicated
  `surfaces/session/` page, and the rail should only summarize and deep-link there.
- `repo_diff` uses the backend-provided tool `url` directly. The UI uses `diff.files` for the
  changed-file selector and `diff.patch` for the rendered unified diff body. The actual diff
  explorer opens in a modal instead of expanding inside the session rail.
