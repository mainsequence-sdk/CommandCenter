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
