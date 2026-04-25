import { useEffect, useMemo, useRef } from "react";

import { BarChart3, Database } from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type UTCTimestamp,
} from "lightweight-charts";

import { Skeleton } from "@/components/ui/skeleton";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetComponentProps } from "@/widgets/types";

import { useResolvedDataNodeWidgetSourceBinding } from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import {
  buildOhlcBarsFieldOptionsFromRuntime,
  buildOhlcBarsSeries,
  normalizeOhlcBarsProps,
  resolveOhlcBarsConfig,
  type MainSequenceOhlcBarsWidgetProps,
} from "./ohlcBarsModel";

type Props = WidgetComponentProps<MainSequenceOhlcBarsWidgetProps>;

function getChartSize(container: HTMLDivElement) {
  return {
    width: Math.max(container.clientWidth, 1),
    height: Math.max(container.clientHeight, 1),
  };
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: "binding" | "chart";
  title: string;
  description: string;
}) {
  const Icon = icon === "binding" ? Database : BarChart3;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function OhlcBarsWidget({ props, instanceId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTokens } = useTheme();

  const normalizedProps = useMemo(
    () => normalizeOhlcBarsProps(props),
    [props],
  );
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
  });
  useResolveWidgetUpstream(instanceId, {
    enabled: sourceBinding.requiresUpstreamResolution,
  });
  const linkedDataset = sourceBinding.resolvedSourceDataset;
  const effectiveProps = useMemo(
    () => ({
      ...normalizedProps,
      ...sourceBinding.resolvedSourceProps,
    }),
    [normalizedProps, sourceBinding.resolvedSourceProps],
  );
  const runtimeFieldOptions = useMemo(
    () => buildOhlcBarsFieldOptionsFromRuntime(linkedDataset),
    [linkedDataset],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveOhlcBarsConfig(
        effectiveProps,
        undefined,
        runtimeFieldOptions.length > 0 ? runtimeFieldOptions : undefined,
      ),
    [effectiveProps, runtimeFieldOptions],
  );
  const seriesResult = useMemo(
    () => buildOhlcBarsSeries(linkedDataset?.rows ?? [], resolvedConfig),
    [linkedDataset?.rows, resolvedConfig],
  );
  const hasRuntimeRows = (linkedDataset?.rows?.length ?? 0) > 0;

  useEffect(() => {
    const container = containerRef.current;

    if (!container || seriesResult.points.length === 0) {
      return;
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: resolvedTokens["muted-foreground"],
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.08) },
        horzLines: { color: withAlpha(resolvedTokens["chart-grid"], 0.14) },
      },
      rightPriceScale: {
        borderColor: withAlpha(resolvedTokens.border, 0.72),
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: withAlpha(resolvedTokens.border, 0.72),
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
      crosshair: {
        vertLine: {
          color: withAlpha(resolvedTokens.foreground, 0.18),
          width: 1,
        },
        horzLine: {
          color: withAlpha(resolvedTokens.foreground, 0.18),
          width: 1,
        },
      },
      ...getChartSize(container),
    });

    const bars = chart.addSeries(CandlestickSeries, {
      upColor: resolvedTokens.success,
      downColor: resolvedTokens.danger,
      borderUpColor: resolvedTokens.success,
      borderDownColor: resolvedTokens.danger,
      wickUpColor: withAlpha(resolvedTokens.success, 0.78),
      wickDownColor: withAlpha(resolvedTokens.danger, 0.78),
      borderVisible: true,
      wickVisible: true,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    bars.setData(
      seriesResult.points.map((point) => ({
        close: point.close,
        high: point.high,
        low: point.low,
        open: point.open,
        time: point.time as UTCTimestamp,
      })),
    );
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions(getChartSize(container));
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [resolvedTokens, seriesResult.points]);

  if (sourceBinding.isFilterWidgetSource && !sourceBinding.hasResolvedFilterWidgetSource) {
    return (
      <EmptyState
        icon="binding"
        title="Bind an OHLC dataset"
        description="Connect this chart to a Connection Query or Tabular Transform dataset."
      />
    );
  }

  if (
    !resolvedConfig.timeField ||
    !resolvedConfig.openField ||
    !resolvedConfig.highField ||
    !resolvedConfig.lowField ||
    !resolvedConfig.closeField
  ) {
    return (
      <EmptyState
        icon="chart"
        title="OHLC field mapping is incomplete"
        description="Choose time, open, high, low, and close fields in the widget settings."
      />
    );
  }

  if (linkedDataset == null || linkedDataset.status === "loading") {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (linkedDataset.status === "error") {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {linkedDataset.error ?? "The bound dataset failed to load rows."}
      </div>
    );
  }

  if (!hasRuntimeRows || seriesResult.points.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="No OHLC bars could be rendered"
        description="The linked rows did not contain parsable time, open, high, low, and close values."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {seriesResult.invalidRowCount > 0 ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Skipped {seriesResult.invalidRowCount.toLocaleString()} row
          {seriesResult.invalidRowCount === 1 ? "" : "s"} because the selected OHLC fields could not be parsed.
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)-6px)] border px-2 pt-2 pb-4"
        style={{
          borderColor: withAlpha(resolvedTokens.border, 0.72),
          background: `linear-gradient(180deg, ${withAlpha(resolvedTokens.background, 0.76)} 0%, ${withAlpha(
            resolvedTokens.card,
            0.96,
          )} 100%)`,
        }}
      >
        <div ref={containerRef} className="h-full min-h-0 w-full" />
      </div>
    </div>
  );
}
