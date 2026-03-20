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

const DEFAULT_GRID: ResolvedDashboardGridConfig = {
  columns: 12,
  rowHeight: 78,
  gap: 16,
};

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
  return "w" in layout && "h" in layout;
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

function normalizeWidgetLayout(
  instance: DashboardWidgetInstance,
  columns: number,
  issues: DashboardLayoutIssue[],
): NormalizedWidgetLayout {
  const rawSpan: DashboardWidgetSpan = isLegacyLayout(instance.layout)
    ? {
        cols: instance.layout.w,
        rows: instance.layout.h,
      }
    : instance.layout;

  const rawPosition = isLegacyLayout(instance.layout)
    ? {
        x: instance.layout.x,
        y: instance.layout.y,
      }
    : instance.position ?? {};

  const w = clampInteger(rawSpan.cols, 1, 1);
  const h = clampInteger(rawSpan.rows, 1, 1);
  const boundedWidth = Math.min(w, columns);

  if (w !== boundedWidth) {
    issues.push({
      widgetId: instance.id,
      message: `Requested width ${w} exceeds the ${columns}-column grid and was clamped.`,
    });
  }

  const position: DashboardWidgetPlacement = {
    x:
      typeof rawPosition.x === "number"
        ? Math.min(clampInteger(rawPosition.x, 0), Math.max(columns - boundedWidth, 0))
        : undefined,
    y: typeof rawPosition.y === "number" ? clampInteger(rawPosition.y, 0) : undefined,
  };

  if (
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
  const startY = position.y ?? 0;

  if (preferredX !== undefined) {
    for (let y = startY; ; y += 1) {
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
  }

  for (let y = startY; ; y += 1) {
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
  const issues: DashboardLayoutIssue[] = [];

  const widgets = dashboard.widgets.map((instance) => {
    const normalized = normalizeWidgetLayout(instance, grid.columns, issues);
    const resolvedLayout = findPlacement(
      occupied,
      grid.columns,
      normalized.span,
      normalized.position,
    );

    if (
      typeof normalized.position.y === "number" &&
      normalized.position.y !== resolvedLayout.y
    ) {
      issues.push({
        widgetId: instance.id,
        message: `Requested y position ${normalized.position.y} was shifted to ${resolvedLayout.y} to avoid overlap.`,
      });
    }

    reserveCells(occupied, resolvedLayout);

    return {
      ...instance,
      layout: resolvedLayout,
    };
  });

  warnLayoutIssues(dashboard.id, issues);

  return {
    ...dashboard,
    grid,
    widgets,
  };
}
