import {
  fetchMainSequenceAiAssistantResponse,
  type MainSequenceAiAssistantRuntimeTarget,
} from "./assistant-endpoint";
import { buildRuntimeHttpErrorMessage } from "./http-error";

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
  const { response, url } = await fetchMainSequenceAiAssistantResponse({
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
    throw new Error(
      await buildRuntimeHttpErrorMessage({
        fallbackMessage: `Session cancellation failed with status ${response.status}.`,
        method: "POST",
        operation: "Agent session cancellation request failed",
        response,
        url,
      }),
    );
  }
}
