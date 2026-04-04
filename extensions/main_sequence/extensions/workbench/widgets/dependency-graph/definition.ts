import { defineWidget } from "@/widgets/types";

import { dependencyGraphExecutionDefinition } from "./dependencyGraphExecution";
import {
  MainSequenceDependencyGraphWidget,
} from "./MainSequenceDependencyGraphWidget";
import { MainSequenceDependencyGraphWidgetSettings } from "./MainSequenceDependencyGraphWidgetSettings";
import type { MainSequenceDependencyGraphWidgetProps } from "./dependencyGraphRuntime";

export const mainSequenceDependencyGraphWidget = defineWidget<MainSequenceDependencyGraphWidgetProps>({
  id: "main-sequence-dependency-graph",
  title: "Dependency Graph",
  description: "Main Sequence dependency graph widget for Data Node and Simple Table updates.",
  category: "Main Sequence",
  kind: "chart",
  source: "main_sequence_workbench",
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "simple-table", "dependency", "graph"],
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
  component: MainSequenceDependencyGraphWidget,
});
