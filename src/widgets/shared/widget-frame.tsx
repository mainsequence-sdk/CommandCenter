import type { CSSProperties, ReactNode } from "react";

import { GripHorizontal, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WidgetDefinition } from "@/widgets/types";

export function WidgetFrame({
  widget,
  instance,
  style,
  children,
}: {
  widget: WidgetDefinition;
  instance: { title?: string };
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section
      style={style}
      className="group flex min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border/80 bg-card/88 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
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
        <GripHorizontal className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </header>
      <div className="min-h-0 flex-1 p-4">{children}</div>
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
      style={style}
      className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-dashed border-border/80 bg-card/60 p-4 text-card-foreground"
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
  style,
}: {
  widgetId: string;
  style?: CSSProperties;
}) {
  return (
    <section
      style={style}
      className={cn(
        "flex min-h-0 items-center justify-center rounded-[var(--radius)] border border-dashed border-danger/40 bg-danger/5 p-5 text-center text-sm text-muted-foreground",
      )}
    >
      Widget <span className="mx-1 font-mono text-foreground">{widgetId}</span> is not registered.
    </section>
  );
}
