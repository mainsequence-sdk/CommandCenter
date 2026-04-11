import type { AssistantRuntime, ChatModelAdapter, ChatModelRunOptions, ThreadMessage } from "@assistant-ui/core";
import { splitLocalRuntimeOptions, type LocalRuntimeOptions, useLocalRuntime } from "@assistant-ui/core/react";
import {
  AssistantMessageAccumulator,
  DataStreamDecoder,
  toGenericMessages,
  toToolsJSONSchema,
  UIMessageStreamDecoder,
  unstable_toolResultStream,
} from "assistant-stream";
import { asAsyncIterableStream } from "assistant-stream/utils";

import { env } from "@/config/env";

type HeadersValue = Record<string, string> | Headers;

export type LatestMessageDataStreamProtocol = "ui-message-stream" | "data-stream";

export type UseLatestMessageDataStreamRuntimeOptions = {
  api: string;
  protocol?: LatestMessageDataStreamProtocol;
  onRequestStart?: () => void | Promise<void>;
  onData?: (data: {
    type: string;
    name: string;
    data: unknown;
    transient?: boolean;
  }) => void;
  onChunk?: (chunk: { type: string; data: Record<string, unknown> }) => void;
  onResponse?: (response: Response) => void | Promise<void>;
  onFinish?: (message: ThreadMessage) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  credentials?: RequestCredentials;
  headers?: HeadersValue | (() => Promise<HeadersValue>);
  body?: object | (() => Promise<object | undefined>);
  sendExtraMessageFields?: boolean;
} & LocalRuntimeOptions;

type DataStreamRuntimeRequestOptions = {
  messages: unknown[];
  tools: unknown;
  system?: string | undefined;
  runConfig?: unknown;
  unstable_assistantMessageId?: string;
  threadId?: string;
  parentId?: string | null;
  state?: unknown;
};

function extractAgentMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return "agent_id" in value ? value : null;
}

function extractUiMessageStreamChunk(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const chunk = value as Record<string, unknown>;
  return typeof chunk.type === "string" ? { type: chunk.type, data: chunk } : null;
}

function createUiMessageStreamMetadataTap(
  options: Pick<UseLatestMessageDataStreamRuntimeOptions, "onChunk" | "onData">,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
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
      const chunk = extractUiMessageStreamChunk(parsed);

      if (chunk) {
        options.onChunk?.(chunk);
      }

      const metadata = extractAgentMetadata(parsed);

      if (metadata) {
        options.onData?.({
          type: "metadata",
          name: "agent_id",
          data: metadata,
        });
      }
    } catch {
      // Ignore malformed metadata frames and let the main decoder own protocol validation.
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
      const fieldValue = rest.join(":").trimStart();

      switch (field) {
        case "event":
          eventName = fieldValue || "message";
          break;
        case "data":
          dataLines.push(fieldValue);
          break;
        default:
          break;
      }
    }
  };

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buffer += decoder.decode(chunk, { stream: true });
      processBufferedLines();
    },
    flush() {
      buffer += decoder.decode();

      if (buffer) {
        const trailingLine = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
        if (trailingLine) {
          const [field, ...rest] = trailingLine.split(":");
          if (field === "data") {
            dataLines.push(rest.join(":").trimStart());
          } else if (field === "event") {
            eventName = rest.join(":").trimStart() || "message";
          }
        }
      }

      flushEvent();
    },
  });
}

function toUrl(value: string | URL): URL {
  if (value instanceof URL) return value;

  try {
    return new URL(value);
  } catch {
    return new URL(value, "file://");
  }
}

function convertGenericToLanguageModel(generic: ReturnType<typeof toGenericMessages>[number]) {
  switch (generic.role) {
    case "system":
      return { role: "system", content: generic.content };
    case "user":
      return {
        role: "user",
        content: generic.content.map((part) =>
          part.type === "text"
            ? part
            : {
                type: "file",
                data: toUrl(part.data),
                mediaType: part.mediaType,
              },
        ),
      };
    case "assistant":
      return {
        role: "assistant",
        content: generic.content.map((part) =>
          part.type === "text"
            ? part
            : {
                type: "tool-call",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                input: part.args,
              },
        ),
      };
    case "tool":
      return {
        role: "tool",
        content: generic.content.map((part) => ({
          type: "tool-result",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: part.isError
            ? { type: "error-json", value: part.result }
            : { type: "json", value: part.result },
        })),
      };
  }
}

function toLatestLanguageModelMessages(
  messages: readonly ThreadMessage[],
  options: { unstable_includeId?: boolean | undefined } = {},
) {
  const includeId = options.unstable_includeId ?? false;
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");

  if (!latestUserMessage) {
    return [];
  }

  const genericMessages = toGenericMessages([latestUserMessage] as never);

  if (!includeId) {
    return genericMessages.map(convertGenericToLanguageModel);
  }

  return genericMessages.map((generic) => {
    const converted = convertGenericToLanguageModel(generic) as Record<string, unknown>;

    if (generic.role !== "tool") {
      converted.unstable_id = latestUserMessage.id;
    }

    return converted;
  });
}

class LatestMessageDataStreamRuntimeAdapter implements ChatModelAdapter {
  constructor(
    private options: Omit<UseLatestMessageDataStreamRuntimeOptions, keyof LocalRuntimeOptions>,
  ) {}

  async *run({
    messages,
    runConfig,
    abortSignal,
    context,
    unstable_assistantMessageId,
    unstable_threadId,
    unstable_parentId,
    unstable_getMessage,
  }: ChatModelRunOptions) {
    const headersValue =
      typeof this.options.headers === "function"
        ? await this.options.headers()
        : this.options.headers;

    const bodyValue =
      typeof this.options.body === "function"
        ? await this.options.body()
        : this.options.body;

    abortSignal.addEventListener(
      "abort",
      () => {
        if (!abortSignal.reason?.detach) this.options.onCancel?.();
      },
      { once: true },
    );

    const headers = new Headers(headersValue);
    headers.set("Content-Type", "application/json");

    await this.options.onRequestStart?.();

    const requestBody = {
      system: context.system,
      messages: toLatestLanguageModelMessages(messages, {
        unstable_includeId: this.options.sendExtraMessageFields,
      }) as DataStreamRuntimeRequestOptions["messages"],
      tools: toToolsJSONSchema(
        context.tools ?? {},
      ) as unknown as DataStreamRuntimeRequestOptions["tools"],
      ...(unstable_assistantMessageId ? { unstable_assistantMessageId } : {}),
      ...(unstable_threadId ? { threadId: unstable_threadId } : {}),
      ...(unstable_parentId !== undefined ? { parentId: unstable_parentId } : {}),
      runConfig,
      state: unstable_getMessage().metadata.unstable_state || undefined,
      ...context.callSettings,
      ...context.config,
      ...(bodyValue ?? {}),
    } satisfies DataStreamRuntimeRequestOptions;

    if (env.debugChat) {
      console.log("[main_sequence_ai] assistant request body", requestBody);
    }

    const result = await fetch(this.options.api, {
      method: "POST",
      headers,
      credentials: this.options.credentials ?? "same-origin",
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    try {
      if (!result.ok) {
        throw new Error(`Status ${result.status}: ${await result.text()}`);
      }

      if (!result.body) {
        throw new Error("Response body is null");
      }

      await this.options.onResponse?.(result);

      const protocol = this.options.protocol ?? "ui-message-stream";
      const decoder =
        protocol === "ui-message-stream"
          ? new UIMessageStreamDecoder(
              this.options.onData ? { onData: this.options.onData } : {},
            )
          : new DataStreamDecoder();

      const stream = result.body
        .pipeThrough(
          protocol === "ui-message-stream" && (this.options.onData || this.options.onChunk)
            ? createUiMessageStreamMetadataTap({
                onChunk: this.options.onChunk,
                onData: this.options.onData,
              })
            : new TransformStream<Uint8Array, Uint8Array>(),
        )
        .pipeThrough(decoder)
        .pipeThrough(
          unstable_toolResultStream(context.tools, abortSignal, () => {
            throw new Error("Tool interrupt is not supported in data stream runtime");
          }),
        )
        .pipeThrough(new AssistantMessageAccumulator());

      yield* asAsyncIterableStream(stream);

      this.options.onFinish?.(unstable_getMessage());
    } catch (error: unknown) {
      this.options.onError?.(error as Error);
      throw error;
    }
  }
}

export const useLatestMessageDataStreamRuntime = (
  options: UseLatestMessageDataStreamRuntimeOptions,
): AssistantRuntime => {
  const { localRuntimeOptions, otherOptions } = splitLocalRuntimeOptions(options);

  return useLocalRuntime(new LatestMessageDataStreamRuntimeAdapter(otherOptions), localRuntimeOptions);
};
