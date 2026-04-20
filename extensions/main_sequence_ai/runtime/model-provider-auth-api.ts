import { fetchMainSequenceAiAssistantResponse } from "./assistant-endpoint";

export type ProviderAuthKind = "api_key" | "oauth";

export interface ProviderAuthStatus {
  provider: string;
  authKind: ProviderAuthKind;
  signInAvailable: boolean;
  authenticated: boolean;
  authSource: "runtime_store" | null;
  knownModelCount: number;
  usableModelCount: number;
  lastValidatedAt: string | null;
}

export type SignInAttemptStatus =
  | "pending"
  | "awaiting_browser"
  | "awaiting_manual_input"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SignInAttemptNextAction =
  | { type: "none" }
  | { type: "wait"; message: string }
  | { type: "open_url"; url: string; instructions?: string }
  | { type: "enter_callback_url"; prompt: string; instructions?: string };

export interface SignInAttempt {
  id: string;
  provider: string;
  status: SignInAttemptStatus;
  authUrl: string | null;
  authInstructions: string | null;
  nextAction: SignInAttemptNextAction;
  progress: { message: string; at: string }[];
  authKind: ProviderAuthKind;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

export type ProviderSignInStartResult =
  | {
      ok: true;
      statusCode: 200;
      provider: string;
      authenticated: boolean;
      updatedAt: string | null;
    }
  | {
      ok: true;
      statusCode: 202;
      provider: string;
      attempt: SignInAttempt;
    };

export class ModelProviderApiError extends Error {
  code: string | null;
  attempt: SignInAttempt | null;
  status: number | null;

  constructor(message: string, options?: { attempt?: SignInAttempt | null; code?: string | null; status?: number | null }) {
    super(message);
    this.name = "ModelProviderApiError";
    this.attempt = options?.attempt ?? null;
    this.code = options?.code ?? null;
    this.status = options?.status ?? null;
  }
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : null;
}

function normalizeAuthKind(value: unknown): ProviderAuthKind {
  return value === "oauth" ? "oauth" : "api_key";
}

function normalizeProgressEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const message = normalizeString(candidate.message);
      const at = normalizeString(candidate.at);

      if (!message || !at) {
        return null;
      }

      return { message, at };
    })
    .filter((entry): entry is { message: string; at: string } => Boolean(entry));
}

function normalizeNextAction(value: unknown): SignInAttemptNextAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { type: "none" };
  }

  const candidate = value as Record<string, unknown>;
  const type = normalizeString(candidate.type);

  if (type === "wait") {
    return {
      type,
      message: normalizeString(candidate.message) ?? "Waiting for provider authentication.",
    };
  }

  if (type === "open_url") {
    const url = normalizeString(candidate.url);

    if (!url) {
      return { type: "none" };
    }

    return {
      type,
      url,
      instructions: normalizeString(candidate.instructions) ?? undefined,
    };
  }

  if (type === "enter_callback_url") {
    return {
      type,
      prompt: normalizeString(candidate.prompt) ?? "Paste the callback URL or code.",
      instructions: normalizeString(candidate.instructions) ?? undefined,
    };
  }

  return { type: "none" };
}

function normalizeSignInAttempt(value: unknown): SignInAttempt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = normalizeString(candidate.id);
  const provider = normalizeString(candidate.provider);
  const status = normalizeString(candidate.status) as SignInAttemptStatus | null;

  if (!id || !provider || !status) {
    return null;
  }

  return {
    id,
    provider,
    status,
    authUrl: normalizeString(candidate.authUrl ?? candidate.auth_url),
    authInstructions: normalizeString(candidate.authInstructions ?? candidate.auth_instructions),
    nextAction: normalizeNextAction(candidate.nextAction ?? candidate.next_action),
    progress: normalizeProgressEntries(candidate.progress),
    authKind: normalizeAuthKind(candidate.authKind ?? candidate.auth_kind),
    createdAt: normalizeString(candidate.createdAt ?? candidate.created_at) ?? "",
    updatedAt: normalizeString(candidate.updatedAt ?? candidate.updated_at) ?? "",
    completedAt: normalizeString(candidate.completedAt ?? candidate.completed_at),
    error: normalizeString(candidate.error),
  };
}

function normalizeProviderAuthStatus(value: unknown): ProviderAuthStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const provider = normalizeString(candidate.provider);

  if (!provider) {
    return null;
  }

  return {
    provider,
    authKind: normalizeAuthKind(candidate.authKind ?? candidate.auth_kind),
    signInAvailable: normalizeBoolean(candidate.signInAvailable ?? candidate.sign_in_available),
    authenticated: normalizeBoolean(candidate.authenticated),
    authSource: (normalizeString(candidate.authSource ?? candidate.auth_source) as "runtime_store" | null) ?? null,
    knownModelCount: normalizeNumber(candidate.knownModelCount ?? candidate.known_model_count) ?? 0,
    usableModelCount: normalizeNumber(candidate.usableModelCount ?? candidate.usable_model_count) ?? 0,
    lastValidatedAt: normalizeString(candidate.lastValidatedAt ?? candidate.last_validated_at),
  };
}

function normalizeProviderAuthPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => normalizeProviderAuthStatus(entry))
      .filter((entry): entry is ProviderAuthStatus => Boolean(entry));
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidate = payload as Record<string, unknown>;

  for (const key of ["providers", "items", "results", "data"]) {
    if (Array.isArray(candidate[key])) {
      return (candidate[key] as unknown[])
        .map((entry) => normalizeProviderAuthStatus(entry))
        .filter((entry): entry is ProviderAuthStatus => Boolean(entry));
    }
  }

  const singleEntry = normalizeProviderAuthStatus(candidate);
  return singleEntry ? [singleEntry] : [];
}

async function parseJsonSafe(response: Response) {
  return (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
}

function extractErrorMessage(payload: Record<string, unknown> | null, fallback: string) {
  return (
    normalizeString(payload?.message) ??
    normalizeString(payload?.detail) ??
    normalizeString(payload?.error) ??
    fallback
  );
}

function extractErrorCode(payload: Record<string, unknown> | null) {
  return normalizeString(payload?.code) ?? normalizeString(payload?.error);
}

async function throwProviderApiError(response: Response, fallback: string): Promise<never> {
  const payload = await parseJsonSafe(response);
  const attempt = normalizeSignInAttempt(payload?.attempt);
  throw new ModelProviderApiError(extractErrorMessage(payload, fallback), {
    attempt,
    code: extractErrorCode(payload),
    status: response.status,
  });
}

export async function fetchModelProviderAuthStates({
  assistantEndpoint,
  signal,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    requestPath: "/api/model-providers",
    method: "GET",
    signal,
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    await throwProviderApiError(response, `Failed to load model providers (${response.status}).`);
  }

  return normalizeProviderAuthPayload((await response.json()) as unknown);
}

export async function startModelProviderSignIn({
  assistantEndpoint,
  provider,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  provider: string;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    requestPath: `/api/model-providers/${encodeURIComponent(provider)}/signin`,
    method: "POST",
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    await throwProviderApiError(
      response,
      `Failed to start sign-in for provider ${provider} (${response.status}).`,
    );
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const statusCode = normalizeNumber(payload?.statusCode ?? payload?.status_code) ?? response.status;
  const attempt = normalizeSignInAttempt(payload?.attempt);

  if (statusCode === 202 && attempt) {
    return {
      ok: true,
      statusCode: 202 as const,
      provider: normalizeString(payload?.provider) ?? provider,
      attempt,
    };
  }

  return {
    ok: true,
    statusCode: 200 as const,
    provider: normalizeString(payload?.provider) ?? provider,
    authenticated: normalizeBoolean(payload?.authenticated),
    updatedAt: normalizeString(payload?.updatedAt ?? payload?.updated_at),
  };
}

export async function fetchModelProviderSignInAttempt({
  assistantEndpoint,
  provider,
  attemptId,
  signal,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  provider: string;
  attemptId: string;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    requestPath: `/api/model-providers/${encodeURIComponent(provider)}/signin/${encodeURIComponent(attemptId)}`,
    method: "GET",
    signal,
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    await throwProviderApiError(
      response,
      `Failed to load sign-in attempt ${attemptId} for provider ${provider} (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;
  const attempt =
    normalizeSignInAttempt(payload) ||
    normalizeSignInAttempt((payload as Record<string, unknown> | null)?.attempt);

  if (!attempt) {
    throw new ModelProviderApiError(
      `The provider sign-in attempt response for ${provider} was invalid.`,
      { status: response.status },
    );
  }

  return attempt;
}

export async function submitModelProviderManualSignIn({
  assistantEndpoint,
  provider,
  attemptId,
  input,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  provider: string;
  attemptId: string;
  input: string;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    requestPath: `/api/model-providers/${encodeURIComponent(provider)}/signin/${encodeURIComponent(attemptId)}/manual`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    await throwProviderApiError(
      response,
      `Failed to submit manual sign-in input for provider ${provider} (${response.status}).`,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return normalizeSignInAttempt(payload) || normalizeSignInAttempt((payload as Record<string, unknown> | null)?.attempt);
}

export async function cancelModelProviderSignIn({
  assistantEndpoint,
  provider,
  attemptId,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  provider: string;
  attemptId: string;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    requestPath: `/api/model-providers/${encodeURIComponent(provider)}/signin/${encodeURIComponent(attemptId)}/cancel`,
    method: "POST",
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    await throwProviderApiError(
      response,
      `Failed to cancel sign-in attempt ${attemptId} for provider ${provider} (${response.status}).`,
    );
  }
}

export async function signOffModelProvider({
  assistantEndpoint,
  provider,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint: string;
  provider: string;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    requestPath: `/api/model-providers/${encodeURIComponent(provider)}/signoff`,
    method: "POST",
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    await throwProviderApiError(
      response,
      `Failed to sign off provider ${provider} (${response.status}).`,
    );
  }
}
