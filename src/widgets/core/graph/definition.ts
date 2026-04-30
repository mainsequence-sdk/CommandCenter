import { BarChart3 } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget, type ResolvedWidgetInputs } from "@/widgets/types";
import type { RuntimeDataStore } from "@/widgets/shared/runtime-data-store";

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
  type GraphWidgetProps,
} from "./graphModel";
import { graphSettingsSchema } from "./schema";

function resolveSourceDataset(
  input: {
    resolvedInputs: ResolvedWidgetInputs | undefined;
    runtimeState?: Record<string, unknown>;
    runtimeDataStore?: RuntimeDataStore | null;
  },
) {
  const incrementalFrame = resolveIncrementalTabularOutputFrame(input);

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
  id: "graph",
  widgetVersion: "3.1.3",
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
    dateRangeMode: "dashboard",
    limit: 500,
    maxSeries: 8,
    minBarSpacingPx: 0.01,
  },
    mockProps: {
      sourceMode: "filter_widget",
      graphSourceMode: "bound",
      provider: "tradingview",
      chartType: "line",
      dateRangeMode: "dashboard",
      limit: 500,
      maxSeries: 8,
      minBarSpacingPx: 0.01,
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
    const fieldOptions = resolveTabularFieldOptionsFromDataset({
      columns: sourceDataset?.columns,
      rows: sourceDataset?.rows,
      fields: sourceDataset?.fields,
    });
    const config = resolveGraphConfig(props, null, fieldOptions);
    const rawSeries = buildGraphSeries(sourceDataset?.rows ?? [], config);
    const chartSeries = buildGraphChartSeries(
      rawSeries.series,
      config.timeAxisMode === "date" ? "date" : "datetime",
      config.provider,
    );

    return {
      displayKind: "chart",
      state: sourceDataset
        ? sourceDataset.status === "error"
          ? "error"
          : sourceDataset.status === "loading"
            ? "loading"
            : chartSeries.series.length > 0
              ? "ready"
              : "empty"
        : "idle",
      summary: sourceDataset
        ? `${chartSeries.series.length.toLocaleString()} series rendered from ${sourceDataset.rows.length.toLocaleString()} rows.`
        : "Graph is waiting for a bound dataset.",
      data: {
        widgetRole: "presentation",
        contentType: "chart",
        sourceStatus: sourceDataset?.status ?? "idle",
        sourceContract: sourceDataset?.source?.context?.sourceContract ?? TABULAR_SOURCE_CONTRACT,
        chartConfig: {
          provider: config.provider,
          chartType: config.chartType,
          xField: config.xField,
          yField: config.yField,
          groupField: config.groupField,
          seriesAxisMode: config.seriesAxisMode,
          timeAxisMode: config.timeAxisMode,
        },
        rowCount: sourceDataset?.rows.length ?? 0,
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
        "Optionally choose grouping, provider, and chart style settings.",
      ],
      configurationNotes: [
        "Bind seedData when this graph needs an initial retained dataset. Bind liveUpdates when this graph should receive incremental publications.",
        "Managed HTTP connections bind the hidden source dataset output to seedData. Managed WebSocket connections bind the hidden source updates output to liveUpdates.",
        "This widget does not infer field mappings from upstream time-series metadata.",
        "For explicit live updates, tail-safe updates use the graph-local rolling queue and delta renderer path. Queue trims, history rewrites, and normalization fall back to snapshot refresh for correctness.",
        "ECharts keeps full millisecond datetime points for high-frequency streams. TradingView collapses same-second datetime points to the latest point in that second.",
        "Max points per series does not trim retained upstream rows; use source-side retention on live stream widgets when the upstream dataset itself should stay bounded.",
        "When grouping is enabled, Max series limits how many grouped series render at once; remaining groups are dropped deterministically by point count.",
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
      supportsPointLimit: true,
      supportsMaxSeriesLimit: true,
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: GraphWidgetSettings,
  component: GraphWidget,
});
