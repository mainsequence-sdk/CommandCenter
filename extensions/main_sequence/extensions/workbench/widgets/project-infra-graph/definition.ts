import { Network } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { MainSequenceProjectInfraGraphWidget } from "./MainSequenceProjectInfraGraphWidget";
import { MainSequenceProjectInfraGraphWidgetSettings } from "./MainSequenceProjectInfraGraphWidgetSettings";
import type { MainSequenceProjectInfraGraphWidgetProps } from "./projectInfraGraphRuntime";

export const mainSequenceProjectInfraGraphWidget = defineWidget<MainSequenceProjectInfraGraphWidgetProps>({
  id: "main-sequence-project-infra-graph",
  title: "Project Infrastructure Graph",
  description:
    "Explores project infrastructure relationships across resources, jobs, images, releases, updates, and secrets.",
  category: "Main Sequence Infrastructure",
  kind: "chart",
  source: "main_sequence_workbench",
  defaultSize: { w: 14, h: 10 },
  responsive: {
    minWidthPx: 560,
  },
  requiredPermissions: ["dashboard:view"],
  tags: ["main-sequence", "project", "infra", "graph", "resources", "releases"],
  exampleProps: {
    projectId: 81,
  },
  mockProps: {
    projectId: 81,
  },
  settingsComponent: MainSequenceProjectInfraGraphWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: Network,
  workspaceRuntimeMode: "local-ui",
  component: MainSequenceProjectInfraGraphWidget,
});
