# ADR: Connection-First Workspace Dataflow

- Status: Accepted
- Date: 2026-04-25
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)

## Context

Workspace dataflow is partly connection-first today, but the Main Sequence Data Node widget family
still carries an older source-widget model.

The connection layer already models backend-owned data access:

- connection types are code-owned and registry-synced
- connection instances are backend-owned configured data sources
- widgets should persist stable `ConnectionRef` values instead of endpoint details
- connection queries can return normalized `core.tabular_frame@v1` frames

The remaining mismatch is `main-sequence-data-node`. It is currently a widget that acts as:

- a connection-backed source selector
- a Data Node query executor
- a manual table source
- an aggregate, pivot, unpivot, and projection transform
- the canonical published dataset owner for downstream widgets

That makes Data Node a special platform concept inside the workspace graph even though the platform
already has a generic connection abstraction. It also forces downstream authoring language to say
"bind to a Data Node widget" instead of "bind to a tabular source", which prevents the workspace
model from feeling like a Grafana-style source, transform, and visualization graph.

Backward compatibility is explicitly not a goal for this migration. Existing saved workspaces,
saved widget groups, demo workspaces, and backend widget-type rows may need direct replacement.
Do not add compatibility guards that preserve old Data Node widget semantics.

## Decision

Workspace data access will become connection-first.

Connections remain backend-owned resources, not widgets. Widgets can query connections, transform
published frames, or render published frames, but no widget family should become a source-specific
platform inside the workspace model.

The target workspace dataflow is:

```text
Connection instance
  -> Connection Query widget
  -> Tabular Transform widget
  -> Table / Chart / Statistic / Curve / other consumers
```

The `main-sequence-data-node` widget will be removed from the live widget catalog instead of
preserved as the canonical source widget. Its source and transform responsibilities will be split
into generic graph nodes:

1. a generic `Connection Query` execution-owner widget that calls configured connection query
   models and publishes `core.tabular_frame@v1` or `core.time_series_frame@v1`
2. a generic `Tabular Transform` execution-owner widget that consumes `core.tabular_frame@v1`,
   applies analytical transforms, and republishes `core.tabular_frame@v1`

Data Node access continues through the `mainsequence.data-node` connection type. A configured Data
Node connection instance owns the selected Data Node in its public config. Workspace widgets should
not store direct Data Node ids as the canonical source selector.

Connection query authoring must have one frontend implementation. The workspace Connection Query
widget settings and Data Sources Explore both use the same query workbench, request builder, typed
connection query editors, runtime range controls, generated request preview, execution helper, and
normalized frame preview. The only semantic difference is ownership of the draft: a workspace
widget persists `ConnectionQueryWidgetProps` in a workspace document, while Explore owns a local
draft unless the user saves it as a reusable backend query.

## Target Contracts

### Connection Query Widget

The Connection Query widget is the generic source node for connection-backed datasets.

It should be an `execution-owner` widget with saved props shaped around the connection contract:

```ts
interface ConnectionQueryWidgetProps {
  connectionRef: ConnectionRef;
  queryModelId: string;
  query: Record<string, unknown>;
  timeRangeMode?: "dashboard" | "fixed" | "none";
  fixedStartMs?: number;
  fixedEndMs?: number;
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
}
```

Runtime behavior:

- resolve the selected connection instance by `connectionRef`
- resolve the selected query model by `queryModelId`
- pass dashboard or fixed time range into `queryConnection(...)` as top-level `timeRange` ISO
  strings when the query model is time-range aware
- derive the requested output contract from the selected connection query model metadata; users do
  not select output frame type manually
- normalize the selected matching `ConnectionQueryResponse.frames[]` entry into
  `core.tabular_frame@v1` or `core.time_series_frame@v1`
- publish a canonical `dataset` output with the resolved frame contract
- optionally publish a raw response output later for debugging or advanced consumers

The widget should use a connection type's custom `queryEditor` when available and fall back to a
generic JSON query editor only when the connection type does not provide one. The `queryEditor`
receives the selected connection instance, connection type, query model, current typed query
payload, and `onChange`. Connection-specific kwargs such as Data Node columns, identifier filters,
SQL parameters, PostgreSQL time-series field mapping, Prometheus matchers, and adapter-specific
limits must be rendered there rather than as static fields in the generic widget.

### Shared Query Workbench

`ConnectionQueryWorkbench` is the shared authoring and test surface for connection query drafts.
It is used by:

- workspace Connection Query widget settings
- generic Data Sources Explore fallback
- connection-specific Explore shells that need source metadata around the same query form

The workbench is responsible for selecting the connection path, invoking typed connection
`queryEditor` components, building the exact `ConnectionQueryRequest`, showing the generated
request preview, executing test queries through the same helper used by widget runtime execution,
and rendering the normalized frame response. Do not add per-connection Explore code that calls
`queryConnection(...)` directly unless the connection is explicitly outside the standard query
contract.

### Reusable Saved Connection Queries

The platform needs a backend-owned saved query model per data source so Explore and workspace
widgets can reuse the same authored query. This is separate from extension-owned connection
`queryModels`: connection `queryModels` define available operation kinds, while saved connection
queries are user/org-authored instances of one operation against one connection instance.

A saved connection query backend record should store at least:

- stable id and display name
- owner or organization scope and permission metadata
- `connectionUid` and `connectionTypeId`
- selected `queryModelId`
- typed query payload, including `query.kind`
- `timeRangeMode`, fixed date defaults when applicable, and any future relative range default
- standard `variables` and `maxRows`
- derived output contract metadata from the selected query model, for validation and display
- audit timestamps and the connection instance version marker if needed for invalidation

It must not store endpoint URLs, route fragments, tokens, credentials, or mutable connection
display labels as authoritative runtime data. Backend APIs must validate the saved query against
the current connection type metadata, the connection instance, and the caller permissions before
reuse. Frontend workspaces may persist an inline query draft or a future `savedQueryId`, but the
saved backend record is the reusable source of truth when the author chooses to save a query.

### Tabular Transform Widget

The Tabular Transform widget owns analytical reshaping that used to live inside the Data Node
widget.

It should be an `execution-owner` widget with:

- input: `sourceData` accepting `core.tabular_frame@v1`
- output: `dataset` publishing `core.tabular_frame@v1`
- supported initial transform modes: `none`, `aggregate`, `pivot`, `unpivot`, and `projection`

This widget should replace the old "Advanced transform" section from the Data Node widget. It is a
visible graph node, not a binding-level transform.

Binding-level transforms should stay intentionally small. They are for structural output
selection, such as selecting an array item or extracting an object path. Analytical transforms must
remain explicit widgets so users can inspect, refresh, debug, and bind them like every other graph
node.

### Consumer Widgets

Table, chart, statistic, curve, and zero-curve widgets should become generic consumers of
`core.tabular_frame@v1`.

They should not require a Data Node source widget. User-facing language should refer to a bound
tabular dataset, connection query, or upstream transform, depending on context.

Current candidates:

- `data-node-table-visualizer` becomes core widget id `table`
- `main-sequence-data-node-visualizer` becomes core widget id `graph`
- `main-sequence-data-node-statistic` becomes core widget id `statistic`
- curve and zero-curve widgets consume tabular curve datasets instead of "Data Node widgets"

## Backend And Storage Impact

This is a backend-visible breaking change.

Workspace storage impact:

- remove old `main-sequence-data-node` widget instances from supported workspace documents
- remove canonical reliance on `sourceMode`, `sourceWidgetId`, `dataNodeId`, and Data Node-specific
  direct source props
- persist `connectionRef`, query model id, query config, time range config, and transform config on
  the new generic source and transform widgets
- later allow workspace source widgets to reference a backend saved connection query id when the
  backend saved-query model lands
- keep widget bindings as the canonical graph edge model
- continue using `runtimeState` for execution-owned published datasets

Backend contract impact:

- backend widget-type registry must receive new widget type rows
- old Data Node widget type rows should be deactivated or removed from normal catalogs
- backend workspace validation must understand the new widget ids and props
- saved-widget validation must understand the new widget ids and props
- backend must add a reusable saved connection query model/API per data source before saved query
  reuse can be considered complete
- connection query adapters must return normalized `ConnectionQueryResponse` frames for tabular
  data
- `mainsequence.data-node` should resolve the Data Node from the connection instance public config
  rather than trusting a widget-level `dataNodeId`

Because compatibility is not required, this ADR does not require migration code for old workspace
documents. Checked-in mock workspaces and demos should be replaced with the new graph shape.

## Consequences

Positive:

- all data access enters workspaces through the same connection abstraction
- Data Node becomes one connection type rather than a privileged widget family
- source, transform, and render responsibilities are inspectable as separate graph nodes
- downstream widgets can work with Data Node, Simple Table SQL, PostgreSQL, Prometheus, or future
  tabular connections when they publish the same contract
- the graph becomes closer to the Grafana mental model without hiding execution inside render
  widgets

Negative:

- existing Data Node workspaces will break until they are rebuilt
- registry and backend validation need a coordinated update
- generic query authoring requires better connection query editors
- transform settings need to move from a mature Data Node-specific settings screen into a new
  generic transform widget
- some user-facing widget names, docs, and demos will need broad cleanup

## Guardrails

- Do not add backwards-compatibility guards for old Data Node widget props or ids.
- Do not make table, chart, statistic, curve, or zero-curve widgets query connections directly.
  They should consume `core.tabular_frame@v1`.
- Do not expand binding-level transforms into analytical transforms.
- Do not store endpoint URLs, tokens, backend route fragments, or raw connection instance display
  names in workspace widget props.
- Do not keep Data Node-specific language in generic widgets after the split.
- Do not add hidden runtime fetch owners. Connection Query and Tabular Transform own execution;
  consumers render published outputs.

## Implementation Checklist

Use this checklist as the rollout tracker. Mark items complete by changing `[ ]` to `[x]` in this
ADR when the corresponding implementation has landed.

### Platform Contracts

- [x] Define the generic Connection Query widget props, IO, execution contract, and registry
  contract.
- [x] Define the generic Tabular Transform widget props, IO, execution contract, and registry
  contract.
- [x] Decide the final widget ids for generic table, generic chart, and generic statistic widgets.
- [x] Share one frontend Connection Query workbench between workspace widget settings and Data
  Sources Explore.
- [x] Add or update value descriptors for `core.tabular_frame@v1` outputs so graph binding tools
  can inspect fields consistently.
- [x] Keep binding-level transforms limited to structural extraction and array item selection.

### Connection Runtime

- [ ] Ensure `queryConnection(...)` can support the Connection Query widget for all configured
  connection types.
- [ ] Ensure `mainsequence.data-node` returns normalized `ConnectionQueryResponse` frames for row
  queries.
- [ ] Ensure `mainsequence.simple-table` returns normalized `ConnectionQueryResponse` frames for SQL
  queries.
- [ ] Remove default/system Data Node fallback behavior from workspace source execution.
- [ ] Make configured Data Node connection instances authoritative for Data Node selection.
- [ ] Update connection type sync metadata and bump the connection registry version if the
  connection manifest shape or query model metadata changes.

### Widget Refactor

- [x] Implement the Connection Query widget as an execution-owner source.
- [x] Pass selected connection instance context into Connection Query `queryEditor` components.
- [x] Add typed Connection Query editors for Data Node, Simple Table, PostgreSQL, and Prometheus
  query payload kwargs.
- [x] Implement the Tabular Transform widget as an execution-owner transform.
- [x] Move aggregate, pivot, unpivot, and projection logic into the generic transform module.
- [x] Convert Data Node Table into a generic tabular table consumer.
- [x] Convert Data Node Graph into a generic tabular chart consumer.
- [x] Convert Data Node Statistic into a generic statistic consumer.
- [x] Update curve plot and zero-curve widgets to describe their input as tabular curve datasets
  instead of Data Node widget outputs.
- [x] Remove `main-sequence-data-node` from the live widget registry.
- [x] Remove Data Node-specific source helpers from generic consumer widgets.
- [x] Remove Data Node-specific layout special cases such as compact layout handling keyed by
  `main-sequence-data-node`.

### Workspace And Demo Data

- [ ] Replace checked-in mock workspace graphs with Connection Query -> Transform -> Consumer graph
  examples.
- [x] Replace demo overview workspace widget examples that instantiate old Data Node consumer ids.
- [ ] Update saved-widget import/export examples to use the new source and transform widgets.
- [ ] Verify workspace graph editor rendering and binding validation with the new source and
  transform nodes.
- [ ] Verify dashboard refresh executes connection query and transform nodes before passive
  consumers.

### Backend Coordination

- [ ] Add backend validation support for the new widget ids and props.
- [ ] Deactivate or remove old Data Node widget type rows from normal backend catalogs.
- [ ] Sync new widget type registry metadata and bump the widget registry version.
- [ ] Update saved-widget backend validation for the new graph shape.
- [ ] Confirm backend connection query adapters enforce permissions before cache and in-flight
  dedupe.
- [ ] Confirm backend connection query adapters never trust frontend-provided endpoint paths or
  credentials.
- [ ] Add a backend saved connection query model/API scoped per data source for reusable authored
  queries.
- [ ] Let Explore and Connection Query widgets load, apply, and save backend saved connection
  queries by id.

### Documentation And UI Language

- [x] Update `src/features/dashboards/README.md` for connection-first workspace authoring.
- [x] Update `src/connections/README.md` to describe workspace source-widget usage.
- [x] Update Main Sequence workbench widget READMEs and `USAGE_GUIDANCE.md` files.
- [ ] Update markets widget READMEs and `USAGE_GUIDANCE.md` files that still say "Data Node
  widget" for generic tabular inputs.
- [ ] Update admin/widget registry docs to describe the new source, transform, and consumer split.
- [x] Remove user-facing Data Node terminology from generic table, chart, and statistic widgets.

### Verification

- [x] `npm run check` passes after TypeScript changes.
- [ ] Workspace graph with one Connection Query and one table consumer refreshes successfully.
- [ ] Workspace graph with Connection Query -> Tabular Transform -> chart/stat/table refreshes
  successfully.
- [ ] Settings preview for consumers resolves upstream execution through the shared execution
  provider.
- [ ] Request debugger shows one canonical owner for connection query execution.
- [ ] Backend registry sync preview includes the new widget types and no active old Data Node source
  widget.
