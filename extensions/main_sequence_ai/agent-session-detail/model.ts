import type { SessionInsightsSnapshot } from "../assistant-ui/session-insights";
import type { SessionToolDefinition, SessionToolsSnapshot } from "../assistant-ui/session-tools";
import type { AgentSessionApiRecord } from "../runtime/agent-sessions-api";

export type AgentSessionDetailStatus = "idle" | "loading" | "ready" | "not_found" | "error";

const DEFAULT_AGENT_REQUEST_NAME = "astro-orchestrator";

export interface AgentSessionContextInput {
  id: string;
  updatedAt?: string | null;
  preview?: string | null;
  handleUniqueId?: string | null;
  runtimeSessionId?: string | null;
  sessionKey?: string | null;
  threadId?: string | null;
  projectId?: string | null;
  cwd?: string | null;
  runtimeState?: string | null;
  working?: boolean;
  origin?: string | null;
  agent?: {
    id?: number | null;
    name?: string | null;
    requestName?: string | null;
    agentUniqueId?: string | null;
  } | null;
}

export interface AgentSessionBoundHandleDetail {
  id: string;
  handleUniqueId: string;
  ownerUserId: string | null;
  isLocked: boolean;
}

export interface AgentSessionCoreDetail {
  sessionId: string;
  agentId: string | null;
  agentName: string | null;
  actorName: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  lastActivityAt: string | null;
  llmProvider: string | null;
  llmModel: string | null;
  engineName: string | null;
  runtimeState: string | null;
  working: boolean;
  runtimeConfigOverride: Record<string, unknown> | null;
  runtimeConfigSnapshot: Record<string, unknown> | null;
  inputPayload: Record<string, unknown> | null;
  outputPayload: Record<string, unknown> | null;
  errorDetail: string | null;
  externalStepId: string | null;
  metadata: Record<string, unknown> | null;
  parentStepId: string | null;
  sequence: number | null;
  stepType: string | null;
  actorType: string | null;
  createdByUserId: string | null;
  boundHandles: AgentSessionBoundHandleDetail[];
}

export interface AgentSessionDetailContext {
  sessionId: string;
  sessionDisplayId: string | null;
  requestName: string;
  displayName: string | null;
  agentUniqueId: string | null;
  handleUniqueId: string | null;
  isDefaultCommandCenterSession: boolean;
  agentId: string | null;
  updatedAt: string | null;
  preview: string | null;
  projectId: string | null;
  cwd: string | null;
  runtimeState: string | null;
  working: boolean;
  threadId: string | null;
  runtimeSessionId: string | null;
  sessionKey: string | null;
}

export interface AgentSessionDetailSnapshot {
  sessionId: string;
  status: AgentSessionDetailStatus;
  detailError: string | null;
  context: AgentSessionDetailContext;
  core: AgentSessionCoreDetail | null;
  insights: SessionInsightsSnapshot | null;
  isLoadingInsights: boolean;
  insightsError: string | null;
  toolsSnapshot: SessionToolsSnapshot | null;
  availableTools: SessionToolDefinition[];
  isLoadingTools: boolean;
  toolsError: string | null;
}

export interface ActiveSessionSummary {
  requestName: string;
  displayName: string | null;
  agentUniqueId: string | null;
  handleUniqueId: string | null;
  isDefaultCommandCenterSession: boolean;
  sessionDisplayId: string | null;
  sessionId: string | null;
  agentId: string | null;
  updatedAt: string | null;
  preview: string | null;
  projectId: string | null;
  cwd: string | null;
  runtimeState: string | null;
  working: boolean;
  threadId: string | null;
  runtimeSessionId: string | null;
  sessionKey: string | null;
  sessionDetailStatus: AgentSessionDetailStatus;
  sessionDetailError: string | null;
  sessionDetail: AgentSessionDetailSnapshot | null;
  sessionInsights: SessionInsightsSnapshot | null;
  isLoadingInsights: boolean;
  insightsError: string | null;
  availableTools: SessionToolDefinition[];
  isLoadingTools: boolean;
  toolsError: string | null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeOptionalRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveAgentSessionRequestName(session: AgentSessionContextInput | null) {
  return normalizeOptionalString(session?.agent?.requestName) ?? DEFAULT_AGENT_REQUEST_NAME;
}

export function resolveAgentSessionLabel(session: AgentSessionContextInput | null) {
  return (
    normalizeOptionalString(session?.agent?.agentUniqueId) ??
    normalizeOptionalString(session?.agent?.name) ??
    DEFAULT_AGENT_REQUEST_NAME
  );
}

export function resolveAgentSessionDisplayId(session: AgentSessionContextInput | null) {
  if (!session) {
    return null;
  }

  if (typeof session.runtimeSessionId === "string" && session.runtimeSessionId.trim()) {
    return session.runtimeSessionId.trim();
  }

  return /^\d+$/.test(session.id) ? session.id : null;
}

export function resolveAgentSessionLookupId(session: AgentSessionContextInput | null) {
  if (!session) {
    return null;
  }

  if (/^\d+$/.test(session.id)) {
    return session.id;
  }

  if (typeof session.runtimeSessionId === "string" && session.runtimeSessionId.trim()) {
    return session.runtimeSessionId.trim();
  }

  return null;
}

export function buildAgentSessionDetailContext(
  session: AgentSessionContextInput,
  fallbackAgentId?: string | null,
): AgentSessionDetailContext {
  const derivedAgentId =
    fallbackAgentId ??
    (session.agent?.id !== null && session.agent?.id !== undefined
      ? String(session.agent.id)
      : null);

  return {
    sessionId: session.id,
    sessionDisplayId: resolveAgentSessionDisplayId(session),
    requestName: resolveAgentSessionRequestName(session),
    displayName: normalizeOptionalString(session.agent?.name),
    agentUniqueId: normalizeOptionalString(session.agent?.agentUniqueId),
    handleUniqueId: normalizeOptionalString(session.handleUniqueId),
    isDefaultCommandCenterSession: normalizeOptionalString(session.origin) === "astro_command_center_base",
    agentId: derivedAgentId,
    updatedAt: normalizeOptionalString(session.updatedAt),
    preview: normalizeOptionalString(session.preview),
    projectId: normalizeOptionalString(session.projectId),
    cwd: normalizeOptionalString(session.cwd),
    runtimeState: normalizeOptionalString(session.runtimeState),
    working: session.working === true,
    threadId: normalizeOptionalString(session.threadId),
    runtimeSessionId: normalizeOptionalString(session.runtimeSessionId),
    sessionKey: normalizeOptionalString(session.sessionKey),
  };
}

export function normalizeAgentSessionCoreDetail(record: AgentSessionApiRecord): AgentSessionCoreDetail {
  const sessionId = String(record.agent_session || record.id);

  return {
    sessionId,
    agentId:
      record.agent !== null && record.agent !== undefined ? String(record.agent) : null,
    agentName: normalizeOptionalString(record.agent_name),
    actorName: normalizeOptionalString(record.actor_name),
    title: normalizeOptionalString(record.title),
    summary: normalizeOptionalString(record.summary),
    status: normalizeOptionalString(record.status),
    startedAt: normalizeOptionalString(record.started_at),
    endedAt: normalizeOptionalString(record.ended_at),
    lastActivityAt:
      normalizeOptionalString(record.ended_at) ??
      normalizeOptionalString(record.started_at),
    llmProvider: normalizeOptionalString(record.llm_provider),
    llmModel: normalizeOptionalString(record.llm_model),
    engineName: normalizeOptionalString(record.engine_name),
    runtimeState: normalizeOptionalString(record.runtime_state),
    working: record.working === true,
    runtimeConfigOverride: normalizeOptionalRecord(record.runtime_config_override),
    runtimeConfigSnapshot: normalizeOptionalRecord(record.runtime_config_snapshot),
    inputPayload: normalizeOptionalRecord(record.input_payload),
    outputPayload: normalizeOptionalRecord(record.output_payload),
    errorDetail: normalizeOptionalString(record.error_detail),
    externalStepId: normalizeOptionalString(record.external_step_id),
    metadata: normalizeOptionalRecord(record.metadata),
    parentStepId:
      record.parent_step !== null && record.parent_step !== undefined
        ? String(record.parent_step)
        : null,
    sequence: normalizeOptionalNumber(record.sequence),
    stepType: normalizeOptionalString(record.step_type),
    actorType: normalizeOptionalString(record.actor_type),
    createdByUserId:
      record.created_by_user !== null && record.created_by_user !== undefined
        ? String(record.created_by_user)
        : null,
    boundHandles: Array.isArray(record.bound_handles)
      ? record.bound_handles.flatMap((handle) => {
          const handleUniqueId = normalizeOptionalString(handle.handle_unique_id);

          if (!handleUniqueId) {
            return [];
          }

          return [{
            id: String(handle.id),
            handleUniqueId,
            ownerUserId:
              handle.owner_user !== null && handle.owner_user !== undefined
                ? String(handle.owner_user)
                : null,
            isLocked: handle.is_locked === true,
          }];
        })
      : [],
  };
}

export function buildAgentSessionDetailSnapshot({
  session,
  detailError,
  detailStatus,
  core,
  fallbackAgentId,
  insights,
  insightsError,
  isLoadingInsights,
  isLoadingTools,
  toolsError,
  toolsSnapshot,
}: {
  session: AgentSessionContextInput;
  detailStatus: AgentSessionDetailStatus;
  detailError: string | null;
  core: AgentSessionCoreDetail | null;
  insights: SessionInsightsSnapshot | null;
  isLoadingInsights: boolean;
  insightsError: string | null;
  toolsSnapshot: SessionToolsSnapshot | null;
  isLoadingTools: boolean;
  toolsError: string | null;
  fallbackAgentId?: string | null;
}): AgentSessionDetailSnapshot {
  return {
    sessionId: session.id,
    status: detailStatus,
    detailError,
    context: buildAgentSessionDetailContext(session, fallbackAgentId),
    core,
    insights,
    isLoadingInsights,
    insightsError,
    toolsSnapshot,
    availableTools: toolsSnapshot?.availableTools ?? [],
    isLoadingTools,
    toolsError,
  };
}

export function buildActiveSessionSummary({
  session,
  detail,
  fallbackAgentId,
}: {
  session: AgentSessionContextInput;
  detail: AgentSessionDetailSnapshot | null;
  fallbackAgentId?: string | null;
}): ActiveSessionSummary {
  const context = detail?.context ?? buildAgentSessionDetailContext(session, fallbackAgentId);

  return {
    requestName: context.requestName,
    displayName: context.displayName,
    agentUniqueId: context.agentUniqueId,
    handleUniqueId: context.handleUniqueId,
    isDefaultCommandCenterSession: context.isDefaultCommandCenterSession,
    sessionDisplayId: context.sessionDisplayId,
    sessionId: context.sessionId,
    agentId: context.agentId,
    updatedAt: context.updatedAt,
    preview: context.preview,
    projectId: context.projectId,
    cwd: context.cwd,
    runtimeState: context.runtimeState,
    working: context.working,
    threadId: context.threadId,
    runtimeSessionId: context.runtimeSessionId,
    sessionKey: context.sessionKey,
    sessionDetailStatus: detail?.status ?? "idle",
    sessionDetailError: detail?.detailError ?? null,
    sessionDetail: detail,
    sessionInsights: detail?.insights ?? null,
    isLoadingInsights: detail?.isLoadingInsights ?? false,
    insightsError: detail?.insightsError ?? null,
    availableTools: detail?.availableTools ?? [],
    isLoadingTools: detail?.isLoadingTools ?? false,
    toolsError: detail?.toolsError ?? null,
  };
}
