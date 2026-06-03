import {
  fetchMainSequenceAiAssistantResponse,
  type MainSequenceAiAssistantRuntimeTarget,
} from "./assistant-endpoint";

export interface CancelChatSessionRequest {
  runtimeSessionUid: string;
  threadId: string;
  userUid: string | number | null;
  reason?: "user_requested" | string;
  message?: string;
}

export async function cancelChatSession({
  assistantEndpoint,
  body,
  runtimeTarget,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint?: string;
  body: CancelChatSessionRequest;
  runtimeTarget?: MainSequenceAiAssistantRuntimeTarget;
  token?: string | null;
  tokenType?: string;
}) {
  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "application/json",
    assistantEndpoint,
    currentSessionId: body.runtimeSessionUid,
    requestPath: "/api/chat/session/cancel",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      runtime_session_uid: body.runtimeSessionUid,
      thread_id: body.threadId,
      user_uid: body.userUid !== null && body.userUid !== undefined ? String(body.userUid) : null,
      reason: body.reason ?? "user_requested",
      message: body.message ?? "User pressed stop.",
    }),
    runtimeTarget,
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string; error?: string; message?: string }
      | null;
    throw new Error(
      payload?.message ||
        payload?.detail ||
        payload?.error ||
        `Session cancellation failed with status ${response.status}.`,
    );
  }
}
