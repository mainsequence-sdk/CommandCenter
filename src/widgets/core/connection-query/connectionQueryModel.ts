import { queryConnection } from "@/connections/api";
import type {
  CommandCenterFrame,
  CommandCenterFrameFieldType,
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
  normalizeTimeSeriesFrameSource,
  type TimeSeriesFrameSourceV1,
} from "@/widgets/shared/timeseries-frame-source";

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
  selectedFrame?: number;
}

export type ConnectionQueryRuntimeState = TabularFrameSourceV1 | TimeSeriesFrameSourceV1;

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

function normalizeNonNegativeInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
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
    selectedFrame: normalizeNonNegativeInteger(props.selectedFrame),
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
    selectedFrame: number;
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
        selectedFrame: input.selectedFrame,
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
    selectedFrame: number;
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
        selectedFrame: input.selectedFrame,
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
    selectedFrame: number;
    traceId?: string;
    warnings?: string[];
  },
) {
  return frameToTimeSeriesSource(frame, input) ?? frameToTabularSource(frame, input);
}

function firstConnectionFramePayload(
  payload: unknown,
  input: {
    connectionRef: ConnectionRef;
    queryModelId: string;
    selectedFrame: number;
  },
) {
  const normalizedTimeSeriesSource = normalizeTimeSeriesFrameSource(payload);

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
          selectedFrame: input.selectedFrame,
        },
      },
    };
  }

  const normalizedSource = normalizeTabularFrameSource(payload);

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
          selectedFrame: input.selectedFrame,
        },
      },
    };
  }

  if (!isPlainRecord(payload)) {
    return null;
  }

  const response = payload as unknown as ConnectionQueryResponse;

  if (!Array.isArray(response.frames) || response.frames.length === 0) {
    return null;
  }

  const selectedFrame = Math.min(input.selectedFrame, response.frames.length - 1);
  const frame = response.frames[selectedFrame];

  return frame
    ? frameToPublishedSource(frame, {
        ...input,
        selectedFrame,
        traceId: response.traceId,
        warnings: response.warnings,
      })
    : null;
}

function resolveDashboardRange(dashboardState?: WidgetExecutionDashboardState) {
  if (!dashboardState) {
    return null;
  }

  return {
    fromMs: dashboardState.rangeStartMs,
    toMs: dashboardState.rangeEndMs,
  };
}

function resolveFixedRange(props: ConnectionQueryWidgetProps) {
  const fromMs = normalizeTimestampMs(props.fixedStartMs);
  const toMs = normalizeTimestampMs(props.fixedEndMs);

  return fromMs !== undefined && toMs !== undefined && fromMs < toMs
    ? { fromMs, toMs }
    : null;
}

function buildEffectiveRange(
  props: ConnectionQueryWidgetProps,
  dashboardState?: WidgetExecutionDashboardState,
) {
  const mode = normalizeTimeRangeMode(props.timeRangeMode);

  if (mode === "none") {
    return null;
  }

  return mode === "fixed" ? resolveFixedRange(props) : resolveDashboardRange(dashboardState);
}

function buildEffectiveQuery(
  props: ConnectionQueryWidgetProps,
  range: { fromMs: number; toMs: number } | null,
) {
  const queryModelId = normalizeString(props.queryModelId);
  const query = isPlainRecord(props.query) ? { ...props.query } : {};

  if (queryModelId && typeof query.kind !== "string") {
    query.kind = queryModelId;
  }

  if (range && query.kind === "data-node-rows-between-dates") {
    if (typeof query.start_date !== "number") {
      query.start_date = Math.floor(range.fromMs / 1000);
    }

    if (typeof query.end_date !== "number") {
      query.end_date = Math.floor(range.toMs / 1000);
    }
  }

  return query;
}

export function buildConnectionQueryRequest(
  props: ConnectionQueryWidgetProps,
  dashboardState?: WidgetExecutionDashboardState,
): ConnectionQueryRequest<Record<string, unknown>> | null {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const connectionRef = normalizedProps.connectionRef;
  const queryModelId = normalizedProps.queryModelId;

  if (!connectionRef || !queryModelId) {
    return null;
  }

  const range = buildEffectiveRange(normalizedProps, dashboardState);

  return {
    connectionUid: connectionRef.uid,
    query: buildEffectiveQuery(normalizedProps, range),
    timeRange: range
      ? {
          from: new Date(range.fromMs).toISOString(),
          to: new Date(range.toMs).toISOString(),
        }
      : undefined,
    variables: normalizedProps.variables,
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
): Promise<ConnectionQueryRuntimeState> {
  const normalizedProps = normalizeConnectionQueryProps(props);
  const connectionRef = normalizedProps.connectionRef;
  const queryModelId = normalizedProps.queryModelId;

  if (!connectionRef) {
    throw new Error("Select a connection before running this query.");
  }

  if (!queryModelId) {
    throw new Error("Select a query model before running this query.");
  }

  const request = buildConnectionQueryRequest(normalizedProps, dashboardState);

  if (!request) {
    throw new Error("Connection query request is incomplete.");
  }

  const payload = await queryConnection(request);
  const frame = firstConnectionFramePayload(payload, {
    connectionRef,
    queryModelId,
    selectedFrame: normalizedProps.selectedFrame ?? 0,
  });

  if (!frame) {
    throw new Error(
      `Connection query did not return a ${CORE_TABULAR_FRAME_SOURCE_CONTRACT} or time-series frame.`,
    );
  }

  return frame;
}

export function normalizeConnectionQueryRuntimeState(
  value: unknown,
): ConnectionQueryRuntimeState | null {
  return normalizeTimeSeriesFrameSource(value) ?? normalizeTabularFrameSource(value);
}
