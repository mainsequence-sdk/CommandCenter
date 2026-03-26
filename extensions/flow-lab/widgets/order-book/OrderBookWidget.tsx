import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { fetchOrderBook } from "@/data/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<{ symbol?: string }>;

export function OrderBookWidget({ props }: Props) {
  const symbol = props.symbol ?? "TSLA";
  const query = useQuery({
    queryKey: ["order-book", symbol],
    queryFn: () => fetchOrderBook(symbol),
    refetchInterval: 2_500,
  });

  const book = query.data;

  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-3">
      <div className="min-h-0 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">Bids</div>
          <Badge variant="success">{symbol}</Badge>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <div>Price</div>
          <div className="text-right">Size</div>
          <div className="text-right">Total</div>
          {book?.bids.map((row) => (
            <FragmentRow
              key={`bid-${row.price}`}
              price={formatCurrency(row.price)}
              size={formatNumber(row.size)}
              total={formatNumber(row.total)}
              positive
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium">Asks</div>
          <Badge variant="danger">{symbol}</Badge>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <div>Price</div>
          <div className="text-right">Size</div>
          <div className="text-right">Total</div>
          {book?.asks.map((row) => (
            <FragmentRow
              key={`ask-${row.price}`}
              price={formatCurrency(row.price)}
              size={formatNumber(row.size)}
              total={formatNumber(row.total)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  price,
  size,
  total,
  positive = false,
}: {
  price: string;
  size: string;
  total: string;
  positive?: boolean;
}) {
  return (
    <>
      <div className={positive ? "text-success" : "text-danger"}>{price}</div>
      <div className="text-right text-foreground">{size}</div>
      <div className="text-right text-muted-foreground">{total}</div>
    </>
  );
}
