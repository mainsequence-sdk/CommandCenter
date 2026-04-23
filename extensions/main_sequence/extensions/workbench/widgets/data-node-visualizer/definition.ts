import { BarChart3 } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget, type ResolvedWidgetInputs } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import {
  MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT,
  normalizeMainSequenceDataSourceBundle,
} from "../../widget-contracts/mainSequenceDataSourceBundle";
import { resolveDataNodeFieldOptionsFromDataset } from "../data-node-shared/dataNodeShared";
import { DATA_NODE_SOURCE_INPUT_ID } from "../data-node-shared/widgetBindings";
import { MainSequenceDataNodeVisualizerWidget } from "./MainSequenceDataNodeVisualizerWidget";
import { dataNodeVisualizerWidgetController } from "./controller";
import { MainSequenceDataNodeVisualizerWidgetSettings } from "./MainSequenceDataNodeVisualizerWidgetSettings";
import {
  buildDataNodeVisualizerChartSeries,
  buildDataNodeVisualizerSeries,
  resolveDataNodeVisualizerConfig,
  type MainSequenceDataNodeVisualizerWidgetProps,
} from "./dataNodeVisualizerModel";
import { dataNodeVisualizerSettingsSchema } from "./schema";

function resolveSourceDataset(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  const resolvedEntry = resolvedInputs?.[DATA_NODE_SOURCE_INPUT_ID];
  const candidate = Array.isArray(resolvedEntry)
    ? resolvedEntry.find((entry) => entry.status === "valid")
    : resolvedEntry;

  return candidate?.status === "valid"
    ? normalizeMainSequenceDataSourceBundle(candidate.value)
    : null;
}

export const mainSequenceDataNodeGraphWidget = defineWidget<MainSequenceDataNodeVisualizerWidgetProps>({
  id: "main-sequence-data-node-visualizer",
  widgetVersion: "1.1.0",
  title: "Data Node Graph",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Data Nodes",
  kind: "chart",
  source: "main_sequence_workbench",
  requiredPermissions: ["main_sequence_foundry:view"],
  tags: ["main-sequence", "data-node", "visualization", "tradingview", "table"],
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
        id: DATA_NODE_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
        required: true,
        effects: [
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "xField" },
            description: "Upstream fields populate X-axis choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "schema-field", id: "yField" },
            description: "Upstream fields populate Y-axis choices.",
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
            description: "Incoming rows drive the rendered chart series.",
          },
        ],
      },
    ],
  },
  workspaceIcon: BarChart3,
  workspaceRuntimeMode: "consumer",
  buildAgentSnapshot: ({ props, resolvedInputs, snapshotProfile }) => {
    const sourceDataset = resolveSourceDataset(resolvedInputs);
    const fieldOptions = resolveDataNodeFieldOptionsFromDataset({
      columns: sourceDataset?.columns,
      rows: sourceDataset?.rows,
      fields: sourceDataset?.fields,
    });
    const config = resolveDataNodeVisualizerConfig(props, null, fieldOptions);
    const rawSeries = buildDataNodeVisualizerSeries(sourceDataset?.rows ?? [], config, 12);
    const chartSeries = buildDataNodeVisualizerChartSeries(
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
        : "Data Node Graph is waiting for a bound dataset.",
      data: {
        sourceStatus: sourceDataset?.status ?? "idle",
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
  schema: dataNodeVisualizerSettingsSchema,
  controller: dataNodeVisualizerWidgetController,
  registryContract: {
    configuration: {
      mode: "hybrid",
      summary:
        "Turns a bound Data Node dataset into a chart by selecting X, Y, grouping, provider, chart type, and series behavior.",
      requiredSetupSteps: [
        "Bind the widget to an upstream Data Node dataset.",
        "Choose X and Y fields.",
        "Optionally choose grouping, provider, and chart style settings.",
      ],
      configurationNotes: [
        "The chart provider changes rendering behavior but not the canonical upstream dataset contract.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes the canonical upstream dataset bundle and renders one chart view without owning data execution.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one Main Sequence dataset bundle and derives chart series from the selected fields.",
    },
    capabilities: {
      acceptedContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      supportedProviders: ["tradingview", "echarts"],
      supportedChartTypes: ["line", "area", "bar"],
      supportedTimeAxisModes: ["auto", "date", "datetime"],
      supportedGroupSelectionModes: ["all", "include", "exclude"],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  settingsComponent: MainSequenceDataNodeVisualizerWidgetSettings,
  component: MainSequenceDataNodeVisualizerWidget,
});
