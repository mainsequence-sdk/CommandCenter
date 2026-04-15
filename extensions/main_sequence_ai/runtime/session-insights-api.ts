import type { SessionInsightsSnapshot } from "../assistant-ui/session-insights";
import { normalizeSessionInsightsSnapshot } from "../assistant-ui/session-insights";
import {
  buildMainSequenceAiAssistantHeaders,
  buildMainSequenceAiAssistantUrl,
} from "./assistant-endpoint";

function buildSessionInsightsUrl(sessionId: string, assistantEndpoint: string) {
  const url = new URL(
    buildMainSequenceAiAssistantUrl(assistantEndpoint, "/api/chat/session-insights"),
  );
  url.searchParams.set("sessionId", sessionId);
  return url.toString();
}

export async function fetchSessionInsights({
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
  const url = buildSessionInsightsUrl(sessionId, assistantEndpoint);
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
      `Failed to load session insights for session ${sessionId} from ${url}. ${detail}`,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string; error?: string; message?: string }
      | null;
    throw new Error(
      `Failed to load session insights for session ${sessionId} from ${url} (${response.status}). ${
        payload?.message || payload?.detail || payload?.error || response.statusText || "Unknown backend error."
      }`,
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionInsightsSnapshot(payload) satisfies SessionInsightsSnapshot;
}
