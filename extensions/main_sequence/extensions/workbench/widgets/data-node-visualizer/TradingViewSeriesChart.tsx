import { useEffect, useMemo, useRef, useState } from "react";

import {
  AreaSeries,
  ColorType,
  HistogramSeries,
  LineStyle,
  LineSeries,
  createChart,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

import { normalizeDataNodeVisualizerSeries } from "./dataNodeVisualizerModel";
import type {
  DataNodeVisualizerChartType,
  DataNodeVisualizerLineStyle,
  DataNodeVisualizerSeriesAxisMode,
  DataNodeVisualizerSeries,
  DataNodeVisualizerTimeAxisMode,
} from "./dataNodeVisualizerModel";
import { formatDataNodeVisualizerUtcDateKey } from "./dataNodeVisualizerModel";

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
  minBarSpacingPx = 0.01,
  normalizationTimeMs,
  series,
  seriesAxisMode = "shared",
  timeAxisMode = "datetime",
  transparentSurface = false,
}: {
  chartType: DataNodeVisualizerChartType;
  className?: string;
  emptyMessage?: string;
  minBarSpacingPx?: number;
  normalizationTimeMs?: number | null;
  series: DataNodeVisualizerSeries[];
  seriesAxisMode?: DataNodeVisualizerSeriesAxisMode;
  timeAxisMode?: Exclude<DataNodeVisualizerTimeAxisMode, "auto">;
  transparentSurface?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
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
  const resolveLineStyle = (lineStyle: DataNodeVisualizerLineStyle | undefined) => {
    switch (lineStyle) {
      case "dotted":
        return LineStyle.Dotted;
      case "dashed":
        return LineStyle.Dashed;
      case "large_dashed":
        return LineStyle.LargeDashed;
      case "sparse_dotted":
        return LineStyle.SparseDotted;
      default:
        return LineStyle.Solid;
    }
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!container || themedSeries.length === 0) {
      setChartError(null);
      return;
    }
    setChartError(null);

    let chart: ReturnType<typeof createChart> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let hasFittedAtStableSize = false;

    try {
      chart = createChart(container, {
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
          timeVisible: timeAxisMode === "datetime",
          secondsVisible: false,
          minBarSpacing: minBarSpacingPx,
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
        const normalizedPoints: Array<{ time: Time; value: number }> = entry.points.map((point) => ({
          time:
            timeAxisMode === "date"
              ? formatDataNodeVisualizerUtcDateKey(point.time)
              : (Math.floor(point.time / 1000) as UTCTimestamp),
          value: point.value,
        }));
        const paneIndex = separateAxes ? index : 0;

        while (chart && chart.panes().length <= paneIndex) {
          chart.addPane();
        }

        if (!chart) {
          return;
        }

        if (chartType === "area") {
          const areaSeries = chart.addSeries(
            AreaSeries,
            {
              lineColor: entry.color,
              lineStyle: resolveLineStyle(entry.lineStyle),
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
            lineStyle: resolveLineStyle(entry.lineStyle),
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

      const fitAtStableSize = () => {
        if (!chart) {
          return;
        }

        const { width, height } = getChartSize(container);

        if (width <= 1 || height <= 1) {
          return;
        }

        chart.applyOptions({ width, height });
        chart.timeScale().fitContent();
        hasFittedAtStableSize = true;
      };

      requestAnimationFrame(() => {
        fitAtStableSize();
      });

      resizeObserver = new ResizeObserver(() => {
        chart?.applyOptions(getChartSize(container));

        if (!hasFittedAtStableSize) {
          fitAtStableSize();
        }
      });

      resizeObserver.observe(container);
    } catch (error) {
      resizeObserver?.disconnect();
      chart?.remove();
      setChartError(
        error instanceof Error
          ? error.message
          : "The chart library rejected the current series data.",
      );
      return;
    }

    return () => {
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [chartType, minBarSpacingPx, resolvedTokens, separateAxes, showPointMarkers, themedSeries, timeAxisMode, transparentSurface]);

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

  if (chartError) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger",
          className,
        )}
      >
        {chartError}
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
