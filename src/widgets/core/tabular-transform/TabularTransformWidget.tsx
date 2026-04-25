import { AlertTriangle, Loader2, Shuffle } from "lucide-react";

import type { WidgetComponentProps } from "@/widgets/types";

import {
  formatTabularTransformSummary,
  normalizeTabularTransformRuntimeState,
  type TabularTransformWidgetProps,
} from "./tabularTransformModel";

type Props = WidgetComponentProps<TabularTransformWidgetProps>;

export function TabularTransformWidget({ props, runtimeState }: Props) {
  const frame = normalizeTabularTransformRuntimeState(runtimeState);
  const status = frame?.status ?? "idle";

  return (
    <div className="flex h-full min-h-[160px] flex-col justify-between gap-4 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/50 text-muted-foreground">
          {status === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : status === "error" ? (
            <AlertTriangle className="h-5 w-5 text-danger" />
          ) : (
            <Shuffle className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {formatTabularTransformSummary(props)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {status === "ready" ? "Transformed dataset" : "Waiting for source dataset"}
          </div>
        </div>
      </div>

      {status === "error" ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger">
          {frame?.error ?? "Transform failed."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Rows
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {(frame?.rows.length ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Columns
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {(frame?.columns.length ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
