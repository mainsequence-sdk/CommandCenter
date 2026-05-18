/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import type { ResolvedWidgetInputs } from "@/widgets/types";
import { buildTableWidgetFrameFromRemoteData } from "@/widgets/core/table/tableModel";

import {
  buildMarketAssetFrameSemanticMeta,
  buildMarketTableFrameMeta,
  MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
} from "../../widget-contracts/marketAssetFrames";
import { mainSequenceAssetScreenerWidget } from "./definition";
import {
  AssetScreenerWidget,
  buildAssetScreenerResolvedTableProps,
  buildAssetScreenerTableFrame,
  buildSparklineValues,
} from "./AssetScreenerWidget";
import {
  assetScreenerDefaultProps,
  resolveAssetScreenerState,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";

const dashboardExecutionMocks = vi.hoisted(() => ({
  useResolveWidgetUpstream: vi.fn(),
}));

const runtimeDataStoreMocks = vi.hoisted(() => ({
  useRuntimeDataStore: vi.fn(() => null),
}));

vi.mock("@/dashboards/DashboardWidgetExecution", () => dashboardExecutionMocks);
vi.mock("@/widgets/shared/runtime-data-store", async () => {
  const actual = await vi.importActual<typeof import("@/widgets/shared/runtime-data-store")>(
    "@/widgets/shared/runtime-data-store",
  );

  return {
    ...actual,
    useRuntimeDataStore: runtimeDataStoreMocks.useRuntimeDataStore,
  };
});

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return Number.parseInt(this.style.height || "420", 10);
  },
});

Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return Number.parseInt(this.style.width || "900", 10);
  },
});

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    bottom: 420,
    height: Number.parseInt(this.style.height || "420", 10),
    left: 0,
    right: 900,
    toJSON: () => ({}),
    top: 0,
    width: Number.parseInt(this.style.width || "900", 10),
    x: 0,
    y: 0,
  };
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  host?.remove();
  root = null;
  host = null;
  dashboardExecutionMocks.useResolveWidgetUpstream.mockClear();
  runtimeDataStoreMocks.useRuntimeDataStore.mockReset();
  runtimeDataStoreMocks.useRuntimeDataStore.mockReturnValue(null);
});

function frame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  return {
    status: "ready",
    columns: Object.keys(rows[0] ?? {}),
    rows,
  };
}

function marketSeedFrame(rows: Array<Record<string, unknown>>): TabularFrameSourceV1 {
  return {
    ...frame(rows),
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
  };
}

function renderWidget(
  props: MainSequenceAssetScreenerWidgetProps,
  frames?: {
    seedData: TabularFrameSourceV1;
  },
  options: {
    instanceTitle?: string;
    resolvedInputs?: ResolvedWidgetInputs;
  } = {},
) {
  host = document.createElement("div");
  host.style.height = "420px";
  host.style.width = "900px";
  document.body.appendChild(host);
  root = createRoot(host);

  act(() => {
    root!.render(
      <AssetScreenerWidget
        instanceId="asset-screener-test"
        widget={mainSequenceAssetScreenerWidget}
        instanceTitle={options.instanceTitle}
        props={props}
        resolvedInputs={options.resolvedInputs}
        runtimeState={frames
          ? {
              marketAssetScreenerDemoFrames: {
                ...frames,
              },
            }
          : undefined}
      />,
    );
  });

  return host;
}

describe("AssetScreenerWidget", () => {
  it("requests passive upstream resolution for awaiting seed bindings", () => {
    renderWidget(assetScreenerDefaultProps, undefined, {
      resolvedInputs: {
        seedData: {
          inputId: "seedData",
          label: "Seed data",
          status: "valid",
          sourceWidgetId: "connection-query",
          sourceOutputId: "dataset",
          contractId: "core.tabular_frame@v1",
        },
      },
    });

    expect(dashboardExecutionMocks.useResolveWidgetUpstream).toHaveBeenCalledWith(
      "asset-screener-test",
      expect.objectContaining({ enabled: true }),
    );
  });

  it("materializes retained seed frames from runtime store context when no prop store is passed", () => {
    const runtimeDataStore = createRuntimeDataStore("asset-screener-widget-test");
    const seedData = marketSeedFrame([
      {
        unique_identifier: "uid:AAPL",
        Symbol: "AAPL",
        sector: "Technology",
        time: "2026-05-16T13:00:00.000Z",
        last_price: 110,
      },
    ]);
    const seedRef = runtimeDataStore.putSnapshot({
      ownerId: "connection-query-1",
      outputId: "dataset",
      frame: seedData,
    });

    runtimeDataStoreMocks.useRuntimeDataStore.mockReturnValue(runtimeDataStore as never);

    const container = renderWidget(assetScreenerDefaultProps, undefined, {
      resolvedInputs: {
        seedData: {
          inputId: "seedData",
          label: "Seed data",
          status: "valid",
          sourceWidgetId: "connection-query-1",
          sourceOutputId: "dataset",
          contractId: "core.tabular_frame@v1",
          upstreamBaseRef: seedRef,
        },
      },
    });

    expect(container.textContent).not.toContain("No source columns are available yet");
  });

  it("does not invent default columns when source metadata has no column proposal", () => {
    const props = {
      ...assetScreenerDefaultProps,
      groupBy: undefined,
      sort: undefined,
      fieldMappings: {
        seed: {
          assetKeyField: "unique_identifier",
          symbolField: "Symbol",
          valueFields: {
            price: "last_price",
          },
        },
      },
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const container = renderWidget(props, {
      seedData: frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          last_price: 112.25,
        },
      ]),
    });

    expect(container.textContent).toContain("No source columns are available yet");
    expect(container.textContent).not.toContain("Trend");
    expect(container.textContent).not.toContain("Net Chg");
  });

  it("renders a bounded virtual window for large generic tabular universes", () => {
    const rows = Array.from({ length: 1_000 }, (_, index) => ({
      unique_identifier: `uid:${index}`,
      Symbol: `SYM${index.toString().padStart(4, "0")}`,
      time: "2026-05-16T12:00:00.000Z",
      last_price: 100 + index,
    }));
    const props = {
      ...assetScreenerDefaultProps,
      columnConfigMode: "custom",
      columns: [
        {
          id: "symbol",
          kind: "asset-field",
          label: "Symbol",
          field: "symbol",
          width: 120,
        },
        {
          id: "last",
          kind: "latest-value",
          label: "Last",
          valueField: "price",
          width: 96,
        },
      ],
      groupBy: undefined,
      maxRenderedRows: 1_000,
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
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const seedData = frame(rows);
    const container = renderWidget(props, { seedData });
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });
    const tableFrame = buildAssetScreenerTableFrame({
      columns: state.columns,
      rows: state.filteredRows,
    });

    expect(container.textContent).not.toContain("Filter assets");
    expect(container.textContent).not.toContain("Clear");
    expect(tableFrame.rowObjects[0]?.symbol).toBe("SYM0000");
    expect(tableFrame.rowObjects.at(-1)?.symbol).toBe("SYM0999");
  });

  it("inserts grouped section rows when groupBy is configured", () => {
    const props = {
      ...assetScreenerDefaultProps,
      columnConfigMode: "custom",
      columns: [
        {
          id: "symbol",
          kind: "asset-field",
          label: "Symbol",
          field: "symbol",
          width: 120,
        },
        {
          id: "last",
          kind: "latest-value",
          label: "Last",
          valueField: "price",
          format: "price",
          width: 96,
        },
      ],
      groupBy: "sector",
      sort: undefined,
      fieldMappings: {
        seed: {
          assetKeyField: "unique_identifier",
          symbolField: "Symbol",
          sectorField: "sector",
          valueFields: {
            price: "last_price",
          },
        },
      },
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const seedData = frame([
      {
        unique_identifier: "uid:AAPL",
        Symbol: "AAPL",
        sector: "Technology",
        last_price: 112.25,
      },
      {
        unique_identifier: "uid:JPM",
        Symbol: "JPM",
        sector: "Financials",
        last_price: 198.42,
      },
    ]);
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });
    const tableFrame = buildAssetScreenerTableFrame({
      columns: state.columns,
      groupBy: props.groupBy,
      rows: state.filteredRows,
    });

    expect((tableFrame.rowObjects[0] as Record<string, unknown>).__groupHeader).toBe(true);
    expect(tableFrame.rowObjects[0]?.symbol).toBe("Technology");
    expect((tableFrame.rowObjects[2] as Record<string, unknown>).__groupHeader).toBe(true);
    expect(tableFrame.rowObjects[2]?.symbol).toBe("Financials");
    expect(tableFrame.rowObjects).toHaveLength(4);
  });

  it("keeps grouped rows contiguous even when the incoming row order interleaves groups", () => {
    const props = {
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
          id: "last",
          kind: "latest-value",
          label: "Last",
          valueField: "price",
          format: "price",
        },
      ],
      groupBy: "sector",
      sort: undefined,
      fieldMappings: {
        seed: {
          assetKeyField: "unique_identifier",
          symbolField: "Symbol",
          sectorField: "sector",
          valueFields: {
            price: "last_price",
          },
        },
      },
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const seedData = frame([
      {
        unique_identifier: "uid:AAPL",
        Symbol: "AAPL",
        sector: "Technology",
        last_price: 112.25,
      },
      {
        unique_identifier: "uid:JPM",
        Symbol: "JPM",
        sector: "Financials",
        last_price: 198.42,
      },
      {
        unique_identifier: "uid:MSFT",
        Symbol: "MSFT",
        sector: "Technology",
        last_price: 421.18,
      },
      {
        unique_identifier: "uid:GS",
        Symbol: "GS",
        sector: "Financials",
        last_price: 451.77,
      },
    ]);
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });
    const tableFrame = buildAssetScreenerTableFrame({
      columns: state.columns,
      groupBy: props.groupBy,
      rows: state.filteredRows,
      sourceColumns: state.sourceColumns,
    });

    expect(tableFrame.rowObjects.map((row) => row.symbol)).toEqual([
      "Technology",
      "AAPL",
      "MSFT",
      "Financials",
      "GS",
      "JPM",
    ]);
    expect(
      tableFrame.rowObjects.filter((row) => (row as Record<string, unknown>).__groupHeader).length,
    ).toBe(2);
  });

  it("renders trend sparklines from inline seed sparkline values", () => {
    const props = {
      ...assetScreenerDefaultProps,
      groupBy: undefined,
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const seedData = marketSeedFrame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          time: "2026-05-16T13:00:00.000Z",
          last_price: 110,
          price_sparkline: "82,96,100,110",
        },
      ]);
    renderWidget(props, {
      seedData,
    });
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });

    expect(buildSparklineValues(state.filteredRows[0]!, "price")).toEqual([82, 96, 100, 110]);
  });

  it("does not render an internal toolbar or title strip", () => {
    const props = {
      ...assetScreenerDefaultProps,
      groupBy: undefined,
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const container = renderWidget(
      props,
      {
        seedData: marketSeedFrame([
          {
            unique_identifier: "uid:AAPL",
            Symbol: "AAPL",
            time: "2026-05-16T13:00:00.000Z",
            last_price: 110,
          },
        ]),
      },
      {
        instanceTitle: "Global equity monitor",
      },
    );

    expect(container.textContent).not.toContain("Global equity monitor");
    expect(container.textContent).not.toContain("Filter assets");
    expect(container.textContent).not.toContain("Clear");
  });

  it("does not render an internal footer strip when the grid has no rows", () => {
    const props = {
      ...assetScreenerDefaultProps,
      columnConfigMode: "custom",
      columns: [
        {
          id: "symbol",
          kind: "asset-field",
          label: "Symbol",
          field: "symbol",
        },
      ],
      groupBy: undefined,
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const container = renderWidget(props, {
      seedData: {
        status: "ready",
        columns: ["unique_identifier", "Symbol"],
        rows: [],
      },
    });

    expect(container.textContent).not.toContain("No assets match the current bindings and filters.");
    expect(container.textContent).not.toContain("Clear");
  });

  it("aliases the shared table source contract onto screener column ids", () => {
    const props = {
      ...assetScreenerDefaultProps,
      columnConfigMode: "custom",
      columns: [
        {
          id: "pct",
          kind: "return",
          label: "1D",
          valueField: "price",
          referenceKey: "previousClose",
          returnMode: "percent",
          format: "percent",
        },
      ],
      groupBy: undefined,
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          last_price: 112.25,
          previous_close: 110,
          one_day_return: 2.0454545454545454,
        },
      ]),
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
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
          tableVisuals: {
            columns: {
              one_day_return: {
                format: "percent",
                gaugeMode: "ring",
                heatmap: true,
                gradientMode: "fill",
                visualRangeMode: "fixed",
                visualMin: -5,
                visualMax: 5,
                thresholds: [
                  { operator: "lt", value: 0, tone: "warning" },
                  { operator: "eq", value: 0, tone: "neutral" },
                  { operator: "gt", value: 0, tone: "success" },
                ],
              },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;
    const container = renderWidget(props, { seedData });
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });
    const plainTableFrame = buildTableWidgetFrameFromRemoteData(
      null,
      seedData.rows,
      seedData.columns,
      [],
      seedData.meta,
    );
    const tableFrame = buildAssetScreenerTableFrame({
      columns: state.columns,
      rows: state.filteredRows,
      sourceFrame: state.sourceFrame,
      sourceColumns: state.sourceColumns,
    });
    const tableProps = buildAssetScreenerResolvedTableProps({
      density: props.density,
      frame: tableFrame.frame,
    });

    expect(container.textContent).not.toContain("Filter assets");
    expect(container.textContent).not.toContain("Clear");
    expect(plainTableFrame.sourceColumnOverrides?.one_day_return).toMatchObject({
      gaugeMode: "ring",
      heatmap: true,
      gradientMode: "fill",
      visualRangeMode: "fixed",
      visualMin: -5,
      visualMax: 5,
    });
    expect(plainTableFrame.sourceConditionalRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columnKey: "one_day_return", operator: "lt", tone: "warning" }),
        expect.objectContaining({ columnKey: "one_day_return", operator: "eq", tone: "neutral" }),
        expect.objectContaining({ columnKey: "one_day_return", operator: "gt", tone: "success" }),
      ]),
    );
    expect(tableProps.schema.find((column) => column.key === "pct")).toMatchObject({
      label: "1D",
      format: "percent",
    });
    expect(tableProps.columnOverrides.pct).toMatchObject({
      gaugeMode: "ring",
      heatmap: true,
      gradientMode: "fill",
      visualRangeMode: "fixed",
      visualMin: -5,
      visualMax: 5,
    });
    expect(tableProps.conditionalRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columnKey: "pct", operator: "lt", tone: "warning" }),
        expect.objectContaining({ columnKey: "pct", operator: "eq", tone: "neutral" }),
        expect.objectContaining({ columnKey: "pct", operator: "gt", tone: "success" }),
      ]),
    );
  });

  it("inherits source theme visuals for semantically matching custom return columns", () => {
    const props = {
      ...assetScreenerDefaultProps,
      columnConfigMode: "custom",
      columns: [
        {
          id: "pct",
          kind: "return",
          label: "1D",
          valueField: "price",
          referenceKey: "previousClose",
          returnMode: "percent",
          format: "percent",
        },
      ],
      groupBy: undefined,
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;
    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          last_price: 112.25,
          previous_close: 110,
          one_day_return: 2.0454545454545454,
        },
      ]),
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
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
          tableVisuals: {
            columns: {
              one_day_return: {
                format: "percent",
                gaugeMode: "ring",
                heatmap: true,
                gradientMode: "fill",
                visualRangeMode: "fixed",
                visualMin: -10,
                visualMax: 10,
                thresholds: [
                  { operator: "lt", value: 0, tone: "warning" },
                  { operator: "eq", value: 0, tone: "neutral" },
                  { operator: "gt", value: 0, tone: "success" },
                ],
              },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });
    const tableFrame = buildAssetScreenerTableFrame({
      columns: state.columns,
      rows: state.filteredRows,
      sourceFrame: state.sourceFrame,
      sourceColumns: state.sourceColumns,
    });
    const tableProps = buildAssetScreenerResolvedTableProps({
      density: props.density,
      frame: tableFrame.frame,
    });

    expect(tableProps.schema.find((column) => column.key === "pct")).toMatchObject({
      format: "percent",
      label: "1D",
    });
    expect(tableProps.columnOverrides.pct).toMatchObject({
      gaugeMode: "ring",
      gradientMode: "fill",
      heatmap: true,
      visualRangeMode: "fixed",
      visualMin: -10,
      visualMax: 10,
    });
    expect(tableProps.conditionalRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columnKey: "pct", operator: "lt", tone: "warning" }),
        expect.objectContaining({ columnKey: "pct", operator: "eq", tone: "neutral" }),
        expect.objectContaining({ columnKey: "pct", operator: "gt", tone: "success" }),
      ]),
    );
  });

  it("inherits computed source return visuals even when the source only exposes table metadata field ids", () => {
    const props = {
      ...assetScreenerDefaultProps,
      columnConfigMode: "custom",
      columns: [
        {
          id: "pct",
          kind: "return",
          label: "1D",
          valueField: "price",
          referenceKey: "previousClose",
          returnMode: "percent",
          format: "percent",
        },
      ],
      groupBy: undefined,
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;
    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          last_price: 112.25,
          previous_close: 110,
        },
      ]),
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
            { field: "last_price", role: "value", valueKey: "price" },
            {
              field: "previous_close",
              role: "referenceValue",
              referenceKey: "previousClose",
              valueKey: "price",
            },
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
                format: "percent",
                gaugeMode: "ring",
                heatmap: true,
                gradientMode: "fill",
                visualRangeMode: "fixed",
                visualMin: -10,
                visualMax: 10,
                thresholds: [
                  { operator: "lt", value: 0, tone: "warning" },
                  { operator: "eq", value: 0, tone: "neutral" },
                  { operator: "gt", value: 0, tone: "success" },
                ],
              },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });
    const tableFrame = buildAssetScreenerTableFrame({
      columns: state.columns,
      rows: state.filteredRows,
      sourceFrame: state.sourceFrame,
      sourceColumns: state.sourceColumns,
    });
    const tableProps = buildAssetScreenerResolvedTableProps({
      density: props.density,
      frame: tableFrame.frame,
    });

    expect(tableProps.schema.find((column) => column.key === "pct")).toMatchObject({
      format: "percent",
      label: "1D",
    });
    expect(tableProps.columnOverrides.pct).toMatchObject({
      gaugeMode: "ring",
      gradientMode: "fill",
      heatmap: true,
      visualRangeMode: "fixed",
      visualMin: -10,
      visualMax: 10,
    });
    expect(tableProps.conditionalRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columnKey: "pct", operator: "lt", tone: "warning" }),
        expect.objectContaining({ columnKey: "pct", operator: "eq", tone: "neutral" }),
        expect.objectContaining({ columnKey: "pct", operator: "gt", tone: "success" }),
      ]),
    );
  });

  it("prefers live source visuals over stale persisted screener column visuals", () => {
    const props = {
      ...assetScreenerDefaultProps,
      columnConfigMode: "custom",
      columns: [
        {
          id: "pct",
          kind: "return",
          label: "1D",
          valueField: "price",
          referenceKey: "previousClose",
          returnMode: "percent",
          format: "percent",
          visual: {
            gaugeMode: "none",
            thresholds: [
              { operator: "lt", value: 0, tone: "danger" },
              { operator: "gt", value: 0, tone: "danger" },
            ],
          },
        },
      ],
      groupBy: undefined,
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;
    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:AAPL",
          Symbol: "AAPL",
          last_price: 112.25,
          previous_close: 110,
          one_day_return: 2.0454545454545454,
        },
      ]),
      meta: {
        ...buildMarketAssetFrameSemanticMeta({
          role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
          fieldRoles: [
            { field: "unique_identifier", role: "assetKey" },
            { field: "Symbol", role: "symbol" },
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
          tableVisuals: {
            columns: {
              one_day_return: {
                format: "percent",
                gaugeMode: "ring",
                heatmap: true,
                gradientMode: "fill",
                visualRangeMode: "fixed",
                visualMin: -10,
                visualMax: 10,
                thresholds: [
                  { operator: "lt", value: 0, tone: "warning" },
                  { operator: "eq", value: 0, tone: "neutral" },
                  { operator: "gt", value: 0, tone: "success" },
                ],
              },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });
    const tableFrame = buildAssetScreenerTableFrame({
      columns: state.columns,
      rows: state.filteredRows,
      sourceFrame: state.sourceFrame,
      sourceColumns: state.sourceColumns,
    });
    const tableProps = buildAssetScreenerResolvedTableProps({
      density: props.density,
      frame: tableFrame.frame,
    });

    expect(tableProps.columnOverrides.pct).toMatchObject({
      gaugeMode: "ring",
      heatmap: true,
      gradientMode: "fill",
      visualRangeMode: "fixed",
      visualMin: -10,
      visualMax: 10,
    });
    expect(tableProps.conditionalRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columnKey: "pct", operator: "lt", tone: "warning" }),
        expect.objectContaining({ columnKey: "pct", operator: "eq", tone: "neutral" }),
        expect.objectContaining({ columnKey: "pct", operator: "gt", tone: "success" }),
      ]),
    );
    expect(tableProps.conditionalRules).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columnKey: "pct", operator: "lt", tone: "danger" }),
        expect.objectContaining({ columnKey: "pct", operator: "gt", tone: "danger" }),
      ]),
    );
  });

  it("applies shared table display settings on top of the market-derived frame", () => {
    const props = {
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
          id: "last",
          kind: "latest-value",
          label: "Last",
          valueField: "price",
          format: "price",
        },
      ],
      groupBy: undefined,
      sort: undefined,
      fieldMappings: {
        seed: {
          assetKeyField: "unique_identifier",
          symbolField: "Symbol",
          valueFields: {
            price: "last_price",
          },
        },
      },
      table: {
        showToolbar: false,
        showSearch: false,
        zebraRows: true,
        pagination: true,
        pageSize: 25,
        columnOverrides: {
          last: {
            label: "Last Px",
            decimals: 2,
          },
        },
        valueLabels: [
          {
            columnKey: "symbol",
            value: "AAPL",
            label: "Apple",
            tone: "primary",
          },
        ],
        conditionalRules: [
          {
            id: "last-positive",
            columnKey: "last",
            operator: "gt",
            value: 0,
            tone: "success",
          },
        ],
      },
    } satisfies MainSequenceAssetScreenerWidgetProps;
    const seedData = frame([
      {
        unique_identifier: "uid:AAPL",
        Symbol: "AAPL",
        last_price: 112.25,
      },
    ]);
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
      },
    });
    const tableFrame = buildAssetScreenerTableFrame({
      columns: state.columns,
      rows: state.filteredRows,
      sourceFrame: state.sourceFrame,
      sourceColumns: state.sourceColumns,
    });
    const tableProps = buildAssetScreenerResolvedTableProps({
      density: props.density,
      frame: tableFrame.frame,
      tableSettings: props.table,
    });

    expect(tableProps).toMatchObject({
      showToolbar: false,
      showSearch: false,
      zebraRows: true,
      pagination: false,
      pageSize: 25,
    });
    expect(tableProps.schema.find((column) => column.key === "last")).toMatchObject({
      label: "Last Px",
    });
    expect(tableProps.columnOverrides.last).toMatchObject({
      decimals: 2,
    });
    expect(tableProps.valueLabels).toEqual(props.table.valueLabels);
    expect(tableProps.conditionalRules).toEqual(props.table.conditionalRules);
  });
});
