import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { fetchOrderBook } from "@/data/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderLevel } from "@/data/types";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<{ symbol?: string }>;

type Side = "bid" | "ask";

export function OrderBookDepthWidget({ props }: Props) {
  const symbol = props.symbol ?? "TSLA";
  const query = useQuery({
    queryKey: ["order-book", "depth", symbol],
    queryFn: () => fetchOrderBook(symbol),
    refetchInterval: 2_500,
  });

  const book = query.data;
  const bidRows = useMemo(() => book?.bids.slice(0, 8) ?? [], [book?.bids]);
  const askRows = useMemo(() => book?.asks.slice(0, 8) ?? [], [book?.asks]);
  const allRows = [...bidRows, ...askRows];
  const maxSize = Math.max(...allRows.map((row) => row.size), 1);
  const maxTotal = Math.max(...allRows.map((row) => row.total), 1);
  const bestBid = bidRows[0]?.price;
  const bestAsk = askRows[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-3">
      <div className="grid grid-cols-3 gap-2">
        <DepthStat
          label="Best Bid"
          value={bestBid !== undefined ? formatCurrency(bestBid) : "--"}
          tone="bid"
        />
        <DepthStat
          label="Spread"
          value={spread !== null ? formatCurrency(spread) : "--"}
          tone="neutral"
        />
        <DepthStat
          label="Best Ask"
          value={bestAsk !== undefined ? formatCurrency(bestAsk) : "--"}
          tone="ask"
        />
      </div>

      <div className="grid min-h-0 grid-cols-2 gap-3">
        <DepthColumn
          badgeVariant="success"
          label="Bids"
          maxSize={maxSize}
          maxTotal={maxTotal}
          rows={bidRows}
          side="bid"
          symbol={symbol}
        />
        <DepthColumn
          badgeVariant="danger"
          label="Asks"
          maxSize={maxSize}
          maxTotal={maxTotal}
          rows={askRows}
          side="ask"
          symbol={symbol}
        />
      </div>
    </div>
  );
}

function DepthStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ask" | "bid" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-[calc(var(--radius)-8px)] border px-3 py-2.5 shadow-sm",
        tone === "bid"
          ? "border-success/20 bg-success/10"
          : tone === "ask"
            ? "border-danger/20 bg-danger/10"
            : "border-border/70 bg-background/35",
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DepthColumn({
  badgeVariant,
  label,
  maxSize,
  maxTotal,
  rows,
  side,
  symbol,
}: {
  badgeVariant: "danger" | "success";
  label: string;
  maxSize: number;
  maxTotal: number;
  rows: OrderLevel[];
  side: Side;
  symbol: string;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Size as depth bars
          </div>
        </div>
        <Badge variant={badgeVariant}>{symbol}</Badge>
      </div>

      <div className="grid grid-cols-[auto_auto_auto] gap-x-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
        {rows.map((row) => (
          <DepthRow
            key={`${side}-${row.price}`}
            maxSize={maxSize}
            maxTotal={maxTotal}
            row={row}
            side={side}
          />
        ))}
      </div>
    </section>
  );
}

function DepthRow({
  maxSize,
  maxTotal,
  row,
  side,
}: {
  maxSize: number;
  maxTotal: number;
  row: OrderLevel;
  side: Side;
}) {
  const sizeWidth = `${Math.max((row.size / maxSize) * 100, 6)}%`;
  const totalWidth = `${Math.max((row.total / maxTotal) * 100, 10)}%`;

  return (
    <div className="relative overflow-hidden rounded-[calc(var(--radius)-9px)] border border-border/60 bg-background/40">
      <div
        className={cn(
          "absolute inset-y-0 opacity-100",
          side === "bid" ? "left-0 bg-success/18" : "right-0 bg-danger/18",
        )}
        style={{ width: sizeWidth }}
      />
      <div
        className={cn(
          "absolute inset-y-[4px] rounded-[calc(var(--radius)-11px)] opacity-100",
          side === "bid" ? "left-0 bg-success/10" : "right-0 bg-danger/10",
        )}
        style={{ width: totalWidth }}
      />

      <div className="relative grid grid-cols-[auto_auto_auto] items-center gap-x-3 px-3 py-2 text-xs">
        <div className={cn("font-medium", side === "bid" ? "text-success" : "text-danger")}>
          {formatCurrency(row.price)}
        </div>
        <div className="text-right text-foreground">{formatNumber(row.size)}</div>
        <div className="text-right text-muted-foreground">{formatNumber(row.total)}</div>
      </div>
    </div>
  );
}
