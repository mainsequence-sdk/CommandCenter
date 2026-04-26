import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import {
  startDashboardRequestTrace,
  type DashboardRequestTraceMeta,
} from "@/dashboards/dashboard-request-trace";
import type {
  ConnectionHealthResult,
  ConnectionInstance,
  ConnectionQueryRequest,
  ConnectionQueryResponse,
  ConnectionRef,
  ConnectionResourceRequest,
  ConnectionStreamRequest,
  AnyConnectionTypeDefinition,
} from "@/connections/types";

const devAuthProxyPrefix = "/__command_center_auth__";
const systemNowIso = "1970-01-01T00:00:00.000Z";

export const COMMAND_CENTER_SYSTEM_CONNECTION_TYPE_ID = "command-center.system-api";
export const COMMAND_CENTER_SYSTEM_CONNECTION_UID = "system-default";

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

function applyTemplate(
  template: string,
  params: Record<string, string | number>,
) {
  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result.replace(`{${key}}`, encodeURIComponent(String(value))),
    template,
  );
}

function getSessionHeaders() {
  const session = useAuthStore.getState().session;

  if (!session?.token) {
    return {};
  }

  return {
    Authorization: `${session.tokenType ?? "Bearer"} ${session.token}`,
  };
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

function formatErrorValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(formatErrorValue).filter(Boolean).join(" ");
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, entry]) => {
        const message = formatErrorValue(entry);
        return message ? `${key}: ${message}` : "";
      })
      .filter(Boolean)
      .join(" ");
  }

  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function readErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (isRecord(payload)) {
    for (const key of ["exception_detail", "detail", "message", "error", "errors"]) {
      const message = formatErrorValue(payload[key]);

      if (message) {
        return message;
      }
    }
  }

  return "";
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  traceMeta?: DashboardRequestTraceMeta,
): Promise<T> {
  if (!path.trim()) {
    throw new Error("Command Center connection endpoint is not configured.");
  }

  const requestUrl = buildEndpointUrl(path);
  const requestTrace = startDashboardRequestTrace(traceMeta, {
    method: init?.method,
    url: requestUrl,
  });

  async function sendRequest() {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");

    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    Object.entries(getSessionHeaders()).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return fetch(requestUrl, {
      ...init,
      headers,
    });
  }

  let response: Response;

  try {
    response = await sendRequest();
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "The browser could not reach the connection endpoint.";

    requestTrace?.fail(errorMessage);
    throw error;
  }

  if (response.status === 401) {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      try {
        response = await sendRequest();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "The browser could not reach the connection endpoint.";

        requestTrace?.fail(errorMessage);
        throw error;
      }
    }
  }

  let payload: unknown;

  try {
    payload = await readResponsePayload(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Connection response could not be read.";

    requestTrace?.finish({
      error: errorMessage,
      ok: false,
      status: response.status,
    });
    throw error;
  }

  if (!response.ok) {
    const errorMessage =
      readErrorMessage(payload) || `Connection request failed with ${response.status}.`;

    requestTrace?.finish({
      error: errorMessage,
      ok: false,
      status: response.status,
    });
    throw new Error(errorMessage);
  }

  requestTrace?.finish({
    ok: true,
    status: response.status,
  });

  return payload as T;
}

function normalizeListPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (isRecord(payload)) {
    for (const key of ["results", "items", "connections", "types"]) {
      const value = payload[key];

      if (Array.isArray(value)) {
        return value as T[];
      }
    }
  }

  return [];
}

export function createConnectionRef(uid: string, typeId: string): ConnectionRef {
  return { uid, typeId };
}

export function normalizeConnectionRef(
  value: unknown,
  fallback?: ConnectionRef,
): ConnectionRef | undefined {
  if (isRecord(value)) {
    const uid = typeof value.uid === "string" ? value.uid.trim() : "";
    const typeId = typeof value.typeId === "string" ? value.typeId.trim() : "";

    if (uid && typeId) {
      return { uid, typeId };
    }
  }

  return fallback;
}

export function getSystemConnectionInstances(): ConnectionInstance[] {
  const instances: ConnectionInstance[] = [
    {
      id: COMMAND_CENTER_SYSTEM_CONNECTION_UID,
      uid: COMMAND_CENTER_SYSTEM_CONNECTION_UID,
      typeId: COMMAND_CENTER_SYSTEM_CONNECTION_TYPE_ID,
      typeVersion: 1,
      name: "Command Center system API",
      description:
        "Hidden system connection that represents the current Command Center backend and websocket runtime.",
      organizationId: undefined,
      workspaceId: null,
      publicConfig: {
        apiBaseUrl: env.apiBaseUrl,
        wsUrl: env.wsUrl,
      },
      secureFields: {},
      status: "unknown",
      isDefault: true,
      isSystem: true,
      tags: ["system"],
      createdAt: systemNowIso,
      updatedAt: systemNowIso,
    },
  ];

  instances.push({
    id: "mainsequence-data-node-default",
    uid: "mainsequence-data-node-default",
    typeId: "mainsequence.data-node",
    typeVersion: 1,
    name: "Main Sequence Data Node",
    description:
      "Default Data Node connection routed through the current authenticated Main Sequence backend session.",
    workspaceId: null,
    publicConfig: {},
    secureFields: {},
    status: "unknown",
    isDefault: true,
    isSystem: true,
    tags: ["main-sequence", "data-node"],
    createdAt: systemNowIso,
    updatedAt: systemNowIso,
  });

  instances.push({
    id: "prometheus-default",
    uid: "prometheus-default",
    typeId: "prometheus.remote",
    typeVersion: 1,
    name: "Prometheus default",
    description:
      "Default Prometheus connection placeholder. Backend-managed instances should replace this when available.",
    workspaceId: null,
    publicConfig: {},
    secureFields: {},
    status: "unknown",
    isDefault: true,
    isSystem: true,
    tags: ["prometheus"],
    createdAt: systemNowIso,
    updatedAt: systemNowIso,
  });

  return instances;
}

export function getDefaultConnectionRefForType(
  typeId: string,
): ConnectionRef | undefined {
  const instance = getSystemConnectionInstances().find(
    (candidate) => candidate.typeId === typeId && candidate.isDefault,
  );

  return instance ? createConnectionRef(instance.uid, instance.typeId) : undefined;
}

export async function fetchConnectionTypes(): Promise<AnyConnectionTypeDefinition[]> {
  const path = commandCenterConfig.connections.types.listUrl.trim();

  if (env.useMockData || !path) {
    return [];
  }

  const payload = await requestJson<unknown>(path);
  return normalizeListPayload<AnyConnectionTypeDefinition>(payload);
}

export async function fetchConnectionInstances(): Promise<ConnectionInstance[]> {
  const path = commandCenterConfig.connections.instances.listUrl.trim();

  if (env.useMockData || !path) {
    return [];
  }

  const payload = await requestJson<unknown>(path);
  return normalizeListPayload<ConnectionInstance>(payload);
}

export function fetchConnectionInstance(uid: string) {
  const template = commandCenterConfig.connections.instances.detailUrl.trim();
  return requestJson<ConnectionInstance>(applyTemplate(template, { uid }));
}

export function createConnectionInstance(
  input: Omit<ConnectionInstance, "id" | "createdAt" | "updatedAt" | "secureFields" | "status"> & {
    secureConfig?: Record<string, unknown>;
  },
) {
  return requestJson<ConnectionInstance>(
    commandCenterConfig.connections.instances.listUrl,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateConnectionInstance(
  uid: string,
  input: Partial<ConnectionInstance> & { secureConfig?: Record<string, unknown> },
) {
  const template = commandCenterConfig.connections.instances.detailUrl.trim();
  return requestJson<ConnectionInstance>(applyTemplate(template, { uid }), {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteConnectionInstance(uid: string) {
  const template = commandCenterConfig.connections.instances.detailUrl.trim();
  return requestJson<void>(applyTemplate(template, { uid }), {
    method: "DELETE",
  });
}

export function testConnection(uid: string) {
  const template = commandCenterConfig.connections.instances.testUrl.trim();
  return requestJson<ConnectionHealthResult>(applyTemplate(template, { uid }), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function queryConnection<
  TQuery = Record<string, unknown>,
  TResponse = ConnectionQueryResponse,
>(
  request: ConnectionQueryRequest<TQuery>,
  traceMeta?: DashboardRequestTraceMeta,
) {
  const template = commandCenterConfig.connections.instances.queryUrl.trim();
  return requestJson<TResponse>(
    applyTemplate(template, { uid: request.connectionUid }),
    {
      method: "POST",
      body: JSON.stringify(request),
    },
    traceMeta,
  );
}

export function fetchConnectionResource<TResponse = unknown>(
  request: ConnectionResourceRequest,
) {
  const template = commandCenterConfig.connections.instances.resourceUrl.trim();
  return requestJson<TResponse>(
    applyTemplate(template, {
      uid: request.connectionUid,
      resource: request.resource,
    }),
    {
      method: "POST",
      body: JSON.stringify(request.params ?? {}),
    },
  );
}

export function openConnectionStream(request: ConnectionStreamRequest) {
  const template = commandCenterConfig.connections.instances.streamUrl.trim();
  const endpoint = applyTemplate(template, { uid: request.connectionUid });
  const url = new URL(buildEndpointUrl(endpoint), window.location.origin);
  url.searchParams.set("channel", request.channel);

  if (request.params && Object.keys(request.params).length > 0) {
    url.searchParams.set("params", JSON.stringify(request.params));
  }

  return new EventSource(url.toString());
}
