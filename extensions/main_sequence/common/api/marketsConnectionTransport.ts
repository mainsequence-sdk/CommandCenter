import { fetchConnectionInstances, queryConnection } from "@/connections/api";
import type {
  ConnectionInstance,
  ConnectionQueryRequest,
} from "@/connections/types";
import type { DashboardRequestTraceMeta } from "@/dashboards/dashboard-request-trace";

import type {
  AdapterFromApiConnectionQuery,
  AdapterFromApiCompiledContract,
  AdapterFromApiOperationDefinition,
  AdapterFromApiParameterLocation,
  AdapterFromApiPublicConfig,
} from "../../../../connections/adapter-from-api";
import {
  discoverAdapterFromApiDirectContract,
  isAdapterFromApiDirectConnectionInstance,
  queryAdapterFromApiDirectRaw,
  type AdapterFromApiRawOperationResponse,
} from "../../../../connections/adapter-from-api/directTransport";
import {
  clearMainSequenceMarketsApiConnectionSessionCache,
  readMainSequenceMarketsApiConnectionSessionCache,
  resolveMainSequenceMarketsApiConnection,
  writeMainSequenceMarketsApiConnectionSessionCache,
} from "../connectionBindings";

export type MainSequenceMarketsTransportQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export interface MainSequenceMarketsConnectionRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  url: string;
}

export class MainSequenceMarketsConnectionTransportError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 0, details?: unknown) {
    super(message);
    this.name = "MainSequenceMarketsConnectionTransportError";
    this.status = status;
    this.details = details;
  }
}

let mainSequenceMarketsApiConnectionResolutionPromise: Promise<ConnectionInstance> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildLogicalRequestUrl(input: {
  baseUrl: string;
  endpoint: string;
  path?: string;
  search?: Record<string, MainSequenceMarketsTransportQueryValue>;
}) {
  const root = new URL(input.endpoint, input.baseUrl);
  const requestUrl = new URL((input.path ?? "").replace(/^\/+/, ""), root);

  Object.entries(input.search ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    requestUrl.searchParams.set(key, String(value));
  });

  return requestUrl;
}

function normalizePathname(pathname: string) {
  const normalized = `/${pathname.replace(/^\/+/, "")}`;
  return normalized.replace(/\/+$/, "") || "/";
}

export function isMainSequenceMarketsConnectionRequestUrl(url: URL) {
  const pathname = normalizePathname(url.pathname);
  return pathname === "/api/v1" || pathname.startsWith("/api/v1/");
}

function parseJsonRequestBody(
  body: BodyInit | null | undefined,
  input: {
    method: string;
    path: string;
  },
) {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === "string") {
    const trimmed = body.trim();

    if (!trimmed) {
      return undefined;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch (error) {
      throw new MainSequenceMarketsConnectionTransportError(
        `Main Sequence Markets ${input.method} ${input.path} must send a JSON request body when routed through Adapter From API.`,
        0,
        error,
      );
    }
  }

  throw new MainSequenceMarketsConnectionTransportError(
    `Main Sequence Markets ${input.method} ${input.path} uses a non-JSON request body that Adapter From API cannot replay.`,
    0,
    {
      method: input.method,
      path: input.path,
    },
  );
}

export function buildMainSequenceMarketsConnectionRequest(input: {
  baseUrl: string;
  endpoint: string;
  path?: string;
  init?: RequestInit;
  search?: Record<string, MainSequenceMarketsTransportQueryValue>;
}): MainSequenceMarketsConnectionRequest | null {
  const requestUrl = buildLogicalRequestUrl(input);

  if (!isMainSequenceMarketsConnectionRequestUrl(requestUrl)) {
    return null;
  }

  const method = (input.init?.method ?? "GET").toUpperCase();
  const path = requestUrl.pathname || "/";

  return {
    method,
    path,
    query: requestUrl.searchParams,
    body: parseJsonRequestBody(input.init?.body, { method, path }),
    url: `${path}${requestUrl.search}`,
  };
}

function connectionName(connection: ConnectionInstance) {
  return connection.name?.trim() || `Connection ${String(connection.id)}`;
}

async function loadMainSequenceMarketsApiConnectionFromBackend() {
  const connections = await fetchConnectionInstances();
  const resolution = resolveMainSequenceMarketsApiConnection(connections);

  if (resolution.status === "resolved") {
    writeMainSequenceMarketsApiConnectionSessionCache(resolution.connection);
    return resolution.connection;
  }

  if (resolution.status === "duplicate") {
    throw new MainSequenceMarketsConnectionTransportError(
      `Multiple Adapter From API data sources are bound to Main Sequence Markets: ${resolution.connections
        .map(connectionName)
        .join(", ")}. Keep one binding in Admin Settings > Main Sequence Markets.`,
      409,
      {
        connectionIds: resolution.connections.map((connection) => connection.id),
      },
    );
  }

  throw new MainSequenceMarketsConnectionTransportError(
    "Main Sequence Markets API connection is not configured. Select an Adapter From API data source in Admin Settings > Main Sequence Markets.",
    404,
  );
}

async function resolveMainSequenceMarketsApiConnectionForRequest(options?: {
  bypassSessionCache?: boolean;
}) {
  if (!options?.bypassSessionCache) {
    const cachedConnection = readMainSequenceMarketsApiConnectionSessionCache();

    if (cachedConnection) {
      return cachedConnection;
    }
  }

  if (options?.bypassSessionCache) {
    return loadMainSequenceMarketsApiConnectionFromBackend();
  }

  if (!mainSequenceMarketsApiConnectionResolutionPromise) {
    mainSequenceMarketsApiConnectionResolutionPromise =
      loadMainSequenceMarketsApiConnectionFromBackend().finally(() => {
        mainSequenceMarketsApiConnectionResolutionPromise = null;
      });
  }

  return mainSequenceMarketsApiConnectionResolutionPromise;
}

function readTransportModeLabel(connection: ConnectionInstance) {
  return connection.publicConfig.transportMode === "direct"
    ? "direct debug"
    : "backend proxy";
}

function readConfiguredApiRoot(connection: ConnectionInstance) {
  return connection.publicConfig.transportMode === "direct"
    ? connection.publicConfig.debugApiBaseUrl
    : connection.publicConfig.apiBaseUrl;
}

function hasCompiledContract(connection: ConnectionInstance) {
  return isRecord((connection.publicConfig as AdapterFromApiPublicConfig).compiledContract);
}

async function hydrateDirectConnectionContractIfNeeded(
  connection: ConnectionInstance,
  options?: {
    signal?: AbortSignal;
  },
) {
  if (!isAdapterFromApiDirectConnectionInstance(connection) || hasCompiledContract(connection)) {
    return connection;
  }

  const debugApiBaseUrl = connection.publicConfig.debugApiBaseUrl;

  if (typeof debugApiBaseUrl !== "string" || !debugApiBaseUrl.trim()) {
    return connection;
  }

  const discovery = await discoverAdapterFromApiDirectContract(debugApiBaseUrl, {
    signal: options?.signal,
  });
  const hydratedConnection = {
    ...connection,
    publicConfig: {
      ...connection.publicConfig,
      debugApiBaseUrl: discovery.apiBaseUrl,
      contractDefinitionUrl: discovery.contractDefinitionUrl,
      openApiUrl: discovery.openApiUrl,
      compiledContract: discovery.compiledContract,
      compiledContractSource: "direct",
      compiledContractSourceUrl: discovery.contractDefinitionUrl,
    } satisfies AdapterFromApiPublicConfig,
  };

  writeMainSequenceMarketsApiConnectionSessionCache(hydratedConnection);
  return hydratedConnection;
}

function createMissingCompiledContractError(
  connection: ConnectionInstance,
  request: MainSequenceMarketsConnectionRequest,
) {
  const transportMode = readTransportModeLabel(connection);
  const configuredRoot = readConfiguredApiRoot(connection);
  const action =
    connection.publicConfig.transportMode === "direct"
      ? "The browser tried to discover the direct debug contract automatically but no compiled contract is available. Check that the direct debug API root is set, the /.well-known/command-center/connection-contract endpoint is browser-readable with CORS, then save the data source."
      : "Open Data Sources, edit this Adapter From API data source, confirm the backend API root URL, then save the data source so the backend discovers and stores the contract.";
  const rootText =
    typeof configuredRoot === "string" && configuredRoot.trim()
      ? ` Configured API root: ${configuredRoot.trim()}.`
      : " No API root URL is stored on the selected data source.";

  return new MainSequenceMarketsConnectionTransportError(
    `Cannot run ${request.method} ${request.path}: the bound Main Sequence Markets data source '${connectionName(connection)}' has no discovered Adapter From API contract. ${action} Transport mode: ${transportMode}.${rootText} Connection id: ${String(connection.id)}.`,
    400,
    {
      reason: "missing_compiled_contract",
      connectionId: connection.id,
      connectionName: connectionName(connection),
      transportMode,
      configuredRoot,
      method: request.method,
      path: request.path,
    },
  );
}

function isMissingCompiledContractError(error: unknown) {
  return (
    error instanceof MainSequenceMarketsConnectionTransportError &&
    isRecord(error.details) &&
    error.details.reason === "missing_compiled_contract"
  );
}

function isOperationNotFoundError(error: unknown) {
  return (
    error instanceof MainSequenceMarketsConnectionTransportError &&
    isRecord(error.details) &&
    error.details.reason === "operation_not_found"
  );
}

function readCompiledContract(
  connection: ConnectionInstance,
  request: MainSequenceMarketsConnectionRequest,
): AdapterFromApiCompiledContract {
  const publicConfig = connection.publicConfig as AdapterFromApiPublicConfig;
  const compiledContract = publicConfig.compiledContract;

  if (!isRecord(compiledContract)) {
    throw createMissingCompiledContractError(connection, request);
  }

  return compiledContract;
}

function isOperationDefinition(value: unknown): value is AdapterFromApiOperationDefinition {
  return (
    isRecord(value) &&
    typeof value.operationId === "string" &&
    typeof value.method === "string" &&
    typeof value.path === "string"
  );
}

function pathSegments(pathname: string) {
  return normalizePathname(pathname)
    .split("/")
    .filter(Boolean);
}

function matchOperationPath(
  operation: AdapterFromApiOperationDefinition,
  requestPath: string,
): Record<string, unknown> | null {
  const templatePath = operation.path;
  const templateSegments = pathSegments(templatePath);
  const requestSegments = pathSegments(requestPath);

  if (templateSegments.length !== requestSegments.length) {
    return null;
  }

  const pathValues: Record<string, unknown> = {};

  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index]!;
    const requestSegment = requestSegments[index]!;
    const parameterMatch = templateSegment.match(/^\{([^}]+)\}$/);

    if (parameterMatch) {
      const parameterName = parameterMatch[1]!;
      const definition = operation.parameters?.path?.find(
        (candidate) =>
          candidate.key === parameterName ||
          (candidate.name ?? candidate.key) === parameterName,
      );

      pathValues[definition?.key ?? parameterName] = decodeURIComponent(requestSegment);
      continue;
    }

    if (templateSegment !== requestSegment) {
      return null;
    }
  }

  return pathValues;
}

function operationPathSpecificity(operation: AdapterFromApiOperationDefinition) {
  return pathSegments(operation.path).filter((segment) => !/^\{[^}]+\}$/.test(segment)).length;
}

function findOperationForRequest(
  connection: ConnectionInstance,
  request: MainSequenceMarketsConnectionRequest,
) {
  const compiledContract = readCompiledContract(connection, request);
  const operations = Array.isArray(compiledContract.availableOperations)
    ? compiledContract.availableOperations
    : [];
  const matches = operations.flatMap((operation) => {
    if (!isOperationDefinition(operation)) {
      return [];
    }

    if (operation.method.toUpperCase() !== request.method) {
      return [];
    }

    const pathValues = matchOperationPath(operation, request.path);

    if (!pathValues) {
      return [];
    }

    return [{ operation, pathValues }];
  });

  matches.sort(
    (left, right) =>
      operationPathSpecificity(right.operation) - operationPathSpecificity(left.operation),
  );

  const match = matches[0];

  if (!match) {
    throw new MainSequenceMarketsConnectionTransportError(
      `The Main Sequence Markets data source '${connectionName(connection)}' contract does not expose ${request.method} ${request.path}.`,
      400,
      {
        reason: "operation_not_found",
        connectionId: connection.id,
        connectionName: connectionName(connection),
        method: request.method,
        path: request.path,
        availableOperations: operations
          .filter(isOperationDefinition)
          .map((operation) => ({
            operationId: operation.operationId,
            method: operation.method,
            path: operation.path,
          })),
      },
    );
  }

  return match;
}

function parameterKeyForName(
  operation: AdapterFromApiOperationDefinition,
  location: AdapterFromApiParameterLocation,
  name: string,
) {
  const definition = operation.parameters?.[location]?.find(
    (candidate) => candidate.key === name || (candidate.name ?? candidate.key) === name,
  );

  return definition?.key ?? name;
}

function buildQueryParameters(
  operation: AdapterFromApiOperationDefinition,
  searchParams: URLSearchParams,
) {
  const queryParameters: Record<string, unknown> = {};

  searchParams.forEach((value, name) => {
    queryParameters[parameterKeyForName(operation, "query", name)] = value;
  });

  return queryParameters;
}

export function buildMainSequenceMarketsConnectionQueryRequest(
  connection: ConnectionInstance,
  request: MainSequenceMarketsConnectionRequest,
): ConnectionQueryRequest<AdapterFromApiConnectionQuery> {
  const { operation, pathValues } = findOperationForRequest(connection, request);

  return {
    connectionId: connection.id,
    query: {
      kind: "api-operation",
      operationId: operation.operationId,
      parameters: {
        path: pathValues,
        query: buildQueryParameters(operation, request.query),
        headers: {},
      },
      body: request.body,
    },
    cacheMode: request.method === "GET" ? "default" : "bypass",
  };
}

function hasBodyField(value: unknown): value is { body: unknown } {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, "body");
}

export function unwrapAdapterFromApiRawOperationBody(payload: unknown) {
  const result = isRecord(payload) ? payload.result : undefined;

  if (hasBodyField(result)) {
    return result.body;
  }

  throw new MainSequenceMarketsConnectionTransportError(
    "Adapter From API did not return a raw operation body for Main Sequence Markets.",
    502,
    payload,
  );
}

function isLikelyStaleConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes("connection") &&
    (normalized.includes("not found") ||
      normalized.includes("does not exist") ||
      normalized.includes("unknown"))
  );
}

export async function requestMainSequenceMarketsConnectionJson<T>(
  request: MainSequenceMarketsConnectionRequest,
  options?: {
    traceMeta?: DashboardRequestTraceMeta;
    signal?: AbortSignal;
  },
): Promise<T> {
  async function refreshConnectionForContractMiss(connection: ConnectionInstance) {
    clearMainSequenceMarketsApiConnectionSessionCache();

    if (isAdapterFromApiDirectConnectionInstance(connection)) {
      return hydrateDirectConnectionContractIfNeeded(
        {
          ...connection,
          publicConfig: {
            ...connection.publicConfig,
            compiledContract: undefined,
            compiledContractSource: undefined,
            compiledContractSourceUrl: undefined,
          },
        },
        {
          signal: options?.signal,
        },
      );
    }

    return resolveMainSequenceMarketsApiConnectionForRequest({
      bypassSessionCache: true,
    });
  }

  async function executeWithConnection(connection: ConnectionInstance) {
    const hydratedConnection = await hydrateDirectConnectionContractIfNeeded(connection, {
      signal: options?.signal,
    });
    const connectionRequest = buildMainSequenceMarketsConnectionQueryRequest(
      hydratedConnection,
      request,
    );
    const rawResponse = isAdapterFromApiDirectConnectionInstance(hydratedConnection)
      ? await queryAdapterFromApiDirectRaw(hydratedConnection, connectionRequest, {
          signal: options?.signal,
          allowNonQueryOperation: true,
        })
      : await queryConnection<
          AdapterFromApiConnectionQuery,
          AdapterFromApiRawOperationResponse
        >(connectionRequest, options?.traceMeta, {
          signal: options?.signal,
        });

    return unwrapAdapterFromApiRawOperationBody(rawResponse) as T;
  }

  try {
    const connection = await resolveMainSequenceMarketsApiConnectionForRequest();

    try {
      return await executeWithConnection(connection);
    } catch (error) {
      if (!isMissingCompiledContractError(error) && !isOperationNotFoundError(error)) {
        throw error;
      }

      const refreshedConnection = await refreshConnectionForContractMiss(connection);
      return executeWithConnection(refreshedConnection);
    }
  } catch (error) {
    if (isLikelyStaleConnectionError(error)) {
      clearMainSequenceMarketsApiConnectionSessionCache();
    }

    if (error instanceof MainSequenceMarketsConnectionTransportError) {
      throw error;
    }

    throw new MainSequenceMarketsConnectionTransportError(
      error instanceof Error
        ? error.message
        : "Main Sequence Markets Adapter From API request failed.",
      0,
      error,
    );
  }
}
