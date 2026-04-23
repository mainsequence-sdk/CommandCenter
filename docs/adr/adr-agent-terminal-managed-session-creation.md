# ADR: Agent Terminal Managed Session Creation and Agent Allowlist

- Status: Proposed
- Date: 2026-04-23
- Related:
  - [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](./adr-widget-agent-context-bindings.md)
  - [ADR: Main Sequence AI Command Center Base Session](./adr-main-sequence-ai-command-center-base-session.md)

## Context

`Agent Terminal` currently binds to an existing `AgentSession` id.

That means the current authoring flow is:

1. choose an agent
2. choose one specific existing session
3. mount the widget against that session

This is the wrong ownership model for the widget.

The terminal is not a generic session browser. It is an execution surface that should own a fresh
session lifecycle for the selected agent.

The current model creates several problems:

- the user can attach the widget to an arbitrary old session
- several widgets can accidentally point at unrelated pre-existing sessions without a clear creation
  moment
- the widget settings surface exposes session-level choice when the real authoring intent is
  agent-level choice
- the widget contract keeps treating `agentSessionId` as a user-authored input rather than a widget-
  managed runtime artifact

There is also a policy constraint for this surface.

The set of agents that may be used by `Agent Terminal` should be explicit and centrally controlled.
For the current product scope, only `astro-orchestrator` should be selectable.

The backend already exposes the correct session-creation primitive:

- `POST /orm/api/agents/v1/agents/{agent_id}/start_new_session/`

The frontend should use that endpoint instead of asking the user to pick a specific existing
session.

## Decision

`Agent Terminal` will become an agent-owned widget, not a user-selected-session widget.

### 1. Agent selection stays, session selection goes away

The widget author will select an agent only.

After the agent is selected, the widget will automatically create a new session for that agent and
bind itself to the newly created `AgentSession`.

The user must not be allowed to select an arbitrary existing session in widget settings or launcher
flows.

### 2. Agent allowlist is a frontend constant

The widget flow will use one explicit constant for allowed agent types/identifiers.

For the first slice, that allowlist contains only:

- `astro-orchestrator`

This constant is a frontend policy surface. It must be shared by every Agent Terminal authoring
entrypoint so the widget settings page, monitor launcher, and any future insertion flow do not
drift.

### 3. Session creation is automatic

Once the user selects an allowed agent, the frontend will call:

- `POST /orm/api/agents/v1/agents/{agent_id}/start_new_session/`

The returned session becomes the widget's bound session immediately.

The session is widget-managed. It is not chosen directly by the user.

### 4. Recycle session is allowed, manual session picking is not

If the product wants a way to discard the current widget-bound session and start fresh, the widget
may expose an explicit `Recycle session` action.

That action should:

- call `start_new_session` again for the same agent
- replace the widget's bound `agentSessionId`
- preserve the same widget/agent identity

It must not open a session picker or let the user browse arbitrary existing sessions.

### 5. Session remains inspectable

Even though the user must not choose a specific session, the currently bound session should still be
visible and clickable from the widget UI so the user can open its session details.

This preserves inspectability without turning session identity into an authoring input.

## Goals

- Make `Agent Terminal` own a clean per-widget session creation flow.
- Remove arbitrary existing-session binding from widget authoring.
- Keep agent choice explicit while keeping session choice implicit.
- Constrain the widget to an explicit allowlist of supported agents.
- Preserve access to session details for inspection/debugging.

## Non-Goals

- Changing general chat session selection behavior
- Changing the shell chat rail session browser
- Allowing all agents immediately
- Defining a cross-product policy for every future agent widget
- Removing the concept of `AgentSession` from runtime execution or diagnostics

## Design

### 1. Canonical authoring input is `agentId`

The authoring surface should pivot from:

- `agentId + agentSessionId`

to:

- `agentId`

with `agentSessionId` treated as widget-managed state that is produced after session creation.

This changes the mental model from "attach widget to an old session" to "create a widget for this
agent."

### 2. One shared allowlist constant

The extension should define one shared constant, for example:

```ts
export const AGENT_TERMINAL_ALLOWED_AGENT_REQUEST_NAMES = ["astro-orchestrator"] as const;
```

or the equivalent shared helper structure needed by the current agent search/result model.

Every Agent Terminal entrypoint must use that same constant:

- widget settings
- Agents Monitor launcher
- any direct add-widget flow

### 3. Automatic session bootstrap flow

Recommended sequence:

1. user selects an allowed agent
2. frontend calls `POST /orm/api/agents/v1/agents/{agent_id}/start_new_session/`
3. frontend normalizes the returned session
4. widget props/runtime bind to that returned session id
5. widget rehydrates the normal session detail/history flow for the new session

The user does not see a second session-selection step.

### 4. Recycle session semantics

`Recycle session` is an explicit authoring/runtime action, not an implicit refresh side effect.

It should:

- create a brand-new session for the already selected allowed agent
- update the widget to point at the new session
- clear/rehydrate local transcript state against the new session

It should not mutate or reopen an old session.

### 5. Session-details navigation

The widget chrome should expose the current session identity as an inspectable link/action.

Expected behavior:

- clicking the displayed session opens the existing session details surface
- the user can inspect metadata, insights, and related runtime details
- returning from that inspection does not change the widget's bound session unless the widget
  explicitly recycles it

## Storage Contract Assessment

This decision likely changes the persisted widget contract.

Today the widget persists `agentSessionId` as an author-authored binding target.

Under this proposal:

- `agentId` remains an authored input
- `agentSessionId` becomes widget-managed state derived from backend session creation

Questions that implementation must settle explicitly:

- whether `agentSessionId` remains a durable persisted widget prop after creation
- whether the backend widget-type contract still treats `agentSessionId` as user-authored config
- whether a recycled session overwrites the durable prop or lives only in runtime state until save

This is not safely a frontend-only concern.

If persisted widget serialization or backend widget-prop validation changes, that is a backend
contract change and must be coordinated.

### Backend dependency

This ADR depends on a stable frontend-consumable contract for:

- `POST /orm/api/agents/v1/agents/{agent_id}/start_new_session/`

The frontend will need the returned payload to include enough information to bind and rehydrate the
new `AgentSession` immediately.

## Consequences

### Positive

- Agent Terminal authoring becomes simpler and closer to user intent.
- Each widget gets an explicit session creation event instead of silently attaching to old history.
- Supported-agent policy becomes centralized and testable.
- The widget can still expose session details without exposing session picking.

### Negative

- Widget insertion now depends on a session-creation network call.
- The widget contract becomes more stateful because session identity is created during authoring.
- Existing settings/launcher UI that assumes session picking will need to be rewritten.
- Storage/back-end contract coordination may be required for `agentSessionId` ownership semantics.

## Tasks

- [ ] Add one shared Agent Terminal allowlist constant for selectable agents.
- [ ] Restrict current Agent Terminal search/picker flows to that allowlist.
- [ ] Remove direct existing-session selection from Agent Terminal settings and launcher flows.
- [ ] Add a runtime/API helper for `POST /orm/api/agents/v1/agents/{agent_id}/start_new_session/`.
- [ ] Create a new session immediately after agent selection and bind the widget to that session.
- [ ] Define whether `agentSessionId` remains a durable prop or becomes runtime-owned until save.
- [ ] Add an explicit `Recycle session` action for the same selected agent.
- [ ] Add a clickable session reference in the widget so the user can open session details.
- [ ] Update Agent Terminal docs and registry contract once implementation is accepted.

## Rejected Alternative

### Keep user-authored session selection

Rejected.

Reason:

- it models the widget as a session browser instead of an execution surface
- it lets users bind to arbitrary stale sessions
- it adds an authoring step that does not reflect the actual intent
- it weakens per-widget session ownership and makes runtime behavior harder to reason about
