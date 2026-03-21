import type { AnchorHTMLAttributes } from "react";

import { BookOpenText } from "lucide-react";

import { getWidgetExplorerPath } from "@/features/widgets/widget-explorer";
import { cn } from "@/lib/utils";

export function WidgetExplorerTrigger({
  className,
  widgetId,
  widgetTitle,
  ...props
}: {
  widgetId: string;
  widgetTitle: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={getWidgetExplorerPath(widgetId)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open widget guide for ${widgetTitle} in a new tab`}
      title={`Open widget guide for ${widgetTitle} in a new tab`}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-topbar-foreground",
        className,
      )}
      {...props}
    >
      <BookOpenText className="h-3.5 w-3.5" />
    </a>
  );
}
