import { commandCenterConfig, type AssistantUiProtocol } from "@/config/command-center";
import { fetchOrCreateCommandCenterBaseSession } from "./command-center-base-session-api";

export interface MainSequenceAiResolvedAssistantAccess {
  assistantEndpoint: string;
  codingAgentId: string | null;
  codingAgentServiceId: string | null;
  mode: "configured" | "dynamic";
  runtimeAccessMode: string | null;
  token: string | null;
}

export type MainSequenceAiAssistantRuntimeTarget = "agent-runtime" | "configured";

const BLANK_CONFIGURED_ASSISTANT_ENDPOINT_FALLBACK = "/";

let cachedDynamicAssistantAccess: MainSequenceAiResolvedAssistantAccess | null = null;
let cachedDynamicAssistantAccessSessionId: string | null = null;
let inFlightDynamicAssistantAccessRefresh: Promise<MainSequenceAiResolvedAssistantAccess> | null = null;
let inFlightDynamicAssistantAccessSessionId: string | null = null;

export function normalizeMainSequenceAiAssistantEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();

  if (!trimmed) {
    throw new Error("assistant_ui.endpoint is blank.");
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  const protocol = window.location.protocol === "https:" ? "https://" : "http://";
  return `${protocol}${trimmed}`;
}

export function resolveMainSequenceAiConfiguredAssistantEndpoint() {
  const endpoint = commandCenterConfig.assistantUi.endpoint?.trim() ?? "";
  return endpoint ? normalizeMainSequenceAiAssistantEndpoint(endpoint) : null;
}

function toAssistantBaseUrl(endpoint: string) {
  const normalized = normalizeMainSequenceAiAssistantEndpoint(endpoint);

  if (normalized.startsWith("/")) {
    return new URL(normalized, window.location.origin);
  }

  return new URL(normalized);
}

export function resolveMainSequenceAiAssistantEndpoint() {
  return (
    resolveMainSequenceAiConfiguredAssistantEndpoint() ??
    BLANK_CONFIGURED_ASSISTANT_ENDPOINT_FALLBACK
  );
}

export function buildMainSequenceAiAssistantUrl(assistantEndpoint: string, requestPath: string) {
  if (/^https?:\/\//i.test(requestPath)) {
    return requestPath;
  }

  const base = toAssistantBaseUrl(assistantEndpoint);
  const prefix = base.pathname.replace(/\/+$/, "");
  const requestUrl = new URL(
    requestPath.startsWith("/") ? requestPath : `/${requestPath}`,
    "http://assistant.local",
  );

  base.pathname = `${prefix}${requestUrl.pathname}`.replace(/\/{2,}/g, "/");
  base.search = requestUrl.search;
  base.hash = requestUrl.hash;

  return base.toString();
}

export function buildMainSequenceAiAssistantChatUrl(assistantEndpoint: string) {
  return buildMainSequenceAiAssistantUrl(assistantEndpoint, "/api/chat");
}

export function resolveMainSequenceAiAssistantChatEndpoint() {
  return buildMainSequenceAiAssistantChatUrl(resolveMainSequenceAiAssistantEndpoint());
}

export function resolveMainSequenceAiAssistantProtocol(): AssistantUiProtocol {
  return commandCenterConfig.assistantUi.protocol;
}

export function buildMainSequenceAiAssistantHeaders({
  accept,
  token,
  tokenType = "Bearer",
}: {
  accept?: string;
  token?: string | null;
  tokenType?: string;
}) {
  const headers = new Headers();

  if (accept) {
    headers.set("Accept", accept);
  }

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  return headers;
}

function normalizeDynamicAssistantAccess(
  payload: Awaited<ReturnType<typeof fetchOrCreateCommandCenterBaseSession>>,
): MainSequenceAiResolvedAssistantAccess {
  const rpcUrl = payload.runtimeAccess?.rpcUrl?.trim();
  const runtimeToken = payload.runtimeAccess?.token?.trim();

  if (!rpcUrl) {
    throw new Error(
      "Command Center runtime access did not include rpc_url.",
    );
  }

  if (!runtimeToken) {
    throw new Error(
      "Command Center runtime access did not include token.",
    );
  }

  return {
    assistantEndpoint: normalizeMainSequenceAiAssistantEndpoint(rpcUrl),
    codingAgentId: payload.runtimeAccess?.codingAgentId ?? null,
    codingAgentServiceId: payload.runtimeAccess?.codingAgentServiceId ?? null,
    mode: "dynamic",
    runtimeAccessMode: payload.runtimeAccess?.mode ?? null,
    token: runtimeToken,
  };
}

export function setMainSequenceAiResolvedRuntimeAccess(
  payload: Awaited<ReturnType<typeof fetchOrCreateCommandCenterBaseSession>> | null,
) {
  if (!payload?.runtimeAccess) {
    cachedDynamicAssistantAccess = null;
    return;
  }

  cachedDynamicAssistantAccess = normalizeDynamicAssistantAccess(payload);
}

export function clearMainSequenceAiResolvedRuntimeAccess() {
  cachedDynamicAssistantAccess = null;
  cachedDynamicAssistantAccessSessionId = null;
  inFlightDynamicAssistantAccessSessionId = null;
}

function normalizeRuntimeSessionId(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

async function refreshDynamicAssistantAccess({
  currentSessionId,
  sessionToken,
  sessionTokenType = "Bearer",
}: {
  currentSessionId?: string | number | null;
  sessionToken?: string | null;
  sessionTokenType?: string;
}) {
  const normalizedCurrentSessionId = normalizeRuntimeSessionId(currentSessionId);

  if (
    inFlightDynamicAssistantAccessRefresh &&
    inFlightDynamicAssistantAccessSessionId === normalizedCurrentSessionId
  ) {
    return inFlightDynamicAssistantAccessRefresh;
  }

  if (!sessionToken) {
    throw new Error("No authenticated session token is available for dynamic assistant access.");
  }

  const refreshPromise = (async () => {
    const payload = await fetchOrCreateCommandCenterBaseSession({
      currentSessionId: normalizedCurrentSessionId,
      token: sessionToken,
      tokenType: sessionTokenType,
    });
    const resolved = normalizeDynamicAssistantAccess(payload);
    cachedDynamicAssistantAccess = resolved;
    cachedDynamicAssistantAccessSessionId = normalizedCurrentSessionId;
    return resolved;
  })();

  inFlightDynamicAssistantAccessRefresh = refreshPromise;
  inFlightDynamicAssistantAccessSessionId = normalizedCurrentSessionId;

  try {
    return await refreshPromise;
  } catch (error) {
    cachedDynamicAssistantAccess = null;
    cachedDynamicAssistantAccessSessionId = null;
    throw error;
  } finally {
    if (inFlightDynamicAssistantAccessRefresh === refreshPromise) {
      inFlightDynamicAssistantAccessRefresh = null;
      inFlightDynamicAssistantAccessSessionId = null;
    }
  }
}

export async function resolveMainSequenceAiAssistantAccess({
  assistantEndpoint,
  currentSessionId,
  forceRefresh = false,
  runtimeTarget = "agent-runtime",
  sessionToken,
  sessionTokenType = "Bearer",
}: {
  assistantEndpoint?: string;
  currentSessionId?: string | number | null;
  forceRefresh?: boolean;
  runtimeTarget?: MainSequenceAiAssistantRuntimeTarget;
  sessionToken?: string | null;
  sessionTokenType?: string;
}): Promise<MainSequenceAiResolvedAssistantAccess> {
  if (runtimeTarget === "configured") {
    const configuredAssistantEndpoint =
      assistantEndpoint?.trim()
        ? normalizeMainSequenceAiAssistantEndpoint(assistantEndpoint)
        : resolveMainSequenceAiConfiguredAssistantEndpoint();

    if (!configuredAssistantEndpoint) {
      throw new Error("assistant_ui.endpoint is blank.");
    }

    return {
      assistantEndpoint: configuredAssistantEndpoint,
      codingAgentId: null,
      codingAgentServiceId: null,
      mode: "configured",
      runtimeAccessMode: null,
      token: sessionToken ?? null,
    };
  }

  const normalizedCurrentSessionId = normalizeRuntimeSessionId(currentSessionId);

  if (
    !forceRefresh &&
    cachedDynamicAssistantAccess &&
    (!normalizedCurrentSessionId ||
      cachedDynamicAssistantAccessSessionId === normalizedCurrentSessionId)
  ) {
    return cachedDynamicAssistantAccess;
  }

  return refreshDynamicAssistantAccess({
    currentSessionId: normalizedCurrentSessionId,
    sessionToken,
    sessionTokenType,
  });
}

function mergeAssistantHeaders({
  accept,
  headers,
  resolvedAccess,
}: {
  accept?: string;
  headers?: HeadersInit;
  resolvedAccess: MainSequenceAiResolvedAssistantAccess;
}) {
  const mergedHeaders = new Headers(headers);

  if (accept && !mergedHeaders.has("Accept")) {
    mergedHeaders.set("Accept", accept);
  }

  if (resolvedAccess.token) {
    mergedHeaders.set("Authorization", `Bearer ${resolvedAccess.token}`);
  }

  return mergedHeaders;
}

export async function fetchMainSequenceAiAssistantResponse({
  accept,
  assistantEndpoint,
  credentials = "same-origin",
  currentSessionId,
  headers,
  requestPath,
  retryOnAuthFailure = true,
  runtimeTarget = "agent-runtime",
  sessionToken,
  sessionTokenType = "Bearer",
  ...init
}: Omit<RequestInit, "headers"> & {
  accept?: string;
  assistantEndpoint?: string;
  currentSessionId?: string | number | null;
  headers?: HeadersInit;
  requestPath: string;
  retryOnAuthFailure?: boolean;
  runtimeTarget?: MainSequenceAiAssistantRuntimeTarget;
  sessionToken?: string | null;
  sessionTokenType?: string;
}) {
  const execute = async (forceRefresh: boolean) => {
    const resolvedAccess = await resolveMainSequenceAiAssistantAccess({
      assistantEndpoint,
      currentSessionId,
      forceRefresh,
      runtimeTarget,
      sessionToken,
      sessionTokenType,
    });
    const url = buildMainSequenceAiAssistantUrl(resolvedAccess.assistantEndpoint, requestPath);
    const response = await fetch(url, {
      ...init,
      credentials,
      headers: mergeAssistantHeaders({
        accept,
        headers,
        resolvedAccess,
      }),
    });

    return {
      resolvedAccess,
      response,
      url,
    };
  };

  const firstAttempt = await execute(false);

  if (
    retryOnAuthFailure &&
    firstAttempt.resolvedAccess.mode === "dynamic" &&
    (firstAttempt.response.status === 401 || firstAttempt.response.status === 403)
  ) {
    return execute(true);
  }

  return firstAttempt;
}
