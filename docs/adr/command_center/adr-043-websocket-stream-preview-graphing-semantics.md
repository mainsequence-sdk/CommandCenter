# ADR 043: WebSocket Stream Preview And Graphing Semantics

- Status: Proposed
- Date: 2026-04-29
- Related:
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
  - Backend ADR 016: Binance WebSocket Market Streams
  - Backend ADR 017: WebSocket Ticket Auth For Bearer-Token SPA Clients

## Context

The generic `connection-stream-query` runtime is now able to open a query-shaped WebSocket
subscription and receive normalized `ConnectionQueryResponse` frames. The stream startup path is
working, but the current preview and graphing behavior is not sufficient for live market-data
inspection.

The current frontend behavior has two architectural problems:

1. Canonical stream runtime and preview graphing are coupled too tightly.
   - `snapshot` messages replace the retained stream frame.
   - `delta` messages merge into the retained stream frame.
   - This is correct for the source-widget runtime contract, but it is not sufficient for an
     Explore/test chart when the backend emits one-row snapshots for the latest observation.

2. Chart field selection for streamed tabular rows is under-specified.
   - Streamed connection frames do not publish explicit chart semantics today.
   - `ConnectionQueryResponsePreview` therefore falls back to generic numeric heuristics.
   - Those heuristics are too weak for streamed OHLC and trade rows. They do not know that OHLC
     should plot `openTime -> close`, or that trade streams should plot `time/eventTime -> price`.

As a result, a valid WebSocket subscription may appear to "not stream" because the preview chart
shows only one point or uses the wrong axes, even while rows are arriving correctly.

## Decision

Separate canonical stream runtime semantics from preview graphing semantics.

Canonical source-widget runtime behavior remains exactly as defined by ADR 041:

- `snapshot` replaces the canonical retained source frame.
- `delta` merges into the canonical retained source frame.
- downstream widgets continue consuming the canonical resolved source output through normal
  workspace bindings and `consumerState`

Explore and widget test-preview surfaces are allowed to maintain a separate preview-only
accumulation buffer for graphing. That preview buffer is diagnostic UI state, not canonical source
runtime state.

The frontend will also add explicit query-model preview graph hints so streamed connection models
can declare how their normalized tabular rows should be charted.

## Preview And Runtime Separation

Two different states are now explicit:

1. Canonical stream runtime state
   - owned by `connection-stream-query`
   - follows ADR 041 exactly
   - published to downstream widgets

2. Preview graph state
   - owned only by Explore / test-preview surfaces
   - may accumulate history across multiple stream messages
   - must never be written back as the source widget's canonical runtime output

This separation prevents preview conveniences from silently changing widget binding semantics.

## Preview Graph Hint Contract

Add frontend-owned preview metadata to query models.

```ts
export interface ConnectionQueryModel {
  id: string;
  label: string;
  description?: string;
  outputContracts: WidgetContractId[];
  defaultOutputContract?: ConnectionResponseContractId;
  defaultQuery?: Record<string, unknown>;
  controls?: string[];
  timeRangeAware?: boolean;
  supportsVariables?: boolean;
  supportsMaxRows?: boolean;
  stream?: ConnectionQueryStreamModel;
  preview?: ConnectionQueryPreviewModel;
}

export interface ConnectionQueryPreviewModel {
  graph?: ConnectionQueryGraphPreviewModel;
}

export interface ConnectionQueryGraphPreviewModel {
  xField: string;
  yField: string;
  groupField?: string;
  rowIdentityFields?: string[];
  preferredChartType?: "line" | "area" | "bar";
  maxRetainedRows?: number;
}
```

Rules:

- this metadata is frontend-owned authoring/rendering guidance
- it does not change backend query or stream request payloads
- it does not change the canonical `ConnectionQueryResponse` contract
- it is used as the authoritative preview graph mapping unless the normalized frame already carries
  `source.context.graphDefaults`

## Preview Rendering Precedence

When rendering a streamed preview, the frontend must choose chart semantics in this order:

1. frame-provided `source.context.graphDefaults`
2. query-model `preview.graph`
3. existing generic numeric fallback heuristics

This keeps normalized frame graph defaults authoritative when they exist, while still allowing
connection-owned frontend hints for adapters such as Binance.

## Preview Accumulation Semantics

Preview accumulation is only for Explore/test-preview graphing.

### Snapshot Messages

When a stream message is `snapshot`:

- canonical source runtime replaces the retained frame
- preview graph buffer may append or upsert rows into accumulated history
- if no `preview.graph.rowIdentityFields` are defined, the preview may fall back to replacing the
  graph buffer with the latest snapshot rows

### Delta Messages

When a stream message is `delta`:

- canonical source runtime merges the delta into retained rows
- preview graph buffer upserts incoming rows using `preview.graph.rowIdentityFields` when present
- if no identity fields are declared, preview falls back to appending delta rows

### Reset Behavior

The preview accumulation buffer must reset on:

- connection instance change
- query model change
- query payload change
- fixed-range change
- variables change
- explicit stop/restart of the preview session

The preview accumulation buffer may survive temporary reconnect attempts for the same subscription
key so the chart does not blank during reconnecting state.

### Retention

Preview accumulation must be bounded.

Rules:

- default to a row-count cap, not an unbounded array
- allow `preview.graph.maxRetainedRows` to override the shared default
- trimming preview history must not mutate canonical source runtime rows

The first implementation only requires row-count retention. Time-window retention can be added
later if needed.

## Binance Initial Mapping

The first implementation will ship explicit preview graph hints for the streamed Binance query
models.

### OHLC

For:

- `binance-spot-ohlc`
- `binance-usdm-futures-ohlc`

Use:

- `xField = openTime`
- `yField = close`
- `groupField = symbol`
- `rowIdentityFields = ["openTime", "symbol", "interval", "marketType"]`
- preferred chart type: `line`

This is a preview decision only. It does not introduce a candlestick-specific contract in the first
slice.

### Trades

For:

- `binance-spot-recent-trades`
- `binance-spot-aggregate-trades`
- `binance-usdm-futures-aggregate-trades`

Use:

- `xField = time`
- `yField = price`
- `groupField = symbol`
- `rowIdentityFields` based on the normalized trade id fields for that stream family

These fields align with the backend Binance normalization contract, which already emits streamed
trade rows with `time`, `price`, symbol metadata, and normalized id fields.

## Non-Goals

- Do not change the canonical source-widget WebSocket semantics defined in ADR 041.
- Do not require downstream widgets to consume preview-only history buffers.
- Do not add a provider-specific chart widget or provider-specific preview renderer.
- Do not persist preview accumulation buffers into workspace storage.
- Do not make preview graph history part of saved widget props or backend workspace payloads.

## Backend Contract Impact

No backend change is required for the first frontend implementation.

The backend may continue sending standard `ConnectionQueryResponse` frames with plain
`core.tabular_frame@v1` rows. The preview-layer accumulation buffer and query-model preview hints
are frontend-only concerns.

Optional future backend improvement:

- adapters may publish `source.context.graphDefaults` on streamed tabular frames when the backend
  has stronger domain knowledge
- when that happens, frontend preview rendering must prefer the backend frame metadata over local
  query-model preview hints

## Storage Contract Impact

No backend storage contract change is required for the first slice.

Preview accumulation state is ephemeral UI state only. It is not serialized into workspace,
widget, or binding storage.

The first implementation keeps query-model preview metadata local to the frontend runtime
definitions. It is not projected into the synced connection-type manifest, so no backend
connection-registry change is required for this slice.

## Implementation Tasks

- [x] Add frontend preview graph metadata types under `src/connections/types.ts`.
- [ ] Extend connection-type sync validation if preview metadata is included in the synced
  connection manifest.
- [x] Add preview graph hints for streamed Binance query models in
  `connections/binance/index.ts`.
- [x] Add a preview-only stream accumulation helper for Explore/test-preview surfaces.
- [x] Update `ConnectionStreamQueryTestPanel.tsx` to maintain bounded accumulated preview history.
- [x] Project preview graph hints into `source.context.graphDefaults` or an equivalent normalized
  preview path before calling `ConnectionQueryResponsePreview`.
- [x] Update `ConnectionQueryResponsePreview.tsx` to prefer frame metadata, then graph defaults,
  then query-model preview hints, then generic numeric fallback.
- [x] Add tests for snapshot accumulation, delta accumulation, retention trimming, and Binance OHLC
  field mapping.
- [x] Add tests confirming downstream source runtime semantics remain unchanged while preview
  accumulation changes only the diagnostic chart path.

## Consequences

Positive:

- WebSocket previews can visibly show a live updating chart even when the backend emits one-row
  snapshots.
- Stream graphing becomes explicit and repeatable instead of relying on weak numeric heuristics.
- Canonical widget runtime and downstream binding semantics stay stable.

Negative:

- Explore/test-preview logic becomes more stateful than request/response preview.
- Preview graph history may differ from the exact current canonical retained source frame.
- Connection definitions may need additional preview metadata maintenance for high-value streaming
  adapters such as Binance.
