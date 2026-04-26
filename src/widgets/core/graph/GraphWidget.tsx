import { useMemo } from "react";

import { BarChart3, CalendarClock, Database, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { resolveWidgetTransparentSurface } from "@/widgets/shared/chrome";
import type { WidgetRuntimeUpdateMode } from "@/widgets/shared/runtime-update";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  buildGraphChartSeries,
  buildGraphSeries,
  normalizeGraphProps,
  resolveGraphDateRange,
  resolveGraphEffectiveTimeAxisMode,
  resolveGraphNormalizationTimeMs,
  resolveGraphConfig,
  type GraphWidgetProps,
} from "./graphModel";
import { TradingViewSeriesChart } from "./TradingViewSeriesChart";
import { EChartsSeriesChart } from "./EChartsSeriesChart";
import { GraphChartErrorBoundary } from "./GraphChartErrorBoundary";
import { resolveTabularFieldOptionsFromDataset } from "@/widgets/shared/tabular-widget-source";
import { useResolvedTabularWidgetSourceBinding } from "@/widgets/shared/tabular-widget-source";

type Props = WidgetComponentProps<GraphWidgetProps>;

export function GraphWidget({
  props,
  presentation,
  instanceId,
}: Props) {
  const { rangeStartMs, rangeEndMs } = useDashboardControls();
  const transparentSurface = resolveWidgetTransparentSurface(presentation);
  const normalizedProps = useMemo(
    () => normalizeGraphProps(props),
    [props],
  );
  const sourceBinding = useResolvedTabularWidgetSourceBinding({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
  });
  useResolveWidgetUpstream(instanceId, {
    enabled: sourceBinding.requiresUpstreamResolution,
  });
  const linkedDataset = useMemo(
    () => sourceBinding.resolvedSourceDataset,
    [sourceBinding.resolvedSourceDataset],
  );
  const effectiveSourceProps = sourceBinding.resolvedSourceProps;
  const effectiveProps = useMemo(
    () => ({
      ...normalizedProps,
      ...effectiveSourceProps,
    }),
    [
      effectiveSourceProps,
      normalizedProps,
    ],
  );
  const runtimeFieldOptions = useMemo(
    () =>
      resolveTabularFieldOptionsFromDataset({
        columns: linkedDataset?.columns,
        fields: linkedDataset?.fields,
        rows: linkedDataset?.rows,
      }),
    [linkedDataset?.columns, linkedDataset?.fields, linkedDataset?.rows],
  );

  const resolvedConfig = useMemo(
    () =>
      resolveGraphConfig(
        effectiveProps,
        undefined,
        runtimeFieldOptions.length > 0 ? runtimeFieldOptions : undefined,
      ),
    [effectiveProps, runtimeFieldOptions],
  );
  const resolvedRange = useMemo(
    () => resolveGraphDateRange(resolvedConfig, rangeStartMs, rangeEndMs),
    [rangeEndMs, rangeStartMs, resolvedConfig],
  );
  const sourceRows = linkedDataset?.rows ?? [];
  const sourceDeltaRows = sourceBinding.resolvedSourceDeltaFrame?.rows ?? [];
  const sourceUpdate = !Array.isArray(sourceBinding.resolvedSourceInput)
    ? sourceBinding.resolvedSourceInput?.upstreamUpdate
    : undefined;
  const canUseDeltaUpdate =
    sourceUpdate?.mode === "delta" &&
    sourceDeltaRows.length > 0 &&
    !resolvedConfig.normalizeSeries &&
    (sourceUpdate.operations?.pruned ?? 0) === 0;
  const chartUpdateMode: WidgetRuntimeUpdateMode = canUseDeltaUpdate ? "delta" : "snapshot";
  const seriesResult = useMemo(
    () => buildGraphSeries(sourceRows, resolvedConfig),
    [resolvedConfig, sourceRows],
  );
  const deltaSeriesResult = useMemo(
    () => buildGraphSeries(sourceDeltaRows, resolvedConfig),
    [resolvedConfig, sourceDeltaRows],
  );
  const effectiveTimeAxisMode = useMemo(
    () => resolveGraphEffectiveTimeAxisMode(resolvedConfig, sourceRows),
    [resolvedConfig, sourceRows],
  );
  const chartSeriesResult = useMemo(
    () => buildGraphChartSeries(seriesResult.series, effectiveTimeAxisMode),
    [effectiveTimeAxisMode, seriesResult.series],
  );
  const deltaChartSeriesResult = useMemo(
    () => buildGraphChartSeries(deltaSeriesResult.series, effectiveTimeAxisMode),
    [deltaSeriesResult.series, effectiveTimeAxisMode],
  );
  const normalizationTimeMs = useMemo(
    () => resolveGraphNormalizationTimeMs(resolvedConfig),
    [resolvedConfig],
  );
  const chartDataShapeKey = useMemo(
    () =>
      JSON.stringify({
        chartType: resolvedConfig.chartType,
        groupField: resolvedConfig.groupField,
        normalizeAtMs: resolvedConfig.normalizeAtMs,
        normalizeSeries: resolvedConfig.normalizeSeries,
        provider: resolvedConfig.provider,
        seriesAxisMode: resolvedConfig.seriesAxisMode,
        timeAxisMode: effectiveTimeAxisMode,
        xField: resolvedConfig.xField,
        yField: resolvedConfig.yField,
      }),
    [
      effectiveTimeAxisMode,
      resolvedConfig.chartType,
      resolvedConfig.groupField,
      resolvedConfig.normalizeAtMs,
      resolvedConfig.normalizeSeries,
      resolvedConfig.provider,
      resolvedConfig.seriesAxisMode,
      resolvedConfig.timeAxisMode,
      resolvedConfig.xField,
      resolvedConfig.yField,
    ],
  );
  const chartEmptyMessage =
    sourceRows.length > 0
      ? "Rows were loaded, but the selected X field is not time-like or the Y field is not numeric."
      : "No chartable rows are available for the selected range.";
  const chartCollisionMessage = useMemo(() => {
    if (chartSeriesResult.collapsedPointCount <= 0) {
      return null;
    }

    return `Merged ${chartSeriesResult.collapsedPointCount.toLocaleString()} row ${
      chartSeriesResult.collapsedPointCount === 1 ? "collision" : "collisions"
    } that resolved to the same chart second across ${chartSeriesResult.affectedSeriesCount.toLocaleString()} ${
      chartSeriesResult.affectedSeriesCount === 1 ? "series" : "series"
    }. The chart keeps the latest point per second.`;
  }, [
    chartSeriesResult.affectedSeriesCount,
    chartSeriesResult.collapsedPointCount,
  ]);
  const isDataLoading = linkedDataset?.status === "loading" || linkedDataset == null;
  const dataErrorMessage =
    linkedDataset?.status === "error"
      ? linkedDataset.error ?? "The bound source failed to load rows."
      : null;

  if (sourceBinding.isFilterWidgetSource && !sourceBinding.hasResolvedFilterWidgetSource) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a source</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and use the Bindings tab to connect this graph to a tabular source.
          </p>
        </div>
      </div>
    );
  }

  if (sourceBinding.isAwaitingBoundSourceValue) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Resolving upstream source</div>
          <p className="text-sm text-muted-foreground">
            Refreshing the bound source widget so this graph can load its dataset.
          </p>
        </div>
      </div>
    );
  }

  if (!sourceBinding.hasResolvedFilterWidgetSource || !linkedDataset) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a source</div>
          <p className="text-sm text-muted-foreground">
            This chart renders the canonical dataset coming from a bound source.
          </p>
        </div>
      </div>
    );
  }

  if (!resolvedConfig.xField || !resolvedConfig.yField) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Axis selection is incomplete</div>
          <p className="text-sm text-muted-foreground">
            Choose an X field and a Y field in the widget settings.
          </p>
        </div>
      </div>
    );
  }

  if (resolvedConfig.dateRangeMode === "fixed" && !resolvedRange.hasValidRange) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Pick a fixed date range</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and choose both a start and end date for this widget.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {isDataLoading ? (
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-full min-h-0 rounded-[calc(var(--radius)-6px)]" />
        </div>
      ) : null}

      {dataErrorMessage ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {dataErrorMessage}
        </div>
      ) : null}

      {!isDataLoading && !dataErrorMessage && chartCollisionMessage ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {chartCollisionMessage}
        </div>
      ) : null}

      {!isDataLoading && !dataErrorMessage ? (
        <div className="min-h-0 flex-1">
          <div className="h-full min-h-0">
            <GraphChartErrorBoundary
              fallback={(
                <div className="flex h-full min-h-0 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
                  The chart could not be rendered. Check the selected X field, Y field, and provider.
                </div>
              )}
                      >
              {resolvedConfig.provider === "echarts" ? (
                <EChartsSeriesChart
                  chartType={resolvedConfig.chartType}
                  dataShapeKey={chartDataShapeKey}
                  emptyMessage={chartEmptyMessage}
                  normalizationTimeMs={normalizationTimeMs}
                  series={chartSeriesResult.series}
                  deltaSeries={chartUpdateMode === "delta" ? deltaChartSeriesResult.series : []}
                  seriesAxisMode={resolvedConfig.seriesAxisMode}
                  timeAxisMode={effectiveTimeAxisMode}
                  transparentSurface={transparentSurface}
                  updateMode={chartUpdateMode}
                />
              ) : (
                <TradingViewSeriesChart
                  chartType={resolvedConfig.chartType}
                  dataShapeKey={chartDataShapeKey}
                  emptyMessage={chartEmptyMessage}
                  minBarSpacingPx={resolvedConfig.minBarSpacingPx}
                  normalizationTimeMs={normalizationTimeMs}
                  series={chartSeriesResult.series}
                  deltaSeries={chartUpdateMode === "delta" ? deltaChartSeriesResult.series : []}
                  seriesAxisMode={resolvedConfig.seriesAxisMode}
                  timeAxisMode={effectiveTimeAxisMode}
                  transparentSurface={transparentSurface}
                  updateMode={chartUpdateMode}
                />
              )}
            </GraphChartErrorBoundary>
          </div>
        </div>
      ) : null}

      {!isDataLoading && !dataErrorMessage && sourceRows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-6 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4" />
            No rows were returned for the selected period.
          </div>
        </div>
      ) : null}
    </div>
  );
}
