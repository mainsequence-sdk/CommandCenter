# ADR: Main Sequence AI Runtime Endpoint Resolution

- Status: Accepted
- Date: 2026-04-19
- Related:
  - [ADR: Main Sequence AI Command Center Base Session](./adr-main-sequence-ai-command-center-base-session.md)

## Context

`Main Sequence AI` currently resolves assistant-runtime endpoints from a configured frontend root.
That works for the proxied local-dev path, but it is no longer sufficient for deployments where the
runtime endpoint is issued dynamically per user/session.

The frontend now has two valid runtime modes:

1. proxied/static mode
2. dynamic RPC mode

### Proxied/static mode

When `VITE_ASSISTANT_UI_PROXY_TARGET` is set, the current frontend behavior should remain in place:

- use `VITE_ASSISTANT_UI_ENDPOINT` as the assistant root
- keep current request flow unchanged
- keep using the current bearer token behavior already implemented for that path

This mode is important for local development and should not be broken by the dynamic-runtime work.

### Dynamic RPC mode

When `VITE_ASSISTANT_UI_PROXY_TARGET` is **not** set, the frontend must not assume a fixed
assistant-runtime root.

Instead it must resolve runtime access through:

- `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`

That endpoint returns the canonical Command Center session payload plus:

```json
{
  "runtime_access": {
    "coding_agent_service_id": "...",
    "coding_agent_id": "...",
    "mode": "token",
    "rpc_url": "https://<subdomain>.<CODING_AGENTS_DOMAIN>/",
    "token": "..."
  }
}
```

In dynamic mode the frontend must:

- read `runtime_access.rpc_url`
- read `runtime_access.token`
- call the runtime using:
  - `Authorization: Bearer <runtime_access.token>`

The ORM API root does **not** change. Only assistant-runtime endpoints switch to the discovered
`rpc_url`.

### Expiration and refresh

The runtime token can expire or become invalid for scope/service reasons.

When that happens:

- `GET /coding-agent/jwt/validate/` would reject it
- assistant-runtime requests may fail with:
  - `401`
  - `403`

When that happens, the frontend must reacquire runtime access from:

- `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`

This refresh behavior should be centralized instead of being duplicated in each transport helper.

## Decision

`Main Sequence AI` will support two assistant-runtime resolution modes:

### 1. Proxied/static mode

Active when:

- `VITE_ASSISTANT_UI_PROXY_TARGET` is set

Behavior:

- keep current assistant root resolution exactly as it works today
- do not introduce dynamic RPC discovery in this mode

### 2. Dynamic RPC mode

Active when:

- `VITE_ASSISTANT_UI_PROXY_TARGET` is not set

Behavior:

- resolve runtime access from the Command Center base-session endpoint
- use `runtime_access.rpc_url` as the assistant root
- use `runtime_access.token` as the bearer token for assistant-runtime calls

This runtime-access object becomes the source of truth for all assistant-runtime requests in
dynamic mode.

## Scope

This ADR covers:

- assistant-runtime root resolution
- assistant-runtime bearer token source
- runtime-access refresh behavior
- boot ordering for runtime-dependent requests

It does **not** change:

- ORM endpoint roots
- the meaning of the Command Center base session itself
- chat/session domain contracts beyond consuming `runtime_access`

## Design

### 1. Two endpoint families remain separate

There are still two backend families:

- ORM endpoints
- assistant-runtime endpoints

Rules:

- ORM endpoints stay rooted at `env.apiBaseUrl`
- assistant-runtime endpoints use:
  - proxied/static root in proxied mode
  - discovered `rpc_url` in dynamic mode

The frontend must not mix those roots.

### 2. Base-session bootstrap also becomes runtime-access bootstrap

The existing Command Center base-session bootstrap endpoint now also provides runtime access.

The normalized frontend response for this endpoint must preserve:

- session identity
- `runtime_access.coding_agent_service_id`
- `runtime_access.coding_agent_id`
- `runtime_access.mode`
- `runtime_access.rpc_url`
- `runtime_access.token`

This does not change the semantic meaning of the base session. It adds the runtime-routing and
runtime-auth information needed to talk to the assigned coding-agent service.

### 3. Provider-owned runtime access state

`ChatProvider` should explicitly own the currently resolved runtime access state, for example:

- `resolvedAssistantRoot`
- `resolvedAssistantToken`
- `resolvedAssistantMode`
- `resolvedCodingAgentServiceId`
- `resolvedCodingAgentId`

Resolution rules:

- proxied mode:
  - use current assistant endpoint configuration
- dynamic mode:
  - require valid `runtime_access.rpc_url`
  - require valid `runtime_access.token`

### 4. Boot ordering

In dynamic mode, runtime-dependent fetches must not start until runtime access has been resolved.

Required order:

1. call the ORM base-session endpoint
2. normalize session + `runtime_access`
3. store resolved runtime root/token
4. only then call assistant-runtime endpoints

This applies to:

- `/api/chat`
- `/api/chat/history`
- `/api/chat/session-tools`
- `/api/chat/session-insights`
- `/api/chat/get_available_models`
- `/api/model-providers`
- `/api/models/catalog`
- `/api/storage/usage`

### 5. Centralized refresh-on-401/403

Dynamic mode must support runtime token refresh.

Refresh trigger:

- assistant-runtime response status `401`
- assistant-runtime response status `403`

Refresh action:

- call
  `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`
- replace the stored runtime root/token with the new `runtime_access`
- retry the failed assistant-runtime request once

This logic must be centralized in a shared runtime wrapper rather than copied into every API file.

### 6. Single-flight refresh

When multiple runtime requests fail at the same time, the frontend should avoid issuing many
parallel refresh calls.

Recommended behavior:

- keep one in-flight refresh promise/lock
- have concurrent failing requests await the same refresh
- retry once after refresh completes

### 7. Strict failure behavior

If dynamic runtime access cannot be resolved or refreshed:

- mark assistant runtime unavailable
- disable the composer/runtime-dependent UI
- show an explicit runtime-access failure state
- do not silently fall back to:
  - stale runtime tokens
  - user session tokens
  - guessed assistant roots

### 8. Token lifetime handling

The backend may default token lifetime to `86400` when unset, but frontend logic should not depend
on that assumption for correctness.

Frontend refresh should be driven by actual runtime authorization failures (`401` / `403`), not by
locally guessed expiry times.

## Consequences

### Positive

- deployed runtime routing becomes explicit and backend-driven
- local proxied development stays stable
- assistant-runtime auth becomes aligned with the assigned coding-agent service
- token refresh behavior becomes predictable and centralized

### Negative

- boot flow becomes more complex in dynamic mode
- assistant-runtime requests depend on successful runtime-access bootstrap
- more provider/runtime state must be tracked in `ChatProvider`

## Tasks

- [x] Extend the normalized Command Center base-session transport to preserve `runtime_access`.
- [x] Preserve `runtime_access.rpc_url` in the normalized frontend model.
- [x] Preserve `runtime_access.token` in the normalized frontend model.
- [x] Preserve `runtime_access.mode` in the normalized frontend model.
- [x] Preserve `runtime_access.coding_agent_service_id` in the normalized frontend model.
- [x] Preserve `runtime_access.coding_agent_id` in the normalized frontend model.
- [x] Add explicit assistant-runtime access state ownership to [ChatProvider.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx).
- [x] Keep current proxied assistant behavior unchanged when `VITE_ASSISTANT_UI_PROXY_TARGET` is set.
- [x] Add dynamic assistant-root selection when `VITE_ASSISTANT_UI_PROXY_TARGET` is not set.
- [x] Route assistant-runtime fetches through the resolved runtime root in dynamic mode.
- [x] Route assistant-runtime fetches through the resolved runtime token in dynamic mode.
- [x] Keep ORM fetches on `env.apiBaseUrl` and the normal app auth token.
- [ ] Gate runtime-dependent boot requests until dynamic runtime access has been resolved.
- [x] Add a shared assistant-runtime fetch wrapper that can refresh runtime access on `401` / `403`.
- [x] Add single-flight protection so concurrent runtime failures share one refresh request.
- [x] Retry a failed assistant-runtime request once after successful refresh.
- [ ] Surface explicit runtime-access failure UI when dynamic access cannot be resolved or refreshed.
- [x] Update `extensions/main_sequence_ai/runtime/README.md` after implementation.
- [x] Update `extensions/main_sequence_ai/assistant-ui/README.md` after implementation.

## Rejected Alternatives

### Always use `VITE_ASSISTANT_UI_ENDPOINT`

Rejected.

Reason:

- it cannot support deployments where the runtime host is assigned dynamically
- it ignores the runtime token issued by the ORM bootstrap endpoint
- it conflates proxied dev behavior with deployed runtime behavior

### Use ORM auth token directly against the runtime RPC URL

Rejected.

Reason:

- the backend is explicitly returning a runtime-scoped token for this purpose
- wrong token or wrong scope may result in `403`
- assistant-runtime auth should follow the issued `runtime_access` contract rather than guessing
