import { useEffect, useMemo, useRef } from "react";

import { AreaSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

export interface TimeseriesAreaChartPoint {
  time: number;
  value: number;
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
        .filter(
          (point) =>
            Number.isFinite(point.time) &&
            Number.isFinite(point.value),
        )
        .map((point) => ({
          time: Math.floor(point.time / 1000) as UTCTimestamp,
          value: point.value,
        })),
    [data],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || normalizedData.length === 0) {
      return;
    }

    const lineColor = color ?? resolvedTokens.primary;
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
          color: withAlpha(lineColor, 0.22),
          width: 1,
        },
        horzLine: {
          color: withAlpha(lineColor, 0.22),
          width: 1,
        },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      localization: valueFormatter
        ? {
            priceFormatter: valueFormatter,
          }
        : undefined,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: withAlpha(lineColor, 0.22),
      bottomColor: withAlpha(lineColor, 0.02),
      priceLineVisible: false,
      lastValueVisible: false,
    });

    series.setData(normalizedData);
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
  }, [color, normalizedData, resolvedTokens, valueFormatter]);

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
