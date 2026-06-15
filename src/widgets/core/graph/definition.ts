import { BarChart3 } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget, type ResolvedWidgetInputs } from "@/widgets/types";
import type { RuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import { CORE_GRAPH_WIDGET_ID } from "@/widgets/widget-type-normalization";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  normalizeAnyTabularFrameSource,
  TABULAR_SOURCE_CONTRACT,
} from "@/widgets/shared/tabular-widget-source";
import { resolveTabularFieldOptionsFromDataset } from "@/widgets/shared/tabular-widget-source";
import {
  resolveIncrementalTabularOutputFrame,
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  TABULAR_UPDATES_OUTPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import { TABULAR_SOURCE_INPUT_ID, TABULAR_SOURCE_OUTPUT_ID } from "@/widgets/shared/tabular-widget-source";
import { GraphWidget } from "./GraphWidget";
import { graphWidgetController } from "./controller";
import { GraphWidgetSettings } from "./GraphWidgetSettings";
import {
  buildGraphChartSeries,
  buildGraphSeries,
  resolveGraphConfig,
  resolveGraphDatasetFrame,
  resolveGraphEffectiveTimeAxisMode,
  type GraphWidgetProps,
} from "./graphModel";
import { graphSettingsSchema } from "./schema";

const GRAPH_LIVE_UPDATE_MERGE_KEY_FIELDS: string[] = [];

function resolveSourceDataset(
  input: {
    resolvedInputs: ResolvedWidgetInputs | undefined;
    runtimeState?: Record<string, unknown>;
    runtimeDataStore?: RuntimeDataStore | null;
  },
) {
  const incrementalFrame = resolveIncrementalTabularOutputFrame({
    ...input,
    liveMergeKeyFields: GRAPH_LIVE_UPDATE_MERGE_KEY_FIELDS,
  });

  if (incrementalFrame) {
    return incrementalFrame;
  }

  const resolvedEntry = input.resolvedInputs?.[TABULAR_SOURCE_INPUT_ID];
  const candidate = Array.isArray(resolvedEntry)
    ? resolvedEntry.find((entry) => entry.status === "valid")
    : resolvedEntry;

  return candidate?.status === "valid"
    ? normalizeAnyTabularFrameSource(candidate.upstreamBase ?? candidate.value)
    : null;
}

const graphTabularFieldEffects = [
  {
    kind: "drives-options" as const,
    sourcePath: "fields",
    target: { kind: "schema-field" as const, id: "xField" },
    description: "Upstream fields populate X-axis choices when the source is tabular.",
  },
  {
    kind: "drives-options" as const,
    sourcePath: "fields",
    target: { kind: "schema-field" as const, id: "yField" },
    description: "Upstream fields populate Y-axis choices when the source is tabular.",
  },
  {
    kind: "drives-options" as const,
    sourcePath: "fields",
    target: { kind: "schema-field" as const, id: "groupField" },
    description: "Upstream fields populate grouping choices.",
  },
  {
    kind: "drives-render" as const,
    sourcePath: "rows",
    target: { kind: "render" as const, id: "chart" },
    description: "Incoming rows drive the rendered chart series.",
  },
];

export const graphWidget = defineWidget<GraphWidgetProps>({
  id: CORE_GRAPH_WIDGET_ID,
  widgetVersion: "3.4.0",
  title: "Graph",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "chart",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["tabular", "visualization", "tradingview", "echarts", "graph", "chart"],
  exampleProps: {
    sourceMode: "filter_widget",
    graphSourceMode: "bound",
    provider: "tradingview",
    chartType: "line",
    stackSeries: false,
    dateRangeMode: "dashboard",
    limit: 500,
    maxSeries: 8,
    minBarSpacingPx: 0.01,
    timeQuantization: "auto",
    yAxisScaleZeros: 0,
  },
  mockProps: {
    sourceMode: "filter_widget",
    graphSourceMode: "bound",
    provider: "tradingview",
    chartType: "line",
    stackSeries: false,
    dateRangeMode: "dashboard",
    limit: 500,
    maxSeries: 8,
    minBarSpacingPx: 0.01,
    timeQuantization: "auto",
    yAxisScaleZeros: 0,
  },
  io: {
    inputs: [
      {
        id: TABULAR_SEED_INPUT_ID,
        label: "Seed data",
        accepts: [TABULAR_SOURCE_CONTRACT],
        acceptedOutputIds: [TABULAR_SOURCE_OUTPUT_ID],
        required: false,
        effects: graphTabularFieldEffects,
      },
      {
        id: TABULAR_LIVE_UPDATES_INPUT_ID,
        label: "Live updates",
        accepts: [TABULAR_SOURCE_CONTRACT],
        acceptedOutputIds: [TABULAR_UPDATES_OUTPUT_ID],
        required: false,
        effects: graphTabularFieldEffects,
      },
    ],
  },
  workspaceIcon: BarChart3,
  workspaceRuntimeMode: "consumer",
  buildAgentSnapshot: ({ props, resolvedInputs, runtimeState, runtimeDataStore }) => {
    const sourceDataset = resolveSourceDataset({
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
    });
    const resolvedGraphDataset = resolveGraphDatasetFrame(sourceDataset);
    const fieldOptions = resolveTabularFieldOptionsFromDataset({
      columns: resolvedGraphDataset?.columns,
      rows: resolvedGraphDataset?.rows,
      fields: resolvedGraphDataset?.fields,
    });
    const config = resolveGraphConfig(props, null, fieldOptions);
    const rawSeries = buildGraphSeries(resolvedGraphDataset?.rows ?? [], config);
    const effectiveTimeAxisMode = resolveGraphEffectiveTimeAxisMode(
      config,
      resolvedGraphDataset?.rows ?? [],
    );
    const chartSeries = buildGraphChartSeries(
      rawSeries.series,
      effectiveTimeAxisMode,
      config.provider,
      config.timeQuantization,
    );

    return {
      displayKind: "chart",
      state: resolvedGraphDataset
        ? resolvedGraphDataset.status === "error"
          ? "error"
          : resolvedGraphDataset.status === "loading"
            ? "loading"
            : chartSeries.series.length > 0
              ? "ready"
              : "empty"
        : "idle",
      summary: resolvedGraphDataset
        ? `${chartSeries.series.length.toLocaleString()} series rendered from ${resolvedGraphDataset.rows.length.toLocaleString()} rows.`
        : "Graph is waiting for a bound dataset.",
      data: {
        widgetRole: "presentation",
        contentType: "chart",
        sourceStatus: resolvedGraphDataset?.status ?? "idle",
        sourceContract: resolvedGraphDataset?.source?.context?.sourceContract ?? TABULAR_SOURCE_CONTRACT,
        chartConfig: {
          provider: config.provider,
          chartType: config.chartType,
          stackSeries: config.stackSeries,
          xField: config.xField,
          yField: config.yField,
          groupField: config.groupField,
          seriesAxisMode: config.seriesAxisMode,
          timeAxisMode: config.timeAxisMode,
          timeQuantization: config.timeQuantization,
          yAxisDecimals: config.yAxisDecimals,
          yAxisScaleZeros: config.yAxisScaleZeros,
          yAxisSuffix: config.yAxisSuffix,
        },
        rowCount: resolvedGraphDataset?.rows.length ?? 0,
        seriesCount: chartSeries.series.length,
        droppedGroups: rawSeries.droppedGroups,
        filteredGroups: rawSeries.filteredGroups,
        totalGroups: rawSeries.totalGroups,
        series: chartSeries.series.map((series) => ({
          id: series.id,
          label: series.label,
          color: series.color,
          lineStyle: series.lineStyle,
          pointCount: series.pointCount,
          points: series.points.slice(0, 200),
        })),
      },
    };
  },
  schema: graphSettingsSchema,
  settingsSchemaPlacement: "custom",
  controller: graphWidgetController,
  registryContract: {
    configuration: {
      mode: "hybrid",
      summary:
        "Turns a bound tabular dataset into a chart by using selected X, Y, grouping, provider, chart type, and series behavior, with optional managed connection-source authoring from the Bindings and Connection tabs.",
      requiredSetupSteps: [
        "Use the Bindings tab to either bind an upstream tabular dataset or add a managed connection for this graph.",
        "If you add a managed connection, configure it from the dedicated Connection tab.",
        "Choose X and Y fields.",
        "Optionally choose grouping, provider, chart style, and Y-axis display settings.",
      ],
      configurationNotes: [
        "Bind seedData when this graph needs an initial retained dataset. Bind liveUpdates when this graph should receive incremental publications.",
        "Managed HTTP connections bind the hidden source dataset output to seedData. Managed WebSocket connections bind the hidden source updates output to liveUpdates.",
        "This widget does not infer field mappings from upstream time-series metadata.",
        "For explicit live updates, tail-safe updates use the graph-local rolling queue and delta renderer path. Queue trims, history rewrites, and normalization fall back to snapshot refresh for correctness.",
        "Time axis mode only chooses date versus datetime interpretation. Time quantization is a separate chart-local setting.",
        "ECharts can keep raw millisecond datetime points when Time quantization is Raw. TradingView requires at least 1-second timestamps and quantizes raw datetime streams to 1-second buckets.",
        "Max points per series bounds the graph's rendered series and ref-backed consumer row view; source-side retention still controls how much retained data the upstream source keeps.",
        "When grouping is enabled, Max series limits how many grouped series render at once; remaining groups are dropped deterministically by point count.",
        "Stacked mode is a shared-axis visualization option. ECharts uses native series stacking. TradingView renders the same stacked view through cumulative shared-axis projection because Lightweight Charts does not expose a stack flag.",
        "Y-axis decimals, divide-by-10^N scaling, and suffix are display-only formatting controls. They do not change the underlying dataset values.",
        "The chart provider changes rendering behavior but not the canonical upstream dataset contract.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes the canonical upstream tabular dataset bundle and renders one chart view without owning data execution.",
    },
    io: {
      mode: "consumer",
      summary:
        "Consumes one canonical tabular frame and derives chart series from selected fields.",
    },
    capabilities: {
      acceptedContracts: [TABULAR_SOURCE_CONTRACT],
      supportedProviders: ["tradingview", "echarts"],
      supportedChartTypes: ["line", "area", "bar", "markers"],
      supportedTimeAxisModes: ["auto", "date", "datetime"],
      supportsTimeQuantization: true,
      supportsPointLimit: true,
      supportsMaxSeriesLimit: true,
      supportsStackedSeries: true,
      supportsYAxisValueFormatting: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: GraphWidgetSettings,
  component: GraphWidget,
});
