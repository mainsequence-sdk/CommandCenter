import {
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  Loader2,
} from "lucide-react";

import {
  useDashboardWidgetExecution,
  type WidgetExecutionState,
} from "@/dashboards/DashboardWidgetExecution";
import { cn, titleCase } from "@/lib/utils";
import type { WidgetInstancePresentation, WidgetDefinition } from "@/widgets/types";
import { resolveWorkspaceWidgetIcon } from "./workspace-widget-icons";

const WORKSPACE_RAIL_SCROLL_TRACK_HEIGHT_PX = 128;
const WORKSPACE_RAIL_SCROLL_THUMB_HEIGHT_PX = 10;

function resolveRuntimeStatus(runtimeState?: Record<string, unknown>) {
  return typeof runtimeState?.status === "string" ? runtimeState.status : null;
}

function resolveWidgetRailStatusDotClass({
  executionState,
  runtimeState,
}: {
  executionState?: WidgetExecutionState;
  runtimeState?: Record<string, unknown>;
}) {
  if (executionState?.status === "error") {
    return "bg-danger";
  }

  if (executionState?.status === "running") {
    return "bg-primary";
  }

  if (executionState?.status === "success") {
    return "bg-success";
  }

  const status = resolveRuntimeStatus(runtimeState);

  if (status === "error" || status === "data_error" || status === "detail_error") {
    return "bg-danger";
  }

  if (status === "range") {
    return "bg-warning";
  }

  if (status === "loading") {
    return "bg-primary";
  }

  if (status === "ready") {
    return "bg-success";
  }

  return "bg-success";
}

function resolveWidgetRailStatusLabel({
  executionState,
  runtimeState,
}: {
  executionState?: WidgetExecutionState;
  runtimeState?: Record<string, unknown>;
}) {
  if (executionState?.status === "running") {
    return "Running";
  }

  if (executionState?.status === "error") {
    return executionState.error?.trim() ? "Execution error" : "Error";
  }

  if (executionState?.status === "success") {
    return "Ready";
  }

  const status = resolveRuntimeStatus(runtimeState);

  if (!status) {
    return "Ready";
  }

  return titleCase(status.replaceAll("_", " "));
}

function isWidgetRailLoading({
  executionState,
  runtimeState,
}: {
  executionState?: WidgetExecutionState;
  runtimeState?: Record<string, unknown>;
}) {
  return executionState?.status === "running" || runtimeState?.status === "loading";
}

function RailHoverCard({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      return undefined;
    }

    function updatePosition() {
      const rect = anchorRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const offset = 10;
      const cardWidth = 220;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const top = Math.min(
        Math.max(rect.top - 8, 12),
        viewportHeight - 140,
      );
      const left = Math.min(rect.right + offset, viewportWidth - cardWidth - 12);

      setStyle({
        left,
        top,
      });
    }

    let frameId = 0;

    const updatePortalPosition = () => {
      updatePosition();
      frameId = window.requestAnimationFrame(updatePortalPosition);
    };

    updatePortalPosition();

    window.addEventListener("resize", updatePortalPosition);
    window.addEventListener("scroll", updatePortalPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePortalPosition);
      window.removeEventListener("scroll", updatePortalPosition, true);
    };
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className="relative inline-flex"
      onPointerEnter={() => {
        setOpen(true);
      }}
      onPointerLeave={() => {
        setOpen(false);
      }}
      onFocus={() => {
        setOpen(true);
      }}
      onBlur={() => {
        setOpen(false);
      }}
    >
      {children}
      {open && style && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-40"
              style={style}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

function DefaultWidgetRailSummary({
  title,
  widget,
  executionState,
  runtimeState,
}: {
  title: string;
  widget: WidgetDefinition;
  executionState?: WidgetExecutionState;
  runtimeState?: Record<string, unknown>;
}) {
  const statusLabel = resolveWidgetRailStatusLabel({
    executionState,
    runtimeState,
  });

  return (
    <div className="pointer-events-none z-20 w-[220px] rounded-[calc(var(--radius)-4px)] border border-border/80 bg-popover/95 p-3 text-left shadow-xl backdrop-blur-sm">
      <div className="truncate text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{widget.title}</div>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium text-foreground">{statusLabel}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Kind</span>
          <span className="font-medium text-foreground">{titleCase(widget.kind)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Source</span>
          <span className="max-w-[120px] text-right font-medium text-foreground">
            {widget.source}
          </span>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceToolbarButton({
  active = false,
  className,
  children,
  title,
  ...props
}: {
  active?: boolean;
  children: ReactNode;
  title: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      className={cn(
        "relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-[calc(var(--radius)-8px)] border border-border/70 bg-card/82 text-foreground shadow-sm transition-[background-color,border-color,color,transform,box-shadow] hover:-translate-y-px hover:border-primary/30 hover:bg-muted/55 hover:text-foreground hover:shadow-[0_10px_22px_-16px_hsl(var(--foreground)/0.55)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-primary/60 bg-muted/45 text-foreground shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.72)]"
          : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function WorkspaceSavingStatus({
  label = "Saving workspace…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/82 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-sm",
        className,
      )}
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      <span>{label}</span>
    </div>
  );
}

export function WorkspaceWidgetRail({
  widgets,
  activeInstanceId,
  topOffsetClassName,
  onOpenWidget,
  scrollSync,
}: {
  widgets: Array<{
    id: string;
    title?: string;
    layout?: {
      x: number;
      y: number;
    };
    props?: Record<string, unknown>;
    presentation?: WidgetInstancePresentation;
    runtimeState?: Record<string, unknown>;
    widget: WidgetDefinition;
  }>;
  activeInstanceId: string | null;
  topOffsetClassName: string;
  onOpenWidget: (instanceId: string) => void;
  scrollSync?: {
    progress: number;
    canScroll: boolean;
    onProgressChange: (progress: number) => void;
  };
}) {
  const widgetExecution = useDashboardWidgetExecution();
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const listContentRef = useRef<HTMLDivElement | null>(null);
  const [listMaxOffset, setListMaxOffset] = useState(0);
  const orderedWidgets = useMemo(
    () =>
      [...widgets].sort((left, right) => {
        const leftY = left.layout?.y ?? Number.MAX_SAFE_INTEGER;
        const rightY = right.layout?.y ?? Number.MAX_SAFE_INTEGER;

        if (leftY !== rightY) {
          return leftY - rightY;
        }

        const leftX = left.layout?.x ?? Number.MAX_SAFE_INTEGER;
        const rightX = right.layout?.x ?? Number.MAX_SAFE_INTEGER;

        if (leftX !== rightX) {
          return leftX - rightX;
        }

        const leftLabel = (left.title ?? left.widget.title ?? left.id).trim().toLowerCase();
        const rightLabel = (right.title ?? right.widget.title ?? right.id).trim().toLowerCase();

        if (leftLabel !== rightLabel) {
          return leftLabel.localeCompare(rightLabel);
        }

        return left.id.localeCompare(right.id);
      }),
    [widgets],
  );
  const clampedScrollProgress = Math.min(1, Math.max(0, scrollSync?.progress ?? 0));
  const listOffset = scrollSync?.canScroll ? clampedScrollProgress * listMaxOffset : 0;
  const trackTravelPx = WORKSPACE_RAIL_SCROLL_TRACK_HEIGHT_PX - WORKSPACE_RAIL_SCROLL_THUMB_HEIGHT_PX;
  const thumbOffsetPx = scrollSync?.canScroll ? clampedScrollProgress * trackTravelPx : 0;

  useLayoutEffect(() => {
    const viewport = listViewportRef.current;
    const content = listContentRef.current;

    if (!viewport || !content || typeof window === "undefined") {
      setListMaxOffset(0);
      return undefined;
    }

    const viewportElement = viewport;
    const contentElement = content;

    function updateOffsets() {
      const nextMaxOffset = Math.max(
        0,
        contentElement.scrollHeight - viewportElement.clientHeight,
      );
      setListMaxOffset((current) => (current === nextMaxOffset ? current : nextMaxOffset));
    }

    updateOffsets();

    const resizeObserver = new ResizeObserver(() => {
      updateOffsets();
    });

    resizeObserver.observe(viewportElement);
    resizeObserver.observe(contentElement);
    window.addEventListener("resize", updateOffsets);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOffsets);
    };
  }, [orderedWidgets.length]);

  if (orderedWidgets.length === 0) {
    return null;
  }

  function updateScrollProgressFromPointer(clientY: number, trackElement: HTMLDivElement) {
    if (!scrollSync?.canScroll) {
      return;
    }

    const rect = trackElement.getBoundingClientRect();
    const relativeY = clientY - rect.top - WORKSPACE_RAIL_SCROLL_THUMB_HEIGHT_PX / 2;
    const nextProgress =
      trackTravelPx > 0
        ? Math.min(1, Math.max(0, relativeY / trackTravelPx))
        : 0;

    scrollSync.onProgressChange(nextProgress);
  }

  return (
    <aside
      className={cn(
        "pointer-events-auto absolute left-2 bottom-4 z-30 flex w-8 flex-col items-center gap-1 overflow-hidden",
        topOffsetClassName,
      )}
      aria-label="Canvas widget rail"
    >
      <div ref={listViewportRef} className="min-h-0 flex-1 overflow-hidden">
        <div
          ref={listContentRef}
          className="flex flex-col items-center gap-1 will-change-transform"
          style={{
            transform: listOffset > 0 ? `translateY(-${listOffset}px)` : undefined,
          }}
        >
          {orderedWidgets.map(({ id, title, props, presentation, runtimeState, widget }) => {
            const Icon = resolveWorkspaceWidgetIcon(widget);
            const active = activeInstanceId === id;
            const executionState = widgetExecution?.getExecutionState(id);
            const dotClassName = resolveWidgetRailStatusDotClass({
              executionState,
              runtimeState,
            });
            const loading = isWidgetRailLoading({
              executionState,
              runtimeState,
            });
            const RailSummary =
              widget.railSummaryComponent as
                | ComponentType<{
                    title: string;
                    instanceId?: string;
                    props: Record<string, unknown>;
                    presentation?: WidgetInstancePresentation;
                    runtimeState?: Record<string, unknown>;
                  }>
                | undefined;
            const displayTitle = title ?? widget.title;
            const summaryContent = RailSummary ? (
              <RailSummary
                title={displayTitle}
                instanceId={id}
                props={(props ?? {}) as Record<string, unknown>}
                presentation={presentation}
                runtimeState={runtimeState}
              />
            ) : (
              <DefaultWidgetRailSummary
                title={displayTitle}
                widget={widget}
                executionState={executionState}
                runtimeState={runtimeState}
              />
            );

            return (
              <RailHoverCard key={id} content={summaryContent}>
                <button
                  type="button"
                  className={cn(
                    "relative flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                    active ? "text-primary" : undefined,
                  )}
                  aria-label={`Open settings for ${displayTitle}`}
                  title={displayTitle}
                  onClick={() => {
                    onOpenWidget(id);
                  }}
                >
                  <Icon className={cn("h-4 w-4", loading ? "animate-spin" : undefined)} />
                  <span
                    className={cn(
                      "absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full",
                      dotClassName,
                      loading ? "animate-pulse" : undefined,
                    )}
                  />
                </button>
              </RailHoverCard>
            );
          })}
        </div>
      </div>

      {scrollSync ? (
        <div className="flex w-full items-center justify-center pt-2 pb-1">
          <div
            className={cn(
              "relative flex w-5 justify-center",
              scrollSync.canScroll ? "cursor-pointer" : "opacity-40",
            )}
            style={{ height: `${WORKSPACE_RAIL_SCROLL_TRACK_HEIGHT_PX}px` }}
            onPointerDown={(event) => {
              const track = event.currentTarget;
              updateScrollProgressFromPointer(event.clientY, track);
              track.setPointerCapture(event.pointerId);

              const handlePointerMove = (moveEvent: PointerEvent) => {
                updateScrollProgressFromPointer(moveEvent.clientY, track);
              };
              const handlePointerEnd = (endEvent: PointerEvent) => {
                track.releasePointerCapture(endEvent.pointerId);
                track.removeEventListener("pointermove", handlePointerMove);
                track.removeEventListener("pointerup", handlePointerEnd);
                track.removeEventListener("pointercancel", handlePointerEnd);
              };

              track.addEventListener("pointermove", handlePointerMove);
              track.addEventListener("pointerup", handlePointerEnd);
              track.addEventListener("pointercancel", handlePointerEnd);
            }}
            aria-label="Workspace viewport scroller"
            title="Move the workspace viewport"
          >
            <div
              className="absolute left-1/2 top-0 h-full -translate-x-1/2"
              style={{
                width: "16px",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 34%, transparent) 0 2px, transparent 2px 9px)",
                opacity: scrollSync.canScroll ? 0.9 : 0.45,
              }}
            />
            <div
              className={cn(
                "absolute left-1/2 rounded-full transition-[transform,background-color,opacity] duration-150",
                scrollSync.canScroll ? "bg-primary" : "bg-primary/45",
              )}
              style={{
                width: "18px",
                height: "2px",
                boxShadow:
                  "0 0 0 1px color-mix(in srgb, var(--background) 70%, transparent), 0 0 10px color-mix(in srgb, var(--primary) 32%, transparent)",
                opacity: scrollSync.canScroll ? 1 : 0.7,
                transform: `translate(-50%, ${thumbOffsetPx + WORKSPACE_RAIL_SCROLL_THUMB_HEIGHT_PX / 2}px)`,
              }}
            />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
