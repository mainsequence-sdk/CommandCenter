import { useEffect, useMemo, useRef } from "react";

import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

export interface TimeseriesAreaChartPoint {
  time: number;
  value: number;
}

const axisTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const tooltipTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatAxisTimeLabel(value: number) {
  return axisTimeFormatter.format(new Date(value));
}

function formatTooltipTimeLabel(value: number) {
  return tooltipTimeFormatter.format(new Date(value));
}

export function TimeseriesAreaChart({
  className,
  color,
  data,
  emptyMessage = "No data available.",
  valueFormatter,
}: {
  className?: string;
  color?: string;
  data: TimeseriesAreaChartPoint[];
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTokens } = useTheme();

  const normalizedData = useMemo(
    () =>
      data
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
        .map((point) => [point.time, point.value] as [number, number]),
    [data],
  );

  const chartOption = useMemo<EChartsOption | null>(() => {
    if (normalizedData.length === 0) {
      return null;
    }

    const lineColor = color ?? resolvedTokens.primary;

    return {
      animation: false,
      backgroundColor: "transparent",
      textStyle: {
        color: resolvedTokens.foreground,
      },
      grid: {
        top: 12,
        left: 8,
        right: 8,
        bottom: 10,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: resolvedTokens.card,
        borderColor: withAlpha(resolvedTokens.border, 0.72),
        textStyle: {
          color: resolvedTokens.foreground,
        },
        formatter: (params) => {
          const firstParam = Array.isArray(params) ? params[0] : params;

          if (!firstParam || Array.isArray(firstParam.value)) {
            const valueTuple = Array.isArray(firstParam?.value)
              ? (firstParam.value as [number, number])
              : null;
            if (!valueTuple) {
              return "";
            }

            const [timeValue, pointValue] = valueTuple;
            const formattedValue =
              typeof pointValue === "number" && Number.isFinite(pointValue)
                ? (valueFormatter?.(pointValue) ?? pointValue.toFixed(2))
                : "No data";

            return `${formatTooltipTimeLabel(timeValue)}<br/>${formattedValue}`;
          }

          return "";
        },
        axisPointer: {
          type: "line",
          lineStyle: {
            color: withAlpha(lineColor, 0.28),
            width: 1,
          },
        },
      },
      xAxis: {
        type: "time",
        axisLine: {
          lineStyle: {
            color: withAlpha(resolvedTokens.border, 0.78),
          },
        },
        axisLabel: {
          color: resolvedTokens["muted-foreground"],
          hideOverlap: true,
          formatter: (value: number) => formatAxisTimeLabel(value),
        },
        splitLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: resolvedTokens["muted-foreground"],
          formatter: (value: number) =>
            typeof value === "number" && Number.isFinite(value)
              ? (valueFormatter?.(value) ?? value.toFixed(2))
              : "",
        },
        splitLine: {
          lineStyle: {
            color: withAlpha(resolvedTokens["chart-grid"], 0.16),
          },
        },
      },
      series: [
        {
          type: "line",
          data: normalizedData,
          showSymbol: normalizedData.length === 1,
          symbol: "circle",
          symbolSize: normalizedData.length === 1 ? 7 : 4,
          smooth: false,
          lineStyle: {
            color: lineColor,
            width: 2,
          },
          itemStyle: {
            color: lineColor,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(lineColor, 0.24) },
              { offset: 1, color: withAlpha(lineColor, 0.03) },
            ]),
          },
        },
      ],
    };
  }, [color, normalizedData, resolvedTokens, valueFormatter]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !chartOption) {
      return;
    }

    const chart = echarts.init(container, undefined, {
      renderer: "svg",
    });

    chart.setOption(chartOption);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [chartOption]);

  if (normalizedData.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[160px] items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 text-sm text-muted-foreground",
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
        "overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35",
        className,
      )}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
