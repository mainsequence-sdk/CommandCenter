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

function getChartSize(container: HTMLDivElement) {
  return {
    width: Math.max(container.clientWidth, 1),
    height: Math.max(container.clientHeight, 1),
  };
}

export function TradingViewSeriesChart({
  chartType,
  className,
  emptyMessage = "No chartable rows are available for the selected configuration.",
  normalizationTimeMs,
  series,
  seriesAxisMode = "shared",
  transparentSurface = false,
}: {
  chartType: DataNodeVisualizerChartType;
  className?: string;
  emptyMessage?: string;
  normalizationTimeMs?: number | null;
  series: DataNodeVisualizerSeries[];
  seriesAxisMode?: DataNodeVisualizerSeriesAxisMode;
  transparentSurface?: boolean;
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
  const showPointMarkers = useMemo(
    () => themedSeries.length > 0 && themedSeries.every((entry) => entry.points.length <= 1),
    [themedSeries],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || themedSeries.length === 0) {
      return;
    }

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
        borderVisible: false,
        borderColor: "transparent",
      },
      timeScale: {
        borderVisible: false,
        borderColor: "transparent",
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
      ...getChartSize(container),
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
      chart.applyOptions(getChartSize(container));
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartType, resolvedTokens, separateAxes, showPointMarkers, themedSeries, transparentSurface]);

  if (themedSeries.length === 0) {
    return (
      <div
        className={cn(
          transparentSurface
            ? "flex h-full min-h-0 items-center justify-center rounded-none border-none bg-transparent px-4 text-sm text-muted-foreground"
            : "flex h-full min-h-0 items-center justify-center rounded-none border-none bg-transparent px-4 text-sm text-muted-foreground",
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
        transparentSurface
          ? "flex h-full min-h-0 flex-col overflow-visible rounded-none border-none bg-transparent"
          : "flex h-full min-h-0 flex-col overflow-visible rounded-none border-none bg-transparent",
        className,
      )}
    >
      <div className="min-h-0 flex-1">
        <div className="h-full min-h-0 w-full pl-1">
          <div ref={containerRef} className="h-full min-h-0 w-full" />
        </div>
      </div>
      <div
        className={cn(
          "shrink-0 flex flex-wrap items-center gap-3 px-3 py-2",
          "border-t-0",
        )}
      >
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
