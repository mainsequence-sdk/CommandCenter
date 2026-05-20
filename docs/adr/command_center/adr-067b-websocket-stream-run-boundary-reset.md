# ADR 067-B: WebSocket Stream Run Boundary Reset

- Status: Accepted
- Date: 2026-05-20
- Related:
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 046: WebSocket Stream Survivability And Reconnect Supervision](./adr-046-websocket-stream-survivability-and-reconnect-supervision.md)
  - [ADR 047: Workspace Runtime Data Reference Store](./adr-047-workspace-runtime-data-reference-store.md)
  - [ADR 049: Publication-Driven Seed/Live Runtime Reduction](./adr-049-publication-driven-seed-live-runtime-reduction.md)
  - [ADR 064: Variable References as Widget Graph Edges](./adr-064-variable-reference-graph-integration.md)
  - [ADR 068: Automatic Partial WebSocket Row Patching For Tabular Consumers](./adr-068-automatic-partial-websocket-row-patching-for-tabular-consumers.md)
  - [ADR 069: Variable-Driven WebSocket Stream Resubscription](./adr-069-websocket-stream-variable-resubscription.md)

## Context

Variable-backed WebSocket connection widgets now resubscribe when a referenced variable changes.

That fixes the subscription-start problem, but exposes a separate retained-state bug:

- the selected table row changes from one symbol to another
- the stream request/runtime key changes
- a new WebSocket subscription starts
- the new session still receives the previous subscription's retained runtime frame as
  `initialRuntimeState`
- the first snapshot or delta from the new subscription is accumulated onto the old symbol's rows
- downstream charts, graphs, tables, and OHLC widgets render mixed rows from different variable
  selections

The visible symptom is a chart that appears overwritten or distorted. For OHLC widgets, rows from
the previous symbol and the new symbol can share rendered timestamps, so the widget reports merged
rows and the price scale becomes invalid for the selected symbol.

This is not the same problem as ADR 068.

ADR 068 decides how to patch rows after the correct seed/live datasets are participating in one
run. This ADR decides when a stream run boundary must clear retained runtime state so old rows do
not contaminate the next run.

## Decision

### 1. Runtime Key Changes Are New Stream Runs

A change to the stream request identity is a hard run boundary.

Examples:

- referenced symbol changes from `BTCUSDT` to `ETHUSDT`
- query model changes
- connection changes
- time range changes when the query is time-range-aware
- public execution key changes

At that boundary, the new WebSocket session must not inherit the previous run's retained rows.

### 2. Reconnects Keep State, Resubscriptions Reset State

Reconnects inside the same runtime key may keep retained state because they represent the same
logical stream run.

Resubscriptions caused by a changed runtime key must reset retained state because they represent a
different logical stream run.

The runtime must keep these cases separate:

- same runtime key, socket reconnects: keep retained frame and resume token when supported
- different runtime key, variable/request changed: clear retained frame and start a new source run

### 3. Downstream Consumers Must See A Clean Transition

When a stream run boundary occurs, downstream consumers should not continue rendering the old
retained frame as if it belongs to the new variable.

The stream widget should publish an idle/loading lifecycle frame for the new request before the new
snapshot or delta arrives. That lets downstream widgets show a loading or waiting state rather than
mixing old and new data.

### 4. Runtime Data Refs Must Be Scoped By Run Identity

Runtime data refs already use the subscription key in their ref key. That is good, but the session
bootstrap path can still pass old retained state before the new subscription writes its own ref.

The implementation must ensure that:

- old refs are not used as the initial retained frame for a new runtime key
- old refs can remain in the store without affecting the new run
- downstream reduction signatures include enough run identity to avoid reusing stale combined refs

## Implementation Tasks

### Stream Widget Session Bootstrap

- [x] In `ConnectionStreamQueryWidget`, detect when `runtimeKey` changes from the previous
  mounted stream request.
- [x] Pass `initialRuntimeState: undefined` to
  `createConnectionStreamQueryWidgetRuntimeSession(...)` when the runtime key changed.
- [x] Preserve `initialRuntimeState` only for same-key reconnect/session reuse paths.
- [x] Publish a lifecycle frame for the new runtime key before the new stream emits retained data.
- [x] Ensure the lifecycle frame includes the new `sourceRunId` or a request-boundary marker so
  downstream consumers do not treat old state as current.

### Connection Stream Runtime Session

- [x] Add regression coverage proving a new subscription does not accumulate the previous
  subscription's retained frame.
- [x] Verify `ack` and `heartbeat` messages for a new run do not republish old retained rows.
- [x] Keep reconnect behavior unchanged: same-run reconnects may retain rows and resume tokens.
- [x] Ensure `snapshot` for a new run replaces retained rows instead of calling
  `accumulateSnapshotFrame(...)` with a previous run frame.
- [x] Ensure `delta` for a new run without retained state becomes the new retained seed for that
  run, not a patch over the previous run.

### Runtime Data Store And Ref Boundaries

- [x] Verify `storeTabularFrameRuntimeState(...)` writes stream runtime refs under the new
  subscription key.
- [x] Ensure old `RuntimeDataRef` objects are not reused when the runtime key changes.
- [x] Add runtime data store or stream tests proving old refs remain readable but are not selected
  by the new run.
- [x] Confirm no backend workspace persistence is affected by clearing frontend runtime state.

### Incremental Consumer And Downstream Widgets

- [x] Add incremental consumer coverage where `livePublication.sourceRunId` changes and the live
  frame contains a different symbol.
- [x] Assert downstream retained datasets do not contain rows from the previous variable after the
  new run publishes.
- [x] Add graph or OHLC coverage proving duplicate rendered timestamps from the old symbol do not
  survive a variable-driven stream restart.
- [x] Verify tables, graphs, OHLC widgets, and statistic widgets receive either loading/empty state
  or the new run's rows, never mixed old/new rows.

### Diagnostics

- [x] Add dev-only diagnostic logging around runtime-key changes while implementing the fix.
- [x] Log previous runtime key, next runtime key, previous sourceRunId, next sourceRunId, and
  whether retained state was cleared.
- [x] Remove or gate the diagnostics before completing the task so the console is not spammed.

### Documentation

- [x] Update `connection-stream-query` README/USAGE_GUIDANCE to document the run boundary rule.
- [x] Link this ADR from ADR 069 as the retained-state companion fix.
- [x] Keep ADR 068 focused on row patching and merge mapping after the correct run state exists.

## Contract Notes

This ADR does not require a backend workspace storage change.

It affects frontend runtime semantics only:

- variable/request changes reset retained stream state
- reconnects inside the same runtime key keep retained stream state
- downstream widgets should stop seeing stale rows from prior variable selections

## Consequences

### Positive

- Variable changes do not mix old and new stream rows.
- OHLC/chart widgets stop merging stale rows that share timestamps with the new selection.
- Reconnect survivability remains intact for same-run socket failures.
- ADR 068 can focus on row patching and merge mapping without also solving run-boundary cleanup.

### Negative

- During a variable-driven resubscription, widgets may briefly show loading/empty state instead of
  stale data.
- Tests must distinguish reconnect continuity from request-boundary resets.
