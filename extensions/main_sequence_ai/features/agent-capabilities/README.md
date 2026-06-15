# Agent Capabilities

## Purpose

This feature owns the reusable capability and agent-binding UI used by the `Main Sequence AI`
agent detail surface.

It implements the backend split between:

- reusable capability resources
- agent-specific capability bindings

## Entry Points

- `api.ts`
  Shared transport, normalization, and mutation helpers for reusable capability resources,
  capability content, and agent capability bindings.
- `AgentCapabilitiesTab.tsx`
  Agent-detail tab content for listing, filtering, syncing, binding, creating, unbinding, and
  editing prompt/skill capabilities with a live markdown authoring flow.

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
- The first phase intentionally supports `prompt` and `skill` only. Do not expose `extension`
  authoring until the backend accepts it.
