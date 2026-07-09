import { Network } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";
import { MAIN_SEQUENCE_FOUNDRY_PROJECT_INFRA_GRAPH_WIDGET_ID } from "@/widgets/widget-type-normalization";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { MainSequenceProjectInfraGraphWidget } from "./MainSequenceProjectInfraGraphWidget";
import { MainSequenceProjectInfraGraphWidgetSettings } from "./MainSequenceProjectInfraGraphWidgetSettings";
import type { MainSequenceProjectInfraGraphWidgetProps } from "./projectInfraGraphRuntime";

export const mainSequenceProjectInfraGraphWidget = defineWidget<MainSequenceProjectInfraGraphWidgetProps>({
  id: MAIN_SEQUENCE_FOUNDRY_PROJECT_INFRA_GRAPH_WIDGET_ID,
  widgetVersion: "1.1.0",
  title: "Project Infrastructure Graph",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence Infrastructure",
  kind: "chart",
  source: "main-sequence-foundry",
  defaultSize: { w: 14, h: 10 },
  responsive: {
    minWidthPx: 560,
  },
  requiredPermissions: ["main_sequence_foundry:view"],
  tags: ["main-sequence", "project", "infra", "graph", "resources", "releases"],
  exampleProps: {
    projectUid: "11111111-1111-1111-1111-111111111111",
  },
  mockProps: {
    projectUid: "11111111-1111-1111-1111-111111111111",
  },
  buildAgentSnapshot: ({ props, domTextContent }) => ({
    displayKind: "graph",
    state: domTextContent?.trim() ? "ready" : "idle",
    summary: domTextContent?.trim()
      ? domTextContent.trim().slice(0, 240)
      : "Project Infrastructure Graph is waiting for project graph data.",
    data: {
      widgetRole: "presentation",
      contentType: "graph",
      projectUid: props.projectUid ?? null,
    },
  }),
  settingsComponent: MainSequenceProjectInfraGraphWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: Network,
  workspaceRuntimeMode: "local-ui",
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Configures one project-scoped infrastructure relationship graph around a selected project UID.",
      fields: [
        {
          id: "projectUid",
          label: "Project UID",
          type: "string",
          required: true,
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: ["Select the target project UID to explore."],
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
