# ADR: Organization-Scoped Widget Type Configurations

- Status: Accepted
- Date: 2026-04-15
- Related:
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)
  - [ADR: Headless Workspace Widget Settings Runtime](./adr-headless-workspace-settings-runtime.md)
  - [ADR: Incremental Workspace Normalization and Resource-Scoped Save](./adr-incremental-workspace-normalization.md)

## Context

Some widget behaviors need organization-scoped defaults or guardrails that should not be baked into
every saved widget instance.

Examples include:

- presentation defaults for one widget type inside one organization
- default filters or preselected source context for one widget type inside one organization
- capability ceilings or trusted-mode toggles for widgets that can render richer external payloads
- widget-specific runtime configuration that is not part of the global widget type registry and not
  appropriate as per-instance user-authored content

The existing backend widget models already separate concerns reasonably well:

- `RegisteredWidgetType` is the global catalog contract for one widget type
- `SavedWidgetInstance` is a saved instance snapshot
- `SavedWidgetGroup` is a reusable bundle of saved widget instances

What was missing was an organization-scoped overlay for widget types.

That overlay must be:

- optional, because not every widget type needs organization-level configuration
- widget-type-specific, because configuration semantics differ materially across widgets
- sparse, because most organizations will not override most widget types
- backend-visible, because it changes persisted configuration semantics and must survive across
  users, sessions, and clients

It must not force every widget type into one generic shared policy shape that pretends all widgets
share the same organization-level configuration model.

## Decision

We will introduce an optional organization-scoped configuration layer per registered widget type.

The model is conceptually:

- one `RegisteredWidgetType` may optionally declare support for organization configuration
- the widget type publishes:
  - an optional organization-configuration schema
  - an optional default organization configuration
  - an organization-configuration version
- an organization may store an override row for that widget type
- widgets without declared organization-configuration support have no override row and no special
  runtime behavior

This is an additive extension to widget types, not a requirement for all widgets.

Current state:

- no widget currently uses this capability
- this ADR defines the general contract so later widgets can opt in cleanly

## Widget Capability

Organization-scoped widget type configuration is itself a widget capability.

That capability is optional and must be declared by the widget type rather than assumed by the
platform.

### Capability contract

A widget type supports this capability only when it publishes organization-configuration metadata on
its `RegisteredWidgetType` row.

The capability is declared through:

- `organization_configuration_schema_json`
- `default_organization_configuration_json`
- `organization_configuration_version`

Interpretation:

- `organization_configuration_schema_json = null`
  - widget does not support organization-scoped configuration
- `organization_configuration_schema_json != null`
  - widget supports organization-scoped configuration
- `default_organization_configuration_json`
  - widget-owned default for organizations that do not persist an override row
- `organization_configuration_version`
  - widget-owned version for this capability contract

### Runtime meaning

When this capability is absent:

- no organization override row is required
- the widget behaves exactly as it does today
- clients should not show organization-configuration editing UI for that widget type

When this capability is present:

- the widget may expose organization-scoped configuration UI
- the backend may persist one sparse override row per organization and widget type
- runtime bootstrap may resolve widget-type defaults plus the organization override

### Registry and client visibility

Clients should treat organization configuration support as explicit widget-type metadata, not as an
inference from widget kind, category, tags, or source.

If the widget type registry or widget-type sync manifest is exposed to clients or agents, this
capability should be represented there as a first-class type-level feature so downstream tooling can
tell:

- whether the widget supports organization configuration
- which schema governs that configuration
- which default configuration applies in the absence of an override row
- which version of the organization-configuration contract is active

## Scope Boundary

### Belongs in organization widget type configuration

- organization-scoped defaults for one widget type
- organization-scoped capability ceilings for one widget type
- organization-scoped presentation or filter defaults for one widget type
- widget-type-specific runtime configuration that should apply across saved instances in the same
  organization

### Does not belong in organization widget type configuration

- global widget catalog metadata already owned by `RegisteredWidgetType`
- user-authored widget instance props already owned by `SavedWidgetInstance.props`
- transient runtime state
- organization configuration for widget types that did not explicitly opt in

## Data Model

The backend shape is:

### 1. Widget-type extension fields

`RegisteredWidgetType` may optionally expose:

- `organization_configuration_schema_json`
- `default_organization_configuration_json`
- `organization_configuration_version`

Semantics:

- if `organization_configuration_schema_json` is `null`, the widget type does not support
  organization-scoped configuration
- `default_organization_configuration_json` is the widget-type-owned default used when no
  organization override row exists
- `organization_configuration_version` versions that widget-specific organization config contract

### 2. Sparse override rows

Each override row belongs to exactly:

- one organization
- one registered widget type

There is at most one row per `(organization, registered_widget_type)`.

No row is required when an organization accepts the widget type default.

## API Contract

The backend exposes organization widget type configuration rows through:

- `GET /api/v1/command_center/org-widget-type-configurations/`
- `POST /api/v1/command_center/org-widget-type-configurations/`
- `GET /api/v1/command_center/org-widget-type-configurations/{id}/`
- `PUT /api/v1/command_center/org-widget-type-configurations/{id}/`
- `PATCH /api/v1/command_center/org-widget-type-configurations/{id}/`
- `DELETE /api/v1/command_center/org-widget-type-configurations/{id}/`

### List filters

Supported list filters:

- `?registered_widget_type=<pk>`
- optionally `?widgetId=<registered widget_id>` for convenience

### Write payload

`organization_owner` and `created_by_user` are not client-controlled.

They come from:

- the authenticated user context
- `CreatedByMixin` / backend ownership semantics

Client write payload:

```json
{
  "registered_widget_type": 12,
  "config_json": {
    "title": "Org-specific chart title",
    "defaultFilters": {
      "desk": "rates"
    },
    "presentation": {
      "theme": "compact"
    }
  }
}
```

### Update semantics

`config_json` is a full replacement value.

`PUT` and `PATCH` must both treat `config_json` as replacing the entire stored JSON blob rather than
deep-merging it.

Example patch:

```json
{
  "config_json": {
    "title": "New replacement config",
    "presentation": {
      "theme": "expanded"
    }
  }
}
```

That payload overwrites the previous `config_json` completely.

### Read payload

Read responses must include both:

- the registered widget type foreign key id
- the public widget identifier and title

That avoids forcing the client to do a second lookup just to understand which widget type a row
belongs to.

Example response:

```json
{
  "id": 7,
  "organization_owner": 3,
  "created_by_user": 42,
  "creation_date": "2026-04-15T10:00:00Z",
  "registered_widget_type": 12,
  "registered_widget_type_widget_id": "main-sequence-chart",
  "registered_widget_type_title": "Chart",
  "config_json": {
    "title": "Org-specific chart title",
    "defaultFilters": {
      "desk": "rates"
    },
    "presentation": {
      "theme": "compact"
    }
  }
}
```

## Runtime Resolution

For one widget instance, effective organization-aware configuration resolves in this order:

1. widget code defaults
2. `RegisteredWidgetType.default_organization_configuration_json`
3. organization override row for that widget type, if one exists
4. saved widget instance props or instance-specific requested behavior, where applicable

Widgets that do not publish organization-configuration support stop at step 1 and behave exactly as
they do today.

This keeps the model sparse and opt-in.

## Why this is widget-type-specific

We explicitly rejected a design that tried to force all widget organization configuration into one
shared cross-widget schema or one shared inheritance hierarchy such as `global`, `kind`, and
`type`.

That abstraction was too coarse for the actual problem.

Examples:

- an ECharts widget may need snippet allowlists, capability modes, or rendering guardrails
- a markdown widget may need HTML policy or markdown feature controls
- an iframe-like widget may need domain allowlists and sandbox flags

These are different configuration models.

The backend therefore stores organization configuration per registered widget type and lets each
widget type define its own schema and defaults.

## Consequences

Positive:

- not all widgets need organization-scoped configuration
- widget types can opt in independently
- the backend persists one generic reusable row shape without pretending every widget shares the
  same config contract
- organizations only create override rows when they actually need them
- the client can bootstrap one widget type's organization config without a widget-specific endpoint

Negative:

- this changes persisted backend configuration semantics and is not a frontend-only change
- widget-type authors must own the schema, defaults, and versioning of their organization config
- clients must treat `config_json` as a full replacement value on updates, not a deep-merge patch

## Guardrails

- Do not require every `RegisteredWidgetType` to define organization configuration support.
- Do not put organization-scoped widget defaults into `SavedWidgetInstance.props`.
- Do not treat `PATCH config_json` as a deep merge.
- Do not force unrelated widget types into one fake shared configuration schema.
- Do not accept `organization_owner` or `created_by_user` from the client.

## Tasks

- [ ] Add `organization_configuration_schema_json`,
      `default_organization_configuration_json`, and
      `organization_configuration_version` to `RegisteredWidgetType`.
- [ ] Add backend persistence and API support for `org-widget-type-configurations`.
- [ ] Enforce uniqueness per `(organization, registered_widget_type)`.
- [ ] Support list filtering by `registered_widget_type` and optional `widgetId`.
- [ ] Treat `PUT config_json` and `PATCH config_json` as full replacements.
- [ ] Return both the registered widget type FK id and the public widget type identity fields in
      read payloads.
- [x] Add frontend widget-definition support for declaring organization configuration capability.
- [x] Add frontend bootstrap support so widget instances can resolve organization widget type
      configuration without widget-specific fetch logic.
- [x] Implement an ECharts widget that opts into this organization-scoped configuration model.
- [x] Define the ECharts widget's organization configuration schema and defaults once that widget is
      introduced.
