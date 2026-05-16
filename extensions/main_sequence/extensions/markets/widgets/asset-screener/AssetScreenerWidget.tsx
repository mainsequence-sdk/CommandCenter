import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Database, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  normalizeAssetScreenerProps,
  resolveAssetScreenerState,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";
import type {
  MarketAssetScreenerColumn,
  MarketAssetScreenerRow,
  MarketAssetScalarValue,
  MarketAssetValuePoint,
} from "../../widget-contracts/marketAssetFrames";

type Props = WidgetComponentProps<MainSequenceAssetScreenerWidgetProps>;

interface RenderEntry {
  id: string;
  kind: "group" | "row";
  groupLabel?: string;
  row?: MarketAssetScreenerRow;
  count?: number;
}

function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...options,
  }).format(value);
}

function getColumnVisual(row: MarketAssetScreenerRow, column: MarketAssetScreenerColumn) {
  if (column.kind === "asset-field") {
    return row.visuals[column.id] ?? row.visuals[String(column.field)];
  }

  if (column.kind === "sparkline") {
    return row.visuals[column.id] ?? row.visuals[column.valueField];
  }

  return row.visuals[column.id] ?? row.visuals[column.valueField];
}

function formatValue(
  value: MarketAssetScalarValue | undefined,
  column: MarketAssetScreenerColumn,
  row: MarketAssetScreenerRow,
) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value !== "number") {
    return String(value);
  }

  const format = ("format" in column ? column.format : undefined) ?? getColumnVisual(row, column)?.format;

  if (format === "percent") {
    return `${formatNumber(value, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}%`;
  }

  if (format === "currency" || format === "price") {
    return formatNumber(value, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }

  if (format === "volume") {
    return formatNumber(value, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }

  return formatNumber(value);
}

function getColumnValue(row: MarketAssetScreenerRow, column: MarketAssetScreenerColumn) {
  return row.metrics[column.id];
}

function getMetricTone(value: MarketAssetScalarValue | undefined, row: MarketAssetScreenerRow, column: MarketAssetScreenerColumn) {
  const colorScale = getColumnVisual(row, column)?.colorScale;

  if (typeof value !== "number") {
    return "text-foreground";
  }

  if (value === 0) {
    return colorScale?.neutral === "muted" ? "text-muted-foreground" : "text-foreground";
  }

  if (value > 0) {
    return colorScale?.positive === "green" || !colorScale?.positive ? "text-emerald-400" : "text-foreground";
  }

  return colorScale?.negative === "red" || !colorScale?.negative ? "text-rose-400" : "text-foreground";
}

function buildRenderEntries(
  rows: MarketAssetScreenerRow[],
  groupBy: string | undefined,
) {
  if (!groupBy) {
    return rows.map<RenderEntry>((row) => ({
      id: `row:${row.asset.assetKey}`,
      kind: "row",
      row,
    }));
  }

  const groups = new Map<string, MarketAssetScreenerRow[]>();

  rows.forEach((row) => {
    const groupValue = row.asset[groupBy as keyof typeof row.asset];
    const groupLabel = typeof groupValue === "string" && groupValue.trim()
      ? groupValue.trim()
      : "Other";

    groups.set(groupLabel, [...(groups.get(groupLabel) ?? []), row]);
  });

  return Array.from(groups.entries()).flatMap<RenderEntry>(([groupLabel, groupRows]) => [
    {
      id: `group:${groupLabel}`,
      kind: "group",
      groupLabel,
      count: groupRows.length,
    },
    ...groupRows.map<RenderEntry>((row) => ({
      id: `row:${groupLabel}:${row.asset.assetKey}`,
      kind: "row",
      row,
    })),
  ]);
}

function getSparklinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = values.length > 1 ? width / (values.length - 1) : width;

  return values.map((value, index) => {
    const x = index * xStep;
    const y = min === max ? height / 2 : height - ((value - min) / range) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function pointSortValue(point: MarketAssetValuePoint) {
  if (typeof point.observedAtMs === "number") {
    return point.observedAtMs;
  }

  if (typeof point.sequence === "number") {
    return point.sequence;
  }

  return 0;
}

function buildSparklineValues(row: MarketAssetScreenerRow, valueField: string) {
  const referencePoints = Object.values(row.references).filter(
    (point): point is NonNullable<typeof point> => Boolean(point),
  );
  const explicitHistory = row.history.length > 0 ? row.history : [];
  const latestPoints: MarketAssetValuePoint[] = row.latest ? [row.latest] : [];
  const sourcePoints: MarketAssetValuePoint[] = explicitHistory.length >= 2
    ? explicitHistory
    : [...referencePoints, ...explicitHistory, ...latestPoints];
  const seen = new Set<string>();

  return sourcePoints
    .filter((point) => {
      const value = point.values[valueField];

      return typeof value === "number" && Number.isFinite(value);
    })
    .sort((left, right) =>
      pointSortValue(left) - pointSortValue(right),
    )
    .filter((point) => {
      const key = [
        point.assetKey,
        point.observedAtMs ?? "",
        point.sequence ?? "",
        point.values[valueField],
      ].join(":");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map((point) => point.values[valueField])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function Sparkline({
  row,
  valueField,
}: {
  row: MarketAssetScreenerRow;
  valueField: string;
}) {
  const values = buildSparklineValues(row, valueField);
  const path = getSparklinePath(values, 84, 22);

  if (!path || values.length < 2) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <svg
      aria-hidden="true"
      className="h-6 w-24 overflow-visible"
      viewBox="0 0 84 22"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Cell({
  column,
  row,
}: {
  column: MarketAssetScreenerColumn;
  row: MarketAssetScreenerRow;
}) {
  if (column.kind === "sparkline") {
    return (
      <div className="text-primary">
        <Sparkline row={row} valueField={column.valueField} />
      </div>
    );
  }

  const value = getColumnValue(row, column);
  const numericTone =
    column.kind === "return" || column.kind === "latest-value" || column.kind === "reference-value"
      ? getMetricTone(value, row, column)
      : "text-foreground";

  return (
    <span className={numericTone}>
      {formatValue(value, column, row)}
    </span>
  );
}

export function AssetScreenerWidget({
  props,
  resolvedInputs,
  runtimeState,
  runtimeDataStore,
  onPropsChange,
}: Props) {
  const normalizedProps = normalizeAssetScreenerProps(props);
  const [scrollTop, setScrollTop] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const state = useMemo(
    () =>
      resolveAssetScreenerState({
        props: normalizedProps,
        resolvedInputs,
        runtimeDataStore,
        fallbackFrames: isAssetScreenerDemoRuntimeState(runtimeState)
          ? runtimeState.marketAssetScreenerDemoFrames
          : undefined,
      }),
    [normalizedProps, resolvedInputs, runtimeDataStore, runtimeState],
  );
  const entries = useMemo(
    () => buildRenderEntries(state.filteredRows, normalizedProps.groupBy),
    [normalizedProps.groupBy, state.filteredRows],
  );
  const columns = normalizedProps.columns ?? [];
  const rowHeight = normalizedProps.density === "comfortable" ? 34 : 28;
  const headerHeight = 34;
  const overscan = 8;
  const viewportHeight = bodyRef.current?.clientHeight ?? 360;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    entries.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan,
  );
  const visibleEntries = entries.slice(startIndex, endIndex);
  const topPadding = startIndex * rowHeight;
  const bottomPadding = Math.max(0, (entries.length - endIndex) * rowHeight);
  const filterText = normalizedProps.filterText ?? "";

  if (!state.hasAnyBinding && state.rows.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed border-border/70 bg-background/35 p-6 text-center">
        <Database className="h-9 w-9 text-muted-foreground" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Bind market asset data</div>
          <div className="max-w-md text-xs text-muted-foreground">
            Connect latest snapshot data to seedData, historical reference points to referenceData,
            and live price or quote updates to liveUpdates.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[260px] flex-col overflow-hidden rounded-[var(--radius)] border border-border/70 bg-background/80">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-card/80 px-3 py-2">
        <div className="mr-auto min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">Asset Screener</div>
          <div className="text-[11px] text-muted-foreground">
            {state.filteredRows.length.toLocaleString()} of {state.rows.length.toLocaleString()} assets
          </div>
        </div>
        <label className="relative flex min-w-[180px] max-w-[280px] flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-7 text-xs"
            value={filterText}
            placeholder="Filter assets"
            onChange={(event) => {
              onPropsChange?.({
                ...normalizedProps,
                filterText: event.target.value,
              });
            }}
          />
        </label>
      </div>
      <div
        className="grid border-b border-border/70 bg-muted/35 text-[11px] font-medium uppercase tracking-normal text-muted-foreground"
        style={{
          gridTemplateColumns: columns.map((column) => `${column.width ?? 110}px`).join(" "),
          minHeight: headerHeight,
        }}
      >
        {columns.map((column) => (
          <button
            key={column.id}
            className="flex items-center border-r border-border/50 px-2 text-left last:border-r-0 hover:bg-muted/60"
            type="button"
            onClick={() => {
              const currentSort = normalizedProps.sort;
              const nextDirection =
                currentSort?.columnId === column.id && currentSort.direction === "desc"
                  ? "asc"
                  : "desc";

              onPropsChange?.({
                ...normalizedProps,
                sort: {
                  columnId: column.id,
                  direction: nextDirection,
                },
              });
            }}
          >
            <span className="truncate">{column.label}</span>
          </button>
        ))}
      </div>
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-auto text-xs"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: topPadding }} />
        {visibleEntries.map((entry) => {
          if (entry.kind === "group") {
            return (
              <div
                key={entry.id}
                className="flex items-center border-b border-border/60 bg-muted/45 px-2 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground"
                style={{ height: rowHeight }}
              >
                <span className="truncate">{entry.groupLabel}</span>
                <span className="ml-2 rounded border border-border/60 px-1.5 py-0.5 text-[10px]">
                  {entry.count}
                </span>
              </div>
            );
          }

          const row = entry.row!;

          return (
            <div
              key={entry.id}
              className="grid border-b border-border/35 text-foreground odd:bg-background/35 hover:bg-muted/40"
              style={{
                gridTemplateColumns: columns.map((column) => `${column.width ?? 110}px`).join(" "),
                height: rowHeight,
              }}
            >
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="flex min-w-0 items-center border-r border-border/35 px-2 last:border-r-0"
                  title={String(getColumnValue(row, column) ?? "")}
                >
                  <div className="truncate">
                    <Cell column={column} row={row} />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        <div style={{ height: bottomPadding }} />
        {entries.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No assets match the current bindings and filters.
          </div>
        ) : null}
      </div>
      {normalizedProps.showDiagnostics && state.runtimeModel.warnings.length > 0 ? (
        <div className="flex items-start gap-2 border-t border-border/70 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="line-clamp-2">
            {state.runtimeModel.warnings.slice(0, 3).join(" ")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isAssetScreenerDemoRuntimeState(
  value: unknown,
): value is {
  marketAssetScreenerDemoFrames: NonNullable<
    Parameters<typeof resolveAssetScreenerState>[0]["fallbackFrames"]
  >;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "marketAssetScreenerDemoFrames" in value,
  );
}
