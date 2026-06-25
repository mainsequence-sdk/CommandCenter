# Task 001: Capability Registry Surface and Shared Editor

## Goal

Implement ADR 078 by adding a top-level reusable capability registry surface and extracting a
shared capability editor that both the registry surface and the agent-detail capabilities tab use.

## Scope

- Add `Main Sequence AI > Capabilities` as a resource-scoped prompt/skill registry.
- Keep agent detail capabilities binding-scoped.
- Split capability authoring into:
  - resource configuration
  - markdown content
- Preserve the backend two-step contract:
  - `POST /orm/api/agents/v1/capabilities/`
  - `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`

## Backend Endpoints

- `GET /orm/api/agents/v1/capabilities/`
- `POST /orm/api/agents/v1/capabilities/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/`
- `PATCH /orm/api/agents/v1/capabilities/{capability_uid}/`
- `DELETE /orm/api/agents/v1/capabilities/{capability_uid}/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`
- `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`
- `GET /orm/api/agents/v1/agents/{agent_uid}/capabilities/`
- `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/bind/`
- `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/unbind/`

## Implementation Steps

1. Add the new `Capabilities` surface to `Main Sequence AI`.
2. Extract a shared `AgentCapabilityEditor` component.
3. Add a shared capability editor draft model that keeps resource and content state separate.
4. Normalize save orchestration behind shared helpers for:
   - create resource then upload content
   - patch resource only
   - upload content only
   - patch resource then upload content
5. Refactor the agent-detail capabilities tab to reuse the shared editor while keeping binding
   actions local.
6. Support partial-save recovery when resource save succeeds but content upload fails.
7. Add focused tests for API normalization, draft normalization, and split save orchestration.

## Acceptance Criteria

- `Main Sequence AI` exposes a `Capabilities` surface for reusable `prompt` and `skill` resources.
- The registry surface supports `Create Skill` and `Create Prompt`.
- The editor always submits `content_mime_type: "text/markdown"` on content writes.
- `skill` content always submits `filename: "SKILL.md"`.
- Prompt filenames derive from `capability_path` and are still submitted explicitly.
- Opening capability detail loads both:
  - `GET /orm/api/agents/v1/capabilities/{capability_uid}/`
  - `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`
- The agent-detail capabilities tab uses the same shared editor for reusable capability authoring.
