import { commandCenterConfig, type AssistantUiProtocol } from "@/config/command-center";
import type { AgentImageDriftRecord } from "../agent-search";
import {
  fetchAgentSessionRuntimeAccess,
  fetchCommandCenterBaseSessionHandle,
  type CommandCenterBaseSessionHandle,
} from "./command-center-base-session-api";
import { normalizeAgentSessionLookupId } from "./agent-sessions-api";
import { MainSequenceAiError } from "./error-source";

const rawEnv = import.meta.env as Record<string, string | undefined>;
const projectExecutorAgentType = "project-executor";
const assistantExecutorProxyPrefix = "/__assistant_executor__";

export interface MainSequenceAiResolvedAssistantAccess {
  assistantEndpoint: string;
  codingAgentId: string | null;
  codingAgentServiceId: string | null;
  imageDrift: AgentImageDriftRecord | null;
  isReady: boolean | null;
  knativeServiceRuntimeId: string | null;
  mode: "configured" | "dynamic";
  runtimeAccessMode: string | null;
  token: string | null;
}

export type MainSequenceAiAssistantRuntimeTarget =
  | "agent-runtime"
  | "configured"
  | "command-center-base";

let cachedDynamicAssistantAccess: MainSequenceAiResolvedAssistantAccess | null = null;
let cachedDynamicAssistantAccessSessionId: string | null = null;
let inFlightDynamicAssistantAccessRefresh: Promise<MainSequenceAiResolvedAssistantAccess> | null = null;
let inFlightDynamicAssistantAccessSessionId: string | null = null;
let cachedCommandCenterBaseAssistantAccess: MainSequenceAiResolvedAssistantAccess | null = null;
let inFlightCommandCenterBaseAssistantAccessRefresh: Promise<MainSequenceAiResolvedAssistantAccess> | null =
  null;

export function normalizeMainSequenceAiAssistantEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();

  if (!trimmed) {
    throw new MainSequenceAiError("assistant_ui.endpoint is blank.", {
      source: "frontend",
    });
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

export function isMainSequenceAiAssistantProxyMode() {
  return Boolean(rawEnv.VITE_ASSISTANT_UI_PROXY_TARGET?.trim());
}

export function isMainSequenceProjectExecutorAgentType(
  value: string | null | undefined,
) {
  return value?.trim().toLowerCase() === projectExecutorAgentType;
}

export function resolveMainSequenceAiAssistantEndpointForAgentType(
  agentType: string | null | undefined,
): string | undefined {
  if (isMainSequenceAiAssistantProxyMode()) {
    if (isMainSequenceProjectExecutorAgentType(agentType)) {
      if (rawEnv.VITE_ASSISTANT_UI_EXECUTOR_TARGET?.trim()) {
        return normalizeMainSequenceAiAssistantEndpoint(assistantExecutorProxyPrefix);
      }

      return undefined;
    }
  }

  return resolveMainSequenceAiConfiguredAssistantEndpoint() ?? undefined;
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
    throw new MainSequenceAiError("assistant_ui.endpoint is blank.", {
      source: "frontend",
    });
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
    throw new MainSequenceAiError("resolve_runtime_access response did not include rpc_url.", {
      source: "frontend_runtime_parser",
    });
  }

  if (!runtimeToken) {
    throw new MainSequenceAiError("resolve_runtime_access response did not include token.", {
      source: "frontend_runtime_parser",
    });
  }

  return {
    assistantEndpoint: normalizeMainSequenceAiAssistantEndpoint(rpcUrl),
    codingAgentId: payload.runtimeAccess?.codingAgentId ?? null,
    codingAgentServiceId: payload.runtimeAccess?.codingAgentServiceId ?? null,
    imageDrift: payload.runtimeAccess?.imageDrift ?? null,
    isReady: payload.runtimeAccess?.isReady ?? null,
    knativeServiceRuntimeId: payload.runtimeAccess?.knativeServiceRuntimeId ?? null,
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
  cachedCommandCenterBaseAssistantAccess = null;
  inFlightCommandCenterBaseAssistantAccessRefresh = null;
}

function normalizeRuntimeSessionId(value: string | number | null | undefined) {
  return normalizeAgentSessionLookupId(value);
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

  if (!normalizedCurrentSessionId) {
    throw new MainSequenceAiError("AgentSession runtime access requires a concrete session id.", {
      source: "frontend_runtime_guard",
    });
  }

  if (!sessionToken) {
    throw new MainSequenceAiError(
      "No authenticated session token is available for dynamic assistant access.",
      {
        source: "frontend",
      },
    );
  }

  const handle = await fetchAgentSessionRuntimeAccess({
    sessionId: normalizedCurrentSessionId,
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
    throw new MainSequenceAiError(
      "No authenticated session token is available for dynamic assistant access.",
      {
        source: "frontend",
      },
    );
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

export async function fetchMainSequenceAiOperationalCommandCenterRuntimeHandle({
  signal,
  sessionToken,
  sessionTokenType = "Bearer",
}: {
  signal?: AbortSignal;
  sessionToken?: string | null;
  sessionTokenType?: string;
}) {
  if (!sessionToken) {
    throw new MainSequenceAiError(
      "No authenticated session token is available for Command Center runtime access.",
      {
        source: "frontend",
      },
    );
  }

  const handle = await fetchCommandCenterBaseSessionHandle({
    signal,
    token: sessionToken,
    tokenType: sessionTokenType,
  });
  const access = normalizeDynamicAssistantAccess(handle);
  cachedCommandCenterBaseAssistantAccess = access;

  return { access, handle };
}

async function refreshCommandCenterBaseAssistantAccess({
  sessionToken,
  sessionTokenType = "Bearer",
}: {
  sessionToken?: string | null;
  sessionTokenType?: string;
}) {
  if (inFlightCommandCenterBaseAssistantAccessRefresh) {
    return inFlightCommandCenterBaseAssistantAccessRefresh;
  }

  if (!sessionToken) {
    throw new MainSequenceAiError(
      "No authenticated session token is available for Command Center runtime access.",
      {
        source: "frontend",
      },
    );
  }

  const refreshPromise = (async () => {
    const { access } = await fetchMainSequenceAiOperationalCommandCenterRuntimeHandle({
      sessionToken,
      sessionTokenType,
    });
    return access;
  })();

  inFlightCommandCenterBaseAssistantAccessRefresh = refreshPromise;

  try {
    return await refreshPromise;
  } catch (error) {
    cachedCommandCenterBaseAssistantAccess = null;
    throw error;
  } finally {
    if (inFlightCommandCenterBaseAssistantAccessRefresh === refreshPromise) {
      inFlightCommandCenterBaseAssistantAccessRefresh = null;
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
  if (
    runtimeTarget === "configured" ||
    (isMainSequenceAiAssistantProxyMode() && Boolean(assistantEndpoint?.trim()))
  ) {
    const configuredAssistantEndpoint =
      assistantEndpoint?.trim()
        ? normalizeMainSequenceAiAssistantEndpoint(assistantEndpoint)
        : resolveMainSequenceAiConfiguredAssistantEndpoint();

    if (!configuredAssistantEndpoint) {
      throw new MainSequenceAiError("assistant_ui.endpoint is blank.", {
        source: "frontend",
      });
    }

    return {
      assistantEndpoint: configuredAssistantEndpoint,
      codingAgentId: null,
      codingAgentServiceId: null,
      imageDrift: null,
      isReady: null,
      knativeServiceRuntimeId: null,
      mode: "configured",
      runtimeAccessMode: null,
      token: sessionToken ?? null,
    };
  }

  if (runtimeTarget === "command-center-base") {
    if (!forceRefresh && cachedCommandCenterBaseAssistantAccess) {
      return cachedCommandCenterBaseAssistantAccess;
    }

    return refreshCommandCenterBaseAssistantAccess({
      sessionToken,
      sessionTokenType,
    });
  }

  const normalizedCurrentSessionId = normalizeRuntimeSessionId(currentSessionId);

  if (!normalizedCurrentSessionId) {
    throw new MainSequenceAiError("AgentSession runtime access requires a concrete session id.", {
      source: "frontend_runtime_guard",
    });
  }

  if (
    !forceRefresh &&
    cachedDynamicAssistantAccess &&
    cachedDynamicAssistantAccessSessionId === normalizedCurrentSessionId
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
