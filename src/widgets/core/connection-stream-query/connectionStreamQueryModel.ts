import {
  createAuthenticatedConnectionQueryWebSocketSubscription,
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
import type { WidgetExecutionDashboardState } from "@/widgets/types";

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
}

const activeStreamRuntimeSessions = new Set<string>();

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
    return "loading";
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
  });
}

function resolveRetainedFrame(runtimeState: unknown) {
  const normalized = normalizeConnectionStreamQueryRuntimeState(runtimeState);

  return normalized?.status === "ready" ? normalized : null;
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
): ConnectionStreamQueryRequest<Record<string, unknown>> | null {
  if (!isConnectionQueryModelStreamable(queryModel)) {
    return null;
  }

  const normalizedProps = normalizeConnectionStreamQueryProps(props);
  const request = buildConnectionQueryRequest(
    normalizedProps as ConnectionQueryWidgetProps,
    dashboardState,
    queryModel,
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
}) {
  const retainedFrame = resolveRetainedFrame(input.retainedState);

  if (!retainedFrame) {
    return buildEmptyStreamFrame(input);
  }

  return withStreamLifecycle(retainedFrame, {
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
        connectionRef: normalizedProps.connectionRef!,
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
        connectionRef: normalizedProps.connectionRef!,
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
}) {
  const normalizedProps = normalizeConnectionStreamQueryProps(input.props);

  if (!normalizedProps.connectionRef?.id) {
    return "Select a connection before opening a stream.";
  }

  if (!normalizedProps.queryModelId) {
    return "Select a connection path before opening a stream.";
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
  initialRuntimeState?: unknown;
  sourceWidgetId?: string;
  onRuntimeStateChange: (state: ConnectionStreamQueryRuntimeState) => void;
  options?: Omit<ConnectionQueryWebSocketAuthenticationOptions, "queryModel">;
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

  function publish(state: ConnectionStreamQueryRuntimeState) {
    if (!active) {
      return;
    }

    retainedState = state;
    input.onRuntimeStateChange(state);
  }

  publish(
    buildConnectionStreamQueryLifecycleFrame({
      props: input.props,
      status: "connecting",
      retainedState,
      lastMessageAtMs: Date.now(),
      sourceRunId,
    }),
  );

  const handlers: ConnectionQueryWebSocketHandlers = {
    onOpen: () => {
      publish(
        buildConnectionStreamQueryLifecycleFrame({
          props: input.props,
          status: "connecting",
          retainedState,
          lastMessageAtMs: Date.now(),
          sourceRunId,
        }),
      );
    },
    onMessage: (message) => {
      try {
        publish(
          reduceConnectionStreamQueryMessage({
            message,
            props: input.props,
            queryModel: input.queryModel,
            retainedState,
            sourceWidgetId: input.sourceWidgetId,
            sourceRunId,
          }),
        );
      } catch (error) {
        publish(
          buildConnectionStreamQueryLifecycleFrame({
            props: input.props,
            status: "error",
            retainedState: undefined,
            error: error instanceof Error ? error.message : "Connection stream message failed.",
            lastMessageAtMs: Date.now(),
            sourceRunId,
          }),
        );
      }
    },
    onParseError: (error) => {
      publish(
        buildConnectionStreamQueryLifecycleFrame({
          props: input.props,
          status: "error",
          error: error.message,
          lastMessageAtMs: Date.now(),
          sourceRunId,
        }),
      );
    },
    onError: () => {
      publish(
        buildConnectionStreamQueryLifecycleFrame({
          props: input.props,
          status: "error",
          error: "Connection stream WebSocket error.",
          lastMessageAtMs: Date.now(),
          sourceRunId,
        }),
      );
    },
    onClose: (event) => {
      activeStreamRuntimeSessions.delete(subscriptionKey);
      publish(
        buildConnectionStreamQueryLifecycleFrame({
          props: input.props,
          status: "closed",
          retainedState,
          closedAtMs: Date.now(),
          error: event.reason || undefined,
          sourceRunId,
        }),
      );
    },
  };
  let subscription: ConnectionQueryWebSocketSubscription | null = null;

  void createAuthenticatedConnectionQueryWebSocketSubscription(
    input.request,
    handlers,
    {
      ...input.options,
      queryModel: input.queryModel,
    },
  )
    .then((nextSubscription) => {
      if (!active) {
        nextSubscription.close(1000, "connection stream query widget unmounted");
        return;
      }

      subscription = nextSubscription;
    })
    .catch((error) => {
      if (!active) {
        return;
      }

      activeStreamRuntimeSessions.delete(subscriptionKey);
      publish(
        buildConnectionStreamQueryLifecycleFrame({
          props: input.props,
          status: "error",
          retainedState,
          error: error instanceof Error ? error.message : "Connection stream could not start.",
          lastMessageAtMs: Date.now(),
          sourceRunId,
        }),
      );
    });

  return {
    close(code = 1000, reason = "connection stream query widget unmounted") {
      if (!active) {
        return;
      }

      active = false;
      activeStreamRuntimeSessions.delete(subscriptionKey);
      subscription?.close(code, reason);
    },
  };
}

export function buildConnectionStreamQuerySubscriptionKey(input: {
  instanceId?: string;
  request: ConnectionStreamQueryRequest<Record<string, unknown>>;
}) {
  return input.instanceId?.trim()
    ? `connection-stream-query:${input.instanceId.trim()}`
    : `connection-stream-query:${stableJsonStringify(input.request)}`;
}
