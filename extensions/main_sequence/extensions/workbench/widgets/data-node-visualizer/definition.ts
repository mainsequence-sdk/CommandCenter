import type { WidgetDefinition } from "@/widgets/types";

import {
  MainSequenceDataNodeVisualizerWidget,
} from "./MainSequenceDataNodeVisualizerWidget";
import {
  MainSequenceDataNodeVisualizerWidgetSettings,
} from "./MainSequenceDataNodeVisualizerWidgetSettings";
import type { MainSequenceDataNodeVisualizerWidgetProps } from "./dataNodeVisualizerModel";

export const mainSequenceDataNodeVisualizerWidget: WidgetDefinition<MainSequenceDataNodeVisualizerWidgetProps> = {
  id: "main-sequence-data-node-visualizer",
  title: "Data Node Visualizer",
  description: "Turns Main Sequence data-node tables into charts or tables.",
  category: "DataNodes",
  kind: "chart",
  source: "main_sequence_workbench",
  defaultSize: { w: 8, h: 7 },
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "visualization", "tradingview", "table"],
  exampleProps: {
    provider: "tradingview",
    chartType: "line",
    dateRangeMode: "dashboard",
    displayMode: "chart",
  },
  settingsComponent: MainSequenceDataNodeVisualizerWidgetSettings,
  component: MainSequenceDataNodeVisualizerWidget,
};
