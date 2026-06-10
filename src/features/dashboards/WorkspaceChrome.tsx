import {
  useEffect,
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
  Network,
  Zap,
} from "lucide-react";

import {
  useDashboardWidgetExecution,
  type WidgetExecutionState,
} from "@/dashboards/DashboardWidgetExecution";
import { useDashboardWidgetDependencies } from "@/dashboards/DashboardWidgetDependencies";
import { listUnresolvedReferenceBackedPropInputs } from "@/dashboards/widget-dependencies";
import {
  resolveWidgetStatusDiagnostics,
  resolveWidgetStatusSummary,
  type WidgetStatusChannel,
  type WidgetStatusSummary,
  type WidgetStatusTone,
} from "@/dashboards/widget-status";
import { formatWidgetSourceLabel } from "@/features/widgets/widget-source-labels";
import { cn, titleCase } from "@/lib/utils";
import type {
  ResolvedWidgetInputs,
  WidgetInstancePresentation,
  WidgetDefinition,
} from "@/widgets/types";
import { resolveWorkspaceWidgetIcon } from "./workspace-widget-icons";

const WORKSPACE_RAIL_SCROLL_TRACK_HEIGHT_PX = 128;
const WORKSPACE_RAIL_SCROLL_THUMB_HEIGHT_PX = 10;

function getWidgetRailStatusDotClass(tone: WidgetStatusTone) {
  switch (tone) {
    case "danger":
      return "bg-danger";
    case "primary":
      return "bg-primary";
    case "success":
      return "bg-success";
    case "warning":
      return "bg-warning";
    default:
      return "bg-muted-foreground/70";
  }
}

function getWidgetRailStatusTextClass(tone: WidgetStatusTone) {
  switch (tone) {
    case "danger":
      return "text-danger";
    case "primary":
      return "text-primary";
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    default:
      return "text-muted-foreground/70";
  }
}

function WidgetRailStatusIndicator({
  loading,
  summary,
}: {
  loading?: boolean;
  summary: WidgetStatusSummary;
}) {
  const primaryDotClassName = getWidgetRailStatusDotClass(summary.tone);

  return (
    <>
      <WidgetRailBindingChannelIndicator
        channel={summary.channels.live}
        position="top-left"
      />
      <WidgetRailBindingChannelIndicator
        channel={summary.channels.seed}
        position="bottom-left"
      />
      <span
        className={cn(
          "absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full",
          primaryDotClassName,
          loading ? "animate-pulse" : undefined,
        )}
      />
    </>
  );
}

function WidgetRailBindingChannelIndicator({
  channel,
  position,
}: {
  channel?: WidgetStatusChannel;
  position: "bottom-left" | "top-left";
}) {
  if (!channel?.present) {
    return null;
  }

  const Icon = channel.kind === "live" ? Zap : Network;
  const positionClassName =
    position === "top-left" ? "-left-1 top-0.5" : "-bottom-0.5 -left-1";

  return (
    <span
      className={cn(
        "absolute flex h-3 w-3 items-center justify-center rounded-full bg-background/95",
        positionClassName,
      )}
      title={channel.label}
    >
      <Icon className={cn("h-2.5 w-2.5", getWidgetRailStatusTextClass(channel.tone))} />
    </span>
  );
}

function isWidgetRailLoading({
  widget,
  executionState,
  dashboardSurfaceHydrationActive,
  runtimeState,
  resolvedInputs,
  hasUnresolvedReferenceInputs,
}: {
  widget?: WidgetDefinition;
  executionState?: WidgetExecutionState;
  dashboardSurfaceHydrationActive?: boolean;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
  hasUnresolvedReferenceInputs?: boolean;
}) {
  return resolveWidgetStatusSummary({
    widget,
    executionState,
    dashboardSurfaceHydrationActive,
    runtimeState,
    resolvedInputs,
    hasUnresolvedReferenceInputs,
  }).isLoading;
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
      setStyle(undefined);
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

      setStyle((current) =>
        current?.left === left && current?.top === top
          ? current
          : {
              left,
              top,
            },
      );
    }

    let frameId = 0;
    const resizeObserver = new ResizeObserver(() => {
      updatePosition();
    });

    const updatePortalPosition = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        updatePosition();
      });
    };

    updatePortalPosition();
    resizeObserver.observe(anchorRef.current);

    window.addEventListener("resize", updatePortalPosition);
    window.addEventListener("scroll", updatePortalPosition, true);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePortalPosition);
      window.removeEventListener("scroll", updatePortalPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return undefined;
    }

    const close = () => {
      setOpen(false);
    };
    const clickedAnchor = (event: MouseEvent) => {
      const anchor = anchorRef.current;

      if (!anchor) {
        return false;
      }

      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      return path.includes(anchor);
    };
    const closeWhenClickOutside = (event: MouseEvent) => {
      if (!clickedAnchor(event)) {
        close();
      }
    };
    const closeWhenPointerLeavesAnchor = (event: PointerEvent) => {
      const rect = anchorRef.current?.getBoundingClientRect();

      if (!rect) {
        close();
        return;
      }

      const tolerance = 3;
      const insideAnchor =
        event.clientX >= rect.left - tolerance &&
        event.clientX <= rect.right + tolerance &&
        event.clientY >= rect.top - tolerance &&
        event.clientY <= rect.bottom + tolerance;

      if (!insideAnchor) {
        close();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("pointermove", closeWhenPointerLeavesAnchor, true);
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("click", closeWhenClickOutside, true);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", closeOnEscape, true);

    return () => {
      window.removeEventListener("pointermove", closeWhenPointerLeavesAnchor, true);
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("click", closeWhenClickOutside, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", closeOnEscape, true);
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
      onPointerCancel={() => {
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
  dashboardSurfaceHydrationActive,
  runtimeState,
  resolvedInputs,
  hasUnresolvedReferenceInputs,
}: {
  title: string;
  widget: WidgetDefinition;
  executionState?: WidgetExecutionState;
  dashboardSurfaceHydrationActive?: boolean;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
  hasUnresolvedReferenceInputs?: boolean;
}) {
  const statusSummary = resolveWidgetStatusSummary({
    widget,
    executionState,
    dashboardSurfaceHydrationActive,
    runtimeState,
    resolvedInputs,
    hasUnresolvedReferenceInputs,
  });
  const statusDiagnostics = resolveWidgetStatusDiagnostics({
    widget,
    executionState,
    dashboardSurfaceHydrationActive,
    runtimeState,
    resolvedInputs,
    hasUnresolvedReferenceInputs,
  });
  const formatStatusToken = (value: string) =>
    titleCase(value.replaceAll("-", " ").replaceAll("+", " + "));

  return (
    <div className="pointer-events-none z-20 w-[280px] rounded-[calc(var(--radius)-4px)] border border-border/80 bg-popover/95 p-3 text-left shadow-xl backdrop-blur-sm">
      <div className="truncate text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{widget.title}</div>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium text-foreground">{statusSummary.label}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Primary</span>
          <span className="font-medium text-foreground">
            {formatStatusToken(statusDiagnostics.primaryStatus)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Lineage</span>
          <span className="font-medium text-foreground">
            {formatStatusToken(statusDiagnostics.outputLineage)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Activity</span>
          <span className="font-medium text-foreground">
            {formatStatusToken(statusDiagnostics.activity)}
          </span>
        </div>
        {statusDiagnostics.channels.live ? (
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Live input</span>
            <span className="max-w-[140px] text-right font-medium text-foreground">
              {statusDiagnostics.channels.live.label}
            </span>
          </div>
        ) : null}
        {statusDiagnostics.channels.seed ? (
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Seed input</span>
            <span className="max-w-[140px] text-right font-medium text-foreground">
              {statusDiagnostics.channels.seed.label}
            </span>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Signals</span>
          <span className="max-w-[140px] text-right font-medium text-foreground">
            {statusDiagnostics.sources.length > 0
              ? statusDiagnostics.sources.join(", ")
              : "local"}
          </span>
        </div>
        {statusDiagnostics.blockedByWidgetId ? (
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Blocked by</span>
            <span className="max-w-[140px] text-right font-medium text-foreground">
              {statusDiagnostics.blockedByWidgetId}
              {statusDiagnostics.blockedByOutputId
                ? ` / ${statusDiagnostics.blockedByOutputId}`
                : ""}
            </span>
          </div>
        ) : null}
        {statusSummary.detail ? (
          <div
            className={cn(
              "rounded-[calc(var(--radius)-8px)] border px-2.5 py-2",
              statusSummary.isError
                ? "border-danger/25 bg-danger/8"
                : "border-warning/25 bg-warning/8",
            )}
          >
            <div
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.14em]",
                statusSummary.isError ? "text-danger" : "text-warning",
              )}
            >
              {statusSummary.isError ? "Issue" : "Attention"}
            </div>
            <div
              className={cn(
                "mt-1 break-words text-xs leading-4",
                statusSummary.isError ? "text-danger" : "text-warning",
              )}
            >
              {statusSummary.detail}
            </div>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Kind</span>
          <span className="font-medium text-foreground">{titleCase(widget.kind)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Source</span>
          <span className="max-w-[120px] text-right font-medium text-foreground">
            {formatWidgetSourceLabel(widget.source)}
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

export function WorkspaceLoadingStatus({
  label = "Loading widget data…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const widgetExecution = useDashboardWidgetExecution();

  if (widgetExecution?.dashboardSurfaceHydrationActive !== true) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-primary shadow-sm",
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
  interactive = true,
  viewportPinned = false,
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
  interactive?: boolean;
  viewportPinned?: boolean;
  scrollSync?: {
    progress: number;
    canScroll: boolean;
    onProgressChange: (progress: number) => void;
  };
}) {
  const widgetExecution = useDashboardWidgetExecution();
  const dependencyModel = useDashboardWidgetDependencies();
  const dashboardSurfaceHydrationActive =
    widgetExecution?.dashboardSurfaceHydrationActive === true;
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
        "pointer-events-auto",
        viewportPinned ? "fixed" : "absolute",
        "left-2 bottom-4 z-40 flex w-8 flex-col items-center gap-1 overflow-hidden",
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
            const Icon = resolveWorkspaceWidgetIcon({
              ...widget,
              props: (props ?? {}) as Record<string, unknown>,
            });
            const active = activeInstanceId === id;
            const executionState = widgetExecution?.getExecutionState(id);
            const resolvedInputs = dependencyModel?.resolveInputs(id);
            const unresolvedReferenceInputs = dependencyModel
              ? listUnresolvedReferenceBackedPropInputs(resolvedInputs)
              : [];
            const hasUnresolvedReferenceInputs = unresolvedReferenceInputs.length > 0;
            const statusSummary = resolveWidgetStatusSummary({
              widget,
              executionState,
              dashboardSurfaceHydrationActive,
              runtimeState,
              resolvedInputs,
              hasUnresolvedReferenceInputs,
            });
            const loading = isWidgetRailLoading({
              widget,
              executionState,
              dashboardSurfaceHydrationActive,
              runtimeState,
              resolvedInputs,
              hasUnresolvedReferenceInputs,
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
                dashboardSurfaceHydrationActive={dashboardSurfaceHydrationActive}
                runtimeState={runtimeState}
                resolvedInputs={resolvedInputs}
                hasUnresolvedReferenceInputs={hasUnresolvedReferenceInputs}
              />
            );

            return (
              <RailHoverCard key={id} content={summaryContent}>
                <div
                  className={cn(
                    "relative flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
                    active ? "text-primary" : undefined,
                  )}
                  aria-label={interactive ? `Open settings for ${displayTitle}` : undefined}
                  title={displayTitle}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : -1}
                  onClick={
                    interactive
                      ? () => {
                          onOpenWidget(id);
                        }
                      : undefined
                  }
                >
                  <Icon className={cn("h-4 w-4", loading ? "animate-spin" : undefined)} />
                  <WidgetRailStatusIndicator loading={loading} summary={statusSummary} />
                </div>
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
