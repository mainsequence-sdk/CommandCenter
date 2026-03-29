import { WORKSPACE_ROW_WIDGET_ID } from "@/dashboards/structural-widgets";
import type { ResolvedDashboardWidgetLayout } from "@/dashboards/types";
import type { WidgetDefinition } from "@/widgets/types";

const MIN_RESPONSIVE_CELL_WIDTH_PX = 72;

export interface ResponsiveCanvasSourceItem {
  id: string;
  layout: ResolvedDashboardWidgetLayout;
  minWidthPx: number;
  widgetId?: string;
}

export interface ResponsiveCanvasLayoutResult {
  columns: number;
  cellWidth: number;
  layoutById: Map<string, ResolvedDashboardWidgetLayout>;
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(Math.round(value), maximum));
}

function resolveResponsiveColumns(
  availableWidth: number,
  sourceColumns: number,
  gap: number,
) {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return sourceColumns;
  }

  return Math.max(
    1,
    Math.min(
      sourceColumns,
      Math.floor((availableWidth + gap) / (MIN_RESPONSIVE_CELL_WIDTH_PX + gap)),
    ),
  );
}

function resolveResponsiveCellWidth(
  availableWidth: number,
  columns: number,
  gap: number,
) {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return MIN_RESPONSIVE_CELL_WIDTH_PX;
  }

  return Math.max(
    1,
    (availableWidth - Math.max(0, columns - 1) * gap) / Math.max(1, columns),
  );
}

function compareByCanonicalLayout(
  left: ResponsiveCanvasSourceItem,
  right: ResponsiveCanvasSourceItem,
) {
  if (left.layout.y !== right.layout.y) {
    return left.layout.y - right.layout.y;
  }

  if (left.layout.x !== right.layout.x) {
    return left.layout.x - right.layout.x;
  }

  return left.id.localeCompare(right.id);
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function canPlace(
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

function reserveCells(
  occupied: Set<string>,
  layout: ResolvedDashboardWidgetLayout,
) {
  for (let x = layout.x; x < layout.x + layout.w; x += 1) {
    for (let y = layout.y; y < layout.y + layout.h; y += 1) {
      occupied.add(cellKey(x, y));
    }
  }
}

function findPlacement(
  occupied: Set<string>,
  columns: number,
  span: Pick<ResolvedDashboardWidgetLayout, "h" | "w">,
  preferredX: number,
) {
  for (let y = 0; ; y += 1) {
    const preferredLayout: ResolvedDashboardWidgetLayout = {
      x: preferredX,
      y,
      w: span.w,
      h: span.h,
    };

    if (canPlace(occupied, columns, preferredLayout)) {
      return preferredLayout;
    }

    for (let x = 0; x <= columns - span.w; x += 1) {
      const layout: ResolvedDashboardWidgetLayout = {
        x,
        y,
        w: span.w,
        h: span.h,
      };

      if (canPlace(occupied, columns, layout)) {
        return layout;
      }
    }
  }
}

export function resolveWidgetResponsiveMinWidthPx(
  widget: Pick<WidgetDefinition, "defaultSize" | "kind" | "responsive">,
) {
  if (typeof widget.responsive?.minWidthPx === "number" && widget.responsive.minWidthPx > 0) {
    return widget.responsive.minWidthPx;
  }

  switch (widget.kind) {
    case "chart":
      return Math.max(320, Math.min(560, widget.defaultSize.w * 44));
    case "table":
      return Math.max(360, Math.min(640, widget.defaultSize.w * 48));
    case "feed":
      return Math.max(260, Math.min(420, widget.defaultSize.w * 42));
    case "kpi":
      return Math.max(180, Math.min(280, widget.defaultSize.w * 38));
    case "custom":
    default:
      return Math.max(220, Math.min(480, widget.defaultSize.w * 40));
  }
}

export function resolveResponsiveCanvasLayout(
  items: readonly ResponsiveCanvasSourceItem[],
  options: {
    availableWidth: number;
    canonicalColumns: number;
    gap: number;
  },
): ResponsiveCanvasLayoutResult {
  const sourceColumns = Math.max(
    1,
    Math.min(
      options.canonicalColumns,
      items.reduce((maximum, item) => Math.max(maximum, item.layout.x + item.layout.w), 1),
    ),
  );

  if (!Number.isFinite(options.availableWidth) || options.availableWidth <= 0) {
    return {
      columns: sourceColumns,
      cellWidth: MIN_RESPONSIVE_CELL_WIDTH_PX,
      layoutById: new Map(items.map((item) => [item.id, item.layout])),
    };
  }

  const columns = resolveResponsiveColumns(
    options.availableWidth,
    sourceColumns,
    options.gap,
  );
  const cellWidth = resolveResponsiveCellWidth(
    options.availableWidth,
    columns,
    options.gap,
  );
  const occupied = new Set<string>();
  const layoutById = new Map<string, ResolvedDashboardWidgetLayout>();
  const occupantsByRow = new Map<number, Set<string>>();

  [...items]
    .sort(compareByCanonicalLayout)
    .forEach((item) => {
      const fullWidth = item.widgetId === WORKSPACE_ROW_WIDGET_ID;

      if (fullWidth) {
        const layout = findPlacement(
          occupied,
          columns,
          {
            w: columns,
            h: item.layout.h,
          },
          0,
        );

        reserveCells(occupied, layout);
        layoutById.set(item.id, layout);
        for (let row = layout.y; row < layout.y + layout.h; row += 1) {
          const occupants = occupantsByRow.get(row) ?? new Set<string>();
          occupants.add(item.id);
          occupantsByRow.set(row, occupants);
        }
        return;
      }

      const scaledWidth = clampInteger(
        (item.layout.w / sourceColumns) * columns,
        1,
        columns,
      );
      const width = Math.max(
        1,
        Math.min(columns, scaledWidth),
      );
      const preferredX = clampInteger(
        (item.layout.x / sourceColumns) * columns,
        0,
        Math.max(0, columns - width),
      );
      const layout = findPlacement(
        occupied,
        columns,
        {
          w: width,
          h: item.layout.h,
        },
        preferredX,
      );

      reserveCells(occupied, layout);
      layoutById.set(item.id, layout);
      for (let row = layout.y; row < layout.y + layout.h; row += 1) {
        const occupants = occupantsByRow.get(row) ?? new Set<string>();
        occupants.add(item.id);
        occupantsByRow.set(row, occupants);
      }
    });

  return {
    columns,
    cellWidth,
    layoutById,
  };
}
