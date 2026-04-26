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
import type { WidgetRuntimeUpdateMode } from "@/widgets/shared/runtime-update";

import { normalizeGraphSeries } from "./graphModel";
import type {
  GraphChartType,
  GraphLineStyle,
  GraphNormalizationAnchor,
  GraphSeriesAxisMode,
  GraphSeries,
  GraphTimeAxisMode,
} from "./graphModel";
import { formatGraphUtcDateKey } from "./graphModel";

function getChartSize(container: HTMLDivElement) {
  return {
    width: Math.max(container.clientWidth, 1),
    height: Math.max(container.clientHeight, 1),
  };
}

type TradingViewChartApi = ReturnType<typeof createChart>;
type TradingViewSeriesApi = Parameters<TradingViewChartApi["removeSeries"]>[0];
type TradingViewPoint = { time: Time; value: number };

function resolveTimeMs(time: Time) {
  if (typeof time === "number") {
    return time * 1000;
  }

  if (typeof time === "string") {
    const parsed = Date.parse(time);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return Date.UTC(time.year, time.month - 1, time.day);
}

function formatTradingViewTime(
  time: Time,
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto">,
  options?: { includeSeconds?: boolean },
) {
  const timestampMs = resolveTimeMs(time);

  if (timestampMs === null) {
    return String(time);
  }

  if (timeAxisMode === "date") {
    return formatGraphUtcDateKey(timestampMs);
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: options?.includeSeconds ? "2-digit" : undefined,
  }).format(new Date(timestampMs));
}

function mapGraphSeriesPoints(
  entry: GraphSeries,
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto">,
): TradingViewPoint[] {
  return entry.points.map((point) => ({
    time:
      timeAxisMode === "date"
        ? formatGraphUtcDateKey(point.time)
        : (Math.floor(point.time / 1000) as UTCTimestamp),
    value: point.value,
  }));
}

export function TradingViewSeriesChart({
  chartType,
  className,
  dataShapeKey,
  deltaSeries = [],
  emptyMessage = "No chartable rows are available for the selected configuration.",
  minBarSpacingPx = 0.01,
  normalizationTimeMs,
  series,
  seriesAxisMode = "shared",
  timeAxisMode = "datetime",
  transparentSurface = false,
  updateMode = "snapshot",
}: {
  chartType: GraphChartType;
  className?: string;
  dataShapeKey?: string;
  deltaSeries?: GraphSeries[];
  emptyMessage?: string;
  minBarSpacingPx?: number;
  normalizationTimeMs?: GraphNormalizationAnchor;
  series: GraphSeries[];
  seriesAxisMode?: GraphSeriesAxisMode;
  timeAxisMode?: Exclude<GraphTimeAxisMode, "auto">;
  transparentSurface?: boolean;
  updateMode?: WidgetRuntimeUpdateMode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<TradingViewChartApi | null>(null);
  const seriesRefs = useRef(new Map<string, TradingViewSeriesApi>());
  const lastStructureKeyRef = useRef<string | null>(null);
  const lastPointCountRef = useRef(0);
  const hasFittedRef = useRef(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const { resolvedTokens } = useTheme();

  const normalizedSeries = useMemo(
    () => normalizeGraphSeries(series, normalizationTimeMs),
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
  const resolveLineStyle = (lineStyle: GraphLineStyle | undefined) => {
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

    let resizeObserver: ResizeObserver | null = null;

    try {
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
          fixRightEdge: true,
          rightOffset: 0,
          timeVisible: timeAxisMode === "datetime",
          secondsVisible: false,
          minBarSpacing: minBarSpacingPx,
          tickMarkFormatter: (time: Time) =>
            formatTradingViewTime(time, timeAxisMode),
        },
        localization: {
          timeFormatter: (time: Time) =>
            formatTradingViewTime(time, timeAxisMode, { includeSeconds: true }),
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
      chartRef.current = chart;
      hasFittedRef.current = false;
      lastStructureKeyRef.current = null;
      lastPointCountRef.current = 0;

      const fitAtStableSize = () => {
        if (!chartRef.current) {
          return;
        }

        const { width, height } = getChartSize(container);

        if (width <= 1 || height <= 1) {
          return;
        }

        chartRef.current.applyOptions({ width, height });
      };

      requestAnimationFrame(() => {
        fitAtStableSize();
      });

      resizeObserver = new ResizeObserver(() => {
        chartRef.current?.applyOptions(getChartSize(container));
        fitAtStableSize();
      });

      resizeObserver.observe(container);
    } catch (error) {
      resizeObserver?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      setChartError(
        error instanceof Error
          ? error.message
          : "The chart library rejected the current series data.",
      );
      return;
    }

    return () => {
      resizeObserver?.disconnect();
      seriesRefs.current.clear();
      chartRef.current?.remove();
      chartRef.current = null;
      lastStructureKeyRef.current = null;
    };
  }, [minBarSpacingPx, resolvedTokens, themedSeries.length, timeAxisMode]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart || themedSeries.length === 0) {
      return;
    }

    const addSeries = (entry: GraphSeries, index: number) => {
      const paneIndex = separateAxes ? index : 0;
      const seriesColor = entry.color ?? resolvedTokens.primary;

      while (chart.panes().length <= paneIndex) {
        chart.addPane();
      }

      if (chartType === "area") {
        return chart.addSeries(
          AreaSeries,
          {
            lineColor: seriesColor,
            lineStyle: resolveLineStyle(entry.lineStyle),
            topColor: withAlpha(seriesColor, 0.22),
            bottomColor: withAlpha(seriesColor, 0.03),
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            pointMarkersVisible: showPointMarkers,
            pointMarkersRadius: showPointMarkers ? 5 : undefined,
            title: entry.label,
          },
          paneIndex,
        );
      }

      if (chartType === "bar") {
        return chart.addSeries(
          HistogramSeries,
          {
            color: withAlpha(seriesColor, 0.8),
            priceLineVisible: false,
            lastValueVisible: false,
            title: entry.label,
          },
          paneIndex,
        );
      }

      return chart.addSeries(
        LineSeries,
        {
          color: seriesColor,
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
    };

    const structureKey = JSON.stringify({
      chartType,
      dataShapeKey,
      separateAxes,
      series: themedSeries.map((entry) => ({
        color: entry.color,
        id: entry.id,
        label: entry.label,
        lineStyle: entry.lineStyle,
      })),
      showPointMarkers,
      timeAxisMode,
    });
    const forceSnapshot =
      updateMode !== "delta" ||
      deltaSeries.length === 0 ||
      lastStructureKeyRef.current !== structureKey;
    const visibleRange = chart.timeScale().getVisibleLogicalRange();
    const wasFollowingRightEdge =
      !visibleRange || visibleRange.to >= lastPointCountRef.current - 2;

    if (forceSnapshot) {
      seriesRefs.current.forEach((seriesApi) => {
        chart.removeSeries(seriesApi);
      });
      seriesRefs.current.clear();

      themedSeries.forEach((entry, index) => {
        const seriesApi = addSeries(entry, index);
        seriesApi.setData(mapGraphSeriesPoints(entry, timeAxisMode));
        seriesRefs.current.set(entry.id, seriesApi);
      });

      if (separateAxes) {
        chart.panes().forEach((pane) => {
          pane.setStretchFactor(1);
        });
      }

      lastStructureKeyRef.current = structureKey;
      lastPointCountRef.current = Math.max(0, ...themedSeries.map((entry) => entry.points.length));

      if (!hasFittedRef.current || wasFollowingRightEdge || !visibleRange) {
        chart.timeScale().fitContent();
      } else {
        chart.timeScale().setVisibleLogicalRange(visibleRange);
      }

      hasFittedRef.current = true;
      return;
    }

    const fullSeriesById = new Map(themedSeries.map((entry, index) => [entry.id, { entry, index }]));

    deltaSeries.forEach((entry) => {
      const fullSeries = fullSeriesById.get(entry.id);

      if (!fullSeries) {
        return;
      }

      let seriesApi = seriesRefs.current.get(entry.id);

      if (!seriesApi) {
        seriesApi = addSeries(fullSeries.entry, fullSeries.index);
        seriesApi.setData(mapGraphSeriesPoints(fullSeries.entry, timeAxisMode));
        seriesRefs.current.set(entry.id, seriesApi);
        return;
      }

      mapGraphSeriesPoints(entry, timeAxisMode).forEach((point) => {
        seriesApi.update(point, true);
      });
    });

    lastPointCountRef.current = Math.max(0, ...themedSeries.map((entry) => entry.points.length));

    if (!wasFollowingRightEdge && visibleRange) {
      chart.timeScale().setVisibleLogicalRange(visibleRange);
    }
  }, [
    chartType,
    dataShapeKey,
    deltaSeries,
    separateAxes,
    showPointMarkers,
    themedSeries,
    timeAxisMode,
    updateMode,
  ]);

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
