import { useMemo, type ReactNode } from "react";
import LegacyGridLayout, {
  WidthProvider as legacyWidthProvider,
  type Layout as LegacyGridLayoutLayout,
} from "react-grid-layout/legacy";

import {
  WORKSPACE_SLIDE_GRID_COLUMNS,
  WORKSPACE_SLIDE_GRID_ROW_HEIGHT,
} from "@/widgets/core/workspace-slide/slide-model";

const SlideSubgridLayout = legacyWidthProvider(LegacyGridLayout);
const FITTED_REGION_ITEM_INSET_PX = 4;

export interface WorkspaceSlideSubgridHostItem {
  id: string;
  layout: Pick<LegacyGridLayoutLayout, "x" | "y" | "w" | "h">;
  content: ReactNode;
}

export function WorkspaceSlideSubgridHost({
  items,
  editable,
  dragHandleSelector,
  dragCancelSelector,
  onLayoutCommit,
}: {
  items: WorkspaceSlideSubgridHostItem[];
  editable: boolean;
  dragHandleSelector?: string;
  dragCancelSelector?: string;
  onLayoutCommit?: (nextLayout: LegacyGridLayoutLayout[]) => void;
}) {
  const layout = useMemo<LegacyGridLayoutLayout[]>(
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
    <div className="h-full min-h-0 w-full overflow-hidden">
      <SlideSubgridLayout
        className="layout h-full min-h-0"
        cols={WORKSPACE_SLIDE_GRID_COLUMNS}
        rowHeight={WORKSPACE_SLIDE_GRID_ROW_HEIGHT}
        margin={[0, 0]}
        containerPadding={[0, 0]}
        layout={layout}
        compactType="vertical"
        autoSize={false}
        isBounded
        preventCollision={false}
        isDraggable={editable}
        isResizable={editable}
        draggableHandle={dragHandleSelector}
        draggableCancel={dragCancelSelector}
        onDragStop={(nextLayout) => {
          if (!editable) {
            return;
          }

          onLayoutCommit?.(nextLayout);
        }}
        onResizeStop={(nextLayout) => {
          if (!editable) {
            return;
          }

          onLayoutCommit?.(nextLayout);
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
