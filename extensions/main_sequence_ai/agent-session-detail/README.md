# Main Sequence AI AgentSession Detail

This module owns the shared AgentSession detail capability for the `Main Sequence AI` extension.

## Entry Points

- `model.ts`
  Canonical normalized AgentSession detail types plus shared helpers for session ids, request names,
  context snapshots, and summary composition.
- `useAgentSessionDetail.ts`
  Shared keyed controller hook that loads the core ORM AgentSession detail and composes the
  optional `insights` facet for one selected session.
- `../runtime/agent-session-readiness.ts`
  Shared interaction-readiness model used by chat and terminal surfaces when detail, insights, and
  history must all complete before user input is allowed.
- `AgentSessionDetailSections.tsx`
  Reusable presentational sections for rendering the normalized AgentSession core detail, including
  raw payload viewers for large JSON fields. The shared renderer now expects the canonical singular
  `bound_handle` serializer contract and presents the session in the same summary-plus-tabs detail
  style used elsewhere in Main Sequence.
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
  `GET /orm/api/agents/v1/sessions/{session_uid}/`
- Insights:
  `GET /orm/api/agents/v1/sessions/{session_uid}/insights/`

This module composes those contracts into one shared detail snapshot, but it does not collapse the
transport boundaries into one fake endpoint.

## Behavior Notes

- `404` from the core detail endpoint is a first-class `not_found` state.
- When core detail is `not_found`, dependent `insights` facets are cleared and must not continue
  loading for that session.
- The dedicated page surface lives at `/app/main_sequence_ai/session?session=<id>` and should be
  the primary deep-link target for widgets and chat rails that need a full session shell.
- The normalized detail snapshot includes both backend-owned ORM detail and frontend/runtime
  context derived from the current selected session, such as `runtimeSessionId`, `threadId`,
  `sessionKey`, `projectId`, and `cwd`.
- The shared detail snapshot also preserves the raw backend session serializer payload so chat and
  terminal surfaces can inject the canonical session object into live runtime requests without
  reconstructing it client-side.
- Provider-derived extras do not belong on the core AgentSession detail record. Fields like
  usage/context summaries come from `insights`, not from the ORM detail contract.
- Interactive chat and terminal surfaces must not treat this detail snapshot alone as readiness.
  The shared readiness contract also requires session insights and session history for the same
  AgentSession id. That gate applies to the first successful insights load; once insights already
  exist, later refreshes should update in place instead of downgrading the session back to a full
  loading shell.
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
- Keep session handle normalization centered on the singular `bound_handle` contract. The
  agent-detail sessions list and the standalone session page should reflect the same handle value.
