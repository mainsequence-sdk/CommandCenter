import { Table } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT } from "../../widget-contracts/mainSequenceDataSourceBundle";
import { DATA_NODE_SOURCE_INPUT_ID } from "../data-node-shared/widgetBindings";
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
  category: "Main Sequence Data Nodes",
  kind: "table",
  source: "main_sequence_workbench",
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "grid", "ag-grid", "formatter", "table"],
  exampleProps: dataNodeTableVisualizerDefaultProps,
  mockProps: dataNodeTableVisualizerDefaultProps,
  io: {
    inputs: [
      {
        id: DATA_NODE_SOURCE_INPUT_ID,
        label: "Source data",
        accepts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
        required: true,
        effects: [
          {
            kind: "drives-render",
            sourcePath: "rows",
            target: { kind: "render", id: "table" },
            description: "Incoming rows drive the rendered table frame.",
          },
          {
            kind: "drives-options",
            sourcePath: "fields",
            target: { kind: "render", id: "schema" },
            description: "Upstream fields define the table schema and formatter choices.",
          },
        ],
      },
    ],
  },
  workspaceRuntimeMode: "consumer",
  workspaceIcon: Table,
  settingsComponent: DataNodeTableWidgetSettings,
  component: DataNodeTableWidget,
});
