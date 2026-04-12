import { env } from "@/config/env";

import type { AgentSessionApiRecord } from "./agent-sessions";

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
