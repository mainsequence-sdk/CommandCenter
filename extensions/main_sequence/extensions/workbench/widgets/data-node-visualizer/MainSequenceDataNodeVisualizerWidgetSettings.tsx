import { useMemo, useState, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import {
  type DataNodeLastObservation,
  type DataNodeRemoteDataRow,
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeLastObservation,
  formatMainSequenceError,
} from "../../../../common/api";
import { DataNodeVisualizerTable } from "./DataNodeVisualizerTable";
import type { DataNodeVisualizerControllerContext } from "./controller";
import {
  buildDataNodeVisualizerSeries,
  buildDataNodeVisualizerTableColumns,
  resolveDataNodeVisualizerDateRange,
  resolveDataNodeVisualizerNormalizationTimeMs,
  resolveDataNodeVisualizerPreviewAnchorMs,
  type DataNodeVisualizerViewMode,
  type MainSequenceDataNodeVisualizerWidgetProps,
} from "./dataNodeVisualizerModel";
import { TradingViewSeriesChart } from "./TradingViewSeriesChart";

const previewRowLimit = 2_500;

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-topbar-foreground">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function formatPreviewTimestamp(timestampMs: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
}

function formatRangeSummary(startMs: number, endMs: number) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startMs)} - ${formatter.format(endMs)}`;
}

function toColorInputValue(value: string | undefined, fallback: string) {
  if (typeof value === "string" && /^#(?:[0-9a-fA-F]{6})$/.test(value.trim())) {
    return value.trim().toLowerCase();
  }

  return fallback;
}

export function MainSequenceDataNodeVisualizerWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
  controllerContext,
}: WidgetSettingsComponentProps<MainSequenceDataNodeVisualizerWidgetProps>) {
  const { resolvedTokens } = useTheme();
  const {
    rangeStartMs: dashboardRangeStartMs,
    rangeEndMs: dashboardRangeEndMs,
  } = useDashboardControls();
  const context = controllerContext as DataNodeVisualizerControllerContext | undefined;
  const resolvedConfig = context?.resolvedConfig;
  const selectedDataNodeId = context?.selectedDataNodeId ?? Number(draftProps.dataNodeId ?? 0);
  const selectedDetail = context?.selectedDataNodeDetailQuery.data;
  const hasNoData = context?.hasNoData ?? false;
  const [previewModeOverride, setPreviewModeOverride] = useState<DataNodeVisualizerViewMode | null>(
    null,
  );

  const activePreviewMode = previewModeOverride ?? "chart";

  const lastObservationQuery = useQuery<DataNodeLastObservation>({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_visualizer",
      "last_observation",
      selectedDataNodeId,
    ],
    queryFn: () => fetchDataNodeLastObservation(selectedDataNodeId),
    enabled: Number.isFinite(selectedDataNodeId) && selectedDataNodeId > 0,
    staleTime: 300_000,
  });

  const previewAnchorMs = useMemo(
    () => resolveDataNodeVisualizerPreviewAnchorMs(selectedDetail, lastObservationQuery.data),
    [lastObservationQuery.data, selectedDetail],
  );
  const previewRange = useMemo(
    () =>
      resolvedConfig
        ? resolveDataNodeVisualizerDateRange(
            resolvedConfig,
            dashboardRangeStartMs,
            dashboardRangeEndMs,
          )
        : { hasValidRange: false, rangeStartMs: null, rangeEndMs: null },
    [dashboardRangeEndMs, dashboardRangeStartMs, resolvedConfig],
  );
  const previewQuery = useQuery<DataNodeRemoteDataRow[]>({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_visualizer",
      "preview",
      selectedDataNodeId,
      JSON.stringify(draftProps),
      previewRange.rangeStartMs,
      previewRange.rangeEndMs,
      activePreviewMode,
    ],
    queryFn: async () => {
      if (!resolvedConfig?.dataNodeId || !previewRange.hasValidRange) {
        return [];
      }

      const previewColumns =
        activePreviewMode === "table"
          ? resolvedConfig.availableFields.map((field) => field.key)
          : buildDataNodeVisualizerTableColumns([], resolvedConfig);

      return fetchDataNodeDataBetweenDatesFromRemote(resolvedConfig.dataNodeId, {
        start_date: Math.floor((previewRange.rangeStartMs ?? 0) / 1000),
        end_date: Math.floor((previewRange.rangeEndMs ?? 0) / 1000),
        columns: previewColumns,
        unique_identifier_list: resolvedConfig.uniqueIdentifierList,
        great_or_equal: true,
        less_or_equal: true,
        limit: previewRowLimit,
        offset: 0,
      });
    },
    enabled: Boolean(resolvedConfig?.dataNodeId) && previewRange.hasValidRange && !hasNoData,
  });

  const previewSeriesResult = useMemo(
    () => (resolvedConfig ? buildDataNodeVisualizerSeries(previewQuery.data ?? [], resolvedConfig) : { series: [], droppedGroups: 0 }),
    [previewQuery.data, resolvedConfig],
  );
  const previewTableColumns = useMemo(
    () =>
      resolvedConfig
        ? buildDataNodeVisualizerTableColumns(previewQuery.data ?? [], resolvedConfig)
        : [],
    [previewQuery.data, resolvedConfig],
  );
  const previewNormalizationTimeMs = useMemo(
    () =>
      resolvedConfig
        ? resolveDataNodeVisualizerNormalizationTimeMs(
            resolvedConfig,
            previewRange.rangeStartMs,
          )
        : null,
    [previewRange.rangeStartMs, resolvedConfig],
  );
  const previewRangeSummary =
    previewRange.rangeStartMs && previewRange.rangeEndMs
      ? formatRangeSummary(previewRange.rangeStartMs, previewRange.rangeEndMs)
      : "Select a valid date range to preview";
  const previewChartEmptyMessage =
    (previewQuery.data?.length ?? 0) > 0
      ? "Rows were loaded, but the selected X field is not time-like or the Y field is not numeric."
      : "No chartable rows are available for the selected range.";
  const canRenderChartPreview = Boolean(resolvedConfig?.xField && resolvedConfig?.yField);

  const seriesStyleRows = useMemo(() => {
    const palette = [
      resolvedTokens.primary,
      resolvedTokens.accent,
      resolvedTokens.success,
      resolvedTokens.warning,
      resolvedTokens.danger,
    ];

    return previewSeriesResult.series.map((series, index) => ({
      id: series.id,
      label: series.label,
      pointCount: series.pointCount,
      color: toColorInputValue(
        resolvedConfig?.seriesOverrides?.[series.id]?.color,
        toColorInputValue(palette[index % palette.length], "#2563eb"),
      ),
    }));
  }, [previewSeriesResult.series, resolvedConfig?.seriesOverrides, resolvedTokens]);

  function updateSeriesColor(seriesId: string, color: string) {
    onDraftPropsChange({
      ...draftProps,
      seriesOverrides: {
        ...(resolvedConfig?.seriesOverrides ?? {}),
        [seriesId]: { color },
      },
    });
  }

  function clearSeriesColor(seriesId: string) {
    if (!resolvedConfig?.seriesOverrides?.[seriesId]) {
      return;
    }

    const nextOverrides = { ...(resolvedConfig.seriesOverrides ?? {}) };
    delete nextOverrides[seriesId];

    onDraftPropsChange({
      ...draftProps,
      seriesOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    });
  }

  if (!resolvedConfig) {
    return null;
  }

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Preview"
        description="Check the current mapping against the current range. Table mode stays inside settings only."
      >
        {resolvedConfig.dataNodeId ? (
          <div className="space-y-4">
            {hasNoData ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
                This data node has no data, so no preview is available.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreviewMode === "chart" ? "default" : "outline"}
                      onClick={() => setPreviewModeOverride("chart")}
                    >
                      Chart
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={activePreviewMode === "table" ? "default" : "outline"}
                      onClick={() => setPreviewModeOverride("table")}
                    >
                      Table
                    </Button>
                  </div>

                  <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                    {previewRangeSummary}
                  </div>
                </div>

                {previewAnchorMs !== null ? (
                  <div className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 px-3 py-3">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Latest observation
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {formatPreviewTimestamp(previewAnchorMs)}
                    </div>
                  </div>
                ) : null}

                {activePreviewMode === "chart" && !canRenderChartPreview ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    Choose both axes to load the preview.
                  </div>
                ) : null}

                {previewQuery.isLoading ? (
                  <div className="grid gap-3">
                    <Skeleton className="h-6 w-48 rounded-[calc(var(--radius)-8px)]" />
                    <Skeleton className="h-[280px] rounded-[calc(var(--radius)-6px)]" />
                  </div>
                ) : null}

                {previewQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatMainSequenceError(previewQuery.error)}
                  </div>
                ) : null}

                {!previewQuery.isLoading &&
                !previewQuery.isError &&
                previewRange.hasValidRange &&
                (activePreviewMode === "table" || canRenderChartPreview) ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{(previewQuery.data?.length ?? 0).toLocaleString()} preview rows</span>
                      {activePreviewMode === "chart" && previewSeriesResult.droppedGroups > 0 ? (
                        <span>
                          showing top {previewSeriesResult.series.length.toLocaleString()} groups, hiding{" "}
                          {previewSeriesResult.droppedGroups.toLocaleString()}
                        </span>
                      ) : null}
                    </div>

                    {activePreviewMode === "table" ? (
                      <DataNodeVisualizerTable
                        className="min-h-[280px]"
                        columns={previewTableColumns}
                        emptyMessage="No rows are available for the preview window."
                        maxRows={40}
                        rows={previewQuery.data ?? []}
                      />
                    ) : (
                      <TradingViewSeriesChart
                        chartType={resolvedConfig.chartType}
                        className="min-h-[280px]"
                        emptyMessage={previewChartEmptyMessage}
                        normalizationTimeMs={previewNormalizationTimeMs}
                        series={previewSeriesResult.series}
                        seriesAxisMode={resolvedConfig.seriesAxisMode}
                      />
                    )}
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            Select a data node to enable the preview controls.
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Series styling"
        description="Lock specific series colors after the preview resolves the active series list."
      >
        {!resolvedConfig.dataNodeId || hasNoData ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            Select a chartable data node to configure per-series colors.
          </div>
        ) : previewQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-24 rounded-[calc(var(--radius)-6px)]" />
            <Skeleton className="h-24 rounded-[calc(var(--radius)-6px)]" />
          </div>
        ) : seriesStyleRows.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {seriesStyleRows.map((series) => (
              <div
                key={series.id}
                className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{series.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {series.pointCount > 0
                        ? `${series.pointCount.toLocaleString()} preview points`
                        : "Uses the active series id when data becomes available."}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!editable || !resolvedConfig.seriesOverrides?.[series.id]?.color}
                    onClick={() => clearSeriesColor(series.id)}
                  >
                    Reset
                  </Button>
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="color"
                    value={series.color}
                    onChange={(event) => updateSeriesColor(series.id, event.target.value)}
                    disabled={!editable}
                    className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                  />
                  <Input value={series.color} readOnly />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            Load a valid date range to discover the series that can be styled.
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
