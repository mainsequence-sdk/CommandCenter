# Main Sequence AI Runtime

## Purpose

This directory owns transport and endpoint helpers that are shared by multiple Main Sequence AI
surfaces.

It exists so reusable API concerns stay outside `assistant-ui/` and can also be used by widgets or
other extension-owned surfaces without pulling in chat-shell runtime state.

## Entry Points

- `assistant-endpoint.ts`
  Resolves the configured assistant endpoint and shared auth/header helpers.
- `agent-session-request.ts`
  Builds the backend request-body fragments used for session-bound assistant runs.
- `agent-session-stream.ts`
  Posts a live assistant request and parses the configured UI message stream into chunk callbacks.
- `agent-sessions-api.ts`
  Shared backend AgentSession list/delete transport used by assistant-ui, workspace launchers, and
  widget settings.
- `session-history-api.ts`
  Shared session history fetch helper for an existing AgentSession id.
- `session-tools-api.ts`
  Shared session tools fetch helper for an existing AgentSession id.

## Maintenance Notes

- Keep this directory free of `assistant-ui` runtime hooks and overlay/page UI concerns.
- Session catalog transport shared by widgets or workspace surfaces belongs here, not under
  `assistant-ui/`.
- If the backend assistant request shape changes, update `agent-session-request.ts` first so the
  page chat and terminal widget stay aligned.
- The live stream helper currently assumes `assistant_ui.protocol=ui-message-stream`, which matches
  the current Command Center configuration.
