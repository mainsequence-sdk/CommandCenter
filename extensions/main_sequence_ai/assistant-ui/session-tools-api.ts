import type { SessionToolsSnapshot } from "./session-tools";
import { normalizeSessionToolsSnapshot } from "./session-tools";

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
  const headers = new Headers({
    Accept: "application/json",
  });

  if (token) {
    headers.set("Authorization", `${tokenType} ${token}`);
  }

  const response = await fetch(buildSessionToolsUrl(sessionId, assistantEndpoint), {
    method: "GET",
    headers,
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
