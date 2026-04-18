import { env } from "@/config/env";

export interface CommandCenterBaseSessionHandle {
  sessionId: string;
  runtimeSessionId: string | null;
  threadId: string | null;
  sessionKey: string | null;
  handleUniqueId: string | null;
  projectId: string | null;
  cwd: string | null;
  updatedAt: string | null;
  agent: {
    id: number | null;
    name: string | null;
    requestName: string | null;
    agentUniqueId: string | null;
  };
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

function normalizeCommandCenterBaseSessionHandle(payload: unknown): CommandCenterBaseSessionHandle {
  const candidate = extractHandleCandidate(payload);
  const agentCandidate = asRecord(candidate.agent);
  const boundHandle =
    Array.isArray(candidate.bound_handles) && candidate.bound_handles[0]
      ? asRecord(candidate.bound_handles[0])
      : null;
  const sessionId =
    normalizeIdentifier(candidate.sessionId) ??
    normalizeIdentifier(candidate.session_id) ??
    normalizeIdentifier(candidate.runtime_session_id) ??
    normalizeIdentifier(candidate.runtimeSessionId) ??
    normalizeIdentifier(candidate.agent_session_id) ??
    normalizeIdentifier(candidate.agentSessionId) ??
    normalizeIdentifier(candidate.agent_session) ??
    normalizeIdentifier(candidate.id);

  if (!sessionId) {
    throw new Error(
      "Command Center base session response did not include a valid session id.",
    );
  }

  return {
    sessionId,
    runtimeSessionId:
      normalizeIdentifier(candidate.runtime_session_id) ??
      normalizeIdentifier(candidate.runtimeSessionId) ??
      normalizeIdentifier(candidate.sessionId) ??
      normalizeIdentifier(candidate.session_id) ??
      sessionId,
    threadId: normalizeString(candidate.thread_id) ?? normalizeString(candidate.threadId),
    sessionKey: normalizeString(candidate.session_key) ?? normalizeString(candidate.sessionKey),
    handleUniqueId:
      normalizeString(boundHandle?.handle_unique_id) ??
      normalizeString(candidate.handle_unique_id) ??
      normalizeString(candidate.handleUniqueId),
    projectId: normalizeIdentifier(candidate.project_id) ?? normalizeIdentifier(candidate.projectId),
    cwd: normalizeString(candidate.cwd),
    updatedAt:
      normalizeString(candidate.updated_at) ??
      normalizeString(candidate.updatedAt) ??
      normalizeString(candidate.started_at) ??
      normalizeString(candidate.startedAt),
    agent: {
      id: normalizeNumber(
        candidate.agent_id ?? candidate.agentId ?? agentCandidate.id ?? agentCandidate.agent_id,
      ),
      name:
        normalizeString(candidate.actor_name) ??
        normalizeString(agentCandidate.name) ??
        normalizeString(agentCandidate.label) ??
        normalizeString(candidate.agent_label) ??
        normalizeString(candidate.agentLabel) ??
        normalizeString(candidate.name),
      requestName:
        normalizeString(candidate.agent_name) ??
        normalizeString(candidate.agentName) ??
        normalizeString(agentCandidate.agent_name) ??
        normalizeString(agentCandidate.requestName) ??
        normalizeString(agentCandidate.request_name),
      agentUniqueId:
        normalizeString(candidate.agent_unique_id) ??
        normalizeString(candidate.agentUniqueId) ??
        normalizeString(agentCandidate.agent_unique_id) ??
        normalizeString(agentCandidate.agentUniqueId),
    },
  };
}

function buildCommandCenterBaseSessionUrl() {
  return new URL(
    "/orm/api/agents/v1/agents/session-handles/get_or_create_astro_command_center/",
    env.apiBaseUrl,
  ).toString();
}

export async function fetchOrCreateCommandCenterBaseSession({
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

  const response = await fetch(buildCommandCenterBaseSessionUrl(), {
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
        `Command Center base session failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeCommandCenterBaseSessionHandle(payload);
}
