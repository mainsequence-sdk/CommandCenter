import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchKpiCards } from "@/data/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<{ symbol?: string }>;

function formatKpi(value: number, format: "currency" | "number" | "percent") {
  if (format === "currency") return formatCurrency(value, true);
  if (format === "percent") return `${value.toFixed(1)}%`;
  return formatNumber(value);
}

export function MarketKpisWidget({ props }: Props) {
  const symbol = props.symbol ?? "AAPL";
  const { rangeStartMs, rangeEndMs, timeRangeKey } = useDashboardControls();
  const query = useQuery({
    queryKey: ["kpi-cards", symbol, timeRangeKey, rangeStartMs, rangeEndMs],
    queryFn: () => fetchKpiCards(symbol),
  });

  if (query.isLoading) {
    return (
      <div className="grid h-full grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-full rounded-[calc(var(--radius)-6px)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-2 gap-3">
      {query.data?.map((item) => {
        const positive = item.changePct >= 0;

        return (
          <div
            key={item.label}
            className="flex min-h-[118px] flex-col justify-between rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45 p-4"
          >
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </div>
              <div className="text-2xl font-semibold tracking-tight">
                {formatKpi(item.value, item.format)}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Badge variant={positive ? "success" : "danger"}>
                {positive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {formatPercent(item.changePct)}
              </Badge>
              <div className="text-xs text-muted-foreground">{item.hint}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
