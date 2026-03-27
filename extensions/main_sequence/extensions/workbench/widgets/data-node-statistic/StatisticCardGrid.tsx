import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/ThemeProvider";

import type { DataNodeStatisticCard } from "./statisticModel";

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
}: {
  points: readonly number[];
}) {
  const { resolvedTokens } = useTheme();
  const geometry = buildChartGeometry(points, 100, 60);

  if (!geometry) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 bottom-0 h-[44%]">
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="h-full w-full"
        aria-hidden="true"
      >
        <path
          d={geometry.areaPath}
          fill={resolvedTokens.success}
          fillOpacity={0.18}
        />
        <path
          d={geometry.linePath}
          fill="none"
          stroke={resolvedTokens.success}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function StatisticCardGrid({
  cards,
  fillHeight = false,
  showCharts = true,
}: {
  cards: readonly DataNodeStatisticCard[];
  fillHeight?: boolean;
  showCharts?: boolean;
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
        const renderChart = showCharts && singleCard && (card.chartPoints?.length ?? 0) >= 2;

        return (
          <div
            key={card.id}
            className={cn(
              "relative overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-[var(--summary-stat-card-padding-x)] py-[var(--summary-stat-card-padding-y)]",
              fillHeight ? "h-full" : undefined,
              singleCard ? "min-h-[180px]" : "min-h-[132px]",
            )}
          >
            {renderChart ? <StatisticMiniChart points={card.chartPoints!} /> : null}

            <div className="relative z-10 flex h-full flex-col">
              {card.label ? (
                <div
                  className="truncate text-muted-foreground"
                  style={{ fontSize: "var(--summary-stat-label-size)" }}
                >
                  {card.label}
                </div>
              ) : null}

              <div
                className={cn(
                  "font-semibold tracking-tight text-foreground",
                  card.label ? "mt-[var(--summary-stat-value-margin-top)]" : "mt-auto mb-auto",
                  singleCard ? "text-center" : undefined,
                )}
                style={{
                  fontSize: singleCard
                    ? "clamp(2.75rem, 7vw, 4rem)"
                    : "var(--summary-stat-value-size)",
                }}
              >
                {card.formattedValue}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
