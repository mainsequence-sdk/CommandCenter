import { commandCenterConfig, type AssistantUiProtocol } from "@/config/command-center";
import { fetchAstroCommandCenterAgentServiceByUser } from "../../main_sequence/common/api";
import type { AgentImageDriftRecord } from "../agent-search";
import {
  ASTRO_COMMAND_CENTER_HANDLE_UNIQUE_ID,
  ASTRO_COMMAND_CENTER_SESSION_NAME,
  fetchAgentSessionRuntimeAccess,
  type AgentSessionRuntimeAccess,
} from "./command-center-base-session-api";
import {
  getOrCreateAgentSessionRequest,
  normalizeAgentSessionLookupId,
  type StartedAgentSessionResult,
} from "./agent-sessions-api";
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
  serviceRuntimeId: string | null;
  mode: "dynamic";
  runtimeAccessMode: string | null;
  token: string | null;
}

export type MainSequenceAiAssistantRuntimeTarget =
  | "agent-runtime"
  | "command-center-base";

let cachedDynamicAssistantAccess: MainSequenceAiResolvedAssistantAccess | null = null;
let cachedDynamicAssistantAccessSessionId: string | null = null;
let inFlightDynamicAssistantAccessRefresh: Promise<MainSequenceAiResolvedAssistantAccess> | null = null;
let inFlightDynamicAssistantAccessSessionId: string | null = null;
let cachedCommandCenterBaseAssistantAccess: MainSequenceAiResolvedAssistantAccess | null = null;
let cachedCommandCenterBaseAssistantAccessEndpoint: string | null = null;
let cachedCommandCenterBaseAssistantAccessUserUid: string | null = null;
let cachedCommandCenterBaseAgentUid: string | null = null;
let cachedCommandCenterBaseAgentUserUid: string | null = null;
let cachedCommandCenterBaseSessionResult: StartedAgentSessionResult | null = null;
let inFlightCommandCenterBaseAssistantAccessRefresh: Promise<MainSequenceAiResolvedAssistantAccess> | null =
  null;
let inFlightCommandCenterBaseAssistantAccessEndpoint: string | null = null;
let inFlightCommandCenterBaseAssistantAccessUserUid: string | null = null;

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
  payload: AgentSessionRuntimeAccess,
  {
    assistantEndpoint,
  }: {
    assistantEndpoint?: string | null;
  } = {},
): MainSequenceAiResolvedAssistantAccess {
  const rpcUrl = payload.rpcUrl?.trim();
  const runtimeToken = payload.token?.trim();
  const resolvedAssistantEndpoint = assistantEndpoint?.trim()
    ? normalizeMainSequenceAiAssistantEndpoint(assistantEndpoint)
    : rpcUrl
      ? normalizeMainSequenceAiAssistantEndpoint(rpcUrl)
      : null;

  if (!resolvedAssistantEndpoint) {
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
    assistantEndpoint: resolvedAssistantEndpoint,
    codingAgentId: payload.codingAgentId,
    codingAgentServiceId: payload.codingAgentServiceId,
    imageDrift: payload.imageDrift,
    isReady: payload.isReady,
    serviceRuntimeId: payload.serviceRuntimeId,
    mode: "dynamic",
    runtimeAccessMode: payload.mode,
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
  cachedCommandCenterBaseAssistantAccessEndpoint = null;
  cachedCommandCenterBaseAssistantAccessUserUid = null;
  cachedCommandCenterBaseAgentUid = null;
  cachedCommandCenterBaseAgentUserUid = null;
  cachedCommandCenterBaseSessionResult = null;
  inFlightCommandCenterBaseAssistantAccessRefresh = null;
  inFlightCommandCenterBaseAssistantAccessEndpoint = null;
  inFlightCommandCenterBaseAssistantAccessUserUid = null;
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

  const runtimeAccess = await fetchAgentSessionRuntimeAccess({
    sessionId: normalizedCurrentSessionId,
    signal,
    token: sessionToken,
    tokenType: sessionTokenType,
  });
  const access = normalizeDynamicAssistantAccess(runtimeAccess);
  cacheDynamicAssistantAccess(access, normalizedCurrentSessionId);

  return { access, runtimeAccess };
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
  assistantEndpoint,
  signal,
  sessionToken,
  sessionTokenType = "Bearer",
  sessionUserUid,
}: {
  assistantEndpoint?: string | null;
  signal?: AbortSignal;
  sessionToken?: string | null;
  sessionTokenType?: string;
  sessionUserUid?: string | null;
}) {
  if (!sessionToken) {
    throw new MainSequenceAiError(
      "No authenticated session token is available for Command Center runtime access.",
      {
        source: "frontend",
      },
    );
  }

  if (!sessionUserUid?.trim()) {
    throw new MainSequenceAiError(
      "Signed-in user uid is required before resolving Command Center runtime access.",
      {
        source: "frontend",
      },
    );
  }

  const normalizedSessionUserUid = sessionUserUid.trim();
  if (cachedCommandCenterBaseAgentUserUid !== normalizedSessionUserUid) {
    cachedCommandCenterBaseAgentUid = null;
    cachedCommandCenterBaseSessionResult = null;
  }

  const agentUid =
    cachedCommandCenterBaseAgentUserUid === normalizedSessionUserUid
      ? cachedCommandCenterBaseAgentUid
      : null;
  const serviceAgentUid =
    agentUid ??
    (await fetchAstroCommandCenterAgentServiceByUser(normalizedSessionUserUid, {
      signal,
    }))?.agent_uid ??
    null;

  if (!serviceAgentUid) {
    throw new MainSequenceAiError(
      "Astro has not been deployed. Deploy Astro before opening Command Center runtime access.",
      {
        source: "frontend_runtime_guard",
      },
    );
  }

  cachedCommandCenterBaseAgentUid = serviceAgentUid;
  cachedCommandCenterBaseAgentUserUid = normalizedSessionUserUid;

  const sessionResult =
    cachedCommandCenterBaseSessionResult ??
    (await getOrCreateAgentSessionRequest({
      agentUid: serviceAgentUid,
      handleUniqueId: ASTRO_COMMAND_CENTER_HANDLE_UNIQUE_ID,
      name: ASTRO_COMMAND_CENTER_SESSION_NAME,
      signal,
      token: sessionToken,
      tokenType: sessionTokenType,
    }));

  cachedCommandCenterBaseSessionResult = sessionResult;

  const runtimeAccess = await fetchAgentSessionRuntimeAccess({
    sessionId: sessionResult.sessionId,
    signal,
    token: sessionToken,
    tokenType: sessionTokenType,
  });
  const access = normalizeDynamicAssistantAccess(runtimeAccess, {
    assistantEndpoint,
  });
  cachedCommandCenterBaseAssistantAccess = access;
  cachedCommandCenterBaseAssistantAccessEndpoint = assistantEndpoint?.trim()
    ? normalizeMainSequenceAiAssistantEndpoint(assistantEndpoint)
    : null;
  cachedCommandCenterBaseAssistantAccessUserUid = normalizedSessionUserUid;

  return {
    access,
    runtimeAccess,
    agentUid: serviceAgentUid,
    sessionResult,
  };
}

async function refreshCommandCenterBaseAssistantAccess({
  assistantEndpoint,
  sessionToken,
  sessionTokenType = "Bearer",
  sessionUserUid,
}: {
  assistantEndpoint?: string | null;
  sessionToken?: string | null;
  sessionTokenType?: string;
  sessionUserUid?: string | null;
}) {
  const normalizedAssistantEndpoint = assistantEndpoint?.trim()
    ? normalizeMainSequenceAiAssistantEndpoint(assistantEndpoint)
    : null;
  const normalizedSessionUserUid = sessionUserUid?.trim() || null;

  if (
    inFlightCommandCenterBaseAssistantAccessRefresh &&
    inFlightCommandCenterBaseAssistantAccessEndpoint === normalizedAssistantEndpoint &&
    inFlightCommandCenterBaseAssistantAccessUserUid === normalizedSessionUserUid
  ) {
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
      assistantEndpoint: normalizedAssistantEndpoint,
      sessionToken,
      sessionTokenType,
      sessionUserUid,
    });
    return access;
  })();

  inFlightCommandCenterBaseAssistantAccessRefresh = refreshPromise;
  inFlightCommandCenterBaseAssistantAccessEndpoint = normalizedAssistantEndpoint;
  inFlightCommandCenterBaseAssistantAccessUserUid = normalizedSessionUserUid;

  try {
    return await refreshPromise;
  } catch (error) {
    cachedCommandCenterBaseAssistantAccess = null;
    cachedCommandCenterBaseAssistantAccessEndpoint = null;
    cachedCommandCenterBaseAssistantAccessUserUid = null;
    cachedCommandCenterBaseSessionResult = null;
    throw error;
  } finally {
    if (inFlightCommandCenterBaseAssistantAccessRefresh === refreshPromise) {
      inFlightCommandCenterBaseAssistantAccessRefresh = null;
      inFlightCommandCenterBaseAssistantAccessEndpoint = null;
      inFlightCommandCenterBaseAssistantAccessUserUid = null;
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
  sessionUserUid,
}: {
  assistantEndpoint?: string;
  currentSessionId?: string | number | null;
  forceRefresh?: boolean;
  runtimeTarget?: MainSequenceAiAssistantRuntimeTarget;
  sessionToken?: string | null;
  sessionTokenType?: string;
  sessionUserUid?: string | null;
}): Promise<MainSequenceAiResolvedAssistantAccess> {
  if (runtimeTarget === "command-center-base") {
    const configuredAssistantEndpoint =
      assistantEndpoint?.trim()
        ? normalizeMainSequenceAiAssistantEndpoint(assistantEndpoint)
        : resolveMainSequenceAiConfiguredAssistantEndpoint();

    if (
      !forceRefresh &&
      cachedCommandCenterBaseAssistantAccess &&
      cachedCommandCenterBaseAssistantAccessEndpoint === configuredAssistantEndpoint &&
      cachedCommandCenterBaseAssistantAccessUserUid === (sessionUserUid?.trim() || null)
    ) {
      return cachedCommandCenterBaseAssistantAccess;
    }

    return refreshCommandCenterBaseAssistantAccess({
      assistantEndpoint: configuredAssistantEndpoint,
      sessionToken,
      sessionTokenType,
      sessionUserUid,
    });
  }

  const normalizedCurrentSessionId = normalizeRuntimeSessionId(currentSessionId);

  if (normalizedCurrentSessionId) {
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

  throw new MainSequenceAiError(
    "AgentSession runtime access requires a concrete session id or command-center-base target.",
    {
      source: "frontend_runtime_guard",
    },
  );
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
  sessionUserUid,
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
  sessionUserUid?: string | null;
}) {
  const execute = async (forceRefresh: boolean) => {
    const resolvedAccess = await resolveMainSequenceAiAssistantAccess({
      assistantEndpoint,
      currentSessionId,
      forceRefresh,
      runtimeTarget,
      sessionToken,
      sessionTokenType,
      sessionUserUid,
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
    (firstAttempt.response.status === 401 || firstAttempt.response.status === 403)
  ) {
    return execute(true);
  }

  return firstAttempt;
}
