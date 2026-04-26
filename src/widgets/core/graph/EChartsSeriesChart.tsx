import { useEffect, useMemo, useRef, useState } from "react";

import * as echarts from "echarts";
import type { EChartsOption, LineSeriesOption, BarSeriesOption } from "echarts";

import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetRuntimeUpdateMode } from "@/widgets/shared/runtime-update";

import { normalizeGraphSeries } from "./graphModel";
import type {
  GraphChartType,
  GraphLineStyle,
  GraphNormalizationAnchor,
  GraphSeries,
  GraphSeriesAxisMode,
  GraphTimeAxisMode,
} from "./graphModel";
import { formatGraphUtcDateKey } from "./graphModel";

function resolveLineStyle(lineStyle: GraphLineStyle | undefined): "solid" | "dashed" | "dotted" {
  switch (lineStyle) {
    case "dashed":
    case "large_dashed":
      return "dashed";
    case "dotted":
    case "sparse_dotted":
      return "dotted";
    default:
      return "solid";
  }
}

function buildSeriesLegendData(series: readonly GraphSeries[]) {
  return series.map((entry) => entry.label);
}

function parseEChartsAxisTimeValue(value: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsedValue = typeof value === "string" ? Date.parse(value) : Number.NaN;

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatEChartsTimeAxisLabel(
  value: string | number,
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto">,
) {
  const parsedValue = parseEChartsAxisTimeValue(value);

  if (parsedValue === null) {
    return String(value);
  }

  if (timeAxisMode === "date") {
    return formatGraphUtcDateKey(parsedValue);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsedValue);
}

function buildSharedChartOption(args: {
  chartType: GraphChartType;
  emptyMessage: string;
  series: GraphSeries[];
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto">;
  tokens: Record<string, string>;
}): EChartsOption {
  const { chartType, series, timeAxisMode, tokens } = args;
  const hasData = series.some((entry) => entry.points.length > 0);

  return {
    animation: false,
    backgroundColor: "transparent",
    textStyle: {
      color: tokens.foreground,
    },
    legend: {
      show: series.length > 1,
      bottom: 8,
      left: 12,
      right: 12,
      textStyle: {
        color: tokens["muted-foreground"],
      },
      data: buildSeriesLegendData(series),
    },
    grid: {
      top: 18,
      left: 16,
      right: 16,
      bottom: series.length > 1 ? 56 : 22,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: chartType === "bar" ? "shadow" : "line",
      },
      backgroundColor: tokens.card,
      borderColor: withAlpha(tokens.border, 0.72),
      textStyle: {
        color: tokens.foreground,
      },
    },
    xAxis: {
      type: "time",
      minInterval: timeAxisMode === "date" ? 24 * 60 * 60 * 1000 : undefined,
      axisLine: {
        lineStyle: {
          color: withAlpha(tokens.border, 0.72),
        },
      },
      axisLabel: {
        color: tokens["muted-foreground"],
        formatter: (value: string | number) => formatEChartsTimeAxisLabel(value, timeAxisMode),
      },
      splitLine: {
        show: false,
      },
    } as EChartsOption["xAxis"],
    yAxis: {
      type: "value",
      scale: true,
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: tokens["muted-foreground"],
      },
      splitLine: {
        lineStyle: {
          color: withAlpha(tokens["chart-grid"], 0.18),
        },
      },
    },
    series: hasData
      ? series.map((entry) => {
          const baseSeries = {
            name: entry.label,
            data: entry.points.map((point) => [point.time, point.value]),
            itemStyle: {
              color: entry.color,
            },
          };

          if (chartType === "bar") {
            return {
              ...baseSeries,
              type: "bar",
              barMaxWidth: 18,
            } satisfies BarSeriesOption;
          }

          return {
            ...baseSeries,
            type: "line",
            smooth: false,
            showSymbol: entry.points.length <= 1,
            symbolSize: entry.points.length <= 1 ? 8 : 5,
            lineStyle: {
              color: entry.color,
              type: resolveLineStyle(entry.lineStyle),
              width: 2,
            },
            areaStyle: chartType === "area"
              ? {
                  color: withAlpha(entry.color ?? tokens.primary, 0.2),
                }
              : undefined,
          } satisfies LineSeriesOption;
        })
      : [],
  };
}

function buildSeparateAxesChartOption(args: {
  chartType: GraphChartType;
  series: GraphSeries[];
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto">;
  tokens: Record<string, string>;
}): EChartsOption {
  const { chartType, series, timeAxisMode, tokens } = args;
  const legendHeight = series.length > 1 ? 44 : 18;
  const availableHeight = 100 - legendHeight;
  const paneHeight = Math.max(14, availableHeight / Math.max(series.length, 1));

  return {
    animation: false,
    backgroundColor: "transparent",
    textStyle: {
      color: tokens.foreground,
    },
    legend: {
      show: series.length > 1,
      bottom: 8,
      left: 12,
      right: 12,
      textStyle: {
        color: tokens["muted-foreground"],
      },
      data: buildSeriesLegendData(series),
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: chartType === "bar" ? "shadow" : "line",
      },
      backgroundColor: tokens.card,
      borderColor: withAlpha(tokens.border, 0.72),
      textStyle: {
        color: tokens.foreground,
      },
    },
    grid: series.map((entry, index) => {
      const top = 12 + index * paneHeight;
      const bottom = index === series.length - 1 ? legendHeight : undefined;
      return {
        top: `${top}%`,
        left: 16,
        right: 16,
        height: `${Math.max(paneHeight - 4, 10)}%`,
        bottom,
        containLabel: true,
      };
    }),
    xAxis: series.map((_, index) =>
      ({
        type: "time" as const,
        gridIndex: index,
        minInterval: timeAxisMode === "date" ? 24 * 60 * 60 * 1000 : undefined,
        axisLine: {
          lineStyle: {
            color: withAlpha(tokens.border, 0.72),
          },
        },
        axisLabel: {
          color: tokens["muted-foreground"],
          show: index === series.length - 1,
          formatter: (value: string | number) => formatEChartsTimeAxisLabel(value, timeAxisMode),
        },
        axisTick: {
          show: index === series.length - 1,
        },
        splitLine: {
          show: false,
        },
      }) as NonNullable<EChartsOption["xAxis"]> extends Array<infer T> ? T : never,
    ),
    yAxis: series.map((entry, index) => ({
      type: "value",
      gridIndex: index,
      scale: true,
      name: entry.label,
      nameLocation: "start",
      nameGap: 8,
      nameTextStyle: {
        color: entry.color ?? tokens.foreground,
        fontWeight: 600,
        align: "left",
      },
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: tokens["muted-foreground"],
      },
      splitLine: {
        lineStyle: {
          color: withAlpha(tokens["chart-grid"], 0.18),
        },
      },
    })),
    series: series.map((entry, index) => {
      const baseSeries = {
        name: entry.label,
        xAxisIndex: index,
        yAxisIndex: index,
        data: entry.points.map((point) => [point.time, point.value]),
        itemStyle: {
          color: entry.color,
        },
      };

      if (chartType === "bar") {
        return {
          ...baseSeries,
          type: "bar",
          barMaxWidth: 18,
        } satisfies BarSeriesOption;
      }

      return {
        ...baseSeries,
        type: "line",
        smooth: false,
        showSymbol: entry.points.length <= 1,
        symbolSize: entry.points.length <= 1 ? 8 : 5,
        lineStyle: {
          color: entry.color,
          type: resolveLineStyle(entry.lineStyle),
          width: 2,
        },
        areaStyle: chartType === "area"
          ? {
              color: withAlpha(entry.color ?? tokens.primary, 0.2),
            }
          : undefined,
      } satisfies LineSeriesOption;
    }),
  };
}

export function EChartsSeriesChart({
  chartType,
  className,
  dataShapeKey,
  deltaSeries = [],
  emptyMessage = "No chartable rows are available for the selected configuration.",
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
  normalizationTimeMs?: GraphNormalizationAnchor;
  series: GraphSeries[];
  seriesAxisMode?: GraphSeriesAxisMode;
  timeAxisMode?: Exclude<GraphTimeAxisMode, "auto">;
  transparentSurface?: boolean;
  updateMode?: WidgetRuntimeUpdateMode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const lastStructureKeyRef = useRef<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const { resolvedTokens } = useTheme();

  const normalizedSeries = useMemo(
    () => normalizeGraphSeries(series, normalizationTimeMs),
    [normalizationTimeMs, series],
  );
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
  const separateAxes = seriesAxisMode === "separate" && themedSeries.length > 1;

  useEffect(() => {
    const container = containerRef.current;

    if (!container || themedSeries.length === 0) {
      setChartError(null);
      return;
    }

    let resizeObserver: ResizeObserver | null = null;

    try {
      chartRef.current = echarts.init(container, undefined, {
        renderer: "canvas",
      });

      resizeObserver = new ResizeObserver(() => {
        chartRef.current?.resize();
      });
      resizeObserver.observe(container);
      setChartError(null);
    } catch (error) {
      resizeObserver?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
      setChartError(
        error instanceof Error
          ? error.message
          : "The ECharts renderer rejected the current series data.",
      );
      return;
    }

    return () => {
      resizeObserver?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
      lastStructureKeyRef.current = null;
    };
  }, [themedSeries.length]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart || themedSeries.length === 0) {
      return;
    }

    const option = separateAxes
      ? buildSeparateAxesChartOption({
          chartType,
          series: themedSeries,
          timeAxisMode,
          tokens: resolvedTokens,
        })
      : buildSharedChartOption({
          chartType,
          emptyMessage,
          series: themedSeries,
          timeAxisMode,
          tokens: resolvedTokens,
        });
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
      timeAxisMode,
    });
    const canMerge =
      updateMode === "delta" &&
      deltaSeries.length > 0 &&
      lastStructureKeyRef.current === structureKey;

    chart.setOption(option, {
      lazyUpdate: true,
      notMerge: !canMerge,
    });
    lastStructureKeyRef.current = structureKey;
    setChartError(null);
  }, [
    chartType,
    dataShapeKey,
    deltaSeries.length,
    emptyMessage,
    resolvedTokens,
    separateAxes,
    themedSeries,
    timeAxisMode,
    updateMode,
  ]);

  if (themedSeries.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 items-center justify-center px-4 text-sm text-muted-foreground",
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
    </div>
  );
}
