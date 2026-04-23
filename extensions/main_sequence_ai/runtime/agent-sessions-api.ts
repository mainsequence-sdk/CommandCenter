import { env } from "@/config/env";

export interface AgentSessionApiRecord {
  id: number;
  agent_session?: number;
  agent?: number;
  agent_name?: string;
  parent_step?: number | null;
  sequence?: number;
  step_type?: string;
  actor_type?: string;
  actor_name?: string;
  title?: string;
  summary?: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  llm_provider: string;
  llm_model: string;
  engine_name: string;
  runtime_state?: string | null;
  working?: boolean;
  runtime_config_override?: Record<string, unknown>;
  runtime_config_snapshot?: Record<string, unknown>;
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  error_detail?: string;
  external_step_id?: string;
  metadata?: Record<string, unknown>;
  created_by_user?: number;
  bound_handles?: Array<{
    id: number;
    handle_unique_id: string;
    owner_user: number;
    is_locked: boolean;
  }>;
}

export interface StartedAgentSessionResult {
  sessionId: string;
  record: AgentSessionApiRecord | null;
}

function createClientThreadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `thread-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class AgentSessionNotFoundError extends Error {
  readonly status = 404;
  readonly sessionId: string;

  constructor(sessionId: string | number, message = "AgentSession not found.") {
    super(message);
    this.name = "AgentSessionNotFoundError";
    this.sessionId = String(sessionId);
  }
}

export function isAgentSessionNotFoundError(error: unknown): error is AgentSessionNotFoundError {
  return error instanceof AgentSessionNotFoundError;
}

function buildLatestAgentSessionsUrl({
  createdByUser,
  agentId,
}: {
  createdByUser: string | number | null | undefined;
  agentId?: number | string | null;
}) {
  const url = new URL("/orm/api/agents/v1/sessions/", env.apiBaseUrl);

  if (agentId !== null && agentId !== undefined && `${agentId}`.trim()) {
    url.searchParams.set("agent_id", String(agentId));
  }

  if (createdByUser !== null && createdByUser !== undefined && `${createdByUser}`.trim()) {
    url.searchParams.set("created_by_user", String(createdByUser));
  }

  url.searchParams.set("ordering", "-started_at");
  url.searchParams.set("limit", "20");

  return url.toString();
}

function buildDeleteAgentSessionUrl(sessionId: string | number) {
  return new URL(`/orm/api/agents/v1/sessions/${sessionId}/`, env.apiBaseUrl).toString();
}

function buildAgentSessionDetailUrl(sessionId: string | number) {
  return new URL(`/orm/api/agents/v1/sessions/${sessionId}/`, env.apiBaseUrl).toString();
}

function buildAgentSessionModelConfigUrl(sessionId: string | number) {
  return new URL(`/orm/api/agents/v1/sessions/${sessionId}/`, env.apiBaseUrl).toString();
}

function buildStartNewAgentSessionUrl(agentId: string | number) {
  return new URL(`/orm/api/agents/v1/agents/${agentId}/start_new_session/`, env.apiBaseUrl).toString();
}

function normalizeIdentifier(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function isAgentSessionApiRecord(value: unknown): value is AgentSessionApiRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    normalizeIdentifier(candidate.id) !== null &&
    (
      normalizeIdentifier(candidate.agent_session) !== null ||
      typeof candidate.status === "string" ||
      typeof candidate.started_at === "string"
    )
  );
}

function extractStartedAgentSessionRecord(value: unknown): AgentSessionApiRecord | null {
  if (isAgentSessionApiRecord(value)) {
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return (
    extractStartedAgentSessionRecord(candidate.session) ??
    extractStartedAgentSessionRecord(candidate.result) ??
    extractStartedAgentSessionRecord(candidate.data)
  );
}

function extractStartedAgentSessionId(value: unknown): string | null {
  const record = extractStartedAgentSessionRecord(value);

  if (record) {
    return getAgentSessionRecordSessionId(record);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return (
    normalizeIdentifier(candidate.agent_session_id) ??
    normalizeIdentifier(candidate.session_id) ??
    extractStartedAgentSessionId(candidate.session) ??
    extractStartedAgentSessionId(candidate.result) ??
    extractStartedAgentSessionId(candidate.data)
  );
}

function collectBackendErrorMessages(
  value: unknown,
  fieldLabel?: string,
): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [fieldLabel ? `${fieldLabel}: ${trimmed}` : trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectBackendErrorMessages(entry, fieldLabel));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const candidate = value as Record<string, unknown>;
  const directMessage = [
    ...collectBackendErrorMessages(candidate.message),
    ...collectBackendErrorMessages(candidate.detail),
    ...collectBackendErrorMessages(candidate.error),
  ];

  if (directMessage.length > 0) {
    return directMessage;
  }

  return Object.entries(candidate).flatMap(([key, entry]) =>
    collectBackendErrorMessages(entry, key === "non_field_errors" ? fieldLabel : key),
  );
}

function buildAgentSessionCreationErrorMessage(payload: unknown) {
  const messages = collectBackendErrorMessages(payload)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (messages.length === 0) {
    return "Unable to create a new session for this agent.";
  }

  return messages.join(" ");
}

export function getAgentSessionRecordSessionId(record: AgentSessionApiRecord) {
  return String(record.agent_session || record.id);
}

export function getAgentSessionRecordTitle(record: AgentSessionApiRecord) {
  const sessionId = getAgentSessionRecordSessionId(record);
  return record.title?.trim() || record.summary?.trim() || `Agent session ${sessionId}`;
}

export function getAgentSessionRecordSummary(record: AgentSessionApiRecord) {
  const trimmed = record.summary?.trim();
  return trimmed || null;
}

export function getAgentSessionRecordHandleUniqueId(record: AgentSessionApiRecord) {
  const handle = Array.isArray(record.bound_handles) ? record.bound_handles[0] : null;
  return handle?.handle_unique_id?.trim() || null;
}

export function getAgentSessionRecordUpdatedAt(record: AgentSessionApiRecord) {
  return record.ended_at || record.started_at || new Date().toISOString();
}

export async function fetchLatestAgentSessions({
  agentId,
  createdByUser,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentId?: string | number | null;
  createdByUser?: string | number | null;
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

  const response = await fetch(buildLatestAgentSessionsUrl({ createdByUser, agentId }), {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Session list failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;

  if (Array.isArray(payload)) {
    return payload as AgentSessionApiRecord[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    "results" in payload &&
    Array.isArray((payload as { results?: unknown }).results)
  ) {
    return (payload as { results: AgentSessionApiRecord[] }).results;
  }

  return [];
}

export async function deleteAgentSessionRequest({
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
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(buildDeleteAgentSessionUrl(sessionId), {
    method: "DELETE",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      payload?.message || payload?.error || `Session delete failed with status ${response.status}.`,
    );
  }
}

export async function fetchAgentSessionDetail({
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

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(buildAgentSessionDetailUrl(sessionId), {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string; error?: string; message?: string }
      | null;
    const message =
      payload?.message ||
      payload?.detail ||
      payload?.error ||
      `Session detail failed with status ${response.status}.`;

    if (response.status === 404) {
      throw new AgentSessionNotFoundError(sessionId, message);
    }

    throw new Error(message);
  }

  return (await response.json()) as AgentSessionApiRecord;
}

export async function startNewAgentSessionRequest({
  agentId,
  createdByUser,
  signal,
  threadId,
  token,
  tokenType = "Bearer",
}: {
  agentId: string | number;
  createdByUser: string | number;
  signal?: AbortSignal;
  threadId?: string | null;
  token?: string | null;
  tokenType?: string;
}): Promise<StartedAgentSessionResult> {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const normalizedCreatedByUser = normalizeIdentifier(createdByUser);
  const normalizedThreadId = normalizeIdentifier(threadId) ?? createClientThreadId();

  if (!normalizedCreatedByUser) {
    throw new Error("Unable to create a session because no signed-in user id is available.");
  }

  const response = await fetch(buildStartNewAgentSessionUrl(agentId), {
    method: "POST",
    body: JSON.stringify({
      created_by_user: normalizedCreatedByUser,
      thread_id: normalizedThreadId,
    }),
    headers,
    signal,
  });

  const rawBody = await response.text().catch(() => "");
  let payload: unknown = null;

  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = rawBody;
    }
  }

  if (!response.ok) {
    throw new Error(buildAgentSessionCreationErrorMessage(payload));
  }

  const record = extractStartedAgentSessionRecord(payload);
  const sessionId = extractStartedAgentSessionId(payload);

  if (!sessionId) {
    throw new Error("Session creation succeeded but no AgentSession id was returned.");
  }

  return {
    sessionId,
    record,
  };
}

export async function patchAgentSessionModelConfig({
  llmModel,
  llmProvider,
  sessionId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  llmModel: string;
  llmProvider: string;
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

  const response = await fetch(buildAgentSessionModelConfigUrl(sessionId), {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      llm_provider: llmProvider,
      llm_model: llmModel,
    }),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string; error?: string; message?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.detail ||
        payload?.error ||
        `Session model update failed with status ${response.status}.`,
    );
  }
}
