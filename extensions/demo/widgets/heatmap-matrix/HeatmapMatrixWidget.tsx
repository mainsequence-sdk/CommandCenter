import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { AreaSeries, ColorType, createChart } from "lightweight-charts";

import { Badge } from "@/components/ui/badge";
import { withAlpha } from "@/lib/color";
import { formatDecimal, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  demoHeatmapCells,
  demoHeatmapColumns,
  demoHeatmapRows,
  type DemoHeatmapCell,
} from "./mock-data";

type HeatmapMatrixProps = WidgetComponentProps<{ desk?: string }>;

function formatSignedNumber(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${formatDecimal(value)}${suffix}`;
}

function formatIntervalLabel(cell: DemoHeatmapCell) {
  return `${cell.rowLabel} / ${cell.columnLabel}`;
}

function readRuntimeSelectionKey(runtimeState: Record<string, unknown> | undefined) {
  return typeof runtimeState?.selectedCellKey === "string" ? runtimeState.selectedCellKey : null;
}

export function HeatmapMatrixWidget({
  props,
  runtimeState,
  onRuntimeStateChange,
}: HeatmapMatrixProps) {
  const { resolvedTokens } = useTheme();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const preferredDesk = props.desk?.trim() || "Global Macro";
  const strongestCell = useMemo(
    () =>
      demoHeatmapCells.reduce((strongest, cell) =>
        Math.abs(cell.signal) > Math.abs(strongest.signal) ? cell : strongest,
      ),
    [],
  );
  const runtimeSelectedKey = readRuntimeSelectionKey(runtimeState);
  const [selectedCellKey, setSelectedCellKey] = useState<string>(
    runtimeSelectedKey ?? strongestCell.key,
  );

  useEffect(() => {
    const nextSelectionKey =
      runtimeSelectedKey && demoHeatmapCells.some((cell) => cell.key === runtimeSelectedKey)
        ? runtimeSelectedKey
        : strongestCell.key;

    setSelectedCellKey((current) => (current === nextSelectionKey ? current : nextSelectionKey));
  }, [runtimeSelectedKey, strongestCell.key]);

  const selectedCell = useMemo(
    () => demoHeatmapCells.find((cell) => cell.key === selectedCellKey) ?? strongestCell,
    [selectedCellKey, strongestCell],
  );

  const selectedTone =
    selectedCell.signal >= 0 ? resolvedTokens.primary : resolvedTokens.danger;

  const summary = useMemo(() => {
    const positiveCells = demoHeatmapCells.filter((cell) => cell.signal > 0).length;
    const negativeCells = demoHeatmapCells.length - positiveCells;
    const averageSignal =
      demoHeatmapCells.reduce((total, cell) => total + cell.signal, 0) / demoHeatmapCells.length;

    return {
      positiveCells,
      negativeCells,
      averageSignal,
    };
  }, []);

  useEffect(() => {
    const container = chartRef.current;

    if (!container) {
      return;
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: resolvedTokens["muted-foreground"],
      },
      grid: {
        vertLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.08) },
        horzLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.08) },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: withAlpha(selectedTone, 0.24),
          width: 1,
        },
        horzLine: {
          color: withAlpha(selectedTone, 0.2),
          width: 1,
        },
      },
      localization: {
        priceFormatter: (value: number) => value.toFixed(1),
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: selectedTone,
      topColor: withAlpha(selectedTone, 0.26),
      bottomColor: withAlpha(selectedTone, 0.04),
      priceLineVisible: false,
      lastValueVisible: false,
      lineWidth: 2,
    });

    series.setData(selectedCell.series);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [resolvedTokens, selectedCell, selectedTone]);

  function handleSelectCell(cell: DemoHeatmapCell) {
    startTransition(() => {
      setSelectedCellKey(cell.key);
    });

    onRuntimeStateChange?.({
      selectedCellKey: cell.key,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">mocked</Badge>
            <Badge variant="secondary">heatmap matrix</Badge>
            <Badge variant="secondary">{preferredDesk}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Cross-asset pressure map with mocked regime scores and a lightweight-charts drilldown
            for the active cell.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/45 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Average signal
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {formatSignedNumber(summary.averageSignal)}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/45 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Positive cells
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {summary.positiveCells}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/45 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Negative cells
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {summary.negativeCells}
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[108px_repeat(6,minmax(0,1fr))] gap-1.5">
        <div />
        {demoHeatmapColumns.map((column) => {
          const active = selectedCell.columnLabel === column;

          return (
            <div
              key={column}
              className={cn(
                "flex items-center justify-center rounded-[calc(var(--radius)-8px)] border px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[0.14em]",
                active && "text-foreground",
              )}
              style={{
                borderColor: withAlpha(
                  active ? selectedTone : resolvedTokens.border,
                  active ? 0.55 : 0.7,
                ),
                backgroundColor: withAlpha(
                  active ? selectedTone : resolvedTokens.muted,
                  active ? 0.14 : 0.36,
                ),
                color: active
                  ? resolvedTokens.foreground
                  : withAlpha(resolvedTokens.foreground, 0.72),
              }}
            >
              {column}
            </div>
          );
        })}

        {demoHeatmapRows.map((row) => (
          <div key={row} className="contents">
            <div
              className={cn(
                "flex items-center rounded-[calc(var(--radius)-8px)] border px-3 text-[11px] font-medium uppercase tracking-[0.14em]",
                selectedCell.rowLabel === row && "text-foreground",
              )}
              style={{
                borderColor: withAlpha(
                  selectedCell.rowLabel === row ? selectedTone : resolvedTokens.border,
                  selectedCell.rowLabel === row ? 0.55 : 0.7,
                ),
                backgroundColor: withAlpha(
                  selectedCell.rowLabel === row ? selectedTone : resolvedTokens.muted,
                  selectedCell.rowLabel === row ? 0.14 : 0.36,
                ),
                color:
                  selectedCell.rowLabel === row
                    ? resolvedTokens.foreground
                    : withAlpha(resolvedTokens.foreground, 0.72),
              }}
            >
              {row}
            </div>

            {demoHeatmapColumns.map((column) => {
              const cell = demoHeatmapCells.find(
                (entry) => entry.rowLabel === row && entry.columnLabel === column,
              );

              if (!cell) {
                return null;
              }

              const positive = cell.signal >= 0;
              const tone = positive ? resolvedTokens.primary : resolvedTokens.danger;
              const selected = cell.key === selectedCell.key;
              const intensity = 0.18 + Math.abs(cell.signal) * 0.36;

              return (
                <button
                  key={cell.key}
                  type="button"
                  className={cn(
                    "flex min-h-[74px] flex-col items-start justify-between rounded-[calc(var(--radius)-8px)] border px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-panel)]",
                    selected && "shadow-[var(--shadow-panel)]",
                  )}
                  style={{
                    borderColor: withAlpha(tone, selected ? 0.66 : 0.34),
                    background: `linear-gradient(180deg, ${withAlpha(
                      tone,
                      selected ? intensity + 0.1 : intensity,
                    )} 0%, ${withAlpha(resolvedTokens.card, 0.9)} 100%)`,
                  }}
                  onClick={() => {
                    handleSelectCell(cell);
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">
                      {formatSignedNumber(cell.signal)}
                    </div>
                    <div
                      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]"
                      style={{
                        backgroundColor: withAlpha(tone, 0.16),
                        color: withAlpha(resolvedTokens.foreground, 0.8),
                      }}
                    >
                      {positive ? "bid" : "offer"}
                    </div>
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: withAlpha(resolvedTokens.foreground, 0.65) }}
                  >
                    Flow {formatSignedNumber(cell.flowPct, "%")}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_240px] gap-3">
        <div className="min-h-[176px] overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Active cell
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {formatIntervalLabel(selectedCell)}
              </div>
            </div>
            <Badge variant={selectedCell.signal >= 0 ? "success" : "danger"}>
              {formatPercent(selectedCell.signal * 100, 1)}
            </Badge>
          </div>
          <div ref={chartRef} className="h-[128px] w-full" />
        </div>

        <div className="grid gap-2">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Flow balance
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {formatSignedNumber(selectedCell.flowPct, "%")}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Imbalance
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {formatSignedNumber(selectedCell.imbalancePct, "%")}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Spread
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {formatDecimal(selectedCell.spreadBps)} bps
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
