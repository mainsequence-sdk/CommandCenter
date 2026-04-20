import type { AssistantUiProtocol } from "@/config/command-center";

import { fetchMainSequenceAiAssistantResponse } from "./assistant-endpoint";

export type AgentSessionStreamChunk = Record<string, unknown> & { type: string };

function toAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw toAbortError();
  }
}

async function readUiMessageStream({
  onChunk,
  signal,
  stream,
}: {
  onChunk?: (chunk: AgentSessionStreamChunk) => void;
  signal?: AbortSignal;
  stream: ReadableStream<Uint8Array>;
}) {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];

  const flushEvent = () => {
    if (eventName !== "message" || dataLines.length === 0) {
      eventName = "message";
      dataLines = [];
      return;
    }

    const rawData = dataLines.join("\n");

    if (rawData === "[DONE]") {
      eventName = "message";
      dataLines = [];
      return;
    }

    try {
      const parsed = JSON.parse(rawData) as unknown;

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        typeof (parsed as { type?: unknown }).type === "string"
      ) {
        onChunk?.(parsed as AgentSessionStreamChunk);
      }
    } catch {
      // Ignore malformed auxiliary frames and let the request finish.
    }

    eventName = "message";
    dataLines = [];
  };

  const processBufferedLines = () => {
    while (true) {
      const newlineIndex = buffer.indexOf("\n");

      if (newlineIndex === -1) {
        break;
      }

      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

      if (line.startsWith(":")) {
        continue;
      }

      if (line === "") {
        flushEvent();
        continue;
      }

      const [field, ...rest] = line.split(":");
      const value = rest.join(":").trimStart();

      switch (field) {
        case "event":
          eventName = value || "message";
          break;
        case "data":
          dataLines.push(value);
          break;
        default:
          break;
      }
    }
  };

  try {
    while (true) {
      assertNotAborted(signal);
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      processBufferedLines();
    }

    buffer += decoder.decode();

    if (buffer) {
      const trailingLine = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;

      if (trailingLine) {
        const [field, ...rest] = trailingLine.split(":");
        const value = rest.join(":").trimStart();

        if (field === "event") {
          eventName = value || "message";
        } else if (field === "data") {
          dataLines.push(value);
        }
      }
    }

    flushEvent();
  } finally {
    reader.releaseLock();
  }
}

export async function streamAgentSessionResponse({
  assistantEndpoint,
  body,
  onChunk,
  protocol,
  signal,
  token,
  tokenType = "Bearer",
}: {
  assistantEndpoint?: string;
  body: Record<string, unknown>;
  onChunk?: (chunk: AgentSessionStreamChunk) => void;
  protocol: AssistantUiProtocol;
  signal?: AbortSignal;
  token?: string | null;
  tokenType?: string;
}) {
  if (protocol !== "ui-message-stream") {
    throw new Error(
      `Agent terminal widget currently supports ui-message-stream only. Received ${protocol}.`,
    );
  }
  const currentSessionId =
    typeof body.sessionId === "string" || typeof body.sessionId === "number"
      ? body.sessionId
      : typeof body.runtime_session_id === "string" ||
          typeof body.runtime_session_id === "number"
        ? body.runtime_session_id
        : null;

  const { response } = await fetchMainSequenceAiAssistantResponse({
    accept: "text/event-stream",
    assistantEndpoint,
    currentSessionId,
    requestPath: "/api/chat",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
    sessionToken: token,
    sessionTokenType: tokenType,
  });

  if (!response.ok) {
    throw new Error(`Status ${response.status}: ${await response.text()}`);
  }

  if (!response.body) {
    throw new Error("Response body is null.");
  }

  await readUiMessageStream({
    onChunk,
    signal,
    stream: response.body,
  });
}
