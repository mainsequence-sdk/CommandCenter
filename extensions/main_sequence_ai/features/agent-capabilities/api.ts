import { env } from "@/config/env";

export type AgentCapabilityKind = "prompt" | "skill";
export type AgentCapabilitySourceType = "inline" | "registry" | "repository" | "api" | "external";
const defaultCapabilityContentMimeType = "text/markdown";

export interface AgentCapabilityRecord {
  uid: string;
  name: string;
  kind: AgentCapabilityKind;
  sourceType: AgentCapabilitySourceType;
  sourceRef: string | null;
  capabilityPath: string | null;
  isEditable: boolean;
  description: string | null;
  metadata: Record<string, unknown>;
  contentFile: string | null;
  contentSha256: string | null;
  contentMimeType: string | null;
  contentSize: number | null;
  hasContent: boolean;
  createdByUserUid: string | null;
  updatedAt: string | null;
}

export interface AgentCapabilityBindingRecord {
  uid: string;
  agentUid: string | null;
  capabilityUid: string;
  capability: AgentCapabilityRecord | null;
  role: string | null;
  sortOrder: number | null;
  isEnabled: boolean;
  isLocked: boolean;
  configuration: Record<string, unknown>;
  sourceType: AgentCapabilitySourceType | null;
  sourceRef: string | null;
  updatedAt: string | null;
}

export interface AgentCapabilityContentRecord {
  content: string;
  filename: string | null;
  contentMimeType: string | null;
  updatedAt: string | null;
}

export class AgentCapabilityApiError extends Error {
  readonly payload: unknown;
  readonly status: number;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "AgentCapabilityApiError";
    this.payload = payload;
    this.status = status;
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function normalizeBoolean(value: unknown) {
  return value === true;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeCapabilityKind(value: unknown): AgentCapabilityKind {
  return value === "prompt" ? "prompt" : "skill";
}

function normalizeCapabilitySourceType(value: unknown): AgentCapabilitySourceType {
  switch (value) {
    case "registry":
    case "repository":
    case "api":
    case "external":
      return value;
    default:
      return "inline";
  }
}

function buildCapabilityListBaseUrl() {
  return new URL("/orm/api/agents/v1/capabilities/", env.apiBaseUrl);
}

function buildCapabilityListUrl(limit = 250) {
  const url = buildCapabilityListBaseUrl();
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", "0");
  return url.toString();
}

function buildCapabilityDetailUrl(capabilityUid: string) {
  return new URL(
    `/orm/api/agents/v1/capabilities/${encodeURIComponent(capabilityUid)}/`,
    env.apiBaseUrl,
  ).toString();
}

function buildCapabilityContentUrl(capabilityUid: string) {
  return new URL(
    `/orm/api/agents/v1/capabilities/${encodeURIComponent(capabilityUid)}/content/`,
    env.apiBaseUrl,
  ).toString();
}

function buildAgentCapabilityBindingsUrl(agentUid: string) {
  return new URL(
    `/orm/api/agents/v1/agents/${encodeURIComponent(agentUid)}/capabilities/`,
    env.apiBaseUrl,
  ).toString();
}

function buildAgentCapabilityBindUrl(agentUid: string) {
  return new URL(
    `/orm/api/agents/v1/agents/${encodeURIComponent(agentUid)}/capabilities/bind/`,
    env.apiBaseUrl,
  ).toString();
}

function buildAgentCapabilityUnbindUrl(agentUid: string) {
  return new URL(
    `/orm/api/agents/v1/agents/${encodeURIComponent(agentUid)}/capabilities/unbind/`,
    env.apiBaseUrl,
  ).toString();
}

function buildHeaders({
  token,
  tokenType = "Bearer",
  json = false,
}: {
  token?: string | null;
  tokenType?: string;
  json?: boolean;
}) {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (json) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  return headers;
}

function collectErrorMessages(value: unknown, fieldLabel?: string): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [fieldLabel ? `${fieldLabel}: ${trimmed}` : trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectErrorMessages(entry, fieldLabel));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const candidate = value as Record<string, unknown>;
  const directMessages = [
    ...collectErrorMessages(candidate.message),
    ...collectErrorMessages(candidate.detail),
    ...collectErrorMessages(candidate.error),
  ];

  if (directMessages.length > 0) {
    return directMessages;
  }

  return Object.entries(candidate).flatMap(([key, entry]) =>
    collectErrorMessages(entry, key === "non_field_errors" ? fieldLabel : key),
  );
}

function buildApiErrorMessage(payload: unknown, fallback: string) {
  const messages = collectErrorMessages(payload).filter(Boolean);
  return messages.length > 0 ? messages.join(" ") : fallback;
}

async function parseErrorPayload(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text || null;
}

async function ensureOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return;
  }

  const payload = await parseErrorPayload(response);
  throw new AgentCapabilityApiError(
    buildApiErrorMessage(payload, fallbackMessage),
    response.status,
    payload,
  );
}

function normalizeCapabilityRecord(value: unknown): AgentCapabilityRecord {
  const candidate = asRecord(value);
  const uid = normalizeString(candidate.uid);

  if (!uid) {
    throw new Error("Capability response missing uid.");
  }

  return {
    uid,
    name: normalizeString(candidate.name) ?? "Untitled capability",
    kind: normalizeCapabilityKind(candidate.kind),
    sourceType: normalizeCapabilitySourceType(candidate.source_type),
    sourceRef: normalizeString(candidate.source_ref),
    capabilityPath: normalizeString(candidate.capability_path),
    isEditable:
      typeof candidate.is_editable === "boolean" ? candidate.is_editable : true,
    description: normalizeString(candidate.description),
    metadata: normalizeObject(candidate.metadata),
    contentFile: normalizeString(candidate.content_file),
    contentSha256: normalizeString(candidate.content_sha256),
    contentMimeType: normalizeString(candidate.content_mime_type),
    contentSize: normalizeNumber(candidate.content_size),
    hasContent: normalizeBoolean(candidate.has_content),
    createdByUserUid: normalizeString(candidate.created_by_user_uid),
    updatedAt: normalizeString(candidate.updated_at),
  };
}

function normalizeCapabilityBindingRecord(value: unknown): AgentCapabilityBindingRecord {
  const candidate = asRecord(value);
  const uid = normalizeString(candidate.uid);
  const capabilityUid = normalizeString(candidate.capability_uid);

  if (!uid || !capabilityUid) {
    throw new Error("Capability binding response missing uid or capability_uid.");
  }

  return {
    uid,
    agentUid: normalizeString(candidate.agent_uid),
    capabilityUid,
    capability:
      candidate.capability && typeof candidate.capability === "object"
        ? normalizeCapabilityRecord(candidate.capability)
        : null,
    role: normalizeString(candidate.role),
    sortOrder: normalizeNumber(candidate.sort_order),
    isEnabled: candidate.is_enabled !== false,
    isLocked: candidate.is_locked === true,
    configuration: normalizeObject(candidate.configuration),
    sourceType: candidate.source_type ? normalizeCapabilitySourceType(candidate.source_type) : null,
    sourceRef: normalizeString(candidate.source_ref),
    updatedAt: normalizeString(candidate.updated_at),
  };
}

function normalizeCapabilityContentRecord(value: unknown): AgentCapabilityContentRecord {
  if (typeof value === "string") {
    return {
      content: value,
      filename: null,
      contentMimeType: "text/markdown",
      updatedAt: null,
    };
  }

  const candidate = asRecord(value);

  return {
    content:
      (typeof candidate.content === "string" ? candidate.content : null) ??
      (typeof candidate.markdown === "string" ? candidate.markdown : null) ??
      "",
    filename: normalizeString(candidate.filename),
    contentMimeType:
      normalizeString(candidate.content_mime_type) ?? "text/markdown",
    updatedAt: normalizeString(candidate.updated_at),
  };
}

function extractResults<T>(payload: unknown, normalizeEntry: (value: unknown) => T): T[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeEntry);
  }

  const candidate = asRecord(payload);
  return Array.isArray(candidate.results) ? candidate.results.map(normalizeEntry) : [];
}

export async function fetchReusableCapabilities({
  limit = 250,
  signal,
  token,
  tokenType = "Bearer",
}: {
  limit?: number;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildCapabilityListUrl(limit), {
    method: "GET",
    headers: buildHeaders({ token, tokenType }),
    signal,
  });

  await ensureOk(response, `Capability list failed with status ${response.status}.`);
  return extractResults(await response.json(), normalizeCapabilityRecord);
}

export async function fetchAgentCapabilityBindings({
  agentUid,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentUid: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildAgentCapabilityBindingsUrl(agentUid), {
    method: "GET",
    headers: buildHeaders({ token, tokenType }),
    signal,
  });

  await ensureOk(response, `Agent capability bindings failed with status ${response.status}.`);
  return extractResults(await response.json(), normalizeCapabilityBindingRecord);
}

export async function fetchCapabilityDetail({
  capabilityUid,
  signal,
  token,
  tokenType = "Bearer",
}: {
  capabilityUid: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildCapabilityDetailUrl(capabilityUid), {
    method: "GET",
    headers: buildHeaders({ token, tokenType }),
    signal,
  });

  await ensureOk(response, `Capability detail failed with status ${response.status}.`);
  return normalizeCapabilityRecord(await response.json());
}

export async function fetchCapabilityContent({
  capabilityUid,
  allowMissing = false,
  signal,
  token,
  tokenType = "Bearer",
}: {
  capabilityUid: string;
  allowMissing?: boolean;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildCapabilityContentUrl(capabilityUid), {
    method: "GET",
    headers: buildHeaders({ token, tokenType }),
    signal,
  });

  if (allowMissing && response.status === 404) {
    return normalizeCapabilityContentRecord({
      content: "",
      filename: null,
      content_mime_type: defaultCapabilityContentMimeType,
    });
  }

  await ensureOk(response, `Capability content failed with status ${response.status}.`);

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    return normalizeCapabilityContentRecord(await response.json());
  }

  return normalizeCapabilityContentRecord(await response.text());
}

export async function deleteCapabilityResource({
  capabilityUid,
  signal,
  token,
  tokenType = "Bearer",
}: {
  capabilityUid: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildCapabilityDetailUrl(capabilityUid), {
    method: "DELETE",
    headers: buildHeaders({ token, tokenType }),
    signal,
  });

  await ensureOk(response, `Capability delete failed with status ${response.status}.`);
}

export async function createCapabilityResource({
  payload,
  signal,
  token,
  tokenType = "Bearer",
}: {
  payload: {
    name: string;
    kind: AgentCapabilityKind;
    description?: string;
    source_type: AgentCapabilitySourceType;
    source_ref?: string;
    capability_path?: string;
    metadata?: Record<string, unknown>;
  };
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildCapabilityListBaseUrl().toString(), {
    method: "POST",
    headers: buildHeaders({ token, tokenType, json: true }),
    signal,
    body: JSON.stringify(payload),
  });

  await ensureOk(response, `Capability create failed with status ${response.status}.`);
  return normalizeCapabilityRecord(await response.json());
}

export async function updateCapabilityResource({
  capabilityUid,
  payload,
  signal,
  token,
  tokenType = "Bearer",
}: {
  capabilityUid: string;
  payload: {
    name: string;
    kind: AgentCapabilityKind;
    description?: string;
    source_type: AgentCapabilitySourceType;
    source_ref?: string;
    capability_path?: string;
    metadata?: Record<string, unknown>;
  };
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildCapabilityDetailUrl(capabilityUid), {
    method: "PATCH",
    headers: buildHeaders({ token, tokenType, json: true }),
    signal,
    body: JSON.stringify(payload),
  });

  await ensureOk(response, `Capability update failed with status ${response.status}.`);
  return normalizeCapabilityRecord(await response.json());
}

export async function updateCapabilityContent({
  capabilityUid,
  payload,
  signal,
  token,
  tokenType = "Bearer",
}: {
  capabilityUid: string;
  payload: {
    content: string;
    filename?: string;
    content_mime_type?: string;
  };
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildCapabilityContentUrl(capabilityUid), {
    method: "PUT",
    headers: buildHeaders({ token, tokenType, json: true }),
    signal,
    body: JSON.stringify(payload),
  });

  await ensureOk(response, `Capability content update failed with status ${response.status}.`);
  return normalizeCapabilityContentRecord(await response.json());
}

export async function bindCapabilityToAgent({
  agentUid,
  payload,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentUid: string;
  payload: {
    capability_uid: string;
    role?: string;
    sort_order?: number;
    is_enabled?: boolean;
    is_locked?: boolean;
    configuration?: Record<string, unknown>;
    source_type?: AgentCapabilitySourceType;
    source_ref?: string;
  };
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildAgentCapabilityBindUrl(agentUid), {
    method: "POST",
    headers: buildHeaders({ token, tokenType, json: true }),
    signal,
    body: JSON.stringify(payload),
  });

  await ensureOk(response, `Capability bind failed with status ${response.status}.`);
  return normalizeCapabilityBindingRecord(await response.json());
}

export async function unbindCapabilityFromAgent({
  agentUid,
  capabilityUid,
  signal,
  token,
  tokenType = "Bearer",
}: {
  agentUid: string;
  capabilityUid: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildAgentCapabilityUnbindUrl(agentUid), {
    method: "POST",
    headers: buildHeaders({ token, tokenType, json: true }),
    signal,
    body: JSON.stringify({ capability_uid: capabilityUid }),
  });

  await ensureOk(response, `Capability unbind failed with status ${response.status}.`);
}
