export interface AgentSessionModelRequestBody {
  model: string;
  provider?: string | null;
  runConfig?: {
    reasoning_effort?: string | null;
  } | null;
  source: string;
}

interface AgentSessionRequestBodyFragmentOptions {
  agentName: string;
  context?: unknown;
  model?: AgentSessionModelRequestBody | null;
  newChat?: boolean;
  sessionId?: string | number | null;
  threadId?: string | null;
  userId?: string | number | null;
  workflowKey?: string | null;
}

export interface AgentSessionLiveRequestOptions extends AgentSessionRequestBodyFragmentOptions {
  input: string;
}

function normalizeNonEmptyString(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function buildAgentSessionRequestBodyFragment({
  agentName,
  context,
  model,
  newChat = false,
  sessionId,
  threadId,
  userId,
  workflowKey,
}: AgentSessionRequestBodyFragmentOptions) {
  const normalizedAgentName = normalizeNonEmptyString(agentName);

  if (!normalizedAgentName) {
    throw new Error("Agent session requests require a non-empty agent name.");
  }

  const normalizedSessionId = normalizeNonEmptyString(sessionId);
  const normalizedThreadId = normalizeNonEmptyString(threadId);
  const normalizedUserId = normalizeNonEmptyString(userId);
  const normalizedWorkflowKey = normalizeNonEmptyString(workflowKey) ?? normalizedAgentName;
  const normalizedModelSource =
    model === null ? null : normalizeNonEmptyString(model?.source);
  const normalizedModelValue =
    model === null ? null : normalizeNonEmptyString(model?.model);
  const normalizedModelProvider =
    model === null ? null : normalizeNonEmptyString(model?.provider);
  const normalizedReasoningEffort =
    model === null
      ? null
      : normalizeNonEmptyString(model?.runConfig?.reasoning_effort);

  return {
    ...(newChat ? { newChat: true } : {}),
    agentName: normalizedAgentName,
    ...(model === null
      ? { model: null }
      : normalizedModelSource && normalizedModelValue
        ? {
            model: {
              source: normalizedModelSource,
              model: normalizedModelValue,
              ...(normalizedModelProvider ? { provider: normalizedModelProvider } : {}),
              ...(normalizedReasoningEffort
                ? {
                    runConfig: {
                      reasoning_effort: normalizedReasoningEffort,
                    },
                  }
                : {}),
            },
          }
        : {}),
    ...(normalizedUserId ? { userId: normalizedUserId } : {}),
    ...(normalizedThreadId ? { threadId: normalizedThreadId } : {}),
    ...(normalizedSessionId
      ? {
          sessionId: normalizedSessionId,
          runtime_session_id: normalizedSessionId,
        }
      : {}),
    sessionMetadata: {
      source: "frontend",
      workflow_key: normalizedWorkflowKey,
    },
    ...(context !== undefined ? { context } : {}),
  };
}

export function buildAgentSessionLiveRequestBody({
  input,
  ...fragmentOptions
}: AgentSessionLiveRequestOptions) {
  const normalizedInput = input.trim();

  if (!normalizedInput) {
    throw new Error("Agent session requests require a non-empty input.");
  }

  return {
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: normalizedInput }],
      },
    ],
    tools: {},
    ...buildAgentSessionRequestBodyFragment(fragmentOptions),
  };
}
