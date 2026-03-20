import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { AreaSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPriceHistory } from "@/data/api";
import { terminalSocket } from "@/data/terminal-socket";
import { env } from "@/config/env";
import { withAlpha } from "@/lib/color";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetComponentProps } from "@/widgets/types";

type Props = WidgetComponentProps<{ symbol?: string }>;

export function PriceChartWidget({ props }: Props) {
  const symbol = props.symbol ?? "AAPL";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const { resolvedTokens } = useTheme();
  const { t } = useTranslation();

  const historyQuery = useQuery({
    queryKey: ["price-history", symbol],
    queryFn: () => fetchPriceHistory(symbol),
  });

  const lastHistoryValue = useMemo(() => {
    const points = historyQuery.data ?? [];
    return points.at(-1)?.value ?? null;
  }, [historyQuery.data]);

  useEffect(() => {
    setLatestPrice(lastHistoryValue);
  }, [lastHistoryValue]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || historyQuery.isLoading || !historyQuery.data) {
      return;
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: resolvedTokens["muted-foreground"],
      },
      grid: {
        vertLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.12) },
        horzLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.12) },
      },
      rightPriceScale: {
        borderColor: resolvedTokens.border,
      },
      timeScale: {
        borderColor: resolvedTokens.border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: withAlpha(resolvedTokens.primary, 0.25),
          width: 1,
        },
        horzLine: {
          color: withAlpha(resolvedTokens.primary, 0.25),
          width: 1,
        },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      localization: {
        priceFormatter: (price: number) => `$${price.toFixed(2)}`,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: resolvedTokens.primary,
      topColor: withAlpha(resolvedTokens.primary, 0.26),
      bottomColor: withAlpha(resolvedTokens.primary, 0.03),
      priceLineColor: resolvedTokens.accent,
    });

    series.setData(
      historyQuery.data.map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      })),
    );
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });

    resizeObserver.observe(container);

    const unsubscribe = terminalSocket.subscribePrice(symbol, (tick) => {
      series.update({
        time: tick.time as UTCTimestamp,
        value: tick.price,
      });
      setLatestPrice(tick.price);
    });

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [historyQuery.data, historyQuery.isLoading, resolvedTokens, symbol]);

  if (historyQuery.isLoading) {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  const changePct =
    latestPrice && lastHistoryValue
      ? ((latestPrice - lastHistoryValue) / lastHistoryValue) * 100
      : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {symbol}
          </div>
          <div className="mt-1 text-2xl font-semibold">{formatCurrency(latestPrice ?? 0)}</div>
        </div>
        <div className="text-right">
          <Badge variant={changePct >= 0 ? "success" : "danger"}>
            {formatPercent(changePct)}
          </Badge>
          <div className="mt-2 text-xs text-muted-foreground">
            {env.useMockData ? t("settingsDialog.mockData") : t("settingsDialog.liveData")}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/45">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
