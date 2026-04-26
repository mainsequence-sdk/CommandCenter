import { appRegistry } from "@/app/registry";
import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import type {
  ConnectionAccessMode,
  ConnectionCapability,
  ConnectionConfigSchema,
  ConnectionQueryModel,
  AnyConnectionTypeDefinition,
} from "@/connections/types";

const devAuthProxyPrefix = "/__command_center_auth__";

export const CONNECTION_REGISTRY_VERSION =
  "2026-04-26-prometheus-service-account-json-visibility-fred-economic-data";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SyncedConnectionTypePayload {
  typeId: string;
  typeVersion: number;
  title: string;
  description: string;
  source: string;
  category: string;
  iconUrl?: string;
  tags: string[];
  capabilities: ConnectionCapability[];
  accessMode: ConnectionAccessMode;
  publicConfigSchema: ConnectionConfigSchema;
  secureConfigSchema?: ConnectionConfigSchema;
  queryModels: ConnectionQueryModel[];
  requiredPermissions: string[];
  usageGuidance?: string;
  examples: JsonValue;
  isActive: boolean;
}

export interface ConnectionTypeSyncPayload {
  registryVersion: string;
  checksum: string;
  connections: SyncedConnectionTypePayload[];
}

export interface ConnectionTypeSyncValidationIssue {
  typeId: string;
  section: string;
  message: string;
}

export interface ConnectionTypeSyncDraft {
  payload: ConnectionTypeSyncPayload;
  validationIssues: ConnectionTypeSyncValidationIssue[];
}

export interface ConnectionTypeSyncResponse {
  status: "noop" | "synced";
  registryVersion?: string;
  checksum?: string;
  lastSyncedAt?: string;
  created?: number;
  updated?: number;
  deactivated?: number;
  total?: number;
}

class ConnectionTypeSyncError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "ConnectionTypeSyncError";
    this.status = status;
    this.payload = payload;
  }
}

const inFlightSyncs = new Map<string, Promise<ConnectionTypeSyncResponse>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildEndpointUrl(path: string) {
  const url = new URL(path, env.apiBaseUrl);

  if (import.meta.env.DEV && isLoopbackHostname(url.hostname)) {
    return `${devAuthProxyPrefix}${url.pathname}${url.search}`;
  }

  return url.toString();
}

function toJsonValue(value: unknown): JsonValue {
  const serialized = JSON.stringify(value, (_key, candidate) => {
    if (candidate === undefined) {
      return undefined;
    }

    if (
      typeof candidate === "function" ||
      typeof candidate === "symbol" ||
      typeof candidate === "bigint"
    ) {
      return undefined;
    }

    return candidate;
  });

  return serialized ? (JSON.parse(serialized) as JsonValue) : {};
}

function stableNormalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => stableNormalizeJson(entry));
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((result, key) => {
        result[key] = stableNormalizeJson(value[key] as JsonValue);
        return result;
      }, {});
  }

  return value;
}

function stableStringifyJson(value: JsonValue) {
  return JSON.stringify(stableNormalizeJson(value));
}

async function sha256Hex(value: string) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function appendRequiredStringIssue(
  issues: ConnectionTypeSyncValidationIssue[],
  connection: AnyConnectionTypeDefinition,
  key: keyof Pick<
    AnyConnectionTypeDefinition,
    "id" | "title" | "description" | "source" | "category"
  >,
) {
  const value = connection[key];

  if (typeof value !== "string" || !value.trim()) {
    issues.push({
      typeId: connection.id || "(missing id)",
      section: "metadata",
      message: `${String(key)} is required.`,
    });
  }
}

function validateConnectionType(
  connection: AnyConnectionTypeDefinition,
): ConnectionTypeSyncValidationIssue[] {
  const issues: ConnectionTypeSyncValidationIssue[] = [];

  appendRequiredStringIssue(issues, connection, "id");
  appendRequiredStringIssue(issues, connection, "title");
  appendRequiredStringIssue(issues, connection, "description");
  appendRequiredStringIssue(issues, connection, "source");
  appendRequiredStringIssue(issues, connection, "category");

  if (!Number.isInteger(connection.version) || connection.version <= 0) {
    issues.push({
      typeId: connection.id || "(missing id)",
      section: "metadata",
      message: "version must be a positive integer.",
    });
  }

  if (connection.capabilities.length === 0) {
    issues.push({
      typeId: connection.id || "(missing id)",
      section: "capabilities",
      message: "At least one capability is required.",
    });
  }

  if (!connection.publicConfigSchema || connection.publicConfigSchema.version <= 0) {
    issues.push({
      typeId: connection.id || "(missing id)",
      section: "publicConfigSchema",
      message: "publicConfigSchema.version must be defined.",
    });
  }

  return issues;
}

function projectConnectionType(
  connection: AnyConnectionTypeDefinition,
): SyncedConnectionTypePayload {
  return {
    typeId: connection.id,
    typeVersion: connection.version,
    title: connection.title,
    description: connection.description,
    source: connection.source,
    category: connection.category,
    iconUrl: connection.iconUrl,
    tags: connection.tags ?? [],
    capabilities: connection.capabilities,
    accessMode: connection.accessMode,
    publicConfigSchema: connection.publicConfigSchema,
    secureConfigSchema: connection.secureConfigSchema,
    queryModels: connection.queryModels ?? [],
    requiredPermissions: connection.requiredPermissions ?? [],
    usageGuidance: connection.usageGuidance,
    examples: toJsonValue(connection.examples ?? []),
    isActive: true,
  };
}

function formatValidationIssues(issues: ConnectionTypeSyncValidationIssue[]) {
  return issues
    .map((issue) => `${issue.typeId} ${issue.section}: ${issue.message}`)
    .join(" ");
}

export async function buildConnectionTypeSyncDraft(): Promise<ConnectionTypeSyncDraft> {
  const validationIssues = [...appRegistry.connections]
    .flatMap((connection) => validateConnectionType(connection))
    .sort((left, right) =>
      left.typeId === right.typeId
        ? left.section.localeCompare(right.section)
        : left.typeId.localeCompare(right.typeId),
    );
  const connections = [...appRegistry.connections]
    .map((connection) => projectConnectionType(connection))
    .sort((left, right) => left.typeId.localeCompare(right.typeId));

  const registryBody = {
    registryVersion: CONNECTION_REGISTRY_VERSION,
    connections,
  } satisfies Omit<ConnectionTypeSyncPayload, "checksum">;
  const checksum = `sha256:${await sha256Hex(
    stableStringifyJson(registryBody as unknown as JsonValue),
  )}`;

  return {
    payload: {
      ...registryBody,
      checksum,
    },
    validationIssues,
  };
}

export async function buildConnectionTypeSyncPayload(): Promise<ConnectionTypeSyncPayload> {
  const draft = await buildConnectionTypeSyncDraft();

  if (draft.validationIssues.length > 0) {
    throw new Error(
      `Connection registry manifest is invalid. ${formatValidationIssues(draft.validationIssues)}`,
    );
  }

  return draft.payload;
}

async function readResponsePayload(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.trim() ? text : null;
}

function readErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (isRecord(payload) && typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail.trim();
  }

  return "";
}

async function requestConnectionTypeSync(
  payload: ConnectionTypeSyncPayload,
): Promise<ConnectionTypeSyncResponse> {
  const syncPath = commandCenterConfig.connections.types.syncUrl.trim();

  if (!syncPath) {
    throw new Error("Command Center connection-type sync endpoint is not configured.");
  }

  const requestUrl = buildEndpointUrl(syncPath);

  async function sendRequest() {
    const session = useAuthStore.getState().session;

    if (!session?.token) {
      throw new Error("You need to be signed in before the connection registry can sync.");
    }

    return fetch(requestUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `${session.tokenType ?? "Bearer"} ${session.token}`,
      },
      body: JSON.stringify(payload),
    });
  }

  let response = await sendRequest();

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await sendRequest();
    }
  }

  const responsePayload = await readResponsePayload(response);

  if (!response.ok) {
    throw new ConnectionTypeSyncError(
      response.status,
      responsePayload,
      readErrorMessage(responsePayload) ||
        `Connection registry sync failed with ${response.status}.`,
    );
  }

  return (responsePayload ?? { status: "noop" }) as ConnectionTypeSyncResponse;
}

export async function syncConnectionTypes(
  payload?: ConnectionTypeSyncPayload,
) {
  if (env.useMockData) {
    return { status: "noop" } satisfies ConnectionTypeSyncResponse;
  }

  const session = useAuthStore.getState().session;

  if (!session?.token || !session.user.id) {
    throw new Error("You need to be signed in before the connection registry can sync.");
  }

  const effectivePayload = payload ?? await buildConnectionTypeSyncPayload();
  const syncMarker = `${effectivePayload.registryVersion}:${effectivePayload.checksum}`;
  const inFlightKey = `${session.user.id}:${syncMarker}`;
  const existingPromise = inFlightSyncs.get(inFlightKey);

  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = requestConnectionTypeSync(effectivePayload)
    .finally(() => {
      inFlightSyncs.delete(inFlightKey);
    });

  inFlightSyncs.set(inFlightKey, nextPromise);
  return nextPromise;
}
