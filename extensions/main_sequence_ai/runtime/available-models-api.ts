import {
  fetchMainSequenceAiAssistantResponse,
  type MainSequenceAiResolvedAssistantAccess,
  type MainSequenceAiAssistantRuntimeTarget,
} from "./assistant-endpoint";
import { MainSequenceAiError } from "./error-source";
import {
  appendCreatedByUserUidSearchParam,
  requireCreatedByUserUid,
} from "./user-scope";

export interface AvailableChatModelOption {
  auth:
    | {
        authKind: string | null;
        authenticated: boolean;
        configuredFromEnv: boolean;
        required: boolean;
        signInAvailable: boolean;
        usable: boolean;
      }
    | null;
  id: string;
  label: string;
  defaultReasoningEffort: string | null;
  value: string;
  provider: string | null;
  reasoningEfforts: AvailableChatReasoningEffortOption[];
  source: string;
}

export interface AvailableChatReasoningEffortOption {
  label: string;
  value: string;
}

export interface AvailableChatProviderOption {
  label: string;
  value: string;
}

export interface AvailableChatRunConfigOptions {
  providers: AvailableChatProviderOption[];
  models: AvailableChatModelOption[];
  reasoningEfforts: AvailableChatReasoningEffortOption[];
}

const AVAILABLE_RUN_CONFIG_CACHE_TTL_MS = 900_000;

interface AvailableRunConfigCacheEntry {
  expiresAt: number;
  value: AvailableChatRunConfigOptions | null;
}

export interface AvailableRunConfigCacheSnapshot {
  expiresAt: number;
  fresh: boolean;
  value: AvailableChatRunConfigOptions;
}

const availableRunConfigOptionsCache = new Map<string, AvailableRunConfigCacheEntry>();

function normalizeCacheKey(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildAvailableRunConfigCacheKey({
  agentType,
  userId,
}: {
  agentType?: string | null;
  userId?: string | number | null;
}) {
  const normalizedUserId =
    userId === null || userId === undefined ? "anonymous" : String(userId).trim() || "anonymous";
  const normalizedAgentType = normalizeCacheKey(agentType) ?? "global";

  return [normalizedUserId, normalizedAgentType].join("::");
}

function getAvailableRunConfigCacheEntry(cacheKey: string | null) {
  if (!cacheKey) {
    return null;
  }

  const entry = availableRunConfigOptionsCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (entry.value && entry.expiresAt > Date.now()) {
    return entry;
  }

  return null;
}

export function peekAvailableRunConfigOptionsCache(cacheKey: string | null | undefined) {
  const normalizedCacheKey = normalizeCacheKey(cacheKey);
  const entry = getAvailableRunConfigCacheEntry(normalizedCacheKey);
  return entry?.value ?? null;
}

export function peekAvailableRunConfigOptionsCacheSnapshot(
  cacheKey: string | null | undefined,
): AvailableRunConfigCacheSnapshot | null {
  const normalizedCacheKey = normalizeCacheKey(cacheKey);

  if (!normalizedCacheKey) {
    return null;
  }

  const entry = availableRunConfigOptionsCache.get(normalizedCacheKey);

  if (!entry?.value) {
    return null;
  }

  return {
    expiresAt: entry.expiresAt,
    fresh: entry.expiresAt > Date.now(),
    value: entry.value,
  };
}

export function clearAvailableRunConfigOptionsCache(cacheKey?: string | null) {
  const normalizedCacheKey = normalizeCacheKey(cacheKey);

  if (!normalizedCacheKey) {
    availableRunConfigOptionsCache.clear();
    return;
  }

  availableRunConfigOptionsCache.delete(normalizedCacheKey);
}

function formatModelLabel(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  if (trimmed.startsWith("gpt-")) {
    return `GPT-${trimmed.slice(4)}`;
  }

  return trimmed;
}

function extractModelOption(value: unknown): AvailableChatModelOption | null {
  return extractModelOptionFromCandidate(value, null);
}

function extractModelOptionFromCandidate(
  value: unknown,
  providerFallback: string | null,
): AvailableChatModelOption | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const rawSource =
    candidate.source ??
    candidate.model_source ??
    candidate.modelSource;
  const rawValue =
    candidate.value ??
    candidate.model ??
    candidate.id ??
    candidate.slug ??
    candidate.name ??
    candidate.label;

  if (
    typeof rawSource !== "string" ||
    !rawSource.trim() ||
    typeof rawValue !== "string" ||
    !rawValue.trim()
  ) {
    return null;
  }

  const normalizedSource = rawSource.trim();
  const normalizedValue = rawValue.trim();
  const rawLabel =
    candidate.label ??
    candidate.display_name ??
    candidate.displayName ??
    candidate.name ??
    candidate.model;
  const rawProvider = candidate.provider;
  const rawAuth = candidate.auth;
  const defaultsCandidate =
    candidate.defaults && typeof candidate.defaults === "object" && !Array.isArray(candidate.defaults)
      ? (candidate.defaults as Record<string, unknown>)
      : null;
  const defaultRunConfig =
    defaultsCandidate?.runConfig &&
    typeof defaultsCandidate.runConfig === "object" &&
    !Array.isArray(defaultsCandidate.runConfig)
      ? (defaultsCandidate.runConfig as Record<string, unknown>)
      : null;
  const capabilitiesCandidate =
    candidate.capabilities &&
    typeof candidate.capabilities === "object" &&
    !Array.isArray(candidate.capabilities)
      ? (candidate.capabilities as Record<string, unknown>)
      : null;
  const capabilityRunConfig =
    capabilitiesCandidate?.runConfig &&
    typeof capabilitiesCandidate.runConfig === "object" &&
    !Array.isArray(capabilitiesCandidate.runConfig)
      ? (capabilitiesCandidate.runConfig as Record<string, unknown>)
      : null;
  const reasoningCapability =
    capabilityRunConfig?.reasoning_effort &&
    typeof capabilityRunConfig.reasoning_effort === "object" &&
    !Array.isArray(capabilityRunConfig.reasoning_effort)
      ? (capabilityRunConfig.reasoning_effort as Record<string, unknown>)
      : null;
  const capabilityReasoningEntries =
    extractReasoningEffortArray(reasoningCapability) ??
    extractReasoningEffortArray(candidate);
  const capabilityDefaultReasoningEffort =
    typeof reasoningCapability?.default === "string" && reasoningCapability.default.trim()
      ? reasoningCapability.default.trim()
      : null;
  const normalizedAuth =
    rawAuth && typeof rawAuth === "object" && !Array.isArray(rawAuth)
      ? {
          ...(function () {
            const authRecord = rawAuth as Record<string, unknown>;
            const rawAuthKind = authRecord.authKind ?? authRecord.auth_kind;

            return {
          authKind:
                typeof rawAuthKind === "string" && rawAuthKind.trim()
                ? rawAuthKind.trim()
                : null,
              authenticated: Boolean(authRecord.authenticated),
          configuredFromEnv: Boolean(
                authRecord.configuredFromEnv ?? authRecord.configured_from_env,
          ),
              required: Boolean(authRecord.required),
          signInAvailable: Boolean(
                authRecord.signInAvailable ?? authRecord.sign_in_available,
          ),
              usable: Boolean(authRecord.usable),
            };
          })(),
        }
      : null;
  const normalizedProvider =
    typeof rawProvider === "string" && rawProvider.trim()
      ? rawProvider.trim()
      : providerFallback;
  const modelIdentity = [normalizedProvider ?? "", normalizedSource, normalizedValue].join("::");

  return {
    auth: normalizedAuth,
    id: modelIdentity,
    defaultReasoningEffort:
      typeof defaultRunConfig?.reasoning_effort === "string" && defaultRunConfig.reasoning_effort.trim()
        ? defaultRunConfig.reasoning_effort.trim()
        : capabilityDefaultReasoningEffort,
    label:
      typeof rawLabel === "string" && rawLabel.trim()
        ? rawLabel.trim()
        : formatModelLabel(normalizedValue),
    provider: normalizedProvider,
    reasoningEfforts: dedupeOptions(
      (capabilityReasoningEntries ?? [])
        .map((entry) => extractReasoningEffortOption(entry))
        .filter((entry): entry is AvailableChatReasoningEffortOption => Boolean(entry)),
    ),
    source: normalizedSource,
    value: normalizedValue,
  };
}

function extractModelArray(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  for (const key of [
    "models",
    "available_models",
    "availableModels",
    "items",
    "results",
    "data",
  ]) {
    if (Array.isArray(candidate[key])) {
      return candidate[key] as unknown[];
    }
  }

  return null;
}

function extractGroupedProviderEntries(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  if (!Array.isArray(candidate.providers)) {
    return null;
  }

  const groupedProviders: Array<{
    provider: string;
    models: unknown[];
  }> = [];

  for (const entry of candidate.providers as unknown[]) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const providerCandidate = entry as Record<string, unknown>;
    const provider =
      typeof providerCandidate.provider === "string" && providerCandidate.provider.trim()
        ? providerCandidate.provider.trim()
        : null;
    const models = Array.isArray(providerCandidate.models) ? providerCandidate.models : null;

    if (!provider || !models) {
      continue;
    }

    groupedProviders.push({ provider, models });
  }

  return groupedProviders;
}

function formatReasoningEffortLabel(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function extractReasoningEffortOption(
  value: unknown,
): AvailableChatReasoningEffortOption | null {
  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    return {
      label: formatReasoningEffortLabel(normalized),
      value: normalized,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const rawValue =
    candidate.value ??
    candidate.reasoning_effort ??
    candidate.reasoningEffort ??
    candidate.id ??
    candidate.name ??
    candidate.label;

  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null;
  }

  const normalizedValue = rawValue.trim();
  const rawLabel =
    candidate.label ??
    candidate.display_name ??
    candidate.displayName ??
    candidate.name ??
    candidate.reasoning_effort ??
    candidate.reasoningEffort;

  return {
    label:
      typeof rawLabel === "string" && rawLabel.trim()
        ? rawLabel.trim()
        : formatReasoningEffortLabel(normalizedValue),
    value: normalizedValue,
  };
}

function extractReasoningEffortArray(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  for (const key of [
    "values",
    "reasoning_efforts",
    "reasoningEfforts",
    "reasoning_effort_options",
    "reasoningEffortOptions",
    "efforts",
  ]) {
    if (Array.isArray(candidate[key])) {
      return candidate[key] as unknown[];
    }
  }

  const runConfig = candidate.runConfig;
  if (runConfig && typeof runConfig === "object" && !Array.isArray(runConfig)) {
    const custom = (runConfig as Record<string, unknown>).custom;

    if (custom && typeof custom === "object" && !Array.isArray(custom)) {
      const reasoningEffort =
        (custom as Record<string, unknown>).reasoning_effort ??
        (custom as Record<string, unknown>).reasoningEffort;

      if (typeof reasoningEffort === "string" && reasoningEffort.trim()) {
        return [reasoningEffort.trim()];
      }
    }
  }

  return null;
}

function dedupeOptions<T extends { value: string }>(entries: readonly T[]) {
  const deduped = new Map<string, T>();

  for (const entry of entries) {
    if (!deduped.has(entry.value)) {
      deduped.set(entry.value, entry);
    }
  }

  return [...deduped.values()];
}

export function normalizeAvailableRunConfigOptions(
  payload: unknown,
): AvailableChatRunConfigOptions {
  const groupedProviders = extractGroupedProviderEntries(payload);
  const flatModelEntries = extractModelArray(payload) ?? [];
  const reasoningEffortEntries = extractReasoningEffortArray(payload) ?? [];
  const models = groupedProviders
    ? dedupeByKey(
        groupedProviders
          .flatMap((providerEntry) =>
            providerEntry.models.map((entry) =>
              extractModelOptionFromCandidate(entry, providerEntry.provider),
            ),
          )
          .filter((entry): entry is AvailableChatModelOption => Boolean(entry)),
        (entry) => entry.id,
      )
    : dedupeByKey(
        flatModelEntries
          .map((entry) => extractModelOption(entry))
          .filter((entry): entry is AvailableChatModelOption => Boolean(entry)),
        (entry) => entry.id,
      );

  const providers = groupedProviders
    ? groupedProviders.map((entry) => ({
        label: entry.provider,
        value: entry.provider,
      }))
    : dedupeOptions(
        models
          .map((entry) =>
            entry.provider
              ? {
                  label: entry.provider,
                  value: entry.provider,
                }
              : null,
          )
          .filter((entry): entry is AvailableChatProviderOption => Boolean(entry)),
      );

  return {
    providers,
    models,
    reasoningEfforts: dedupeOptions(
      reasoningEffortEntries
        .map((entry) => extractReasoningEffortOption(entry))
        .filter((entry): entry is AvailableChatReasoningEffortOption => Boolean(entry)),
    ),
  };
}

function dedupeByKey<T>(entries: readonly T[], getKey: (entry: T) => string) {
  const deduped = new Map<string, T>();

  for (const entry of entries) {
    const key = getKey(entry);

    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  return [...deduped.values()];
}

export async function fetchAvailableRunConfigOptions({
  assistantEndpoint,
  cacheKey,
  cacheTtlMs = AVAILABLE_RUN_CONFIG_CACHE_TTL_MS,
  createdByUserUid,
  runtimeTarget,
  sessionId,
  signal,
  token,
  tokenType = "Bearer",
  onResolvedAccess,
}: {
  assistantEndpoint?: string;
  cacheKey?: string | null;
  cacheTtlMs?: number;
  createdByUserUid?: string | null;
  onResolvedAccess?: ((access: MainSequenceAiResolvedAssistantAccess) => void) | null;
  runtimeTarget?: MainSequenceAiAssistantRuntimeTarget;
  sessionId?: string | null;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  const normalizedCacheKey = normalizeCacheKey(cacheKey);
  const cachedEntry = getAvailableRunConfigCacheEntry(normalizedCacheKey);

  if (cachedEntry?.value) {
    return cachedEntry.value;
  }

  const resolvedCreatedByUserUid = requireCreatedByUserUid(
    createdByUserUid,
    "Available model catalog",
  );
  const { resolvedAccess, response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    ...(sessionId
      ? { currentSessionId: sessionId }
      : { runtimeTarget: runtimeTarget ?? ("configured" as const) }),
    requestPath: appendCreatedByUserUidSearchParam(
      "/api/chat/get_available_models",
      resolvedCreatedByUserUid,
    ),
    method: "GET",
    signal,
    sessionToken: token,
    sessionTokenType: tokenType,
    sessionUserUid: resolvedCreatedByUserUid,
  });
  onResolvedAccess?.(resolvedAccess);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new MainSequenceAiError(
      payload?.message ||
        payload?.error ||
        `Available models failed with status ${response.status}.`,
      {
        source: "assistant_available_models",
        status: response.status,
      },
    );
  }

  const payload = (await response.json()) as unknown;
  const options = normalizeAvailableRunConfigOptions(payload);

  if (normalizedCacheKey) {
    availableRunConfigOptionsCache.set(normalizedCacheKey, {
      expiresAt: Date.now() + cacheTtlMs,
      value: options,
    });
  }

  return options;
}
