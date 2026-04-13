import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
} from "@/widgets/types";

export type AgentTerminalHistoryRefreshMode = "workspace" | "never" | "interval";

export const DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_MODE = "workspace";
export const DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS = 30;
export const MIN_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS = 5;
export const MAX_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS = 3_600;
export const AGENT_TERMINAL_REFRESH_PROMPT_INPUT_ID = "prompt-on-refresh";

export type AgentTerminalWidgetProps = Record<string, unknown> & {
  agentSessionId?: string;
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
  sessionId: string;
  threadId: string | null;
  toolSummary: string | null;
}

function normalizeOptionalMarkdownString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim() ? value : undefined;
}

function resolveFirstValidResolvedInput(
  value: ResolvedWidgetInput | ResolvedWidgetInput[] | undefined,
) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || candidate.status !== "valid") {
    return undefined;
  }

  return candidate;
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
  const normalizedSessionId =
    typeof props.agentSessionId === "string" ? props.agentSessionId.trim() : "";
  const historyRefreshMode = normalizeAgentTerminalHistoryRefreshMode(props.historyRefreshMode);
  const historyRefreshIntervalSeconds = normalizeAgentTerminalHistoryRefreshIntervalSeconds(
    props.historyRefreshIntervalSeconds,
  );
  const promptOnRefresh = normalizeOptionalMarkdownString(props.promptOnRefresh);

  return {
    ...(normalizedSessionId ? { agentSessionId: normalizedSessionId } : {}),
    historyRefreshMode,
    ...(historyRefreshMode === "interval" || props.historyRefreshIntervalSeconds != null
      ? { historyRefreshIntervalSeconds }
      : {}),
    ...(promptOnRefresh ? { promptOnRefresh } : {}),
  };
}

export function resolveAgentTerminalRefreshPrompt(
  props: AgentTerminalWidgetProps,
  resolvedInputs?: ResolvedWidgetInputs,
) {
  const boundInput = resolveFirstValidResolvedInput(
    resolvedInputs?.[AGENT_TERMINAL_REFRESH_PROMPT_INPUT_ID],
  );

  if (typeof boundInput?.value === "string" && boundInput.value.trim()) {
    return boundInput.value;
  }

  return normalizeOptionalMarkdownString(props.promptOnRefresh) ?? null;
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
      text: "[configure] Select an agent session in widget settings or add this terminal from Agents Monitor.",
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
}: {
  messages: readonly ThreadMessageLike[];
  prompt: string;
  session: AgentTerminalSessionState;
  sessionError?: string | null;
}) {
  const lines: AgentTerminalLine[] = [
    createAgentTerminalOutputLine({
      text: `[session] ${session.agentName} (${session.sessionId})`,
      tone: "muted",
    }),
  ];

  if (session.toolSummary) {
    lines.push(
      createAgentTerminalOutputLine({
        text: `[tools] ${session.toolSummary}`,
        tone: "muted",
      }),
    );
  }

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
        text: "[ready] Session loaded. Type a command to continue the conversation.",
        tone: "muted",
      }),
    );
  } else {
    lines.push(...historyLines);
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
