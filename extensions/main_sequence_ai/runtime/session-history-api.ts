import type { SessionHistorySnapshot } from "../assistant-ui/session-history";
import { normalizeSessionHistorySnapshot } from "../assistant-ui/session-history";
import {
  buildMainSequenceAiAssistantHeaders,
  buildMainSequenceAiAssistantUrl,
} from "./assistant-endpoint";

function buildSessionHistoryUrl(sessionId: string, assistantEndpoint: string) {
  const url = new URL(
    buildMainSequenceAiAssistantUrl(assistantEndpoint, "/api/chat/history"),
  );
  url.searchParams.set("sessionId", sessionId);
  return url.toString();
}

export async function fetchSessionHistory({
  assistantEndpoint,
  sessionId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  sessionId: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildSessionHistoryUrl(sessionId, assistantEndpoint), {
    method: "GET",
    headers: buildMainSequenceAiAssistantHeaders({
      accept: "application/json",
      token,
      tokenType,
    }),
    signal,
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
