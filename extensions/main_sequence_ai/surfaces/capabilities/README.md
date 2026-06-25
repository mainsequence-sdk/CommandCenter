# Main Sequence AI Capabilities Surface

## Purpose

This directory owns the resource-scoped `Capabilities` surface for the `Main Sequence AI` app.

It is the reusable prompt/skill registry home defined by ADR 078. Unlike the agent-detail
capabilities tab, this surface manages capability resources directly rather than agent bindings.

## Entry Points

- `CapabilitiesPage.tsx`
  URL-driven list/detail surface for reusable prompt and skill resources. List mode reads
  `GET /orm/api/agents/v1/capabilities/`, while detail mode loads both
  `GET /orm/api/agents/v1/capabilities/{capability_uid}/` and
  `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`. Create mode uses
  `msCapabilityCreateKind` until a capability UID exists.

## Maintenance Notes

- Keep this surface resource-scoped. Agent binding actions such as bind and unbind stay on
  `Agent Detail > Capabilities`.
- Keep capability resource writes separate from capability content writes. Create uses
  `POST /capabilities/` followed by `PUT /capabilities/{uid}/content/`, while edits use `PATCH`
  plus `PUT /content/` only for changed domains.
- Keep visible kinds limited to `prompt` and `skill` in this phase.
- Keep editor state URL-addressable through `msCapabilityUid` for existing resources.
