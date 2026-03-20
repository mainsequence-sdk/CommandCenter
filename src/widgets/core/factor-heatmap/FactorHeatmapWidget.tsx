import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { withAlpha } from "@/lib/color";
import { formatDecimal } from "@/lib/format";
import { useTheme } from "@/themes/ThemeProvider";
import {
  heatmapColumns,
  heatmapRows,
  heatmapValues,
} from "@/widgets/core/quant-showcase/mock-data";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<Record<string, unknown>>;

export function FactorHeatmapWidget({}: Props) {
  const { resolvedTokens } = useTheme();
  const panelSurfaceStyle = {
    borderColor: withAlpha(resolvedTokens.border, 0.72),
    backgroundColor: withAlpha(resolvedTokens.muted, 0.42),
    color: withAlpha(resolvedTokens.foreground, 0.68),
  } as const;

  const highlights = useMemo(() => {
    return heatmapValues
      .flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => ({
          row: heatmapRows[rowIndex],
          column: heatmapColumns[columnIndex],
          value,
        })),
      )
      .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
      .slice(0, 3);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="primary">cross-impact</Badge>
          <Badge variant="secondary">6 x 6 matrix</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Positive cells highlight reinforcing pressure. Negative cells show friction.
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[96px_repeat(6,minmax(0,1fr))] gap-1.5">
        <div />
        {heatmapColumns.map((column) => (
          <div
            key={column}
            className="flex items-center justify-center rounded-[calc(var(--radius)-8px)] border px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[0.14em]"
            style={panelSurfaceStyle}
          >
            {column}
          </div>
        ))}

        {heatmapRows.map((row, rowIndex) => (
          <div key={row} className="contents">
            <div
              className="flex items-center rounded-[calc(var(--radius)-8px)] border px-3 text-[11px] font-medium uppercase tracking-[0.14em]"
              style={panelSurfaceStyle}
            >
              {row}
            </div>
            {heatmapValues[rowIndex].map((value, columnIndex) => {
              const positive = value >= 0;
              const tone = positive ? resolvedTokens.primary : resolvedTokens.danger;
              const intensity = 0.16 + Math.abs(value) * 0.46;

              return (
                <div
                  key={`${row}-${heatmapColumns[columnIndex]}`}
                  className="flex min-h-[62px] flex-col items-center justify-center rounded-[calc(var(--radius)-8px)] border text-center"
                  style={{
                    borderColor: withAlpha(tone, 0.34),
                    background: `linear-gradient(180deg, ${withAlpha(
                      tone,
                      intensity,
                    )} 0%, ${withAlpha(resolvedTokens.card, 0.82)} 100%)`,
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: resolvedTokens.foreground }}>
                    {value > 0 ? "+" : ""}
                    {formatDecimal(value)}
                  </div>
                  <div
                    className="mt-1 text-[10px] uppercase tracking-[0.14em]"
                    style={{ color: withAlpha(resolvedTokens.foreground, 0.62) }}
                  >
                    {positive ? "reinforce" : "drag"}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {highlights.map((item) => (
          <div
            key={`${item.row}-${item.column}`}
            className="rounded-[calc(var(--radius)-8px)] border px-3 py-2"
            style={panelSurfaceStyle}
          >
            <div
              className="text-[11px] uppercase tracking-[0.14em]"
              style={{ color: withAlpha(resolvedTokens.foreground, 0.62) }}
            >
              {item.row} -&gt; {item.column}
            </div>
            <div className="mt-1 text-base font-semibold" style={{ color: resolvedTokens.foreground }}>
              {item.value > 0 ? "+" : ""}
              {formatDecimal(item.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
