# ADR: Managed Connection Query Sources for Consumer Widgets

- Status: Accepted
- Date: 2026-04-27
- Related:
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)

## Context

The workspace model is connection-first. A configured connection instance is queried by a
`connection-query` widget, and visible widgets such as Graph and Table consume the published
`core.tabular_frame@v1` output through canonical widget bindings.

That model is correct, but it creates too much workspace chrome for common authoring flows. A
Prometheus dashboard may need many charts where each chart has a different metric, variable set,
time window, or query payload. Requiring users to create one visible `connection-query` widget and
one visible chart widget for every chart makes the widget rail noisy and turns a chart-heavy
workspace into a source-widget management task.

The platform should support two valid authoring styles:

- explicit shared source widgets, when one query should feed several downstream consumers
- embedded source authoring, when one visible consumer owns its own connection query

The second style must not break the accepted connection-first and single-runtime-owner rules. Graph,
Table, and similar consumer widgets should not call connection APIs directly during rendering.
Connection execution, incremental refresh, request tracing, output publication, and backend adapter
access must remain owned by `connection-query`.

Backward compatibility is required. Existing workspaces that manually bind
`connection-query -> Graph/Table` must continue to load and behave the same way.

## Decision

Consumer widgets may own a managed `connection-query` source widget.

The managed source is still a normal dashboard widget instance with widget id `connection-query`.
It persists its own `ConnectionQueryWidgetProps`, runs as the execution owner, publishes the same
`dataset` output, and participates in the normal dependency graph. The visible consumer stores
enough source-mode metadata for settings and lifecycle management, but the actual data edge remains
the canonical widget binding from the managed source's `dataset` output to the consumer's
`sourceData` input.

Initial implementation scope is Graph and Table.

When a Graph or Table is configured with connection-backed source mode, the workspace editor will:

1. create a managed `connection-query` widget if the consumer does not already own one
2. store the connection query configuration on the managed widget
3. create or repair the binding from managed source `dataset` to consumer `sourceData`
4. hide the managed source from the normal workspace widget rail
5. keep the managed source mounted and executable

Standalone `connection-query` widgets remain supported. They are the preferred authoring path when
one query should feed multiple consumers, when the source should be visible in the workspace graph,
or when authors want to tune source execution independently from a specific visualization.

## Target Storage Shape

The implementation should use additive optional metadata so old workspace documents remain valid.
The exact names may be refined during implementation, but the stored contract should be equivalent
to:

```ts
interface DashboardWidgetInstance {
  bindings?: WidgetInstanceBindings;
  managedBy?: {
    ownerInstanceId: string;
    role: "embedded-connection-source";
  };
  presentation?: WidgetInstancePresentation & {
    railVisibility?: "visible" | "hidden";
  };
}
```

The managed source widget should carry `managedBy`. The hidden rail behavior should be controlled
by presentation metadata, not by removing the widget from `dashboard.widgets`.

Visible consumers should not rely on a private in-props data edge. Their binding remains the source
of truth for runtime dataflow. Consumer props may store an authoring source mode such as
`sourceMode: "connection"` or `tableSourceMode: "connection"` so settings can show the embedded
connection editor and lifecycle code can find or create the managed source.

## Runtime Rules

- Managed sources are included in dependency graph extraction, execution planning, request tracing,
  runtime-state publication, and binding validation.
- Managed sources are excluded only from the normal user-facing workspace rail by default.
- Graph and Table stay passive consumers. They render resolved `sourceData` and never call
  `queryConnection(...)` directly.
- `connection-query` remains the only runtime owner for connection query execution.
- Incremental refresh behavior stays on the managed `connection-query` widget, including retained
  frame state, dedupe, overlap, merge keys, and published update envelopes.
- The workspace graph/debug view may expose a "show managed widgets" affordance later, but the
  default authoring surface should not show managed sources as normal rail items.

## Lifecycle Rules

Creation:

- switching a supported consumer to connection source mode creates a managed source if needed
- the managed source receives default sidebar placement and hidden rail visibility
- the consumer binding is created or repaired automatically

Update:

- editing embedded connection settings updates the managed source props
- changing query model, variables, time range, row limit, or incremental settings invalidates or
  refreshes the managed source using the same rules as an explicit `connection-query` widget
- binding repair must preserve user edits unless the binding points at the owned managed source

Duplication:

- duplicating a consumer with an embedded connection source duplicates the managed source too
- the duplicate consumer is rebound to the duplicate source
- sharing the same embedded source across duplicated consumers is not the default because it couples
  chart-local query edits across widgets

Deletion:

- deleting the owner consumer deletes its managed source when no other widget references that
  source
- if another widget has been manually bound to the managed source, deletion should either preserve
  the source as an explicit standalone `connection-query` widget or require a clear confirmation

Migration:

- existing explicit source widgets and bindings are not rewritten
- existing consumers with bound sources remain bound-source consumers
- no automatic migration should convert manual `connection-query -> consumer` graphs into embedded
  sources

## UI Rules

Graph and Table settings should expose connection-backed source mode beside existing source modes.

For Graph, source modes should clearly distinguish:

- bound upstream dataset
- embedded connection query

For Table, source modes should clearly distinguish:

- bound upstream dataset
- embedded connection query
- manual table

The embedded connection query editor should reuse the same workbench logic and typed query editors
as the `connection-query` widget. Do not create Graph-specific or Table-specific connection query
forms.

The visible widget may show a compact managed-source status in settings, including selected
connection, query model, last runtime status, and an affordance to open advanced source settings.
The managed source should not appear as a normal rail item unless a future debug mode explicitly
asks for it.

## Backend And Storage Impact

Connection query request and response contracts do not change.

Frontend workspace storage changes add optional metadata for managed widget ownership and rail
visibility. If backend workspace validation treats dashboard widget instances as strict schemas,
the backend must allow:

- optional `managedBy` metadata on widget instances
- optional rail visibility presentation metadata
- `sourceMode: "connection"` or equivalent source-mode values on Graph and Table props

The backend widget registry does not need a new widget type. It may need updated registry metadata
for Graph and Table if their source-mode guidance, settings schema, or usage guidance changes.

This is a backend-visible storage compatibility change only if backend validation rejects unknown
widget fields or unknown consumer source-mode values.

## Consequences

Positive:

- chart-heavy and table-heavy dashboards can stay visually focused on the actual widgets users care
  about
- the existing connection-query execution contract, trace behavior, incremental refresh, and
  normalized frame output are reused instead of duplicated
- existing explicit source-widget workflows remain available for shared sources
- the binding graph remains the canonical dataflow model

Negative:

- workspace lifecycle code must manage hidden owned widgets, including duplicate/delete edge cases
- rail filtering needs a separate visibility rule from execution inclusion
- backend workspace validation may need additive schema updates
- settings UI needs shared embedded source authoring without duplicating connection-query logic

## Guardrails

- Do not make Graph, Table, or other passive consumers query connections directly.
- Do not hide managed sources by removing them from `dashboard.widgets`.
- Do not store credentials, endpoint URLs, route fragments, or connection display labels as
  authoritative consumer props.
- Do not auto-migrate explicit shared source graphs into embedded sources.
- Do not let hidden rail visibility affect dependency resolution, execution, runtime state, or
  request tracing.
- Do not create per-widget query editors that drift from the connection type's own query editor.

## Implementation Tasks

Use this checklist as the rollout tracker. Mark items complete by changing `[ ]` to `[x]` in this
ADR when the corresponding implementation has landed.

### Platform Model

- [x] Add additive managed-widget ownership metadata to dashboard widget instance types.
- [x] Add additive rail visibility metadata to widget presentation types.
- [x] Normalize managed-widget metadata in workspace load/save paths.
- [x] Keep managed widgets included in dependency graph extraction and execution planning.
- [x] Add helpers to find managed widgets by owner instance id and role.
- [x] Add helpers to create, update, duplicate, detach, and remove managed source widgets.

### Workspace UI

- [x] Filter managed widgets with hidden rail visibility out of the normal workspace widget rail.
- [x] Keep managed widgets available to settings and debug surfaces that explicitly ask for them.
- [x] Add or update workspace graph/debug affordances to show managed widgets when needed.
- [x] Ensure managed widgets do not leave empty canvas grid items or invisible hit areas.

### Connection Query Reuse

- [x] Extract reusable connection-query settings/workbench pieces needed by embedded consumers.
- [x] Reuse the same request builder, query model resolution, typed query editors, test execution,
  and response preview as the standalone `connection-query` widget.
- [x] Preserve incremental refresh settings and execution behavior on the managed source widget.
- [x] Ensure managed source runtime errors surface clearly in the owning consumer settings.
- [x] Keep the shared connection picker usable for embedded consumers when the backend connection
  instance catalog is empty by surfacing runtime/system default instances such as
  `prometheus-default`.
- [x] Keep widget-managed Prometheus authoring on the same typed editor and exploration surface as
  Data Sources Explore instead of a widget-only schema fallback.
- [x] Drive widget-managed Prometheus draft defaults from the same connection-type resolver used by
  Explore so query-model selection, PromQL defaults, and fixed lookback seeding do not diverge.

### Graph Rollout

- [x] Add graph-managed connection authoring from `Bindings`, with a dedicated `Connection` tab
  instead of embedding the full connection workbench in the main Graph settings tab.
- [x] Create or repair the managed `connection-query` source when Graph enters connection mode.
- [x] Bind Graph `sourceData` to the managed source `dataset` output automatically.
- [x] Keep Graph field pickers and chart rendering driven by resolved `sourceData`.
- [x] Update Graph README, `USAGE_GUIDANCE.md`, and widget-settings route docs for `Bindings ->
  Connection` managed-source authoring.
- [x] Add focused tests for Graph managed source creation, update, duplicate, delete, and backward
  compatibility with explicit source bindings.

### Table Rollout

- [ ] Add connection-backed source mode to Table settings while preserving manual and bound modes.
- [ ] Create or repair the managed `connection-query` source when Table enters connection mode.
- [ ] Bind Table `sourceData` to the managed source `dataset` output automatically.
- [ ] Keep Table output publication driven by the resolved source or manual rows, not direct
  connection execution.
- [ ] Update Table README and `USAGE_GUIDANCE.md` for embedded connection source authoring.
- [ ] Add focused tests for Table managed source creation, update, duplicate, delete, manual mode,
  and backward compatibility with explicit source bindings.

### Backend Coordination

- [ ] Confirm whether backend workspace validation allows optional widget `managedBy` metadata.
- [ ] Confirm whether backend workspace validation allows optional presentation rail visibility
  metadata.
- [ ] Confirm whether backend workspace validation allows new Graph/Table connection source-mode
  values.
- [ ] Update backend validation if any additive storage fields are rejected.
- [ ] Sync updated Graph/Table widget registry metadata if usage guidance or schema contracts
  change.

### Verification

- [ ] Existing workspace with explicit `connection-query -> Graph` binding still loads and
  refreshes.
- [ ] Existing workspace with explicit `connection-query -> Table` binding still loads and
  refreshes.
- [ ] Workspace with several Graph widgets using embedded Prometheus queries shows only the visible
  charts in the normal rail.
- [x] Managed connection sources execute before their owners consume resolved inputs.
- [ ] Duplicating and deleting embedded-source consumers leaves no orphaned hidden sources.
- [x] `npm run check` passes after TypeScript changes.
