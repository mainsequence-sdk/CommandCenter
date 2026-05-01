import type { ConnectionQueryStreamModel, ConnectionTypeDefinition } from "@/connections/types";
import alpacaSymbolUrl from "@/connections/assets/alpaca-symbol.png";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { AlpacaConnectionConfigEditor } from "./AlpacaConnectionConfigEditor";
import { alpacaConnectionAuthoringContract } from "./alpacaAuthoring";
import { AlpacaConnectionQueryEditor } from "./AlpacaConnectionQueryEditor";

export const ALPACA_MARKET_DATA_CONNECTION_TYPE_ID = "finance.alpaca-market-data";

export type AlpacaAssetClass = "us_equity" | "crypto";
export type AlpacaFeed = "iex" | "sip" | "delayed_sip" | "boats" | "overnight" | "otc";
export type AlpacaCryptoLocation = "us" | "us-1" | "us-2" | "eu-1" | "bs-1";
export type AlpacaWebSocketStockFeed = "iex" | "sip" | "delayed_sip" | "boats" | "overnight";
export type AlpacaWebSocketCryptoLocation = "us" | "us-1" | "eu-1";
export type AlpacaQueryCachePolicy = "read" | "disabled";
export type AlpacaSortDirection = "asc" | "desc";

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

export interface AlpacaSecureConfig {
  apiKeyId?: string;
  apiSecretKey?: string;
}

export type AlpacaQueryKind =
  | "alpaca-equity-ohlc"
  | "alpaca-equity-latest-bars"
  | "alpaca-equity-historical-trades"
  | "alpaca-equity-latest-trades"
  | "alpaca-equity-latest-quotes"
  | "alpaca-equity-live-trades"
  | "alpaca-equity-live-quotes"
  | "alpaca-equity-live-bars"
  | "alpaca-crypto-ohlc"
  | "alpaca-crypto-latest-bars"
  | "alpaca-crypto-historical-trades"
  | "alpaca-crypto-latest-trades"
  | "alpaca-crypto-live-trades"
  | "alpaca-crypto-live-quotes"
  | "alpaca-crypto-live-bars";

export interface AlpacaConnectionQuery {
  kind?: AlpacaQueryKind;
  symbols?: string[];
  timeframe?: string;
  feed?: AlpacaFeed | AlpacaWebSocketStockFeed;
  cryptoLocation?: AlpacaCryptoLocation | AlpacaWebSocketCryptoLocation;
  limit?: number;
  pageToken?: string;
  sort?: AlpacaSortDirection;
}

const tabularOutputContracts = [CORE_TABULAR_FRAME_SOURCE_CONTRACT];

function createStreamPreview(
  yField: string,
  rowIdentityFields: string[],
) {
  return {
    graph: {
      xField: "timestamp",
      yField,
      groupField: "symbol",
      rowIdentityFields,
      preferredChartType: "line" as const,
      maxRetainedRows: 1000,
    },
  };
}

function createStreamMetadata(
  description: string,
  defaultMergeKeyFields: string[],
): ConnectionQueryStreamModel {
  return {
    transport: "websocket" as const,
    modes: ["delta"],
    defaultMode: "delta" as const,
    supportsResume: false,
    heartbeatMs: 30_000,
    description,
    defaultMergeKeyFields,
  };
}

const usageGuidance = `## purpose

Connects widgets and Explore flows to Alpaca Market Data for equities and crypto through the backend adapter \`finance.alpaca-market-data\`.

## whenToUse

- Use when a workspace needs Alpaca OHLC bars, latest bars, historical trades, latest trades, latest quotes, live trades, live quotes, live minute bars, or provider asset metadata.
- Use for backend-proxied Alpaca requests where API keys must remain encrypted server-side.
- Use the streamable live query paths when a workspace needs Alpaca data through the generic Command Center WebSocket bridge.

## whenNotToUse

- Do not use for order placement, account management, portfolio trading, or non-Alpaca data providers.
- Do not use when a direct browser-side provider SDK is required; this connection only uses generic Command Center backend routes.
- Do not assume every Alpaca query model is streamable; only the live query kinds ending in -live-* publish WebSocket stream metadata.

## configurationFields

### dataBaseUrl

- Label: Data base URL
- Type: string
- Required: no
- Default: https://data.alpaca.markets
- Example: https://data.alpaca.markets
- Used by: backend adapter
- Meaning: Alpaca Market Data API root for bars, trades, and quotes.
- Constraints: must be a URI; should normally remain the Alpaca production data host.
- UI help: Alpaca Market Data API root used by the backend adapter for bars, trades, and quotes. Default: https://data.alpaca.markets.

### tradingBaseUrl

- Label: Trading base URL
- Type: string
- Required: no
- Default: https://paper-api.alpaca.markets
- Example: https://paper-api.alpaca.markets
- Used by: backend adapter
- Meaning: Alpaca Trading API root for provider asset metadata.
- Constraints: must be a URI; paper API is the safe default for metadata lookup.
- UI help: Alpaca Trading API root used by the backend adapter for provider asset metadata. Default: https://paper-api.alpaca.markets.

### assetClasses

- Label: Asset classes
- Type: string array
- Required: yes
- Default: ["us_equity"]
- Example: ["us_equity", "crypto"]
- Used by: frontend and backend adapter
- Meaning: asset classes this connection may query.
- Constraints: entries must be us_equity or crypto; backend rejects disabled asset-class queries.
- UI help: Asset classes enabled for this connection. The backend rejects queries for disabled classes. Default: us_equity.

### feed

- Label: Equity feed
- Type: string
- Required: no
- Default: iex
- Example: sip
- Used by: frontend and backend adapter
- Meaning: default Alpaca stock market-data feed for equity query models.
- Constraints: must be one of iex, sip, delayed_sip, boats, overnight, or otc; provider entitlements still apply.
- UI help: Default Alpaca stock market-data feed for equity queries. IEX works for basic plans; SIP and other feeds require provider entitlements.

### cryptoLocation

- Label: Crypto location
- Type: string
- Required: no
- Default: us
- Example: us
- Used by: frontend and backend adapter
- Meaning: default Alpaca crypto endpoint location for crypto query models.
- Constraints: must be one of us, us-1, us-2, eu-1, or bs-1.
- UI help: Default Alpaca crypto market-data location used by crypto bars and trades endpoints. Default: us.

### defaultTimeframe

- Label: Default timeframe
- Type: string
- Required: no
- Default: 1Min
- Example: 5Min
- Used by: frontend and backend adapter
- Meaning: default timeframe for OHLC bar queries when the query payload omits timeframe.
- Constraints: must be accepted by Alpaca bars endpoints, including 1-59Min, 1-23Hour, 1Day, 1Week, and 1/2/3/4/6/12Month. Short aliases such as 5T, 1H, 1D, 1W, and 1M are also valid.
- UI help: Default Alpaca timeframe used by OHLC bar queries when a query does not override it. Use Alpaca's documented bars values such as 1Min, 5Min, 1Hour, 1Day, 1Week, 1Month, or aliases like 5T and 1H.

### defaultLimit

- Label: Default limit
- Type: number
- Required: no
- Default: 1000
- Example: 500
- Used by: frontend and backend adapter
- Meaning: default provider page size or latest-record budget.
- Constraints: integer from 1 to 10000.
- UI help: Default provider page size for market-data requests. Valid range: 1 to 10000. Default: 1000.

### requestTimeoutMs

- Label: Request timeout ms
- Type: number
- Required: no
- Default: 10000
- Example: 15000
- Used by: backend adapter
- Meaning: HTTP timeout for Alpaca provider calls.
- Constraints: integer from 1000 to 30000.
- UI help: Backend HTTP timeout for Alpaca provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000.

### queryCachePolicy

- Label: Query cache policy
- Type: string
- Required: no
- Default: read
- Example: read
- Used by: backend adapter
- Meaning: successful market-data query caching behavior.
- Constraints: read or disabled; backend must not cache auth, permission, rate-limit, provider, or malformed-response failures.
- UI help: Backend market-data query cache policy. Use read for short-lived provider response caching or disabled to bypass query-result caching.

### queryCacheTtlMs

- Label: Query cache TTL ms
- Type: number
- Required: no
- Default: 15000
- Example: 15000
- Used by: backend adapter
- Meaning: TTL for successful query cache entries.
- Constraints: non-negative integer.
- UI help: Backend cache lifetime for successful market-data query responses in milliseconds. Default: 15000.

### metadataCacheTtlMs

- Label: Metadata cache TTL ms
- Type: number
- Required: no
- Default: 300000
- Example: 300000
- Used by: backend adapter
- Meaning: TTL for provider asset metadata fetched from the assets resource.
- Constraints: non-negative integer.
- UI help: Backend cache lifetime for provider asset metadata in milliseconds. Default: 300000.

### dedupeInFlight

- Label: Dedupe in-flight identical queries
- Type: boolean
- Required: no
- Default: true
- Example: true
- Used by: backend adapter
- Meaning: share one running provider request for identical cacheable Alpaca requests.
- Constraints: only dedupes identical safe requests.
- UI help: When enabled, the backend shares one in-flight provider request for identical Alpaca queries. Default: true.

### webSocketBaseUrl

- Label: WebSocket base URL
- Type: string
- Required: no
- Default: wss://stream.data.alpaca.markets
- Example: wss://stream.data.alpaca.markets
- Used by: backend adapter
- Meaning: Alpaca production Market Data WebSocket root used for backend-owned live subscriptions.
- Constraints: must be a WebSocket URI.
- UI help: Alpaca production Market Data WebSocket root used only by the backend adapter. Default: wss://stream.data.alpaca.markets.

### webSocketSandboxBaseUrl

- Label: WebSocket sandbox base URL
- Type: string
- Required: no
- Default: wss://stream.data.sandbox.alpaca.markets
- Example: wss://stream.data.sandbox.alpaca.markets
- Used by: backend adapter
- Meaning: Alpaca sandbox Market Data WebSocket root used when WebSocket sandbox mode is enabled.
- Constraints: must be a WebSocket URI.
- UI help: Alpaca sandbox Market Data WebSocket root used only when WebSocket sandbox mode is enabled.

### webSocketUseSandbox

- Label: Use WebSocket sandbox
- Type: boolean
- Required: no
- Default: false
- Example: false
- Used by: backend adapter
- Meaning: route live Alpaca subscriptions through the sandbox WebSocket host.
- Constraints: affects only WebSocket subscriptions; REST routes keep using their configured base URLs.
- UI help: Route live Alpaca subscriptions through the sandbox WebSocket host. HTTP REST routes continue to use their own configured base URLs.

### webSocketStockFeed

- Label: WebSocket equity feed
- Type: string
- Required: no
- Default: iex
- Example: sip
- Used by: frontend defaults and backend adapter
- Meaning: default Alpaca equity WebSocket feed for live trades, quotes, and bars.
- Constraints: must be one of iex, sip, delayed_sip, boats, or overnight; provider entitlements still apply.
- UI help: Default Alpaca equity WebSocket feed for live trades, quotes, and bars. IEX works for basic plans; SIP and other feeds require provider entitlements.

### webSocketCryptoLocation

- Label: WebSocket crypto location
- Type: string
- Required: no
- Default: us
- Example: eu-1
- Used by: frontend defaults and backend adapter
- Meaning: default Alpaca crypto WebSocket location for live trades, quotes, and bars.
- Constraints: must be one of us, us-1, or eu-1.
- UI help: Default Alpaca crypto WebSocket location for live trades, quotes, and bars. Unsupported REST-only locations are rejected for streams.

### webSocketAuthTimeoutMs

- Label: WebSocket auth timeout ms
- Type: number
- Required: no
- Default: 10000
- Example: 10000
- Used by: backend adapter
- Meaning: Alpaca provider authentication timeout for backend-owned WebSocket sessions.
- Constraints: integer from 1 to 10000.
- UI help: Alpaca provider authentication timeout for backend-owned WebSocket sessions. Must be at most 10000 milliseconds.

### webSocketProviderConnectionLimitPerEndpoint

- Label: Provider WS endpoint limit
- Type: number
- Required: no
- Default: 1
- Example: 1
- Used by: backend adapter
- Meaning: documents Alpaca's provider connection limit per endpoint for backend stream ownership.
- Constraints: positive integer; should remain 1 unless the backend adapter and provider plan explicitly support more.
- UI help: Documents Alpaca's provider connection limit per endpoint. Keep at 1 unless the backend adapter and provider plan explicitly support more.

### apiKeyId

- Label: API key ID
- Type: secret
- Required: yes
- Default: none
- Example: PK...
- Used by: backend adapter
- Meaning: Alpaca API key id sent as APCA-API-KEY-ID by the backend.
- Constraints: write-only secureConfig field; never serialized back to the frontend.
- UI help: Write-only Alpaca API key id. Stored in secure config and sent only by the backend provider adapter.

### apiSecretKey

- Label: API secret key
- Type: secret
- Required: yes
- Default: none
- Example: provider secret value
- Used by: backend adapter
- Meaning: Alpaca API secret sent as APCA-API-SECRET-KEY by the backend.
- Constraints: write-only secureConfig field; never serialized back to the frontend.
- UI help: Write-only Alpaca API secret key. Stored in secure config and never serialized back to the frontend.

## queryModels

### alpaca-equity-ohlc

- Payload: { "kind": "alpaca-equity-ohlc", "symbols": ["AAPL"], "timeframe": "1Min", "feed": "iex", "limit": 1000 }
- Returns: core.tabular_frame@v1 with timestamp, symbol, open, high, low, close, volume, tradeCount, vwap, timeframe, assetClass, feed, and provider fields.
- Notes: uses the request envelope timeRange and may expose nextPageToken in response metadata.

### alpaca-equity-latest-bars

- Payload: { "kind": "alpaca-equity-latest-bars", "symbols": ["AAPL"], "feed": "iex", "limit": 1000 }
- Returns: core.tabular_frame@v1 latest bar rows.

### alpaca-equity-historical-trades

- Payload: { "kind": "alpaca-equity-historical-trades", "symbols": ["AAPL"], "feed": "iex", "limit": 1000, "sort": "asc" }
- Returns: core.tabular_frame@v1 trade rows and may expose nextPageToken in response metadata.

### alpaca-equity-latest-trades

- Payload: { "kind": "alpaca-equity-latest-trades", "symbols": ["AAPL"], "feed": "iex", "limit": 1000 }
- Returns: core.tabular_frame@v1 latest trade rows.

### alpaca-equity-latest-quotes

- Payload: { "kind": "alpaca-equity-latest-quotes", "symbols": ["AAPL"], "feed": "iex", "limit": 1000 }
- Returns: core.tabular_frame@v1 quote rows.

### alpaca-equity-live-trades

- Payload: { "kind": "alpaca-equity-live-trades", "symbols": ["AAPL"], "feed": "iex" }
- Returns: core.tabular_frame@v1 live trade frames over the generic WebSocket stream bridge.
- Notes: stream only; emits delta frames and does not use timeRange, pageToken, sort, or limit.

### alpaca-equity-live-quotes

- Payload: { "kind": "alpaca-equity-live-quotes", "symbols": ["AAPL"], "feed": "iex" }
- Returns: core.tabular_frame@v1 live quote frames over the generic WebSocket stream bridge.
- Notes: stream only; emits delta frames and does not use timeRange, pageToken, sort, or limit.

### alpaca-equity-live-bars

- Payload: { "kind": "alpaca-equity-live-bars", "symbols": ["AAPL"], "feed": "iex" }
- Returns: core.tabular_frame@v1 live provider minute-bar frames over the generic WebSocket stream bridge.
- Notes: stream only; emits delta frames and does not use timeRange, pageToken, sort, or limit.

### alpaca-crypto-ohlc

- Payload: { "kind": "alpaca-crypto-ohlc", "symbols": ["BTC/USD"], "timeframe": "1Min", "cryptoLocation": "us", "limit": 1000 }
- Returns: core.tabular_frame@v1 crypto bar rows and may expose nextPageToken in response metadata.

### alpaca-crypto-latest-bars

- Payload: { "kind": "alpaca-crypto-latest-bars", "symbols": ["BTC/USD"], "cryptoLocation": "us", "limit": 1000 }
- Returns: core.tabular_frame@v1 latest crypto bar rows.

### alpaca-crypto-historical-trades

- Payload: { "kind": "alpaca-crypto-historical-trades", "symbols": ["BTC/USD"], "cryptoLocation": "us", "limit": 1000, "sort": "asc" }
- Returns: core.tabular_frame@v1 crypto trade rows and may expose nextPageToken in response metadata.

### alpaca-crypto-latest-trades

- Payload: { "kind": "alpaca-crypto-latest-trades", "symbols": ["BTC/USD"], "cryptoLocation": "us", "limit": 1000 }
- Returns: core.tabular_frame@v1 latest crypto trade rows.

### alpaca-crypto-live-trades

- Payload: { "kind": "alpaca-crypto-live-trades", "symbols": ["BTC/USD"], "cryptoLocation": "us" }
- Returns: core.tabular_frame@v1 live crypto trade frames over the generic WebSocket stream bridge.
- Notes: stream only; emits delta frames and does not use timeRange, pageToken, sort, or limit.

### alpaca-crypto-live-quotes

- Payload: { "kind": "alpaca-crypto-live-quotes", "symbols": ["BTC/USD"], "cryptoLocation": "us" }
- Returns: core.tabular_frame@v1 live crypto quote frames over the generic WebSocket stream bridge.
- Notes: stream only; emits delta frames and does not use timeRange, pageToken, sort, or limit.

### alpaca-crypto-live-bars

- Payload: { "kind": "alpaca-crypto-live-bars", "symbols": ["BTC/USD"], "cryptoLocation": "us" }
- Returns: core.tabular_frame@v1 live crypto provider minute-bar frames over the generic WebSocket stream bridge.
- Notes: stream only; emits delta frames and does not use timeRange, pageToken, sort, or limit.

## resources

### assets

- Payload: provider metadata filters owned by the backend adapter.
- Returns: provider asset metadata for frontend symbol selection.

## backendOwnership

- Backend owns credential decryption, APCA headers, provider HTTP calls through requests, provider WebSocket session ownership, health checks, permissions, caching, cache keys, in-flight dedupe, pagination metadata, response normalization, and rejection of unsafe or unsupported operations.
- Generic routes: /test/, /query/, /resources/assets/, and /stream-query/ for the live query kinds listed above.`;

export const alpacaMarketDataConnection: ConnectionTypeDefinition<
  AlpacaPublicConfig,
  AlpacaConnectionQuery
> = {
  id: ALPACA_MARKET_DATA_CONNECTION_TYPE_ID,
  version: 1,
  title: "Alpaca Market Data",
  description: "HTTP and WebSocket Alpaca equity and crypto market data.",
  source: "finance",
  category: "Market Data",
  iconUrl: alpacaSymbolUrl,
  tags: ["finance", "equities", "crypto", "alpaca", "ohlc", "trades", "quotes", "stream"],
  capabilities: ["query", "resource", "health-check", "stream"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "endpoints",
        title: "Endpoints",
        description: "Alpaca API roots used by the backend adapter.",
      },
      {
        id: "markets",
        title: "Markets",
        description: "Enabled asset classes and provider defaults.",
      },
      {
        id: "policy",
        title: "Runtime policy",
        description: "Timeout, cache, and in-flight de-duplication controls.",
      },
      {
        id: "websocket",
        title: "WebSocket streams",
        description: "Backend-owned WebSocket defaults for live Alpaca subscriptions.",
      },
    ],
    fields: [
      {
        id: "dataBaseUrl",
        sectionId: "endpoints",
        label: "Data base URL",
        description:
          "Alpaca Market Data API root used by the backend adapter for bars, trades, and quotes. Default: https://data.alpaca.markets.",
        type: "string",
        required: false,
        defaultValue: "https://data.alpaca.markets",
      },
      {
        id: "tradingBaseUrl",
        sectionId: "endpoints",
        label: "Trading base URL",
        description:
          "Alpaca Trading API root used by the backend adapter for provider asset metadata. Default: https://paper-api.alpaca.markets.",
        type: "string",
        required: false,
        defaultValue: "https://paper-api.alpaca.markets",
      },
      {
        id: "assetClasses",
        sectionId: "markets",
        label: "Asset classes",
        description:
          "Asset classes enabled for this connection. The backend rejects queries for disabled classes. Default: us_equity.",
        type: "json",
        required: true,
        defaultValue: ["us_equity"],
      },
      {
        id: "feed",
        sectionId: "markets",
        label: "Equity feed",
        description:
          "Default Alpaca stock market-data feed for equity queries. IEX works for basic plans; SIP and other feeds require provider entitlements.",
        type: "select",
        required: false,
        defaultValue: "iex",
        options: [
          { label: "IEX", value: "iex" },
          { label: "SIP", value: "sip" },
          { label: "Delayed SIP", value: "delayed_sip" },
          { label: "BOATS", value: "boats" },
          { label: "Overnight", value: "overnight" },
          { label: "OTC", value: "otc" },
        ],
      },
      {
        id: "cryptoLocation",
        sectionId: "markets",
        label: "Crypto location",
        description:
          "Default Alpaca crypto market-data location used by crypto bars and trades endpoints. Default: us.",
        type: "select",
        required: false,
        defaultValue: "us",
        options: [
          { label: "US", value: "us" },
          { label: "US 1", value: "us-1" },
          { label: "US 2", value: "us-2" },
          { label: "EU 1", value: "eu-1" },
          { label: "Bahamas 1", value: "bs-1" },
        ],
      },
      {
        id: "defaultTimeframe",
        sectionId: "markets",
        label: "Default timeframe",
        description:
          "Default Alpaca timeframe used by OHLC bar queries when a query does not override it. Use Alpaca's documented bars values such as 1Min, 5Min, 1Hour, 1Day, 1Week, 1Month, or aliases like 5T and 1H.",
        type: "string",
        required: false,
        defaultValue: "1Min",
      },
      {
        id: "defaultLimit",
        sectionId: "policy",
        label: "Default limit",
        description:
          "Default provider page size for market-data requests. Valid range: 1 to 10000. Default: 1000.",
        type: "number",
        required: false,
        defaultValue: 1000,
      },
      {
        id: "requestTimeoutMs",
        sectionId: "policy",
        label: "Request timeout ms",
        description:
          "Backend HTTP timeout for Alpaca provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000.",
        type: "number",
        required: false,
        defaultValue: 10000,
      },
      {
        id: "queryCachePolicy",
        sectionId: "policy",
        label: "Query cache policy",
        description:
          "Backend market-data query cache policy. Use read for short-lived provider response caching or disabled to bypass query-result caching.",
        type: "select",
        required: false,
        defaultValue: "read",
        options: [
          { label: "Read", value: "read" },
          { label: "Disabled", value: "disabled" },
        ],
      },
      {
        id: "queryCacheTtlMs",
        sectionId: "policy",
        label: "Query cache TTL ms",
        description:
          "Backend cache lifetime for successful market-data query responses in milliseconds. Default: 15000.",
        type: "number",
        required: false,
        defaultValue: 15000,
      },
      {
        id: "metadataCacheTtlMs",
        sectionId: "policy",
        label: "Metadata cache TTL ms",
        description:
          "Backend cache lifetime for provider asset metadata in milliseconds. Default: 300000.",
        type: "number",
        required: false,
        defaultValue: 300000,
      },
      {
        id: "dedupeInFlight",
        sectionId: "policy",
        label: "Dedupe in-flight identical queries",
        description:
          "When enabled, the backend shares one in-flight provider request for identical Alpaca queries. Default: true.",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      {
        id: "webSocketBaseUrl",
        sectionId: "websocket",
        label: "WebSocket base URL",
        description:
          "Alpaca production Market Data WebSocket root used only by the backend adapter. Default: wss://stream.data.alpaca.markets.",
        type: "string",
        required: false,
        defaultValue: "wss://stream.data.alpaca.markets",
      },
      {
        id: "webSocketSandboxBaseUrl",
        sectionId: "websocket",
        label: "WebSocket sandbox base URL",
        description:
          "Alpaca sandbox Market Data WebSocket root used only when WebSocket sandbox mode is enabled.",
        type: "string",
        required: false,
        defaultValue: "wss://stream.data.sandbox.alpaca.markets",
      },
      {
        id: "webSocketUseSandbox",
        sectionId: "websocket",
        label: "Use WebSocket sandbox",
        description:
          "Route live Alpaca subscriptions through the sandbox WebSocket host. HTTP REST routes continue to use their own configured base URLs.",
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "webSocketStockFeed",
        sectionId: "websocket",
        label: "WebSocket equity feed",
        description:
          "Default Alpaca equity WebSocket feed for live trades, quotes, and bars. IEX works for basic plans; SIP and other feeds require provider entitlements.",
        type: "select",
        required: false,
        defaultValue: "iex",
        options: [
          { label: "IEX", value: "iex" },
          { label: "SIP", value: "sip" },
          { label: "Delayed SIP", value: "delayed_sip" },
          { label: "BOATS", value: "boats" },
          { label: "Overnight", value: "overnight" },
        ],
      },
      {
        id: "webSocketCryptoLocation",
        sectionId: "websocket",
        label: "WebSocket crypto location",
        description:
          "Default Alpaca crypto WebSocket location for live trades, quotes, and bars. Unsupported REST-only locations are rejected for streams.",
        type: "select",
        required: false,
        defaultValue: "us",
        options: [
          { label: "US", value: "us" },
          { label: "US 1", value: "us-1" },
          { label: "EU 1", value: "eu-1" },
        ],
      },
      {
        id: "webSocketAuthTimeoutMs",
        sectionId: "websocket",
        label: "WebSocket auth timeout ms",
        description:
          "Alpaca provider authentication timeout for backend-owned WebSocket sessions. Must be at most 10000 milliseconds.",
        type: "number",
        required: false,
        defaultValue: 10000,
      },
      {
        id: "webSocketProviderConnectionLimitPerEndpoint",
        sectionId: "websocket",
        label: "Provider WS endpoint limit",
        description:
          "Documents Alpaca's provider connection limit per endpoint. Keep at 1 unless the backend adapter and provider plan explicitly support more.",
        type: "number",
        required: false,
        defaultValue: 1,
      },
    ],
  },
  secureConfigSchema: {
    version: 1,
    fields: [
      {
        id: "apiKeyId",
        label: "API key ID",
        description:
          "Write-only Alpaca API key id. Stored in secure config and sent only by the backend provider adapter.",
        type: "secret",
        required: true,
      },
      {
        id: "apiSecretKey",
        label: "API secret key",
        description:
          "Write-only Alpaca API secret key. Stored in secure config and never serialized back to the frontend.",
        type: "secret",
        required: true,
      },
    ],
  },
  queryModels: [
    {
      id: "alpaca-equity-ohlc",
      label: "Equity OHLC",
      description: "Fetch historical equity OHLC bars from /v2/stocks/bars.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-equity-ohlc", symbols: [], timeframe: "1Min" },
      controls: ["symbols", "timeframe", "feed", "timeRange", "limit", "pageToken"],
      timeRangeAware: true,
    },
    {
      id: "alpaca-equity-latest-bars",
      label: "Equity Latest Bars",
      description: "Fetch latest equity bars from /v2/stocks/bars/latest.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-equity-latest-bars", symbols: [] },
      controls: ["symbols", "feed", "limit"],
    },
    {
      id: "alpaca-equity-historical-trades",
      label: "Equity Historical Trades",
      description: "Fetch historical equity trades from /v2/stocks/trades.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-equity-historical-trades", symbols: [] },
      controls: ["symbols", "feed", "timeRange", "limit", "pageToken", "sort"],
      timeRangeAware: true,
    },
    {
      id: "alpaca-equity-latest-trades",
      label: "Equity Latest Trades",
      description: "Fetch latest equity trades.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-equity-latest-trades", symbols: [] },
      controls: ["symbols", "feed", "limit"],
    },
    {
      id: "alpaca-equity-latest-quotes",
      label: "Equity Latest Quotes",
      description: "Fetch latest equity quotes.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-equity-latest-quotes", symbols: [] },
      controls: ["symbols", "feed", "limit"],
    },
    {
      id: "alpaca-equity-live-trades",
      label: "Equity Live Trades (WS)",
      description: "Subscribe to live Alpaca equity trade updates through the backend WebSocket bridge.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-equity-live-trades", symbols: [], feed: "iex" },
      controls: ["symbols", "feed"],
      preview: createStreamPreview("price", ["timestamp", "symbol", "tradeId", "assetClass"]),
      stream: createStreamMetadata(
        "Subscribe to live Alpaca equity trade updates through the backend WebSocket bridge.",
        ["timestamp", "symbol", "tradeId", "assetClass"],
      ),
    },
    {
      id: "alpaca-equity-live-quotes",
      label: "Equity Live Quotes (WS)",
      description: "Subscribe to live Alpaca equity quote updates through the backend WebSocket bridge.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-equity-live-quotes", symbols: [], feed: "iex" },
      controls: ["symbols", "feed"],
      preview: createStreamPreview("bidPrice", ["timestamp", "symbol", "assetClass"]),
      stream: createStreamMetadata(
        "Subscribe to live Alpaca equity quote updates through the backend WebSocket bridge.",
        ["timestamp", "symbol", "assetClass"],
      ),
    },
    {
      id: "alpaca-equity-live-bars",
      label: "Equity Live Bars (WS)",
      description:
        "Subscribe to live Alpaca equity minute-bar updates through the backend WebSocket bridge.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-equity-live-bars", symbols: [], feed: "iex" },
      controls: ["symbols", "feed"],
      preview: createStreamPreview("close", ["timestamp", "symbol", "timeframe", "barType", "assetClass"]),
      stream: createStreamMetadata(
        "Subscribe to live Alpaca equity minute-bar updates through the backend WebSocket bridge.",
        ["timestamp", "symbol", "timeframe", "barType", "assetClass"],
      ),
    },
    {
      id: "alpaca-crypto-ohlc",
      label: "Crypto OHLC",
      description: "Fetch historical crypto OHLC bars from /v1beta3/crypto/{loc}/bars.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-crypto-ohlc", symbols: [], timeframe: "1Min" },
      controls: ["symbols", "cryptoLocation", "timeframe", "timeRange", "limit", "pageToken"],
      timeRangeAware: true,
    },
    {
      id: "alpaca-crypto-latest-bars",
      label: "Crypto Latest Bars",
      description: "Fetch latest crypto bars from /v1beta3/crypto/{loc}/latest/bars.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-crypto-latest-bars", symbols: [] },
      controls: ["symbols", "cryptoLocation", "limit"],
    },
    {
      id: "alpaca-crypto-historical-trades",
      label: "Crypto Historical Trades",
      description: "Fetch historical crypto trades from /v1beta3/crypto/{loc}/trades.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-crypto-historical-trades", symbols: [] },
      controls: ["symbols", "cryptoLocation", "timeRange", "limit", "pageToken", "sort"],
      timeRangeAware: true,
    },
    {
      id: "alpaca-crypto-latest-trades",
      label: "Crypto Latest Trades",
      description: "Fetch latest crypto trades.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-crypto-latest-trades", symbols: [] },
      controls: ["symbols", "cryptoLocation", "limit"],
    },
    {
      id: "alpaca-crypto-live-trades",
      label: "Crypto Live Trades (WS)",
      description: "Subscribe to live Alpaca crypto trade updates through the backend WebSocket bridge.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-crypto-live-trades", symbols: [], cryptoLocation: "us" },
      controls: ["symbols", "cryptoLocation"],
      preview: createStreamPreview("price", ["timestamp", "symbol", "tradeId", "assetClass"]),
      stream: createStreamMetadata(
        "Subscribe to live Alpaca crypto trade updates through the backend WebSocket bridge.",
        ["timestamp", "symbol", "tradeId", "assetClass"],
      ),
    },
    {
      id: "alpaca-crypto-live-quotes",
      label: "Crypto Live Quotes (WS)",
      description: "Subscribe to live Alpaca crypto quote updates through the backend WebSocket bridge.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-crypto-live-quotes", symbols: [], cryptoLocation: "us" },
      controls: ["symbols", "cryptoLocation"],
      preview: createStreamPreview("bidPrice", ["timestamp", "symbol", "assetClass"]),
      stream: createStreamMetadata(
        "Subscribe to live Alpaca crypto quote updates through the backend WebSocket bridge.",
        ["timestamp", "symbol", "assetClass"],
      ),
    },
    {
      id: "alpaca-crypto-live-bars",
      label: "Crypto Live Bars (WS)",
      description:
        "Subscribe to live Alpaca crypto minute-bar updates through the backend WebSocket bridge.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "alpaca-crypto-live-bars", symbols: [], cryptoLocation: "us" },
      controls: ["symbols", "cryptoLocation"],
      preview: createStreamPreview("close", ["timestamp", "symbol", "timeframe", "barType", "assetClass"]),
      stream: createStreamMetadata(
        "Subscribe to live Alpaca crypto minute-bar updates through the backend WebSocket bridge.",
        ["timestamp", "symbol", "timeframe", "barType", "assetClass"],
      ),
    },
  ],
  requiredPermissions: ["connections:query"],
  configEditor: AlpacaConnectionConfigEditor,
  queryEditor: AlpacaConnectionQueryEditor,
  authoringContract: alpacaConnectionAuthoringContract,
  usageGuidance,
  examples: [
    {
      title: "US equities with IEX feed",
      publicConfig: {
        dataBaseUrl: "https://data.alpaca.markets",
        tradingBaseUrl: "https://paper-api.alpaca.markets",
        assetClasses: ["us_equity"],
        feed: "iex",
        cryptoLocation: "us",
        defaultTimeframe: "1Min",
        defaultLimit: 1000,
        requestTimeoutMs: 10000,
        queryCachePolicy: "read",
        queryCacheTtlMs: 15000,
        metadataCacheTtlMs: 300000,
        dedupeInFlight: true,
      },
      query: {
        kind: "alpaca-equity-ohlc",
        symbols: ["AAPL", "MSFT"],
        timeframe: "1Min",
        feed: "iex",
        limit: 1000,
        sort: "asc",
      },
    },
    {
      title: "Crypto bars",
      publicConfig: {
        assetClasses: ["crypto"],
        cryptoLocation: "us",
        defaultTimeframe: "1Min",
        defaultLimit: 1000,
      },
      query: {
        kind: "alpaca-crypto-ohlc",
        symbols: ["BTC/USD", "ETH/USD"],
        timeframe: "1Min",
        cryptoLocation: "us",
        limit: 1000,
      },
    },
    {
      title: "Live equity trades",
      publicConfig: {
        assetClasses: ["us_equity"],
        webSocketBaseUrl: "wss://stream.data.alpaca.markets",
        webSocketStockFeed: "iex",
        webSocketAuthTimeoutMs: 10000,
        webSocketProviderConnectionLimitPerEndpoint: 1,
      },
      query: {
        kind: "alpaca-equity-live-trades",
        symbols: ["AAPL", "MSFT"],
        feed: "iex",
      },
    },
    {
      title: "Live crypto quotes",
      publicConfig: {
        assetClasses: ["crypto"],
        webSocketBaseUrl: "wss://stream.data.alpaca.markets",
        webSocketCryptoLocation: "us",
        webSocketAuthTimeoutMs: 10000,
        webSocketProviderConnectionLimitPerEndpoint: 1,
      },
      query: {
        kind: "alpaca-crypto-live-quotes",
        symbols: ["BTC/USD", "ETH/USD"],
        cryptoLocation: "us",
      },
    },
  ],
};

export default alpacaMarketDataConnection;
