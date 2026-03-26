import type { WidgetDefinition } from "@/widgets/types";

import { MainSequenceDataNodeVisualizerWidget } from "./MainSequenceDataNodeVisualizerWidget";
import { dataNodeVisualizerWidgetController } from "./controller";
import { MainSequenceDataNodeVisualizerWidgetSettings } from "./MainSequenceDataNodeVisualizerWidgetSettings";
import type { MainSequenceDataNodeVisualizerWidgetProps } from "./dataNodeVisualizerModel";
import { dataNodeVisualizerSettingsSchema } from "./schema";

export const mainSequenceDataNodeGraphWidget: WidgetDefinition<MainSequenceDataNodeVisualizerWidgetProps> = {
  id: "main-sequence-data-node-visualizer",
  title: "Data Node Graph",
  description: "Turns Main Sequence data-node tables into charts, with a settings-only table preview.",
  category: "DataNodes",
  kind: "chart",
  source: "main_sequence_workbench",
  defaultSize: { w: 8, h: 7 },
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
  schema: dataNodeVisualizerSettingsSchema,
  controller: dataNodeVisualizerWidgetController,
  settingsComponent: MainSequenceDataNodeVisualizerWidgetSettings,
  component: MainSequenceDataNodeVisualizerWidget,
};
