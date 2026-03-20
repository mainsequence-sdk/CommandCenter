import { Badge } from "@/components/ui/badge";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import {
  distributionActive,
  distributionBaseline,
  distributionBuckets,
  distributionMarkers,
  distributionStats,
  distributionStress,
} from "@/widgets/core/quant-showcase/mock-data";
import type { WidgetComponentProps } from "@/widgets/types";

const chartWidth = 760;
const chartHeight = 260;
const chartPadding = 24;

function buildAreaPath(values: readonly number[]) {
  const max = Math.max(...distributionBaseline, ...distributionActive, ...distributionStress);
  const usableWidth = chartWidth - chartPadding * 2;
  const usableHeight = chartHeight - chartPadding * 2;
  const step = usableWidth / (values.length - 1);

  const line = values
    .map((value, index) => {
      const x = chartPadding + index * step;
      const y = chartHeight - chartPadding - (value / max) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return `${line} L ${chartPadding + usableWidth} ${chartHeight - chartPadding} L ${chartPadding} ${chartHeight - chartPadding} Z`;
}

type Props = WidgetComponentProps<Record<string, unknown>>;

export function DistributionLabWidget({}: Props) {
  const { resolvedTokens } = useTheme();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">baseline</Badge>
          <Badge variant="primary">live density</Badge>
          <Badge variant="warning">stress blend</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Distribution normalized over rolling 60-day factor returns
        </div>
      </div>

      <div
        className="relative min-h-[260px] flex-1 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70"
        style={{
          background: `linear-gradient(180deg, ${withAlpha(
            resolvedTokens.card,
            0.88,
          )} 0%, ${withAlpha(resolvedTokens.background, 0.88)} 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(${withAlpha(
              resolvedTokens.border,
              0.28,
            )} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(
              resolvedTokens.border,
              0.28,
            )} 1px, transparent 1px)`,
            backgroundSize: "56px 56px, 56px 56px",
          }}
        />

        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {distributionMarkers.map((marker) => {
            const x = chartPadding + marker.x * (chartWidth - chartPadding * 2);

            return (
              <g key={marker.label}>
                <line
                  x1={x}
                  x2={x}
                  y1={chartPadding}
                  y2={chartHeight - chartPadding}
                  stroke={withAlpha(resolvedTokens.border, 0.5)}
                  strokeDasharray="8 8"
                />
                <text
                  x={x}
                  y={24}
                  fill={resolvedTokens["muted-foreground"]}
                  fontSize="11"
                  textAnchor="middle"
                >
                  {marker.label}
                </text>
                <text
                  x={x}
                  y={42}
                  fill={resolvedTokens["topbar-foreground"]}
                  fontSize="12"
                  textAnchor="middle"
                >
                  {marker.value}
                </text>
              </g>
            );
          })}

          <path
            d={buildAreaPath(distributionStress)}
            fill={withAlpha(resolvedTokens.warning, 0.18)}
            stroke={withAlpha(resolvedTokens.warning, 0.88)}
            strokeWidth="2"
          />
          <path
            d={buildAreaPath(distributionBaseline)}
            fill={withAlpha(resolvedTokens.foreground, 0.06)}
            stroke={withAlpha(resolvedTokens.foreground, 0.5)}
            strokeWidth="2"
          />
          <path
            d={buildAreaPath(distributionActive)}
            fill={withAlpha(resolvedTokens.primary, 0.2)}
            stroke={withAlpha(resolvedTokens.primary, 0.95)}
            strokeWidth="2.5"
          />
        </svg>

        <div className="absolute inset-x-6 bottom-4 grid grid-cols-7 gap-2 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {distributionBuckets.map((bucket, index) =>
            index % 2 === 0 ? <div key={bucket}>{bucket}</div> : <div key={bucket} />,
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {distributionStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-background/35 px-3 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-1 text-lg font-semibold text-card-foreground">{stat.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{stat.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
