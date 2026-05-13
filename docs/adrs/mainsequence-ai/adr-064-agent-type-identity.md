# ADR 064: Agent Type Identity

- Status: Accepted
- Date: 2026-05-12
- Related:
  - [ADR 063: User AI Initialization](./adr-063-user-ai-initialization.md)

## Context

Main Sequence AI currently uses `Agent.name` in places where the value is not a display label. In
practice, those code paths use `Agent.name` as the stable runtime identity for chat routing,
AgentSession request construction, endpoint selection, model-catalog scoping, and Agent Terminal
capability checks.

That is wrong because the runtime identity is the agent type. A display name can change, can be
localized, and can be duplicated. The agent type is the capability identifier that should drive
runtime behavior.

The current naming also hides the bug. The session agent identity field sounded generic, but it
actually carries the agent runtime type used by `/api/chat` and assistant endpoint resolution.

## Decision

Command Center will stop using `Agent.name` as an agent capability or runtime identifier.

The canonical identity field for agent capability routing is:

```ts
agent.agent_type
```

Frontend domain models, variables, and function names must use `agentType` or `requestAgentType`
when they represent this identity.

The frontend must not expose or consume `Agent.name` as an identity property. If a human-facing
label is needed for generic UI, it must use label-specific naming such as `agentLabel` or
`displayLabel`. `Agent.name` and `AgentSession.agent_name` may be consumed only in explicitly visual
surfaces that are showing backend name fields as text. Display labels and names must never be
accepted as fallback runtime identities.

## Required Renames

| Current name | Replacement |
| --- | --- |
| `Agent.name` | `Agent.agent_type` for identity, `displayLabel` for UI text |
| `AgentSessionAgent.name` | `displayLabel` |
| session agent identity field | `requestAgentType` |
| `activeAgentName` | `activeAgentType` or `activeAgentLabel`, depending on usage |
| `activeAgentRequestName` | `activeRequestAgentType` |
| `resolveAgentSessionRequestName` | `resolveAgentSessionRequestAgentType` |
| `isAgentTerminalAllowedAgentName` | `isAgentTerminalAllowedAgentType` |
| `normalizeAgentName` | `normalizeAgentType` or `normalizeAgentLabel`, depending on usage |
| ambiguous widget/request identity variables | `agentType` or `agentLabel`, depending on usage |
| `workflowKey` sourced from agent name | `workflowKey` sourced from `agentType` |

The `/api/chat` request must emit `agentType` as the runtime identity. It must not emit a legacy
identity alias.

## Capability Impact

### Agent Search And Catalog

Agent list, quick search, semantic search, and detail normalization must expose `agentType`.

Search and display surfaces may show a human label, but selection must retain the selected
`agentType` separately. Search keywords may include display labels, descriptions, skills, ids, and
agent type, but selecting an agent must never derive runtime identity from a display label.

### AgentSession State

Local `AgentSessionRecord.agent` must separate:

- `agentType`: stable runtime/capability identity.
- `displayLabel`: human-facing label.
- `agentUniqueId`: backend unique id when present.
- `id`: numeric backend agent id.

Session hydration from backend session serializers must use `agent_type`. The normalized frontend
property must still be called `agentType` or `requestAgentType`.

Local-storage migration must not fallback from missing type to display label. Old records with only
a display label should be treated as missing runtime identity and rehydrated from backend session
detail when possible.

### Chat Runtime

Chat request construction must resolve the active agent type from the selected session.

The following behavior must be driven by agent type:

- `/api/chat` request identity.
- assistant endpoint selection.
- project executor vs orchestrator routing.
- model catalog cache scope.
- `sessionMetadata.workflow_key`.
- runtime access refresh and debug logs.

No chat send path should branch on a display label.

### Agent Terminal Widgets

Agent Terminal configuration must store both display and runtime identity when needed:

- `agentType` for capability checks and runtime request construction.
- `agentLabel` for widget titles, toast text, and workspace labels.

The allowed-agent list must be an allowed agent-type list. Agent Terminal must not check
`Agent.name` to determine whether an agent can be used.

### Agent Monitor Workspaces

Agent monitor workspace titles may use labels. Workspace labels and widget props that participate
in session creation, session lookup, or runtime request construction must use agent type.

Existing workspace/widget records using ambiguous identity props need a migration path:

- If the value can be proven to be an agent type, migrate to `agentType`.
- If the value is only a label, keep it only as `agentLabel` and recover `agentType` from the
  backend session or selected agent record.

## Non-Goals

- Do not redesign backend AgentSession endpoints in this ADR.
- Do not change the user-facing agent labels unless required by the UI.
- Do not use `agent_unique_id` as a replacement for `agent_type`; they are separate identifiers.
- Do not keep compatibility fallbacks that silently treat labels as runtime identities.

## Implementation Tasks

- [x] Add `agent_type` to agent API response types and normalize it to frontend `agentType`.
- [x] Remove exported frontend agent domain properties named `name`.
- [x] Introduce explicit display fields such as `displayLabel` or `agentLabel`.
- [x] Rename the session agent identity field to `requestAgentType`.
- [x] Rename request-name helpers to request-agent-type helpers.
- [x] Update assistant endpoint resolution to accept agent type.
- [x] Update chat request body construction to pass agent type as the runtime identity value.
- [x] Update model catalog cache keys to scope by user id and agent type.
- [x] Update Agent Terminal allowed-agent filtering to use agent type.
- [x] Update Agent Terminal widget props and workspace metadata to split `agentType` from
  `agentLabel`.
- [x] Add migration handling for persisted local AgentSession and widget records that currently
  store legacy identity aliases.
- [x] Update debug logs so they say `agentType`.
- [ ] Add focused tests for catalog selection, chat endpoint routing, Agent Terminal selection,
  persisted session migration, and model cache scoping.

## Consequences

The frontend vocabulary will match the backend capability model. Display labels will stay
human-facing, while runtime routing will use the stable agent type everywhere.

This makes project-executor routing, orchestrator routing, model selection, and Agent Terminal
eligibility easier to reason about because they no longer depend on a field that looks like a UI
label.
