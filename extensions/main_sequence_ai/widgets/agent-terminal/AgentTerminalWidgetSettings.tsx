import { Bot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { getAgentSessionRecordSessionId } from "../../runtime/agent-sessions-api";
import { AgentSessionCatalogPicker } from "../../features/chat/AgentSessionCatalogPicker";
import {
  DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS,
  buildAgentTerminalPrompt,
  normalizeAgentTerminalWidgetProps,
  resolveAgentTerminalRefreshPrompt,
  resolveAgentTerminalUpstreamContexts,
  type AgentTerminalWidgetProps,
} from "./agentTerminalModel";
import { buildAgentTerminalSessionWidgetTitle } from "./agentTerminalWorkspace";

export function AgentTerminalWidgetSettings({
  widget,
  instanceTitle,
  draftProps,
  editable,
  onDraftPropsChange,
  onInstanceTitleChange,
  resolvedInputs,
}: WidgetSettingsComponentProps<AgentTerminalWidgetProps>) {
  const normalizedProps = normalizeAgentTerminalWidgetProps(draftProps);
  const sessionId = normalizedProps.agentSessionId ?? "";
  const previewPrompt = buildAgentTerminalPrompt(sessionId || "session");
  const historyRefreshMode = normalizedProps.historyRefreshMode ?? "workspace";
  const historyRefreshIntervalSeconds =
    normalizedProps.historyRefreshIntervalSeconds ??
    DEFAULT_AGENT_TERMINAL_HISTORY_REFRESH_INTERVAL_SECONDS;
  const promptOnRefresh = normalizedProps.promptOnRefresh ?? "";
  const effectivePromptOnRefresh = resolveAgentTerminalRefreshPrompt(normalizedProps);
  const upstreamContextCount = resolveAgentTerminalUpstreamContexts(resolvedInputs).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">Main Sequence AI</Badge>
        <Badge variant="neutral">Terminal</Badge>
        <Badge variant="neutral">Agent session</Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Bind this widget to one existing AgentSession and render the conversation through a terminal
        shell instead of chat bubbles.
      </div>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">AgentSession id</div>
          <p className="mt-1 text-sm text-muted-foreground">
            The widget does not create sessions. Search for an agent first, then bind one of its
            existing sessions.
          </p>
        </div>

        <AgentSessionCatalogPicker
          currentSessionId={sessionId}
          editable={editable}
          onClear={() => {
            onDraftPropsChange({
              ...normalizedProps,
              agentSessionId: undefined,
            });
          }}
          onSelect={({ session }) => {
            const nextSessionId = getAgentSessionRecordSessionId(session);

            onDraftPropsChange({
              ...normalizedProps,
              agentSessionId: nextSessionId,
            });

            if (
              !instanceTitle.trim() ||
              instanceTitle.trim() === widget.title ||
              instanceTitle.trim().startsWith("Agent Terminal (") ||
              (sessionId && instanceTitle.trim().endsWith(`(${sessionId})`))
            ) {
              onInstanceTitleChange(
                buildAgentTerminalSessionWidgetTitle({
                  agentName: session.actor_name || session.agent_name || undefined,
                  sessionId: nextSessionId,
                }),
              );
            }
          }}
        />
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">History refresh</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Control when the widget reloads session history after the initial mount.
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
                : "Automatic history refresh is disabled after the initial session load."}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Prompt on refresh</div>
          <p className="mt-1 text-sm text-muted-foreground">
            When set, every refresh sends this Markdown prompt to the session instead of only
            reloading history. Bound upstream widget context from the Bindings tab is appended to
            this saved prompt during automated refresh.
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
                ? `[session] Attached to AgentSession ${sessionId}`
                : "[configure] Select an agent and session to enable the widget."}
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
            {upstreamContextCount > 0 ? (
              <div className="text-muted-foreground">
                [context] {upstreamContextCount} bound widget context
                {upstreamContextCount === 1 ? "" : "s"} will be appended on automated refresh.
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
