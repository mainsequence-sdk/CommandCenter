import type {
  DashboardDefinition,
  DashboardLayoutIssue,
  DashboardWidgetInstance,
  DashboardWidgetLegacyLayout,
  DashboardWidgetPlacement,
  DashboardWidgetSpan,
  ResolvedDashboardDefinition,
  ResolvedDashboardGridConfig,
  ResolvedDashboardWidgetLayout,
} from "@/dashboards/types";
import {
  isWorkspaceRowWidgetId,
  WORKSPACE_ROW_HEIGHT_ROWS,
} from "@/dashboards/structural-widgets";
import {
  resolveWidgetMinimalChrome,
  resolveWidgetSidebarOnly,
} from "@/widgets/shared/chrome";

const DEFAULT_GRID: ResolvedDashboardGridConfig = {
  columns: 12,
  rowHeight: 78,
  gap: 16,
};
const LEGACY_GRID_COLUMNS = 12;
const LEGACY_COMPACT_WIDGET_HEIGHT_PX = 78;

interface NormalizedWidgetLayout {
  span: {
    w: number;
    h: number;
  };
  position: DashboardWidgetPlacement;
}

function isLegacyLayout(
  layout: DashboardWidgetInstance["layout"],
): layout is DashboardWidgetLegacyLayout {
  return typeof layout === "object" && layout !== null && "w" in layout && "h" in layout;
}

function isCanonicalLayout(
  layout: DashboardWidgetInstance["layout"],
): layout is DashboardWidgetSpan {
  return typeof layout === "object" && layout !== null && "cols" in layout && "rows" in layout;
}

function clampInteger(value: number | undefined, fallback: number, minimum = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function resolveGridConfig(dashboard: DashboardDefinition): ResolvedDashboardGridConfig {
  return {
    columns: clampInteger(dashboard.grid?.columns, DEFAULT_GRID.columns, 1),
    rowHeight: clampInteger(dashboard.grid?.rowHeight, DEFAULT_GRID.rowHeight, 1),
    gap: clampInteger(dashboard.grid?.gap, DEFAULT_GRID.gap, 0),
  };
}

function resolveCompactWidgetSpan(grid: ResolvedDashboardGridConfig) {
  return {
    w: Math.max(1, Math.round(grid.columns / LEGACY_GRID_COLUMNS)),
    h: Math.max(
      1,
      Math.round((LEGACY_COMPACT_WIDGET_HEIGHT_PX + grid.gap) / (grid.rowHeight + grid.gap)),
    ),
  };
}

function normalizeWidgetLayout(
  instance: DashboardWidgetInstance,
  grid: ResolvedDashboardGridConfig,
  issues: DashboardLayoutIssue[],
): NormalizedWidgetLayout {
  const columns = grid.columns;
  const isWorkspaceRow = isWorkspaceRowWidgetId(instance.widgetId);
  const isMinimalChrome = resolveWidgetMinimalChrome(instance.props);
  const isCompactFilterWidget =
    instance.widgetId === "main-sequence-data-node" &&
    (isMinimalChrome || instance.props?.chromeMode == null);
  const rawSpan: Partial<DashboardWidgetSpan> = isLegacyLayout(instance.layout)
    ? {
        cols: instance.layout.w,
        rows: instance.layout.h,
      }
    : isCanonicalLayout(instance.layout)
      ? instance.layout
      : {};
  const rawPosition = isLegacyLayout(instance.layout)
    ? {
        x: instance.layout.x,
        y: instance.layout.y,
      }
    : instance.position && typeof instance.position === "object"
      ? instance.position
      : {};

  if (!isLegacyLayout(instance.layout) && !isCanonicalLayout(instance.layout)) {
    issues.push({
      widgetId: instance.id,
      message: "Widget layout was missing or invalid and was reset to a safe default size.",
    });
  }
  const compactSpan = resolveCompactWidgetSpan(grid);
  const w = isWorkspaceRow
    ? columns
    : isCompactFilterWidget
      ? compactSpan.w
      : clampInteger(rawSpan.cols, 1, 1);
  const h = isWorkspaceRow
    ? WORKSPACE_ROW_HEIGHT_ROWS
    : isCompactFilterWidget
      ? compactSpan.h
      : clampInteger(rawSpan.rows, 1, 1);
  const boundedWidth = isWorkspaceRow ? columns : Math.min(w, columns);

  if (!isWorkspaceRow && w !== boundedWidth) {
    issues.push({
      widgetId: instance.id,
      message: `Requested width ${w} exceeds the ${columns}-column grid and was clamped.`,
    });
  }

  if (isWorkspaceRow && rawSpan.rows !== WORKSPACE_ROW_HEIGHT_ROWS) {
    issues.push({
      widgetId: instance.id,
      message: `Row widgets keep a fixed height of ${WORKSPACE_ROW_HEIGHT_ROWS}.`,
    });
  }

  const position: DashboardWidgetPlacement = {
    x: isWorkspaceRow
      ? 0
      : (
        typeof rawPosition.x === "number"
          ? Math.min(clampInteger(rawPosition.x, 0), Math.max(columns - boundedWidth, 0))
          : undefined
      ),
    y: typeof rawPosition.y === "number" ? clampInteger(rawPosition.y, 0) : undefined,
  };

  if (isWorkspaceRow && typeof rawPosition.x === "number" && rawPosition.x !== 0) {
    issues.push({
      widgetId: instance.id,
      message: "Row widgets always span the full workspace width and stay anchored at x = 0.",
    });
  } else if (
    !isWorkspaceRow &&
    typeof rawPosition.x === "number" &&
    rawPosition.x !== position.x
  ) {
    issues.push({
      widgetId: instance.id,
      message: `Requested x position ${rawPosition.x} was clamped to ${position.x}.`,
    });
  }

  if (
    typeof rawPosition.y === "number" &&
    rawPosition.y !== position.y
  ) {
    issues.push({
      widgetId: instance.id,
      message: `Requested y position ${rawPosition.y} was clamped to ${position.y}.`,
    });
  }

  return {
    span: {
      w: boundedWidth,
      h,
    },
    position,
  };
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function canPlaceWidget(
  occupied: Set<string>,
  columns: number,
  layout: ResolvedDashboardWidgetLayout,
) {
  if (layout.x < 0 || layout.y < 0 || layout.x + layout.w > columns) {
    return false;
  }

  for (let x = layout.x; x < layout.x + layout.w; x += 1) {
    for (let y = layout.y; y < layout.y + layout.h; y += 1) {
      if (occupied.has(cellKey(x, y))) {
        return false;
      }
    }
  }

  return true;
}

function reserveCells(occupied: Set<string>, layout: ResolvedDashboardWidgetLayout) {
  for (let x = layout.x; x < layout.x + layout.w; x += 1) {
    for (let y = layout.y; y < layout.y + layout.h; y += 1) {
      occupied.add(cellKey(x, y));
    }
  }
}

function findPlacement(
  occupied: Set<string>,
  columns: number,
  span: { w: number; h: number },
  position: DashboardWidgetPlacement,
) {
  const preferredX = position.x;
  const startY = Math.max(position.y ?? 0, 0);

  function tryRange(rangeStartY: number, rangeEndYExclusive: number | null) {
    if (preferredX !== undefined) {
      for (let y = rangeStartY; rangeEndYExclusive === null || y + span.h <= rangeEndYExclusive; y += 1) {
        const layout = {
          x: preferredX,
          y,
          w: span.w,
          h: span.h,
        };

        if (canPlaceWidget(occupied, columns, layout)) {
          return layout;
        }
      }

      return null;
    }

    for (let y = rangeStartY; rangeEndYExclusive === null || y + span.h <= rangeEndYExclusive; y += 1) {
      for (let x = 0; x <= columns - span.w; x += 1) {
        const layout = {
          x,
          y,
          w: span.w,
          h: span.h,
        };

        if (canPlaceWidget(occupied, columns, layout)) {
          return layout;
        }
      }
    }

    return null;
  }

  const primaryRange = tryRange(startY, null);

  if (primaryRange) {
    return primaryRange;
  }

  return null;
}


function warnLayoutIssues(dashboardId: string, issues: DashboardLayoutIssue[]) {
  if (!import.meta.env.DEV || issues.length === 0) {
    return;
  }

  console.warn(
    `[dashboard-layout] Adjusted dashboard "${dashboardId}" to keep widgets collision-free.`,
    issues,
  );
}

export function resolveDashboardLayout(
  dashboard: DashboardDefinition,
): ResolvedDashboardDefinition {
  const grid = resolveGridConfig(dashboard);
  const occupied = new Set<string>();
  const sidebarOccupied = new Set<string>();
  const issues: DashboardLayoutIssue[] = [];
  const resolvedLayouts = new Map<string, ResolvedDashboardWidgetLayout>();
  const canvasWidgets = dashboard.widgets.filter(
    (instance) => !resolveWidgetSidebarOnly(instance.presentation),
  );
  const sidebarWidgets = dashboard.widgets.filter((instance) =>
    resolveWidgetSidebarOnly(instance.presentation),
  );
  let activeRowFloorY = 0;

  canvasWidgets.forEach((instance) => {
    const normalized = normalizeWidgetLayout(instance, grid, issues);
    const minimumY = Math.max(normalized.position.y ?? activeRowFloorY, activeRowFloorY);
    const resolvedLayout =
      findPlacement(
        occupied,
        grid.columns,
        normalized.span,
        {
          ...normalized.position,
          y: minimumY,
        },
      ) ?? {
        x: normalized.position.x ?? 0,
        y: minimumY,
        w: normalized.span.w,
        h: normalized.span.h,
      };

    if (
      typeof normalized.position.y === "number" &&
      normalized.position.y !== resolvedLayout.y
    ) {
      issues.push({
        widgetId: instance.id,
        message: isWorkspaceRowWidgetId(instance.widgetId)
          ? `Requested y position ${normalized.position.y} was shifted to ${resolvedLayout.y} to keep row order collision-free.`
          : `Requested y position ${normalized.position.y} was shifted to ${resolvedLayout.y} to preserve row sequence.`,
      });
    }

    if (
      normalized.span.w !== resolvedLayout.w ||
      normalized.span.h !== resolvedLayout.h
    ) {
      issues.push({
        widgetId: instance.id,
        message: `Widget span ${normalized.span.w}x${normalized.span.h} was reduced to ${resolvedLayout.w}x${resolvedLayout.h} to fit within its row band.`,
      });
    }

    reserveCells(occupied, resolvedLayout);
    resolvedLayouts.set(instance.id, resolvedLayout);

    if (isWorkspaceRowWidgetId(instance.widgetId)) {
      activeRowFloorY = resolvedLayout.y + resolvedLayout.h;
    }
  });

  sidebarWidgets.forEach((instance) => {
    const normalized = normalizeWidgetLayout(instance, grid, issues);
    const resolvedLayout =
      findPlacement(
        sidebarOccupied,
        grid.columns,
        normalized.span,
        normalized.position,
      ) ?? {
        x: normalized.position.x ?? 0,
        y: normalized.position.y ?? 0,
        w: normalized.span.w,
        h: normalized.span.h,
      };

    reserveCells(sidebarOccupied, resolvedLayout);
    resolvedLayouts.set(instance.id, resolvedLayout);
  });

  const widgets = dashboard.widgets.map((instance) => ({
    ...instance,
    layout: resolvedLayouts.get(instance.id) ?? {
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    },
  }));

  warnLayoutIssues(dashboard.id, issues);

  return {
    ...dashboard,
    grid,
    widgets,
  };
}
