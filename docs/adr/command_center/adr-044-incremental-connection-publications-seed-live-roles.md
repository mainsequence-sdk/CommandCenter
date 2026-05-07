# ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles

- Status: Proposed
- Date: 2026-04-29
- Related:
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)

## Context

The current WebSocket source architecture is too stateful at the source layer.

Today `connection-stream-query` normalizes incoming frames, retains rows in its own runtime state,
and republishes a canonical dataset from that retained state. Downstream widgets then try to apply
their own rolling windows on top of an already-growing retained dataset.

That is the wrong ownership split for live data:

- stream sources should own transport, subscription lifecycle, and frame normalization
- stream sources should not own chart history, rolling queues, or consumer-specific retention
- widgets should not branch on WebSocket vs HTTP transport
- widgets should consume one shared publication model based on the same tabular frame contracts

There is also a composition requirement the current model does not satisfy cleanly:

- one widget may need one historical seed source
- and one live incremental source
- both should feed the same reducer without transport-specific widget code

HTTP also needs to remain valid in this model. A `connection-query` execution is not a streaming
transport, but it may still publish incremental batches that initialize or update the same
consumer reducer used by live sources. That existing HTTP incremental capability must not regress.

## Decision

Unify connection-source consumption around incremental publications and explicit consumer roles.

Live-capable widgets will expose two explicit logical inputs:

- `seedData`
- `liveUpdates`

Users must bind those roles intentionally. We are not introducing an implicit "many sources on one
input" model in this ADR.

Connection sources will publish one of two output shapes:

- `dataset`: retained canonical dataset for legacy retained-data consumers
- `updates`: incremental publication stream for live-capable consumers

The important rule is that transport no longer defines consumer behavior.

- HTTP query sources may publish seed and update batches
- WebSocket query sources publish incremental live batches continuously
- consumer widgets use the same shared reducer path for both

## Scope

This ADR defines the frontend publication and consumer contract for connection-backed widgets.

In scope:

- connection source outputs
- live-capable widget input roles
- shared incremental reducer semantics
- backward compatibility for existing retained-dataset workflows
- migration away from source-owned WebSocket history

Out of scope:

- backend route changes
- provider-specific frame formats
- generic many-source ordering metadata on one input
- transport-specific widget implementations

## Source Publication Model

### 1. Retained dataset output stays for legacy consumers

`connection-query` keeps its existing retained `dataset` output.

That output continues to support current widgets and workspaces that consume one canonical retained
`core.tabular_frame@v1` dataset through one source binding.

This retained path remains valid for:

- existing widgets that only know `sourceData`
- one-shot query workflows
- non-live consumers that do not need incremental composition

### 2. Add an explicit incremental `updates` output

Connection sources that can participate in live composition publish an `updates` output.

`updates` is the canonical incremental publication path for:

- `connection-query`
- `connection-stream-query`
- future source widgets that can emit incremental tabular updates

The `updates` carrier still uses the same tabular frame contracts. What changes is the publication
envelope attached through `widget-runtime-update@v1`.

Representative additive contract:

```ts
type IncrementalPublicationRole = "seed" | "update";

interface WidgetRuntimeUpdateEnvelope<TRetainedOutput = unknown, TDeltaOutput = unknown> {
  contractVersion: "widget-runtime-update@v1";
  mode: "delta";
  publicationSemantics: "incremental";
  publicationRole: IncrementalPublicationRole;
  sourceRunId: string;
  sequence?: number;
  sourceWidgetId?: string;
  sourceOutputId?: string;
  outputContractId?: string;
  deltaOutput?: TDeltaOutput;
  diagnostics?: Record<string, unknown>;
}
```

Rules:

- the `updates` output always publishes `mode: "delta"`
- the difference between initialization and live mutation is `publicationRole`, not transport
- `sourceRunId` changes when the source execution resets semantically, for example a new HTTP
  query execution or a new WebSocket subscription with different query parameters
- `sourceRunId` stays stable while one logical execution lineage is still advancing, for example
  successive HTTP incremental update batches for the same retained run or successive WebSocket
  messages for one active subscription
- HTTP sources may emit:
  - one seed publication only
  - repeated seed publications on re-execution
  - true update publications when the existing HTTP execution path already computes or receives
    incremental changes
- bounded transport buffers are allowed for reconnect, ordering, or heartbeat handling, but they
  are not the published widget history model

### 3. WebSocket stream sources stop owning retained consumer history

`connection-stream-query` should not be the owner of downstream history windows.

Its steady-state architecture becomes:

- open and close the WebSocket
- validate lifecycle
- normalize incoming `ConnectionQueryResponse` frames
- publish each normalized batch to `updates`

It may keep a small non-published transport buffer when required for reconnect or sequence
handling, but it must not be the authoritative owner of:

- plotted point history
- table rolling row windows
- statistics accumulation windows
- large retained canonical datasets for downstream consumers

If a temporary compatibility bridge is needed for old workspaces that still bind to
`connection-stream-query.dataset`, that bridge is transitional and must not define the long-term
architecture.

## Widget Input Roles

Live-capable widgets add two explicit logical inputs:

- `seedData`
- `liveUpdates`

These roles are semantic, not transport-specific.

### `seedData`

Purpose:

- initialize local consumer state
- reset local state when the bound seed source changes materially

Accepted source shapes:

- retained `dataset` output from a legacy or one-shot source
- incremental `updates` output with `publicationRole: "seed"`

### `liveUpdates`

Purpose:

- apply ongoing incremental changes after initialization

Accepted source shape:

- explicit `updates` output only

The binding UI should not silently reinterpret arbitrary retained outputs as live updates.

## Shared Reducer Model

Widgets must not implement one consumer path for HTTP and another for WebSockets.

They should use one shared incremental reducer with this behavior:

1. retained `seedData` is adapted into one synthetic `seed` publication
2. incremental `seedData` publications initialize or replace local state
3. incremental `liveUpdates` publications mutate local state
4. widget-local policies then decide bounded retention, queue trimming, or replacement

That yields one shared model for graph, table, statistic, and similar live-capable widgets:

- source owns publication
- shared reducer owns seed/update semantics
- widget owns local bounded view policy

Examples:

- graph owns max visible points per series
- table owns max visible rows or pinned row policy
- statistic owns latest-value or bounded aggregation policy

None of those policies should live in the WebSocket connection source.

## HTTP Integration

HTTP remains valid as an incremental publisher.

`connection-query` should therefore support both:

- `dataset`: existing retained canonical result
- `updates`: incremental publications with `publicationRole: "seed"` and/or
  `publicationRole: "update"` depending on the execution strategy

This allows the same widget to consume:

- a historical HTTP seed through `seedData`
- live updates from another source through `liveUpdates`

without inventing transport-specific widget logic.

Important compatibility rule:

- existing retained-data consumers may keep using `dataset`
- new incremental consumers may use `seedData <- dataset` or `seedData <- updates`
- `liveUpdates` must bind to explicit `updates`

Supported HTTP incremental shapes include:

- snapshot-only execution that emits a seed batch
- repeated execution that emits new seed batches
- existing HTTP incremental execution that already emits update batches
- future snapshot-diff or cursor-based HTTP execution that emits update batches

This ADR preserves the current ability for HTTP-backed sources to participate in incremental widget
updates. It does not redefine HTTP as seed-only.

## WebSocket Integration

`connection-stream-query` becomes a delta passthrough source.

Its public consumer contract is:

- normalize every backend WebSocket message into standard tabular frame contracts
- publish those normalized batches through `updates`
- mark the first initializing batch as `publicationRole: "seed"` when appropriate
- mark later live batches as `publicationRole: "update"`

This means downstream consumers only care about:

- seed publication
- update publication

They do not care whether the source transport is:

- WebSocket
- HTTP
- future polling or resume-driven execution

## Binding And Authoring Rules

For the first slice, live-capable widgets use two explicit roles instead of one polymorphic input.

Rules:

- users bind `seedData` intentionally
- users bind `liveUpdates` intentionally
- UI must make those roles explicit
- UI must not hide role selection behind transport-specific widget copy
- `liveUpdates` without `seedData` is allowed when the live source itself publishes an initial
  `seed` publication

Existing single-input retained workflows remain valid and do not require immediate rebinding.

## Backward Compatibility

This ADR is additive for retained HTTP workflows and intentional for new live workflows.

Backward-compatible parts:

- existing `connection-query.dataset` behavior stays valid
- existing widgets that only consume retained `sourceData` can keep doing so
- existing HTTP incremental behavior stays valid on `updates`
- HTTP can join the new live model without losing either its retained-data role or its current
  incremental-publication capability

Intentional migration areas:

- live-capable widgets need new `seedData` and `liveUpdates` ports
- `connection-stream-query.dataset` should be treated as deprecated once `updates` is available
- existing workspaces that bind a live stream source as if it were a retained dataset will need a
  migration path or compatibility bridge

## Storage And Backend Contract Impact

This ADR implies frontend storage and widget-registry changes.

Frontend and backend-synced widget contract impact:

- live-capable widget IO definitions will change by adding `seedData` and `liveUpdates`
- source-widget output ids will change or expand by adding `updates`
- persisted workspace bindings may now store explicit seed/live role bindings
- shared binding UI and dependency-resolution helpers will need to understand the new ports and
  output ids
- backend widget-type validation and persisted-workspace validation must accept the new widget IO
  contract after registry republish; frontend load normalization migrates legacy `sourceData`
  bindings for migrated widgets, but backend-saved workspace payloads must not reject
  `seedData`, `liveUpdates`, or `updates` references once the new registry is published

Connection runtime / backend API impact:

- no backend route change is required by this ADR
- no provider-specific payload change is required if the frontend can continue normalizing the
  backend `ConnectionQueryResponse` frames it already receives
- if the frontend needs explicit backend reset semantics later, that should be a separate backend
  contract task instead of being assumed here

## Completion Checklist

ADR 044 should not be considered complete until all of the following are done.

### Shared publication contract

- [x] Extend `widget-runtime-update@v1` with additive incremental-publication fields, at minimum:
  `publicationSemantics`, `publicationRole`, and `sourceRunId`.
- [x] Keep the existing runtime-update envelope backward compatible for current retained and
  incremental consumers during migration.
- [x] Define and document the reset semantics for `sourceRunId`, including HTTP re-execution,
  WebSocket resubscription, and query-parameter changes.
- [x] Add tests for runtime-update parsing and mapping so `seed` and `update` publications survive
  normalization and rebinding.

### Connection Query (HTTP)

- [x] Preserve the current `connection-query.dataset` retained output exactly for legacy widgets.
- [x] Keep `connection-query.updates` compatible with current HTTP incremental behavior.
- [x] Make the HTTP incremental envelope explicit so HTTP executions can publish
  `publicationRole: "seed"` and `publicationRole: "update"` without changing consumer contracts.
- [x] Verify that current HTTP incremental query paths still work without rebinding existing
  workspaces.
- [x] Add tests for:
  - [x] snapshot-only HTTP seed publication
  - [x] repeated HTTP execution publishing new seed batches
  - [x] existing HTTP incremental update publication remaining valid

### Connection Stream Query (WebSocket)

- [ ] Refactor `connection-stream-query` so its canonical live output is `updates`, not
  source-owned retained history.
- [x] Keep transport lifecycle handling in the source widget, including connect, reconnect,
  heartbeat, close, and error state.
- [ ] Stop using the source widget as the long-term owner of chart history, table row queues, or
  statistics windows.
- [x] Define any temporary compatibility bridge for `connection-stream-query.dataset` explicitly as
  transitional.
- [ ] Add tests for:
  - [x] first WebSocket batch published as `seed` when appropriate
  - [x] subsequent WebSocket batches published as `update`
  - [ ] reconnect/resubscribe resets `sourceRunId` correctly
  - [ ] source-side retained history is not required for ongoing downstream updates

### Widget IO and consumer roles

- [x] Add explicit `seedData` and `liveUpdates` inputs to live-capable widgets, starting with
  graph, table, and statistic.
- [x] Keep existing single-input retained widget flows working for widgets that have not migrated to
  the dual-role model.
- [x] Ensure `seedData` accepts retained `dataset` and incremental `updates` seed publications.
- [x] Ensure `liveUpdates` accepts only explicit `updates` outputs and does not silently reinterpret
  retained datasets.
- [x] Add widget IO tests covering:
  - [x] `seedData <- dataset`
  - [x] `seedData <- updates`
  - [x] `liveUpdates <- updates`
  - [x] rejection of invalid `liveUpdates <- dataset` bindings

### Shared reducer

- [x] Build one shared reducer for live-capable widgets that adapts retained seed inputs and
  incremental update inputs onto one internal state model.
- [x] Make that reducer transport-agnostic so widgets do not branch on HTTP vs WebSocket.
- [x] Define reducer behavior for:
  - [x] initial seed with no prior state
  - [x] replacement seed with prior state
  - [x] update batches after seed
  - [x] update batches arriving before any seed
  - [x] reset on `sourceRunId` change
- [x] Add reducer tests covering seed replacement, update application, out-of-order reset, and
  empty-batch behavior.

### Binding UI and authoring

- [x] Update the binding UI so live-capable widgets expose `seedData` and `liveUpdates`
  explicitly.
- [x] Force the user to select the logical role intentionally instead of hiding the distinction in
  transport-specific copy.
- [x] Keep the existing retained-source binding UX working for non-live widgets and legacy inputs.
- [x] Add binding-panel tests verifying that:
  - [x] `seedData` can bind to retained HTTP outputs
  - [x] `liveUpdates` can bind to HTTP or WS `updates` outputs
  - [x] invalid bindings are rejected cleanly
  - [x] rebinding does not clear stable draft selections

### Migration and compatibility

- [x] Define migration handling for existing workspaces that currently bind
  `connection-stream-query.dataset`.
- [ ] Decide whether that migration is:
  - [x] automatic workspace normalization
  - [ ] compatibility shim at runtime
  - [ ] explicit rebind guidance for old workspaces
- [x] Confirm that adding `seedData` and `liveUpdates` does not break backend-synced widget IO
  contracts without the required registry/version updates.
- [x] Document any required backend coordination if widget registry payloads or persisted binding
  semantics change.

### Documentation and maintenance

- [x] Update widget `README.md` and `USAGE_GUIDANCE.md` files for every migrated live-capable
  widget.
- [x] Update connection documentation so `dataset` vs `updates` and `seed` vs `update` semantics
  are clear for both HTTP and WS sources.
- [x] Update shared workspace/binding documentation to describe the two-role model.
- [x] Reconcile ADR 041 and related docs so they no longer describe `connection-stream-query` as
  the owner of long-term retained consumer history.

### Final acceptance

- [ ] One widget can bind:
  - [ ] `seedData` from a historical HTTP query
  - [ ] `liveUpdates` from a WebSocket query
  - [ ] and continue updating indefinitely without source-owned history growth
- [ ] One widget can bind `liveUpdates` from an HTTP incremental source without any WebSocket path.
- [ ] Graph/table/statistic consumers continue updating through one shared reducer path rather than
  transport-specific code.
- [ ] Existing retained HTTP workspaces still render without forced rebinding.

## Non-Goals

- Do not make widgets branch on Binance vs non-Binance streams.
- Do not require separate widget implementations for HTTP and WebSocket sources.
- Do not keep large retained live history in connection sources just to make downstream graphs
  easier to render.
- Do not collapse `seedData` and `liveUpdates` into one many-source input in this first slice.
