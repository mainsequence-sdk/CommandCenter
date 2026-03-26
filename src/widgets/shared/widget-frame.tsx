import type { CSSProperties, ReactNode } from "react";

import { AlertTriangle, GripHorizontal, Lock, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isWorkspaceRowWidgetId } from "@/dashboards/structural-widgets";
import { cn } from "@/lib/utils";
import {
  resolveWidgetMinimalChrome,
  widgetShellClassName,
  widgetShellHeaderClassName,
} from "@/widgets/shared/chrome";
import { WidgetExplorerTrigger } from "@/widgets/shared/widget-explorer-trigger";
import { WidgetSettingsTrigger } from "@/widgets/shared/widget-settings";
import type { WidgetDefinition } from "@/widgets/types";

export function WidgetFrame({
  widget,
  instance,
  headerActions,
  onOpenSettings,
  showExplorerTrigger,
  showHeader,
  style,
  children,
}: {
  widget: WidgetDefinition;
  instance: { title?: string; props?: Record<string, unknown> };
  headerActions?: ReactNode;
  onOpenSettings?: () => void;
  showExplorerTrigger?: boolean;
  showHeader?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const headerVisible = showHeader ?? true;
  const minimalChrome = resolveWidgetMinimalChrome(instance.props);
  const dividerPresentation =
    (isWorkspaceRowWidgetId(widget.id) || minimalChrome) && !headerVisible;

  return (
    <section
      data-widget-shell="default"
      style={style}
      className={cn(
        widgetShellClassName,
        dividerPresentation
          ? "group flex h-full min-h-0 flex-col overflow-visible rounded-none border-none bg-transparent text-card-foreground shadow-none backdrop-blur-0"
          : "group flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border/80 bg-card/88 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur",
      )}
    >
      {headerVisible ? (
        <header
          data-widget-shell-header=""
          className={cn(
            widgetShellHeaderClassName,
            "flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3",
          )}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-card-foreground">
              {instance.title ?? widget.title}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="neutral">{widget.kind}</Badge>
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {widget.source}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <GripHorizontal className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </header>
      ) : null}
      <div className={cn("min-h-0 flex-1", dividerPresentation ? "p-0" : "p-4")}>{children}</div>
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
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-dashed border-border/80 bg-card/60 p-4 text-card-foreground",
      )}
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-border/60 bg-muted/20 p-6 text-center">
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
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-dashed border-danger/40 bg-danger/5 p-3 text-card-foreground",
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

      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-danger/20 bg-danger/8 p-4 text-center">
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
