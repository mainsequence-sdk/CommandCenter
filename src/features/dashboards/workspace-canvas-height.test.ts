import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS,
  DEFAULT_WORKSPACE_CANVAS_EDIT_MODE_BOTTOM_BUFFER_ROWS,
  DEFAULT_WORKSPACE_CANVAS_MIN_ROWS,
  resolveWorkspaceCanvasMinHeight,
} from "./workspace-canvas-height";

describe("resolveWorkspaceCanvasMinHeight", () => {
  it("keeps a minimum canvas height for empty workspaces", () => {
    const height = resolveWorkspaceCanvasMinHeight([], {
      bottomBufferRows: 2,
      grid: {
        gap: 8,
        rowHeight: 15,
      },
      minimumRows: DEFAULT_WORKSPACE_CANVAS_MIN_ROWS,
    });

    expect(height).toBe(130);
  });

  it("extends the canvas below the lowest widget by the configured buffer rows", () => {
    const height = resolveWorkspaceCanvasMinHeight(
      [
        { y: 0, h: 3 },
        { y: 11, h: 4 },
      ],
      {
        bottomBufferRows: DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS,
        grid: {
          gap: 0,
          rowHeight: 15,
        },
      },
    );

    expect(height).toBe(345);
  });

  it("gives edit mode more trailing room than view mode for the same content", () => {
    const viewHeight = resolveWorkspaceCanvasMinHeight(
      [{ y: 6, h: 4 }],
      {
        bottomBufferRows: DEFAULT_WORKSPACE_CANVAS_BOTTOM_BUFFER_ROWS,
        grid: {
          gap: 0,
          rowHeight: 15,
        },
      },
    );
    const editHeight = resolveWorkspaceCanvasMinHeight(
      [{ y: 6, h: 4 }],
      {
        bottomBufferRows: DEFAULT_WORKSPACE_CANVAS_EDIT_MODE_BOTTOM_BUFFER_ROWS,
        grid: {
          gap: 0,
          rowHeight: 15,
        },
      },
    );

    expect(editHeight).toBeGreaterThan(viewHeight);
    expect(editHeight - viewHeight).toBe(60);
  });

  it("includes grid gaps in the final pixel height", () => {
    const height = resolveWorkspaceCanvasMinHeight(
      [{ y: 2, h: 3 }],
      {
        bottomBufferRows: 4,
        grid: {
          gap: 6,
          rowHeight: 20,
        },
      },
    );

    expect(height).toBe(228);
  });
});
