import { defineWidget } from "@/widgets/types";

import { dependencyGraphExecutionDefinition } from "./dependencyGraphExecution";
import {
  MainSequenceDependencyGraphWidget,
} from "./MainSequenceDependencyGraphWidget";
import { MainSequenceDependencyGraphWidgetSettings } from "./MainSequenceDependencyGraphWidgetSettings";
import type { MainSequenceDependencyGraphWidgetProps } from "./dependencyGraphRuntime";

export const mainSequenceDependencyGraphWidget = defineWidget<MainSequenceDependencyGraphWidgetProps>({
  id: "main-sequence-dependency-graph",
  widgetVersion: "1.0.0",
  title: "Dependency Graph",
  description: "Main Sequence dependency graph widget for update relationships across platform resources.",
  category: "Main Sequence Infrastructure",
  kind: "chart",
  source: "main_sequence_workbench",
  requiredPermissions: ["main_sequence_foundry:view"],
  tags: ["main-sequence", "simple-table", "dependency", "graph", "workbench"],
  exampleProps: {
    sourceKind: "data_node",
    dataNodeId: 714,
    direction: "downstream",
  },
  mockRuntimeState: {
    selectedNodeId: "desk-curve-signal",
  },
  settingsComponent: MainSequenceDependencyGraphWidgetSettings,
  execution: dependencyGraphExecutionDefinition,
  workspaceRuntimeMode: "execution-owner",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Loads one dependency graph around a selected Main Sequence source resource and direction.",
      fields: [
        {
          id: "sourceKind",
          label: "Source kind",
          type: "enum",
          required: true,
          source: "custom-settings",
        },
        {
          id: "dataNodeId",
          label: "Data Node id",
          type: "integer",
          source: "custom-settings",
        },
        {
          id: "simpleTableUpdateId",
          label: "Simple table id",
          type: "integer",
          source: "custom-settings",
        },
        {
          id: "direction",
          label: "Direction",
          type: "enum",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: [
        "Select the source kind and valid resource id.",
        "Choose whether to explore upstream or downstream dependencies.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate"],
      executionSummary:
        "Owns dependency-graph fetch execution for the selected Main Sequence source resource.",
    },
    io: {
      mode: "none",
      summary: "This widget executes its own graph request and does not participate in typed widget bindings.",
    },
    capabilities: {
      supportedSourceKinds: ["data_node", "simple_table"],
      supportedDirections: ["downstream", "upstream"],
    },
    agentHints: {
      buildPurpose:
        "Use this widget to explore dependency relationships around one Main Sequence source resource.",
      whenToUse: [
        "Use when the user needs to inspect upstream or downstream update relationships.",
      ],
      whenNotToUse: [
        "Do not use when the goal is to visualize a tabular Data Node dataset or time series chart.",
      ],
      authoringSteps: [
        "Pick the source kind and source id.",
        "Choose the graph direction to explore.",
      ],
      blockingRequirements: ["A valid source resource id is required."],
      commonPitfalls: [
        "The selected source kind determines which id field is relevant.",
      ],
    },
  },
  component: MainSequenceDependencyGraphWidget,
});
