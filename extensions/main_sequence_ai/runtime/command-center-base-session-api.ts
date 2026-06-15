import { env } from "@/config/env";
import type { AgentImageDriftRecord } from "../agent-search";
import { normalizeAgentImageDriftRecord } from "../image-drift";
import { requireAgentSessionLookupId, normalizeAgentSessionLookupId } from "./agent-sessions-api";

const rawEnv = import.meta.env as Record<string, string | undefined>;

export interface CommandCenterBaseSessionHandle {
  sessionId: string;
  runtimeSessionId: string | null;
  threadId: string | null;
  sessionKey: string | null;
  handleUniqueId: string | null;
  runtimeAccess: {
    codingAgentId: string | null;
    codingAgentServiceId: string | null;
    mode: string | null;
    rpcUrl: string | null;
    token: string | null;
    isReady: boolean | null;
    knativeServiceRuntimeId: string | null;
    imageDrift: AgentImageDriftRecord | null;
  } | null;
  projectId: string | null;
  cwd: string | null;
  updatedAt: string | null;
  runtimeState: string | null;
  working: boolean;
  agent: {
    id: number | null;
    displayLabel: string | null;
    requestAgentType: string | null;
    agentUniqueId: string | null;
    llmProvider: string | null;
    llmModel: string | null;
  };
}

function buildCommandCenterBaseSessionHandleUrl() {
  return new URL(
    "/orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/",
    env.apiBaseUrl,
  ).toString();
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIdentifier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeString(value);
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractHandleCandidate(payload: unknown) {
  const candidate = asRecord(payload);

  for (const key of ["session_handle", "sessionHandle", "session", "result", "data"]) {
    const nested = candidate[key];

    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return asRecord(nested);
    }
  }

  return candidate;
}

function hasRuntimeAccessShape(value: Record<string, unknown>) {
  return Boolean(
    value.rpc_url ??
      value.rpcUrl ??
      value.token ??
      value.coding_agent_id ??
      value.codingAgentId ??
      value.coding_agent_service_id ??
      value.codingAgentServiceId,
  );
}

function normalizeCommandCenterBaseSessionHandle(
  payload: unknown,
  options: {
    fallbackSessionId?: string | number | null;
    sourceLabel?: string;
  } = {},
): CommandCenterBaseSessionHandle {
  const envelope = asRecord(payload);
  const extractedCandidate = extractHandleCandidate(payload);
  const candidate = {
    ...envelope,
    ...extractedCandidate,
  };
  const agentCandidate = asRecord(candidate.agent);
  const runtimeAccessEnvelopeCandidate = asRecord(
    candidate.runtime_access ?? candidate.runtimeAccess,
  );
  const runtimeAccessCandidate =
    Object.keys(runtimeAccessEnvelopeCandidate).length > 0
      ? runtimeAccessEnvelopeCandidate
      : hasRuntimeAccessShape(candidate)
        ? candidate
        : hasRuntimeAccessShape(envelope)
          ? envelope
          : {};
  const boundHandle =
    candidate.bound_handle && typeof candidate.bound_handle === "object" && !Array.isArray(candidate.bound_handle)
      ? asRecord(candidate.bound_handle)
      : Array.isArray(candidate.bound_handles) && candidate.bound_handles[0]
        ? asRecord(candidate.bound_handles[0])
        : null;
  const sessionId =
    normalizeAgentSessionLookupId(candidate.uid) ??
    normalizeAgentSessionLookupId(candidate.agent_session_uid) ??
    normalizeAgentSessionLookupId(candidate.session_uid) ??
    normalizeAgentSessionLookupId(candidate.sessionUid) ??
    normalizeAgentSessionLookupId(candidate.runtime_session_uid) ??
    normalizeAgentSessionLookupId(candidate.runtimeSessionUid) ??
    normalizeAgentSessionLookupId(options.fallbackSessionId);

  if (!sessionId) {
    throw new Error(
      `${options.sourceLabel ?? "Runtime access"} response did not include a valid session uid.`,
    );
  }

  return {
    sessionId,
    runtimeSessionId:
      normalizeAgentSessionLookupId(candidate.runtime_session_uid) ??
      normalizeAgentSessionLookupId(candidate.runtimeSessionUid) ??
      normalizeAgentSessionLookupId(candidate.agent_session_uid) ??
      normalizeAgentSessionLookupId(candidate.session_uid) ??
      normalizeAgentSessionLookupId(candidate.sessionUid) ??
      sessionId,
    threadId: normalizeString(candidate.thread_id) ?? normalizeString(candidate.threadId),
    sessionKey: normalizeString(candidate.session_key) ?? normalizeString(candidate.sessionKey),
    handleUniqueId:
      normalizeString(boundHandle?.handle_unique_id) ??
      normalizeString(candidate.handle_unique_id) ??
      normalizeString(candidate.handleUniqueId),
    runtimeAccess:
      Object.keys(runtimeAccessCandidate).length > 0
        ? {
            codingAgentId:
              normalizeIdentifier(
                runtimeAccessCandidate.coding_agent_id ?? runtimeAccessCandidate.codingAgentId,
              ),
            codingAgentServiceId:
              normalizeIdentifier(
                runtimeAccessCandidate.coding_agent_service_id ??
                  runtimeAccessCandidate.codingAgentServiceId,
              ),
            mode: normalizeString(runtimeAccessCandidate.mode),
            rpcUrl:
              normalizeString(runtimeAccessCandidate.rpc_url) ??
              normalizeString(runtimeAccessCandidate.rpcUrl),
            token: normalizeString(runtimeAccessCandidate.token),
            isReady:
              typeof runtimeAccessCandidate.is_ready === "boolean"
                ? runtimeAccessCandidate.is_ready
                : typeof runtimeAccessCandidate.isReady === "boolean"
                  ? runtimeAccessCandidate.isReady
                  : null,
            knativeServiceRuntimeId:
              normalizeIdentifier(
                runtimeAccessCandidate.knative_service_runtime ??
                  runtimeAccessCandidate.knativeServiceRuntime,
              ),
            imageDrift: normalizeAgentImageDriftRecord(
              runtimeAccessCandidate.image_drift ?? runtimeAccessCandidate.imageDrift,
            ),
          }
        : null,
    projectId: normalizeIdentifier(candidate.project_id) ?? normalizeIdentifier(candidate.projectId),
    cwd: normalizeString(candidate.cwd),
    updatedAt:
      normalizeString(candidate.updated_at) ??
      normalizeString(candidate.updatedAt) ??
      normalizeString(candidate.started_at) ??
      normalizeString(candidate.startedAt),
    runtimeState:
      normalizeString(candidate.runtime_state) ?? normalizeString(candidate.runtimeState),
    working: candidate.working === true,
    agent: {
      id: normalizeNumber(
        candidate.agent_id ?? candidate.agentId ?? agentCandidate.id ?? agentCandidate.agent_id,
      ),
      displayLabel:
        normalizeString(agentCandidate.display_label) ??
        normalizeString(agentCandidate.displayLabel) ??
        normalizeString(agentCandidate.label) ??
        normalizeString(candidate.agent_label) ??
        normalizeString(candidate.agentLabel),
      requestAgentType:
        normalizeString(candidate.agent_type) ??
        normalizeString(agentCandidate.agent_type),
      agentUniqueId:
        normalizeString(candidate.agent_unique_id) ??
        normalizeString(candidate.agentUniqueId) ??
        normalizeString(agentCandidate.agent_unique_id) ??
        normalizeString(agentCandidate.agentUniqueId),
      llmProvider:
        normalizeString(candidate.llm_provider) ??
        normalizeString(candidate.llmProvider) ??
        normalizeString(agentCandidate.llm_provider) ??
        normalizeString(agentCandidate.llmProvider),
      llmModel:
        normalizeString(candidate.llm_model) ??
        normalizeString(candidate.llmModel) ??
        normalizeString(agentCandidate.llm_model) ??
        normalizeString(agentCandidate.llmModel),
    },
  };
}

function buildAgentSessionRuntimeAccessUrl(sessionId: string | number) {
  const normalizedSessionId = requireAgentSessionLookupId(
    sessionId,
    "AgentSession runtime access",
  );
  return new URL(
    `/orm/api/agents/v1/sessions/${encodeURIComponent(normalizedSessionId)}/resolve_runtime_access/`,
    env.apiBaseUrl,
  ).toString();
}

function shouldSkipKnativeServiceCreation() {
  return Boolean(rawEnv.VITE_ASSISTANT_UI_PROXY_TARGET?.trim());
}

export async function fetchAgentSessionRuntimeAccess({
  sessionId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  sessionId: string | number;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const headers = new Headers({
    Accept: "application/json",
  });
  const createKnativeService = !shouldSkipKnativeServiceCreation();
  const requestBody = createKnativeService ? null : { create_knative_service: false };

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  if (requestBody) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildAgentSessionRuntimeAccessUrl(sessionId), {
    method: "POST",
    headers,
    ...(requestBody
      ? {
          body: JSON.stringify(requestBody),
        }
      : {}),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.detail ||
        payload?.error ||
        `AgentSession runtime access failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  /*
  console.log("[main_sequence_ai] resolve_runtime_access response", {
    payload,
    sessionId: String(sessionId),
    url: buildAgentSessionRuntimeAccessUrl(sessionId),
  });
  */
  return normalizeCommandCenterBaseSessionHandle(payload, {
    fallbackSessionId: sessionId,
    sourceLabel: "AgentSession runtime access",
  });
}

export async function fetchCommandCenterBaseSessionHandle({
  signal,
  token,
  tokenType = "Bearer",
}: {
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(buildCommandCenterBaseSessionHandleUrl(), {
    method: "POST",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.detail ||
        payload?.error ||
        `Command Center base session handle failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeCommandCenterBaseSessionHandle(payload, {
    sourceLabel: "Command Center base session handle",
  });
}
