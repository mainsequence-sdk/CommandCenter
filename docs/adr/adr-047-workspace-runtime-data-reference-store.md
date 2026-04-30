# ADR 047: Workspace Runtime Data Reference Store

- Status: Partially Implemented
- Date: 2026-04-30
- Related:
  - [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)

## Context

Workspace widgets currently pass tabular data by value through runtime state, binding resolution,
and widget consumer state.

That model is not scalable for either WebSocket streams or large HTTP query results.

The current high-cost path is:

```text
connection source receives rows
  -> source runtimeState stores rows
  -> output resolver returns rows by value
  -> dependency resolver stores rows on resolved inputs
  -> consumer widget runtimeState may store merged rows
  -> source.context may store seed/live frames
  -> workspace runtime-state writer clones/stringifies rows
```

For streaming market data this explodes quickly because every tick can copy a growing array through
several layers. For HTTP queries the same architecture also creates large unnecessary clones when a
query returns many rows, when several widgets consume the same source, or when HTTP incremental
refresh publishes repeated batches.

Retention caps are useful operational limits, but they do not fix the underlying ownership problem.
The correct model is:

```text
source writes data once into a workspace runtime data store
  -> source output publishes a small data reference
  -> binding resolver passes references and versions
  -> consumers read bounded views from the store
  -> widget runtimeState stores metadata, not row arrays
```

This ADR defines the long-term architecture for that model. It applies to both HTTP and WebSocket
connection sources.

## Decision

Add a workspace-scoped runtime data reference store.

The store owns large runtime datasets in memory. Widget runtime state, source outputs, binding
resolution, and incremental publication envelopes must pass stable references plus version metadata
instead of passing full row arrays by value.

Connection sources become runtime data producers:

- `connection-query` writes HTTP snapshots and HTTP incremental batches into the store
- `connection-stream-query` writes WebSocket snapshots and deltas into the store
- future polling, cursor, and local transform sources use the same store APIs

Consumer widgets become runtime data readers:

- graph reads a bounded latest-point view
- table reads a page or rolling row window
- statistic reads latest rows or an aggregation window
- transforms read source refs and publish transformed refs

The data store is transport-neutral. HTTP is not treated as a second-class seed-only path. HTTP
snapshots, repeated refreshes, and true HTTP incremental updates all publish refs through the same
contract used by WebSocket streams.

## Goals

- Store large tabular datasets once per workspace runtime session.
- Pass references and version metadata through widget outputs and resolved inputs.
- Support both HTTP and WebSocket connection sources.
- Keep `seedData` and `liveUpdates` semantics from ADR 044.
- Preserve existing retained HTTP workflows through a compatibility materialization path.
- Prevent workspace JSON persistence from cloning or storing live row arrays.
- Allow multiple widgets to consume one source without duplicating the dataset per consumer.
- Make widget limits real data-view limits, not only render limits.

## Non-Goals

- Do not persist the runtime data store to the backend workspace JSON.
- Do not make source widgets keep long-term chart/table/statistic history.
- Do not make widgets branch on HTTP versus WebSocket transport.
- Do not expose provider-native stream payloads to widgets.
- Do not require every legacy widget to migrate in the first implementation slice.
- Do not remove by-value `core.tabular_frame@v1` compatibility before migrated consumers exist.

## Runtime Data References

Add a serializable reference object.

Representative shape:

```ts
export interface RuntimeDataRef {
  kind: "runtime-data-ref";
  refId: string;
  workspaceRuntimeId: string;
  ownerId: string;
  contractId: WidgetContractId;
  version: number;
  rowCount?: number;
  schemaSignature?: string;
  updatedAtMs?: number;
}

export interface RuntimeTabularFrameRef extends RuntimeDataRef {
  contractId: "core.tabular_frame@v1";
  columns: string[];
  fields?: TabularFrameFieldSchema[];
  status?: "idle" | "loading" | "ready" | "error";
  error?: string;
}
```

Rules:

- `refId` identifies data inside the current mounted workspace runtime store.
- `workspaceRuntimeId` prevents stale refs from another workspace session being treated as live.
- `version` increments whenever the referenced data changes.
- refs are small and may appear in runtime state, resolved inputs, and update envelopes.
- refs are not durable data. If a workspace reloads and the store does not contain `refId`, the
  source must republish or the consumer must show `awaiting-upstream` / `loading`.
- rows never live inside `RuntimeDataRef`.

## Runtime Data Store

Add a workspace-scoped provider and store.

Representative API:

```ts
interface RuntimeDataStore {
  putSnapshot(input: {
    ownerId: string;
    outputId: string;
    frame: TabularFrameSourceV1;
    refKey?: string;
  }): RuntimeTabularFrameRef;

  applyDelta(input: {
    ownerId: string;
    outputId: string;
    baseRef?: RuntimeTabularFrameRef;
    deltaFrame: TabularFrameSourceV1;
    mergeKeyFields: string[];
    retention?: RuntimeRetentionPolicy;
    refKey?: string;
  }): {
    outputRef: RuntimeTabularFrameRef;
    deltaRef: RuntimeTabularFrameRef;
    operations: WidgetRuntimeUpdateOperations;
  };

  combine(input: {
    ownerId: string;
    outputId: string;
    seedRef?: RuntimeTabularFrameRef;
    liveRef?: RuntimeTabularFrameRef;
    mergeKeyFields: string[];
    retention?: RuntimeRetentionPolicy;
  }): RuntimeTabularFrameRef;

  readFrame(ref: RuntimeTabularFrameRef): TabularFrameSourceV1 | null;

  readRows(ref: RuntimeTabularFrameRef, selector?: RuntimeRowSelector): Array<Record<string, unknown>>;

  subscribe(ref: RuntimeDataRef, listener: RuntimeDataListener): () => void;

  releaseOwner(ownerId: string): void;
}
```

The provider must be scoped to a mounted workspace/dashboard runtime, not to the whole browser
process forever.

The store owns:

- row arrays
- snapshot replacement
- delta merge
- seed/live union
- keyed dedupe
- row-window retention
- ref versions
- subscriber notification
- owner cleanup

The store does not own:

- provider WebSocket lifecycle
- connection credentials
- persisted workspace JSON
- widget-specific visual projection

## Source Publication Model

### HTTP connection query

`connection-query` must write query results into the runtime data store.

For a normal HTTP snapshot:

```text
HTTP response frame
  -> store.putSnapshot(...)
  -> dataset output publishes RuntimeTabularFrameRef
  -> updates output publishes a seed publication with retainedOutputRef
```

For HTTP incremental refresh:

```text
HTTP incremental batch
  -> store.applyDelta(...)
  -> updates output publishes deltaOutputRef and outputRef
```

HTTP remains fully valid in the incremental model:

- one-shot HTTP query can publish a seed ref
- repeated HTTP execution can publish replacement seed refs
- HTTP cursor/polling/diff execution can publish update refs
- retained HTTP consumers can still materialize a bounded frame for compatibility

### WebSocket connection stream query

`connection-stream-query` must write every normalized stream frame into the runtime data store.

For a stream snapshot:

```text
WebSocket snapshot frame
  -> store.putSnapshot(...)
  -> updates output publishes seed publication with retainedOutputRef
```

For a stream delta:

```text
WebSocket delta frame
  -> store.applyDelta(...)
  -> updates output publishes deltaOutputRef and outputRef
```

`connection-stream-query` runtime state keeps lifecycle metadata only:

- stream status
- connection status
- sequence
- last message time
- heartbeat time
- reconnect diagnostics
- current dataset ref metadata
- last delta ref metadata

It must not store retained rows in `runtimeState`.

## Runtime Update Envelope

Extend `widget-runtime-update@v1` additively with ref fields.

Representative shape:

```ts
interface WidgetRuntimeUpdateEnvelope<TRetainedOutput = unknown, TDeltaOutput = unknown> {
  contractVersion: "widget-runtime-update@v1";
  mode: "snapshot" | "delta";
  publicationSemantics?: "incremental";
  publicationRole?: "seed" | "update";
  sourceRunId?: string;
  sequence?: number;

  retainedOutput?: TRetainedOutput;
  deltaOutput?: TDeltaOutput;

  retainedOutputRef?: RuntimeDataRef;
  deltaOutputRef?: RuntimeDataRef;
  outputRef?: RuntimeDataRef;

  operations?: WidgetRuntimeUpdateOperations;
  diagnostics?: Record<string, unknown>;
}
```

Rules:

- new HTTP and WebSocket connection paths must prefer refs
- `updates` must not package a full retained base by value when a ref is available
- by-value fields remain only for compatibility and small non-ref-backed publishers
- consumers that understand refs must read `retainedOutputRef`, `deltaOutputRef`, and `outputRef`
  before falling back to by-value fields

## Binding Resolution

Extend resolved inputs additively.

Representative shape:

```ts
interface ResolvedWidgetInput {
  value?: unknown;
  upstreamBase?: unknown;
  upstreamDelta?: unknown;
  upstreamUpdate?: WidgetRuntimeUpdateEnvelope;

  valueRef?: RuntimeDataRef;
  upstreamBaseRef?: RuntimeDataRef;
  upstreamDeltaRef?: RuntimeDataRef;
}
```

Rules:

- binding resolution passes refs without materializing full rows
- ref-aware widgets use refs directly
- non-ref-aware widgets receive a compatibility materialized frame
- compatibility materialization must be bounded and explicit
- binding compatibility still uses widget contracts and output ids, not transport names

## Incremental Consumer Model

The shared incremental tabular consumer must stop storing full frames in serializable metadata.

Remove this shape from consumer metadata:

```ts
seedFrame?: TabularFrameSourceV1 | null;
liveFrame?: TabularFrameSourceV1 | null;
```

Replace with refs and signatures:

```ts
interface IncrementalTabularConsumerMeta {
  mode: "incremental-tabular-consumer";
  seedRef?: RuntimeTabularFrameRef | null;
  liveRef?: RuntimeTabularFrameRef | null;
  outputRef?: RuntimeTabularFrameRef | null;
  lastSeedSignature?: string;
  lastSeedSourceRunId?: string;
  lastLiveSignature?: string;
  lastLiveSourceRunId?: string;
  liveMergeKeyFields?: string[];
}
```

Rules:

- seed/live merge happens in the runtime data store
- consumer runtime state stores metadata and refs only
- no full row arrays may be stored under `source.context.incrementalConsumer`
- sourceRunId reset semantics from ADR 044 still apply

## Widget View Policies

Widgets read bounded views from refs.

Examples:

- graph reads latest N projected points per series
- table reads current page or latest N rows
- statistic reads latest row, selected aggregation window, or selected scalar projection
- OHLC reads latest N bars per symbol/interval
- transform widgets read input refs and publish output refs

The key rule is that widget display limits must become data-view limits. A graph max-points setting
cannot only cap rendering while upstream row arrays keep growing in memory.

## Runtime State And Persistence

Workspace runtime state may store refs and small metadata. It must not store large live datasets.

Allowed:

```ts
{
  status: "ready",
  streamStatus: "live",
  sequence: 1234,
  datasetRef: {
    kind: "runtime-data-ref",
    refId: "...",
    version: 42,
    rowCount: 1000
  }
}
```

Not allowed:

```ts
{
  status: "ready",
  rows: [/* live stream history */]
}
```

The workspace runtime-state writer must compare ref identity/version metadata instead of
`JSON.stringify` on full materialized frames.

If a ref-backed runtime state is hydrated without a matching store entry, the UI must treat it as
not currently published and wait for the owning source to republish.

## Managed Sources And Subscription Sharing

Managed hidden sources remain valid, but they must not force duplicated data storage.

The runtime data store deduplicates identical ref keys inside a workspace. A later implementation
may additionally dedupe physical WebSocket subscriptions by normalized subscription identity:

```text
connectionId + queryModelId + normalizedQuery + timeRange + requestedOutputContract
```

Subscription dedupe is useful, but it is separate from the mandatory data-store ref architecture.
The first correctness requirement is that repeated consumers do not receive cloned row arrays.

## Compatibility

Compatibility materialization is allowed while widgets migrate.

Rules:

- old consumers that only accept by-value `core.tabular_frame@v1` may receive a materialized frame
- materialization must be bounded and should be treated as a compatibility path
- ref-aware widgets must not request materialized full history
- `connection-query.dataset` remains valid for existing HTTP workspaces
- `connection-stream-query.dataset` remains a transitional compatibility output, not the long-term
  stream consumption model

## Storage And Backend Contract Impact

The runtime data store itself is frontend-only and in-memory.

No backend data route is required for the first implementation.

However, this ADR affects frontend-synced widget contracts:

- widget IO may advertise ref-aware behavior
- shared runtime-update metadata gains additive ref fields
- resolved input shape gains additive ref fields
- widget usage guidance and backend-synced registry metadata must explain ref-backed incremental
  consumption when widgets migrate

If a new formal widget contract id is introduced, such as `core.runtime_data_ref@v1`, then the
backend widget registry and workspace validation must accept it before synced widgets rely on it.

Safer first implementation path:

- keep existing `core.tabular_frame@v1` output compatibility
- add runtime ref metadata as additive frontend runtime fields
- migrate ref-aware widgets to prefer refs
- materialize bounded by-value frames only for legacy consumers

## Implementation Plan

### Runtime data store

- [x] Add `runtime-data-store.ts` with `RuntimeDataRef`, `RuntimeTabularFrameRef`, store APIs,
  retention policy types, and row selector types.
- [x] Add a workspace-scoped `RuntimeDataStoreProvider`.
- [x] Mount the provider at dashboard/workspace execution boundaries.
- [x] Add owner cleanup on connection-source widget unmount and stream source
  query/path changes.
- [x] Add store tests for snapshot replacement, delta merge, keyed dedupe, row-window retention,
  stale ref handling, and owner release.
- [ ] Add subscriber notification tests if a subscribed store API is introduced.

### Runtime update and binding contracts

- [x] Extend `widget-runtime-update@v1` with `retainedOutputRef`, `deltaOutputRef`, and `outputRef`.
- [x] Extend `ResolvedWidgetInput` with `valueRef`, `upstreamBaseRef`, and `upstreamDeltaRef`.
- [x] Update dependency resolution so refs propagate without materializing full rows on identity bindings.
- [x] Add compatibility materialization for non-ref-aware consumers.
- [x] Add tests proving ref-backed outputs do not place rows on resolved inputs unless
  compatibility materialization is explicitly requested.

### Connection Query HTTP

- [x] Refactor `connection-query` so HTTP snapshots write to the runtime data store.
- [x] Publish HTTP `dataset` as a ref-backed output for ref-aware consumers.
- [x] Publish HTTP `updates` with seed/update refs according to ADR 044 semantics.
- [x] Preserve existing retained HTTP workspace behavior through compatibility materialization.
- [ ] Add tests for one-shot HTTP seed refs, repeated HTTP refresh replacement, HTTP incremental
  update refs, and legacy materialized `dataset` consumers.

### Connection Stream Query WebSocket

- [x] Refactor `connection-stream-query` so runtime state stores lifecycle metadata and refs only.
- [x] Write WebSocket snapshots and deltas into the runtime data store.
- [x] Publish `updates` with `deltaOutputRef` and `outputRef`, not full retained output by value.
- [x] Keep `dataset` only as transitional compatibility output.
- [ ] Add tests proving WebSocket runtime state and updates envelopes do not carry retained row
  arrays.

### Shared incremental consumer

- [x] Replace stored `seedFrame` and `liveFrame` metadata with `seedRef`, `liveRef`, and
  `outputRef`.
- [ ] Move seed/live merge into the runtime data store.
- [x] Keep sourceRunId reset behavior from ADR 044.
- [x] Ensure HTTP and WebSocket updates use the same reducer path.
- [x] Add tests for seed replacement, live delta merge, seed plus live union, sourceRunId reset,
  and absence of row arrays in consumer metadata.

### Widget migration

- [ ] Migrate graph to read bounded latest-point views from refs.
- [ ] Migrate table to read bounded row windows/pages from refs.
- [ ] Migrate statistic to read latest row or aggregation-window views from refs.
- [ ] Migrate OHLC to read bounded bar windows from refs.
- [ ] Update migrated widget README and `USAGE_GUIDANCE.md` files.
- [ ] Add widget tests proving view limits constrain store reads, not only rendering.

### Runtime persistence

- [ ] Update workspace runtime-state writing so ref-backed states are compared by ref metadata and
  version.
- [ ] Prevent clone/stringify of materialized row arrays on live update paths.
- [ ] Ensure hydrated stale refs resolve to awaiting publication instead of stale data.
- [ ] Add tests for runtime-state persistence with refs and stale-ref hydration.

### Optional subscription dedupe

- [ ] Add a normalized subscription identity helper for WebSocket streams.
- [ ] Share physical WebSocket subscriptions for identical managed stream sources inside one
  workspace runtime when safe.
- [ ] Keep logical output refs separate when consumers require different retention/view policies.
- [ ] Add tests proving multiple consumers can share one stream without duplicate sockets or
  duplicate retained row stores.

## Acceptance Criteria

- HTTP and WebSocket connection sources both publish through the runtime data store.
- Large row arrays are not stored in widget runtime state, resolved inputs, or update envelopes on
  ref-aware paths.
- A graph can bind one HTTP seed source and one WebSocket live source, update indefinitely, and keep
  memory bounded by its selected view policy.
- A widget can bind HTTP incremental updates without using WebSockets.
- Multiple widgets can consume the same source data without each receiving a cloned retained frame.
- Existing retained HTTP workspaces continue rendering through compatibility materialization.
- Workspace JSON does not persist live stream row history.
- Tests prove the absence of by-value retained rows in the new ref-backed paths.
