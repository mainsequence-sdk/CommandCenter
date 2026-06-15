# ADR 076: Agent Detail Capabilities Tab

- Status: Proposed
- Date: 2026-06-14
- Related:
  - [ADR 060: Main Sequence AI Session-Backed Chat Request Contract](./adr-060-session-backed-chat-request-contract.md)
  - [ADR 062: Remove Unused Agent Capability and Session Resource Models](./adr-062-remove-unused-agent-resource-models.md)
  - [ADR 063: Project Agent Configuration Source of Truth](./adr-063-project-agent-configuration-source-of-truth.md)
  - [ADR 074: UID-Only Main Sequence Backend Identifier Contracts](../main_sequence/adr-074-uid-only-main-sequence-backend-identifier-contracts.md)

## Context

The `Main Sequence AI` agent detail surface currently exposes three tabs:

- `Overview`
- `Agent Card`
- `Sessions`

It does not expose the agent's reusable capabilities as first-class resources.

The backend now separates:

1. reusable capability resources
2. agent/session bindings to those capabilities

That split changes how the frontend must model authoring.

### Capability resources

Reusable capabilities live under:

- `GET /orm/api/agents/v1/capabilities/`
- `POST /orm/api/agents/v1/capabilities/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/`
- `PATCH /orm/api/agents/v1/capabilities/{capability_uid}/`
- `DELETE /orm/api/agents/v1/capabilities/{capability_uid}/`
- `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`
- `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`

The reusable resource owns:

- `name`
- `kind`
- `description`
- `source_type`
- `source_ref`
- `capability_path`
- `metadata`
- content metadata such as `has_content`, `content_sha256`, `content_mime_type`, and `content_size`
- editability through `is_editable`

Allowed frontend kinds for now are:

- `skill`
- `prompt`

The backend enum contains `extension`, but that kind is currently rejected and must not be exposed
as a selectable authoring choice.

### Agent bindings

An agent owns bindings, not the underlying capability resource itself:

- `GET /orm/api/agents/v1/agents/{agent_uid}/capabilities/`
- `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/bind/`
- `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/unbind/`

The binding owns:

- `role`
- `sort_order`
- `is_enabled`
- `is_locked`
- `configuration`
- binding-local `source_type`
- binding-local `source_ref`

This means the agent detail UI cannot treat a bound capability as a single flat document. It must
respect the resource/binding split.

### Why a dedicated tab is needed

The agent detail screen is now the natural place to inspect and manage capabilities because it
already owns:

- canonical agent summary state
- agent-card inspection
- session history
- project-executor configuration actions

Adding capability management to some other surface would fragment agent authoring and make the new
binding model harder to understand.

### Why markdown authoring matters

Skills and prompts are content-first assets. A plain form-only editor is insufficient because the
user needs to author and review markdown in place.

The backend also makes content updates explicit:

- capability create/update payloads do **not** carry `content_file`
- content updates happen through `/content/`
- `is_editable=false` capabilities must be treated as read-only

The frontend therefore needs a markdown authoring surface that understands:

- resource metadata
- binding metadata
- editable vs read-only content
- live markdown preview

### AgentSession contract changes in the same implementation window

This implementation window also touches adjacent `Agent` and `AgentSession` UX that depends on the
same agent-detail surface.

The backend `AgentSessionSerializer` now exposes one canonical bound handle instead of a plural
handle list:

```json
{
  "uid": "session-uid",
  "agent_uid": "agent-uid",
  "agent_name": "Agent name",
  "agent_type": "custom",
  "created_by_user_uid": "user-uid",
  "parent_session_uid": null,
  "name": "Quarterly portfolio review",
  "status": "running",
  "runtime_state": "working",
  "working": true,
  "started_at": "2026-06-14T10:00:00Z",
  "ended_at": null,
  "llm_provider": "openai",
  "llm_model": "gpt-5.4",
  "llm_thinking": "",
  "engine_name": "mainsequence-agent-runtime",
  "runtime_config_snapshot": {},
  "error_detail": "",
  "thread_id": "",
  "session_metadata": {},
  "bound_handle": {
    "uid": "handle-uid",
    "handle_unique_id": "portfolio-review-q2-2026",
    "owner_user_uid": "user-uid",
    "is_locked": false
  }
}
```

That contract creates two immediate frontend requirements:

1. the `Sessions` list inside `Agent Detail` must always surface the bound handle when the
   serializer provides it
2. the dedicated `AgentSession` detail surface must stop using its current bespoke layout and move
   to the same summary-plus-tabs detail pattern used elsewhere in Main Sequence

Those changes belong in this ADR because the `Capabilities` tab increases how often users move
between:

- the agent detail surface
- agent-bound sessions
- capability and prompt authoring

If session handle visibility and session detail structure remain inconsistent, the agent authoring
flow will still feel fragmented even after the capabilities tab exists.

## Decision

The `Agent Detail` surface will add a fourth tab called `Capabilities`.

## 1. The tab is agent-binding scoped

The tab will treat:

- `GET /orm/api/agents/v1/agents/{agent_uid}/capabilities/`

as the source of truth for what the current agent can use.

The screen will not infer capability membership from:

- `agent_card`
- search results
- session history
- capability registry contents alone

Those sources may describe or suggest capabilities, but the binding list is authoritative for the
agent detail tab.

## 2. The tab will show prompts and skills only

The visible kinds for this phase are:

- `prompt`
- `skill`

The UI will not offer `extension` creation or filtering.

The tab will provide:

- an `All` view
- a `Prompts` view
- a `Skills` view

This is a presentation filter over one bound-capability dataset, not three separate backend
queries.

## 3. The UI will preserve the capability resource / binding split

The tab will expose two layers of information:

### Resource layer

Shown from the nested `capability` object and capability detail/content endpoints:

- `name`
- `kind`
- `description`
- `source_type`
- `source_ref`
- `capability_path`
- `metadata`
- `is_editable`
- content metadata
- markdown content

### Binding layer

Shown from the agent binding itself:

- `role`
- `sort_order`
- `is_enabled`
- `is_locked`
- `configuration`
- binding-local `source_type`
- binding-local `source_ref`

The frontend must not flatten those fields into one PATCH payload because the backend does not
model them that way.

## 4. The tab will use lazy content loading

The bindings list endpoint is sufficient for the overview table, but markdown content must be
loaded lazily.

When the user opens a capability editor or detail pane, the frontend will fetch:

- `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`

This avoids loading full markdown bodies for every bound capability during the initial agent-detail
hydration.

## 5. The editor will be a live markdown editor

Editing prompts and skills will use a split authoring experience:

- left: editable markdown source
- right: live rendered markdown preview

Implementation should reuse existing repository primitives where possible:

- `@uiw/react-codemirror` for source editing
- `MarkdownContent` for preview rendering

The editor is not a rich-text surface. The saved source of truth remains markdown text.

## 6. Content editing uses the dedicated content endpoint only

Capability metadata and capability content are separate save paths.

### Metadata save

Use:

- `POST /orm/api/agents/v1/capabilities/` for new reusable capabilities
- `PATCH /orm/api/agents/v1/capabilities/{capability_uid}/` for resource metadata updates

### Content save

Use:

- `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`

with JSON such as:

```json
{
  "content": "# Markdown skill\n",
  "filename": "rebalance.md",
  "content_mime_type": "text/markdown"
}
```

The normal metadata create/update payloads must not send `content_file`.

If `is_editable=false`, the editor becomes read-only and the content save action stays disabled.

## 7. Add flow supports both create-and-bind and bind-existing

The `Capabilities` tab will expose an `Add capability` action with two supported paths:

1. create a new reusable capability and bind it to this agent
2. bind an existing reusable capability to this agent

### Create-and-bind

The save flow is:

1. `POST /orm/api/agents/v1/capabilities/`
2. optionally `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`
3. `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/bind/`

### Bind-existing

The flow is:

1. pick an existing capability from the reusable capability registry
2. `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/bind/`

The underlying capability resource is shared. Binding an existing capability must not imply that
the agent owns exclusive edit or delete rights to the resource.

## 8. Unbind is separate from delete

The first implementation will support unbinding from the current agent:

- `POST /orm/api/agents/v1/agents/{agent_uid}/capabilities/unbind/`

It will not delete the underlying reusable capability resource from the agent-detail tab by
default.

Deleting a reusable capability can affect other agents or sessions. That needs a separate decision
with explicit cross-agent impact handling.

## 9. Session capability bindings are out of scope for this tab

The backend also supports:

- `GET /orm/api/agents/v1/sessions/{session_uid}/capabilities/`
- session bind/unbind

This ADR does not introduce session-capability authoring into the agent detail surface.

Agent-bound and session-bound capabilities have different semantics:

- agent-bound capabilities affect normal agent discovery/search
- session-bound capabilities do not

Mixing them into the same first implementation would make the UI ambiguous.

Session capability management can be added later on `AgentSession` detail if needed.

## 10. Agent-detail session lists must always show the bound handle

The `Sessions` tab inside `Agent Detail` consumes `AgentSessionSerializer` rows and must surface
handle information as first-class row metadata.

When `bound_handle` is present, the session list must display:

- `bound_handle.handle_unique_id` as the primary handle label
- `bound_handle.uid` as secondary detail where space allows

Handle presence must not be hidden behind raw JSON or a secondary drilldown. It belongs directly in
the session list because handle identity is part of how users distinguish long-lived sessions.

## 11. AgentSession detail will use the standard summary and tabs pattern

The dedicated `AgentSession` detail screen must follow the same detail conventions used across the
rest of the application:

- summary header first
- tabs for major information groups
- consistent detail sections beneath the active tab

It should stop reading like a one-off debug page.

This ADR does not freeze the final tab names, but the layout direction is fixed:

- one canonical summary area
- one canonical tab strip
- one consistent detail-body pattern

The goal is that agent detail and session detail feel like neighboring entity screens, not separate
products.

## 12. AgentSession handle normalization will use `bound_handle` as the canonical field

For `AgentSessionSerializer`-backed screens, the frontend will normalize handles from the singular
`bound_handle` object.

The normalized shape should preserve at least:

- handle UID
- `handle_unique_id`
- `owner_user_uid`
- `is_locked`

The following surfaces must read that canonical contract consistently:

- the `Sessions` tab inside `Agent Detail`
- the standalone `AgentSession` detail page
- shared session catalogs and pickers that consume `AgentSessionSerializer` rows

For this serializer contract, the frontend must stop depending on plural `bound_handles` array
semantics.

## Scope

This ADR covers:

- the new `Capabilities` tab inside `AgentDetailView`
- prompt and skill display for agent-bound capabilities
- reusable capability resource vs binding separation
- live markdown authoring for capability content
- add, bind, edit-content, edit-metadata, and unbind flows
- handle visibility in the `Agent Detail` sessions list
- `AgentSessionSerializer` normalization for singular `bound_handle`
- `AgentSession` detail layout alignment with the standard summary/tabs/detail pattern

This ADR does not cover:

- session-bound capability authoring UI
- reusable capability deletion semantics across agents
- `extension` capability kind
- non-markdown binary file authoring
- capability search/discovery ranking outside this tab
- backend changes to handle lifecycle semantics beyond the published serializer fields

## Implementation Direction

### UI shape

1. Add a `Capabilities` tab to `extensions/main_sequence_ai/surfaces/agents/AgentDetailView.tsx`.
2. Load agent bindings from `GET /orm/api/agents/v1/agents/{agent_uid}/capabilities/`.
3. Render one list with client-side kind filters:
   - `All`
   - `Prompts`
   - `Skills`
4. Show binding metadata and nested capability metadata in distinct columns/sections.
5. Open capability detail/editing in a dedicated panel or dialog instead of overloading the
   existing `Agent Card` view.
6. Update the `Sessions` tab inside `Agent Detail` so each session row always surfaces the
   normalized bound handle when the serializer provides one.

### API clients

7. Add shared clients for:
   - capability list/detail/content
   - agent capability bindings
   - bind/unbind
8. Keep all lookup paths UID-only.
9. Treat bind as the only write path for binding-level fields.
10. Refetch bindings after every bind, unbind, sync, or capability metadata/content save.
11. Normalize `AgentSessionSerializer.bound_handle` in the shared session-model layer and stop
    depending on plural `bound_handles` for serializer-backed session screens.

### Editing workflow

12. For editable capabilities, load content lazily from `/content/`.
13. Build a split markdown editor using existing `CodeMirror` and `MarkdownContent` primitives.
14. Save resource metadata through `POST`/`PATCH`.
15. Save markdown source through `PUT /content/`.
16. Disable content save when `is_editable=false`.

### Add flow

17. Add an `Add capability` dialog with:
   - `Create new`
   - `Bind existing`
18. Restrict new capability kind selection to:
   - `prompt`
   - `skill`
19. Support inline markdown authoring during create-new.
20. Bind the new or selected reusable capability to the current agent after the resource step.

### AgentSession detail alignment

21. Refactor the standalone `AgentSession` detail surface to use the standard summary-plus-tabs
    layout pattern already used by agent, project, and other Main Sequence entity screens.
22. Move handle presentation out of raw-json-only sections and into the summary/detail flow.
23. Ensure the dedicated session page and any shared detail sections read handle data from the
    normalized singular `bound_handle` contract.

### Tests and docs

24. Add focused tests for:
   - capability binding normalization
   - content endpoint save sequencing
   - readonly capability behavior
   - `bound_handle` normalization for session rows and detail payloads
   - agent-detail session-row rendering with handle metadata
25. After implementation, update:
   - `extensions/main_sequence_ai/surfaces/agents/README.md`
   - `extensions/main_sequence_ai/surfaces/session/README.md`
   - `extensions/main_sequence_ai/agent-session-detail/README.md`
   - any new feature-directory README created for capability clients/components

## Implementation Tasks

- [ ] Add a `Capabilities` tab to `extensions/main_sequence_ai/surfaces/agents/AgentDetailView.tsx`.
- [ ] Add shared API clients for reusable capability list/detail/content operations.
- [ ] Add shared API clients for agent capability bindings, bind, and unbind.
- [ ] Keep all new capability and binding lookups UID-only.
- [ ] Load `GET /orm/api/agents/v1/agents/{agent_uid}/capabilities/` as the canonical dataset for
  the tab.
- [ ] Render one bound-capabilities list with client-side filters for `All`, `Prompts`, and
  `Skills`.
- [ ] Separate binding metadata from reusable capability metadata in the UI.
- [ ] Build a capability detail/editor surface as a dedicated panel or dialog instead of reusing
  the `Agent Card` tab.
- [ ] Load capability markdown lazily from
  `GET /orm/api/agents/v1/capabilities/{capability_uid}/content/`.
- [ ] Build a live markdown editor with source editing on one side and rendered markdown preview on
  the other.
- [ ] Reuse existing repository primitives for authoring and preview:
  - `@uiw/react-codemirror`
  - `MarkdownContent`
- [ ] Save reusable capability metadata through `POST /orm/api/agents/v1/capabilities/` and
  `PATCH /orm/api/agents/v1/capabilities/{capability_uid}/`.
- [ ] Save markdown source only through
  `PUT /orm/api/agents/v1/capabilities/{capability_uid}/content/`.
- [ ] Keep `content_file` out of normal metadata create/update payloads.
- [ ] Enforce `is_editable=false` as a read-only content state in the editor.
- [ ] Add an `Add capability` flow with two modes:
  - `Create new`
  - `Bind existing`
- [ ] Restrict new capability creation kinds to `prompt` and `skill`.
- [ ] Support inline markdown authoring during create-new.
- [ ] Bind newly created capabilities to the current agent after the resource step completes.
- [ ] Support binding an existing reusable capability to the current agent.
- [ ] Support unbinding from the current agent without deleting the underlying reusable capability.
- [ ] Normalize `AgentSessionSerializer.bound_handle` as the canonical handle contract for
  serializer-backed session screens.
- [ ] Update the `Sessions` tab inside `Agent Detail` so each session row always shows the bound
  handle when present.
- [ ] Surface `bound_handle.handle_unique_id` as the primary handle label in agent-detail session
  rows.
- [ ] Surface `bound_handle.uid` as secondary handle detail where the row layout allows it.
- [ ] Refactor the standalone `AgentSession` detail page to the standard summary-plus-tabs detail
  layout.
- [ ] Move handle presentation in `AgentSession` detail out of raw JSON sections and into the
  summary/detail flow.
- [ ] Ensure shared session pickers/catalogs that consume `AgentSessionSerializer` rows also read
  the singular `bound_handle` contract.
- [ ] Add focused tests for capability binding normalization and capability content save
  sequencing.
- [ ] Add focused tests for readonly capability behavior.
- [ ] Add focused tests for `bound_handle` normalization in shared session models.
- [ ] Add focused tests for agent-detail session-row rendering with handle metadata.
- [ ] Update `extensions/main_sequence_ai/surfaces/agents/README.md` after implementation.
- [ ] Update `extensions/main_sequence_ai/surfaces/session/README.md` after implementation.
- [ ] Update `extensions/main_sequence_ai/agent-session-detail/README.md` after implementation.
- [ ] Add README coverage for any new capability-specific feature directory introduced by the
  implementation.

## Consequences

### Positive

- agent capability authoring becomes visible at the point where users already inspect the agent
- the UI matches the backend capability/binding model instead of flattening it
- prompts and skills become editable without abusing the agent-card payload
- markdown content stays first-class and previewable
- session handles become visible and consistent anywhere `AgentSessionSerializer` is rendered
- agent detail and session detail become structurally aligned, making the authoring flow easier to
  scan

### Negative

- the tab introduces another set of agent-detail queries and mutations
- the UI must manage two write surfaces for one conceptual item:
  - resource metadata
  - markdown content
- reusing existing capabilities introduces shared-ownership considerations
- binding updates depend on backend bind semantics staying stable
- the session-detail surface refactor adds UI churn beyond the narrow capabilities tab itself

## Required Fixes

- The agent detail surface must stop treating capabilities as implicit agent-card data.
- The agent detail surface must expose agent-bound capabilities through the canonical bindings
  endpoint.
- The frontend must separate reusable capability metadata writes from markdown content writes.
- The frontend must not surface `extension` as a selectable capability kind in this phase.
- The frontend must keep reusable capability deletion out of the first agent-detail tab
  implementation.
- The `Sessions` tab inside `Agent Detail` must always display the session handle when
  `bound_handle` is present.
- Shared session normalization must read the singular `bound_handle` contract for
  `AgentSessionSerializer`-backed screens.
- The standalone `AgentSession` detail surface must be refactored to the standard
  summary-plus-tabs entity-detail style.
