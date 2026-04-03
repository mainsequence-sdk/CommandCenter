import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Database, Loader2 } from "lucide-react";

import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { WidgetRailSummaryComponentProps } from "@/widgets/types";

import { fetchDataNodeDetail, formatMainSequenceError } from "../../../../common/api";
import { useResolvedDataNodeWidgetSourceBinding } from "../data-node-shared/dataNodeWidgetSource";
import {
  normalizeDataNodeFilterProps,
  normalizeDataNodeFilterRuntimeState,
  resolveDataNodeFilterConfig,
  resolveDataNodeFilterDateRange,
  type MainSequenceDataNodeFilterWidgetProps,
} from "./dataNodeFilterModel";
import { DataNodeHoverPanel } from "./DataNodeHoverPanel";

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

export function DataNodeRailSummary({
  instanceId,
  props,
  runtimeState,
}: WidgetRailSummaryComponentProps<MainSequenceDataNodeFilterWidgetProps>) {
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
    currentWidgetInstanceId: instanceId,
  });
  const linkedDataset = sourceBinding.resolvedSourceDataset;
  const normalizedRuntimeState = useMemo(
    () => normalizeDataNodeFilterRuntimeState(runtimeState),
    [runtimeState],
  );
  const effectiveProps = useMemo(
    () => ({
      ...normalizedProps,
      ...sourceBinding.resolvedSourceProps,
    }),
    [normalizedProps, sourceBinding.resolvedSourceProps],
  );
  const dataNodeId = Number(
    normalizedRuntimeState?.dataNodeId ??
      linkedDataset?.dataNodeId ??
      effectiveProps.dataNodeId ??
      0,
  );
  const detailQuery = useQuery({
    queryKey: ["main_sequence", "widgets", "data_node_filter", "rail_detail", dataNodeId],
    queryFn: () => fetchDataNodeDetail(dataNodeId),
    enabled: Number.isFinite(dataNodeId) && dataNodeId > 0,
    staleTime: 300_000,
  });
  const resolvedConfig = useMemo(
    () => resolveDataNodeFilterConfig(effectiveProps, detailQuery.data),
    [detailQuery.data, effectiveProps],
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
  const hasSourceTableConfiguration = Boolean(detailQuery.data?.sourcetableconfiguration);
  const isUnconfigured =
    sourceBinding.isFilterWidgetSource
      ? !sourceBinding.hasResolvedFilterWidgetSource
      : !Number.isFinite(dataNodeId) || dataNodeId <= 0;
  const hasInvalidFixedRange =
    !sourceBinding.isFilterWidgetSource &&
    resolvedConfig.dateRangeMode === "fixed" &&
    !resolvedRange.hasValidRange;
  const detailErrorMessage = detailQuery.isError
    ? formatMainSequenceError(detailQuery.error)
    : null;
  const runtimeErrorMessage =
    normalizedRuntimeState?.status === "error"
      ? normalizedRuntimeState.error ?? "The canonical dataset request failed."
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
              !detailQuery.isLoading
            ? "metadata_error"
            : runtimeErrorMessage
              ? "data_error"
              : detailQuery.isLoading || normalizedRuntimeState?.status === "loading"
                ? "loading"
                : normalizedRuntimeState?.status === "ready"
                  ? "ready"
                  : "idle";

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
              ? runtimeErrorMessage ?? "The canonical dataset request failed."
              : status === "loading"
                ? "Linked widgets keep reading from this Data Node while the dataset refreshes."
                : "Linked widgets should read rows from this Data Node instead of querying directly.";
  const publishedRowCount = normalizedRuntimeState?.rows.length ?? 0;
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

  return (
    <DataNodeHoverPanel
      title={hoverTitle}
      description={hoverDescription}
      details={[
        {
          label: "Data node",
          value:
            resolvedConfig.dataNodeLabel ||
            (dataNodeId > 0 ? dataNodeId : "Not selected"),
        },
        {
          label: "Range",
          value: formatRangeSummary(
            normalizedRuntimeState?.rangeStartMs ?? resolvedRange.rangeStartMs,
            normalizedRuntimeState?.rangeEndMs ?? resolvedRange.rangeEndMs,
          ),
        },
        {
          label: "Dataset",
          value: datasetSummary,
        },
        {
          label: "Transform",
          value: transformSummary,
        },
        {
          label: "Fields",
          value: `${(normalizedRuntimeState?.columns.length ?? 0).toLocaleString()} columns`,
        },
        {
          label: "Identifiers",
          value: identifierSummary,
        },
      ]}
      Icon={Icon}
      iconToneClass={iconToneClass}
      spinning={status === "loading"}
    />
  );
}
