import { BarChart3 } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget, type ResolvedWidgetInputs } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  normalizeTabularFrameSource,
  TABULAR_SOURCE_CONTRACT,
} from "@/widgets/shared/tabular-widget-source";
import {
  CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  timeSeriesFrameToTabularFrameSource,
} from "@/widgets/shared/timeseries-frame-source";
import { resolveTabularFieldOptionsFromDataset } from "@/widgets/shared/tabular-widget-source";
import { TABULAR_SOURCE_INPUT_ID } from "@/widgets/shared/tabular-widget-source";
import { GraphWidget } from "./GraphWidget";
import { graphWidgetController } from "./controller";
import { GraphWidgetSettings } from "./GraphWidgetSettings";
import {
  buildGraphChartSeries,
  buildGraphSeries,
  resolveGraphConfig,
  resolveGraphSourceFieldDefaults,
  type GraphWidgetProps,
} from "./graphModel";
import { graphSettingsSchema } from "./schema";

function resolveSourceDataset(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  const resolvedEntry = resolvedInputs?.[TABULAR_SOURCE_INPUT_ID];
  const candidate = Array.isArray(resolvedEntry)
    ? resolvedEntry.find((entry) => entry.status === "valid")
    : resolvedEntry;

  return candidate?.status === "valid"
    ? normalizeTabularFrameSource(candidate.value) ??
        timeSeriesFrameToTabularFrameSource(candidate.value)
    : null;
}

export const graphWidget = defineWidget<GraphWidgetProps>({
  id: "graph",
  widgetVersion: "2.0.0",
  title: "Graph",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Core",
  kind: "chart",
  source: "core",
  requiredPermissions: ["workspaces:view"],
  tags: ["tabular", "time-series", "visualization", "tradingview", "echarts", "graph", "chart"],
  exampleProps: {
    sourceMode: "filter_widget",
    provider: "tradingview",
    chartType: "line",
    dateRangeMode: "dashboard",
    minBarSpacingPx: 0.01,
  },
  mockProps: {
    sourceMode: "filter_widget",
    provider: "tradingview",
    chartType: "line",
    dateRangeMode: "dashboard",
    minBarSpacingPx: 0.01,
  },
  io: {
    inputs: [
      {
        id: TABULAR_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [
          CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
          TABULAR_SOURCE_CONTRACT,
        ],
        required: true,
        effects: [
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "xField" },
            description: "Upstream fields populate X-axis choices when the source is tabular.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "yField" },
            description: "Upstream fields populate Y-axis choices when the source is tabular.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "groupField" },
            description: "Upstream fields populate grouping choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "rows",
            target: { kind: "schema-field", id: "selectedGroupValues" },
            description: "Distinct upstream group values populate visible-group choices.",
          },
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "chart" },
            description: "Incoming rows or time-series points drive the rendered chart series.",
          },
        ],
      },
    ],
  },
  workspaceIcon: BarChart3,
  workspaceRuntimeMode: "consumer",
  buildAgentSnapshot: ({ props, resolvedInputs, snapshotProfile }) => {
    const sourceDataset = resolveSourceDataset(resolvedInputs);
    const sourceDefaults = resolveGraphSourceFieldDefaults(sourceDataset);
    const fieldOptions = resolveTabularFieldOptionsFromDataset({
      columns: sourceDataset?.columns,
      rows: sourceDataset?.rows,
      fields: sourceDataset?.fields,
    });
    const config = resolveGraphConfig({
      ...props,
      xField: props.xField ?? sourceDefaults.xField,
      yField: props.yField ?? sourceDefaults.yField,
      groupField: props.groupField ?? sourceDefaults.groupField,
    }, null, fieldOptions);
    const rawSeries = buildGraphSeries(sourceDataset?.rows ?? [], config, 12);
    const chartSeries = buildGraphChartSeries(
      rawSeries.series,
      config.timeAxisMode === "date" ? "date" : "datetime",
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
        sourceStatus: sourceDataset?.status ?? "idle",
        sourceContract: sourceDataset?.source?.context?.sourceContract ?? TABULAR_SOURCE_CONTRACT,
        provider: config.provider,
        chartType: config.chartType,
        xField: config.xField,
        yField: config.yField,
        groupField: config.groupField,
        groupSelectionMode: config.groupSelectionMode,
        selectedGroupValues: config.selectedGroupValues ?? [],
        seriesAxisMode: config.seriesAxisMode,
        timeAxisMode: config.timeAxisMode,
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
          points:
            snapshotProfile === "full-data"
              ? series.points
              : series.points.slice(0, 200),
        })),
      },
    };
  },
  schema: graphSettingsSchema,
  controller: graphWidgetController,
  registryContract: {
    configuration: {
      mode: "hybrid",
      summary:
        "Turns a bound time-series frame or tabular dataset into a chart by using declared time-series semantics or selected X, Y, grouping, provider, chart type, and series behavior.",
      requiredSetupSteps: [
        "Bind the widget to an upstream time-series frame or tabular dataset.",
        "For tabular sources, choose X and Y fields.",
        "Optionally choose grouping, provider, and chart style settings.",
      ],
      configurationNotes: [
        "Time-series frames provide default time, value, and series fields through their frame metadata.",
        "The chart provider changes rendering behavior but not the canonical upstream dataset contract.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes the canonical upstream time-series or tabular dataset bundle and renders one chart view without owning data execution.",
    },
    io: {
      mode: "consumer",
      summary:
        "Consumes one time-series frame or tabular frame and derives chart series from declared semantics or selected fields.",
    },
    capabilities: {
      acceptedContracts: [
        CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
        TABULAR_SOURCE_CONTRACT,
      ],
      supportedProviders: ["tradingview", "echarts"],
      supportedChartTypes: ["line", "area", "bar"],
      supportedTimeAxisModes: ["auto", "date", "datetime"],
      supportedGroupSelectionModes: ["all", "include", "exclude"],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: GraphWidgetSettings,
  component: GraphWidget,
});
