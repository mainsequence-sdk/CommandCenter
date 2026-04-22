import type { ThreadMessageLike } from "@assistant-ui/react";

import type { AgentSearchResult } from "../agent-search";
import type { AgentSessionApiRecord } from "../runtime/agent-sessions-api";
import type { CommandCenterBaseSessionHandle } from "../runtime/command-center-base-session-api";

export const DEFAULT_AGENT_NAME = "astro-orchestrator";
export const DEFAULT_AGENT_LABEL = "Astro Orchestrator";

export interface AgentSessionAgent {
  id: number | null;
  name: string;
  requestName: string;
  agentUniqueId: string;
  description: string;
  status: string;
  llmProvider: string;
  llmModel: string;
  engineName: string;
}

export interface AgentSessionRecord {
  id: string;
  title: string;
  preview: string | null;
  runtimeSessionId: string | null;
  sessionKey: string | null;
  handleUniqueId: string | null;
  threadId: string | null;
  projectId: string | null;
  cwd: string | null;
  runtimeState: string | null;
  working: boolean;
  updatedAt: string;
  agent: AgentSessionAgent | null;
  origin: "astro_command_center_base" | null;
  isPlaceholder: boolean;
  messages: ThreadMessageLike[];
}

export type AgentSessionSummary = Omit<AgentSessionRecord, "messages">;

export interface StreamCreatedAgentSession {
  agentId: number | null;
  agentSessionId: string;
  agentUniqueId: string | null;
  sessionKey: string | null;
  threadId: string | null;
}

export interface StreamSwitchedAgentSession {
  fromAgentName: string | null;
  toAgentName: string;
  projectId: string | null;
  cwd: string | null;
  threadId: string | null;
  agentId: number | null;
  agentUniqueId: string | null;
  agentSessionId: string;
  sessionKey: string | null;
  runtimeSessionId: string | null;
  initialTask: string | null;
  summary: string | null;
}

function buildStorageKey(userId: string | null) {
  return `ms.main-sequence-ai.agent-sessions:${userId ?? "anonymous"}`;
}

function inferRuntimeSessionId(id: string) {
  return /^\d+$/.test(id) ? id : null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function extractTextContent(message: ThreadMessageLike) {
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .flatMap((part) => {
      if (part.type !== "text" || typeof part.text !== "string") {
        return [];
      }

      return [part.text];
    })
    .join("")
    .trim();
}

export function createAgentSessionId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `agent-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toAgentSessionAgent(agent: AgentSearchResult): AgentSessionAgent {
  return {
    id: agent.id,
    name: agent.name,
    requestName: agent.name,
    agentUniqueId: agent.agent_unique_id,
    description: agent.description,
    status: agent.status,
    llmProvider: agent.llm_provider,
    llmModel: agent.llm_model,
    engineName: agent.engine_name,
  };
}

export function createDefaultAgentSessionAgent(): AgentSessionAgent {
  return {
    id: null,
    name: DEFAULT_AGENT_LABEL,
    requestName: DEFAULT_AGENT_NAME,
    agentUniqueId: DEFAULT_AGENT_NAME,
    description: "",
    status: "",
    llmProvider: "",
    llmModel: "",
    engineName: "",
  };
}

export function toAgentSessionRecordFromApi(
  record: AgentSessionApiRecord,
  existing?: AgentSessionRecord,
): AgentSessionRecord {
  const sessionId = String(record.agent_session || record.id);
  const updatedAt = record.ended_at || record.started_at || new Date().toISOString();
  const title = record.title?.trim() || record.summary?.trim() || `Agent session ${sessionId}`;
  const preview = record.summary?.trim() || null;
  const handleUniqueId =
    (Array.isArray(record.bound_handles) ? record.bound_handles[0]?.handle_unique_id : null) ??
    existing?.handleUniqueId ??
    null;

  return {
    id: sessionId,
    title,
    preview,
    runtimeSessionId: existing?.runtimeSessionId ?? sessionId,
    sessionKey: existing?.sessionKey ?? null,
    handleUniqueId,
    threadId: existing?.threadId ?? null,
    projectId: existing?.projectId ?? null,
    cwd: existing?.cwd ?? null,
    runtimeState: record.runtime_state?.trim() || existing?.runtimeState || null,
    working: record.working ?? existing?.working ?? false,
    updatedAt,
    origin: existing?.origin ?? null,
    isPlaceholder: false,
    agent: {
      id: record.agent ?? existing?.agent?.id ?? null,
      name:
        record.actor_name?.trim() ||
        record.agent_name?.trim() ||
        existing?.agent?.name ||
        "Astro Orchestrator",
      requestName: record.agent_name?.trim() || existing?.agent?.requestName || DEFAULT_AGENT_NAME,
      agentUniqueId: handleUniqueId || existing?.agent?.agentUniqueId || "astro-orchestrator",
      description: existing?.agent?.description || "",
      status: record.status || existing?.agent?.status || "",
      llmProvider: record.llm_provider || existing?.agent?.llmProvider || "",
      llmModel: record.llm_model || existing?.agent?.llmModel || "",
      engineName: record.engine_name || existing?.agent?.engineName || "",
    },
    messages: existing?.messages ?? [],
  };
}

export function summarizeAgentSession(record: AgentSessionRecord): AgentSessionSummary {
  const { messages: _messages, ...summary } = record;
  return summary;
}

export function buildAgentSessionTitle({
  agent,
  messages,
}: {
  agent: AgentSessionAgent | null;
  messages: readonly ThreadMessageLike[];
}) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const firstUserText = firstUserMessage ? extractTextContent(firstUserMessage) : "";

  if (firstUserText) {
    return firstUserText.length > 72 ? `${firstUserText.slice(0, 69)}...` : firstUserText;
  }

  if (agent?.name) {
    return agent.name;
  }

  return "New agent session";
}

export function buildAgentSessionPreview(messages: readonly ThreadMessageLike[]) {
  const latestMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" || message.role === "user");

  if (!latestMessage) {
    return null;
  }

  const text = extractTextContent(latestMessage);
  if (!text) {
    return null;
  }

  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function createEmptyAgentSession(
  agent: AgentSessionAgent | null = null,
  options: { placeholder?: boolean } = {},
): AgentSessionRecord {
  return {
    id: createAgentSessionId(),
    title: agent?.name ?? "New agent session",
    preview: null,
    runtimeSessionId: null,
    sessionKey: null,
    handleUniqueId: null,
    threadId: null,
    projectId: null,
    cwd: null,
    runtimeState: null,
    working: false,
    updatedAt: new Date().toISOString(),
    agent,
    origin: null,
    isPlaceholder: options.placeholder ?? false,
    messages: [],
  };
}

export function updateAgentSessionSnapshot({
  session,
  messages,
  updatedAt = new Date().toISOString(),
}: {
  session: AgentSessionRecord;
  messages: readonly ThreadMessageLike[];
  updatedAt?: string;
}): AgentSessionRecord {
  const normalizedMessages = cloneJson([...messages]) as ThreadMessageLike[];

  return {
    ...session,
    messages: normalizedMessages,
    isPlaceholder: normalizedMessages.length > 0 ? false : session.isPlaceholder,
    preview: buildAgentSessionPreview(normalizedMessages),
    title: buildAgentSessionTitle({
      agent: session.agent,
      messages: normalizedMessages,
    }),
    updatedAt,
  };
}

export function attachAgentToSession(session: AgentSessionRecord, agent: AgentSearchResult) {
  const nextAgent = toAgentSessionAgent(agent);
  return {
    ...session,
    agent: nextAgent,
    origin: session.origin,
    isPlaceholder: false,
    title:
      session.messages.length === 0
        ? nextAgent.name
        : buildAgentSessionTitle({ agent: nextAgent, messages: session.messages }),
    updatedAt: new Date().toISOString(),
  };
}

export function promoteAgentSessionFromStream({
  session,
  stream,
  messages,
}: {
  session: AgentSessionRecord;
  stream: StreamCreatedAgentSession;
  messages: readonly ThreadMessageLike[];
}) {
  const nextAgent =
    session.agent || createDefaultAgentSessionAgent();

  return updateAgentSessionSnapshot({
    session: {
      ...session,
      id: stream.agentSessionId,
      runtimeSessionId: stream.agentSessionId,
      sessionKey: stream.sessionKey ?? session.sessionKey,
      handleUniqueId: session.handleUniqueId,
      threadId: stream.threadId ?? session.threadId,
      origin: session.origin,
      isPlaceholder: false,
      updatedAt: new Date().toISOString(),
      agent: {
        ...nextAgent,
        id: stream.agentId ?? nextAgent.id,
        agentUniqueId: stream.agentUniqueId ?? nextAgent.agentUniqueId,
      },
    },
    messages,
  });
}

export function switchAgentSessionFromStream({
  session,
  stream,
  messages,
}: {
  session: AgentSessionRecord;
  stream: StreamSwitchedAgentSession;
  messages: readonly ThreadMessageLike[];
}) {
  const nextAgent = session.agent || createDefaultAgentSessionAgent();
  const nextAgentName = stream.toAgentName.trim() || nextAgent.name;

  return updateAgentSessionSnapshot({
    session: {
      ...session,
      id: stream.agentSessionId,
      runtimeSessionId: stream.runtimeSessionId ?? stream.agentSessionId,
      sessionKey: stream.sessionKey ?? session.sessionKey,
      handleUniqueId: session.handleUniqueId,
      threadId: stream.threadId ?? session.threadId,
      projectId: stream.projectId ?? session.projectId,
      cwd: stream.cwd ?? session.cwd,
      runtimeState: session.runtimeState,
      working: session.working,
      origin: session.origin,
      isPlaceholder: false,
      updatedAt: new Date().toISOString(),
      agent: {
        ...nextAgent,
        id: stream.agentId ?? nextAgent.id,
        name: nextAgentName,
        requestName: nextAgentName,
        agentUniqueId: stream.agentUniqueId ?? nextAgent.agentUniqueId,
      },
    },
    messages,
  });
}

export function toAgentSessionRecordFromBaseHandle(
  handle: CommandCenterBaseSessionHandle,
  existing?: AgentSessionRecord,
): AgentSessionRecord {
  const nextAgent = existing?.agent ?? createDefaultAgentSessionAgent();
  const requestName = handle.agent.requestName?.trim() || DEFAULT_AGENT_NAME;
  const displayName =
    handle.agent.name?.trim() ||
    (requestName === DEFAULT_AGENT_NAME ? DEFAULT_AGENT_LABEL : requestName);

  return {
    id: handle.sessionId,
    title:
      existing?.title ||
      displayName,
    preview: existing?.preview ?? null,
    runtimeSessionId: handle.runtimeSessionId ?? existing?.runtimeSessionId ?? handle.sessionId,
    sessionKey: handle.sessionKey ?? existing?.sessionKey ?? null,
    handleUniqueId: handle.handleUniqueId ?? existing?.handleUniqueId ?? null,
    threadId: handle.threadId ?? existing?.threadId ?? null,
    projectId: handle.projectId ?? existing?.projectId ?? null,
    cwd: handle.cwd ?? existing?.cwd ?? null,
    runtimeState: handle.runtimeState ?? existing?.runtimeState ?? null,
    working: handle.working ?? existing?.working ?? false,
    updatedAt: handle.updatedAt ?? existing?.updatedAt ?? new Date().toISOString(),
    agent: {
      ...nextAgent,
      id: handle.agent.id ?? nextAgent.id,
      name: displayName,
      requestName,
      agentUniqueId:
        handle.agent.agentUniqueId?.trim() ||
        nextAgent.agentUniqueId ||
        requestName,
      llmProvider: handle.agent.llmProvider?.trim() || nextAgent.llmProvider || "",
      llmModel: handle.agent.llmModel?.trim() || nextAgent.llmModel || "",
    },
    origin: "astro_command_center_base",
    isPlaceholder: false,
    messages: existing?.messages ?? [],
  };
}

export function readAgentSessions(userId: string | null) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
      }

      const candidate = entry as Partial<AgentSessionRecord>;

      if (typeof candidate.id !== "string") {
        return [];
      }

      return [
        {
          id: candidate.id,
          title:
            typeof candidate.title === "string" && candidate.title.trim()
              ? candidate.title
              : "New agent session",
          preview: typeof candidate.preview === "string" ? candidate.preview : null,
          runtimeSessionId:
            typeof candidate.runtimeSessionId === "string" && candidate.runtimeSessionId
              ? candidate.runtimeSessionId
              : inferRuntimeSessionId(candidate.id),
          sessionKey:
            typeof candidate.sessionKey === "string" && candidate.sessionKey
              ? candidate.sessionKey
              : null,
          handleUniqueId:
            typeof candidate.handleUniqueId === "string" && candidate.handleUniqueId
              ? candidate.handleUniqueId
              : null,
          threadId:
            typeof candidate.threadId === "string" && candidate.threadId
              ? candidate.threadId
              : null,
          projectId:
            typeof candidate.projectId === "string" && candidate.projectId
              ? candidate.projectId
              : null,
          cwd:
            typeof candidate.cwd === "string" && candidate.cwd
              ? candidate.cwd
              : null,
          runtimeState:
            typeof candidate.runtimeState === "string" && candidate.runtimeState
              ? candidate.runtimeState
              : null,
          working: Boolean(candidate.working),
          updatedAt:
            typeof candidate.updatedAt === "string" && candidate.updatedAt
              ? candidate.updatedAt
              : new Date().toISOString(),
          origin:
            candidate.origin === "astro_command_center_base"
              ? "astro_command_center_base"
              : null,
          agent:
            candidate.agent && typeof candidate.agent === "object" && !Array.isArray(candidate.agent)
              ? ({
                  ...(candidate.agent as AgentSessionAgent),
                  requestName:
                    typeof (candidate.agent as Partial<AgentSessionAgent>).requestName === "string" &&
                    (candidate.agent as Partial<AgentSessionAgent>).requestName
                      ? (candidate.agent as AgentSessionAgent).requestName
                      : typeof (candidate.agent as Partial<AgentSessionAgent>).name === "string" &&
                          (candidate.agent as Partial<AgentSessionAgent>).name
                        ? (candidate.agent as AgentSessionAgent).name
                        : DEFAULT_AGENT_NAME,
                } satisfies AgentSessionAgent)
              : null,
          isPlaceholder: Boolean(candidate.isPlaceholder),
          messages: Array.isArray(candidate.messages)
            ? cloneJson(candidate.messages as ThreadMessageLike[])
            : [],
        } satisfies AgentSessionRecord,
      ];
    });
  } catch {
    return [];
  }
}

export function writeAgentSessions(
  userId: string | null,
  sessions: readonly AgentSessionRecord[],
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(sessions));
  } catch {
    // Ignore localStorage failures and keep the in-memory session list authoritative.
  }
}
