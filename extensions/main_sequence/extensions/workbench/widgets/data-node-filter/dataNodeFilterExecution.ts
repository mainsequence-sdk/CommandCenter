import { buildDashboardExecutionRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
  WidgetExecutionContext,
  WidgetExecutionDefinition,
  WidgetExecutionResult,
} from "@/widgets/types";
import { normalizeTabularFrameSource } from "@/widgets/shared/tabular-frame-source";

import {
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeDetail,
  formatMainSequenceError,
} from "../../../../common/api";
import { buildMainSequenceDataSourceDescriptor, resolveMainSequenceDataSourceContext } from "../../widget-contracts/mainSequenceDataSourceBundle";
import type { DataNodeDateRangeMode } from "../data-node-shared/dataNodeShared";
import { resolveDataNodeFieldOptionsFromDataset } from "../data-node-shared/dataNodeShared";
import { normalizeDataNodePublishedDataset } from "../data-node-shared/dataNodePublishedDataset";
import { DATA_NODE_SOURCE_INPUT_ID } from "../data-node-shared/widgetBindings";
import {
  buildManualDataNodeSourceDataset,
  buildDataNodeTransformedDataset,
  normalizeDataNodeFilterProps,
  normalizeDataNodeFilterRuntimeState,
  resolveDataNodeFilterConfig,
  resolveDataNodeFilterDateRange,
  type DataNodeFilterRuntimeState,
  type MainSequenceDataNodeFilterWidgetProps,
} from "./dataNodeFilterModel";

function resolveDataNodeSourceInput(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  const resolvedEntry = resolvedInputs?.[DATA_NODE_SOURCE_INPUT_ID];

  if (!resolvedEntry || Array.isArray(resolvedEntry)) {
    return undefined;
  }

  return resolvedEntry;
}

function buildDataNodeRuntimeState(args: {
  runtimeState: DataNodeFilterRuntimeState | null;
  resolvedConfig: ReturnType<typeof resolveDataNodeFilterConfig>;
  status: DataNodeFilterRuntimeState["status"];
  columns: string[];
  rows: Array<Record<string, unknown>>;
  fields?: DataNodeFilterRuntimeState["fields"];
  rangeStartMs?: number | null;
  rangeEndMs?: number | null;
  updatedAtMs?: number;
  error?: string;
}) {
  return {
    status: args.status,
    dataNodeId: args.resolvedConfig.dataNodeId,
    columns: args.columns,
    rows: args.rows,
    fields: args.fields,
    limit: args.resolvedConfig.limit,
    rangeStartMs: args.rangeStartMs ?? null,
    rangeEndMs: args.rangeEndMs ?? null,
    uniqueIdentifierList: args.resolvedConfig.uniqueIdentifierList,
    updatedAtMs: args.updatedAtMs ?? args.runtimeState?.updatedAtMs,
    error: args.error,
    source: buildMainSequenceDataSourceDescriptor({
      dataNodeId: args.resolvedConfig.dataNodeId,
      dataNodeLabel: args.resolvedConfig.dataNodeLabel,
      dateRangeMode: args.resolvedConfig.dateRangeMode,
      fixedStartMs: args.resolvedConfig.fixedStartMs,
      fixedEndMs: args.resolvedConfig.fixedEndMs,
      uniqueIdentifierList: args.resolvedConfig.uniqueIdentifierList,
      updatedAtMs: args.updatedAtMs ?? args.runtimeState?.updatedAtMs,
      limit: args.resolvedConfig.limit,
    }),
  } satisfies DataNodeFilterRuntimeState;
}

function buildInvalidBoundSourceResult(args: {
  runtimeState: DataNodeFilterRuntimeState | null;
  resolvedConfig: ReturnType<typeof resolveDataNodeFilterConfig>;
  resolvedSourceInput: ResolvedWidgetInput | undefined;
}): WidgetExecutionResult {
  const status = args.resolvedSourceInput?.status;
  const error =
    status === "missing-source"
      ? "The bound source widget is no longer available."
      : status === "missing-output"
        ? "The bound source widget no longer publishes the selected output."
        : status === "contract-mismatch"
          ? "The bound source output is incompatible with this Data Node input."
          : status === "self-reference-blocked"
            ? "A Data Node cannot bind to itself."
            : status === "transform-invalid"
              ? "The bound source output transform is invalid."
              : "The bound source widget did not publish a usable dataset.";

  return {
    status: "error",
    error,
    runtimeStatePatch: buildDataNodeRuntimeState({
      runtimeState: args.runtimeState,
      resolvedConfig: args.resolvedConfig,
      status: "error",
      columns: args.runtimeState?.columns ?? [],
      rows: [],
      fields: args.runtimeState?.fields,
      rangeStartMs: args.runtimeState?.rangeStartMs ?? null,
      rangeEndMs: args.runtimeState?.rangeEndMs ?? null,
      error,
    }),
  };
}

async function executeManualDataNodeSource(args: {
  normalizedProps: MainSequenceDataNodeFilterWidgetProps;
  runtimeState: DataNodeFilterRuntimeState | null;
}): Promise<WidgetExecutionResult> {
  const manualSourceDataset = buildManualDataNodeSourceDataset(args.normalizedProps);
  const resolvedConfig = resolveDataNodeFilterConfig(
    args.normalizedProps,
    undefined,
    manualSourceDataset.fields,
  );

  if (manualSourceDataset.status !== "ready") {
    return {
      status: "success",
      runtimeStatePatch: buildDataNodeRuntimeState({
        runtimeState: args.runtimeState,
        resolvedConfig,
        status: "idle",
        columns: [],
        rows: [],
        fields: manualSourceDataset.fields,
        rangeStartMs: null,
        rangeEndMs: null,
      }),
    };
  }

  const transformedDataset = buildDataNodeTransformedDataset(
    manualSourceDataset.rows,
    resolvedConfig,
    manualSourceDataset.columns,
    manualSourceDataset.fields,
  );

  return {
    status: "success",
    runtimeStatePatch: buildDataNodeRuntimeState({
      runtimeState: args.runtimeState,
      resolvedConfig,
      status: "ready",
      columns: transformedDataset.columns,
      rows: transformedDataset.rows,
      fields: transformedDataset.availableFields,
      rangeStartMs: null,
      rangeEndMs: null,
      updatedAtMs: Date.now(),
    }),
  };
}

async function executeBoundDataNodeSource(args: {
  normalizedProps: MainSequenceDataNodeFilterWidgetProps;
  runtimeState: DataNodeFilterRuntimeState | null;
  resolvedSourceInput: ResolvedWidgetInput;
  dashboardRangeStartMs?: number | null;
  dashboardRangeEndMs?: number | null;
}): Promise<WidgetExecutionResult> {
  const sourceFrame = normalizeTabularFrameSource(args.resolvedSourceInput.value);
  const sourceDataset = normalizeDataNodePublishedDataset(args.resolvedSourceInput.value);

  if (!sourceFrame) {
    const resolvedConfig = resolveDataNodeFilterConfig(args.normalizedProps);
    return buildInvalidBoundSourceResult({
      runtimeState: args.runtimeState,
      resolvedConfig,
      resolvedSourceInput: args.resolvedSourceInput,
    });
  }

  const sourceContext = resolveMainSequenceDataSourceContext(sourceFrame.source);
  const effectiveProps = normalizeDataNodeFilterProps({
    ...args.normalizedProps,
    dataNodeId: sourceContext?.dataNodeId ?? args.normalizedProps.dataNodeId,
    dateRangeMode:
      (sourceContext?.dateRangeMode as DataNodeDateRangeMode | undefined) ??
      args.normalizedProps.dateRangeMode,
    fixedStartMs: sourceContext?.fixedStartMs ?? args.normalizedProps.fixedStartMs,
    fixedEndMs: sourceContext?.fixedEndMs ?? args.normalizedProps.fixedEndMs,
    uniqueIdentifierList:
      sourceContext?.uniqueIdentifierList ?? args.normalizedProps.uniqueIdentifierList,
  });
  const sourceFieldOptions = resolveDataNodeFieldOptionsFromDataset({
    columns: sourceFrame.columns,
    fields: sourceFrame.fields,
    rows: sourceFrame.rows,
  });
  const resolvedConfig = resolveDataNodeFilterConfig(
    effectiveProps,
    undefined,
    sourceFieldOptions.length > 0 ? sourceFieldOptions : undefined,
  );
  const resolvedRange = resolveDataNodeFilterDateRange(
    resolvedConfig,
    args.dashboardRangeStartMs,
    args.dashboardRangeEndMs,
  );

  if (sourceFrame.status === "error") {
    return {
      status: "error",
      error: sourceFrame.error ?? "The bound source widget failed to publish rows.",
      runtimeStatePatch: buildDataNodeRuntimeState({
        runtimeState: args.runtimeState,
        resolvedConfig,
        status: "error",
        columns: args.runtimeState?.columns ?? sourceFrame.columns,
        rows: [],
        fields: args.runtimeState?.fields ?? sourceFieldOptions,
        rangeStartMs: sourceDataset?.rangeStartMs ?? resolvedRange.rangeStartMs ?? null,
        rangeEndMs: sourceDataset?.rangeEndMs ?? resolvedRange.rangeEndMs ?? null,
        updatedAtMs: sourceDataset?.updatedAtMs,
        error: sourceFrame.error ?? "The bound source widget failed to publish rows.",
      }),
    };
  }

  if (sourceFrame.status !== "ready") {
    return {
      status: "success",
      runtimeStatePatch: buildDataNodeRuntimeState({
        runtimeState: args.runtimeState,
        resolvedConfig,
        status: sourceFrame.status === "loading" ? "loading" : "idle",
        columns: args.runtimeState?.columns ?? sourceFrame.columns,
        rows: args.runtimeState?.rows ?? [],
        fields: args.runtimeState?.fields ?? sourceFieldOptions,
        rangeStartMs: sourceDataset?.rangeStartMs ?? resolvedRange.rangeStartMs ?? null,
        rangeEndMs: sourceDataset?.rangeEndMs ?? resolvedRange.rangeEndMs ?? null,
        updatedAtMs: sourceDataset?.updatedAtMs,
      }),
    };
  }

  const transformedDataset = buildDataNodeTransformedDataset(
    sourceFrame.rows,
    resolvedConfig,
    sourceFrame.columns,
    sourceFieldOptions,
  );

  return {
    status: "success",
    runtimeStatePatch: buildDataNodeRuntimeState({
      runtimeState: args.runtimeState,
      resolvedConfig,
      status: "ready",
      columns: transformedDataset.columns,
      rows: transformedDataset.rows,
      fields: transformedDataset.availableFields,
      rangeStartMs: sourceDataset?.rangeStartMs ?? resolvedRange.rangeStartMs ?? null,
      rangeEndMs: sourceDataset?.rangeEndMs ?? resolvedRange.rangeEndMs ?? null,
      updatedAtMs: sourceDataset?.updatedAtMs ?? Date.now(),
    }),
  };
}

async function executeDirectDataNodeSource(args: {
  normalizedProps: MainSequenceDataNodeFilterWidgetProps;
  runtimeState: DataNodeFilterRuntimeState | null;
  dashboardRangeStartMs?: number | null;
  dashboardRangeEndMs?: number | null;
  requestTraceMeta?: ReturnType<typeof buildDashboardExecutionRequestTraceMeta>;
}): Promise<WidgetExecutionResult> {
  const dataNodeId = Number(args.normalizedProps.dataNodeId ?? 0);

  if (!Number.isFinite(dataNodeId) || dataNodeId <= 0) {
    return {
      status: "error",
      error: "Select a valid Data Node before this widget can publish a dataset.",
    };
  }

  let detail: Awaited<ReturnType<typeof fetchDataNodeDetail>>;

  try {
    detail = await fetchDataNodeDetail(dataNodeId, args.requestTraceMeta);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : formatMainSequenceError(error);
    const resolvedConfig = resolveDataNodeFilterConfig(args.normalizedProps);

    return {
      status: "error",
      error: errorMessage,
      runtimeStatePatch: buildDataNodeRuntimeState({
        runtimeState: args.runtimeState,
        resolvedConfig,
        status: "error",
        columns: args.runtimeState?.columns ?? [],
        rows: [],
        fields: args.runtimeState?.fields,
        error: errorMessage,
      }),
    };
  }

  const resolvedConfig = resolveDataNodeFilterConfig(args.normalizedProps, detail);
  const resolvedRange = resolveDataNodeFilterDateRange(
    resolvedConfig,
    args.dashboardRangeStartMs,
    args.dashboardRangeEndMs,
  );

  if (!detail?.sourcetableconfiguration) {
    return {
      status: "error",
      error: "This data node has no source-table metadata.",
      runtimeStatePatch: buildDataNodeRuntimeState({
        runtimeState: args.runtimeState,
        resolvedConfig,
        status: "error",
        columns: args.runtimeState?.columns ?? resolvedConfig.availableFields.map((field) => field.key),
        rows: [],
        fields: args.runtimeState?.fields ?? resolvedConfig.availableFields,
        rangeStartMs: resolvedRange.rangeStartMs ?? null,
        rangeEndMs: resolvedRange.rangeEndMs ?? null,
        error: "This data node has no source-table metadata.",
      }),
    };
  }

  if (!resolvedRange.hasValidRange || resolvedRange.rangeStartMs == null || resolvedRange.rangeEndMs == null) {
    return {
      status: "error",
      error: "The selected date range is incomplete for this Data Node request.",
      runtimeStatePatch: buildDataNodeRuntimeState({
        runtimeState: args.runtimeState,
        resolvedConfig,
        status: "error",
        columns: args.runtimeState?.columns ?? resolvedConfig.availableFields.map((field) => field.key),
        rows: [],
        fields: args.runtimeState?.fields ?? resolvedConfig.availableFields,
        rangeStartMs: resolvedRange.rangeStartMs ?? null,
        rangeEndMs: resolvedRange.rangeEndMs ?? null,
        error: "The selected date range is incomplete for this Data Node request.",
      }),
    };
  }

  const requestedColumns = resolvedConfig.availableFields.map((field) => field.key);

  try {
    const rows = await fetchDataNodeDataBetweenDatesFromRemote(dataNodeId, {
      start_date: Math.floor(resolvedRange.rangeStartMs / 1000),
      end_date: Math.floor(resolvedRange.rangeEndMs / 1000),
      columns: requestedColumns,
      unique_identifier_list: resolvedConfig.uniqueIdentifierList,
      great_or_equal: true,
      less_or_equal: true,
      limit: resolvedConfig.limit,
      offset: 0,
    }, args.requestTraceMeta);
    const transformedDataset = buildDataNodeTransformedDataset(
      rows,
      resolvedConfig,
      requestedColumns,
      resolvedConfig.availableFields,
    );

    return {
      status: "success",
      runtimeStatePatch: buildDataNodeRuntimeState({
        runtimeState: args.runtimeState,
        resolvedConfig,
        status: "ready",
        columns: transformedDataset.columns,
        rows: transformedDataset.rows,
        fields: transformedDataset.availableFields,
        rangeStartMs: resolvedRange.rangeStartMs,
        rangeEndMs: resolvedRange.rangeEndMs,
        updatedAtMs: Date.now(),
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : formatMainSequenceError(error);

    return {
      status: "error",
      error: errorMessage,
      runtimeStatePatch: buildDataNodeRuntimeState({
        runtimeState: args.runtimeState,
        resolvedConfig,
        status: "error",
        columns: args.runtimeState?.columns ?? requestedColumns,
        rows: [],
        fields: args.runtimeState?.fields ?? resolvedConfig.availableFields,
        rangeStartMs: resolvedRange.rangeStartMs,
        rangeEndMs: resolvedRange.rangeEndMs,
        error: errorMessage,
      }),
    };
  }
}

export async function executeDataNodeFilterWidget(
  context: WidgetExecutionContext<MainSequenceDataNodeFilterWidgetProps>,
): Promise<WidgetExecutionResult> {
  const requestTraceMeta = buildDashboardExecutionRequestTraceMeta(context);
  const normalizedProps = normalizeDataNodeFilterProps(
    (context.targetOverrides?.props ?? context.props) as MainSequenceDataNodeFilterWidgetProps,
  );
  const normalizedRuntimeState = normalizeDataNodeFilterRuntimeState(
    context.targetOverrides?.runtimeState ?? context.runtimeState,
  );
  const resolvedSourceInput = resolveDataNodeSourceInput(context.resolvedInputs);
  const dashboardRangeStartMs = context.dashboardState?.rangeStartMs ?? null;
  const dashboardRangeEndMs = context.dashboardState?.rangeEndMs ?? null;

  if (normalizedProps.sourceMode === "manual") {
    return executeManualDataNodeSource({
      normalizedProps,
      runtimeState: normalizedRuntimeState,
    });
  }

  if (resolvedSourceInput?.status === "valid" && resolvedSourceInput.sourceWidgetId) {
    return executeBoundDataNodeSource({
      normalizedProps,
      runtimeState: normalizedRuntimeState,
      resolvedSourceInput,
      dashboardRangeStartMs,
      dashboardRangeEndMs,
    });
  }

  return executeDirectDataNodeSource({
    normalizedProps,
    runtimeState: normalizedRuntimeState,
    dashboardRangeStartMs,
    dashboardRangeEndMs,
    requestTraceMeta,
  });
}

function canExecuteDataNodeFilterWidget(
  context: WidgetExecutionContext<MainSequenceDataNodeFilterWidgetProps>,
) {
  const normalizedProps = normalizeDataNodeFilterProps(
    (context.targetOverrides?.props ?? context.props) as MainSequenceDataNodeFilterWidgetProps,
  );
  const resolvedSourceInput = resolveDataNodeSourceInput(context.resolvedInputs);

  return Boolean(
    normalizedProps.sourceMode === "manual" ||
    (typeof normalizedProps.dataNodeId === "number" && normalizedProps.dataNodeId > 0) ||
    (resolvedSourceInput?.status === "valid" && resolvedSourceInput.sourceWidgetId),
  );
}

export const dataNodeFilterExecutionDefinition: WidgetExecutionDefinition<MainSequenceDataNodeFilterWidgetProps> = {
  canExecute: canExecuteDataNodeFilterWidget,
  execute: executeDataNodeFilterWidget,
  getRefreshPolicy: (context) =>
    canExecuteDataNodeFilterWidget(context) ? "allow-refresh" : "manual-only",
  getExecutionKey: (context) => `main-sequence-data-node:${context.instanceId}`,
};
