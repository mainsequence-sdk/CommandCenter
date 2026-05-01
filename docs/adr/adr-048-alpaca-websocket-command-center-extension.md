# ADR 048: Alpaca WebSocket Market Data Frontend Extension

- Status: Proposed
- Date: 2026-04-30
- Related:
  - Backend ADR 018: Alpaca Market Data Adapter Supports WebSocket Streams
  - Backend ADR 011: Alpaca Market Data Adapter
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
  - [ADR 046: WebSocket Stream Survivability And Reconnect Supervision](./adr-046-websocket-stream-survivability-and-reconnect-supervision.md)
  - [ADR 047: Workspace Runtime Data Reference Store](./adr-047-workspace-runtime-data-reference-store.md)

## Context

The backend Alpaca adapter now extends the existing `finance.alpaca-market-data`
connection type with query-shaped WebSocket streaming through the generic route:

```text
WS /api/v1/command_center/connections/<connectionId>/stream-query/
```

The browser still sends the normal Command Center query-shaped subscribe
message. It must not speak Alpaca provider channels, provider auth messages, or
provider WebSocket URLs directly.

The current frontend Alpaca connection definition is REST-only. It advertises:

- top-level capabilities: `query`, `resource`, `health-check`
- HTTP query models for historical and latest equity/crypto data
- public config fields for REST base URLs, REST feeds/locations, timeout, cache,
  and dedupe policy
- secure config fields `apiKeyId` and `apiSecretKey`

Backend ADR 018 explicitly leaves one frontend task open:

- update the frontend connection type manifest so
  `finance.alpaca-market-data` advertises top-level `stream` and
  `queryModels[].stream.transport=websocket` for supported live query kinds.

## Decision

Extend the existing Alpaca frontend connection module. Do not create a second
Alpaca connection type, a provider-specific stream widget, or an Alpaca-only
Explore wrapper.

The frontend connection id remains:

```ts
finance.alpaca-market-data
```

The first frontend slice adds explicit WebSocket-only query models:

- `alpaca-equity-live-trades`
- `alpaca-equity-live-quotes`
- `alpaca-equity-live-bars`
- `alpaca-crypto-live-trades`
- `alpaca-crypto-live-quotes`
- `alpaca-crypto-live-bars`

Existing REST query models remain HTTP-only. We must not mark the REST latest
or historical query models as dual transport. Live WebSocket paths are separate
query models because they have different lifecycle, retry, provider session,
and subscription semantics.

## Non-Goals

- Do not add direct browser-to-Alpaca WebSockets.
- Do not expose Alpaca provider channel names as public UI choices.
- Do not add Alpaca trading account streams, Broker API streams, order updates,
  options, news, orderbooks, LULD, or market status events in the first slice.
- Do not use `timeRange`, `pageToken`, `sort`, or HTTP `limit` as live
  subscription fields.
- Do not add a second Alpaca connection instance type for WebSockets.
- Do not bypass `connection-stream-query`, `ConnectionQueryWorkbench`, or the
  shared connection authoring contract.

## Frontend Contract

### Connection capabilities

Update the connection definition:

```ts
capabilities: ["query", "resource", "health-check", "stream"]
```

The connection remains `accessMode: "proxy"`. Browser code still uses backend
generic connection routes.

### Public config additions

Add optional WebSocket public config fields. Existing instances remain valid
when these fields are absent because the backend supplies defaults.

```ts
export interface AlpacaPublicConfig {
  dataBaseUrl?: string;
  tradingBaseUrl?: string;
  assetClasses?: AlpacaAssetClass[];
  feed?: AlpacaFeed;
  cryptoLocation?: AlpacaCryptoLocation;
  defaultTimeframe?: string;
  defaultLimit?: number;
  requestTimeoutMs?: number;
  queryCachePolicy?: AlpacaQueryCachePolicy;
  queryCacheTtlMs?: number;
  metadataCacheTtlMs?: number;
  dedupeInFlight?: boolean;

  webSocketBaseUrl?: string;
  webSocketSandboxBaseUrl?: string;
  webSocketUseSandbox?: boolean;
  webSocketStockFeed?: AlpacaWebSocketStockFeed;
  webSocketCryptoLocation?: AlpacaWebSocketCryptoLocation;
  webSocketAuthTimeoutMs?: number;
  webSocketProviderConnectionLimitPerEndpoint?: number;
}
```

Field guidance:

- `webSocketBaseUrl`
  - Label: WebSocket base URL
  - Type: string
  - Required: no
  - Default: `wss://stream.data.alpaca.markets`
  - Example: `wss://stream.data.alpaca.markets`
  - Used by: backend adapter
  - UI help: Alpaca production Market Data WebSocket root used only by the backend adapter. Default: `wss://stream.data.alpaca.markets`.

- `webSocketSandboxBaseUrl`
  - Label: WebSocket sandbox base URL
  - Type: string
  - Required: no
  - Default: `wss://stream.data.sandbox.alpaca.markets`
  - Example: `wss://stream.data.sandbox.alpaca.markets`
  - Used by: backend adapter
  - UI help: Alpaca sandbox Market Data WebSocket root used only when WebSocket sandbox mode is enabled.

- `webSocketUseSandbox`
  - Label: Use WebSocket sandbox
  - Type: boolean
  - Required: no
  - Default: `false`
  - Example: `false`
  - Used by: backend adapter
  - UI help: Route live Alpaca subscriptions through the sandbox WebSocket host. HTTP REST routes continue to use their own configured base URLs.

- `webSocketStockFeed`
  - Label: WebSocket equity feed
  - Type: select
  - Required: no
  - Default: `iex`
  - Example: `iex`
  - Options: `iex`, `sip`, `delayed_sip`, `boats`, `overnight`
  - Used by: frontend defaults and backend adapter
  - UI help: Default Alpaca equity WebSocket feed for live trades, quotes, and bars. `otc` is REST-only in the current frontend slice.

- `webSocketCryptoLocation`
  - Label: WebSocket crypto location
  - Type: select
  - Required: no
  - Default: `us`
  - Example: `us`
  - Options: `us`, `us-1`, `eu-1`
  - Used by: frontend defaults and backend adapter
  - UI help: Default Alpaca crypto WebSocket location for live trades, quotes, and bars. Unsupported REST-only locations are rejected for streams.

- `webSocketAuthTimeoutMs`
  - Label: WebSocket auth timeout ms
  - Type: number
  - Required: no
  - Default: `10000`
  - Example: `10000`
  - Used by: backend adapter
  - UI help: Alpaca provider authentication timeout for backend-owned WebSocket sessions. Must be at most 10000 milliseconds.

- `webSocketProviderConnectionLimitPerEndpoint`
  - Label: Provider WS endpoint limit
  - Type: number
  - Required: no
  - Default: `1`
  - Example: `1`
  - Used by: backend adapter
  - UI help: Documents Alpaca's provider connection limit per endpoint. Keep at 1 unless the backend adapter and provider plan explicitly support more.

Add these fields to:

- `AlpacaPublicConfig`
- `publicConfigSchema.fields[]`, with `description` text matching the UI help
- `AlpacaConnectionConfigEditor`
- `usageGuidance`
- `connections/alpaca/README.md`
- realistic `examples`

The config editor should place these fields under a dedicated `WebSocket streams`
section so users can distinguish REST endpoint defaults from live stream
defaults.

### Secure config

Secure config remains unchanged:

```ts
apiKeyId?: string;
apiSecretKey?: string;
```

The frontend must not add provider auth payload fields, provider tokens, or
browser-visible WebSocket credentials.

## Query Models

Add stream-only query kinds to the union:

```ts
export type AlpacaStreamQueryKind =
  | "alpaca-equity-live-trades"
  | "alpaca-equity-live-quotes"
  | "alpaca-equity-live-bars"
  | "alpaca-crypto-live-trades"
  | "alpaca-crypto-live-quotes"
  | "alpaca-crypto-live-bars";
```

The live query payload shape stays small:

```ts
export interface AlpacaConnectionQuery {
  kind?: AlpacaQueryKind;
  symbols?: string[];
  feed?: AlpacaFeed | AlpacaWebSocketStockFeed;
  cryptoLocation?: AlpacaCryptoLocation | AlpacaWebSocketCryptoLocation;

  // REST-only fields
  timeframe?: string;
  limit?: number;
  pageToken?: string;
  sort?: AlpacaSortDirection;
}
```

Live query editor rules:

- require at least one symbol at runtime, while allowing an empty draft for UI
  authoring
- uppercase equity symbols in examples and helper copy
- preserve crypto symbols with `/`, for example `BTC/USD`
- show `feed` only for equity live query models
- show `cryptoLocation` only for crypto live query models
- hide `timeframe`, `timeRange`, `limit`, `pageToken`, and `sort` for live
  query models
- describe live bars as provider minute bars for the first slice

### Equity live trades

```ts
{
  id: "alpaca-equity-live-trades",
  label: "Equity Live Trades (WS)",
  description: "Subscribe to live Alpaca equity trade updates through the backend WebSocket bridge.",
  outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
  defaultQuery: { kind: "alpaca-equity-live-trades", symbols: [], feed: "iex" },
  controls: ["symbols", "feed"],
  preview: {
    graph: {
      xField: "timestamp",
      yField: "price",
      groupField: "symbol",
      rowIdentityFields: ["timestamp", "symbol", "tradeId", "assetClass"],
      preferredChartType: "line",
      maxRetainedRows: 1000
    }
  },
  stream: {
    transport: "websocket",
    modes: ["delta"],
    defaultMode: "delta",
    supportsResume: false,
    heartbeatMs: 30000,
    defaultMergeKeyFields: ["timestamp", "symbol", "tradeId", "assetClass"]
  }
}
```

### Equity live quotes

Use the same shape with:

- `id`: `alpaca-equity-live-quotes`
- `label`: `Equity Live Quotes (WS)`
- `defaultQuery.kind`: `alpaca-equity-live-quotes`
- graph default `yField`: `bidPrice`
- row identity and merge fields:
  `["timestamp", "symbol", "assetClass"]`

### Equity live bars

Use the same shape with:

- `id`: `alpaca-equity-live-bars`
- `label`: `Equity Live Bars (WS)`
- `defaultQuery.kind`: `alpaca-equity-live-bars`
- graph default `yField`: `close`
- row identity and merge fields:
  `["timestamp", "symbol", "timeframe", "barType", "assetClass"]`

### Crypto live trades

Use the same shape with:

- `id`: `alpaca-crypto-live-trades`
- `label`: `Crypto Live Trades (WS)`
- `defaultQuery`: `{ kind: "alpaca-crypto-live-trades", symbols: [], cryptoLocation: "us" }`
- controls: `["symbols", "cryptoLocation"]`
- graph default `yField`: `price`
- row identity and merge fields:
  `["timestamp", "symbol", "tradeId", "assetClass"]`

### Crypto live quotes

Use the same shape with:

- `id`: `alpaca-crypto-live-quotes`
- `label`: `Crypto Live Quotes (WS)`
- `defaultQuery.kind`: `alpaca-crypto-live-quotes`
- graph default `yField`: `bidPrice`
- row identity and merge fields:
  `["timestamp", "symbol", "assetClass"]`

### Crypto live bars

Use the same shape with:

- `id`: `alpaca-crypto-live-bars`
- `label`: `Crypto Live Bars (WS)`
- `defaultQuery.kind`: `alpaca-crypto-live-bars`
- graph default `yField`: `close`
- row identity and merge fields:
  `["timestamp", "symbol", "timeframe", "barType", "assetClass"]`

## Authoring And Explore Behavior

The shared connection authoring contract remains the owner of default draft
selection and Explore copy.

Required behavior:

- HTTP mode defaults to the existing `alpaca-equity-ohlc` REST query model.
- WebSocket mode defaults to `alpaca-equity-live-trades` when the connection
  has equity enabled, otherwise the first available streamable Alpaca query
  model.
- The shared workbench transport selector must show live models only in WS mode.
- The connection path picker must make transport explicit through separate
  query labels, not by showing one path as both HTTP and WebSocket.
- Stream query summaries should say "WebSocket stream" or "live subscription",
  not "run request".
- The stream test panel should send the generic subscribe payload and should
  show Alpaca frames through `ConnectionQueryResponsePreview`.

Do not add a per-Alpaca Explore wrapper. `ConnectionExploreSurface` and
`ConnectionQueryWorkbench` remain the only normal Explore path.

## Workspace Runtime Behavior

Alpaca live data uses the generic `connection-stream-query` widget.

The stream source:

- stores `ConnectionRef`, `queryModelId`, normalized query payload, output
  contract, merge keys, and retention settings
- must not store provider URLs, provider channels, credentials, or backend route
  fragments in widget props
- opens the generic Command Center `stream-query` WebSocket through the shared
  ticket-auth helper
- normalizes incoming `ConnectionQueryResponse` frames through the existing
  tabular conversion path
- publishes `updates` with `widget-runtime-update@v1`
- keeps lifecycle status visible through existing runtime state fields

Downstream widgets consume Alpaca streams exactly like other incremental
connection publications:

- historical HTTP data may bind to `seedData`
- Alpaca live stream data may bind to `liveUpdates`
- graph, table, statistic, and OHLC must not branch on Alpaca provider details

## Backend Contract Impact

This ADR assumes backend ADR 018 is authoritative and implemented for the
generic WebSocket contract.

Frontend implementation changes the connection manifest and persisted public
config shape additively. Backend already accepts the new optional WebSocket
public config fields and stream query kinds. Existing Alpaca connection
instances remain valid without migration.

No frontend change may require browser-visible provider credentials or
provider-native stream routes.

Known backend follow-ups from ADR 018 remain backend-owned:

- Redis-coordinated Alpaca endpoint session ownership and fanout for
  multi-worker deployments
- focused backend tests for auth failure, subscription failure, reconnect
  failure, and unsubscribe cleanup

## Implementation Plan

### Connection definition

- [ ] Add Alpaca WebSocket public config TypeScript fields.
- [ ] Add `AlpacaWebSocketStockFeed` and `AlpacaWebSocketCryptoLocation` types.
- [ ] Add `stream` to top-level capabilities.
- [ ] Add six stream-only query models with `stream.transport="websocket"`.
- [ ] Add stream preview graph hints and `defaultMergeKeyFields` for each live
  query model.
- [ ] Add live examples for equity and crypto streams.

### Config editor and schema

- [ ] Add a `WebSocket streams` schema section.
- [ ] Add public config schema fields for all WebSocket config additions.
- [ ] Add matching config editor fields and help text.
- [ ] Keep REST feed/location fields separate from WebSocket feed/location
  fields so users can see which defaults affect HTTP versus WS.

### Query editor and authoring contract

- [ ] Extend `AlpacaConnectionQueryEditor` for live query kinds.
- [ ] Hide HTTP-only fields for live query kinds.
- [ ] Add helper copy that explains live bars are provider minute bars in the
  first slice.
- [ ] Update `alpacaAuthoring.ts` to choose stream defaults in WS mode.
- [ ] Ensure source summaries and run/test copy use the shared authoring
  contract.

### Documentation

- [ ] Update `connections/alpaca/README.md`.
- [ ] Update Alpaca `usageGuidance` with every new public config field and live
  query model.
- [ ] Update any shared connection docs if examples need an Alpaca WS sample.

### Tests

- [ ] Add connection definition tests proving top-level `stream` capability is
  present and every live query model is streamable.
- [ ] Add tests for default merge keys and graph preview hints.
- [ ] Add query editor tests for live equity and crypto field visibility.
- [ ] Add authoring contract tests proving HTTP mode and WS mode choose
  different Alpaca defaults.
- [ ] Add streamability filtering tests proving existing REST Alpaca paths do
  not appear as WS models.

## Acceptance Criteria

- Data Sources Explore shows Alpaca live stream query models only under the WS
  transport path.
- Workspace `connection-stream-query` can select Alpaca equity and crypto live
  trades, quotes, and bars.
- Existing Alpaca HTTP query models continue to work and remain HTTP-only.
- Saved Alpaca connection instances without new WebSocket public config fields
  remain valid.
- The browser never stores or displays Alpaca provider credentials, provider
  auth messages, or provider-native stream URLs as runtime widget props.
- Downstream widgets receive standard incremental tabular publications and do
  not need Alpaca-specific consumer code.
