# Main Sequence AI Runtime

## Purpose

This directory owns transport and endpoint helpers that are shared by multiple Main Sequence AI
surfaces.

It exists so reusable API concerns stay outside `assistant-ui/` and can also be used by widgets or
other extension-owned surfaces without pulling in chat-shell runtime state.

## Entry Points

- `assistant-endpoint.ts`
  Resolves assistant-runtime access, including dynamic runtime `rpc_url` resolution, bearer-token
  injection, selected-session binding, and shared `401` / `403` refresh-and-retry behavior.
- `assistant-health-api.ts`
  Fetches the assistant-runtime `GET /health` response and preserves the raw JSON or text payload
  for the Agents settings diagnostics panel.
- `command-center-base-session-api.ts`
  Shared transport for the canonical Command Center base session handle returned by
  `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`.
  It can send `current_session` when a frontend request targets an existing backend AgentSession.
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
- Assistant-runtime calls for agent sessions use `runtime_access.rpc_url` plus
  `Authorization: Bearer <runtime_access.token>`.
- `assistant_ui.endpoint` may be blank when Main Sequence AI should rely entirely on backend
  runtime access. Render paths must not call the configured/static endpoint as a hard requirement
  for agent-runtime calls.
- `VITE_ASSISTANT_UI_PROXY_TARGET` may still configure Vite's development proxy, but it is not the
  source of truth for Main Sequence AI agent-runtime calls.
- Requests that target a specific existing AgentSession should pass the session id through
  `currentSessionId` so the backend exchange can bind the astro command-center handle to
  `current_session` before hitting runtime endpoints such as history, tools, insights, or chat.
- Dynamic runtime-token refresh is centralized in `assistant-endpoint.ts`. Assistant-runtime
  transports should use the shared fetch wrapper instead of issuing raw `fetch(...)` calls so
  `401` / `403` can reacquire runtime access once and retry consistently.
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
  storage state, not session-local or chat-local storage. It preserves the `mainsequence` detail
  bucket when present, including `mainSequence` and `main_sequence` casing variants.
- `assistant-health-api.ts` intentionally does not impose a strict health response schema; the
  settings screen should render the backend answer as returned.
- `command-center-base-session-api.ts` is the only canonical source for the default Command Center
  assistant continuity session. Frontend code should not infer that default by picking the latest
  `astro-orchestrator` session from the latest-session query.
- `session-insights-api.ts` remains the canonical read contract for session config values and
  editable constraints. `session-config-api.ts` is write-only and should only send changed writable
  fields back to the backend.
- The live stream helper currently assumes `assistant_ui.protocol=ui-message-stream`, which matches
  the current Command Center configuration.
