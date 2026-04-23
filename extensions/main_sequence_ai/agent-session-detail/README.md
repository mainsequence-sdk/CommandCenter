# Main Sequence AI AgentSession Detail

This module owns the shared AgentSession detail capability for the `Main Sequence AI` extension.

## Entry Points

- `model.ts`
  Canonical normalized AgentSession detail types plus shared helpers for session ids, request names,
  context snapshots, and summary composition.
- `useAgentSessionDetail.ts`
  Shared keyed controller hook that loads the core ORM AgentSession detail and composes optional
  `insights` and `tools` facets for one selected session.
- `AgentSessionDetailSections.tsx`
  Reusable presentational sections for rendering the normalized AgentSession core detail, including
  raw payload viewers for large JSON fields.
- `AgentSessionInsightsSections.tsx`
  Shared read-only rendering for the backend insights payload, including model, usage, context,
  and last-turn sections.
- `AgentSessionModelEditor.tsx`
  Standalone provider/model selector that uses the same available-models and session PATCH
  contracts as chat without depending on `ChatProvider`.
- `routes.ts`
  Route helpers for the dedicated AgentSession page surface.

## Transport Boundaries

- Core detail:
  `GET /orm/api/agents/v1/sessions/{agent_session_id}/`
- Insights:
  `GET /orm/api/agents/v1/sessions/{agent_session_id}/insights/`
- Tools:
  `GET /api/chat/session-tools?sessionId=<runtime session id>`

This module composes those contracts into one shared detail snapshot, but it does not collapse the
transport boundaries into one fake endpoint.

## Behavior Notes

- `404` from the core detail endpoint is a first-class `not_found` state.
- When core detail is `not_found`, dependent `insights` and `tools` facets are cleared and must not
  continue loading for that session.
- The dedicated page surface lives at `/app/main_sequence_ai/session?session=<id>` and should be
  the primary deep-link target for widgets and chat rails that need a full session shell.
- The normalized detail snapshot includes both backend-owned ORM detail and frontend/runtime
  context derived from the current selected session, such as `runtimeSessionId`, `threadId`,
  `sessionKey`, `projectId`, and `cwd`.
- Provider-derived extras do not belong on the core AgentSession detail record. Fields like
  usage/context summaries come from `insights`, not from the ORM detail contract.
- Large JSON fields such as `metadata`, `runtimeConfigOverride`, `runtimeConfigSnapshot`,
  `inputPayload`, and `outputPayload` are intended for collapsed viewers or dialogs, not always-on
  rail content.

## Maintenance Notes

- Keep this module independent from chat-surface presentation ownership. Chat is one consumer.
- The standalone session page in `surfaces/session/` should consume these shared components instead
  of re-embedding session-detail UI back into chat-owned files.
- Reuse the shared controller from other Main Sequence AI surfaces instead of reimplementing
  session-detail fetch state in each surface.
- If the backend detail serializer changes, update `model.ts` first so every consumer stays
  aligned.
