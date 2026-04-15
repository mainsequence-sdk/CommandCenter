import type { SessionToolsSnapshot } from "../assistant-ui/session-tools";
import { normalizeSessionToolsSnapshot } from "../assistant-ui/session-tools";
import {
  buildMainSequenceAiAssistantHeaders,
  buildMainSequenceAiAssistantUrl,
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

  try {
    response = await fetch(url, {
      method: "GET",
      headers: buildMainSequenceAiAssistantHeaders({
        accept: "application/json",
        token,
        tokenType,
      }),
      signal,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown fetch error.";
    throw new Error(
      `Failed to load available tools for session ${sessionId} from ${url}. ${detail}`,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;
    throw new Error(
      `Failed to load available tools for session ${sessionId} from ${url} (${response.status}). ${
        payload?.message || payload?.detail || payload?.error || response.statusText || "Unknown backend error."
      }`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionToolsSnapshot(payload, assistantEndpoint) satisfies SessionToolsSnapshot;
}
