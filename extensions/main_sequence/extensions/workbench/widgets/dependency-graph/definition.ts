import type { WidgetDefinition } from "@/widgets/types";

import {
  MainSequenceDependencyGraphWidget,
  type MainSequenceDependencyGraphWidgetProps,
} from "./MainSequenceDependencyGraphWidget";
import { MainSequenceDependencyGraphWidgetSettings } from "./MainSequenceDependencyGraphWidgetSettings";

export const mainSequenceDependencyGraphWidget: WidgetDefinition<MainSequenceDependencyGraphWidgetProps> = {
  id: "main-sequence-dependency-graph",
  title: "Dependency Graph",
  description: "Main Sequence LocalTimeSerie upstream/downstream dependency graph widget.",
  category: "Main Sequence",
  kind: "chart",
  source: "main_sequence_workbench",
  defaultSize: { w: 6, h: 8 },
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "data-node", "dependency", "graph"],
  exampleProps: {
    localTimeSerieId: 716,
    direction: "downstream",
  },
  mockRuntimeState: {
    selectedNodeId: "desk-curve-signal",
  },
  settingsComponent: MainSequenceDependencyGraphWidgetSettings,
  component: MainSequenceDependencyGraphWidget,
};
