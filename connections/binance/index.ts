import type { ConnectionTypeDefinition } from "@/connections/types";
import binanceLogoUrl from "@/connections/assets/binance-logo.svg";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { BinanceConnectionConfigEditor } from "./BinanceConnectionConfigEditor";
import { BinanceConnectionExplore } from "./BinanceConnectionExplore";
import { BinanceConnectionQueryEditor } from "./BinanceConnectionQueryEditor";

export const BINANCE_MARKET_DATA_CONNECTION_TYPE_ID = "finance.binance-market-data";

export type BinanceMarketType = "spot" | "usdm_futures";
export type BinanceQueryCachePolicy = "read" | "disabled";

export interface BinancePublicConfig {
  spotBaseUrl?: string;
  usdmFuturesBaseUrl?: string;
  marketTypes?: BinanceMarketType[];
  defaultQuoteAsset?: string;
  defaultInterval?: string;
  defaultLimit?: number;
  requestTimeoutMs?: number;
  queryCachePolicy?: BinanceQueryCachePolicy;
  queryCacheTtlMs?: number;
  metadataCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export type BinanceQueryKind =
  | "binance-spot-prices"
  | "binance-spot-ohlc"
  | "binance-spot-recent-trades"
  | "binance-spot-aggregate-trades"
  | "binance-usdm-futures-prices"
  | "binance-usdm-futures-ohlc"
  | "binance-usdm-futures-recent-trades"
  | "binance-usdm-futures-aggregate-trades";

export interface BinanceConnectionQuery {
  kind?: BinanceQueryKind;
  symbols?: string[];
  interval?: string;
  limit?: number;
  fromId?: number;
  timeZone?: string;
}

const tabularOutputContracts = [CORE_TABULAR_FRAME_SOURCE_CONTRACT];

const usageGuidance = `## purpose

Connects widgets and Explore flows to Binance public market data for spot and USD-M futures through the backend adapter \`finance.binance-market-data\`.

## whenToUse

- Use when a workspace needs Binance prices, OHLCV bars, recent trades, aggregate trades, or exchange-info symbol metadata.
- Use for public Binance market data that should run through Command Center backend proxy routes.

## whenNotToUse

- Do not use for Binance account, order, wallet, user-data stream, or authenticated trading endpoints.
- Do not use for non-Binance exchanges or provider SDK workflows.

## configurationFields

### spotBaseUrl

- Label: Spot base URL
- Type: string
- Required: no
- Default: https://api.binance.com
- Example: https://api.binance.com
- Used by: backend adapter
- Meaning: Binance Spot REST API root for spot prices, klines, trades, and exchange-info metadata.
- Constraints: must be a URI.
- UI help: Binance Spot REST API root used by the backend adapter for spot prices, klines, and trades. Default: https://api.binance.com.

### usdmFuturesBaseUrl

- Label: USD-M futures base URL
- Type: string
- Required: no
- Default: https://fapi.binance.com
- Example: https://fapi.binance.com
- Used by: backend adapter
- Meaning: Binance USD-M Futures REST API root for futures prices, klines, trades, and exchange-info metadata.
- Constraints: must be a URI.
- UI help: Binance USD-M Futures REST API root used by the backend adapter for futures prices, klines, and trades. Default: https://fapi.binance.com.

### marketTypes

- Label: Market types
- Type: string array
- Required: yes
- Default: ["spot"]
- Example: ["spot", "usdm_futures"]
- Used by: frontend and backend adapter
- Meaning: market families this connection may query.
- Constraints: entries must be spot or usdm_futures; backend rejects disabled market-type queries.
- UI help: Market types enabled for this connection. The backend rejects queries for disabled market types. Default: spot.

### defaultQuoteAsset

- Label: Default quote asset
- Type: string
- Required: no
- Default: USDT
- Example: USDT
- Used by: frontend and backend adapter
- Meaning: default quote asset for symbol selection and metadata filtering.
- Constraints: uppercase quote asset is recommended.
- UI help: Default quote asset used by frontend symbol helpers and backend metadata filtering when applicable. Example: USDT.

### defaultInterval

- Label: Default interval
- Type: string
- Required: no
- Default: 1m
- Example: 1m
- Used by: frontend and backend adapter
- Meaning: default Binance kline interval for OHLC queries.
- Constraints: must be accepted by the target Binance kline endpoint.
- UI help: Default Binance kline interval used by OHLC queries when a query does not override it. Example: 1m.

### defaultLimit

- Label: Default limit
- Type: number
- Required: no
- Default: 1000
- Example: 500
- Used by: frontend and backend adapter
- Meaning: default provider row limit.
- Constraints: integer from 1 to 1500; endpoint-specific caps still apply.
- UI help: Default provider row limit for market-data requests. Spot klines cap at 1000, USD-M futures klines cap at 1500, and trade endpoints cap at 1000.

### requestTimeoutMs

- Label: Request timeout ms
- Type: number
- Required: no
- Default: 10000
- Example: 15000
- Used by: backend adapter
- Meaning: HTTP timeout for Binance provider calls.
- Constraints: integer from 1000 to 30000.
- UI help: Backend HTTP timeout for Binance provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000.

### queryCachePolicy

- Label: Query cache policy
- Type: string
- Required: no
- Default: read
- Example: read
- Used by: backend adapter
- Meaning: successful market-data query caching behavior.
- Constraints: read or disabled; backend must not cache provider errors, rate-limit responses, or malformed responses.
- UI help: Backend market-data query cache policy. Use read for short-lived provider response caching or disabled to bypass query-result caching.

### queryCacheTtlMs

- Label: Query cache TTL ms
- Type: number
- Required: no
- Default: 30000
- Example: 30000
- Used by: backend adapter
- Meaning: TTL for successful query cache entries.
- Constraints: non-negative integer.
- UI help: Backend cache lifetime for successful market-data query responses in milliseconds. Default: 30000.

### metadataCacheTtlMs

- Label: Metadata cache TTL ms
- Type: number
- Required: no
- Default: 300000
- Example: 300000
- Used by: backend adapter
- Meaning: TTL for Binance exchange-info symbol metadata.
- Constraints: non-negative integer.
- UI help: Backend cache lifetime for exchange-info symbol metadata in milliseconds. Default: 300000.

### dedupeInFlight

- Label: Dedupe in-flight identical queries
- Type: boolean
- Required: no
- Default: true
- Example: true
- Used by: backend adapter
- Meaning: share one running provider request for identical cacheable Binance requests.
- Constraints: only dedupes identical safe requests.
- UI help: When enabled, the backend shares one in-flight provider request for identical Binance queries. Default: true.

## queryModels

### binance-spot-prices

- Payload: { "kind": "binance-spot-prices", "symbols": ["BTCUSDT"], "limit": 1000 }
- Returns: core.tabular_frame@v1 price rows with observedAt, symbol, price, marketType, provider, and quoteAsset fields.

### binance-spot-ohlc

- Payload: { "kind": "binance-spot-ohlc", "symbols": ["BTCUSDT"], "interval": "1m", "limit": 1000 }
- Returns: core.tabular_frame@v1 OHLCV rows with openTime, closeTime, symbol, interval, open, high, low, close, volume, quoteVolume, tradeCount, taker volumes, marketType, and provider.
- Notes: uses request envelope timeRange; spot klines may accept timeZone.

### binance-spot-recent-trades

- Payload: { "kind": "binance-spot-recent-trades", "symbols": ["BTCUSDT"], "limit": 1000 }
- Returns: core.tabular_frame@v1 recent trade rows.

### binance-spot-aggregate-trades

- Payload: { "kind": "binance-spot-aggregate-trades", "symbols": ["BTCUSDT"], "fromId": 123, "limit": 1000 }
- Returns: core.tabular_frame@v1 aggregate trade rows.
- Notes: fromId takes precedence over timeRange.

### binance-usdm-futures-prices

- Payload: { "kind": "binance-usdm-futures-prices", "symbols": ["BTCUSDT"], "limit": 1000 }
- Returns: core.tabular_frame@v1 USD-M futures price rows.

### binance-usdm-futures-ohlc

- Payload: { "kind": "binance-usdm-futures-ohlc", "symbols": ["BTCUSDT"], "interval": "1m", "limit": 1500 }
- Returns: core.tabular_frame@v1 USD-M futures OHLCV rows.

### binance-usdm-futures-recent-trades

- Payload: { "kind": "binance-usdm-futures-recent-trades", "symbols": ["BTCUSDT"], "limit": 1000 }
- Returns: core.tabular_frame@v1 USD-M futures recent trade rows.

### binance-usdm-futures-aggregate-trades

- Payload: { "kind": "binance-usdm-futures-aggregate-trades", "symbols": ["BTCUSDT"], "fromId": 123, "limit": 1000 }
- Returns: core.tabular_frame@v1 USD-M futures aggregate trade rows.

## resources

### symbols

- Payload: optional backend-owned market metadata filters.
- Returns: exchange-info symbols for frontend selectors.

## backendOwnership

- Backend owns provider HTTP calls through requests, symbol normalization, symbol validation, health checks, permissions, cache policy, cache-key dimensions, in-flight dedupe, response normalization, and rejection of unsafe or unsupported operations.
- Backend must not set meta.timeSeries for Binance frames; widgets consume core.tabular_frame@v1.
- Generic routes only: /test/, /query/, and /resources/symbols/.
- This adapter has no secure config. Authenticated Binance account or user-data endpoints require a separate connection type.`;

export const binanceMarketDataConnection: ConnectionTypeDefinition<
  BinancePublicConfig,
  BinanceConnectionQuery
> = {
  id: BINANCE_MARKET_DATA_CONNECTION_TYPE_ID,
  version: 1,
  title: "Binance Market Data",
  description: "Requests-only Binance spot and USD-M futures market data.",
  source: "finance",
  category: "Market Data",
  iconUrl: binanceLogoUrl,
  tags: ["finance", "crypto", "binance", "ohlc", "trades"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "endpoints",
        title: "Endpoints",
        description: "Binance API roots used by the backend adapter.",
      },
      {
        id: "markets",
        title: "Markets",
        description: "Enabled market types and provider defaults.",
      },
      {
        id: "policy",
        title: "Runtime policy",
        description: "Timeout, cache, and in-flight de-duplication controls.",
      },
    ],
    fields: [
      {
        id: "spotBaseUrl",
        sectionId: "endpoints",
        label: "Spot base URL",
        description:
          "Binance Spot REST API root used by the backend adapter for spot prices, klines, and trades. Default: https://api.binance.com.",
        type: "string",
        required: false,
        defaultValue: "https://api.binance.com",
      },
      {
        id: "usdmFuturesBaseUrl",
        sectionId: "endpoints",
        label: "USD-M futures base URL",
        description:
          "Binance USD-M Futures REST API root used by the backend adapter for futures prices, klines, and trades. Default: https://fapi.binance.com.",
        type: "string",
        required: false,
        defaultValue: "https://fapi.binance.com",
      },
      {
        id: "marketTypes",
        sectionId: "markets",
        label: "Market types",
        description:
          "Market types enabled for this connection. The backend rejects queries for disabled market types. Default: spot.",
        type: "json",
        required: true,
        defaultValue: ["spot"],
      },
      {
        id: "defaultQuoteAsset",
        sectionId: "markets",
        label: "Default quote asset",
        description:
          "Default quote asset used by frontend symbol helpers and backend metadata filtering when applicable. Example: USDT.",
        type: "string",
        required: false,
        defaultValue: "USDT",
      },
      {
        id: "defaultInterval",
        sectionId: "markets",
        label: "Default interval",
        description:
          "Default Binance kline interval used by OHLC queries when a query does not override it. Example: 1m.",
        type: "string",
        required: false,
        defaultValue: "1m",
      },
      {
        id: "defaultLimit",
        sectionId: "policy",
        label: "Default limit",
        description:
          "Default provider row limit for market-data requests. Spot klines cap at 1000, USD-M futures klines cap at 1500, and trade endpoints cap at 1000.",
        type: "number",
        required: false,
        defaultValue: 1000,
      },
      {
        id: "requestTimeoutMs",
        sectionId: "policy",
        label: "Request timeout ms",
        description:
          "Backend HTTP timeout for Binance provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000.",
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
          "Backend cache lifetime for successful market-data query responses in milliseconds. Default: 30000.",
        type: "number",
        required: false,
        defaultValue: 30000,
      },
      {
        id: "metadataCacheTtlMs",
        sectionId: "policy",
        label: "Metadata cache TTL ms",
        description:
          "Backend cache lifetime for exchange-info symbol metadata in milliseconds. Default: 300000.",
        type: "number",
        required: false,
        defaultValue: 300000,
      },
      {
        id: "dedupeInFlight",
        sectionId: "policy",
        label: "Dedupe in-flight identical queries",
        description:
          "When enabled, the backend shares one in-flight provider request for identical Binance queries. Default: true.",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
  },
  secureConfigSchema: {
    version: 1,
    fields: [],
  },
  queryModels: [
    {
      id: "binance-spot-prices",
      label: "Spot Prices",
      description: "Fetch spot prices from /api/v3/ticker/price.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "binance-spot-prices", symbols: [] },
      controls: ["symbols", "limit"],
    },
    {
      id: "binance-spot-ohlc",
      label: "Spot OHLC",
      description: "Fetch spot OHLCV bars from /api/v3/klines.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "binance-spot-ohlc", symbols: [], interval: "1m" },
      controls: ["symbols", "interval", "timeRange", "limit"],
      timeRangeAware: true,
    },
    {
      id: "binance-spot-recent-trades",
      label: "Spot Recent Trades",
      description: "Fetch recent spot trades from /api/v3/trades.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "binance-spot-recent-trades", symbols: [] },
      controls: ["symbols", "limit"],
    },
    {
      id: "binance-spot-aggregate-trades",
      label: "Spot Aggregate Trades",
      description: "Fetch spot aggregate trades from /api/v3/aggTrades.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "binance-spot-aggregate-trades", symbols: [] },
      controls: ["symbols", "timeRange", "fromId", "limit"],
      timeRangeAware: true,
    },
    {
      id: "binance-usdm-futures-prices",
      label: "USD-M Futures Prices",
      description: "Fetch USD-M futures prices from /fapi/v2/ticker/price.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "binance-usdm-futures-prices", symbols: [] },
      controls: ["symbols", "limit"],
    },
    {
      id: "binance-usdm-futures-ohlc",
      label: "USD-M Futures OHLC",
      description: "Fetch USD-M futures OHLCV bars from /fapi/v1/klines.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "binance-usdm-futures-ohlc", symbols: [], interval: "1m" },
      controls: ["symbols", "interval", "timeRange", "limit"],
      timeRangeAware: true,
    },
    {
      id: "binance-usdm-futures-recent-trades",
      label: "USD-M Futures Recent Trades",
      description: "Fetch USD-M futures recent trades from /fapi/v1/trades.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "binance-usdm-futures-recent-trades", symbols: [] },
      controls: ["symbols", "limit"],
    },
    {
      id: "binance-usdm-futures-aggregate-trades",
      label: "USD-M Futures Aggregate Trades",
      description: "Fetch USD-M futures aggregate trades from /fapi/v1/aggTrades.",
      outputContracts: tabularOutputContracts,
      defaultQuery: { kind: "binance-usdm-futures-aggregate-trades", symbols: [] },
      controls: ["symbols", "timeRange", "fromId", "limit"],
      timeRangeAware: true,
    },
  ],
  requiredPermissions: ["connections:query"],
  configEditor: BinanceConnectionConfigEditor,
  exploreComponent: BinanceConnectionExplore,
  queryEditor: BinanceConnectionQueryEditor,
  usageGuidance,
  examples: [
    {
      title: "Spot BTCUSDT OHLC",
      publicConfig: {
        spotBaseUrl: "https://api.binance.com",
        usdmFuturesBaseUrl: "https://fapi.binance.com",
        marketTypes: ["spot"],
        defaultQuoteAsset: "USDT",
        defaultInterval: "1m",
        defaultLimit: 1000,
        requestTimeoutMs: 10000,
        queryCachePolicy: "read",
        queryCacheTtlMs: 30000,
        metadataCacheTtlMs: 300000,
        dedupeInFlight: true,
      },
      query: {
        kind: "binance-spot-ohlc",
        symbols: ["BTCUSDT"],
        interval: "1m",
        limit: 500,
      },
    },
    {
      title: "USD-M futures aggregate trades",
      publicConfig: {
        marketTypes: ["usdm_futures"],
        defaultQuoteAsset: "USDT",
        defaultLimit: 1000,
      },
      query: {
        kind: "binance-usdm-futures-aggregate-trades",
        symbols: ["BTCUSDT"],
        fromId: 123,
        limit: 1000,
      },
    },
  ],
};

export default binanceMarketDataConnection;
