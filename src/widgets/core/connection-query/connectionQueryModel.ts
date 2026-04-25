import { queryConnection } from "@/connections/api";
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
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  normalizeTimeSeriesFrameSource,
  type TimeSeriesFrameSourceV1,
} from "@/widgets/shared/timeseries-frame-source";
import type { WidgetContractId } from "@/widgets/types";

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
}

export type ConnectionQueryRuntimeState = TabularFrameSourceV1 | TimeSeriesFrameSourceV1;

export function resolveConnectionQueryRequestedOutputContract(
  queryModel: ConnectionQueryModel | undefined,
): ConnectionResponseContractId | undefined {
  const outputContracts = queryModel?.outputContracts ?? [];

  if (
    queryModel?.defaultOutputContract &&
    outputContracts.includes(queryModel.defaultOutputContract) &&
    isConnectionResponseContractId(queryModel.defaultOutputContract)
  ) {
    return queryModel.defaultOutputContract;
  }

  return outputContracts.find(isConnectionResponseContractId);
}

function resolveConnectionQueryAllowedOutputContracts(
  queryModel: ConnectionQueryModel | undefined,
) {
  return queryModel?.outputContracts ?? [
    CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
    CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  ];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  };
}

function mapFrameFieldType(type: CommandCenterFrameFieldType): TabularFrameFieldType {
  if (type === "time") {
    return "datetime";
  }

  return type;
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

  return {
    status: "ready",
    columns,
    rows,
    fields,
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
  };
}

function frameToTimeSeriesSource(
  frame: CommandCenterFrame,
  input: {
    connectionRef: ConnectionRef;
    queryModelId: string;
    traceId?: string;
    warnings?: string[];
  },
): TimeSeriesFrameSourceV1 | null {
  const normalized = normalizeTimeSeriesFrameSource({
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
        requestedOutputContract: CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
        traceId: input.traceId,
        warnings: input.warnings,
      },
    },
    traceId: input.traceId,
    warnings: input.warnings,
  });

  return normalized;
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
    ? frame.contract === input.requestedOutputContract
    : input.allowedOutputContracts.includes(frame.contract);

  if (!frameAllowed) {
    return null;
  }

  if (frame.contract === CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT) {
    return frameToTimeSeriesSource(frame, input);
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
        ? frame.contract === input.requestedOutputContract
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

  const normalizedTimeSeriesSource =
    (!input.requestedOutputContract ||
      input.requestedOutputContract === CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT) &&
    input.allowedOutputContracts.includes(CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT)
      ? normalizeTimeSeriesFrameSource(payload)
      : null;

  if (normalizedTimeSeriesSource) {
    return {
      ...normalizedTimeSeriesSource,
      source: normalizedTimeSeriesSource.source ?? {
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
    maxRows: normalizedProps.maxRows,
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

  const payload = await queryConnection(request);
  const frame = firstConnectionFramePayload(payload, {
    connectionRef,
    queryModelId,
    requestedOutputContract,
    allowedOutputContracts,
  });

  if (!frame) {
    throw new Error(
      requestedOutputContract
        ? `Connection query did not return a ${requestedOutputContract} frame.`
        : `Connection query did not return an advertised frame contract.`,
    );
  }

  return frame;
}

export function normalizeConnectionQueryRuntimeState(
  value: unknown,
): ConnectionQueryRuntimeState | null {
  return normalizeTimeSeriesFrameSource(value) ?? normalizeTabularFrameSource(value);
}
