import { useEffect, useRef, useState } from "react";

import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";
import type { ThemeTokens } from "@/themes/types";

import type { DataNodeStatisticCard, DataNodeStatisticTone } from "./statisticModel";

function buildChartGeometry(points: readonly number[], width: number, height: number) {
  if (points.length < 2) {
    return null;
  }

  const minValue = Math.min(...points);
  const maxValue = Math.max(...points);
  const range = maxValue - minValue || 1;
  const stepX = width / Math.max(points.length - 1, 1);

  const normalizedPoints = points.map((point, index) => {
    const x = index * stepX;
    const normalizedY = (point - minValue) / range;
    const y = height - normalizedY * height;

    return { x, y };
  });

  const linePath = normalizedPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${width.toFixed(2)} ${height.toFixed(2)} L 0 ${height.toFixed(2)} Z`;

  return {
    areaPath,
    linePath,
  };
}

function StatisticMiniChart({
  points,
  chartColor,
  heightPx,
}: {
  points: readonly number[];
  chartColor: string;
  heightPx?: number;
}) {
  const geometry = buildChartGeometry(points, 100, 60);

  if (!geometry) {
    return null;
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0"
      style={{ height: heightPx ? `${heightPx}px` : "44%" }}
    >
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden="true"
      >
        <path
          d={geometry.areaPath}
          fill={chartColor}
          fillOpacity={0.22}
        />
        <path
          d={geometry.linePath}
          fill="none"
          stroke={chartColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function resolveSemanticToneColor(
  tone: DataNodeStatisticTone | undefined,
  tokens: ThemeTokens,
) {
  if (tone === "primary") {
    return tokens.primary;
  }

  if (tone === "success") {
    return tokens.success;
  }

  if (tone === "warning") {
    return tokens.warning;
  }

  if (tone === "danger") {
    return tokens.danger;
  }

  return tokens.border;
}

function StatisticCard({
  card,
  fillHeight,
  showCharts,
  showSourceLabel,
  singleCard,
  sourceLabel,
}: {
  card: DataNodeStatisticCard;
  fillHeight: boolean;
  showCharts: boolean;
  showSourceLabel: boolean;
  singleCard: boolean;
  sourceLabel?: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardSize, setCardSize] = useState<{ height: number; width: number } | null>(null);
  const { resolvedTokens } = useTheme();

  useEffect(() => {
    if (!singleCard) {
      setCardSize(null);
      return;
    }

    const node = cardRef.current;

    if (!node) {
      return;
    }

    const updateSize = () => {
      setCardSize({
        height: node.clientHeight,
        width: node.clientWidth,
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [singleCard]);

  const chartHeightPx =
    singleCard && cardSize
      ? Math.max(32, Math.min(Math.round(cardSize.height * 0.36), 110))
      : undefined;
  const singleCardValueFontPx =
    singleCard && cardSize
      ? Math.max(28, Math.min(cardSize.width * 0.16, cardSize.height * 0.28, 64))
      : undefined;
  const renderChart = showCharts && singleCard && (card.chartPoints?.length ?? 0) >= 2;
  const toneColor = card.resolvedStyle?.tone
    ? resolveSemanticToneColor(card.resolvedStyle.tone, resolvedTokens)
    : undefined;
  const cardBackgroundColor = card.resolvedStyle?.backgroundColor ?? toneColor;
  const cardTextColor =
    card.resolvedStyle?.textColor ??
    (cardBackgroundColor ? resolvedTokens.card : undefined);
  const cardStyle = cardBackgroundColor
    ? {
        background: `linear-gradient(180deg, ${withAlpha(cardBackgroundColor, 0.92)} 0%, ${withAlpha(cardBackgroundColor, 0.8)} 100%)`,
        borderColor: withAlpha(cardBackgroundColor, 0.58),
        boxShadow: `inset 0 0 0 1px ${withAlpha(cardBackgroundColor, 0.26)}`,
      }
    : undefined;
  const chartColor = cardTextColor ?? toneColor ?? resolvedTokens.success;

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-[var(--summary-stat-card-padding-x)] py-[var(--summary-stat-card-padding-y)]",
        fillHeight ? "h-full" : undefined,
        singleCard ? (fillHeight ? "min-h-0" : "min-h-[180px]") : "min-h-[132px]",
      )}
      style={cardStyle}
    >
      {renderChart ? (
        <StatisticMiniChart
          points={card.chartPoints!}
          chartColor={chartColor}
          heightPx={chartHeightPx}
        />
      ) : null}

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        {card.label ? (
          <div
            className={cn(
              "truncate text-muted-foreground",
              singleCard ? "max-w-full text-center" : undefined,
            )}
            style={{
              fontSize: "var(--summary-stat-label-size)",
              color: cardTextColor ?? undefined,
            }}
          >
            {card.label}
          </div>
        ) : null}

        {card.metricLabel ? (
          <div
            className={cn(
              "truncate text-[11px] uppercase tracking-[0.12em] text-muted-foreground/90",
              singleCard ? "mt-1 max-w-full text-center" : "mt-1",
            )}
            style={{ color: cardTextColor ? withAlpha(cardTextColor, 0.84) : undefined }}
          >
            {card.metricLabel}
          </div>
        ) : null}

        <div
          className={cn(
            "flex min-h-0 flex-1",
            singleCard ? "items-center justify-center" : "items-end",
          )}
        >
          <div
            className={cn(
              "font-semibold tracking-tight text-foreground",
              singleCard ? "text-center" : undefined,
            )}
            style={{
              color: cardTextColor ?? undefined,
              fontSize: singleCard
                ? (singleCardValueFontPx ? `${singleCardValueFontPx}px` : "clamp(2.75rem, 7vw, 4rem)")
                : "var(--summary-stat-value-size)",
            }}
          >
            <span>{card.formattedPrimaryValue}</span>
            {card.formattedSuffix ? (
              <span
                className="ml-2 align-baseline font-medium tracking-normal"
                style={{
                  fontSize: "0.46em",
                  color: cardTextColor ? withAlpha(cardTextColor, 0.9) : undefined,
                }}
              >
                {card.formattedSuffix}
              </span>
            ) : null}
          </div>
        </div>

        {showSourceLabel && sourceLabel ? (
          <div
            className="mt-2 truncate text-left text-[10px] text-muted-foreground/85"
            style={{ color: cardTextColor ? withAlpha(cardTextColor, 0.76) : undefined }}
            title={sourceLabel}
          >
            {sourceLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StatisticCardGrid({
  cards,
  fillHeight = false,
  showCharts = true,
  showSourceLabel = false,
  sourceLabel,
}: {
  cards: readonly DataNodeStatisticCard[];
  fillHeight?: boolean;
  showCharts?: boolean;
  showSourceLabel?: boolean;
  sourceLabel?: string;
}) {
  const singleCard = cards.length === 1;
  const multiCardColumnCount = Math.max(1, Math.min(cards.length, 4));

  return (
    <div
      className={cn(
        "grid gap-[var(--summary-stat-grid-gap)]",
        fillHeight ? "h-full" : undefined,
        singleCard ? "grid-cols-1" : undefined,
      )}
      style={
        singleCard
          ? undefined
          : {
              gridAutoRows: fillHeight ? "minmax(0, 1fr)" : undefined,
              gridTemplateColumns: `repeat(${multiCardColumnCount}, minmax(0, 1fr))`,
            }
      }
    >
      {cards.map((card) => {
        return (
          <StatisticCard
            key={card.id}
            card={card}
            fillHeight={fillHeight}
            showCharts={showCharts}
            showSourceLabel={showSourceLabel}
            singleCard={singleCard}
            sourceLabel={sourceLabel}
          />
        );
      })}
    </div>
  );
}
