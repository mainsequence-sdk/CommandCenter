# ADR: Query-Shaped WebSocket Streaming for Connections

- Status: Proposed
- Date: 2026-04-26
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)

## Context

Command Center connections already expose query models that return normalized
`ConnectionQueryResponse` frames. The core Connection Query widget turns those frames into one
canonical `core.tabular_frame@v1` output that downstream widgets bind to.

The current shared connection API also has a `ConnectionStreamRequest` and `openConnectionStream`
helper, but that path is channel-based and uses `EventSource`. It does not mirror
`ConnectionQueryRequest`, does not advertise stream support at the query-model level, and does not
define how streamed provider events become the same tabular contract that widgets already consume.

The desired architecture is a full streaming workflow:

```text
provider websocket -> backend connection adapter -> query-shaped Command Center websocket
  -> connection source runtime -> core.tabular_frame@v1 output
  -> downstream widgets through normal workspace bindings
```

Binance public market data is the first concrete target because it has natural provider streams for
tickers, trades, aggregate trades, and klines. Streaming must still be optional per connection type
and per query model. Many connectors will remain request-only.

## Decision

Add a query-shaped WebSocket streaming path as a sibling to the existing connection query path.

The stream request must reuse the standard connection query envelope wherever possible:

- stable connection instance uid
- selected query model through `query.kind`
- requested output contract
- optional variables and row limit
- connection-specific query payload rendered by the existing query editor

The stream response must preserve the same data contract as normal queries. A streamed snapshot or
delta carries a `ConnectionQueryResponse` whose frames use the same frame contracts, especially
`core.tabular_frame@v1`. Downstream widgets must not learn Binance-specific WebSocket payloads.

The existing `EventSource` helper should remain available for legacy channel streams. It is not the
new workspace dataflow path. Query-shaped streaming uses WebSockets because the frontend must send a
structured subscription request, receive acknowledgements and data frames, close intentionally, and
eventually support resume tokens or subscription updates.

## Non-Goals

- Do not replace `queryConnection` or remove request/response query models.
- Do not expose provider-native Binance websocket messages to widgets.
- Do not create connector-specific widget binding contracts.
- Do not require every connection type to implement streaming.
- Do not use browser-to-provider WebSockets for backend-owned connections.
- Do not make frontend runtime state or WebSocket sessions durable across page reloads.

## Frontend Contracts

### Connection Query Model Metadata

Extend query model metadata so streaming is advertised by the selected query model, not only by the
connection type.

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
}

export interface ConnectionQueryStreamModel {
  transport: "websocket";
  modes: Array<"snapshot" | "delta">;
  defaultMode?: "snapshot" | "delta";
  supportsResume?: boolean;
  heartbeatMs?: number;
  description?: string;
}
```

Rules:

- A connection type with streamable paths must include `stream` in `capabilities`.
- A query model is streamable only when `queryModel.stream` exists.
- Query models can advertise normal query execution and streaming at the same time.
- `outputContracts` remain authoritative for both request and stream execution.

### Stream Request

The frontend WebSocket client sends this JSON message after opening the socket:

```ts
export interface ConnectionStreamQueryRequest<TQuery = Record<string, unknown>> {
  connectionUid: string;
  query: TQuery;
  requestedOutputContract?: ConnectionResponseContractId;
  timeRange?: {
    from: string;
    to: string;
  };
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
  streamMode?: "snapshot" | "delta";
  resumeToken?: string;
  clientRequestId?: string;
}

export interface ConnectionStreamSubscribeMessage<TQuery = Record<string, unknown>> {
  type: "subscribe";
  request: ConnectionStreamQueryRequest<TQuery>;
}
```

The initial frontend implementation may send only one `subscribe` message per socket. Future
versions can add an `update` message for changing query payloads without reconnecting, but this ADR
does not require that behavior.

### Stream Response Frames

Every backend WebSocket message must be JSON and must match this envelope.

```ts
export type ConnectionStreamServerMessage =
  | ConnectionStreamAckMessage
  | ConnectionStreamDataMessage
  | ConnectionStreamHeartbeatMessage
  | ConnectionStreamErrorMessage
  | ConnectionStreamCompleteMessage;

export interface ConnectionStreamAckMessage {
  type: "ack";
  connectionUid: string;
  queryKind: string;
  sequence: number;
  acceptedAt: string;
  traceId?: string;
  heartbeatMs?: number;
  resumeToken?: string;
}

export interface ConnectionStreamDataMessage {
  type: "snapshot" | "delta";
  connectionUid: string;
  queryKind: string;
  sequence: number;
  emittedAt: string;
  response: ConnectionQueryResponse;
  traceId?: string;
  resumeToken?: string;
  warnings?: string[];
}

export interface ConnectionStreamHeartbeatMessage {
  type: "heartbeat";
  sequence: number;
  emittedAt: string;
  traceId?: string;
}

export interface ConnectionStreamErrorMessage {
  type: "error";
  sequence: number;
  emittedAt: string;
  code: string;
  message: string;
  retryable: boolean;
  traceId?: string;
  details?: Record<string, unknown>;
}

export interface ConnectionStreamCompleteMessage {
  type: "complete";
  sequence: number;
  emittedAt: string;
  reason?: string;
  traceId?: string;
}
```

Rules:

- `sequence` is monotonically increasing per socket.
- `snapshot` replaces the retained source frame.
- `delta` merges into the retained source frame and attaches `widget-runtime-update@v1`.
- `response.frames[]` must follow the standard `ConnectionQueryResponse` frame rules.
- Error messages must not expose credentials, provider secrets, raw cache keys, or internal stack
  traces.

### Workspace Runtime Behavior

Streaming source execution should publish the same `core.tabular_frame@v1` output as the current
Connection Query widget.

The implementation can either extend Connection Query with a runtime mode or introduce a separate
Connection Stream source widget. The preferred first implementation is a separate source widget if
the UI becomes materially different from request execution, because long-lived socket lifecycle,
reconnect state, and stream health are different from one-shot query execution.

Regardless of widget shape:

- widget props store `ConnectionRef`, `queryModelId`, query payload, output contract, stream mode,
  and bounded retention/merge settings
- widget props must not store provider URLs, tokens, or backend route fragments
- mounted runtime owns opening and closing the socket
- socket messages update widget runtime state through the normal runtime-state write path
- downstream widgets bind through the same output id and contract semantics as request-based
  sources
- delta-aware widgets read `upstreamBase`, `upstreamDelta`, and `upstreamUpdate`

## Backend Contracts

### Generic Route

Add a backend-owned WebSocket endpoint for connection instances:

```text
GET /connections/instances/{uid}/stream-query/
```

The concrete URL can follow the deployed backend route prefix, but the route semantics are:

1. Authenticate the browser session before accepting subscription messages.
2. Resolve connection instance `{uid}`.
3. Resolve the connection type manifest and runtime adapter.
4. Validate that the connection type has `stream` capability.
5. Validate that `request.connectionUid` matches the path `{uid}`.
6. Validate `request.query.kind`.
7. Validate that the selected query model advertises `stream.transport = "websocket"`.
8. Validate `requestedOutputContract` against the selected query model `outputContracts`.
9. Run the same organization/user/object permission checks as `query/`.
10. Start the adapter stream and normalize provider events into stream envelopes.

If validation fails after the socket is accepted, send an `error` message followed by a `complete`
message and close with a normal or policy close code. If authentication fails before upgrade, reject
the upgrade with the normal HTTP auth response.

### Adapter Interface

Backend connection adapters should expose a streaming operation separate from one-shot query
execution:

```ts
export interface ConnectionBackendAdapter {
  query?(request: ConnectionQueryRequest): Promise<ConnectionQueryResponse>;
  streamQuery?(
    request: ConnectionStreamQueryRequest,
    context: ConnectionRuntimeContext,
  ): AsyncIterable<ConnectionStreamDataMessage | ConnectionStreamHeartbeatMessage>;
}
```

Backend implementations do not need to use TypeScript. The DTO names and JSON shapes in this ADR
are normative.

Adapter rules:

- reuse query validators where possible
- reject unknown or unsupported stream query kinds
- enforce configured connection public and secure config before opening provider streams
- normalize provider reconnects into stable Command Center messages where safe
- emit heartbeat messages when no data has arrived within the negotiated heartbeat window
- close provider sockets when the browser disconnects or the server cancels the operation
- cap subscriptions, symbols, and per-connection concurrent streams according to backend limits

### Result Contract

Streamed data frames use the same backend DTOs as request queries:

```ts
export interface ConnectionQueryResponse {
  frames: CommandCenterFrame[];
  warnings?: string[];
  traceId?: string;
}
```

Required invariants:

- Every `snapshot` and `delta` data message must include at least one frame matching the selected
  query model's advertised output contract.
- `core.tabular_frame@v1` remains the first implementation target.
- Field names must be stable for one subscription unless the backend sends a `snapshot` with a
  schema-change warning.
- Backends should include `meta.source` with connection uid, connection type id, query model id,
  query kind, provider, market type, and symbol metadata when available.
- Provider timestamps must be converted to ISO strings or epoch milliseconds consistently with the
  existing standardized result contract.

### Authentication

The frontend cannot set arbitrary headers on the browser `WebSocket` constructor. The backend must
choose and document one supported auth pattern:

- same-site authenticated cookie for the WebSocket upgrade, or
- short-lived stream launch token obtained over authenticated HTTP before opening the socket.

Bearer token query parameters are not the preferred long-term contract because URLs can leak
through logs. If a launch token is used, it must be short lived, single purpose, scoped to the
connection uid and query kind when possible, and rejected after expiry.

### Close Codes

Backends should use standard WebSocket close behavior:

- `1000`: normal client/server close
- `1001`: server shutdown or navigation away
- `1008`: policy violation, auth failure after upgrade, permission failure, unsupported query
- `1011`: unexpected backend/provider failure

For retryable provider errors, prefer a structured `error` message with `retryable: true` before
closing.

## Binance Backend Contract

The first adapter should be `type_id = "finance.binance-market-data"`.

### Streamable Query Kinds

The backend should support these mappings first:

- `binance-spot-prices`
  - provider stream: spot ticker or mini ticker streams
  - output: rows with `observedAt`, `symbol`, `price`, `marketType`, `provider`, `quoteAsset`
- `binance-spot-recent-trades`
  - provider stream: spot trade streams
  - output: trade rows with event/trade timestamps, symbol, trade id, price, quantity, side hints
- `binance-spot-aggregate-trades`
  - provider stream: spot aggregate trade streams
  - output: aggregate trade rows
- `binance-spot-ohlc`
  - provider stream: spot kline streams
  - output: kline rows with `openTime`, `closeTime`, `symbol`, `interval`, OHLCV fields, and
    completion flag
- `binance-usdm-futures-prices`
  - provider stream: USD-M futures ticker or mark/price stream selected by backend contract
  - output: price rows
- `binance-usdm-futures-recent-trades`
  - provider stream: USD-M trade streams
  - output: trade rows
- `binance-usdm-futures-aggregate-trades`
  - provider stream: USD-M aggregate trade streams
  - output: aggregate trade rows
- `binance-usdm-futures-ohlc`
  - provider stream: USD-M kline streams
  - output: kline rows

### Binance Validation

The backend must:

- reject spot streams when `public_config.marketTypes` does not include `spot`
- reject USD-M futures streams when `public_config.marketTypes` does not include `usdm_futures`
- normalize symbols to Binance uppercase symbol form
- validate symbols against cached exchange-info metadata when practical
- apply symbol-count limits before opening provider streams
- apply configured default interval and default limit only where meaningful for stream bootstrap
- ignore completed-result cache settings for live provider streams
- keep in-flight dedupe separate from live subscription sharing unless a backend fan-out layer is
  explicitly implemented

### Binance Snapshot And Delta Rules

The first data message should be a `snapshot` when the backend can provide a bootstrap value. After
that, provider events should emit `delta` messages.

For kline streams:

- open/in-progress candles may emit multiple deltas with the same merge key
- the recommended merge key is `["openTime", "symbol", "interval", "marketType"]`
- completed candles should carry a boolean field such as `isFinal`

For trade streams:

- the recommended merge key is provider trade id plus symbol and market type
- trade rows are append-oriented

For price streams:

- the recommended merge key is `["observedAt", "symbol", "marketType"]` for event history, or
  `["symbol", "marketType"]` if the source widget is configured as a latest-price table

## Implementation Tasks

### Frontend Contracts

- [ ] Add stream metadata types to `ConnectionQueryModel`.
- [ ] Add query-shaped stream request and server message types under `src/connections/types.ts`.
- [ ] Add `streamQueryUrl` to command-center config typing and YAML defaults.
- [ ] Add a WebSocket client helper in `src/connections/api.ts`.
- [ ] Keep the existing `EventSource` stream helper intact for legacy channel streams.
- [ ] Add a React hook or runtime helper that opens a query WebSocket, parses messages, and closes
      reliably on unmount or request changes.
- [ ] Add frontend validation that only streamable query models can enter streaming mode.
- [ ] Add tests for URL construction, subscribe payload construction, message parsing, and close
      handling.

### Registry And Metadata Sync

- [ ] Project `ConnectionQueryModel.stream` through connection type sync payloads.
- [ ] Bump `CONNECTION_REGISTRY_VERSION`.
- [ ] Validate synced stream metadata shape before sending manifests.
- [ ] Update backend registry models so synced query models can store and return stream metadata.
- [ ] Confirm hydrated runtime definitions preserve stream metadata from local definitions.

### Workspace Source Runtime

- [ ] Decide whether to extend Connection Query or add a separate Connection Stream source widget.
- [ ] Store stream source props without credentials or provider route fragments.
- [ ] Reuse existing connection query editors for streamable query payloads.
- [ ] Normalize streamed `ConnectionQueryResponse` frames through the existing tabular conversion
      path.
- [ ] Convert `snapshot` messages into full runtime-state replacement.
- [ ] Convert `delta` messages into retained-frame merges with `widget-runtime-update@v1`.
- [ ] Expose stream lifecycle status in runtime state: idle, connecting, live, reconnecting, error,
      closed.
- [ ] Ensure downstream widgets receive normal resolved inputs through existing binding resolution.
- [ ] Add tests for snapshot replacement, delta merge, schema mismatch, and socket cleanup.

### Explore And Authoring UI

- [ ] Show stream controls only when the selected query model advertises stream metadata.
- [ ] Add a stream test action to the shared connection workbench or a dedicated stream workbench.
- [ ] Preview streamed frames through `ConnectionQueryResponsePreview`.
- [ ] Show connection status, last sequence, last emitted time, heartbeat, and errors.
- [ ] Prevent saved widgets from switching to stream mode when the selected query model is not
      streamable.

### Backend Generic Runtime

- [ ] Add the authenticated WebSocket route for connection instance query streams.
- [ ] Implement upgrade/auth policy using cookie auth or a short-lived launch token.
- [ ] Resolve connection instance and adapter on subscribe.
- [ ] Validate connection type `stream` capability and query model stream metadata.
- [ ] Reuse query permission checks and object-level adapter checks.
- [ ] Emit `ack`, `snapshot`/`delta`, `heartbeat`, `error`, and `complete` envelopes.
- [ ] Normalize all stream data to `ConnectionQueryResponse`.
- [ ] Add per-user, per-organization, per-connection, and global stream concurrency limits.
- [ ] Add server cancellation cleanup for browser disconnects.
- [ ] Add structured logs and trace ids without leaking provider payload secrets.
- [ ] Add backend tests for validation errors, permission failures, provider failure, heartbeat,
      cancellation, and frame normalization.

### Binance Adapter

- [ ] Add Binance `streamQuery` support for price, trade, aggregate trade, and kline stream kinds.
- [ ] Enforce configured `marketTypes` for every stream.
- [ ] Validate and normalize requested symbols.
- [ ] Map configured query kinds to spot and USD-M provider WebSocket endpoints.
- [ ] Convert provider events to `core.tabular_frame@v1` frames.
- [ ] Emit bootstrap `snapshot` where practical and `delta` for later events.
- [ ] Include stable metadata for provider, market type, symbol, interval, and event time.
- [ ] Document Binance stream merge-key recommendations in connection usage guidance and README.
- [ ] Add backend tests with mocked provider WebSocket events.

### Documentation And Maintenance

- [ ] Update `src/connections/README.md` with the query-shaped WebSocket contract.
- [ ] Update the owning source widget README once the widget shape is chosen.
- [ ] Update `connections/binance/README.md` and `usageGuidance`.
- [ ] Update backend adapter documentation for generic stream route semantics.
- [ ] Add an operations note for WebSocket limits, timeouts, and proxy/load-balancer behavior.

## Storage And Backend Contract Impact

This is a backend contract change.

Frontend persisted widget props may change if stream mode is added to a widget. Connection type
metadata changes because query models need stream metadata. Backend registry storage must preserve
that metadata. Backend runtime contracts change because a new WebSocket endpoint and adapter
operation are required.

The published widget output contract should remain `core.tabular_frame@v1`. Downstream widgets
should not need persisted schema changes as long as they already consume the shared runtime update
contract for deltas or fall back to the retained snapshot.

## Open Questions

- Should the first frontend implementation extend Connection Query or ship a separate Connection
  Stream source widget?
- Which WebSocket auth pattern should the backend standardize on for deployed Command Center:
  same-site cookies or short-lived launch tokens?
- Should the backend provide subscription fan-out for identical Binance streams, or should each
  browser subscription open its own provider stream at first?
- Should `streamMode = "delta"` require frontend merge-key settings, or should adapters provide
  model-level recommended merge keys in stream metadata?
