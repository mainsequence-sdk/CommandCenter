import type { ThreadMessageLike } from "@assistant-ui/react";

import type { AgentSearchResult } from "../agent-search";
import type {
  AgentSessionApiRecord,
  AgentSessionSerializedRecord,
} from "../runtime/agent-sessions-api";
import {
  getAgentSessionRecordAgentId,
  getAgentSessionRecordHandleUniqueId,
  getAgentSessionRecordAgentName,
  getAgentSessionRecordSessionId,
  normalizeAgentSessionLookupId,
} from "../runtime/agent-sessions-api";
import type { CommandCenterBaseSessionHandle } from "../runtime/command-center-base-session-api";

export const DEFAULT_AGENT_TYPE = "astro-orchestrator";
export const DEFAULT_AGENT_LABEL = "Astro Orchestrator";

export interface AgentSessionAgent {
  id: number | null;
  name: string;
  displayLabel: string;
  requestAgentType: string;
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
  serializedSession: AgentSessionSerializedRecord | null;
  messages: ThreadMessageLike[];
}

export type AgentSessionSummary = Omit<AgentSessionRecord, "messages" | "serializedSession">;

export interface StreamCreatedAgentSession {
  agentId: number | null;
  agentSessionId: string;
  agentUniqueId: string | null;
  sessionKey: string | null;
  threadId: string | null;
}

function buildStorageKey(userId: string | null) {
  return `ms.main-sequence-ai.agent-sessions:${userId ?? "anonymous"}`;
}

function inferRuntimeSessionId(id: string) {
  return normalizeAgentSessionLookupId(id);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSerializedThinkingValue(value: unknown) {
  return typeof value === "string" ? value : "";
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
    id: agent.id > 0 ? agent.id : null,
    name: agent.name,
    displayLabel: agent.displayLabel,
    requestAgentType: agent.agentType,
    agentUniqueId: agent.agent_unique_id,
    description: agent.description,
    status: agent.status ?? "",
    llmProvider: agent.llm_provider,
    llmModel: agent.llm_model,
    engineName: agent.engine_name,
  };
}

export function createDefaultAgentSessionAgent(): AgentSessionAgent {
  return {
    id: null,
    name: DEFAULT_AGENT_LABEL,
    displayLabel: DEFAULT_AGENT_LABEL,
    requestAgentType: DEFAULT_AGENT_TYPE,
    agentUniqueId: DEFAULT_AGENT_TYPE,
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
  const sessionId = getAgentSessionRecordSessionId(record);
  if (!sessionId) {
    throw new Error(
      "AgentSession response did not include uid, agent_session_uid, session_uid, or runtime_session_uid.",
    );
  }
  const updatedAt = record.ended_at || record.started_at || new Date().toISOString();
  const title = record.title?.trim() || record.summary?.trim() || `Agent session ${sessionId}`;
  const preview = record.summary?.trim() || null;
  const requestAgentType = record.agent_type?.trim() || "";
  const recordAgentId = getAgentSessionRecordAgentId(record);
  const recordAgentName = getAgentSessionRecordAgentName(record);
  const hasCanonicalSessionUid = Boolean(
    normalizeAgentSessionLookupId(record.uid) ||
      normalizeAgentSessionLookupId(record.agent_session_uid) ||
      normalizeAgentSessionLookupId(record.session_uid) ||
      normalizeAgentSessionLookupId(record.runtime_session_uid),
  );
  const handleUniqueId = getAgentSessionRecordHandleUniqueId(record) ?? existing?.handleUniqueId ?? null;
  const preservedAgentUniqueId =
    existing?.agent &&
    existing.agent.agentUniqueId &&
    existing.agent.agentUniqueId !== DEFAULT_AGENT_TYPE &&
    (
      existing.agent.requestAgentType === requestAgentType ||
      (recordAgentId !== null && existing.agent.id === recordAgentId)
    )
      ? existing.agent.agentUniqueId
      : null;

  return {
    id: sessionId,
    title,
    preview,
    runtimeSessionId:
      hasCanonicalSessionUid
        ? sessionId
        : normalizeAgentSessionLookupId(existing?.runtimeSessionId) ?? sessionId,
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
    serializedSession: existing?.serializedSession ?? null,
    agent: {
      id: recordAgentId ?? existing?.agent?.id ?? null,
      name: recordAgentName || existing?.agent?.name || "",
      displayLabel: existing?.agent?.displayLabel || "",
      requestAgentType,
      agentUniqueId: preservedAgentUniqueId ?? "",
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
  const { messages: _messages, serializedSession: _serializedSession, ...summary } = record;
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

  if (agent?.displayLabel) {
    return agent.displayLabel;
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
    title: agent?.displayLabel ?? "New agent session",
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
    serializedSession: null,
    messages: [],
  };
}

export function attachSerializedSessionToSession(
  session: AgentSessionRecord,
  serializedSession: AgentSessionSerializedRecord,
) {
  return {
    ...toAgentSessionRecordFromApi(serializedSession, session),
    serializedSession: cloneJson(serializedSession),
  } satisfies AgentSessionRecord;
}

export function applyModelConfigToSerializedSession(
  serializedSession: AgentSessionSerializedRecord | null,
  {
    model,
    provider,
    thinking = "",
  }: {
    model: string;
    provider: string;
    thinking?: string | null;
  },
) {
  if (!serializedSession) {
    return null;
  }

  return {
    ...cloneJson(serializedSession),
    llm_model: model,
    llm_provider: provider,
    llm_thinking: normalizeSerializedThinkingValue(thinking),
  } satisfies AgentSessionSerializedRecord;
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
        ? nextAgent.displayLabel
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

export function toAgentSessionRecordFromBaseHandle(
  handle: CommandCenterBaseSessionHandle,
  existing?: AgentSessionRecord,
): AgentSessionRecord {
  const nextAgent = existing?.agent ?? createDefaultAgentSessionAgent();
  const requestAgentType = handle.agent.requestAgentType?.trim() || "";
  const displayLabel = handle.agent.displayLabel?.trim() || "";

  return {
    id: handle.sessionId,
    title:
      existing?.title ||
      displayLabel,
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
      name: nextAgent.name,
      displayLabel,
      requestAgentType,
      agentUniqueId: handle.agent.agentUniqueId?.trim() || "",
      llmProvider: handle.agent.llmProvider?.trim() || nextAgent.llmProvider || "",
      llmModel: handle.agent.llmModel?.trim() || nextAgent.llmModel || "",
    },
    origin: "astro_command_center_base",
    isPlaceholder: false,
    serializedSession: existing?.serializedSession ?? null,
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

      const storedSessionId = normalizeAgentSessionLookupId(candidate.id);

      if (!storedSessionId) {
        return [];
      }

      return [
        {
          id: storedSessionId,
          title:
            typeof candidate.title === "string" && candidate.title.trim()
              ? candidate.title
              : "New agent session",
          preview: typeof candidate.preview === "string" ? candidate.preview : null,
          runtimeSessionId:
            normalizeAgentSessionLookupId(candidate.runtimeSessionId)
              ? normalizeAgentSessionLookupId(candidate.runtimeSessionId)
              : inferRuntimeSessionId(storedSessionId),
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
              ? (() => {
                  const agent = candidate.agent as Partial<AgentSessionAgent>;

                  return {
                    id: typeof agent.id === "number" && Number.isFinite(agent.id) ? agent.id : null,
                    name: typeof agent.name === "string" ? agent.name : "",
                    displayLabel: typeof agent.displayLabel === "string" ? agent.displayLabel : "",
                    requestAgentType:
                      typeof agent.requestAgentType === "string" ? agent.requestAgentType : "",
                    agentUniqueId:
                      typeof agent.agentUniqueId === "string" ? agent.agentUniqueId : "",
                    description: typeof agent.description === "string" ? agent.description : "",
                    status: typeof agent.status === "string" ? agent.status : "",
                    llmProvider: typeof agent.llmProvider === "string" ? agent.llmProvider : "",
                    llmModel: typeof agent.llmModel === "string" ? agent.llmModel : "",
                    engineName: typeof agent.engineName === "string" ? agent.engineName : "",
                  } satisfies AgentSessionAgent;
                })()
              : null,
          isPlaceholder: Boolean(candidate.isPlaceholder),
          serializedSession:
            candidate.serializedSession &&
            typeof candidate.serializedSession === "object" &&
            !Array.isArray(candidate.serializedSession)
              ? cloneJson(candidate.serializedSession as AgentSessionSerializedRecord)
              : null,
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
