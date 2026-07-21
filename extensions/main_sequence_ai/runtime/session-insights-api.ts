import type { SessionInsightsSnapshot } from "../assistant-ui/session-insights";
import {
  createEmptySessionInsightsSnapshot,
  normalizeSessionInsightsSnapshot,
} from "../assistant-ui/session-insights";
import { env } from "@/config/env";
import { requireAgentSessionLookupId } from "./agent-sessions-api";
import { MainSequenceAiError } from "./error-source";
import { buildRuntimeHttpErrorMessage } from "./http-error";

function buildSessionInsightsUrl(sessionId: string | number) {
  const normalizedSessionId = requireAgentSessionLookupId(
    sessionId,
    "AgentSession insights",
  );
  return new URL(
    `/orm/api/agents/v1/sessions/${encodeURIComponent(normalizedSessionId)}/insights/`,
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
    throw new MainSequenceAiError(
      `Failed to load session insights for session ${sessionId} from ${requestUrl}. ${detail}`,
      {
        source: "agent_session_insights",
      },
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      return createEmptySessionInsightsSnapshot({
        sessionId,
      });
    }

    throw new MainSequenceAiError(
      await buildRuntimeHttpErrorMessage({
        fallbackMessage: `Session insights failed with status ${response.status}.`,
        method: "GET",
        operation: `Agent session insights request failed for session ${sessionId}`,
        response,
        url: requestUrl,
      }),
      {
        source: "agent_session_insights",
        status: response.status,
      },
    );
  }

  const payload = (await response.json()) as unknown;
  return normalizeSessionInsightsSnapshot(payload) satisfies SessionInsightsSnapshot;
}
