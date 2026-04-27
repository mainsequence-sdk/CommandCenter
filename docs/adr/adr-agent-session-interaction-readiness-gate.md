# ADR: AgentSession Interaction Readiness Gate

- Status: Proposed
- Date: 2026-04-27
- Related:
  - [ADR: Main Sequence AI Command Center Base Session](./adr-main-sequence-ai-command-center-base-session.md)
  - [ADR: Main Sequence AI Runtime Endpoint Resolution](./adr-main-sequence-ai-runtime-endpoint-resolution.md)
  - [ADR: Agent Terminal Managed Session Creation and Agent Allowlist](./adr-agent-terminal-managed-session-creation.md)

## Context

The chat page at `/app/main_sequence_ai/chat` and the Agent Terminal widget both let users interact
with backend `AgentSession` objects.

The current chat boot sequence is visibly unstable:

1. The page opens and the composer says `Connecting to the Command Center base session.`
2. A fresh-looking session shell renders while additional requests are still running.
3. The runtime then continues requesting session data in the background:
   - `GET /orm/api/agents/v1/sessions/{agent_session_id}/`
   - `GET /orm/api/agents/v1/sessions/{agent_session_id}/insights/`
   - `GET /api/chat/history?sessionId=<agent_session_id>`

This creates a bad interaction model. The user can see and sometimes interact with a session shell
before the frontend has a complete backend-backed session view. The visible UI mutates from
placeholder state into real state, which makes the product feel nondeterministic.

The same class of issue exists in Agent Terminal, although the current terminal is already stricter
than chat:

- it validates the configured `AgentSession` through
  `GET /orm/api/agents/v1/sessions/{agent_session_id}/`
- it blocks manual terminal input until that detail validation succeeds
- it does not require insights readiness before rendering an interactive terminal
- initial history loading is optional, so the terminal may show an empty validated shell even while
  transcript state has not been reconciled
- automated refresh can queue while readiness is incomplete

Both surfaces need the same product rule: `AgentSession` drives interaction readiness. UI controls
should not infer readiness from local placeholder state, partial session identity, or component
mount state.

## Decision

All Main Sequence AI interaction surfaces must gate user interaction on a complete
`AgentSessionInteractionReadiness` contract.

For a backend-attached `AgentSession`, the initial load is complete only after these requests have
finished successfully for the same selected session id:

- `GET /orm/api/agents/v1/sessions/{agent_session_id}/`
- `GET /orm/api/agents/v1/sessions/{agent_session_id}/insights/`
- `GET /api/chat/history?sessionId=<agent_session_id>`

Until that readiness gate is satisfied, the UI must render a stable loading state and must not
expose actions that can interact with the session.

This applies to:

- chat composer input and send
- model/provider picker mutations for the selected session
- session switching actions that would expose a half-loaded session
- new session creation actions once a target session exists but is not hydrated
- Agent Terminal manual input
- Agent Terminal automated refresh and prompt-on-refresh sends
- Agent Terminal transcript rendering that implies the session is ready

## Scope

This ADR covers frontend interaction gating and boot ordering for Main Sequence AI session
surfaces.

It does not change:

- ORM `AgentSession` serializer shape
- assistant-runtime history payload shape
- session insights payload shape
- model catalog payload shape
- stream chunk contracts

## Design

### 1. Define a shared readiness model

Introduce a shared session readiness model under the Main Sequence AI runtime or session-detail
boundary, for example:

```ts
type AgentSessionInteractionReadinessStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "not_found";

interface AgentSessionInteractionReadiness {
  sessionId: string | null;
  status: AgentSessionInteractionReadinessStatus;
  detailReady: boolean;
  insightsReady: boolean;
  historyReady: boolean;
  error: string | null;
}
```

The readiness key must include the selected backend `AgentSession` id. Late responses for an old
session must not mark the current session ready.

### 2. Compose readiness from real backend facets

The readiness gate is satisfied only when:

- core detail status is `ready`
- insights request completed successfully
- history request completed successfully
- all three completions belong to the same selected session id

Errors are terminal for that readiness attempt:

- detail `404` becomes `not_found`
- insights error becomes `error`
- history error becomes `error`
- aborted requests stay non-ready and should not flash an error for a superseded session

### 3. Chat bootstrap must be atomic from the user perspective

`ChatProvider` should keep resolving the Command Center base session first, but it must not expose
the session as interactable until the selected session readiness gate is complete.

Recommended chat sequence:

1. resolve base session handle/runtime access
2. fetch core AgentSession detail
3. select/stage that session internally
4. fetch insights and history for that same session
5. reset the assistant-ui thread from history
6. publish the session to the visible chat shell as `ready`
7. enable composer and session-level controls

The UI can show a full-page or in-composer loading state while this happens, but it must not show a
new empty session that later mutates into the real transcript.

### 4. Chat controls must read readiness, not local state

The chat page should disable or hide interaction controls while readiness is not `ready`:

- composer input/send
- provider picker
- model picker
- reasoning effort picker
- session delete/select/start actions that would mutate the active interaction path

Controls that are purely navigational or diagnostic may remain visible if they clearly show loading
or error state and cannot mutate the selected session.

### 5. Session switching uses two-phase activation

When the user selects another existing AgentSession:

1. keep the old ready session visible or replace it with a dedicated loading shell
2. start the readiness requests for the target session
3. activate the target session only after detail, insights, and history are complete
4. if the target fails, keep the user out of interaction with that target and show a recoverable
   error

The product should avoid briefly rendering the target as a fresh empty chat.

### 6. Agent Terminal uses the same readiness contract

Agent Terminal should stop treating core detail validation alone as full interaction readiness.

For terminal sessions, readiness should require:

- core detail ready
- insights ready
- history ready

The terminal may continue to support `loadInitialHistory = false` as a product option only if it is
renamed or re-scoped to mean "do not render previous transcript after readiness." It must not mean
"skip history readiness entirely" for interactive sessions.

Recommended terminal sequence:

1. validate core AgentSession detail
2. load insights for the same session
3. load history for the same session
4. build the terminal lines from either the loaded history or an intentional empty-history view
5. set `sessionReady = true`
6. allow manual input and automated refresh

Automated refresh should queue while readiness is loading and execute only after the readiness
state is `ready`.

### 7. New session creation is not ready by id alone

When chat or terminal creates a new AgentSession, the returned id is only an identity, not an
interactive session.

The frontend must still run the readiness gate against the new id before enabling interaction.

This prevents a newly created session from appearing as a ready empty session while backend
services, insights, or history endpoints are still catching up.

### 8. Model catalog is a separate dependency

Available model catalog loading remains a separate runtime dependency.

Interaction is allowed only when both are true:

- `AgentSessionInteractionReadiness.status === "ready"`
- model catalog policy allows sending

If the model catalog returns zero models, that catalog result remains authoritative and the
composer stays disabled with the provider sign-in action. That is not a session readiness failure.

## UX Requirements

- Use one stable loading message for session bootstrap, for example:
  `Loading AgentSession...`
- Show sub-status only as non-interactive supporting text, for example:
  `Loading detail`, `Loading insights`, `Loading history`.
- Do not render a blank transcript as if it is an initialized new session while history is loading.
- Do not focus the chat composer or terminal prompt until readiness is `ready`.
- Do not show stale model/session metadata as if it belongs to the new target session.
- If readiness fails, show the failed facet and keep interaction disabled until retry or another
  session is selected.

## Storage Contract Assessment

This is a frontend interaction-state change.

No persisted workspace, widget, binding, runtime-state, ORM session, history, or insights payload
shape needs to change to implement the readiness gate.

Backend coordination is still required for behavior, not payload shape:

- `GET /orm/api/agents/v1/sessions/{agent_session_id}/insights/` must be treated as a required
  readiness facet for interactive session surfaces.
- If the backend can return `404` while a new session service is still starting, the frontend needs
  either retry/backoff semantics or a backend distinction between `not ready yet` and `not found`.
- If the backend wants a single atomic session-bootstrap endpoint later, that would be a new
  backend contract and should get its own ADR/update.

## Consequences

### Positive

- Chat and terminal stop exposing half-hydrated sessions.
- The user sees a stable loading-to-ready transition instead of visible state mutation.
- Session interaction becomes contract-driven instead of UI-driven.
- Terminal and chat share the same readiness semantics.
- New-session and session-switch flows become easier to reason about.

### Negative

- Initial chat and terminal interaction may take longer because insights and history become
  blocking readiness facets.
- Insights endpoint instability becomes more visible because it blocks interaction.
- More provider state is needed to coordinate late responses, retries, and target-session
  activation.

## Tasks

- [x] Add a shared `AgentSessionInteractionReadiness` model and helper/controller that composes
  detail, insights, and history readiness for one selected session id.
- [x] Extend the session-detail controller or add a sibling controller so history readiness is
  tracked alongside detail and insights.
- [x] Update `ChatProvider` so base-session bootstrap stages the session internally and only
  exposes it as interactable after detail, insights, and history succeed.
- [x] Update chat shell components so composer, model/provider controls, session explorer
  mutations, and focus behavior read the readiness gate.
- [x] Update session switching to render a dedicated target-session loading state first, with
  interaction enabled only after readiness.
- [x] Route chat-created fresh sessions through backend session creation before selecting them for
  readiness hydration.
- [x] Update Agent Terminal so `sessionReady` is set only after detail, insights, and history are
  ready for the bound session.
- [x] Queue terminal automated refresh while readiness is loading and flush it only when the
  session becomes ready.
- [ ] Add retry/backoff policy for transient insights/history startup failures, especially for
  newly created sessions.
- [x] Update `assistant-ui`, `agent-session-detail`, runtime, and Agent Terminal READMEs after
  implementation.
- [ ] Verify with local network traces that opening `/app/main_sequence_ai/chat` does not enable
  interaction before these three requests complete successfully:
  - `GET /orm/api/agents/v1/sessions/{agent_session_id}/`
  - `GET /orm/api/agents/v1/sessions/{agent_session_id}/insights/`
  - `GET /api/chat/history?sessionId=<agent_session_id>`
- [ ] Mark the ADR ready only after chat and terminal both satisfy the readiness gate in local
  testing and the implementation READMEs document the final behavior.

## Rejected Alternative

### Keep current partial rendering and only disable send

Rejected.

Reason:

- the user still sees the selected session mutate from placeholder to real state
- model/session metadata can still appear before the session is actually ready
- terminal refresh and focus behavior can still run against partial state
- it keeps readiness implicit in component-local UI logic instead of making it an AgentSession
  contract
