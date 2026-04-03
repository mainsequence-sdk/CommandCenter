import {
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
  BarChart3,
  Boxes,
  Clock3,
  Database,
  Table,
} from "lucide-react";

import { cn, titleCase } from "@/lib/utils";
import type { WidgetInstancePresentation, WidgetDefinition } from "@/widgets/types";

function resolveWidgetRailIcon(widget: WidgetDefinition) {
  if (widget.railIcon) {
    return widget.railIcon;
  }

  if (/data-node/i.test(widget.id) || /data node/i.test(widget.title)) {
    return Database;
  }

  if (widget.kind === "chart") {
    return BarChart3;
  }

  if (widget.kind === "table") {
    return Table;
  }

  if (widget.kind === "feed") {
    return Clock3;
  }

  return Boxes;
}

function resolveWidgetRailStatusDotClass(runtimeState?: Record<string, unknown>) {
  const status = typeof runtimeState?.status === "string" ? runtimeState.status : null;

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

  return "bg-muted-foreground/55";
}

function resolveWidgetRailStatusLabel(runtimeState?: Record<string, unknown>) {
  const status = typeof runtimeState?.status === "string" ? runtimeState.status : null;

  if (!status) {
    return "Idle";
  }

  return titleCase(status.replaceAll("_", " "));
}

function isWidgetRailLoading(runtimeState?: Record<string, unknown>) {
  return runtimeState?.status === "loading";
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
  runtimeState,
}: {
  title: string;
  widget: WidgetDefinition;
  runtimeState?: Record<string, unknown>;
}) {
  const statusLabel = resolveWidgetRailStatusLabel(runtimeState);

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

export function WorkspaceWidgetRail({
  widgets,
  activeInstanceId,
  topOffsetClassName,
  onOpenWidget,
}: {
  widgets: Array<{
    id: string;
    title?: string;
    props?: Record<string, unknown>;
    presentation?: WidgetInstancePresentation;
    runtimeState?: Record<string, unknown>;
    widget: WidgetDefinition;
  }>;
  activeInstanceId: string | null;
  topOffsetClassName: string;
  onOpenWidget: (instanceId: string) => void;
}) {
  if (widgets.length === 0) {
    return null;
  }

  return (
    <aside
      className={cn(
        "pointer-events-auto absolute left-2 bottom-4 z-30 flex w-8 flex-col items-center gap-1 overflow-hidden",
        topOffsetClassName,
      )}
      aria-label="Canvas widget rail"
    >
      {widgets.map(({ id, title, props, presentation, runtimeState, widget }) => {
        const Icon = resolveWidgetRailIcon(widget);
        const active = activeInstanceId === id;
        const dotClassName = resolveWidgetRailStatusDotClass(runtimeState);
        const loading = isWidgetRailLoading(runtimeState);
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
    </aside>
  );
}
