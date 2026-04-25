import { AlertTriangle, Database, Loader2 } from "lucide-react";

import {
  normalizeConnectionQueryProps,
  normalizeConnectionQueryRuntimeState,
  type ConnectionQueryWidgetProps,
} from "./connectionQueryModel";
import { TIMESERIES_FRAME_SOURCE_CONTRACTS } from "@/widgets/shared/timeseries-frame-source";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<ConnectionQueryWidgetProps>;

export function ConnectionQueryWidget({ props, runtimeState }: Props) {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const frame = normalizeConnectionQueryRuntimeState(runtimeState);
  const status = frame?.status ?? "idle";
  const isTimeSeriesFrame = Boolean(
    frame &&
      "contract" in frame &&
      TIMESERIES_FRAME_SOURCE_CONTRACTS.includes(
        frame.contract as (typeof TIMESERIES_FRAME_SOURCE_CONTRACTS)[number],
      ),
  );
  const rowCount = frame && "rows" in frame
    ? frame.rows.length
    : frame
      ? Math.max(0, ...frame.fields.map((field) => field.values.length))
      : 0;
  const columnCount = frame && "columns" in frame
    ? frame.columns.length
    : frame?.fields.length ?? 0;

  return (
    <div className="flex h-full min-h-[160px] flex-col justify-between gap-4 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/50 text-muted-foreground">
          {status === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : status === "error" ? (
            <AlertTriangle className="h-5 w-5 text-danger" />
          ) : (
            <Database className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {normalizedProps.queryModelId ?? "Connection query"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {normalizedProps.connectionRef?.typeId ?? "No connection selected"}
          </div>
        </div>
      </div>

      {status === "error" ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger">
          {frame?.error ?? "Connection query failed."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {isTimeSeriesFrame ? "Points" : "Rows"}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {rowCount.toLocaleString()}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {isTimeSeriesFrame ? "Fields" : "Columns"}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {columnCount.toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
