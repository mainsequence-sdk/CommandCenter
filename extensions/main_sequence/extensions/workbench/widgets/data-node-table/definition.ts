import { Table } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { DataNodeTableWidget } from "./DataNodeTableWidget";
import { DataNodeTableWidgetSettings } from "./DataNodeTableWidgetSettings";
import {
  dataNodeTableVisualizerDefaultProps,
  type DataNodeTableVisualizerProps,
} from "./dataNodeTableModel";

export const mainSequenceDataNodeTableWidget = defineWidget<DataNodeTableVisualizerProps>({
  id: "data-node-table-visualizer",
  title: "Data Node Table",
  description: "Main Sequence table formatter for live data-node rows with instance-owned field config.",
  category: "DataNodes",
  kind: "table",
  source: "main_sequence_workbench",
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "grid", "ag-grid", "formatter", "table"],
  exampleProps: dataNodeTableVisualizerDefaultProps,
  mockProps: dataNodeTableVisualizerDefaultProps,
  railIcon: Table,
  settingsComponent: DataNodeTableWidgetSettings,
  component: DataNodeTableWidget,
});
