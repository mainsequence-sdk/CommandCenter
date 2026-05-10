import type {
  SessionHistoryApiSession,
  SessionHistorySnapshot,
} from "../assistant-ui/session-history";
import { normalizeSessionHistorySnapshot } from "../assistant-ui/session-history";
import { env } from "@/config/env";
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

function buildSessionHistoryUrl(sessionId: string | number) {
  return new URL(
    `/orm/api/agents/v1/sessions/${encodeURIComponent(String(sessionId))}/history/`,
    env.apiBaseUrl,
  ).toString();
}

export async function fetchSessionHistory({
  sessionId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  sessionId: string | number;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const requestUrl = buildSessionHistoryUrl(sessionId);
  const headers = new Headers({
    Accept: "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      method: "GET",
      headers,
      signal,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown fetch error.";
    throw new MainSequenceAiError(
      `Failed to load session history for session ${sessionId} from ${requestUrl}. ${detail}`,
      {
        source: "agent_session_history",
      },
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      return createEmptySessionHistorySnapshot(String(sessionId));
    }

    const payload = (await response.json().catch(() => null)) as
      | { detail?: string; error?: string; message?: string }
      | null;
    throw new MainSequenceAiError(
      `Failed to load session history for session ${sessionId} from ${requestUrl} (${response.status}). ${
        payload?.message || payload?.detail || payload?.error || response.statusText || "Unknown backend error."
      }`,
      {
        source: "agent_session_history",
        status: response.status,
      },
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionHistorySnapshot(payload) satisfies SessionHistorySnapshot;
}
