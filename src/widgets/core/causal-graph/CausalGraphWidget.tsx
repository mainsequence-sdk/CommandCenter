import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import {
  quantCausalEdges,
  quantCausalNodes,
  quantSummaryMetrics,
} from "@/widgets/core/quant-showcase/mock-data";
import type { WidgetComponentProps } from "@/widgets/types";

const viewBoxWidth = 760;
const viewBoxHeight = 430;

const clusterToToken = {
  Flow: "primary",
  Rates: "warning",
  Micro: "accent",
  Risk: "danger",
} as const;

function buildEdgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const x1 = from.x * viewBoxWidth;
  const y1 = from.y * viewBoxHeight;
  const x2 = to.x * viewBoxWidth;
  const y2 = to.y * viewBoxHeight;
  const curve = Math.max(48, Math.abs(x2 - x1) * 0.36);

  return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
}

type Props = WidgetComponentProps<Record<string, unknown>>;

export function CausalGraphWidget({}: Props) {
  const { resolvedTokens } = useTheme();
  const nodesById = new Map(quantCausalNodes.map((node) => [node.id, node]));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {quantSummaryMetrics.map((metric) => {
          const tone =
            metric.tone === "accent" ? resolvedTokens.accent : resolvedTokens[metric.tone];

          return (
            <div
              key={metric.label}
              className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {metric.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</div>
              <div
                className="mt-2 text-xs"
                style={{ color: withAlpha(tone, 0.9) }}
              >
                {metric.detail}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70"
        style={{
          background: `radial-gradient(circle at top left, ${withAlpha(
            resolvedTokens.primary,
            0.2,
          )} 0%, transparent 35%), radial-gradient(circle at bottom right, ${withAlpha(
            resolvedTokens.accent,
            0.16,
          )} 0%, transparent 36%), ${withAlpha(resolvedTokens.background, 0.72)}`,
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(${withAlpha(
              resolvedTokens.border,
              0.32,
            )} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(
              resolvedTokens.border,
              0.32,
            )} 1px, transparent 1px)`,
            backgroundPosition: "0 0, 0 0",
            backgroundSize: "44px 44px, 44px 44px",
          }}
        />

        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
          {quantCausalEdges.map((edge) => {
            const from = nodesById.get(edge.from);
            const to = nodesById.get(edge.to);

            if (!from || !to) {
              return null;
            }

            const tone =
              edge.polarity === "positive" ? resolvedTokens.primary : resolvedTokens.danger;
            const path = buildEdgePath(from, to);
            const strokeWidth = 1.4 + edge.weight * 4.2;

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={path}
                  fill="none"
                  stroke={withAlpha(tone, 0.16)}
                  strokeWidth={strokeWidth + 6}
                  strokeLinecap="round"
                />
                <path
                  d={path}
                  fill="none"
                  stroke={withAlpha(tone, 0.92)}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={edge.polarity === "negative" ? "10 9" : undefined}
                />
              </g>
            );
          })}
        </svg>

        {quantCausalNodes.map((node) => {
          const tokenKey = clusterToToken[node.cluster];
          const clusterTone =
            tokenKey === "accent" ? resolvedTokens.accent : resolvedTokens[tokenKey];
          const positive = node.impulse >= 0;

          return (
            <div
              key={node.id}
              className="absolute w-[150px] rounded-[18px] border p-3 shadow-[var(--shadow-panel)] backdrop-blur"
              style={{
                left: `calc(${node.x * 100}% - 75px)`,
                top: `calc(${node.y * 100}% - 44px)`,
                borderColor: withAlpha(clusterTone, 0.38),
                background: `linear-gradient(160deg, ${withAlpha(
                  clusterTone,
                  0.16,
                )} 0%, ${withAlpha(resolvedTokens.card, 0.9)} 58%, ${withAlpha(
                  resolvedTokens.background,
                  0.92,
                )} 100%)`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {node.cluster}
                  </div>
                  <div className="mt-1 text-sm font-semibold leading-5 text-card-foreground">
                    {node.label}
                  </div>
                </div>
                <Badge variant={positive ? "success" : "danger"} className="shrink-0">
                  {positive ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {node.score}
                </Badge>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Confidence
                  </div>
                  <div className="mt-1 text-lg font-semibold text-card-foreground">
                    {Math.round(node.confidence * 100)}%
                  </div>
                </div>
                <div
                  className="rounded-full px-2 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: withAlpha(clusterTone, 0.16),
                    color: clusterTone,
                  }}
                >
                  {node.detail}
                </div>
              </div>
            </div>
          );
        })}

        <div
          className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-muted-foreground backdrop-blur"
          style={{
            borderColor: withAlpha(resolvedTokens.border, 0.72),
            backgroundColor: withAlpha(resolvedTokens.card, 0.78),
          }}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Propagation topology updates every 15 minutes in mock mode
        </div>
      </div>
    </div>
  );
}
