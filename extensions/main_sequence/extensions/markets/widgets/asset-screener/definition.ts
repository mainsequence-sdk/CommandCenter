import { Search } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import {
  buildMarketAssetFrameSemanticMeta,
  buildMarketTableFrameMeta,
  MARKET_ASSET_HISTORY_SERIES_FRAME_ROLE,
  MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE,
  MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
  MARKET_ASSET_SCREENER_HISTORY_INPUT_ID,
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
  MARKET_ASSET_SCREENER_INPUT_CONTRACTS,
} from "../../widget-contracts/marketAssetFrames";
import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { AssetScreenerWidget } from "./AssetScreenerWidget";
import { AssetScreenerWidgetSettings } from "./AssetScreenerWidgetSettings";
import {
  assetScreenerDefaultProps,
  resolveAssetScreenerState,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";

const datasetOutputId = "dataset";
const updatesOutputId = "updates";

const mockSeedData = {
  status: "ready",
  columns: [
    "asset_id",
    "symbol",
    "display_name",
    "sector",
    "time",
    "last_price",
    "previous_close",
    "volume",
    "price_sparkline",
  ],
  rows: [
    {
      asset_id: "asset:AAPL",
      symbol: "AAPL",
      display_name: "Apple Inc.",
      sector: "Technology",
      time: "2026-05-16T13:00:00.000Z",
      last_price: 110,
      previous_close: 100,
      volume: 42_000_000,
      price_sparkline: "101,104,106,108,107,110",
    },
    {
      asset_id: "asset:MSFT",
      symbol: "MSFT",
      display_name: "Microsoft Corp.",
      sector: "Technology",
      time: "2026-05-16T13:00:00.000Z",
      last_price: 204,
      previous_close: 210,
      volume: 31_000_000,
      price_sparkline: "196,199,201,205,202,204",
    },
    {
      asset_id: "asset:JPM",
      symbol: "JPM",
      display_name: "JPMorgan Chase",
      sector: "Financials",
      time: "2026-05-16T13:00:00.000Z",
      last_price: 158,
      previous_close: 151,
      volume: 12_000_000,
      price_sparkline: "151,153,156,155,157,158",
    },
  ],
  meta: {
    ...buildMarketAssetFrameSemanticMeta({
      role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
      fieldRoles: [
        { field: "asset_id", role: "assetKey" },
        { field: "symbol", role: "symbol" },
        { field: "display_name", role: "displayName" },
        { field: "sector", role: "sector" },
        { field: "time", role: "observedAt" },
        { field: "last_price", role: "value", valueKey: "price" },
        { field: "volume", role: "value", valueKey: "volume" },
        { field: "previous_close", role: "referenceValue", referenceKey: "previousClose", valueKey: "price" },
        { field: "price_sparkline", role: "sparklineSeries", valueKey: "price", encoding: "csv-number" },
        { field: "one_day_return", role: "value", valueKey: "oneDayReturn" },
      ],
    }),
    ...buildMarketTableFrameMeta({
      tableTransforms: {
        computedColumns: [
          {
            id: "one_day_return",
            label: "1D %",
            type: "number",
            expression: {
              op: "percentChange",
              current: { field: "last_price" },
              reference: { field: "previous_close" },
            },
          },
        ],
      },
      tableVisuals: {
        columns: {
          one_day_return: {
            format: "percent",
            colorScale: {
              negative: "red",
              neutral: "muted",
              positive: "green",
            },
            range: {
              min: -10,
              max: 10,
              midpoint: 0,
            },
          },
          price_sparkline: {
            kind: "sparkline",
            encoding: "csv-number",
            order: "oldest-to-newest",
          },
        },
      },
    }),
  },
  source: {
    kind: "mock-market-snapshot",
    updatedAtMs: 1_779_000_000_000,
  },
};

const mockReferenceData = {
  status: "ready",
  columns: ["asset_id", "reference_key", "observed_at", "close"],
  rows: [
    { asset_id: "asset:AAPL", reference_key: "previousClose", observed_at: "2026-05-15T20:00:00.000Z", close: 100 },
    { asset_id: "asset:AAPL", reference_key: "oneMonthAgo", observed_at: "2026-04-16T20:00:00.000Z", close: 96 },
    { asset_id: "asset:AAPL", reference_key: "yearStart", observed_at: "2026-01-02T20:00:00.000Z", close: 88 },
    { asset_id: "asset:AAPL", reference_key: "oneYearAgo", observed_at: "2025-05-16T20:00:00.000Z", close: 82 },
    { asset_id: "asset:MSFT", reference_key: "previousClose", observed_at: "2026-05-15T20:00:00.000Z", close: 210 },
    { asset_id: "asset:MSFT", reference_key: "oneMonthAgo", observed_at: "2026-04-16T20:00:00.000Z", close: 190 },
    { asset_id: "asset:MSFT", reference_key: "yearStart", observed_at: "2026-01-02T20:00:00.000Z", close: 178 },
    { asset_id: "asset:MSFT", reference_key: "oneYearAgo", observed_at: "2025-05-16T20:00:00.000Z", close: 165 },
    { asset_id: "asset:JPM", reference_key: "previousClose", observed_at: "2026-05-15T20:00:00.000Z", close: 151 },
    { asset_id: "asset:JPM", reference_key: "oneMonthAgo", observed_at: "2026-04-16T20:00:00.000Z", close: 149 },
    { asset_id: "asset:JPM", reference_key: "yearStart", observed_at: "2026-01-02T20:00:00.000Z", close: 141 },
    { asset_id: "asset:JPM", reference_key: "oneYearAgo", observed_at: "2025-05-16T20:00:00.000Z", close: 137 },
  ],
  meta: buildMarketAssetFrameSemanticMeta({
    role: MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE,
    fieldRoles: [
      { field: "asset_id", role: "assetKey" },
      { field: "reference_key", role: "referenceKey" },
      { field: "observed_at", role: "observedAt" },
      { field: "close", role: "value", valueKey: "price" },
    ],
  }),
  source: {
    kind: "mock-market-reference-points",
    updatedAtMs: 1_779_000_000_000,
  },
};

const mockHistoryData = {
  status: "ready",
  columns: ["asset_id", "symbol", "observed_at", "close"],
  rows: [
    { asset_id: "asset:AAPL", symbol: "AAPL", observed_at: "2026-05-10T20:00:00.000Z", close: 101 },
    { asset_id: "asset:AAPL", symbol: "AAPL", observed_at: "2026-05-11T20:00:00.000Z", close: 104 },
    { asset_id: "asset:AAPL", symbol: "AAPL", observed_at: "2026-05-12T20:00:00.000Z", close: 106 },
    { asset_id: "asset:AAPL", symbol: "AAPL", observed_at: "2026-05-13T20:00:00.000Z", close: 108 },
    { asset_id: "asset:AAPL", symbol: "AAPL", observed_at: "2026-05-14T20:00:00.000Z", close: 107 },
    { asset_id: "asset:MSFT", symbol: "MSFT", observed_at: "2026-05-10T20:00:00.000Z", close: 196 },
    { asset_id: "asset:MSFT", symbol: "MSFT", observed_at: "2026-05-11T20:00:00.000Z", close: 199 },
    { asset_id: "asset:MSFT", symbol: "MSFT", observed_at: "2026-05-12T20:00:00.000Z", close: 201 },
    { asset_id: "asset:MSFT", symbol: "MSFT", observed_at: "2026-05-13T20:00:00.000Z", close: 205 },
    { asset_id: "asset:MSFT", symbol: "MSFT", observed_at: "2026-05-14T20:00:00.000Z", close: 202 },
    { asset_id: "asset:JPM", symbol: "JPM", observed_at: "2026-05-10T20:00:00.000Z", close: 151 },
    { asset_id: "asset:JPM", symbol: "JPM", observed_at: "2026-05-11T20:00:00.000Z", close: 153 },
    { asset_id: "asset:JPM", symbol: "JPM", observed_at: "2026-05-12T20:00:00.000Z", close: 156 },
    { asset_id: "asset:JPM", symbol: "JPM", observed_at: "2026-05-13T20:00:00.000Z", close: 155 },
    { asset_id: "asset:JPM", symbol: "JPM", observed_at: "2026-05-14T20:00:00.000Z", close: 157 },
  ],
  meta: buildMarketAssetFrameSemanticMeta({
    role: MARKET_ASSET_HISTORY_SERIES_FRAME_ROLE,
    fieldRoles: [
      { field: "asset_id", role: "assetKey" },
      { field: "symbol", role: "symbol" },
      { field: "observed_at", role: "observedAt" },
      { field: "close", role: "value", valueKey: "price" },
    ],
  }),
  source: {
    kind: "mock-market-history-series",
    updatedAtMs: 1_779_000_000_000,
  },
};

export const mainSequenceAssetScreenerWidget = defineWidget<MainSequenceAssetScreenerWidgetProps>({
  id: "ms-markets-asset-screener",
  widgetVersion: "1.2.0",
  title: "Asset Screener",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Markets",
  kind: "table",
  source: "main_sequence_markets",
  requiredPermissions: ["main_sequence_markets:view"],
  tags: ["main-sequence", "markets", "asset", "screener", "terminal", "table", "live"],
  defaultSize: { w: 14, h: 8 },
  exampleProps: assetScreenerDefaultProps,
  mockProps: assetScreenerDefaultProps,
  mockRuntimeState: {
    marketAssetScreenerDemoFrames: {
      seedData: mockSeedData,
      referenceData: mockReferenceData,
      historyData: mockHistoryData,
    },
  },
  io: {
    inputs: [
      {
        id: MARKET_ASSET_SCREENER_SEED_INPUT_ID,
        label: "Seed data",
        accepts: [...MARKET_ASSET_SCREENER_INPUT_CONTRACTS],
        acceptedOutputIds: [datasetOutputId],
        required: false,
        description: "Latest/current snapshot used to initialize the screener.",
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "asset-screener" },
            description: "Snapshot rows initialize latest asset state.",
          },
        ],
      },
      {
        id: MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID,
        label: "Reference data",
        accepts: [...MARKET_ASSET_SCREENER_INPUT_CONTRACTS],
        acceptedOutputIds: [datasetOutputId],
        required: false,
        description: "Historical reference points used for return calculations.",
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "asset-screener" },
            description: "Reference rows provide historical baselines for calculated columns.",
          },
        ],
      },
      {
        id: MARKET_ASSET_SCREENER_HISTORY_INPUT_ID,
        label: "History data",
        accepts: [...MARKET_ASSET_SCREENER_INPUT_CONTRACTS],
        acceptedOutputIds: [datasetOutputId],
        required: false,
        description: "Bounded historical series used for trend sparklines.",
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "asset-screener" },
            description: "History rows provide ordered value series for sparkline columns.",
          },
        ],
      },
      {
        id: MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
        label: "Live updates",
        accepts: [...MARKET_ASSET_SCREENER_INPUT_CONTRACTS],
        acceptedOutputIds: [updatesOutputId],
        required: false,
        description: "Incremental latest updates that recalculate columns against reference data.",
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "asset-screener" },
            description: "Live rows update latest asset state without mutating references.",
          },
        ],
      },
    ],
  },
  workspaceRuntimeMode: "consumer",
  workspaceIcon: Search,
  railIcon: Search,
  settingsComponent: AssetScreenerWidgetSettings,
  settingsSchemaPlacement: "custom",
  buildAgentSnapshot: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) => {
    const state = resolveAssetScreenerState({
      props,
      resolvedInputs,
      runtimeDataStore,
      fallbackFrames: runtimeState?.marketAssetScreenerDemoFrames as never,
    });

    return {
      displayKind: "table",
      state: state.filteredRows.length > 0 ? "ready" : state.hasAnyBinding ? "empty" : "idle",
      summary: state.filteredRows.length > 0
        ? `${state.filteredRows.length.toLocaleString()} assets rendered with ${props.columns?.length ?? 0} configured columns.`
        : "Asset Screener is waiting for seedData and referenceData bindings.",
      data: {
        widgetRole: "presentation",
        contentType: "market-asset-screener",
        rowCount: state.filteredRows.length,
        columns: props.columns?.map((column) => ({
          id: column.id,
          label: column.label,
          kind: column.kind,
        })),
        rows: state.filteredRows.slice(0, 25).map((row) => ({
          asset: row.asset,
          metrics: row.metrics,
          status: row.status,
        })),
      },
    };
  },
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Configures a dense market asset screener with latest, reference-point, history-series, and live-update lanes.",
      requiredSetupSteps: [
        "Bind latest snapshot rows to seedData.",
        "Bind historical reference-point rows to referenceData, or mark inline referenceValue fields on seedData.",
        "Optionally bind bounded historical series rows to historyData for trend sparklines.",
        "Optionally bind WebSocket or incremental latest rows to liveUpdates.",
      ],
      configurationNotes: [
        "Generic tabular frames can use explicit field mappings or meta.marketAsset field roles.",
        "Row-local meta.tableTransforms can compute derived value keys before market semantic adaptation.",
        "Columns are dynamic view config over stable value keys such as price, volume, or marketCap.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes bound market data and derives rows locally without opening backend requests or WebSockets.",
    },
    io: {
      mode: "consumer",
      summary:
        "Consumes seedData, referenceData, historyData, and liveUpdates lanes to derive latest values, return columns, and sparkline columns.",
      inputContracts: [...MARKET_ASSET_SCREENER_INPUT_CONTRACTS],
      ioNotes: [
        "seedData initializes latest state and may carry inline referenceValue or sparklineSeries fields.",
        "referenceData supplies historical baselines.",
        "historyData supplies ordered value series for sparkline columns.",
        "liveUpdates mutates latest state only.",
      ],
    },
    capabilities: {
      supportsDynamicColumns: true,
      supportsHistorySeries: true,
      supportsLiveUpdates: true,
      supportsReferencePoints: true,
      supportsVirtualizedRows: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: AssetScreenerWidget,
});
