# Main Sequence AI Chat Feature UI

## Purpose

This directory owns reusable page-level chat/session UI for the `Main Sequence AI` extension.

It sits outside `assistant-ui/` on purpose so page surfaces can share the same `AgentSession`
explorer without moving presentational shell chrome into the runtime boundary.

## Entry Points

- `AgentSessionExplorer.tsx`
  Shared explorer for agent quick-search and latest session selection. Used by both the `Chat`
  page rail and the `Agents` surface canvas. It now surfaces backend session handles when
  `bound_handles` are present on session rows. On the full chat page, clicking a latest-session
  row reuses the current tab only when the user is on the plain unbound `/chat` route with no
  selected session yet. Otherwise it opens a session-pinned chat route in a separate browser tab
  and must not rebind the current chat screen in place.
- `AgentSessionCatalogPicker.tsx`
  Reusable agent-first, session-second picker used by the Agent Terminal widget settings and the
  Agents Monitor workspace launcher. It now also surfaces backend session handles when present.
- `SessionDetailRail.tsx`
  Shared right-side session rail for the selected `AgentSession` on the chat page. It renders the
  session-summary launcher into the standalone AgentSession detail surface. When assistant-ui
  opens in direct project-agent mode, the rail swaps to project-agent-specific copy instead of
  default-orchestrator wording. The summary card also suppresses stale duplicate identifiers, maps
  raw insights status enums to human-facing copy, and prefers the current session model from local
  session state so provider/model changes update the card immediately without forcing a
  detail/insights reload.

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
- Chat-page latest-session rows must stay openable even while the current tab is still hydrating
  its selected session. Do not reintroduce readiness-gate disabling for cross-tab session opens.
- Full AgentSession detail ownership does not live here. This directory only owns the chat-page
  presentation of the shared detail capability.
- `SessionDetailRail.tsx` must stay thin. The full AgentSession shell now lives on the dedicated
  `surfaces/session/` page, and the rail should only summarize and deep-link there.
- `SessionDetailRail.tsx` should follow the active rail experience from `ChatProvider`. Do not
  reintroduce hardcoded Command Center orchestrator copy when the selected session was launched
  from a project agent entry point.
