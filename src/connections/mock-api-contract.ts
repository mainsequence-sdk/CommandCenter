import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  normalizeTabularFrameSource,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";

import type {
  CommandCenterFrame,
  CommandCenterFrameField,
  CommandCenterFrameFieldType,
  ConnectionHealthResult,
  ConnectionId,
  ConnectionInstance,
  ConnectionQueryRequest,
  ConnectionQueryResponse,
} from "./types";

export const MOCK_API_CONNECTION_TYPE_ID = "command_center.mock_api";
export const MOCK_API_CONNECTION_TYPE_VERSION = 1;
export const MOCK_API_LOCAL_INSTANCE_ID = "__local_mock_api__";
export const MOCK_API_QUERY_KIND = "mock-api-response";
export const DEFAULT_MOCK_API_LATENCY_MS = 750;

export type MockApiResponseMode =
  | "auto"
  | "rows"
  | "tabular-frame"
  | "connection-query-response";

export interface MockApiPublicConfig {
  defaultResponseBody?: unknown;
  defaultResponseStatus?: number;
  defaultResponseMode?: MockApiResponseMode;
  latencyMs?: number;
}

export interface MockApiConnectionQuery {
  kind?: typeof MOCK_API_QUERY_KIND;
  responseBody?: unknown;
  responseStatus?: number;
  responseMode?: MockApiResponseMode;
  latencyMs?: number;
  warnings?: string[];
}

export const DEFAULT_MOCK_API_RESPONSE_BODY = [
  { x: 0, y: 2, label: "alpha" },
  { x: 1, y: 5, label: "beta" },
  { x: 2, y: 3, label: "gamma" },
] as const;

interface MockApiSimulatedRequest {
  latencyMs: number;
  mode: MockApiResponseMode;
  responseBody: unknown;
  status: number;
  warnings?: string[];
}

const MOCK_API_CREATED_AT = "1970-01-01T00:00:00.000Z";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStatus(value: unknown) {
  const parsed = normalizeNumber(value);
  if (parsed === undefined) {
    return undefined;
  }

  return Math.min(599, Math.max(100, Math.trunc(parsed)));
}

function normalizeLatencyMs(value: unknown) {
  const parsed = normalizeNumber(value);
  if (parsed === undefined) {
    return undefined;
  }

  return Math.min(30_000, Math.max(0, Math.trunc(parsed)));
}

function normalizeMockApiLatencyMs(value: unknown) {
  const normalized = normalizeLatencyMs(value);
  return normalized === undefined || normalized <= 0
    ? undefined
    : normalized;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function isConnectionQueryResponse(value: unknown): value is ConnectionQueryResponse {
  return isRecord(value) && Array.isArray(value.frames);
}

function isCommandCenterFrame(value: unknown): value is CommandCenterFrame {
  return (
    isRecord(value) &&
    typeof value.contract === "string" &&
    Array.isArray(value.fields)
  );
}

function isIsoTimeString(value: string) {
  return /^\d{4}-\d{2}-\d{2}(?:T|\s)\d{2}:\d{2}/.test(value);
}

function inferFieldType(values: unknown[]): CommandCenterFrameFieldType {
  const sample = values.find((value) => value !== undefined && value !== null);

  if (typeof sample === "number") {
    return "number";
  }

  if (typeof sample === "boolean") {
    return "boolean";
  }

  if (typeof sample === "string") {
    return isIsoTimeString(sample) ? "time" : "string";
  }

  return "json";
}

function mapTabularFieldTypeToFrameFieldType(
  type: TabularFrameFieldType | undefined,
): CommandCenterFrameFieldType {
  if (type === "number" || type === "integer") {
    return "number";
  }

  if (type === "boolean") {
    return "boolean";
  }

  if (type === "datetime" || type === "date" || type === "time") {
    return "time";
  }

  if (type === "string") {
    return "string";
  }

  return "json";
}

function columnsFromTabularFrame(frame: TabularFrameSourceV1) {
  const fieldKeys = (frame.fields ?? []).flatMap((field) => field.key ? [field.key] : []);
  const rowKeys = frame.rows.flatMap((row) => Object.keys(row));
  const seen = new Set<string>();

  return [...frame.columns, ...fieldKeys, ...rowKeys].flatMap((column) => {
    const normalized = column.trim();

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function canonicalTabularFrameToCommandCenterFrame(
  body: unknown,
): CommandCenterFrame | null {
  const frame = normalizeTabularFrameSource(body);

  if (!frame) {
    return null;
  }

  const fieldByKey = new Map((frame.fields ?? []).map((field) => [field.key, field] as const));
  const columns = columnsFromTabularFrame(frame);
  const fields = columns.map((column) => {
    const field = fieldByKey.get(column);
    const values = frame.rows.map((row) =>
      Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null,
    );

    return {
      name: column,
      type: field
        ? mapTabularFieldTypeToFrameFieldType(field.type)
        : inferFieldType(values),
      values,
      config: { displayName: field?.label ?? column },
    } satisfies CommandCenterFrameField;
  });

  return {
    name: frame.source?.label ?? "Mock API response",
    contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    fields,
    meta: frame.meta,
  };
}

function normalizeRows(value: unknown): Array<Record<string, unknown>> {
  if (isRecord(value) && Array.isArray(value.rows)) {
    return normalizeRows(value.rows);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => (isRecord(entry) ? entry : { value: entry }));
  }

  if (isRecord(value)) {
    return [value];
  }

  return [{ value }];
}

function normalizeColumns(value: unknown, rows: Array<Record<string, unknown>>) {
  if (isRecord(value) && Array.isArray(value.columns)) {
    const columns = value.columns.flatMap((column) =>
      typeof column === "string" && column.trim() ? [column.trim()] : [],
    );

    if (columns.length > 0) {
      return columns;
    }
  }

  const columns: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  return columns.length > 0 ? columns : ["value"];
}

function tabularLikeBodyToFrame(body: unknown): CommandCenterFrame {
  const canonicalFrame = canonicalTabularFrameToCommandCenterFrame(body);

  if (canonicalFrame) {
    return {
      ...canonicalFrame,
      meta: {
        ...(canonicalFrame.meta ?? {}),
        mockApi: {
          rowCount: Math.max(0, ...canonicalFrame.fields.map((field) => field.values.length)),
          generatedAtMs: Date.now(),
        },
      },
    };
  }

  const rows = normalizeRows(body);
  const columns = normalizeColumns(body, rows);
  const fields = columns.map((column) => {
    const values = rows.map((row) =>
      Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null,
    );

    return {
      name: column,
      type: inferFieldType(values),
      values,
      config: { displayName: column },
    };
  });
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : undefined;

  return {
    name: "Mock API response",
    contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    fields,
    meta: {
      ...(meta ?? {}),
      mockApi: {
        rowCount: rows.length,
        generatedAtMs: Date.now(),
      },
    },
  };
}

function responseBodyToConnectionResponse(
  body: unknown,
  mode: MockApiResponseMode,
  warnings?: string[],
): ConnectionQueryResponse {
  const traceId = `mock-api-${Date.now()}`;

  if (mode === "connection-query-response") {
    if (!isConnectionQueryResponse(body)) {
      throw new Error("Mock API response body must be a ConnectionQueryResponse object.");
    }

    const response = body as ConnectionQueryResponse;

    return {
      ...response,
      traceId: response.traceId ?? traceId,
      warnings: [
        ...(response.warnings ?? []),
        ...(warnings ?? []),
      ],
    };
  }

  if (mode === "auto" && isConnectionQueryResponse(body)) {
    return {
      ...body,
      traceId: body.traceId ?? traceId,
      warnings: [
        ...(body.warnings ?? []),
        ...(warnings ?? []),
      ],
    };
  }

  if (mode === "tabular-frame") {
    const canonicalFrame = canonicalTabularFrameToCommandCenterFrame(body);

    if (!isCommandCenterFrame(body) && !canonicalFrame) {
      throw new Error(
        "Mock API response body must be a Command Center frame object or canonical tabular frame source.",
      );
    }

    return {
      frames: [isCommandCenterFrame(body) ? body : canonicalFrame!],
      traceId,
      warnings,
    };
  }

  if (mode === "auto" && isCommandCenterFrame(body)) {
    return {
      frames: [body],
      traceId,
      warnings,
    };
  }

  return {
    frames: [tabularLikeBodyToFrame(body)],
    traceId,
    warnings,
  };
}

function buildMockApiSimulatedRequest(
  query: MockApiConnectionQuery,
  publicConfig: MockApiPublicConfig,
): MockApiSimulatedRequest {
  return {
    latencyMs:
      normalizeMockApiLatencyMs(query.latencyMs) ??
      normalizeMockApiLatencyMs(publicConfig.latencyMs) ??
      DEFAULT_MOCK_API_LATENCY_MS,
    mode: query.responseMode ?? publicConfig.defaultResponseMode ?? "auto",
    responseBody:
      query.responseBody === undefined
        ? publicConfig.defaultResponseBody ?? DEFAULT_MOCK_API_RESPONSE_BODY
        : query.responseBody,
    status:
      normalizeStatus(query.responseStatus) ??
      normalizeStatus(publicConfig.defaultResponseStatus) ??
      200,
    warnings: Array.isArray(query.warnings)
      ? query.warnings.filter(isNonEmptyString)
      : undefined,
  };
}

async function resolveMockApiSimulatedResponse(
  simulatedRequest: MockApiSimulatedRequest,
): Promise<ConnectionQueryResponse> {
  if (simulatedRequest.latencyMs > 0) {
    await sleep(simulatedRequest.latencyMs);
  }

  if (simulatedRequest.status < 200 || simulatedRequest.status >= 300) {
    throw new Error(`Mock API response failed with HTTP ${simulatedRequest.status}.`);
  }

  return responseBodyToConnectionResponse(
    simulatedRequest.responseBody,
    simulatedRequest.mode,
    simulatedRequest.warnings,
  );
}

export function isMockApiConnectionId(id: ConnectionId | undefined) {
  return id !== undefined && String(id) === MOCK_API_LOCAL_INSTANCE_ID;
}

export function isMockApiConnectionRef(
  value: { id?: ConnectionId; typeId?: string } | undefined,
) {
  return (
    isMockApiConnectionId(value?.id) &&
    value?.typeId === MOCK_API_CONNECTION_TYPE_ID
  );
}

export function isMockApiConnectionInstance(instance: ConnectionInstance | undefined) {
  return (
    isMockApiConnectionId(instance?.id) &&
    instance?.typeId === MOCK_API_CONNECTION_TYPE_ID
  );
}

export function buildMockApiConnectionInstance(): ConnectionInstance {
  return {
    id: MOCK_API_LOCAL_INSTANCE_ID,
    typeId: MOCK_API_CONNECTION_TYPE_ID,
    typeVersion: MOCK_API_CONNECTION_TYPE_VERSION,
    name: "Mock API",
    description:
      "Local JSON-backed mock connection for prototyping connection queries and widget bindings.",
    publicConfig: {
      defaultResponseBody: DEFAULT_MOCK_API_RESPONSE_BODY,
      defaultResponseStatus: 200,
      defaultResponseMode: "auto",
      latencyMs: DEFAULT_MOCK_API_LATENCY_MS,
    } satisfies MockApiPublicConfig,
    secureFields: {},
    status: "ok",
    statusMessage: "Local mock connection. No backend registry sync or network call is used.",
    lastHealthCheckAt: MOCK_API_CREATED_AT,
    isActive: true,
    isDefault: true,
    isSystem: true,
    tags: ["local", "mock", "api", "test"],
    createdAt: MOCK_API_CREATED_AT,
    updatedAt: MOCK_API_CREATED_AT,
  };
}

export function withMockApiConnectionInstance(instances: ConnectionInstance[]) {
  if (instances.some(isMockApiConnectionInstance)) {
    return instances;
  }

  return [buildMockApiConnectionInstance(), ...instances];
}

export async function testMockApiConnection(): Promise<ConnectionHealthResult> {
  return {
    status: "ok",
    message: "Mock API is available locally.",
    latencyMs: 0,
    checkedAt: new Date().toISOString(),
    traceId: `mock-api-health-${Date.now()}`,
  };
}

export async function executeMockApiConnectionQuery(
  request: ConnectionQueryRequest<Record<string, unknown>>,
): Promise<ConnectionQueryResponse> {
  const query = isRecord(request.query)
    ? (request.query as MockApiConnectionQuery)
    : {};
  const localInstance = buildMockApiConnectionInstance();
  const publicConfig = localInstance.publicConfig as MockApiPublicConfig;
  const simulatedRequest = buildMockApiSimulatedRequest(query, publicConfig);

  return resolveMockApiSimulatedResponse(simulatedRequest);
}
