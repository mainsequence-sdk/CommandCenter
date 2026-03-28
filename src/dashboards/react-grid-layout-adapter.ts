import type {
  DashboardDefinition,
  DashboardWidgetInstance,
  ResolvedDashboardDefinition,
  ResolvedDashboardWidgetInstance,
} from "@/dashboards/types";
import {
  isWorkspaceRowCollapsed,
  isWorkspaceRowWidgetId,
  WORKSPACE_ROW_HEIGHT_ROWS,
} from "@/dashboards/structural-widgets";
import { resolveWidgetSidebarOnly } from "@/widgets/shared/chrome";

export const workspaceGridDraggableHandleClassName = "workspace-grid-handle";
export const workspaceGridDraggableCancelClassName = "workspace-grid-cancel";
export const workspaceGridDraggableHandleSelector = `.${workspaceGridDraggableHandleClassName}`;
export const workspaceGridDraggableCancelSelector =
  `.${workspaceGridDraggableCancelClassName}, button, a, input, textarea, select, [data-no-widget-drag='true']`;

export interface WorkspaceGridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  moved?: boolean;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
  isBounded?: boolean;
}

interface ComparableGridItem {
  i: string;
  x: number;
  y: number;
}

function isGridManagedWidget(
  widget: Pick<DashboardWidgetInstance, "presentation" | "widgetId">,
) {
  return !resolveWidgetSidebarOnly(widget.presentation);
}

function compareGridItems(
  left: ComparableGridItem,
  right: ComparableGridItem,
) {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  if (left.x !== right.x) {
    return left.x - right.x;
  }

  return left.i.localeCompare(right.i);
}

export function resolvedWidgetToGridLayoutItem(
  widget: ResolvedDashboardWidgetInstance,
  columns: number,
): WorkspaceGridLayoutItem | null {
  if (!isGridManagedWidget(widget)) {
    return null;
  }

  if (isWorkspaceRowWidgetId(widget.widgetId)) {
    return {
      i: widget.id,
      x: 0,
      y: widget.layout.y,
      w: columns,
      h: WORKSPACE_ROW_HEIGHT_ROWS,
      minW: columns,
      maxW: columns,
      minH: WORKSPACE_ROW_HEIGHT_ROWS,
      maxH: WORKSPACE_ROW_HEIGHT_ROWS,
      isResizable: false,
      isDraggable: isWorkspaceRowCollapsed(widget),
    };
  }

  return {
    i: widget.id,
    x: widget.layout.x,
    y: widget.layout.y,
    w: widget.layout.w,
    h: widget.layout.h,
  };
}

export function resolvedDashboardToGridLayout(
  dashboard: ResolvedDashboardDefinition,
): WorkspaceGridLayoutItem[] {
  return dashboard.widgets
    .map((widget) => resolvedWidgetToGridLayoutItem(widget, dashboard.grid.columns))
    .filter((widget): widget is WorkspaceGridLayoutItem => widget !== null)
    .sort(compareGridItems);
}

export function applyGridLayoutToDashboardWidgets(
  widgets: DashboardWidgetInstance[],
  layout: Array<Pick<WorkspaceGridLayoutItem, "h" | "i" | "w" | "x" | "y">>,
): DashboardWidgetInstance[] {
  const layoutById = new Map(
    layout.map((entry) => [
      entry.i,
      {
        x: entry.x,
        y: entry.y,
        cols: entry.w,
        rows: entry.h,
      },
    ]),
  );

  return widgets.map((widget) => {
    if (!isGridManagedWidget(widget)) {
      return widget;
    }

    const nextLayout = layoutById.get(widget.id);

    if (!nextLayout) {
      return widget;
    }

    if (isWorkspaceRowWidgetId(widget.widgetId)) {
      return {
        ...widget,
        layout: {
          cols: nextLayout.cols,
          rows: WORKSPACE_ROW_HEIGHT_ROWS,
        },
        position: {
          x: 0,
          y: nextLayout.y,
        },
      };
    }

    return {
      ...widget,
      layout: {
        cols: nextLayout.cols,
        rows: nextLayout.rows,
      },
      position: {
        x: nextLayout.x,
        y: nextLayout.y,
      },
    };
  });
}

export function sortWidgetsByGridOrder<T extends DashboardWidgetInstance>(
  widgets: readonly T[],
  layout: Array<Pick<WorkspaceGridLayoutItem, "i" | "x" | "y">>,
): T[] {
  const rankedIds = new Map(
    [...layout]
      .sort(compareGridItems)
      .map((entry, index) => [entry.i, index]),
  );

  return [...widgets].sort((left, right) => {
    const leftRank = rankedIds.get(left.id);
    const rightRank = rankedIds.get(right.id);

    if (leftRank !== undefined && rightRank !== undefined) {
      return leftRank - rightRank;
    }

    if (leftRank !== undefined) {
      return -1;
    }

    if (rightRank !== undefined) {
      return 1;
    }

    const leftY = left.position?.y ?? 0;
    const rightY = right.position?.y ?? 0;

    if (leftY !== rightY) {
      return leftY - rightY;
    }

    const leftX = left.position?.x ?? 0;
    const rightX = right.position?.x ?? 0;

    if (leftX !== rightX) {
      return leftX - rightX;
    }

    return left.id.localeCompare(right.id);
  });
}

export function splitDashboardWidgetsForGrid(
  dashboard: Pick<DashboardDefinition, "widgets"> | Pick<ResolvedDashboardDefinition, "widgets">,
) {
  const gridManaged: Array<(typeof dashboard.widgets)[number]> = [];
  const structural: Array<(typeof dashboard.widgets)[number]> = [];

  dashboard.widgets.forEach((widget) => {
    if (isGridManagedWidget(widget)) {
      gridManaged.push(widget);
      return;
    }

    structural.push(widget);
  });

  return {
    gridManaged,
    structural,
  };
}
