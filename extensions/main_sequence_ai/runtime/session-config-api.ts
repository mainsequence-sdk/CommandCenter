import {
  buildMainSequenceAiAssistantHeaders,
  buildMainSequenceAiAssistantUrl,
} from "./assistant-endpoint";

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

function buildSessionConfigUrl(assistantEndpoint: string) {
  return buildMainSequenceAiAssistantUrl(assistantEndpoint, "/api/chat/session-config");
}

export async function patchSessionConfig({
  assistantEndpoint,
  body,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  body: SessionConfigPatchRequest;
  token?: string | null;
  tokenType?: string;
}) {
  const response = await fetch(buildSessionConfigUrl(assistantEndpoint), {
    method: "PATCH",
    headers: (() => {
      const headers = buildMainSequenceAiAssistantHeaders({
        accept: "application/json",
        token,
        tokenType,
      });
      headers.set("Content-Type", "application/json");
      return headers;
    })(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { code?: string; detail?: string; error?: string; message?: string }
      | null;
    throw new SessionConfigApiError(
      payload?.message ||
        payload?.detail ||
        payload?.error ||
        `Session config update failed with status ${response.status}.`,
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
