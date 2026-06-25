import { env } from "@/config/env";
import type { AgentImageDriftRecord } from "../agent-search";
import { normalizeAgentImageDriftRecord } from "../image-drift";
import { normalizeAgentSessionLookupId, requireAgentSessionLookupId } from "./agent-sessions-api";

export const ASTRO_COMMAND_CENTER_HANDLE_UNIQUE_ID = "astro-orchestrator-command-center";
export const ASTRO_COMMAND_CENTER_SESSION_NAME = "Astro Command Center Session";

export interface AgentSessionRuntimeAccess {
  sessionId: string;
  codingAgentId: string | null;
  codingAgentServiceId: string | null;
  mode: string | null;
  rpcUrl: string | null;
  token: string | null;
  isReady: boolean | null;
  knativeServiceRuntimeId: string | null;
  imageDrift: AgentImageDriftRecord | null;
  reconciliation: Record<string, unknown> | null;
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

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
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

function normalizeRuntimeAccess(
  payload: unknown,
  options: {
    fallbackSessionId: string | number;
  },
): AgentSessionRuntimeAccess {
  const candidate = asRecord(payload);
  const sessionId =
    normalizeAgentSessionLookupId(candidate.uid) ??
    normalizeAgentSessionLookupId(candidate.agent_session_uid) ??
    normalizeAgentSessionLookupId(candidate.session_uid) ??
    normalizeAgentSessionLookupId(candidate.sessionUid) ??
    normalizeAgentSessionLookupId(candidate.runtime_session_uid) ??
    normalizeAgentSessionLookupId(candidate.runtimeSessionUid) ??
    requireAgentSessionLookupId(options.fallbackSessionId, "AgentSession runtime access");
  const reconciliation = asRecord(candidate.reconciliation);

  return {
    sessionId,
    codingAgentId: normalizeIdentifier(candidate.coding_agent_id ?? candidate.codingAgentId),
    codingAgentServiceId: normalizeIdentifier(
      candidate.coding_agent_service_id ?? candidate.codingAgentServiceId,
    ),
    mode: normalizeString(candidate.mode),
    rpcUrl: normalizeString(candidate.rpc_url) ?? normalizeString(candidate.rpcUrl),
    token: normalizeString(candidate.token),
    isReady: normalizeBoolean(candidate.is_ready) ?? normalizeBoolean(candidate.isReady),
    knativeServiceRuntimeId: normalizeIdentifier(
      candidate.knative_service_runtime_uid ??
        candidate.knativeServiceRuntimeUid ??
        candidate.knative_service_runtime ??
        candidate.knativeServiceRuntime,
    ),
    imageDrift: normalizeAgentImageDriftRecord(candidate.image_drift ?? candidate.imageDrift),
    reconciliation: Object.keys(reconciliation).length > 0 ? reconciliation : null,
  };
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
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(buildAgentSessionRuntimeAccessUrl(sessionId), {
    method: "POST",
    headers,
    body: JSON.stringify({}),
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
  return normalizeRuntimeAccess(payload, {
    fallbackSessionId: sessionId,
  });
}
