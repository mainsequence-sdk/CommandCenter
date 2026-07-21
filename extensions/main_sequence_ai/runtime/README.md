# Main Sequence AI Runtime

## Purpose

This directory owns transport and endpoint helpers that are shared by multiple Main Sequence AI
surfaces.

It exists so reusable API concerns stay outside `assistant-ui/` and can also be used by widgets or
other extension-owned surfaces without pulling in chat-shell runtime state.

## Entry Points

- `assistant-endpoint.ts`
  Resolves assistant-runtime access, including dynamic runtime `rpc_url` resolution, bearer-token
  injection, selected-session binding, the non-chat Astro operational runtime-access path, and
  shared `401` / `403` refresh-and-retry behavior.
- `assistant-health-api.ts`
  Fetches the assistant-runtime `GET /health` response and preserves the raw JSON or text payload
  for the Agents settings diagnostics panel.
- `command-center-base-session-api.ts`
  Shared transport for per-session runtime access at
  `POST /orm/api/agents/v1/sessions/{session_uid}/resolve_runtime_access/`.
- `agent-session-request.ts`
  Builds the backend request-body fragments used for session-bound assistant runs, including the
  injected canonical AgentSession serializer payload.
- `agent-session-readiness.ts`
  Shared readiness model for interaction surfaces that must wait for AgentSession detail,
  insights, and history before enabling chat or terminal input.
- `agent-session-stream.ts`
  Posts a live assistant request and parses the configured UI message stream into chunk callbacks.
- `agent-sessions-api.ts`
  Shared backend AgentSession list/detail/delete transport used by assistant-ui, workspace
  launchers, and widget settings. Detail reads use
  `GET /orm/api/agents/v1/sessions/{session_uid}/` and expose a typed `404` not-found
  error so callers can invalidate stale session-bound UI before touching the assistant runtime. It
  also owns managed session creation through
  `POST /orm/api/agents/v1/agents/{agent_id}/start_new_session/`, handle-bound session creation
  through
  `POST /orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/`,
  plus the AgentSession model-binding PATCH for `llm_provider` / `llm_model`.
- `available-models-api.ts`
  Shared assistant-backend sendable-model discovery helper used by the page chat composer. It also
  owns the shared in-memory available-models cache. Chat runtime availability is read strictly from
  `/api/chat/get_available_models`; `/api/models/catalog` remains a settings/catalog endpoint and
  is not a chat fallback. Non-empty results are cached for 15 minutes for the same user +
  agent-request-name scope. Empty model responses are cached for only 60 seconds: long enough to
  avoid request loops, short enough to recover quickly after provider credentials or runtime
  availability changes. The cache also exposes expired snapshots so callers can keep the last
  successful catalog rendered while refreshing the runtime in the background.
- `run-config-selection.ts`
  Shared provider/model/thinking selection resolver. It merges backend model catalogs with the
  current persisted agent or session defaults so callers can render standard run-config fields
  without dropping a current value that is not present in the registered catalog. It also
  normalizes fallback `current::{provider}::{model}` option ids back to canonical provider/model
  values before rendering or submitting run configuration.
- `model-catalog-api.ts`
  Shared global model-catalog fetch helper used by the provider settings screen.
- `model-provider-auth-api.ts`
  Shared assistant-backend global provider transport used by the Main Sequence AI user settings
  section for provider sign-in/sign-off and generic sign-in attempt polling.
- `session-history-api.ts`
  Shared backend session-history fetch helper for an existing AgentSession uid.
- `session-insights-api.ts`
  Shared ORM session insights fetch helper for an existing AgentSession uid.
- `session-config-api.ts`
  Shared session-config patch helper for the writable subset of per-session config exposed through
  the session-insights contract.
- `session-cancel-api.ts`
  Shared assistant-runtime cancellation helper for `POST /api/chat/session/cancel`.

## Maintenance Notes

- Keep this directory free of `assistant-ui` runtime hooks and overlay/page UI concerns.
- Assistant-runtime calls are always runtime-access backed. When
  `VITE_ASSISTANT_UI_PROXY_TARGET` is set, the configured proxy endpoint may replace the HTTP URL
  used for the final assistant-runtime request, but the frontend must still resolve an
  `AgentSession` and call `resolve_runtime_access/` first to obtain the runtime token and metadata.
  Without a proxy override, calls use `runtime_access.rpc_url` plus
  `Authorization: Bearer <runtime_access.token>`.
- When both `VITE_ASSISTANT_UI_PROXY_TARGET` and `VITE_ASSISTANT_UI_EXECUTOR_TARGET` are set,
  proxy-mode session traffic can branch by agent type: sessions for
  `project-executor` use the dedicated executor proxy path, while other sessions keep
  using the standard assistant proxy path.
- When `VITE_ASSISTANT_UI_PROXY_TARGET` is set but `VITE_ASSISTANT_UI_EXECUTOR_TARGET` is not,
  `project-executor` session-bound requests must fall back to per-session
  `resolve_runtime_access/` instead of being forced onto the standard `/__assistant__` proxy.
- The Vite dev server must only mount `/__assistant_executor__` when
  `VITE_ASSISTANT_UI_EXECUTOR_TARGET` is explicitly configured. It must not silently fall back to
  the standard assistant proxy target for that route.
- `assistant_ui.endpoint` may be blank when Main Sequence AI should rely entirely on backend
  runtime access. Render paths must not call the configured/static endpoint as a hard requirement
  or fallback for agent-runtime calls.
- When `VITE_ASSISTANT_UI_PROXY_TARGET` is set for Command Center operational traffic, the frontend
  still resolves Astro service identity, gets the canonical handle-bound AgentSession, and calls
  `resolve_runtime_access/` with the normal empty `{}` body. The configured proxy endpoint replaces
  the returned `rpc_url` only for assistant-runtime HTTP calls.
- Requests that target a specific existing AgentSession should pass the session id through
  `currentSessionId`. Dynamic runtime resolution will then call
  `POST /orm/api/agents/v1/sessions/{session_uid}/resolve_runtime_access/` before hitting
  runtime endpoints such as history, tools, or chat. Agent-runtime resolution no longer creates or
  selects Astro implicitly when no concrete `AgentSession` id is selected; callers must provide a
  real backend session id.
- Requests that do not target an existing selected session but still need Command Center
  operational runtime access must use `runtimeTarget: "command-center-base"`. That path resolves
  the deployed Astro service, gets or creates the canonical Astro handle session, and then calls
  `resolve_runtime_access/`. There is no production `configured` runtime target that bypasses
  session runtime access.
- The frontend treats `image_drift` from that per-session `resolve_runtime_access` response as
  backend-owned status. It only normalizes the payload shape enough to surface a generic warning
  in chat when the backend says that the selected runtime needs an update.
- Global, non-chat operational surfaces such as `Model Providers`, `Agents Settings`, and
  project-agent configuration modals should use the dedicated `command-center-base` runtime target instead of
  depending on chat-store side effects or a concrete `AgentSession`.
- The `command-center-base` target first reads the user-scoped Astro deployment through
  `GET /orm/api/agents/v1/coding-agent-services/?agent_type=astro-orchestrator&scope_kind=user&user_uid=<signed-in-user-uid>`.
  If no result includes `agent_uid`, the UI should show the deploy-required state.
- The `command-center-base` runtime target is allowed to resolve runtime access, call `/health`,
  and fetch model/provider catalogs. It must not implicitly fetch transcript history, insights, or
  other chat-hydration state.
- The per-session `resolve_runtime_access` response may omit echoed session identity. The frontend
  normalizer must fall back to the requested session id instead of treating that response as an
  invalid runtime-access payload.
- `session-history-api.ts` reads
  `GET /orm/api/agents/v1/sessions/{session_uid}/history/` directly and treats a `404`
  history read as a valid empty session transcript. Fresh `start_new_session` records should not
  block chat readiness just because no runtime messages have been persisted yet.
- Interaction surfaces should use `agent-session-readiness.ts` semantics: a backend AgentSession
  is not ready for user input until detail, insights, and history have all loaded successfully for
  the same selected session id.
- Dynamic runtime-token refresh is centralized in `assistant-endpoint.ts`. Assistant-runtime
  transports should use the shared fetch wrapper instead of issuing raw `fetch(...)` calls so
  `401` / `403` can reacquire runtime access once and retry consistently.
- Session catalog transport shared by widgets or workspace surfaces belongs here, not under
  `assistant-ui/`.
- Shared AgentSession list reads filter by `created_by_user_uid` when a signed-in user-scoped
  session catalog is requested from chat, pickers, or widget surfaces.
- Managed Agent Terminal session creation also belongs here. Settings and launchers should not hand
  roll `start_new_session` fetches or parse response payloads themselves.
- `start_new_session` sends a minimal JSON body with a generated `thread_id`; user ownership is
  resolved from the authenticated backend request context, not from a frontend-supplied
  `created_by_user_uid`.
- `get_or_create_session` sends exactly one lookup key: `session_uid` or `handle_unique_id`.
  Handle calls may include `name`, `parent_session_uid`, `llm_provider`, `llm_model`, and
  `llm_thinking` when available. The response must be the canonical top-level
  `AgentSessionSerializer`; wrapped `session` / `result` / `data` envelopes are not accepted.
- If the backend assistant request shape changes, update `agent-session-request.ts` first so the
  page chat and terminal widget stay aligned.
- Chat picker provider/model changes are persisted through
  `PATCH /orm/api/agents/v1/sessions/{session_uid}/` with `llm_provider`, `llm_model`, and
  `llm_thinking` as the third-picker string value. Provider-only picker changes stay local until a
  concrete model or thinking selection is persisted. This is ORM session metadata, not an
  assistant-runtime request.
- `agent-session-request.ts` now injects the canonical
  `GET /orm/api/agents/v1/sessions/{session_uid}/` serializer payload as top-level `session`
  on live `/api/chat` requests for existing sessions.
- Session-bound live requests no longer rely on a parallel top-level `model` object. Provider and
  model live on the injected session serializer, while optional per-run overrides such as
  `runConfig.reasoning_effort` stay top-level.
- `available-models-api.ts` now also preserves per-model auth metadata so shell settings can show
  auth-backed models as visible but unusable when sign-in is required.
- `available-models-api.ts` also normalizes the provider-grouped `/api/chat/get_available_models`
  response and preserves per-model reasoning-effort capabilities so the chat composer can render
  provider, model, and reasoning selectors in sequence.
- `available-models-api.ts` caches normalized sendable-model responses in memory by
  caller-provided user + agent-request-name cache key so chat session churn does not refetch the
  same runtime model list repeatedly after a successful load. The current TTL is 15 minutes, and
  expired snapshots remain readable for UI stability while a fresh request is in flight.
- reasoning options for the chat picker are derived from each model's
  `capabilities.runConfig.reasoning_effort` payload, with `defaults.runConfig.reasoning_effort`
  used as the selected default when present.
- `model-provider-auth-api.ts` now targets `/api/model-providers` rather than chat runtime
  endpoints and owns the generic sign-in attempt state machine:
  start, poll, manual input, cancel, and sign-off.
- Global model-provider credential requests are scoped with
  `created_by_user_uid=<signed-in user uid>`. Do not use the legacy numeric `created_by_user`
  filter on this path. These calls must fail before network I/O when the uid is missing or when a
  legacy numeric user id is passed by mistake.
- Sign-in attempt normalization also preserves `authUrl` / `authInstructions`, because the frontend
  should keep showing the sign-in link whenever the backend keeps providing it across attempt
  states.
- `model-catalog-api.ts` is the only catalog source for the global provider settings screen.
  `available-models-api.ts` remains the chat-runtime picker source for session-bound chat and also
  powers non-chat project-agent deployment model selection when it is explicitly pointed at the
  `command-center-base` runtime target.
- `assistant-health-api.ts` intentionally does not impose a strict health response schema; the
  settings screen should render the backend answer as returned.
- The runtime-access normalizer preserves `llm_provider` and `llm_model` so the chat picker can
  initialize from the actual session metadata instead of forcing the user to reselect the model.
- AgentSession transports preserve `runtime_state` and `working`. UI surfaces must treat
  `working=true` as a backend-owned busy state and avoid sending another chat request for that
  session; stop actions should use `session-cancel-api.ts`.
- `session-insights-api.ts` reads
  `GET /orm/api/agents/v1/sessions/{session_uid}/insights/` and does not call the assistant
  runtime URL. It remains the canonical read contract for session config values and editable
  constraints. The transport treats a `200` payload with `has_insights=false` and `insights={}` as
  a valid empty snapshot, and it also downgrades a legacy `404` response into that same empty
  snapshot shape for compatibility during backend rollout. `session-config-api.ts` is write-only
  and should only send changed writable fields back to the backend.
- The live stream helper currently assumes `assistant_ui.protocol=ui-message-stream`, which matches
  the current Command Center configuration.
- Runtime helpers should throw source-tagged errors through `error-source.ts` so chat-visible
  failures can identify whether they came from Command Center guards/parsing, Main Sequence
  session APIs, or the agent runtime transport/stream.
- Agent-service HTTP failures should use `http-error.ts` so every visible error includes the
  failed operation, HTTP status, full resolved URL, and backend response body/message.
