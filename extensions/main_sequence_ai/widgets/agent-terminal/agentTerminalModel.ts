import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  WidgetAgentContextValue,
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
} from "@/widgets/types";

import {
  isWorkspaceReferenceValue,
  type WorkspaceReferenceValue,
} from "../workspace/workspaceReference";

export type AgentTerminalHistoryRefreshMode = "workspace" | "never" | "interval";

export const DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_MODE = "workspace";
export const DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS = 30;
export const MIN_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS = 5;
export const MAX_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS = 3_600;
export const AGENT_TERMINAL_UPSTREAM_CONTEXT_INPUT_ID = "upstream-context";
export const AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_OUTPUT_ID = "latest-assistant-markdown";
export const AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_RUNTIME_KEY = "latestAssistantMarkdown";
export const AGENT_TERMINAL_LATEST_ASSISTANT_UPDATED_AT_RUNTIME_KEY = "latestAssistantUpdatedAt";

export type AgentTerminalWidgetProps = Record<string, unknown> & {
  agentId?: string;
  agentName?: string;
  agentSessionId?: string;
  blockUserInput?: boolean;
  loadInitialHistory?: boolean;
  historyRefreshMode?: AgentTerminalHistoryRefreshMode;
  historyRefreshIntervalSeconds?: number;
  promptOnRefresh?: string;
};

export type AgentTerminalLineTone = "default" | "muted" | "danger" | "success";

export interface AgentTerminalLine {
  id: string;
  kind: "input" | "output";
  prompt?: string;
  text: string;
  tone?: AgentTerminalLineTone;
}

export interface AgentTerminalSessionState {
  agentName: string;
  llmModel?: string | null;
  llmProvider?: string | null;
  requestAgentName: string | null;
  sessionId: string;
  threadId: string | null;
}

export type AgentTerminalUpstreamSource =
  | {
      kind: "widget-context";
      context: WidgetAgentContextValue;
    }
  | {
      kind: "workspace-reference";
      reference: WorkspaceReferenceValue;
    };

function normalizeOptionalMarkdownString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim() ? value : undefined;
}

function normalizeOptionalTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function formatAgentTerminalModelLabel({
  model,
  provider,
}: {
  model?: string | null;
  provider?: string | null;
}) {
  const normalizedProvider = normalizeOptionalTrimmedString(provider) ?? null;
  const normalizedModel = normalizeOptionalTrimmedString(model) ?? null;

  if (normalizedProvider && normalizedModel) {
    return `${normalizedProvider} · ${normalizedModel}`;
  }

  return normalizedModel ?? normalizedProvider ?? null;
}

function normalizeOptionalIdentifier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return normalizeOptionalTrimmedString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveValidResolvedInputs(
  value: ResolvedWidgetInput | ResolvedWidgetInput[] | undefined,
) {
  if (!value) {
    return [];
  }

  const entries = Array.isArray(value) ? value : [value];

  return entries.filter((entry): entry is ResolvedWidgetInput => entry.status === "valid");
}

function isWidgetAgentContextValue(value: unknown): value is WidgetAgentContextValue {
  if (!isRecord(value)) {
    return false;
  }

  const snapshot = value.snapshot;

  if (!isRecord(snapshot)) {
    return false;
  }

  return (
    value.contractVersion === "v1" &&
    typeof value.widgetId === "string" &&
    typeof value.instanceId === "string" &&
    typeof value.title === "string" &&
    typeof snapshot.displayKind === "string" &&
    typeof snapshot.state === "string" &&
    typeof snapshot.summary === "string"
  );
}

export function normalizeAgentTerminalHistoryRefreshMode(
  value: unknown,
): AgentTerminalHistoryRefreshMode {
  return value === "never" || value === "interval" || value === "workspace"
    ? value
    : DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_MODE;
}

export function normalizeAgentTerminalHistoryRefreshIntervalSeconds(
  value: unknown,
): number {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS;
  }

  return Math.min(
    MAX_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS,
    Math.max(
      MIN_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS,
      Math.round(numericValue),
    ),
  );
}

function createAgentTerminalLineId(prefix: string) {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function flattenThreadMessageText(message: ThreadMessageLike) {
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .flatMap((part) => {
      if (part.type !== "text" || typeof part.text !== "string") {
        return [];
      }

      return [part.text];
    })
    .join("")
    .trim();
}

export function normalizeAgentTerminalWidgetProps(
  props: AgentTerminalWidgetProps,
): AgentTerminalWidgetProps {
  const agentId = normalizeOptionalIdentifier(props.agentId);
  const normalizedSessionId =
    typeof props.agentSessionId === "string" ? props.agentSessionId.trim() : "";
  const agentName = normalizeOptionalTrimmedString(props.agentName);
  const loadInitialHistory = props.loadInitialHistory === true;
  const blockUserInput = props.blockUserInput === true;
  const historyRefreshMode = normalizeAgentTerminalHistoryRefreshMode(props.historyRefreshMode);
  const historyRefreshIntervalSeconds = normalizeAgentTerminalHistoryRefreshIntervalSeconds(
    props.historyRefreshIntervalSeconds,
  );
  const promptOnRefresh = normalizeOptionalMarkdownString(props.promptOnRefresh);

  return {
    ...(agentId ? { agentId } : {}),
    ...(agentName ? { agentName } : {}),
    ...(normalizedSessionId ? { agentSessionId: normalizedSessionId } : {}),
    ...(blockUserInput ? { blockUserInput: true } : {}),
    ...(loadInitialHistory ? { loadInitialHistory: true } : {}),
    historyRefreshMode,
    ...(historyRefreshMode === "interval" || props.historyRefreshIntervalSeconds != null
      ? { historyRefreshIntervalSeconds }
      : {}),
    ...(promptOnRefresh ? { promptOnRefresh } : {}),
  };
}

export function resolveAgentTerminalRefreshPrompt(
  props: AgentTerminalWidgetProps,
) {
  return normalizeOptionalMarkdownString(props.promptOnRefresh) ?? null;
}

export function resolveAgentTerminalUpstreamSources(
  resolvedInputs?: ResolvedWidgetInputs,
) {
  return resolveValidResolvedInputs(resolvedInputs?.[AGENT_TERMINAL_UPSTREAM_CONTEXT_INPUT_ID])
    .flatMap((entry): AgentTerminalUpstreamSource[] => {
      if (isWidgetAgentContextValue(entry.value)) {
        return [{
          kind: "widget-context",
          context: entry.value,
        }];
      }

      if (isWorkspaceReferenceValue(entry.value)) {
        return [{
          kind: "workspace-reference",
          reference: entry.value,
        }];
      }

      return [];
    });
}

function formatAgentTerminalContextData(data: Record<string, unknown> | undefined) {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

function formatAgentTerminalContextSection(
  context: WidgetAgentContextValue,
  index: number,
) {
  const lines = [
    `## Source ${index + 1}: Widget ${context.title}`,
    `Widget id: ${context.widgetId}`,
    `Instance id: ${context.instanceId}`,
    `Display kind: ${context.snapshot.displayKind}`,
    `State: ${context.snapshot.state}`,
    `Summary: ${context.snapshot.summary}`,
  ];
  const serializedData = formatAgentTerminalContextData(context.snapshot.data);

  if (serializedData) {
    lines.push("Data:", serializedData);
  }

  return lines.join("\n");
}

function formatAgentTerminalWorkspaceReferenceSection(
  reference: WorkspaceReferenceValue,
  index: number,
) {
  return [
    `## Source ${index + 1}: Workspace reference`,
    `Workspace id: ${reference.id}`,
  ].join("\n");
}

function formatAgentTerminalUpstreamSourceSection(
  source: AgentTerminalUpstreamSource,
  index: number,
) {
  if (source.kind === "workspace-reference") {
    return formatAgentTerminalWorkspaceReferenceSection(source.reference, index);
  }

  return formatAgentTerminalContextSection(source.context, index);
}

export function buildAgentTerminalRefreshRequest({
  prompt,
  upstreamSources,
}: {
  prompt: string | null;
  upstreamSources: AgentTerminalUpstreamSource[];
}) {
  const normalizedPrompt = normalizeOptionalMarkdownString(prompt);

  if (!normalizedPrompt) {
    return null;
  }

  if (upstreamSources.length === 0) {
    return normalizedPrompt;
  }

  return [
    normalizedPrompt,
    "",
    "Use the live widget context and workspace references below as evidence for your answer.",
    "",
    ...upstreamSources.map((source, index) =>
      formatAgentTerminalUpstreamSourceSection(source, index),
    ),
  ].join("\n");
}

export function resolveAgentTerminalLatestAssistantMarkdown(
  runtimeState?: Record<string, unknown>,
) {
  if (!runtimeState || typeof runtimeState !== "object") {
    return undefined;
  }

  const value = runtimeState[AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_RUNTIME_KEY];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function extractLatestAssistantMarkdown(
  messages: readonly ThreadMessageLike[],
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role !== "assistant") {
      continue;
    }

    const text = flattenThreadMessageText(message);

    if (text) {
      return text;
    }
  }

  return null;
}

export function buildAgentTerminalPrompt(sessionId: string) {
  const trimmed = sessionId.trim();

  if (!trimmed) {
    return "$";
  }

  if (trimmed.length <= 14) {
    return `${trimmed}>`;
  }

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}>`;
}

export function createAgentTerminalInputLine({
  prompt,
  text,
}: {
  prompt: string;
  text: string;
}): AgentTerminalLine {
  return {
    id: createAgentTerminalLineId("input"),
    kind: "input",
    prompt,
    text,
  };
}

export function createAgentTerminalOutputLine({
  text,
  tone = "default",
}: {
  text: string;
  tone?: AgentTerminalLineTone;
}): AgentTerminalLine {
  return {
    id: createAgentTerminalLineId("output"),
    kind: "output",
    text,
    tone,
  };
}

export function buildAgentTerminalPlaceholderLines() {
  return [
    createAgentTerminalOutputLine({
      text: "[configure] Select a supported agent in widget settings or add this terminal from Agents Monitor.",
      tone: "muted",
    }),
  ];
}

export function buildAgentTerminalLoadingLines(sessionId: string) {
  return [
    createAgentTerminalOutputLine({
      text: `[connect] Loading AgentSession ${sessionId}...`,
      tone: "muted",
    }),
  ];
}

export function buildAgentTerminalValidationLines(sessionId: string) {
  return [
    createAgentTerminalOutputLine({
      text: `[validate] Checking AgentSession ${sessionId}...`,
      tone: "muted",
    }),
  ];
}

export function buildAgentTerminalSessionNotFoundLines(sessionId: string) {
  return [
    createAgentTerminalOutputLine({
      text: `[session-not-found] AgentSession ${sessionId} was not found in the backend. Select the agent again or recycle the session from widget settings.`,
      tone: "danger",
    }),
  ];
}

export function buildAgentTerminalErrorLines(message: string) {
  return [
    createAgentTerminalOutputLine({
      text: `[error] ${message}`,
      tone: "danger",
    }),
  ];
}

export function buildAgentTerminalSessionLines({
  messages,
  prompt,
  session,
  sessionError,
  userInputBlocked = false,
}: {
  messages: readonly ThreadMessageLike[];
  prompt: string;
  session: AgentTerminalSessionState;
  sessionError?: string | null;
  userInputBlocked?: boolean;
}) {
  const lines: AgentTerminalLine[] = [
    createAgentTerminalOutputLine({
      text: `[session] ${session.agentName} (${session.sessionId})`,
      tone: "muted",
    }),
  ];

  const historyLines = messages.flatMap((message) => {
    const text = flattenThreadMessageText(message);

    if (!text) {
      return [];
    }

    if (message.role === "user") {
      return [
        createAgentTerminalInputLine({
          prompt,
          text,
        }),
      ];
    }

    if (message.role === "assistant") {
      return [
        createAgentTerminalOutputLine({
          text,
        }),
      ];
    }

    return [
      createAgentTerminalOutputLine({
        text: `[${message.role}] ${text}`,
        tone: "muted",
      }),
    ];
  });

  if (historyLines.length === 0) {
    lines.push(
      createAgentTerminalOutputLine({
        text: userInputBlocked
          ? "[ready] Session attached. Manual typing is blocked; refresh actions may still send the saved prompt."
          : "[ready] Session attached. Type a command to continue the conversation.",
        tone: "muted",
      }),
    );
  } else {
    lines.push(...historyLines);
  }

  if (historyLines.length > 0 && userInputBlocked) {
    lines.push(
      createAgentTerminalOutputLine({
        text: "[input-blocked] Manual typing is disabled for this terminal. Refresh actions may still send the saved prompt.",
        tone: "muted",
      }),
    );
  }

  if (sessionError) {
    lines.push(
      createAgentTerminalOutputLine({
        text: `[session-error] ${sessionError}`,
        tone: "danger",
      }),
    );
  }

  return lines;
}
