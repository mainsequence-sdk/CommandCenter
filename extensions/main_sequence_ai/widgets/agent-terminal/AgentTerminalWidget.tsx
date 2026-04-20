import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import Terminal, { ColorMode, TerminalInput, TerminalOutput } from "react-terminal-ui";

import { useAuthStore } from "@/auth/auth-store";
import { useDashboardWidgetExecution } from "@/dashboards/DashboardWidgetExecution";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  buildAgentSessionLiveRequestBody,
} from "../../runtime/agent-session-request";
import {
  streamAgentSessionResponse,
  type AgentSessionStreamChunk,
} from "../../runtime/agent-session-stream";
import {
  resolveMainSequenceAiAssistantProtocol,
} from "../../runtime/assistant-endpoint";
import { fetchSessionHistory } from "../../runtime/session-history-api";
import { fetchSessionTools } from "../../runtime/session-tools-api";
import "./AgentTerminalWidget.css";
import { AGENT_TERMINAL_HISTORY_REFRESH_RUNTIME_KEY } from "./agentTerminalExecution";
import {
  DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS,
  AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_RUNTIME_KEY,
  AGENT_TERMINAL_LATEST_ASSISTANT_UPDATED_AT_RUNTIME_KEY,
  buildAgentTerminalRefreshRequest,
  buildAgentTerminalErrorLines,
  extractLatestAssistantMarkdown,
  buildAgentTerminalLoadingLines,
  buildAgentTerminalPlaceholderLines,
  buildAgentTerminalPrompt,
  buildAgentTerminalSessionLines,
  createAgentTerminalInputLine,
  createAgentTerminalOutputLine,
  normalizeAgentTerminalWidgetProps,
  resolveAgentTerminalLatestAssistantMarkdown,
  resolveAgentTerminalRefreshPrompt,
  resolveAgentTerminalUpstreamContexts,
  type AgentTerminalLine,
  type AgentTerminalLineTone,
  type AgentTerminalSessionState,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";
import {
  AGENT_TERMINAL_AUTO_FOCUS_RUNTIME_KEY,
  buildAgentTerminalSessionWidgetTitle,
} from "./agentTerminalWorkspace";

type Props = WidgetComponentProps<AgentTerminalWidgetProps>;

function TerminalChromeHidden() {
  return null;
}

function resolveOutputTextClassName(tone: AgentTerminalLineTone | undefined) {
  switch (tone) {
    case "muted":
      return "ms-agent-terminal-output-muted";
    case "danger":
      return "ms-agent-terminal-output-danger";
    case "success":
      return "ms-agent-terminal-output-success";
    default:
      return "ms-agent-terminal-output-default";
  }
}

function extractChunkTextDelta(chunk: AgentSessionStreamChunk) {
  if (typeof chunk.textDelta === "string") {
    return chunk.textDelta;
  }

  if (typeof chunk.delta === "string") {
    return chunk.delta;
  }

  if (typeof chunk.text === "string") {
    return chunk.text;
  }

  return "";
}

function extractChunkThreadId(chunk: AgentSessionStreamChunk) {
  if (typeof chunk.thread_id === "string" && chunk.thread_id.trim()) {
    return chunk.thread_id.trim();
  }

  if (typeof chunk.threadId === "string" && chunk.threadId.trim()) {
    return chunk.threadId.trim();
  }

  return null;
}

function extractSessionSwitchAgentName(chunk: AgentSessionStreamChunk) {
  if (typeof chunk.to_agent_name === "string" && chunk.to_agent_name.trim()) {
    return chunk.to_agent_name.trim();
  }

  if (typeof chunk.toAgentName === "string" && chunk.toAgentName.trim()) {
    return chunk.toAgentName.trim();
  }

  return null;
}

function buildWidgetContext({
  instanceId,
  sessionId,
  title,
  userId,
}: {
  instanceId?: string;
  sessionId: string;
  title: string;
  userId: string | null;
}) {
  const currentPath = `/widgets/main_sequence_ai/agent-terminal/${instanceId ?? "preview"}`;

  return {
    appId: "main_sequence_ai",
    appTitle: "Main Sequence AI",
    currentPath,
    surfaceActions: [],
    surfaceContextSource: "surface",
    surfaceDetails: {
      sessionId,
      ...(instanceId ? { instanceId } : {}),
    },
    surfaceId: "agent-terminal-widget",
    surfaceSummary: "Agent session terminal widget mounted inside a workspace canvas.",
    surfaceTitle: title,
    ...(userId ? { userId } : {}),
  };
}

export function AgentTerminalWidget({
  instanceId,
  instanceTitle,
  onRuntimeStateChange,
  props,
  resolvedInputs,
  runtimeState,
  widget,
}: Props) {
  const normalizedProps = useMemo(() => normalizeAgentTerminalWidgetProps(props), [props]);
  const sessionId = normalizedProps.agentSessionId ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const widgetExecution = useDashboardWidgetExecution();
  const assistantProtocol = useMemo(() => resolveMainSequenceAiAssistantProtocol(), []);
  const [lines, setLines] = useState<AgentTerminalLine[]>(() => buildAgentTerminalPlaceholderLines());
  const [sessionState, setSessionState] = useState<AgentTerminalSessionState | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const loadControllerRef = useRef<AbortController | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);
  const activeOutputLineIdRef = useRef<string | null>(null);
  const pendingHistoryRefreshRef = useRef(false);
  const hasObservedHistoryRefreshNonceRef = useRef(false);
  const observedHistoryRefreshSessionIdRef = useRef<string | null>(null);
  const lastHistoryRefreshNonceRef = useRef<number | null>(null);
  const runtimeStateRef = useRef<Record<string, unknown> | undefined>(runtimeState);
  const sessionStateRef = useRef<AgentTerminalSessionState | null>(null);
  const reasoningNoticeRef = useRef(false);
  const receivedTextRef = useRef(false);
  const streamedAssistantTextRef = useRef("");
  const autoFocusNonce =
    runtimeState &&
    typeof runtimeState === "object" &&
    typeof runtimeState[AGENT_TERMINAL_AUTO_FOCUS_RUNTIME_KEY] === "number"
      ? runtimeState[AGENT_TERMINAL_AUTO_FOCUS_RUNTIME_KEY]
      : null;
  const historyRefreshNonce =
    runtimeState &&
    typeof runtimeState === "object" &&
    typeof runtimeState[AGENT_TERMINAL_HISTORY_REFRESH_RUNTIME_KEY] === "number"
      ? runtimeState[AGENT_TERMINAL_HISTORY_REFRESH_RUNTIME_KEY]
      : null;

  const prompt = useMemo(() => buildAgentTerminalPrompt(sessionId), [sessionId]);
  const historyRefreshMode = normalizedProps.historyRefreshMode ?? "workspace";
  const historyRefreshIntervalSeconds =
    normalizedProps.historyRefreshIntervalSeconds ??
    DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS;
  const promptOnRefresh = useMemo(
    () => resolveAgentTerminalRefreshPrompt(normalizedProps),
    [normalizedProps],
  );
  const upstreamContexts = useMemo(
    () => resolveAgentTerminalUpstreamContexts(resolvedInputs),
    [resolvedInputs],
  );
  const automatedRefreshInput = useMemo(
    () =>
      buildAgentTerminalRefreshRequest({
        prompt: promptOnRefresh,
        upstreamContexts,
      }),
    [promptOnRefresh, upstreamContexts],
  );
  const terminalTitle = useMemo(() => {
    if (instanceTitle?.trim()) {
      return instanceTitle.trim();
    }

    return buildAgentTerminalSessionWidgetTitle({
      agentName: sessionState?.agentName,
      sessionId: sessionState?.sessionId ?? sessionId,
    });
  }, [instanceTitle, sessionId, sessionState?.agentName, sessionState?.sessionId]);

  const commitRuntimeState = useCallback(
    (patch: Record<string, unknown> | undefined) => {
      const base =
        runtimeStateRef.current &&
        typeof runtimeStateRef.current === "object" &&
        !Array.isArray(runtimeStateRef.current)
          ? runtimeStateRef.current
          : {};

      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return Object.keys(base).length > 0 ? { ...base } : undefined;
      }

      const nextState = {
        ...base,
        ...patch,
      };

      for (const [key, value] of Object.entries(nextState)) {
        if (value === undefined) {
          delete nextState[key];
        }
      }

      const resolvedState = Object.keys(nextState).length > 0 ? nextState : undefined;
      runtimeStateRef.current = resolvedState;
      onRuntimeStateChange?.(resolvedState);
      return resolvedState;
    },
    [onRuntimeStateChange],
  );

  const publishLatestAssistantMarkdown = useCallback(
    async ({
      markdown,
      triggerDownstream = false,
    }: {
      markdown: string | null | undefined;
      triggerDownstream?: boolean;
    }) => {
      const nextMarkdown = typeof markdown === "string" && markdown.trim() ? markdown : undefined;
      const previousMarkdown = resolveAgentTerminalLatestAssistantMarkdown(runtimeStateRef.current);

      if (previousMarkdown === nextMarkdown) {
        return;
      }

      const nextRuntimeState = commitRuntimeState({
        [AGENT_TERMINAL_LATEST_ASSISTANT_MARKDOWN_RUNTIME_KEY]: nextMarkdown,
        [AGENT_TERMINAL_LATEST_ASSISTANT_UPDATED_AT_RUNTIME_KEY]:
          nextMarkdown ? new Date().toISOString() : undefined,
      });

      if (!triggerDownstream || !instanceId || !widgetExecution) {
        return;
      }

      await widgetExecution.executeWidgetFlow(instanceId, {
        reason: "manual-recalculate",
        targetOverrides: {
          runtimeState: nextRuntimeState,
        },
      });
    },
    [commitRuntimeState, instanceId, widgetExecution],
  );

  const focusPromptInput = useCallback((attempts = 6, initialDelayMs = 0) => {
    if (typeof window === "undefined") {
      return () => {};
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const attemptFocus = (attempt: number) => {
      const delay = attempt === 0 ? initialDelayMs : 120;

      timeoutId = window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        const terminalViewport =
          containerRef.current?.querySelector<HTMLDivElement>(".react-terminal");
        const input = containerRef.current?.querySelector<HTMLInputElement>(".terminal-hidden-input");

        if (terminalViewport) {
          terminalViewport.scrollTop = terminalViewport.scrollHeight;
        }

        if (!input) {
          if (attempt + 1 < attempts) {
            attemptFocus(attempt + 1);
          }
          return;
        }

        if (input.disabled) {
          return;
        }

        input.focus({ preventScroll: true });

        const cursorPosition = input.value.length;
        input.setSelectionRange(cursorPosition, cursorPosition);

        if (document.activeElement !== input && attempt + 1 < attempts) {
          attemptFocus(attempt + 1);
        }
      }, delay);
    };

    attemptFocus(0);

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const syncPromptViewport = useCallback(() => {
    if (typeof window === "undefined") {
      return () => {};
    }

    let frameId = 0;

    const run = () => {
      const terminalViewport =
        containerRef.current?.querySelector<HTMLDivElement>(".react-terminal");

      if (terminalViewport) {
        terminalViewport.scrollTop = terminalViewport.scrollHeight;
      }
    };

    frameId = window.requestAnimationFrame(() => {
      run();
      frameId = window.requestAnimationFrame(run);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const appendLine = useCallback((line: AgentTerminalLine) => {
    setLines((current) => [...current, line]);
  }, []);

  const appendOutputDelta = useCallback((text: string) => {
    if (!text) {
      return;
    }

    setLines((current) => {
      const activeOutputLineId = activeOutputLineIdRef.current;

      if (activeOutputLineId) {
        const nextLines = [...current];
        const activeIndex = nextLines.findIndex((line) => line.id === activeOutputLineId);

        if (activeIndex >= 0) {
          nextLines[activeIndex] = {
            ...nextLines[activeIndex],
            text: `${nextLines[activeIndex].text}${text}`,
          };
          return nextLines;
        }
      }

      const nextLine = createAgentTerminalOutputLine({ text });
      activeOutputLineIdRef.current = nextLine.id;
      return [...current, nextLine];
    });
  }, []);

  const hydrateSession = useCallback(
    async (
      targetSessionId: string,
      {
        fallbackLatestAssistantMarkdown,
        publishLatestAssistantOutput = false,
        showLoading,
      }: {
        showLoading: boolean;
        publishLatestAssistantOutput?: boolean;
        fallbackLatestAssistantMarkdown?: string | null;
      },
    ) => {
      loadControllerRef.current?.abort();
      const controller = new AbortController();
      loadControllerRef.current = controller;

      if (showLoading) {
        setLines(buildAgentTerminalLoadingLines(targetSessionId));
        setSessionState(null);
        sessionStateRef.current = null;
        focusPromptInput(6, 20);
      }

      try {
        const [historyResult, toolsResult] = await Promise.allSettled([
          fetchSessionHistory({
            sessionId: targetSessionId,
            signal: controller.signal,
            token: sessionToken,
            tokenType: sessionTokenType,
          }),
          fetchSessionTools({
            sessionId: targetSessionId,
            signal: controller.signal,
            token: sessionToken,
            tokenType: sessionTokenType,
          }),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        if (historyResult.status !== "fulfilled") {
          throw historyResult.reason;
        }

        const currentSessionState = sessionStateRef.current;
        const history = historyResult.value;
        const tools =
          toolsResult.status === "fulfilled"
            ? toolsResult.value
            : null;
        const toolSummary =
          tools?.availableTools.length
            ? tools.availableTools.map((tool) => tool.toolKey).join(", ")
            : toolsResult.status === "rejected"
              ? currentSessionState?.toolSummary ?? "unavailable"
              : null;
        const nextSessionState: AgentTerminalSessionState = {
          agentName:
            history.session.agentName.trim() ||
            tools?.session.agentName.trim() ||
            currentSessionState?.agentName ||
            "Agent session",
          sessionId: targetSessionId,
          threadId: history.session.threadId ?? currentSessionState?.threadId ?? null,
          toolSummary,
        };

        setSessionState(nextSessionState);
        sessionStateRef.current = nextSessionState;
        setLines(
          buildAgentTerminalSessionLines({
            messages: history.messages,
            prompt: buildAgentTerminalPrompt(targetSessionId),
            session: nextSessionState,
            sessionError: history.session.status === "error" ? history.session.error : null,
          }),
        );
        await publishLatestAssistantMarkdown({
          markdown: extractLatestAssistantMarkdown(history.messages),
          triggerDownstream: publishLatestAssistantOutput,
        });
        focusPromptInput(8, 40);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const detail =
          error instanceof Error ? error.message : "Failed to load the configured AgentSession.";

        setSessionState(null);
        sessionStateRef.current = null;
        setLines(buildAgentTerminalErrorLines(detail));

        if (publishLatestAssistantOutput && fallbackLatestAssistantMarkdown?.trim()) {
          await publishLatestAssistantMarkdown({
            markdown: fallbackLatestAssistantMarkdown,
            triggerDownstream: true,
          });
        }

        focusPromptInput(6, 40);
      }
    },
    [
      focusPromptInput,
      publishLatestAssistantMarkdown,
      sessionToken,
      sessionTokenType,
    ],
  );

  useEffect(() => {
    runtimeStateRef.current = runtimeState;
  }, [runtimeState]);

  useEffect(() => {
    const input = containerRef.current?.querySelector<HTMLInputElement>(".terminal-hidden-input");

    if (!input) {
      return;
    }

    input.disabled = isStreaming;

    if (isStreaming) {
      input.blur();
      return;
    }

    const cursorPosition = input.value.length;
    input.focus({ preventScroll: true });
    input.setSelectionRange(cursorPosition, cursorPosition);
  }, [isStreaming]);

  useEffect(() => {
    streamControllerRef.current?.abort();
    loadControllerRef.current?.abort();
    activeOutputLineIdRef.current = null;
    pendingHistoryRefreshRef.current = false;
    reasoningNoticeRef.current = false;
    receivedTextRef.current = false;
    setIsStreaming(false);

    if (!sessionId) {
      setSessionState(null);
      sessionStateRef.current = null;
      setLines(buildAgentTerminalPlaceholderLines());
      void publishLatestAssistantMarkdown({
        markdown: null,
      });
      focusPromptInput(6, 20);
      return;
    }

    focusPromptInput(6, 20);
    void hydrateSession(sessionId, { showLoading: true });

    return () => {
      streamControllerRef.current?.abort();
      loadControllerRef.current?.abort();
    };
  }, [hydrateSession, publishLatestAssistantMarkdown, sessionId]);

  const sendTerminalInput = useCallback(
    async ({
      rawInput,
      automated = false,
    }: {
      rawInput: string;
      automated?: boolean;
    }) => {
      const input = rawInput.trim();

      if (!input) {
        return;
      }

      if (isStreaming) {
        if (automated) {
          pendingHistoryRefreshRef.current = true;
          return;
        }

        appendLine(
          createAgentTerminalOutputLine({
            text: "[busy] Wait for the current response to finish.",
            tone: "muted",
          }),
        );
        return;
      }

      const activeSession = sessionStateRef.current;

      if (!sessionId || !activeSession) {
        if (automated) {
          pendingHistoryRefreshRef.current = true;

          if (sessionId) {
            void hydrateSession(sessionId, { showLoading: false });
          }

          return;
        }

        appendLine(
          createAgentTerminalOutputLine({
            text: "[unavailable] Load a valid AgentSession before sending terminal input.",
            tone: "danger",
          }),
        );
        return;
      }

      pendingHistoryRefreshRef.current = false;
      streamedAssistantTextRef.current = "";
      appendLine(
        createAgentTerminalInputLine({
          prompt,
          text: input,
        }),
      );
      setIsStreaming(true);
      reasoningNoticeRef.current = false;
      receivedTextRef.current = false;
      activeOutputLineIdRef.current = null;

      const controller = new AbortController();
      streamControllerRef.current = controller;

      try {
        await streamAgentSessionResponse({
          body: buildAgentSessionLiveRequestBody({
            agentName: activeSession.agentName,
            context: buildWidgetContext({
              instanceId,
              sessionId,
              title: terminalTitle,
              userId: sessionUserId,
            }),
            input,
            sessionId,
            threadId: activeSession.threadId ?? sessionId,
            userId: sessionUserId,
            workflowKey: activeSession.agentName,
          }),
          onChunk: (chunk) => {
            if (chunk.type === "text-delta") {
              const delta = extractChunkTextDelta(chunk);

              if (!delta) {
                return;
              }

              receivedTextRef.current = true;
              streamedAssistantTextRef.current = `${streamedAssistantTextRef.current}${delta}`;
              appendOutputDelta(delta);
              return;
            }

            if (chunk.type === "text-end" || chunk.type === "finish") {
              activeOutputLineIdRef.current = null;
              return;
            }

            if (
              (chunk.type === "reasoning-start" || chunk.type === "reasoning-delta") &&
              !reasoningNoticeRef.current &&
              !receivedTextRef.current
            ) {
              reasoningNoticeRef.current = true;
              appendLine(
                createAgentTerminalOutputLine({
                  text: "[thinking] agent is preparing a response...",
                  tone: "muted",
                }),
              );
              return;
            }

            if (chunk.type === "session_switch") {
              const nextAgentName = extractSessionSwitchAgentName(chunk);
              const nextThreadId = extractChunkThreadId(chunk);

              if (!nextAgentName && !nextThreadId) {
                return;
              }

              setSessionState((current) => {
                if (!current) {
                  return current;
                }

                const nextState = {
                  ...current,
                  agentName: nextAgentName ?? current.agentName,
                  threadId: nextThreadId ?? current.threadId,
                };
                sessionStateRef.current = nextState;
                return nextState;
              });

              if (nextAgentName) {
                appendLine(
                  createAgentTerminalOutputLine({
                    text: `[session] switched to ${nextAgentName}`,
                    tone: "muted",
                  }),
                );
              }
              return;
            }

            if (chunk.type === "error") {
              const errorText =
                typeof chunk.errorText === "string" && chunk.errorText.trim()
                  ? chunk.errorText.trim()
                  : "Assistant stream returned an error chunk.";
              appendLine(
                createAgentTerminalOutputLine({
                  text: `[error] ${errorText}`,
                  tone: "danger",
                }),
              );
            }
          },
          protocol: assistantProtocol,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (!controller.signal.aborted) {
          void hydrateSession(sessionId, {
            showLoading: false,
            publishLatestAssistantOutput: true,
            fallbackLatestAssistantMarkdown: streamedAssistantTextRef.current,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const detail =
          error instanceof Error ? error.message : "The agent terminal request failed.";
        appendLine(
          createAgentTerminalOutputLine({
            text: `[error] ${detail}`,
            tone: "danger",
          }),
        );
      } finally {
        if (streamControllerRef.current === controller) {
          streamControllerRef.current = null;
        }

        activeOutputLineIdRef.current = null;
        reasoningNoticeRef.current = false;
        receivedTextRef.current = false;
        streamedAssistantTextRef.current = "";
        setIsStreaming(false);
      }
    },
    [
      appendLine,
      appendOutputDelta,
      assistantProtocol,
      hydrateSession,
      instanceId,
      isStreaming,
      prompt,
      sessionId,
      sessionToken,
      sessionTokenType,
      sessionUserId,
      terminalTitle,
    ],
  );

  const requestRefreshAction = useCallback(
    (targetSessionId: string) => {
      if (!targetSessionId) {
        return;
      }

      if (isStreaming) {
        pendingHistoryRefreshRef.current = true;
        return;
      }

      if (automatedRefreshInput) {
        pendingHistoryRefreshRef.current = true;
        void sendTerminalInput({
          rawInput: automatedRefreshInput,
          automated: true,
        });
        return;
      }

      pendingHistoryRefreshRef.current = false;
      void hydrateSession(targetSessionId, { showLoading: false });
    },
    [automatedRefreshInput, hydrateSession, isStreaming, sendTerminalInput],
  );

  useEffect(() => {
    if (autoFocusNonce == null) {
      return;
    }

    return focusPromptInput(8, 80);
  }, [autoFocusNonce, focusPromptInput]);
  useEffect(() => {
    if (!sessionId) {
      observedHistoryRefreshSessionIdRef.current = null;
      hasObservedHistoryRefreshNonceRef.current = false;
      lastHistoryRefreshNonceRef.current = null;
      return;
    }

    if (observedHistoryRefreshSessionIdRef.current !== sessionId) {
      observedHistoryRefreshSessionIdRef.current = sessionId;
      hasObservedHistoryRefreshNonceRef.current = false;
      lastHistoryRefreshNonceRef.current = null;
    }

    if (!hasObservedHistoryRefreshNonceRef.current) {
      hasObservedHistoryRefreshNonceRef.current = true;
      lastHistoryRefreshNonceRef.current =
        typeof historyRefreshNonce === "number" ? historyRefreshNonce : null;
      return;
    }

    if (typeof historyRefreshNonce !== "number") {
      return;
    }

    if (lastHistoryRefreshNonceRef.current === historyRefreshNonce) {
      return;
    }

    lastHistoryRefreshNonceRef.current = historyRefreshNonce;
    requestRefreshAction(sessionId);
  }, [historyRefreshNonce, requestRefreshAction, sessionId]);
  useEffect(() => {
    if (historyRefreshMode !== "interval" || !sessionId || typeof window === "undefined") {
      return;
    }

    const timerId = window.setInterval(() => {
      requestRefreshAction(sessionId);
    }, historyRefreshIntervalSeconds * 1_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [
    historyRefreshIntervalSeconds,
    historyRefreshMode,
    requestRefreshAction,
    sessionId,
  ]);
  useEffect(() => {
    if (!sessionId || isStreaming || !pendingHistoryRefreshRef.current) {
      return;
    }

    requestRefreshAction(sessionId);
  }, [
    isStreaming,
    automatedRefreshInput,
    requestRefreshAction,
    sessionId,
    sessionState?.sessionId,
  ]);
  useLayoutEffect(
    () => syncPromptViewport(),
    [autoFocusNonce, isStreaming, lines.length, sessionId, sessionState?.sessionId, syncPromptViewport],
  );

  const handleInput = useCallback(
    async (rawInput: string) => {
      await sendTerminalInput({
        rawInput,
      });
    },
    [sendTerminalInput],
  );

  const renderedLines = useMemo(
    () =>
      lines.map((line) =>
        line.kind === "input" ? (
          <TerminalInput key={line.id} prompt={line.prompt}>
            {line.text}
          </TerminalInput>
        ) : (
          <TerminalOutput key={line.id}>
            <span className={resolveOutputTextClassName(line.tone)}>{line.text}</span>
          </TerminalOutput>
        ),
      ),
    [lines],
  );

  return (
    <div ref={containerRef} className="ms-agent-terminal-widget">
      <div className="ms-agent-terminal-window">
        <Terminal
          colorMode={ColorMode.Dark}
          height="100%"
          prompt={prompt}
          onInput={handleInput}
          TopButtonsPanel={TerminalChromeHidden}
        >
          {renderedLines}
        </Terminal>
      </div>
    </div>
  );
}
