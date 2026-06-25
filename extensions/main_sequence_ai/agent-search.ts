import { env } from "@/config/env";
import {
  mainSequenceRegistryPageSize,
  type OffsetPaginatedList,
  type SummaryResponse,
} from "../main_sequence/common/api";

export interface AgentSearchResult {
  id: number;
  uid?: string;
  project_uid?: string | null;
  name: string;
  agentType: string;
  displayLabel: string;
  agent_unique_id: string;
  description: string;
  status?: string;
  llm_provider: string;
  llm_model: string;
  llm_thinking: string;
  engine_name: string;
  last_run_at: string | null;
}

export interface AgentSemanticSearchResult {
  id: number;
  uid?: string;
  project_uid?: string | null;
  name: string;
  agentType: string;
  displayLabel: string;
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
  message?: string | null;
  autoheal_supported?: boolean | null;
  autoheal_mode?: string | null;
  autoheal_message?: string | null;
  expected_image_uri?: string | null;
  actual_image_uri?: string | null;
}

export interface AgentImageDriftRecord {
  agent_kind?: string | null;
  available?: boolean | null;
  has_drift?: boolean | null;
  autoheal_available?: boolean | null;
  autoheal_message?: string | null;
  checks?: AgentImageDriftCheckRecord[] | null;
  detail?: string | null;
}

export interface AgentDetailRecord {
  id: number;
  uid?: string;
  project_uid?: string | null;
  name?: string;
  agentType: string;
  displayLabel?: string;
  agent_type: string;
  agent_unique_id?: string;
  description?: string | null;
  agent_card?: unknown;
  image_drift?: AgentImageDriftRecord | null;
  status?: string | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  llm_thinking?: string | null;
  engine_name?: string | null;
  last_run_at?: string | null;
  metadata?: Record<string, unknown> | null;
  runtime_config_override?: Record<string, unknown> | null;
  runtime_config_snapshot?: Record<string, unknown> | null;
  created_by_user?: string | number | null;
  [key: string]: unknown;
}

export type AgentSummaryResponse = SummaryResponse;
export interface AgentRuntimeRefResponse {
  cluster_uid: string | null;
  exists: boolean;
  latest_ready_revision_name: string | null;
  namespace: string | null;
  runtime_kind: string | null;
  runtime_uid: string | null;
  service_name: string | null;
}

export interface AgentBulkDeleteResponse {
  requested_agent_uids: string[];
  deleted_agent_uids: string[];
  missing_agent_uids: string[];
  deleted_count: number;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeAgentType(candidate: Record<string, unknown>) {
  const agentType = normalizeString(candidate.agent_type);

  if (!agentType) {
    throw new Error("Agent response missing required agent_type.");
  }

  return agentType;
}

function normalizeAgentName(candidate: Record<string, unknown>) {
  const nestedAgent = asRecord(candidate.agent);

  return (
    normalizeString(candidate.name) ||
    normalizeString(candidate.agent_name) ||
    normalizeString(nestedAgent.name)
  );
}

function normalizeAgentUid(candidate: Record<string, unknown>) {
  const nestedAgent = asRecord(candidate.agent);

  return (
    normalizeString(candidate.uid) ||
    normalizeString(candidate.agent_uid) ||
    normalizeString(candidate.agentUid) ||
    normalizeString(nestedAgent.uid) ||
    normalizeString(nestedAgent.agent_uid) ||
    normalizeString(nestedAgent.agentUid)
  );
}

function normalizeAgentDisplayLabel(candidate: Record<string, unknown>, fallbackName = "") {
  return (
    normalizeString(candidate.display_label) ||
    normalizeString(candidate.displayLabel) ||
    normalizeString(candidate.label) ||
    normalizeString(candidate.title) ||
    fallbackName
  );
}

function normalizeAgentSearchResult(value: unknown): AgentSearchResult {
  const candidate = asRecord(value);
  const agentType = normalizeAgentType(candidate);
  const name = normalizeAgentName(candidate);

  return {
    id: normalizeNumber(candidate.id),
    uid: normalizeAgentUid(candidate) || undefined,
    project_uid: normalizeNullableString(candidate.project_uid),
    name,
    agentType,
    displayLabel: normalizeAgentDisplayLabel(candidate, name),
    agent_unique_id: normalizeString(candidate.agent_unique_id),
    description: normalizeString(candidate.description),
    status: normalizeNullableString(candidate.status) ?? undefined,
    llm_provider: normalizeString(candidate.llm_provider),
    llm_model: normalizeString(candidate.llm_model),
    llm_thinking: normalizeString(candidate.llm_thinking),
    engine_name: normalizeString(candidate.engine_name),
    last_run_at: normalizeNullableString(candidate.last_run_at),
  };
}

function normalizeAgentSemanticSearchResult(value: unknown): AgentSemanticSearchResult {
  const candidate = asRecord(value);
  const agentType = normalizeAgentType(candidate);
  const name = normalizeAgentName(candidate);

  return {
    id: normalizeNumber(candidate.id),
    uid: normalizeAgentUid(candidate) || undefined,
    project_uid: normalizeNullableString(candidate.project_uid),
    name,
    agentType,
    displayLabel: normalizeAgentDisplayLabel(candidate, name),
    agent_unique_id: normalizeString(candidate.agent_unique_id),
    description: normalizeString(candidate.description),
    semantic_score:
      typeof candidate.semantic_score === "number" ? candidate.semantic_score : null,
    text_score:
      typeof candidate.text_score === "number" ? candidate.text_score : null,
    combined_score:
      typeof candidate.combined_score === "number" ? candidate.combined_score : null,
  };
}

function normalizeAgentDetailRecord(value: unknown): AgentDetailRecord {
  const candidate = asRecord(value);
  const agentType = normalizeAgentType(candidate);
  const name = normalizeAgentName(candidate);

  return {
    ...candidate,
    id: normalizeNumber(candidate.id),
    uid: normalizeAgentUid(candidate) || undefined,
    project_uid: normalizeNullableString(candidate.project_uid),
    name,
    agentType,
    displayLabel: normalizeAgentDisplayLabel(candidate, name),
    agent_type: agentType,
    llm_provider: normalizeNullableString(candidate.llm_provider),
    llm_model: normalizeNullableString(candidate.llm_model),
    llm_thinking: normalizeNullableString(candidate.llm_thinking),
  } as AgentDetailRecord;
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
  return new URL(
    `/orm/api/agents/v1/agents/${encodeURIComponent(String(agentId))}/`,
    env.apiBaseUrl,
  ).toString();
}

export function buildAgentSummaryUrl(agentId: string | number) {
  return new URL(
    `/orm/api/agents/v1/agents/${encodeURIComponent(String(agentId))}/summary/`,
    env.apiBaseUrl,
  ).toString();
}

export function buildAgentRuntimeRefUrl(agentUid: string | number) {
  return new URL(
    `/orm/api/agents/v1/agents/${encodeURIComponent(String(agentUid))}/runtime-ref/`,
    env.apiBaseUrl,
  ).toString();
}

export function buildAgentSemanticSearchUrl() {
  return new URL("/orm/api/agents/v1/agents/semantic-search/", env.apiBaseUrl).toString();
}

export function buildAgentBulkDeleteUrl() {
  return new URL("/orm/api/agents/v1/agents/bulk-delete/", env.apiBaseUrl).toString();
}

export function buildAgentSelectionDescription(agent: AgentSearchResult) {
  return [agent.agent_unique_id, agent.status].filter(Boolean).join(" · ");
}

export function getAgentSearchResultLookupKey(
  agent: Pick<AgentSearchResult, "id" | "uid"> | Pick<AgentSemanticSearchResult, "id" | "uid">,
) {
  const uid = normalizeString(agent.uid);

  if (uid) {
    return uid;
  }

  return agent.id > 0 ? String(agent.id) : null;
}

export function getAgentSearchResultRowKey(
  agent: Pick<AgentSearchResult, "agent_unique_id" | "id" | "name" | "uid">,
  index: number,
) {
  return (
    getAgentSearchResultLookupKey(agent) ||
    normalizeString(agent.agent_unique_id) ||
    normalizeString(agent.name) ||
    `agent-row-${index}`
  );
}

export function buildAgentOptionDescription(agent: AgentSearchResult) {
  return [
    agent.agentType,
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

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? payload.map(normalizeAgentSearchResult) : [];
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
    | OffsetPaginatedList<unknown>
    | unknown[];

  if (Array.isArray(payload)) {
    const results = payload.map(normalizeAgentSearchResult);

    return {
      count: results.length,
      next: null,
      previous: null,
      limit,
      offset,
      results: results.slice(offset, offset + limit),
    } satisfies OffsetPaginatedList<AgentSearchResult>;
  }

  const results = Array.isArray(payload.results)
    ? payload.results.map(normalizeAgentSearchResult)
    : [];

  return {
    count: typeof payload.count === "number" ? payload.count : results.length,
    next: payload.next ?? null,
    previous: payload.previous ?? null,
    limit,
    offset,
    results,
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

  return Array.isArray(payload) ? payload.map(normalizeAgentSemanticSearchResult) : [];
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

  return normalizeAgentDetailRecord(await response.json());
}

export async function bulkDeleteAgents({
  agentUids,
  token,
  tokenType = "Bearer",
}: {
  agentUids: string[];
  token?: string | null;
  tokenType?: string;
}) {
  const normalizedAgentUids = Array.from(new Set(agentUids.map(normalizeString).filter(Boolean)));

  if (normalizedAgentUids.length === 0) {
    throw new Error("At least one agent UID is required before deleting agents.");
  }

  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(buildAgentBulkDeleteUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      agent_uids: normalizedAgentUids,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: unknown; error?: unknown }
      | null;
    const detail = typeof payload?.detail === "string" ? payload.detail : "";
    const error = typeof payload?.error === "string" ? payload.error : "";
    throw new Error(detail || error || `Agent bulk delete failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<AgentBulkDeleteResponse>;

  return {
    requested_agent_uids: Array.isArray(payload.requested_agent_uids)
      ? payload.requested_agent_uids.filter((value): value is string => typeof value === "string")
      : normalizedAgentUids,
    deleted_agent_uids: Array.isArray(payload.deleted_agent_uids)
      ? payload.deleted_agent_uids.filter((value): value is string => typeof value === "string")
      : [],
    missing_agent_uids: Array.isArray(payload.missing_agent_uids)
      ? payload.missing_agent_uids.filter((value): value is string => typeof value === "string")
      : [],
    deleted_count:
      typeof payload.deleted_count === "number" && Number.isFinite(payload.deleted_count)
        ? payload.deleted_count
        : 0,
  } satisfies AgentBulkDeleteResponse;
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

function normalizeAgentRuntimeRefResponse(value: unknown): AgentRuntimeRefResponse {
  const candidate = asRecord(value);

  return {
    cluster_uid: normalizeNullableString(candidate.cluster_uid),
    exists: candidate.exists === true,
    latest_ready_revision_name: normalizeNullableString(candidate.latest_ready_revision_name),
    namespace: normalizeNullableString(candidate.namespace),
    runtime_kind: normalizeNullableString(candidate.runtime_kind),
    runtime_uid: normalizeNullableString(candidate.runtime_uid),
    service_name: normalizeNullableString(candidate.service_name),
  };
}

export async function fetchAgentRuntimeRef({
  agentUid,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentUid: string | number;
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

  const response = await fetch(buildAgentRuntimeRefUrl(agentUid), {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Agent runtime lookup failed with status ${response.status}.`);
  }

  return normalizeAgentRuntimeRefResponse(await response.json());
}
