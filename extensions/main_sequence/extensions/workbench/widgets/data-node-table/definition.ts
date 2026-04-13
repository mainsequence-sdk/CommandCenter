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
  widgetVersion: "1.0.0",
  title: "Data Node Table",
  description: "Main Sequence table formatter for live data-node rows with instance-owned field config.",
  category: "Main Sequence Data Nodes",
  kind: "table",
  source: "main_sequence_workbench",
  requiredPermissions: ["main_sequence_foundry:view"],
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
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Formats a linked Data Node dataset into a user-facing table with saved field formatting and visibility preferences.",
      requiredSetupSteps: [
        "Bind the widget to one upstream Data Node dataset.",
        "Adjust visible fields and formatting options in settings.",
      ],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Consumes the canonical upstream dataset bundle and renders it as a formatted table without owning execution.",
    },
    io: {
      mode: "consumer",
      summary: "Consumes one Main Sequence dataset bundle and renders its rows as a table.",
      ioNotes: [
        "The widget does not publish a new canonical runtime contract.",
      ],
    },
    capabilities: {
      acceptedContracts: [MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT],
      renderingSurface: "table",
    },
    agentHints: {
      buildPurpose:
        "Use this widget to show a bound Data Node dataset as a formatted interactive table.",
      whenToUse: [
        "Use when users need row-level inspection, sorting, and table-style presentation of a Data Node output.",
      ],
      whenNotToUse: [
        "Do not use when the widget must own data loading or transformation.",
      ],
      authoringSteps: [
        "Bind the widget to an upstream Data Node dataset.",
        "Configure table presentation and field visibility.",
      ],
      blockingRequirements: ["An upstream Data Node dataset binding is required."],
      commonPitfalls: [
        "This widget will stay empty until it is bound to a compatible Data Node source.",
      ],
    },
  },
  settingsComponent: DataNodeTableWidgetSettings,
  component: DataNodeTableWidget,
});
