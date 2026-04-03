import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarClock, Database, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { resolveWidgetTransparentSurface } from "@/widgets/shared/chrome";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  fetchDataNodeDetail,
  formatMainSequenceError,
} from "../../../../common/api";
import {
  buildDataNodeVisualizerChartSeries,
  buildDataNodeVisualizerSeries,
  normalizeDataNodeVisualizerProps,
  resolveDataNodeVisualizerDateRange,
  resolveDataNodeVisualizerNormalizationTimeMs,
  resolveDataNodeVisualizerConfig,
  type MainSequenceDataNodeVisualizerWidgetProps,
} from "./dataNodeVisualizerModel";
import { TradingViewSeriesChart } from "./TradingViewSeriesChart";
import { DataNodeVisualizerChartErrorBoundary } from "./DataNodeVisualizerChartErrorBoundary";
import { useResolvedDataNodeWidgetSourceBinding } from "../data-node-shared/dataNodeWidgetSource";

type Props = WidgetComponentProps<MainSequenceDataNodeVisualizerWidgetProps>;

export function MainSequenceDataNodeVisualizerWidget({ props, presentation, instanceId }: Props) {
  const { rangeStartMs, rangeEndMs } = useDashboardControls();
  const transparentSurface = resolveWidgetTransparentSurface(presentation);
  const normalizedProps = useMemo(
    () => normalizeDataNodeVisualizerProps(props),
    [props],
  );
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
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
  const dataNodeId = Number(effectiveSourceProps.dataNodeId ?? 0);

  const dataNodeDetailQuery = useQuery({
    queryKey: ["main_sequence", "widgets", "data_node_visualizer", "detail", dataNodeId],
    queryFn: () => fetchDataNodeDetail(dataNodeId),
    enabled: Number.isFinite(dataNodeId) && dataNodeId > 0,
    staleTime: 300_000,
  });

  const resolvedConfig = useMemo(
    () => resolveDataNodeVisualizerConfig(effectiveProps, dataNodeDetailQuery.data),
    [dataNodeDetailQuery.data, effectiveProps],
  );
  const resolvedRange = useMemo(
    () => resolveDataNodeVisualizerDateRange(resolvedConfig, rangeStartMs, rangeEndMs),
    [rangeEndMs, rangeStartMs, resolvedConfig],
  );
  const sourceRows = linkedDataset?.rows ?? [];
  const seriesResult = useMemo(
    () => buildDataNodeVisualizerSeries(sourceRows, resolvedConfig),
    [resolvedConfig, sourceRows],
  );
  const chartSeriesResult = useMemo(
    () => buildDataNodeVisualizerChartSeries(seriesResult.series),
    [seriesResult.series],
  );
  const normalizationTimeMs = useMemo(
    () =>
      resolveDataNodeVisualizerNormalizationTimeMs(
        resolvedConfig,
        resolvedRange.rangeStartMs,
      ),
    [resolvedConfig, resolvedRange.rangeStartMs],
  );
  const hasSourceTableConfiguration = Boolean(dataNodeDetailQuery.data?.sourcetableconfiguration);
  const chartEmptyMessage =
    sourceRows.length > 0
      ? "Rows were loaded, but the selected X field is not time-like or the Y field is not numeric."
      : "No chartable rows are available for the selected range.";
  const suggestedGroupField = useMemo(() => {
    if (resolvedConfig.groupField) {
      return null;
    }

    const fallbackGroupField = dataNodeDetailQuery.data?.sourcetableconfiguration?.index_names?.[1];

    return typeof fallbackGroupField === "string" && fallbackGroupField.trim()
      ? fallbackGroupField
      : null;
  }, [dataNodeDetailQuery.data?.sourcetableconfiguration?.index_names, resolvedConfig.groupField]);
  const chartCollisionMessage = useMemo(() => {
    if (chartSeriesResult.collapsedPointCount <= 0) {
      return null;
    }

    const baseMessage = `Merged ${chartSeriesResult.collapsedPointCount.toLocaleString()} row ${
      chartSeriesResult.collapsedPointCount === 1 ? "collision" : "collisions"
    } that resolved to the same chart second across ${chartSeriesResult.affectedSeriesCount.toLocaleString()} ${
      chartSeriesResult.affectedSeriesCount === 1 ? "series" : "series"
    }. The chart keeps the latest point per second.`;

    if (suggestedGroupField) {
      return `${baseMessage} Consider grouping by ${suggestedGroupField}.`;
    }

    return baseMessage;
  }, [
    chartSeriesResult.affectedSeriesCount,
    chartSeriesResult.collapsedPointCount,
    suggestedGroupField,
  ]);
  const isDataLoading = linkedDataset?.status === "loading" || linkedDataset == null;
  const dataErrorMessage =
    linkedDataset?.status === "error"
      ? linkedDataset.error ?? "The linked Data Node failed to load rows."
      : null;

  if (sourceBinding.isFilterWidgetSource && !sourceBinding.hasResolvedFilterWidgetSource) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a Data Node source</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and use the Bindings tab to connect this graph to a Data Node.
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
            This chart only renders the dataset coming from its Data Node source.
          </p>
        </div>
      </div>
    );
  }

  if (dataNodeDetailQuery.isLoading && !dataNodeDetailQuery.data) {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (dataNodeDetailQuery.isError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(dataNodeDetailQuery.error)}
      </div>
    );
  }

  if (!hasSourceTableConfiguration) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">This data node has no data</div>
          <p className="text-sm text-muted-foreground">
            Choose another data node with table data to visualize it here.
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
            <DataNodeVisualizerChartErrorBoundary
              fallback={(
                <div className="flex h-full min-h-0 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
                  The chart could not be rendered. Try grouping the rows into separate series or choosing a different time field.
                </div>
              )}
            >
              <TradingViewSeriesChart
                chartType={resolvedConfig.chartType}
                emptyMessage={chartEmptyMessage}
                normalizationTimeMs={normalizationTimeMs}
                series={chartSeriesResult.series}
                seriesAxisMode={resolvedConfig.seriesAxisMode}
                transparentSurface={transparentSurface}
              />
            </DataNodeVisualizerChartErrorBoundary>
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
