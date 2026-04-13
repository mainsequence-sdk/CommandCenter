import { Network } from "lucide-react";

import { defineWidget } from "@/widgets/types";

import { MainSequenceProjectInfraGraphWidget } from "./MainSequenceProjectInfraGraphWidget";
import { MainSequenceProjectInfraGraphWidgetSettings } from "./MainSequenceProjectInfraGraphWidgetSettings";
import type { MainSequenceProjectInfraGraphWidgetProps } from "./projectInfraGraphRuntime";

export const mainSequenceProjectInfraGraphWidget = defineWidget<MainSequenceProjectInfraGraphWidgetProps>({
  id: "main-sequence-project-infra-graph",
  widgetVersion: "1.0.0",
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
    agentHints: {
      buildPurpose:
        "Use this widget to inspect infrastructure relationships around one Main Sequence project.",
      whenToUse: [
        "Use when the user needs a project-centric view of resources, jobs, releases, and secrets.",
      ],
      whenNotToUse: [
        "Do not use when the user needs a dependency graph around one data source or a dataset chart.",
      ],
      authoringSteps: [
        "Set the target project id.",
      ],
      blockingRequirements: ["A valid project id is required."],
      commonPitfalls: [
        "This widget is project-scoped and does not accept upstream dataset bindings.",
      ],
    },
  },
  component: MainSequenceProjectInfraGraphWidget,
});
