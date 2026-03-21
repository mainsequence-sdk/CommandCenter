import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarClock, Database, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeDetail,
  formatMainSequenceError,
} from "../../../../common/api";
import {
  buildDataNodeVisualizerSeries,
  buildDataNodeVisualizerRequestedColumns,
  resolveDataNodeVisualizerDateRange,
  resolveDataNodeVisualizerNormalizationTimeMs,
  resolveDataNodeVisualizerConfig,
  type MainSequenceDataNodeVisualizerWidgetProps,
} from "./dataNodeVisualizerModel";
import { TradingViewSeriesChart } from "./TradingViewSeriesChart";

type Props = WidgetComponentProps<MainSequenceDataNodeVisualizerWidgetProps>;

export function MainSequenceDataNodeVisualizerWidget({ props }: Props) {
  const { rangeStartMs, rangeEndMs } = useDashboardControls();
  const dataNodeId = Number(props.dataNodeId ?? 0);

  const dataNodeDetailQuery = useQuery({
    queryKey: ["main_sequence", "widgets", "data_node_visualizer", "detail", dataNodeId],
    queryFn: () => fetchDataNodeDetail(dataNodeId),
    enabled: Number.isFinite(dataNodeId) && dataNodeId > 0,
    staleTime: 300_000,
  });

  const resolvedConfig = useMemo(
    () => resolveDataNodeVisualizerConfig(props, dataNodeDetailQuery.data),
    [dataNodeDetailQuery.data, props],
  );
  const requestedColumns = useMemo(
    () => buildDataNodeVisualizerRequestedColumns(resolvedConfig),
    [resolvedConfig],
  );
  const resolvedRange = useMemo(
    () => resolveDataNodeVisualizerDateRange(resolvedConfig, rangeStartMs, rangeEndMs),
    [rangeEndMs, rangeStartMs, resolvedConfig],
  );

  const dataQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_visualizer",
      resolvedConfig.dataNodeId,
      requestedColumns.join("|"),
      (resolvedConfig.uniqueIdentifierList ?? []).join("|"),
      resolvedRange.mode,
      resolvedRange.rangeStartMs,
      resolvedRange.rangeEndMs,
      resolvedConfig.limit,
    ],
    queryFn: () =>
      fetchDataNodeDataBetweenDatesFromRemote(resolvedConfig.dataNodeId!, {
        start_date: Math.floor(resolvedRange.rangeStartMs! / 1000),
        end_date: Math.floor(resolvedRange.rangeEndMs! / 1000),
        columns: requestedColumns,
        unique_identifier_list: resolvedConfig.uniqueIdentifierList,
        great_or_equal: true,
        less_or_equal: true,
        limit: resolvedConfig.limit,
        offset: 0,
      }),
    enabled:
      Boolean(resolvedConfig.dataNodeId) &&
      requestedColumns.length > 0 &&
      resolvedRange.hasValidRange,
  });

  const seriesResult = useMemo(
    () => buildDataNodeVisualizerSeries(dataQuery.data ?? [], resolvedConfig),
    [dataQuery.data, resolvedConfig],
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
    (dataQuery.data?.length ?? 0) > 0
      ? "Rows were loaded, but the selected X field is not time-like or the Y field is not numeric."
      : "No chartable rows are available for the selected range.";

  if (!resolvedConfig.dataNodeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a data node to start visualizing</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and choose a data node, then confirm the axis mapping.
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
      {dataQuery.isLoading ? (
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-full min-h-0 rounded-[calc(var(--radius)-6px)]" />
        </div>
      ) : null}

      {dataQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(dataQuery.error)}
        </div>
      ) : null}

      {!dataQuery.isLoading && !dataQuery.isError ? (
        <div className="min-h-0 flex-1">
          <div className="h-full min-h-0">
            <TradingViewSeriesChart
              chartType={resolvedConfig.chartType}
              emptyMessage={chartEmptyMessage}
              normalizationTimeMs={normalizationTimeMs}
              series={seriesResult.series}
              seriesAxisMode={resolvedConfig.seriesAxisMode}
            />
          </div>
        </div>
      ) : null}

      {!dataQuery.isLoading && !dataQuery.isError && (dataQuery.data?.length ?? 0) === 0 ? (
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
