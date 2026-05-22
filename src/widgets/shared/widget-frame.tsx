import type { CSSProperties, ReactNode } from "react";

import { AlertTriangle, GripHorizontal, Loader2, Lock, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useDashboardWidgetExecution,
  useWidgetExecutionState,
} from "@/dashboards/DashboardWidgetExecution";
import { resolveWidgetStatusSummary } from "@/dashboards/widget-status";
import { isWorkspaceRowWidgetId } from "@/dashboards/structural-widgets";
import { cn } from "@/lib/utils";
import {
  resolveWidgetMinimalChrome,
  resolveWidgetTransparentSurface,
  widgetShellClassName,
  widgetShellHeaderClassName,
} from "@/widgets/shared/chrome";
import { WidgetExplorerTrigger } from "@/widgets/shared/widget-explorer-trigger";
import { WidgetSettingsTrigger } from "@/widgets/shared/widget-settings";
import type { WidgetDefinition, WidgetInstancePresentation } from "@/widgets/types";

export function WidgetFrame({
  widget,
  instanceId,
  instance,
  headerActions,
  onOpenSettings,
  showDragHandle,
  showExplorerTrigger,
  showHeader,
  showHeaderMeta,
  presentation,
  runtimeState,
  style,
  children,
}: {
  widget: WidgetDefinition;
  instanceId?: string;
  instance: { title?: string; props?: Record<string, unknown> };
  headerActions?: ReactNode;
  onOpenSettings?: () => void;
  showDragHandle?: boolean;
  showExplorerTrigger?: boolean;
  showHeader?: boolean;
  showHeaderMeta?: boolean;
  presentation?: WidgetInstancePresentation;
  runtimeState?: Record<string, unknown>;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const widgetExecution = useDashboardWidgetExecution();
  const executionState = useWidgetExecutionState(instanceId);
  const headerVisible = showHeader ?? true;
  const headerMetaVisible = showHeaderMeta ?? true;
  const dragHandleVisible = showDragHandle ?? true;
  const minimalChrome = resolveWidgetMinimalChrome(instance.props);
  const transparentSurface = resolveWidgetTransparentSurface(presentation);
  const dividerPresentation =
    (isWorkspaceRowWidgetId(widget.id) || minimalChrome) && !headerVisible;
  const shellStatus = resolveWidgetStatusSummary({
    widget,
    dashboardSurfaceHydrationActive:
      widgetExecution?.dashboardSurfaceHydrationActive === true,
    executionState,
    runtimeState,
  });
  const shellLoading = shellStatus.isLoading;
  const shellLoadingLabel = shellLoading ? shellStatus.label : null;
  const shellError = shellStatus.isError ? shellStatus.detail ?? shellStatus.label : null;

  return (
    <section
      data-widget-shell="default"
      data-widget-shell-loading={shellLoading ? "true" : "false"}
      data-widget-surface={dividerPresentation || transparentSurface ? "bare" : "card"}
      style={style}
      className={cn(
        widgetShellClassName,
        "relative",
        dividerPresentation
          ? "group flex h-full min-h-0 flex-col overflow-visible rounded-none border-none bg-transparent text-card-foreground shadow-none backdrop-blur-0"
          : transparentSurface
            ? "group flex h-full min-h-0 flex-col overflow-visible rounded-none border-none bg-transparent text-card-foreground shadow-none backdrop-blur-0"
            : "group flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-border/80 bg-card/88 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur",
        shellLoading && !dividerPresentation && !transparentSurface
          ? "border-primary/35 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),var(--shadow-panel)]"
          : undefined,
        shellError && !dividerPresentation && !transparentSurface
          ? "border-danger/45 shadow-[0_0_0_1px_color-mix(in_srgb,var(--danger)_20%,transparent),var(--shadow-panel)]"
          : undefined,
      )}
    >
      {shellLoading ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-primary/45 via-primary/80 to-primary/45 animate-pulse"
          />
          {!dividerPresentation ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent animate-pulse"
            />
          ) : null}
        </>
      ) : null}
      {shellLoading && !headerVisible ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20">
          <Badge variant="primary" className="gap-1.5 px-2 py-1 text-[10px] tracking-[0.12em] shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            {shellLoadingLabel}
          </Badge>
        </div>
      ) : null}
      {shellError && !headerVisible ? (
        <div className="pointer-events-none absolute right-3 top-3 z-20">
          <Badge
            variant="danger"
            className="max-w-[260px] gap-1.5 px-2 py-1 text-[10px] tracking-[0.12em] shadow-sm"
            title={shellError}
          >
            Error
          </Badge>
        </div>
      ) : null}
      {headerVisible ? (
        <header
          data-widget-shell-header=""
          className={cn(
            widgetShellHeaderClassName,
            "relative z-10 flex items-center justify-between gap-2 border-b border-border/70 px-3 py-1.5",
          )}
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-5 text-card-foreground">
              {instance.title ?? widget.title}
            </div>
            {headerMetaVisible ? (
              <div className="mt-0.5 flex items-center gap-1.5">
                <Badge variant="neutral" className="px-1.5 py-0.5 text-[9px] tracking-[0.12em]">
                  {widget.kind}
                </Badge>
                {shellLoading ? (
                  <Badge
                    variant="primary"
                    className="gap-1.5 px-1.5 py-0.5 text-[9px] tracking-[0.12em] shadow-sm"
                  >
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    {shellLoadingLabel}
                  </Badge>
                ) : null}
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {widget.source}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {shellLoading ? (
              <Badge
                variant="primary"
                className="gap-1.5 px-2 py-1 text-[10px] tracking-[0.12em] shadow-sm"
                aria-label={`Widget ${shellLoadingLabel?.toLowerCase() ?? "loading"}`}
                title={`Widget ${shellLoadingLabel?.toLowerCase() ?? "loading"}`}
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                {shellLoadingLabel}
              </Badge>
            ) : null}
            {shellError ? (
              <Badge
                variant="danger"
                className="max-w-[240px] px-2 py-1 text-[10px] tracking-[0.12em] shadow-sm"
                title={shellError}
              >
                Error
              </Badge>
            ) : null}
            {headerActions}
            {showExplorerTrigger !== false ? (
              <WidgetExplorerTrigger
                widgetId={widget.id}
                widgetTitle={instance.title ?? widget.title}
              />
            ) : null}
            {onOpenSettings ? (
              <WidgetSettingsTrigger
                widgetTitle={instance.title ?? widget.title}
                onClick={onOpenSettings}
              />
            ) : null}
            {dragHandleVisible ? (
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={cn("relative z-10 min-h-0 flex-1", dividerPresentation ? "p-0" : "p-4")}>
        {children}
      </div>
    </section>
  );
}

export function LockedWidgetFrame({
  title,
  description,
  style,
}: {
  title: string;
  description: string;
  style?: CSSProperties;
}) {
  return (
    <section
      data-widget-shell="locked"
      style={style}
      className={cn(
        widgetShellClassName,
        "flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-dashed border-border/80 bg-card/60 p-4 text-card-foreground",
      )}
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-none border border-border/60 bg-muted/20 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <Lock className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="font-medium">{title}</div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </section>
  );
}

export function MissingWidgetFrame({
  widgetId,
  onRemove,
  style,
}: {
  widgetId: string;
  onRemove?: () => void;
  style?: CSSProperties;
}) {
  return (
    <section
      data-widget-shell="missing"
      style={style}
      className={cn(
        widgetShellClassName,
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-none border border-dashed border-danger/40 bg-danger/5 p-3 text-card-foreground",
      )}
    >
      {onRemove ? (
        <div className="absolute right-2 top-2 z-10">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full border border-danger/25 bg-background/75 text-danger hover:bg-danger/12"
            onClick={onRemove}
            title="Delete legacy widget"
            aria-label="Delete legacy widget"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-none border border-danger/20 bg-danger/8 p-4 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/12 text-danger">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <div className="font-medium text-foreground">Legacy widget unavailable</div>
          <p className="max-w-md text-xs text-muted-foreground sm:text-sm">
            This widget instance points to{" "}
            <span className="font-mono text-foreground">{widgetId}</span>, but that widget definition is
            not registered in the current client. It usually means the widget was removed, renamed, or
            the owning extension is not loaded.
          </p>
        </div>
        {onRemove ? (
          <Button size="sm" variant="danger" onClick={onRemove} className="max-sm:hidden">
            <Trash2 className="h-3.5 w-3.5" />
            Delete legacy widget
          </Button>
        ) : null}
      </div>
    </section>
  );
}
