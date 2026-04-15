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
- `available-models-api.ts`
  Shared assistant-backend model catalog fetch helper used by the page chat composer.
- `model-catalog-api.ts`
  Shared global model-catalog fetch helper used by the provider settings screen.
- `model-provider-auth-api.ts`
  Shared assistant-backend global provider transport used by the Main Sequence AI user settings
  section for provider sign-in/sign-off and generic sign-in attempt polling.
- `session-history-api.ts`
  Shared session history fetch helper for an existing AgentSession id.
- `session-insights-api.ts`
  Shared session insights fetch helper for an existing runtime session id.
- `session-tools-api.ts`
  Shared session tools fetch helper for an existing AgentSession id.

## Maintenance Notes

- Keep this directory free of `assistant-ui` runtime hooks and overlay/page UI concerns.
- Session catalog transport shared by widgets or workspace surfaces belongs here, not under
  `assistant-ui/`.
- If the backend assistant request shape changes, update `agent-session-request.ts` first so the
  page chat and terminal widget stay aligned.
- `agent-session-request.ts` now owns the top-level optional `model` request object for `/api/chat`,
  including `source`, exact model id, optional provider, and optional
  `runConfig.reasoning_effort`.
- `available-models-api.ts` now also preserves per-model auth metadata so shell settings can show
  auth-backed models as visible but unusable when sign-in is required.
- `model-provider-auth-api.ts` now targets `/api/model-providers` rather than chat runtime
  endpoints and owns the generic sign-in attempt state machine:
  start, poll, manual input, cancel, and sign-off.
- Sign-in attempt normalization also preserves `authUrl` / `authInstructions`, because the frontend
  should keep showing the sign-in link whenever the backend keeps providing it across attempt
  states.
- `model-catalog-api.ts` is the only catalog source for the global provider settings screen.
  `available-models-api.ts` remains the chat-runtime picker source.
- The live stream helper currently assumes `assistant_ui.protocol=ui-message-stream`, which matches
  the current Command Center configuration.
