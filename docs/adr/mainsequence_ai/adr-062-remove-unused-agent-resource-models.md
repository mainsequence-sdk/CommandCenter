# ADR 062: Remove Unused Agent Capability and Session Resource Models

- Status: Proposed
- Date: 2026-05-07
- Related:
  - [ADR 060: Main Sequence AI Session-Backed Chat Request Contract](./adr-060-session-backed-chat-request-contract.md)
  - [ADR 077: Unified Astro Coding-Agent Bootstrap](./adr-077-unified-astro-coding-agent-bootstrap.md)

## Context

The current `Main Sequence AI` frontend runtime does not use the following ORM resource families:

- `AgentCapability`
- `AgentCapabilityBinding`
- `AgentSubagentBinding`
- `AgentSessionCapabilitySnapshot`
- `AgentSessionStep`
- `AgentSessionArtifact`

Concretely, the active assistant/chat architecture in Command Center uses:

- `POST /orm/api/agents/v1/sessions/{agent_session_id}/resolve_runtime_access/`
- `POST /orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/` for handle-bound
  AgentSession creation/reuse when an Astro `agent_uid` already exists
- assistant-runtime endpoints rooted at the resolved `runtime_access.rpc_url`, especially:
  - `/api/chat`
  - `/api/chat/history`
  - `/api/chat/session-tools`
  - `/api/chat/session-insights`
  - `/api/chat/get_available_models`
  - `/api/chat/session/cancel`

Repository inspection in Command Center shows no frontend runtime references to:

- `/orm/api/agents/v1/capabilities/`
- `/orm/api/agents/v1/bindings/`
- `/orm/api/agents/v1/subagent-bindings/`
- `/orm/api/agents/v1/session-capability-snapshots/`
- `/orm/api/agents/v1/session-steps/`
- `/orm/api/agents/v1/session-artifacts/`

That means these backend-owned resources currently add maintenance and API surface without serving
the actual session-backed assistant workflow.

Keeping unused agent resources has real cost:

- larger DRF/router/OpenAPI surface area
- more backend model and migration burden
- more ambiguous architecture for future agent work
- increased chance that new frontend/backend work accidentally depends on obsolete contracts

## Decision

The unused agent capability and session resource families will be removed from the platform.

This removal includes:

- backend persistence models
- DRF serializers
- DRF viewsets/endpoints
- router registration
- permission wiring
- admin registrations
- OpenAPI/schema exposure
- stale documentation and ADR references

The removal target is:

- `AgentCapability`
- `AgentCapabilityBinding`
- `AgentSubagentBinding`
- `AgentSessionCapabilitySnapshot`
- `AgentSessionStep`
- `AgentSessionArtifact`

## Scope

This ADR covers:

- removal of the six unused backend model families above
- removal of their REST endpoints under `/orm/api/agents/v1/`
- removal of schema/docs/references that advertise those endpoints as supported
- confirmation that current Command Center assistant flows do not depend on them

This ADR does not cover:

- `AgentSession`
- session runtime-access resolution
- command-center handle bootstrap
- assistant-runtime `/api/chat/*` endpoints
- future replacement designs for capability graphs, subagent topology, artifact persistence, or
  session execution traces

## Design

### 1. The session-backed assistant path stays unchanged

Current assistant communication remains centered on:

1. a concrete backend `AgentSession`
2. runtime-access resolution through `resolve_runtime_access`
3. runtime RPC communication through the resolved `rpc_url`

Removing the unused ORM resources must not change that path.

### 2. Remove dead ORM resources completely, not partially

The platform should not keep placeholder DRF endpoints or empty models for these resources.

If a resource family is unused and has no adopted runtime contract, the correct outcome is full
deletion rather than soft deprecation-by-neglect.

### 3. Remove DRF exposure together with model removal

Deleting only the model layer while keeping serializers, routers, or schema registration would
leave a broken public contract. The deletion must be end-to-end:

1. model removal
2. serializer removal
3. view/viewset removal
4. router removal
5. schema removal
6. test cleanup

### 4. Treat documentation as part of the public contract

Any backend API docs, generated schema output, integration notes, or ADRs that still imply those
resources are active must be updated in the same removal slice.

The goal is not only to stop serving the endpoints, but to stop teaching engineers that those
resources are part of the supported architecture.

## Implementation Tasks

- [ ] Remove the backend models for `AgentCapability`, `AgentCapabilityBinding`,
      `AgentSubagentBinding`, `AgentSessionCapabilitySnapshot`, `AgentSessionStep`, and
      `AgentSessionArtifact`.
- [ ] Remove the corresponding DRF serializers, filters, viewsets, and router registrations.
- [ ] Remove admin registrations and permission wiring for those resources.
- [ ] Remove schema/OpenAPI references so the endpoints disappear from generated API docs.
- [ ] Remove backend tests that only validate those deleted resources.
- [ ] Update any surviving tests or fixtures that still import those model classes.
- [ ] Update architecture docs and backend docs to reflect that the supported assistant path is
      session-backed runtime access plus assistant-runtime `/api/chat/*`, not capability/binding
      REST resources.
- [ ] Verify that Command Center frontend assistant flows still depend only on the active session
      and runtime-access endpoints listed in this ADR.

## Consequences

### Positive

- The agent backend contract becomes smaller and easier to reason about.
- The supported assistant architecture becomes clearer: session-backed runtime access is the real
  path, and the deleted resources are no longer misleading alternatives.
- Backend maintenance burden drops because unused model, DRF, and schema surface disappears.

### Negative

- Any private tooling or manual scripts that still depend on those endpoints will break and must be
  migrated or deleted.
- Backend removal may require migration work if the tables already exist in deployed environments.

## Storage Contract Assessment

This ADR changes backend contracts by removing unused API resources and their persistence models.

It does not change the frontend persisted workspace/widget/chat storage contracts in Command
Center.

The affected contract area is the backend ORM/DRF API surface only.
