import { LayoutTemplate } from "lucide-react";

import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { WorkspaceReferenceRailSummary } from "./WorkspaceReferenceRailSummary";
import { WorkspaceWidget } from "./WorkspaceWidget";
import { WorkspaceWidgetSettings } from "./WorkspaceWidgetSettings";
import {
  MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT,
  WORKSPACE_REFERENCE_OUTPUT_ID,
  WORKSPACE_REFERENCE_OUTPUT_LABEL,
  WORKSPACE_REFERENCE_VALUE_DESCRIPTOR,
  resolveWorkspaceReferenceOutputValue,
  type WorkspaceWidgetProps,
} from "./workspaceReference";

export const WORKSPACE_WIDGET_ID = "main-sequence-ai-workspace";

export const workspaceWidget = defineWidget<WorkspaceWidgetProps>({
  id: WORKSPACE_WIDGET_ID,
  widgetVersion: "1.1.0",
  title: "Workspace",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
  category: "Main Sequence AI",
  kind: "custom",
  source: "main_sequence_ai",
  defaultSize: { w: 8, h: 6 },
  defaultPresentation: {
    placementMode: "sidebar",
  },
  responsive: {
    minWidthPx: 360,
  },
  requiredPermissions: ["workspaces:view"],
  tags: ["workspace", "reference", "agents", "binding"],
  exampleProps: {
    workspaceId: "workspace-123",
  },
  mockProps: {},
  io: {
    outputs: [{
      id: WORKSPACE_REFERENCE_OUTPUT_ID,
      label: WORKSPACE_REFERENCE_OUTPUT_LABEL,
      contract: MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT,
      description:
        "Selected workspace reference published as a minimal object with only the workspace id.",
      valueDescriptor: WORKSPACE_REFERENCE_VALUE_DESCRIPTOR,
      resolveValue: ({ runtimeState }) => resolveWorkspaceReferenceOutputValue(runtimeState),
    }],
  },
  settingsComponent: WorkspaceWidgetSettings,
  showRawPropsEditor: false,
  workspaceIcon: LayoutTemplate,
  railSummaryComponent: WorkspaceReferenceRailSummary,
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary:
        "Stores one selected workspace id and publishes that id as a bindable workspace reference object.",
      fields: [
        {
          id: "workspaceId",
          label: "Workspace id",
          type: "workspace-ref",
          required: true,
          source: "custom-settings",
          description:
            "Selected target workspace. The current workspace is excluded from the picker and cannot be selected.",
        },
      ],
      requiredSetupSteps: ["Select one target workspace in settings."],
    },
    runtime: {
      refreshPolicy: "not-applicable",
      executionTriggers: [],
      executionSummary:
        "Resolves the selected workspace against the accessible workspace list and publishes a minimal reference object only when the selection is valid and not self-referential.",
    },
    io: {
      mode: "static",
      summary:
        "Publishes one workspace reference object containing only the selected workspace id.",
    },
    capabilities: {
      publishedContracts: [MAIN_SEQUENCE_AI_WORKSPACE_REFERENCE_CONTRACT],
    },
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
    examples: [
      {
        label: "Workspace handoff",
        summary:
          "Publish one saved workspace id so an Agent Terminal can reference that workspace explicitly during automated refresh.",
        props: {
          workspaceId: "workspace-123",
        },
      },
    ],
  },
  component: WorkspaceWidget,
});
