import { useEffect, useMemo, useRef, useState } from "react";

import * as echarts from "echarts";
import type {
  EChartsOption,
  LineSeriesOption,
  BarSeriesOption,
  ScatterSeriesOption,
} from "echarts";

import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetRuntimeUpdateMode } from "@/widgets/shared/runtime-update";

import {
  formatGraphTimestampLabel,
  buildStackedGraphSeriesProjection,
  formatGraphAxisValue,
  normalizeGraphSeries,
  resolveGraphTimeQuantization,
} from "./graphModel";
import type {
  GraphChartType,
  GraphLineStyle,
  GraphNormalizationAnchor,
  GraphSeries,
  GraphSeriesAxisMode,
  GraphTimeAxisMode,
  GraphTimeQuantizationMode,
  ResolvedGraphTimeQuantization,
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
  timeQuantization: ResolvedGraphTimeQuantization,
) {
  const parsedValue = parseEChartsAxisTimeValue(value);

  if (parsedValue === null) {
    return String(value);
  }

  if (timeAxisMode === "date") {
    return formatGraphUtcDateKey(parsedValue);
  }

  return formatGraphTimestampLabel(parsedValue, {
    timeAxisMode,
    timeQuantization,
  });
}

function formatEChartsValueAxisLabel(value: string | number) {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(numericValue);
}

function buildEChartsTooltipFormatter() {
  return (params: unknown) => {
    const entries = Array.isArray(params) ? params : [params];

    return entries
      .flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }

        const record = entry as {
          color?: unknown;
          seriesName?: unknown;
        };
        const color = typeof record.color === "string" ? record.color : "#94a3b8";
        const seriesName =
          typeof record.seriesName === "string" && record.seriesName.trim()
            ? record.seriesName
            : "Series";

        return [
          `<div style="line-height:1.4;color:${color};">` +
            `${echarts.format.encodeHTML(seriesName)}` +
          `</div>`,
        ];
      })
      .join("");
  };
}

function resolveSeriesValueExtent(series: readonly GraphSeries[]) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  series.forEach((entry) => {
    entry.points.forEach((point) => {
      min = Math.min(min, point.value);
      max = Math.max(max, point.value);
    });
  });

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  return { min, max };
}

export function buildPaddedValueAxisBounds(series: readonly GraphSeries[]) {
  const extent = resolveSeriesValueExtent(series);

  if (!extent) {
    return {};
  }

  if (extent.min === 0 && extent.max === 0) {
    return {};
  }

  const baseSpan = extent.max - extent.min;
  const magnitude = Math.max(Math.abs(extent.max), Math.abs(extent.min), 1e-6);
  const paddingBase = baseSpan > 0 ? baseSpan : magnitude;
  const paddingRatio = baseSpan > 0 ? 0.08 : 0.001;
  const padding =
    Math.max(paddingBase * paddingRatio, 1e-9);
  const paddedMin = extent.min - padding;
  const paddedMax = extent.max + padding;
  const roughStep = Math.max((paddedMax - paddedMin) / 5, 1e-9);
  const stepMagnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / stepMagnitude;
  const step =
    normalizedStep <= 1
      ? stepMagnitude
      : normalizedStep <= 2
        ? 2 * stepMagnitude
        : normalizedStep <= 5
          ? 5 * stepMagnitude
          : 10 * stepMagnitude;
  const min =
    extent.min >= 0 && paddedMin < 0
      ? 0
      : Math.floor(paddedMin / step) * step;
  const max =
    extent.max <= 0 && paddedMax > 0
      ? 0
      : Math.ceil(paddedMax / step) * step;

  return {
    min,
    max,
  };
}

function buildStackAlignedSeries(series: readonly GraphSeries[]) {
  if (series.length <= 1) {
    return [...series];
  }

  const timeValues = [...new Set(series.flatMap((entry) => entry.points.map((point) => point.time)))]
    .sort((left, right) => left - right);

  if (timeValues.length === 0) {
    return [...series];
  }

  return series.map((entry) => {
    const pointMap = new Map(entry.points.map((point) => [point.time, point.value]));
    const points = timeValues.map((time) => ({
      time,
      value: pointMap.get(time) ?? 0,
    }));

    return {
      ...entry,
      pointCount: points.length,
      points,
    };
  });
}

function buildSharedChartOption(args: {
  chartType: GraphChartType;
  emptyMessage: string;
  markerSizePx: number;
  series: GraphSeries[];
  stackSeries: boolean;
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto">;
  timeQuantization: ResolvedGraphTimeQuantization;
  tokens: Record<string, string>;
  yAxisDecimals?: number;
  yAxisScaleZeros: number;
  yAxisSuffix?: string;
  xAxisType: "time" | "value";
}): EChartsOption {
  const {
    chartType,
    markerSizePx,
    series,
    stackSeries,
    timeAxisMode,
    timeQuantization,
    tokens,
    xAxisType,
    yAxisDecimals,
    yAxisScaleZeros,
    yAxisSuffix,
  } = args;
  const plottedSeries = stackSeries ? buildStackAlignedSeries(series) : [...series];
  const axisSeries = stackSeries
    ? buildStackedGraphSeriesProjection(plottedSeries)
    : plottedSeries;
  const hasData = plottedSeries.some((entry) => entry.points.length > 0);
  const valueAxisBounds = buildPaddedValueAxisBounds(axisSeries);
  const useScrollableLegend = plottedSeries.length > 8;
  const legendBottom = 8;
  const legendHeight = useScrollableLegend ? 30 : plottedSeries.length > 1 ? 56 : 22;

  return {
    animation: false,
    backgroundColor: "transparent",
    textStyle: {
      color: tokens.foreground,
    },
    legend: {
      type: useScrollableLegend ? "scroll" : "plain",
      show: plottedSeries.length > 1,
      bottom: legendBottom,
      left: 12,
      right: 12,
      icon: "circle",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: tokens["muted-foreground"],
      },
      pageIconColor: tokens.primary,
      pageIconInactiveColor: withAlpha(tokens["muted-foreground"], 0.5),
      pageTextStyle: {
        color: tokens["muted-foreground"],
      },
      data: buildSeriesLegendData(plottedSeries),
    },
    grid: {
      top: 18,
      left: 16,
      right: 16,
      bottom: legendHeight + legendBottom,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: chartType === "bar" ? "shadow" : "line",
      },
      formatter: buildEChartsTooltipFormatter(),
      backgroundColor: tokens.card,
      borderColor: withAlpha(tokens.border, 0.72),
      textStyle: {
        color: tokens.foreground,
      },
    },
    xAxis: {
      type: xAxisType,
      minInterval:
        xAxisType === "time" && timeAxisMode === "date" ? 24 * 60 * 60 * 1000 : undefined,
      axisLine: {
        lineStyle: {
          color: withAlpha(tokens.border, 0.72),
        },
      },
      axisLabel: {
        color: tokens["muted-foreground"],
        formatter:
          xAxisType === "time"
            ? (value: string | number) => formatEChartsTimeAxisLabel(value, timeAxisMode, timeQuantization)
            : (value: string | number) => formatEChartsValueAxisLabel(value),
      },
      splitLine: {
        show: false,
      },
    } as EChartsOption["xAxis"],
    yAxis: {
      type: "value",
      scale: true,
      ...valueAxisBounds,
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: tokens["muted-foreground"],
        formatter: (value: string | number) =>
          formatGraphAxisValue(value, { yAxisDecimals, yAxisScaleZeros, yAxisSuffix }),
      },
      splitLine: {
        lineStyle: {
          color: withAlpha(tokens["chart-grid"], 0.18),
        },
      },
    },
    series: hasData
      ? plottedSeries.map((entry) => {
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
              stack: stackSeries ? "graph-stack" : undefined,
            } satisfies BarSeriesOption;
          }

          if (chartType === "markers") {
            return {
              ...baseSeries,
              type: "scatter",
              symbolSize: markerSizePx,
            } satisfies ScatterSeriesOption;
          }

          return {
            ...baseSeries,
            type: "line",
            stack: stackSeries ? "graph-stack" : undefined,
            smooth: false,
            showSymbol: false,
            emphasis: {
              disabled: true,
            },
            lineStyle: {
              color: entry.color,
              type: resolveLineStyle(entry.lineStyle),
              width: 2,
            },
            areaStyle: chartType === "area" || stackSeries
              ? {
                  color: withAlpha(entry.color ?? tokens.primary, stackSeries ? 0.26 : 0.2),
                }
              : undefined,
          } satisfies LineSeriesOption;
        })
      : [],
  };
}

function buildSeparateAxesChartOption(args: {
  chartType: GraphChartType;
  markerSizePx: number;
  series: GraphSeries[];
  stackSeries?: boolean;
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto">;
  timeQuantization: ResolvedGraphTimeQuantization;
  tokens: Record<string, string>;
  yAxisDecimals?: number;
  yAxisScaleZeros: number;
  yAxisSuffix?: string;
  xAxisType: "time" | "value";
}): EChartsOption {
  const {
    chartType,
    markerSizePx,
    series,
    timeAxisMode,
    timeQuantization,
    tokens,
    xAxisType,
    yAxisDecimals,
    yAxisScaleZeros,
    yAxisSuffix,
  } = args;
  const useScrollableLegend = series.length > 8;
  const legendBottom = 8;
  const legendHeight = useScrollableLegend ? 30 : series.length > 1 ? 44 : 18;
  const availableHeight = 100 - legendHeight;
  const paneHeight = Math.max(14, availableHeight / Math.max(series.length, 1));

  return {
    animation: false,
    backgroundColor: "transparent",
    textStyle: {
      color: tokens.foreground,
    },
    legend: {
      type: useScrollableLegend ? "scroll" : "plain",
      show: series.length > 1,
      bottom: legendBottom,
      left: 12,
      right: 12,
      icon: "circle",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: tokens["muted-foreground"],
      },
      pageIconColor: tokens.primary,
      pageIconInactiveColor: withAlpha(tokens["muted-foreground"], 0.5),
      pageTextStyle: {
        color: tokens["muted-foreground"],
      },
      data: buildSeriesLegendData(series),
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: chartType === "bar" ? "shadow" : "line",
      },
      formatter: buildEChartsTooltipFormatter(),
      backgroundColor: tokens.card,
      borderColor: withAlpha(tokens.border, 0.72),
      textStyle: {
        color: tokens.foreground,
      },
    },
    grid: series.map((entry, index) => {
      const top = 12 + index * paneHeight;
      const bottom = index === series.length - 1 ? legendHeight + legendBottom : undefined;
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
        type: xAxisType,
        gridIndex: index,
        minInterval:
          xAxisType === "time" && timeAxisMode === "date" ? 24 * 60 * 60 * 1000 : undefined,
        axisLine: {
          lineStyle: {
            color: withAlpha(tokens.border, 0.72),
          },
        },
        axisLabel: {
          color: tokens["muted-foreground"],
          show: index === series.length - 1,
          formatter:
            xAxisType === "time"
              ? (value: string | number) => formatEChartsTimeAxisLabel(value, timeAxisMode, timeQuantization)
              : (value: string | number) => formatEChartsValueAxisLabel(value),
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
      ...buildPaddedValueAxisBounds([entry]),
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
        formatter: (value: string | number) =>
          formatGraphAxisValue(value, { yAxisDecimals, yAxisScaleZeros, yAxisSuffix }),
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

      if (chartType === "markers") {
        return {
          ...baseSeries,
          type: "scatter",
          symbolSize: markerSizePx,
        } satisfies ScatterSeriesOption;
      }

      return {
        ...baseSeries,
        type: "line",
        smooth: false,
        showSymbol: false,
        emphasis: {
          disabled: true,
        },
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
  markerSizePx = 8,
  normalizationTimeMs,
  series,
  seriesAxisMode = "shared",
  stackSeries = false,
  timeAxisMode = "datetime",
  timeQuantization = "auto",
  transparentSurface = false,
  updateMode = "snapshot",
  xAxisType = "time",
  yAxisDecimals,
  yAxisScaleZeros = 0,
  yAxisSuffix,
}: {
  chartType: GraphChartType;
  className?: string;
  dataShapeKey?: string;
  deltaSeries?: GraphSeries[];
  emptyMessage?: string;
  markerSizePx?: number;
  normalizationTimeMs?: GraphNormalizationAnchor;
  series: GraphSeries[];
  seriesAxisMode?: GraphSeriesAxisMode;
  stackSeries?: boolean;
  timeAxisMode?: Exclude<GraphTimeAxisMode, "auto">;
  timeQuantization?: GraphTimeQuantizationMode;
  transparentSurface?: boolean;
  updateMode?: WidgetRuntimeUpdateMode;
  xAxisType?: "time" | "value";
  yAxisDecimals?: number;
  yAxisScaleZeros?: number;
  yAxisSuffix?: string;
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
  const resolvedTimeQuantization = useMemo(
    () => resolveGraphTimeQuantization(
      { provider: "echarts", timeQuantization },
      timeAxisMode,
    ),
    [timeAxisMode, timeQuantization],
  );

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
        markerSizePx,
        series: themedSeries,
        stackSeries,
        timeAxisMode,
        timeQuantization: resolvedTimeQuantization,
        tokens: resolvedTokens,
        xAxisType,
        yAxisDecimals,
        yAxisScaleZeros,
        yAxisSuffix,
      })
      : buildSharedChartOption({
          chartType,
          emptyMessage,
          markerSizePx,
          series: themedSeries,
          stackSeries,
          timeAxisMode,
          timeQuantization: resolvedTimeQuantization,
          tokens: resolvedTokens,
          xAxisType,
          yAxisDecimals,
          yAxisScaleZeros,
          yAxisSuffix,
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
      stackSeries,
      timeAxisMode,
      xAxisType,
      yAxisDecimals,
      yAxisScaleZeros,
      yAxisSuffix,
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
    markerSizePx,
    resolvedTokens,
    separateAxes,
    stackSeries,
    themedSeries,
    timeAxisMode,
    resolvedTimeQuantization,
    updateMode,
    xAxisType,
    yAxisDecimals,
    yAxisScaleZeros,
    yAxisSuffix,
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
