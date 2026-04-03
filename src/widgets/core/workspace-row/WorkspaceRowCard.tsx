import type { ReactNode } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

const hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeWorkspaceRowColor(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : null;
}

export interface WorkspaceRowCardProps {
  title: string;
  accentColor?: string;
  childCount?: number;
  collapsed?: boolean;
  editable?: boolean;
  selected?: boolean;
  className?: string;
  showCollapseToggle?: boolean;
  showDragHint?: boolean;
  trailingContent?: ReactNode;
  onToggleCollapse?: () => void;
}

export function WorkspaceRowCard({
  title,
  accentColor,
  childCount = 0,
  collapsed = false,
  editable = false,
  selected = false,
  className,
  showCollapseToggle = false,
  showDragHint = false,
  trailingContent,
  onToggleCollapse,
}: WorkspaceRowCardProps) {
  const { resolvedTokens } = useTheme();
  const rowColor = normalizeWorkspaceRowColor(accentColor) ?? resolvedTokens.primary;
  const childLabel =
    childCount > 0 ? `${childCount} ${childCount === 1 ? "widget" : "widgets"}` : null;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 items-center justify-between overflow-hidden px-2.5 text-card-foreground",
        selected ? "text-foreground" : undefined,
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 border-y border-border/70"
        style={{
          borderTopColor: withAlpha(rowColor, selected ? 0.46 : 0.34),
          borderBottomColor: withAlpha(rowColor, selected ? 0.56 : 0.42),
          background: `linear-gradient(180deg, ${withAlpha(rowColor, selected ? 0.18 : 0.12)} 0%, ${withAlpha(
            rowColor,
            selected ? 0.1 : 0.06,
          )} 100%)`,
          boxShadow: `inset 0 1px 0 ${withAlpha(rowColor, 0.08)}, inset 0 -1px 0 ${withAlpha(
            rowColor,
            0.18,
          )}`,
        }}
      />

      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{
          backgroundColor: withAlpha(rowColor, selected ? 0.72 : 0.56),
        }}
      />

      <div className="relative z-10 min-w-0 flex items-center gap-1.5">
        {showCollapseToggle ? (
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            data-no-widget-drag="true"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse?.();
            }}
          >
            {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        ) : null}

        <span
          className="truncate text-[10px] font-semibold uppercase tracking-[0.15em]"
          style={{ color: rowColor }}
        >
          {title}
        </span>

        {childLabel ? (
          <span className="truncate text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {childLabel}
          </span>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center gap-1">
        {showDragHint ? (
          <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Drag row
          </span>
        ) : null}
        {trailingContent}
      </div>
    </div>
  );
}
