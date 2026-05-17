/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import type { ResolvedWidgetInputs } from "@/widgets/types";

import {
  buildMarketAssetFrameSemanticMeta,
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

vi.mock("@/dashboards/DashboardWidgetExecution", () => dashboardExecutionMocks);

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

    expect(container.textContent).toContain("1,000 of 1,000 assets");
    expect(tableFrame.rowObjects[0]?.symbol).toBe("SYM0000");
    expect(tableFrame.rowObjects.at(-1)?.symbol).toBe("SYM0999");
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

  it("uses the workspace card title for the in-panel header", () => {
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

    expect(container.textContent).toContain("Global equity monitor");
    expect(container.textContent).not.toContain("Asset Screener");
  });

  it("maps table threshold metadata to table conditional rules", () => {
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
          id: "return",
          kind: "latest-value",
          label: "Return",
          valueField: "price",
          format: "percent",
          width: 96,
          visual: {
            thresholds: [
              { operator: "lt", value: 0, tone: "warning" },
              { operator: "eq", value: 0, tone: "neutral" },
              { operator: "gt", value: 0, tone: "success" },
            ],
            heatmap: true,
            gradientMode: "fill",
            visualRangeMode: "fixed",
            visualMin: -5,
            visualMax: 5,
          },
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
    } satisfies MainSequenceAssetScreenerWidgetProps;

    const seedData = frame([
      {
        unique_identifier: "uid:AAPL",
        Symbol: "AAPL",
        last_price: 1,
      },
      {
        unique_identifier: "uid:MSFT",
        Symbol: "MSFT",
        last_price: -1,
      },
    ]);
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
    const tableProps = buildAssetScreenerResolvedTableProps({
      columns: state.columns,
      density: props.density,
      frame: tableFrame.frame,
      rows: state.filteredRows,
    });

    expect(container.textContent).toContain("2 of 2 assets");
    expect(tableProps.conditionalRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ columnKey: "return", operator: "lt", tone: "warning" }),
        expect.objectContaining({ columnKey: "return", operator: "eq", tone: "neutral" }),
        expect.objectContaining({ columnKey: "return", operator: "gt", tone: "success" }),
      ]),
    );
    expect(tableProps.columnOverrides.return).toMatchObject({
      gradientMode: "fill",
      heatmap: true,
      visualMax: 5,
      visualMin: -5,
      visualRangeMode: "fixed",
    });
  });
});
