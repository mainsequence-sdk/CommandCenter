import {
  fetchConnectionResource,
  queryPublicWidgetExecution,
  queryConnection,
  resolveConnectionRefFromInstances,
} from "@/connections/api";
import type { DashboardRequestTraceMeta } from "@/dashboards/dashboard-request-trace";
import {
  isConnectionResponseContractId,
  type ConnectionId,
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
import type {
  WidgetExecutionDashboardState,
  WidgetExecutionSurface,
  WidgetPublicExecutionContract,
} from "@/widgets/types";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  inferTabularTimeSeriesMetaFromFields,
  legacyTimeSeriesFrameToTabularFrameSource,
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import type { WidgetContractId } from "@/widgets/types";
import {
  storeTabularFrameRuntimeState,
  type RuntimeDataStore,
} from "@/widgets/shared/runtime-data-store";

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
  queryEditorState?: Record<string, unknown>;
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

const DEFAULT_PROMQL_RANGE_STEP_MS = 5 * 60 * 1000;

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

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
    connectionId: request.connectionId,
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
    connectionId: input.connectionRef.id,
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

function normalizeIdentifier(value: unknown): ConnectionId | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = String(value).trim();
  const numericId = Number(normalized);

  if (/^\d+$/.test(normalized) && Number.isSafeInteger(numericId)) {
    return numericId;
  }

  return normalized || undefined;
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

  const id = normalizeIdentifier(value.id) ?? normalizeIdentifier(value.uid);
  const typeId = normalizeString(value.typeId);

  return id && typeId ? { id, typeId } : undefined;
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
    queryEditorState: isPlainRecord(props.queryEditorState)
      ? { ...props.queryEditorState }
      : undefined,
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

function resolveEffectiveConnectionQueryProps(
  props: ConnectionQueryWidgetProps,
  queryModel?: ConnectionQueryModel,
): ConnectionQueryWidgetProps {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const resolvedQueryModelId = normalizeString(queryModel?.id) ?? normalizedProps.queryModelId;
  const existingQuery = isPlainRecord(normalizedProps.query) ? normalizedProps.query : {};
  const queryModelChanged = normalizedProps.queryModelId !== resolvedQueryModelId;
  const queryKindMatches = normalizeString(existingQuery.kind) === resolvedQueryModelId;

  if (!resolvedQueryModelId) {
    return normalizedProps;
  }

  if (!queryModelChanged && queryKindMatches) {
    return normalizedProps;
  }

  return {
    ...normalizedProps,
    queryModelId: resolvedQueryModelId,
    query: queryModelChanged
      ? {
          ...(queryModel?.defaultQuery ?? {}),
          kind: resolvedQueryModelId,
        }
      : {
          ...existingQuery,
          kind: resolvedQueryModelId,
        },
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
    connectionRef?: ConnectionRef;
    sourceId: string;
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
  const meta = normalizedMeta ?? (Object.keys(rawMeta).length > 0 ? rawMeta : undefined);

  return {
    status: "ready",
    columns,
    rows,
    fields,
    meta,
    source: {
      kind: "connection-query",
      id: input.connectionRef?.id ?? input.sourceId,
      label: frame.name || input.queryModelId,
      updatedAtMs: Date.now(),
      context: {
        ...(input.connectionRef ? { connectionRef: input.connectionRef } : {}),
        queryModelId: input.queryModelId,
        requestedOutputContract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
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
    connectionRef?: ConnectionRef;
    sourceId: string;
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
        id: input.connectionRef?.id ?? input.sourceId,
        label: frame.name || input.queryModelId,
        updatedAtMs: Date.now(),
        context: {
          ...(input.connectionRef ? { connectionRef: input.connectionRef } : {}),
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
    connectionRef?: ConnectionRef;
    sourceId: string;
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
        id: input.connectionRef?.id ?? input.sourceId,
        label: input.queryModelId,
        updatedAtMs: Date.now(),
        context: {
          ...(input.connectionRef ? { connectionRef: input.connectionRef } : {}),
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
        id: input.connectionRef?.id ?? input.sourceId,
        label: input.queryModelId,
        updatedAtMs: Date.now(),
        context: {
          ...(input.connectionRef ? { connectionRef: input.connectionRef } : {}),
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

export function normalizeConnectionQueryResponsePayload(
  payload: unknown,
  input: {
    connectionRef?: ConnectionRef;
    sourceId: string;
    queryModelId: string;
    queryModel?: ConnectionQueryModel;
  },
) {
  return firstConnectionFramePayload(payload, {
    connectionRef: input.connectionRef,
    sourceId: input.sourceId,
    queryModelId: input.queryModelId,
    requestedOutputContract: resolveConnectionQueryRequestedOutputContract(input.queryModel),
    allowedOutputContracts: resolveConnectionQueryAllowedOutputContracts(input.queryModel),
  });
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

  if (query.kind === "promql-range" || queryModelId === "promql-range") {
    query.kind = "promql-range";
    query.stepMs = normalizePositiveInteger(query.stepMs) ?? DEFAULT_PROMQL_RANGE_STEP_MS;

    const maxDataPoints = normalizePositiveInteger(query.maxDataPoints);

    if (maxDataPoints !== undefined) {
      query.maxDataPoints = maxDataPoints;
    }
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
    const detail = await fetchConnectionResource({
      connectionId: request.connectionId,
      resource: "data-node-detail",
      params: dataNodeId ? { dataNodeId } : {},
    });
    const columns = extractDataNodeDetailColumns(detail);

    if (columns.length === 0) {
      return request;
    }

    return {
      ...request,
      query: {
        ...query,
        columns,
      },
    };
  } catch {
    return request;
  }
}

export function buildConnectionQueryRequest(
  props: ConnectionQueryWidgetProps,
  dashboardState?: WidgetExecutionDashboardState,
  queryModel?: ConnectionQueryModel,
): ConnectionQueryRequest<Record<string, unknown>> | null {
  const effectiveProps = resolveEffectiveConnectionQueryProps(props, queryModel);
  const connectionRef = effectiveProps.connectionRef;
  const queryModelId = effectiveProps.queryModelId;
  const requestedOutputContract = resolveConnectionQueryRequestedOutputContract(queryModel);

  if (!connectionRef || !queryModelId) {
    return null;
  }

  const timeRangeProps =
    queryModel?.timeRangeAware && effectiveProps.timeRangeMode === "none"
      ? { ...effectiveProps, timeRangeMode: "dashboard" as const }
      : effectiveProps;
  const range = queryModel?.timeRangeAware
    ? buildEffectiveRange(timeRangeProps, dashboardState)
    : null;

  if (queryModel?.timeRangeAware && !range) {
    return null;
  }

  return {
    connectionId: connectionRef.id,
    query: buildEffectiveQuery(effectiveProps),
    requestedOutputContract,
    timeRange: range
      ? {
          from: new Date(range.fromMs).toISOString(),
          to: new Date(range.toMs).toISOString(),
        }
      : undefined,
    variables: queryModel?.supportsVariables ? effectiveProps.variables : undefined,
    maxRows: queryModel?.supportsMaxRows === false ? undefined : effectiveProps.maxRows,
  };
}

function buildPublicConnectionQueryRequestPayload(
  input: {
    props: ConnectionQueryWidgetProps;
    dashboardState?: WidgetExecutionDashboardState;
    queryModel?: ConnectionQueryModel;
    publicExecution?: WidgetPublicExecutionContract;
  },
) {
  const capability = normalizeNonEmptyString(input.publicExecution?.capability);

  if (!capability) {
    throw new Error("Public execution capability is missing for this connection query widget.");
  }

  const effectiveProps = resolveEffectiveConnectionQueryProps(input.props, input.queryModel);
  const allowedInputs =
    isPlainRecord(input.publicExecution?.allowedInputs)
      ? input.publicExecution.allowedInputs
      : null;
  const payload: Record<string, unknown> = {
    capability,
  };

  if (allowedInputs?.timeRange === true) {
    const timeRangeProps =
      effectiveProps.timeRangeMode === "none"
        ? { ...effectiveProps, timeRangeMode: "dashboard" as const }
        : effectiveProps;
    const range = buildEffectiveRange(timeRangeProps, input.dashboardState);

    if (!range) {
      return null;
    }

    payload.timeRange = {
      from: new Date(range.fromMs).toISOString(),
      to: new Date(range.toMs).toISOString(),
    };
  }

  const allowedVariableNames =
    allowedInputs?.variables === true
      ? null
      : Array.isArray(allowedInputs?.variables)
        ? allowedInputs.variables.flatMap((value) =>
            typeof value === "string" && value.trim() ? [value.trim()] : [],
          )
        : [];
  const sourceVariables = effectiveProps.variables;

  if (sourceVariables && (allowedVariableNames === null || allowedVariableNames.length > 0)) {
    const variableEntries = Object.entries(sourceVariables).filter(([key]) =>
      allowedVariableNames === null ? true : allowedVariableNames.includes(key),
    );

    if (variableEntries.length > 0) {
      payload.variables = Object.fromEntries(variableEntries);
    }
  }

  return payload;
}

function buildPublicConnectionQueryClientExecutionKey(input: {
  queryUrl: string;
  request: unknown;
}) {
  return `${input.queryUrl}\u001e${stableJsonStringify(input.request)}`;
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
      id: normalizedProps.connectionRef?.id,
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
    ownerId?: string;
    runtimeDataStore?: RuntimeDataStore | null;
    scopeId?: string;
    executionSurface?: WidgetExecutionSurface;
    publicExecution?: WidgetPublicExecutionContract;
    publicWorkspaceToken?: string;
    forceFullRefresh?: boolean;
    traceMeta?: DashboardRequestTraceMeta;
    signal?: AbortSignal;
  },
): Promise<ConnectionQueryRuntimeState> {
  const effectiveProps = resolveEffectiveConnectionQueryProps(props, queryModel);
  const isPublicExecutionSurface = options?.executionSurface === "public-workspace";
  const publicQueryUrl = normalizeNonEmptyString(options?.publicExecution?.queryUrl);

  if (isPublicExecutionSurface) {
    const queryModelId = effectiveProps.queryModelId;

    if (!queryModelId) {
      throw new Error("Select a connection path before running this query.");
    }

    if (!publicQueryUrl) {
      throw new Error("Public execution URL is missing for this connection query widget.");
    }

    const publicRequest = buildPublicConnectionQueryRequestPayload({
      props: effectiveProps,
      dashboardState,
      queryModel,
      publicExecution: options?.publicExecution,
    });

    if (!publicRequest) {
      throw new Error("Public connection query request is incomplete.");
    }

    const payload = await runConnectionQueryWithInFlightDedupe(
      buildPublicConnectionQueryClientExecutionKey({
        queryUrl: publicQueryUrl,
        request: publicRequest,
      }),
      () =>
        queryPublicWidgetExecution(publicQueryUrl, publicRequest, options?.traceMeta, {
          signal: options?.signal,
        }),
    );
    const frame = firstConnectionFramePayload(payload, {
      connectionRef: effectiveProps.connectionRef,
      sourceId: options?.ownerId ?? `public:${queryModelId}`,
      queryModelId,
      requestedOutputContract: resolveConnectionQueryRequestedOutputContract(queryModel),
      allowedOutputContracts: resolveConnectionQueryAllowedOutputContracts(queryModel),
    });

    if (!frame) {
      throw new Error(
        resolveConnectionQueryRequestedOutputContract(queryModel) ===
          CORE_TABULAR_FRAME_SOURCE_CONTRACT
          ? "Connection query did not return a canonical tabular frame."
          : resolveConnectionQueryRequestedOutputContract(queryModel)
            ? `Connection query did not return a ${resolveConnectionQueryRequestedOutputContract(queryModel)} frame.`
            : "Connection query did not return a publishable frame.",
      );
    }

    return storeTabularFrameRuntimeState({
      frame,
      ownerId: options?.ownerId ?? options?.scopeId ?? "connection-query",
      outputId: "dataset",
      store: options?.runtimeDataStore,
      refKey: `${options?.scopeId ?? options?.ownerId ?? "connection-query"}:dataset`,
      includeRowsInShell: true,
    }) as ConnectionQueryRuntimeState;
  }

  const resolvedConnectionSelection = isPublicExecutionSurface
    ? { connectionRef: effectiveProps.connectionRef }
    : await resolveConnectionRefFromInstances(
        effectiveProps.connectionRef,
        { allowFetch: true },
      );
  const resolvedProps: ConnectionQueryWidgetProps = {
    ...effectiveProps,
    connectionRef: resolvedConnectionSelection.connectionRef ?? effectiveProps.connectionRef,
  };
  const connectionRef = resolvedProps.connectionRef;
  const queryModelId = effectiveProps.queryModelId;
  const requestedOutputContract = resolveConnectionQueryRequestedOutputContract(queryModel);
  const allowedOutputContracts = resolveConnectionQueryAllowedOutputContracts(queryModel);

  if (!connectionRef) {
    throw new Error("Select a connection before running this query.");
  }

  if (!queryModelId) {
    throw new Error("Select a connection path before running this query.");
  }

  const request = buildConnectionQueryRequest(resolvedProps, dashboardState, queryModel);

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

  const enrichedRequest = isPublicExecutionSurface
    ? request
    : await enrichConnectionQueryRequest(request, resolvedProps);
  const incrementalSettings = resolveConnectionQueryIncrementalSettings(resolvedProps);
  const incrementalDecision = resolveConnectionQueryIncrementalDecision({
    fullRequest: enrichedRequest,
    settings: incrementalSettings,
    executionIdentity: isPublicExecutionSurface ? publicQueryUrl : undefined,
    clientExecutionKey:
      isPublicExecutionSurface && publicQueryUrl
        ? buildPublicConnectionQueryClientExecutionKey({
            queryUrl: publicQueryUrl,
            request: enrichedRequest,
          })
        : undefined,
    connectionTypeId: connectionRef.typeId,
    queryModelId,
    scopeId: options?.scopeId,
    eligible:
      Boolean(queryModel?.timeRangeAware) &&
      resolvedProps.timeRangeMode === "dashboard" &&
      requestedOutputContract === CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    forceFullSnapshot: options?.forceFullRefresh,
  });
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
  const frame = firstConnectionFramePayload(payload, {
    connectionRef,
    sourceId: options?.ownerId ?? String(connectionRef.id),
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

  if (frame.status === "ready") {
    const mergedFrame = mergeConnectionQueryIncrementalFrame({
      incomingFrame: frame,
      decision: incrementalDecision,
      settings: incrementalSettings,
    }).frame;

    return storeTabularFrameRuntimeState({
      frame: mergedFrame,
      ownerId: options?.ownerId ?? options?.scopeId ?? "connection-query",
      outputId: "dataset",
      store: options?.runtimeDataStore,
      refKey: incrementalDecision.identityKey
        ? `${options?.ownerId ?? options?.scopeId ?? "connection-query"}:dataset:${incrementalDecision.identityKey}`
        : undefined,
      includeRowsInShell: true,
    });
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
