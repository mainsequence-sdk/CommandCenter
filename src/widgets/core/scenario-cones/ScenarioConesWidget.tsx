import { Badge } from "@/components/ui/badge";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import { scenarioCones } from "@/widgets/core/quant-showcase/mock-data";
import type { WidgetComponentProps } from "@/widgets/types";

const chartWidth = 220;
const chartHeight = 120;

function buildLine(values: number[]) {
  const paddingX = 12;
  const paddingY = 10;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;
  const step = usableWidth / (values.length - 1);

  return values
    .map((value, index) => {
      const x = paddingX + index * step;
      const y = paddingY + (1 - (value + 1) / 2) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildBand(upper: number[], lower: number[]) {
  return `${buildLine(upper)} ${lower
    .slice()
    .reverse()
    .map((value, index) => {
      const paddingX = 12;
      const paddingY = 10;
      const usableWidth = chartWidth - paddingX * 2;
      const usableHeight = chartHeight - paddingY * 2;
      const step = usableWidth / (lower.length - 1);
      const x = paddingX + (lower.length - 1 - index) * step;
      const y = paddingY + (1 - (value + 1) / 2) * usableHeight;
      return `L ${x} ${y}`;
    })
    .join(" ")} Z`;
}

type Props = WidgetComponentProps<Record<string, unknown>>;

export function ScenarioConesWidget({}: Props) {
  const { resolvedTokens } = useTheme();

  return (
    <div className="grid h-full gap-3 md:grid-cols-3">
      {scenarioCones.map((scenario) => {
        const tone =
          scenario.tone === "primary"
            ? resolvedTokens.primary
            : scenario.tone === "warning"
              ? resolvedTokens.warning
              : resolvedTokens.danger;

        return (
          <div
            key={scenario.name}
            className="flex min-h-0 flex-col rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {scenario.name}
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-card-foreground">
                  {Math.round(scenario.probability * 100)}%
                </div>
              </div>
              <Badge variant={scenario.tone}>{scenario.horizon}</Badge>
            </div>

            <div
              className="mt-4 overflow-hidden rounded-[calc(var(--radius)-8px)] border"
              style={{
                borderColor: withAlpha(resolvedTokens.border, 0.72),
                background: `linear-gradient(180deg, ${withAlpha(
                  tone,
                  0.12,
                )} 0%, ${withAlpha(resolvedTokens.card, 0.72)} 100%)`,
              }}
            >
              <svg className="h-[120px] w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                <path
                  d={buildBand(scenario.upper, scenario.lower)}
                  fill={withAlpha(tone, 0.18)}
                />
                <path
                  d={buildLine(scenario.center)}
                  fill="none"
                  stroke={withAlpha(tone, 0.96)}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-card/55 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Expected move
                </div>
                <div className="mt-1 text-sm font-semibold text-card-foreground">
                  {scenario.expectedMove}
                </div>
              </div>
              <div className="rounded-[calc(var(--radius)-8px)] border border-border/60 bg-card/55 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Half-life
                </div>
                <div className="mt-1 text-sm font-semibold text-card-foreground">
                  {scenario.halfLife}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {scenario.drivers.map((driver) => (
                <span
                  key={driver}
                  className="rounded-full border border-border/60 bg-card/55 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {driver}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
