export interface SessionToolsApiSession {
  sessionId: string;
  agentName: string;
  agentId: number | null;
  agentSessionId: string | null;
  projectId: string | null;
}

export interface RepoDiffSessionTool {
  kind: "repo_diff";
  toolKey: "repo_diff";
  url: string;
  raw: Record<string, unknown>;
}

export interface UnknownSessionTool {
  kind: "unknown";
  toolKey: string;
  url: string;
  raw: Record<string, unknown>;
}

export type SessionToolDefinition = RepoDiffSessionTool | UnknownSessionTool;

export interface SessionToolsSnapshot {
  version: number;
  session: SessionToolsApiSession;
  availableTools: SessionToolDefinition[];
  availableToolsByKey: Record<string, SessionToolDefinition>;
}

function normalizeSessionToolsSession(value: unknown): SessionToolsApiSession {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const rawSessionId = candidate.sessionId;
  const rawAgentSessionId = candidate.agentSessionId;
  const rawAgentId = candidate.agentId;

  return {
    sessionId: typeof rawSessionId === "string" && rawSessionId.trim() ? rawSessionId.trim() : "",
    agentName:
      typeof candidate.agentName === "string" && candidate.agentName.trim()
        ? candidate.agentName.trim()
        : "",
    agentId:
      typeof rawAgentId === "number" && Number.isFinite(rawAgentId)
        ? rawAgentId
        : typeof rawAgentId === "string" && rawAgentId.trim()
          ? Number(rawAgentId)
          : null,
    agentSessionId:
      typeof rawAgentSessionId === "string" && rawAgentSessionId.trim()
        ? rawAgentSessionId.trim()
        : typeof rawAgentSessionId === "number" && Number.isFinite(rawAgentSessionId)
          ? String(rawAgentSessionId)
          : null,
    projectId:
      typeof candidate.projectId === "string" && candidate.projectId.trim()
        ? candidate.projectId.trim()
        : null,
  };
}

function normalizeToolUrl(url: string, assistantEndpoint: string) {
  return new URL(url, assistantEndpoint).toString();
}

function normalizeSessionToolDefinition(
  toolKey: string,
  value: unknown,
  assistantEndpoint: string,
): SessionToolDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const rawUrl = raw.url;

  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return null;
  }

  const url = normalizeToolUrl(rawUrl.trim(), assistantEndpoint);

  switch (toolKey) {
    case "repo_diff":
      return {
        kind: "repo_diff",
        toolKey: "repo_diff",
        url,
        raw,
      };
    default:
      return {
        kind: "unknown",
        toolKey,
        url,
        raw,
      };
  }
}

export function normalizeSessionToolsSnapshot(payload: unknown, assistantEndpoint: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Session tools response is not an object.");
  }

  const candidate = payload as Record<string, unknown>;
  const version =
    typeof candidate.version === "number" && Number.isFinite(candidate.version)
      ? candidate.version
      : 1;
  const session = normalizeSessionToolsSession(candidate.session);
  const rawAvailableTools =
    candidate.available_tools &&
    typeof candidate.available_tools === "object" &&
    !Array.isArray(candidate.available_tools)
      ? (candidate.available_tools as Record<string, unknown>)
      : {};

  const availableTools = Object.entries(rawAvailableTools)
    .map(([toolKey, value]) => normalizeSessionToolDefinition(toolKey, value, assistantEndpoint))
    .filter((tool): tool is SessionToolDefinition => tool !== null);

  const availableToolsByKey = Object.fromEntries(
    availableTools.map((tool) => [tool.toolKey, tool]),
  );

  return {
    version,
    session,
    availableTools,
    availableToolsByKey,
  } satisfies SessionToolsSnapshot;
}
