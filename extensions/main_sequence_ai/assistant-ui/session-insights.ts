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

export interface SessionInsightsEditableBooleanField {
  editable: boolean;
  type: "boolean";
}

export interface SessionInsightsEditableNumberField {
  editable: boolean;
  type: "integer" | "number";
  min: number | null;
  max: number | null;
  step: number | null;
  unit: string | null;
}

export interface SessionInsightsEditableConfig {
  compaction: {
    enabled: SessionInsightsEditableBooleanField | null;
    reserveTokens: SessionInsightsEditableNumberField | null;
    thresholdPercent: SessionInsightsEditableNumberField | null;
    thresholdTokens: SessionInsightsEditableNumberField | null;
  } | null;
  model: {
    contextWindow: SessionInsightsEditableNumberField | null;
    maxOutputTokens: SessionInsightsEditableNumberField | null;
    model: SessionInsightsEditableNumberField | SessionInsightsEditableBooleanField | null;
    provider: SessionInsightsEditableNumberField | SessionInsightsEditableBooleanField | null;
    reasoningEffort: SessionInsightsEditableNumberField | SessionInsightsEditableBooleanField | null;
  } | null;
}

export interface SessionInsightsInfoSource {
  kind: "astro_doc" | "pi_doc";
  package: "astro" | "pi-coding-agent" | "pi-ai" | null;
  path: string | null;
  section: string | null;
}

export interface SessionInsightsInfoNode {
  label: string | null;
  description: string | null;
  source: SessionInsightsInfoSource[];
  children: Record<string, SessionInsightsInfoNode>;
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
  compactionThresholdPercent: number | null;
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
  config: {
    compaction: {
      enabled: boolean | null;
      reserveTokens: number | null;
      thresholdPercent: number | null;
      thresholdTokens: number | null;
    } | null;
    model: {
      contextWindow: number | null;
      model: string | null;
      provider: string | null;
      reasoningEffort: string | null;
    } | null;
  } | null;
  editable: {
    config: SessionInsightsEditableConfig | null;
  } | null;
  info: Record<string, SessionInsightsInfoNode>;
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

function normalizeEditableField(value: unknown) {
  const candidate = asRecord(value);

  if (Object.keys(candidate).length === 0) {
    return null;
  }

  const rawType = candidate.type;
  const type =
    rawType === "boolean" || rawType === "integer" || rawType === "number" ? rawType : null;

  if (!type) {
    return null;
  }

  if (type === "boolean") {
    return {
      editable: Boolean(candidate.editable),
      type,
    } satisfies SessionInsightsEditableBooleanField;
  }

  return {
    editable: Boolean(candidate.editable),
    type,
    min: normalizeNumber(candidate.min),
    max: normalizeNumber(candidate.max),
    step: normalizeNumber(candidate.step),
    unit: normalizeString(candidate.unit),
  } satisfies SessionInsightsEditableNumberField;
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
    compactionThresholdPercent: normalizeNumber(candidate.compactionThresholdPercent),
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

function normalizeConfig(value: unknown) {
  const candidate = asRecord(value);

  if (Object.keys(candidate).length === 0) {
    return null;
  }

  const compaction = asRecord(candidate.compaction);
  const model = asRecord(candidate.model);

  return {
    compaction:
      Object.keys(compaction).length > 0
        ? {
            enabled: normalizeBoolean(compaction.enabled),
            reserveTokens: normalizeNumber(compaction.reserveTokens),
            thresholdPercent: normalizeNumber(compaction.thresholdPercent),
            thresholdTokens: normalizeNumber(compaction.thresholdTokens),
          }
        : null,
    model:
      Object.keys(model).length > 0
        ? {
            contextWindow: normalizeNumber(model.contextWindow),
            maxOutputTokens: normalizeNumber(model.maxOutputTokens),
            model: normalizeString(model.model),
            provider: normalizeString(model.provider),
            reasoningEffort: normalizeString(model.reasoningEffort),
          }
        : null,
  };
}

function normalizeEditable(value: unknown) {
  const candidate = asRecord(value);

  if (Object.keys(candidate).length === 0) {
    return null;
  }

  const config = asRecord(candidate.config);
  const compaction = asRecord(config.compaction);
  const model = asRecord(config.model);

  return {
    config:
      Object.keys(config).length > 0
        ? {
            compaction:
              Object.keys(compaction).length > 0
                ? {
                    enabled: normalizeEditableField(compaction.enabled) as SessionInsightsEditableBooleanField | null,
                    reserveTokens: normalizeEditableField(compaction.reserveTokens) as SessionInsightsEditableNumberField | null,
                    thresholdPercent: normalizeEditableField(compaction.thresholdPercent) as SessionInsightsEditableNumberField | null,
                    thresholdTokens: normalizeEditableField(compaction.thresholdTokens) as SessionInsightsEditableNumberField | null,
                  }
                : null,
            model:
              Object.keys(model).length > 0
                ? {
                    contextWindow: normalizeEditableField(model.contextWindow) as SessionInsightsEditableNumberField | null,
                    maxOutputTokens: normalizeEditableField(model.maxOutputTokens) as SessionInsightsEditableNumberField | null,
                    model: normalizeEditableField(model.model),
                    provider: normalizeEditableField(model.provider),
                    reasoningEffort: normalizeEditableField(model.reasoningEffort),
                  }
                : null,
          }
        : null,
  };
}

function normalizeInfoSource(value: unknown): SessionInsightsInfoSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind;

  if (kind !== "astro_doc" && kind !== "pi_doc") {
    return null;
  }

  const packageName = candidate.package;

  return {
    kind,
    package:
      packageName === "astro" || packageName === "pi-coding-agent" || packageName === "pi-ai"
        ? packageName
        : null,
    path: normalizeString(candidate.path),
    section: normalizeString(candidate.section),
  };
}

function normalizeInfoNode(value: unknown): SessionInsightsInfoNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const childrenCandidate = asRecord(candidate.children);
  const childrenEntries = Object.entries(childrenCandidate)
    .map(([key, child]) => {
      const normalizedChild = normalizeInfoNode(child);
      return normalizedChild ? ([key, normalizedChild] as const) : null;
    })
    .filter((entry): entry is readonly [string, SessionInsightsInfoNode] => Boolean(entry));

  return {
    label: normalizeString(candidate.label),
    description: normalizeString(candidate.description),
    source: Array.isArray(candidate.source)
      ? candidate.source
          .map((entry) => normalizeInfoSource(entry))
          .filter((entry): entry is SessionInsightsInfoSource => Boolean(entry))
      : [],
    children: Object.fromEntries(childrenEntries),
  };
}

function normalizeInfoTree(value: unknown) {
  const candidate = asRecord(value);
  const entries = Object.entries(candidate)
    .map(([key, node]) => {
      const normalizedNode = normalizeInfoNode(node);
      return normalizedNode ? ([key, normalizedNode] as const) : null;
    })
    .filter((entry): entry is readonly [string, SessionInsightsInfoNode] => Boolean(entry));

  return Object.fromEntries(entries) as Record<string, SessionInsightsInfoNode>;
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
  const config = normalizeConfig(candidate.config);
  const editable = normalizeEditable(candidate.editable);
  const model = normalizeModel(candidate.model);
  const context = normalizeContext(candidate.context);

  return {
    config,
    editable,
    info: normalizeInfoTree(candidate.info),
    context:
      context || config?.compaction || config?.model
        ? {
            compactionEnabled: context?.compactionEnabled ?? config?.compaction?.enabled ?? null,
            compactionReserveTokens:
              context?.compactionReserveTokens ?? config?.compaction?.reserveTokens ?? null,
            compactionThresholdPercent:
              context?.compactionThresholdPercent ?? config?.compaction?.thresholdPercent ?? null,
            compactionThresholdTokens:
              context?.compactionThresholdTokens ?? config?.compaction?.thresholdTokens ?? null,
            contextWindow: context?.contextWindow ?? config?.model?.contextWindow ?? null,
            latestCompaction: context?.latestCompaction ?? null,
            percentOfContextWindow: context?.percentOfContextWindow ?? null,
            source: context?.source ?? null,
            status: context?.status ?? null,
            tokens: context?.tokens ?? null,
            tokensRemainingBeforeCompaction: context?.tokensRemainingBeforeCompaction ?? null,
            tokensRemainingBeforeContextLimit: context?.tokensRemainingBeforeContextLimit ?? null,
          }
        : null,
    lastTurn: normalizeLastTurn(candidate.lastTurn),
    model:
      model || config?.model
        ? {
            contextWindow: model?.contextWindow ?? config?.model?.contextWindow ?? null,
            maxOutputTokens: model?.maxOutputTokens ?? config?.model?.maxOutputTokens ?? null,
            model: model?.model ?? config?.model?.model ?? null,
            provider: model?.provider ?? config?.model?.provider ?? null,
            reasoningEffort: model?.reasoningEffort ?? config?.model?.reasoningEffort ?? null,
          }
        : null,
    session: normalizeSession(candidate.session),
    usage: normalizeUsage(candidate.usage),
    version:
      typeof candidate.version === "number" && Number.isFinite(candidate.version)
        ? candidate.version
        : 1,
  } satisfies SessionInsightsSnapshot;
}

export function getSessionInsightsInfoNode(
  snapshot: SessionInsightsSnapshot | null,
  path: readonly string[],
) {
  if (!snapshot || path.length === 0) {
    return null;
  }

  let current: SessionInsightsInfoNode | null = snapshot.info[path[0]] ?? null;

  for (let index = 1; index < path.length; index += 1) {
    if (!current) {
      return null;
    }

    current = current.children[path[index]] ?? null;
  }

  return current;
}
