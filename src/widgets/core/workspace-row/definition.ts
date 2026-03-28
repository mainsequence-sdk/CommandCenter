import { WORKSPACE_ROW_WIDGET_ID } from "@/dashboards/structural-widgets";
import type { WidgetDefinition } from "@/widgets/types";

import { WorkspaceRowWidget, type WorkspaceRowWidgetProps } from "./WorkspaceRowWidget";
import { WorkspaceRowWidgetSettings } from "./WorkspaceRowWidgetSettings";

export const workspaceRowWidget: WidgetDefinition<WorkspaceRowWidgetProps> = {
  id: WORKSPACE_ROW_WIDGET_ID,
  title: "Row",
  description:
    "Grafana-style workspace row header that can collapse or expand the following sibling widgets.",
  category: "Workspace",
  kind: "custom",
  source: "core",
  defaultSize: { w: 12, h: 1 },
  requiredPermissions: ["dashboard:view"],
  tags: ["layout", "workspace", "row", "collapse", "group"],
  exampleProps: {
    color: undefined,
  },
  mockProps: {
    color: undefined,
  },
  settingsComponent: WorkspaceRowWidgetSettings,
  component: WorkspaceRowWidget,
};
