import { useMemo } from "react";

import { CalendarClock, Database, Loader2 } from "lucide-react";

import { useDashboardControls } from "@/dashboards/DashboardControls";
import type { WidgetRailSummaryComponentProps } from "@/widgets/types";

import { useResolvedDataNodeWidgetSourceBinding } from "../data-node-shared/dataNodeWidgetSource";
import {
  formatDataNodeFilterTransformSummary,
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
  title,
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
  const resolvedConfig = useMemo(
    () =>
      resolveDataNodeFilterConfig(
        effectiveProps,
        undefined,
        normalizedRuntimeState?.fields ?? linkedDataset?.fields,
      ),
    [effectiveProps, linkedDataset?.fields, normalizedRuntimeState?.fields],
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
  const sourceDatasetStatus = sourceBinding.isFilterWidgetSource
    ? linkedDataset?.status ?? normalizedRuntimeState?.status ?? "idle"
    : normalizedRuntimeState?.status ?? "idle";
  const sourceWidgetLabel =
    sourceBinding.resolvedSourceWidget?.title?.trim() ||
    sourceBinding.resolvedSourceWidget?.id ||
    null;
  const isUnconfigured =
    sourceBinding.isFilterWidgetSource
      ? !sourceBinding.hasResolvedFilterWidgetSource
      : !Number.isFinite(dataNodeId) || dataNodeId <= 0;
  const hasInvalidFixedRange =
    !sourceBinding.isFilterWidgetSource &&
    resolvedConfig.dateRangeMode === "fixed" &&
    !resolvedRange.hasValidRange;
  const runtimeErrorMessage =
    sourceBinding.isFilterWidgetSource
      ? linkedDataset?.status === "error"
        ? linkedDataset.error ?? "The upstream source widget failed to publish rows."
        : normalizedRuntimeState?.status === "error"
          ? normalizedRuntimeState.error ?? "The canonical dataset request failed."
          : null
      : normalizedRuntimeState?.status === "error"
        ? normalizedRuntimeState.error ?? "The canonical dataset request failed."
        : null;
  const status =
    isUnconfigured
      ? "idle"
      : hasInvalidFixedRange
        ? "range"
        : runtimeErrorMessage
          ? "data_error"
          : sourceDatasetStatus === "loading"
            ? "loading"
            : sourceDatasetStatus === "ready"
              ? "ready"
              : "idle";

  const hoverTitle =
    status === "idle"
      ? sourceBinding.isFilterWidgetSource
        ? "Source widget not configured"
        : "Data Node not configured"
      : status === "range"
        ? "Fixed range is incomplete"
        : status === "data_error"
          ? "Dataset request failed"
          : status === "loading"
            ? "Refreshing dataset"
            : "Canonical dataset ready";
  const hoverDescription =
    status === "idle"
      ? sourceBinding.isFilterWidgetSource
        ? "Choose an upstream source widget in settings so this node can transform that dataset."
        : "Choose a data node in settings so this widget can own the shared dataset."
      : status === "range"
        ? "This Data Node needs both saved fixed dates before it can publish rows."
        : status === "data_error"
          ? runtimeErrorMessage ?? "The canonical dataset request failed."
          : status === "loading"
            ? sourceBinding.isFilterWidgetSource
              ? "Linked widgets keep reading from this bound source while the dataset refreshes."
              : "Linked widgets keep reading from this Data Node while the dataset refreshes."
            : "Linked widgets should read rows from this Data Node instead of querying directly.";
  const widgetTitle =
    typeof title === "string" && title.trim()
      ? title.trim()
      : sourceBinding.isFilterWidgetSource
        ? (sourceWidgetLabel ?? "Data Node")
        : (resolvedConfig.dataNodeLabel || "Data Node");
  const hoverSummary = `${hoverTitle}. ${hoverDescription}`;
  const displayedRows =
    status === "ready"
      ? (linkedDataset?.rows ?? normalizedRuntimeState?.rows ?? [])
      : (normalizedRuntimeState?.rows ?? linkedDataset?.rows ?? []);
  const displayedColumns =
    status === "ready"
      ? (linkedDataset?.columns ?? normalizedRuntimeState?.columns ?? [])
      : (normalizedRuntimeState?.columns ?? linkedDataset?.columns ?? []);
  const displayedRangeStartMs =
    status === "ready"
      ? (linkedDataset?.rangeStartMs ?? normalizedRuntimeState?.rangeStartMs ?? resolvedRange.rangeStartMs)
      : (normalizedRuntimeState?.rangeStartMs ?? linkedDataset?.rangeStartMs ?? resolvedRange.rangeStartMs);
  const displayedRangeEndMs =
    status === "ready"
      ? (linkedDataset?.rangeEndMs ?? normalizedRuntimeState?.rangeEndMs ?? resolvedRange.rangeEndMs)
      : (normalizedRuntimeState?.rangeEndMs ?? linkedDataset?.rangeEndMs ?? resolvedRange.rangeEndMs);
  const publishedRowCount = displayedRows.length;
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
          : "Waiting for dataset";
  const transformSummary = formatDataNodeFilterTransformSummary(resolvedConfig);
  const Icon =
    status === "idle"
      ? Database
      : status === "range"
        ? CalendarClock
        : status === "loading"
          ? Loader2
          : Database;
  const iconToneClass =
    status === "data_error"
      ? "border-danger/40 bg-danger/10 text-danger"
      : status === "range"
        ? "border-warning/40 bg-warning/10 text-warning"
        : status === "loading"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/70 bg-background/60 text-primary";

  return (
    <DataNodeHoverPanel
      title={widgetTitle}
      description={hoverSummary}
      details={[
        {
          label: sourceBinding.isFilterWidgetSource ? "Source widget" : "Data node",
          value:
            sourceBinding.isFilterWidgetSource
              ? (sourceWidgetLabel ?? "Not selected")
              : (resolvedConfig.dataNodeLabel ||
                (dataNodeId > 0 ? dataNodeId : "Not selected")),
        },
        {
          label: "Range",
          value: formatRangeSummary(
            displayedRangeStartMs,
            displayedRangeEndMs,
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
          value: `${displayedColumns.length.toLocaleString()} columns`,
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
