import { env } from "@/config/env";

import type { AgentSessionApiRecord } from "./agent-sessions";

const DEFAULT_AGENT_NAME = "astro-orchestrator";

function buildLatestAgentSessionsUrl(createdByUser: string | number | null | undefined) {
  const url = new URL("/orm/api/agents/v1/sessions/", env.apiBaseUrl);
  url.searchParams.set("agent_name", DEFAULT_AGENT_NAME);
  if (createdByUser !== null && createdByUser !== undefined && `${createdByUser}`.trim()) {
    url.searchParams.set("created_by_user", String(createdByUser));
  }
  url.searchParams.set("ordering", "-started_at");
  url.searchParams.set("limit", "20");
  return url.toString();
}

export async function fetchLatestAgentSessions({
  createdByUser,
  signal,
  token,
  tokenType = "Bearer",
}: {
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

  const response = await fetch(buildLatestAgentSessionsUrl(createdByUser), {
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
