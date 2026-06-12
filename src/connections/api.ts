import {
  DEFAULT_WEBSOCKET_TICKET_AUDIENCE,
  requestWebSocketTicket,
  type WebSocketTicketRequestInput,
  type WebSocketTicketResponse,
} from "@/auth/api";
import { useAuthStore } from "@/auth/auth-store";
import { buildSessionAuthHeaderRecord } from "@/auth/session-headers";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import {
  startDashboardRequestTrace,
  type DashboardRequestTraceMeta,
} from "@/dashboards/dashboard-request-trace";
import { resolveConnectionRefSelection } from "@/connections/connectionRefResolution";
import {
  buildMockApiConnectionInstance,
  executeMockApiConnectionQuery,
  isMockApiConnectionId,
  isMockApiConnectionRef,
  testMockApiConnection,
  withMockApiConnectionInstance,
  withMockApiConnectionType,
} from "@/connections/mock-api";
import { assertConnectionQueryModelStreamable } from "@/connections/types";
import type {
  ConnectionId,
  ConnectionHealthResult,
  ConnectionInstance,
  ConnectionQueryModel,
  ConnectionQueryRequest,
  ConnectionQueryResponse,
  ConnectionRef,
  ConnectionResourceRequest,
  ConnectionStreamQueryRequest,
  ConnectionStreamRequest,
  ConnectionStreamServerMessage,
  ConnectionStreamSubscribeMessage,
  AnyConnectionTypeDefinition,
} from "@/connections/types";

const devAuthProxyPrefix = "/__command_center_auth__";

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

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function isConnectionId(value: unknown): value is ConnectionId {
  return (
    typeof value === "string" ||
    (typeof value === "number" && Number.isSafeInteger(value))
  );
}

function assertString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Connection stream message is missing ${field}.`);
  }
}

function assertSequence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Connection stream message is missing sequence.");
  }
}

function assertConnectionId(value: unknown) {
  if (!isConnectionId(value)) {
    throw new Error("Connection stream message is missing connectionId.");
  }
}

function readConnectionStreamMessageConnectionId(
  payload: Record<string, unknown>,
  options?: {
    allowMissingConnectionId?: boolean;
  },
) {
  const connectionId = isConnectionId(payload.connectionId)
    ? payload.connectionId
    : isConnectionId(payload.connectionUid)
      ? payload.connectionUid
      : options?.allowMissingConnectionId
        ? "public"
        : payload.connectionId;

  assertConnectionId(connectionId);
  return connectionId;
}

function assertConnectionQueryResponse(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.frames)) {
    throw new Error("Connection stream data message is missing response frames.");
  }
}

export function buildWebSocketEndpointUrl(
  path: string,
  options?: {
    apiBaseUrl?: string;
  },
) {
  if (!path.trim()) {
    throw new Error("Command Center WebSocket endpoint is not configured.");
  }

  const url = new URL(path, options?.apiBaseUrl ?? env.apiBaseUrl);

  if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error(`Unsupported WebSocket endpoint protocol: ${url.protocol}`);
  }

  return url.toString();
}

export function buildConnectionQueryWebSocketUrl(
  connectionId: ConnectionId,
  options?: {
    apiBaseUrl?: string;
    webSocketTicket?: string;
  },
) {
  const template = commandCenterConfig.connections.instances.streamQueryUrl.trim();

  if (!template) {
    throw new Error("Command Center connection stream query endpoint is not configured.");
  }

  const url = new URL(
    buildWebSocketEndpointUrl(
      applyTemplate(template, createConnectionEndpointTemplateValues(connectionId)),
      options,
    ),
  );

  if (options?.webSocketTicket) {
    url.searchParams.set("ws_ticket", options.webSocketTicket);
  }

  return url.toString();
}

export function buildConnectionQueryUrl(
  connectionId: ConnectionId,
  options?: {
    apiBaseUrl?: string;
  },
) {
  const template = commandCenterConfig.connections.instances.queryUrl.trim();

  if (!template) {
    throw new Error("Command Center connection query endpoint is not configured.");
  }

  return buildEndpointUrl(
    applyTemplate(template, createConnectionEndpointTemplateValues(connectionId)),
  );
}

export type ConnectionWebSocketTicketProvider = (
  input?: WebSocketTicketRequestInput,
) => Promise<WebSocketTicketResponse>;

export interface ConnectionQueryWebSocketAuthenticationOptions
  extends OpenConnectionQueryWebSocketOptions {
  ticketAudience?: string;
  ticketProvider?: ConnectionWebSocketTicketProvider;
}

export interface PublicConnectionQueryWebSocketOptions
  extends OpenConnectionQueryWebSocketOptions {
  streamUrl: string;
  subscriptionId: string;
  widgetInstanceId: string;
  capability: string;
}

export async function requestConnectionQueryWebSocketTicket(
  options?: Pick<ConnectionQueryWebSocketAuthenticationOptions, "ticketAudience" | "ticketProvider">,
) {
  const provider = options?.ticketProvider ?? requestWebSocketTicket;

  return provider({
    audience: options?.ticketAudience ?? DEFAULT_WEBSOCKET_TICKET_AUDIENCE,
  });
}

export async function createAuthenticatedConnectionQueryWebSocketSubscription<
  TQuery = Record<string, unknown>,
>(
  request: ConnectionStreamQueryRequest<TQuery>,
  handlers: ConnectionQueryWebSocketHandlers,
  options: ConnectionQueryWebSocketAuthenticationOptions,
): Promise<ConnectionQueryWebSocketSubscription> {
  assertConnectionQueryModelStreamable(options.queryModel);
  const ticketUrl = buildEndpointUrl(commandCenterConfig.auth.websocketTicketUrl.trim());

  options.onLifecycleEvent?.({
    type: "ticket-request-start",
    url: ticketUrl,
  });

  const ticket = await requestConnectionQueryWebSocketTicket({
    ticketAudience: options.ticketAudience,
    ticketProvider: options.ticketProvider,
  });

  options.onLifecycleEvent?.({
    type: "ticket-response",
    url: ticketUrl,
    audience: ticket.audience,
    expiresAt: ticket.expiresAt,
  });

  return createConnectionQueryWebSocketSubscription(request, handlers, {
    ...options,
    webSocketTicket: ticket.ticket,
  });
}

export function openPublicConnectionQueryWebSocket<TRequest extends Record<string, unknown> = Record<string, unknown>>(
  request: TRequest,
  options: PublicConnectionQueryWebSocketOptions,
) {
  assertConnectionQueryModelStreamable(options.queryModel);

  const url = buildWebSocketEndpointUrl(options.streamUrl, {
    apiBaseUrl: options.apiBaseUrl,
  });
  const factory = options.webSocketFactory ?? openDefaultWebSocket;

  return factory(url, options.protocols);
}

export function createPublicConnectionQueryWebSocketSubscription<
  TRequest extends Record<string, unknown> = Record<string, unknown>,
>(
  request: TRequest,
  handlers: ConnectionQueryWebSocketHandlers,
  options: PublicConnectionQueryWebSocketOptions,
): ConnectionQueryWebSocketSubscription {
  const socket = openPublicConnectionQueryWebSocket(request, options);
  const socketUrl = socket.url;
  let closed = false;

  options.onLifecycleEvent?.({
    type: "socket-connect-start",
    url: socketUrl,
  });

  socket.onopen = (event) => {
    if (closed) {
      return;
    }

    socket.send(JSON.stringify({
      type: "subscribe",
      subscriptionId: options.subscriptionId,
      widgetInstanceId: options.widgetInstanceId,
      capability: options.capability,
      request,
    }));
    options.onLifecycleEvent?.({
      type: "socket-open",
      url: socketUrl,
    });
    options.onLifecycleEvent?.({
      type: "subscribe-sent",
      url: socketUrl,
    });
    handlers.onOpen?.(event);
  };

  socket.onmessage = (event) => {
    if (closed) {
      return;
    }

    try {
      handlers.onMessage(
        parseConnectionStreamServerMessage(event.data, {
          allowMissingConnectionId: true,
        }),
        event,
      );
    } catch (error) {
      handlers.onParseError?.(toError(error), event);
    }
  };

  socket.onerror = (event) => {
    if (!closed) {
      options.onLifecycleEvent?.({
        type: "socket-error",
        url: socketUrl,
      });
      handlers.onError?.(event);
    }
  };

  socket.onclose = (event) => {
    if (!closed) {
      options.onLifecycleEvent?.({
        type: "socket-close",
        url: socketUrl,
        code: event.code,
        reason: event.reason,
      });
      handlers.onClose?.(event);
    }
  };

  return {
    socket,
    close(code = 1000, reason = "closed") {
      if (closed) {
        return;
      }

      closed = true;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (socket.readyState === 1) {
        try {
          socket.send(
            JSON.stringify({
              type: "unsubscribe",
              subscriptionId: options.subscriptionId,
            }),
          );
        } catch {
          // Ignore best-effort public unsubscribe failures and continue closing the socket.
        }
      }

      if (socket.readyState !== 2 && socket.readyState !== 3) {
        socket.close(code, reason);
      }
    },
  };
}

export function buildConnectionStreamSubscribeMessage<TQuery = Record<string, unknown>>(
  request: ConnectionStreamQueryRequest<TQuery>,
): ConnectionStreamSubscribeMessage<TQuery> {
  return {
    type: "subscribe",
    request: serializeConnectionStreamQueryRequest(request) as unknown as ConnectionStreamQueryRequest<TQuery>,
  };
}

export function parseConnectionStreamServerMessage(
  data: unknown,
  options?: {
    allowMissingConnectionId?: boolean;
  },
): ConnectionStreamServerMessage {
  const payload = typeof data === "string" ? JSON.parse(data) : data;

  if (!isRecord(payload) || typeof payload.type !== "string") {
    throw new Error("Connection stream message must be a JSON object with a type.");
  }

  switch (payload.type) {
    case "ack": {
      const connectionId = readConnectionStreamMessageConnectionId(payload, options);
      assertString(payload.queryKind, "queryKind");
      assertSequence(payload.sequence);
      assertString(payload.acceptedAt, "acceptedAt");
      return { ...payload, connectionId } as unknown as ConnectionStreamServerMessage;
    }
    case "snapshot":
    case "delta": {
      const connectionId = readConnectionStreamMessageConnectionId(payload, options);
      assertString(payload.queryKind, "queryKind");
      assertSequence(payload.sequence);
      assertString(payload.emittedAt, "emittedAt");
      assertConnectionQueryResponse(payload.response);
      return { ...payload, connectionId } as unknown as ConnectionStreamServerMessage;
    }
    case "heartbeat":
      assertSequence(payload.sequence);
      assertString(payload.emittedAt, "emittedAt");
      return payload as unknown as ConnectionStreamServerMessage;
    case "error":
      assertSequence(payload.sequence);
      assertString(payload.emittedAt, "emittedAt");
      assertString(payload.code, "code");
      assertString(payload.message, "message");
      if (typeof payload.retryable !== "boolean") {
        throw new Error("Connection stream error message is missing retryable.");
      }
      return payload as unknown as ConnectionStreamServerMessage;
    case "complete":
      assertSequence(payload.sequence);
      assertString(payload.emittedAt, "emittedAt");
      return payload as unknown as ConnectionStreamServerMessage;
    default:
      throw new Error(`Unsupported connection stream message type: ${payload.type}`);
  }
}

export interface OpenConnectionQueryWebSocketOptions {
  apiBaseUrl?: string;
  protocols?: string | string[];
  queryModel: ConnectionQueryModel | null | undefined;
  webSocketFactory?: ConnectionWebSocketFactory;
  webSocketTicket?: string;
  onLifecycleEvent?: (event: ConnectionQueryWebSocketLifecycleEvent) => void;
}

export interface ConnectionQueryWebSocketHandlers {
  onOpen?: (event: Event) => void;
  onMessage: (message: ConnectionStreamServerMessage, event: MessageEvent) => void;
  onParseError?: (error: Error, event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

export interface ConnectionQueryWebSocketSubscription {
  socket: WebSocket;
  close: (code?: number, reason?: string) => void;
}

export type ConnectionQueryWebSocketLifecycleEvent =
  | {
      type: "ticket-request-start";
      url: string;
    }
  | {
      type: "ticket-response";
      url: string;
      audience: string;
      expiresAt: string;
    }
  | {
      type: "socket-connect-start";
      url: string;
    }
  | {
      type: "socket-open";
      url: string;
    }
  | {
      type: "subscribe-sent";
      url: string;
    }
  | {
      type: "socket-error";
      url: string;
    }
  | {
      type: "socket-close";
      url: string;
      code: number;
      reason: string;
    };

export type ConnectionWebSocketFactory = (
  url: string,
  protocols?: string | string[],
) => WebSocket;

function openDefaultWebSocket(url: string, protocols?: string | string[]) {
  const WebSocketCtor = globalThis.WebSocket;

  if (typeof WebSocketCtor !== "function") {
    throw new Error("WebSocket is not available in this browser runtime.");
  }

  return protocols === undefined
    ? new WebSocketCtor(url)
    : new WebSocketCtor(url, protocols);
}

export function openConnectionQueryWebSocket<TQuery = Record<string, unknown>>(
  request: ConnectionStreamQueryRequest<TQuery>,
  options: OpenConnectionQueryWebSocketOptions,
) {
  assertConnectionQueryModelStreamable(options.queryModel);

  const url = buildConnectionQueryWebSocketUrl(request.connectionId, {
    apiBaseUrl: options.apiBaseUrl,
    webSocketTicket: options.webSocketTicket,
  });
  const factory = options.webSocketFactory ?? openDefaultWebSocket;

  return factory(url, options.protocols);
}

export function createConnectionQueryWebSocketSubscription<
  TQuery = Record<string, unknown>,
>(
  request: ConnectionStreamQueryRequest<TQuery>,
  handlers: ConnectionQueryWebSocketHandlers,
  options: OpenConnectionQueryWebSocketOptions,
): ConnectionQueryWebSocketSubscription {
  const socket = openConnectionQueryWebSocket(request, options);
  const socketUrl = socket.url;
  let closed = false;

  options.onLifecycleEvent?.({
    type: "socket-connect-start",
    url: socketUrl,
  });

  socket.onopen = (event) => {
    if (closed) {
      return;
    }

    socket.send(JSON.stringify(buildConnectionStreamSubscribeMessage(request)));
    options.onLifecycleEvent?.({
      type: "socket-open",
      url: socketUrl,
    });
    options.onLifecycleEvent?.({
      type: "subscribe-sent",
      url: socketUrl,
    });
    handlers.onOpen?.(event);
  };

  socket.onmessage = (event) => {
    if (closed) {
      return;
    }

    try {
      handlers.onMessage(parseConnectionStreamServerMessage(event.data), event);
    } catch (error) {
      handlers.onParseError?.(toError(error), event);
    }
  };

  socket.onerror = (event) => {
    if (!closed) {
      options.onLifecycleEvent?.({
        type: "socket-error",
        url: socketUrl,
      });
      handlers.onError?.(event);
    }
  };

  socket.onclose = (event) => {
    if (!closed) {
      options.onLifecycleEvent?.({
        type: "socket-close",
        url: socketUrl,
        code: event.code,
        reason: event.reason,
      });
      handlers.onClose?.(event);
    }
  };

  return {
    socket,
    close(code = 1000, reason = "closed") {
      if (closed) {
        return;
      }

      closed = true;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (socket.readyState !== 2 && socket.readyState !== 3) {
        socket.close(code, reason);
      }
    },
  };
}

function getSessionHeaders() {
  const session = useAuthStore.getState().session;

  if (!session?.token) {
    return {};
  }

  return buildSessionAuthHeaderRecord(session);
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

async function requestPublicJson<T>(
  path: string,
  init?: RequestInit,
  traceMeta?: DashboardRequestTraceMeta,
): Promise<T> {
  if (!path.trim()) {
    throw new Error("Command Center public connection endpoint is not configured.");
  }

  const requestUrl = buildEndpointUrl(path);
  const requestTrace = startDashboardRequestTrace(traceMeta, {
    method: init?.method,
    url: requestUrl,
  });

  let response: Response;

  try {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");

    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    response = await fetch(requestUrl, {
      ...init,
      headers,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "The browser could not reach the public connection endpoint.";

    requestTrace?.fail(errorMessage);
    throw error;
  }

  let payload: unknown;

  try {
    payload = await readResponsePayload(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Public connection response could not be read.";

    requestTrace?.finish({
      error: errorMessage,
      ok: false,
      status: response.status,
    });
    throw error;
  }

  if (!response.ok) {
    const errorMessage =
      readErrorMessage(payload) || `Public connection request failed with ${response.status}.`;

    requestTrace?.finish({
      error: errorMessage,
      ok: false,
      status: response.status,
      responseBody: payload,
    });

    throw new Error(errorMessage);
  }

  requestTrace?.finish({
    ok: true,
    status: response.status,
    responseBody: payload,
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

function normalizeConnectionInstancePayload(instance: ConnectionInstance): ConnectionInstance | null {
  const record = instance as unknown as Record<string, unknown>;
  const id = normalizeIdentifier(record.id) ?? normalizeIdentifier(record.uid);

  if (!id) {
    return null;
  }

  return {
    ...instance,
    id,
  };
}

function normalizeConnectionInstanceList(payload: unknown) {
  return normalizeListPayload<ConnectionInstance>(payload).flatMap((instance) => {
    const normalizedInstance = normalizeConnectionInstancePayload(instance);
    return normalizedInstance ? [normalizedInstance] : [];
  });
}

export function createConnectionRef(id: ConnectionId, typeId: string): ConnectionRef {
  return { id, typeId };
}

function createConnectionInstanceTemplateValues(id: ConnectionId) {
  return {
    uid: id,
  };
}

function createConnectionEndpointTemplateValues(connectionId: ConnectionId) {
  return {
    uid: connectionId,
    connectionUid: connectionId,
  };
}

function serializeConnectionQueryRequest<TQuery = Record<string, unknown>>(
  request: ConnectionQueryRequest<TQuery>,
) {
  const { connectionId, ...rest } = request;

  return {
    ...rest,
    connectionUid: connectionId,
  };
}

function serializeConnectionStreamQueryRequest<TQuery = Record<string, unknown>>(
  request: ConnectionStreamQueryRequest<TQuery>,
) {
  const { connectionId, ...rest } = request;

  return {
    ...rest,
    connectionUid: connectionId,
  };
}

export function normalizeConnectionRef(
  value: unknown,
  fallback?: ConnectionRef,
): ConnectionRef | undefined {
  if (isRecord(value)) {
    const id = normalizeIdentifier(value.id) ?? normalizeIdentifier(value.uid);
    const typeId = typeof value.typeId === "string" ? value.typeId.trim() : "";

    if (id && typeId) {
      return { id, typeId };
    }
  }

  return fallback;
}

export async function fetchConnectionTypes(): Promise<AnyConnectionTypeDefinition[]> {
  const path = commandCenterConfig.connections.types.listUrl.trim();

  if (env.useMockData || !path) {
    return withMockApiConnectionType([]);
  }

  const payload = await requestJson<unknown>(path);
  return withMockApiConnectionType(normalizeListPayload<AnyConnectionTypeDefinition>(payload));
}

export async function fetchConnectionInstances(): Promise<ConnectionInstance[]> {
  const path = commandCenterConfig.connections.instances.listUrl.trim();

  if (env.useMockData || !path) {
    return withMockApiConnectionInstance([]);
  }

  const payload = await requestJson<unknown>(path);
  return withMockApiConnectionInstance(normalizeConnectionInstanceList(payload));
}

export async function resolveConnectionRefFromInstances(
  requestedRef: ConnectionRef | undefined,
  options?: {
    preferredInstance?: ConnectionInstance;
    allowFetch?: boolean;
  },
) {
  if (isMockApiConnectionRef(requestedRef)) {
    const instance = buildMockApiConnectionInstance();

    return {
      connectionRef: { id: instance.id, typeId: instance.typeId },
      connectionInstance: instance,
      repaired: false,
    };
  }

  let backendInstances: ConnectionInstance[] = [];

  if (options?.allowFetch !== false) {
    try {
      backendInstances = await fetchConnectionInstances();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Unable to load configured connections from the backend.";
      throw new Error(message);
    }
  }

  return resolveConnectionRefSelection({
    requestedRef,
    preferredInstance: options?.preferredInstance,
    backendInstances,
  });
}

export async function fetchConnectionInstance(id: ConnectionId) {
  const template = commandCenterConfig.connections.instances.detailUrl.trim();
  const payload = await requestJson<ConnectionInstance>(
    applyTemplate(template, createConnectionInstanceTemplateValues(id)),
  );
  const normalizedPayload = normalizeConnectionInstancePayload(payload);

  if (!normalizedPayload) {
    throw new Error("Connection instance response did not include an id.");
  }

  return normalizedPayload;
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
  ).then((payload) => {
    const normalizedPayload = normalizeConnectionInstancePayload(payload);

    if (!normalizedPayload) {
      throw new Error("Connection instance response did not include an id.");
    }

    return normalizedPayload;
  });
}

export function updateConnectionInstance(
  id: ConnectionId,
  input: Partial<ConnectionInstance> & { secureConfig?: Record<string, unknown> },
) {
  const template = commandCenterConfig.connections.instances.detailUrl.trim();
  return requestJson<ConnectionInstance>(
    applyTemplate(template, createConnectionInstanceTemplateValues(id)),
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  ).then((payload) => {
    const normalizedPayload = normalizeConnectionInstancePayload(payload);

    if (!normalizedPayload) {
      throw new Error("Connection instance response did not include an id.");
    }

    return normalizedPayload;
  });
}

export function deleteConnectionInstance(id: ConnectionId) {
  const template = commandCenterConfig.connections.instances.detailUrl.trim();
  return requestJson<void>(applyTemplate(template, createConnectionInstanceTemplateValues(id)), {
    method: "DELETE",
  });
}

export function testConnection(id: ConnectionId) {
  if (isMockApiConnectionId(id)) {
    return testMockApiConnection();
  }

  const template = commandCenterConfig.connections.instances.testUrl.trim();
  return requestJson<ConnectionHealthResult>(
    applyTemplate(template, createConnectionInstanceTemplateValues(id)),
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function queryConnection<
  TQuery = Record<string, unknown>,
  TResponse = ConnectionQueryResponse,
>(
  request: ConnectionQueryRequest<TQuery>,
  traceMeta?: DashboardRequestTraceMeta,
  options?: {
    signal?: AbortSignal;
  },
) {
  if (isMockApiConnectionId(request.connectionId)) {
    return executeMockApiConnectionQuery(
      request as unknown as ConnectionQueryRequest<Record<string, unknown>>,
    ) as Promise<TResponse>;
  }

  const template = commandCenterConfig.connections.instances.queryUrl.trim();
  return requestJson<TResponse>(
    applyTemplate(template, createConnectionEndpointTemplateValues(request.connectionId)),
    {
      method: "POST",
      body: JSON.stringify(serializeConnectionQueryRequest(request)),
      signal: options?.signal,
    },
    traceMeta,
  );
}

export function queryPublicWidgetExecution<
  TRequest extends Record<string, unknown>,
  TResponse = ConnectionQueryResponse,
>(
  queryUrl: string,
  request: TRequest,
  traceMeta?: DashboardRequestTraceMeta,
  options?: {
    signal?: AbortSignal;
  },
) {
  return requestPublicJson<TResponse>(
    queryUrl,
    {
      method: "POST",
      body: JSON.stringify(request),
      signal: options?.signal,
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
      ...createConnectionEndpointTemplateValues(request.connectionId),
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
  const endpoint = applyTemplate(template, {
    ...createConnectionEndpointTemplateValues(request.connectionId),
  });
  const url = new URL(buildEndpointUrl(endpoint), window.location.origin);
  url.searchParams.set("channel", request.channel);

  if (request.params && Object.keys(request.params).length > 0) {
    url.searchParams.set("params", JSON.stringify(request.params));
  }

  return new EventSource(url.toString());
}
