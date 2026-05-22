import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
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
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Infrastructure",
  kind: "chart",
  source: "main_sequence_workbench",
  requiredPermissions: ["main_sequence_foundry:view"],
  tags: ["main-sequence", "simple-table", "dependency", "graph", "workbench"],
  exampleProps: {
    sourceKind: "data_node",
    dataNodeUid: "00000000-0000-0000-0000-000000000714",
    direction: "downstream",
  },
  mockRuntimeState: {
    selectedNodeId: "desk-curve-signal",
  },
  buildAgentSnapshot: ({ props, runtimeState, domTextContent }) => ({
    displayKind: "graph",
    state: domTextContent?.trim()
      ? "ready"
      : runtimeState
        ? "loading"
        : "idle",
    summary: domTextContent?.trim()
      ? domTextContent.trim().slice(0, 240)
      : "Dependency Graph is waiting for graph data.",
    data: {
      widgetRole: "presentation",
      contentType: "graph",
      sourceKind: props.sourceKind ?? null,
      dataNodeUid: props.dataNodeUid ?? null,
      simpleTableUpdateUid: props.simpleTableUpdateUid ?? null,
      direction: props.direction ?? null,
    },
  }),
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
          id: "dataNodeUid",
          label: "Data Node UID",
          type: "string",
          source: "custom-settings",
        },
        {
          id: "simpleTableUpdateUid",
          label: "Simple table update UID",
          type: "string",
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
        "Select the source kind and valid resource UID.",
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
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: MainSequenceDependencyGraphWidget,
});
