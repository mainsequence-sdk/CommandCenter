interface AgentSessionRequestBodyFragmentOptions {
  agentName: string;
  context?: unknown;
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

  return {
    ...(newChat ? { newChat: true } : {}),
    agentName: normalizedAgentName,
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
