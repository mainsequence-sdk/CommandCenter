import { describe, expect, it } from "vitest";

import type { DashboardWidgetInstance } from "@/dashboards/types";
import { createDashboardWidgetDependencyModel } from "@/dashboards/widget-dependencies";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  attachWidgetRuntimeUpdateContext,
  WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
} from "@/widgets/shared/runtime-update";
import { defineWidget, type ResolvedWidgetInputs, type WidgetDefinition } from "@/widgets/types";

import {
  assetScreenerDefaultProps,
  resolveAssetScreenerState,
} from "./assetScreenerModel";
import {
  MARKET_ASSET_SCREENER_HISTORY_INPUT_ID,
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID,
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

function assetScreenerInstance(
  bindings: DashboardWidgetInstance["bindings"],
): DashboardWidgetInstance {
  return {
    id: "asset-screener-1",
    widgetId: mainSequenceAssetScreenerWidget.id,
    title: "Asset Screener",
    props: {
      ...assetScreenerDefaultProps,
      fieldMappings: {
        seed: {
          assetKeyField: "asset_id",
          symbolField: "symbol",
          sectorField: "sector",
          observedAtField: "time",
          valueFields: {
            price: "last_price",
          },
        },
        reference: {
          assetKeyField: "asset_id",
          referenceKeyField: "reference_key",
          observedAtField: "observed_at",
          valueFields: {
            price: "close",
          },
        },
        live: {
          assetKeyField: "asset_id",
          observedAtField: "time",
          valueFields: {
            price: "last_price",
          },
        },
        history: {
          assetKeyField: "asset_id",
          symbolField: "symbol",
          observedAtField: "observed_at",
          valueFields: {
            price: "close",
          },
        },
      },
    },
    bindings,
    layout: { w: 14, h: 8 },
  };
}

describe("assetScreenerModel", () => {
  it("derives configured rows from fallback seed, reference, and live frames", () => {
    const state = resolveAssetScreenerState({
      props: {
        ...assetScreenerDefaultProps,
        fieldMappings: {
          seed: {
            assetKeyField: "asset_id",
            symbolField: "symbol",
            sectorField: "sector",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
            },
          },
          reference: {
            assetKeyField: "asset_id",
            referenceKeyField: "reference_key",
            observedAtField: "observed_at",
            valueFields: {
              price: "close",
            },
          },
          live: {
            assetKeyField: "asset_id",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
            },
          },
        },
      },
      fallbackFrames: {
        seedData: frame([
          {
            asset_id: "asset:AAPL",
            symbol: "AAPL",
            sector: "Technology",
            time: "2026-05-16T12:00:00.000Z",
            last_price: 101,
          },
        ]),
        referenceData: frame([
          {
            asset_id: "asset:AAPL",
            reference_key: "previousClose",
            observed_at: "2026-05-15T20:00:00.000Z",
            close: 100,
          },
        ]),
        liveUpdates: frame([
          {
            asset_id: "asset:AAPL",
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
            assetKeyField: "asset_id",
            symbolField: "symbol",
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
            asset_id: "asset:AAPL",
            symbol: "AAPL",
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

  it("resolves a refresh-only workspace from generic dataset outputs", () => {
    const widgets: DashboardWidgetInstance[] = [
      {
        id: "latest-query",
        widgetId: genericDatasetSourceWidget.id,
        title: "Latest query",
        props: {
          frame: frame([
            {
              asset_id: "asset:AAPL",
              symbol: "AAPL",
              sector: "Technology",
              time: "2026-05-16T12:00:00.000Z",
              last_price: 101,
            },
          ]),
        },
        layout: { w: 4, h: 3 },
      },
      {
        id: "reference-query",
        widgetId: genericDatasetSourceWidget.id,
        title: "Reference query",
        props: {
          frame: frame([
            {
              asset_id: "asset:AAPL",
              reference_key: "previousClose",
              observed_at: "2026-05-15T20:00:00.000Z",
              close: 100,
            },
          ]),
        },
        layout: { w: 4, h: 3 },
      },
      {
        id: "history-query",
        widgetId: genericDatasetSourceWidget.id,
        title: "History query",
        props: {
          frame: frame([
            {
              asset_id: "asset:AAPL",
              symbol: "AAPL",
              observed_at: "2026-05-13T20:00:00.000Z",
              close: 98,
            },
            {
              asset_id: "asset:AAPL",
              symbol: "AAPL",
              observed_at: "2026-05-14T20:00:00.000Z",
              close: 99,
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
        [MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID]: {
          sourceWidgetId: "reference-query",
          sourceOutputId: "dataset",
        },
        [MARKET_ASSET_SCREENER_HISTORY_INPUT_ID]: {
          sourceWidgetId: "history-query",
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
    expect(singleInput(resolvedInputs, MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID)).toMatchObject({
      status: "valid",
      sourceWidgetId: "reference-query",
      sourceOutputId: "dataset",
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    });
    expect(singleInput(resolvedInputs, MARKET_ASSET_SCREENER_HISTORY_INPUT_ID)).toMatchObject({
      status: "valid",
      sourceWidgetId: "history-query",
      sourceOutputId: "dataset",
      contractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    });

    const state = resolveAssetScreenerState({
      props: widgets[3]?.props ?? {},
      resolvedInputs,
    });

    expect(state.sourceStatuses).toMatchObject({
      seed: "valid",
      reference: "valid",
      history: "valid",
    });
    expect(state.filteredRows[0]?.history).toHaveLength(2);
    expect(state.filteredRows[0]?.metrics).toMatchObject({
      symbol: "AAPL",
      last: 101,
    });
    expect(state.filteredRows[0]?.metrics.pct).toBeCloseTo(1);
  });

  it("resolves a live workspace from a generic stream updates output", () => {
    const liveBase = frame([
      {
        asset_id: "asset:AAPL",
        time: "2026-05-16T12:00:00.000Z",
        last_price: 101,
      },
    ]);
    const liveDelta = frame([
      {
        asset_id: "asset:AAPL",
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
          frame: frame([
            {
              asset_id: "asset:AAPL",
              symbol: "AAPL",
              sector: "Technology",
              time: "2026-05-16T12:00:00.000Z",
              last_price: 101,
            },
          ]),
        },
        layout: { w: 4, h: 3 },
      },
      {
        id: "reference-query",
        widgetId: genericDatasetSourceWidget.id,
        title: "Reference query",
        props: {
          frame: frame([
            {
              asset_id: "asset:AAPL",
              reference_key: "previousClose",
              observed_at: "2026-05-15T20:00:00.000Z",
              close: 100,
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
        [MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID]: {
          sourceWidgetId: "reference-query",
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
      props: widgets[3]?.props ?? {},
      resolvedInputs,
    });

    expect(state.sourceStatuses.live).toBe("valid");
    expect(state.filteredRows[0]?.metrics).toMatchObject({
      symbol: "AAPL",
      last: 104,
    });
    expect(state.filteredRows[0]?.metrics.pct).toBeCloseTo(4);
  });

  it("recalculates against refreshed reference data while keeping the live binding stable", () => {
    function buildWorkspace(referenceClose: number) {
      const liveBase = frame([
        {
          asset_id: "asset:AAPL",
          time: "2026-05-16T12:00:00.000Z",
          last_price: 101,
        },
      ]);
      const liveDelta = frame([
        {
          asset_id: "asset:AAPL",
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
            frame: frame([
              {
                asset_id: "asset:AAPL",
                symbol: "AAPL",
                sector: "Technology",
                time: "2026-05-16T12:00:00.000Z",
                last_price: 101,
              },
            ]),
          },
          layout: { w: 4, h: 3 },
        },
        {
          id: "reference-query",
          widgetId: genericDatasetSourceWidget.id,
          title: "Reference query",
          props: {
            frame: frame([
              {
                asset_id: "asset:AAPL",
                reference_key: "previousClose",
                observed_at: "2026-05-15T20:00:00.000Z",
                close: referenceClose,
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
          [MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID]: {
            sourceWidgetId: "reference-query",
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
      props: firstWidgets[3]?.props ?? {},
      resolvedInputs: firstInputs,
    });
    const refreshedWidgets = buildWorkspace(80);
    const refreshedInputs = createDashboardWidgetDependencyModel(
      refreshedWidgets,
      resolveWidgetDefinition,
    ).resolveInputs("asset-screener-1");
    const refreshedState = resolveAssetScreenerState({
      props: refreshedWidgets[3]?.props ?? {},
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
      props: {
        ...assetScreenerDefaultProps,
        fieldMappings: {
          seed: {
            assetKeyField: "asset_id",
            symbolField: "symbol",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
            },
          },
        },
      },
      fallbackFrames: {
        seedData: frame([
          {
            asset_id: "asset:AAPL",
            symbol: "AAPL",
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

  it("caps large universes before rendering so settings previews stay bounded", () => {
    const rows = Array.from({ length: 2_000 }, (_, index) => ({
      asset_id: `asset:${index}`,
      symbol: `SYM${index.toString().padStart(4, "0")}`,
      time: "2026-05-16T12:00:00.000Z",
      last_price: 100 + index,
    }));
    const state = resolveAssetScreenerState({
      props: {
        ...assetScreenerDefaultProps,
        maxRenderedRows: 250,
        groupBy: undefined,
        fieldMappings: {
          seed: {
            assetKeyField: "asset_id",
            symbolField: "symbol",
            observedAtField: "time",
            valueFields: {
              price: "last_price",
            },
          },
        },
      },
      fallbackFrames: {
        seedData: frame(rows),
      },
    });

    expect(state.rows).toHaveLength(2_000);
    expect(state.filteredRows).toHaveLength(250);
    expect(state.filteredRows[0]?.metrics.symbol).toBe("SYM0000");
  });
});
