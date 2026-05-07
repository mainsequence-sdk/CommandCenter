import { env } from "@/config/env";
import {
  mainSequenceRegistryPageSize,
  type OffsetPaginatedList,
  type SummaryResponse,
} from "../main_sequence/common/api";

export interface AgentSearchResult {
  id: number;
  name: string;
  agent_unique_id: string;
  description: string;
  status?: string;
  llm_provider: string;
  llm_model: string;
  engine_name: string;
  last_run_at: string | null;
}

export interface AgentSemanticSearchResult {
  id: number;
  name: string;
  agent_unique_id: string;
  description: string;
  semantic_score?: number | null;
  text_score?: number | null;
  combined_score?: number | null;
}

export interface AgentImageDriftCheckRecord {
  key?: string | null;
  label?: string | null;
  status?: string | null;
  matches?: boolean | null;
  has_drift?: boolean | null;
  reason?: string | null;
  expected_image_uri?: string | null;
  actual_image_uri?: string | null;
}

export interface AgentImageDriftRecord {
  agent_kind?: string | null;
  available?: boolean | null;
  has_drift?: boolean | null;
  checks?: AgentImageDriftCheckRecord[] | null;
  detail?: string | null;
}

export interface AgentDetailRecord {
  id: number;
  name?: string;
  agent_unique_id?: string;
  description?: string | null;
  agent_card?: unknown;
  image_drift?: AgentImageDriftRecord | null;
  status?: string | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  engine_name?: string | null;
  last_run_at?: string | null;
  metadata?: Record<string, unknown> | null;
  runtime_config_override?: Record<string, unknown> | null;
  runtime_config_snapshot?: Record<string, unknown> | null;
  created_by_user?: string | number | null;
  [key: string]: unknown;
}

export type AgentSummaryResponse = SummaryResponse;
export interface AgentRuntimeIdResponse {
  runtime_id: number | null;
}

export function buildAgentQuickSearchUrl(query: string) {
  const url = new URL("/orm/api/agents/v1/agents/quick-search/", env.apiBaseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  return url.toString();
}

export function buildAgentListUrl({
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  const url = new URL("/orm/api/agents/v1/agents/", env.apiBaseUrl);
  url.searchParams.set("limit", `${limit}`);
  url.searchParams.set("offset", `${offset}`);
  return url.toString();
}

export function buildAgentDetailUrl(agentId: string | number) {
  return new URL(`/orm/api/agents/v1/agents/${agentId}/`, env.apiBaseUrl).toString();
}

export function buildAgentSummaryUrl(agentId: string | number) {
  return new URL(`/orm/api/agents/v1/agents/${agentId}/summary/`, env.apiBaseUrl).toString();
}

export function buildAgentRuntimeIdUrl(agentId: string | number) {
  return new URL(`/orm/api/agents/v1/agents/${agentId}/get_runtime_id/`, env.apiBaseUrl).toString();
}

export function buildAgentSemanticSearchUrl() {
  return new URL("/orm/api/agents/v1/agents/semantic-search/", env.apiBaseUrl).toString();
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

export async function fetchAgentList({
  signal,
  token,
  tokenType = "Bearer",
  limit = mainSequenceRegistryPageSize,
  offset = 0,
}: {
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
  limit?: number;
  offset?: number;
}) {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(buildAgentListUrl({ limit, offset }), {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Agent list failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as
    | OffsetPaginatedList<AgentSearchResult>
    | AgentSearchResult[];

  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      previous: null,
      limit,
      offset,
      results: payload.slice(offset, offset + limit),
    } satisfies OffsetPaginatedList<AgentSearchResult>;
  }

  return {
    count: typeof payload.count === "number" ? payload.count : payload.results.length,
    next: payload.next ?? null,
    previous: payload.previous ?? null,
    limit,
    offset,
    results: Array.isArray(payload.results) ? payload.results : [],
  } satisfies OffsetPaginatedList<AgentSearchResult>;
}

export async function fetchAgentSemanticSearch({
  query,
  signal,
  token,
  tokenType = "Bearer",
  limit = 20,
}: {
  query: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
  limit?: number;
}) {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(buildAgentSemanticSearchUrl(), {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      q: query,
      limit: Math.max(1, Math.min(100, limit)),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Semantic agent search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;

  return Array.isArray(payload) ? (payload as AgentSemanticSearchResult[]) : [];
}

export async function fetchAgentDetail({
  agentId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentId: string | number;
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

  const response = await fetch(buildAgentDetailUrl(agentId), {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Agent detail failed with status ${response.status}.`);
  }

  return (await response.json()) as AgentDetailRecord;
}

export async function fetchAgentSummary({
  agentId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentId: string | number;
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

  const response = await fetch(buildAgentSummaryUrl(agentId), {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Agent summary failed with status ${response.status}.`);
  }

  return (await response.json()) as AgentSummaryResponse;
}

export async function fetchAgentRuntimeId({
  agentId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentId: string | number;
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

  const response = await fetch(buildAgentRuntimeIdUrl(agentId), {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Agent runtime lookup failed with status ${response.status}.`);
  }

  return (await response.json()) as AgentRuntimeIdResponse;
}
