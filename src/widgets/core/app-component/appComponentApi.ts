import { useAuthStore } from "@/auth/auth-store";
import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import {
  startDashboardRequestTrace,
  type DashboardRequestTraceMeta,
} from "@/dashboards/dashboard-request-trace";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";

import {
  appComponentMockOpenApiDocument,
  buildAppComponentConfiguredHeadersKey,
  buildAppComponentOpenApiUrl,
  isAppComponentMainSequenceResourceReleaseMode,
  normalizeAppComponentAuthMode,
  resolveAppComponentDisplayBaseUrl,
  resolveAppComponentRequestBaseUrl,
  resolveAppComponentConfiguredHeadersRecord,
  type AppComponentAuthMode,
  type AppComponentWidgetProps,
  type OpenApiDocument,
} from "./appComponentModel";
import {
  buildMainSequenceReleaseTransportIdentityKey,
  sendMainSequenceReleaseRequest,
} from "./mainSequenceReleaseTransport";

const appComponentProxyPrefix = "/__app_component_proxy__";
export const APP_COMPONENT_OPENAPI_CACHE_TTL_MS =
  commandCenterConfig.app.cache.appComponentOpenApiDocumentTtlMs;
export const APP_COMPONENT_SAFE_RESPONSE_CACHE_TTL_MS =
  commandCenterConfig.app.cache.appComponentSafeResponseTtlMs;

interface CachedEntry<T> {
  expiresAt: number;
  value: T;
}

interface AppComponentResponseCacheOptions {
  enabled?: boolean;
  ttlMs?: number;
}

const openApiDocumentCache = new Map<string, CachedEntry<OpenApiDocument>>();
const inFlightOpenApiRequests = new Map<string, Promise<OpenApiDocument>>();
const safeResponseCache = new Map<string, CachedEntry<AppComponentTransportResponse>>();
const inFlightSafeResponses = new Map<string, Promise<AppComponentTransportResponse>>();
const APP_COMPONENT_OPENAPI_ERROR_SAMPLE_MAX_CHARS = 1600;

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function truncateTextSample(value: string, maxChars = APP_COMPONENT_OPENAPI_ERROR_SAMPLE_MAX_CHARS) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n...`;
}

function buildOpenApiErrorSample(payload: unknown) {
  if (payload == null) {
    return undefined;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed ? truncateTextSample(trimmed) : undefined;
  }

  try {
    return truncateTextSample(JSON.stringify(payload, null, 2));
  } catch {
    return truncateTextSample(String(payload));
  }
}

export class AppComponentOpenApiDiscoveryError extends Error {
  responseContentType?: string;
  responseSample?: string;
  responseStatus?: number;
  responseUrl?: string;

  constructor(
    message: string,
    options?: {
      responseContentType?: string;
      responseSample?: string;
      responseStatus?: number;
      responseUrl?: string;
    },
  ) {
    super(message);
    this.name = "AppComponentOpenApiDiscoveryError";
    this.responseContentType = options?.responseContentType;
    this.responseSample = options?.responseSample;
    this.responseStatus = options?.responseStatus;
    this.responseUrl = options?.responseUrl;
  }
}

function isSafeCacheableMethod(method: string) {
  const normalizedMethod = method.trim().toUpperCase();
  return normalizedMethod === "GET" || normalizedMethod === "HEAD";
}

function pruneExpiredEntry<T>(cache: Map<string, CachedEntry<T>>, key: string) {
  const cachedEntry = cache.get(key);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cachedEntry;
}

function buildAppComponentTransportIdentityKey(
  props: Pick<
    AppComponentWidgetProps,
    "apiTargetMode" | "authMode" | "mainSequenceResourceRelease"
  >,
) {
  if (isAppComponentMainSequenceResourceReleaseMode(props)) {
    return buildMainSequenceReleaseTransportIdentityKey(props);
  }

  return `manual:${normalizeAppComponentAuthMode(props.authMode)}`;
}

function buildOpenApiCacheKey(props: AppComponentWidgetProps) {
  const session = useAuthStore.getState().session;
  const userId = session?.user.id ?? "anonymous";
  const baseUrl =
    resolveAppComponentDisplayBaseUrl(props) ??
    props.mainSequenceResourceRelease?.publicUrl ??
    "invalid";

  return `${userId}::${buildAppComponentTransportIdentityKey(props)}::${baseUrl}::${buildAppComponentConfiguredHeadersKey(props.serviceHeaders)}`;
}

async function sha256Hex(value: string) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildSafeResponseCacheKey({
  transportIdentity,
  body,
  headers,
  method,
  url,
}: {
  transportIdentity: string;
  body?: string;
  headers?: Record<string, string>;
  method: string;
  url: string;
}) {
  const session = useAuthStore.getState().session;
  const userId = session?.user.id ?? "anonymous";
  const normalizedMethod = method.trim().toUpperCase();
  const bodyHash = await sha256Hex(body ?? "");
  const headersHash = await sha256Hex(
    JSON.stringify(
      Object.entries(headers ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    ),
  );

  return `${userId}::${transportIdentity}::${normalizedMethod}::${url}::${bodyHash}::${headersHash}`;
}

function buildTransportUrl(requestUrl: string) {
  const resolvedUrl = new URL(requestUrl);

  if (import.meta.env.DEV && isLoopbackHostname(resolvedUrl.hostname)) {
    return `${appComponentProxyPrefix}?target=${encodeURIComponent(resolvedUrl.toString())}`;
  }

  return resolvedUrl.toString();
}

function describeTransportStrategy(requestUrl: string) {
  const resolvedUrl = new URL(requestUrl);
  const proxied = import.meta.env.DEV && isLoopbackHostname(resolvedUrl.hostname);

  return {
    proxied,
    resolvedUrl,
    transportUrl: proxied
      ? `${appComponentProxyPrefix}?target=${encodeURIComponent(resolvedUrl.toString())}`
      : resolvedUrl.toString(),
  };
}

function buildTransportErrorMessage(
  requestUrl: string,
  authMode: AppComponentAuthMode,
  error: unknown,
) {
  const { proxied, resolvedUrl } = describeTransportStrategy(requestUrl);
  const session = useAuthStore.getState().session;
  const originalMessage =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "The browser failed before receiving an HTTP response.";
  const authMessage =
    authMode === "session-jwt"
      ? session?.token
        ? `Auth mode is session-jwt and the current session JWT was attached to the request.`
        : `Auth mode is session-jwt but there is no session JWT available in the current browser session.`
      : "Auth mode is none, so no Authorization header was sent.";
  const transportMessage = import.meta.env.DEV
    ? proxied
      ? "The request went through the local AppComponent proxy because the target host is loopback."
      : "The request was sent directly from the browser because this target is not loopback, so browser CORS, TLS, DNS, or network policy can fail before the API returns an HTTP response."
    : "The request was sent directly from the browser to the configured target URL.";

  return [
    `Could not reach ${resolvedUrl.toString()}.`,
    authMessage,
    transportMessage,
    `Browser error: ${originalMessage}`,
  ].join(" ");
}

export interface AppComponentTransportResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function readHeaders(response: Response) {
  return Object.fromEntries(Array.from(response.headers.entries()));
}

async function readResponseBody(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  if (
    contentType.startsWith("text/") ||
    contentType.includes("xml") ||
    contentType.includes("html") ||
    contentType.includes("javascript")
  ) {
    const text = await response.text();
    return text.trim() ? text : null;
  }

  const text = await response.text();
  return text.trim() ? text : null;
}

function buildMockResponse(
  body: unknown,
  {
    ok = true,
    status = 200,
    statusText = "OK",
    url,
  }: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    url: string;
  },
): AppComponentTransportResponse {
  return {
    ok,
    status,
    statusText,
    url,
    headers: {
      "content-type": "application/json",
      "x-app-component-mock": "true",
    },
    body,
  };
}

async function submitMockRequest({
  method,
  url,
  body,
}: {
  method: string;
  url: string;
  body?: string;
}) {
  const requestUrl = new URL(url);
  const routeKey = `${method.toUpperCase()} ${requestUrl.pathname}`;

  switch (routeKey) {
    case "GET /context": {
      const offsetDays = Number(requestUrl.searchParams.get("offset_days") ?? 2);
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + (Number.isFinite(offsetDays) ? offsetDays : 0));

      return buildMockResponse(
        {
          random_date: targetDate.toISOString().slice(0, 10),
          source: "app-component-mock",
          offset_days: Number.isFinite(offsetDays) ? offsetDays : 0,
        },
        {
          url,
        },
      );
    }
    case "POST /price/swap": {
      const parsedBody = body ? (JSON.parse(body) as Record<string, unknown>) : {};
      const rate = typeof parsedBody.rate === "number" ? parsedBody.rate : Number(parsedBody.rate ?? 0);
      const swappedRate =
        Number.isFinite(rate) && rate !== 0 ? Number((1 / rate).toFixed(6)) : null;

      return buildMockResponse(
        {
          submitted: true,
          date: typeof parsedBody.date === "string" ? parsedBody.date : null,
          rate: Number.isFinite(rate) ? rate : null,
          swapped_rate: swappedRate,
          pricing_source: "app-component-mock",
        },
        {
          url,
        },
      );
    }
    case "GET /health":
      return buildMockResponse(
        {
          status: "ok",
          service: "app-component-mock",
        },
        {
          url,
        },
      );
    default:
      return buildMockResponse(
        {
          detail: `Mock route not implemented for ${routeKey}.`,
        },
        {
          ok: false,
          status: 404,
          statusText: "Not Found",
          url,
        },
      );
  }
}

export function buildAppComponentOpenApiQueryKey(
  props: AppComponentWidgetProps,
) {
  const normalizedProps = {
    ...props,
    authMode: normalizeAppComponentAuthMode(props.authMode),
  } satisfies AppComponentWidgetProps;

  return [
    "app-component",
    "openapi",
    buildAppComponentTransportIdentityKey(normalizedProps),
    resolveAppComponentDisplayBaseUrl(normalizedProps) ?? "invalid",
    buildAppComponentConfiguredHeadersKey(normalizedProps.serviceHeaders),
  ] as const;
}

async function sendAuthenticatedRequest(
  requestUrl: string,
  {
    authMode,
    init,
    traceMeta,
  }: {
    authMode: AppComponentAuthMode;
    init?: RequestInit;
    traceMeta?: DashboardRequestTraceMeta;
  },
) {
  const { transportUrl } = describeTransportStrategy(requestUrl);

  async function execute() {
    const headers = new Headers(init?.headers);
    const session = useAuthStore.getState().session;

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (authMode === "session-jwt" && session?.token) {
      headers.set("Authorization", `${session.tokenType ?? "Bearer"} ${session.token}`);
    }

    return fetch(transportUrl, {
      ...init,
      headers,
    });
  }

  let response: Response;
  const requestTrace = startDashboardRequestTrace(traceMeta, {
    method: init?.method,
    url: requestUrl,
  });

  try {
    response = await execute();
  } catch (error) {
    const transportErrorMessage = buildTransportErrorMessage(requestUrl, authMode, error);
    requestTrace?.fail(transportErrorMessage);
    throw new Error(transportErrorMessage);
  }

  if (response.status === 401 && authMode === "session-jwt") {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await execute();
    }
  }

  requestTrace?.finish({
    status: response.status,
    ok: response.ok,
  });

  return response;
}

export async function fetchAppComponentOpenApiDocument({
  props,
  traceMeta,
}: {
  props: AppComponentWidgetProps;
  traceMeta?: DashboardRequestTraceMeta;
}) {
  const normalizedProps = {
    ...props,
    authMode: normalizeAppComponentAuthMode(props.authMode),
  } satisfies AppComponentWidgetProps;
  const requestBaseUrl = resolveAppComponentRequestBaseUrl(normalizedProps);

  if (env.useMockData || isWidgetPreviewMode()) {
    return appComponentMockOpenApiDocument satisfies OpenApiDocument;
  }

  if (!requestBaseUrl) {
    throw new Error(
      "AppComponent requires a valid API base URL or a Main Sequence resource release before loading OpenAPI.",
    );
  }

  const openApiCacheKey = buildOpenApiCacheKey(normalizedProps);
  const cachedDocument = pruneExpiredEntry(openApiDocumentCache, openApiCacheKey);
  const openApiUrl = buildAppComponentOpenApiUrl(requestBaseUrl);

  if (cachedDocument) {
    startDashboardRequestTrace(traceMeta, {
      method: "GET",
      url: openApiUrl ?? requestBaseUrl,
    })?.finish({
      ok: true,
      status: 200,
      resolution: "cache-hit",
    });
    return cloneSerializable(cachedDocument.value);
  }

  const inFlightDocumentRequest = inFlightOpenApiRequests.get(openApiCacheKey);

  if (inFlightDocumentRequest) {
    startDashboardRequestTrace(traceMeta, {
      method: "GET",
      url: openApiUrl ?? requestBaseUrl,
    })?.finish({
      ok: true,
      status: 200,
      resolution: "shared-promise",
    });
    return cloneSerializable(await inFlightDocumentRequest);
  }

  if (!openApiUrl) {
    throw new Error("AppComponent requires a valid API URL.");
  }

  const requestPromise = (async () => {
    const response = isAppComponentMainSequenceResourceReleaseMode(normalizedProps)
      ? await sendMainSequenceReleaseRequest(openApiUrl, {
          props: normalizedProps,
          init: {
            headers: resolveAppComponentConfiguredHeadersRecord(
              normalizedProps.serviceHeaders,
            ),
          },
          traceMeta,
        })
      : await sendAuthenticatedRequest(openApiUrl, {
          authMode: normalizedProps.authMode ?? "session-jwt",
          init: {
            headers: resolveAppComponentConfiguredHeadersRecord(
              normalizedProps.serviceHeaders,
            ),
          },
          traceMeta,
        });
    const payload = await readResponseBody(response);
    const responseSample = buildOpenApiErrorSample(payload);
    const responseContentType = response.headers.get("content-type") ?? undefined;

    if (!response.ok) {
      throw new AppComponentOpenApiDiscoveryError(
        typeof payload === "string"
          ? payload
          : response.status === 401
            ? isAppComponentMainSequenceResourceReleaseMode(normalizedProps)
              ? "OpenAPI request was rejected by the selected Main Sequence FastAPI release."
              : "OpenAPI request was rejected. Refresh the session or verify the target API."
            : `OpenAPI request failed with ${response.status}.`,
        {
          responseContentType,
          responseSample,
          responseStatus: response.status,
          responseUrl: openApiUrl,
        },
      );
    }

    if (!payload || typeof payload !== "object" || !("paths" in payload)) {
      throw new AppComponentOpenApiDiscoveryError(
        "The target /openapi.json response did not look like an OpenAPI document.",
        {
          responseContentType,
          responseSample,
          responseStatus: response.status,
          responseUrl: openApiUrl,
        },
      );
    }

    const document = payload as OpenApiDocument;
    openApiDocumentCache.set(openApiCacheKey, {
      expiresAt: Date.now() + APP_COMPONENT_OPENAPI_CACHE_TTL_MS,
      value: cloneSerializable(document),
    });
    return document;
  })();

  inFlightOpenApiRequests.set(openApiCacheKey, requestPromise);

  try {
    return cloneSerializable(await requestPromise);
  } finally {
    inFlightOpenApiRequests.delete(openApiCacheKey);
  }
}

export async function submitAppComponentRequest({
  transportProps,
  method,
  url,
  headers,
  body,
  cache,
  traceMeta,
}: {
  transportProps: AppComponentWidgetProps;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  cache?: AppComponentResponseCacheOptions;
  traceMeta?: DashboardRequestTraceMeta;
}) {
  const normalizedTransportProps = {
    ...transportProps,
    authMode: normalizeAppComponentAuthMode(transportProps.authMode),
  } satisfies AppComponentWidgetProps;
  const normalizedMethod = method.trim().toUpperCase();
  const shouldUseSafeResponseCache =
    cache?.enabled === true && isSafeCacheableMethod(normalizedMethod);

  if (env.useMockData || isWidgetPreviewMode()) {
    return submitMockRequest({
      method: normalizedMethod,
      url,
      body,
    });
  }

  if (shouldUseSafeResponseCache) {
    const cacheKey = await buildSafeResponseCacheKey({
      transportIdentity: buildAppComponentTransportIdentityKey(
        normalizedTransportProps,
      ),
      body,
      headers,
      method: normalizedMethod,
      url,
    });
    const cachedResponse = pruneExpiredEntry(safeResponseCache, cacheKey);

    if (cachedResponse) {
      startDashboardRequestTrace(traceMeta, {
        method: normalizedMethod,
        url,
      })?.finish({
        ok: true,
        status: cachedResponse.value.status,
        resolution: "cache-hit",
      });
      return cloneSerializable(cachedResponse.value);
    }

    const inFlightResponse = inFlightSafeResponses.get(cacheKey);

    if (inFlightResponse) {
      startDashboardRequestTrace(traceMeta, {
        method: normalizedMethod,
        url,
      })?.finish({
        ok: true,
        status: 200,
        resolution: "shared-promise",
      });
      return cloneSerializable(await inFlightResponse);
    }

    const requestPromise = (async () => {
      const response = isAppComponentMainSequenceResourceReleaseMode(
        normalizedTransportProps,
      )
        ? await sendMainSequenceReleaseRequest(url, {
            props: normalizedTransportProps,
            init: {
              method: normalizedMethod,
              headers,
              body,
            },
            traceMeta,
          })
        : await sendAuthenticatedRequest(url, {
            authMode: normalizedTransportProps.authMode ?? "session-jwt",
            init: {
              method: normalizedMethod,
              headers,
              body,
            },
            traceMeta,
          });
      const normalizedResponse = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url,
        headers: readHeaders(response),
        body: await readResponseBody(response),
      } satisfies AppComponentTransportResponse;

      if (normalizedResponse.ok) {
        safeResponseCache.set(cacheKey, {
          expiresAt: Date.now() + (cache?.ttlMs ?? APP_COMPONENT_SAFE_RESPONSE_CACHE_TTL_MS),
          value: cloneSerializable(normalizedResponse),
        });
      }

      return normalizedResponse;
    })();

    inFlightSafeResponses.set(cacheKey, requestPromise);

    try {
      return cloneSerializable(await requestPromise);
    } finally {
      inFlightSafeResponses.delete(cacheKey);
    }
  }

  const response = isAppComponentMainSequenceResourceReleaseMode(
    normalizedTransportProps,
  )
    ? await sendMainSequenceReleaseRequest(url, {
        props: normalizedTransportProps,
        init: {
          method: normalizedMethod,
          headers,
          body,
        },
        traceMeta,
      })
    : await sendAuthenticatedRequest(url, {
        authMode: normalizedTransportProps.authMode ?? "session-jwt",
        init: {
          method: normalizedMethod,
          headers,
          body,
        },
        traceMeta,
      });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    headers: readHeaders(response),
    body: await readResponseBody(response),
  } satisfies AppComponentTransportResponse;
}
