import type { ConnectionQueryModel } from "@/connections/types";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

export const MASSIVE_MARKET_DATA_CONNECTION_TYPE_ID = "finance.massive-market-data";

export type MassiveAssetClass =
  | "stocks"
  | "options"
  | "crypto"
  | "forex"
  | "indices"
  | "futures"
  | "economy"
  | "alternative"
  | "partners";

export type MassiveQueryCachePolicy = "read" | "disabled";

export interface MassivePublicConfig {
  baseUrl?: string;
  enabledAssetClasses?: MassiveAssetClass[];
  enableBetaEndpoints?: boolean;
  enableDeprecatedEndpoints?: boolean;
  defaultLimit?: number;
  maxRows?: number;
  requestTimeoutMs?: number;
  queryCachePolicy?: MassiveQueryCachePolicy;
  queryCacheTtlMs?: number;
  metadataCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}

export interface MassiveSecureConfig {
  apiKey?: string;
}

type MassiveEndpointFlag = "beta" | "deprecated";
type MassiveEndpointCatalogRow = readonly [
  kind: `massive-${string}`,
  assetClass: MassiveAssetClass,
  providerPath: `/${string}`,
  description: string,
  flags?: readonly MassiveEndpointFlag[],
];

export const MASSIVE_ASSET_CLASS_OPTIONS = [
  { label: "Stocks", value: "stocks" },
  { label: "Options", value: "options" },
  { label: "Crypto", value: "crypto" },
  { label: "Forex", value: "forex" },
  { label: "Indices", value: "indices" },
  { label: "Economy", value: "economy" },
  { label: "Alternative data", value: "alternative" },
  { label: "Partners", value: "partners" },
  { label: "Futures beta", value: "futures" },
] as const satisfies ReadonlyArray<{ label: string; value: MassiveAssetClass }>;

export const DEFAULT_MASSIVE_ASSET_CLASSES = [
  "stocks",
  "options",
  "crypto",
  "forex",
  "indices",
  "economy",
  "alternative",
  "partners",
] as const satisfies readonly MassiveAssetClass[];

export const MASSIVE_CONFIG_FIELD_HELP = {
  baseUrl:
    "Massive REST API root used by the backend adapter. Production should normally use https://api.massive.com.",
  enabledAssetClasses:
    "Asset classes enabled for this connection. The backend rejects queries for disabled classes, and futures also require beta endpoints to be enabled.",
  enableBetaEndpoints:
    "Allow backend catalog entries marked beta, including Massive futures REST endpoints. Default: false.",
  enableDeprecatedEndpoints:
    "Allow backend catalog entries marked deprecated, such as legacy stock split and dividend reference endpoints. Default: false.",
  defaultLimit:
    "Default provider page size for Massive requests when the query payload omits a limit. Valid range: 1 to 50000. Default: 1000.",
  maxRows:
    "Maximum normalized rows the backend returns after pagination. Valid range: 1 to 50000. Default: 50000.",
  requestTimeoutMs:
    "Backend HTTP timeout for Massive provider calls. Valid range: 1000 to 30000 milliseconds. Default: 10000.",
  queryCachePolicy:
    "Backend Massive query cache policy. Use read for short-lived successful provider response caching or disabled to bypass query-result caching.",
  queryCacheTtlMs:
    "Backend cache lifetime for successful Massive query responses in milliseconds. Default: 30000.",
  metadataCacheTtlMs:
    "Backend cache lifetime for Massive selector and endpoint-catalog resources in milliseconds. Default: 300000.",
  dedupeInFlight:
    "When enabled, the backend shares one in-flight provider request for identical cacheable Massive queries. Default: true.",
  apiKey:
    "Write-only Massive API key. Stored in secure config and sent only by the backend provider adapter as an Authorization bearer token.",
} as const;

const massiveEndpointRows = [
  [
    "massive-alternative-merchant-aggregates",
    "alternative",
    "/consumer-spending/eu/v1/merchant-aggregates",
    "EU consumer spending merchant aggregates.",
  ],
  [
    "massive-alternative-merchant-hierarchy",
    "alternative",
    "/consumer-spending/eu/v1/merchant-hierarchy",
    "Merchant-to-parent-company, ticker, sector, and industry mapping.",
  ],
  [
    "massive-crypto-custom-bars",
    "crypto",
    "/v2/aggs/ticker/{cryptoTicker}/range/{multiplier}/{timespan}/{from}/{to}",
    "Crypto OHLCV aggregate bars.",
  ],
  [
    "massive-crypto-daily-market-summary",
    "crypto",
    "/v2/aggs/grouped/locale/global/market/crypto/{date}",
    "Daily OHLCV for all crypto tickers on a date.",
  ],
  [
    "massive-crypto-daily-ticker-summary",
    "crypto",
    "/v1/open-close/crypto/{from}/{to}/{date}",
    "Daily open/close for a crypto pair.",
  ],
  [
    "massive-crypto-previous-day-bar",
    "crypto",
    "/v2/aggs/ticker/{cryptoTicker}/prev",
    "Previous day crypto OHLCV.",
  ],
  [
    "massive-crypto-condition-codes",
    "crypto",
    "/v3/reference/conditions",
    "Crypto trade and quote condition reference.",
  ],
  ["massive-crypto-exchanges", "crypto", "/v3/reference/exchanges", "Crypto exchange reference."],
  [
    "massive-crypto-market-holidays",
    "crypto",
    "/v1/marketstatus/upcoming",
    "Upcoming market holidays.",
  ],
  ["massive-crypto-market-status", "crypto", "/v1/marketstatus/now", "Current market status."],
  [
    "massive-crypto-full-market-snapshot",
    "crypto",
    "/v2/snapshot/locale/global/markets/crypto/tickers",
    "Full crypto market snapshot.",
  ],
  [
    "massive-crypto-single-ticker-snapshot",
    "crypto",
    "/v2/snapshot/locale/global/markets/crypto/tickers/{ticker}",
    "Single crypto ticker snapshot.",
  ],
  [
    "massive-crypto-top-market-movers",
    "crypto",
    "/v2/snapshot/locale/global/markets/crypto/{direction}",
    "Top crypto gainers or losers.",
  ],
  ["massive-crypto-unified-snapshot", "crypto", "/v3/snapshot", "Cross-asset unified snapshot."],
  ["massive-crypto-ema", "crypto", "/v1/indicators/ema/{cryptoTicker}", "Crypto EMA."],
  ["massive-crypto-macd", "crypto", "/v1/indicators/macd/{cryptoTicker}", "Crypto MACD."],
  ["massive-crypto-rsi", "crypto", "/v1/indicators/rsi/{cryptoTicker}", "Crypto RSI."],
  ["massive-crypto-sma", "crypto", "/v1/indicators/sma/{cryptoTicker}", "Crypto SMA."],
  ["massive-crypto-all-tickers", "crypto", "/v3/reference/tickers", "Crypto ticker discovery."],
  [
    "massive-crypto-ticker-overview",
    "crypto",
    "/v3/reference/tickers/{ticker}",
    "Crypto ticker detail.",
  ],
  [
    "massive-crypto-last-trade",
    "crypto",
    "/v1/last/crypto/{from}/{to}",
    "Latest crypto pair trade.",
  ],
  ["massive-crypto-trades", "crypto", "/v3/trades/{cryptoTicker}", "Historical crypto trades."],
  ["massive-economy-inflation", "economy", "/fed/v1/inflation", "Realized inflation indicators."],
  [
    "massive-economy-inflation-expectations",
    "economy",
    "/fed/v1/inflation-expectations",
    "Expected inflation indicators.",
  ],
  [
    "massive-economy-labor-market",
    "economy",
    "/fed/v1/labor-market",
    "Labor-market indicators.",
  ],
  [
    "massive-economy-treasury-yields",
    "economy",
    "/fed/v1/treasury-yields",
    "Treasury yield curve observations.",
  ],
  [
    "massive-forex-custom-bars",
    "forex",
    "/v2/aggs/ticker/{forexTicker}/range/{multiplier}/{timespan}/{from}/{to}",
    "FX OHLC aggregates from quotes.",
  ],
  [
    "massive-forex-daily-market-summary",
    "forex",
    "/v2/aggs/grouped/locale/global/market/fx/{date}",
    "Daily OHLC for all FX tickers.",
  ],
  [
    "massive-forex-previous-day-bar",
    "forex",
    "/v2/aggs/ticker/{forexTicker}/prev",
    "Previous day FX OHLC.",
  ],
  [
    "massive-forex-currency-conversion",
    "forex",
    "/v1/conversion/{from}/{to}",
    "Currency conversion.",
  ],
  ["massive-forex-exchanges", "forex", "/v3/reference/exchanges", "Forex exchange reference."],
  [
    "massive-forex-market-holidays",
    "forex",
    "/v1/marketstatus/upcoming",
    "Upcoming market holidays.",
  ],
  ["massive-forex-market-status", "forex", "/v1/marketstatus/now", "Current market status."],
  [
    "massive-forex-last-quote",
    "forex",
    "/v1/last_quote/currencies/{from}/{to}",
    "Latest FX quote.",
  ],
  ["massive-forex-quotes", "forex", "/v3/quotes/{fxTicker}", "Historical FX BBO quotes."],
  [
    "massive-forex-full-market-snapshot",
    "forex",
    "/v2/snapshot/locale/global/markets/forex/tickers",
    "Full FX market snapshot.",
  ],
  [
    "massive-forex-single-ticker-snapshot",
    "forex",
    "/v2/snapshot/locale/global/markets/forex/tickers/{ticker}",
    "Single FX ticker snapshot.",
  ],
  [
    "massive-forex-top-market-movers",
    "forex",
    "/v2/snapshot/locale/global/markets/forex/{direction}",
    "Top FX gainers or losers.",
  ],
  ["massive-forex-unified-snapshot", "forex", "/v3/snapshot", "Cross-asset unified snapshot."],
  ["massive-forex-ema", "forex", "/v1/indicators/ema/{fxTicker}", "FX EMA."],
  ["massive-forex-macd", "forex", "/v1/indicators/macd/{fxTicker}", "FX MACD."],
  ["massive-forex-rsi", "forex", "/v1/indicators/rsi/{fxTicker}", "FX RSI."],
  ["massive-forex-sma", "forex", "/v1/indicators/sma/{fxTicker}", "FX SMA."],
  ["massive-forex-all-tickers", "forex", "/v3/reference/tickers", "FX ticker discovery."],
  ["massive-forex-ticker-overview", "forex", "/v3/reference/tickers/{ticker}", "FX ticker detail."],
  [
    "massive-futures-aggregate-bars",
    "futures",
    "/futures/vX/aggs/{ticker}",
    "Futures OHLCV aggregate bars.",
    ["beta"],
  ],
  [
    "massive-futures-contracts",
    "futures",
    "/futures/vX/contracts",
    "Futures contract discovery and specifications.",
    ["beta"],
  ],
  [
    "massive-futures-exchanges",
    "futures",
    "/futures/vX/exchanges",
    "Futures exchange reference.",
    ["beta"],
  ],
  [
    "massive-futures-market-status",
    "futures",
    "/futures/vX/market-status",
    "Current futures market status.",
    ["beta"],
  ],
  [
    "massive-futures-products",
    "futures",
    "/futures/vX/products",
    "Futures product discovery and specifications.",
    ["beta"],
  ],
  [
    "massive-futures-schedules",
    "futures",
    "/futures/vX/schedules",
    "Futures trading schedules.",
    ["beta"],
  ],
  [
    "massive-futures-contracts-snapshot",
    "futures",
    "/futures/vX/snapshot",
    "Futures contract snapshots.",
    ["beta"],
  ],
  [
    "massive-futures-quotes",
    "futures",
    "/futures/vX/quotes/{ticker}",
    "Futures top-of-book quote history.",
    ["beta"],
  ],
  [
    "massive-futures-trades",
    "futures",
    "/futures/vX/trades/{ticker}",
    "Futures tick trades.",
    ["beta"],
  ],
  [
    "massive-indices-custom-bars",
    "indices",
    "/v2/aggs/ticker/{indicesTicker}/range/{multiplier}/{timespan}/{from}/{to}",
    "Index OHLC/value aggregates.",
  ],
  [
    "massive-indices-daily-ticker-summary",
    "indices",
    "/v1/open-close/{indicesTicker}/{date}",
    "Daily open/close for one index.",
  ],
  [
    "massive-indices-previous-day-bar",
    "indices",
    "/v2/aggs/ticker/{indicesTicker}/prev",
    "Previous day index OHLC.",
  ],
  [
    "massive-indices-market-holidays",
    "indices",
    "/v1/marketstatus/upcoming",
    "Upcoming market holidays.",
  ],
  ["massive-indices-market-status", "indices", "/v1/marketstatus/now", "Current market status."],
  ["massive-indices-snapshot", "indices", "/v3/snapshot/indices", "Indices snapshot."],
  ["massive-indices-unified-snapshot", "indices", "/v3/snapshot", "Cross-asset unified snapshot."],
  ["massive-indices-ema", "indices", "/v1/indicators/ema/{indicesTicker}", "Index EMA."],
  ["massive-indices-macd", "indices", "/v1/indicators/macd/{indicesTicker}", "Index MACD."],
  ["massive-indices-rsi", "indices", "/v1/indicators/rsi/{indicesTicker}", "Index RSI."],
  ["massive-indices-sma", "indices", "/v1/indicators/sma/{indicesTicker}", "Index SMA."],
  ["massive-indices-all-tickers", "indices", "/v3/reference/tickers", "Index ticker discovery."],
  [
    "massive-indices-ticker-overview",
    "indices",
    "/v3/reference/tickers/{ticker}",
    "Index ticker detail.",
  ],
  [
    "massive-options-custom-bars",
    "options",
    "/v2/aggs/ticker/{optionsTicker}/range/{multiplier}/{timespan}/{from}/{to}",
    "Options OHLCV aggregate bars.",
  ],
  [
    "massive-options-daily-ticker-summary",
    "options",
    "/v1/open-close/{optionsTicker}/{date}",
    "Daily open/close for an options contract.",
  ],
  [
    "massive-options-previous-day-bar",
    "options",
    "/v2/aggs/ticker/{optionsTicker}/prev",
    "Previous day options OHLC.",
  ],
  [
    "massive-options-all-contracts",
    "options",
    "/v3/reference/options/contracts",
    "Options contract discovery.",
  ],
  [
    "massive-options-contract-overview",
    "options",
    "/v3/reference/options/contracts/{options_ticker}",
    "Options contract detail.",
  ],
  [
    "massive-options-condition-codes",
    "options",
    "/v3/reference/conditions",
    "Options condition-code reference.",
  ],
  ["massive-options-exchanges", "options", "/v3/reference/exchanges", "Options exchange reference."],
  [
    "massive-options-market-holidays",
    "options",
    "/v1/marketstatus/upcoming",
    "Upcoming market holidays.",
  ],
  ["massive-options-market-status", "options", "/v1/marketstatus/now", "Current market status."],
  [
    "massive-options-chain-snapshot",
    "options",
    "/v3/snapshot/options/{underlyingAsset}",
    "Option chain snapshot.",
  ],
  [
    "massive-options-contract-snapshot",
    "options",
    "/v3/snapshot/options/{underlyingAsset}/{optionContract}",
    "Single options contract snapshot.",
  ],
  ["massive-options-unified-snapshot", "options", "/v3/snapshot", "Cross-asset unified snapshot."],
  ["massive-options-ema", "options", "/v1/indicators/ema/{optionsTicker}", "Options EMA."],
  ["massive-options-macd", "options", "/v1/indicators/macd/{optionsTicker}", "Options MACD."],
  ["massive-options-rsi", "options", "/v1/indicators/rsi/{optionsTicker}", "Options RSI."],
  ["massive-options-sma", "options", "/v1/indicators/sma/{optionsTicker}", "Options SMA."],
  ["massive-options-last-trade", "options", "/v2/last/trade/{optionsTicker}", "Latest options trade."],
  ["massive-options-quotes", "options", "/v3/quotes/{optionsTicker}", "Historical options quotes."],
  ["massive-options-trades", "options", "/v3/trades/{optionsTicker}", "Historical options trades."],
  [
    "massive-benzinga-analyst-details",
    "partners",
    "/benzinga/v1/analysts",
    "Benzinga analyst reference.",
  ],
  [
    "massive-benzinga-analyst-insights",
    "partners",
    "/benzinga/v1/analyst-insights",
    "Benzinga analyst insights.",
  ],
  ["massive-benzinga-analyst-ratings", "partners", "/benzinga/v1/ratings", "Benzinga analyst ratings."],
  [
    "massive-benzinga-bulls-bears-say",
    "partners",
    "/benzinga/v1/bulls-bears-say",
    "Benzinga bull and bear case summaries.",
  ],
  [
    "massive-benzinga-consensus-ratings",
    "partners",
    "/benzinga/v1/consensus-ratings/{ticker}",
    "Benzinga consensus ratings.",
  ],
  [
    "massive-benzinga-corporate-guidance",
    "partners",
    "/benzinga/v1/guidance",
    "Benzinga corporate guidance.",
  ],
  ["massive-benzinga-earnings", "partners", "/benzinga/v1/earnings", "Benzinga earnings data."],
  ["massive-benzinga-firm-details", "partners", "/benzinga/v1/firms", "Benzinga analyst firm details."],
  ["massive-benzinga-news", "partners", "/benzinga/v2/news", "Real-time Benzinga news."],
  ["massive-etf-analytics", "partners", "/etf-global/v1/analytics", "ETF analytics."],
  ["massive-etf-constituents", "partners", "/etf-global/v1/constituents", "ETF holdings and constituents."],
  ["massive-etf-fund-flows", "partners", "/etf-global/v1/fund-flows", "ETF fund flows."],
  ["massive-etf-profiles", "partners", "/etf-global/v1/profiles", "ETF profiles and exposure."],
  ["massive-etf-taxonomies", "partners", "/etf-global/v1/taxonomies", "ETF taxonomy reference."],
  ["massive-tmx-corporate-events", "partners", "/tmx/v1/corporate-events", "TMX corporate events."],
  [
    "massive-stocks-custom-bars",
    "stocks",
    "/v2/aggs/ticker/{stocksTicker}/range/{multiplier}/{timespan}/{from}/{to}",
    "Equity OHLCV aggregate bars.",
  ],
  [
    "massive-stocks-daily-market-summary",
    "stocks",
    "/v2/aggs/grouped/locale/us/market/stocks/{date}",
    "Daily OHLCV for all U.S. equities.",
  ],
  [
    "massive-stocks-daily-ticker-summary",
    "stocks",
    "/v1/open-close/{stocksTicker}/{date}",
    "Daily open/close for one equity.",
  ],
  [
    "massive-stocks-previous-day-bar",
    "stocks",
    "/v2/aggs/ticker/{stocksTicker}/prev",
    "Previous day equity OHLC.",
  ],
  ["massive-stocks-dividends", "stocks", "/stocks/v1/dividends", "Current dividends endpoint."],
  ["massive-stocks-ipos", "stocks", "/vX/reference/ipos", "IPO events."],
  [
    "massive-stocks-reference-dividends",
    "stocks",
    "/v3/reference/dividends",
    "Deprecated dividends endpoint.",
    ["deprecated"],
  ],
  [
    "massive-stocks-reference-splits",
    "stocks",
    "/v3/reference/splits",
    "Deprecated splits endpoint.",
    ["deprecated"],
  ],
  ["massive-stocks-splits", "stocks", "/stocks/v1/splits", "Current splits endpoint."],
  [
    "massive-stocks-ticker-events",
    "stocks",
    "/vX/reference/tickers/{id}/events",
    "Ticker event timeline.",
  ],
  [
    "massive-stocks-10k-sections",
    "stocks",
    "/stocks/filings/10-K/vX/sections",
    "10-K narrative section extracts.",
  ],
  ["massive-stocks-13f-filings", "stocks", "/stocks/filings/vX/13-F", "13-F holdings."],
  ["massive-stocks-8k-text", "stocks", "/stocks/filings/8-K/vX/text", "8-K text extracts."],
  ["massive-stocks-form-3", "stocks", "/stocks/filings/vX/form-3", "Insider ownership Form 3."],
  ["massive-stocks-form-4", "stocks", "/stocks/filings/vX/form-4", "Insider ownership Form 4."],
  ["massive-stocks-edgar-index", "stocks", "/stocks/filings/vX/index", "SEC EDGAR filing index."],
  [
    "massive-stocks-risk-categories",
    "stocks",
    "/stocks/taxonomies/vX/risk-factors",
    "Risk-factor taxonomy.",
  ],
  [
    "massive-stocks-risk-factors",
    "stocks",
    "/stocks/filings/vX/risk-factors",
    "Machine-readable risk factors.",
  ],
  [
    "massive-stocks-balance-sheets",
    "stocks",
    "/stocks/financials/v1/balance-sheets",
    "Balance sheets.",
  ],
  [
    "massive-stocks-cash-flow-statements",
    "stocks",
    "/stocks/financials/v1/cash-flow-statements",
    "Cash-flow statements.",
  ],
  ["massive-stocks-float", "stocks", "/stocks/vX/float", "Latest free float."],
  [
    "massive-stocks-income-statements",
    "stocks",
    "/stocks/financials/v1/income-statements",
    "Income statements.",
  ],
  ["massive-stocks-ratios", "stocks", "/stocks/financials/v1/ratios", "Financial ratios."],
  ["massive-stocks-short-interest", "stocks", "/stocks/v1/short-interest", "FINRA short interest."],
  ["massive-stocks-short-volume", "stocks", "/stocks/v1/short-volume", "FINRA short volume."],
  ["massive-stocks-condition-codes", "stocks", "/v3/reference/conditions", "Stock condition-code reference."],
  ["massive-stocks-exchanges", "stocks", "/v3/reference/exchanges", "Stock exchange reference."],
  [
    "massive-stocks-market-holidays",
    "stocks",
    "/v1/marketstatus/upcoming",
    "Upcoming market holidays.",
  ],
  ["massive-stocks-market-status", "stocks", "/v1/marketstatus/now", "Current market status."],
  ["massive-stocks-news", "stocks", "/v2/reference/news", "Massive stock news."],
  [
    "massive-stocks-full-market-snapshot",
    "stocks",
    "/v2/snapshot/locale/us/markets/stocks/tickers",
    "Full U.S. equity market snapshot.",
  ],
  [
    "massive-stocks-single-ticker-snapshot",
    "stocks",
    "/v2/snapshot/locale/us/markets/stocks/tickers/{stocksTicker}",
    "Single equity snapshot.",
  ],
  [
    "massive-stocks-top-market-movers",
    "stocks",
    "/v2/snapshot/locale/us/markets/stocks/{direction}",
    "Top stock gainers or losers.",
  ],
  ["massive-stocks-unified-snapshot", "stocks", "/v3/snapshot", "Cross-asset unified snapshot."],
  ["massive-stocks-ema", "stocks", "/v1/indicators/ema/{stockTicker}", "Stock EMA."],
  ["massive-stocks-macd", "stocks", "/v1/indicators/macd/{stockTicker}", "Stock MACD."],
  ["massive-stocks-rsi", "stocks", "/v1/indicators/rsi/{stockTicker}", "Stock RSI."],
  ["massive-stocks-sma", "stocks", "/v1/indicators/sma/{stockTicker}", "Stock SMA."],
  ["massive-stocks-all-tickers", "stocks", "/v3/reference/tickers", "Stock ticker discovery."],
  ["massive-stocks-related-tickers", "stocks", "/v1/related-companies/{ticker}", "Related companies."],
  ["massive-stocks-ticker-overview", "stocks", "/v3/reference/tickers/{ticker}", "Stock ticker detail."],
  ["massive-stocks-ticker-types", "stocks", "/v3/reference/tickers/types", "Ticker-type reference."],
  ["massive-stocks-last-quote", "stocks", "/v2/last/nbbo/{stocksTicker}", "Latest NBBO quote."],
  ["massive-stocks-last-trade", "stocks", "/v2/last/trade/{stocksTicker}", "Latest equity trade."],
  ["massive-stocks-quotes", "stocks", "/v3/quotes/{stockTicker}", "Historical NBBO quotes."],
  ["massive-stocks-trades", "stocks", "/v3/trades/{stockTicker}", "Historical equity trades."],
] as const satisfies readonly MassiveEndpointCatalogRow[];

export type MassiveQueryKind = (typeof massiveEndpointRows)[number][0];

export interface MassiveConnectionQuery extends Record<string, unknown> {
  kind?: MassiveQueryKind;
  pathParams?: Record<string, string | number | boolean>;
  params?: Record<string, unknown>;
  followPages?: boolean;
}

export interface MassiveEndpointCatalogEntry {
  kind: MassiveQueryKind;
  assetClass: MassiveAssetClass;
  providerPath: string;
  description: string;
  pathParamKeys: string[];
  beta: boolean;
  deprecated: boolean;
  timeRangeAware: boolean;
  defaultQuery: MassiveConnectionQuery;
}

export interface MassiveConnectionQueryModel extends ConnectionQueryModel {
  assetClass: MassiveAssetClass;
  providerPath: string;
  pathParamKeys: string[];
  beta?: boolean;
  deprecated?: boolean;
}

const tabularOutputContracts = [CORE_TABULAR_FRAME_SOURCE_CONTRACT];

const acronymLabels: Record<string, string> = {
  "10k": "10-K",
  "13f": "13-F",
  "8k": "8-K",
  bbo: "BBO",
  ema: "EMA",
  etf: "ETF",
  eu: "EU",
  fx: "FX",
  ipos: "IPOs",
  macd: "MACD",
  nbbo: "NBBO",
  ohlc: "OHLC",
  ohlcv: "OHLCV",
  rsi: "RSI",
  sec: "SEC",
  sma: "SMA",
  tmx: "TMX",
  usd: "USD",
};

function titleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => acronymLabels[part] ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatMassiveQueryKindLabel(kind: MassiveQueryKind) {
  return titleCase(kind.replace(/^massive-/, ""));
}

export function formatMassiveAssetClassLabel(assetClass: MassiveAssetClass) {
  return MASSIVE_ASSET_CLASS_OPTIONS.find((option) => option.value === assetClass)?.label ?? assetClass;
}

function extractPathParamKeys(providerPath: string) {
  return Array.from(providerPath.matchAll(/\{([^}]+)\}/g), (match) => match[1]!).filter(Boolean);
}

function isCurrencyPairPath(kind: MassiveQueryKind) {
  return (
    kind === "massive-crypto-daily-ticker-summary" ||
    kind === "massive-crypto-last-trade" ||
    kind === "massive-forex-currency-conversion" ||
    kind === "massive-forex-last-quote"
  );
}

function sampleTickerForKind(kind: MassiveQueryKind) {
  if (kind.includes("-crypto-")) {
    return "X:BTCUSD";
  }

  if (kind.includes("-forex-")) {
    return "C:EURUSD";
  }

  if (kind.includes("-indices-")) {
    return "I:SPX";
  }

  if (kind.includes("-options-")) {
    return "O:AAPL260116C00150000";
  }

  if (kind.includes("-futures-")) {
    return "ESM6";
  }

  return "AAPL";
}

function samplePathParamValue(kind: MassiveQueryKind, key: string) {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "multiplier") {
    return 1;
  }

  if (normalizedKey === "timespan") {
    return "day";
  }

  if (normalizedKey === "direction") {
    return "gainers";
  }

  if (normalizedKey === "date") {
    return "2026-04-26";
  }

  if ((normalizedKey === "from" || normalizedKey === "to") && !isCurrencyPairPath(kind)) {
    return normalizedKey === "from" ? "2026-01-01" : "2026-04-26";
  }

  if (normalizedKey === "from") {
    return kind.includes("-crypto-") ? "BTC" : "USD";
  }

  if (normalizedKey === "to") {
    return kind.includes("-crypto-") ? "USD" : "EUR";
  }

  if (normalizedKey === "underlyingasset") {
    return "AAPL";
  }

  if (normalizedKey === "optioncontract" || normalizedKey === "options_ticker") {
    return "O:AAPL260116C00150000";
  }

  if (normalizedKey === "id") {
    return "AAPL";
  }

  if (normalizedKey.includes("ticker")) {
    return sampleTickerForKind(kind);
  }

  return "AAPL";
}

function buildDefaultPathParams(kind: MassiveQueryKind, pathParamKeys: string[]) {
  return pathParamKeys.reduce<Record<string, string | number | boolean>>((result, key) => {
    result[key] = samplePathParamValue(kind, key);
    return result;
  }, {});
}

function buildDefaultParams(kind: MassiveQueryKind) {
  if (kind.endsWith("-custom-bars")) {
    return {
      adjusted: true,
      sort: "asc",
      limit: 5000,
    };
  }

  if (
    kind.endsWith("-ema") ||
    kind.endsWith("-macd") ||
    kind.endsWith("-rsi") ||
    kind.endsWith("-sma")
  ) {
    return {
      adjusted: true,
      order: "asc",
      limit: 5000,
    };
  }

  if (
    kind.endsWith("-quotes") ||
    kind.endsWith("-trades") ||
    kind.endsWith("-all-tickers") ||
    kind.endsWith("-all-contracts") ||
    kind.endsWith("-news")
  ) {
    return { limit: 1000 };
  }

  return {};
}

function buildDefaultQuery(kind: MassiveQueryKind, pathParamKeys: string[]): MassiveConnectionQuery {
  const pathParams = buildDefaultPathParams(kind, pathParamKeys);
  const params = buildDefaultParams(kind);

  return {
    kind,
    ...(Object.keys(pathParams).length > 0 ? { pathParams } : {}),
    ...(Object.keys(params).length > 0 ? { params } : {}),
  };
}

function isTimeRangeAware(kind: MassiveQueryKind, pathParamKeys: string[]) {
  return kind.endsWith("-custom-bars") && pathParamKeys.includes("from") && pathParamKeys.includes("to");
}

export const massiveEndpointCatalog: MassiveEndpointCatalogEntry[] = massiveEndpointRows.map(
  ([kind, assetClass, providerPath, description, flags = []]) => {
    const pathParamKeys = extractPathParamKeys(providerPath);
    const endpointFlags = flags as readonly MassiveEndpointFlag[];

    return {
      kind,
      assetClass,
      providerPath,
      description,
      pathParamKeys,
      beta: endpointFlags.includes("beta"),
      deprecated: endpointFlags.includes("deprecated"),
      timeRangeAware: isTimeRangeAware(kind, pathParamKeys),
      defaultQuery: buildDefaultQuery(kind, pathParamKeys),
    };
  },
);

export const massiveEndpointCatalogByKind = new Map(
  massiveEndpointCatalog.map((entry) => [entry.kind, entry]),
);

export const massiveQueryModels: MassiveConnectionQueryModel[] = massiveEndpointCatalog.map((entry) => ({
  id: entry.kind,
  label: formatMassiveQueryKindLabel(entry.kind),
  description: `${entry.description} Provider path: ${entry.providerPath}.`,
  outputContracts: tabularOutputContracts,
  defaultOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  defaultQuery: entry.defaultQuery,
  controls: [
    ...(entry.pathParamKeys.length > 0 ? ["pathParams"] : []),
    "params",
    ...(entry.timeRangeAware ? ["timeRange"] : []),
  ],
  timeRangeAware: entry.timeRangeAware,
  supportsVariables: false,
  supportsMaxRows: true,
  assetClass: entry.assetClass,
  providerPath: entry.providerPath,
  pathParamKeys: entry.pathParamKeys,
  beta: entry.beta || undefined,
  deprecated: entry.deprecated || undefined,
}));

export function isMassiveQueryKind(value: unknown): value is MassiveQueryKind {
  return typeof value === "string" && massiveEndpointCatalogByKind.has(value as MassiveQueryKind);
}

export function getEnabledMassiveAssetClasses(
  publicConfig: MassivePublicConfig | Record<string, unknown> | undefined,
) {
  const configured = publicConfig?.enabledAssetClasses;

  if (Array.isArray(configured) && configured.length > 0) {
    return configured.filter((value): value is MassiveAssetClass =>
      MASSIVE_ASSET_CLASS_OPTIONS.some((option) => option.value === value),
    );
  }

  return [...DEFAULT_MASSIVE_ASSET_CLASSES];
}

export function filterMassiveQueryModelsForConfig(
  queryModels: readonly ConnectionQueryModel[] | undefined,
  publicConfig: MassivePublicConfig | Record<string, unknown> | undefined,
) {
  const enabledAssetClasses = new Set(getEnabledMassiveAssetClasses(publicConfig));
  const enableBetaEndpoints = publicConfig?.enableBetaEndpoints === true;
  const enableDeprecatedEndpoints = publicConfig?.enableDeprecatedEndpoints === true;

  return (queryModels ?? massiveQueryModels).filter((model) => {
    const catalogEntry = massiveEndpointCatalogByKind.get(model.id as MassiveQueryKind);

    if (!catalogEntry) {
      return false;
    }

    if (!enabledAssetClasses.has(catalogEntry.assetClass)) {
      return false;
    }

    if (catalogEntry.beta && !enableBetaEndpoints) {
      return false;
    }

    if (catalogEntry.deprecated && !enableDeprecatedEndpoints) {
      return false;
    }

    return true;
  });
}

export function buildMassiveCatalogUsageMarkdown() {
  return MASSIVE_ASSET_CLASS_OPTIONS.map((option) => {
    const entries = massiveEndpointCatalog.filter((entry) => entry.assetClass === option.value);

    if (entries.length === 0) {
      return "";
    }

    const lines = entries.map((entry) => {
      const flags = [
        entry.timeRangeAware ? "time-range-aware" : undefined,
        entry.beta ? "beta" : undefined,
        entry.deprecated ? "deprecated" : undefined,
      ]
        .filter(Boolean)
        .join(", ");

      return `- \`${entry.kind}\`: ${entry.providerPath}; returns \`core.tabular_frame@v1\`${flags ? `; ${flags}` : ""}.`;
    });

    return `### ${option.label}\n\n${lines.join("\n")}`;
  })
    .filter(Boolean)
    .join("\n\n");
}
