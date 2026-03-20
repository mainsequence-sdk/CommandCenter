import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarClock,
  Database,
  Loader2,
  Table2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeDetail,
  formatMainSequenceError,
} from "../../api";
import {
  buildDataNodeVisualizerSeries,
  buildDataNodeVisualizerTableColumns,
  resolveDataNodeVisualizerDateRange,
  resolveDataNodeVisualizerNormalizationTimeMs,
  resolveDataNodeVisualizerConfig,
  type MainSequenceDataNodeVisualizerWidgetProps,
  type DataNodeVisualizerViewMode,
} from "./dataNodeVisualizerModel";
import { DataNodeVisualizerTable } from "./DataNodeVisualizerTable";
import { TradingViewSeriesChart } from "./TradingViewSeriesChart";

function WidgetModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

type Props = WidgetComponentProps<MainSequenceDataNodeVisualizerWidgetProps>;

function formatWidgetRangeLabel(startMs: number, endMs: number) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startMs)} - ${formatter.format(endMs)}`;
}

export function MainSequenceDataNodeVisualizerWidget({ props }: Props) {
  const { rangeStartMs, rangeEndMs, timeRangeLabel } = useDashboardControls();
  const dataNodeId = Number(props.dataNodeId ?? 0);
  const [viewModeOverride, setViewModeOverride] = useState<DataNodeVisualizerViewMode | null>(
    null,
  );

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
    () => resolvedConfig.availableFields.map((field) => field.key),
    [resolvedConfig.availableFields],
  );
  const resolvedRange = useMemo(
    () => resolveDataNodeVisualizerDateRange(resolvedConfig, rangeStartMs, rangeEndMs),
    [rangeEndMs, rangeStartMs, resolvedConfig],
  );
  const rangeLabel = useMemo(() => {
    if (resolvedRange.mode === "dashboard") {
      return timeRangeLabel;
    }

    if (resolvedRange.rangeStartMs !== null && resolvedRange.rangeEndMs !== null) {
      return formatWidgetRangeLabel(resolvedRange.rangeStartMs, resolvedRange.rangeEndMs);
    }

    return "Fixed date";
  }, [resolvedRange, timeRangeLabel]);

  const dataQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_visualizer",
      resolvedConfig.dataNodeId,
      requestedColumns.join("|"),
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
  const tableColumns = useMemo(
    () => buildDataNodeVisualizerTableColumns(dataQuery.data ?? [], resolvedConfig),
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
  const activeViewMode = viewModeOverride ?? resolvedConfig.displayMode;
  const hasSourceTableConfiguration = Boolean(dataNodeDetailQuery.data?.sourcetableconfiguration);

  useEffect(() => {
    setViewModeOverride(null);
  }, [resolvedConfig.displayMode]);

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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{resolvedConfig.dataNodeLabel}</Badge>
            <Badge variant="neutral">{resolvedConfig.provider}</Badge>
            <Badge variant="neutral">{resolvedConfig.chartType}</Badge>
            <Badge variant="neutral">
              {resolvedConfig.seriesAxisMode === "separate" ? "separate axes" : "shared axis"}
            </Badge>
            {resolvedConfig.normalizeSeries ? (
              <Badge variant="neutral">normalized</Badge>
            ) : null}
            <Badge variant="neutral">{rangeLabel}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>X {resolvedConfig.xField}</span>
            <span>Y {resolvedConfig.yField}</span>
            {resolvedConfig.groupField ? <span>Group {resolvedConfig.groupField}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <WidgetModeButton
            active={activeViewMode === "chart"}
            onClick={() => setViewModeOverride("chart")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Chart
          </WidgetModeButton>
          <WidgetModeButton
            active={activeViewMode === "table"}
            onClick={() => setViewModeOverride("table")}
          >
            <Table2 className="h-3.5 w-3.5" />
            Table
          </WidgetModeButton>
        </div>
      </div>

      {dataQuery.isLoading ? (
        <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <Skeleton className="h-full min-h-[260px] rounded-[calc(var(--radius)-6px)]" />
          <Skeleton className="h-full min-h-[260px] rounded-[calc(var(--radius)-6px)]" />
        </div>
      ) : null}

      {dataQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(dataQuery.error)}
        </div>
      ) : null}

      {!dataQuery.isLoading && !dataQuery.isError ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{(dataQuery.data?.length ?? 0).toLocaleString()} rows loaded</span>
            {seriesResult.droppedGroups > 0 ? (
              <span>
                showing top {(seriesResult.series.length).toLocaleString()} groups, hiding{" "}
                {seriesResult.droppedGroups.toLocaleString()}
              </span>
            ) : null}
            {dataQuery.data && dataQuery.data.length >= resolvedConfig.limit ? (
              <span>limited to {resolvedConfig.limit.toLocaleString()} rows</span>
            ) : null}
          </div>

          <div className="min-h-0 flex-1">
            {activeViewMode === "table" ? (
              <DataNodeVisualizerTable columns={tableColumns} rows={dataQuery.data ?? []} />
            ) : (
              <TradingViewSeriesChart
                chartType={resolvedConfig.chartType}
                normalizationTimeMs={normalizationTimeMs}
                series={seriesResult.series}
                seriesAxisMode={resolvedConfig.seriesAxisMode}
              />
            )}
          </div>

          {!dataQuery.isLoading &&
          !dataQuery.isError &&
          activeViewMode === "chart" &&
          (dataQuery.data?.length ?? 0) > 0 &&
          seriesResult.series.length === 0 ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              The selected X field does not look time-like, or the Y field does not contain numeric
              values for the current range.
            </div>
          ) : null}
        </>
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
