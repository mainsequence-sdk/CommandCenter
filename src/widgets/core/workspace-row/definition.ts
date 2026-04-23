import { WORKSPACE_ROW_WIDGET_ID } from "@/dashboards/structural-widgets";
import { resolveWidgetDescription } from "@/widgets/shared/widget-description";
import { defineWidget } from "@/widgets/types";

import descriptionMarkdown from "./DESCRIPTION.md?raw";
import { WorkspaceRowWidget, type WorkspaceRowWidgetProps } from "./WorkspaceRowWidget";
import { WorkspaceRowWidgetSettings } from "./WorkspaceRowWidgetSettings";

export const workspaceRowWidget = defineWidget<WorkspaceRowWidgetProps>({
  id: WORKSPACE_ROW_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Row",
  description: resolveWidgetDescription(descriptionMarkdown),
  category: "Core",
  kind: "custom",
  source: "core",
  defaultSize: { w: 12, h: 2 },
  requiredPermissions: ["workspaces:view"],
  tags: ["layout", "workspace", "row", "collapse", "group"],
  exampleProps: {
    color: undefined,
  },
  mockProps: {
    color: undefined,
  },
  settingsComponent: WorkspaceRowWidgetSettings,
  registryContract: {
    configuration: {
      mode: "custom-settings",
      summary: "Defines a structural row header used to group and collapse workspace siblings.",
      fields: [
        {
          id: "color",
          label: "Row color",
          type: "color",
          source: "custom-settings",
        },
      ],
      requiredSetupSteps: ["Place the row above the widgets it should visually group."],
    },
    io: {
      mode: "none",
      summary: "This widget is structural only and does not participate in typed IO.",
    },
    agentHints: {
      buildPurpose:
        "Use this widget to create labeled row groupings and collapse sections in a workspace layout.",
      whenToUse: [
        "Use when related widgets should be visually grouped under a collapsible row heading.",
      ],
      whenNotToUse: [
        "Do not use when the widget needs to render data or participate in execution.",
      ],
      authoringSteps: [
        "Insert the row above the widgets it should own.",
        "Set a title and optional accent color.",
      ],
      blockingRequirements: [],
      commonPitfalls: [
        "The row is a layout control, not a data container or execution node.",
      ],
    },
  },
  component: WorkspaceRowWidget,
});
