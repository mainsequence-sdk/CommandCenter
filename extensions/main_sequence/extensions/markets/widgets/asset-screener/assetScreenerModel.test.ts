import { describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import { createDashboardWidgetDependencyModel } from "@/dashboards/widget-dependencies";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import { createRuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import {
  attachWidgetRuntimeUpdateContext,
  WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
} from "@/widgets/shared/runtime-update";
import { defineWidget, type ResolvedWidgetInputs, type WidgetDefinition } from "@/widgets/types";

import {
  assetScreenerDefaultProps,
  normalizeAssetScreenerProps,
  prepareAssetScreenerColumnsForPersistence,
  resolveAssetScreenerColumnConfigFromResolvedInputs,
  resolveAssetScreenerState,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";
import {
  buildMarketAssetFrameSemanticMeta,
  buildMarketTableFrameMeta,
  MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
} from "../../widget-contracts/marketAssetFrames";
import { mainSequenceAssetScreenerWidget } from "./definition";

function frame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: Object.keys(rows[0] ?? {}),
    rows,
  };
}

function marketSeedFrame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  const normalizedRows = rows.map((row) => ({
    ...row,
    ...(row.Symbol == null && row.symbol != null ? { Symbol: row.symbol } : {}),
  }));

  return {
    ...frame(normalizedRows),
    meta: buildMarketAssetFrameSemanticMeta({
      role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
      fieldRoles: [
        { field: "unique_identifier", role: "assetKey" },
        { field: "Symbol", role: "symbol" },
        { field: "sector", role: "sector" },
        { field: "time", role: "observedAt" },
        { field: "last_price", role: "value", valueKey: "price" },
        { field: "volume", role: "value", valueKey: "volume" },
        { field: "previous_close", role: "referenceValue", referenceKey: "previousClose", valueKey: "price" },
        { field: "price_sparkline", role: "sparklineSeries", valueKey: "price", encoding: "csv-number" },
      ],
    }),
  };
}

const genericDatasetSourceWidget = defineWidget({
  id: "test-generic-tabular-query",
  widgetVersion: "1.0.0",
  title: "Generic Tabular Query",
  description: "Publishes a generic retained tabular frame.",
  category: "Test",
  kind: "table",
  source: "test",
  defaultSize: { w: 4, h: 3 },
  io: {
    outputs: [
      {
        id: "dataset",
        label: "Dataset",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ props }) => props.frame,
      },
    ],
  },
  component: () => null,
});

const genericStreamSourceWidget = defineWidget({
  id: "test-generic-tabular-stream",
  widgetVersion: "1.0.0",
  title: "Generic Tabular Stream",
  description: "Publishes generic incremental tabular updates.",
  category: "Test",
  kind: "table",
  source: "test",
  defaultSize: { w: 4, h: 3 },
  io: {
    outputs: [
      {
        id: "updates",
        label: "Updates",
        contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        resolveValue: ({ props }) => props.frame,
      },
    ],
  },
  component: () => null,
});

const testWidgetDefinitions = new Map<string, WidgetDefinition>([
  [genericDatasetSourceWidget.id, genericDatasetSourceWidget],
  [genericStreamSourceWidget.id, genericStreamSourceWidget],
  [mainSequenceAssetScreenerWidget.id, mainSequenceAssetScreenerWidget],
]);

function resolveWidgetDefinition(widgetId: string) {
  return testWidgetDefinitions.get(widgetId);
}

function singleInput(inputs: ResolvedWidgetInputs | undefined, inputId: string) {
  const input = inputs?.[inputId];
  return Array.isArray(input) ? input[0] : input;
}

const legacyOverrideColumns = [
  {
    id: "symbol",
    kind: "asset-field",
    label: "Symbol",
    field: "symbol",
    width: 120,
    groupable: true,
  },
  {
    id: "name",
    kind: "asset-field",
    label: "Name",
    field: "displayName",
    width: 220,
  },
  {
    id: "trend",
    kind: "sparkline",
    label: "Trend",
    valueField: "price",
    width: 118,
  },
  {
    id: "last",
    kind: "latest-value",
    label: "Last",
    valueField: "price",
    format: "price",
    width: 96,
  },
  {
    id: "net",
    kind: "return",
    label: "Net Chg",
    referenceKey: "previousClose",
    valueField: "price",
    returnMode: "absolute",
    format: "price",
    width: 94,
  },
  {
    id: "pct",
    kind: "return",
    label: "% Chg",
    referenceKey: "previousClose",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 86,
  },
  {
    id: "mtd",
    kind: "return",
    label: "1M",
    referenceKey: "oneMonthAgo",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 76,
  },
  {
    id: "ytd",
    kind: "return",
    label: "YTD",
    referenceKey: "yearStart",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 76,
  },
  {
    id: "oneYear",
    kind: "return",
    label: "1Y",
    referenceKey: "oneYearAgo",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 76,
  },
  {
    id: "sector",
    kind: "asset-field",
    label: "Sector",
    field: "sector",
    width: 150,
    groupable: true,
  },
] satisfies NonNullable<MainSequenceAssetScreenerWidgetProps["columns"]>;

const testCustomColumns = [
  {
    id: "symbol",
    kind: "asset-field",
    label: "Ticker",
    field: "symbol",
    width: 120,
    groupable: true,
  },
  {
    id: "last",
    kind: "latest-value",
    label: "Last Px",
    valueField: "price",
    format: "price",
    width: 96,
  },
  {
    id: "pct",
    kind: "return",
    label: "1D %",
    referenceKey: "previousClose",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 86,
  },
] satisfies NonNullable<MainSequenceAssetScreenerWidgetProps["columns"]>;

function propsWithDefaultColumns(
  overrides: Partial<MainSequenceAssetScreenerWidgetProps> = {},
): MainSequenceAssetScreenerWidgetProps {
  return {
    ...assetScreenerDefaultProps,
    columnConfigMode: "custom",
    columns: testCustomColumns,
    ...overrides,
  };
}

function assetScreenerInstance(
  bindings: DashboardWidgetInstance["bindings"],
): DashboardWidgetInstance {
  return {
    id: "asset-screener-1",
    widgetId: mainSequenceAssetScreenerWidget.id,
    title: "Asset Screener",
    props: propsWithDefaultColumns({
      fieldMappings: {
        seed: {
          assetKeyField: "unique_identifier",
          symbolField: "Symbol",
          sectorField: "sector",
          observedAtField: "time",
          valueFields: {
            price: "last_price",
          },
        },
        live: {
          assetKeyField: "unique_identifier",
          observedAtField: "time",
          valueFields: {
            price: "last_price",
          },
        },
      },
    }),
    bindings,
    layout: { w: 14, h: 8 },
  };
}

describe("assetScreenerModel", () => {
  it("does not treat saved columns as a custom override unless the mode explicitly says custom", () => {
    const props = normalizeAssetScreenerProps({
      columns: testCustomColumns,
    });

    expect(props.columnConfigMode).toBe("source");
    expect(props.columns).toEqual(testCustomColumns);
  });

  it("strips source visual snapshots when copying source columns into a persisted override", () => {
    expect(prepareAssetScreenerColumnsForPersistence([
      {
        id: "pct",
        kind: "return",
        label: "1D",
        referenceKey: "previousClose",
        valueField: "price",
        returnMode: "percent",
        format: "percent",
        visual: {
          gaugeMode: "ring",
          thresholds: [
            { operator: "lt", value: 0, tone: "warning" },
            { operator: "gt", value: 0, tone: "success" },
          ],
        },
      },
    ])).toEqual([
      {
        id: "pct",
        kind: "return",
        label: "1D",
        referenceKey: "previousClose",
        valueField: "price",
        returnMode: "percent",
        format: "percent",
      },
    ]);
  });

  it("ignores persisted screener column visual snapshots when normalizing saved props", () => {
    const props = normalizeAssetScreenerProps({
      columnConfigMode: "custom",
      columns: [
        {
          id: "pct",
          kind: "return",
          label: "1D",
          referenceKey: "previousClose",
          valueField: "price",
          returnMode: "percent",
          format: "percent",
          visual: {
            gaugeMode: "ring",
            thresholds: [
              { operator: "lt", value: 0, tone: "warning" },
              { operator: "gt", value: 0, tone: "success" },
            ],
          },
        },
      ],
    });

    expect(props.columns).toEqual([
      {
        id: "pct",
        kind: "return",
        label: "1D",
        referenceKey: "previousClose",
        valueField: "price",
        returnMode: "percent",
        format: "percent",
      },
    ]);
  });

  it("migrates the shipped legacy screener preset back to source metadata", () => {
    const props = normalizeAssetScreenerProps({
      columnConfigMode: "custom",
      columns: legacyOverrideColumns,
    });

    expect(props.columnConfigMode).toBe("source");
    expect(props.columns).toBeUndefined();
  });

  it("derives configured rows from fallback seed references and live frames", () => {
    const state = resolveAssetScreenerState({
      props: propsWithDefaultColumns({
        fieldMappings: {
          seed: {
            assetKeyField: "unique_identifier",
            symbolField: "Symbol",
            sectorField: "sector",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
            },
          },
          live: {
            assetKeyField: "unique_identifier",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
            },
          },
        },
      }),
      fallbackFrames: {
        seedData: marketSeedFrame([
          {
            unique_identifier: "uid:AAPL",
            symbol: "AAPL",
            sector: "Technology",
            time: "2026-05-16T12:00:00.000Z",
            last_price: 101,
            previous_close: 100,
          },
        ]),
        liveUpdates: frame([
          {
            unique_identifier: "uid:AAPL",
            time: "2026-05-16T12:01:00.000Z",
            last_price: 104,
          },
        ]),
      },
    });

    expect(state.filteredRows).toHaveLength(1);
    expect(state.filteredRows[0]?.metrics).toMatchObject({
      symbol: "AAPL",
      last: 104,
    });
    expect(state.filteredRows[0]?.metrics.pct).toBeCloseTo(4);
  });

  it("derives dynamic metric columns from configured value keys", () => {
    const state = resolveAssetScreenerState({
      props: {
        ...assetScreenerDefaultProps,
        columnConfigMode: "custom",
        columns: [
          {
            id: "symbol",
            kind: "asset-field",
            label: "Symbol",
            field: "symbol",
          },
          {
            id: "volume",
            kind: "latest-value",
            label: "Volume",
            valueField: "volume",
            format: "volume",
          },
        ],
        fieldMappings: {
          seed: {
            assetKeyField: "unique_identifier",
            symbolField: "Symbol",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
              volume: "volume",
            },
          },
        },
      },
      fallbackFrames: {
        seedData: frame([
          {
            unique_identifier: "uid:AAPL",
            Symbol: "AAPL",
            time: "2026-05-16T12:00:00.000Z",
            last_price: 104,
            volume: 42_000_000,
          },
        ]),
      },
    });

    expect(state.filteredRows[0]?.metrics).toMatchObject({
      symbol: "AAPL",
      volume: 42_000_000,
    });
  });

  it("derives visible column configuration from source metadata and lets instance columns override it", () => {
    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          sector: "Technology",
          as_of: "2026-05-17T14:30:00.000Z",
          last_price: 112.25,
          previous_close: 110,
          one_month_ago: 101.5,
          year_start: 94.25,
          one_year_ago: 88.1,
          sparkline_prices: "101.5,103.2,104.8,107.1,109.4,112.25",
        },
        {
          unique_identifier: "uid:MSFT",
          Symbol: "MSFT",
          sector: "Technology",
          as_of: "2026-05-17T14:30:00.000Z",
          last_price: 219.5,
          previous_close: 221,
          one_month_ago: 205.25,
          year_start: 198,
          one_year_ago: 182.75,
          sparkline_prices: "205.2,207.8,211.4,216.0,221.0,219.5",
        },
      ]),
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
            { field: "sector", role: "sector" },
            { field: "as_of", role: "observedAt" },
            { field: "last_price", role: "value", valueKey: "price" },
            {
              field: "previous_close",
              role: "referenceValue",
              referenceKey: "previousClose",
              valueKey: "price",
            },
            {
              field: "one_month_ago",
              role: "referenceValue",
              referenceKey: "oneMonthAgo",
              valueKey: "price",
            },
            {
              field: "year_start",
              role: "referenceValue",
              referenceKey: "yearStart",
              valueKey: "price",
            },
            {
              field: "one_year_ago",
              role: "referenceValue",
              referenceKey: "oneYearAgo",
              valueKey: "price",
            },
            {
              field: "sparkline_prices",
              role: "sparklineSeries",
              valueKey: "price",
              encoding: "csv-number",
              order: "oldest-to-newest",
            },
            { field: "one_day_return", role: "value", valueKey: "oneDayReturn" },
            { field: "one_month_return", role: "value", valueKey: "oneMonthReturn" },
            { field: "ytd_return", role: "value", valueKey: "ytdReturn" },
            { field: "one_year_return", role: "value", valueKey: "oneYearReturn" },
          ],
        }),
        ...buildMarketTableFrameMeta({
          tableTransforms: {
            computedColumns: [
              {
                id: "one_day_return",
                label: "1D",
                type: "number",
                expression: {
                  op: "percentChange",
                  current: { field: "last_price" },
                  reference: { field: "previous_close" },
                },
              },
              {
                id: "one_month_return",
                label: "1M",
                type: "number",
                expression: {
                  op: "percentChange",
                  current: { field: "last_price" },
                  reference: { field: "one_month_ago" },
                },
              },
              {
                id: "ytd_return",
                label: "YTD",
                type: "number",
                expression: {
                  op: "percentChange",
                  current: { field: "last_price" },
                  reference: { field: "year_start" },
                },
              },
              {
                id: "one_year_return",
                label: "1Y",
                type: "number",
                expression: {
                  op: "percentChange",
                  current: { field: "last_price" },
                  reference: { field: "one_year_ago" },
                },
              },
            ],
          },
          tableVisuals: {
            columns: {
              Symbol: { label: "Symbol" },
              sector: { label: "Sector" },
              last_price: { format: "price" },
              one_day_return: {
                format: "percent",
                colorScale: { negative: "warning", neutral: "muted", positive: "success" },
              },
              one_month_return: {
                format: "percent",
                colorScale: { negative: "warning", neutral: "muted", positive: "success" },
              },
              ytd_return: {
                format: "percent",
                colorScale: { negative: "warning", neutral: "muted", positive: "success" },
              },
              one_year_return: {
                format: "percent",
                colorScale: { negative: "warning", neutral: "muted", positive: "success" },
              },
              sparkline_prices: {
                kind: "sparkline",
                encoding: "csv-number",
                order: "oldest-to-newest",
              },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;

    const sourceDriven = resolveAssetScreenerState({
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData,
      },
    });

    expect(sourceDriven.columnConfigSource).toBe("source");
    expect(sourceDriven.columns.map((column) => column.id)).toEqual([
      "Symbol",
      "sector",
      "last_price",
      "one_day_return",
      "one_month_return",
      "ytd_return",
      "one_year_return",
      "sparkline_prices",
    ]);
    expect(sourceDriven.columns.find((column) => column.id === "one_day_return")).toMatchObject({
      kind: "latest-value",
      label: "1D",
      valueField: "oneDayReturn",
      format: "percent",
      visual: {
        colorScale: { negative: "warning", neutral: "muted", positive: "success" },
      },
    });
    expect(sourceDriven.filteredRows[0]?.metrics.one_day_return).toBeCloseTo(
      (112.25 / 110 - 1) * 100,
    );
    expect(sourceDriven.filteredRows[0]?.visuals.one_day_return).toMatchObject({
      colorScale: { negative: "warning", neutral: "muted", positive: "success" },
    });

    const customOverride = resolveAssetScreenerState({
      props: {
        ...assetScreenerDefaultProps,
        columnConfigMode: "custom",
        columns: [
          {
            id: "Symbol",
            kind: "asset-field",
            label: "Ticker",
            field: "symbol",
          },
        ],
      },
      fallbackFrames: {
        seedData,
      },
    });

    expect(customOverride.columnConfigSource).toBe("custom");
    expect(customOverride.columns.map((column) => column.id)).toEqual(["Symbol"]);
  });

  it("ignores the shipped legacy screener preset when source metadata is available", () => {
    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          sector: "Technology",
          as_of: "2026-05-17T14:30:00.000Z",
          last_price: 112.25,
        },
      ]),
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
            { field: "sector", role: "sector" },
            { field: "as_of", role: "observedAt" },
            { field: "last_price", role: "value", valueKey: "price" },
          ],
        }),
        ...buildMarketTableFrameMeta({
          tableVisuals: {
            columns: {
              Symbol: { label: "Symbol" },
              sector: { label: "Sector" },
              last_price: { label: "Last", format: "price" },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;

    const migrated = resolveAssetScreenerState({
      props: {
        ...assetScreenerDefaultProps,
        columnConfigMode: "custom",
        columns: legacyOverrideColumns,
      },
      fallbackFrames: {
        seedData,
      },
    });

    expect(migrated.columnConfigSource).toBe("source");
    expect(migrated.columns.map((column) => column.id)).toEqual([
      "Symbol",
      "sector",
      "last_price",
    ]);
    expect(migrated.filteredRows).toHaveLength(1);
    expect(migrated.filteredRows[0]?.metrics.last_price).toBe(112.25);
  });

  it("shows table visual metadata columns in settings even without market field-role metadata", () => {
    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          sector: "Technology",
          as_of: "2026-05-17T14:30:00.000Z",
          last_price: 112.25,
          previous_close: 110,
          sparkline_prices: "101.5,103.2,104.8,107.1,109.4,112.25",
        },
      ]),
      fields: [
        { key: "Symbol", label: "Symbol", type: "string" },
        { key: "sector", label: "Sector", type: "string" },
        { key: "last_price", label: "Last", type: "number" },
      ],
      meta: buildMarketTableFrameMeta({
        tableTransforms: {
          computedColumns: [
            {
              id: "one_day_return",
              label: "1D",
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
            Symbol: { label: "Symbol" },
            sector: { label: "Sector" },
            last_price: { label: "Last", format: "price" },
            one_day_return: {
              label: "1D",
              format: "percent",
              colorScale: { negative: "warning", neutral: "muted", positive: "success" },
            },
            sparkline_prices: {
              label: "Trend",
              kind: "sparkline",
              encoding: "csv-number",
              order: "oldest-to-newest",
              width: 128,
            },
          },
        },
      }),
    } satisfies TabularFrameSourceV1;

    const sourceDriven = resolveAssetScreenerState({
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData,
      },
    });

    expect(sourceDriven.columnConfigSource).toBe("source");
    expect(sourceDriven.columns.map((column) => column.id)).toEqual([
      "Symbol",
      "sector",
      "last_price",
      "one_day_return",
      "sparkline_prices",
    ]);
    expect(sourceDriven.columns.find((column) => column.id === "Symbol")).toMatchObject({
      kind: "asset-field",
      field: "symbol",
      label: "Symbol",
    });
    expect(sourceDriven.columns.find((column) => column.id === "last_price")).toMatchObject({
      kind: "latest-value",
      label: "Last",
      valueField: "price",
      format: "price",
    });
    expect(sourceDriven.columns.find((column) => column.id === "one_day_return")).toMatchObject({
      kind: "latest-value",
      label: "1D",
      valueField: "one_day_return",
      format: "percent",
      visual: {
        colorScale: { negative: "warning", neutral: "muted", positive: "success" },
      },
    });
    expect(sourceDriven.columns.find((column) => column.id === "sparkline_prices")).toMatchObject({
      kind: "sparkline",
      label: "Trend",
      valueField: "price",
      width: 128,
    });
    expect(sourceDriven.filteredRows[0]?.metrics.last_price).toBe(112.25);
    expect(sourceDriven.filteredRows[0]?.metrics.one_day_return).toBeCloseTo(
      (112.25 / 110 - 1) * 100,
    );
  });

  it("derives settings-visible source columns from runtime data refs", () => {
    const runtimeDataStore = createRuntimeDataStore("asset-screener-settings-test");
    const seedData = {
      ...marketSeedFrame([
        {
          unique_identifier: "uid:AAPL",
          symbol: "AAPL",
          sector: "Technology",
          time: "2026-05-16T12:00:00.000Z",
          last_price: 101,
          previous_close: 100,
          price_sparkline: "98,99,101",
        },
      ]),
      meta: {
        ...marketSeedFrame([]).meta,
        ...buildMarketTableFrameMeta({
          tableVisuals: {
            columns: {
              Symbol: { label: "Symbol" },
              sector: { label: "Sector" },
              last_price: { format: "price" },
              price_sparkline: {
                kind: "sparkline",
                encoding: "csv-number",
                order: "oldest-to-newest",
              },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;
    const seedRef = runtimeDataStore.putSnapshot({
      ownerId: "latest-query",
      outputId: "dataset",
      frame: seedData,
    });
    const columnConfig = resolveAssetScreenerColumnConfigFromResolvedInputs({
      props: assetScreenerDefaultProps,
      runtimeDataStore,
      resolvedInputs: {
        [MARKET_ASSET_SCREENER_SEED_INPUT_ID]: {
          inputId: MARKET_ASSET_SCREENER_SEED_INPUT_ID,
          label: "Seed data",
          status: "valid",
          sourceWidgetId: "latest-query",
          sourceOutputId: "dataset",
          contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          upstreamBaseRef: seedRef,
        },
      },
    });

    expect(columnConfig.source).toBe("source");
    expect(columnConfig.columns.map((column) => column.id)).toEqual([
      "Symbol",
      "sector",
      "last_price",
      "price_sparkline",
    ]);
  });

  it("treats table visuals as the authoritative source column proposal when present", () => {
    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          sector: "Technology",
          time: "2026-05-16T12:00:00.000Z",
          last_price: 101.25,
          previous_close: 100.75,
        },
      ]),
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
            { field: "sector", role: "sector" },
            { field: "time", role: "observedAt" },
            { field: "last_price", role: "value", valueKey: "price" },
            { field: "previous_close", role: "referenceValue", referenceKey: "previousClose", valueKey: "price" },
          ],
        }),
        ...buildMarketTableFrameMeta({
          tableVisuals: {
            columns: {
              last_price: { label: "Last", format: "price", decimals: 2 },
              Symbol: { label: "Ticker" },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;

    const sourceDriven = resolveAssetScreenerState({
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData,
      },
    });

    expect(sourceDriven.columnConfigSource).toBe("source");
    expect(sourceDriven.columns.map((column) => column.id)).toEqual([
      "last_price",
      "Symbol",
    ]);
    expect(sourceDriven.columns.find((column) => column.id === "last_price")).toMatchObject({
      label: "Last",
      format: "price",
      valueField: "price",
      visual: {
        decimals: 2,
      },
    });
    expect(sourceDriven.columns.find((column) => column.id === "Symbol")).toMatchObject({
      label: "Ticker",
      kind: "asset-field",
      field: "symbol",
    });
  });

  it("resolves a refresh-only workspace from generic dataset outputs", () => {
    const widgets: DashboardWidgetInstance[] = [
      {
        id: "latest-query",
        widgetId: genericDatasetSourceWidget.id,
        title: "Latest query",
        props: {
          frame: marketSeedFrame([
            {
              unique_identifier: "uid:AAPL",
              symbol: "AAPL",
              sector: "Technology",
              time: "2026-05-16T12:00:00.000Z",
              last_price: 101,
              previous_close: 100,
              price_sparkline: "98,99,101",
            },
          ]),
        },
        layout: { w: 4, h: 3 },
      },
      assetScreenerInstance({
        [MARKET_ASSET_SCREENER_SEED_INPUT_ID]: {
          sourceWidgetId: "latest-query",
          sourceOutputId: "dataset",
        },
      }),
    ];
    const model = createDashboardWidgetDependencyModel(widgets, resolveWidgetDefinition);
    const resolvedInputs = model.resolveInputs("asset-screener-1");

    expect(singleInput(resolvedInputs, MARKET_ASSET_SCREENER_SEED_INPUT_ID)).toMatchObject({
      status: "valid",
      sourceWidgetId: "latest-query",
      sourceOutputId: "dataset",
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    });

    const state = resolveAssetScreenerState({
      props: widgets[1]?.props ?? {},
      resolvedInputs,
    });

    expect(state.sourceStatuses).toMatchObject({
      seed: "valid",
    });
    expect(state.filteredRows[0]?.history).toHaveLength(3);
    expect(state.filteredRows[0]?.metrics).toMatchObject({
      symbol: "AAPL",
      last: 101,
    });
    expect(state.filteredRows[0]?.metrics.pct).toBeCloseTo(1);
  });

  it("resolves a live workspace from a generic stream updates output", () => {
    const liveBase = frame([
      {
        unique_identifier: "uid:AAPL",
        time: "2026-05-16T12:00:00.000Z",
        last_price: 101,
      },
    ]);
    const liveDelta = frame([
      {
        unique_identifier: "uid:AAPL",
        time: "2026-05-16T12:01:00.000Z",
        last_price: 104,
      },
    ]);
    const streamFrame = attachWidgetRuntimeUpdateContext(liveBase, {
      contractVersion: WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
      mode: "delta",
      publicationRole: "update",
      outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      sourceOutputId: "updates",
      deltaOutput: liveDelta,
    });
    const widgets: DashboardWidgetInstance[] = [
      {
        id: "latest-query",
        widgetId: genericDatasetSourceWidget.id,
        title: "Latest query",
        props: {
          frame: marketSeedFrame([
            {
              unique_identifier: "uid:AAPL",
              symbol: "AAPL",
              sector: "Technology",
              time: "2026-05-16T12:00:00.000Z",
              last_price: 101,
              previous_close: 100,
            },
          ]),
        },
        layout: { w: 4, h: 3 },
      },
      {
        id: "stream-query",
        widgetId: genericStreamSourceWidget.id,
        title: "Stream query",
        props: {
          frame: streamFrame,
        },
        layout: { w: 4, h: 3 },
      },
      assetScreenerInstance({
        [MARKET_ASSET_SCREENER_SEED_INPUT_ID]: {
          sourceWidgetId: "latest-query",
          sourceOutputId: "dataset",
        },
        [MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID]: {
          sourceWidgetId: "stream-query",
          sourceOutputId: "updates",
        },
      }),
    ];
    const model = createDashboardWidgetDependencyModel(widgets, resolveWidgetDefinition);
    const resolvedInputs = model.resolveInputs("asset-screener-1");

    expect(singleInput(resolvedInputs, MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID)).toMatchObject({
      status: "valid",
      sourceWidgetId: "stream-query",
      sourceOutputId: "updates",
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    });

    const state = resolveAssetScreenerState({
      props: widgets[2]?.props ?? {},
      resolvedInputs,
    });

    expect(state.sourceStatuses.live).toBe("valid");
    expect(state.filteredRows[0]?.metrics).toMatchObject({
      symbol: "AAPL",
      last: 104,
    });
    expect(state.filteredRows[0]?.metrics.pct).toBeCloseTo(4);
  });

  it("uses an explicit canonical source frame for screener columns and visuals", () => {
    const seedData = marketSeedFrame([
      {
        unique_identifier: "uid:AAPL",
        Symbol: "AAPL",
        sector: "Technology",
        time: "2026-05-16T12:00:00.000Z",
        last_price: 101,
        previous_close: 100,
      },
    ]);
    const canonicalSourceFrame = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          sector: "Technology",
          time: "2026-05-16T12:01:00.000Z",
          last_price: 104,
          previous_close: 100,
        },
      ]),
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
            { field: "sector", role: "sector" },
            { field: "time", role: "observedAt" },
            { field: "last_price", role: "value", valueKey: "price" },
            {
              field: "previous_close",
              role: "referenceValue",
              referenceKey: "previousClose",
              valueKey: "price",
            },
            { field: "one_day_return", role: "value", valueKey: "oneDayReturn" },
          ],
        }),
        ...buildMarketTableFrameMeta({
          tableTransforms: {
            computedColumns: [
              {
                id: "one_day_return",
                label: "1D",
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
                label: "1D",
                format: "percent",
                thresholds: [
                  { operator: "lt", value: 0, tone: "warning" },
                  { operator: "gt", value: 0, tone: "success" },
                ],
              },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;

    const state = resolveAssetScreenerState({
      canonicalSourceFrame,
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData,
      },
    });

    expect(state.sourceFrame).toBe(canonicalSourceFrame);
    expect(state.columns.some((column) => column.id === "one_day_return")).toBe(true);
    expect(state.sourceColumns?.find((column) => column.id === "one_day_return")).toMatchObject({
      id: "one_day_return",
      label: "1D",
      kind: "latest-value",
      valueField: "oneDayReturn",
    });
  });

  it("recalculates against refreshed seeded references while keeping the live binding stable", () => {
    function buildWorkspace(referenceClose: number) {
      const liveBase = frame([
        {
          unique_identifier: "uid:AAPL",
          time: "2026-05-16T12:00:00.000Z",
          last_price: 101,
        },
      ]);
      const liveDelta = frame([
        {
          unique_identifier: "uid:AAPL",
          time: "2026-05-16T12:01:00.000Z",
          last_price: 104,
        },
      ]);
      const streamFrame = attachWidgetRuntimeUpdateContext(liveBase, {
        contractVersion: WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
        mode: "delta",
        publicationRole: "update",
        outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        sourceOutputId: "updates",
        deltaOutput: liveDelta,
      });

      return [
        {
          id: "latest-query",
          widgetId: genericDatasetSourceWidget.id,
          title: "Latest query",
          props: {
            frame: marketSeedFrame([
              {
                unique_identifier: "uid:AAPL",
                symbol: "AAPL",
                sector: "Technology",
                time: "2026-05-16T12:00:00.000Z",
                last_price: 101,
                previous_close: referenceClose,
              },
            ]),
          },
          layout: { w: 4, h: 3 },
        },
        {
          id: "stream-query",
          widgetId: genericStreamSourceWidget.id,
          title: "Stream query",
          props: {
            frame: streamFrame,
          },
          layout: { w: 4, h: 3 },
        },
        assetScreenerInstance({
          [MARKET_ASSET_SCREENER_SEED_INPUT_ID]: {
            sourceWidgetId: "latest-query",
            sourceOutputId: "dataset",
          },
          [MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID]: {
            sourceWidgetId: "stream-query",
            sourceOutputId: "updates",
          },
        }),
      ] satisfies DashboardWidgetInstance[];
    }

    const firstWidgets = buildWorkspace(100);
    const firstInputs = createDashboardWidgetDependencyModel(
      firstWidgets,
      resolveWidgetDefinition,
    ).resolveInputs("asset-screener-1");
    const firstState = resolveAssetScreenerState({
      props: firstWidgets[2]?.props ?? {},
      resolvedInputs: firstInputs,
    });
    const refreshedWidgets = buildWorkspace(80);
    const refreshedInputs = createDashboardWidgetDependencyModel(
      refreshedWidgets,
      resolveWidgetDefinition,
    ).resolveInputs("asset-screener-1");
    const refreshedState = resolveAssetScreenerState({
      props: refreshedWidgets[2]?.props ?? {},
      resolvedInputs: refreshedInputs,
    });

    expect(singleInput(firstInputs, MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID)).toMatchObject({
      sourceWidgetId: "stream-query",
      sourceOutputId: "updates",
    });
    expect(singleInput(refreshedInputs, MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID)).toMatchObject({
      sourceWidgetId: "stream-query",
      sourceOutputId: "updates",
    });
    expect(firstState.filteredRows[0]?.metrics.pct).toBeCloseTo(4);
    expect(refreshedState.filteredRows[0]?.metrics).toMatchObject({
      last: 104,
    });
    expect(refreshedState.filteredRows[0]?.metrics.pct).toBeCloseTo(30);
  });

  it("keeps rows renderable when configured reference columns are missing", () => {
    const state = resolveAssetScreenerState({
      props: propsWithDefaultColumns({
        fieldMappings: {
          seed: {
            assetKeyField: "unique_identifier",
            symbolField: "Symbol",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
            },
          },
        },
      }),
      fallbackFrames: {
        seedData: frame([
          {
            unique_identifier: "uid:AAPL",
            Symbol: "AAPL",
            time: "2026-05-16T12:00:00.000Z",
            last_price: 104,
          },
        ]),
      },
    });

    expect(state.filteredRows).toHaveLength(1);
    expect(state.filteredRows[0]).toMatchObject({
      status: "missing-reference",
      metrics: {
        symbol: "AAPL",
        last: 104,
      },
    });
    expect(state.filteredRows[0]?.metrics.pct).toBeNull();
  });

  it("falls back when saved explicit field mappings no longer match the incoming frame", () => {
    const state = resolveAssetScreenerState({
      props: propsWithDefaultColumns({
        fieldMappings: {
          seed: {
            assetKeyField: "asset_id",
            symbolField: "symbol",
            observedAtField: "time",
            valueFields: {
              price: "last",
            },
          },
        },
      }),
      fallbackFrames: {
        seedData: frame([
          {
            unique_identifier: "uid:AAPL",
            Symbol: "AAPL",
            as_of: "2026-05-17T16:30:00.000Z",
            last_price: 112.25,
            previous_close: 110,
          },
        ]),
      },
    });

    expect(state.rows).toHaveLength(1);
    expect(state.filteredRows[0]).toMatchObject({
      status: "missing-reference",
      metrics: {
        symbol: "AAPL",
        last: 112.25,
      },
    });
  });

  it("caps large universes before rendering so settings previews stay bounded", () => {
    const rows = Array.from({ length: 2_000 }, (_, index) => ({
      unique_identifier: `asset:${index}`,
      Symbol: `SYM${index.toString().padStart(4, "0")}`,
      time: "2026-05-16T12:00:00.000Z",
      last_price: 100 + index,
    }));
    const state = resolveAssetScreenerState({
      props: propsWithDefaultColumns({
        maxRenderedRows: 250,
        groupBy: undefined,
        fieldMappings: {
          seed: {
            assetKeyField: "unique_identifier",
            symbolField: "Symbol",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
            },
          },
        },
      }),
      fallbackFrames: {
        seedData: frame(rows),
      },
    });

    expect(state.rows).toHaveLength(2_000);
    expect(state.filteredRows).toHaveLength(250);
    expect(state.filteredRows[0]?.metrics.symbol).toBe("SYM0000");
  });
});
