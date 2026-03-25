import type { WidgetDefinition } from "@/widgets/types";

import { DataNodeTableWidget } from "./DataNodeTableWidget";
import { DataNodeTableWidgetSettings } from "./DataNodeTableWidgetSettings";
import {
  dataNodeTableVisualizerDefaultProps,
  type DataNodeTableVisualizerProps,
} from "./dataNodeTableModel";

export const mainSequenceDataNodeTableWidget: WidgetDefinition<DataNodeTableVisualizerProps> = {
  id: "data-node-table-visualizer",
  title: "Data Node Table",
  description: "Main Sequence table formatter for live data-node rows with instance-owned field config.",
  category: "DataNodes",
  kind: "table",
  source: "main_sequence_workbench",
  defaultSize: { w: 8, h: 6 },
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "grid", "ag-grid", "formatter", "table"],
  exampleProps: dataNodeTableVisualizerDefaultProps,
  mockProps: dataNodeTableVisualizerDefaultProps,
  settingsComponent: DataNodeTableWidgetSettings,
  component: DataNodeTableWidget,
};
