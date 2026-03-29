const DEFAULT_AUTO_GRID_MIN_COLUMN_WIDTH_PX = 320;
const DEFAULT_AUTO_GRID_MAX_COLUMNS = 4;

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
