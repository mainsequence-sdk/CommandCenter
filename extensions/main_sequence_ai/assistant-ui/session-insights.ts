export interface SessionInsightsSession {
  agentId: number | null;
  agentName: string | null;
  agentSessionId: string | null;
  lastError: string | null;
  sessionId: string | null;
  startedAt: string | null;
  status: "running" | "completed" | "error";
  threadId: string | null;
  updatedAt: string | null;
}

export interface SessionInsightsModel {
  contextWindow: number | null;
  maxOutputTokens: number | null;
  model: string | null;
  provider: string | null;
  reasoningEffort: string | null;
}

export interface SessionInsightsTokenTotals {
  cacheRead: number | null;
  cacheWrite: number | null;
  input: number | null;
  output: number | null;
  total: number | null;
}

export interface SessionInsightsUsage {
  assistantMessages: number | null;
  assistantTurns: number | null;
  estimatedCostUsd: number | null;
  tokens: SessionInsightsTokenTotals;
  toolCalls: number | null;
  toolResults: number | null;
  totalMessages: number | null;
  userMessages: number | null;
}

export interface SessionInsightsContext {
  compactionEnabled: boolean | null;
  compactionReserveTokens: number | null;
  compactionThresholdTokens: number | null;
  contextWindow: number | null;
  latestCompaction: string | null;
  percentOfContextWindow: number | null;
  source: string | null;
  status: string | null;
  tokens: number | null;
  tokensRemainingBeforeCompaction: number | null;
  tokensRemainingBeforeContextLimit: number | null;
}

export interface SessionInsightsLastTurn {
  completedAt: string | null;
  errorMessage: string | null;
  finishReason: string | null;
  model: {
    model: string | null;
    provider: string | null;
  };
  tokens: SessionInsightsTokenTotals;
}

export interface SessionInsightsSnapshot {
  context: SessionInsightsContext | null;
  lastTurn: SessionInsightsLastTurn | null;
  model: SessionInsightsModel | null;
  session: SessionInsightsSession;
  usage: SessionInsightsUsage | null;
  version: number;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : null;
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeTokenTotals(value: unknown): SessionInsightsTokenTotals {
  const candidate = asRecord(value);

  return {
    cacheRead: normalizeNumber(candidate.cacheRead),
    cacheWrite: normalizeNumber(candidate.cacheWrite),
    input: normalizeNumber(candidate.input),
    output: normalizeNumber(candidate.output),
    total: normalizeNumber(candidate.total),
  };
}

function normalizeSession(value: unknown): SessionInsightsSession {
  const candidate = asRecord(value);
  const rawStatus = candidate.status;

  return {
    agentId: normalizeNumber(candidate.agentId),
    agentName: normalizeString(candidate.agentName),
    agentSessionId: normalizeString(candidate.agentSessionId),
    lastError: normalizeString(candidate.lastError),
    sessionId: normalizeString(candidate.sessionId),
    startedAt: normalizeString(candidate.startedAt),
    status:
      rawStatus === "running" || rawStatus === "completed" || rawStatus === "error"
        ? rawStatus
        : "completed",
    threadId: normalizeString(candidate.threadId),
    updatedAt: normalizeString(candidate.updatedAt),
  };
}

function normalizeModel(value: unknown): SessionInsightsModel | null {
  const candidate = asRecord(value);

  if (Object.keys(candidate).length === 0) {
    return null;
  }

  return {
    contextWindow: normalizeNumber(candidate.contextWindow),
    maxOutputTokens: normalizeNumber(candidate.maxOutputTokens),
    model: normalizeString(candidate.model),
    provider: normalizeString(candidate.provider),
    reasoningEffort: normalizeString(candidate.reasoningEffort),
  };
}

function normalizeUsage(value: unknown): SessionInsightsUsage | null {
  const candidate = asRecord(value);

  if (Object.keys(candidate).length === 0) {
    return null;
  }

  return {
    assistantMessages: normalizeNumber(candidate.assistantMessages),
    assistantTurns: normalizeNumber(candidate.assistantTurns),
    estimatedCostUsd: normalizeNumber(candidate.estimatedCostUsd),
    tokens: normalizeTokenTotals(candidate.tokens),
    toolCalls: normalizeNumber(candidate.toolCalls),
    toolResults: normalizeNumber(candidate.toolResults),
    totalMessages: normalizeNumber(candidate.totalMessages),
    userMessages: normalizeNumber(candidate.userMessages),
  };
}

function normalizeContext(value: unknown): SessionInsightsContext | null {
  const candidate = asRecord(value);

  if (Object.keys(candidate).length === 0) {
    return null;
  }

  return {
    compactionEnabled: normalizeBoolean(candidate.compactionEnabled),
    compactionReserveTokens: normalizeNumber(candidate.compactionReserveTokens),
    compactionThresholdTokens: normalizeNumber(candidate.compactionThresholdTokens),
    contextWindow: normalizeNumber(candidate.contextWindow),
    latestCompaction: normalizeString(candidate.latestCompaction),
    percentOfContextWindow: normalizeNumber(candidate.percentOfContextWindow),
    source: normalizeString(candidate.source),
    status: normalizeString(candidate.status),
    tokens: normalizeNumber(candidate.tokens),
    tokensRemainingBeforeCompaction: normalizeNumber(candidate.tokensRemainingBeforeCompaction),
    tokensRemainingBeforeContextLimit: normalizeNumber(candidate.tokensRemainingBeforeContextLimit),
  };
}

function normalizeLastTurn(value: unknown): SessionInsightsLastTurn | null {
  const candidate = asRecord(value);

  if (Object.keys(candidate).length === 0) {
    return null;
  }

  const model = asRecord(candidate.model);

  return {
    completedAt: normalizeString(candidate.completedAt),
    errorMessage: normalizeString(candidate.errorMessage),
    finishReason: normalizeString(candidate.finishReason),
    model: {
      model: normalizeString(model.model),
      provider: normalizeString(model.provider),
    },
    tokens: normalizeTokenTotals(candidate.tokens),
  };
}

export function normalizeSessionInsightsSnapshot(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Session insights response is not an object.");
  }

  const candidate = payload as Record<string, unknown>;

  return {
    context: normalizeContext(candidate.context),
    lastTurn: normalizeLastTurn(candidate.lastTurn),
    model: normalizeModel(candidate.model),
    session: normalizeSession(candidate.session),
    usage: normalizeUsage(candidate.usage),
    version:
      typeof candidate.version === "number" && Number.isFinite(candidate.version)
        ? candidate.version
        : 1,
  } satisfies SessionInsightsSnapshot;
}
