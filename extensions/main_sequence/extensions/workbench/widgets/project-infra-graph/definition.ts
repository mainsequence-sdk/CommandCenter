import { Network } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { MainSequenceProjectInfraGraphWidget } from "./MainSequenceProjectInfraGraphWidget";
import { MainSequenceProjectInfraGraphWidgetSettings } from "./MainSequenceProjectInfraGraphWidgetSettings";
import type { MainSequenceProjectInfraGraphWidgetProps } from "./projectInfraGraphRuntime";

export const mainSequenceProjectInfraGraphWidget = defineWidget<MainSequenceProjectInfraGraphWidgetProps>({
  id: "main-sequence-project-infra-graph",
  widgetVersion: "1.0.0",
  title: "Project Infrastructure Graph",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Infrastructure",
  kind: "chart",
  source: "main_sequence_workbench",
  defaultSize: { w: 14, h: 10 },
  responsive: {
    minWidthPx: 560,
  },
  requiredPermissions: ["main_sequence_foundry:view"],
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
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Configures one project-scoped infrastructure relationship graph around a selected project id.",
      fields: [
        {
          id: "projectId",
          label: "Project id",
          type: "integer",
          required: true,
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: ["Select the target project id to explore."],
    },
    io: {
      mode: "none",
      summary: "This widget owns its own project graph query lifecycle and does not use typed widget IO.",
    },
    capabilities: {
      renderingModel: "project-centered-infra-graph",
      supportedVariants: ["widget", "page"],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: MainSequenceProjectInfraGraphWidget,
});
