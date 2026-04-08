import { WORKSPACE_ROW_WIDGET_ID } from "@/dashboards/structural-widgets";
import { defineWidget } from "@/widgets/types";

import { WorkspaceRowWidget, type WorkspaceRowWidgetProps } from "./WorkspaceRowWidget";
import { WorkspaceRowWidgetSettings } from "./WorkspaceRowWidgetSettings";

export const workspaceRowWidget = defineWidget<WorkspaceRowWidgetProps>({
  id: WORKSPACE_ROW_WIDGET_ID,
  title: "Row",
  description:
    "Workspace row header that can collapse or expand the following sibling widgets.",
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
  component: WorkspaceRowWidget,
});
