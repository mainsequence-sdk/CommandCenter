import { useEffect, useMemo, useRef } from "react";

import {
  ColorType,
  LineSeries,
  TickMarkType,
  createChart,
  type Time,
} from "lightweight-charts";

import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  buildMockYieldCurveDeck,
  normalizeYieldCurveComparisonMode,
  normalizeYieldCurveMarket,
  normalizeYieldCurveScenario,
  type YieldCurveComparisonMode,
  type YieldCurveMarket,
  type YieldCurveScenario,
} from "./mock-data";

export interface YieldCurvePlotWidgetProps extends Record<string, unknown> {
  market?: YieldCurveMarket;
  scenario?: YieldCurveScenario;
  comparisonMode?: YieldCurveComparisonMode;
}

type Props = WidgetComponentProps<YieldCurvePlotWidgetProps>;

function formatYield(value: number) {
  return `${value.toFixed(2)}%`;
}

function toTimeKey(time: Time) {
  if (typeof time === "number" || typeof time === "string") {
    return String(time);
  }

  return `${time.year}-${time.month}-${time.day}`;
}

function getMarketTone(
  market: YieldCurveMarket,
  tokens: ReturnType<typeof useTheme>["resolvedTokens"],
) {
  if (market === "bund") {
    return tokens.accent;
  }

  if (market === "sofr") {
    return tokens.warning;
  }

  return tokens.primary;
}

function getSnapshotOpacity(index: number, total: number) {
  const progress = total <= 1 ? 1 : 1 - index / (total - 1);
  return 0.22 + progress * 0.72;
}

function getSnapshotColor(baseTone: string, index: number, total: number) {
  return withAlpha(baseTone, getSnapshotOpacity(index, total));
}

function getSnapshotLineWidth(index: number) {
  if (index === 0) {
    return 3;
  }

  if (index === 1) {
    return 2;
  }

  return 1;
}

function getChartSize(container: HTMLDivElement) {
  return {
    width: Math.max(container.clientWidth, 1),
    height: Math.max(container.clientHeight, 1),
  };
}

export function YieldCurvePlotWidget({ props }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTokens } = useTheme();

  const market = normalizeYieldCurveMarket(props.market);
  const scenario = normalizeYieldCurveScenario(props.scenario);
  const comparisonMode = normalizeYieldCurveComparisonMode(props.comparisonMode);

  const deck = useMemo(
    () =>
      buildMockYieldCurveDeck({
        market,
        scenario,
        comparisonMode,
      }),
    [comparisonMode, market, scenario],
  );

  const baseTone = useMemo(
    () => getMarketTone(deck.market, resolvedTokens),
    [deck.market, resolvedTokens],
  );
  const maturityLabelMap = useMemo(
    () => new Map(deck.points.map((point) => [String(point.time), point.label])),
    [deck.points],
  );

  useEffect(() => {
    const container = containerRef.current;

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
        horzLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.14) },
      },
      ...getChartSize(container),
      leftPriceScale: {
        visible: false,
      },
      rightPriceScale: {
        borderColor: withAlpha(resolvedTokens.border, 0.72),
        scaleMargins: {
          top: 0.16,
          bottom: 0.14,
        },
      },
      crosshair: {
        vertLine: {
          color: withAlpha(resolvedTokens.foreground, 0.18),
          width: 1,
        },
        horzLine: {
          color: withAlpha(resolvedTokens.foreground, 0.18),
          width: 1,
        },
      },
      localization: {
        priceFormatter: formatYield,
      },
      timeScale: {
        borderColor: withAlpha(resolvedTokens.border, 0.72),
        minBarSpacing: 28,
        rightOffset: 8,
        tickMarkFormatter: (time: Time, _tickMarkType: TickMarkType) =>
          maturityLabelMap.get(toTimeKey(time)) ?? null,
      },
    });

    deck.snapshots.forEach((snapshot, index) => {
      const color = getSnapshotColor(baseTone, index, deck.snapshots.length);
      const emphasis = index === 0;
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: getSnapshotLineWidth(index),
        lineStyle: 0,
        pointMarkersVisible: emphasis,
        pointMarkersRadius: emphasis ? 5 : 0,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: emphasis ? 5 : 4,
        crosshairMarkerBorderColor: color,
        crosshairMarkerBackgroundColor: resolvedTokens.card,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      series.setData(
        snapshot.points.map((point) => ({
          time: point.time,
          value: point.value,
        })),
      );
    });

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions(getChartSize(container));
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [baseTone, deck.snapshots, maturityLabelMap, resolvedTokens]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        className="min-h-0 flex-1 overflow-hidden rounded-[22px] px-2 pt-2 pb-5"
        style={{
          background: `linear-gradient(180deg, ${withAlpha(resolvedTokens.background, 0.76)} 0%, ${withAlpha(
            resolvedTokens.card,
            0.96,
          )} 100%)`,
        }}
      >
        <div ref={containerRef} className="h-full min-h-0 w-full" />
      </div>

      <div
        className="shrink-0 flex flex-wrap items-center gap-2 rounded-[18px] border px-4 py-3"
        style={{
          borderColor: withAlpha(resolvedTokens.border, 0.72),
          background: `linear-gradient(180deg, ${withAlpha(resolvedTokens.background, 0.62)} 0%, ${withAlpha(
            resolvedTokens.card,
            0.94,
          )} 100%)`,
        }}
      >
        {deck.snapshots.map((snapshot, index) => {
          const opacity = getSnapshotOpacity(index, deck.snapshots.length);
          const color = withAlpha(baseTone, opacity);

          return (
            <div
              key={snapshot.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: withAlpha(baseTone, Math.max(0.16, opacity * 0.4)),
                backgroundColor: withAlpha(
                  baseTone,
                  snapshot.emphasis === "primary"
                    ? Math.max(0.14, opacity * 0.22)
                    : Math.max(0.08, opacity * 0.18),
                ),
              }}
            >
              <span
                className="h-2.5 w-8 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${withAlpha(baseTone, Math.max(0.12, opacity * 0.4))} 0%, ${color} 100%)`,
                }}
              />
              <span className="font-medium text-foreground">{snapshot.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
