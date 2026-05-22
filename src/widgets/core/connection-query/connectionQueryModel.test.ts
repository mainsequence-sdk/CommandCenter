import { describe, expect, it } from "vitest";

import { mockApiConnection } from "@/connections/mock-api";
import {
  MOCK_API_CONNECTION_TYPE_ID,
  MOCK_API_LOCAL_INSTANCE_ID,
  MOCK_API_QUERY_KIND,
} from "@/connections/mock-api-contract";
import type { ConnectionQueryModel } from "@/connections/types";
import { createRuntimeDataStore, materializeRuntimeTabularFrame } from "@/widgets/shared/runtime-data-store";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";
import type { WidgetExecutionDashboardState } from "@/widgets/types";

import {
  assetScreenerDefaultProps,
  resolveAssetScreenerState,
} from "../../../../extensions/main_sequence/extensions/markets/widgets/asset-screener/assetScreenerModel";
import {
  buildConnectionQueryRequest,
  executeConnectionQueryWidgetRequest,
  normalizeConnectionQueryProps,
} from "./connectionQueryModel";

describe("normalizeConnectionQueryProps", () => {
  it("preserves legacy uid-based connection refs for saved widgets", () => {
    const normalized = normalizeConnectionQueryProps({
      connectionRef: {
        uid: "42",
        typeId: "finance.binance-market-data",
      },
      queryModelId: "binance-spot-prices",
      query: {
        kind: "binance-spot-prices",
      },
    } as unknown as Parameters<typeof normalizeConnectionQueryProps>[0]);

    expect(normalized.connectionRef).toEqual({
      id: 42,
      typeId: "finance.binance-market-data",
    });
    expect(normalized.queryModelId).toBe("binance-spot-prices");
  });
});

describe("buildConnectionQueryRequest", () => {
  const dashboardState: WidgetExecutionDashboardState = {
    timeRangeKey: "15m",
    rangeStartMs: Date.parse("2026-05-21T21:44:48.559Z"),
    rangeEndMs: Date.parse("2026-05-21T21:59:48.559Z"),
    refreshIntervalMs: null,
  };
  const queryModel: ConnectionQueryModel = {
    id: "binance-usdm-futures-ohlc",
    label: "Futures OHLC",
    outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
    defaultQuery: {
      kind: "binance-usdm-futures-ohlc",
      interval: "1m",
    },
    timeRangeAware: true,
    supportsMaxRows: true,
  };

  it("merges query model defaults without dropping resolved query fields", () => {
    const request = buildConnectionQueryRequest(
      {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        query: {
          symbols: ["BTCUSDT"],
        },
        timeRangeMode: "dashboard",
        maxRows: 1000,
      },
      dashboardState,
      queryModel,
    );

    expect(request?.query).toEqual({
      kind: "binance-usdm-futures-ohlc",
      interval: "1m",
      symbols: ["BTCUSDT"],
    });
  });

  it("lets resolved query fields override query model defaults", () => {
    const request = buildConnectionQueryRequest(
      {
        connectionRef: {
          id: 5,
          typeId: "finance.binance-market-data",
        },
        queryModelId: "binance-usdm-futures-ohlc",
        query: {
          kind: "binance-usdm-futures-ohlc",
          interval: "5m",
          symbols: ["ETHUSDT"],
        },
        timeRangeMode: "dashboard",
      },
      dashboardState,
      queryModel,
    );

    expect(request?.query).toEqual({
      kind: "binance-usdm-futures-ohlc",
      interval: "5m",
      symbols: ["ETHUSDT"],
    });
  });
});

describe("executeConnectionQueryWidgetRequest", () => {
  it("preserves mock tabular-frame metadata for Asset Screener source columns", async () => {
    const responseBody = {
      status: "ready",
      columns: [
        "unique_identifier",
        "Symbol",
        "sector",
        "last_price",
        "previous_close",
      ],
      rows: [
        {
          unique_identifier: "uid:BTCUSDT",
          Symbol: "BTCUSDT",
          sector: "Layer 1",
          last_price: 109420,
          previous_close: 107980,
        },
      ],
      meta: {
        marketAsset: {
          role: "snapshot",
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
            { field: "sector", role: "sector" },
            { field: "last_price", role: "value", valueKey: "price" },
            {
              field: "previous_close",
              role: "referenceValue",
              referenceKey: "previousClose",
              valueKey: "price",
            },
          ],
        },
        tableVisuals: {
          columns: {
            Symbol: { label: "Symbol" },
            sector: { label: "Sector" },
            last_price: { label: "Last", format: "price" },
            previous_close: {
              label: "Previous close",
              format: "price",
              visible: false,
            },
            one_day_return: {
              label: "1D",
              format: "formula",
              formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
              formulaResultFormat: "percent",
            },
          },
        },
      },
    };
    const store = createRuntimeDataStore("mock-api-asset-screener-test");
    const runtimeState = await executeConnectionQueryWidgetRequest(
      {
        connectionRef: {
          id: MOCK_API_LOCAL_INSTANCE_ID,
          typeId: MOCK_API_CONNECTION_TYPE_ID,
        },
        queryModelId: MOCK_API_QUERY_KIND,
        query: {
          kind: MOCK_API_QUERY_KIND,
          responseMode: "auto",
          responseBody,
        },
      },
      undefined,
      mockApiConnection.queryModels![0],
      {
        ownerId: "connection-query-test",
        runtimeDataStore: store,
      },
    );
    const frame = materializeRuntimeTabularFrame(runtimeState, store);
    const state = resolveAssetScreenerState({
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData: frame,
      },
    });

    expect(frame?.meta?.tableVisuals).toMatchObject(responseBody.meta.tableVisuals);
    expect(state.columns.map((column) => column.id)).toEqual([
      "Symbol",
      "sector",
      "last_price",
      "one_day_return",
    ]);
  });

  it("keeps a full market asset mock frame valid for Asset Screener", async () => {
    const responseBody = {
      meta: {
        marketAsset: {
          role: "snapshot",
          fieldRoles: [
            { role: "assetKey", field: "unique_identifier" },
            { role: "symbol", field: "Symbol" },
            { role: "displayName", field: "display_name" },
            { role: "sector", field: "sector" },
            { role: "observedAt", field: "time" },
            { role: "value", field: "last_price", valueKey: "price" },
            { role: "value", field: "volume", valueKey: "volume" },
            {
              role: "referenceValue",
              field: "previous_close",
              valueKey: "price",
              referenceKey: "previousClose",
            },
            {
              role: "referenceValue",
              field: "one_month_ago",
              valueKey: "price",
              referenceKey: "oneMonthAgo",
            },
            {
              role: "referenceValue",
              field: "year_start",
              valueKey: "price",
              referenceKey: "yearStart",
            },
            {
              role: "referenceValue",
              field: "one_year_ago",
              valueKey: "price",
              referenceKey: "oneYearAgo",
            },
            {
              role: "sparklineSeries",
              field: "price_sparkline",
              order: "oldest-to-newest",
              encoding: "csv-number",
              valueKey: "price",
            },
          ],
        },
        tableVisuals: {
          columns: {
            Symbol: { label: "Symbol", width: 112 },
            sector: { label: "Sector", width: 140 },
            last_price: { label: "Last", width: 108, format: "price" },
            previous_close: { label: "Previous close", format: "price", visible: false },
            one_month_ago: { label: "One month ago", format: "price", visible: false },
            year_start: { label: "Year start", format: "price", visible: false },
            one_year_ago: { label: "One year ago", format: "price", visible: false },
            ytd_return: {
              label: "YTD",
              format: "formula",
              formulaExpression: "PERCENT_CHANGE([last_price], [year_start])",
              formulaResultFormat: "percent",
              heatmap: true,
              visualMax: 20,
              visualMin: -20,
              gradientMode: "fill",
              heatmapPalette: "red-yellow-green",
              visualRangeMode: "fixed",
            },
            one_day_return: {
              label: "1D",
              format: "formula",
              formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
              formulaResultFormat: "percent",
              gaugeMode: "ring",
              visualMax: 3,
              visualMin: -3,
              thresholds: [
                { tone: "warning", value: 0, operator: "lt" },
                { tone: "neutral", value: 0, operator: "eq" },
                { tone: "success", value: 0, operator: "gt" },
              ],
              visualRangeMode: "fixed",
            },
            one_year_return: {
              label: "1Y",
              format: "formula",
              formulaExpression: "PERCENT_CHANGE([last_price], [one_year_ago])",
              formulaResultFormat: "percent",
              visualMax: 30,
              visualMin: -12,
              colorScale: { negative: "danger", positive: "success" },
              visualRangeMode: "fixed",
            },
            price_sparkline: {
              kind: "sparkline",
              label: "Trend",
              order: "oldest-to-newest",
              width: 132,
              encoding: "csv-number",
            },
            one_month_return: {
              label: "1M",
              format: "formula",
              formulaExpression: "PERCENT_CHANGE([last_price], [one_month_ago])",
              formulaResultFormat: "percent",
              visualMax: 10,
              visualMin: -10,
              colorScale: { negative: "danger", positive: "success" },
              visualRangeMode: "fixed",
            },
          },
        },
      },
      rows: [
        {
          time: "2026-05-19T13:00:00.000Z",
          Symbol: "BTCUSDT",
          sector: "Layer 1",
          volume: 28400000000,
          last_price: 109420,
          year_start: 92400,
          display_name: "Bitcoin",
          one_year_ago: 76800,
          one_month_ago: 101300,
          previous_close: 107980,
          price_sparkline: "100800,102400,104950,106700,107980,109420",
          unique_identifier: "uid:BTCUSDT",
        },
        {
          time: "2026-05-19T13:00:00.000Z",
          Symbol: "ETHUSDT",
          sector: "Layer 1",
          volume: 16900000000,
          last_price: 5860,
          year_start: 4380,
          display_name: "Ethereum",
          one_year_ago: 3620,
          one_month_ago: 5120,
          previous_close: 5710,
          price_sparkline: "5140,5280,5420,5560,5710,5860",
          unique_identifier: "uid:ETHUSDT",
        },
      ],
      status: "ready",
      columns: [
        "unique_identifier",
        "Symbol",
        "display_name",
        "sector",
        "time",
        "last_price",
        "previous_close",
        "one_month_ago",
        "year_start",
        "one_year_ago",
        "volume",
        "price_sparkline",
      ],
    };
    const store = createRuntimeDataStore("mock-api-full-asset-screener-test");
    const runtimeState = await executeConnectionQueryWidgetRequest(
      {
        connectionRef: {
          id: MOCK_API_LOCAL_INSTANCE_ID,
          typeId: MOCK_API_CONNECTION_TYPE_ID,
        },
        queryModelId: MOCK_API_QUERY_KIND,
        query: {
          kind: MOCK_API_QUERY_KIND,
          responseMode: "auto",
          responseBody,
        },
      },
      undefined,
      mockApiConnection.queryModels![0],
      {
        ownerId: "connection-query-test",
        runtimeDataStore: store,
      },
    );
    const frame = materializeRuntimeTabularFrame(runtimeState, store);
    const state = resolveAssetScreenerState({
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData: frame,
      },
    });

    expect(frame?.meta?.marketAsset).toMatchObject(responseBody.meta.marketAsset);
    expect(frame?.meta?.tableVisuals).toMatchObject(responseBody.meta.tableVisuals);
    expect(state.columnConfigSource).toBe("source");
    expect(state.columns.map((column) => column.id)).toEqual([
      "Symbol",
      "sector",
      "last_price",
      "ytd_return",
      "one_day_return",
      "one_year_return",
      "price_sparkline",
      "one_month_return",
    ]);
    expect(state.filteredRows).toHaveLength(2);
  });
});
