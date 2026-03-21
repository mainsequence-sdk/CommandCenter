import { DataNodeTableVisualizerWidget } from "@/widgets/extensions/data-node-table-visualizer/DataNodeTableVisualizerWidget";
import type { WidgetDefinition } from "@/widgets/types";

import { DataNodeTableVisualizerWidgetSettings } from "./DataNodeTableVisualizerWidgetSettings";
import {
  dataNodeTableVisualizerDefaultProps,
  type DataNodeTableVisualizerProps,
} from "./data-node-table-visualizer-model";

export const dataNodeTableVisualizerWidget: WidgetDefinition<DataNodeTableVisualizerProps> = {
  id: "data-node-table-visualizer",
  title: "data-node-table visualizer",
  description: "Flow Lab-owned table formatter that consumes columns[] + rows[][] with instance-owned field config.",
  category: "Execution",
  kind: "table",
  source: "flow-lab",
  defaultSize: { w: 8, h: 6 },
  requiredPermissions: ["portfolio:read"],
  tags: ["grid", "ag-grid", "formatter", "heatmap", "positions", "extension"],
  exampleProps: dataNodeTableVisualizerDefaultProps,
  mockProps: dataNodeTableVisualizerDefaultProps,
  settingsComponent: DataNodeTableVisualizerWidgetSettings,
  component: DataNodeTableVisualizerWidget,
};
