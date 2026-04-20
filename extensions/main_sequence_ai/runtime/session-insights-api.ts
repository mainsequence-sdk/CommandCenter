import type { SessionInsightsSnapshot } from "../assistant-ui/session-insights";
import { normalizeSessionInsightsSnapshot } from "../assistant-ui/session-insights";
import { fetchMainSequenceAiAssistantResponse } from "./assistant-endpoint";

export async function fetchSessionInsights({
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
  const requestPath = `/api/chat/session-insights?sessionId=${encodeURIComponent(sessionId)}`;
  let response: Response;
  let requestUrl = requestPath;

  try {
    ({ response, url: requestUrl } = await fetchMainSequenceAiAssistantResponse({
      accept: "application/json",
      assistantEndpoint,
      currentSessionId: sessionId,
      requestPath,
      method: "GET",
      signal,
      sessionToken: token,
      sessionTokenType: tokenType,
    }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown fetch error.";
    throw new Error(
      `Failed to load session insights for session ${sessionId} from ${requestUrl}. ${detail}`,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string; error?: string; message?: string }
      | null;
    throw new Error(
      `Failed to load session insights for session ${sessionId} from ${requestUrl} (${response.status}). ${
        payload?.message || payload?.detail || payload?.error || response.statusText || "Unknown backend error."
      }`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionInsightsSnapshot(payload) satisfies SessionInsightsSnapshot;
}
