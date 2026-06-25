# ADR 078: Capability Registry Surface and Agent Capability Editor Widget

- Status: Proposed
- Date: 2026-06-24
- Related:
  - [ADR 076: Agent Detail Capabilities Tab](./adr-076-agent-detail-capabilities-tab.md)
  - [ADR 077: Unified Astro Coding-Agent Bootstrap](./adr-077-unified-astro-coding-agent-bootstrap.md)
  - [ADR 074: UID-Only Main Sequence Backend Identifier Contracts](../main_sequence/adr-074-uid-only-main-sequence-backend-identifier-contracts.md)

## Context

`Main Sequence AI` already has one capability-management entry point:

- the agent-scoped `Capabilities` tab inside `Agent Detail`

That tab is binding-scoped. It answers:

- which capabilities are bound to one agent
- how those bindings are configured
- how a bound capability is edited in the context of one agent

It does not provide a reusable capability-resource registry for:

- listing all prompt and skill resources
- creating a new prompt without starting from one agent
- creating a new skill without starting from one agent
- editing reusable capability content outside the binding flow

The backend resource contract already supports that resource-scoped workflow.

Reusable capabilities live under:

- `GET /orm/api/agents/v1/capabilities/`
- `POST /orm/api/agents/v1/capabilities/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/`
- `PATCH /orm/api/agents/v1/capabilities/{capability_uid}/`
- `DELETE /orm/api/agents/v1/capabilities/{capability_uid}/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`
- `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`

The important backend rule is that capability configuration and capability content are not one
payload.

Configuration is created first:

```http
POST /orm/api/agents/v1/capabilities/
Content-Type: application/json
```

```json
{
  "name": "Rebalance Skill",
  "kind": "skill",
  "capability_path": "skills/trading/rebalance/SKILL.md",
  "description": "Rules and workflow for portfolio rebalance analysis.",
  "metadata": {}
}
```

Or:

```json
{
  "name": "Portfolio Review Prompt",
  "kind": "prompt",
  "capability_path": "prompts/portfolio/review.md",
  "description": "Prompt template for portfolio review sessions.",
  "metadata": {}
}
```

Content is uploaded separately:

```http
PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/
Content-Type: application/json
```

```json
{
  "content": "# Rebalance Skill\n\n...",
  "filename": "SKILL.md",
  "content_mime_type": "text/markdown"
}
```

That split means the frontend cannot model capability authoring as a single markdown textarea or a
single save endpoint. It needs:

1. capability configuration fields
2. capability content fields
3. a two-step save workflow

The existing `AgentCapabilitiesTab.tsx` already contains capability resource and markdown-editing
logic, but it is embedded inside agent binding management and is not shaped as a reusable registry
surface or a reusable editor widget/component.

## Decision

`Main Sequence AI` will add a new top-level surface called `Capabilities` and will introduce a
reusable `Agent Capability Editor` widget/component for authoring prompt and skill resources.

## 1. The new surface is resource-scoped, not binding-scoped

The new surface will manage reusable capability resources directly.

Its source of truth is:

- `GET /orm/api/agents/v1/capabilities/`

The surface will not infer the registry from:

- agent detail bindings
- agent card content
- session history
- capability references embedded in other payloads

The agent-detail `Capabilities` tab remains binding-scoped and continues to answer:

- which capabilities this one agent is bound to
- how those bindings are configured

The new `Capabilities` surface answers:

- which reusable capability resources exist
- how each capability resource is configured
- what markdown content each reusable capability stores

## 2. The new surface will follow the existing list/detail AI pattern

The preferred route is:

- `/app/main_sequence_ai/capabilities`

The detail/editor state should follow the same same-surface list/detail pattern already used by
`Agents`:

- list mode when no capability is selected
- detail/editor mode when a capability UID is selected through URL params

Recommended URL state:

- `msCapabilityUid=<capability_uid>`

Optional editor state can also be encoded in URL params if useful, but the canonical requirement is
that the selected capability UID be URL-addressable.

## 3. The list view will focus on prompts and skills only

This phase supports two visible kinds only:

- `prompt`
- `skill`

The surface will not expose `extension` creation or filtering.

The list view should show, at minimum:

- `name`
- `kind`
- `capability_path`
- `description`
- content state such as `has_content`
- editability such as `is_editable`
- `updated_at`

The header actions must include:

- `Create Skill`
- `Create Prompt`

Those actions open the shared editor with prefilled kind-specific defaults.

## 4. The editor must be a reusable Agent Capability Editor widget/component

Capability authoring must move behind one reusable editor unit called `Agent Capability Editor`.

The first consumers are:

- the new `Main Sequence AI > Capabilities` surface
- the existing `Agent Detail > Capabilities` tab

The editor should reuse the current markdown-authoring conventions from the existing capability tab
and the closest markdown note authoring patterns, but it must add capability-aware configuration.

This editor is not just a generic markdown note.

It must own two separate sections:

### Configuration section

This section edits the capability resource payload:

- `name`
- `kind`
- `capability_path`
- `description`
- `metadata`

The editor should treat `kind` as a first-class configuration choice during creation.

The preferred UX is:

- `kind` selectable during create
- `kind` read-only after the capability resource already exists

That prevents accidental prompt/skill type flipping after content and path conventions have already
been established.

### Content section

This section edits the capability content payload:

- `content`
- `filename`
- `content_mime_type`

`content_mime_type` is not a free-form user field in this phase.

It must be initialized, stored, and submitted as:

- `content_mime_type: "text/markdown"`

for every content write.

The frontend must not leave `content_mime_type` blank, inferred-only, or omitted on content save.

`filename` behavior is kind-specific:

- for `skill`, the filename control is locked and always resolves to `SKILL.md`
- for `prompt`, the filename is derived from the configured prompt path and is still submitted
  explicitly in the content payload

This means the editor owns a content request model, not just a markdown body textarea.

The content section should provide:

- markdown textarea editor
- rendered markdown preview
- explicit empty-content state
- read-only mode when `is_editable=false`

## 5. Save behavior is explicitly two-step

The frontend must not invent a synthetic one-call save contract.

### Create workflow

When the user creates a new capability:

1. `POST /orm/api/agents/v1/capabilities/` creates the capability configuration resource
2. after the new `capability_uid` exists, `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/` uploads markdown content, always including both `filename` and `content_mime_type`

The create buttons should prefill configuration defaults:

### Create Skill

- `kind: "skill"`
- `capability_path` derived from the name and ending in `SKILL.md`
- `filename` field is read-only
- `filename: "SKILL.md"` is always sent in the content write payload
- `content_mime_type: "text/markdown"` is always sent in the content write payload

### Create Prompt

- `kind: "prompt"`
- `capability_path` derived from the name and using a markdown filename
- `filename` defaults to the last path segment from `capability_path`
- `filename` is still sent explicitly in the content write payload
- `content_mime_type: "text/markdown"` is always sent in the content write payload

If step 1 succeeds and step 2 fails:

- the capability resource remains created
- the UI must keep the new capability selected
- the UI must surface that configuration saved but content upload failed
- retry must target `PUT /content/` only

The frontend must not try to roll back the created capability automatically.

### Edit workflow

When the user edits an existing capability:

- `PATCH /orm/api/agents/v1/capabilities/{capability_uid}/` saves configuration changes
- `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/` saves markdown content changes

Every content save request must submit:

- `content`
- `filename`
- `content_mime_type: "text/markdown"`

For `skill`, that means the request must always include:

```json
{
  "content": "# Rebalance Skill\n\n...",
  "filename": "SKILL.md",
  "content_mime_type": "text/markdown"
}
```

The skill filename must not become user-editable or drift from `SKILL.md`.

If only configuration changed:

- call `PATCH`

If only content changed:

- call `PUT /content/`

If both changed:

1. call `PATCH`
2. then call `PUT /content/`

## 6. Existing capability APIs and authoring logic should be reused, not duplicated

The existing shared capability API module is already the correct transport layer:

- `extensions/main_sequence_ai/features/agent-capabilities/api.ts`

The new surface should reuse and extend that module instead of introducing a second capability
client.

The existing `AgentCapabilitiesTab.tsx` should be refactored so the reusable parts move into
shared capability-resource components:

- registry/list logic
- capability detail load logic
- content load logic
- create/update mutations
- markdown editor/prefill logic

The agent-detail tab should then consume the same editor widget/component, while keeping its
binding-specific actions local:

- bind
- unbind
- binding configuration

## 7. The surface should use one capability detail workflow

Opening a capability in the new surface should load:

- `GET /orm/api/agents/v1/capabilities/{capability_uid}/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`

The detail/editor page should not assume the list payload is sufficient for the full authoring
state.

The list payload is the registry summary.
The detail and content endpoints are the authoritative editor state.

## 8. The widget/component state model must keep configuration and content separate

The `Agent Capability Editor` state should be modeled as two independent dirty domains:

### Resource configuration state

- `name`
- `kind`
- `capability_path`
- `description`
- `metadata`

### Content state

- `content`
- `filename`
- `content_mime_type`

`content_mime_type` is fixed-value state, not a user-authored variable. It remains part of the
request model because the frontend must still submit it explicitly on every content write.

For `skill`, `filename` is also constrained state:

- fixed to `SKILL.md`
- displayed as locked/read-only
- still included explicitly in the content request payload

That split matters for:

- dirty state display
- save ordering
- partial retries
- read-only handling
- future autosave decisions

The UI must not treat `metadata` and markdown `content` as one blob.

## 9. This does not replace the agent-detail capabilities tab

The new `Capabilities` surface is not a replacement for:

- agent capability bindings
- binding enable/disable state
- per-agent capability ordering
- per-agent capability configuration

Those stay in `Agent Detail > Capabilities`.

The new surface becomes the resource registry and authoring home for reusable prompts and skills.

## 10. Storage and backend contract impact

This ADR does not require a backend contract change.

It uses the existing backend capability-resource and capability-content endpoints exactly as they
already exist.

The frontend contract change is architectural:

- a new top-level AI surface is added
- a reusable capability editor widget/component is introduced
- existing agent-detail capability authoring is refactored to reuse the same editor

If the editor is implemented as a formal Command Center widget definition, that widget must include:

- `README.md`
- `USAGE_GUIDANCE.md`
- `definition.ts`
- representative `mockProps` or `exampleProps`

If the first implementation keeps it as a shared feature-level authoring widget/component inside
`Main Sequence AI`, no workspace storage contract changes are required in this phase.

## Implementation Plan

1. Add a new `Capabilities` surface to `Main Sequence AI` using the same list/detail URL pattern as
   the existing `Agents` surface.
2. Reuse `features/agent-capabilities/api.ts` as the only capability transport layer.
3. Extract a reusable `Agent Capability Editor` widget/component from the current
   `AgentCapabilitiesTab.tsx` authoring flow.
4. Split the editor into two sections:
   - configuration
   - content
5. Add resource-registry list actions:
   - `Create Skill`
   - `Create Prompt`
6. Implement create flow as:
   - `POST /orm/api/agents/v1/capabilities/`
   - `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`
7. Implement edit flow as:
   - `PATCH /orm/api/agents/v1/capabilities/{capability_uid}/`
   - `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`
8. Refactor the existing agent-detail capabilities tab to reuse the same editor while preserving
   bind/unbind and binding-local controls.
9. Keep prompt and skill as the only visible create kinds in this phase.
10. Add tests for:
    - resource list load
    - create skill flow
    - create prompt flow
    - detail/content load
    - partial failure when content upload fails after resource create
    - edit flow with configuration-only, content-only, and combined saves

## Consequences

### Positive

- reusable capabilities become first-class resources in `Main Sequence AI`
- prompt and skill creation no longer depend on opening one agent first
- the authoring workflow matches the backend contract instead of hiding it
- one shared editor widget/component reduces drift between the registry view and agent-detail tab
- markdown authoring stays compatible with the existing capability content model

### Negative

- create and edit flows are more complex because save is intentionally split
- partial-success handling is required when configuration saves but content upload fails
- the existing agent-detail tab will need refactoring before the new surface and old surface feel
  consistent

## Explicit Non-Goals

- exposing `extension` authoring in this phase
- replacing agent capability bindings with resource-level editing
- inventing a synthetic combined save endpoint
- requiring workspace persistence or dashboard-canvas integration for the first release
