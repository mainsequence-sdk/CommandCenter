import { useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Database, Loader2 } from "lucide-react";

import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeDetail,
  formatMainSequenceError,
} from "../../../../common/api";
import {
  buildDataNodeFieldOptionsFromRows,
} from "../data-node-shared/dataNodeShared";
import {
  buildDataNodeRemoteRowsQueryKey,
  useResolvedDataNodeWidgetSourceBinding,
} from "../data-node-shared/dataNodeWidgetSource";
import {
  buildDataNodeTransformedDataset,
  normalizeDataNodeFilterRuntimeState,
  normalizeDataNodeFilterProps,
  resolveDataNodeFilterConfig,
  resolveDataNodeFilterDateRange,
  type DataNodeFilterRuntimeState,
  type MainSequenceDataNodeFilterWidgetProps,
} from "./dataNodeFilterModel";

type Props = WidgetComponentProps<MainSequenceDataNodeFilterWidgetProps>;

function formatDateTime(timestampMs?: number | null) {
  if (!timestampMs) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
}

function formatRangeSummary(startMs?: number | null, endMs?: number | null) {
  if (!startMs || !endMs) {
    return "Waiting for range";
  }

  return `${formatDateTime(startMs)} - ${formatDateTime(endMs)}`;
}

function areRuntimeStatesEqual(
  left: DataNodeFilterRuntimeState | null | undefined,
  right: DataNodeFilterRuntimeState | null | undefined,
) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return values.filter((value): value is string => {
    if (!value?.trim()) {
      return false;
    }

    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function collectRowKeys(rows: ReadonlyArray<Record<string, unknown>>) {
  return uniqueStrings(rows.flatMap((row) => Object.keys(row)));
}

export function MainSequenceDataNodeFilterWidget({
  props,
  runtimeState,
  onRuntimeStateChange,
}: Props) {
  const {
    rangeStartMs: dashboardRangeStartMs,
    rangeEndMs: dashboardRangeEndMs,
  } = useDashboardControls();
  const normalizedProps = useMemo(
    () => normalizeDataNodeFilterProps(props),
    [props],
  );
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({
    props: normalizedProps,
  });
  const linkedNodeRuntime = useMemo(
    () => normalizeDataNodeFilterRuntimeState(sourceBinding.referencedFilterWidget?.runtimeState),
    [sourceBinding.referencedFilterWidget?.runtimeState],
  );
  const effectiveSourceProps = sourceBinding.resolvedSourceProps;
  const effectiveProps = useMemo(
    () => ({
      ...normalizedProps,
      ...effectiveSourceProps,
    }),
    [effectiveSourceProps, normalizedProps],
  );
  const dataNodeId = Number(
    linkedNodeRuntime?.dataNodeId ?? effectiveSourceProps.dataNodeId ?? 0,
  );
  const dataNodeDetailQuery = useQuery({
    queryKey: ["main_sequence", "widgets", "data_node_filter", "detail", dataNodeId],
    queryFn: () => fetchDataNodeDetail(dataNodeId),
    enabled: Number.isFinite(dataNodeId) && dataNodeId > 0,
    staleTime: 300_000,
  });
  const runtimeFieldOptions = useMemo(
    () =>
      buildDataNodeFieldOptionsFromRows({
        columns: linkedNodeRuntime?.columns,
        rows: linkedNodeRuntime?.rows,
      }),
    [linkedNodeRuntime?.columns, linkedNodeRuntime?.rows],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveDataNodeFilterConfig(
        effectiveProps,
        dataNodeDetailQuery.data,
        runtimeFieldOptions.length > 0 ? runtimeFieldOptions : undefined,
      ),
    [dataNodeDetailQuery.data, effectiveProps, runtimeFieldOptions],
  );
  const resolvedRange = useMemo(
    () =>
      resolveDataNodeFilterDateRange(
        resolvedConfig,
        dashboardRangeStartMs,
        dashboardRangeEndMs,
      ),
    [dashboardRangeEndMs, dashboardRangeStartMs, resolvedConfig],
  );
  const requestedColumns = useMemo(
    () => resolvedConfig.availableFields.map((field) => field.key),
    [resolvedConfig.availableFields],
  );
  const hasSourceTableConfiguration = Boolean(
    dataNodeDetailQuery.data?.sourcetableconfiguration,
  );
  const dataQuery = useQuery({
    queryKey: buildDataNodeRemoteRowsQueryKey({
      sourceMode: sourceBinding.sourceMode,
      sourceWidgetId: sourceBinding.sourceWidgetId,
      dataNodeId: resolvedConfig.dataNodeId,
      columns: requestedColumns,
      uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
      rangeStartMs: resolvedRange.rangeStartMs,
      rangeEndMs: resolvedRange.rangeEndMs,
      limit: resolvedConfig.limit,
    }),
    queryFn: () =>
      fetchDataNodeDataBetweenDatesFromRemote(resolvedConfig.dataNodeId!, {
        start_date: Math.floor((resolvedRange.rangeStartMs ?? 0) / 1000),
        end_date: Math.floor((resolvedRange.rangeEndMs ?? 0) / 1000),
        columns: requestedColumns,
        unique_identifier_list: resolvedConfig.uniqueIdentifierList,
        great_or_equal: true,
        less_or_equal: true,
        limit: resolvedConfig.limit,
        offset: 0,
      }),
    enabled:
      Boolean(resolvedConfig.dataNodeId) &&
      !sourceBinding.isFilterWidgetSource &&
      hasSourceTableConfiguration &&
      resolvedRange.hasValidRange,
    staleTime: 60_000,
  });
  const normalizedRuntimeState = useMemo(
    () => normalizeDataNodeFilterRuntimeState(runtimeState),
    [runtimeState],
  );
  const loadingColumns = useMemo(
    () =>
      uniqueStrings([
        ...requestedColumns,
        ...(normalizedRuntimeState?.columns ?? []),
        ...collectRowKeys(normalizedRuntimeState?.rows ?? []),
      ]),
    [normalizedRuntimeState?.columns, normalizedRuntimeState?.rows, requestedColumns],
  );
  const readyColumns = useMemo(
    () =>
      uniqueStrings([
        ...requestedColumns,
        ...collectRowKeys(
          sourceBinding.isFilterWidgetSource
            ? (linkedNodeRuntime?.rows ?? [])
            : (dataQuery.data ?? []),
        ),
      ]),
    [dataQuery.data, linkedNodeRuntime?.rows, requestedColumns, sourceBinding.isFilterWidgetSource],
  );
  const transformedDataset = useMemo(
    () =>
      buildDataNodeTransformedDataset(
        sourceBinding.isFilterWidgetSource
          ? (linkedNodeRuntime?.rows ?? [])
          : (dataQuery.data ?? []),
        resolvedConfig,
        readyColumns,
      ),
    [dataQuery.data, linkedNodeRuntime?.rows, readyColumns, resolvedConfig, sourceBinding.isFilterWidgetSource],
  );
  const nextRuntimeState = useMemo(() => {
    if (!resolvedConfig.dataNodeId) {
      return undefined;
    }

    if (dataNodeDetailQuery.isError) {
      return {
        status: "error",
        dataNodeId: resolvedConfig.dataNodeId,
        columns: loadingColumns,
        rows: [],
        limit: resolvedConfig.limit,
        uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
        error: formatMainSequenceError(dataNodeDetailQuery.error),
        updatedAtMs:
          dataNodeDetailQuery.errorUpdatedAt ||
          normalizedRuntimeState?.updatedAtMs,
      } satisfies DataNodeFilterRuntimeState;
    }

    if (!hasSourceTableConfiguration && !sourceBinding.isFilterWidgetSource) {
      return {
        status: "error",
        dataNodeId: resolvedConfig.dataNodeId,
        columns: loadingColumns,
        rows: [],
        limit: resolvedConfig.limit,
        uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
        error: "This data node has no source-table metadata.",
        updatedAtMs: normalizedRuntimeState?.updatedAtMs,
      } satisfies DataNodeFilterRuntimeState;
    }

    if (
      sourceBinding.isFilterWidgetSource &&
      !sourceBinding.hasResolvedFilterWidgetSource
    ) {
      return {
        status: "idle",
        dataNodeId: resolvedConfig.dataNodeId,
        columns: loadingColumns,
        rows: [],
        limit: resolvedConfig.limit,
        rangeStartMs: resolvedRange.rangeStartMs,
        rangeEndMs: resolvedRange.rangeEndMs,
        uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
        updatedAtMs: normalizedRuntimeState?.updatedAtMs,
      } satisfies DataNodeFilterRuntimeState;
    }

    if (sourceBinding.isFilterWidgetSource && linkedNodeRuntime?.status === "error") {
      return {
        status: "error",
        dataNodeId: linkedNodeRuntime.dataNodeId ?? resolvedConfig.dataNodeId,
        columns: loadingColumns,
        rows: [],
        limit: resolvedConfig.limit,
        rangeStartMs: linkedNodeRuntime.rangeStartMs ?? resolvedRange.rangeStartMs,
        rangeEndMs: linkedNodeRuntime.rangeEndMs ?? resolvedRange.rangeEndMs,
        uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
        error: linkedNodeRuntime.error ?? "The upstream Data Node failed to publish rows.",
        updatedAtMs: linkedNodeRuntime.updatedAtMs ?? normalizedRuntimeState?.updatedAtMs,
      } satisfies DataNodeFilterRuntimeState;
    }

    if (sourceBinding.isFilterWidgetSource && linkedNodeRuntime?.status === "loading") {
      return {
        status: "loading",
        dataNodeId: linkedNodeRuntime.dataNodeId ?? resolvedConfig.dataNodeId,
        columns: transformedDataset.columns,
        rows: normalizedRuntimeState?.rows ?? [],
        limit: resolvedConfig.limit,
        rangeStartMs: linkedNodeRuntime.rangeStartMs ?? resolvedRange.rangeStartMs,
        rangeEndMs: linkedNodeRuntime.rangeEndMs ?? resolvedRange.rangeEndMs,
        uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
        updatedAtMs: linkedNodeRuntime.updatedAtMs ?? normalizedRuntimeState?.updatedAtMs,
      } satisfies DataNodeFilterRuntimeState;
    }

    if (dataQuery.isError) {
      return {
        status: "error",
        dataNodeId: resolvedConfig.dataNodeId,
        columns: loadingColumns,
        rows: [],
        limit: resolvedConfig.limit,
        rangeStartMs: resolvedRange.rangeStartMs,
        rangeEndMs: resolvedRange.rangeEndMs,
        uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
        error: formatMainSequenceError(dataQuery.error),
        updatedAtMs:
          dataQuery.errorUpdatedAt ||
          normalizedRuntimeState?.updatedAtMs,
      } satisfies DataNodeFilterRuntimeState;
    }

    if (dataQuery.isLoading) {
      return {
        status: "loading",
        dataNodeId: resolvedConfig.dataNodeId,
        columns: loadingColumns,
        rows: normalizedRuntimeState?.rows ?? [],
        limit: resolvedConfig.limit,
        rangeStartMs: resolvedRange.rangeStartMs,
        rangeEndMs: resolvedRange.rangeEndMs,
        uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
        updatedAtMs:
          normalizedRuntimeState?.updatedAtMs ??
          dataQuery.dataUpdatedAt ??
          undefined,
      } satisfies DataNodeFilterRuntimeState;
    }

    if (
      (sourceBinding.isFilterWidgetSource && linkedNodeRuntime?.status === "ready") ||
      dataQuery.data
    ) {
      return {
        status: "ready",
        dataNodeId: resolvedConfig.dataNodeId,
        columns: transformedDataset.columns,
        rows: transformedDataset.rows,
        limit: resolvedConfig.limit,
        rangeStartMs:
          linkedNodeRuntime?.rangeStartMs ?? resolvedRange.rangeStartMs,
        rangeEndMs:
          linkedNodeRuntime?.rangeEndMs ?? resolvedRange.rangeEndMs,
        uniqueIdentifierList: resolvedConfig.uniqueIdentifierList,
        updatedAtMs:
          linkedNodeRuntime?.updatedAtMs ||
          dataQuery.dataUpdatedAt ||
          normalizedRuntimeState?.updatedAtMs,
      } satisfies DataNodeFilterRuntimeState;
    }

    return undefined;
  }, [
    dataNodeDetailQuery.error,
    dataNodeDetailQuery.errorUpdatedAt,
    dataNodeDetailQuery.isError,
    dataQuery.data,
    dataQuery.dataUpdatedAt,
    dataQuery.error,
    dataQuery.errorUpdatedAt,
    dataQuery.isError,
    dataQuery.isLoading,
    hasSourceTableConfiguration,
    linkedNodeRuntime?.dataNodeId,
    linkedNodeRuntime?.error,
    linkedNodeRuntime?.rangeEndMs,
    linkedNodeRuntime?.rangeStartMs,
    linkedNodeRuntime?.status,
    linkedNodeRuntime?.updatedAtMs,
    loadingColumns,
    normalizedRuntimeState?.rows,
    normalizedRuntimeState?.updatedAtMs,
    requestedColumns,
    readyColumns,
    resolvedConfig.dataNodeId,
    resolvedConfig.limit,
    resolvedConfig.uniqueIdentifierList,
    resolvedRange.rangeEndMs,
    resolvedRange.rangeStartMs,
    sourceBinding.hasResolvedFilterWidgetSource,
    sourceBinding.isFilterWidgetSource,
    transformedDataset.columns,
    transformedDataset.rows,
  ]);

  useEffect(() => {
    if (!onRuntimeStateChange) {
      return;
    }

    if (areRuntimeStatesEqual(normalizedRuntimeState, nextRuntimeState)) {
      return;
    }

    onRuntimeStateChange(nextRuntimeState);
  }, [nextRuntimeState, normalizedRuntimeState, onRuntimeStateChange]);
  const isUnconfigured =
    sourceBinding.isFilterWidgetSource
      ? !sourceBinding.hasResolvedFilterWidgetSource
      : !Number.isFinite(dataNodeId) || dataNodeId <= 0;
  const hasInvalidFixedRange =
    !sourceBinding.isFilterWidgetSource &&
    resolvedConfig.dateRangeMode === "fixed" &&
    !resolvedRange.hasValidRange;
  const detailErrorMessage = dataNodeDetailQuery.isError
    ? formatMainSequenceError(dataNodeDetailQuery.error)
    : null;
  const dataErrorMessage = sourceBinding.isFilterWidgetSource
    ? linkedNodeRuntime?.status === "error"
      ? linkedNodeRuntime.error ?? "The upstream Data Node failed to load rows."
      : null
    : dataQuery.isError
      ? formatMainSequenceError(dataQuery.error)
      : null;
  const status =
    isUnconfigured
      ? "idle"
      : hasInvalidFixedRange
        ? "range"
        : detailErrorMessage
          ? "detail_error"
          : !hasSourceTableConfiguration &&
              !sourceBinding.isFilterWidgetSource &&
              !dataNodeDetailQuery.isLoading
            ? "metadata_error"
            : dataErrorMessage
              ? "data_error"
              : dataNodeDetailQuery.isLoading ||
                  dataQuery.isLoading ||
                  (sourceBinding.isFilterWidgetSource &&
                    (linkedNodeRuntime?.status === "loading" || linkedNodeRuntime == null))
                ? "loading"
                : "ready";

  const hoverTitle =
    status === "idle"
      ? "Data Node not configured"
      : status === "range"
        ? "Fixed range is incomplete"
        : status === "detail_error"
          ? "Data node lookup failed"
          : status === "metadata_error"
            ? "Missing table metadata"
            : status === "data_error"
              ? "Dataset request failed"
      : status === "loading"
                ? "Refreshing dataset"
                : "Canonical dataset ready";
  const hoverDescription =
    status === "idle"
      ? sourceBinding.isFilterWidgetSource
        ? "Choose an upstream Data Node in settings so this node can transform that dataset."
        : "Choose a data node in settings so this widget can own the shared dataset."
      : status === "range"
        ? "This Data Node needs both saved fixed dates before it can publish rows."
        : status === "detail_error"
          ? detailErrorMessage ?? "Unable to load data node metadata."
          : status === "metadata_error"
            ? "This data node has no source-table metadata, so it cannot publish rows."
          : status === "data_error"
              ? dataErrorMessage ?? "The canonical dataset request failed."
              : status === "loading"
                ? "Linked widgets keep reading from this Data Node while the dataset refreshes."
                : "Linked widgets should read rows from this Data Node instead of querying directly.";
  const publishedRowCount =
    nextRuntimeState?.rows.length ??
    normalizedRuntimeState?.rows.length ??
    linkedNodeRuntime?.rows.length ??
    dataQuery.data?.length ??
    0;
  const identifierSummary = resolvedConfig.uniqueIdentifierList?.length
    ? `${resolvedConfig.uniqueIdentifierList.length.toLocaleString()} identifiers`
    : "No identifier selection";
  const datasetSummary =
    status === "loading"
      ? "Loading rows"
      : status === "ready"
        ? `${publishedRowCount.toLocaleString()} rows`
        : status === "data_error"
          ? "Request failed"
          : status === "metadata_error"
            ? "Unavailable"
            : "Waiting for dataset";
  const transformSummary =
    resolvedConfig.transformMode === "pivot" &&
    resolvedConfig.pivotField &&
    resolvedConfig.pivotValueField
      ? `Pivot ${resolvedConfig.pivotField} -> ${resolvedConfig.pivotValueField} (${resolvedConfig.aggregateMode})`
      : resolvedConfig.transformMode === "aggregate" &&
          resolvedConfig.keyFields &&
          resolvedConfig.keyFields.length > 0
        ? `Aggregate by ${resolvedConfig.keyFields.join(", ")} (${resolvedConfig.aggregateMode})`
        : resolvedConfig.projectFields && resolvedConfig.projectFields.length > 0
          ? `Projected ${resolvedConfig.projectFields.length.toLocaleString()} columns`
          : "Raw dataset";
  const Icon =
    status === "idle" || status === "detail_error" || status === "metadata_error"
      ? Database
      : status === "range"
        ? CalendarClock
        : status === "loading"
          ? Loader2
          : Database;
  const iconToneClass =
    status === "detail_error" || status === "metadata_error" || status === "data_error"
      ? "border-danger/40 bg-danger/10 text-danger"
      : status === "range"
        ? "border-warning/40 bg-warning/10 text-warning"
        : status === "loading"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/70 bg-background/60 text-primary";
  const indicatorToneClass =
    status === "detail_error" || status === "metadata_error" || status === "data_error"
      ? "bg-danger"
      : status === "range"
        ? "bg-warning"
        : status === "loading"
          ? "bg-primary"
          : status === "ready"
            ? "bg-success"
            : "bg-muted-foreground/60";
  const hoverSummary = [
    `Status: ${hoverTitle}`,
    `Data node: ${resolvedConfig.dataNodeLabel || (dataNodeId > 0 ? String(dataNodeId) : "Not selected")}`,
    `Range: ${formatRangeSummary(resolvedRange.rangeStartMs, resolvedRange.rangeEndMs)}`,
    `Dataset: ${datasetSummary}`,
    `Transform: ${transformSummary}`,
    `Columns: ${(nextRuntimeState?.columns.length ?? requestedColumns.length).toLocaleString()} | Limit: ${resolvedConfig.limit.toLocaleString()}`,
    `Identifiers: ${identifierSummary}`,
  ].join("\n");

  return (
    <div className="group relative flex h-full w-full min-h-0 items-center justify-center overflow-visible">
      <div
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition-transform duration-150 group-hover:scale-[1.03] ${iconToneClass}`}
        title={hoverSummary}
        aria-label={hoverTitle}
      >
        <Icon className={`h-4.5 w-4.5 ${status === "loading" ? "animate-spin" : ""}`} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background ${indicatorToneClass}`}
        />
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[260px] -translate-x-1/2 translate-y-3 rounded-[calc(var(--radius)-4px)] border border-border/80 bg-popover/95 p-3 text-left opacity-0 shadow-xl backdrop-blur-sm transition-all duration-150 group-hover:translate-y-5 group-hover:opacity-100">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${iconToneClass}`}>
            <Icon className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{hoverTitle}</div>
            <div className="text-xs text-muted-foreground">Data Node</div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">{hoverDescription}</p>

        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Data node</span>
            <span className="max-w-[160px] text-right font-medium text-foreground">
              {resolvedConfig.dataNodeLabel || (dataNodeId > 0 ? dataNodeId : "Not selected")}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Range</span>
            <span className="max-w-[160px] text-right font-medium text-foreground">
              {formatRangeSummary(resolvedRange.rangeStartMs, resolvedRange.rangeEndMs)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Dataset</span>
            <span className="max-w-[160px] text-right font-medium text-foreground">
              {datasetSummary}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Transform</span>
            <span className="max-w-[160px] text-right font-medium text-foreground">
              {transformSummary}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Fields</span>
            <span className="max-w-[160px] text-right font-medium text-foreground">
              {(nextRuntimeState?.columns.length ?? requestedColumns.length).toLocaleString()} columns
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Identifiers</span>
            <span className="max-w-[160px] text-right font-medium text-foreground">
              {identifierSummary}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
