import { WORKSPACE_ROW_WIDGET_ID } from "@/dashboards/structural-widgets";
import type { WidgetDefinition } from "@/widgets/types";

import { WorkspaceRowWidget, type WorkspaceRowWidgetProps } from "./WorkspaceRowWidget";
import { WorkspaceRowWidgetSettings } from "./WorkspaceRowWidgetSettings";

export const workspaceRowWidget: WidgetDefinition<WorkspaceRowWidgetProps> = {
  id: WORKSPACE_ROW_WIDGET_ID,
  title: "Row",
  description:
    "Workspace structural divider that splits the canvas into horizontal bands. Widgets stay fully above or below it.",
  category: "Workspace",
  kind: "custom",
  source: "core",
  defaultSize: { w: 12, h: 1 },
  requiredPermissions: ["dashboard:view"],
  tags: ["layout", "divider", "workspace", "row"],
  exampleProps: {
    showHeader: false,
    visible: false,
  },
  mockProps: {
    showHeader: false,
    visible: false,
  },
  settingsComponent: WorkspaceRowWidgetSettings,
  component: WorkspaceRowWidget,
};
