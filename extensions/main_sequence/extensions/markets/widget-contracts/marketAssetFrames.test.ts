import { describe, expect, it } from "vitest";

import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";

import {
  adaptMarketAssetSnapshotFrame,
  adaptMarketAssetReferencePointsFrame,
  buildMarketAssetFrameSemanticMeta,
  buildMarketAssetScreenerRuntimeModelFromTabularFrames,
  deriveMarketAssetScreenerRows,
  getMarketAssetFrameRoleMetadata,
  MARKET_ASSET_HISTORY_SERIES_FRAME_ROLE,
  MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE,
  MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
  type MarketAssetScreenerColumn,
} from "./marketAssetFrames";

function frame(input: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  updatedAtMs?: number;
  meta?: Record<string, unknown>;
}): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: input.columns,
    rows: input.rows,
    meta: input.meta,
    source: {
      kind: "test-market-source",
      updatedAtMs: input.updatedAtMs,
    },
  };
}

describe("marketAssetFrames", () => {
  it("defines Markets-scoped semantic role metadata", () => {
    const snapshot = getMarketAssetFrameRoleMetadata(MARKET_ASSET_SNAPSHOT_FRAME_ROLE);
    const references = getMarketAssetFrameRoleMetadata(MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE);
    const history = getMarketAssetFrameRoleMetadata(MARKET_ASSET_HISTORY_SERIES_FRAME_ROLE);

    expect(snapshot.fieldRoles.some((role) => role.role === "assetKey" && role.required)).toBe(false);
    expect(snapshot.fieldRoles.some((role) => role.role === "value" && role.valueKeyRequired)).toBe(true);
    expect(snapshot.fieldRoles.some((role) => role.role === "referenceValue" && role.valueKeyRequired)).toBe(true);
    expect(snapshot.fieldRoles.some((role) => role.role === "sparklineSeries" && role.valueKeyRequired)).toBe(true);
    expect(references.fieldRoles.some((role) => role.role === "referenceKey" && role.required)).toBe(true);
    expect(history.fieldRoles.some((role) => role.role === "observedAt" && role.required)).toBe(true);
  });

  it("builds a screener runtime model from seed metadata and live tabular frames", () => {
    const seed = frame({
      columns: ["unique_identifier", "Symbol", "time", "last_price", "previous_close", "sector"],
      rows: [
        {
          unique_identifier: "asset:AAPL",
          Symbol: "AAPL",
          time: "2026-05-16T13:00:00.000Z",
          last_price: 110,
          previous_close: 100,
          sector: "Technology",
        },
      ],
      updatedAtMs: 1000,
      meta: buildMarketAssetFrameSemanticMeta({
        role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
        fieldRoles: [
          { field: "unique_identifier", role: "assetKey" },
          { field: "Symbol", role: "symbol" },
          { field: "time", role: "observedAt" },
          { field: "last_price", role: "value", valueKey: "price" },
          { field: "previous_close", role: "referenceValue", referenceKey: "previousClose", valueKey: "price" },
        ],
      }),
    });
    const live = frame({
      columns: ["unique_identifier", "time", "last_price"],
      rows: [
        {
          unique_identifier: "asset:AAPL",
          time: "2026-05-16T13:01:00.000Z",
          last_price: 112,
        },
      ],
      updatedAtMs: 1200,
    });
    const columns: MarketAssetScreenerColumn[] = [
      {
        id: "symbol",
        kind: "asset-field",
        label: "Symbol",
        field: "symbol",
      },
      {
        id: "last",
        kind: "latest-value",
        label: "Last",
        valueField: "price",
      },
      {
        id: "pct",
        kind: "return",
        label: "% Chg",
        referenceKey: "previousClose",
        valueField: "price",
        returnMode: "percent",
      },
    ];

    const runtime = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
      seedData: seed,
      liveUpdates: live,
      liveMapping: {
        assetKeyField: "unique_identifier",
        observedAtField: "time",
        valueFields: {
          price: "last_price",
        },
      },
    });
    const rows = deriveMarketAssetScreenerRows(runtime, columns);

    expect(runtime.latestByKey["asset:AAPL"]?.values.price).toBe(112);
    expect(runtime.referencesByKey["asset:AAPL"]?.previousClose?.values.price).toBe(100);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("ready");
    expect(rows[0]?.metrics).toMatchObject({
      symbol: "AAPL",
      last: 112,
    });
    expect(rows[0]?.metrics.pct).toBeCloseTo(12);
  });

  it("accepts screener seed frames without canonical unique identifier columns", () => {
    const seed = frame({
      columns: ["legacy_identifier", "symbol", "time", "last_price"],
      rows: [
        {
          legacy_identifier: "asset:AAPL",
          symbol: "AAPL",
          time: "2026-05-16T13:00:00.000Z",
          last_price: 110,
        },
      ],
      meta: buildMarketAssetFrameSemanticMeta({
        role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
        fieldRoles: [
          { field: "legacy_identifier", role: "assetKey" },
          { field: "symbol", role: "symbol" },
          { field: "time", role: "observedAt" },
          { field: "last_price", role: "value", valueKey: "price" },
        ],
      }),
    });

    const runtime = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
      seedData: seed,
    });

    expect(runtime.warnings).toEqual([]);
    expect(runtime.latestByKey["asset:AAPL"]?.values.price).toBe(110);
    expect(runtime.assetsByKey["asset:AAPL"]?.symbol).toBe("AAPL");
  });

  it("uses symbol-like fields when no explicit asset key exists", () => {
    const seed = frame({
      columns: ["symbol", "last"],
      rows: [
        {
          symbol: "ETHUSDT",
          last: 2135,
        },
      ],
    });

    const runtime = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
      seedData: seed,
    });

    expect(runtime.warnings).toEqual([]);
    expect(runtime.latestByKey.ETHUSDT?.values.price).toBe(2135);
    expect(runtime.assetsByKey.ETHUSDT?.symbol).toBe("ETHUSDT");
  });

  it("uses live merge mappings to patch seed rows when seed and live identity fields differ", () => {
    const seed = frame({
      columns: ["unique_identifier", "Symbol", "last_price"],
      rows: [
        {
          unique_identifier: "uid:BTCUSDT",
          Symbol: "BTCUSDT",
          time: "2026-05-19T13:00:00.000Z",
          last_price: 109420,
        },
      ],
      meta: buildMarketAssetFrameSemanticMeta({
        role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
        fieldRoles: [
          { field: "unique_identifier", role: "assetKey" },
          { field: "Symbol", role: "symbol" },
          { field: "time", role: "observedAt" },
          { field: "last_price", role: "value", valueKey: "price" },
        ],
      }),
    });
    const live = frame({
      columns: ["symbol", "last"],
      rows: [
        {
          symbol: "BTCUSDT",
          last: 109500,
        },
      ],
    });

    const runtime = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
      seedData: seed,
      liveUpdates: live,
      liveMergeKeyMappings: [{ seedField: "Symbol", liveField: "symbol" }],
    });

    expect(runtime.latestByKey["uid:BTCUSDT"]?.values.price).toBe(109500);
    expect(runtime.latestByKey.BTCUSDT).toBeUndefined();
  });

  it("uses semantic field-role metadata to adapt reference points", () => {
    const references = frame({
      columns: ["ticker", "period", "asof", "px"],
      rows: [
        {
          ticker: "MSFT",
          period: "oneMonthAgo",
          asof: "2026-04-16T20:00:00.000Z",
          px: 200,
        },
      ],
      meta: buildMarketAssetFrameSemanticMeta({
        role: MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE,
        fieldRoles: [
          { field: "ticker", role: "assetKey" },
          { field: "period", role: "referenceKey" },
          { field: "asof", role: "observedAt" },
          { field: "px", role: "value", valueKey: "price" },
        ],
      }),
    });

    const adapted = adaptMarketAssetReferencePointsFrame(references);

    expect(adapted.warnings).toEqual([]);
    expect(adapted.referencesByKey.MSFT?.oneMonthAgo).toMatchObject({
      assetKey: "MSFT",
      referenceKey: "oneMonthAgo",
      values: {
        price: 200,
      },
    });
  });

  it("ignores table transform metadata before adapting snapshot value semantics", () => {
    const seed = frame({
      columns: ["unique_identifier", "Symbol", "time", "last_price", "previous_close"],
      rows: [
        {
          unique_identifier: "asset:AAPL",
          Symbol: "AAPL",
          time: "2026-05-16T13:00:00.000Z",
          last_price: 112,
          previous_close: 100,
        },
      ],
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
            { field: "time", role: "observedAt" },
            { field: "last_price", role: "value", valueKey: "price" },
            { field: "previous_close", role: "referenceValue", referenceKey: "previousClose", valueKey: "price" },
            { field: "one_day_return", role: "value", valueKey: "oneDayReturn" },
          ],
        }),
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
      },
    });
    const columns: MarketAssetScreenerColumn[] = [
      {
        id: "oneDayReturn",
        kind: "latest-value",
        label: "1D %",
        valueField: "oneDayReturn",
      },
    ];

    const runtime = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
      seedData: seed,
    });
    const rows = deriveMarketAssetScreenerRows(runtime, columns);

    expect(runtime.latestByKey["asset:AAPL"]?.values.price).toBe(112);
    expect(runtime.latestByKey["asset:AAPL"]?.values.oneDayReturn).toBeUndefined();
    expect(runtime.referencesByKey["asset:AAPL"]?.previousClose?.values.price).toBe(100);
    expect(rows[0]?.metrics.oneDayReturn).toBeNull();
  });

  it("adapts inline CSV sparkline series from snapshot metadata", () => {
    const seed = frame({
      columns: ["unique_identifier", "Symbol", "time", "last_price", "price_sparkline"],
      rows: [
        {
          unique_identifier: "asset:AAPL",
          Symbol: "AAPL",
          time: "2026-05-16T13:00:00.000Z",
          last_price: 112,
          price_sparkline: "100, 101, 103, 112",
        },
      ],
      meta: buildMarketAssetFrameSemanticMeta({
        role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
        fieldRoles: [
          { field: "unique_identifier", role: "assetKey" },
          { field: "Symbol", role: "symbol" },
          { field: "time", role: "observedAt" },
          { field: "last_price", role: "value", valueKey: "price" },
          { field: "price_sparkline", role: "sparklineSeries", valueKey: "price", encoding: "csv-number" },
        ],
      }),
    });

    const adapted = adaptMarketAssetSnapshotFrame(seed);
    const runtime = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
      seedData: seed,
    });
    const rows = deriveMarketAssetScreenerRows(runtime, [
      {
        id: "trend",
        kind: "sparkline",
        label: "Trend",
        valueField: "price",
      },
    ]);

    expect(adapted.historyByKey["asset:AAPL"]?.map((point) => point.values.price)).toEqual([
      100,
      101,
      103,
      112,
    ]);
    expect(rows[0]?.history.map((point) => point.values.price)).toEqual([
      100,
      101,
      103,
      112,
    ]);
  });
});
