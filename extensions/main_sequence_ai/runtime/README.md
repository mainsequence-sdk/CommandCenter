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
- `storage-usage-api.ts`
  Shared global storage-usage transport used by the Agents settings screen.
- `session-history-api.ts`
  Shared session history fetch helper for an existing AgentSession id.
- `session-insights-api.ts`
  Shared session insights fetch helper for an existing runtime session id.
- `session-config-api.ts`
  Shared session-config patch helper for the writable subset of per-session config exposed through
  the session-insights contract.
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
- `available-models-api.ts` also normalizes the provider-grouped `/api/chat/get_available_models`
  response and preserves per-model reasoning-effort capabilities so the chat composer can render
  provider, model, and reasoning selectors in sequence.
- reasoning options for the chat picker are derived from each model's
  `capabilities.runConfig.reasoning_effort` payload, with `defaults.runConfig.reasoning_effort`
  used as the selected default when present.
- `model-provider-auth-api.ts` now targets `/api/model-providers` rather than chat runtime
  endpoints and owns the generic sign-in attempt state machine:
  start, poll, manual input, cancel, and sign-off.
- Sign-in attempt normalization also preserves `authUrl` / `authInstructions`, because the frontend
  should keep showing the sign-in link whenever the backend keeps providing it across attempt
  states.
- `model-catalog-api.ts` is the only catalog source for the global provider settings screen.
  `available-models-api.ts` remains the chat-runtime picker source.
- `storage-usage-api.ts` targets `/api/storage/usage` and represents deployment/runtime durable
  storage state, not session-local or chat-local storage.
- `session-insights-api.ts` remains the canonical read contract for session config values and
  editable constraints. `session-config-api.ts` is write-only and should only send changed writable
  fields back to the backend.
- The live stream helper currently assumes `assistant_ui.protocol=ui-message-stream`, which matches
  the current Command Center configuration.
