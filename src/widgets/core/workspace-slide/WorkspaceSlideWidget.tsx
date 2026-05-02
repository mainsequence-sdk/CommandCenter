import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  sanitizeWorkspaceSlideProps,
  type WorkspaceSlideRegionId,
  type WorkspaceSlideWidgetProps,
} from "./slide-model";

const MIN_CENTER_WIDTH_PCT = 24;
const MIN_SIDE_WIDTH_PCT = 12;
const MIN_BODY_HEIGHT_PCT = 22;
const MIN_BAND_HEIGHT_PCT = 10;
const SLIDE_ASPECT_RATIO = 16 / 9;

function resolveSlideCanvasColumnsStyle(slide: WorkspaceSlideWidgetProps): CSSProperties {
  const columns: string[] = [];

  if (slide.leftEnabled) {
    columns.push(`${slide.leftWidthPct}%`);
  }

  columns.push("minmax(0, 1fr)");

  if (slide.rightEnabled) {
    columns.push(`${slide.rightWidthPct}%`);
  }

  return {
    gridTemplateColumns: columns.join(" "),
  };
}

function resolveSlideCanvasCenterRowsStyle(slide: WorkspaceSlideWidgetProps): CSSProperties {
  const rows: string[] = [];

  if (slide.headerEnabled) {
    rows.push(`${slide.headerHeightPct}%`);
  }

  rows.push("minmax(0, 1fr)");

  if (slide.footerEnabled) {
    rows.push(`${slide.footerHeightPct}%`);
  }

  return {
    gridTemplateRows: rows.join(" "),
  };
}

function clampPercent(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function resolveSlideFrameStyle(bounds: { width: number; height: number } | null): CSSProperties {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return {
      width: "100%",
      height: "100%",
    };
  }

  let frameWidth = bounds.width;
  let frameHeight = frameWidth / SLIDE_ASPECT_RATIO;

  if (frameHeight > bounds.height) {
    frameHeight = bounds.height;
    frameWidth = frameHeight * SLIDE_ASPECT_RATIO;
  }

  return {
    width: `${frameWidth}px`,
    height: `${frameHeight}px`,
  };
}

function SlideRegionSurface({
  children,
  editable,
  regionId,
  slideWidgetId,
}: {
  children?: ReactNode;
  editable: boolean;
  regionId: WorkspaceSlideRegionId;
  slideWidgetId?: string;
}) {
  return (
    <div
      className="group relative h-full min-h-0 overflow-hidden bg-transparent"
      data-workspace-slide-region-id={regionId}
      data-workspace-slide-widget-id={slideWidgetId}
    >
      <div className="h-full min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function WorkspaceSlideSurface({
  active = false,
  editable,
  onSlideChange,
  overlayContent,
  regionContent,
  slide,
  slideWidgetId,
}: {
  active?: boolean;
  editable: boolean;
  onSlideChange?: (next: WorkspaceSlideWidgetProps) => void;
  overlayContent?: ReactNode;
  regionContent?: Partial<Record<WorkspaceSlideRegionId, ReactNode>>;
  slide: WorkspaceSlideWidgetProps;
  slideWidgetId?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [surfaceBounds, setSurfaceBounds] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [dividerDrag, setDividerDrag] = useState<{
    kind: "left" | "right" | "header" | "footer";
    rect: {
      left: number;
      top: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    };
    base: WorkspaceSlideWidgetProps;
  } | null>(null);

  useEffect(() => {
    const currentDrag = dividerDrag;
    const handleSlideChange = onSlideChange;

    if (!currentDrag || !handleSlideChange) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      const { rect, kind, base } = currentDrag;
      const relativeX = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * 100 : 0;
      const relativeY = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * 100 : 0;

      if (kind === "left" && base.leftEnabled) {
        const maxLeft = 100 - (base.rightEnabled ? base.rightWidthPct : 0) - MIN_CENTER_WIDTH_PCT;

        handleSlideChange({
          ...base,
          leftWidthPct: clampPercent(relativeX, MIN_SIDE_WIDTH_PCT, maxLeft),
        });
        return;
      }

      if (kind === "right" && base.rightEnabled) {
        const nextRight = 100 - relativeX;
        const maxRight = 100 - (base.leftEnabled ? base.leftWidthPct : 0) - MIN_CENTER_WIDTH_PCT;

        handleSlideChange({
          ...base,
          rightWidthPct: clampPercent(nextRight, MIN_SIDE_WIDTH_PCT, maxRight),
        });
        return;
      }

      if (kind === "header" && base.headerEnabled) {
        const maxHeader = 100 - (base.footerEnabled ? base.footerHeightPct : 0) - MIN_BODY_HEIGHT_PCT;

        handleSlideChange({
          ...base,
          headerHeightPct: clampPercent(relativeY, MIN_BAND_HEIGHT_PCT, maxHeader),
        });
        return;
      }

      if (kind === "footer" && base.footerEnabled) {
        const nextFooter = 100 - relativeY;
        const maxFooter = 100 - (base.headerEnabled ? base.headerHeightPct : 0) - MIN_BODY_HEIGHT_PCT;

        handleSlideChange({
          ...base,
          footerHeightPct: clampPercent(nextFooter, MIN_BAND_HEIGHT_PCT, maxFooter),
        });
      }
    }

    function handlePointerUp() {
      setDividerDrag(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dividerDrag, onSlideChange]);

  useLayoutEffect(() => {
    function updateBounds() {
      const element = hostRef.current;

      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();

      setSurfaceBounds({
        width: rect.width,
        height: rect.height,
      });
    }

    updateBounds();

    const element = hostRef.current;

    if (!element) {
      return undefined;
    }

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateBounds);

      return () => {
        window.removeEventListener("resize", updateBounds);
      };
    }

    const observer = new ResizeObserver(() => {
      updateBounds();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  function beginDividerDrag(
    kind: "left" | "right" | "header" | "footer",
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!editable || !onSlideChange) {
      return;
    }

    const rect = rootRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDividerDrag({
      kind,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      base: slide,
    });
  }

  const centerInsetLeft = slide.leftEnabled ? `${slide.leftWidthPct}%` : "0%";
  const centerInsetRight = slide.rightEnabled ? `${slide.rightWidthPct}%` : "0%";
  const slideFrameStyle = resolveSlideFrameStyle(surfaceBounds);
  const frameShellStyle: CSSProperties = {
    width: slideFrameStyle.width,
    height: slideFrameStyle.height,
  };

  return (
    <div
      ref={hostRef}
      className={cn(
        "relative h-full min-h-0",
        overlayContent ? "overflow-visible" : "overflow-hidden",
      )}
    >
      <div
        className={cn(
          "flex h-full w-full items-center justify-center",
          overlayContent ? "px-0 pb-4 pt-16" : "py-4",
        )}
      >
        <div
          className="group/slideframe relative flex-none"
          style={frameShellStyle}
        >
          {overlayContent ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 mb-3">
              {overlayContent}
            </div>
          ) : null}

          <div
            ref={rootRef}
            className={cn(
              "relative h-full w-full overflow-hidden rounded-[calc(var(--radius)-6px)] border bg-background shadow-[0_34px_90px_-42px_hsl(var(--foreground)/0.42),0_10px_24px_-18px_hsl(var(--foreground)/0.18)]",
              active
                ? "border-primary/75 ring-2 ring-primary/24"
                : "border-primary/42",
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit] border border-primary/18 shadow-[inset_0_1px_0_hsl(var(--background)/0.92),inset_0_0_0_1px_hsl(var(--primary)/0.12),inset_0_-18px_40px_-32px_hsl(var(--primary)/0.16)]"
            />

            {editable && slide.leftEnabled ? (
              <div
                data-no-widget-drag="true"
                className="absolute top-0 bottom-0 z-10 w-2 -translate-x-1/2 cursor-col-resize"
                style={{ left: `${slide.leftWidthPct}%` }}
                onPointerDown={(event) => {
                  beginDividerDrag("left", event);
                }}
              />
            ) : null}

            {editable && slide.rightEnabled ? (
              <div
                data-no-widget-drag="true"
                className="absolute top-0 bottom-0 z-10 w-2 -translate-x-1/2 cursor-col-resize"
                style={{ left: `${100 - slide.rightWidthPct}%` }}
                onPointerDown={(event) => {
                  beginDividerDrag("right", event);
                }}
              />
            ) : null}

            {editable && slide.headerEnabled ? (
              <div
                data-no-widget-drag="true"
                className="absolute z-10 h-2 -translate-y-1/2 cursor-row-resize"
                style={{
                  left: centerInsetLeft,
                  right: centerInsetRight,
                  top: `${slide.headerHeightPct}%`,
                }}
                onPointerDown={(event) => {
                  beginDividerDrag("header", event);
                }}
              />
            ) : null}

            {editable && slide.footerEnabled ? (
              <div
                data-no-widget-drag="true"
                className="absolute z-10 h-2 -translate-y-1/2 cursor-row-resize"
                style={{
                  left: centerInsetLeft,
                  right: centerInsetRight,
                  top: `${100 - slide.footerHeightPct}%`,
                }}
                onPointerDown={(event) => {
                  beginDividerDrag("footer", event);
                }}
              />
            ) : null}

            <div className="h-full w-full p-5">
              <div className="grid h-full w-full" style={resolveSlideCanvasColumnsStyle(slide)}>
                {slide.leftEnabled ? (
                  <div className={editable ? "min-h-0 border-r border-border/50 pr-3" : "min-h-0 pr-3"}>
                    <SlideRegionSurface
                      editable={editable}
                      regionId="left"
                      slideWidgetId={slideWidgetId}
                    >
                      {regionContent?.left}
                    </SlideRegionSurface>
                  </div>
                ) : null}

                <div
                  className={cn(
                    "grid min-h-0",
                    slide.rightEnabled && editable ? "border-r border-border/50 pr-3" : slide.rightEnabled ? "pr-3" : undefined,
                    slide.leftEnabled ? "pl-3" : undefined,
                  )}
                  style={resolveSlideCanvasCenterRowsStyle(slide)}
                >
                  {slide.headerEnabled ? (
                    <div className={editable ? "min-h-0 border-b border-border/50 pb-3" : "min-h-0 pb-3"}>
                      <SlideRegionSurface
                        editable={editable}
                        regionId="header"
                        slideWidgetId={slideWidgetId}
                      >
                        {regionContent?.header}
                      </SlideRegionSurface>
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "min-h-0",
                      slide.headerEnabled ? "pt-3" : undefined,
                      slide.footerEnabled ? "pb-3" : undefined,
                    )}
                  >
                    <SlideRegionSurface
                      editable={editable}
                      regionId="body"
                      slideWidgetId={slideWidgetId}
                    >
                      {regionContent?.body}
                    </SlideRegionSurface>
                  </div>

                  {slide.footerEnabled ? (
                    <div className={editable ? "min-h-0 border-t border-border/50 pt-3" : "min-h-0 pt-3"}>
                      <SlideRegionSurface
                        editable={editable}
                        regionId="footer"
                        slideWidgetId={slideWidgetId}
                      >
                        {regionContent?.footer}
                      </SlideRegionSurface>
                    </div>
                  ) : null}
                </div>

                {slide.rightEnabled ? (
                  <div className={slide.leftEnabled ? "min-h-0 pl-3" : "min-h-0 pl-3"}>
                    <SlideRegionSurface
                      editable={editable}
                      regionId="right"
                      slideWidgetId={slideWidgetId}
                    >
                      {regionContent?.right}
                    </SlideRegionSurface>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSlideWidget({
  editable = false,
  onPropsChange,
  props,
}: WidgetComponentProps<WorkspaceSlideWidgetProps>) {
  const slide = sanitizeWorkspaceSlideProps(props);

  return (
    <WorkspaceSlideSurface
      slide={slide}
      editable={editable}
      onSlideChange={onPropsChange}
    />
  );
}
