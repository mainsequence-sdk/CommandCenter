import { commandCenterConfig, type AssistantUiProtocol } from "@/config/command-center";
import {
  fetchOrCreateCommandCenterBaseSession,
  type CommandCenterBaseSessionHandle,
} from "./command-center-base-session-api";

export interface MainSequenceAiResolvedAssistantAccess {
  assistantEndpoint: string;
  codingAgentId: string | null;
  codingAgentServiceId: string | null;
  mode: "configured" | "dynamic";
  runtimeAccessMode: string | null;
  token: string | null;
}

export type MainSequenceAiAssistantRuntimeTarget = "agent-runtime" | "configured";

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
  const configuredAssistantEndpoint = resolveMainSequenceAiConfiguredAssistantEndpoint();

  if (!configuredAssistantEndpoint) {
    throw new Error("assistant_ui.endpoint is blank.");
  }

  return configuredAssistantEndpoint;
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
  payload: CommandCenterBaseSessionHandle,
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

function cacheDynamicAssistantAccess(
  access: MainSequenceAiResolvedAssistantAccess | null,
  currentSessionId: string | null,
) {
  if (!access) {
    cachedDynamicAssistantAccess = null;
    cachedDynamicAssistantAccessSessionId = null;
    return;
  }

  cachedDynamicAssistantAccess = access;
  cachedDynamicAssistantAccessSessionId = currentSessionId;
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

export async function fetchMainSequenceAiCommandCenterRuntimeHandle({
  currentSessionId,
  signal,
  sessionToken,
  sessionTokenType = "Bearer",
}: {
  currentSessionId?: string | number | null;
  signal?: AbortSignal;
  sessionToken?: string | null;
  sessionTokenType?: string;
}) {
  const normalizedCurrentSessionId = normalizeRuntimeSessionId(currentSessionId);

  if (!sessionToken) {
    throw new Error("No authenticated session token is available for dynamic assistant access.");
  }

  const handle = await fetchOrCreateCommandCenterBaseSession({
    currentSessionId: normalizedCurrentSessionId,
    signal,
    token: sessionToken,
    tokenType: sessionTokenType,
  });
  const access = normalizeDynamicAssistantAccess(handle);
  cacheDynamicAssistantAccess(access, normalizedCurrentSessionId);

  return { access, handle };
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
    const { access } = await fetchMainSequenceAiCommandCenterRuntimeHandle({
      currentSessionId: normalizedCurrentSessionId,
      sessionToken,
      sessionTokenType,
    });
    return access;
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
