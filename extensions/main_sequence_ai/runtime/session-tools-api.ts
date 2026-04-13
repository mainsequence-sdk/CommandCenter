import type { SessionToolsSnapshot } from "../assistant-ui/session-tools";
import { normalizeSessionToolsSnapshot } from "../assistant-ui/session-tools";
import { buildMainSequenceAiAssistantHeaders } from "./assistant-endpoint";

function buildSessionToolsUrl(sessionId: string, assistantEndpoint: string) {
  const url = new URL("/api/chat/session-tools", assistantEndpoint);
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
  const response = await fetch(buildSessionToolsUrl(sessionId, assistantEndpoint), {
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
        `Session tools failed with status ${response.status}.`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionToolsSnapshot(payload, assistantEndpoint) satisfies SessionToolsSnapshot;
}
