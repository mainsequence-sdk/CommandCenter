import type { SessionHistorySnapshot } from "../assistant-ui/session-history";
import { normalizeSessionHistorySnapshot } from "../assistant-ui/session-history";
import { fetchMainSequenceAiAssistantResponse } from "./assistant-endpoint";

export async function fetchSessionHistory({
  assistantEndpoint,
  sessionId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint?: string;
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
    signal,
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.error ||
        `Session history failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionHistorySnapshot(payload) satisfies SessionHistorySnapshot;
}
