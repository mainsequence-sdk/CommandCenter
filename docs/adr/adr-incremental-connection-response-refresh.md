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

That behavior is correct but inefficient and visually poor for live time-series experiences:

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
delta into the retained response, dedupe by time and series identity, and discard values outside the
configured rolling window.

This is not a backend session cache. It is a frontend runtime cache for active workspace/query
surfaces. It may be lost on page reload, workspace remount, user logout, connection changes, or
query identity changes.

The Connection Query widget must expose this behavior as per-widget-instance configuration because
the runtime cannot always infer the correct time field and because incremental refresh does not make
sense for every connection or query model. The user must be able to choose the time column used for:

- computing the next incremental backend time filter
- merging incoming rows/points into the retained response
- discarding rows/points that fall outside the retained rolling range

The runtime may infer a default time field from `frame.meta.timeSeries.timeField`, a field with
`type: "time"`, or connection query metadata, but the persisted widget-instance setting must allow
the user to override it. If a selected connection/query model is not time-range aware, does not
return mergeable time data, or cannot apply a backend time filter, the widget should hide or disable
incremental refresh and keep full replacement refresh behavior.

## Scope

This ADR covers:

- all connection-backed query execution through the shared connection query runtime
- the core Connection Query widget instance settings
- Explore surfaces that use the shared connection workbench
- graph and chart consumers that render retained time-series frames
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
- configured retention window

For each retained query identity, store:

- the retained `ConnectionQueryResponse`
- the last successful requested range
- the last observed watermark from the configured time field
- the current rolling window start/end
- the configured overlap duration
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
5. Deduplicate rows/points by time field plus series identity.
6. Discard values older than the active rolling window.
7. Publish both the updated retained response and a frontend delta description to downstream
   widgets.

Reset to full-window execution when:

- the connection reference changes
- the query model changes
- the query payload changes
- variables change
- requested output contract changes
- the configured incremental time field changes
- the rolling range/window changes in a non-tail-compatible way
- the backend returns an incompatible schema
- the retained response is missing or expired
- the user explicitly forces a full refresh

## Connection Query Widget Instance Configuration

The core Connection Query widget should add an incremental refresh section per widget instance and
only for eligible time-range-aware query models. This must not be a global connection-instance
setting because the same configured connection can be used by different widgets with different
queries, ranges, and merge semantics.

Required setting:

- `incrementalTimeField?: string`
  - user-selected column/field name
  - used to compute the next smaller backend `timeRange`
  - used to merge and dedupe retained rows/points
  - used to discard retained values outside the rolling window

Recommended settings:

- `incrementalRefreshMode?: "full" | "incremental"`
  - `full` keeps current replacement behavior
  - `incremental` enables retained in-memory response merging
- `incrementalOverlapMs?: number`
  - default should be small, for example 30-120 seconds depending on refresh cadence
  - avoids missing late-arriving rows and allows correction of the last bucket/candle/point
- `incrementalDedupePolicy?: "latest" | "first" | "error"`
  - default should be `latest`
  - `latest` replaces an existing retained row/point when the merge key matches
- `incrementalRetentionMs?: number`
  - defaults to the active rolling range duration when available
  - controls how much retained data stays in memory

The widget settings UI should populate time-field candidates from:

- `frame.meta.timeSeries.timeField`
- fields whose `type` is `"time"`
- adapter/query editor hints when available
- manual free text fallback for adapters that cannot preview schema before execution

The widget settings UI should not offer incremental refresh when the selected connection/query model
does not advertise time-range awareness or when the response contract cannot be merged by a
configured time field. In those cases the widget should keep the normal full refresh path.

## Frontend Widget Delta Propagation

The retained response alone is not enough. Widgets must be able to receive deltas in and publish
deltas out so downstream widgets can implement efficient additive behavior instead of repeatedly
processing full snapshots.

The widget runtime should distinguish two frontend update modes:

- `snapshot`: a full replacement output, equivalent to current behavior
- `delta`: an incremental output that also carries the retained full output

A delta update should be a frontend runtime envelope, not a backend response contract change. It
should describe:

- the source widget instance id and output id
- the output contract id
- the retained full output after merge
- the delta output returned by the latest incremental refresh
- the delta time range
- the watermark before and after the merge
- whether rows/points were appended, replaced, removed by retention pruning, or forced to snapshot

Widget input resolution should pass this update mode to consumers. A widget may then choose:

- handle `delta` directly and update internal/rendered state incrementally
- transform `delta` into a downstream `delta`
- ignore the delta metadata and consume the retained full output as a `snapshot`

Delta-in/delta-out behavior is required for widgets that transform or visualize live time-series
data. For example:

- Connection Query receives a backend delta, merges it into memory, and publishes retained output
  plus delta metadata.
- Tabular Transform can receive a row delta, apply the same transform to only changed rows when the
  transform is compatible, and publish a transformed delta plus retained transformed output.
- Graph can receive a point delta and append/update existing chart series without recreating the
  chart.

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
- append points newer than the last retained timestamp
- replace points with matching timestamp and series identity when overlap returns corrected values
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
  - should consume delta inputs as append/update operations
  - should preserve chart instances, viewport, zoom, and crosshair state when possible
  - is the main visible UX beneficiary because live points should animate in naturally

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
`meta.timeSeries.timeField` hints, or adapter-owned cursors, that work must be documented separately
and must remain optional. It must not become a prerequisite for this ADR.

## Risks

- Wrong time-field configuration can drop valid data or request the wrong tail range.
- Late-arriving data can be missed without overlap.
- Some adapters may return corrected historical buckets; merge policy must handle overlap updates.
- Large retained windows can consume memory if many widgets run many unique queries.
- Query identity normalization must be stable or the runtime will miss cache reuse.
- Incremental graph updates must not override user zoom/pan unexpectedly.
- Incorrect delta propagation can produce stale downstream widgets; every widget must be allowed to
  fall back to snapshot recomputation when it cannot safely transform a delta.

## Implementation Tasks

- [ ] Add persisted per-widget-instance Connection Query settings for incremental refresh mode.
- [ ] Add persisted per-widget-instance Connection Query setting for `incrementalTimeField`.
- [ ] Gate the settings UI so incremental refresh is hidden or disabled for non-time-range-aware
      query models and connections whose responses cannot be merged by a configured time field.
- [ ] Add optional settings for overlap, retention, and dedupe policy.
- [ ] Add settings UI that lets the user choose the time field from response/schema candidates and
      still type a field manually.
- [ ] Add an in-memory retained connection response store keyed by stable connection query identity.
- [ ] Add query identity normalization for connection uid, type id, query model, payload, variables,
      requested contract, max rows, incremental time field, and retention policy.
- [ ] Add full-window initial load behavior.
- [ ] Add incremental tail-range request behavior using `lastWatermark - overlapMs` to `now`.
- [ ] Add merge/dedupe logic for `core.tabular_frame@v1` frames using the configured time field.
- [ ] Add merge/dedupe logic for `core.time_series_frame@v1` frames using time plus series identity.
- [ ] Add retained-window pruning so values older than the rolling range are discarded.
- [ ] Add reset-to-full-refresh behavior for query identity, schema, range, and connection changes.
- [ ] Add in-flight request dedupe or abort/ignore behavior for overlapping refreshes.
- [ ] Keep the implementation frontend-only; do not add backend endpoints, backend sessions, new
      response envelopes, cursor requirements, watermark requirements, or adapter-specific backend
      requirements.
- [ ] Add a frontend widget runtime update envelope that distinguishes `snapshot` from `delta`.
- [ ] Pass delta metadata through widget input resolution so consumers know whether an input update
      is additive or a full replacement.
- [ ] Let widgets publish delta outputs when they can safely transform an input delta.
- [ ] Require widgets to fall back to snapshot output when they cannot safely preserve delta
      correctness.
- [ ] Update graph/chart renderers to distinguish full replacement from incremental updates.
- [ ] Add imperative append/update support to the core graph renderer.
- [ ] Preserve graph viewport, zoom, and crosshair state during incremental updates.
- [ ] Add diagnostics for retained row count, last watermark, last request range, and full vs delta
      refresh mode.
- [ ] Update connection and widget READMEs after implementation.
- [ ] Update backend adapter docs if `meta.watermark`, cursor tokens, or stronger time-series
      metadata become required.
- [ ] Add tests for merge/dedupe, retention pruning, wrong time-field handling, full reset triggers,
      and graph incremental update behavior.

## Current Status

No runtime implementation exists yet. This ADR records the intended architecture and the tasks
needed to implement it.
