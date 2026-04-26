import type { ConnectionQueryRequest } from "@/connections/types";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  type TabularFrameFieldSchema,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
  attachWidgetRuntimeUpdateContext,
  type WidgetRuntimeUpdateEnvelope,
} from "@/widgets/shared/runtime-update";

export type ConnectionQueryIncrementalRefreshMode = "full" | "incremental";
export type ConnectionQueryIncrementalDedupePolicy = "latest" | "first" | "error";

export interface ConnectionQueryIncrementalRefreshSettings {
  mode: ConnectionQueryIncrementalRefreshMode;
  timeField?: string;
  mergeKeyFields?: string[];
  overlapMs: number;
  retentionMs?: number;
  dedupePolicy: ConnectionQueryIncrementalDedupePolicy;
}

export interface ConnectionQueryRuntimeDeltaSummary
  extends WidgetRuntimeUpdateEnvelope<TabularFrameSourceV1, TabularFrameSourceV1> {
  enabled: boolean;
  reason?: string;
  identityKey?: string;
  timeField?: string;
  mergeKeyFields?: string[];
  dedupePolicy?: ConnectionQueryIncrementalDedupePolicy;
  rowsReturned?: number;
  rowsRetained?: number;
  rowsAppended?: number;
  rowsReplaced?: number;
  rowsPruned?: number;
}

export interface RetainedConnectionQueryState {
  identityKey: string;
  retainedFrame: TabularFrameSourceV1;
  lastWatermarkMs: number;
  lastRequestRange: { fromMs: number; toMs: number };
  updatedAtMs: number;
}

export interface ConnectionQueryIncrementalDecision {
  active: boolean;
  identityKey?: string;
  sourceWidgetId?: string;
  request: ConnectionQueryRequest<Record<string, unknown>>;
  fullRequest: ConnectionQueryRequest<Record<string, unknown>>;
  retainedState?: RetainedConnectionQueryState;
  reason?: string;
}

export interface ConnectionQueryMergeResult {
  frame: TabularFrameSourceV1;
  delta: ConnectionQueryRuntimeDeltaSummary;
  watermarkMs: number;
}

const retainedConnectionQueryStore = new Map<string, RetainedConnectionQueryState>();
const inFlightConnectionQueryRequests = new Map<string, Promise<unknown>>();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function parseRange(
  range: ConnectionQueryRequest<Record<string, unknown>>["timeRange"],
) {
  if (!range) {
    return null;
  }

  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);

  return Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs < toMs
    ? { fromMs, toMs }
    : null;
}

function normalizeTimestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
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

function collectColumns(...frames: TabularFrameSourceV1[]) {
  const columns = new Set<string>();

  frames.forEach((frame) => {
    frame.columns.forEach((column) => {
      if (column.trim()) {
        columns.add(column);
      }
    });
    frame.rows.forEach((row) => {
      Object.keys(row).forEach((column) => {
        if (column.trim()) {
          columns.add(column);
        }
      });
    });
  });

  return Array.from(columns);
}

function collectFields(...frames: TabularFrameSourceV1[]) {
  const fields = new Map<string, TabularFrameFieldSchema>();

  frames.forEach((frame) => {
    frame.fields?.forEach((field) => {
      if (!fields.has(field.key)) {
        fields.set(field.key, field);
      }
    });
  });

  return fields.size > 0 ? Array.from(fields.values()) : undefined;
}

function buildDeltaFrame(input: {
  sourceFrame: TabularFrameSourceV1;
  rows: Array<Record<string, unknown>>;
  columns: string[];
  fields?: TabularFrameFieldSchema[];
}) {
  return {
    ...input.sourceFrame,
    rows: input.rows,
    columns: input.columns,
    fields: input.fields,
    source: {
      ...input.sourceFrame.source,
      kind: input.sourceFrame.source?.kind ?? "connection-query",
      context: {
        ...(input.sourceFrame.source?.context ?? {}),
        incrementalDeltaOnly: true,
      },
    },
  } satisfies TabularFrameSourceV1;
}

function withIncrementalContext(
  frame: TabularFrameSourceV1,
  delta: ConnectionQueryRuntimeDeltaSummary,
) {
  return attachWidgetRuntimeUpdateContext({
    ...frame,
    source: {
      ...frame.source,
      kind: frame.source?.kind ?? "connection-query",
      updatedAtMs: Date.now(),
      context: {
        ...(frame.source?.context ?? {}),
      },
    },
  } satisfies TabularFrameSourceV1, delta);
}

function getFrameWatermark(frame: TabularFrameSourceV1, timeField: string, fallbackMs: number) {
  const watermarkMs = frame.rows.reduce<number | undefined>((current, row) => {
    const rowTimeMs = normalizeTimestampMs(row[timeField]);

    if (rowTimeMs === undefined) {
      return current;
    }

    return current === undefined ? rowTimeMs : Math.max(current, rowTimeMs);
  }, undefined);

  return watermarkMs ?? fallbackMs;
}

function assertMergeableFrame(frame: TabularFrameSourceV1, settings: ConnectionQueryIncrementalRefreshSettings) {
  if (!settings.timeField) {
    throw new Error("Incremental refresh needs a time field.");
  }

  if (!settings.mergeKeyFields?.length) {
    throw new Error("Incremental refresh needs at least one merge-key column.");
  }

  if (frame.rows.length === 0) {
    return;
  }

  const invalidTimeRow = frame.rows.find(
    (row) => normalizeTimestampMs(row[settings.timeField!]) === undefined,
  );

  if (invalidTimeRow) {
    throw new Error(
      `Incremental refresh time field "${settings.timeField}" is missing or not parseable on at least one row.`,
    );
  }
}

export function buildConnectionQueryIncrementalIdentity(input: {
  scopeId?: string;
  connectionTypeId?: string;
  queryModelId?: string;
  request: ConnectionQueryRequest<Record<string, unknown>>;
  settings: ConnectionQueryIncrementalRefreshSettings;
  rangeDurationMs?: number;
}) {
  return stableJsonStringify({
    scopeId: input.scopeId,
    connectionUid: input.request.connectionUid,
    connectionTypeId: input.connectionTypeId,
    queryModelId: input.queryModelId,
    requestedOutputContract: input.request.requestedOutputContract,
    query: input.request.query,
    variables: input.request.variables,
    maxRows: input.request.maxRows,
    rangeDurationMs: input.rangeDurationMs,
    incrementalTimeField: input.settings.timeField,
    incrementalMergeKeyFields: input.settings.mergeKeyFields,
    incrementalRetentionMs: input.settings.retentionMs,
    incrementalDedupePolicy: input.settings.dedupePolicy,
  });
}

export function resolveConnectionQueryIncrementalDecision(input: {
  fullRequest: ConnectionQueryRequest<Record<string, unknown>>;
  settings: ConnectionQueryIncrementalRefreshSettings;
  connectionTypeId?: string;
  queryModelId?: string;
  scopeId?: string;
  eligible: boolean;
}) {
  const fullRange = parseRange(input.fullRequest.timeRange);
  const inactiveDecision = (reason: string): ConnectionQueryIncrementalDecision => ({
    active: false,
    request: input.fullRequest,
    fullRequest: input.fullRequest,
    reason,
  });

  if (input.settings.mode !== "incremental") {
    return inactiveDecision("mode-full");
  }

  if (!input.eligible) {
    return inactiveDecision("not-eligible");
  }

  if (!fullRange) {
    return inactiveDecision("missing-range");
  }

  if (!input.settings.timeField || !input.settings.mergeKeyFields?.length) {
    return inactiveDecision("missing-merge-settings");
  }

  const retentionMs = input.settings.retentionMs ?? fullRange.toMs - fullRange.fromMs;
  const identityKey = buildConnectionQueryIncrementalIdentity({
    scopeId: input.scopeId,
    connectionTypeId: input.connectionTypeId,
    queryModelId: input.queryModelId,
    request: input.fullRequest,
    settings: {
      ...input.settings,
      retentionMs,
    },
    rangeDurationMs: fullRange.toMs - fullRange.fromMs,
  });
  const retainedState = retainedConnectionQueryStore.get(identityKey);

  if (!retainedState) {
    return {
      active: true,
      identityKey,
      sourceWidgetId: input.scopeId,
      request: input.fullRequest,
      fullRequest: input.fullRequest,
      reason: "initial-snapshot",
    };
  }

  const tailFromMs = Math.max(
    fullRange.fromMs,
    retainedState.lastWatermarkMs - Math.max(0, input.settings.overlapMs),
  );
  const boundedFromMs = Math.min(tailFromMs, fullRange.toMs - 1);

  return {
    active: true,
    identityKey,
    sourceWidgetId: input.scopeId,
    retainedState,
    fullRequest: input.fullRequest,
    request: {
      ...input.fullRequest,
      timeRange: {
        from: new Date(boundedFromMs).toISOString(),
        to: new Date(fullRange.toMs).toISOString(),
      },
    },
    reason: "delta",
  };
}

export async function runConnectionQueryWithInFlightDedupe<TPayload>(
  decision: ConnectionQueryIncrementalDecision,
  run: () => Promise<TPayload>,
): Promise<TPayload> {
  if (!decision.active || !decision.identityKey) {
    return run();
  }

  const requestKey = `${decision.identityKey}\u001e${stableJsonStringify(decision.request)}`;
  const existingRequest = inFlightConnectionQueryRequests.get(requestKey);

  if (existingRequest) {
    return existingRequest as Promise<TPayload>;
  }

  const promise = run().finally(() => {
    if (inFlightConnectionQueryRequests.get(requestKey) === promise) {
      inFlightConnectionQueryRequests.delete(requestKey);
    }
  });

  inFlightConnectionQueryRequests.set(requestKey, promise);

  return promise;
}

export function mergeConnectionQueryIncrementalFrame(input: {
  incomingFrame: TabularFrameSourceV1;
  decision: ConnectionQueryIncrementalDecision;
  settings: ConnectionQueryIncrementalRefreshSettings;
}): ConnectionQueryMergeResult {
  const requestRange = parseRange(input.decision.request.timeRange);
  const fullRange = parseRange(input.decision.fullRequest.timeRange);

  if (!input.decision.active || !input.decision.identityKey || !requestRange || !fullRange) {
    const watermarkMs = input.settings.timeField
      ? getFrameWatermark(input.incomingFrame, input.settings.timeField, requestRange?.toMs ?? Date.now())
      : Date.now();
    const delta: ConnectionQueryRuntimeDeltaSummary = {
      contractVersion: WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
      mode: "snapshot",
      retainedOutputLocation: "carrier",
      sourceOutputId: "dataset",
      sourceWidgetId: input.decision.sourceWidgetId,
      outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      enabled: false,
      reason: input.decision.reason,
      rowsReturned: input.incomingFrame.rows.length,
      rowsRetained: input.incomingFrame.rows.length,
      watermarkAfterMs: watermarkMs,
      range: input.decision.request.timeRange,
      retainedRange: input.decision.fullRequest.timeRange,
      operations: {
        returned: input.incomingFrame.rows.length,
        retained: input.incomingFrame.rows.length,
      },
    };

    return {
      frame: withIncrementalContext(input.incomingFrame, delta),
      delta,
      watermarkMs,
    };
  }

  assertMergeableFrame(input.incomingFrame, input.settings);

  const retentionStartMs =
    input.settings.retentionMs === undefined
      ? fullRange.fromMs
      : Math.max(fullRange.fromMs, fullRange.toMs - input.settings.retentionMs);
  const existingRows = input.decision.retainedState?.retainedFrame.rows ?? [];
  const rowsByKey = new Map<string, Record<string, unknown>>();
  const retainedRowsBeforePrune = existingRows.length;

  existingRows.forEach((row) => {
    const rowTimeMs = normalizeTimestampMs(row[input.settings.timeField!]);

    if (rowTimeMs === undefined || rowTimeMs < retentionStartMs || rowTimeMs > fullRange.toMs) {
      return;
    }

    rowsByKey.set(buildRowMergeKey(row, input.settings.mergeKeyFields!), row);
  });

  let rowsAppended = 0;
  let rowsReplaced = 0;
  const changedRows: Array<Record<string, unknown>> = [];

  input.incomingFrame.rows.forEach((row) => {
    const rowTimeMs = normalizeTimestampMs(row[input.settings.timeField!]);

    if (rowTimeMs === undefined || rowTimeMs < retentionStartMs || rowTimeMs > fullRange.toMs) {
      return;
    }

    const mergeKey = buildRowMergeKey(row, input.settings.mergeKeyFields!);
    const existingRow = rowsByKey.get(mergeKey);

    if (existingRow) {
      if (input.settings.dedupePolicy === "error") {
        throw new Error(
          `Incremental refresh received a duplicate merge key for ${input.settings.mergeKeyFields!.join(", ")}.`,
        );
      }

      if (input.settings.dedupePolicy === "latest") {
        rowsByKey.set(mergeKey, row);
        rowsReplaced += 1;
        changedRows.push(row);
      }
      return;
    }

    rowsByKey.set(mergeKey, row);
    rowsAppended += 1;
    changedRows.push(row);
  });

  const rows = Array.from(rowsByKey.values()).sort((left, right) => {
    const leftTimeMs = normalizeTimestampMs(left[input.settings.timeField!]) ?? 0;
    const rightTimeMs = normalizeTimestampMs(right[input.settings.timeField!]) ?? 0;

    if (leftTimeMs !== rightTimeMs) {
      return leftTimeMs - rightTimeMs;
    }

    return buildRowMergeKey(left, input.settings.mergeKeyFields!).localeCompare(
      buildRowMergeKey(right, input.settings.mergeKeyFields!),
    );
  });
  const baseFrame = input.decision.retainedState?.retainedFrame ?? input.incomingFrame;
  const columns = collectColumns(baseFrame, input.incomingFrame);
  const fields = collectFields(baseFrame, input.incomingFrame);
  const watermarkMs = getFrameWatermark(
    { ...input.incomingFrame, rows },
    input.settings.timeField!,
    fullRange.toMs,
  );
  const deltaOutput = buildDeltaFrame({
    sourceFrame: input.incomingFrame,
    rows: changedRows,
    columns,
    fields,
  });
  const delta: ConnectionQueryRuntimeDeltaSummary = {
    contractVersion: WIDGET_RUNTIME_UPDATE_CONTRACT_VERSION,
    mode: input.decision.retainedState ? "delta" : "snapshot",
    retainedOutputLocation: "carrier",
    sourceOutputId: "dataset",
    sourceWidgetId: input.decision.sourceWidgetId,
    outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    enabled: true,
    reason: input.decision.reason,
    identityKey: input.decision.identityKey,
    timeField: input.settings.timeField,
    mergeKeyFields: input.settings.mergeKeyFields,
    dedupePolicy: input.settings.dedupePolicy,
    range: input.decision.request.timeRange,
    retainedRange: input.decision.fullRequest.timeRange,
    watermarkBeforeMs: input.decision.retainedState?.lastWatermarkMs,
    watermarkAfterMs: watermarkMs,
    rowsReturned: input.incomingFrame.rows.length,
    rowsRetained: rows.length,
    rowsAppended,
    rowsReplaced,
    rowsPruned: Math.max(0, retainedRowsBeforePrune + rowsAppended - rowsReplaced - rows.length),
    deltaOutput,
    operations: {
      appended: rowsAppended,
      replaced: rowsReplaced,
      pruned: Math.max(0, retainedRowsBeforePrune + rowsAppended - rowsReplaced - rows.length),
      returned: input.incomingFrame.rows.length,
      retained: rows.length,
    },
    diagnostics: {
      identityKey: input.decision.identityKey,
      reason: input.decision.reason,
      timeField: input.settings.timeField,
      mergeKeyFields: input.settings.mergeKeyFields,
      dedupePolicy: input.settings.dedupePolicy,
    },
  };
  const frame = withIncrementalContext(
    {
      ...input.incomingFrame,
      columns,
      rows,
      fields,
      meta: input.incomingFrame.meta ?? baseFrame.meta,
    },
    delta,
  );

  retainedConnectionQueryStore.set(input.decision.identityKey, {
    identityKey: input.decision.identityKey,
    retainedFrame: frame,
    lastWatermarkMs: watermarkMs,
    lastRequestRange: fullRange,
    updatedAtMs: Date.now(),
  });

  return {
    frame,
    delta,
    watermarkMs,
  };
}

export function clearRetainedConnectionQueryResponses() {
  retainedConnectionQueryStore.clear();
  inFlightConnectionQueryRequests.clear();
}
