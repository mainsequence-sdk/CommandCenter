import type { SessionToolsSnapshot } from "../assistant-ui/session-tools";
import { normalizeSessionToolsSnapshot } from "../assistant-ui/session-tools";
import { fetchMainSequenceAiAssistantResponse } from "./assistant-endpoint";
import { MainSequenceAiError } from "./error-source";

export async function fetchSessionTools({
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
  const requestPath = `/api/chat/session-tools?sessionId=${encodeURIComponent(sessionId)}`;
  let response: Response;
  let requestUrl = requestPath;
  let resolvedAssistantEndpoint: string | null = null;

  try {
    ({
      response,
      url: requestUrl,
      resolvedAccess: { assistantEndpoint: resolvedAssistantEndpoint },
    } = await fetchMainSequenceAiAssistantResponse({
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
    throw new MainSequenceAiError(
      `Failed to load available tools for session ${sessionId} from ${requestUrl}. ${detail}`,
      {
        source: "agent_session_tools",
      },
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;
    throw new MainSequenceAiError(
      `Failed to load available tools for session ${sessionId} from ${requestUrl} (${response.status}). ${
        payload?.message || payload?.detail || payload?.error || response.statusText || "Unknown backend error."
      }`,
      {
        source: "agent_session_tools",
        status: response.status,
      },
    );
  }

  const payload = (await response.json()) as unknown;
  if (!resolvedAssistantEndpoint) {
    throw new MainSequenceAiError(
      `Failed to load available tools for session ${sessionId}. Assistant runtime endpoint was not resolved.`,
      {
        source: "agent_session_tools",
      },
    );
  }

  return normalizeSessionToolsSnapshot(payload, resolvedAssistantEndpoint) satisfies SessionToolsSnapshot;
}
