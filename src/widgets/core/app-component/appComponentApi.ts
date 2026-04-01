import { useAuthStore } from "@/auth/auth-store";
import { env } from "@/config/env";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";

import {
  appComponentMockOpenApiDocument,
  buildAppComponentOpenApiUrl,
  normalizeAppComponentAuthMode,
  tryResolveAppComponentBaseUrl,
  type AppComponentAuthMode,
  type OpenApiDocument,
} from "./appComponentModel";

const appComponentProxyPrefix = "/__app_component_proxy__";

function isLoopbackHostname(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function buildTransportUrl(requestUrl: string) {
  const resolvedUrl = new URL(requestUrl);

  if (import.meta.env.DEV && isLoopbackHostname(resolvedUrl.hostname)) {
    return `${appComponentProxyPrefix}?target=${encodeURIComponent(resolvedUrl.toString())}`;
  }

  return resolvedUrl.toString();
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
  baseUrl: string | null,
  authMode: AppComponentAuthMode,
) {
  return ["app-component", "openapi", baseUrl ?? "invalid", authMode] as const;
}

async function sendAuthenticatedRequest(
  requestUrl: string,
  {
    authMode,
    init,
  }: {
    authMode: AppComponentAuthMode;
    init?: RequestInit;
  },
) {
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

    return fetch(buildTransportUrl(requestUrl), {
      ...init,
      headers,
    });
  }

  let response: Response;

  try {
    response = await execute();
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "The browser could not reach the configured API.",
    );
  }

  if (response.status === 401 && authMode === "session-jwt") {
    const refreshed = await useAuthStore.getState().refreshSession();

    if (refreshed) {
      response = await execute();
    }
  }

  return response;
}

export async function fetchAppComponentOpenApiDocument({
  baseUrl,
  authMode,
}: {
  baseUrl: string;
  authMode?: AppComponentAuthMode;
}) {
  const normalizedAuthMode = normalizeAppComponentAuthMode(authMode);
  const resolvedBaseUrl = tryResolveAppComponentBaseUrl(baseUrl);

  if (!resolvedBaseUrl) {
    throw new Error("AppComponent requires a valid API base URL.");
  }

  if (env.useMockData || isWidgetPreviewMode()) {
    return appComponentMockOpenApiDocument satisfies OpenApiDocument;
  }

  const openApiUrl = buildAppComponentOpenApiUrl(resolvedBaseUrl);

  if (!openApiUrl) {
    throw new Error("AppComponent requires a valid API URL.");
  }

  const response = await sendAuthenticatedRequest(openApiUrl, {
    authMode: normalizedAuthMode,
  });
  const payload = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      typeof payload === "string"
        ? payload
        : response.status === 401
          ? "OpenAPI request was rejected. Refresh the session or verify the target API."
          : `OpenAPI request failed with ${response.status}.`,
    );
  }

  if (!payload || typeof payload !== "object" || !("paths" in payload)) {
    throw new Error("The target /openapi.json response did not look like an OpenAPI document.");
  }

  return payload as OpenApiDocument;
}

export async function submitAppComponentRequest({
  authMode,
  method,
  url,
  headers,
  body,
}: {
  authMode?: AppComponentAuthMode;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  const normalizedAuthMode = normalizeAppComponentAuthMode(authMode);

  if (env.useMockData || isWidgetPreviewMode()) {
    return submitMockRequest({
      method,
      url,
      body,
    });
  }

  const response = await sendAuthenticatedRequest(url, {
    authMode: normalizedAuthMode,
    init: {
      method,
      headers,
      body,
    },
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
