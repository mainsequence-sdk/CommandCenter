import { useMemo, type ReactNode } from "react";
import LegacyGridLayout, {
  WidthProvider as legacyWidthProvider,
  type Layout as LegacyGridLayoutLayout,
  type LayoutItem as LegacyGridLayoutItem,
} from "react-grid-layout/legacy";

import type { WorkspaceGridLayoutItem } from "@/dashboards/react-grid-layout-adapter";
import {
  WORKSPACE_SLIDE_GRID_COLUMNS,
  WORKSPACE_SLIDE_GRID_ROW_HEIGHT,
} from "@/widgets/core/workspace-slide/slide-model";

const SlideSubgridLayout = legacyWidthProvider(LegacyGridLayout);
const FITTED_REGION_ITEM_INSET_PX = 4;

export interface WorkspaceSlideSubgridHostItem {
  id: string;
  layout: Pick<LegacyGridLayoutItem, "x" | "y" | "w" | "h">;
  content: ReactNode;
}

export function WorkspaceSlideSubgridHost({
  items,
  editable,
  dragHandleSelector,
  dragCancelSelector,
  onLayoutCommit,
  onDragStart,
  onDragStop,
}: {
  items: WorkspaceSlideSubgridHostItem[];
  editable: boolean;
  dragHandleSelector?: string;
  dragCancelSelector?: string;
  onLayoutCommit?: (
    nextLayout: Array<Pick<WorkspaceGridLayoutItem, "h" | "i" | "w" | "x" | "y">>,
  ) => void;
  onDragStart?: (itemId: string) => void;
  onDragStop?: (
    nextLayout: Array<Pick<WorkspaceGridLayoutItem, "h" | "i" | "w" | "x" | "y">>,
    draggedItem: Pick<WorkspaceGridLayoutItem, "h" | "i" | "w" | "x" | "y">,
  ) => void;
}) {
  const layout = useMemo<LegacyGridLayoutLayout>(
    () =>
      items.map((item) => ({
        i: item.id,
        x: item.layout.x,
        y: item.layout.y,
        w: item.layout.w,
        h: item.layout.h,
      })),
    [items],
  );

  return (
    <div className={editable ? "h-full min-h-0 w-full overflow-auto" : "h-full min-h-0 w-full overflow-hidden"}>
      <SlideSubgridLayout
        className="layout min-h-full"
        cols={WORKSPACE_SLIDE_GRID_COLUMNS}
        rowHeight={WORKSPACE_SLIDE_GRID_ROW_HEIGHT}
        margin={[0, 0]}
        containerPadding={[0, 0]}
        layout={layout}
        compactType="vertical"
        autoSize={editable}
        isBounded
        preventCollision={false}
        isDraggable={editable}
        isResizable={editable}
        draggableHandle={dragHandleSelector}
        draggableCancel={dragCancelSelector}
        onDragStart={(_nextLayout, _oldItem, newItem) => {
          if (!editable || !newItem?.i) {
            return;
          }

          onDragStart?.(newItem.i);
        }}
        onDragStop={(nextLayout, _oldItem, newItem) => {
          if (!editable) {
            return;
          }

          const normalizedLayout = nextLayout.map(({ h, i, w, x, y }) => ({
            h,
            i,
            w,
            x,
            y,
          }));

          if (newItem && onDragStop) {
            onDragStop?.(normalizedLayout, {
              h: newItem.h,
              i: newItem.i,
              w: newItem.w,
              x: newItem.x,
              y: newItem.y,
            });
            return;
          }

          onLayoutCommit?.(normalizedLayout);
        }}
        onResizeStop={(nextLayout) => {
          if (!editable) {
            return;
          }

          onLayoutCommit?.(
            nextLayout.map(({ h, i, w, x, y }) => ({
              h,
              i,
              w,
              x,
              y,
            })),
          );
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="box-border h-full min-h-0 min-w-0 overflow-hidden"
            style={{ padding: `${FITTED_REGION_ITEM_INSET_PX}px` }}
          >
            {item.content}
          </div>
        ))}
      </SlideSubgridLayout>
    </div>
  );
}
