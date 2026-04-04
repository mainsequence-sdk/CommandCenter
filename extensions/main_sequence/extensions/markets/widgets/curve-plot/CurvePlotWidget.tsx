import { useEffect, useMemo, useRef, useState } from "react";

import { Database, LineChart } from "lucide-react";
import {
  ColorType,
  LineSeries,
  createYieldCurveChart,
} from "lightweight-charts";

import { Skeleton } from "@/components/ui/skeleton";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetComponentProps } from "@/widgets/types";

import { useResolvedDataNodeWidgetSourceBinding } from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import {
  buildCurvePlotSeriesFromCurveDataNodeRows,
  buildCurvePlotFieldOptionsFromRuntime,
  buildCurvePlotSeries,
  formatCurvePlotMaturityLabel,
  normalizeCurvePlotProps,
  resolveCurvePlotConfig,
  type MainSequenceCurvePlotWidgetProps,
} from "./curvePlotModel";

type Props = WidgetComponentProps<MainSequenceCurvePlotWidgetProps>;

const curvePaletteTokenOrder = ["primary", "accent", "success", "warning", "danger"] as const;

function formatYield(value: number) {
  const absValue = Math.abs(value);
  const maximumFractionDigits = absValue >= 10 ? 2 : absValue >= 1 ? 3 : 4;

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value)}%`;
}

function getChartSize(container: HTMLDivElement) {
  return {
    width: Math.max(container.clientWidth, 1),
    height: Math.max(container.clientHeight, 1),
  };
}

function getSeriesPalette(resolvedTokens: Record<string, string>) {
  return curvePaletteTokenOrder.map((tokenKey) => resolvedTokens[tokenKey]);
}

export function CurvePlotWidget({ props, instanceId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTokens } = useTheme();

  const normalizedProps = useMemo(
    () => normalizeCurvePlotProps(props),
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
  const effectiveSourceProps = sourceBinding.resolvedSourceProps;
  const effectiveProps = useMemo(
    () => ({
      ...normalizedProps,
      ...effectiveSourceProps,
    }),
    [effectiveSourceProps, normalizedProps],
  );
  const runtimeFieldOptions = useMemo(
    () => buildCurvePlotFieldOptionsFromRuntime(linkedDataset),
    [linkedDataset],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveCurvePlotConfig(
        effectiveProps,
        undefined,
        runtimeFieldOptions.length > 0 ? runtimeFieldOptions : undefined,
      ),
    [effectiveProps, runtimeFieldOptions],
  );
  const seriesResult = useMemo(
    () =>
      resolvedConfig.curveDataNode
        ? null
        : buildCurvePlotSeries(linkedDataset?.rows ?? [], resolvedConfig),
    [linkedDataset?.rows, resolvedConfig],
  );
  const hasRuntimeRows = (linkedDataset?.rows?.length ?? 0) > 0;
  const palette = useMemo(
    () => getSeriesPalette(resolvedTokens),
    [resolvedTokens],
  );
  const [curveDataNodeSeriesState, setCurveDataNodeSeriesState] = useState<{
    error: string | null;
    loading: boolean;
    result: ReturnType<typeof buildCurvePlotSeries> | null;
  }>({
    error: null,
    loading: false,
    result: null,
  });

  useEffect(() => {
    if (!resolvedConfig.curveDataNode) {
      setCurveDataNodeSeriesState({
        error: null,
        loading: false,
        result: null,
      });
      return;
    }

    let cancelled = false;
    const rows = linkedDataset?.rows ?? [];

    setCurveDataNodeSeriesState({
      error: null,
      loading: true,
      result: null,
    });

    void buildCurvePlotSeriesFromCurveDataNodeRows(rows, resolvedConfig)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setCurveDataNodeSeriesState({
          error: null,
          loading: false,
          result,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setCurveDataNodeSeriesState({
          error:
            error instanceof Error
              ? error.message
              : "Curve Data Node rows could not be decompressed.",
          loading: false,
          result: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [linkedDataset?.rows, resolvedConfig]);

  const effectiveSeriesResult = resolvedConfig.curveDataNode
    ? curveDataNodeSeriesState.result
    : seriesResult;

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !effectiveSeriesResult || effectiveSeriesResult.series.length === 0) {
      return;
    }

    const allMaturities = effectiveSeriesResult.series.flatMap((series) =>
      series.points.map((point) => point.time),
    );
    const minMaturity =
      allMaturities.reduce(
        (currentMin, maturity) => Math.min(currentMin, maturity),
        Number.POSITIVE_INFINITY,
      ) || 0;
    const maxMaturity =
      allMaturities.reduce(
        (currentMax, maturity) => Math.max(currentMax, maturity),
        0,
      ) || 120;
    const startTimeRange = Math.max(0, Math.floor(minMaturity) - 1);
    const minimumTimeRange = Math.max(
      12,
      Math.ceil(maxMaturity) - startTimeRange + 1,
    );

    const chart = createYieldCurveChart(container, {
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
          top: 0.16,
          bottom: 0.14,
        },
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
      localization: {
        priceFormatter: formatYield,
        timeFormatter: formatCurvePlotMaturityLabel,
      },
      yieldCurve: {
        baseResolution: 1,
        minimumTimeRange,
        startTimeRange,
      },
      timeScale: {
        rightOffset: 2,
      },
      ...getChartSize(container),
    });

    effectiveSeriesResult.series.forEach((series, index) => {
      const baseColor = palette[index % palette.length] ?? resolvedTokens.primary;
      const emphasis = index === 0;
      const lineColor = emphasis ? baseColor : withAlpha(baseColor, 0.76);
      const chartSeries = chart.addSeries(LineSeries, {
        color: lineColor,
        lineWidth: emphasis ? 3 : 2,
        pointMarkersVisible: emphasis,
        pointMarkersRadius: emphasis ? 5 : 4,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: emphasis ? 5 : 4,
        crosshairMarkerBorderColor: lineColor,
        crosshairMarkerBackgroundColor: resolvedTokens.card,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      chartSeries.setData(series.points.map((point) => ({ time: point.time, value: point.value })));
    });

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions(getChartSize(container));
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [effectiveSeriesResult, palette, resolvedTokens]);

  if (sourceBinding.isFilterWidgetSource && !sourceBinding.hasResolvedFilterWidgetSource) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a Data Node source</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and use the Bindings tab to connect this curve plot to a Data Node widget.
          </p>
        </div>
      </div>
    );
  }

  if (!resolvedConfig.dataNodeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Configure the linked Data Node</div>
          <p className="text-sm text-muted-foreground">
            This curve plot only renders the dataset coming from its linked Data Node widget.
          </p>
        </div>
      </div>
    );
  }

  if (!resolvedConfig.maturityField || !resolvedConfig.valueField) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <LineChart className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Curve field mapping is incomplete</div>
          <p className="text-sm text-muted-foreground">
            Choose a maturity field and a yield field in the widget settings.
          </p>
        </div>
      </div>
    );
  }

  if (linkedDataset == null || linkedDataset.status === "loading") {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (linkedDataset.status === "error") {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {linkedDataset.error ?? "The linked Data Node failed to load rows."}
      </div>
    );
  }

  if (resolvedConfig.curveDataNode && curveDataNodeSeriesState.loading) {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (resolvedConfig.curveDataNode && curveDataNodeSeriesState.error) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {curveDataNodeSeriesState.error}
      </div>
    );
  }

  if (!hasRuntimeRows || !effectiveSeriesResult || effectiveSeriesResult.series.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <LineChart className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">No curve points could be rendered</div>
          <p className="text-sm text-muted-foreground">
            The linked rows did not contain parsable maturity and yield pairs for the selected fields.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {effectiveSeriesResult.invalidRowCount > 0 ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Skipped {effectiveSeriesResult.invalidRowCount.toLocaleString()} row
          {effectiveSeriesResult.invalidRowCount === 1 ? "" : "s"} because the selected curve payload or fields could not be parsed.
        </div>
      ) : null}

      {effectiveSeriesResult.droppedGroups > 0 ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Showing the first {effectiveSeriesResult.series.length.toLocaleString()} curves and hiding{" "}
          {effectiveSeriesResult.droppedGroups.toLocaleString()} additional grouped series.
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

      {effectiveSeriesResult.series.length > 1 ? (
        <div
          className="shrink-0 flex flex-wrap items-center gap-2 rounded-[calc(var(--radius)-6px)] border px-4 py-3"
          style={{
            borderColor: withAlpha(resolvedTokens.border, 0.72),
            background: withAlpha(resolvedTokens.background, 0.6),
          }}
        >
          {effectiveSeriesResult.series.map((series, index) => {
            const baseColor = palette[index % palette.length] ?? resolvedTokens.primary;

            return (
              <div
                key={series.id}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                style={{
                  borderColor: withAlpha(baseColor, 0.22),
                  backgroundColor: withAlpha(baseColor, index === 0 ? 0.14 : 0.08),
                }}
              >
                <span
                  className="h-2.5 w-8 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${withAlpha(baseColor, 0.24)} 0%, ${baseColor} 100%)`,
                  }}
                />
                <span className="font-medium text-foreground">{series.label}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
