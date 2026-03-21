import type { ChatViewContext } from "@/features/chat/chat-context";

export type ChatRunStatus = "idle" | "queued" | "thinking" | "responding" | "complete" | "error";

export type ChatBackendEvent =
  | { type: "status"; detail?: string; status: Exclude<ChatRunStatus, "idle"> }
  | { type: "thinking"; summary: string }
  | { type: "text-delta"; text: string }
  | { type: "done" };

export interface ChatBackendRequest {
  context: ChatViewContext;
  input: string;
}

export interface ChatBackendAdapter {
  streamResponse: (request: ChatBackendRequest) => AsyncIterable<ChatBackendEvent>;
}

function splitTextIntoChunks(value: string, size = 28) {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export const mockChatBackendAdapter: ChatBackendAdapter = {
  async *streamResponse(request) {
    yield {
      type: "status",
      status: "queued",
      detail: "Using the feature-local mock backend adapter.",
    };
    await sleep(180);

    yield {
      type: "status",
      status: "thinking",
      detail: "Reading route and user context from the shell.",
    };
    yield {
      type: "thinking",
      summary: `Visible route: ${request.context.currentPath}`,
    };
    await sleep(260);

    yield {
      type: "status",
      status: "responding",
      detail: "Streaming assistant output into the shared chat runtime.",
    };

    const response = [
      "This is the removable chat scaffold.",
      "",
      `Input: ${request.input}`,
      `Current route: ${request.context.currentPath}`,
      `App: ${request.context.appId ?? "none"}`,
      `Surface: ${request.context.surfaceId ?? "none"}`,
      "",
      "Replace `mockChatBackendAdapter` in `src/features/chat/chat-backend-adapter.ts` when you wire the real agent event stream.",
    ].join("\n");

    for (const chunk of splitTextIntoChunks(response)) {
      yield { type: "text-delta", text: chunk };
      await sleep(42);
    }

    yield {
      type: "status",
      status: "complete",
      detail: "Run completed.",
    };
    yield { type: "done" };
  },
};
