# ADR 072: Backend Variables And Reference Defaults

- Status: Proposed
- Date: 2026-05-21
- Related:
  - [ADR 058: Cross-Widget References And Variables](./adr-058-cross-widget-references-and-variables.md)
  - [ADR 064: Variable References as Widget Graph Edges](./adr-064-variable-reference-graph-integration.md)
  - [ADR 070: Workspace Variable Explorer](./adr-070-workspace-variable-explorer.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)

## Context

Cross-widget variables now let users bind widget settings to runtime widget outputs, for example:

```text
$(asset-screener-1).activeRow.Symbol
$(table-1).activeCellValue
```

That is useful, but runtime selection values can be absent. A table can have no active row, an Asset
Screener can have no active cell, and a workspace can load before a user has made a selection.

Today the absence of a selection creates two different user problems:

- the effective consumer setting becomes empty or `null`
- users cannot express a stable default such as `BTCUSDT` without hard-coding it into every widget

The platform also lacks a backend-owned variable model. All current variable behavior is derived
from widget references and frontend runtime state. That prevents users from defining reusable
workspace values such as:

```text
default_ticker = "BTCUSDT"
risk_currency = "USD"
```

It also prevents platform-level defaults that should be available across workspaces.

## Decision

Add backend-owned variable definitions and allow reference-backed settings to declare optional
fallback defaults.

There are two separate concepts:

1. **Backend variable definitions**: named values owned by the backend and scoped to `platform` or
   `workspace`.
2. **Reference defaults**: fallback metadata on a consumer binding that says what value to use when
   a referenced widget value is absent under an explicit policy.

These concepts must stay graph-native:

- backend variables are source nodes/outputs in the same dependency graph
- reference defaults are part of the effective value resolution of a binding edge
- defaults must not mutate source widget runtime state
- defaults must not write resolved values back into saved widget props
- defaults must not reintroduce upstream resolution loops

## Backend Variable Model

Introduce a backend model for named variables.

Minimum fields:

```json
{
  "id": "uuid",
  "scope_type": "workspace",
  "workspace_id": "25",
  "key": "default_ticker",
  "label": "Default ticker",
  "description": "Ticker used when no workspace selection is active.",
  "value_contract": "core.value.string@v1",
  "value_descriptor": {
    "kind": "primitive",
    "primitive": "string",
    "contract": "core.value.string@v1"
  },
  "value": "BTCUSDT",
  "status": "active",
  "created_by": 849,
  "updated_by": 849,
  "created_at": "2026-05-21T00:00:00.000Z",
  "updated_at": "2026-05-21T00:00:00.000Z",
  "version": 1
}
```

### Scope Types

Supported first-slice scopes:

- `platform`: global variables available to all workspaces in the current platform deployment
- `workspace`: variables available only inside one workspace

Future scopes such as organization, project, and user are out of scope for this ADR unless the
backend requires them for authorization.

### Keys

Variable keys must be stable slugs:

```text
default_ticker
risk_currency
selected_market
```

Keys are unique within a scope:

- one platform variable can use `default_ticker`
- one workspace variable in workspace `25` can also use `default_ticker`
- fully qualified references remove ambiguity

## Reference Syntax

Backend variables need reserved namespaces so they cannot collide with widget instance ids.

First slice syntax:

```text
$(platform.default_ticker)
$(workspace.default_ticker)
```

These references compile into dependency graph edges just like widget variable references.

The platform may later add an unqualified convenience namespace such as `$(vars.default_ticker)`,
but the first implementation should prefer fully qualified scope names to keep graph resolution
deterministic.

## Reference Defaults

Reference defaults are consumer-side fallback metadata.

The same source variable can have different default behavior depending on the target field:

- one Binance query may default `activeRow.Symbol` to `BTCUSDT`
- another widget may want the same source to remain empty until the user selects a row
- a title may show `No selection` instead of a ticker

Therefore the default belongs to the binding/use site, not to the source widget output.

### Binding Metadata

Extend reference-backed binding metadata with a fallback block:

```json
{
  "sourceWidgetId": "asset-screener-1",
  "sourceOutputId": "activeRow",
  "transformSteps": [
    {
      "id": "extract-path",
      "path": ["Symbol"],
      "contractId": "core.value.string@v1"
    }
  ],
  "fallback": {
    "enabled": true,
    "applyWhen": ["missing", "null"],
    "source": {
      "kind": "backend-variable",
      "scopeType": "workspace",
      "key": "default_ticker"
    }
  }
}
```

The first slice should prefer backend-variable fallback sources. Inline fallback literals can be
added later, but if the user enters a literal default in the UI, the save flow should create or
update a workspace variable and then bind to that backend variable.

### Apply Conditions

Fallback application must be explicit. Supported conditions:

- `missing`: source output or transform result is unavailable
- `null`: source output resolved to `null`
- `empty-string`: source output resolved to an empty string
- `empty-array`: source output resolved to an empty array

Default first-slice behavior for selection variables should use:

```json
["missing", "null"]
```

This supports the common case:

```text
$(asset-screener-1).activeRow.Symbol
```

with fallback:

```text
$(workspace.default_ticker) -> "BTCUSDT"
```

## Resolution Semantics

Resolution order for a reference-backed setting:

1. Resolve the primary source graph edge.
2. Apply binding transforms such as `extract-path`.
3. Classify the primary result as `ready`, `missing`, `null`, `empty`, or `error`.
4. If the fallback policy matches the classified result, resolve the fallback backend variable.
5. The consumer receives the effective value.

Important loop-safety rule:

```text
null remains a settled source value.
```

Fallback substitution is a pure effective-value step. A primary `null` value must not turn back into
`awaiting-upstream`, must not retrigger upstream resolution, and must not mutate the source widget
runtime state.

Errors should not silently apply defaults unless the binding explicitly supports an `error`
condition in a future ADR. First slice should render errors as errors.

## Graph Model

Backend variables become graph-visible source nodes.

The graph should show both:

- the primary variable edge
- the fallback variable edge when a binding has a fallback

Example:

```text
Asset Screener.activeRow.Symbol -> Binance Query.props.query.symbols
Workspace Variable.default_ticker -> Binance Query.props.query.symbols (fallback)
```

The Variable Explorer should show:

- backend variable definitions
- current backend variable value
- consumers that use the variable directly
- consumers that use the variable as fallback
- effective value when primary is absent and fallback is applied

## API Contract

This ADR requires a backend contract change.

The backend must own variable definitions and expose them through a typed, versioned API. The
frontend must not treat these variables as local-only browser state.

### Backend Resource: VariableDefinition

Canonical response shape:

```json
{
  "id": "var_01HX...",
  "scope_type": "workspace",
  "workspace_id": "25",
  "key": "default_ticker",
  "label": "Default ticker",
  "description": "Ticker used when no table or screener selection is active.",
  "value_contract": "core.value.string@v1",
  "value_descriptor": {
    "kind": "primitive",
    "primitive": "string",
    "contract": "core.value.string@v1"
  },
  "value": "BTCUSDT",
  "status": "active",
  "created_by": 849,
  "updated_by": 849,
  "created_at": "2026-05-21T00:00:00.000Z",
  "updated_at": "2026-05-21T00:00:00.000Z",
  "version": 1
}
```

Required semantics:

- `id`: backend-stable variable id.
- `scope_type`: first slice accepts `platform` or `workspace`.
- `workspace_id`: required for `workspace`, null or omitted for `platform`.
- `key`: stable slug used by reference syntax; unique within its scope.
- `label`: human-readable display name.
- `description`: optional help text.
- `value_contract`: widget value contract id used for compatibility checks.
- `value_descriptor`: structured descriptor used by completion, validation, and graph diagnostics.
- `value`: JSON-compatible value validated against `value_contract` and `value_descriptor`.
- `status`: `active` or `archived`; archived variables must not resolve for new graph hydration.
- `version`: monotonic integer for optimistic concurrency and stale-write protection.

### List Effective Workspace Variables

The workspace runtime needs one effective variable set before graph hydration.

```text
GET /api/v1/command_center/workspaces/{workspace_id}/variables/
```

Response:

```json
{
  "workspace_id": "25",
  "variables": [
    {
      "id": "var_workspace_default_ticker",
      "scope_type": "workspace",
      "workspace_id": "25",
      "key": "default_ticker",
      "label": "Default ticker",
      "description": "Ticker used when no selection is active.",
      "value_contract": "core.value.string@v1",
      "value_descriptor": {
        "kind": "primitive",
        "primitive": "string",
        "contract": "core.value.string@v1"
      },
      "value": "BTCUSDT",
      "status": "active",
      "version": 3,
      "created_by": 849,
      "updated_by": 849,
      "created_at": "2026-05-21T00:00:00.000Z",
      "updated_at": "2026-05-21T00:00:00.000Z"
    }
  ],
  "effective_scopes": ["platform", "workspace"]
}
```

The backend must resolve scope precedence deterministically:

1. workspace variables
2. platform variables

If both scopes define `default_ticker`, `$(workspace.default_ticker)` resolves the workspace value
and `$(platform.default_ticker)` resolves the platform value. There is no implicit shadowing for
fully qualified references.

### Create Workspace Variable

```text
POST /api/v1/command_center/workspaces/{workspace_id}/variables/
```

Request:

```json
{
  "key": "default_ticker",
  "label": "Default ticker",
  "description": "Ticker used when no selection is active.",
  "value_contract": "core.value.string@v1",
  "value_descriptor": {
    "kind": "primitive",
    "primitive": "string",
    "contract": "core.value.string@v1"
  },
  "value": "BTCUSDT"
}
```

Response: `201` with `VariableDefinition`.

### Update Workspace Variable

```text
PUT /api/v1/command_center/workspaces/{workspace_id}/variables/{variable_id}/
```

Request:

```json
{
  "key": "default_ticker",
  "label": "Default ticker",
  "description": "Ticker used when no selection is active.",
  "value_contract": "core.value.string@v1",
  "value_descriptor": {
    "kind": "primitive",
    "primitive": "string",
    "contract": "core.value.string@v1"
  },
  "value": "ETHUSDT",
  "version": 3
}
```

Response: `200` with updated `VariableDefinition`.

The backend must reject stale updates when `version` does not match the latest stored version.

### Archive Workspace Variable

```text
DELETE /api/v1/command_center/workspaces/{workspace_id}/variables/{variable_id}/
```

Response:

```json
{
  "id": "var_workspace_default_ticker",
  "status": "archived"
}
```

Hard delete is not required for the first slice. Archiving preserves auditability and lets graph
diagnostics explain references to removed variables.

### Platform Variables

Platform variables use the same payloads and response shape, but require platform-admin
authorization:

```text
GET    /api/v1/command_center/platform/variables/
POST   /api/v1/command_center/platform/variables/
PUT    /api/v1/command_center/platform/variables/{variable_id}/
DELETE /api/v1/command_center/platform/variables/{variable_id}/
```

The backend must not allow non-admin users to mutate platform variables. Non-admin users may read
active platform variables if those variables are part of effective workspace resolution.

### Workspace Detail Integration

The backend must support one of these two hydration contracts:

1. Embed `effective_variables` in workspace detail responses.
2. Provide the variables endpoint above and document that the frontend must load it before final
   dependency graph hydration.

Preferred first slice is embedding, because variable references participate in graph readiness:

```json
{
  "id": "25",
  "title": "Asset Monitor",
  "definition": {
    "widgets": []
  },
  "effective_variables": [
    {
      "id": "var_workspace_default_ticker",
      "scope_type": "workspace",
      "workspace_id": "25",
      "key": "default_ticker",
      "value_contract": "core.value.string@v1",
      "value_descriptor": {
        "kind": "primitive",
        "primitive": "string",
        "contract": "core.value.string@v1"
      },
      "value": "BTCUSDT",
      "status": "active",
      "version": 3
    }
  ]
}
```

### Error Contract

Errors must use stable `code` values so the frontend can render useful diagnostics.

Example:

```json
{
  "code": "variable_key_conflict",
  "title": "Variable key already exists",
  "detail": "A workspace variable with key default_ticker already exists.",
  "field_errors": {
    "key": ["This key is already used in this workspace."]
  }
}
```

Required codes:

| Code | Meaning | Frontend handling |
| --- | --- | --- |
| `variable_key_conflict` | Duplicate key within scope | Show field error on key |
| `variable_invalid_key` | Key is not a valid slug | Show field error on key |
| `variable_invalid_value` | Value does not match contract/descriptor | Show field error on value |
| `variable_contract_unsupported` | Backend does not support the value contract | Show contract error |
| `variable_not_found` | Variable id/key is missing or archived | Show unresolved variable diagnostic |
| `variable_version_conflict` | Stale update version | Ask user to reload/merge |
| `variable_permission_denied` | User cannot mutate the scope | Show access denied |

## Required Backend Implementation

The backend must implement these pieces before the frontend can safely ship reference defaults:

- a persisted `VariableDefinition` table/model
- workspace-scoped CRUD with workspace authorization
- platform-scoped CRUD with platform-admin authorization
- value validation against the same contracts/descriptors used by widgets
- deterministic list/effective resolution for workspace graph hydration
- stable error codes for duplicate keys, invalid values, missing variables, and permissions
- audit fields for create/update ownership and timestamps
- optimistic concurrency through `version`
- archived-variable behavior that keeps old references diagnosable without resolving as active
- OpenAPI/schema documentation for the frontend client
- backend tests for scope isolation, value validation, authorization, version conflicts, and
  effective workspace variable listing

Required backend validation:

```text
key: /^[a-z][a-z0-9_]{1,63}$/
value: JSON-compatible only
value_contract: must be a registered widget value contract
value_descriptor: must be compatible with value_contract
scope_type: platform | workspace
workspace_id: required only for workspace scope
```

Backend must not store secrets in this model. Secret or credential variables need a separate secret
store contract and are explicitly out of scope.

## Frontend Plan

### 1. Backend Client

Add a typed variable API client for:

- listing effective workspace variables
- creating/updating workspace variables
- reading platform variables
- admin platform variable mutation when authorized

### 2. Runtime Model

Extend the dashboard dependency model with backend variable definitions.

Backend variable definitions should be represented as source outputs with stable ids:

```text
platform.default_ticker
workspace.default_ticker
```

They should use normal widget value descriptors and contracts so existing binding validation can
reuse the same compatibility checks.

### 3. Reference Language

Extend the parser and completion system to recognize:

```text
$(platform.<key>)
$(workspace.<key>)
```

These should compile into graph-native reference bindings, not string substitution.

### 4. Binding Defaults

Extend widget binding metadata and effective prop/title resolution to support `fallback`.

The resolver must preserve the distinction between:

- primary source value
- fallback source value
- effective consumer value

This distinction is required for debugging and for preventing resolved defaults from being written
back to source widgets.

### 5. UI

Add variable management surfaces:

- workspace variable management in workspace settings
- platform variable management in the appropriate admin/settings surface
- default configuration UI on reference tokens/bindings

Reference-aware inputs should let a user:

- select a widget variable
- choose "Use default when empty"
- pick an existing backend variable
- create a new workspace variable such as `default_ticker = "BTCUSDT"`
- remove the default without removing the primary reference

### 6. Variable Explorer

Extend ADR 070's Variable Explorer to show:

- backend variables
- fallback edges
- fallback applied/not applied state
- effective value for each consumer

## Storage Impact

This is a backend and frontend storage contract change.

New shared persisted data:

- backend variable definitions
- binding fallback metadata

Existing saved widget props must remain unchanged by runtime fallback resolution.

The fallback metadata is part of the shared workspace/binding contract because all viewers of the
workspace should resolve the same effective default.

## Implementation Tasks

### Backend Contract

- [ ] Define the backend `VariableDefinition` model with `platform` and `workspace` scopes.
- [ ] Add uniqueness constraints for `(scope_type, workspace_id, key)`.
- [ ] Add validation for `value_contract`, `value_descriptor`, and `value`.
- [ ] Implement stable backend error codes for key conflict, invalid key, invalid value,
  unsupported contract, missing variable, version conflict, and permission denied.
- [ ] Add list/create/update/archive APIs for workspace variables.
- [ ] Add list/create/update/archive APIs for platform variables with admin authorization.
- [ ] Decide whether workspace detail embeds effective variables or frontend loads them separately.
- [ ] Publish OpenAPI/schema documentation for `VariableDefinition` requests and responses.
- [ ] Add backend tests for scope isolation, validation, update versioning, and authorization.

### Frontend Data Loading

- [ ] Add typed frontend API helpers for variable list/create/update/archive.
- [ ] Load effective backend variables before workspace dependency graph hydration.
- [ ] Cache variables per workspace while preserving refresh after create/update/archive.
- [ ] Surface variable loading and error states without blocking unrelated workspace rendering.

### Dependency Graph

- [ ] Represent backend variables as graph-native source nodes/outputs.
- [ ] Compile `$(platform.key)` and `$(workspace.key)` into reference edges.
- [ ] Add graph diagnostics for missing backend variable keys.
- [ ] Add fallback edges from backend variables to consumers.
- [ ] Ensure fallback resolution does not trigger widget execution or upstream refresh by itself.

### Binding And Resolution

- [ ] Extend `WidgetPortBinding` metadata with an optional `fallback` block.
- [ ] Implement explicit fallback apply conditions: `missing`, `null`, `empty-string`, and
  `empty-array`.
- [ ] Apply fallback only during effective consumer value resolution.
- [ ] Preserve `null` as a settled primary source value and never map it back to
  `awaiting-upstream`.
- [ ] Ensure fallback values are not persisted into widget props or runtime state.
- [ ] Add tests for primary ready value, primary null with default, missing source with default,
  and source error without default.

### Authoring UI

- [ ] Extend variable-aware inputs to offer backend variable namespaces.
- [ ] Add default configuration on token/reference controls.
- [ ] Add create-new-workspace-variable flow from a default input.
- [ ] Add workspace settings UI for workspace variables.
- [ ] Add platform/admin UI for platform variables if user permissions allow it.
- [ ] Make token editing/removal work independently for primary reference and default reference.

### Variable Explorer

- [ ] Show backend variable definitions in the Variable Explorer.
- [ ] Show whether a consumer is using a primary value or fallback value.
- [ ] Show missing backend variable references as unresolved diagnostics.
- [ ] Add tests proving unused backend variables do not appear unless the explorer is in variable
  management mode.

### Migration And Compatibility

- [ ] Keep existing widget variable references valid without defaults.
- [ ] Treat absent `fallback` metadata as "no default".
- [ ] Do not migrate literal widget props into backend variables automatically.
- [ ] Add regression tests that existing table and Asset Screener references still refresh
  downstream connections without defaults.

## Consequences

### Benefits

- Users can express stable defaults without hard-coding the same literal into every widget.
- Workspace variables become reusable, backend-owned configuration.
- Platform variables allow global defaults without copying values into each workspace.
- The graph and Variable Explorer can explain primary values, fallbacks, and effective values.

### Risks

- This introduces a backend storage contract and must be coordinated with backend migrations.
- Fallbacks can hide missing user selection if the UI does not clearly show that a default was
  applied.
- Fully qualified variable namespaces are necessary to avoid collisions with widget instance ids.
- Runtime loop prevention must be preserved: fallback defaults are effective-value substitution,
  not an upstream-readiness state.

### Non-Goals

- This ADR does not add secrets or credential variables.
- This ADR does not add organization, project, or user scoped variables.
- This ADR does not add arbitrary expression evaluation.
- This ADR does not allow defaults to mutate source widget state.
- This ADR does not replace widget-to-widget references.
