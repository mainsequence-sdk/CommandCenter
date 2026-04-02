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
  title: "Data Node Graph",
  description: "Turns Main Sequence data-node tables into charts, with a settings-only table preview.",
  category: "DataNodes",
  kind: "chart",
  source: "main_sequence_workbench",
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "visualization", "tradingview", "table"],
  exampleProps: {
    sourceMode: "filter_widget",
    provider: "tradingview",
    chartType: "line",
    dateRangeMode: "dashboard",
  },
  mockProps: {
    sourceMode: "filter_widget",
    provider: "tradingview",
    chartType: "line",
    dateRangeMode: "dashboard",
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
            sourcePath: "availableFields",
            target: { kind: "schema-field", id: "xField" },
            description: "Upstream fields populate X-axis choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "availableFields",
            target: { kind: "schema-field", id: "yField" },
            description: "Upstream fields populate Y-axis choices.",
          },
          {
            kind: "drives-options",
            sourcePath: "availableFields",
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
  railIcon: BarChart3,
  schema: dataNodeVisualizerSettingsSchema,
  controller: dataNodeVisualizerWidgetController,
  settingsComponent: MainSequenceDataNodeVisualizerWidgetSettings,
  component: MainSequenceDataNodeVisualizerWidget,
});
