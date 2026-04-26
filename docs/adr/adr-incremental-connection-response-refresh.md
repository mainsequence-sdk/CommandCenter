# ADR: Incremental In-Memory Connection Response Refresh

- Status: Proposed
- Date: 2026-04-25
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)

## Context

Connection-backed widgets commonly request a rolling time range, for example the latest 24 hours.
Today every refresh sends that full range to the backend again, receives a full replacement response,
and downstream widgets render the replacement frame.

That behavior is correct but inefficient and visually poor for live chart and table experiences:

- backend adapters repeatedly read and normalize data that the frontend already has in memory
- the frontend repeatedly replaces a full frame when it only needs the newest tail of the range
- graph widgets cannot show a natural "new prices are arriving" animation when every refresh looks
  like a full data replacement

The desired behavior is short:

> For all connections, keep the last response in memory and update future request ranges from the
> last successful request time or configured time field, then merge the smaller response into the
> retained window.

This must remain adapter-agnostic. PostgreSQL, Prometheus, Main Sequence Data Node, Simple Table,
and future connections should all use the same frontend refresh policy when their query model is
time-range aware and their response can be merged by time.

## Decision

Command Center should add an incremental connection response refresh mode to the shared connection
query runtime.

The runtime should keep a retained in-memory response per stable connection query identity. After
the first full-window request, subsequent refreshes should request only the new tail range, merge the
delta into the retained response, dedupe by a configured row merge key, and discard values outside
the configured rolling window.

This is not a backend session cache. It is a frontend runtime cache for active workspace/query
surfaces. It may be lost on page reload, workspace remount, user logout, connection changes, or
query identity changes.

The Connection Query widget must expose this behavior as per-widget-instance configuration because
the runtime cannot always infer the correct time field or dedupe key columns and because incremental
refresh does not make sense for every connection or query model. The user must be able to choose the
time column used for:

- computing the next incremental backend time filter
- discarding rows that fall outside the retained rolling range

The user must separately choose the columns that make up the dedupe/merge key. The merge key is a
user-selected combination of response columns. It may include the time field and domain columns such
as `symbol`, `interval`, `provider`, or `portfolioId`, but the runtime must not hard code those
semantics. The selected merge key is authoritative for deciding whether an incoming row replaces an
existing retained row or appends as a new row.

The active refresh contract is `core.tabular_frame@v1`. This ADR must not add a separate
`core.time_series_frame@v1` merge path. Legacy or backend-native series-shaped responses should be
normalized to the canonical tabular frame before the incremental refresh store sees them.

The runtime may infer time-field candidates from fields whose type is `datetime`, `date`, or
`time`, adapter/query editor hints, or optional metadata such as `frame.meta.timeSeries.timeField`
when present. Those hints are not authoritative. The persisted widget-instance setting must allow
the user to override the time field. If a selected connection/query model is not time-range aware,
does not return mergeable time data, or cannot apply a backend time filter, the widget should hide
or disable incremental refresh and keep full replacement refresh behavior.

## Scope

This ADR covers:

- all connection-backed query execution through the shared connection query runtime
- the core Connection Query widget instance settings
- Explore surfaces that use the shared connection workbench
- graph and chart consumers that render retained tabular frames
- frontend request-range reduction after an initial full-window load

This ADR does not require:

- backend modifications
- backend-owned per-client sessions
- a new connection response envelope
- adapter-specific frontend query paths
- vendor-specific chart response contracts

## Runtime Model

The shared connection query runtime should maintain an in-memory retained response keyed by a stable
query identity:

- connection uid
- connection type id
- query model id
- requested output contract
- normalized query payload
- variables
- max rows or effective row limit policy
- configured incremental time field
- configured incremental merge key fields
- configured retention window

For each retained query identity, store:

- the retained `ConnectionQueryResponse`
- the last successful requested range
- the last observed watermark from the configured time field
- the current rolling window start/end
- the configured overlap duration
- the configured merge key fields
- the merge/dedupe policy
- the in-flight request promise or abort handle
- warnings and trace metadata from the latest request

Initial execution:

1. Build the normal full rolling range, for example `now - 24h` to `now`.
2. Send the existing `ConnectionQueryRequest.timeRange`.
3. Store the full response in memory.
4. Derive the watermark from the configured time field.
5. Publish the retained response to downstream widgets.

Incremental execution:

1. Read the retained query state.
2. Compute the next request range from `lastWatermark - overlapMs` to `now`.
3. Send the existing `ConnectionQueryRequest.timeRange` with that smaller range.
4. Merge the response into the retained response.
5. Deduplicate rows by the configured merge key.
6. Discard rows older than the active rolling window.
7. Publish both the updated retained response and a frontend delta description to downstream
   widgets.

Reset to full-window execution when:

- the connection reference changes
- the query model changes
- the query payload changes
- variables change
- requested output contract changes
- the configured incremental time field changes
- the configured incremental merge key fields change
- the rolling range/window changes in a non-tail-compatible way
- the backend returns an incompatible schema
- the retained response is missing or expired
- the user explicitly forces a full refresh

## Connection Query Widget Instance Configuration

The core Connection Query widget should add an incremental refresh section per widget instance and
only for eligible time-range-aware query models. This must not be a global connection-instance
setting because the same configured connection can be used by different widgets with different
queries, ranges, and merge semantics.

Required settings:

- `incrementalTimeField?: string`
  - user-selected column/field name
  - used to compute the next smaller backend `timeRange`
  - used to discard retained rows outside the rolling window

- `incrementalMergeKeyFields?: string[]`
  - user-selected ordered combination of response columns used to dedupe and replace retained rows
  - must be non-empty when incremental refresh is enabled
  - may be seeded from `incrementalTimeField` plus obvious domain columns, but the user selection
    is authoritative
  - examples: `["timestamp", "symbol"]`, `["openTime", "symbol", "interval"]`,
    `["portfolioId", "asOf"]`
  - if the key is too narrow, distinct rows can be collapsed; if it is too broad, corrected overlap
    rows may append instead of replacing

Recommended settings:

- `incrementalRefreshMode?: "full" | "incremental"`
  - `full` keeps current replacement behavior
  - `incremental` enables retained in-memory response merging
- `incrementalOverlapMs?: number`
  - default should be small, for example 30-120 seconds depending on refresh cadence
  - avoids missing late-arriving rows and allows correction of the last bucket/candle/row
- `incrementalDedupePolicy?: "latest" | "first" | "error"`
  - default should be `latest`
  - `latest` replaces an existing retained row when the merge key matches
- `incrementalRetentionMs?: number`
  - defaults to the active rolling range duration when available
  - controls how much retained data stays in memory

The widget settings UI should populate time-field candidates from:

- fields whose `type` is `"datetime"`, `"date"`, or `"time"`
- adapter/query editor hints when available
- optional legacy metadata such as `frame.meta.timeSeries.timeField` when present
- manual free text fallback for adapters that cannot preview schema before execution

The widget settings UI should populate merge-key candidates from all response schema fields. It may
seed the selected merge key from the chosen time field and obvious domain keys, but the user-selected
column combination is the source of truth.

The widget settings UI should not offer incremental refresh when the selected connection/query model
does not advertise time-range awareness or when the response contract cannot be merged by a
configured time field and merge key. In those cases the widget should keep the normal full
refresh path.

## Frontend Widget Delta Propagation

The retained response alone is not enough. Widgets must be able to receive deltas in and publish
deltas out so downstream widgets can implement efficient additive behavior instead of repeatedly
processing full snapshots.

The widget runtime should distinguish two frontend update modes:

- `snapshot`: a full replacement output, equivalent to current behavior
- `delta`: an incremental output that also carries the retained full output

A delta update should use the shared `widget-runtime-update@v1` frontend runtime envelope, not a
backend response contract change. The envelope is stored under `source.context.runtimeUpdate` on
published widget outputs, so all widget consumers can inspect one common contract instead of
reading widget-specific metadata names. It should describe:

- `contractVersion: "widget-runtime-update@v1"`
- `mode: "snapshot" | "delta"`
- the source widget instance id and output id
- the output contract id
- where the retained full output lives; when the envelope is attached to the retained output,
  `retainedOutputLocation` should be `"carrier"` and the retained frame should not be duplicated in
  the envelope
- the delta output returned by the latest incremental refresh
- the delta time range
- the watermark before and after the merge
- generic operation counts such as appended, replaced, removed, pruned, returned, and retained
- optional widget-specific diagnostics

Widget input resolution should pass this update mode to consumers. A widget may then choose:

- handle `delta` directly and update internal/rendered state incrementally
- transform `delta` into a downstream `delta`
- ignore the delta metadata and consume the retained full output as a `snapshot`

The generic resolved input contract must expose this as widget-level upstream fields, not as a
Connection Query-specific escape hatch:

- `value`: the retained full output for backward-compatible snapshot consumers
- `upstreamBase`: the retained full output after the binding transform has been applied
- `upstreamDelta`: the delta output after the same binding transform has been applied, when the
  transform can safely produce one
- `upstreamUpdate`: the shared `widget-runtime-update@v1` envelope after output-contract and
  delta-transform normalization

Widgets must consume these generic fields when they need incremental behavior. They must not read
Connection Query-specific metadata directly.

Fan-out must be per consumer. If one Connection Query output feeds multiple widgets, the source
query should still execute once per refresh according to its own incremental setting. A delta-aware
consumer may use the delta path, while a non-delta consumer must receive the retained full output as
a snapshot. A non-delta consumer must not force the Connection Query widget to issue a second full
backend request, and it must not disable incremental refresh for sibling consumers that can use it.
The tradeoff is only frontend recomputation/render cost for that specific non-delta consumer.

Delta-in/delta-out behavior is required for widgets that transform or visualize live time-indexed
tabular data. For example:

- Connection Query receives a backend delta, merges it into memory, and publishes retained output
  plus delta metadata.
- Tabular Transform can receive a row delta, apply the same transform to only changed rows when the
  transform is compatible, and publish a transformed delta plus retained transformed output.
- Graph can receive a row delta, project rows through its configured X/Y/group fields, and
  append/update existing chart series without recreating the chart.

Widgets that cannot safely preserve correctness from a delta must emit a `snapshot` after
recomputing from the retained full input. Correctness is more important than preserving delta mode.

## Graph And Chart Behavior

Graph widgets should consume the retained response as an additive stream when the source update is
incremental.

The chart renderer should support two update paths:

- full replacement: rebuild/set all series data
- incremental update: append or replace only new/overlapping points

Incremental chart updates should:

- keep chart and series instances mounted
- append points newer than the last retained X value for the affected series
- replace points with matching X value and graph-derived series key when overlap returns corrected
  values
- drop visible data older than the retained rolling window
- keep the viewport following the right edge only when the user has not panned away
- preserve user zoom/crosshair state during delta updates

This makes live graphs feel like new prices are arriving instead of like the whole chart is being
redrawn.

## Impacted Widgets And Surfaces

Directly impacted widgets:

- Connection Query (`connection-query`)
  - owns the per-widget-instance incremental refresh settings
  - owns the retained in-memory connection response used by downstream bindings
  - publishes the merged retained frame plus frontend delta metadata after incremental refreshes
- Graph (`graph`)
  - should consume delta inputs as append/update operations after projecting tabular rows through
    its configured X/Y/group fields
  - should preserve chart instances, viewport, zoom, and crosshair state when possible
  - is the main visible UX beneficiary because live points should animate in naturally
- Main Sequence OHLC Bars (`main-sequence-ohlc-bars`)
  - should consume delta inputs as append/update operations after projecting tabular rows through
    its configured time/open/high/low/close fields
  - should preserve the Lightweight Charts instance, visible range, and crosshair state when
    upstream market bars update incrementally
  - must keep consuming the retained full tabular snapshot when delta metadata is absent or when
    OHLC row updates cannot be applied safely

Indirectly impacted widgets:

- Table (`table`)
  - receives the retained merged dataset when bound downstream of Connection Query
  - may consume row deltas in the future but can initially render the retained snapshot
  - does not need backend changes or table-specific query settings
- Statistic (`statistic`)
  - recalculates cards from the retained merged dataset when bound downstream of Connection Query
  - should generally fall back to snapshot recomputation unless a statistic can safely update from
    a delta
  - does not need adapter-specific behavior
- Debug Stream (`debug_stream`)
  - can be used to inspect retained/merged connection outputs during development
- Tabular Transform and other transform/source widgets
  - should preserve delta-in/delta-out semantics when their operation can transform deltas without
    changing correctness
  - should publish a snapshot when the transform requires a full recompute

Not directly impacted by this ADR:

- Lightweight Charts Spec (`lightweight-charts-spec`) unless a future implementation binds it to
  retained connection output or generated chart specs.
- Main Sequence Dependency Graph (`main-sequence-dependency-graph`) and Project Infrastructure
  Graph (`main-sequence-project-infra-graph`), because they use graph-shaped resource payloads
  rather than the shared connection query time-range flow.
- Rich text, markdown, AppComponent, and other non-connection-query presentation widgets.

## Backend Contract Impact

This implementation must use the existing backend contract and must not require backend
modifications. This is a Command Center frontend/runtime feature: retain the previous response in
memory, compute a smaller follow-up `timeRange`, send the same request shape, and merge the result
on the frontend.

The frontend still sends:

```ts
ConnectionQueryRequest.timeRange = {
  from: string;
  to: string;
}
```

The only difference is that follow-up requests use a smaller `from` value based on the retained
watermark and overlap. Backend adapters do not need to know whether the request is full-window or
incremental, and no adapter change is required for this ADR's implementation tasks.

Non-requirements:

- do not add backend endpoints
- do not add backend-owned client sessions
- do not require backend cursor tokens
- do not require new backend watermark fields
- do not require adapter-specific backend changes
- do not change the connection response envelope

If a future backend team wants to add optional metadata such as `meta.watermark`, stronger
time-field/schema hints, or adapter-owned cursors, that work must be documented separately and must
remain optional. It must not become a prerequisite for this ADR.

## Risks

- Wrong time-field configuration can drop valid data or request the wrong tail range.
- Missing or wrong merge-key configuration can collapse distinct rows or fail to replace corrected
  overlap rows.
- Late-arriving data can be missed without overlap.
- Some adapters may return corrected historical buckets; merge policy must handle overlap updates.
- Large retained windows can consume memory if many widgets run many unique queries.
- Query identity normalization must be stable or the runtime will miss cache reuse.
- Incremental graph updates must not override user zoom/pan unexpectedly.
- Incorrect delta propagation can produce stale downstream widgets; every widget must be allowed to
  fall back to snapshot recomputation when it cannot safely transform a delta.

## Implementation Tasks

- [x] Add persisted per-widget-instance Connection Query settings for incremental refresh mode.
- [x] Add persisted per-widget-instance Connection Query setting for `incrementalTimeField`.
- [x] Add persisted per-widget-instance Connection Query setting for `incrementalMergeKeyFields`.
- [x] Gate the settings UI so incremental refresh is hidden or disabled for non-time-range-aware
      query models and connections whose responses cannot be merged by a configured time field and
      merge key.
- [x] Add optional settings for overlap, retention, and dedupe policy.
- [x] Add settings UI that lets the user choose the time field and merge-key columns from
      response/schema candidates and still type fields manually.
- [x] Add an in-memory retained connection response store keyed by stable connection query identity.
- [x] Add query identity normalization for connection uid, type id, query model, payload, variables,
      requested contract, max rows, incremental time field, incremental merge key fields, and
      retention policy.
- [x] Add full-window initial load behavior.
- [x] Add incremental tail-range request behavior using `lastWatermark - overlapMs` to `now`.
- [x] Add merge/dedupe logic for `core.tabular_frame@v1` rows using the user-selected merge-key
      column combination.
- [x] Add retained-window pruning so values older than the rolling range are discarded.
- [x] Add reset-to-full-refresh behavior for query identity, schema, range, and connection changes.
- [x] Add in-flight request dedupe or abort/ignore behavior for overlapping refreshes.
- [x] Keep the implementation frontend-only; do not add backend endpoints, backend sessions, new
      response envelopes, cursor requirements, watermark requirements, or adapter-specific backend
      requirements.
- [x] Add a frontend widget runtime update envelope that distinguishes `snapshot` from `delta`.
- [x] Make the update envelope a shared widget runtime contract instead of a Connection
      Query-specific metadata shape.
- [x] Pass delta metadata through widget input resolution so consumers know whether an input update
      is additive or a full replacement.
- [x] Expose generic `upstreamBase`, `upstreamDelta`, and `upstreamUpdate` fields on resolved widget
      inputs so widgets do not depend on source-specific metadata names.
- [x] Update shared source helpers and direct resolved-input consumers so existing table,
      statistic, graph, tabular transform, app component, spec chart, debug, and Main Sequence
      tabular consumers read retained base values through the generic contract.
- [x] Let widgets publish delta outputs when they can safely transform an input delta.
- [x] Require widgets to fall back to snapshot output when they cannot safely preserve delta
      correctness.
- [x] Update graph/chart renderers to distinguish full replacement from incremental updates.
- [x] Add imperative append/update support to the core graph renderer.
- [x] Add imperative append/update support to the Main Sequence OHLC Bars renderer.
- [x] Preserve graph viewport, zoom, and crosshair state during incremental updates.
- [x] Preserve OHLC Bars viewport and crosshair state during incremental updates.
- [x] Add diagnostics for retained row count, last watermark, last request range, and full vs delta
      refresh mode.
- [x] Update widget README after implementation.
- [x] Confirm backend adapter docs do not need updates because this implementation does not require
      `meta.watermark`, cursor tokens, or stronger time-field/schema metadata.
- [x] Add tests for merge/dedupe, retention pruning, wrong time-field handling, full reset triggers,
      wrong merge-key collisions, and graph incremental update behavior.

## Current Status

The source/runtime portion is implemented for the Connection Query widget. The active
implementation target is canonical `core.tabular_frame@v1` output; `core.time_series_frame@v1` is
not part of the incremental refresh runtime design. Generic resolved inputs expose
`upstreamBase`, `upstreamDelta`, and `upstreamUpdate`; table-like consumers read retained base
values, safe tabular pass-through/projection transforms can publish delta outputs, and graph/OHLC
renderers can apply append/update paths while keeping mounted chart instances. Focused Vitest
coverage now protects the retained-frame merge, pruning, invalid time-field, merge-key collision,
identity reset, and in-flight dedupe behavior.
