import { fetchConnectionResource, queryConnection } from "@/connections/api";
import type { DashboardRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import {
  isConnectionResponseContractId,
  type ConnectionResponseContractId,
} from "@/connections/types";
import type {
  CommandCenterFrame,
  CommandCenterFrameFieldType,
  ConnectionQueryModel,
  ConnectionQueryRequest,
  ConnectionQueryResponse,
  ConnectionRef,
} from "@/connections/types";
import type { WidgetExecutionDashboardState } from "@/widgets/types";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  buildGraphDefaultsFromTimeSeriesMeta,
  inferTabularTimeSeriesMetaFromFields,
  legacyTimeSeriesFrameToTabularFrameSource,
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import type { WidgetContractId } from "@/widgets/types";

import {
  mergeConnectionQueryIncrementalFrame,
  resolveConnectionQueryIncrementalDecision,
  runConnectionQueryWithInFlightDedupe,
  type ConnectionQueryIncrementalDedupePolicy,
  type ConnectionQueryIncrementalRefreshMode,
  type ConnectionQueryIncrementalRefreshSettings,
} from "./incrementalConnectionRefresh";

export type ConnectionQueryTimeRangeMode = "dashboard" | "fixed" | "none";

export interface ConnectionQueryWidgetProps extends Record<string, unknown> {
  connectionRef?: ConnectionRef;
  queryModelId?: string;
  query?: Record<string, unknown>;
  timeRangeMode?: ConnectionQueryTimeRangeMode;
  fixedStartMs?: number;
  fixedEndMs?: number;
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
  incrementalRefreshMode?: ConnectionQueryIncrementalRefreshMode;
  incrementalTimeField?: string;
  incrementalMergeKeyFields?: string[];
  incrementalOverlapMs?: number;
  incrementalRetentionMs?: number;
  incrementalDedupePolicy?: ConnectionQueryIncrementalDedupePolicy;
}

export type ConnectionQueryRawFrameRuntimeState = CommandCenterFrame & {
  status: "ready" | "loading" | "idle" | "error";
  error?: string;
  source?: Record<string, unknown>;
  traceId?: string;
  warnings?: string[];
};

export type ConnectionQueryRuntimeState =
  | TabularFrameSourceV1
  | ConnectionQueryRawFrameRuntimeState;

export function resolveConnectionQueryRequestedOutputContract(
  queryModel: ConnectionQueryModel | undefined,
): ConnectionResponseContractId | undefined {
  const outputContracts = queryModel?.outputContracts ?? [];

  if (
    outputContracts.includes(CORE_TABULAR_FRAME_SOURCE_CONTRACT) ||
    outputContracts.includes(LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT)
  ) {
    return CORE_TABULAR_FRAME_SOURCE_CONTRACT;
  }

  if (
    queryModel?.defaultOutputContract &&
    outputContracts.includes(queryModel.defaultOutputContract) &&
    isConnectionResponseContractId(queryModel.defaultOutputContract)
  ) {
    return queryModel.defaultOutputContract;
  }

  const responseContracts = outputContracts.filter(isConnectionResponseContractId);

  return responseContracts.length === 1 ? responseContracts[0] : undefined;
}

function resolveConnectionQueryAllowedOutputContracts(
  queryModel: ConnectionQueryModel | undefined,
) {
  return queryModel?.outputContracts ?? [
    CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  ];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeConnectionQueryValueForDebug(value: unknown) {
  if (!isPlainRecord(value)) {
    return value === undefined ? { kind: "undefined" } : { kind: typeof value };
  }

  if (typeof value.contract === "string" && Array.isArray(value.fields)) {
    return {
      kind: "frame",
      status: typeof value.status === "string" ? value.status : undefined,
      contract: value.contract,
      fieldCount: value.fields.length,
      fieldNames: value.fields
        .flatMap((field) =>
          isPlainRecord(field) && typeof field.name === "string" ? [field.name] : [],
        )
        .slice(0, 6),
      traceId: typeof value.traceId === "string" ? value.traceId : undefined,
    };
  }

  if (Array.isArray(value.columns) && Array.isArray(value.rows)) {
    return {
      kind: "tabular-frame",
      status: typeof value.status === "string" ? value.status : undefined,
      columnCount: value.columns.length,
      rowCount: value.rows.length,
      fieldCount: Array.isArray(value.fields) ? value.fields.length : 0,
    };
  }

  if (Array.isArray(value.frames)) {
    return {
      kind: "connection-response",
      frameCount: value.frames.length,
      frameContracts: value.frames.flatMap((frame) =>
        isPlainRecord(frame) && typeof frame.contract === "string" ? [frame.contract] : [],
      ),
      traceId: typeof value.traceId === "string" ? value.traceId : undefined,
      warningCount: Array.isArray(value.warnings) ? value.warnings.length : 0,
    };
  }

  return {
    kind: "record",
    status: typeof value.status === "string" ? value.status : undefined,
    keys: Object.keys(value).slice(0, 10),
  };
}

function summarizeConnectionQueryRequestForDebug(
  request: ConnectionQueryRequest<Record<string, unknown>> | null,
) {
  if (!request) {
    return null;
  }

  return {
    connectionUid: request.connectionUid,
    queryKind:
      isPlainRecord(request.query) && typeof request.query.kind === "string"
        ? request.query.kind
        : undefined,
    queryKeys: isPlainRecord(request.query) ? Object.keys(request.query).sort() : [],
    requestedOutputContract: request.requestedOutputContract,
    hasTimeRange: Boolean(request.timeRange),
    timeRange: request.timeRange,
    maxRows: request.maxRows,
    variablesKeys: request.variables ? Object.keys(request.variables).sort() : [],
    cacheMode: request.cacheMode,
    cacheTtlMs: request.cacheTtlMs,
  };
}

function buildConnectionQueryTraceDetails(input: {
  connectionRef: ConnectionRef;
  queryModelId?: string;
  requestedOutputContract?: string;
  incrementalDecision: {
    active: boolean;
    reason?: string;
    request: ConnectionQueryRequest<Record<string, unknown>>;
    fullRequest: ConnectionQueryRequest<Record<string, unknown>>;
    retainedState?: unknown;
  };
}) {
  const request = input.incrementalDecision.request;
  const fullRequest = input.incrementalDecision.fullRequest;

  return {
    kind: "connection-query",
    connectionUid: input.connectionRef.uid,
    connectionTypeId: input.connectionRef.typeId,
    queryModelId: input.queryModelId,
    queryKind:
      isPlainRecord(request.query) && typeof request.query.kind === "string"
        ? request.query.kind
        : undefined,
    requestedOutputContract: input.requestedOutputContract,
    timeRange: request.timeRange,
    retainedTimeRange: fullRequest.timeRange,
    maxRows: request.maxRows,
    cacheMode: request.cacheMode,
    incremental: {
      active: input.incrementalDecision.active,
      reason: input.incrementalDecision.reason,
      hasRetainedState: Boolean(input.incrementalDecision.retainedState),
      requestedDeltaRange:
        input.incrementalDecision.active &&
        request.timeRange &&
        fullRequest.timeRange &&
        (
          request.timeRange.from !== fullRequest.timeRange.from ||
          request.timeRange.to !== fullRequest.timeRange.to
        ),
    },
  } satisfies Record<string, unknown>;
}

function buildConnectionQueryTraceMeta(
  traceMeta: DashboardRequestTraceMeta | undefined,
  details: Record<string, unknown>,
) {
  if (!traceMeta) {
    return undefined;
  }

  return {
    ...traceMeta,
    label: traceMeta.label ?? "Connection query",
    details: {
      ...(traceMeta.details ?? {}),
      ...details,
    },
  } satisfies DashboardRequestTraceMeta;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeNonNegativeInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeConnectionRef(value: unknown): ConnectionRef | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const uid = normalizeString(value.uid);
  const typeId = normalizeString(value.typeId);

  return uid && typeId ? { uid, typeId } : undefined;
}

function normalizeVariables(value: unknown) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([key, entryValue]) => {
    const normalizedKey = key.trim();

    if (!normalizedKey) {
      return [];
    }

    if (
      typeof entryValue === "string" ||
      typeof entryValue === "number" ||
      typeof entryValue === "boolean"
    ) {
      return [[normalizedKey, entryValue] as const];
    }

    return [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value.flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );

  return entries.length > 0 ? entries : undefined;
}

function normalizeIncrementalRefreshMode(value: unknown): ConnectionQueryIncrementalRefreshMode {
  return value === "incremental" ? "incremental" : "full";
}

function normalizeIncrementalDedupePolicy(
  value: unknown,
): ConnectionQueryIncrementalDedupePolicy {
  return value === "first" || value === "error" ? value : "latest";
}

export function resolveConnectionQueryIncrementalSettings(
  props: ConnectionQueryWidgetProps,
): ConnectionQueryIncrementalRefreshSettings {
  const normalizedProps = normalizeConnectionQueryProps(props);

  return {
    mode: normalizeIncrementalRefreshMode(normalizedProps.incrementalRefreshMode),
    timeField: normalizeString(normalizedProps.incrementalTimeField),
    mergeKeyFields: normalizeStringArray(normalizedProps.incrementalMergeKeyFields),
    overlapMs: normalizeNonNegativeInteger(normalizedProps.incrementalOverlapMs) ?? 60_000,
    retentionMs: normalizePositiveInteger(normalizedProps.incrementalRetentionMs),
    dedupePolicy: normalizeIncrementalDedupePolicy(normalizedProps.incrementalDedupePolicy),
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim())));
}

function extractDataNodeDetailColumns(value: unknown) {
  if (!isPlainRecord(value)) {
    return [];
  }

  const sourceConfig = isPlainRecord(value.sourcetableconfiguration)
    ? value.sourcetableconfiguration
    : {};
  const timeIndexName = normalizeString(sourceConfig.time_index_name);
  const indexNames = normalizeStringArray(sourceConfig.index_names) ?? [];
  const metadataColumns = Array.isArray(sourceConfig.columns_metadata)
    ? sourceConfig.columns_metadata.flatMap((column) =>
        isPlainRecord(column) ? [normalizeString(column.column_name)].flatMap((name) => name ? [name] : []) : [],
      )
    : [];
  const dtypeColumns = isPlainRecord(sourceConfig.column_dtypes_map)
    ? Object.keys(sourceConfig.column_dtypes_map)
    : [];

  return uniqueStrings([
    timeIndexName ?? "",
    ...indexNames,
    ...metadataColumns,
    ...dtypeColumns,
  ]);
}

function normalizeTimeRangeMode(value: unknown): ConnectionQueryTimeRangeMode {
  return value === "fixed" || value === "none" ? value : "dashboard";
}

export function normalizeConnectionQueryProps(
  props: ConnectionQueryWidgetProps,
): ConnectionQueryWidgetProps {
  return {
    ...props,
    connectionRef: normalizeConnectionRef(props.connectionRef),
    queryModelId: normalizeString(props.queryModelId),
    query: isPlainRecord(props.query) ? { ...props.query } : {},
    timeRangeMode: normalizeTimeRangeMode(props.timeRangeMode),
    fixedStartMs: normalizeTimestampMs(props.fixedStartMs),
    fixedEndMs: normalizeTimestampMs(props.fixedEndMs),
    variables: normalizeVariables(props.variables),
    maxRows: normalizePositiveInteger(props.maxRows),
    incrementalRefreshMode: normalizeIncrementalRefreshMode(props.incrementalRefreshMode),
    incrementalTimeField: normalizeString(props.incrementalTimeField),
    incrementalMergeKeyFields: normalizeStringArray(props.incrementalMergeKeyFields),
    incrementalOverlapMs: normalizeNonNegativeInteger(props.incrementalOverlapMs),
    incrementalRetentionMs: normalizePositiveInteger(props.incrementalRetentionMs),
    incrementalDedupePolicy: normalizeIncrementalDedupePolicy(props.incrementalDedupePolicy),
  };
}

function mapFrameFieldType(type: CommandCenterFrameFieldType): TabularFrameFieldType {
  if (type === "time") {
    return "datetime";
  }

  return type;
}

function inferTimeSeriesMetaFromFrame(
  frame: Pick<CommandCenterFrame, "fields">,
) {
  return inferTabularTimeSeriesMetaFromFields(
    frame.fields.map((field) => ({
      name: field.name,
      type: field.type,
    })),
  );
}

function frameToTabularSource(
  frame: CommandCenterFrame,
  input: {
    connectionRef: ConnectionRef;
    queryModelId: string;
    traceId?: string;
    warnings?: string[];
  },
): TabularFrameSourceV1 {
  const rowCount = Math.max(0, ...frame.fields.map((field) => field.values.length));
  const columns = frame.fields.map((field) => field.name);
  const rows = Array.from({ length: rowCount }, (_entry, index) =>
    Object.fromEntries(frame.fields.map((field) => [field.name, field.values[index] ?? null])),
  );
  const fields = frame.fields.map<TabularFrameFieldSchema>((field) => ({
    key: field.name,
    label: field.config?.displayName ?? field.name,
    type: mapFrameFieldType(field.type),
    nullable: true,
    provenance: "backend",
    nativeType: field.type,
    reason: "Returned by the selected connection query frame.",
  }));
  const rawMeta = isPlainRecord(frame.meta) ? frame.meta : {};
  const normalizedMeta = normalizeTabularFrameSource({
    status: "ready",
    columns,
    rows: [],
    fields,
    meta: rawMeta,
  })?.meta;
  const inferredTimeSeries = inferTimeSeriesMetaFromFrame(frame);
  const timeSeries = normalizedMeta?.timeSeries ?? inferredTimeSeries ?? undefined;

  return {
    status: "ready",
    columns,
    rows,
    fields,
    meta: timeSeries
      ? {
          ...rawMeta,
          timeSeries,
        }
      : Object.keys(rawMeta).length > 0
        ? rawMeta
        : undefined,
    source: {
      kind: "connection-query",
      id: input.connectionRef.uid,
      label: frame.name || input.queryModelId,
      updatedAtMs: Date.now(),
      context: {
        connectionRef: input.connectionRef,
        queryModelId: input.queryModelId,
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        graphDefaults: buildGraphDefaultsFromTimeSeriesMeta(timeSeries),
        traceId: input.traceId,
        warnings: input.warnings,
      },
    },
  };
}

function isTabularCompatibleFrameContract(contract: string) {
  return (
    contract === CORE_TABULAR_FRAME_SOURCE_CONTRACT ||
    contract === LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT
  );
}

function frameToPublishedSource(
  frame: CommandCenterFrame,
  input: {
    connectionRef: ConnectionRef;
    queryModelId: string;
    requestedOutputContract?: ConnectionResponseContractId;
    allowedOutputContracts: WidgetContractId[];
    traceId?: string;
    warnings?: string[];
  },
) {
  const frameAllowed = input.requestedOutputContract
    ? input.requestedOutputContract === CORE_TABULAR_FRAME_SOURCE_CONTRACT
      ? isTabularCompatibleFrameContract(frame.contract)
      : frame.contract === input.requestedOutputContract
    : isTabularCompatibleFrameContract(frame.contract)
      ? input.allowedOutputContracts.some(isTabularCompatibleFrameContract)
      : input.allowedOutputContracts.includes(frame.contract);

  if (!frameAllowed) {
    return null;
  }

  if (frame.contract === LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT) {
    const inferredMeta = inferTimeSeriesMetaFromFrame(frame);

    return legacyTimeSeriesFrameToTabularFrameSource({
      ...frame,
      status: "ready",
      source: {
        kind: "connection-query",
        id: input.connectionRef.uid,
        label: frame.name || input.queryModelId,
        updatedAtMs: Date.now(),
        context: {
          connectionRef: input.connectionRef,
          queryModelId: input.queryModelId,
          requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
          traceId: input.traceId,
          warnings: input.warnings,
        },
      },
      traceId: input.traceId,
      warnings: input.warnings,
      meta: {
        ...(isPlainRecord(frame.meta) ? frame.meta : {}),
        ...(inferredMeta ? { timeSeries: inferredMeta } : {}),
      },
    });
  }

  if (frame.contract === CORE_TABULAR_FRAME_SOURCE_CONTRACT) {
    return frameToTabularSource(frame, input);
  }

  return null;
}

function firstConnectionFramePayload(
  payload: unknown,
  input: {
    connectionRef: ConnectionRef;
    queryModelId: string;
    requestedOutputContract?: ConnectionResponseContractId;
    allowedOutputContracts: WidgetContractId[];
  },
) {
  if (isPlainRecord(payload) && Array.isArray(payload.frames)) {
    const response = payload as unknown as ConnectionQueryResponse;

    if (response.frames.length === 0) {
      return null;
    }

    const matchingFrames = response.frames.filter((frame) =>
      input.requestedOutputContract
        ? input.requestedOutputContract === CORE_TABULAR_FRAME_SOURCE_CONTRACT
          ? isTabularCompatibleFrameContract(frame.contract)
          : frame.contract === input.requestedOutputContract
        : isTabularCompatibleFrameContract(frame.contract)
          ? input.allowedOutputContracts.some(isTabularCompatibleFrameContract)
          : input.allowedOutputContracts.includes(frame.contract),
    );

    if (matchingFrames.length === 0) {
      return null;
    }

    const frame = matchingFrames[0];

    return frame
      ? frameToPublishedSource(frame, {
          ...input,
          traceId: response.traceId,
          warnings: response.warnings,
        })
      : null;
  }

  const normalizedLegacyTimeSeriesSource =
    (!input.requestedOutputContract ||
      input.requestedOutputContract === CORE_TABULAR_FRAME_SOURCE_CONTRACT) &&
    input.allowedOutputContracts.some(isTabularCompatibleFrameContract)
      ? legacyTimeSeriesFrameToTabularFrameSource(payload)
      : null;

  if (normalizedLegacyTimeSeriesSource) {
    return {
      ...normalizedLegacyTimeSeriesSource,
      source: normalizedLegacyTimeSeriesSource.source ?? {
        kind: "connection-query",
        id: input.connectionRef.uid,
        label: input.queryModelId,
        updatedAtMs: Date.now(),
        context: {
          connectionRef: input.connectionRef,
          queryModelId: input.queryModelId,
        },
      },
    };
  }

  const normalizedSource =
    (!input.requestedOutputContract ||
      input.requestedOutputContract === CORE_TABULAR_FRAME_SOURCE_CONTRACT) &&
    input.allowedOutputContracts.includes(CORE_TABULAR_FRAME_SOURCE_CONTRACT)
      ? normalizeTabularFrameSource(payload)
      : null;

  if (normalizedSource) {
    return {
      ...normalizedSource,
      source: normalizedSource.source ?? {
        kind: "connection-query",
        id: input.connectionRef.uid,
        label: input.queryModelId,
        updatedAtMs: Date.now(),
        context: {
          connectionRef: input.connectionRef,
          queryModelId: input.queryModelId,
        },
      },
    };
  }

  if (!isPlainRecord(payload)) {
    return null;
  }

  return null;
}

function resolveDashboardRange(dashboardState?: WidgetExecutionDashboardState) {
  if (!dashboardState) {
    return null;
  }

  const fromMs = normalizeTimestampMs(dashboardState.rangeStartMs);
  const toMs = normalizeTimestampMs(dashboardState.rangeEndMs);

  return fromMs !== undefined && toMs !== undefined && fromMs < toMs
    ? { fromMs, toMs }
    : null;
}

function resolveFixedRange(props: ConnectionQueryWidgetProps) {
  const fromMs = normalizeTimestampMs(props.fixedStartMs);
  const toMs = normalizeTimestampMs(props.fixedEndMs);

  return fromMs !== undefined && toMs !== undefined && fromMs < toMs
    ? { fromMs, toMs }
    : null;
}

function resolveDefaultRange(dashboardState?: WidgetExecutionDashboardState) {
  const dashboardRange = resolveDashboardRange(dashboardState);

  if (dashboardRange) {
    return dashboardRange;
  }

  const toMs = Date.now();
  const fromMs = toMs - 365 * 24 * 60 * 60 * 1000;

  return { fromMs, toMs };
}

function buildEffectiveRange(
  props: ConnectionQueryWidgetProps,
  dashboardState?: WidgetExecutionDashboardState,
) {
  const mode = normalizeTimeRangeMode(props.timeRangeMode);

  if (mode === "none") {
    return null;
  }

  return mode === "fixed"
    ? (resolveFixedRange(props) ?? resolveDefaultRange(dashboardState))
    : resolveDefaultRange(dashboardState);
}

function buildEffectiveQuery(props: ConnectionQueryWidgetProps) {
  const queryModelId = normalizeString(props.queryModelId);
  const query = isPlainRecord(props.query) ? { ...props.query } : {};

  if (queryModelId) {
    query.kind = queryModelId;
  }

  if (queryModelId === "sql") {
    return {
      ...query,
      kind: queryModelId,
    };
  }

  if (queryModelId === "data-node-rows-between-dates") {
    const normalizedQuery: Record<string, unknown> = {
      kind: queryModelId,
    };
    const dataNodeId = normalizePositiveInteger(query.dataNodeId);
    const columns = normalizeStringArray(query.columns);
    const uniqueIdentifierList = normalizeStringArray(query.unique_identifier_list);
    const limit = normalizePositiveInteger(query.limit);

    if (dataNodeId !== undefined) {
      normalizedQuery.dataNodeId = dataNodeId;
    }

    if (columns) {
      normalizedQuery.columns = columns;
    }

    if (uniqueIdentifierList) {
      normalizedQuery.unique_identifier_list = uniqueIdentifierList;
    }

    if (isPlainRecord(query.unique_identifier_range_map)) {
      normalizedQuery.unique_identifier_range_map = query.unique_identifier_range_map;
    }

    if (typeof query.great_or_equal === "boolean") {
      normalizedQuery.great_or_equal = query.great_or_equal;
    }

    if (typeof query.less_or_equal === "boolean") {
      normalizedQuery.less_or_equal = query.less_or_equal;
    }

    if (limit !== undefined) {
      normalizedQuery.limit = limit;
    }

    return normalizedQuery;
  }

  return query;
}

async function enrichConnectionQueryRequest(
  request: ConnectionQueryRequest<Record<string, unknown>>,
  props: ConnectionQueryWidgetProps,
) {
  const connectionRef = props.connectionRef;
  const query = isPlainRecord(request.query) ? request.query : {};

  if (
    connectionRef?.typeId !== "mainsequence.data-node" ||
    query.kind !== "data-node-rows-between-dates" ||
    normalizeStringArray(query.columns)?.length
  ) {
    return request;
  }

  const dataNodeId = normalizePositiveInteger(query.dataNodeId);

  try {
    if (import.meta.env.DEV) {
      console.debug("[connection-query] enrich request start", {
        request: summarizeConnectionQueryRequestForDebug(request),
        dataNodeId,
      });
    }

    const detail = await fetchConnectionResource({
      connectionUid: request.connectionUid,
      resource: "data-node-detail",
      params: dataNodeId ? { dataNodeId } : {},
    });
    const columns = extractDataNodeDetailColumns(detail);

    if (columns.length === 0) {
      if (import.meta.env.DEV) {
        console.debug("[connection-query] enrich request no columns derived", {
          request: summarizeConnectionQueryRequestForDebug(request),
          detail: summarizeConnectionQueryValueForDebug(detail),
        });
      }
      return request;
    }

    const enrichedRequest = {
      ...request,
      query: {
        ...query,
        columns,
      },
    };

    if (import.meta.env.DEV) {
      console.debug("[connection-query] enrich request applied", {
        before: summarizeConnectionQueryRequestForDebug(request),
        after: summarizeConnectionQueryRequestForDebug(enrichedRequest),
        derivedColumnCount: columns.length,
        derivedColumnsSample: columns.slice(0, 8),
      });
    }

    return enrichedRequest;
  } catch {
    if (import.meta.env.DEV) {
      console.warn("[connection-query] enrich request failed", {
        request: summarizeConnectionQueryRequestForDebug(request),
        dataNodeId,
      });
    }
    return request;
  }
}

export function buildConnectionQueryRequest(
  props: ConnectionQueryWidgetProps,
  dashboardState?: WidgetExecutionDashboardState,
  queryModel?: ConnectionQueryModel,
): ConnectionQueryRequest<Record<string, unknown>> | null {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const connectionRef = normalizedProps.connectionRef;
  const queryModelId = normalizedProps.queryModelId;
  const requestedOutputContract = resolveConnectionQueryRequestedOutputContract(queryModel);

  if (!connectionRef || !queryModelId) {
    return null;
  }

  const timeRangeProps =
    queryModel?.timeRangeAware && normalizedProps.timeRangeMode === "none"
      ? { ...normalizedProps, timeRangeMode: "dashboard" as const }
      : normalizedProps;
  const range = queryModel?.timeRangeAware
    ? buildEffectiveRange(timeRangeProps, dashboardState)
    : null;

  if (queryModel?.timeRangeAware && !range) {
    return null;
  }

  return {
    connectionUid: connectionRef.uid,
    query: buildEffectiveQuery(normalizedProps),
    requestedOutputContract,
    timeRange: range
      ? {
          from: new Date(range.fromMs).toISOString(),
          to: new Date(range.toMs).toISOString(),
        }
      : undefined,
    variables: queryModel?.supportsVariables ? normalizedProps.variables : undefined,
    maxRows: queryModel?.supportsMaxRows === false ? undefined : normalizedProps.maxRows,
  };
}

export function buildConnectionQueryErrorFrame(
  error: string,
  props: ConnectionQueryWidgetProps,
): ConnectionQueryRuntimeState {
  const normalizedProps = normalizeConnectionQueryProps(props);

  return {
    status: "error",
    error,
    columns: [],
    rows: [],
    source: {
      kind: "connection-query",
      id: normalizedProps.connectionRef?.uid,
      label: normalizedProps.queryModelId ?? "Connection query",
      updatedAtMs: Date.now(),
      context: {
        connectionRef: normalizedProps.connectionRef,
        queryModelId: normalizedProps.queryModelId,
      },
    },
  };
}

export async function executeConnectionQueryWidgetRequest(
  props: ConnectionQueryWidgetProps,
  dashboardState?: WidgetExecutionDashboardState,
  queryModel?: ConnectionQueryModel,
  options?: {
    scopeId?: string;
    forceFullRefresh?: boolean;
    traceMeta?: DashboardRequestTraceMeta;
    signal?: AbortSignal;
  },
): Promise<ConnectionQueryRuntimeState> {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const connectionRef = normalizedProps.connectionRef;
  const queryModelId = normalizedProps.queryModelId;
  const requestedOutputContract = resolveConnectionQueryRequestedOutputContract(queryModel);
  const allowedOutputContracts = resolveConnectionQueryAllowedOutputContracts(queryModel);

  if (!connectionRef) {
    throw new Error("Select a connection before running this query.");
  }

  if (!queryModelId) {
    throw new Error("Select a connection path before running this query.");
  }

  const request = buildConnectionQueryRequest(normalizedProps, dashboardState, queryModel);

  if (!request) {
    throw new Error("Connection query request is incomplete.");
  }

  if (import.meta.env.DEV) {
    console.debug("[connection-query] execute start", {
      connectionRef,
      queryModelId,
      requestedOutputContract,
      allowedOutputContracts,
      request: summarizeConnectionQueryRequestForDebug(request),
    });
  }

  const enrichedRequest = await enrichConnectionQueryRequest(request, normalizedProps);
  const incrementalSettings = resolveConnectionQueryIncrementalSettings(normalizedProps);
  const incrementalDecision = options?.forceFullRefresh
    ? {
        active: false,
        request: enrichedRequest,
        fullRequest: enrichedRequest,
        reason: "forced-full-refresh",
      }
    : resolveConnectionQueryIncrementalDecision({
        fullRequest: enrichedRequest,
        settings: incrementalSettings,
        connectionTypeId: connectionRef.typeId,
        queryModelId,
        scopeId: options?.scopeId,
        eligible:
          Boolean(queryModel?.timeRangeAware) &&
          normalizedProps.timeRangeMode === "dashboard" &&
          requestedOutputContract === CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      });
  if (import.meta.env.DEV) {
    console.debug("[connection-query] execute request ready", {
      originalRequest: summarizeConnectionQueryRequestForDebug(request),
      enrichedRequest: summarizeConnectionQueryRequestForDebug(enrichedRequest),
      incrementalRequest: summarizeConnectionQueryRequestForDebug(incrementalDecision.request),
      incrementalMode: incrementalDecision.reason,
    });
  }
  const traceMeta = buildConnectionQueryTraceMeta(
    options?.traceMeta,
    buildConnectionQueryTraceDetails({
      connectionRef,
      queryModelId,
      requestedOutputContract,
      incrementalDecision,
    }),
  );
  const payload = await runConnectionQueryWithInFlightDedupe(
    incrementalDecision,
    () => queryConnection(incrementalDecision.request, traceMeta, {
      signal: options?.signal,
    }),
  );
  if (import.meta.env.DEV) {
    console.debug("[connection-query] execute payload received", {
      request: summarizeConnectionQueryRequestForDebug(incrementalDecision.request),
      payload: summarizeConnectionQueryValueForDebug(payload),
    });
  }
  const frame = firstConnectionFramePayload(payload, {
    connectionRef,
    queryModelId,
    requestedOutputContract,
    allowedOutputContracts,
  });

  if (!frame) {
    if (import.meta.env.DEV) {
      console.error("[connection-query] execute no publishable frame", {
        request: summarizeConnectionQueryRequestForDebug(enrichedRequest),
        payload: summarizeConnectionQueryValueForDebug(payload),
      });
    }
    throw new Error(
      requestedOutputContract === CORE_TABULAR_FRAME_SOURCE_CONTRACT
        ? "Connection query did not return a canonical tabular frame."
        : requestedOutputContract
          ? `Connection query did not return a ${requestedOutputContract} frame.`
          : "Connection query did not return a publishable frame.",
    );
  }

  if (import.meta.env.DEV) {
    console.debug("[connection-query] execute published frame", {
      request: summarizeConnectionQueryRequestForDebug(incrementalDecision.request),
      frame: summarizeConnectionQueryValueForDebug(frame),
    });
  }

  if (frame.status === "ready") {
    return mergeConnectionQueryIncrementalFrame({
      incomingFrame: frame,
      decision: incrementalDecision,
      settings: incrementalSettings,
    }).frame;
  }

  return frame;
}

export function normalizeConnectionQueryRuntimeState(
  value: unknown,
): ConnectionQueryRuntimeState | null {
  const normalizedFrame =
    normalizeTabularFrameSource(value) ?? legacyTimeSeriesFrameToTabularFrameSource(value);

  if (normalizedFrame) {
    return normalizedFrame;
  }

  if (
    isPlainRecord(value) &&
    isConnectionResponseContractId(value.contract) &&
    Array.isArray(value.fields)
  ) {
    return value as unknown as ConnectionQueryRawFrameRuntimeState;
  }

  return null;
}
