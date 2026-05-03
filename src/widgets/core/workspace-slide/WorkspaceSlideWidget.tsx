import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  sanitizeWorkspaceSlideProps,
  WORKSPACE_SLIDE_BAND_SLOT_IDS,
  type WorkspaceSlideBandId,
  type WorkspaceSlideBandSlotId,
  type WorkspaceSlideBandSlots,
  type WorkspaceSlideRegionId,
  type WorkspaceSlideSlotContent,
  type WorkspaceSlideWidgetProps,
} from "./slide-model";

const MIN_BODY_HEIGHT_PCT = 22;
const MIN_BAND_HEIGHT_PCT = 5;
const SLIDE_ASPECT_RATIO = 16 / 9;
const SLIDE_LOGICAL_WIDTH_PX = 1280;
const SLIDE_LOGICAL_HEIGHT_PX = SLIDE_LOGICAL_WIDTH_PX / SLIDE_ASPECT_RATIO;

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

function resolveBandSlotAlignment(slotId: WorkspaceSlideBandSlotId) {
  switch (slotId) {
    case "left":
      return "items-start text-left";
    case "right":
      return "items-end text-right";
    case "middle":
    default:
      return "items-center text-center";
  }
}

function renderBandSlotPlaceholder(label: string) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-dashed border-border/60 bg-background/28 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/85">
      <Plus className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function renderBandSlotContent(
  slot: WorkspaceSlideSlotContent,
  options: {
    editable: boolean;
    bandId: WorkspaceSlideBandId;
    slotId: WorkspaceSlideBandSlotId;
  },
) {
  if (slot.type === "text") {
    if (!slot.text?.trim()) {
      return options.editable ? renderBandSlotPlaceholder("Add text") : null;
    }

    return (
      <div className="max-w-full whitespace-pre-wrap break-words text-[14px] font-medium leading-5 text-foreground/92">
        {slot.text}
      </div>
    );
  }

  if (slot.type === "image") {
    if (!slot.imageUrl?.trim()) {
      return options.editable ? renderBandSlotPlaceholder("Add image") : null;
    }

    return (
      <img
        src={slot.imageUrl}
        alt={slot.imageAlt ?? ""}
        className="max-h-full max-w-full object-contain"
      />
    );
  }

  return options.editable ? renderBandSlotPlaceholder("Add element") : null;
}

function SlideBandSlots({
  editable,
  bandId,
  slots,
}: {
  editable: boolean;
  bandId: WorkspaceSlideBandId;
  slots: WorkspaceSlideBandSlots;
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-3 gap-3">
      {WORKSPACE_SLIDE_BAND_SLOT_IDS.map((slotId) => (
        <div
          key={`${bandId}-${slotId}`}
          className={cn(
            "flex min-h-0 min-w-0",
            resolveBandSlotAlignment(slotId),
          )}
        >
          <div
            className={cn(
              "flex h-full min-h-0 w-full min-w-0",
              resolveBandSlotAlignment(slotId),
              slotId === "middle" ? "justify-center" : slotId === "right" ? "justify-end" : "justify-start",
            )}
          >
            {renderBandSlotContent(slots[slotId], {
              editable,
              bandId,
              slotId,
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function resolveSlideFrameFit(bounds: { width: number; height: number } | null) {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    return {
      frameWidth: SLIDE_LOGICAL_WIDTH_PX,
      frameHeight: SLIDE_LOGICAL_HEIGHT_PX,
      scale: 1,
    };
  }

  let frameWidth = bounds.width;
  let frameHeight = frameWidth / SLIDE_ASPECT_RATIO;

  if (frameHeight > bounds.height) {
    frameHeight = bounds.height;
    frameWidth = frameHeight * SLIDE_ASPECT_RATIO;
  }

  return {
    frameWidth,
    frameHeight,
    scale: frameWidth / SLIDE_LOGICAL_WIDTH_PX,
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
      <div
        className={cn(
          "h-full min-h-0",
          editable && regionId === "body" ? "overflow-auto" : "overflow-hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function WorkspaceSlideSurface({
  active = false,
  editable,
  maximizeFrame = false,
  onSlideChange,
  overlayContent,
  regionContent,
  slide,
  slideWidgetId,
}: {
  active?: boolean;
  editable: boolean;
  maximizeFrame?: boolean;
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
    kind: "header" | "footer";
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
    if (!dividerDrag || !onSlideChange) {
      return undefined;
    }

    const currentDrag: NonNullable<typeof dividerDrag> = dividerDrag;
    const handleSlideChange: NonNullable<typeof onSlideChange> = onSlideChange;

    function handlePointerMove(event: PointerEvent) {
      const { rect, kind, base } = currentDrag;
      const relativeY = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * 100 : 0;

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
    kind: "header" | "footer",
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

  const slideFrameFit = resolveSlideFrameFit(surfaceBounds);
  const frameShellStyle: CSSProperties = {
    width: `${slideFrameFit.frameWidth}px`,
    height: `${slideFrameFit.frameHeight}px`,
  };
  const rootTransformStyle: CSSProperties = {
    width: `${SLIDE_LOGICAL_WIDTH_PX}px`,
    height: `${SLIDE_LOGICAL_HEIGHT_PX}px`,
    transform: `scale(${slideFrameFit.scale})`,
    transformOrigin: "top left",
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
          maximizeFrame
            ? overlayContent
              ? "px-0 pb-0 pt-0 xl:pb-4 xl:pt-16"
              : "px-0 py-0 xl:py-4"
            : overlayContent
              ? "px-0 pb-4 pt-16"
              : "py-4",
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
              "relative overflow-hidden bg-background",
              maximizeFrame
                ? "rounded-none border-0 shadow-none xl:rounded-[calc(var(--radius)-6px)] xl:border xl:shadow-[0_34px_90px_-42px_hsl(var(--foreground)/0.42),0_10px_24px_-18px_hsl(var(--foreground)/0.18)]"
                : "rounded-[calc(var(--radius)-6px)] border shadow-[0_34px_90px_-42px_hsl(var(--foreground)/0.42),0_10px_24px_-18px_hsl(var(--foreground)/0.18)]",
              active
                ? "border-primary/75 ring-2 ring-primary/24"
                : "border-primary/42",
            )}
            style={rootTransformStyle}
          >
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 rounded-[inherit]",
                maximizeFrame
                  ? "border-0 shadow-none xl:border xl:border-primary/18 xl:shadow-[inset_0_1px_0_hsl(var(--background)/0.92),inset_0_0_0_1px_hsl(var(--primary)/0.12),inset_0_-18px_40px_-32px_hsl(var(--primary)/0.16)]"
                  : "border border-primary/18 shadow-[inset_0_1px_0_hsl(var(--background)/0.92),inset_0_0_0_1px_hsl(var(--primary)/0.12),inset_0_-18px_40px_-32px_hsl(var(--primary)/0.16)]",
              )}
            />

            {editable && slide.headerEnabled ? (
              <div
                data-no-widget-drag="true"
                className="absolute z-10 h-2 -translate-y-1/2 cursor-row-resize"
                style={{
                  left: "0%",
                  right: "0%",
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
                  left: "0%",
                  right: "0%",
                  top: `${100 - slide.footerHeightPct}%`,
                }}
                onPointerDown={(event) => {
                  beginDividerDrag("footer", event);
                }}
              />
            ) : null}

            <div className="h-full w-full p-5">
              <div
                className="grid h-full w-full min-h-0"
                style={resolveSlideCanvasCenterRowsStyle(slide)}
              >
                {slide.headerEnabled ? (
                  <div className={editable ? "min-h-0 border-b border-border/50 pb-3" : "min-h-0 pb-3"}>
                    <SlideBandSlots editable={editable} bandId="header" slots={slide.headerSlots} />
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
                    <SlideBandSlots editable={editable} bandId="footer" slots={slide.footerSlots} />
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
