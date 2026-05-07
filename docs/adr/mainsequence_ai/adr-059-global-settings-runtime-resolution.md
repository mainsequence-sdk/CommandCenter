# ADR 059: Main Sequence AI Global Settings Runtime Resolution

- Status: Proposed
- Date: 2026-05-06
- Related:
  - [ADR: Main Sequence AI Command Center Base Session](./adr-main-sequence-ai-command-center-base-session.md)
  - [ADR: Main Sequence AI Runtime Endpoint Resolution](./adr-main-sequence-ai-runtime-endpoint-resolution.md)

## Context

`Main Sequence AI` currently has two different assistant-runtime access patterns:

1. session-bound runtime resolution for a concrete `AgentSession`
2. configured-endpoint runtime access for global settings surfaces

The session-bound path is now explicit and correct:

- `POST /orm/api/agents/v1/sessions/{agent_session_id}/resolve_runtime_access/`

That path is appropriate for:

- page chat
- shell chat rail
- agent terminal
- any interaction already attached to a concrete backend `AgentSession`

However, the global settings screens are not attached to a concrete session. Today they use:

- `assistant_ui.endpoint`
- or `VITE_ASSISTANT_UI_ENDPOINT`

through `runtimeTarget: "configured"`.

That is only valid for debug / proxied development.

In production, `assistant_ui.endpoint` may be blank, and the settings surfaces still need a real
runtime root plus a runtime token in order to call:

- `/api/model-providers`
- `/api/models/catalog`
- `/health`

The backend already provides the correct production bootstrap path through the Astro orchestrator
handle:

- `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`

That endpoint creates or resolves the canonical Command Center orchestrator session and returns the
same runtime-access contract shape used elsewhere:

```json
{
  "runtime_access": {
    "rpc_url": "https://<runtime>/",
    "token": "...",
    "mode": "token",
    "coding_agent_id": "...",
    "coding_agent_service_id": "..."
  }
}
```

The current settings architecture is therefore wrong in two ways:

1. it treats `VITE_ASSISTANT_UI_ENDPOINT` as a production requirement instead of a debug override
2. it uses the configured-endpoint path with the ORM auth token instead of using orchestrator
   runtime access with the returned runtime token

## Decision

`Main Sequence AI` will use three distinct assistant-runtime resolution targets:

1. `configured`
2. `agent-runtime`
3. `command-center-base`

### 1. `configured`

Use only for debug / proxied development.

Activation:

- `VITE_ASSISTANT_UI_ENDPOINT` is intentionally configured for local development
- or proxy-mode development is active

Behavior:

- use the configured frontend assistant root directly
- use the current app session token behavior already implemented for that debug path

This target is not the production fallback.

### 2. `agent-runtime`

Use for any flow already attached to a concrete `AgentSession`.

Behavior:

- call
  `POST /orm/api/agents/v1/sessions/{agent_session_id}/resolve_runtime_access/`
- require `runtime_access.rpc_url`
- require `runtime_access.token`
- use the returned runtime token for assistant-runtime requests

This remains the only valid target for session-bound chat or terminal interactions.

### 3. `command-center-base`

Use for global, non-session settings surfaces.

Behavior:

- call
  `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`
- require `runtime_access.rpc_url`
- require `runtime_access.token`
- use the returned runtime token for assistant-runtime requests

This is the production path for:

- `Model Providers`
- `Agents Settings`
- any future global assistant-runtime diagnostics screen not attached to a concrete session

## Scope

This ADR covers:

- runtime-access resolution for global settings surfaces
- debug versus production assistant-endpoint behavior
- token source for global assistant-runtime requests
- separation between session-bound and non-session assistant runtime access

It does not change:

- the per-session `resolve_runtime_access/` contract
- the meaning of the canonical Command Center base session
- ORM endpoint roots
- the visible session selection rules in chat

## Design

### 1. Runtime target selection must be explicit

The shared runtime endpoint layer must stop treating “configured endpoint exists” as the only
non-session option.

Instead it should support explicit runtime targets:

- `configured`
- `agent-runtime`
- `command-center-base`

The caller must choose the target intentionally.

### 2. Global settings must branch by environment role, not by screen convenience

The settings hook should use these rules:

1. if debug configured endpoint mode is intentionally active, use `configured`
2. otherwise, use `command-center-base`

It should not fail just because `assistant_ui.endpoint` is blank in production.

### 3. Session-bound chat must not fall back to orchestrator bootstrap

Once a concrete `AgentSession` exists, runtime access must continue to come only from:

- `POST /orm/api/agents/v1/sessions/{agent_session_id}/resolve_runtime_access/`

The orchestrator handle path is only for session-free global surfaces.

### 4. Token semantics must stay aligned with the backend contract

Rules:

- ORM requests keep using the app session token
- `configured` debug assistant-runtime requests keep current debug auth behavior
- `agent-runtime` assistant-runtime requests use `runtime_access.token` returned for that session
- `command-center-base` assistant-runtime requests use `runtime_access.token` returned by the
  orchestrator-handle endpoint

The frontend must not substitute the app session token for production assistant-runtime calls.

### 5. Global settings state must expose the active resolution mode

Settings surfaces should be able to distinguish:

- debug configured endpoint mode
- production Command Center orchestrator runtime mode
- runtime resolution failure

This is required so the UI can explain where runtime access came from and why it failed.

### 6. Refresh behavior should follow the existing shared runtime wrapper

When assistant-runtime requests fail with `401` or `403`:

- `configured` mode keeps current retry behavior
- `agent-runtime` refreshes via session `resolve_runtime_access/`
- `command-center-base` refreshes via the orchestrator-handle endpoint

This logic should remain centralized in the shared runtime fetch wrapper rather than duplicated in
each settings transport.

## Consequences

### Positive

- `VITE_ASSISTANT_UI_ENDPOINT` becomes correctly limited to debug / proxied development
- production settings can work without a configured static assistant root
- global settings and session chat each use the backend contract intended for their scope
- runtime-token semantics become consistent with the backend-issued access contract

### Negative

- shared endpoint resolution becomes more complex because there is now a third runtime target
- settings runtime access becomes dependent on orchestrator-handle bootstrap in production
- failure messaging must become more specific so the UI can distinguish configured-endpoint errors
  from orchestrator runtime-access errors

## Tasks

- [ ] Reintroduce a dedicated frontend transport for
  `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`.
- [ ] Extend `assistant-endpoint.ts` to support a third runtime target:
  `command-center-base`.
- [ ] Make `useAssistantRuntimeAccess.ts` choose `configured` only for debug / proxied mode, and
  otherwise choose `command-center-base`.
- [ ] Route `AgentSettingsSection.tsx` through the new production global-runtime path.
- [ ] Route `ModelProviderSettingsSection.tsx` through the new production global-runtime path.
- [ ] Preserve session-bound chat, history, tools, models, and cancel flows on
  `agent-runtime` only.
- [ ] Ensure `command-center-base` requests use the returned `runtime_access.token`, not the app
  session token, for assistant-runtime HTTP calls.
- [ ] Surface explicit settings UI state for:
  - configured debug endpoint mode
  - orchestrator runtime mode
  - runtime resolution failure
- [ ] Update `extensions/main_sequence_ai/runtime/README.md` after implementation.
- [ ] Update `extensions/main_sequence_ai/features/settings/README.md` after implementation.

## Rejected Alternatives

### Always require `VITE_ASSISTANT_UI_ENDPOINT`

Rejected.

Reason:

- it makes a debug override behave like a production dependency
- it fails when production runtime hosts are issued dynamically
- it bypasses the backend runtime-token contract

### Use the orchestrator handle for concrete `AgentSession` chat

Rejected.

Reason:

- chat and terminal already have a concrete session contract
- per-session runtime resolution is authoritative once a real `AgentSession` exists
- falling back to the orchestrator path would mix global and session-bound runtime scopes again
