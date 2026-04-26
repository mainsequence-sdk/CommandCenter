import { useEffect, useMemo, useRef } from "react";

import { BarChart3, Database } from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
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
  type OhlcBarsStudyConfig,
} from "./ohlcBarsModel";

type Props = WidgetComponentProps<MainSequenceOhlcBarsWidgetProps>;
type OhlcChartApi = ReturnType<typeof createChart>;
type OhlcSeriesApi = Parameters<OhlcChartApi["removeSeries"]>[0];
type OhlcChartPoint = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: UTCTimestamp;
};
type OhlcLinePoint = {
  time: UTCTimestamp;
  value: number;
};
type OhlcVolumePoint = OhlcLinePoint & {
  color: string;
};

function getChartSize(container: HTMLDivElement) {
  return {
    width: Math.max(container.clientWidth, 1),
    height: Math.max(container.clientHeight, 1),
  };
}

function mapOhlcChartPoints(points: ReturnType<typeof buildOhlcBarsSeries>["points"]) {
  return points.map<OhlcChartPoint>((point) => ({
    close: point.close,
    high: point.high,
    low: point.low,
    open: point.open,
    time: point.time as UTCTimestamp,
  }));
}

function mapVolumeChartPoints(
  points: ReturnType<typeof buildOhlcBarsSeries>["points"],
  resolvedTokens: Record<string, string>,
) {
  return points.flatMap<OhlcVolumePoint>((point) => {
    if (point.volume === undefined) {
      return [];
    }

    return [{
      color: withAlpha(point.close >= point.open ? resolvedTokens.success : resolvedTokens.danger, 0.42),
      time: point.time as UTCTimestamp,
      value: point.volume,
    }];
  });
}

function mapStudyChartPoints(
  points: ReturnType<typeof buildOhlcBarsSeries>["points"],
  study: Required<OhlcBarsStudyConfig>,
) {
  const period = Math.max(2, Math.min(Math.trunc(Number(study.period) || 20), 500));
  const closes = points.map((point) => point.close);

  if (study.type === "ema") {
    const multiplier = 2 / (period + 1);
    let ema: number | null = null;
    let rollingSum = 0;

    return points.flatMap<OhlcLinePoint>((point, index) => {
      rollingSum += closes[index] ?? 0;

      if (index < period - 1) {
        return [];
      }

      if (ema === null) {
        ema = rollingSum / period;
      } else {
        ema = point.close * multiplier + ema * (1 - multiplier);
      }

      return [{
        time: point.time as UTCTimestamp,
        value: ema,
      }];
    });
  }

  let rollingSum = 0;

  return points.flatMap<OhlcLinePoint>((point, index) => {
    rollingSum += point.close;

    if (index >= period) {
      rollingSum -= closes[index - period] ?? 0;
    }

    if (index < period - 1) {
      return [];
    }

    return [{
      time: point.time as UTCTimestamp,
      value: rollingSum / period,
    }];
  });
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
  const chartRef = useRef<OhlcChartApi | null>(null);
  const barsRef = useRef<OhlcSeriesApi | null>(null);
  const volumeRef = useRef<OhlcSeriesApi | null>(null);
  const studyRefs = useRef<OhlcSeriesApi[]>([]);
  const hasFittedRef = useRef(false);
  const lastPointCountRef = useRef(0);
  const lastShapeKeyRef = useRef<string | null>(null);
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
  const deltaSeriesResult = useMemo(
    () => buildOhlcBarsSeries(sourceBinding.resolvedSourceDeltaDataset?.rows ?? [], resolvedConfig),
    [resolvedConfig, sourceBinding.resolvedSourceDeltaDataset?.rows],
  );
  const sourceUpdate = sourceBinding.resolvedSourceInput?.upstreamUpdate;
  const chartUpdateMode =
    sourceUpdate?.mode === "delta" &&
    deltaSeriesResult.points.length > 0 &&
    (sourceUpdate.operations?.pruned ?? 0) === 0
      ? "delta"
      : "snapshot";
  const chartDataShapeKey = useMemo(
    () =>
      JSON.stringify({
        closeField: resolvedConfig.closeField,
        highField: resolvedConfig.highField,
        lowField: resolvedConfig.lowField,
        openField: resolvedConfig.openField,
        studies: resolvedConfig.studies.map((study) => `${study.type}:${study.period}`).join("|"),
        timeField: resolvedConfig.timeField,
        volumeField: resolvedConfig.volumeField,
      }),
    [
      resolvedConfig.closeField,
      resolvedConfig.highField,
      resolvedConfig.lowField,
      resolvedConfig.openField,
      resolvedConfig.studies,
      resolvedConfig.timeField,
      resolvedConfig.volumeField,
    ],
  );
  const hasRuntimeRows = (linkedDataset?.rows?.length ?? 0) > 0;
  const hasChartablePoints = seriesResult.points.length > 0;
  const hasVolume = Boolean(resolvedConfig.volumeField && seriesResult.volumePointCount > 0);

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
    chartRef.current = chart;
    const priceSeries = chart.addSeries(CandlestickSeries, {
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
    barsRef.current = priceSeries;

    if (hasVolume) {
      while (chart.panes().length <= 1) {
        chart.addPane();
      }

      volumeRef.current = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: {
            type: "volume",
          },
          priceLineVisible: false,
          lastValueVisible: false,
        },
        1,
      );
      chart.panes()[0]?.setStretchFactor(4);
      chart.panes()[1]?.setStretchFactor(1);
    } else {
      volumeRef.current = null;
    }

    const studyPalette = [
      resolvedTokens.primary,
      resolvedTokens.accent,
      resolvedTokens.warning,
      resolvedTokens.foreground,
      resolvedTokens.success,
    ];
    studyRefs.current = resolvedConfig.studies.map((study, index) =>
      chart.addSeries(LineSeries, {
        color: studyPalette[index % studyPalette.length] ?? resolvedTokens.primary,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `${study.type.toUpperCase()} ${study.period}`,
      }),
    );

    hasFittedRef.current = false;
    lastPointCountRef.current = 0;
    lastShapeKeyRef.current = null;

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.applyOptions(getChartSize(container));
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      barsRef.current = null;
      volumeRef.current = null;
      studyRefs.current = [];
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [hasChartablePoints, hasVolume, resolvedConfig.studies, resolvedTokens]);

  useEffect(() => {
    const chart = chartRef.current;
    const bars = barsRef.current;
    const volume = volumeRef.current;

    if (!chart || !bars || seriesResult.points.length === 0) {
      return;
    }

    const visibleRange = chart.timeScale().getVisibleLogicalRange();
    const wasFollowingRightEdge =
      !visibleRange || visibleRange.to >= lastPointCountRef.current - 2;
    const forceSnapshot =
      chartUpdateMode !== "delta" ||
      deltaSeriesResult.points.length === 0 ||
      lastShapeKeyRef.current !== chartDataShapeKey ||
      resolvedConfig.studies.length > 0;

    if (forceSnapshot) {
      bars.setData(mapOhlcChartPoints(seriesResult.points));
      volume?.setData(mapVolumeChartPoints(seriesResult.points, resolvedTokens));
      studyRefs.current.forEach((studySeries, index) => {
        const study = resolvedConfig.studies[index];

        if (!study) {
          studySeries.setData([]);
          return;
        }

        studySeries.setData(mapStudyChartPoints(seriesResult.points, study));
      });
      lastShapeKeyRef.current = chartDataShapeKey;
      lastPointCountRef.current = seriesResult.points.length;

      if (!hasFittedRef.current || wasFollowingRightEdge || !visibleRange) {
        chart.timeScale().fitContent();
      } else {
        chart.timeScale().setVisibleLogicalRange(visibleRange);
      }

      hasFittedRef.current = true;
      return;
    }

    mapOhlcChartPoints(deltaSeriesResult.points).forEach((point) => {
      bars.update(point, true);
    });
    mapVolumeChartPoints(deltaSeriesResult.points, resolvedTokens).forEach((point) => {
      volume?.update(point, true);
    });
    lastPointCountRef.current = seriesResult.points.length;

    if (!wasFollowingRightEdge && visibleRange) {
      chart.timeScale().setVisibleLogicalRange(visibleRange);
    }
  }, [
    chartDataShapeKey,
    chartUpdateMode,
    deltaSeriesResult.points,
    resolvedConfig.studies,
    resolvedTokens,
    seriesResult.points,
  ]);

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
