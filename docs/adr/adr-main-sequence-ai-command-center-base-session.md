# ADR: Main Sequence AI Command Center Base Session

- Status: Accepted
- Date: 2026-04-18
- Related:
  - [ADR: Extension-Contributed Shell Settings Menus](./adr-extension-contributed-shell-settings-menus.md)

## Context

`Main Sequence AI` currently has a shortcut-driven assistant entrypoint through the global shell rail
and a full-page chat route at `/app/main_sequence_ai/chat`.

Today the provider uses a heuristic when the assistant rail opens:

- if the current selection is the default empty `astro-orchestrator` draft
- and the rail opens in docked mode
- prefer the latest real `astro-orchestrator` session

That logic currently lives in:

- [extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx)

This behavior is useful, but it is still only a heuristic. It assumes:

- the right default session is always the latest session by `agent_name`
- the latest session list always contains the correct continuity target
- session recency is the same thing as the canonical Command Center assistant thread

Those assumptions are weak.

The backend now provides a dedicated endpoint for the canonical Command Center session:

- `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`

This endpoint is the correct source of truth for the assistant’s default continuity session.

The frontend should stop inferring the default session from “latest astro-orchestrator session” and
instead model the canonical base session explicitly.

## Decision

`Main Sequence AI` will introduce an explicit `base session` concept for the Command Center
assistant.

The base session is:

- resolved from the dedicated backend endpoint
- treated as the canonical default assistant session
- used when the global assistant shortcut opens the assistant
- used as the default session when the chat page opens and there is no stronger explicit user
  selection

This must **not** be implemented as “pick latest astro session by agent name.”

The new endpoint gives the frontend the canonical default session handle, so the provider must
model that session explicitly as the source of truth.

## Scope

This ADR covers:

- frontend state ownership of the base session
- selection precedence rules
- assistant shortcut/default-open behavior
- rehydration requirements
- fallback behavior when the base-session endpoint fails

It does **not** implement:

- new backend contracts beyond consuming the endpoint above
- changes to session history payload shape
- changes to the visible latest-sessions rail contract

## Design

### 1. Base session is a first-class provider concept

`ChatProvider` must explicitly track:

- `selectedSession`
- `activeSession`
- `baseSession`

These are different concepts.

- `selectedSession`: what the user is currently browsing
- `activeSession`: the real backend-attached session currently driving requests
- `baseSession`: the canonical Command Center default session returned by the new backend endpoint

The provider must stop relying on title, agent name, or session recency to infer the default
assistant continuity target.

### 2. Canonical source of truth

The only canonical source for the default Command Center session is:

- `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`

This endpoint must replace the current dock-open heuristic that selects the latest
`astro-orchestrator` session by name.

### 3. Selection precedence

The provider should use the following precedence rules:

1. if the user explicitly selected a session in the current UI flow, keep it
2. otherwise, if the base session is resolved, select the base session
3. otherwise, fall back temporarily to the existing local draft/placeholder behavior while the
   base-session bootstrap is unresolved only while the request is still in flight

This prevents the canonical base session from fighting explicit user intent.

### 4. Bootstrap triggers

The base session should be resolved on the same lifecycle boundaries that currently initialize the
assistant experience:

- when auth/session identity becomes available
- when the shell assistant rail opens
- when the full chat page opens

The user should not need to send a first message to establish continuity.

### 5. Rehydration requirement

Once the base session is resolved, the frontend must immediately run the normal backend session
rehydration flow for it:

- load history
- hydrate transcript
- load session tools
- load session insights

This is required so the assistant opens as a continuous thread rather than a fresh local shell.

### 6. Visibility vs latest-session pagination

The base session should not depend on whether it appears inside the latest-session query window.

Recommended behavior:

- keep the latest-sessions list as a separate backend-driven list
- if the base session appears there, reuse it
- if it does not appear there, inject the base session into provider state anyway so it can be
  selected and hydrated

This keeps “default assistant continuity” separate from latest-session pagination.

### 7. Frontend-only origin marker

The frontend should mark the base session with a frontend-only origin field, for example:

```ts
origin: "astro_command_center_base"
```

This marker is for provider reasoning only.

It should not be treated as a backend contract unless the frontend later persists or serializes it
in a way the backend must understand.

Storage contract assessment:

- if this marker stays frontend-local in browser storage/runtime state only, this is a frontend-only
  change
- if it later becomes part of any persisted contract the backend reads, that becomes a backend
  contract change and must be coordinated explicitly

### 8. Failure behavior

If `get_or_create_astro_command_center` fails:

- fail fast for the default assistant path
- block the assistant composer until a real backend session is available
- do not silently reinterpret “latest astro session” as the canonical default
- keep the failure visible in debug/dev logging

The frontend should not silently fabricate a new default local draft and pretend it is the
canonical Command Center continuity session.

## Consequences

### Positive

- default assistant continuity becomes explicit and backend-backed
- shortcut behavior becomes stable and deterministic
- the full chat page and shell rail can share one canonical default session rule
- frontend mental model becomes cleaner because `baseSession` is separate from
  `selectedSession` and `activeSession`

### Negative

- provider complexity increases because there is one more session concept to model
- assistant bootstrap gains another network dependency
- rehydration flow needs to be coordinated carefully with existing session selection behavior

## Tasks

- [x] Add a dedicated runtime transport for `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`.
- [x] Define the normalized frontend response model for the base session handle in `extensions/main_sequence_ai/runtime/`.
- [x] Add explicit `baseSession` state ownership to [ChatProvider.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx).
- [x] Remove the current “latest `astro-orchestrator` session” dock-open heuristic from [ChatProvider.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx).
- [x] Replace that heuristic with base-session bootstrap and explicit precedence rules.
- [x] Resolve the base session when auth becomes available.
- [x] Resolve the base session when the shell assistant rail opens.
- [x] Resolve the base session when the full chat page opens.
- [x] Rehydrate history immediately after resolving the base session.
- [x] Refresh tools immediately after resolving the base session.
- [x] Refresh insights immediately after resolving the base session.
- [x] Inject the base session into provider state even when it is not part of the latest-session page window.
- [x] Add a frontend-only origin marker for the base session and document its storage semantics.
- [x] Keep explicit user session selection higher priority than automatic base-session selection.
- [x] Fail fast when the base-session endpoint fails instead of silently falling back to a fabricated default draft.
- [x] Update `extensions/main_sequence_ai/assistant-ui/README.md` after implementation.
- [x] Update `extensions/main_sequence_ai/runtime/README.md` after implementation.

## Rejected Alternative

### Use latest `astro-orchestrator` session as the default

Rejected.

Reason:

- this is only a heuristic
- it couples canonical assistant continuity to session recency
- it depends on latest-session pagination
- it can select the wrong session even when the backend now provides the canonical one directly

The new endpoint exists specifically to remove that ambiguity, so the frontend should use it.
