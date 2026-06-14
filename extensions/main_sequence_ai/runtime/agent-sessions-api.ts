import { env } from "@/config/env";
import { MainSequenceAiError, withMainSequenceAiErrorSource } from "./error-source";

export interface AgentSessionApiRecord {
  id?: number | string | null;
  uid?: string | null;
  agent_session?: number | string | null;
  agent_session_uid?: string | null;
  session_uid?: string | null;
  runtime_session_uid?: string | null;
  agent?: number | AgentSessionApiAgent;
  agent_type: string;
  agent_name: string;
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
  llm_thinking?: string | null;
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
  created_by_user_uid?: string | null;
  bound_handles?: Array<{
    id: number;
    handle_unique_id: string;
    owner_user: number;
    is_locked: boolean;
  }>;
}

export interface AgentSessionApiAgent {
  id?: number | null;
  name?: string | null;
}

export type AgentSessionSerializedRecord = AgentSessionApiRecord & Record<string, unknown>;

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
  createdByUserUid,
  agentId,
}: {
  createdByUserUid: string | null | undefined;
  agentId?: number | string | null;
}) {
  const url = new URL("/orm/api/agents/v1/sessions/", env.apiBaseUrl);

  const normalizedAgentId = normalizeIdentifier(agentId);

  if (normalizedAgentId) {
    url.searchParams.set(/^\d+$/.test(normalizedAgentId) ? "agent_id" : "agent_uid", normalizedAgentId);
  }

  if (
    createdByUserUid !== null &&
    createdByUserUid !== undefined &&
    `${createdByUserUid}`.trim()
  ) {
    url.searchParams.set("created_by_user_uid", String(createdByUserUid));
  }

  url.searchParams.set("ordering", "-started_at");
  url.searchParams.set("limit", "20");

  return url.toString();
}

function buildDeleteAgentSessionUrl(sessionId: string | number) {
  const normalizedSessionId = requireAgentSessionLookupId(sessionId, "AgentSession delete");
  return new URL(
    `/orm/api/agents/v1/sessions/${encodeURIComponent(normalizedSessionId)}/`,
    env.apiBaseUrl,
  ).toString();
}

function buildAgentSessionDetailUrl(sessionId: string | number) {
  const normalizedSessionId = requireAgentSessionLookupId(sessionId, "AgentSession detail");
  return new URL(
    `/orm/api/agents/v1/sessions/${encodeURIComponent(normalizedSessionId)}/`,
    env.apiBaseUrl,
  ).toString();
}

function buildAgentSessionModelConfigUrl(sessionId: string | number) {
  const normalizedSessionId = requireAgentSessionLookupId(
    sessionId,
    "AgentSession model config",
  );
  return new URL(
    `/orm/api/agents/v1/sessions/${encodeURIComponent(normalizedSessionId)}/`,
    env.apiBaseUrl,
  ).toString();
}

function buildStartNewAgentSessionUrl(agentId: string | number) {
  return new URL(
    `/orm/api/agents/v1/agents/${encodeURIComponent(String(agentId))}/start_new_session/`,
    env.apiBaseUrl,
  ).toString();
}

function buildGetOrCreateAgentSessionWithHandleUrl(agentUid: string | number) {
  return new URL(
    `/orm/api/agents/v1/agents/${encodeURIComponent(String(agentUid))}/sessions/get_or_create_session_with_handle/`,
    env.apiBaseUrl,
  ).toString();
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

export function normalizeAgentSessionLookupId(value: unknown) {
  const normalized = normalizeIdentifier(value);

  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();

  if (lowered === "undefined" || lowered === "null") {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function requireAgentSessionLookupId(
  value: unknown,
  contextLabel = "AgentSession",
) {
  const normalized = normalizeAgentSessionLookupId(value);

  if (!normalized) {
    throw new MainSequenceAiError(`${contextLabel} requires a valid session uid.`, {
      source: "frontend_runtime_guard",
    });
  }

  return normalized;
}

function isAgentSessionApiRecord(value: unknown): value is AgentSessionApiRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (
      normalizeAgentSessionLookupId(candidate.uid) !== null ||
      normalizeAgentSessionLookupId(candidate.agent_session_uid) !== null ||
      normalizeAgentSessionLookupId(candidate.session_uid) !== null ||
      normalizeAgentSessionLookupId(candidate.runtime_session_uid) !== null
    ) &&
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
    normalizeAgentSessionLookupId(candidate.uid) ??
    normalizeAgentSessionLookupId(candidate.agent_session_uid) ??
    normalizeAgentSessionLookupId(candidate.session_uid) ??
    normalizeAgentSessionLookupId(candidate.runtime_session_uid) ??
    extractStartedAgentSessionId(candidate.agent_session) ??
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
  return (
    normalizeAgentSessionLookupId(record.uid) ??
    normalizeAgentSessionLookupId(record.agent_session_uid) ??
    normalizeAgentSessionLookupId(record.session_uid) ??
    normalizeAgentSessionLookupId(record.runtime_session_uid) ??
    ""
  );
}

export function getAgentSessionRecordAgentId(record: AgentSessionApiRecord) {
  if (typeof record.agent === "number" && Number.isFinite(record.agent)) {
    return record.agent;
  }

  if (record.agent && typeof record.agent === "object" && !Array.isArray(record.agent)) {
    return typeof record.agent.id === "number" && Number.isFinite(record.agent.id)
      ? record.agent.id
      : null;
  }

  return null;
}

export function getAgentSessionRecordAgentName(record: AgentSessionApiRecord) {
  const agentName = record.agent_name?.trim();

  if (agentName) {
    return agentName;
  }

  if (record.agent && typeof record.agent === "object" && !Array.isArray(record.agent)) {
    return record.agent.name?.trim() || "";
  }

  return "";
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
  createdByUserUid,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentId?: string | number | null;
  createdByUserUid?: string | null;
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

  const response = await fetch(buildLatestAgentSessionsUrl({ createdByUserUid, agentId }), {
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
}): Promise<AgentSessionSerializedRecord> {
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
      throw new AgentSessionNotFoundError(
        sessionId,
        withMainSequenceAiErrorSource({
          message,
          source: "agent_session_detail",
        }),
      );
    }

    throw new MainSequenceAiError(message, {
      source: "agent_session_detail",
      status: response.status,
    });
  }

  return (await response.json()) as AgentSessionSerializedRecord;
}

export async function startNewAgentSessionRequest({
  agentId,
  signal,
  threadId,
  token,
  tokenType = "Bearer",
}: {
  agentId: string | number;
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

  const normalizedThreadId = normalizeIdentifier(threadId) ?? createClientThreadId();

  const response = await fetch(buildStartNewAgentSessionUrl(agentId), {
    method: "POST",
    body: JSON.stringify({
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
    throw new Error("Session creation succeeded but no AgentSession uid was returned.");
  }

  return {
    sessionId,
    record,
  };
}

export async function getOrCreateAgentSessionWithHandleRequest({
  agentUid,
  handleUniqueId,
  llmModel,
  llmProvider,
  llmThinking,
  name,
  sessionMetadata = {},
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentUid: string | number;
  handleUniqueId: string;
  llmModel: string;
  llmProvider: string;
  llmThinking?: string | null;
  name: string;
  sessionMetadata?: Record<string, unknown>;
  signal?: AbortSignal;
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

  const response = await fetch(buildGetOrCreateAgentSessionWithHandleUrl(agentUid), {
    method: "POST",
    body: JSON.stringify({
      handle_unique_id: handleUniqueId,
      name,
      llm_provider: llmProvider,
      llm_model: llmModel,
      llm_thinking: llmThinking ?? "",
      session_metadata: sessionMetadata,
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
    throw new Error("Session creation succeeded but no AgentSession uid was returned.");
  }

  return {
    sessionId,
    record,
  };
}

export async function patchAgentSessionModelConfig({
  llmModel,
  llmProvider,
  llmThinking,
  sessionId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  llmModel: string;
  llmProvider: string;
  llmThinking?: string | null;
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
      llm_thinking: typeof llmThinking === "string" ? llmThinking : "",
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
