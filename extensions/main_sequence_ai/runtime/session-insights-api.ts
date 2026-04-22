import type { SessionInsightsSnapshot } from "../assistant-ui/session-insights";
import { normalizeSessionInsightsSnapshot } from "../assistant-ui/session-insights";
import { env } from "@/config/env";

function buildSessionInsightsUrl(sessionId: string | number) {
  return new URL(
    `/orm/api/agents/v1/sessions/${encodeURIComponent(String(sessionId))}/insights/`,
    env.apiBaseUrl,
  ).toString();
}

export async function fetchSessionInsights({
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
  const requestUrl = buildSessionInsightsUrl(sessionId);
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
