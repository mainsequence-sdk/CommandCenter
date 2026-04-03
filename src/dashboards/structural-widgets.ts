import type { DashboardWidgetInstance } from "@/dashboards/types";
import { resolveWidgetSidebarOnly } from "@/widgets/shared/chrome";

export const WORKSPACE_ROW_WIDGET_ID = "workspace-row";
export const WORKSPACE_ROW_HEIGHT_ROWS = 2;

export function isWorkspaceRowWidgetId(widgetId: string) {
  return widgetId === WORKSPACE_ROW_WIDGET_ID;
}

export function isWorkspaceRowWidget(
  widget: Pick<DashboardWidgetInstance, "widgetId">,
) {
  return isWorkspaceRowWidgetId(widget.widgetId);
}

export function isWorkspaceRowCollapsed(
  widget: Pick<DashboardWidgetInstance, "row" | "widgetId">,
) {
  return isWorkspaceRowWidget(widget) && widget.row?.collapsed === true;
}

export function getExpandedWorkspaceRowChildren(
  widgets: readonly DashboardWidgetInstance[],
  rowIndex: number,
) {
  const children: DashboardWidgetInstance[] = [];

  for (let index = rowIndex + 1; index < widgets.length; index += 1) {
    const candidate = widgets[index];

    if (isWorkspaceRowWidget(candidate)) {
      break;
    }

    children.push(candidate);
  }

  return children;
}

export function getWorkspaceRowChildCount(
  widgets: readonly DashboardWidgetInstance[],
  rowId: string,
) {
  const rowIndex = widgets.findIndex((widget) => widget.id === rowId);

  if (rowIndex < 0) {
    return 0;
  }

  const row = widgets[rowIndex];

  if (!isWorkspaceRowWidget(row)) {
    return 0;
  }

  if (isWorkspaceRowCollapsed(row)) {
    return (row.row?.children ?? []).filter(
      (child) => !resolveWidgetSidebarOnly(child.presentation),
    ).length;
  }

  return getExpandedWorkspaceRowChildren(widgets, rowIndex).filter(
    (child) => !resolveWidgetSidebarOnly(child.presentation),
  ).length;
}
