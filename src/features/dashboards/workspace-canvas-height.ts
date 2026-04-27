export const DEFAULT_WORKSPACE_CANVAS_MIN_ROWS = 6;
export const DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS = 8;
export const DEFAULT_WORKSPACE_CANVAS_EDIT_MODE_BOTTOM_BUFFER_ROWS = 12;

interface WorkspaceCanvasHeightItem {
  h: number;
  y: number;
}

interface ResolveWorkspaceCanvasMinHeightOptions {
  bottomBufferRows?: number;
  grid: {
    gap: number;
    rowHeight: number;
  };
  minimumRows?: number;
}

export function resolveWorkspaceCanvasMinHeight(
  items: readonly WorkspaceCanvasHeightItem[],
  options: ResolveWorkspaceCanvasMinHeightOptions,
) {
  const gap = Math.max(0, Math.round(options.grid.gap));
  const rowHeight = Math.max(1, Math.round(options.grid.rowHeight));
  const minimumRows = Math.max(
    1,
    Math.round(options.minimumRows ?? DEFAULT_WORKSPACE_CANVAS_MIN_ROWS),
  );
  const bottomBufferRows = Math.max(
    0,
    Math.round(options.bottomBufferRows ?? DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS),
  );

  const contentBottomRows = items.reduce(
    (bottom, item) => Math.max(bottom, item.y + item.h),
    0,
  );
  const totalRows = Math.max(minimumRows, contentBottomRows + bottomBufferRows);

  return totalRows * rowHeight + Math.max(0, totalRows - 1) * gap;
}
