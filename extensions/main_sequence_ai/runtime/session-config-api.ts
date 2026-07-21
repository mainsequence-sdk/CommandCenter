import { fetchMainSequenceAiAssistantResponse } from "./assistant-endpoint";
import { buildRuntimeHttpErrorMessage } from "./http-error";

export interface SessionConfigPatchRequest {
  sessionId: string;
  config: {
    compaction?: {
      enabled?: boolean;
      reserveTokens?: number;
    };
  };
}

export interface SessionConfigPatchResponse {
  ok: true;
  sessionId: string;
  updatedAt: string | null;
  updatedFields: string[];
}

export class SessionConfigApiError extends Error {
  code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "SessionConfigApiError";
    this.code = code;
  }
}

export async function patchSessionConfig({
  assistantEndpoint,
  body,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint?: string;
  body: SessionConfigPatchRequest;
  token?: string | null;
  tokenType?: string;
}) {
  const { response, url } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    currentSessionId: body.sessionId,
    requestPath: "/api/chat/session-config",
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    const payload = (await response.clone().json().catch(() => null)) as
      | { code?: string; detail?: string; error?: string; message?: string }
      | null;
    throw new SessionConfigApiError(
      await buildRuntimeHttpErrorMessage({
        fallbackMessage: `Session config update failed with status ${response.status}.`,
        method: "PATCH",
        operation: "Agent session config update request failed",
        response,
        url,
      }),
      payload?.code ?? null,
    );
  }

  const payload = (await response.json()) as
    | { ok?: true; sessionId?: string; updatedAt?: string | null; updatedFields?: unknown }
    | null;

  return {
    ok: true,
    sessionId: typeof payload?.sessionId === "string" ? payload.sessionId : body.sessionId,
    updatedAt: typeof payload?.updatedAt === "string" ? payload.updatedAt : null,
    updatedFields: Array.isArray(payload?.updatedFields)
      ? payload.updatedFields.filter((entry): entry is string => typeof entry === "string")
      : [],
  } satisfies SessionConfigPatchResponse;
}
