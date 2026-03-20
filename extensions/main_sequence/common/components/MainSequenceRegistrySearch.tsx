import { useEffect, useRef, useState, type ChangeEventHandler, type ReactNode } from "react";

import { ChevronDown, Search, X, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MainSequenceRegistryBulkAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "primary" | "warning" | "danger";
};

function defaultSelectionSummary(selectionCount: number) {
  return (
    <>
      <span>{selectionCount}</span>
      <span>selected</span>
    </>
  );
}

export function MainSequenceRegistrySearch({
  actionMenuLabel = "Actions",
  accessory,
  bulkActions = [],
  clearSelectionLabel = "Clear",
  onClearSelection,
  renderSelectionSummary = defaultSelectionSummary,
  value,
  onChange,
  placeholder,
  className,
  searchClassName,
  selectionCount = 0,
}: {
  actionMenuLabel?: string;
  accessory?: ReactNode;
  bulkActions?: MainSequenceRegistryBulkAction[];
  clearSelectionLabel?: string;
  onClearSelection?: () => void;
  renderSelectionSummary?: (selectionCount: number) => ReactNode;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  className?: string;
  searchClassName?: string;
  selectionCount?: number;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionsOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [actionsOpen]);

  useEffect(() => {
    if (selectionCount === 0) {
      setActionsOpen(false);
    }
  }, [selectionCount]);

  return (
    <div className={cn("flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {selectionCount > 0 ? (
          <>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              {renderSelectionSummary(selectionCount)}
            </div>
            {bulkActions.length > 0 ? (
              <div className="relative" ref={actionsRef}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActionsOpen((current) => !current)}
                >
                  {actionMenuLabel}
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", actionsOpen ? "rotate-180" : "")}
                  />
                </Button>
                {actionsOpen ? (
                  <div className="absolute top-full left-0 z-20 mt-2 min-w-56 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-popover/95 p-1 shadow-2xl backdrop-blur">
                    {bulkActions.map((action) => {
                      const Icon = action.icon;

                      return (
                        <button
                          key={action.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-[calc(var(--radius)-10px)] px-3 py-2 text-left text-sm transition-colors hover:bg-background/60",
                            action.tone === "danger"
                              ? "text-danger hover:bg-danger/10"
                              : action.tone === "primary"
                                ? "text-primary hover:bg-primary/10"
                              : action.tone === "warning"
                                ? "text-warning hover:bg-warning/10"
                                : "text-foreground",
                          )}
                          onClick={() => {
                            setActionsOpen(false);
                            action.onSelect();
                          }}
                        >
                          {Icon ? <Icon className="h-4 w-4" /> : null}
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
            {onClearSelection ? (
              <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
                <X className="h-4 w-4" />
                {clearSelectionLabel}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {accessory}
        <div className={cn("relative w-full max-w-md", searchClassName)}>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={value} onChange={onChange} placeholder={placeholder} className="pl-9" />
        </div>
      </div>
    </div>
  );
}
