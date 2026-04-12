import type { ThreadMessageLike } from "@assistant-ui/react";

type HistoryMessageStatus = "running" | "completed" | "error";

type HistoryMessagePart = {
  type: "text";
  text: string;
};

export interface SessionHistoryApiSession {
  sessionId: string;
  threadId: string | null;
  agentName: string;
  agentId: number | null;
  agentSessionId: string | null;
  status: HistoryMessageStatus;
  startedAt: string | null;
  updatedAt: string | null;
  error: string | null;
}

export interface SessionHistorySnapshot {
  version: number;
  session: SessionHistoryApiSession;
  messages: ThreadMessageLike[];
  inProgressMessage: ThreadMessageLike | null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeTextParts(value: unknown): HistoryMessagePart[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const candidate = entry as Record<string, unknown>;
    if (candidate.type !== "text" || typeof candidate.text !== "string") {
      return [];
    }

    return [
      {
        type: "text" as const,
        text: candidate.text,
      },
    ];
  });
}

function normalizeAssistantStatus(
  mode: "complete" | "in-progress",
  session: SessionHistoryApiSession,
) {
  if (mode === "complete") {
    return {
      type: "complete" as const,
      reason: "stop" as const,
    };
  }

  if (session.status === "error") {
    return {
      type: "incomplete" as const,
      reason: "error" as const,
      ...(session.error ? { error: session.error } : {}),
    };
  }

  return {
    type: "running" as const,
  };
}

function normalizeHistoryMessage(
  value: unknown,
  session: SessionHistoryApiSession,
  mode: "complete" | "in-progress",
): ThreadMessageLike | null {
  const candidate = asRecord(value);
  const role = candidate.role;

  if (role !== "assistant" && role !== "user" && role !== "system") {
    return null;
  }

  const content = normalizeTextParts(candidate.content);
  if (content.length === 0) {
    return null;
  }

  const id =
    typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : undefined;

  return {
    role,
    ...(id ? { id } : {}),
    ...(normalizeDate(candidate.createdAt) ? { createdAt: normalizeDate(candidate.createdAt) } : {}),
    ...(role === "assistant" ? { status: normalizeAssistantStatus(mode, session) } : {}),
    content,
  } satisfies ThreadMessageLike;
}

function normalizeSession(value: unknown): SessionHistoryApiSession {
  const candidate = asRecord(value);
  const rawAgentId = candidate.agentId;
  const parsedAgentId =
    typeof rawAgentId === "number" && Number.isFinite(rawAgentId)
      ? rawAgentId
      : typeof rawAgentId === "string" && rawAgentId.trim()
        ? Number(rawAgentId)
        : null;

  const rawAgentSessionId = candidate.agentSessionId;
  const rawSessionId = candidate.sessionId;
  const rawStatus = candidate.status;

  return {
    sessionId:
      typeof rawSessionId === "string" && rawSessionId.trim() ? rawSessionId.trim() : "",
    threadId:
      typeof candidate.threadId === "string" && candidate.threadId.trim()
        ? candidate.threadId.trim()
        : null,
    agentName:
      typeof candidate.agentName === "string" && candidate.agentName.trim()
        ? candidate.agentName.trim()
        : "",
    agentId: parsedAgentId !== null && Number.isFinite(parsedAgentId) ? parsedAgentId : null,
    agentSessionId:
      typeof rawAgentSessionId === "string" && rawAgentSessionId.trim()
        ? rawAgentSessionId.trim()
        : typeof rawAgentSessionId === "number" && Number.isFinite(rawAgentSessionId)
          ? String(rawAgentSessionId)
          : null,
    status:
      rawStatus === "running" || rawStatus === "completed" || rawStatus === "error"
        ? rawStatus
        : "completed",
    startedAt:
      typeof candidate.startedAt === "string" && candidate.startedAt.trim()
        ? candidate.startedAt.trim()
        : null,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
        ? candidate.updatedAt.trim()
        : null,
    error:
      typeof candidate.error === "string" && candidate.error.trim() ? candidate.error.trim() : null,
  };
}

export function normalizeSessionHistorySnapshot(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Session history response is not an object.");
  }

  const candidate = payload as Record<string, unknown>;
  const session = normalizeSession(candidate.session);
  const version =
    typeof candidate.version === "number" && Number.isFinite(candidate.version)
      ? candidate.version
      : 1;

  const completedMessages = Array.isArray(candidate.messages)
    ? candidate.messages.flatMap((message) => {
        const normalized = normalizeHistoryMessage(message, session, "complete");
        return normalized ? [normalized] : [];
      })
    : [];

  const inProgressMessage = normalizeHistoryMessage(
    candidate.inProgressMessage,
    session,
    "in-progress",
  );

  return {
    version,
    session,
    messages: inProgressMessage ? [...completedMessages, inProgressMessage] : completedMessages,
    inProgressMessage,
  } satisfies SessionHistorySnapshot;
}
