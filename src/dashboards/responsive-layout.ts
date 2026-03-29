const DEFAULT_AUTO_GRID_MIN_COLUMN_WIDTH_PX = 320;
const DEFAULT_AUTO_GRID_MAX_COLUMNS = 4;
export const DASHBOARD_MD_BREAKPOINT_PX = 769;

export interface DashboardRuntimeGridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function compareRuntimeGridItems(
  left: Pick<DashboardRuntimeGridItem, "i" | "x" | "y">,
  right: Pick<DashboardRuntimeGridItem, "i" | "x" | "y">,
) {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  if (left.x !== right.x) {
    return left.x - right.x;
  }

  return left.i.localeCompare(right.i);
}

export function isDashboardMobileWidth(width: number | null | undefined) {
  return typeof width === "number" && width > 0 && width < DASHBOARD_MD_BREAKPOINT_PX;
}

export function resolveCustomRuntimeGridLayout<T extends DashboardRuntimeGridItem>(
  items: readonly T[],
  columns: number,
  width: number | null | undefined,
) {
  if (!isDashboardMobileWidth(width)) {
    return {
      mobile: false,
      layout: [...items].sort(compareRuntimeGridItems),
    };
  }

  let nextY = 0;

  return {
    mobile: true,
    layout: [...items]
      .sort(compareRuntimeGridItems)
      .map((item) => {
        const nextItem = {
          ...item,
          x: 0,
          y: nextY,
          w: Math.max(1, columns),
          h: Math.max(1, item.h),
        };

        nextY += nextItem.h;
        return nextItem;
      }),
    };
}

export function resolveAutoGridTemplateColumns(options?: {
  maxColumns?: number;
  minColumnWidthPx?: number;
  gap?: number;
}) {
  const maxColumns = Math.max(1, Math.round(options?.maxColumns ?? DEFAULT_AUTO_GRID_MAX_COLUMNS));
  const minColumnWidthPx = Math.max(
    1,
    Math.round(options?.minColumnWidthPx ?? DEFAULT_AUTO_GRID_MIN_COLUMN_WIDTH_PX),
  );
  const gap = Math.max(0, Math.round(options?.gap ?? 0));
  const reservedGapWidth = gap * Math.max(0, maxColumns - 1);
  const maxTrackWidth =
    maxColumns === 1
      ? "100%"
      : `calc((100% - ${reservedGapWidth}px) / ${maxColumns})`;

  return `repeat(auto-fit, minmax(min(max(${maxTrackWidth}, ${minColumnWidthPx}px), 100%), 1fr))`;
}
