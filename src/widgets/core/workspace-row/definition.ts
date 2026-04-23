import { WORKSPACE_ROW_WIDGET_ID } from "@/dashboards/structural-widgets";
import { resolveWidgetDescription, resolveWidgetUsageGuidance } from "@/widgets/shared/widget-usage-guidance";
import { defineWidget } from "@/widgets/types";

import usageGuidanceMarkdown from "./USAGE_GUIDANCE.md?raw";
import { WorkspaceRowWidget, type WorkspaceRowWidgetProps } from "./WorkspaceRowWidget";
import { WorkspaceRowWidgetSettings } from "./WorkspaceRowWidgetSettings";

export const workspaceRowWidget = defineWidget<WorkspaceRowWidgetProps>({
  id: WORKSPACE_ROW_WIDGET_ID,
  widgetVersion: "1.0.0",
  title: "Row",
  description: resolveWidgetDescription(usageGuidanceMarkdown),
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
    usageGuidance: resolveWidgetUsageGuidance(usageGuidanceMarkdown),
  },
  component: WorkspaceRowWidget,
});
