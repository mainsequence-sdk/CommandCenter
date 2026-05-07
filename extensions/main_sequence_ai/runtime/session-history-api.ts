import type {
  SessionHistoryApiSession,
  SessionHistorySnapshot,
} from "../assistant-ui/session-history";
import { normalizeSessionHistorySnapshot } from "../assistant-ui/session-history";
import {
  fetchMainSequenceAiAssistantResponse,
  type MainSequenceAiAssistantRuntimeTarget,
} from "./assistant-endpoint";
import { MainSequenceAiError } from "./error-source";

function createEmptySessionHistorySnapshot(sessionId: string): SessionHistorySnapshot {
  const session: SessionHistoryApiSession = {
    sessionId,
    threadId: null,
    agentName: "",
    agentId: null,
    agentSessionId: sessionId,
    status: "completed",
    startedAt: null,
    updatedAt: null,
    error: null,
  };

  return {
    version: 1,
    session,
    messages: [],
    inProgressMessage: null,
  };
}

export async function fetchSessionHistory({
  assistantEndpoint,
  runtimeTarget,
  sessionId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint?: string;
  runtimeTarget?: MainSequenceAiAssistantRuntimeTarget;
  sessionId: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    currentSessionId: sessionId,
    requestPath: `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`,
    method: "GET",
    runtimeTarget,
    signal,
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    if (response.status === 404) {
      return createEmptySessionHistorySnapshot(sessionId);
    }

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new MainSequenceAiError(
      payload?.message ||
        payload?.error ||
        `Session history failed with status ${response.status}.`,
      {
        source: "agent_session_history",
        status: response.status,
      },
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionHistorySnapshot(payload) satisfies SessionHistorySnapshot;
}
