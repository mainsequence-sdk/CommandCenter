import { useMemo } from "react";
import { CalendarClock, Database, Loader2 } from "lucide-react";

import { useDashboardControls } from "@/dashboards/DashboardControls";
import {
  useResolveWidgetUpstream,
  useWidgetExecutionState,
} from "@/dashboards/DashboardWidgetExecution";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  resolveDataNodeFieldOptionsFromDataset,
} from "../data-node-shared/dataNodeShared";
import {
  useResolvedDataNodeWidgetSourceBinding,
} from "../data-node-shared/dataNodeWidgetSource";
import {
  formatDataNodeFilterTransformSummary,
  normalizeDataNodeFilterRuntimeState,
  normalizeDataNodeFilterProps,
  resolveDataNodeFilterConfig,
  resolveDataNodeFilterDateRange,
  type MainSequenceDataNodeFilterWidgetProps,
} from "./dataNodeFilterModel";
import { DataNodeHoverPanel } from "./DataNodeHoverPanel";

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

export function MainSequenceDataNodeFilterWidget({
  props,
  instanceId,
  runtimeState,
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
    currentWidgetInstanceId: instanceId,
  });
  useResolveWidgetUpstream(instanceId, {
    enabled: sourceBinding.requiresUpstreamResolution,
  });
  const linkedDataset = sourceBinding.resolvedSourceDataset;
  const executionState = useWidgetExecutionState(instanceId);
  const effectiveSourceProps = sourceBinding.resolvedSourceProps;
  const effectiveProps = useMemo(
    () => ({
      ...normalizedProps,
      ...effectiveSourceProps,
    }),
    [effectiveSourceProps, normalizedProps],
  );
  const dataNodeId = Number(
    linkedDataset?.dataNodeId ?? effectiveSourceProps.dataNodeId ?? 0,
  );
  const isManualSource = sourceBinding.sourceMode === "manual";
  const manualColumnCount = normalizedProps.manualColumns?.length ?? 0;
  const normalizedRuntimeState = useMemo(
    () => normalizeDataNodeFilterRuntimeState(runtimeState),
    [runtimeState],
  );
  const runtimeFieldOptions = useMemo(
    () =>
      resolveDataNodeFieldOptionsFromDataset({
        columns: normalizedRuntimeState?.columns ?? linkedDataset?.columns,
        fields: normalizedRuntimeState?.fields ?? linkedDataset?.fields,
        rows: normalizedRuntimeState?.rows ?? linkedDataset?.rows,
      }),
    [
      linkedDataset?.columns,
      linkedDataset?.fields,
      linkedDataset?.rows,
      normalizedRuntimeState?.columns,
      normalizedRuntimeState?.fields,
      normalizedRuntimeState?.rows,
    ],
  );
  const resolvedConfig = useMemo(
    () =>
      resolveDataNodeFilterConfig(
        effectiveProps,
        undefined,
        runtimeFieldOptions.length > 0 ? runtimeFieldOptions : undefined,
      ),
    [effectiveProps, runtimeFieldOptions],
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
  const isUnconfigured =
    sourceBinding.isFilterWidgetSource
      ? !sourceBinding.hasResolvedFilterWidgetSource
      : isManualSource
        ? manualColumnCount === 0
        : !Number.isFinite(dataNodeId) || dataNodeId <= 0;
  const runtimeStatus = normalizedRuntimeState?.status ?? "idle";
  const isExecuting = executionState?.status === "running";
  const sourceWidgetLabel =
    sourceBinding.resolvedSourceWidget?.title?.trim() ||
    sourceBinding.resolvedSourceWidget?.id ||
    null;
  const hasInvalidFixedRange =
    !sourceBinding.isFilterWidgetSource &&
    !isManualSource &&
    resolvedConfig.dateRangeMode === "fixed" &&
    !resolvedRange.hasValidRange;
  const dataErrorMessage =
    runtimeStatus === "error"
      ? normalizedRuntimeState?.error ?? "The canonical dataset request failed."
      : sourceBinding.isFilterWidgetSource && linkedDataset?.status === "error"
        ? linkedDataset.error ?? "The upstream source widget failed to publish rows."
        : null;
  const status =
    isUnconfigured
      ? "idle"
      : hasInvalidFixedRange
        ? "range"
        : dataErrorMessage
          ? "data_error"
          : sourceBinding.isAwaitingBoundSourceValue ||
              isExecuting ||
              runtimeStatus === "loading"
            ? "loading"
            : runtimeStatus === "ready"
              ? "ready"
              : "idle";

  const hoverTitle =
    status === "idle"
      ? sourceBinding.isFilterWidgetSource
        ? "Source widget not configured"
        : isManualSource
          ? "Manual table not configured"
          : "Data Node not configured"
      : status === "range"
        ? "Fixed range is incomplete"
        : status === "data_error"
          ? "Dataset request failed"
          : status === "loading"
            ? isManualSource
              ? "Preparing manual dataset"
              : "Refreshing dataset"
            : isManualSource
              ? "Manual dataset ready"
              : "Canonical dataset ready";
  const hoverDescription =
    status === "idle"
      ? sourceBinding.isFilterWidgetSource
        ? "Choose an upstream source widget in settings so this node can transform that dataset."
        : isManualSource
          ? "Add at least one column in settings so this widget can publish a local table."
          : "Choose a data node in settings so this widget can own the shared dataset."
      : status === "range"
        ? "This Data Node needs both saved fixed dates before it can publish rows."
        : status === "data_error"
          ? dataErrorMessage ?? "The canonical dataset request failed."
          : status === "loading"
            ? sourceBinding.isFilterWidgetSource
              ? "Linked widgets keep reading from this bound source while the canonical dataset refreshes."
              : isManualSource
                ? "Linked widgets keep reading from this manual table while the published dataset refreshes."
                : "Linked widgets keep reading from this Data Node while the canonical dataset refreshes."
            : isManualSource
              ? "Linked widgets should read rows from this authored manual table instead of querying directly."
              : "Linked widgets should read rows from this Data Node instead of querying directly.";
  const displayedRows = normalizedRuntimeState?.rows ?? [];
  const displayedColumns = normalizedRuntimeState?.columns ?? [];
  const displayedRangeStartMs =
    normalizedRuntimeState?.rangeStartMs ??
    resolvedRange.rangeStartMs ??
    null;
  const displayedRangeEndMs =
    normalizedRuntimeState?.rangeEndMs ??
    resolvedRange.rangeEndMs ??
    null;
  const publishedRowCount = displayedRows.length;
  const identifierSummary = resolvedConfig.uniqueIdentifierList?.length
    ? `${resolvedConfig.uniqueIdentifierList.length.toLocaleString()} identifiers`
    : isManualSource
      ? "Not applicable"
      : "No identifier selection";
  const datasetSummary =
    status === "loading"
      ? "Loading rows"
      : status === "ready"
        ? `${publishedRowCount.toLocaleString()} rows`
        : status === "data_error"
          ? "Request failed"
          : isManualSource
            ? "Add at least one column"
            : "Waiting for dataset";
  const rangeSummary = isManualSource
    ? "Manual table"
    : formatRangeSummary(displayedRangeStartMs, displayedRangeEndMs);
  const sourceDetailLabel = sourceBinding.isFilterWidgetSource
    ? "Source widget"
    : isManualSource
      ? "Source mode"
      : "Data node";
  const sourceDetailValue = sourceBinding.isFilterWidgetSource
    ? (sourceWidgetLabel ?? "Not selected")
    : isManualSource
      ? "Manual table"
      : (resolvedConfig.dataNodeLabel || (dataNodeId > 0 ? String(dataNodeId) : "Not selected"));
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
  const indicatorToneClass =
    status === "data_error"
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
    `${sourceDetailLabel}: ${sourceDetailValue}`,
    `Range: ${rangeSummary}`,
    `Dataset: ${datasetSummary}`,
    `Transform: ${transformSummary}`,
    isManualSource
      ? `Columns: ${displayedColumns.length.toLocaleString()}`
      : `Columns: ${displayedColumns.length.toLocaleString()} | Limit: ${resolvedConfig.limit.toLocaleString()}`,
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

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-3 opacity-0 transition-all duration-150 group-hover:translate-y-5 group-hover:opacity-100">
        <DataNodeHoverPanel
          title={hoverTitle}
          description={hoverDescription}
          details={[
            {
              label: sourceDetailLabel,
              value: sourceDetailValue,
            },
            {
              label: "Range",
              value: rangeSummary,
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
      </div>
    </div>
  );
}
