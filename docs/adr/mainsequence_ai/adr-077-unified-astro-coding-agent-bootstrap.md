# ADR 077: Unified Astro Coding-Agent Bootstrap

- Status: Accepted
- Date: 2026-06-23
- Related:
  - [ADR 060: Main Sequence AI Session-Backed Chat Request Contract](./adr-060-session-backed-chat-request-contract.md)
  - [ADR 063: Project Agent Configuration Source of Truth](./adr-063-project-agent-configuration-source-of-truth.md)
  - [ADR 076: Agent Detail Capabilities Tab](./adr-076-agent-detail-capabilities-tab.md)
  - [ADR 074: UID-Only Main Sequence Backend Identifier Contracts](../main_sequence/adr-074-uid-only-main-sequence-backend-identifier-contracts.md)

## Context

`Main Sequence AI` currently has two coding-agent deployment and bootstrap workflows.

Project-executor agents use the generic coding-agent service deployment path and explicit
configuration inputs:

- `POST /orm/api/agents/v1/coding-agent-services/deploy/`
- `agent_type: "project-executor"`
- `scope.kind: "project"`
- `scope.project_uid`
- explicit `llm_provider`, `llm_model`, `llm_thinking`, and runtime resources

Astro Command Center must use the same explicit coding-agent lifecycle:

1. user-triggered deploy creates or reuses the user-scoped Astro coding-agent service and `Agent`
2. chat/session surfaces create or reuse the canonical Command Center `AgentSession`
3. runtime consumers resolve runtime access for a concrete `AgentSession`

Those stages are separate frontend responsibilities. Chat must not deploy Astro implicitly, and
deployment must not be modeled as an Agent PATCH.

## Decision

Astro Command Center will be modeled as the same explicit coding-agent lifecycle used for other
agents:

1. user-triggered deploy creates or reuses service and `Agent` identity
2. create or reuse the `AgentSession`
3. resolve runtime access for that session only when runtime access is needed

### 1. Deploy the user-scoped Astro coding-agent service and Agent row

During the user-triggered Astro deploy action, the frontend should read the global coding-agent
deployment defaults when they are available:

```http
GET /orm/api/agents/v1/coding-agent-deployment-defaults/
```

Those defaults provide the initial Astro model configuration when they already exist. The first
Astro deploy request must not be blocked on model defaults being present. If no usable defaults are
available yet, the frontend may send an identity-only deploy request.

The deploy action will then use the generic coding-agent deployment endpoint:

```http
POST /orm/api/agents/v1/coding-agent-services/deploy/
Content-Type: application/json
```

```json
{
  "agent_type": "astro-orchestrator",
  "scope": {
    "kind": "user"
  }
}
```

The frontend must not send `user_uid`. The backend derives the user scope from `request.user`.
The deploy endpoint owns creating or reusing the Astro service, creating or reusing the Astro
`Agent`, and applying model configuration to that service and `Agent` when model configuration is
provided.

When deployment defaults already provide model configuration, the deploy request may include:

```json
{
  "agent_type": "astro-orchestrator",
  "scope": {
    "kind": "user"
  },
  "llm_provider": "default-provider",
  "llm_model": "default-model",
  "llm_thinking": "default-thinking"
}
```

The frontend must not call `PATCH /orm/api/agents/v1/agents/{agent_uid}/` to configure Astro as
part of this bootstrap workflow.

Expected response:

```json
{
  "agent_type": "astro-orchestrator",
  "scope": {
    "kind": "user",
    "user_uid": "current-user-uid"
  },
  "agent_uid": "astro-agent-uid",
  "service_uid": "coding-agent-service-uid",
  "reconciliation": {
    "queued": true
  }
}
```

This user-triggered deploy operation creates or reuses deployable service identity. It must not be
treated as session selection or runtime access.

### 2. Resolve the user-scoped Astro service before session lookup

Before the chat rail or settings can get the Command Center session, the frontend resolves the
deployed Astro service through the filtered service list:

```http
GET /orm/api/agents/v1/coding-agent-services/?agent_type=astro-orchestrator&scope_kind=user&user_uid={user_uid}
```

Expected response:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "uid": "coding-agent-service-uid",
      "agent_uid": "astro-agent-uid",
      "agent_type": "astro-orchestrator",
      "scope": {
        "kind": "user",
        "user_uid": "user-uid"
      },
      "service_runtime_uid": "runtime-uid-or-null",
      "is_ready": true,
      "image_drift": {},
      "automatic_deployment": true
    }
  ]
}
```

If this list is empty, or no result includes `agent_uid`, Astro has not been deployed for that
user and the UI must show the deploy-required state. The frontend must not use a separate service
resolve endpoint for this step.

### 3. Create or reuse the Astro Command Center session through the Agent

After the frontend has `agent_uid` from the user-scoped Astro service, it will create or reuse the
Command Center session through the normal agent session endpoint:

```http
POST /orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/
Content-Type: application/json
```

```json
{
  "handle_unique_id": "astro-orchestrator-command-center",
  "name": "Astro Command Center Session"
}
```

The session name is required by product convention. It is not the Agent name; it is the
human-readable session label.

Expected response is the canonical `AgentSessionSerializer`:

```json
{
  "uid": "agent-session-uid",
  "agent_uid": "astro-agent-uid",
  "agent_type": "astro-orchestrator",
  "name": "Astro Command Center Session",
  "bound_handle": {
    "handle_unique_id": "astro-orchestrator-command-center"
  }
}
```

The frontend must consume this as a normal `AgentSession` record. It must not expect or accept a
wrapped `session_handle`, `session`, `result`, or `data` envelope for this workflow.

When the chat rail opens, it should use this same endpoint to get or create the Command Center
session by handle, but only after it has the Astro `agent_uid`. If the frontend cannot resolve an
Astro `agent_uid`, that means Astro has not been deployed for the user yet; the rail should show a
deploy-required state that tells the user to deploy Astro. The rail must not deploy Astro or
resolve runtime access during rail bootstrap.

### 4. Resolve runtime access for the Astro session only when needed

When a runtime operation is needed, the frontend will resolve access through the session:

```http
POST /orm/api/agents/v1/sessions/{session_uid}/resolve_runtime_access/
Content-Type: application/json
```

```json
{}
```

Expected response when access can be minted:

```json
{
  "coding_agent_id": "coding-agent-service-id",
  "mode": "token",
  "rpc_url": "https://...",
  "token": "...",
  "is_ready": false,
  "service_runtime_uid": "runtime-uid",
  "runtime_paths": {
    "session": "/api/a2a/sessions/{session_uid}/runtime",
    "chat": "/api/a2a/sessions/{session_uid}/runtime/chat",
    "cancel": "/api/a2a/sessions/{session_uid}/runtime/cancel",
    "detach": "/api/a2a/sessions/{session_uid}/runtime/detach"
  },
  "reconciliation": {
    "queued": true
  }
}
```

The backend stops at runtime-access minting. Runtime attach, chat, cancel, and detach requests
happen directly against `rpc_url` with the returned bearer token.

### 4. Keep Astro model configuration in deployment, not session bootstrap

Astro `Agent` configuration must not be hidden inside session bootstrap or written through an Agent
PATCH during this workflow.

Astro follows the same deployment ownership model as project-executor agents:

- Main Sequence AI settings owns the global coding-agent deployment defaults
- service deployment accepts `llm_provider`, `llm_model`, and `llm_thinking` when available
- service deployment creates or reuses service identity and `Agent` identity even when the first
  request does not include model configuration
- service deployment applies model configuration when it is supplied
- agent detail may read current agent metadata and model configuration, but it is not the write path
  for Astro bootstrap
- session creation owns session identity and handle binding, not initial Agent model configuration
- runtime access owns transport credentials

The Astro handle-session request should send only `handle_unique_id` and `name` unless a future
flow intentionally introduces a session-level model override.

## Implementation Scope

### `command-center-base-session-api.ts`

- `extensions/main_sequence_ai/runtime/command-center-base-session-api.ts` owns only per-session
  runtime access for `POST /orm/api/agents/v1/sessions/{session_uid}/resolve_runtime_access/`.
- It exports an explicit `AgentSessionRuntimeAccess` type.
- It must not compose Astro service, session, runtime-access, or agent information into one
  frontend response type.

### `assistant-endpoint.ts`

- `runtimeTarget: "command-center-base"` runs the operational Astro sequence:
  - read the user-scoped Astro service with
    `GET /orm/api/agents/v1/coding-agent-services/?agent_type=astro-orchestrator&scope_kind=user&user_uid={user_uid}`
  - use the returned `agent_uid` to get or create the canonical handle session
  - call `resolve_runtime_access` only when runtime access is needed
- cache should distinguish:
  - Astro service identity
  - Astro session UID
  - runtime access token/rpc URL
- `resolveMainSequenceAiAssistantAccess(...)` should be able to resolve service/session without
  forcing history/insights reads

### `ChatProvider.tsx`

- chat rail bootstrap should resolve the Astro `agent_uid` by reading the filtered user-scoped
  Astro service list
- if the Astro `agent_uid` is missing, chat should show a deploy-required state that tells the user
  to deploy Astro
- once the Astro `agent_uid` exists, chat should call `getOrCreateAgentSessionRequest(...)` with
  `handle_unique_id: "astro-orchestrator-command-center"` and select the returned
  `AgentSessionSerializer`
- chat rail bootstrap must not deploy Astro or resolve runtime access
- runtime access should be requested only when a concrete runtime/chat interaction needs it

### `agent-sessions.ts`

- `extensions/main_sequence_ai/assistant-ui/agent-sessions.ts` owns conversion from backend
  `AgentSessionSerializer` to UI `AgentSessionRecord`.
- Astro bootstrap must use the same serializer conversion path as other backend session reads.

### `useAssistantRuntimeAccess.ts` and settings screens

- settings should use the new operational Astro bootstrap sequence
- settings should not hydrate chat history or session insights
- settings should display reconciliation/starting state separately from model-catalog failures

### `ProjectAgentConfigurator.tsx`

- production model catalog resolution should use the new Astro service/session/runtime sequence
- project-agent configuration and Agent detail model hydration must use the `command-center-base`
  runtime target when they do not have a selected backend `AgentSession` uid
- a configured/proxy assistant endpoint may alter the final assistant-runtime HTTP URL, but it must
  not create a separate runtime target or bypass the Astro service, handle session, and
  `resolve_runtime_access` sequence

## Answered Questions

### Chat rail bootstrap scope

Question:

- Should the chat rail call all three stages immediately: deploy, get-or-create session, resolve
  runtime access?

Answer:

- No. The chat rail must not deploy Astro or resolve runtime access as part of rail bootstrap.
- Once the rail has the Astro `agent_uid`, it should call
  `POST /orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/` with
  `handle_unique_id: "astro-orchestrator-command-center"` and select the returned
  `AgentSessionSerializer`.
- If the rail cannot resolve an Astro `agent_uid`, it should show a deploy-required state that
  tells the user to deploy Astro first.

### Chat runtime readiness after session selection

Question:

- If `resolve_runtime_access` returns `is_ready: false` and `reconciliation.queued: true` during a
  later runtime/chat interaction, should chat input be disabled until the runtime reports ready, or
  can the runtime endpoint queue/attach later?

Answer:

- Keep the existing runtime readiness workflow.
- After the user selects an existing Astro `AgentSession`, the first concrete runtime/chat
  interaction resolves runtime access.
- If runtime access returns `rpc_url` and token but the runtime is not ready, chat input stays
  disabled while the frontend polls runtime health with that token.
- Chat is enabled only after runtime health succeeds.
- If health does not become ready within the existing timeout/backoff behavior, show the existing
  starting or failed-to-start state.

### Command Center rail session selection

Question:

- Should the Astro command-center session always be selected by handle regardless of the recent
  sessions list?

Answer:

- Yes. This is the reason the Command Center session has a stable handle.
- When the normal Command Center chat rail opens, it must use
  `POST /orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/` with
  `handle_unique_id: "astro-orchestrator-command-center"` and select the returned session.
- Latest-session ordering must not decide the default Command Center rail session.
- The recent sessions list is still loaded for history/navigation, but it is not the source of
  truth for the default rail binding.

### Command Center session lookup transport

Question:

- Should `GET /sessions/` grow a handle filter, or should a dedicated handle lookup endpoint be
  added, so the frontend can find the command-center session without creating it?

Answer:

- Neither. The frontend should not add a separate read-only handle lookup for this workflow.
- To get the Command Center session, always call
  `POST /orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/` with
  `handle_unique_id: "astro-orchestrator-command-center"`.
- If there is no Astro `agent_uid`, the rail should show the deploy-required state.

### Session catalog composition

Question:

- Should the command-center session appear in the normal sessions list, or be visually separated as
  the operational base session?

Answer:

- The chat session catalog should be the union of:
  - the normal recent sessions from `GET /orm/api/agents/v1/sessions/`
  - the canonical Astro Command Center session returned by
    `POST /orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/`
- Deduplicate by AgentSession UID, preferring the canonical Astro handle-session response for that
  UID when both sources include it.
- The canonical Astro handle session should always be present in the Command Center rail session
  catalog when the Astro `agent_uid` exists, even if it is absent from the current recent-sessions
  page.

### Settings operational runtime-access cache

Settings need runtime access for operational endpoints:

- `/health`
- model-provider status
- model catalog

Question:

- Should settings cache service/session identity separately from runtime token access?
- What TTL should runtime access use when `reconciliation.queued` is returned?
- Should provider/model settings trigger a forced runtime-access refresh after auth changes?
- Should settings show "Astro runtime starting" separately from "model catalog failed"?

Answer:

- Cache Astro identity separately from runtime credentials.
- Astro `agent_uid` and the Command Center handle-session `session_uid` may be reused across
  settings requests once resolved.
- Runtime credentials (`rpc_url` and token) should be cached only briefly and refreshed on
  `401` / `403`.
- When `resolve_runtime_access` reports `reconciliation.queued` or health is not ready, settings
  should use a short retry/backoff instead of treating the runtime token as a long-lived ready
  cache entry.
- Model-provider auth changes should force a refresh/recheck of provider status and model catalog
  data. They should not recreate Astro identity or the handle session.
- Settings should distinguish "Astro runtime starting" from model-catalog or provider-status
  request failures.

### Configured/proxy endpoint handling

The frontend supports configured assistant endpoints and local proxy paths as transport overrides.
They are not runtime-access strategies.

Question:

- Should a configured endpoint or Vite proxy bypass Astro service lookup, handle-session
  creation/reuse, or `resolve_runtime_access`?
- What should model/provider screens do when they need assistant-runtime data but do not have a
  selected chat session?

Answer:

- No production `runtimeTarget: "configured"` exists.
- When debug/proxy env vars such as `VITE_ASSISTANT_UI_ENDPOINT=/__assistant__` and
  `VITE_ASSISTANT_UI_PROXY_TARGET=http://...` are set, the frontend still resolves the Astro
  `agent_uid`, gets or creates the Command Center handle session, and resolves runtime access for
  that concrete session when runtime access is needed.
- The only transport difference is that assistant-runtime calls may use the configured/proxy
  endpoint instead of the `rpc_url` returned by `resolve_runtime_access`. The bearer token and
  runtime metadata still come from `resolve_runtime_access`.
- Selected-session calls use `runtimeTarget: "agent-runtime"` and must pass a concrete backend
  `AgentSession` uid as `currentSessionId`.
- Settings, model-provider screens, Agent detail handle-session model hydration, and
  project-agent configuration model hydration use `runtimeTarget: "command-center-base"` when
  they do not have a selected chat session. That path resolves the deployed user-scoped Astro
  service, gets or creates the canonical Astro handle session, and then calls
  `resolve_runtime_access`.
- If neither a selected session uid nor the `command-center-base` workflow is available, the UI
  should show a deploy/configure-required state. It must not fall back to a static endpoint.
- The `resolve_runtime_access` request body stays the normal empty object. The frontend must not
  send `create_knative_service`; that flag is no longer supported.

### Replacement for the composed Astro handle type

Do not use a frontend type that merges service, session, runtime access, and agent information.

Question:

- Should the replacement be three explicit types:
  - `CodingAgentServiceDeployResponse`
  - `AgentSessionSerializedRecord`
  - `AgentSessionRuntimeAccess`
- Should any convenience helper compose already-authorized stages, or should callers invoke each
  stage-specific helper directly?
- Which layer owns conversion from `AgentSessionSerializer` to `AgentSessionRecord`?

Answer:

- Replace the composed handle response model with explicit stage-specific types.
- The user-triggered deploy action returns deployment/service/agent identity.
- `get_or_create_session/` returns the canonical `AgentSessionSerializer`.
- `resolve_runtime_access/` returns runtime access.
- No helper should deploy Astro unless it is wired to the explicit user-triggered Deploy Astro
  action.
- Runtime and settings helpers may compose already-authorized stages, but they must not hide a
  deploy side effect.
- Conversion from backend `AgentSessionSerializer` to chat UI `AgentSessionRecord` belongs in
  `assistant-ui/agent-sessions.ts`, because `AgentSessionRecord` is UI state rather than runtime
  transport state.

## Open Questions

- None.

## Implementation Tasks

- [x] Add a shared `deployCodingAgentService(...)` helper for
  `POST /orm/api/agents/v1/coding-agent-services/deploy/` that supports both `project-executor`
  and `astro-orchestrator` scopes without `user_uid`.
- [x] Load global coding-agent deployment defaults before Astro deploy when available and pass
  `llm_provider`, `llm_model`, and `llm_thinking` into the deploy request only when usable values
  exist.
- [x] Add a user-triggered Astro deploy action that calls `coding-agent-services/deploy/` with
  `agent_type: "astro-orchestrator"` and `scope.kind: "user"` and does not patch the Agent after
  deploy.
- [x] Reuse `getOrCreateAgentSessionRequest(...)` for the Astro handle session with
  `handle_unique_id: "astro-orchestrator-command-center"` and
  `name: "Astro Command Center Session"` without sending initial Agent model configuration.
- [x] Update ChatProvider so it resolves the Astro `agent_uid` from
  `GET /orm/api/agents/v1/coding-agent-services/?agent_type=astro-orchestrator&scope_kind=user&user_uid={user_uid}`,
  calls
  `getOrCreateAgentSessionRequest(...)` with `handle_unique_id:
  "astro-orchestrator-command-center"` when the agent exists, and shows a deploy-required state only
  when the Astro `agent_uid` is missing.
- [x] Do not add a separate read-only handle lookup path for the Command Center session. The
  Command Center session retrieval path is always
  `agents/{agent_uid}/sessions/get_or_create_session/` once the Astro `agent_uid` exists.
- [x] Update ChatProvider default rail selection so latest-session ordering never chooses the
  default Command Center rail session over the canonical Astro handle session.
- [x] Update ChatProvider session state so the visible session catalog unions the normal recent
  sessions list with the canonical Astro handle session and deduplicates by AgentSession UID.
- [x] Preserve the existing chat runtime-readiness workflow after runtime access resolution:
  disable chat input while runtime health is not ready, poll health with the runtime token, enable
  chat only after health succeeds, and keep the existing timeout/backoff failure state.
- [x] Keep `resolve_runtime_access` as a separate operation that accepts a concrete session UID.
- [x] Use explicit stage-specific types for deployment identity, canonical
  `AgentSessionSerializer`, and runtime access. Do not introduce a new combined type that merges
  service, session, runtime, and agent fields.
- [x] Keep conversion from backend `AgentSessionSerializer` to UI `AgentSessionRecord` in
  `assistant-ui/agent-sessions.ts`.
- [x] Update settings runtime-access caching so Astro `agent_uid` and handle-session `session_uid`
  are cached separately from short-lived runtime credentials.
- [x] Refresh runtime credentials on assistant-runtime `401` / `403` without recreating Astro
  identity or the handle session.
- [x] When settings see `reconciliation.queued` or health-not-ready, use short retry/backoff and
  render "Astro runtime starting" separately from model-catalog or provider-status failures.
- [x] After model-provider auth changes, force provider-status/model-catalog rechecks without
  recreating Astro identity or the handle session.
- [x] Remove the production `configured` runtime target. Configured/proxy endpoint values are
  transport overrides only; selected-session and command-center-base paths still call
  `resolve_runtime_access`.
- [x] Default no-session available-model/model-hydration requests to `command-center-base` instead
  of a configured/static endpoint path.
- [x] Remove any frontend request body usage of `create_knative_service`; the
  `resolve_runtime_access` request body is the normal empty object.
- [x] Use the filtered user-scoped Astro service list, handle-session get-or-create, and
  per-session `resolve_runtime_access` sequence in `assistant-endpoint.ts`, `ChatProvider.tsx`,
  and settings hooks.
- [x] Use normal `AgentSessionSerializer` normalization for this workflow.
- [x] Update runtime and settings READMEs to describe the three-stage Astro workflow.
- [x] Add tests for the new Astro sequence:
  deploy service, get-or-create session by handle, resolve runtime access.
- [x] Add tests that ChatProvider uses the Astro handle session instead of latest-session ordering
  for default Command Center rail binding and unions that session into the visible session catalog.
- [x] Add tests that configured/proxy transport still calls `resolve_runtime_access`, does not send
  `create_knative_service`, and uses the configured endpoint only as a transport override for
  assistant-runtime calls.
- [x] Add tests that agent-runtime requests without a concrete session uid are rejected instead of
  falling back to a static configured endpoint.
- [x] Add tests for settings runtime-access caching, `401` / `403` refresh, queued/starting
  messaging, and provider-auth-triggered catalog/status refresh.

## Storage And Backend Contract Assessment

This ADR changes frontend runtime transport and session bootstrap behavior. It does not require a
persisted workspace/widget storage change by itself.

It depends on these backend API contracts:

- supporting `astro-orchestrator` through `coding-agent-services/deploy/`, including optional
  `llm_provider`, `llm_model`, and `llm_thinking`
- guaranteeing `AgentSessionSerializer` from `agents/{agent_uid}/sessions/get_or_create_session/`
- returning runtime access from `sessions/{session_uid}/resolve_runtime_access/`

If the frontend later persists Astro session identity in workspace/widget state, that must be
reviewed separately as a storage contract change.

## Consequences

Positive:

- Astro and project-executor deployment use the same coding-agent service abstraction.
- settings, model catalog, chat bootstrap, and session selection can use the same explicit stages.
- frontend code can reject envelope-shaped responses and rely on canonical serializers.

Negative:

- bootstrap has more visible stages and therefore more intermediate loading/error states.
- cache invalidation becomes more explicit because service, session, and runtime access can change
  independently.
- implementation must keep tests and documentation aligned with the explicit Astro service,
  session, and runtime-access stages.
