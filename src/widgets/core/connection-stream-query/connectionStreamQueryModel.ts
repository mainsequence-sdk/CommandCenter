import {
  createAuthenticatedConnectionQueryWebSocketSubscription,
  createPublicConnectionQueryWebSocketSubscription,
  type ConnectionQueryWebSocketHandlers,
  type ConnectionQueryWebSocketSubscription,
  type ConnectionQueryWebSocketAuthenticationOptions,
} from "@/connections/api";
import {
  assertConnectionQueryModelStreamable,
  isConnectionQueryModelStreamable,
  type ConnectionQueryModel,
  type ConnectionRef,
  type ConnectionStreamQueryRequest,
  type ConnectionStreamServerMessage,
} from "@/connections/types";
import {
  buildConnectionQueryRequest,
  normalizeConnectionQueryProps,
  normalizeConnectionQueryResponsePayload,
  type ConnectionQueryTimeRangeMode,
  type ConnectionQueryWidgetProps,
} from "@/widgets/core/connection-query/connectionQueryModel";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
  attachWidgetRuntimeUpdateContext,
  type WidgetRuntimeUpdateEnvelope,
} from "@/widgets/shared/runtime-update";
import {
  getRuntimeDataRef,
  materializeRuntimeTabularFrame,
  storeTabularFrameRuntimeState,
  type RuntimeDataStore,
} from "@/widgets/shared/runtime-data-store";
import type {
  WidgetExecutionDashboardState,
  WidgetExecutionSurface,
  WidgetPublicExecutionContract,
} from "@/widgets/types";

export type ConnectionStreamLifecycleStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "error"
  | "closed";

export interface ConnectionStreamQueryWidgetProps extends Record<string, unknown> {
  connectionRef?: ConnectionRef;
  queryModelId?: string;
  query?: Record<string, unknown>;
  queryEditorState?: Record<string, unknown>;
  timeRangeMode?: ConnectionQueryTimeRangeMode;
  fixedStartMs?: number;
  fixedEndMs?: number;
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
  mergeKeyFields?: string[];
  retentionMaxRows?: number;
}

export interface ConnectionStreamQueryRuntimeState extends TabularFrameSourceV1 {
  streamStatus: ConnectionStreamLifecycleStatus;
  sourceRunId?: string;
  sequence?: number;
  connectedAtMs?: number;
  lastMessageAtMs?: number;
  lastHeartbeatAtMs?: number;
  closedAtMs?: number;
  emittedAt?: string;
  acceptedAt?: string;
  resumeToken?: string;
  traceId?: string;
  streamErrorCode?: string;
  reconnectAttemptCount?: number;
  nextRetryAtMs?: number;
  lastDisconnectAtMs?: number;
  lastDisconnectReason?: string;
}

export interface ConnectionStreamQueryRuntimeSession {
  close: (code?: number, reason?: string) => void;
}

interface StreamRuntimeContext {
  status: ConnectionStreamLifecycleStatus;
  sourceRunId?: string;
  sequence?: number;
  connectedAtMs?: number;
  lastMessageAtMs?: number;
  lastHeartbeatAtMs?: number;
  closedAtMs?: number;
  emittedAt?: string;
  acceptedAt?: string;
  resumeToken?: string;
  traceId?: string;
  errorCode?: string;
  reconnectAttemptCount?: number;
  nextRetryAtMs?: number;
  lastDisconnectAtMs?: number;
  lastDisconnectReason?: string;
}

const activeStreamRuntimeSessions = new Set<string>();
const STREAM_RECONNECT_INITIAL_DELAY_MS = 1_000;
const STREAM_RECONNECT_MAX_DELAY_MS = 30_000;
const STREAM_RECONNECT_JITTER_RATIO = 0.2;
const STREAM_RECONNECT_MAX_ATTEMPTS = 8;
const STREAM_HEARTBEAT_TIMEOUT_MULTIPLIER = 3;
const STREAM_HEARTBEAT_TIMEOUT_MIN_MS = 5_000;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value.flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );

  return entries.length > 0 ? Array.from(new Set(entries)) : undefined;
}

function normalizeStreamLifecycleStatus(
  value: unknown,
): ConnectionStreamLifecycleStatus | undefined {
  return value === "idle" ||
    value === "connecting" ||
    value === "live" ||
    value === "reconnecting" ||
    value === "error" ||
    value === "closed"
    ? value
    : undefined;
}

function normalizeTimestamp(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : undefined;
}

function lifecycleStatusToFrameStatus(
  status: ConnectionStreamLifecycleStatus,
  hasRetainedFrame: boolean,
): TabularFrameSourceV1["status"] {
  if (status === "error") {
    return "error";
  }

  if (status === "connecting" || status === "reconnecting") {
    return hasRetainedFrame ? "ready" : "loading";
  }

  if (status === "live") {
    return hasRetainedFrame ? "ready" : "loading";
  }

  if (status === "closed") {
    return hasRetainedFrame ? "ready" : "idle";
  }

  return "idle";
}

function buildStreamContext(input: {
  existing?: Record<string, unknown>;
  lifecycle: StreamRuntimeContext;
}) {
  return {
    ...(input.existing ?? {}),
    stream: {
      ...(isPlainRecord(input.existing?.stream) ? input.existing.stream : {}),
      status: input.lifecycle.status,
      sourceRunId: input.lifecycle.sourceRunId,
      sequence: input.lifecycle.sequence,
      connectedAtMs: input.lifecycle.connectedAtMs,
      lastMessageAtMs: input.lifecycle.lastMessageAtMs,
      lastHeartbeatAtMs: input.lifecycle.lastHeartbeatAtMs,
      closedAtMs: input.lifecycle.closedAtMs,
      emittedAt: input.lifecycle.emittedAt,
      acceptedAt: input.lifecycle.acceptedAt,
      resumeToken: input.lifecycle.resumeToken,
      traceId: input.lifecycle.traceId,
      errorCode: input.lifecycle.errorCode,
      reconnectAttemptCount: input.lifecycle.reconnectAttemptCount,
      nextRetryAtMs: input.lifecycle.nextRetryAtMs,
      lastDisconnectAtMs: input.lifecycle.lastDisconnectAtMs,
      lastDisconnectReason: input.lifecycle.lastDisconnectReason,
    },
  };
}

function withStreamLifecycle(
  frame: TabularFrameSourceV1,
  lifecycle: StreamRuntimeContext,
): ConnectionStreamQueryRuntimeState {
  const sourceContext = isPlainRecord(frame.source?.context)
    ? frame.source.context
    : undefined;

  return {
    ...frame,
    status: lifecycleStatusToFrameStatus(lifecycle.status, frame.status === "ready"),
    streamStatus: lifecycle.status,
    sourceRunId: lifecycle.sourceRunId,
    sequence: lifecycle.sequence,
    connectedAtMs: lifecycle.connectedAtMs,
    lastMessageAtMs: lifecycle.lastMessageAtMs,
    lastHeartbeatAtMs: lifecycle.lastHeartbeatAtMs,
    closedAtMs: lifecycle.closedAtMs,
    emittedAt: lifecycle.emittedAt,
    acceptedAt: lifecycle.acceptedAt,
    resumeToken: lifecycle.resumeToken,
    traceId: lifecycle.traceId,
    streamErrorCode: lifecycle.errorCode,
    reconnectAttemptCount: lifecycle.reconnectAttemptCount,
    nextRetryAtMs: lifecycle.nextRetryAtMs,
    lastDisconnectAtMs: lifecycle.lastDisconnectAtMs,
    lastDisconnectReason: lifecycle.lastDisconnectReason,
    source: {
      ...frame.source,
      kind: frame.source?.kind ?? "connection-stream-query",
      updatedAtMs: Date.now(),
      context: buildStreamContext({
        existing: sourceContext,
        lifecycle,
      }),
    },
  };
}

function buildEmptyStreamFrame(input: {
  props: ConnectionStreamQueryWidgetProps;
  status: ConnectionStreamLifecycleStatus;
  error?: string;
  errorCode?: string;
  sequence?: number;
  connectedAtMs?: number;
  lastMessageAtMs?: number;
  lastHeartbeatAtMs?: number;
  closedAtMs?: number;
  emittedAt?: string;
  acceptedAt?: string;
  resumeToken?: string;
  traceId?: string;
  sourceRunId?: string;
  reconnectAttemptCount?: number;
  nextRetryAtMs?: number;
  lastDisconnectAtMs?: number;
  lastDisconnectReason?: string;
}) {
  const normalizedProps = normalizeConnectionStreamQueryProps(input.props);
  const frame: TabularFrameSourceV1 = {
    status: lifecycleStatusToFrameStatus(input.status, false),
    error: input.error,
    columns: [],
    rows: [],
    source: {
      kind: "connection-stream-query",
      id: normalizedProps.connectionRef?.id,
      label: normalizedProps.queryModelId ?? "Connection stream query",
      updatedAtMs: Date.now(),
      context: {
        connectionRef: normalizedProps.connectionRef,
        queryModelId: normalizedProps.queryModelId,
      },
    },
  };

  return withStreamLifecycle(frame, {
    status: input.status,
    sourceRunId: input.sourceRunId,
    sequence: input.sequence,
    connectedAtMs: input.connectedAtMs,
    lastMessageAtMs: input.lastMessageAtMs,
    lastHeartbeatAtMs: input.lastHeartbeatAtMs,
    closedAtMs: input.closedAtMs,
    emittedAt: input.emittedAt,
    acceptedAt: input.acceptedAt,
    resumeToken: input.resumeToken,
    traceId: input.traceId,
    errorCode: input.errorCode,
    reconnectAttemptCount: input.reconnectAttemptCount,
    nextRetryAtMs: input.nextRetryAtMs,
    lastDisconnectAtMs: input.lastDisconnectAtMs,
    lastDisconnectReason: input.lastDisconnectReason,
  });
}

function resolveRetainedFrame(runtimeState: unknown) {
  const normalized = normalizeConnectionStreamQueryRuntimeState(runtimeState);

  if (!normalized || normalized.status === "error") {
    return null;
  }

  return normalized.status === "ready" ||
    normalized.rows.length > 0 ||
    Boolean(getRuntimeDataRef(normalized))
    ? normalized
    : null;
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeMergeKeyValue(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return stableJsonStringify(value);
}

function buildRowMergeKey(row: Record<string, unknown>, mergeKeyFields: string[]) {
  return mergeKeyFields.map((field) => normalizeMergeKeyValue(row[field])).join("\u001f");
}

function resolveStreamMergeKeyFields(input: {
  props: ConnectionStreamQueryWidgetProps;
  queryModel: ConnectionQueryModel;
}) {
  return normalizeStringArray(input.props.mergeKeyFields) ??
    normalizeStringArray(input.queryModel.stream?.defaultMergeKeyFields) ??
    [];
}

function sameStringArray(left: string[] | undefined, right: string[] | undefined) {
  const normalizedLeft = left ?? [];
  const normalizedRight = right ?? [];

  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function sameFieldSchema(
  left: TabularFrameFieldSchema[] | undefined,
  right: TabularFrameFieldSchema[] | undefined,
) {
  if (!left?.length && !right?.length) {
    return true;
  }

  if (!left?.length || !right?.length || left.length !== right.length) {
    return false;
  }

  return left.every((field, index) => {
    const rightField = right[index];
    return Boolean(rightField && field.key === rightField.key && field.type === rightField.type);
  });
}

function assertCompatibleDeltaSchema(
  retainedFrame: TabularFrameSourceV1,
  deltaFrame: TabularFrameSourceV1,
) {
  if (!sameStringArray(retainedFrame.columns, deltaFrame.columns)) {
    throw new Error("Stream delta schema does not match the retained frame columns.");
  }

  if (!sameFieldSchema(retainedFrame.fields, deltaFrame.fields)) {
    throw new Error("Stream delta schema does not match the retained frame fields.");
  }
}

function buildDeltaOnlyFrame(input: {
  deltaFrame: TabularFrameSourceV1;
  rows: Array<Record<string, unknown>>;
}) {
  return {
    ...input.deltaFrame,
    rows: input.rows,
    source: {
      ...input.deltaFrame.source,
      kind: input.deltaFrame.source?.kind ?? "connection-stream-query",
      context: {
        ...(input.deltaFrame.source?.context ?? {}),
        streamDeltaOnly: true,
      },
    },
  } satisfies TabularFrameSourceV1;
}

function mergeDeltaFrame(input: {
  retainedFrame: TabularFrameSourceV1;
  deltaFrame: TabularFrameSourceV1;
  props: ConnectionStreamQueryWidgetProps;
  queryModel: ConnectionQueryModel;
  sourceWidgetId?: string;
  sourceRunId?: string;
  sequence?: number;
  emittedAt?: string;
}) {
  assertCompatibleDeltaSchema(input.retainedFrame, input.deltaFrame);

  const mergeKeyFields = resolveStreamMergeKeyFields({
    props: input.props,
    queryModel: input.queryModel,
  });
  const retentionMaxRows = normalizePositiveInteger(input.props.retentionMaxRows);
  const rowsByKey = new Map<string, Record<string, unknown>>();
  let rowsAppended = 0;
  let rowsReplaced = 0;

  if (mergeKeyFields.length > 0) {
    input.retainedFrame.rows.forEach((row) => {
      rowsByKey.set(buildRowMergeKey(row, mergeKeyFields), row);
    });

    input.deltaFrame.rows.forEach((row) => {
      const mergeKey = buildRowMergeKey(row, mergeKeyFields);
      const existing = rowsByKey.has(mergeKey);

      rowsByKey.set(mergeKey, row);

      if (existing) {
        rowsReplaced += 1;
      } else {
        rowsAppended += 1;
      }
    });
  }

  const mergedRows = mergeKeyFields.length > 0
    ? Array.from(rowsByKey.values())
    : [...input.retainedFrame.rows, ...input.deltaFrame.rows];
  const rowsBeforeRetention = mergedRows.length;
  const rows = retentionMaxRows ? mergedRows.slice(-retentionMaxRows) : mergedRows;
  const rowsPruned = rowsBeforeRetention - rows.length;
  const deltaRows = input.deltaFrame.rows;
  const retainedFrame = {
    ...input.retainedFrame,
    status: "ready",
    columns: input.retainedFrame.columns,
    fields: input.retainedFrame.fields,
    rows,
    meta: input.deltaFrame.meta ?? input.retainedFrame.meta,
    source: {
      ...input.deltaFrame.source,
      kind: input.deltaFrame.source?.kind ?? "connection-stream-query",
      updatedAtMs: Date.now(),
      context: {
        ...(input.deltaFrame.source?.context ?? {}),
        connectionRef: input.props.connectionRef,
        queryModelId: input.props.queryModelId,
      },
    },
  } satisfies TabularFrameSourceV1;
  const deltaOutput = buildDeltaOnlyFrame({
    deltaFrame: input.deltaFrame,
    rows: deltaRows,
  });
  const update = {
    contractVersion: WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
    mode: "delta",
    publicationSemantics: "incremental",
    publicationRole: "update",
    sourceRunId: input.sourceRunId,
    sequence: input.sequence,
    retainedOutputLocation: "carrier",
    sourceWidgetId: input.sourceWidgetId,
    sourceOutputId: "dataset",
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    deltaOutput,
    operations: {
      appended: mergeKeyFields.length > 0 ? rowsAppended : deltaRows.length,
      replaced: rowsReplaced,
      pruned: rowsPruned,
      returned: deltaRows.length,
      retained: rows.length,
    },
    diagnostics: {
      stream: true,
      sequence: input.sequence,
      emittedAt: input.emittedAt,
      mergeKeyFields,
      retentionMaxRows,
    },
  } satisfies WidgetRuntimeUpdateEnvelope<TabularFrameSourceV1, TabularFrameSourceV1>;

  return attachWidgetRuntimeUpdateContext(retainedFrame, update);
}

function accumulateSnapshotFrame(input: {
  retainedFrame: TabularFrameSourceV1;
  snapshotFrame: TabularFrameSourceV1;
  props: ConnectionStreamQueryWidgetProps;
  queryModel: ConnectionQueryModel;
  sourceWidgetId?: string;
  sourceRunId?: string;
  sequence?: number;
  emittedAt?: string;
}) {
  const mergeKeyFields = resolveStreamMergeKeyFields({
    props: input.props,
    queryModel: input.queryModel,
  });

  if (mergeKeyFields.length === 0) {
    return attachSnapshotRuntimeUpdate({
      frame: input.snapshotFrame,
      sourceWidgetId: input.sourceWidgetId,
      sourceRunId: input.sourceRunId,
      publicationRole: "seed",
      sequence: input.sequence,
      emittedAt: input.emittedAt,
      diagnostics: {
        stream: true,
        sourceMessageType: "snapshot",
        mergeKeyFields,
      },
    });
  }

  if (
    !sameStringArray(input.retainedFrame.columns, input.snapshotFrame.columns) ||
    !sameFieldSchema(input.retainedFrame.fields, input.snapshotFrame.fields)
  ) {
    return attachSnapshotRuntimeUpdate({
      frame: input.snapshotFrame,
      sourceWidgetId: input.sourceWidgetId,
      sourceRunId: input.sourceRunId,
      publicationRole: "seed",
      sequence: input.sequence,
      emittedAt: input.emittedAt,
      diagnostics: {
        stream: true,
        sourceMessageType: "snapshot",
        mergeKeyFields,
      },
    });
  }

  const retentionMaxRows = normalizePositiveInteger(input.props.retentionMaxRows);
  const rowsByKey = new Map<string, Record<string, unknown>>();
  let rowsAppended = 0;
  let rowsReplaced = 0;

  input.retainedFrame.rows.forEach((row) => {
    rowsByKey.set(buildRowMergeKey(row, mergeKeyFields), row);
  });

  input.snapshotFrame.rows.forEach((row) => {
    const mergeKey = buildRowMergeKey(row, mergeKeyFields);
    const existing = rowsByKey.has(mergeKey);

    rowsByKey.set(mergeKey, row);

    if (existing) {
      rowsReplaced += 1;
    } else {
      rowsAppended += 1;
    }
  });

  const mergedRows = Array.from(rowsByKey.values());
  const rowsBeforeRetention = mergedRows.length;
  const rows = retentionMaxRows ? mergedRows.slice(-retentionMaxRows) : mergedRows;
  const rowsPruned = rowsBeforeRetention - rows.length;
  const retainedFrame = {
    ...input.retainedFrame,
    status: "ready",
    columns: input.retainedFrame.columns,
    fields: input.retainedFrame.fields,
    rows,
    meta: input.snapshotFrame.meta ?? input.retainedFrame.meta,
    source: {
      ...input.snapshotFrame.source,
      kind: input.snapshotFrame.source?.kind ?? "connection-stream-query",
      updatedAtMs: Date.now(),
      context: {
        ...(input.snapshotFrame.source?.context ?? {}),
        connectionRef: input.props.connectionRef,
        queryModelId: input.props.queryModelId,
      },
    },
  } satisfies TabularFrameSourceV1;
  return attachSnapshotRuntimeUpdate({
    frame: retainedFrame,
    sourceWidgetId: input.sourceWidgetId,
    sourceRunId: input.sourceRunId,
    publicationRole: "seed",
    sequence: input.sequence,
    emittedAt: input.emittedAt,
    operations: {
      appended: rowsAppended,
      replaced: rowsReplaced,
      pruned: rowsPruned,
      returned: input.snapshotFrame.rows.length,
      retained: rows.length,
    },
    diagnostics: {
      stream: true,
      sourceMessageType: "snapshot",
      sequence: input.sequence,
      emittedAt: input.emittedAt,
      mergeKeyFields,
      retentionMaxRows,
    },
  });
}

function attachSnapshotRuntimeUpdate(input: {
  frame: TabularFrameSourceV1;
  sourceWidgetId?: string;
  sourceRunId?: string;
  publicationRole?: "seed" | "update";
  sequence?: number;
  emittedAt?: string;
  diagnostics?: Record<string, unknown>;
  operations?: WidgetRuntimeUpdateEnvelope<TabularFrameSourceV1, TabularFrameSourceV1>["operations"];
}) {
  const update = {
    contractVersion: WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
    mode: "snapshot",
    publicationSemantics: "incremental",
    publicationRole: input.publicationRole ?? "seed",
    sourceRunId: input.sourceRunId,
    sequence: input.sequence,
    retainedOutputLocation: "carrier",
    sourceWidgetId: input.sourceWidgetId,
    sourceOutputId: "dataset",
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    operations: {
      ...(input.operations ?? {}),
      returned: input.frame.rows.length,
      retained: input.frame.rows.length,
    },
    diagnostics: {
      stream: true,
      sequence: input.sequence,
      emittedAt: input.emittedAt,
      ...(input.diagnostics ?? {}),
    },
  } satisfies WidgetRuntimeUpdateEnvelope<TabularFrameSourceV1, TabularFrameSourceV1>;

  return attachWidgetRuntimeUpdateContext(input.frame, update);
}

function normalizeStreamFrameSource(input: {
  frame: TabularFrameSourceV1;
  props: ConnectionStreamQueryWidgetProps;
}) {
  return {
    ...input.frame,
    source: {
      ...input.frame.source,
      kind: "connection-stream-query",
      id: input.props.connectionRef?.id ?? input.frame.source?.id,
      label: input.frame.source?.label ?? input.props.queryModelId,
      updatedAtMs: Date.now(),
      context: {
        ...(input.frame.source?.context ?? {}),
        connectionRef: input.props.connectionRef,
        queryModelId: input.props.queryModelId,
      },
    },
  } satisfies TabularFrameSourceV1;
}

export function normalizeConnectionStreamQueryProps(
  props: ConnectionStreamQueryWidgetProps,
): ConnectionStreamQueryWidgetProps {
  const normalizedQueryProps = normalizeConnectionQueryProps(
    props as ConnectionQueryWidgetProps,
  );

  return {
    connectionRef: normalizedQueryProps.connectionRef,
    queryModelId: normalizedQueryProps.queryModelId,
    query: normalizedQueryProps.query,
    queryEditorState: normalizedQueryProps.queryEditorState,
    timeRangeMode: normalizedQueryProps.timeRangeMode,
    fixedStartMs: normalizedQueryProps.fixedStartMs,
    fixedEndMs: normalizedQueryProps.fixedEndMs,
    variables: normalizedQueryProps.variables,
    maxRows: normalizedQueryProps.maxRows,
    mergeKeyFields: normalizeStringArray(props.mergeKeyFields),
    retentionMaxRows: normalizePositiveInteger(props.retentionMaxRows),
  };
}

export function buildConnectionStreamQueryRequest(
  props: ConnectionStreamQueryWidgetProps,
  dashboardState: WidgetExecutionDashboardState | undefined,
  queryModel: ConnectionQueryModel | undefined,
  executionSurface?: WidgetExecutionSurface,
): ConnectionStreamQueryRequest<Record<string, unknown>> | null {
  const normalizedProps = normalizeConnectionStreamQueryProps(props);
  const effectiveQueryModel =
    executionSurface === "public-workspace"
      ? (queryModel ??
          (normalizedProps.queryModelId
            ? ({
                id: normalizedProps.queryModelId,
                timeRangeAware: true,
                supportsVariables: true,
              } as ConnectionQueryModel)
            : undefined))
      : queryModel;

  if (
    executionSurface !== "public-workspace" &&
    !isConnectionQueryModelStreamable(effectiveQueryModel)
  ) {
    return null;
  }

  const request = buildConnectionQueryRequest(
    (
      executionSurface === "public-workspace" && !normalizedProps.connectionRef?.id
        ? {
            ...normalizedProps,
            connectionRef: {
              id: "public",
              typeId: "public",
            },
          }
        : normalizedProps
    ) as ConnectionQueryWidgetProps,
    dashboardState,
    effectiveQueryModel,
  );

  if (!request) {
    return null;
  }

  return {
    connectionId: request.connectionId,
    query: request.query,
    requestedOutputContract: request.requestedOutputContract,
    timeRange: request.timeRange,
    variables: request.variables,
    maxRows: request.maxRows,
  };
}

export function buildPublicConnectionStreamQueryRequestPayload(
  request: ConnectionStreamQueryRequest<Record<string, unknown>>,
  publicExecution?: WidgetPublicExecutionContract,
) {
  const capability =
    typeof publicExecution?.capability === "string" && publicExecution.capability.trim()
      ? publicExecution.capability.trim()
      : null;

  if (!capability) {
    throw new Error("Public execution capability is missing for this connection stream widget.");
  }

  const allowedInputs =
    isPlainRecord(publicExecution?.allowedInputs)
      ? publicExecution.allowedInputs
      : null;
  const publicRequest: Record<string, unknown> = {};

  if (allowedInputs?.timeRange === true && request.timeRange) {
    publicRequest.timeRange = request.timeRange;
  }

  const allowedVariableNames =
    allowedInputs?.variables === true
      ? null
      : Array.isArray(allowedInputs?.variables)
        ? allowedInputs.variables.flatMap((value) =>
            typeof value === "string" && value.trim() ? [value.trim()] : [],
          )
        : [];

  if (request.variables && (allowedVariableNames === null || allowedVariableNames.length > 0)) {
    const variableEntries = Object.entries(request.variables).filter(([key]) =>
      allowedVariableNames === null ? true : allowedVariableNames.includes(key),
    );

    if (variableEntries.length > 0) {
      publicRequest.variables = Object.fromEntries(variableEntries);
    }
  }

  return {
    capability,
    request: publicRequest,
  };
}

export function normalizeConnectionStreamQueryRuntimeState(
  value: unknown,
): ConnectionStreamQueryRuntimeState | null {
  const frame = normalizeTabularFrameSource(value);

  if (!frame || !isPlainRecord(value)) {
    return frame
      ? withStreamLifecycle(frame, { status: frame.status === "error" ? "error" : "idle" })
      : null;
  }

  const sourceContext = isPlainRecord(frame.source?.context)
    ? frame.source.context
    : undefined;
  const streamContext = isPlainRecord(sourceContext?.stream)
    ? sourceContext.stream
    : undefined;
  const status =
    normalizeStreamLifecycleStatus(value.streamStatus) ??
    normalizeStreamLifecycleStatus(streamContext?.status) ??
    (frame.status === "error" ? "error" : frame.status === "loading" ? "connecting" : "idle");

  return {
    ...frame,
    streamStatus: status,
    sourceRunId:
      normalizeTimestamp((value as { sourceRunId?: unknown }).sourceRunId) ??
      normalizeTimestamp(streamContext?.sourceRunId),
    sequence: normalizeNumber(value.sequence) ?? normalizeNumber(streamContext?.sequence),
    connectedAtMs:
      normalizeNumber(value.connectedAtMs) ?? normalizeNumber(streamContext?.connectedAtMs),
    lastMessageAtMs:
      normalizeNumber(value.lastMessageAtMs) ?? normalizeNumber(streamContext?.lastMessageAtMs),
    lastHeartbeatAtMs:
      normalizeNumber(value.lastHeartbeatAtMs) ?? normalizeNumber(streamContext?.lastHeartbeatAtMs),
    closedAtMs: normalizeNumber(value.closedAtMs) ?? normalizeNumber(streamContext?.closedAtMs),
    emittedAt: normalizeTimestamp(value.emittedAt) ?? normalizeTimestamp(streamContext?.emittedAt),
    acceptedAt: normalizeTimestamp(value.acceptedAt) ?? normalizeTimestamp(streamContext?.acceptedAt),
    resumeToken:
      normalizeTimestamp(value.resumeToken) ?? normalizeTimestamp(streamContext?.resumeToken),
    traceId: normalizeTimestamp(value.traceId) ?? normalizeTimestamp(streamContext?.traceId),
    streamErrorCode:
      normalizeTimestamp(value.streamErrorCode) ?? normalizeTimestamp(streamContext?.errorCode),
    reconnectAttemptCount:
      normalizeNumber((value as { reconnectAttemptCount?: unknown }).reconnectAttemptCount) ??
      normalizeNumber(streamContext?.reconnectAttemptCount),
    nextRetryAtMs:
      normalizeNumber((value as { nextRetryAtMs?: unknown }).nextRetryAtMs) ??
      normalizeNumber(streamContext?.nextRetryAtMs),
    lastDisconnectAtMs:
      normalizeNumber((value as { lastDisconnectAtMs?: unknown }).lastDisconnectAtMs) ??
      normalizeNumber(streamContext?.lastDisconnectAtMs),
    lastDisconnectReason:
      normalizeTimestamp((value as { lastDisconnectReason?: unknown }).lastDisconnectReason) ??
      normalizeTimestamp(streamContext?.lastDisconnectReason),
  };
}

export function buildConnectionStreamQueryLifecycleFrame(input: {
  props: ConnectionStreamQueryWidgetProps;
  status: ConnectionStreamLifecycleStatus;
  retainedState?: unknown;
  error?: string;
  errorCode?: string;
  sequence?: number;
  connectedAtMs?: number;
  lastMessageAtMs?: number;
  lastHeartbeatAtMs?: number;
  closedAtMs?: number;
  emittedAt?: string;
  acceptedAt?: string;
  resumeToken?: string;
  traceId?: string;
  sourceRunId?: string;
  reconnectAttemptCount?: number;
  nextRetryAtMs?: number;
  lastDisconnectAtMs?: number;
  lastDisconnectReason?: string;
}) {
  const retainedFrame = resolveRetainedFrame(input.retainedState);

  if (!retainedFrame) {
    return buildEmptyStreamFrame(input);
  }

  const nextError = input.error !== undefined
    ? input.error
    : input.status === "live" || input.status === "connecting"
      ? undefined
      : retainedFrame.error;
  const nextFrame = nextError === retainedFrame.error
    ? retainedFrame
    : {
        ...retainedFrame,
        error: nextError,
      };

  return withStreamLifecycle(nextFrame, {
    status: input.status,
    sourceRunId: input.sourceRunId ?? retainedFrame.sourceRunId,
    sequence: input.sequence ?? retainedFrame.sequence,
    connectedAtMs: input.connectedAtMs ?? retainedFrame.connectedAtMs,
    lastMessageAtMs: input.lastMessageAtMs ?? retainedFrame.lastMessageAtMs,
    lastHeartbeatAtMs: input.lastHeartbeatAtMs ?? retainedFrame.lastHeartbeatAtMs,
    closedAtMs: input.closedAtMs ?? retainedFrame.closedAtMs,
    emittedAt: input.emittedAt ?? retainedFrame.emittedAt,
    acceptedAt: input.acceptedAt ?? retainedFrame.acceptedAt,
    resumeToken: input.resumeToken ?? retainedFrame.resumeToken,
    traceId: input.traceId ?? retainedFrame.traceId,
    errorCode: input.errorCode ?? retainedFrame.streamErrorCode,
    reconnectAttemptCount:
      input.reconnectAttemptCount ?? retainedFrame.reconnectAttemptCount,
    nextRetryAtMs: input.nextRetryAtMs ?? retainedFrame.nextRetryAtMs,
    lastDisconnectAtMs:
      input.lastDisconnectAtMs ?? retainedFrame.lastDisconnectAtMs,
    lastDisconnectReason:
      input.lastDisconnectReason ?? retainedFrame.lastDisconnectReason,
  });
}

export function reduceConnectionStreamQueryMessage(input: {
  message: ConnectionStreamServerMessage;
  props: ConnectionStreamQueryWidgetProps;
  queryModel: ConnectionQueryModel;
  retainedState?: unknown;
  sourceWidgetId?: string;
  sourceRunId?: string;
  nowMs?: number;
}) {
  assertConnectionQueryModelStreamable(input.queryModel);

  const normalizedProps = normalizeConnectionStreamQueryProps(input.props);
  const retainedFrame = resolveRetainedFrame(input.retainedState);
  const nowMs = input.nowMs ?? Date.now();
  const baseLifecycle = {
    sequence: input.message.sequence,
    lastMessageAtMs: nowMs,
    traceId: "traceId" in input.message ? input.message.traceId : undefined,
  };

  switch (input.message.type) {
    case "ack":
      return buildConnectionStreamQueryLifecycleFrame({
        props: normalizedProps,
        status: "live",
        retainedState: input.retainedState,
        sequence: input.message.sequence,
        connectedAtMs: nowMs,
        lastMessageAtMs: nowMs,
        acceptedAt: input.message.acceptedAt,
        resumeToken: input.message.resumeToken,
        traceId: input.message.traceId,
        sourceRunId: input.sourceRunId,
      });
    case "heartbeat":
      return buildConnectionStreamQueryLifecycleFrame({
        props: normalizedProps,
        status: "live",
        retainedState: input.retainedState,
        sequence: input.message.sequence,
        lastHeartbeatAtMs: nowMs,
        lastMessageAtMs: nowMs,
        emittedAt: input.message.emittedAt,
        traceId: input.message.traceId,
        sourceRunId: input.sourceRunId,
      });
    case "snapshot": {
      const frame = normalizeConnectionQueryResponsePayload(input.message.response, {
        connectionRef: normalizedProps.connectionRef,
        sourceId: input.sourceWidgetId ?? normalizedProps.queryModelId ?? "connection-stream-query",
        queryModelId: normalizedProps.queryModelId!,
        queryModel: input.queryModel,
      });

      if (!frame) {
        throw new Error("Connection stream snapshot did not include a publishable tabular frame.");
      }

      const normalizedFrame = normalizeStreamFrameSource({ frame, props: normalizedProps });
      const nextFrame = retainedFrame
        ? accumulateSnapshotFrame({
            retainedFrame,
            snapshotFrame: normalizedFrame,
            props: normalizedProps,
            queryModel: input.queryModel,
            sourceWidgetId: input.sourceWidgetId,
            sourceRunId: input.sourceRunId,
            sequence: input.message.sequence,
            emittedAt: input.message.emittedAt,
          })
        : attachSnapshotRuntimeUpdate({
            frame: normalizedFrame,
            sourceWidgetId: input.sourceWidgetId,
            sourceRunId: input.sourceRunId,
            publicationRole: "seed",
            sequence: input.message.sequence,
            emittedAt: input.message.emittedAt,
          });

      return withStreamLifecycle(
        nextFrame,
        {
          ...baseLifecycle,
          status: "live",
          emittedAt: input.message.emittedAt,
          resumeToken: input.message.resumeToken,
          traceId: input.message.traceId,
          sourceRunId: input.sourceRunId,
        },
      );
    }
    case "delta": {
      const frame = normalizeConnectionQueryResponsePayload(input.message.response, {
        connectionRef: normalizedProps.connectionRef,
        sourceId: input.sourceWidgetId ?? normalizedProps.queryModelId ?? "connection-stream-query",
        queryModelId: normalizedProps.queryModelId!,
        queryModel: input.queryModel,
      });

      if (!frame) {
        throw new Error("Connection stream delta did not include a publishable tabular frame.");
      }

      const normalizedFrame = normalizeStreamFrameSource({ frame, props: normalizedProps });
      const mergedFrame = retainedFrame
        ? mergeDeltaFrame({
            retainedFrame,
            deltaFrame: normalizedFrame,
            props: normalizedProps,
            queryModel: input.queryModel,
            sourceWidgetId: input.sourceWidgetId,
            sourceRunId: input.sourceRunId,
            sequence: input.message.sequence,
            emittedAt: input.message.emittedAt,
          })
        : attachSnapshotRuntimeUpdate({
            frame: normalizedFrame,
            sourceWidgetId: input.sourceWidgetId,
            sourceRunId: input.sourceRunId,
            publicationRole: "seed",
            sequence: input.message.sequence,
            emittedAt: input.message.emittedAt,
          });

      return withStreamLifecycle(mergedFrame, {
        ...baseLifecycle,
        status: "live",
        emittedAt: input.message.emittedAt,
        resumeToken: input.message.resumeToken,
        traceId: input.message.traceId,
        sourceRunId: input.sourceRunId,
      });
    }
    case "error":
      return buildConnectionStreamQueryLifecycleFrame({
        props: normalizedProps,
        status: input.message.retryable ? "reconnecting" : "error",
        retainedState: input.message.retryable ? input.retainedState : undefined,
        error: input.message.message,
        errorCode: input.message.code,
        sequence: input.message.sequence,
        lastMessageAtMs: nowMs,
        emittedAt: input.message.emittedAt,
        traceId: input.message.traceId,
        sourceRunId: input.sourceRunId,
      });
    case "complete":
      return buildConnectionStreamQueryLifecycleFrame({
        props: normalizedProps,
        status: "closed",
        retainedState: input.retainedState,
        sequence: input.message.sequence,
        lastMessageAtMs: nowMs,
        closedAtMs: nowMs,
        emittedAt: input.message.emittedAt,
        traceId: input.message.traceId,
        sourceRunId: input.sourceRunId,
      });
    default:
      return input.retainedState as ConnectionStreamQueryRuntimeState;
  }
}

export function buildConnectionStreamQueryValidationError(input: {
  props: ConnectionStreamQueryWidgetProps;
  queryModel?: ConnectionQueryModel;
  executionSurface?: WidgetExecutionSurface;
}) {
  const normalizedProps = normalizeConnectionStreamQueryProps(input.props);

  if (
    input.executionSurface !== "public-workspace" &&
    !normalizedProps.connectionRef?.id
  ) {
    return "Select a connection before opening a stream.";
  }

  if (!normalizedProps.queryModelId) {
    return "Select a connection path before opening a stream.";
  }

  if (input.executionSurface === "public-workspace") {
    return null;
  }

  if (!isConnectionQueryModelStreamable(input.queryModel)) {
    return "The selected connection path does not support WebSocket streaming.";
  }

  return null;
}

export function resolveConnectionStreamQueryOutput(runtimeState: unknown) {
  return normalizeConnectionStreamQueryRuntimeState(runtimeState);
}

export function createConnectionStreamQueryWidgetRuntimeSession(input: {
  subscriptionKey: string;
  request: ConnectionStreamQueryRequest<Record<string, unknown>>;
  props: ConnectionStreamQueryWidgetProps;
  queryModel: ConnectionQueryModel;
  executionSurface?: WidgetExecutionSurface;
  publicExecution?: WidgetPublicExecutionContract;
  initialRuntimeState?: unknown;
  sourceWidgetId?: string;
  onRuntimeStateChange: (state: ConnectionStreamQueryRuntimeState) => void;
  options?: Omit<ConnectionQueryWebSocketAuthenticationOptions, "queryModel"> & {
    now?: () => number;
    random?: () => number;
    setTimer?: typeof setTimeout;
    clearTimer?: typeof clearTimeout;
    runtimeDataStore?: RuntimeDataStore | null;
  };
}): ConnectionStreamQueryRuntimeSession {
  const subscriptionKey = input.subscriptionKey.trim();

  if (!subscriptionKey) {
    throw new Error("Connection stream runtime session requires a subscription key.");
  }

  if (activeStreamRuntimeSessions.has(subscriptionKey)) {
    return {
      close() {
        // Another mounted source already owns this subscription.
      },
    };
  }

  activeStreamRuntimeSessions.add(subscriptionKey);

  let active = true;
  let retainedState: unknown = input.initialRuntimeState;
  const sourceRunId = `${subscriptionKey}:${Date.now().toString(36)}`;
  const now = input.options?.now ?? (() => Date.now());
  const random = input.options?.random ?? Math.random;
  const setTimer = input.options?.setTimer ?? globalThis.setTimeout.bind(globalThis);
  const clearTimer = input.options?.clearTimer ?? globalThis.clearTimeout.bind(globalThis);
  const runtimeDataStore = input.options?.runtimeDataStore;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let subscription: ConnectionQueryWebSocketSubscription | null = null;
  let attemptFinished = false;
  let reconnectAttemptCount = 0;
  let nextRetryAtMs: number | undefined;
  let lastDisconnectAtMs: number | undefined;
  let lastDisconnectReason: string | undefined;
  const publicStreamUrl =
    input.executionSurface === "public-workspace" &&
    typeof input.publicExecution?.streamUrl === "string" &&
    input.publicExecution.streamUrl.trim()
      ? input.publicExecution.streamUrl.trim()
      : undefined;

  function publish(state: ConnectionStreamQueryRuntimeState) {
    if (!active) {
      return;
    }

    const storedState = storeTabularFrameRuntimeState({
      frame: state,
      ownerId: input.sourceWidgetId ?? subscriptionKey,
      outputId: "dataset",
      store: runtimeDataStore,
      refKey: `${subscriptionKey}:dataset`,
      includeRowsInShell: true,
    }) as ConnectionStreamQueryRuntimeState;

    retainedState = storedState;
    input.onRuntimeStateChange(storedState);
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimer(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function clearHeartbeatTimer() {
    if (heartbeatTimer) {
      clearTimer(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function publishLifecycleFrame(
    lifecycle: Omit<Parameters<typeof buildConnectionStreamQueryLifecycleFrame>[0], "props">,
  ) {
    publish(
      buildConnectionStreamQueryLifecycleFrame({
        props: input.props,
        ...lifecycle,
      }),
    );
  }

  function decorateRuntimeState(state: ConnectionStreamQueryRuntimeState) {
    return buildConnectionStreamQueryLifecycleFrame({
      props: input.props,
      status: state.streamStatus,
      retainedState: state,
      error: state.error,
      errorCode: state.streamErrorCode,
      sequence: state.sequence,
      connectedAtMs: state.connectedAtMs,
      lastMessageAtMs: state.lastMessageAtMs,
      lastHeartbeatAtMs: state.lastHeartbeatAtMs,
      closedAtMs: state.closedAtMs,
      emittedAt: state.emittedAt,
      acceptedAt: state.acceptedAt,
      resumeToken: state.resumeToken,
      traceId: state.traceId,
      sourceRunId: state.sourceRunId,
      reconnectAttemptCount,
      nextRetryAtMs,
      lastDisconnectAtMs,
      lastDisconnectReason,
    });
  }

  function resolveHeartbeatTimeoutMs() {
    if (!isConnectionQueryModelStreamable(input.queryModel) || !input.queryModel.stream.heartbeatMs) {
      return null;
    }

    return Math.max(
      Math.trunc(input.queryModel.stream.heartbeatMs * STREAM_HEARTBEAT_TIMEOUT_MULTIPLIER),
      STREAM_HEARTBEAT_TIMEOUT_MIN_MS,
    );
  }

  function closeSubscription(code: number, reason: string) {
    const currentSubscription = subscription;
    subscription = null;
    clearHeartbeatTimer();
    currentSubscription?.close(code, reason);
  }

  function armHeartbeatTimeout() {
    clearHeartbeatTimer();
    const timeoutMs = resolveHeartbeatTimeoutMs();

    if (!timeoutMs || !active) {
      return;
    }

    heartbeatTimer = setTimer(() => {
      heartbeatTimer = null;
      handleRecoverableDisconnect({
        reason: "Connection stream heartbeat timed out.",
        errorCode: "heartbeat_timeout",
        closeCode: 4001,
        closeReason: "heartbeat timeout",
      });
    }, timeoutMs);
  }

  function buildReconnectDelayMs(attempt: number) {
    const baseDelay = Math.min(
      STREAM_RECONNECT_INITIAL_DELAY_MS * 2 ** Math.max(attempt - 1, 0),
      STREAM_RECONNECT_MAX_DELAY_MS,
    );
    const jitterScale =
      1 + ((random() * 2) - 1) * STREAM_RECONNECT_JITTER_RATIO;

    return Math.max(
      STREAM_RECONNECT_INITIAL_DELAY_MS,
      Math.min(
        STREAM_RECONNECT_MAX_DELAY_MS,
        Math.round(baseDelay * jitterScale),
      ),
    );
  }

  function markHealthy() {
    reconnectAttemptCount = 0;
    nextRetryAtMs = undefined;
  }

  function buildReconnectRequest() {
    const normalizedRuntimeState =
      normalizeConnectionStreamQueryRuntimeState(
        materializeRuntimeTabularFrame(retainedState, runtimeDataStore) ?? retainedState,
      );

    if (input.queryModel.stream?.supportsResume && normalizedRuntimeState?.resumeToken) {
      return {
        ...input.request,
        resumeToken: normalizedRuntimeState.resumeToken,
      } satisfies ConnectionStreamQueryRequest<Record<string, unknown>>;
    }

    return input.request;
  }

  function scheduleReconnect(reason: string, errorCode?: string) {
    if (!active) {
      return;
    }

    clearReconnectTimer();
    clearHeartbeatTimer();

    if (reconnectAttemptCount >= STREAM_RECONNECT_MAX_ATTEMPTS) {
      nextRetryAtMs = undefined;
      publishLifecycleFrame({
        status: "error",
        retainedState,
        error: reason,
        errorCode: errorCode ?? "reconnect_exhausted",
        lastMessageAtMs: now(),
        sourceRunId,
        reconnectAttemptCount,
        lastDisconnectAtMs,
        lastDisconnectReason,
      });
      return;
    }

    reconnectAttemptCount += 1;
    const delayMs = buildReconnectDelayMs(reconnectAttemptCount);
    nextRetryAtMs = now() + delayMs;

    publishLifecycleFrame({
      status: "reconnecting",
      retainedState,
      error: reason,
      errorCode,
      lastMessageAtMs: now(),
      sourceRunId,
      reconnectAttemptCount,
      nextRetryAtMs,
      lastDisconnectAtMs,
      lastDisconnectReason,
    });

    reconnectTimer = setTimer(() => {
      reconnectTimer = null;
      nextRetryAtMs = undefined;
      startSubscription(buildReconnectRequest(), true);
    }, delayMs);
  }

  function handleRecoverableDisconnect(inputDisconnect: {
    reason: string;
    errorCode?: string;
    closeCode?: number;
    closeReason?: string;
  }) {
    if (!active || attemptFinished) {
      return;
    }

    attemptFinished = true;
    lastDisconnectAtMs = now();
    lastDisconnectReason = inputDisconnect.reason;

    closeSubscription(
      inputDisconnect.closeCode ?? 1000,
      inputDisconnect.closeReason ?? "connection stream reconnecting",
    );
    scheduleReconnect(inputDisconnect.reason, inputDisconnect.errorCode);
  }

  function startSubscription(
    request: ConnectionStreamQueryRequest<Record<string, unknown>>,
    isReconnect: boolean,
  ) {
    if (!active) {
      return;
    }

    attemptFinished = false;
    publishLifecycleFrame({
      status: isReconnect ? "reconnecting" : "connecting",
      retainedState,
      error: isReconnect ? lastDisconnectReason : undefined,
      lastMessageAtMs: now(),
      sourceRunId,
      reconnectAttemptCount,
      nextRetryAtMs,
      lastDisconnectAtMs,
      lastDisconnectReason,
    });

    const handlers: ConnectionQueryWebSocketHandlers = {
      onOpen: () => {
        publishLifecycleFrame({
          status: isReconnect ? "reconnecting" : "connecting",
          retainedState,
          error: isReconnect ? lastDisconnectReason : undefined,
          lastMessageAtMs: now(),
          sourceRunId,
          reconnectAttemptCount,
          nextRetryAtMs,
          lastDisconnectAtMs,
          lastDisconnectReason,
        });
        armHeartbeatTimeout();
      },
      onMessage: (message) => {
        try {
          const nextState = reduceConnectionStreamQueryMessage({
            message,
            props: input.props,
            queryModel: input.queryModel,
            retainedState:
              materializeRuntimeTabularFrame(retainedState, runtimeDataStore) ?? retainedState,
            sourceWidgetId: input.sourceWidgetId,
            sourceRunId,
          });

          if (
            message.type === "ack" ||
            message.type === "heartbeat" ||
            message.type === "snapshot" ||
            message.type === "delta"
          ) {
            markHealthy();
            armHeartbeatTimeout();
          }

          publish(decorateRuntimeState(nextState));

          if (message.type === "error" && message.retryable) {
            handleRecoverableDisconnect({
              reason: message.message,
              errorCode: message.code,
              closeCode: 1012,
              closeReason: "retryable stream error",
            });
            return;
          }

          if (message.type === "complete") {
            attemptFinished = true;
            clearHeartbeatTimer();
            closeSubscription(1000, "stream complete");
          }
        } catch (error) {
          attemptFinished = true;
          clearHeartbeatTimer();
          publishLifecycleFrame({
            status: "error",
            retainedState: undefined,
            error: error instanceof Error ? error.message : "Connection stream message failed.",
            lastMessageAtMs: now(),
            sourceRunId,
            reconnectAttemptCount,
            lastDisconnectAtMs,
            lastDisconnectReason,
          });
        }
      },
      onParseError: (error) => {
        attemptFinished = true;
        clearHeartbeatTimer();
        publishLifecycleFrame({
          status: "error",
          error: error.message,
          lastMessageAtMs: now(),
          sourceRunId,
          reconnectAttemptCount,
          lastDisconnectAtMs,
          lastDisconnectReason,
        });
      },
      onError: () => {
        handleRecoverableDisconnect({
          reason: "Connection stream WebSocket error.",
          errorCode: "socket_error",
        });
      },
      onClose: (event) => {
        if (!active || attemptFinished) {
          return;
        }

        lastDisconnectAtMs = now();
        lastDisconnectReason = event.reason?.trim() || `Connection stream socket closed (${event.code}).`;

        if (event.code === 1000) {
          attemptFinished = true;
          subscription = null;
          clearHeartbeatTimer();
          publishLifecycleFrame({
            status: "closed",
            retainedState,
            closedAtMs: now(),
            error: event.reason || undefined,
            sourceRunId,
            reconnectAttemptCount,
            lastDisconnectAtMs,
            lastDisconnectReason,
          });
          return;
        }

        handleRecoverableDisconnect({
          reason: lastDisconnectReason,
          errorCode: `close_${event.code}`,
        });
      },
    };

    const subscriptionPromise =
      input.executionSurface === "public-workspace"
        ? publicStreamUrl
          ? (() => {
              const publicRequest = buildPublicConnectionStreamQueryRequestPayload(
                request,
                input.publicExecution,
              );

              return createPublicConnectionQueryWebSocketSubscription(
                publicRequest.request,
                handlers,
                {
                  ...input.options,
                  capability: publicRequest.capability,
                  queryModel: input.queryModel,
                  streamUrl: publicStreamUrl,
                  subscriptionId: input.subscriptionKey,
                  widgetInstanceId: input.sourceWidgetId ?? input.subscriptionKey,
                },
              );
            })()
          : Promise.reject(
              new Error("Public stream execution URL is missing for this widget."),
            )
        : createAuthenticatedConnectionQueryWebSocketSubscription(
            request,
            handlers,
            {
              ...input.options,
              queryModel: input.queryModel,
            },
          );

    void Promise.resolve(subscriptionPromise)
      .then((nextSubscription: ConnectionQueryWebSocketSubscription) => {
        if (!active) {
          nextSubscription.close(1000, "connection stream query widget unmounted");
          return;
        }

        subscription = nextSubscription;
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        lastDisconnectAtMs = now();
        lastDisconnectReason =
          error instanceof Error ? error.message : "Connection stream could not start.";
        scheduleReconnect(lastDisconnectReason, "subscription_start_failed");
      });
  }

  startSubscription(input.request, false);

  return {
    close(code = 1000, reason = "connection stream query widget unmounted") {
      if (!active) {
        return;
      }

      active = false;
      attemptFinished = true;
      clearReconnectTimer();
      clearHeartbeatTimer();
      activeStreamRuntimeSessions.delete(subscriptionKey);
      closeSubscription(code, reason);
    },
  };
}

export function buildConnectionStreamQuerySubscriptionKey(input: {
  instanceId?: string;
  request: ConnectionStreamQueryRequest<Record<string, unknown>>;
  publicExecutionKey?: string;
}) {
  return input.instanceId?.trim()
    ? `connection-stream-query:${input.instanceId.trim()}`
    : input.publicExecutionKey?.trim()
      ? `connection-stream-query:${input.publicExecutionKey.trim()}`
      : `connection-stream-query:${stableJsonStringify(input.request)}`;
}
