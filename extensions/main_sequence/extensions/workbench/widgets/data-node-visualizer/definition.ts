import { BarChart3 } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { MainSequenceDataNodeVisualizerWidget } from "./MainSequenceDataNodeVisualizerWidget";
import { dataNodeVisualizerWidgetController } from "./controller";
import { MainSequenceDataNodeVisualizerWidgetSettings } from "./MainSequenceDataNodeVisualizerWidgetSettings";
import type { MainSequenceDataNodeVisualizerWidgetProps } from "./dataNodeVisualizerModel";
import { dataNodeVisualizerSettingsSchema } from "./schema";
import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../widget-contracts/mainSequenceDataSourceBundle";
import { DATA_NODE_SOURCE_INPUT_ID } from "../data-node-shared/widgetBindings";

export const mainSequenceDataNodeGraphWidget = defineWidget<MainSequenceDataNodeVisualizerWidgetProps>({
  id: "main-sequence-data-node-visualizer",
  widgetVersion: "1.0.0",
  title: "Data Node Graph",
  description: "Turns Main Sequence data-node tables into charts, with a settings-only table preview.",
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
    agentHints: {
      buildPurpose:
        "Use this widget to chart a bound Data Node dataset over time or another selected X-axis field.",
      whenToUse: [
        "Use when a Data Node dataset should be rendered as a line, area, or bar chart.",
      ],
      whenNotToUse: [
        "Do not use when the widget should own the source data query or transform pipeline.",
      ],
      authoringSteps: [
        "Bind the widget to a Data Node dataset.",
        "Choose X and Y fields that match the intended chart.",
        "Select provider, chart type, and grouping behavior as needed.",
      ],
      blockingRequirements: [
        "A compatible upstream Data Node binding is required before field selectors become meaningful.",
      ],
      commonPitfalls: [
        "Ambiguous date strings can make the inferred time axis behave unexpectedly.",
      ],
    },
  },
  settingsComponent: MainSequenceDataNodeVisualizerWidgetSettings,
  component: MainSequenceDataNodeVisualizerWidget,
});
