import type { SessionInsightsSnapshot } from "../assistant-ui/session-insights";
import type { AgentImageDriftRecord } from "../agent-search";
import type {
  AgentSessionApiRecord,
  AgentSessionSerializedRecord,
} from "../runtime/agent-sessions-api";
import {
  getAgentSessionRecordAgentLookupId,
  getAgentSessionRecordAgentId,
  getAgentSessionRecordHandleUniqueId,
  getAgentSessionRecordSessionId,
  getAgentSessionRecordTitle,
  normalizeAgentSessionLookupId,
} from "../runtime/agent-sessions-api";

export type AgentSessionDetailStatus = "idle" | "loading" | "ready" | "not_found" | "error";

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
  serializedSession?: AgentSessionSerializedRecord | null;
  agent?: {
    id?: number | string | null;
    displayLabel?: string | null;
    requestAgentType?: string | null;
    agentUniqueId?: string | null;
    llmProvider?: string | null;
    llmModel?: string | null;
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
  agentType: string | null;
  actorName: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  lastActivityAt: string | null;
  llmProvider: string | null;
  llmModel: string | null;
  llmThinking: string | null;
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
  boundHandle: AgentSessionBoundHandleDetail | null;
}

export interface AgentSessionDetailContext {
  sessionId: string;
  sessionDisplayId: string | null;
  requestAgentType: string;
  displayLabel: string | null;
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
  serializedRecord: AgentSessionSerializedRecord | null;
  insights: SessionInsightsSnapshot | null;
  isLoadingInsights: boolean;
  insightsError: string | null;
}

export interface ActiveSessionSummary {
  requestAgentType: string;
  displayLabel: string | null;
  agentUniqueId: string | null;
  imageDrift: AgentImageDriftRecord | null;
  llmProvider: string | null;
  llmModel: string | null;
  llmThinking: string | null;
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

function normalizeThinkingValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveAgentSessionRequestAgentType(session: AgentSessionContextInput | null) {
  return normalizeOptionalString(session?.agent?.requestAgentType) ?? "";
}

export function resolveAgentSessionLabel(session: AgentSessionContextInput | null) {
  return (
    normalizeOptionalString(session?.agent?.agentUniqueId) ??
    normalizeOptionalString(session?.agent?.displayLabel) ??
    ""
  );
}

export function resolveAgentSessionDisplayId(session: AgentSessionContextInput | null) {
  if (!session) {
    return null;
  }

  const runtimeSessionId = normalizeAgentSessionLookupId(session.runtimeSessionId);

  if (runtimeSessionId) {
    return runtimeSessionId;
  }

  const sessionId = normalizeAgentSessionLookupId(session.id);
  return sessionId;
}

export function resolveAgentSessionLookupId(session: AgentSessionContextInput | null) {
  if (!session) {
    return null;
  }

  const runtimeSessionId = normalizeAgentSessionLookupId(session.runtimeSessionId);

  if (runtimeSessionId) {
    return runtimeSessionId;
  }

  const sessionId = normalizeAgentSessionLookupId(session.id);
  return sessionId;
}

export function buildAgentSessionDetailContext(
  session: AgentSessionContextInput,
  fallbackAgentId?: string | null,
  fallbackHandleUniqueId?: string | null,
): AgentSessionDetailContext {
  const derivedAgentId =
    fallbackAgentId ??
    (session.agent?.id !== null && session.agent?.id !== undefined
      ? String(session.agent.id)
      : null);

  return {
    sessionId: session.id,
    sessionDisplayId: resolveAgentSessionDisplayId(session),
    requestAgentType: resolveAgentSessionRequestAgentType(session),
    displayLabel: normalizeOptionalString(session.agent?.displayLabel),
    agentUniqueId: normalizeOptionalString(session.agent?.agentUniqueId),
    handleUniqueId:
      normalizeOptionalString(session.handleUniqueId) ??
      normalizeOptionalString(fallbackHandleUniqueId),
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
  const sessionId = getAgentSessionRecordSessionId(record);
  const agentLookupId = getAgentSessionRecordAgentLookupId(record);
  const agentId = getAgentSessionRecordAgentId(record);
  const boundHandleUniqueId = getAgentSessionRecordHandleUniqueId(record);
  const boundHandle =
    boundHandleUniqueId
      ? {
          id:
            normalizeOptionalString(record.bound_handle?.uid) ??
            normalizeOptionalString(record.bound_handles?.[0]?.uid) ??
            (record.bound_handles?.[0]?.id !== null && record.bound_handles?.[0]?.id !== undefined
              ? String(record.bound_handles[0].id)
              : "bound-handle"),
          handleUniqueId: boundHandleUniqueId,
          ownerUserId:
            normalizeOptionalString(record.bound_handle?.owner_user_uid) ??
            (record.bound_handle?.owner_user !== null && record.bound_handle?.owner_user !== undefined
              ? String(record.bound_handle.owner_user)
              : normalizeOptionalString(record.bound_handles?.[0]?.owner_user_uid) ??
                (record.bound_handles?.[0]?.owner_user !== null &&
                record.bound_handles?.[0]?.owner_user !== undefined
                  ? String(record.bound_handles[0].owner_user)
                  : null)),
          isLocked:
            record.bound_handle?.is_locked === true || record.bound_handles?.[0]?.is_locked === true,
        }
      : null;

  return {
    sessionId,
    agentId: agentLookupId ?? (agentId !== null ? String(agentId) : null),
    agentType: normalizeOptionalString(record.agent_type),
    actorName: normalizeOptionalString(record.actor_name),
    title: normalizeOptionalString(getAgentSessionRecordTitle(record)),
    summary: normalizeOptionalString(record.summary),
    status: normalizeOptionalString(record.status),
    startedAt: normalizeOptionalString(record.started_at),
    endedAt: normalizeOptionalString(record.ended_at),
    lastActivityAt:
      normalizeOptionalString(record.ended_at) ??
      normalizeOptionalString(record.started_at),
    llmProvider: normalizeOptionalString(record.llm_provider),
    llmModel: normalizeOptionalString(record.llm_model),
    llmThinking: normalizeThinkingValue(record.llm_thinking),
    engineName: normalizeOptionalString(record.engine_name),
    runtimeState: normalizeOptionalString(record.runtime_state),
    working: record.working === true,
    runtimeConfigOverride: normalizeOptionalRecord(record.runtime_config_override),
    runtimeConfigSnapshot: normalizeOptionalRecord(record.runtime_config_snapshot),
    inputPayload: normalizeOptionalRecord(record.input_payload),
    outputPayload: normalizeOptionalRecord(record.output_payload),
    errorDetail: normalizeOptionalString(record.error_detail),
    externalStepId: normalizeOptionalString(record.external_step_id),
    metadata:
      normalizeOptionalRecord(record.session_metadata) ??
      normalizeOptionalRecord(record.metadata),
    parentStepId:
      normalizeOptionalString(record.parent_session_uid) ??
      (record.parent_step !== null && record.parent_step !== undefined
        ? String(record.parent_step)
        : null),
    sequence: normalizeOptionalNumber(record.sequence),
    stepType: normalizeOptionalString(record.step_type),
    actorType: normalizeOptionalString(record.actor_type),
    createdByUserId:
      record.created_by_user_uid !== null &&
      record.created_by_user_uid !== undefined &&
      `${record.created_by_user_uid}`.trim()
        ? String(record.created_by_user_uid).trim()
        : record.created_by_user !== null && record.created_by_user !== undefined
          ? String(record.created_by_user)
        : null,
    boundHandle,
  };
}

export function buildAgentSessionDetailSnapshot({
  session,
  detailError,
  detailStatus,
  core,
  serializedRecord,
  fallbackAgentId,
  insights,
  insightsError,
  isLoadingInsights,
}: {
  session: AgentSessionContextInput;
  detailStatus: AgentSessionDetailStatus;
  detailError: string | null;
  core: AgentSessionCoreDetail | null;
  serializedRecord: AgentSessionSerializedRecord | null;
  insights: SessionInsightsSnapshot | null;
  isLoadingInsights: boolean;
  insightsError: string | null;
  fallbackAgentId?: string | null;
}): AgentSessionDetailSnapshot {
  const fallbackHandleUniqueId =
    core?.boundHandle?.handleUniqueId ??
    (serializedRecord ? getAgentSessionRecordHandleUniqueId(serializedRecord) : null);

  return {
    sessionId: session.id,
    status: detailStatus,
    detailError,
    context: buildAgentSessionDetailContext(session, fallbackAgentId, fallbackHandleUniqueId),
    core,
    serializedRecord,
    insights,
    isLoadingInsights,
    insightsError,
  };
}

export function buildActiveSessionSummary({
  imageDrift,
  session,
  detail,
  fallbackAgentId,
}: {
  imageDrift?: AgentImageDriftRecord | null;
  session: AgentSessionContextInput;
  detail: AgentSessionDetailSnapshot | null;
  fallbackAgentId?: string | null;
}): ActiveSessionSummary {
  const context = detail?.context ?? buildAgentSessionDetailContext(session, fallbackAgentId);
  const sessionThinking = normalizeThinkingValue(session.serializedSession?.llm_thinking);
  const detailThinking = normalizeThinkingValue(detail?.serializedRecord?.llm_thinking);

  return {
    requestAgentType: context.requestAgentType,
    displayLabel: context.displayLabel,
    agentUniqueId: context.agentUniqueId,
    imageDrift: imageDrift ?? null,
    llmProvider:
      normalizeOptionalString(session.agent?.llmProvider) ?? detail?.core?.llmProvider ?? null,
    llmModel:
      normalizeOptionalString(session.agent?.llmModel) ?? detail?.core?.llmModel ?? null,
    llmThinking:
      sessionThinking ??
      detailThinking ??
      detail?.core?.llmThinking ??
      null,
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
  };
}
