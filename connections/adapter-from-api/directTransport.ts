import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import type {
  AdapterFromApiCompiledContract,
  AdapterFromApiConnectionQuery,
  AdapterFromApiFieldType,
  AdapterFromApiLogo,
  AdapterFromApiOperationDefinition,
  AdapterFromApiOperationParameter,
  AdapterFromApiParameterLocation,
  AdapterFromApiPublicConfig,
  AdapterFromApiResponseMapping,
  AdapterFromApiSecretDefinition,
  AdapterFromApiTransportMode,
  AdapterFromApiVariableDefinition,
} from "./index";
import type {
  CommandCenterFrame,
  CommandCenterFrameFieldType,
  ConnectionId,
  ConnectionInstance,
  ConnectionHealthResult,
  ConnectionQueryRequest,
  ConnectionQueryResponse,
} from "@/connections/types";

const WELL_KNOWN_CONTRACT_PATH = "/.well-known/command-center/connection-contract";
const DEFAULT_OPENAPI_PATH = "/openapi.json";
const OPTIONAL_OPENAPI_DISCOVERY_TIMEOUT_MS = 1000;
const ADAPTER_FROM_API_CONNECTION_TYPE_ID = "command_center.adapter_from_api";
const ADAPTER_FROM_API_QUERY_KIND = "api-operation";
const DIRECT_DISCOVERY_SESSION_CACHE_PREFIX =
  "command-center:adapter-from-api:direct-discovery:";
const SUPPORTED_OPERATION_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
const BLOCKED_USER_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
]);
const SUPPORTED_FIELD_TYPES = new Set<AdapterFromApiFieldType>([
  "string",
  "number",
  "boolean",
  "select",
  "json",
  "secret",
]);
const SUPPORTED_PARAMETER_TYPES = new Set<Exclude<AdapterFromApiFieldType, "secret">>([
  "string",
  "number",
  "boolean",
  "select",
  "json",
]);

export interface AdapterFromApiDirectDiscoveryResult {
  apiBaseUrl: string;
  contractDefinitionUrl: string;
  openApiUrl: string;
  compiledContract: AdapterFromApiCompiledContract;
}

export interface AdapterFromApiDirectDiscoverySessionCacheEntry
  extends AdapterFromApiDirectDiscoveryResult {
  cachedAt: string;
}

export interface AdapterFromApiRawOperationResponse {
  result: {
    operationId: string;
    statusCode: number;
    contentType: string;
    headers: Record<string, string>;
    body: unknown;
  };
  warnings: string[];
  traceId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sessionStorageOrNull() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function optionalBoundedString(value: unknown, maxLength: number) {
  const trimmed = optionalString(value);
  return trimmed && trimmed.length <= maxLength ? trimmed : undefined;
}

function optionalLogoBackgroundColor(value: unknown) {
  const candidate = optionalBoundedString(value, 80);

  if (
    candidate &&
    (/^#[0-9a-f]{3,8}$/i.test(candidate) ||
      /^rgba?\([\d\s,%.]+\)$/i.test(candidate) ||
      /^hsla?\([\d\s,%.]+deg?[\d\s,%.]*\)$/i.test(candidate) ||
      /^[a-z]+$/i.test(candidate))
  ) {
    return candidate;
  }

  return undefined;
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function directDiscoverySessionCacheKey(connectionId: ConnectionId) {
  return `${DIRECT_DISCOVERY_SESSION_CACHE_PREFIX}${String(connectionId)}`;
}

function isDirectDiscoveryCacheEntry(
  value: unknown,
): value is AdapterFromApiDirectDiscoverySessionCacheEntry {
  return (
    isRecord(value) &&
    typeof value.apiBaseUrl === "string" &&
    typeof value.contractDefinitionUrl === "string" &&
    typeof value.openApiUrl === "string" &&
    isRecord(value.compiledContract) &&
    typeof value.cachedAt === "string"
  );
}

function cacheEntryMatches(
  entry: AdapterFromApiDirectDiscoverySessionCacheEntry,
  input?: {
    apiBaseUrl?: string;
    contractVersion?: string;
  },
) {
  if (input?.apiBaseUrl) {
    try {
      if (
        normalizeAdapterFromApiRootUrl(entry.apiBaseUrl) !==
        normalizeAdapterFromApiRootUrl(input.apiBaseUrl)
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (input?.contractVersion?.trim()) {
    return String(entry.compiledContract.contractVersion) === input.contractVersion.trim();
  }

  return true;
}

export function readAdapterFromApiDirectDiscoverySessionCache(
  connectionId: ConnectionId | undefined,
  input?: {
    apiBaseUrl?: string;
    contractVersion?: string;
  },
) {
  if (connectionId === undefined || connectionId === null) {
    return undefined;
  }

  const storage = sessionStorageOrNull();

  if (!storage) {
    return undefined;
  }

  try {
    const rawValue = storage.getItem(directDiscoverySessionCacheKey(connectionId));
    const parsed = rawValue ? JSON.parse(rawValue) as unknown : undefined;

    if (!isDirectDiscoveryCacheEntry(parsed) || !cacheEntryMatches(parsed, input)) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

export function writeAdapterFromApiDirectDiscoverySessionCache(
  connectionId: ConnectionId | undefined,
  result: AdapterFromApiDirectDiscoveryResult,
) {
  if (connectionId === undefined || connectionId === null) {
    return;
  }

  const storage = sessionStorageOrNull();

  if (!storage) {
    return;
  }

  const entry: AdapterFromApiDirectDiscoverySessionCacheEntry = {
    ...result,
    cachedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(directDiscoverySessionCacheKey(connectionId), JSON.stringify(entry));
  } catch {
    // Session cache is only an optimization; persistence failures must not block discovery.
  }
}

export function clearAdapterFromApiDirectDiscoverySessionCache(
  connectionId: ConnectionId | undefined,
) {
  if (connectionId === undefined || connectionId === null) {
    return;
  }

  const storage = sessionStorageOrNull();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(directDiscoverySessionCacheKey(connectionId));
  } catch {
    // Session cache is best-effort only.
  }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function removeDisplayOnlyContractMetadata(
  contract: AdapterFromApiCompiledContract,
): Record<string, unknown> {
  const { checksum: _checksum, openapi, adapter, ...rest } = contract;
  const checksumPayload: Record<string, unknown> = { ...rest };

  if (isRecord(adapter)) {
    const { logo: _logo, ...adapterWithoutLogo } = adapter;
    checksumPayload.adapter = adapterWithoutLogo;
  } else if (adapter !== undefined) {
    checksumPayload.adapter = adapter;
  }

  if (isRecord(openapi)) {
    const { logo: _logo, ...openapiWithoutLogo } = openapi;
    checksumPayload.openapi = openapiWithoutLogo;
  } else if (openapi !== undefined) {
    checksumPayload.openapi = openapi;
  }

  return checksumPayload;
}

function browserOriginLabel() {
  return typeof window === "undefined" ? "the Command Center origin" : window.location.origin;
}

function directFetchErrorMessage(action: string, url: string, init: RequestInit, error: unknown) {
  const originalMessage = error instanceof Error ? error.message : String(error);
  const method = String(init.method ?? "GET").toUpperCase();

  return [
    `${action} failed before the response was readable by the browser.`,
    method === "GET"
      ? `For ${method} ${url}, this usually means the API response did not allow ${browserOriginLabel()} through CORS.`
      : `For ${method} ${url}, the browser sends an OPTIONS CORS preflight before the real request. If the API log shows OPTIONS returning 400, the preflight failed and the browser did not send the ${method} request.`,
    `For local direct debug mode, configure the API to return Access-Control-Allow-Origin for ${browserOriginLabel()}, allow OPTIONS plus ${method}, and allow Content-Type plus any declared operation headers.`,
    `Browser error: ${originalMessage}`,
  ].join(" ");
}

async function fetchDirect(
  url: string,
  init: RequestInit,
  action: string,
) {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(directFetchErrorMessage(action, url, init, error));
  }
}

export function normalizeAdapterFromApiRootUrl(value: unknown, fieldName = "apiBaseUrl") {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  const trimmed = value.trim().replace(/\/+$/, "");
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${fieldName} must be an absolute http or https URL.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.host) {
    throw new Error(`${fieldName} must be an absolute http or https URL.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${fieldName} must not include URL credentials.`);
  }

  if (parsed.search || parsed.hash) {
    throw new Error(`${fieldName} must not include a query string or fragment.`);
  }

  return parsed.toString().replace(/\/+$/, "");
}

export function buildAdapterFromApiDiscoveryUrls(apiBaseUrl: string) {
  const normalizedRoot = normalizeAdapterFromApiRootUrl(apiBaseUrl);

  return {
    apiBaseUrl: normalizedRoot,
    contractDefinitionUrl: new URL(WELL_KNOWN_CONTRACT_PATH, `${normalizedRoot}/`).toString(),
    openApiUrl: new URL(DEFAULT_OPENAPI_PATH, `${normalizedRoot}/`).toString(),
  };
}

function normalizeHttpUrl(value: unknown, baseUrl: string) {
  const candidate = optionalString(value);

  if (!candidate) {
    return undefined;
  }

  try {
    const parsed = new URL(candidate, baseUrl);

    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.host) {
      return undefined;
    }

    if (parsed.username || parsed.password) {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}

function normalizeAdapterFromApiLogo(
  value: unknown,
  input: {
    baseUrl: string;
    source?: AdapterFromApiLogo["source"];
  },
): AdapterFromApiLogo | undefined {
  const source = input.source ?? "openapi.info.x-logo";

  if (typeof value === "string") {
    const url = normalizeHttpUrl(value, input.baseUrl);
    return url ? { url, source } : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const url = normalizeHttpUrl(value.url, input.baseUrl);

  if (!url) {
    return undefined;
  }

  const logo: AdapterFromApiLogo = { url, source };
  const altText = optionalBoundedString(value.altText, 120);
  const backgroundColor = optionalLogoBackgroundColor(value.backgroundColor);
  const href = normalizeHttpUrl(value.href, input.baseUrl);

  if (altText) {
    logo.altText = altText;
  }

  if (backgroundColor) {
    logo.backgroundColor = backgroundColor;
  }

  if (href) {
    logo.href = href;
  }

  return logo;
}

function readOpenApiInfoLogo(payload: unknown, openApiUrl: string) {
  if (!isRecord(payload) || !isRecord(payload.info)) {
    return undefined;
  }

  return normalizeAdapterFromApiLogo(payload.info["x-logo"], {
    baseUrl: openApiUrl,
    source: "openapi.info.x-logo",
  });
}

async function discoverOpenApiLogo(
  openApiUrl: string,
  options?: {
    signal?: AbortSignal;
  },
) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, OPTIONAL_OPENAPI_DISCOVERY_TIMEOUT_MS);
  const abortFromParent = () => controller.abort();

  if (options?.signal?.aborted) {
    clearTimeout(timeoutHandle);
    return undefined;
  }

  options?.signal?.addEventListener("abort", abortFromParent, { once: true });

  try {
    const response = await fetchDirect(
      openApiUrl,
      {
        method: "GET",
        redirect: "error",
        credentials: "omit",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
      "Direct OpenAPI metadata discovery",
    );

    if (!response.ok) {
      return undefined;
    }

    return readOpenApiInfoLogo(await response.json() as unknown, openApiUrl);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutHandle);
    options?.signal?.removeEventListener("abort", abortFromParent);
  }
}

function requiredContractString(
  item: Record<string, unknown>,
  key: string,
  fieldName: string,
) {
  const value = item[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function normalizeVariableDefinition(
  item: unknown,
  input: {
    secret: boolean;
    seen: Set<string>;
  },
): AdapterFromApiVariableDefinition | AdapterFromApiSecretDefinition {
  if (!isRecord(item)) {
    throw new Error("Each compiled contract variable must be an object.");
  }

  const key = requiredContractString(item, "key", "compiledContract.variables.key");

  if (input.seen.has(key)) {
    throw new Error(`Duplicate compiled contract variable '${key}'.`);
  }

  input.seen.add(key);
  const declaredType =
    typeof item.type === "string" ? item.type.trim() : input.secret ? "secret" : "string";
  const type = input.secret ? "secret" : declaredType;

  if (!SUPPORTED_FIELD_TYPES.has(type as AdapterFromApiFieldType)) {
    throw new Error(`Unsupported compiled contract variable type '${type}'.`);
  }

  const base = {
    key,
    label: optionalString(item.label) ?? key,
    description: optionalString(item.description) ?? "",
    required: Boolean(item.required),
    defaultValue: item.defaultValue,
    renderAs: optionalString(item.renderAs),
    validation: isRecord(item.validation) ? item.validation : {},
    options: Array.isArray(item.options) ? item.options : [],
  };

  if (!input.secret) {
    return {
      ...base,
      type: type as AdapterFromApiVariableDefinition["type"],
    } as AdapterFromApiVariableDefinition;
  }

  const injection = item.injection;

  if (!isRecord(injection)) {
    throw new Error(`Secret variable '${key}' must declare injection metadata.`);
  }

  return {
    ...base,
    type: "secret",
    injection: {
      ...injection,
      type:
        injection.type === "basic auth" || injection.type === "basic_auth"
          ? "basic"
          : (injection.type as "header" | "query" | "basic" | "bearer"),
      name: optionalString(injection.name),
      template: optionalString(injection.template),
    },
  } as AdapterFromApiSecretDefinition;
}

function normalizeVariables(items: unknown, secret: false): AdapterFromApiVariableDefinition[];
function normalizeVariables(items: unknown, secret: true): AdapterFromApiSecretDefinition[];
function normalizeVariables(items: unknown, secret: boolean) {
  if (!Array.isArray(items)) {
    throw new Error("compiledContract.variables must be a list.");
  }

  const seen = new Set<string>();

  return items.map((item) =>
    normalizeVariableDefinition(item, { secret, seen }),
  );
}

function isBlockedHeaderName(value: unknown) {
  return typeof value === "string" && BLOCKED_USER_HEADER_NAMES.has(value.trim().toLowerCase());
}

function normalizeParameterDefinitions(
  items: unknown,
  location: AdapterFromApiParameterLocation,
): AdapterFromApiOperationParameter[] {
  if (!Array.isArray(items)) {
    throw new Error(`compiledContract.parameters.${location} must be a list.`);
  }

  const seen = new Set<string>();

  return items.map((item) => {
    if (!isRecord(item)) {
      throw new Error(`Each compiled contract ${location} parameter must be an object.`);
    }

    const key = requiredContractString(
      item,
      "key",
      `compiledContract.parameters.${location}.key`,
    );

    if (seen.has(key)) {
      throw new Error(`Duplicate ${location} parameter '${key}'.`);
    }

    seen.add(key);
    const type = optionalString(item.type) ?? "string";

    if (!SUPPORTED_PARAMETER_TYPES.has(type as Exclude<AdapterFromApiFieldType, "secret">)) {
      throw new Error(`Unsupported ${location} parameter type '${type}'.`);
    }

    const name = optionalString(item.name) ?? key;

    if (location === "headers" && isBlockedHeaderName(name)) {
      throw new Error(`Header '${name}' cannot be user-configurable.`);
    }

    return {
      key,
      name,
      label: optionalString(item.label) ?? key,
      description: optionalString(item.description) ?? "",
      type: type as Exclude<AdapterFromApiFieldType, "secret">,
      required: Boolean(item.required),
      defaultValue: item.defaultValue,
      example: item.example,
      options: Array.isArray(item.options) ? item.options : [],
      validation: isRecord(item.validation) ? item.validation : {},
    };
  });
}

function normalizeOperations(items: unknown): AdapterFromApiOperationDefinition[] {
  if (!Array.isArray(items)) {
    throw new Error("compiledContract.availableOperations must be a list.");
  }

  const seen = new Set<string>();

  return items.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Each compiled contract operation must be an object.");
    }

    const operationIdValue = item.operationId ?? item.id;
    const operationId =
      typeof operationIdValue === "string" && operationIdValue.trim()
        ? operationIdValue.trim()
        : undefined;

    if (!operationId) {
      throw new Error("compiledContract.availableOperations.operationId is required.");
    }

    if (seen.has(operationId)) {
      throw new Error(`Duplicate operation '${operationId}'.`);
    }

    seen.add(operationId);
    const method = requiredContractString(
      item,
      "method",
      "compiledContract.availableOperations.method",
    ).toUpperCase();

    if (!SUPPORTED_OPERATION_METHODS.has(method)) {
      throw new Error(
        "Only GET, POST, PUT, PATCH, and DELETE operations are supported.",
      );
    }

    const path = requiredContractString(
      item,
      "path",
      "compiledContract.availableOperations.path",
    );

    if (!path.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
      throw new Error("Operation path must be a relative API path starting with '/'.");
    }

    const capabilities = Array.isArray(item.capabilities)
      ? item.capabilities
          .map(String)
          .filter(
            (capability): capability is "query" | "resource" | "mutation" =>
              capability === "query" ||
              capability === "resource" ||
              capability === "mutation",
          )
      : [];
    const parameters = isRecord(item.parameters) ? item.parameters : {};
    const responseMappings = Array.isArray(item.responseMappings)
      ? item.responseMappings.filter(
          (mapping): mapping is AdapterFromApiResponseMapping =>
            isRecord(mapping) && typeof mapping.id === "string" && mapping.id.trim().length > 0,
        )
      : [];

    return {
      operationId,
      label: optionalString(item.label) ?? operationId,
      description: optionalString(item.description) ?? "",
      method,
      path,
      kind: optionalString(item.kind) as AdapterFromApiOperationDefinition["kind"],
      capabilities,
      requiresTimeRange: Boolean(item.requiresTimeRange),
      supportsVariables: Boolean(item.supportsVariables),
      supportsMaxRows: Boolean(item.supportsMaxRows),
      parameters: {
        path: normalizeParameterDefinitions(parameters.path ?? [], "path"),
        query: normalizeParameterDefinitions(parameters.query ?? [], "query"),
        headers: normalizeParameterDefinitions(parameters.headers ?? [], "headers"),
      },
      requestBody: isRecord(item.requestBody) ? item.requestBody : null,
      responseMappings,
      responseContract: optionalString(item.responseContract),
      responseModel: optionalString(item.responseModel) ?? null,
      cache: isRecord(item.cache) ? item.cache : {},
    };
  });
}

export async function compileAdapterFromApiDirectContract(
  payload: unknown,
  input: {
    apiBaseUrl: string;
    openApiUrl: string;
    openApiLogo?: AdapterFromApiLogo;
  },
): Promise<AdapterFromApiCompiledContract> {
  if (!isRecord(payload)) {
    throw new Error("Contract discovery response must be an object.");
  }

  if (payload.contractVersion === undefined || payload.contractVersion === null) {
    throw new Error("compiledContract.contractVersion is required.");
  }

  if (!isRecord(payload.adapter)) {
    throw new Error("compiledContract.adapter must be an object.");
  }

  const availableOperations = normalizeOperations(payload.availableOperations ?? []);

  if (availableOperations.length === 0) {
    throw new Error("compiledContract.availableOperations must contain at least one operation.");
  }

  const openapi = isRecord(payload.openapi) ? { ...payload.openapi } : {};

  if (typeof openapi.url !== "string" || !openapi.url.trim()) {
    openapi.url = input.openApiUrl;
  }

  const openApiLogo = normalizeAdapterFromApiLogo(openapi.logo, {
    baseUrl: input.openApiUrl,
    source: "openapi.info.x-logo",
  }) ?? input.openApiLogo;

  if (openApiLogo) {
    openapi.logo = openApiLogo;
  }

  const compiledContract: AdapterFromApiCompiledContract = {
    contractVersion:
      typeof payload.contractVersion === "number" || typeof payload.contractVersion === "string"
        ? payload.contractVersion
        : String(payload.contractVersion),
    adapter: {
      type: optionalString(payload.adapter.type) === "adapter-from-api"
        ? "adapter-from-api"
        : undefined,
      id: optionalString(payload.adapter.id),
      title: optionalString(payload.adapter.title),
      description: optionalString(payload.adapter.description),
    },
    openapi,
    configVariables: normalizeVariables(payload.configVariables ?? [], false),
    secretVariables: normalizeVariables(payload.secretVariables ?? [], true),
    availableOperations,
    health: isRecord(payload.health) ? payload.health : undefined,
    apiBaseUrl: input.apiBaseUrl,
  };
  const checksumPayload = removeDisplayOnlyContractMetadata(compiledContract);

  return {
    ...compiledContract,
    checksum: `sha256:${await sha256Hex(stableJsonStringify(checksumPayload))}`,
  };
}

export async function discoverAdapterFromApiDirectContract(
  apiBaseUrl: string,
  options?: {
    signal?: AbortSignal;
  },
): Promise<AdapterFromApiDirectDiscoveryResult> {
  const urls = buildAdapterFromApiDiscoveryUrls(apiBaseUrl);
  const response = await fetchDirect(
    urls.contractDefinitionUrl,
    {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      signal: options?.signal,
      headers: {
        Accept: "application/json",
      },
    },
    "Direct contract discovery",
  );

  if (!response.ok) {
    throw new Error(
      `Contract discovery failed with upstream status ${response.status}.`,
    );
  }

  const payload = await response.json() as unknown;
  const openApiLogo = await discoverOpenApiLogo(urls.openApiUrl, options);
  const compiledContract = await compileAdapterFromApiDirectContract(payload, {
    apiBaseUrl: urls.apiBaseUrl,
    openApiUrl: urls.openApiUrl,
    openApiLogo,
  });

  return {
    ...urls,
    compiledContract,
  };
}

export function readAdapterFromApiTransportMode(
  publicConfig: Record<string, unknown> | undefined,
): AdapterFromApiTransportMode {
  return publicConfig?.transportMode === "direct" ? "direct" : "backend";
}

export function isAdapterFromApiDirectConnectionInstance(
  instance: ConnectionInstance | undefined,
) {
  return (
    instance?.typeId === ADAPTER_FROM_API_CONNECTION_TYPE_ID &&
    readAdapterFromApiTransportMode(instance.publicConfig) === "direct"
  );
}

export function adapterFromApiOperationSupportsQuery(
  operation: AdapterFromApiOperationDefinition,
) {
  const capabilities = operation.capabilities ?? [];
  const method = operation.method.toUpperCase();

  if (operation.kind === "query" || capabilities.includes("query")) {
    return true;
  }

  if (operation.kind === "mutation" || capabilities.includes("mutation")) {
    return false;
  }

  if (method === "GET") {
    return true;
  }

  // Older contracts did not classify operations; keep those selectable/executable.
  return !operation.kind && capabilities.length === 0;
}

export function readAdapterFromApiEffectiveCompiledContract(
  instance: ConnectionInstance | undefined,
): AdapterFromApiCompiledContract | undefined {
  if (!instance || instance.typeId !== ADAPTER_FROM_API_CONNECTION_TYPE_ID) {
    return undefined;
  }

  const publicConfig = instance.publicConfig as AdapterFromApiPublicConfig;
  const directDiscoveryCacheEntry = isAdapterFromApiDirectConnectionInstance(instance)
    ? readAdapterFromApiDirectDiscoverySessionCache(instance.id, {
        apiBaseUrl: publicConfig.debugApiBaseUrl,
        contractVersion: publicConfig.contractVersion,
      })
    : undefined;

  if (directDiscoveryCacheEntry?.compiledContract) {
    return directDiscoveryCacheEntry.compiledContract;
  }

  const contract = publicConfig.compiledContract;

  if (isRecord(contract)) {
    return contract as unknown as AdapterFromApiCompiledContract;
  }

  return undefined;
}

function compiledContractFromInstance(instance: ConnectionInstance): AdapterFromApiCompiledContract {
  const contract = readAdapterFromApiEffectiveCompiledContract(instance);

  if (!contract) {
    throw new Error("Adapter From API contract has not been discovered.");
  }

  return contract;
}

function operationById(
  contract: AdapterFromApiCompiledContract,
  operationId: unknown,
): AdapterFromApiOperationDefinition {
  if (typeof operationId !== "string" || !operationId.trim()) {
    throw new Error("query.operationId is required.");
  }

  const operation = (contract.availableOperations ?? []).find(
    (candidate) => candidate.operationId === operationId,
  );

  if (!operation) {
    throw new Error("Unknown Adapter From API operation.");
  }

  return operation;
}

function validateValue(
  value: unknown,
  definition: AdapterFromApiVariableDefinition,
  fieldName: string,
) {
  if (value === undefined || value === null) {
    if (definition.required) {
      throw new Error(`${fieldName}.${definition.key} is required.`);
    }
    return undefined;
  }

  if (definition.type === "string" || definition.type === "secret") {
    if (typeof value !== "string") {
      throw new Error(`${fieldName}.${definition.key} must be a string.`);
    }
  } else if (definition.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${fieldName}.${definition.key} must be a number.`);
    }
  } else if (definition.type === "boolean") {
    if (typeof value !== "boolean") {
      throw new Error(`${fieldName}.${definition.key} must be a boolean.`);
    }
  } else if (definition.type === "select") {
    const optionValues = new Set(
      (definition.options ?? [])
        .map((option) => option.value)
        .filter((optionValue) => typeof optionValue === "string"),
    );

    if (optionValues.size > 0 && !optionValues.has(String(value))) {
      throw new Error(`${fieldName}.${definition.key} must match a declared option.`);
    }
  } else if (definition.type === "json") {
    JSON.stringify(value);
  }

  const pattern = isRecord(definition.validation)
    ? definition.validation.pattern
    : undefined;

  if (typeof pattern === "string" && typeof value === "string" && !new RegExp(pattern).test(value)) {
    throw new Error(`${fieldName}.${definition.key} does not match the required pattern.`);
  }

  return value;
}

function validateValues(
  values: unknown,
  definitions: AdapterFromApiVariableDefinition[],
  input: {
    fieldName: string;
    requireMissing: boolean;
    allowUnknown?: boolean;
  },
) {
  if (!isRecord(values)) {
    throw new Error(`${input.fieldName} must be an object.`);
  }

  const definitionByKey = new Map<string, AdapterFromApiVariableDefinition>();

  definitions.forEach((definition) => {
    definitionByKey.set(definition.key, definition);

    if ("name" in definition && typeof definition.name === "string") {
      definitionByKey.set(definition.name, definition);
    }
  });

  const normalized: Record<string, unknown> = {};

  Object.entries(values).forEach(([key, value]) => {
    const definition = definitionByKey.get(key);

    if (!definition) {
      if (input.allowUnknown) {
        normalized[key] = value;
        return;
      }

      throw new Error(`${input.fieldName} contains unknown field '${key}'.`);
    }

    const normalizedValue = validateValue(value, definition, input.fieldName);

    if (normalizedValue !== undefined) {
      normalized[definition.key] = normalizedValue;
    }
  });

  definitions.forEach((definition) => {
    if (Object.prototype.hasOwnProperty.call(normalized, definition.key)) {
      return;
    }

    if (definition.defaultValue !== undefined && definition.defaultValue !== null) {
      normalized[definition.key] = definition.defaultValue;
      return;
    }

    if (input.requireMissing && definition.required) {
      throw new Error(`${input.fieldName}.${definition.key} is required.`);
    }
  });

  return normalized;
}

function pathTemplateParameterNames(path: string) {
  return Array.from(path.matchAll(/\{([^}]+)\}/g), (match) => match[1]!).filter(Boolean);
}

function operationParameterDefinitions(
  operation: AdapterFromApiOperationDefinition,
  location: AdapterFromApiParameterLocation,
): AdapterFromApiOperationParameter[] {
  const definitions = [...(operation.parameters?.[location] ?? [])];

  if (location !== "path") {
    return definitions;
  }

  pathTemplateParameterNames(operation.path).forEach((placeholder) => {
    const exists = definitions.some(
      (definition) =>
        definition.key === placeholder || (definition.name ?? definition.key) === placeholder,
    );

    if (!exists) {
      definitions.push({
        key: placeholder,
        name: placeholder,
        label: placeholder,
        type: "string",
        required: true,
      });
    }
  });

  return definitions;
}

function parameterName(
  operation: AdapterFromApiOperationDefinition,
  location: AdapterFromApiParameterLocation,
  key: string,
) {
  const definition = operationParameterDefinitions(operation, location).find(
    (candidate) => candidate.key === key,
  );

  return definition?.name ?? key;
}

function normalizeQuery(
  instance: ConnectionInstance,
  request: ConnectionQueryRequest<AdapterFromApiConnectionQuery>,
  options?: {
    allowHealthOperation?: boolean;
    allowNonQueryOperation?: boolean;
  },
) {
  const query = isRecord(request.query)
    ? request.query as AdapterFromApiConnectionQuery
    : {};

  if (query.kind !== ADAPTER_FROM_API_QUERY_KIND) {
    throw new Error("Unsupported Adapter From API query kind.");
  }

  const contract = compiledContractFromInstance(instance);
  const operation = operationById(contract, query.operationId);

  if (
    !options?.allowHealthOperation &&
    !options?.allowNonQueryOperation &&
    !adapterFromApiOperationSupportsQuery(operation)
  ) {
    throw new Error("Selected operation does not support query execution.");
  }

  const parameters = isRecord(query.parameters) ? query.parameters : {};
  const pathValues = validateValues(parameters.path ?? {}, operationParameterDefinitions(operation, "path"), {
    fieldName: "query.parameters.path",
    requireMissing: true,
  });
  const queryValues = validateValues(parameters.query ?? {}, operationParameterDefinitions(operation, "query"), {
    fieldName: "query.parameters.query",
    requireMissing: false,
    allowUnknown: true,
  });
  const headerValues = validateValues(parameters.headers ?? {}, operationParameterDefinitions(operation, "headers"), {
    fieldName: "query.parameters.headers",
    requireMissing: false,
  });

  if (query.body !== undefined && query.body !== null && !operation.requestBody) {
    throw new Error("Selected operation does not declare a request body.");
  }

  const responseMappingId = optionalString(query.responseMappingId);
  const mappingIds = new Set(
    (operation.responseMappings ?? [])
      .map((mapping) => mapping.id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
  );

  if (responseMappingId && !mappingIds.has(responseMappingId)) {
    throw new Error("Unknown response mapping for operation.");
  }

  return {
    contract,
    operation,
    query,
    pathValues,
    queryValues,
    headerValues,
    body: query.body,
    responseMappingId,
    requestedOutputContract: request.requestedOutputContract,
    maxRows:
      request.maxRows !== undefined && operation.supportsMaxRows
        ? request.maxRows
        : undefined,
  };
}

function buildDirectRequestUrl(
  apiBaseUrl: string,
  operation: AdapterFromApiOperationDefinition,
  pathValues: Record<string, unknown>,
  queryValues: Record<string, unknown>,
) {
  let path = operation.path;

  Object.entries(pathValues).forEach(([key, value]) => {
    path = path.replace(
      `{${parameterName(operation, "path", key)}}`,
      encodeURIComponent(String(value)),
    );
  });

  if (/{[^}]+}/.test(path)) {
    throw new Error("Missing required path parameter.");
  }

  const url = new URL(path.replace(/^\/+/, ""), `${apiBaseUrl}/`);

  Object.entries(queryValues).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    url.searchParams.set(parameterName(operation, "query", key), String(value));
  });

  return url.toString();
}

function buildDirectHeaders(
  operation: AdapterFromApiOperationDefinition,
  headerValues: Record<string, unknown>,
  body: unknown,
) {
  const headers = new Headers();

  Object.entries(headerValues).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const headerName = parameterName(operation, "headers", key);

    if (isBlockedHeaderName(headerName)) {
      throw new Error(`Header '${headerName}' cannot be sent in direct debug mode.`);
    }

    headers.set(headerName, String(value));
  });

  if (body !== undefined && body !== null) {
    headers.set(
      "Content-Type",
      operation.requestBody?.contentType ?? "application/json",
    );
  }

  headers.set("Accept", "application/json");
  return headers;
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("json")) {
    try {
      return await response.json() as unknown;
    } catch {
      return await response.text();
    }
  }

  return response.text();
}

function safeResponseHeaders(headers: Headers): Record<string, string> {
  const safeHeaders: Record<string, string> = {};

  [
    "cache-control",
    "content-language",
    "content-type",
    "etag",
    "expires",
    "last-modified",
  ].forEach((key) => {
    const value = headers.get(key);

    if (value) {
      safeHeaders[key] = value;
    }
  });

  return safeHeaders;
}

function responseMappingForQuery(
  operation: AdapterFromApiOperationDefinition,
  responseMappingId: string | undefined,
  requestedOutputContract: string | undefined,
) {
  const mappings = operation.responseMappings ?? [];

  if (responseMappingId) {
    const mapping = mappings.find((candidate) => candidate.id === responseMappingId);

    if (!mapping) {
      throw new Error("Unknown response mapping for operation.");
    }

    if (requestedOutputContract && mapping.contract !== requestedOutputContract) {
      throw new Error(
        `Response mapping '${responseMappingId}' returns ${mapping.contract}, not ${requestedOutputContract}.`,
      );
    }

    return mapping;
  }

  const matching = requestedOutputContract
    ? mappings.filter((mapping) => mapping.contract === requestedOutputContract)
    : mappings;

  if (matching.length === 1) {
    return matching[0];
  }

  if (matching.length === 0) {
    throw new Error(
      requestedOutputContract
        ? `Selected operation does not declare a response mapping for ${requestedOutputContract}.`
        : "Selected operation does not declare a response mapping.",
    );
  }

  throw new Error(
    "Selected operation declares multiple matching response mappings; choose one explicitly.",
  );
}

function jsonPathValue(value: unknown, path: string | undefined) {
  if (!path || path === "$") {
    return value;
  }

  if (!path.startsWith("$.")) {
    throw new Error("Only simple '$.field.path' rows paths are supported.");
  }

  let current = value;

  for (const token of path.slice(2).split(".")) {
    if (!token) {
      throw new Error("Rows path contains an empty segment.");
    }

    if (isRecord(current) && Object.prototype.hasOwnProperty.call(current, token)) {
      current = current[token];
      continue;
    }

    return undefined;
  }

  return current;
}

function inferFieldType(values: unknown[]): CommandCenterFrameFieldType {
  const concreteValues = values.filter((value) => value !== undefined && value !== null);

  if (concreteValues.length === 0) {
    return "string";
  }

  if (concreteValues.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return "number";
  }

  if (concreteValues.every((value) => typeof value === "boolean")) {
    return "boolean";
  }

  return "string";
}

function mappedRows(body: unknown, mapping: AdapterFromApiResponseMapping): Record<string, unknown>[] {
  const rowsValue = jsonPathValue(body, mapping.rowsPath ?? "$");

  if (Array.isArray(rowsValue)) {
    return rowsValue.map((row): Record<string, unknown> =>
      isRecord(row) ? row : { value: row },
    );
  }

  if (isRecord(rowsValue)) {
    return [rowsValue];
  }

  throw new Error(
    `Response mapping '${mapping.id}' rowsPath did not resolve to an object or list.`,
  );
}

function mappingColumns(
  records: Record<string, unknown>[],
  fieldTypes: Record<string, string>,
) {
  const columns = Object.keys(fieldTypes).filter(Boolean);
  const seen = new Set(columns);

  records.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (!seen.has(key)) {
        columns.push(key);
        seen.add(key);
      }
    });
  });

  return columns;
}

function responseToMappedFrame(
  input: {
    instance: ConnectionInstance;
    operation: AdapterFromApiOperationDefinition;
    mapping: AdapterFromApiResponseMapping;
    body: unknown;
    statusCode: number;
  },
): CommandCenterFrame {
  if (input.mapping.contract !== CORE_TABULAR_FRAME_SOURCE_CONTRACT) {
    throw new Error(
      `Adapter From API direct mode currently supports mapped frames only for ${CORE_TABULAR_FRAME_SOURCE_CONTRACT}.`,
    );
  }

  if (
    input.mapping.statusCode !== undefined &&
    String(input.mapping.statusCode) !== String(input.statusCode)
  ) {
    throw new Error(
      "Upstream response status did not match the selected response mapping.",
    );
  }

  const fieldTypes = isRecord(input.mapping.fieldTypes)
    ? input.mapping.fieldTypes as Record<string, string>
    : {};
  const records = mappedRows(input.body, input.mapping);
  const columns = mappingColumns(records, fieldTypes);

  return {
    name: input.mapping.label ?? input.operation.label ?? input.operation.operationId,
    contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    fields: columns.map((column) => {
      const values = records.map((record) =>
        Object.prototype.hasOwnProperty.call(record, column) ? record[column] : null,
      );
      const declaredType = fieldTypes[column];

      return {
        name: column,
        type: (
          declaredType === "time" ||
          declaredType === "number" ||
          declaredType === "boolean" ||
          declaredType === "string" ||
          declaredType === "json"
            ? declaredType
            : inferFieldType(values)
        ) as CommandCenterFrameFieldType,
        values,
      };
    }),
    meta: {
      operationId: input.operation.operationId,
      responseMappingId: input.mapping.id,
      providerStatusCode: input.statusCode,
      transportMode: "direct",
      connectionId: input.instance.id,
    },
  };
}

function isCommandCenterFrame(value: unknown): value is CommandCenterFrame {
  return (
    isRecord(value) &&
    typeof value.contract === "string" &&
    Array.isArray(value.fields) &&
    value.fields.every(
      (field) =>
        isRecord(field) &&
        typeof field.name === "string" &&
        typeof field.type === "string" &&
        Array.isArray(field.values),
    )
  );
}

function normalizeFrameFieldType(value: unknown): CommandCenterFrameFieldType {
  return value === "time" ||
    value === "number" ||
    value === "string" ||
    value === "boolean" ||
    value === "json"
    ? value
    : "json";
}

function nativeTabularSourceToFrame(value: unknown): CommandCenterFrame | undefined {
  if (!isRecord(value) || !Array.isArray(value.columns) || !Array.isArray(value.rows)) {
    return undefined;
  }

  const columns = value.columns.flatMap((column) =>
    typeof column === "string" && column.trim() ? [column.trim()] : [],
  );

  if (columns.length === 0) {
    return undefined;
  }

  const rows = value.rows.filter(isRecord);
  const fieldTypes = new Map<string, CommandCenterFrameFieldType>();

  if (Array.isArray(value.fields)) {
    value.fields.forEach((field) => {
      if (!isRecord(field)) {
        return;
      }

      const key =
        typeof field.key === "string" && field.key.trim()
          ? field.key.trim()
          : typeof field.name === "string" && field.name.trim()
            ? field.name.trim()
            : undefined;

      if (key) {
        fieldTypes.set(key, normalizeFrameFieldType(field.type));
      }
    });
  }

  return {
    contract: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
    fields: columns.map((column) => ({
      name: column,
      type: fieldTypes.get(column) ?? "json",
      values: rows.map((row) => row[column] ?? null),
    })),
    ...(isRecord(value.meta) ? { meta: value.meta } : {}),
  };
}

function upstreamBodyToConnectionQueryResponse(
  input: {
    instance: ConnectionInstance;
    normalized: ReturnType<typeof normalizeQuery>;
    body: unknown;
    statusCode: number;
    traceId: string;
  },
): ConnectionQueryResponse {
  if (isRecord(input.body) && Array.isArray(input.body.frames)) {
    return {
      frames: input.body.frames as CommandCenterFrame[],
      warnings: Array.isArray(input.body.warnings)
        ? input.body.warnings.map(String)
        : [],
      traceId: typeof input.body.traceId === "string" ? input.body.traceId : input.traceId,
    };
  }

  if (input.normalized.operation.responseContract === CORE_TABULAR_FRAME_SOURCE_CONTRACT) {
    const nativeTabularFrame = nativeTabularSourceToFrame(input.body);

    if (nativeTabularFrame) {
      return {
        frames: [nativeTabularFrame],
        warnings: [],
        traceId: input.traceId,
      };
    }
  }

  if (
    input.normalized.operation.responseContract &&
    isCommandCenterFrame(input.body)
  ) {
    if (input.body.contract !== input.normalized.operation.responseContract) {
      throw new Error(
        `Native operation response returned ${input.body.contract}, not ${input.normalized.operation.responseContract}.`,
      );
    }

    if (
      input.normalized.requestedOutputContract &&
      input.body.contract !== input.normalized.requestedOutputContract
    ) {
      throw new Error(
        `Native operation response returned ${input.body.contract}, not ${input.normalized.requestedOutputContract}.`,
      );
    }

    return {
      frames: [input.body],
      warnings: [],
      traceId: input.traceId,
    };
  }

  const mapping = responseMappingForQuery(
    input.normalized.operation,
    input.normalized.responseMappingId,
    input.normalized.requestedOutputContract,
  );

  return {
    frames: [
      responseToMappedFrame({
        instance: input.instance,
        operation: input.normalized.operation,
        mapping,
        body: input.body,
        statusCode: input.statusCode,
      }),
    ],
    warnings: [],
    traceId: input.traceId,
  };
}

async function executeAdapterFromApiDirectOperation(
  instance: ConnectionInstance,
  request: ConnectionQueryRequest<AdapterFromApiConnectionQuery>,
  options?: {
    signal?: AbortSignal;
    allowNonQueryOperation?: boolean;
  },
) {
  if (!isAdapterFromApiDirectConnectionInstance(instance)) {
    throw new Error("Adapter From API connection is not configured for direct debug mode.");
  }

  const publicConfig = instance.publicConfig as AdapterFromApiPublicConfig;
  const debugApiBaseUrl = normalizeAdapterFromApiRootUrl(
    publicConfig.debugApiBaseUrl,
    "debugApiBaseUrl",
  );
  const normalized = normalizeQuery(instance, request, {
    allowNonQueryOperation: options?.allowNonQueryOperation,
  });
  const url = buildDirectRequestUrl(
    debugApiBaseUrl,
    normalized.operation,
    normalized.pathValues,
    normalized.queryValues,
  );
  const response = await fetchDirect(
    url,
    {
      method: normalized.operation.method,
      redirect: "error",
      credentials: "omit",
      signal: options?.signal,
      headers: buildDirectHeaders(
        normalized.operation,
        normalized.headerValues,
        normalized.body,
      ),
      body:
        normalized.body === undefined || normalized.body === null
          ? undefined
          : JSON.stringify(normalized.body),
    },
    "Direct API operation",
  );
  const body = await readResponseBody(response);
  const traceId = `direct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  if (!response.ok) {
    throw new Error(
      `Adapter From API direct request failed with upstream status ${response.status}: ${
        typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)
      }`,
    );
  }

  return {
    normalized,
    body,
    statusCode: response.status,
    contentType: response.headers.get("content-type") ?? "",
    headers: safeResponseHeaders(response.headers),
    traceId,
  };
}

export async function queryAdapterFromApiDirectRaw(
  instance: ConnectionInstance,
  request: ConnectionQueryRequest<AdapterFromApiConnectionQuery>,
  options?: {
    signal?: AbortSignal;
    allowNonQueryOperation?: boolean;
  },
): Promise<AdapterFromApiRawOperationResponse> {
  const execution = await executeAdapterFromApiDirectOperation(instance, request, options);

  return {
    result: {
      operationId: execution.normalized.operation.operationId,
      statusCode: execution.statusCode,
      contentType: execution.contentType,
      headers: execution.headers,
      body: execution.body,
    },
    warnings: [],
    traceId: execution.traceId,
  };
}

export async function queryAdapterFromApiDirect(
  instance: ConnectionInstance,
  request: ConnectionQueryRequest<AdapterFromApiConnectionQuery>,
  options?: {
    signal?: AbortSignal;
  },
): Promise<ConnectionQueryResponse> {
  const execution = await executeAdapterFromApiDirectOperation(instance, request, options);

  return upstreamBodyToConnectionQueryResponse({
    instance,
    normalized: execution.normalized,
    body: execution.body,
    statusCode: execution.statusCode,
    traceId: execution.traceId,
  });
}

export async function testAdapterFromApiDirect(
  instance: ConnectionInstance,
  options?: {
    signal?: AbortSignal;
  },
): Promise<ConnectionHealthResult> {
  const traceId = `direct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const publicConfig = instance.publicConfig as AdapterFromApiPublicConfig;
  const contract = compiledContractFromInstance(instance);
  const health = isRecord(contract.health) ? contract.health : undefined;
  const operationId = health?.operationId;

  if (!health || typeof operationId !== "string" || !operationId.trim()) {
    return {
      status: "unknown",
      message: "Adapter From API contract does not declare a health check.",
      traceId,
    };
  }

  try {
    const debugApiBaseUrl = normalizeAdapterFromApiRootUrl(
      publicConfig.debugApiBaseUrl,
      "debugApiBaseUrl",
    );
    const normalized = normalizeQuery(
      instance,
      {
        connectionId: instance.id,
        query: {
          kind: ADAPTER_FROM_API_QUERY_KIND,
          operationId,
          parameters: isRecord(health.parameters) ? health.parameters : {},
          body: health.body,
        },
      },
      { allowHealthOperation: true },
    );
    const url = buildDirectRequestUrl(
      debugApiBaseUrl,
      normalized.operation,
      normalized.pathValues,
      normalized.queryValues,
    );
    const startedAtMs = performance.now();
    const response = await fetchDirect(
      url,
      {
        method: normalized.operation.method,
        redirect: "error",
        credentials: "omit",
        signal: options?.signal,
        headers: buildDirectHeaders(
          normalized.operation,
          normalized.headerValues,
          normalized.body,
        ),
        body:
          normalized.body === undefined || normalized.body === null
            ? undefined
            : JSON.stringify(normalized.body),
      },
      "Direct health check",
    );
    await readResponseBody(response);
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAtMs));
    const expectedStatus = health.expectedStatus;

    if (expectedStatus !== undefined && String(expectedStatus) !== String(response.status)) {
      return {
        status: "error",
        message: `Adapter From API direct health check returned status ${response.status}; expected ${expectedStatus}.`,
        latencyMs,
        traceId,
      };
    }

    if (!response.ok) {
      return {
        status: "error",
        message: `Adapter From API direct health check failed with upstream status ${response.status}.`,
        latencyMs,
        traceId,
      };
    }

    return {
      status: "ok",
      message: "Adapter From API direct health check succeeded.",
      latencyMs,
      checkedAt: new Date().toISOString(),
      traceId,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Adapter From API direct health check failed.",
      traceId,
    };
  }
}
