import { useEffect, useState } from "react";

import { ArrowUpRight, Bot, Loader2, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { useAuthStore } from "@/auth/auth-store";
import { WidgetSettingFieldLabel } from "@/widgets/shared/widget-setting-help";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { getAgentSessionDetailPath } from "../../agent-session-detail/routes";
import { startNewAgentSessionRequest } from "../../runtime/agent-sessions-api";
import { AgentTerminalAgentPicker } from "./AgentTerminalAgentPicker";
import {
  getAgentTerminalAllowedAgentsLabel,
  isAgentTerminalAllowedAgentName,
} from "./agentTerminalAgents";
import {
  DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS,
  buildAgentTerminalPrompt,
  normalizeAgentTerminalWidgetProps,
  resolveAgentTerminalRefreshPrompt,
  resolveAgentTerminalUpstreamSources,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";
import {
  buildAgentTerminalSessionWidgetTitle,
  buildAgentTerminalWidgetTitle,
} from "./agentTerminalWorkspace";

export function AgentTerminalWidgetSettings({
  widget,
  instanceTitle,
  draftProps,
  editable,
  onDraftPropsChange,
  onInstanceTitleChange,
  resolvedInputs,
}: WidgetSettingsComponentProps<AgentTerminalWidgetProps>) {
  const { toast } = useToast();
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const normalizedProps = normalizeAgentTerminalWidgetProps(draftProps);
  const agentId = normalizedProps.agentId ?? "";
  const agentName = normalizedProps.agentName ?? "";
  const sessionId = normalizedProps.agentSessionId ?? "";
  const previewPrompt = buildAgentTerminalPrompt(sessionId || "session");
  const blockUserInput = normalizedProps.blockUserInput === true;
  const loadInitialHistory = normalizedProps.loadInitialHistory === true;
  const historyRefreshMode = normalizedProps.historyRefreshMode ?? "workspace";
  const historyRefreshIntervalSeconds =
    normalizedProps.historyRefreshIntervalSeconds ??
    DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS;
  const promptOnRefresh = normalizedProps.promptOnRefresh ?? "";
  const effectivePromptOnRefresh = resolveAgentTerminalRefreshPrompt(normalizedProps);
  const upstreamSourceCount = resolveAgentTerminalUpstreamSources(resolvedInputs).length;
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(!sessionId);
  const currentAgentAllowed = isAgentTerminalAllowedAgentName(agentName);
  const canRecycleSession =
    editable && !isCreatingSession && currentAgentAllowed && /^\d+$/.test(agentId);

  useEffect(() => {
    if (sessionId) {
      setShowAgentPicker(false);
    }
  }, [sessionId]);

  function shouldReplaceTitle(nextPreviousSessionId: string, nextAgentName: string) {
    const trimmedTitle = instanceTitle.trim();

    return (
      !trimmedTitle ||
      trimmedTitle === widget.title ||
      trimmedTitle.startsWith("Agent Terminal (") ||
      (nextPreviousSessionId && trimmedTitle.endsWith(`(${nextPreviousSessionId})`)) ||
      trimmedTitle === `${nextAgentName} Terminal`
    );
  }

  function handleClearBinding() {
    onDraftPropsChange({
      ...normalizedProps,
      agentId: undefined,
      agentName: undefined,
      agentSessionId: undefined,
    });

    if (shouldReplaceTitle(sessionId, agentName)) {
      onInstanceTitleChange(buildAgentTerminalWidgetTitle());
    }

    setSelectionError(null);
    setShowAgentPicker(true);
  }

  async function createManagedSession({
    agentId: nextAgentId,
    agentName: nextAgentName,
  }: {
    agentId: number;
    agentName: string;
  }) {
    if (isCreatingSession) {
      return;
    }

    setIsCreatingSession(true);
    setSelectionError(null);

    try {
      const { sessionId: nextSessionId } = await startNewAgentSessionRequest({
        agentId: nextAgentId,
        createdByUser: sessionUserId ?? "",
        token: sessionToken,
        tokenType: sessionTokenType,
      });

      onDraftPropsChange({
        ...normalizedProps,
        agentId: String(nextAgentId),
        agentName: nextAgentName,
        agentSessionId: nextSessionId,
      });

      if (shouldReplaceTitle(sessionId, nextAgentName)) {
        onInstanceTitleChange(
          buildAgentTerminalSessionWidgetTitle({
            agentName: nextAgentName,
            sessionId: nextSessionId,
          }),
        );
      }

      setShowAgentPicker(false);
      toast({
        title: "Agent session created",
        description: `${nextAgentName} session ${nextSessionId} is now bound to this widget.`,
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create a new agent session.";

      setSelectionError(message);
      toast({
        title: "Agent session creation failed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsCreatingSession(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Main Sequence AI</Badge>
        <Badge variant="neutral">Terminal</Badge>
        <Badge variant="neutral">Managed session</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Select one supported agent. The widget creates and owns a fresh AgentSession automatically,
        then renders that conversation through a terminal shell instead of chat bubbles.
      </div>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Agent</div>
          <p className="mt-1 text-sm text-muted-foreground">
            This widget does not browse existing sessions. Selecting an allowed agent immediately
            creates a new session and binds the widget to it.
          </p>
        </div>

        {sessionId ? (
          <section className="rounded-[calc(var(--radius)-2px)] border border-border/70 bg-background/26 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Current binding
                </div>
                <div className="text-sm font-medium text-foreground">
                  {agentName || "Agent session"}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral" className="border border-border/70 bg-card/55">
                    Agent id {agentId || "unknown"}
                  </Badge>
                  <Link
                    to={getAgentSessionDetailPath(sessionId)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Session {sessionId}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                {!currentAgentAllowed ? (
                  <div className="text-xs text-muted-foreground">
                    This existing widget session still works, but new managed sessions are restricted
                    to {getAgentTerminalAllowedAgentsLabel()}.
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canRecycleSession}
                  onClick={() => {
                    void createManagedSession({
                      agentId: Number(agentId),
                      agentName,
                    });
                  }}
                >
                  {isCreatingSession ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-3.5 w-3.5" />
                  )}
                  Recycle session
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!editable || isCreatingSession}
                  onClick={() => {
                    handleClearBinding();
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {isCreatingSession ? (
          <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating a fresh session for the selected agent
          </div>
        ) : null}

        {selectionError ? (
          <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-4 text-sm text-danger">
            {selectionError}
          </div>
        ) : null}

        {!sessionId || showAgentPicker ? (
          <AgentTerminalAgentPicker
            editable={editable && !isCreatingSession}
            onSelect={(agent) => {
              void createManagedSession({
                agentId: agent.id,
                agentName: agent.name,
              });
            }}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <label className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-3 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            checked={loadInitialHistory}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...normalizedProps,
                loadInitialHistory: event.target.checked,
              });
            }}
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-topbar-foreground">
              Load initial history
            </span>
            <span className="block text-sm text-muted-foreground">
              Off by default. When disabled, the widget makes no assistant runtime request on mount;
              it only calls the runtime after manual terminal input, an automated refresh prompt, or
              an explicit history refresh.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <label className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-3 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            checked={blockUserInput}
            disabled={!editable}
            onChange={(event) => {
              onDraftPropsChange({
                ...normalizedProps,
                blockUserInput: event.target.checked,
              });
            }}
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-topbar-foreground">
              <WidgetSettingFieldLabel help="Disable manual typing in the terminal. The session still validates, refresh actions still run, and any saved Prompt on refresh can still be sent automatically.">
                Block user input
              </WidgetSettingFieldLabel>
            </span>
            <span className="block text-sm text-muted-foreground">
              Keep the terminal read-only for manual typing. The prompt remains visible, and
              refresh-driven actions can still reload history or send the saved refresh prompt.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">History refresh</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Control when the widget reloads session history after mount. Initial history loading is
            controlled separately above.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-topbar-foreground">Refresh mode</span>
            <Select
              value={historyRefreshMode}
              disabled={!editable}
              onChange={(event) => {
                const nextMode = event.target.value as AgentTerminalWidgetProps["historyRefreshMode"];

                onDraftPropsChange({
                  ...normalizedProps,
                  historyRefreshMode: nextMode,
                  ...(nextMode === "interval"
                    ? { historyRefreshIntervalSeconds }
                    : {}),
                });
              }}
            >
              <option value="workspace">With workspace</option>
              <option value="interval">Custom interval</option>
              <option value="never">Never</option>
            </Select>
          </label>

          {historyRefreshMode === "interval" ? (
            <label className="space-y-2">
              <span className="text-sm font-medium text-topbar-foreground">Interval seconds</span>
              <Input
                type="number"
                min={5}
                max={3600}
                step={1}
                value={String(historyRefreshIntervalSeconds)}
                disabled={!editable}
                onChange={(event) => {
                  const rawValue = event.target.value.trim();
                  const nextValue =
                    rawValue === ""
                      ? DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS
                      : Number(rawValue);

                  onDraftPropsChange({
                    ...normalizedProps,
                    historyRefreshMode: "interval",
                    historyRefreshIntervalSeconds: nextValue,
                  });
                }}
              />
            </label>
          ) : (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-3 py-3 text-sm text-muted-foreground">
              {historyRefreshMode === "workspace"
                ? "The widget listens to workspace refresh and refresh-interval cycles."
                : "Automatic history refresh is disabled."}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Prompt on refresh</div>
          <p className="mt-1 text-sm text-muted-foreground">
            When set, every refresh sends this Markdown prompt to the session instead of only
            reloading history. Bound upstream widget context or workspace references from the
            Bindings tab are appended to this saved prompt during automated refresh.
          </p>
        </div>

        <Textarea
          value={promptOnRefresh}
          readOnly={!editable}
          spellCheck={false}
          placeholder={"## Refresh instruction\n\nSummarize what changed since the last refresh."}
          className="min-h-[220px] font-mono text-xs leading-6"
          onChange={(event) => {
            onDraftPropsChange({
              ...normalizedProps,
              promptOnRefresh: event.target.value,
            });
          }}
        />
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Preview</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Streamed replies render as terminal output blocks while the prompt stays tied to the
            configured session.
          </p>
        </div>

        <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/24">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            Terminal preview
          </div>
          <div className="space-y-2 px-4 py-4 font-mono text-xs leading-6 text-foreground">
            <div className="text-muted-foreground">
              {sessionId
                ? `[session] ${agentName || "AgentSession"} is bound to ${sessionId}`
                : "[configure] Select a supported agent to create the widget session."}
            </div>
            <div className="text-muted-foreground">
              {loadInitialHistory
                ? "[initial-load] Session history loads when the widget mounts."
                : "[initial-load] No runtime request is sent when the widget mounts."}
            </div>
            <div className="text-muted-foreground">
              {blockUserInput
                ? "[input] Manual typing is blocked; only refresh-driven actions can send prompts."
                : "[input] Manual typing is enabled."}
            </div>
            <div className="text-muted-foreground">
              {historyRefreshMode === "workspace"
                ? "[refresh] Session history reloads with workspace refresh."
                : historyRefreshMode === "interval"
                  ? `[refresh] Session history reloads every ${historyRefreshIntervalSeconds}s.`
                  : "[refresh] Automatic session-history reload is disabled."}
            </div>
            {effectivePromptOnRefresh ? (
              <div className="text-muted-foreground">
                [refresh-prompt] Refresh sends the configured Markdown prompt into the session.
              </div>
            ) : null}
            {upstreamSourceCount > 0 ? (
              <div className="text-muted-foreground">
                [bindings] {upstreamSourceCount} bound upstream source
                {upstreamSourceCount === 1 ? "" : "s"} will be appended on automated refresh.
              </div>
            ) : null}
            <div>
              {previewPrompt} inspect current workspace status
            </div>
            <div className="text-muted-foreground">
              Streaming output renders inline like a terminal command run.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
