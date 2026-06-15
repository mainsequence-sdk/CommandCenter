import type { DashboardWidgetInstance } from "@/dashboards/types";
import { resolveWidgetSidebarOnly } from "@/widgets/shared/chrome";
import {
  CORE_WORKSPACE_ROW_WIDGET_ID,
  CORE_WORKSPACE_SLIDE_WIDGET_ID,
  normalizeWidgetTypeId,
} from "@/widgets/widget-type-normalization";

export const WORKSPACE_ROW_WIDGET_ID = CORE_WORKSPACE_ROW_WIDGET_ID;
export const WORKSPACE_SLIDE_WIDGET_ID = CORE_WORKSPACE_SLIDE_WIDGET_ID;
export const WORKSPACE_ROW_HEIGHT_ROWS = 2;
export const WORKSPACE_SLIDE_MIN_HEIGHT_ROWS = 48;

export function isWorkspaceRowWidgetId(widgetId: string) {
  return normalizeWidgetTypeId(widgetId) === WORKSPACE_ROW_WIDGET_ID;
}

export function isWorkspaceSlideWidgetId(widgetId: string) {
  return normalizeWidgetTypeId(widgetId) === WORKSPACE_SLIDE_WIDGET_ID;
}

export function isWorkspaceFullWidthWidgetId(widgetId: string) {
  return isWorkspaceRowWidgetId(widgetId) || isWorkspaceSlideWidgetId(widgetId);
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
