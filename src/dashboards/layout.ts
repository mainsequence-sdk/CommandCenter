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

interface LayoutSegment {
  endY: number | null;
  startY: number;
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
  const isWorkspaceRow = isWorkspaceRowWidgetId(instance.widgetId);
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

  const w = isWorkspaceRow ? columns : clampInteger(rawSpan.cols, 1, 1);
  const h = isWorkspaceRow
    ? WORKSPACE_ROW_HEIGHT_ROWS
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
  segment?: LayoutSegment,
) {
  if (layout.x < 0 || layout.y < 0 || layout.x + layout.w > columns) {
    return false;
  }

  if (segment) {
    if (layout.y < segment.startY) {
      return false;
    }

    if (segment.endY !== null && layout.y + layout.h > segment.endY) {
      return false;
    }
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
  segment?: LayoutSegment,
) {
  const preferredX = position.x;
  const startY = Math.max(position.y ?? 0, segment?.startY ?? 0);

  function tryRange(rangeStartY: number, rangeEndYExclusive: number | null) {
    if (preferredX !== undefined) {
      for (let y = rangeStartY; rangeEndYExclusive === null || y + span.h <= rangeEndYExclusive; y += 1) {
        const layout = {
          x: preferredX,
          y,
          w: span.w,
          h: span.h,
        };

        if (canPlaceWidget(occupied, columns, layout, segment)) {
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

        if (canPlaceWidget(occupied, columns, layout, segment)) {
          return layout;
        }
      }
    }

    return null;
  }

  const primaryRange = tryRange(startY, segment?.endY ?? null);

  if (primaryRange) {
    return primaryRange;
  }

  if (segment && startY > segment.startY) {
    return tryRange(segment.startY, startY + span.h - 1);
  }

  return null;
}

function buildLayoutSegments(rowLayouts: ResolvedDashboardWidgetLayout[]): LayoutSegment[] {
  if (rowLayouts.length === 0) {
    return [{ startY: 0, endY: null }];
  }

  const segments: LayoutSegment[] = [];
  const sortedRows = [...rowLayouts].sort((left, right) => left.y - right.y);
  let nextStartY = 0;

  sortedRows.forEach((rowLayout) => {
    if (rowLayout.y > nextStartY) {
      segments.push({
        startY: nextStartY,
        endY: rowLayout.y,
      });
    }

    nextStartY = Math.max(nextStartY, rowLayout.y + rowLayout.h);
  });

  segments.push({
    startY: nextStartY,
    endY: null,
  });

  return segments;
}

function getSegmentDistance(segment: LayoutSegment, y: number) {
  if (y < segment.startY) {
    return segment.startY - y;
  }

  if (segment.endY !== null && y >= segment.endY) {
    return y - segment.endY + 1;
  }

  return 0;
}

function getPreferredSegmentOrder(segments: LayoutSegment[], preferredY: number | undefined) {
  if (segments.length <= 1 || preferredY === undefined) {
    return segments;
  }

  const rankedSegments = segments
    .map((segment) => ({
      segment,
      distance: getSegmentDistance(segment, preferredY),
    }))
    .sort((left, right) => left.distance - right.distance);

  return rankedSegments.map((entry) => entry.segment);
}

function fitSpanToSegment(
  occupied: Set<string>,
  columns: number,
  span: { w: number; h: number },
  position: DashboardWidgetPlacement,
  segment: LayoutSegment,
) {
  const maxSegmentHeight =
    segment.endY === null
      ? span.h
      : Math.max(segment.endY - segment.startY, 0);
  const fittedHeight = Math.max(1, Math.min(span.h, maxSegmentHeight || 1));

  for (let nextWidth = span.w; nextWidth >= 1; nextWidth -= 1) {
    const maxX =
      position.x !== undefined
        ? Math.max(0, Math.min(position.x, columns - nextWidth))
        : undefined;

    const layout = findPlacement(
      occupied,
      columns,
      { w: nextWidth, h: fittedHeight },
      {
        ...position,
        x: maxX,
      },
      segment,
    );

    if (layout) {
      return layout;
    }
  }

  return null;
}

function resolveWidgetPlacement(
  occupied: Set<string>,
  columns: number,
  span: { w: number; h: number },
  position: DashboardWidgetPlacement,
  segments: LayoutSegment[],
) {
  if (position.y === undefined) {
    for (const segment of segments) {
      const layout = findPlacement(occupied, columns, span, position, segment);

      if (layout) {
        return layout;
      }
    }

    return findPlacement(occupied, columns, span, position) ?? {
      x: position.x ?? 0,
      y: position.y ?? 0,
      w: span.w,
      h: span.h,
    };
  }

  const orderedSegments = getPreferredSegmentOrder(segments, position.y);

  for (const segment of orderedSegments) {
    const fittedLayout = fitSpanToSegment(occupied, columns, span, position, segment);

    if (fittedLayout) {
      return fittedLayout;
    }
  }

  return findPlacement(occupied, columns, span, position) ?? {
    x: position.x ?? 0,
    y: position.y ?? 0,
    w: span.w,
    h: span.h,
  };
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
  const resolvedLayouts = new Map<string, ResolvedDashboardWidgetLayout>();
  const rowWidgets = dashboard.widgets.filter((instance) => isWorkspaceRowWidgetId(instance.widgetId));
  const contentWidgets = dashboard.widgets.filter((instance) => !isWorkspaceRowWidgetId(instance.widgetId));

  rowWidgets.forEach((instance) => {
    const normalized = normalizeWidgetLayout(instance, grid.columns, issues);
    const resolvedLayout =
      findPlacement(
        occupied,
        grid.columns,
        normalized.span,
        normalized.position,
      ) ?? {
        x: 0,
        y: normalized.position.y ?? 0,
        w: normalized.span.w,
        h: normalized.span.h,
      };

    if (
      typeof normalized.position.y === "number" &&
      normalized.position.y !== resolvedLayout.y
    ) {
      issues.push({
        widgetId: instance.id,
        message: `Requested y position ${normalized.position.y} was shifted to ${resolvedLayout.y} to keep row dividers collision-free.`,
      });
    }

    reserveCells(occupied, resolvedLayout);
    resolvedLayouts.set(instance.id, resolvedLayout);
  });

  const segments = buildLayoutSegments(
    rowWidgets
      .map((instance) => resolvedLayouts.get(instance.id))
      .filter((layout): layout is ResolvedDashboardWidgetLayout => Boolean(layout)),
  );

  contentWidgets.forEach((instance) => {
    const normalized = normalizeWidgetLayout(instance, grid.columns, issues);
    const resolvedLayout = resolveWidgetPlacement(
      occupied,
      grid.columns,
      normalized.span,
      normalized.position,
      segments,
    );

    if (
      typeof normalized.position.y === "number" &&
      normalized.position.y !== resolvedLayout.y
    ) {
      issues.push({
        widgetId: instance.id,
        message: `Requested y position ${normalized.position.y} was shifted to ${resolvedLayout.y} to stay within its row band.`,
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
