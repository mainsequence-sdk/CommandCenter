import { env } from "@/config/env";

export interface AgentSearchResult {
  id: number;
  name: string;
  agent_unique_id: string;
  description: string;
  status: string;
  llm_provider: string;
  llm_model: string;
  engine_name: string;
  last_run_at: string | null;
}

export function buildAgentQuickSearchUrl(query: string) {
  const url = new URL("/orm/api/agents/v1/agents/quick-search/", env.apiBaseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  return url.toString();
}

export function buildAgentSelectionDescription(agent: AgentSearchResult) {
  return [agent.agent_unique_id, agent.status].filter(Boolean).join(" · ");
}

export function buildAgentOptionDescription(agent: AgentSearchResult) {
  return [
    agent.agent_unique_id,
    agent.llm_provider && agent.llm_model ? `${agent.llm_provider} / ${agent.llm_model}` : null,
    agent.engine_name,
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function fetchAgentQuickSearch({
  query,
  signal,
  token,
  tokenType = "Bearer",
}: {
  query: string;
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

  const response = await fetch(buildAgentQuickSearchUrl(query), {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Search failed with status ${response.status}.`);
  }

  return (await response.json()) as AgentSearchResult[];
}
