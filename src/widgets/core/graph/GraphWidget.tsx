import { useEffect, useMemo, useRef, useState } from "react";

import { AlertTriangle, BarChart3, CalendarClock, Database, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { resolveWidgetTransparentSurface } from "@/widgets/shared/chrome";
import type { WidgetRuntimeUpdateMode } from "@/widgets/shared/runtime-update";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  buildGraphChartSeries,
  buildGraphSeriesConfigKey,
  buildGraphSeries,
  normalizeGraphProps,
  reduceIncrementalGraphSeries,
  resolveGraphDateRange,
  resolveGraphDatasetFrame,
  resolveGraphEffectiveTimeAxisMode,
  resolveGraphNormalizationTimeMs,
  resolveGraphStackingEnabled,
  resolveGraphTimeQuantization,
  resolveGraphConfig,
  type GraphSeriesResult,
  type GraphWidgetProps,
} from "./graphModel";
import { TradingViewSeriesChart } from "./TradingViewSeriesChart";
import { EChartsSeriesChart } from "./EChartsSeriesChart";
import { GraphChartErrorBoundary } from "./GraphChartErrorBoundary";
import { resolveTabularFieldOptionsFromDataset } from "@/widgets/shared/tabular-widget-source";
import { useResolvedTabularWidgetSourceBinding } from "@/widgets/shared/tabular-widget-source";
import { useIncrementalTabularConsumerBindingState } from "@/widgets/shared/incremental-tabular-consumer";

type Props = WidgetComponentProps<GraphWidgetProps>;

interface IncrementalGraphRenderState {
  configKey: string;
  deltaResult: GraphSeriesResult;
  lastLiveSignature?: string;
  lastLiveSourceRunId?: string;
  lastSeedSignature?: string;
  lastSeedSourceRunId?: string;
  result: GraphSeriesResult;
  updateMode: WidgetRuntimeUpdateMode;
}

const GRAPH_RUNTIME_ROW_WINDOW_MULTIPLIER = 4;
const GRAPH_RUNTIME_ROW_WINDOW_MAX_ROWS = 250_000;
const GRAPH_LIVE_UPDATE_MERGE_KEY_FIELDS: string[] = [];

function resolveGraphRuntimeRowWindowLimit(config: { limit: number; maxSeries: number }) {
  return Math.min(
    GRAPH_RUNTIME_ROW_WINDOW_MAX_ROWS,
    Math.max(
      config.limit,
      config.limit * Math.max(1, config.maxSeries) * GRAPH_RUNTIME_ROW_WINDOW_MULTIPLIER,
    ),
  );
}

function shouldBlockGraphRenderingWhileLoading(dataset: {
  status?: string;
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
} | null) {
  if (!dataset) {
    return true;
  }

  if (dataset.status !== "loading") {
    return false;
  }

  return (dataset.rows?.length ?? 0) === 0 && (dataset.columns?.length ?? 0) === 0;
}

export function GraphWidget({
  props,
  presentation,
  instanceId,
  editable,
  runtimeState,
  resolvedInputs,
  onRuntimeStateChange,
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
    resolvedInputs,
  });
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
  const preliminaryConfig = useMemo(
    () => resolveGraphConfig(effectiveProps),
    [effectiveProps],
  );
  const runtimeRowWindowLimit = useMemo(
    () => resolveGraphRuntimeRowWindowLimit(preliminaryConfig),
    [preliminaryConfig],
  );
  const runtimeRowSelector = useMemo(
    () => ({ direction: "latest" as const, limit: runtimeRowWindowLimit }),
    [runtimeRowWindowLimit],
  );
  const runtimeRetention = useMemo(
    () => ({ maxRows: runtimeRowWindowLimit }),
    [runtimeRowWindowLimit],
  );
  const incrementalBinding = useIncrementalTabularConsumerBindingState({
    instanceId,
    liveMergeKeyFields: GRAPH_LIVE_UPDATE_MERGE_KEY_FIELDS,
    onRuntimeStateChange,
    resolvedInputs,
    runtimeRetention,
    runtimeRowSelector,
    runtimeState,
  });
  const sourceConsumerState = incrementalBinding.active
    ? incrementalBinding.consumerState
    : sourceBinding.consumerState;
  useResolveWidgetUpstream(instanceId, {
    enabled: incrementalBinding.active
      ? incrementalBinding.requiresUpstreamResolution
      : sourceBinding.requiresUpstreamResolution,
  });
  const linkedDataset = useMemo(
    () =>
      resolveGraphDatasetFrame(
        incrementalBinding.active ? incrementalBinding.dataset : sourceConsumerState.dataset,
      ),
    [incrementalBinding.active, incrementalBinding.dataset, sourceConsumerState.dataset],
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
  const resolvedDeltaDataset = useMemo(
    () =>
      resolveGraphDatasetFrame(
        incrementalBinding.active
          ? incrementalBinding.deltaDataset
          : sourceBinding.resolvedSourceDeltaFrame,
      ),
    [
      incrementalBinding.active,
      incrementalBinding.deltaDataset,
      sourceBinding.resolvedSourceDeltaFrame,
    ],
  );
  const sourceDeltaRows = resolvedDeltaDataset?.rows ?? [];
  const sourceUpdate = incrementalBinding.active
    ? incrementalBinding.liveInput?.upstreamUpdate
    : !Array.isArray(sourceBinding.resolvedSourceInput)
      ? sourceBinding.resolvedSourceInput?.upstreamUpdate
      : undefined;
  const graphSeriesConfigKey = useMemo(
    () => buildGraphSeriesConfigKey(resolvedConfig),
    [resolvedConfig],
  );
  const [incrementalRenderState, setIncrementalRenderState] = useState<IncrementalGraphRenderState | null>(null);
  const incrementalRenderStateRef = useRef<IncrementalGraphRenderState | null>(null);

  useEffect(() => {
    incrementalRenderStateRef.current = incrementalRenderState;
  }, [incrementalRenderState]);

  useEffect(() => {
    if (!incrementalBinding.active) {
      if (incrementalRenderStateRef.current !== null) {
        setIncrementalRenderState(null);
      }
      return;
    }

    const previous = incrementalRenderStateRef.current;
    let nextState = previous;

    if (!nextState || nextState.configKey !== graphSeriesConfigKey) {
      const seededResult = buildGraphSeries(sourceRows, resolvedConfig);
      nextState = {
        configKey: graphSeriesConfigKey,
        deltaResult: { ...seededResult, series: [] },
        lastSeedSignature: undefined,
        lastSeedSourceRunId: undefined,
        lastLiveSignature: undefined,
        lastLiveSourceRunId: undefined,
        result: seededResult,
        updateMode: "snapshot",
      };
    }

    if (
      incrementalBinding.seedPublication &&
      incrementalBinding.seedPublication.signature !== nextState.lastSeedSignature
    ) {
      const seededResult = buildGraphSeries(
        (incrementalBinding.seedPublication.baseFrame ?? incrementalBinding.seedPublication.deltaFrame)?.rows ?? [],
        resolvedConfig,
      );
      nextState = {
        ...nextState,
        deltaResult: { ...seededResult, series: [] },
        lastSeedSignature: incrementalBinding.seedPublication.signature,
        lastSeedSourceRunId: incrementalBinding.seedPublication.sourceRunId,
        result: seededResult,
        updateMode: "snapshot",
      };
    }

    if (
      incrementalBinding.livePublication &&
      incrementalBinding.livePublication.signature !== nextState.lastLiveSignature
    ) {
      const liveRows =
        (incrementalBinding.livePublication.deltaFrame ?? incrementalBinding.livePublication.baseFrame)?.rows ?? [];
      const sourceRunChanged =
        Boolean(nextState.lastLiveSourceRunId) &&
        Boolean(incrementalBinding.livePublication.sourceRunId) &&
        nextState.lastLiveSourceRunId !== incrementalBinding.livePublication.sourceRunId;
      const shouldResetFromLiveSeed =
        incrementalBinding.livePublication.role === "seed" ||
        incrementalBinding.livePublication.update?.mode === "snapshot" ||
        sourceRunChanged ||
        nextState.result.series.length === 0;

      if (shouldResetFromLiveSeed) {
        const seededResult = buildGraphSeries(
          (incrementalBinding.livePublication.baseFrame ?? incrementalBinding.livePublication.deltaFrame)?.rows ?? [],
          resolvedConfig,
        );
        nextState = {
          ...nextState,
          deltaResult: { ...seededResult, series: [] },
          lastLiveSignature: incrementalBinding.livePublication.signature,
          lastLiveSourceRunId: incrementalBinding.livePublication.sourceRunId,
          result: seededResult,
          updateMode: "snapshot",
        };
      } else {
        const reduced = reduceIncrementalGraphSeries(
          nextState.result,
          liveRows,
          resolvedConfig,
        );

        nextState = {
          ...nextState,
          deltaResult:
            reduced.updateMode === "delta"
              ? {
                  ...reduced.result,
                  series: reduced.deltaSeries,
                  droppedGroups: 0,
                  filteredGroups: 0,
                  totalGroups: reduced.deltaSeries.length,
                }
              : {
                  ...reduced.result,
                  series: [],
                },
          lastLiveSignature: incrementalBinding.livePublication.signature,
          lastLiveSourceRunId: incrementalBinding.livePublication.sourceRunId,
          result: reduced.result,
          updateMode:
            resolvedConfig.normalizeSeries || reduced.updateMode === "snapshot"
              ? "snapshot"
              : "delta",
        };
      }
    }

    if (
      previous &&
      previous.configKey === nextState.configKey &&
      previous.lastSeedSignature === nextState.lastSeedSignature &&
      previous.lastSeedSourceRunId === nextState.lastSeedSourceRunId &&
      previous.lastLiveSignature === nextState.lastLiveSignature &&
      previous.lastLiveSourceRunId === nextState.lastLiveSourceRunId &&
      previous.deltaResult === nextState.deltaResult &&
      previous.result === nextState.result &&
      previous.updateMode === nextState.updateMode
    ) {
      return;
    }

    incrementalRenderStateRef.current = nextState;
    setIncrementalRenderState(nextState);
  }, [
    graphSeriesConfigKey,
    incrementalBinding.active,
    incrementalBinding.livePublication,
    incrementalBinding.seedPublication,
    resolvedConfig,
    sourceRows,
  ]);

  const seriesResult = useMemo(
    () =>
      incrementalBinding.active
        ? (incrementalRenderState?.result ?? buildGraphSeries(sourceRows, resolvedConfig))
        : buildGraphSeries(sourceRows, resolvedConfig),
    [incrementalBinding.active, incrementalRenderState?.result, resolvedConfig, sourceRows],
  );
  const deltaSeriesResult = useMemo(
    () =>
      incrementalBinding.active
        ? (incrementalRenderState?.deltaResult ?? { ...seriesResult, series: [] })
        : buildGraphSeries(sourceDeltaRows, resolvedConfig),
    [incrementalBinding.active, incrementalRenderState?.deltaResult, resolvedConfig, seriesResult, sourceDeltaRows],
  );
  const stackingEnabled = useMemo(
    () => resolveGraphStackingEnabled(resolvedConfig),
    [resolvedConfig],
  );
  const canUseDeltaUpdate =
    !incrementalBinding.active &&
    sourceUpdate?.mode === "delta" &&
    sourceDeltaRows.length > 0 &&
    !stackingEnabled &&
    !resolvedConfig.normalizeSeries &&
    (sourceUpdate.operations?.pruned ?? 0) === 0;
  const chartUpdateMode: WidgetRuntimeUpdateMode = incrementalBinding.active
    ? stackingEnabled
      ? "snapshot"
      : (incrementalRenderState?.updateMode ?? "snapshot")
    : canUseDeltaUpdate
      ? "delta"
      : "snapshot";
  const effectiveTimeAxisMode = useMemo(
    () => resolveGraphEffectiveTimeAxisMode(resolvedConfig, sourceRows),
    [resolvedConfig, sourceRows],
  );
  const chartSeriesResult = useMemo(
    () =>
      buildGraphChartSeries(
        seriesResult.series,
        effectiveTimeAxisMode,
        resolvedConfig.provider,
        resolvedConfig.timeQuantization,
      ),
    [effectiveTimeAxisMode, resolvedConfig.provider, resolvedConfig.timeQuantization, seriesResult.series],
  );
  const deltaChartSeriesResult = useMemo(
    () =>
      buildGraphChartSeries(
        deltaSeriesResult.series,
        effectiveTimeAxisMode,
        resolvedConfig.provider,
        resolvedConfig.timeQuantization,
      ),
    [deltaSeriesResult.series, effectiveTimeAxisMode, resolvedConfig.provider, resolvedConfig.timeQuantization],
  );
  const resolvedTimeQuantization = useMemo(
    () =>
      resolveGraphTimeQuantization(
        {
          provider: resolvedConfig.provider,
          timeQuantization: resolvedConfig.timeQuantization,
        },
        effectiveTimeAxisMode,
      ),
    [effectiveTimeAxisMode, resolvedConfig.provider, resolvedConfig.timeQuantization],
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
        stackSeries: stackingEnabled,
        timeAxisMode: effectiveTimeAxisMode,
        timeQuantization: resolvedConfig.timeQuantization,
        xField: resolvedConfig.xField,
        yAxisDecimals: resolvedConfig.yAxisDecimals,
        yAxisScaleZeros: resolvedConfig.yAxisScaleZeros,
        yAxisSuffix: resolvedConfig.yAxisSuffix,
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
      stackingEnabled,
      resolvedConfig.timeAxisMode,
      resolvedConfig.timeQuantization,
      resolvedConfig.xField,
      resolvedConfig.yAxisDecimals,
      resolvedConfig.yAxisScaleZeros,
      resolvedConfig.yAxisSuffix,
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

    const providerNote = resolvedTimeQuantization.providerLimited && resolvedConfig.provider === "tradingview"
      ? " TradingView requires at least 1-second timestamps; use ECharts for raw sub-second ticks."
      : "";

    return `Collapsed ${chartSeriesResult.collapsedPointCount.toLocaleString()} point ${
      chartSeriesResult.collapsedPointCount === 1 ? "update" : "updates"
    } into ${resolvedTimeQuantization.label.toLowerCase()} buckets across ${
      chartSeriesResult.affectedSeriesCount.toLocaleString()
    } visible ${chartSeriesResult.affectedSeriesCount === 1 ? "series" : "series"}. The chart keeps the latest point in each bucket.${providerNote}`;
  }, [
    resolvedConfig.provider,
    resolvedTimeQuantization.label,
    resolvedTimeQuantization.providerLimited,
    chartSeriesResult.affectedSeriesCount,
    chartSeriesResult.collapsedPointCount,
  ]);
  const isDataLoading = shouldBlockGraphRenderingWhileLoading(linkedDataset);
  const showRefreshOverlay =
    linkedDataset?.status === "loading" &&
    !isDataLoading &&
    sourceRows.length > 0;
  const dataErrorMessage =
    linkedDataset?.status === "error"
      ? linkedDataset.error ?? "The bound source failed to load rows."
      : null;

  if (sourceConsumerState.kind === "unbound") {
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

  if (sourceConsumerState.kind === "missing-source") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Bound source is missing</div>
          <p className="text-sm text-muted-foreground">
            Rebind this graph because the saved source widget no longer exists in this workspace.
          </p>
        </div>
      </div>
    );
  }

  if (sourceConsumerState.kind === "missing-output") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Bound output is missing</div>
          <p className="text-sm text-muted-foreground">
            The selected source widget no longer publishes the output this graph is bound to.
          </p>
        </div>
      </div>
    );
  }

  if (sourceConsumerState.kind === "contract-mismatch") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Incompatible bound dataset</div>
          <p className="text-sm text-muted-foreground">
            Bind this graph to a widget output that publishes one canonical tabular frame.
          </p>
        </div>
      </div>
    );
  }

  if (
    sourceConsumerState.kind === "self-reference-blocked" ||
    sourceConsumerState.kind === "transform-invalid"
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Source binding is invalid</div>
          <p className="text-sm text-muted-foreground">
            Fix the graph binding before this widget can render the published dataset.
          </p>
        </div>
      </div>
    );
  }

  if (sourceConsumerState.kind === "awaiting-upstream") {
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

  if (!linkedDataset) {
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

      {!isDataLoading && !dataErrorMessage ? (
        <div className="min-h-0 flex-1">
          <div className="relative h-full min-h-0">
            {showRefreshOverlay ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[calc(var(--radius)-6px)] bg-background/28 backdrop-blur-[1.5px]">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/88 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Refreshing chart…</span>
                </div>
              </div>
            ) : null}
            {editable && chartCollisionMessage ? (
              <div className="absolute right-2 top-2 z-10">
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-warning/35 bg-background/90 text-warning shadow-sm backdrop-blur hover:bg-warning/10"
                  title={chartCollisionMessage}
                  aria-label={chartCollisionMessage}
                >
                  <AlertTriangle className="h-4 w-4" />
                </button>
              </div>
            ) : null}
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
                  markerSizePx={resolvedConfig.markerSizePx}
                  normalizationTimeMs={normalizationTimeMs}
                  series={chartSeriesResult.series}
                  deltaSeries={chartUpdateMode === "delta" ? deltaChartSeriesResult.series : []}
                  seriesAxisMode={resolvedConfig.seriesAxisMode}
                  stackSeries={stackingEnabled}
                  timeAxisMode={effectiveTimeAxisMode}
                  timeQuantization={resolvedConfig.timeQuantization}
                  transparentSurface={transparentSurface}
                  updateMode={chartUpdateMode}
                  yAxisDecimals={resolvedConfig.yAxisDecimals}
                  yAxisScaleZeros={resolvedConfig.yAxisScaleZeros}
                  yAxisSuffix={resolvedConfig.yAxisSuffix}
                />
              ) : (
                <TradingViewSeriesChart
                  chartType={resolvedConfig.chartType}
                  dataShapeKey={chartDataShapeKey}
                  emptyMessage={chartEmptyMessage}
                  markerSizePx={resolvedConfig.markerSizePx}
                  minBarSpacingPx={resolvedConfig.minBarSpacingPx}
                  normalizationTimeMs={normalizationTimeMs}
                  series={chartSeriesResult.series}
                  deltaSeries={chartUpdateMode === "delta" ? deltaChartSeriesResult.series : []}
                  seriesAxisMode={resolvedConfig.seriesAxisMode}
                  stackSeries={stackingEnabled}
                  timeAxisMode={effectiveTimeAxisMode}
                  timeQuantization={resolvedConfig.timeQuantization}
                  transparentSurface={transparentSurface}
                  updateMode={chartUpdateMode}
                  yAxisDecimals={resolvedConfig.yAxisDecimals}
                  yAxisScaleZeros={resolvedConfig.yAxisScaleZeros}
                  yAxisSuffix={resolvedConfig.yAxisSuffix}
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
