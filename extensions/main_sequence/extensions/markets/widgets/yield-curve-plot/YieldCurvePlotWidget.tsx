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

function getSeriesPalette(market: YieldCurveMarket, tokens: ReturnType<typeof useTheme>["resolvedTokens"]) {
  if (market === "bund") {
    return [tokens.accent, tokens.primary, tokens.success] as const;
  }

  if (market === "sofr") {
    return [tokens.warning, tokens.primary, tokens.accent] as const;
  }

  return [tokens.primary, tokens.accent, tokens.warning] as const;
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

  const palette = useMemo(() => getSeriesPalette(deck.market, resolvedTokens), [deck.market, resolvedTokens]);
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
      width: Math.max(container.clientWidth, 320),
      height: Math.max(container.clientHeight, 260),
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
      const color = palette[index] ?? palette[palette.length - 1];
      const emphasis = snapshot.emphasis === "primary";
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: emphasis ? 3 : 2,
        lineStyle: emphasis ? 0 : 2,
        pointMarkersVisible: true,
        pointMarkersRadius: emphasis ? 5 : 4,
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
      chart.applyOptions({
        width: Math.max(container.clientWidth, 320),
        height: Math.max(container.clientHeight, 260),
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [deck.snapshots, maturityLabelMap, palette, resolvedTokens]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        className="min-h-[280px] flex-1 rounded-[22px] px-2 pt-2 pb-5"
        style={{
          background: `linear-gradient(180deg, ${withAlpha(resolvedTokens.background, 0.76)} 0%, ${withAlpha(
            resolvedTokens.card,
            0.96,
          )} 100%)`,
        }}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>

      <div
        className="flex flex-wrap items-center gap-2 rounded-[18px] border px-4 py-3"
        style={{
          borderColor: withAlpha(resolvedTokens.border, 0.72),
          background: `linear-gradient(180deg, ${withAlpha(resolvedTokens.background, 0.62)} 0%, ${withAlpha(
            resolvedTokens.card,
            0.94,
          )} 100%)`,
        }}
      >
        {deck.snapshots.map((snapshot, index) => {
          const color = palette[index] ?? palette[palette.length - 1];

          return (
            <div
              key={snapshot.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: withAlpha(color, 0.26),
                backgroundColor: withAlpha(color, snapshot.emphasis === "primary" ? 0.16 : 0.1),
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-foreground">{snapshot.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
