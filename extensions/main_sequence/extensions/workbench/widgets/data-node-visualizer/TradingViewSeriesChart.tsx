import { useEffect, useMemo, useRef } from "react";

import {
  AreaSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type UTCTimestamp,
} from "lightweight-charts";

import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

import { normalizeDataNodeVisualizerSeries } from "./dataNodeVisualizerModel";
import type {
  DataNodeVisualizerChartType,
  DataNodeVisualizerSeriesAxisMode,
  DataNodeVisualizerSeries,
} from "./dataNodeVisualizerModel";

const separateAxisPaneHeight = 140;

export function TradingViewSeriesChart({
  chartType,
  className,
  emptyMessage = "No chartable rows are available for the selected configuration.",
  normalizationTimeMs,
  series,
  seriesAxisMode = "shared",
}: {
  chartType: DataNodeVisualizerChartType;
  className?: string;
  emptyMessage?: string;
  normalizationTimeMs?: number | null;
  series: DataNodeVisualizerSeries[];
  seriesAxisMode?: DataNodeVisualizerSeriesAxisMode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTokens } = useTheme();

  const normalizedSeries = useMemo(
    () => normalizeDataNodeVisualizerSeries(series, normalizationTimeMs),
    [normalizationTimeMs, series],
  );
  const separateAxes = seriesAxisMode === "separate" && normalizedSeries.length > 1;

  const themedSeries = useMemo(() => {
    const palette = [
      resolvedTokens.primary,
      resolvedTokens.accent,
      resolvedTokens.success,
      resolvedTokens.warning,
      resolvedTokens.danger,
      resolvedTokens.foreground,
    ];

    return normalizedSeries
      .filter((entry) => entry.points.length > 0)
      .map((entry, index) => ({
        ...entry,
        color: entry.color ?? palette[index % palette.length],
      }));
  }, [
    normalizedSeries,
    resolvedTokens.accent,
    resolvedTokens.danger,
    resolvedTokens.foreground,
    resolvedTokens.primary,
    resolvedTokens.success,
    resolvedTokens.warning,
  ]);
  const chartMinHeight = separateAxes
    ? Math.max(260, themedSeries.length * separateAxisPaneHeight)
    : 260;
  const showPointMarkers = useMemo(
    () => themedSeries.length > 0 && themedSeries.every((entry) => entry.points.length <= 1),
    [themedSeries],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || themedSeries.length === 0) {
      return;
    }

    const chartWidth = Math.max(container.clientWidth, 320);
    const chartHeight = Math.max(container.clientHeight, chartMinHeight);

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: resolvedTokens["muted-foreground"],
      },
      grid: {
        vertLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.12) },
        horzLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.12) },
      },
      rightPriceScale: {
        borderColor: resolvedTokens.border,
      },
      timeScale: {
        borderColor: resolvedTokens.border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: withAlpha(resolvedTokens.primary, 0.2),
          width: 1,
        },
        horzLine: {
          color: withAlpha(resolvedTokens.primary, 0.2),
          width: 1,
        },
      },
      width: chartWidth,
      height: chartHeight,
    });

    themedSeries.forEach((entry, index) => {
      const normalizedPoints = entry.points.map((point) => ({
        time: Math.floor(point.time / 1000) as UTCTimestamp,
        value: point.value,
      }));
      const paneIndex = separateAxes ? index : 0;

      while (chart.panes().length <= paneIndex) {
        chart.addPane();
      }

      if (chartType === "area") {
        const areaSeries = chart.addSeries(
          AreaSeries,
          {
            lineColor: entry.color,
            topColor: withAlpha(entry.color, 0.22),
            bottomColor: withAlpha(entry.color, 0.03),
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            pointMarkersVisible: showPointMarkers,
            pointMarkersRadius: showPointMarkers ? 5 : undefined,
            title: entry.label,
          },
          paneIndex,
        );

        areaSeries.setData(normalizedPoints);
        return;
      }

      if (chartType === "bar") {
        const histogramSeries = chart.addSeries(
          HistogramSeries,
          {
            color: withAlpha(entry.color, 0.8),
            priceLineVisible: false,
            lastValueVisible: false,
            title: entry.label,
          },
          paneIndex,
        );

        histogramSeries.setData(normalizedPoints);
        return;
      }

      const lineSeries = chart.addSeries(
        LineSeries,
        {
          color: entry.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          pointMarkersVisible: showPointMarkers,
          pointMarkersRadius: showPointMarkers ? 5 : undefined,
          title: entry.label,
        },
        paneIndex,
      );

      lineSeries.setData(normalizedPoints);
    });

    if (separateAxes) {
      chart.panes().forEach((pane) => {
        pane.setStretchFactor(1);
      });
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: Math.max(container.clientWidth, 320),
        height: Math.max(container.clientHeight, chartMinHeight),
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartMinHeight, chartType, resolvedTokens, separateAxes, showPointMarkers, themedSeries]);

  if (themedSeries.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[220px] items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-[260px] flex-col overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35",
        className,
      )}
      style={{ minHeight: chartMinHeight }}
    >
      <div className="min-h-0 flex-1" style={{ minHeight: chartMinHeight - 40 }}>
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border/70 px-3 py-2">
        {themedSeries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="truncate">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
