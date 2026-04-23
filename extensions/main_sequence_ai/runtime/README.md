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
  Shared backend AgentSession list/detail/delete transport used by assistant-ui, workspace
  launchers, and widget settings. Detail reads use
  `GET /orm/api/agents/v1/sessions/{agent_session_id}/` and expose a typed `404` not-found
  error so callers can invalidate stale session-bound UI before touching the assistant runtime. It
  also owns managed session creation through
  `POST /orm/api/agents/v1/agents/{agent_id}/start_new_session/` plus the AgentSession
  model-binding PATCH for `llm_provider` / `llm_model`.
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
  Shared ORM session insights fetch helper for an existing AgentSession id.
- `session-config-api.ts`
  Shared session-config patch helper for the writable subset of per-session config exposed through
  the session-insights contract.
- `session-cancel-api.ts`
  Shared assistant-runtime cancellation helper for `POST /api/chat/session/cancel`.
- `session-tools-api.ts`
  Shared session tools fetch helper for an existing AgentSession id.

## Maintenance Notes

- Keep this directory free of `assistant-ui` runtime hooks and overlay/page UI concerns.
- Assistant-runtime calls use the configured assistant endpoint when `VITE_ASSISTANT_UI_PROXY_TARGET`
  is set. Otherwise agent-runtime calls use `runtime_access.rpc_url` plus
  `Authorization: Bearer <runtime_access.token>`.
- `assistant_ui.endpoint` may be blank when Main Sequence AI should rely entirely on backend
  runtime access. Render paths must not call the configured/static endpoint as a hard requirement
  for agent-runtime calls.
- When `VITE_ASSISTANT_UI_PROXY_TARGET` is set, the Command Center base-session request sends
  `create_knative_service=false` so local proxied development does not ask the backend to create a
  dynamic runtime service.
- Requests that target a specific existing AgentSession should pass the session id through
  `currentSessionId` so the backend exchange can bind the astro command-center handle to
  `current_session` before hitting runtime endpoints such as history, tools, or chat.
- Dynamic runtime-token refresh is centralized in `assistant-endpoint.ts`. Assistant-runtime
  transports should use the shared fetch wrapper instead of issuing raw `fetch(...)` calls so
  `401` / `403` can reacquire runtime access once and retry consistently.
- Session catalog transport shared by widgets or workspace surfaces belongs here, not under
  `assistant-ui/`.
- Managed Agent Terminal session creation also belongs here. Settings and launchers should not hand
  roll `start_new_session` fetches or parse response payloads themselves.
- `start_new_session` currently sends a minimal JSON body with `created_by_user` plus a generated
  `thread_id`, because the backend contract requires both fields even for a fresh session.
- If the backend assistant request shape changes, update `agent-session-request.ts` first so the
  page chat and terminal widget stay aligned.
- Chat picker provider/model changes are persisted through
  `PATCH /orm/api/agents/v1/sessions/{agent_session_id}/` with `llm_provider` and `llm_model`.
  This is ORM session metadata, not an assistant-runtime request.
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
- `assistant-health-api.ts` intentionally does not impose a strict health response schema; the
  settings screen should render the backend answer as returned.
- `command-center-base-session-api.ts` is the only canonical source for the default Command Center
  assistant continuity session. Frontend code should not infer that default by picking the latest
  `astro-orchestrator` session from the latest-session query.
- The base-session normalizer preserves `llm_provider` and `llm_model` so the chat picker can
  initialize from the actual session metadata instead of forcing the user to reselect the model.
- AgentSession transports preserve `runtime_state` and `working`. UI surfaces must treat
  `working=true` as a backend-owned busy state and avoid sending another chat request for that
  session; stop actions should use `session-cancel-api.ts`.
- `session-insights-api.ts` reads
  `GET /orm/api/agents/v1/sessions/{agent_session_id}/insights/` and does not call the assistant
  runtime URL. It remains the canonical read contract for session config values and editable
  constraints. `session-config-api.ts` is write-only and should only send changed writable fields
  back to the backend.
- The live stream helper currently assumes `assistant_ui.protocol=ui-message-stream`, which matches
  the current Command Center configuration.
