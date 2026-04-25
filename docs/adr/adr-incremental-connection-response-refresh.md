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

The Connection Query widget must expose configuration for this behavior because the runtime cannot
always infer the correct time field. The user must be able to choose the time column used for:

- computing the next incremental backend time filter
- merging incoming rows/points into the retained response
- discarding rows/points that fall outside the retained rolling range

The runtime may infer a default time field from `frame.meta.timeSeries.timeField`, a field with
`type: "time"`, or connection query metadata, but the persisted widget setting must allow the user
to override it.

## Scope

This ADR covers:

- all connection-backed query execution through the shared connection query runtime
- the core Connection Query widget settings
- Explore surfaces that use the shared connection workbench
- graph and chart consumers that render retained time-series frames
- frontend request-range reduction after an initial full-window load

This ADR does not require:

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
7. Publish the updated retained response to downstream widgets.

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

## Connection Query Widget Configuration

The core Connection Query widget should add an incremental refresh section for time-range-aware
query models.

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

## Backend Contract Impact

Phase one can use the existing backend contract.

The frontend still sends:

```ts
ConnectionQueryRequest.timeRange = {
  from: string;
  to: string;
}
```

The only difference is that follow-up requests use a smaller `from` value based on the retained
watermark and overlap. Backend adapters do not need to know whether the request is full-window or
incremental.

Optional future backend improvements:

- include `meta.watermark` in frames
- include `meta.timeSeries.timeField` reliably for time-series capable results
- include adapter-owned cursor tokens for non-time-based incremental reads
- include explicit duplicate/correction semantics for bucketed time-series results

Those improvements should be documented in a follow-up ADR or an update to
[ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
before implementation.

## Risks

- Wrong time-field configuration can drop valid data or request the wrong tail range.
- Late-arriving data can be missed without overlap.
- Some adapters may return corrected historical buckets; merge policy must handle overlap updates.
- Large retained windows can consume memory if many widgets run many unique queries.
- Query identity normalization must be stable or the runtime will miss cache reuse.
- Incremental graph updates must not override user zoom/pan unexpectedly.

## Implementation Tasks

- [ ] Add persisted Connection Query widget settings for incremental refresh mode.
- [ ] Add persisted Connection Query widget setting for `incrementalTimeField`.
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
