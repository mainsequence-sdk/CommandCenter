import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";
import { MAIN_SEQUENCE_FOUNDRY_DEPENDENCY_GRAPH_WIDGET_ID } from "@/widgets/widget-type-normalization";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { dependencyGraphExecutionDefinition } from "./dependencyGraphExecution";
import {
  MainSequenceDependencyGraphWidget,
} from "./MainSequenceDependencyGraphWidget";
import { MainSequenceDependencyGraphWidgetSettings } from "./MainSequenceDependencyGraphWidgetSettings";
import type { MainSequenceDependencyGraphWidgetProps } from "./dependencyGraphRuntime";

export const mainSequenceDependencyGraphWidget = defineWidget<MainSequenceDependencyGraphWidgetProps>({
  id: MAIN_SEQUENCE_FOUNDRY_DEPENDENCY_GRAPH_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Dependency Graph",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Infrastructure",
  kind: "chart",
  source: "main_sequence_workbench",
  requiredPermissions: ["main_sequence_foundry:view"],
  tags: ["main-sequence", "data-node", "dependency", "graph", "workbench"],
  exampleProps: {
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
      dataNodeUid: props.dataNodeUid ?? null,
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
        "Loads one dependency graph around a selected Main Sequence Data Node and direction.",
      fields: [
        {
          id: "dataNodeUid",
          label: "Data Node UID",
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
        "Select a valid Data Node UID.",
        "Choose whether to explore upstream or downstream dependencies.",
      ],
    },
    runtime: {
      refreshPolicy: "allow-refresh",
      executionTriggers: ["dashboard-refresh", "manual-recalculate"],
      executionSummary:
        "Owns dependency-graph fetch execution for the selected Main Sequence Data Node.",
    },
    io: {
      mode: "none",
      summary: "This widget executes its own graph request and does not participate in typed widget bindings.",
    },
    capabilities: {
      supportedSourceKinds: ["data_node"],
      supportedDirections: ["downstream", "upstream"],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: MainSequenceDependencyGraphWidget,
});
