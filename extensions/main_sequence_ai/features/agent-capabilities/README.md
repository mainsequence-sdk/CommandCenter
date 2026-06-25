# Agent Capabilities

## Purpose

This feature owns the reusable capability authoring/editor layer and the agent-binding UI used by
the `Main Sequence AI` capability surfaces.

It implements the backend split between:

- reusable capability resources
- agent-specific capability bindings

## Entry Points

- `api.ts`
  Shared transport, normalization, and mutation helpers for reusable capability resources,
  capability content, and agent capability bindings.
- `model.ts`
  Shared capability-editor draft model, path/filename derivation, dirty-domain comparison, and
  request-payload builders. This is the source of truth for prompt/skill authoring rules such as
  fixed `SKILL.md` filenames and explicit `text/markdown` content writes.
- `save.ts`
  Shared create/edit save orchestration for capability resources and content, including partial
  success handling when resource save succeeds before content upload fails.
- `AgentCapabilityEditor.tsx`
  Reusable editor component used by both the top-level Capabilities surface and the agent-detail
  capabilities tab. It keeps configuration and content sections separate while sharing markdown
  preview and read-only behavior.
- `AgentCapabilitiesTab.tsx`
  Agent-detail tab content for listing bound capabilities, binding existing reusable capabilities,
  unbinding them, and opening the shared capability editor for resource authoring.

## Backend Contracts

- `GET /orm/api/agents/v1/capabilities/`
- `POST /orm/api/agents/v1/capabilities/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/`
- `PATCH /orm/api/agents/v1/capabilities/{capability_uid}/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`
- `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`
- `GET /orm/api/agents/v1/agents/{agent_uid}/capabilities/`
- `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/bind/`
- `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/unbind/`

## Maintenance Notes

- Keep all capability and binding identifiers UID-only.
- Keep capability resource writes separate from capability content writes. Do not collapse them into
  a synthetic one-endpoint save contract.
- Keep content writes explicit. Every markdown content save must submit `filename` plus
  `content_mime_type: "text/markdown"`.
- Keep `skill` filename handling locked to `SKILL.md`; do not add an editable skill filename field.
- The first phase intentionally supports `prompt` and `skill` only. Do not expose `extension`
  authoring until the backend accepts it.
