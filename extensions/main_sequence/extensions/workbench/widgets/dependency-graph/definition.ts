import type { WidgetDefinition } from "@/widgets/types";

import {
  MainSequenceDependencyGraphWidget,
  type MainSequenceDependencyGraphWidgetProps,
} from "./MainSequenceDependencyGraphWidget";
import { MainSequenceDependencyGraphWidgetSettings } from "./MainSequenceDependencyGraphWidgetSettings";

export const mainSequenceDependencyGraphWidget: WidgetDefinition<MainSequenceDependencyGraphWidgetProps> = {
  id: "main-sequence-dependency-graph",
  title: "Dependency Graph",
  description: "Main Sequence dependency graph widget for Data Node and Simple Table updates.",
  category: "Main Sequence",
  kind: "chart",
  source: "main_sequence_workbench",
  defaultSize: { w: 6, h: 8 },
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
  component: MainSequenceDependencyGraphWidget,
};
