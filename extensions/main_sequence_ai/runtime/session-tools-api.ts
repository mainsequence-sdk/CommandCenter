import type { SessionToolsSnapshot } from "../assistant-ui/session-tools";
import { normalizeSessionToolsSnapshot } from "../assistant-ui/session-tools";
import {
  buildMainSequenceAiAssistantUrl,
  fetchMainSequenceAiAssistantResponse,
} from "./assistant-endpoint";

function buildSessionToolsUrl(sessionId: string, assistantEndpoint: string) {
  const url = new URL(
    buildMainSequenceAiAssistantUrl(assistantEndpoint, "/api/chat/session-tools"),
  );
  url.searchParams.set("sessionId", sessionId);
  return url.toString();
}

export async function fetchSessionTools({
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
  const url = buildSessionToolsUrl(sessionId, assistantEndpoint);
  let response: Response;
  let requestUrl = url;
  let resolvedAssistantEndpoint = assistantEndpoint;

  try {
    ({
      response,
      url: requestUrl,
      resolvedAccess: { assistantEndpoint: resolvedAssistantEndpoint },
    } = await fetchMainSequenceAiAssistantResponse({
      accept: "application/json",
      assistantEndpoint,
      currentSessionId: sessionId,
      requestPath: `/api/chat/session-tools?sessionId=${encodeURIComponent(sessionId)}`,
      method: "GET",
      signal,
      sessionToken: token,
      sessionTokenType: tokenType,
    }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown fetch error.";
    throw new Error(
      `Failed to load available tools for session ${sessionId} from ${requestUrl}. ${detail}`,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;
    throw new Error(
      `Failed to load available tools for session ${sessionId} from ${requestUrl} (${response.status}). ${
        payload?.message || payload?.detail || payload?.error || response.statusText || "Unknown backend error."
      }`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionToolsSnapshot(payload, resolvedAssistantEndpoint) satisfies SessionToolsSnapshot;
}
