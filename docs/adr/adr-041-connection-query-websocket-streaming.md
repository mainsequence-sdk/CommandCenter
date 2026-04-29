# ADR 041: Query-Shaped WebSocket Streaming for Connections

- Status: Proposed
- Date: 2026-04-28
- Related:
  - Backend ADR 017: WebSocket Ticket Auth For Bearer-Token SPA Clients
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Incremental In-Memory Connection Response Refresh](./adr-incremental-connection-response-refresh.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR 038: Progressive Workspace Initial Rendering and Per-Widget Hydration](./adr-038-progressive-workspace-widget-hydration.md)
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - [ADR 040: Dashboard Surface Return Hydration](./adr-040-dashboard-surface-return-hydration.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)
  - [ADR: Shared Connection Authoring Contract](./adr-connection-authoring-contract.md)

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
  -> downstream widgets through normal workspace bindings and consumerState
```

Binance public market data is the first concrete target because it has natural provider streams for
tickers, trades, aggregate trades, and klines. Streaming must still be optional per connection type
and per query model. Many connectors will remain request-only.

## Decision

Add a query-shaped WebSocket streaming path as a sibling to the existing connection query path.

The stream request must reuse the standard connection query envelope wherever possible:

- stable connection instance id (`ConnectionRef.id`, which may be a numeric backend id or a
  backend connection instance id)
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

Workspace streaming will ship as a separate generic `connection-stream-query` source widget, not as
a Binance-specific widget and not as a second Binance connection type or instance. The same
configured connection instance can therefore be used by both source widgets:

```text
connection-query        -> POST /api/v1/command_center/connections/{id}/query/
connection-stream-query -> WS   /api/v1/command_center/connections/{id}/stream-query/
```

The separate source widget owns WebSocket-only runtime concerns such as connection lifecycle,
heartbeat/reconnect status, retained stream frames, snapshot replacement, delta merge behavior, and
stream-specific settings. It still reuses the shared connection picker, query model metadata,
connection-specific query editors, output contracts, and downstream binding semantics.

## Non-Goals

- Do not replace `queryConnection` or remove request/response query models.
- Do not expose provider-native Binance websocket messages to widgets.
- Do not create connector-specific widget binding contracts.
- Do not create a second Binance connection type or require users to configure a separate
  connection instance just because a query path streams.
- Do not require every connection type to implement streaming.
- Do not use browser-to-provider WebSockets for backend-owned connections.
- Do not make frontend runtime state or WebSocket sessions durable across page reloads.
- Do not make passive consumer widgets open connection WebSockets or call connection runtime APIs
  directly.

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
  connectionId: ConnectionId;
  query: TQuery;
  requestedOutputContract?: ConnectionResponseContractId;
  timeRange?: {
    from: string;
    to: string;
  };
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
  resumeToken?: string;
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
  connectionId: ConnectionId;
  queryKind: string;
  sequence: number;
  acceptedAt: string;
  traceId?: string;
  heartbeatMs?: number;
  resumeToken?: string;
}

export interface ConnectionStreamDataMessage {
  type: "snapshot" | "delta";
  connectionId: ConnectionId;
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

Use a separate generic `connection-stream-query` source widget for the WebSocket execution path.
Do not extend the existing `connection-query` widget with a stream mode for the first
implementation. The two widgets share connection authoring primitives, but they own different
runtime state machines:

- `connection-query` owns one-shot request/response execution through
  `POST /api/v1/command_center/connections/{id}/query/`
- `connection-stream-query` owns long-lived WebSocket execution through
  `WS /api/v1/command_center/connections/{id}/stream-query/`

Regardless of widget shape:

- widget props store `ConnectionRef`, `queryModelId`, query payload, output contract, and bounded
  retention/merge settings
- widget props must not store provider URLs, tokens, or backend route fragments
- mounted runtime owns opening and closing the socket
- socket messages update widget runtime state through the normal runtime-state write path
- downstream widgets bind through the same output id and contract semantics as request-based
  sources
- downstream widgets render from the shared `ResolvedUpstreamConsumerState` exposed by
  `useResolvedTabularWidgetSourceBinding(...)` or equivalent source helpers
- delta-aware widgets read `upstreamBase`, `upstreamDelta`, and `upstreamUpdate` from resolved
  inputs, not from source-widget-specific runtime metadata

### Relationship To Upstream Consumer State

`ADR 039` is now the mounted-consumer boundary. It explicitly keeps source-owner widgets such as
`connection-query` outside the upstream-consumer contract, while requiring passive consumers to
render from a shared consumer-state object.

Query-shaped streaming follows that same boundary:

- the streaming source widget is a source owner
- visible widgets such as Graph, Table, Statistic, OHLC Bars, and Debug Stream remain passive
  consumers
- passive consumers must keep using `consumerState.kind`, `consumerState.dataset`,
  `consumerState.deltaDataset`, and `consumerState.requiresUpstreamResolution`
- passive consumers must not inspect socket lifecycle fields or infer readiness from raw source
  runtime state, row count, or column count
- the streaming source must publish explicit `loading`, `ready`, `error`, and completed empty
  states so the shared consumer-state resolver can distinguish `awaiting-upstream`, `loading`,
  `empty`, and `error`

This matters for streaming because a live socket may be connected while no provider data has arrived
yet, may reconnect while retained data is still usable, or may close after publishing an error.
Those states belong to the source runtime and should be projected into the canonical source output;
they should not become a second widget-consumer state machine.

### Relationship To Managed Sources And Hydration

Managed connection sources remain normal hidden source widgets. If a visible consumer uses embedded
connection authoring and later opts into streaming, the managed source still owns the WebSocket and
the visible consumer still receives data only through the normal `sourceData` binding.

Streaming must also respect the `ADR 038` and `ADR 040` hydration model:

- initial workspace hydration and dashboard-surface return hydration remain owned by the shared
  execution provider
- passive consumer remounts must not create duplicate WebSockets
- hidden managed streaming sources may stay mounted for runtime publication, but their socket
  lifecycle must not be coupled to visible consumer remounts
- `useResolveWidgetUpstream(...)` continues to be a passive-consumer resolution request, not a
  direct streaming subscription API

### Relationship To Shared Connection Authoring

Stream authoring must be added to the shared connection authoring surfaces. It should not re-create
per-connection Explore wrappers.

The stream controls should live in the same shared authoring path that now handles normal
connection queries:

- `ConnectionExploreSurface`
- `ConnectionQueryWorkbench` or a sibling shared stream workbench
- `ConnectionQuerySettingsSurface` and managed-connection settings
- typed connection `queryEditor` components for query-payload fields

Connection-specific stream defaults, query-model filtering, labels, and source summaries should use
the shared authoring contract rather than widget-local defaults.

Even when the stream widget reuses the same typed `queryEditor` component as the one-shot query
widget, the shared authoring surface must stay transport-aware:

- stream settings resolve draft defaults only against streamable query models
- the connection picker filters to stream-capable connections
- path labels, path descriptions, runtime labels, and row-limit copy describe WebSocket
  subscription semantics rather than HTTP request/response semantics

## Backend Contracts

### Generic Route

Add a backend-owned WebSocket endpoint for connection instances.

The frontend opens this with the WebSocket protocol:

```text
ws://<host>/api/v1/command_center/connections/{id}/stream-query/
wss://<host>/api/v1/command_center/connections/{id}/stream-query/
```

At the HTTP layer the WebSocket handshake is still an HTTP `GET` upgrade request for:

```text
GET /api/v1/command_center/connections/{id}/stream-query/
Upgrade: websocket
Connection: Upgrade
```

The current Command Center frontend default follows the existing connection route prefix:

```text
/api/v1/command_center/connections/{id}/stream-query/
```

`streamQueryUrl` uses `{id}` as the route placeholder. The frontend fills it from
`ConnectionRef.id` / `ConnectionStreamQueryRequest.connectionId`.

That `GET` is not a normal REST endpoint. Frontend code must not call it with `fetch`, React Query,
or the existing `requestJson(...)` helper. It must use `new WebSocket(...)` against a `ws://` or
`wss://` URL.

The concrete path can follow the deployed backend route prefix, but the route semantics are:

1. Authenticate the browser session before accepting subscription messages.
2. Resolve connection instance `{id}` from the configured route template.
3. Resolve the connection type manifest and runtime adapter.
4. Validate that the connection type has `stream` capability.
5. Validate that `request.connectionId` matches the path connection identifier.
6. Validate `request.query.kind`.
7. Validate that the selected query model advertises `stream.transport = "websocket"`.
8. Validate `requestedOutputContract` against the selected query model `outputContracts`.
9. Run the same organization/user/object permission checks as `query/`.
10. Start the adapter stream and normalize provider events into stream envelopes.

If validation fails after the socket is accepted, send an `error` message followed by a `complete`
message and close with a normal or policy close code. If authentication fails before upgrade, reject
the upgrade with the normal HTTP auth response.

### Frontend URL Resolution

The frontend config should store:

- `connections.instances.streamQueryUrl`, a route template such as:

```text
/api/v1/command_center/connections/{id}/stream-query/
```

- `auth.websocketTicketUrl`, defaulting to:

```text
/auth/websocket-ticket/
```

or an absolute WebSocket URL when the deployment requires a different host. The WebSocket client
helper owns scheme resolution:

- `https://` API origins become `wss://`
- `http://` API origins become `ws://`
- explicitly configured `wss://` or `ws://` origins are used as-is
- configured `https://` or `http://` absolute stream URLs are accepted only as deployment input and
  converted before opening the socket

The connection stream client should build the URL, open the socket, wait for `open`, then send the
JSON `subscribe` message. Query payloads should not be encoded into the URL except for a short-lived
handshake ticket query parameter when the backend requires browser WebSocket ticket auth.

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
- Backends should include `meta.source` with connection id, connection type id, query model id,
  query kind, provider, market type, and symbol metadata when available.
- Provider timestamps must be converted to ISO strings or epoch milliseconds consistently with the
  existing standardized result contract.

### Authentication

Browser SPA callers use the accepted backend ticket-auth flow from backend ADR 017.

Because the browser `WebSocket` constructor cannot attach arbitrary `Authorization` headers, the
frontend must:

1. `POST /auth/websocket-ticket/` over normal authenticated HTTP using the existing bearer JWT.
2. Receive `{ ticket, ticketType, audience, expiresAt }`.
3. Open the query WebSocket route with `?ws_ticket=<ticket>`.
4. Send the normal JSON `subscribe` payload after the socket opens.

Concrete SPA handshake flow:

```text
POST /auth/websocket-ticket/
Authorization: Bearer <access-token>

WS /api/v1/command_center/connections/{id}/stream-query/?ws_ticket=<ticket>
```

Required rules:

- do not send long-lived bearer tokens in the WebSocket URL
- do not persist handshake tickets in widget props, runtime state, or saved workspace payloads
- treat tickets as short-lived handshake-only secrets
- allow same-site session-cookie auth to remain as a backend fallback path, but standard SPA
  streaming uses the ticket flow

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

Backend ADR 016 is now authoritative for the first public Binance stream slice.
The frontend manifest should advertise only these query kinds as streamable:

- `binance-spot-ohlc`
  - provider stream: spot kline streams
  - output: kline rows with `openTime`, `closeTime`, `symbol`, `interval`, OHLCV fields, and
    completion flag
- `binance-spot-recent-trades`
  - provider stream: spot trade streams
  - output: trade rows with event/trade timestamps, symbol, trade id, price, quantity, side hints
- `binance-spot-aggregate-trades`
  - provider stream: spot aggregate trade streams
  - output: aggregate trade rows
- `binance-usdm-futures-aggregate-trades`
  - provider stream: USD-M aggregate trade streams
  - output: aggregate trade rows
- `binance-usdm-futures-ohlc`
  - provider stream: USD-M kline streams
  - output: kline rows

The backend may implement additional internal provider channel normalizers such as ticker,
mini-ticker, book ticker, or mark price, but those are backend-private until a public query model
is explicitly published as streamable.

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

## Implementation Tasks

### Frontend Contracts

- [x] Add stream metadata types to `ConnectionQueryModel`.
- [x] Add query-shaped stream request and server message types under `src/connections/types.ts`.
- [x] Add `streamQueryUrl` to command-center config typing and YAML defaults as a WebSocket route
      template, not a fetch endpoint.
- [x] Add `auth.websocketTicketUrl` to command-center auth config and mint short-lived WebSocket
      tickets before opening browser stream-query sockets.
- [x] Add a WebSocket client helper in `src/connections/api.ts`.
- [x] Add WebSocket URL resolution from `http`/`https` API origins to `ws`/`wss` stream URLs.
- [x] Keep the existing `EventSource` stream helper intact for legacy channel streams.
- [x] Add a React hook or runtime helper that opens a query WebSocket, parses messages, and closes
      reliably on unmount or request changes.
- [x] Add frontend validation that only streamable query models can enter streaming mode.
- [x] Add tests for URL construction, `ws`/`wss` scheme conversion, subscribe payload construction,
      message parsing, and close handling.

### Registry And Metadata Sync

- [x] Project `ConnectionQueryModel.stream` through connection type sync payloads.
- [x] Bump `CONNECTION_REGISTRY_VERSION`.
- [x] Validate synced stream metadata shape before sending manifests.
- [x] Update backend registry models so synced query models can store and return stream metadata.
- [x] Confirm hydrated runtime definitions preserve stream metadata from local definitions.

### Workspace Source Runtime

- [x] Decide whether to extend Connection Query or add a separate Connection Stream source widget.
      Decision: add a separate generic `connection-stream-query` source widget.
- [x] Store stream source props without credentials or provider route fragments.
- [x] Reuse existing connection query editors for streamable query payloads.
- [x] Normalize streamed `ConnectionQueryResponse` frames through the existing tabular conversion
      path.
- [x] Convert `snapshot` messages into full runtime-state replacement.
- [x] Convert `delta` messages into retained-frame merges with `widget-runtime-update@v1`.
- [x] Expose stream lifecycle status in runtime state: idle, connecting, live, reconnecting, error,
      closed.
- [x] Project source lifecycle into canonical output status so the shared upstream consumer-state
      resolver can distinguish awaiting publication, loading, ready, empty, and error without
      row-count heuristics.
- [x] Ensure downstream widgets receive normal resolved inputs through existing binding resolution.
- [x] Ensure downstream widgets continue using `consumerState` from shared source-binding helpers
      instead of socket-specific runtime metadata.
- [x] Ensure passive consumer remounts, initial hydration, and dashboard-surface return hydration do
      not create duplicate WebSocket subscriptions.
- [x] Ensure managed streaming sources remain normal hidden source widgets with canonical bindings
      to their visible owner consumers.
- [x] Add tests for snapshot replacement, delta merge, schema mismatch, and socket cleanup.

### Explore And Authoring UI

- [x] Show stream controls only when the selected query model advertises stream metadata.
- [x] Add a stream test action to the shared connection workbench or a dedicated shared stream
      workbench.
- [x] Preview streamed frames through `ConnectionQueryResponsePreview`.
- [x] Show connection status, last sequence, last emitted time, heartbeat, and errors.
- [x] Prevent saved widgets from switching to stream mode when the selected query model is not
      streamable.
- [x] Route stream defaults, query-model filtering, source summaries, labels, and run copy through
      the shared connection authoring contract instead of per-connection Explore wrappers.
- [x] Include stream controls in managed-connection settings when the owning consumer uses embedded
      connection authoring.

### Backend Generic Runtime

- [x] Add the authenticated WebSocket upgrade route for connection instance query streams.
- [x] Implement SPA ticket-auth over `POST /auth/websocket-ticket/` plus `?ws_ticket=...`, while
      keeping same-site session-cookie auth as a backend fallback.
- [x] Resolve connection instance and adapter on subscribe.
- [x] Validate connection type `stream` capability and query model stream metadata.
- [x] Reuse query permission checks and object-level adapter checks.
- [x] Emit `ack`, `snapshot`/`delta`, `heartbeat`, `error`, and `complete` envelopes.
- [x] Normalize all stream data to `ConnectionQueryResponse`.
- [x] Add per-user, per-organization, per-connection, and global stream concurrency limits.
- [x] Add server cancellation cleanup for browser disconnects.
- [x] Add structured logs and trace ids without leaking provider payload secrets.
- [x] Add backend tests for validation errors, permission failures, provider failure, heartbeat,
      cancellation, and frame normalization.

### Binance Adapter

- [x] Add Binance `streamQuery` support for the backend-approved streamable trade, aggregate trade,
      and kline query kinds.
- [x] Enforce configured `marketTypes` for every stream.
- [x] Validate and normalize requested symbols.
- [x] Map configured query kinds to spot and USD-M provider WebSocket endpoints.
- [x] Convert provider events to `core.tabular_frame@v1` frames.
- [x] Emit bootstrap `snapshot` where practical and `delta` for later events.
- [x] Include stable metadata for provider, market type, symbol, interval, and event time.
- [x] Document Binance stream merge-key recommendations in connection usage guidance and README.
- [x] Add backend tests with mocked provider WebSocket events.

### Documentation And Maintenance

- [x] Update `src/connections/README.md` with the query-shaped WebSocket contract.
- [x] Update the owning source widget README once the widget shape is chosen.
- [x] Update `connections/binance/README.md` and `usageGuidance`.
- [ ] Update backend adapter documentation for generic stream route semantics.
- [ ] Add an operations note for WebSocket limits, timeouts, and proxy/load-balancer behavior.

## Storage And Backend Contract Impact

This is a backend contract change.

Frontend persisted widget props change because streaming sources store retained-frame merge settings
instead of a request-only runtime contract. Connection type metadata changes because query models
need stream metadata. Backend registry storage must preserve that metadata. Backend runtime
contracts change because a new WebSocket endpoint and adapter operation are required.

The published widget output contract should remain `core.tabular_frame@v1`. Downstream widgets
should not need persisted schema changes as long as they already consume the shared runtime update
contract for deltas or fall back to the retained snapshot.

The upstream-consumer architecture from `ADR 039` remains the consumer boundary. This ADR does not
add a backend schema for consumer state. It does require streaming source widgets to publish enough
frontend runtime status for `ResolvedUpstreamConsumerState` to remain accurate. If streaming is
available through managed connection sources, the additive managed-source storage from the managed
connection ADR remains the persistence boundary; the visible consumer still stores only its
authoring mode and binding metadata.

## Open Questions

- Should the backend provide subscription fan-out for identical Binance streams, or should each
  browser subscription open its own provider stream at first?
- When a streamable query model emits deltas, should adapters also publish model-level recommended
  merge keys in stream metadata?
- During provider reconnects with retained data, should the source publish `loading` with retained
  rows or keep `ready` plus stream lifecycle diagnostics so consumers avoid unnecessary loading
  transitions?
