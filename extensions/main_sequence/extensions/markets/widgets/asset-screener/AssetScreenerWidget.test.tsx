/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import type { ResolvedWidgetInputs } from "@/widgets/types";
import {
  buildTableWidgetFrameFromRemoteData,
  buildTableWidgetRowObjects,
} from "@/widgets/core/table/tableModel";
import {
  TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID,
  TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID,
  TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID,
} from "@/widgets/core/table/tableModel";

import {
  buildMarketAssetFrameSemanticMeta,
  buildMarketTableFrameMeta,
  MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
} from "../../widget-contracts/marketAssetFrames";
import { mainSequenceAssetScreenerWidget } from "./definition";
import {
  AssetScreenerWidget,
  buildAssetScreenerSparklineColumnDefOverrides,
  buildAssetScreenerResolvedTableProps,
  buildAssetScreenerTableFrame,
  buildSparklineValues,
  resolveAssetScreenerActiveCellOutput,
  resolveAssetScreenerActiveCellValueOutput,
  resolveAssetScreenerActiveRowOutput,
  resolveAssetScreenerSelectedCellValuesOutput,
  resolveAssetScreenerSelectedRowsOutput,
} from "./AssetScreenerWidget";
import {
  assetScreenerDefaultProps,
  buildAssetScreenerResetTableSettingsProps,
  normalizeAssetScreenerProps,
  resolveAssetScreenerState,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";

const dashboardExecutionMocks = vi.hoisted(() => ({
  useResolveWidgetUpstream: vi.fn(),
}));

const runtimeDataStoreMocks = vi.hoisted(() => ({
  useRuntimeDataStore: vi.fn(() => null),
}));
const dependencyMocks = vi.hoisted(() => ({
  useWorkspaceVariableReferenceRegistry: vi.fn(() => ({
    bySourceWidgetId: new Map(),
  })),
}));

vi.mock("@/dashboards/DashboardWidgetExecution", () => dashboardExecutionMocks);
vi.mock("@/dashboards/DashboardWidgetDependencies", () => dependencyMocks);
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
  dependencyMocks.useWorkspaceVariableReferenceRegistry.mockReset();
  dependencyMocks.useWorkspaceVariableReferenceRegistry.mockReturnValue({
    bySourceWidgetId: new Map(),
  });
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

function resolveWidgetOutputValue(
  outputId: string,
  input: {
    props: MainSequenceAssetScreenerWidgetProps;
    resolvedInputs?: ResolvedWidgetInputs;
    runtimeDataStore?: ReturnType<typeof createRuntimeDataStore> | null;
    runtimeState?: unknown;
  },
) {
  switch (outputId) {
    case TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID:
      return resolveAssetScreenerActiveRowOutput({
        props: input.props,
        resolvedInputs: input.resolvedInputs,
        runtimeDataStore: input.runtimeDataStore ?? undefined,
        runtimeState: input.runtimeState,
      });
    case TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID:
      return resolveAssetScreenerActiveCellOutput({
        props: input.props,
        resolvedInputs: input.resolvedInputs,
        runtimeDataStore: input.runtimeDataStore ?? undefined,
        runtimeState: input.runtimeState,
      });
    case TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID:
      return resolveAssetScreenerActiveCellValueOutput({
        props: input.props,
        resolvedInputs: input.resolvedInputs,
        runtimeDataStore: input.runtimeDataStore ?? undefined,
        runtimeState: input.runtimeState,
      });
    case TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID:
      return resolveAssetScreenerSelectedCellValuesOutput({
        props: input.props,
        resolvedInputs: input.resolvedInputs,
        runtimeDataStore: input.runtimeDataStore ?? undefined,
        runtimeState: input.runtimeState,
      });
    case TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID:
      return resolveAssetScreenerSelectedRowsOutput({
        props: input.props,
        resolvedInputs: input.resolvedInputs,
        runtimeDataStore: input.runtimeDataStore ?? undefined,
        runtimeState: input.runtimeState,
      });
    default:
      throw new Error(`Unsupported output id in test: ${outputId}`);
  }
}

describe("AssetScreenerWidget", () => {
  it("keeps source-column failures isolated per widget instance", () => {
    const badSeedData = frame([{ unsupported: "row" }]);
    const goodSeedData = marketSeedFrame([
      {
        unique_identifier: "uid:BTCUSDT",
        Symbol: "BTCUSDT",
        sector: "Layer 1",
        time: "2026-05-20T12:00:00.000Z",
        last_price: 109420,
        price_sparkline: "100800,102400,104950,106700,107980,109420",
      },
    ]);
    const badState = resolveAssetScreenerState({
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData: badSeedData,
      },
    });
    const goodState = resolveAssetScreenerState({
      props: assetScreenerDefaultProps,
      fallbackFrames: {
        seedData: goodSeedData,
      },
    });

    expect(badState.columns).toHaveLength(0);
    expect(goodState.columns.length).toBeGreaterThan(0);
    expect(goodState.filteredRows[0]?.asset.symbol).toBe("BTCUSDT");

    host = document.createElement("div");
    host.style.height = "840px";
    host.style.width = "900px";
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root!.render(
        <div>
          <div style={{ height: "420px", width: "900px" }}>
            <AssetScreenerWidget
              instanceId="asset-screener-bad"
              widget={mainSequenceAssetScreenerWidget}
              instanceTitle="Broken screener"
              props={assetScreenerDefaultProps}
              runtimeState={{
                marketAssetScreenerDemoFrames: {
                  seedData: badSeedData,
                },
              }}
            />
          </div>
          <div style={{ height: "420px", width: "900px" }}>
            <AssetScreenerWidget
              instanceId="asset-screener-good"
              widget={mainSequenceAssetScreenerWidget}
              instanceTitle="Valid screener"
              props={assetScreenerDefaultProps}
              runtimeState={{
                marketAssetScreenerDemoFrames: {
                  seedData: goodSeedData,
                },
              }}
            />
          </div>
        </div>,
      );
    });

    const emptyColumnMessageCount = host.textContent
      ?.split("The source returned data, but it did not describe which columns")
      .length ?? 0;

    expect(emptyColumnMessageCount - 1).toBe(1);
    expect(dashboardExecutionMocks.useResolveWidgetUpstream).toHaveBeenCalledWith(
      "asset-screener-bad",
      expect.any(Object),
    );
    expect(dashboardExecutionMocks.useResolveWidgetUpstream).toHaveBeenCalledWith(
      "asset-screener-good",
      expect.any(Object),
    );
  });

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

    expect(container.textContent).not.toContain(
      "The source returned data, but it did not describe which columns",
    );
  });

  it("inherits Pro table formulas by default through the shared table path", () => {
    const resolved = buildAssetScreenerResolvedTableProps({
      density: "compact",
      frame: {
        columns: ["last_price", "yearStart"],
        rows: [[118, 100]],
        schemaFallback: [
          { key: "last_price", label: "Last", format: "number" },
          { key: "yearStart", label: "Year Start", format: "number" },
        ],
      },
      tableSettings: {
        schema: [
          { key: "last_price", label: "Last", format: "number" },
          { key: "yearStart", label: "Year Start", format: "number" },
          {
            key: "ytd",
            label: "YTD",
            format: "formula",
            formulaExpression: "PERCENT_CHANGE([last_price], [yearStart])",
            formulaResultFormat: "percent",
          },
        ],
      },
    });
    const rows = buildTableWidgetRowObjects(resolved.columns, resolved.rows);

    expect(resolved.formulasEnabled).toBe(true);
    expect(rows[0]?.ytd).toBe(18);
  });

  it("renders source-declared return formulas from table visual column metadata", () => {
    const props = {
      ...assetScreenerDefaultProps,
      groupBy: undefined,
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;
    const seedData = {
      ...frame([
        {
          unique_identifier: "uid:BTCUSDT",
          Symbol: "BTCUSDT",
          sector: "Layer 1",
          time: "2026-05-19T13:00:00.000Z",
          last_price: 109420,
          previous_close: 107980,
          one_month_ago: 101300,
          year_start: 92400,
          one_year_ago: 76800,
          price_sparkline: "100800,102400,104950,106700,107980,109420",
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
              field: "price_sparkline",
              role: "sparklineSeries",
              valueKey: "price",
              encoding: "csv-number",
            },
          ],
        }),
        ...buildMarketTableFrameMeta({
          tableVisuals: {
            columns: {
              Symbol: {
                label: "Symbol",
                width: 112,
              },
              sector: {
                label: "Sector",
                width: 140,
              },
              last_price: {
                label: "Last",
                format: "price",
                width: 108,
              },
              previous_close: {
                label: "Previous close",
                format: "price",
                visible: false,
              },
              one_month_ago: {
                label: "One month ago",
                format: "price",
                visible: false,
              },
              year_start: {
                label: "Year start",
                format: "price",
                visible: false,
              },
              one_year_ago: {
                label: "One year ago",
                format: "price",
                visible: false,
              },
              price_sparkline: {
                kind: "sparkline",
                label: "Trend",
                encoding: "csv-number",
                width: 132,
              },
              one_day_return: {
                label: "1D",
                format: "formula",
                formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
                formulaResultFormat: "percent",
                gaugeMode: "ring",
                visualRangeMode: "fixed",
                visualMin: -3,
                visualMax: 3,
              },
              one_month_return: {
                label: "1M",
                format: "formula",
                formulaExpression: "PERCENT_CHANGE([last_price], [one_month_ago])",
                formulaResultFormat: "percent",
              },
              ytd_return: {
                label: "YTD",
                format: "formula",
                formulaExpression: "PERCENT_CHANGE([last_price], [year_start])",
                formulaResultFormat: "percent",
                heatmap: true,
              },
              one_year_return: {
                label: "1Y",
                format: "formula",
                formulaExpression: "PERCENT_CHANGE([last_price], [one_year_ago])",
                formulaResultFormat: "percent",
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
    const rows = buildTableWidgetRowObjects(tableProps.columns, tableProps.rows);

    expect(state.columns.map((column) => column.id)).toEqual([
      "Symbol",
      "sector",
      "last_price",
      "price_sparkline",
      "one_day_return",
      "one_month_return",
      "ytd_return",
      "one_year_return",
    ]);
    expect(tableProps.schema.find((column) => column.key === "one_day_return")).toMatchObject({
      format: "formula",
      formulaExpression: "PERCENT_CHANGE([last_price], [previous_close])",
      formulaResultFormat: "percent",
    });
    expect(tableProps.columnOverrides.previous_close).toMatchObject({
      visible: false,
    });
    expect(tableProps.columnOverrides.one_day_return).toMatchObject({
      gaugeMode: "ring",
    });
    expect(rows[0]?.one_day_return).toBeCloseTo(1.3335802926467864);
    expect(rows[0]?.one_month_return).toBeCloseTo(8.01579466929911);
    expect(rows[0]?.ytd_return).toBeCloseTo(18.41991341991342);
    expect(rows[0]?.one_year_return).toBeCloseTo(42.47395833333333);
  });

  it("renders plain source columns when source metadata has no column proposal", () => {
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
    const container = renderWidget(props, { seedData });

    expect(state.columns.map((column) => column.id)).toEqual(["Symbol", "last_price"]);
    expect(state.filteredRows[0]?.asset.symbol).toBe("AAPL");
    expect(state.filteredRows[0]?.metrics.last_price).toBe(112.25);
    expect(container.textContent).not.toContain("Waiting for source data");
    expect(container.textContent).not.toContain(
      "The source returned data, but it did not describe which columns",
    );
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

  it("keeps screener frame rows ungrouped and carries shared table grouping config", () => {
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
      sort: undefined,
      table: {
        groupBy: "sector",
      },
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
      rows: state.filteredRows,
    });
    const tableProps = buildAssetScreenerResolvedTableProps({
      density: props.density,
      frame: tableFrame.frame,
      tableSettings: props.table,
    });

    expect(tableFrame.rowObjects).toHaveLength(2);
    expect(tableFrame.rowObjects.map((row) => row.symbol)).toEqual(["AAPL", "JPM"]);
    expect(tableProps.groupBy).toBe("sector");
  });

  it("moves legacy top-level groupBy into shared table settings on normalization", () => {
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
    } satisfies MainSequenceAssetScreenerWidgetProps;

    expect(normalizeAssetScreenerProps(props).table?.groupBy).toBe("sector");
  });

  it("resets embedded table settings back to screener defaults instead of rehydrating legacy display state", () => {
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
      density: "comfortable",
      groupBy: "industry",
      table: {
        density: "comfortable",
        groupBy: "industry",
        zebraRows: true,
        selectionMode: "single-row",
      },
      sort: undefined,
    } satisfies MainSequenceAssetScreenerWidgetProps;

    expect(buildAssetScreenerResetTableSettingsProps(props)).toMatchObject({
      density: assetScreenerDefaultProps.density,
      groupBy: assetScreenerDefaultProps.groupBy,
      table: undefined,
    });
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

  it("builds AG Grid Enterprise sparkline overrides backed by derived sparkline values", () => {
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
    const overrides = buildAssetScreenerSparklineColumnDefOverrides({
      columns: state.columns,
      rows: state.filteredRows,
      strokeColor: "#ffffff",
    });
    const sparklineColumn = state.columns.find((column) => column.kind === "sparkline");

    expect(sparklineColumn).toBeDefined();

    const override = sparklineColumn ? overrides[sparklineColumn.id] : undefined;
    const sparklineValues =
      typeof override?.valueGetter === "function"
        ? override.valueGetter({
            data: tableFrame.rowObjects[0],
          } as Parameters<NonNullable<typeof override.valueGetter>>[0])
        : undefined;

    expect(override?.cellRenderer).toBe("agSparklineCellRenderer");
    expect(override?.filter).toBe(false);
    expect(override?.sortable).toBe(false);
    expect(override?.cellRendererParams).toEqual(
      expect.objectContaining({
        sparklineOptions: expect.objectContaining({
          stroke: "#ffffff",
          strokeWidth: 1.5,
          marker: expect.objectContaining({ enabled: false }),
          type: "line",
        }),
      }),
    );
    expect(sparklineValues).toEqual([82, 96, 100, 110]);
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

  it("describes activeRow fields up front for variable completion", () => {
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
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const io = mainSequenceAssetScreenerWidget.resolveIo?.({
      widgetId: mainSequenceAssetScreenerWidget.id,
      instanceId: "asset-screener-test",
      props,
      runtimeState: undefined,
    });
    const activeRowOutput = io?.outputs?.find((output) => output.id === TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID);
    const activeCellOutput = io?.outputs?.find((output) => output.id === TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID);

    expect(activeRowOutput?.valueDescriptor).toMatchObject({
      kind: "object",
      fields: expect.arrayContaining([
        expect.objectContaining({ key: "symbol", label: "Symbol" }),
        expect.objectContaining({ key: "last", label: "Last" }),
      ]),
    });
    expect(activeCellOutput?.valueDescriptor).toMatchObject({
      kind: "object",
      fields: expect.arrayContaining([
        expect.objectContaining({ key: "row" }),
        expect.objectContaining({ key: "columnKey" }),
      ]),
    });
  });

  it("publishes activeRow for a selected asset row and ignores grouped header rows", () => {
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
      sort: undefined,
      table: {
        groupBy: "sector",
        selectionMode: "single-row",
      },
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

    expect(
      resolveWidgetOutputValue(TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID, {
        props,
        runtimeState: {
          interaction: {
            selection: {
              mode: "single-row",
              selectedRowIndices: [0],
              selectedRowKeys: ['["uid:AAPL"]'],
              activeRowIndex: 0,
              activeRowKey: '["uid:AAPL"]',
              selectedCells: [],
              updatedAtMs: 1,
            },
          },
          marketAssetScreenerDemoFrames: {
            seedData,
          },
        },
      }),
    ).toMatchObject({
      assetKey: "uid:AAPL",
      unique_identifier: "uid:AAPL",
      symbol: "AAPL",
      last: 112.25,
      sector: "Technology",
    });
  });

  it("publishes activeRow from the retained live frame instead of only the latest live delta", () => {
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
      sort: undefined,
      table: {
        selectionMode: "single-row",
      },
      fieldMappings: {
        live: {
          symbolField: "symbol",
          valueFields: {
            price: "last",
          },
        },
      },
    } satisfies MainSequenceAssetScreenerWidgetProps;
    const retainedLiveFrame = frame([
      {
        symbol: "BTCUSDT",
        last: 77295.7,
      },
      {
        symbol: "ETHUSDT",
        last: 2117.05,
      },
    ]);
    const latestLiveDelta = frame([
      {
        symbol: "BTCUSDT",
        last: 77301.2,
      },
    ]);
    const runtimeState = {
      ...retainedLiveFrame,
      source: {
        kind: "asset-screener-retained-live",
      },
      interaction: {
        selection: {
          mode: "single-row",
          selectedRowIndices: [1],
          selectedRowKeys: ['["ETHUSDT"]'],
          activeRowIndex: 1,
          activeRowKey: '["ETHUSDT"]',
          selectedCells: [],
          updatedAtMs: 1,
        },
      },
    };
    const resolvedInputs = {
      liveUpdates: {
        inputId: "liveUpdates",
        label: "Live updates",
        status: "valid",
        sourceWidgetId: "stream-query",
        sourceOutputId: "updates",
        contractId: "core.tabular_frame@v1",
        upstreamDelta: latestLiveDelta,
      },
    } satisfies ResolvedWidgetInputs;

    expect(
      resolveWidgetOutputValue(TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID, {
        props,
        resolvedInputs,
        runtimeState,
      }),
    ).toMatchObject({
      assetKey: "ETHUSDT",
      symbol: "ETHUSDT",
      last: 2117.05,
    });
  });

  it("publishes activeCell, activeCellValue, selectedCellValues, and selectedRows from asset selections", () => {
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
      sort: undefined,
      table: {
        groupBy: "sector",
        selectionMode: "cell",
      },
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
    const runtimeState = {
      interaction: {
        selection: {
          mode: "cell",
          selectedRowIndices: [0],
          selectedRowKeys: ['["uid:AAPL"]'],
          activeRowIndex: 0,
          activeRowKey: '["uid:AAPL"]',
          activeCell: {
            rowIndex: 0,
            rowKey: '["uid:AAPL"]',
            columnKey: "symbol",
            value: "AAPL",
          },
          selectedCells: [
            {
              rowIndex: 0,
              rowKey: '["uid:AAPL"]',
              columnKey: "symbol",
              value: "AAPL",
            },
            {
              rowIndex: 1,
              rowKey: '["uid:JPM"]',
              columnKey: "symbol",
              value: "JPM",
            },
          ],
          updatedAtMs: 1,
        },
      },
      marketAssetScreenerDemoFrames: {
        seedData,
      },
    };

    expect(
      resolveWidgetOutputValue(TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID, {
        props,
        runtimeState,
      }),
    ).toMatchObject({
      rowIndex: 0,
      rowKey: '["uid:AAPL"]',
      columnKey: "symbol",
      value: "AAPL",
      row: expect.objectContaining({
        assetKey: "uid:AAPL",
        symbol: "AAPL",
      }),
    });
    expect(
      resolveWidgetOutputValue(TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID, {
        props,
        runtimeState,
      }),
    ).toBe("AAPL");
    expect(
      resolveWidgetOutputValue(TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID, {
        props,
        runtimeState,
      }),
    ).toEqual(["AAPL", "JPM"]);
    expect(
      resolveWidgetOutputValue(TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID, {
        props,
        runtimeState,
      }),
    ).toMatchObject({
      columns: expect.arrayContaining(["symbol", "last", "assetKey", "unique_identifier"]),
      rows: [
        expect.objectContaining({
          assetKey: "uid:AAPL",
          symbol: "AAPL",
        }),
        expect.objectContaining({
          assetKey: "uid:JPM",
          symbol: "JPM",
        }),
      ],
    });
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
    expect(tableProps.selectionKeyFields).toEqual([]);
    expect(tableProps.selectionMode).toBe("none");
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

  it("normalizes live fields into seed fields before resolving table columns", () => {
    const props = {
      ...assetScreenerDefaultProps,
      table: {
        liveMergeKeyMappings: [{ seedField: "Symbol", liveField: "symbol" }],
        selectionMode: "single-row",
        columnOverrides: {
          last_price: {
            decimals: 4,
          },
        },
      },
    } satisfies MainSequenceAssetScreenerWidgetProps;
    const seedData = {
      ...marketSeedFrame([
        {
          unique_identifier: "uid:BTCUSDT",
          Symbol: "BTCUSDT",
          time: "2026-05-19T13:00:00.000Z",
          last_price: 109420,
        },
      ]),
      meta: {
        ...marketSeedFrame([]).meta,
        ...buildMarketTableFrameMeta({
          tableVisuals: {
            columns: {
              Symbol: { label: "Symbol" },
              last_price: { label: "Last", format: "price" },
            },
          },
        }),
      },
    } satisfies TabularFrameSourceV1;
    const liveUpdates = frame([
      {
        symbol: "BTCUSDT",
        last: 109500.12345,
      },
    ]);
    const state = resolveAssetScreenerState({
      props,
      fallbackFrames: {
        seedData,
        liveUpdates,
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

    expect(tableFrame.frame.columns).toContain("last_price");
    expect(tableFrame.frame.columns).not.toContain("last");
    expect(tableFrame.rowObjects[0]?.last_price).toBe(109500.12345);
    expect(tableProps.columnOverrides.last_price).toMatchObject({
      decimals: 4,
    });

    const stateWithRetainedRuntime = resolveAssetScreenerState({
      props,
      resolvedInputs: {
        seedData: {
          inputId: "seedData",
          label: "Seed data",
          status: "valid",
          sourceWidgetId: "seed-query",
          sourceOutputId: "dataset",
          contractId: "core.tabular_frame@v1",
          upstreamBase: seedData,
        },
        liveUpdates: {
          inputId: "liveUpdates",
          label: "Live updates",
          status: "valid",
          sourceWidgetId: "stream-query",
          sourceOutputId: "updates",
          contractId: "core.tabular_frame@v1",
          upstreamDelta: liveUpdates,
        },
      },
      runtimeState: {
        ...seedData,
        rows: [
          ...seedData.rows,
          ...liveUpdates.rows,
        ],
      },
    });
    const tableFrameWithRetainedRuntime = buildAssetScreenerTableFrame({
      columns: stateWithRetainedRuntime.columns,
      rows: stateWithRetainedRuntime.filteredRows,
      sourceFrame: stateWithRetainedRuntime.sourceFrame,
      sourceColumns: stateWithRetainedRuntime.sourceColumns,
    });

    expect(tableFrameWithRetainedRuntime.rowObjects).toHaveLength(1);
    expect(tableFrameWithRetainedRuntime.rowObjects[0]).toMatchObject({
      Symbol: "BTCUSDT",
      last_price: 109500.12345,
    });

    expect(
      resolveWidgetOutputValue(TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID, {
        props,
        resolvedInputs: {
          seedData: {
            inputId: "seedData",
            label: "Seed data",
            status: "valid",
            sourceWidgetId: "seed-query",
            sourceOutputId: "dataset",
            contractId: "core.tabular_frame@v1",
            upstreamBase: seedData,
          },
          liveUpdates: {
            inputId: "liveUpdates",
            label: "Live updates",
            status: "valid",
            sourceWidgetId: "stream-query",
            sourceOutputId: "updates",
            contractId: "core.tabular_frame@v1",
            upstreamDelta: frame([
              {
                symbol: "ETHUSDT",
                last: 2121,
              },
            ]),
          },
        },
        runtimeState: {
          status: "ready",
          columns: seedData.columns,
          rows: [
            ...seedData.rows,
            ...liveUpdates.rows,
          ],
          source: {
            context: {
              incrementalConsumer: {
                mode: "incremental-tabular-consumer",
                seedFrame: seedData,
                liveFrame: liveUpdates,
              },
            },
          },
          interaction: {
            selection: {
              mode: "single-row",
              selectedRowIndices: [0],
              selectedRowKeys: ['["uid:BTCUSDT"]'],
              activeRowIndex: 0,
              activeRowKey: '["uid:BTCUSDT"]',
              selectedCells: [],
              updatedAtMs: 1,
            },
          },
        },
      }),
    ).toMatchObject({
      assetKey: "uid:BTCUSDT",
      Symbol: "BTCUSDT",
      last_price: 109500.12345,
    });
  });
});
