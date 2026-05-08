# ADR 063: User AI Initialization

- Status: Accepted
- Date: 2026-05-08
- Related:
  - [ADR: Main Sequence AI Command Center Base Session](../../adr/mainsequence_ai/adr-main-sequence-ai-command-center-base-session.md)
  - [ADR: Main Sequence AI Runtime Endpoint Resolution](../../adr/mainsequence_ai/adr-main-sequence-ai-runtime-endpoint-resolution.md)
  - [ADR: AgentSession Interaction Readiness Gate](../../adr/mainsequence_ai/adr-agent-session-interaction-readiness-gate.md)

## Context

The Main Sequence AI chat page and right rail are session-backed surfaces. A user should not see a
dead empty chat state when they have no `AgentSession` records at all, because the Command Center
orchestrator is the default user AI entry point.

The important condition is not whether the route has a `?session=<id>` query parameter. The only
condition that should trigger automatic initialization is that Command Center has finished loading
the user's available sessions and the final merged session list is empty.

Existing session runtime access must continue to use the session-scoped runtime resolver:

- `POST /orm/api/agents/v1/sessions/<session_id>/resolve_runtime_access/`

The Command Center orchestrator get-or-create path is only for the zero-session initialization case.
It must not be used as a runtime access fallback for existing sessions.

## Decision

When the user opens `/app/main_sequence_ai/chat` or opens the Main Sequence AI right rail, Command
Center will automatically initialize the Command Center orchestrator only if there are no available
sessions after session loading completes.

The bootstrap condition is:

```ts
chatOrRailMounted &&
latestSessionsLoadFinishedSuccessfully &&
mergedAgentSessions.length === 0 &&
!bootstrapAlreadyInFlightOrAttemptedForThisUser
```

This condition is independent of `?session=<id>`.

## Behavior

1. Command Center restores local cached sessions and fetches latest sessions from Main Sequence.
2. The latest-session response is merged into the local `agentSessions` list.
3. If the merged list contains at least one session, no automatic get-or-create call is made.
4. If the merged list is empty, Command Center calls the Command Center orchestrator get-or-create
   initialization endpoint.
5. The returned backend `AgentSession` serializer is normalized into the same local
   `AgentSessionRecord` shape used by explicit session creation.
6. The new session is inserted into `agentSessions` and selected because there were no other
   sessions available.
7. The normal readiness gate then runs before chat accepts input:
   - `GET /orm/api/agents/v1/sessions/<session_id>/`
   - `GET /orm/api/agents/v1/sessions/<session_id>/insights/`
   - `GET /api/chat/history?sessionId=<session_id>`

## Non-Goals

- Do not bootstrap merely because the route does not contain `?session=<id>`.
- Do not bootstrap merely because the currently requested `?session=<id>` is missing while other
  sessions exist.
- Do not use the Command Center orchestrator get-or-create path for project-agent sessions.
- Do not use get-or-create as a replacement for
  `/orm/api/agents/v1/sessions/<session_id>/resolve_runtime_access/`.
- Do not create a second session if any session already exists for the loaded user scope.

## Edge Cases

- If `?session=<id>` points to a stale or deleted session and the merged list is non-empty, Command
  Center should handle the stale selection as a selection error or fall back to normal session
  selection rules. It must not create a new Command Center orchestrator session.
- If `?session=<id>` points to a stale or deleted session and the merged list is empty, the
  zero-session rule applies and Command Center should initialize the orchestrator.
- If latest-session loading fails, Command Center must not assume zero sessions. It should show the
  loading error and avoid bootstrapping from an unknown state.
- If the user selects or creates a session while bootstrap is in flight, the bootstrap response must
  be ignored unless the session list is still empty when it returns.

## Implementation Tasks

- [x] Add a dedicated bootstrap request guard/ref so the get-or-create call cannot run twice for the
  same user/session scope.
- [x] Trigger bootstrap only after latest-session loading has completed successfully and the merged
  `agentSessions` list is empty.
- [x] Share the bootstrap trigger between the full chat page and the right rail.
- [x] Normalize the returned backend `AgentSession` through the same record-building path used by
  explicit session creation.
- [x] Select the bootstrapped session only because the list was empty at the time of acceptance.
- [x] Ignore stale bootstrap responses if the user selected or created another session before the
  response arrived.
- [x] Preserve the normal AgentSession readiness gate after bootstrap.
- [x] Keep project-agent session launches and widget-managed terminal sessions out of this
  initialization path.
- [ ] Add tests or focused coverage for zero-session bootstrap, non-empty no-op, stale query-session
  handling, duplicate prevention, and stale response ignore behavior.

## Consequences

The chat page and rail become immediately useful for a first-time user without making route query
state responsible for session creation. The source of truth stays simple: automatic Command Center
orchestrator initialization happens only when the loaded user scope has no sessions at all.

The design also preserves the existing runtime contract. Existing sessions resolve runtime access
through their own session id, while get-or-create remains a narrowly scoped user initialization
operation.
