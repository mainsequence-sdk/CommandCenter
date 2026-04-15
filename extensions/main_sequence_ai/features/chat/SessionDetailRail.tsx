import { useState } from "react";

import { ChevronDown, Loader2, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { useChatFeature } from "../../assistant-ui/ChatProvider";
import { RepoDiffTool } from "./components/RepoDiffTool";

function formatSessionTimestamp(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return `${value}%`;
}

function formatBoolean(value: boolean | null) {
  if (value === null) {
    return null;
  }

  return value ? "Enabled" : "Disabled";
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function SessionField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-sm text-foreground", mono && "font-mono text-[13px]")}>{value}</div>
    </div>
  );
}

export function SessionDetailRail() {
  const { activeSessionSummary } = useChatFeature();
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState(false);
  const [sessionInsightsOpen, setSessionInsightsOpen] = useState(false);
  const hasBackendSession = Boolean(
    activeSessionSummary?.sessionDisplayId || activeSessionSummary?.runtimeSessionId,
  );

  if (!activeSessionSummary || !hasBackendSession) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="text-sm font-semibold text-foreground">Session Details</div>
          <div className="text-xs text-muted-foreground">
            Inspect the currently selected conversation session.
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-sm text-muted-foreground">
          No active session. The next conversation will start with the orchestrator.
        </div>
      </section>
    );
  }

  const lastActivity = formatSessionTimestamp(activeSessionSummary.updatedAt);
  const sessionInsights = activeSessionSummary.sessionInsights;
  const usageTokens = sessionInsights?.usage?.tokens ?? null;
  const lastTurnTokens = sessionInsights?.lastTurn?.tokens ?? null;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="text-sm font-semibold text-foreground">Session Details</div>
        <div className="text-xs text-muted-foreground">
          Inspect the current conversation session.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Conversation With
            </div>
            <div className="font-mono text-sm font-semibold text-primary">
              {activeSessionSummary.requestName}
            </div>
            {activeSessionSummary.agentUniqueId ? (
              <div className="font-mono text-xs text-muted-foreground">
                {activeSessionSummary.agentUniqueId}
              </div>
            ) : null}
          </div>

          <section className="rounded-[16px] border border-border/60 bg-background/35">
            <button
              type="button"
              aria-expanded={sessionDetailsOpen}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              onClick={() => {
                setSessionDetailsOpen((current) => !current);
              }}
            >
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Session Metadata
                </div>
                <div className="mt-1 text-sm text-foreground">
                  Session ids, runtime state, and working context.
                </div>
              </div>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", sessionDetailsOpen && "rotate-180")}
              />
            </button>

            {sessionDetailsOpen ? (
              <div className="space-y-5 border-t border-border/60 px-3 py-3">
                <SessionField
                  label="Session ID"
                  value={activeSessionSummary.sessionDisplayId}
                  mono
                />
                <SessionField label="Agent ID" value={activeSessionSummary.agentId} mono />
                <SessionField label="Last Activity" value={lastActivity || null} />
                <SessionField label="Project ID" value={activeSessionSummary.projectId} mono />
                <SessionField
                  label="Runtime Session ID"
                  value={activeSessionSummary.runtimeSessionId}
                  mono
                />
                <SessionField label="Thread ID" value={activeSessionSummary.threadId} mono />
                <SessionField label="Session Key" value={activeSessionSummary.sessionKey} mono />
                <SessionField label="Working Directory" value={activeSessionSummary.cwd} mono />

                {activeSessionSummary.preview ? (
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Summary
                    </div>
                    <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3 text-sm leading-6 text-foreground">
                      {activeSessionSummary.preview}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-[16px] border border-border/60 bg-background/35">
            <button
              type="button"
              aria-expanded={sessionInsightsOpen}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              onClick={() => {
                setSessionInsightsOpen((current) => !current);
              }}
            >
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Session Insights
                </div>
                <div className="mt-1 text-sm text-foreground">
                  Model, usage, context pressure, and last-turn stats.
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  sessionInsightsOpen && "rotate-180",
                )}
              />
            </button>

            {sessionInsightsOpen ? (
              <div className="space-y-5 border-t border-border/60 px-3 py-3">
                {activeSessionSummary.isLoadingInsights ? (
                  <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading session insights
                  </div>
                ) : null}

                {!activeSessionSummary.isLoadingInsights && activeSessionSummary.insightsError ? (
                  <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
                    <div className="font-medium">Failed to load session insights.</div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">
                      {activeSessionSummary.insightsError}
                    </div>
                  </div>
                ) : null}

                {!activeSessionSummary.isLoadingInsights &&
                !activeSessionSummary.insightsError &&
                !sessionInsights ? (
                  <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
                    No session insights available for this session.
                  </div>
                ) : null}

                {!activeSessionSummary.isLoadingInsights &&
                !activeSessionSummary.insightsError &&
                sessionInsights ? (
                  <>
                    {sessionInsights.model ? (
                      <div className="space-y-4">
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Model
                        </div>
                        <div className="grid gap-4">
                          <SessionField label="Provider" value={sessionInsights.model.provider} />
                          <SessionField label="Model" value={sessionInsights.model.model} mono />
                          <SessionField
                            label="Reasoning Effort"
                            value={sessionInsights.model.reasoningEffort}
                          />
                          <SessionField
                            label="Context Window"
                            value={formatNumber(sessionInsights.model.contextWindow)}
                            mono
                          />
                          <SessionField
                            label="Max Output Tokens"
                            value={formatNumber(sessionInsights.model.maxOutputTokens)}
                            mono
                          />
                        </div>
                      </div>
                    ) : null}

                    {sessionInsights.usage ? (
                      <div className="space-y-4">
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Usage
                        </div>
                        <div className="grid gap-4">
                          <SessionField
                            label="User Messages"
                            value={formatNumber(sessionInsights.usage.userMessages)}
                            mono
                          />
                          <SessionField
                            label="Assistant Messages"
                            value={formatNumber(sessionInsights.usage.assistantMessages)}
                            mono
                          />
                          <SessionField
                            label="Assistant Turns"
                            value={formatNumber(sessionInsights.usage.assistantTurns)}
                            mono
                          />
                          <SessionField
                            label="Tool Calls"
                            value={formatNumber(sessionInsights.usage.toolCalls)}
                            mono
                          />
                          <SessionField
                            label="Tool Results"
                            value={formatNumber(sessionInsights.usage.toolResults)}
                            mono
                          />
                          <SessionField
                            label="Total Messages"
                            value={formatNumber(sessionInsights.usage.totalMessages)}
                            mono
                          />
                          <SessionField
                            label="Estimated Cost"
                            value={formatCurrency(sessionInsights.usage.estimatedCostUsd)}
                          />
                        </div>

                        {usageTokens ? (
                          <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3">
                            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Cumulative Tokens
                            </div>
                            <div className="mt-3 grid gap-3">
                              <SessionField label="Input" value={formatNumber(usageTokens.input)} mono />
                              <SessionField label="Output" value={formatNumber(usageTokens.output)} mono />
                              <SessionField
                                label="Cache Read"
                                value={formatNumber(usageTokens.cacheRead)}
                                mono
                              />
                              <SessionField
                                label="Cache Write"
                                value={formatNumber(usageTokens.cacheWrite)}
                                mono
                              />
                              <SessionField label="Total" value={formatNumber(usageTokens.total)} mono />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {sessionInsights.context ? (
                      <div className="space-y-4">
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Context
                        </div>

                        {sessionInsights.context.status === "unknown_after_compaction" ? (
                          <div className="rounded-[14px] border border-warning/30 bg-warning/8 px-3 py-3 text-sm text-warning-foreground">
                            Context usage was compacted recently. The current context estimate is not
                            trusted yet.
                          </div>
                        ) : null}

                        <div className="grid gap-4">
                          <SessionField label="Status" value={sessionInsights.context.status} />
                          <SessionField label="Source" value={sessionInsights.context.source} />
                          <SessionField
                            label="Context Tokens"
                            value={formatNumber(sessionInsights.context.tokens)}
                            mono
                          />
                          <SessionField
                            label="Context Window"
                            value={formatNumber(sessionInsights.context.contextWindow)}
                            mono
                          />
                          <SessionField
                            label="Window Used"
                            value={formatPercent(sessionInsights.context.percentOfContextWindow)}
                          />
                          <SessionField
                            label="Compaction"
                            value={formatBoolean(sessionInsights.context.compactionEnabled)}
                          />
                          <SessionField
                            label="Reserve Tokens"
                            value={formatNumber(sessionInsights.context.compactionReserveTokens)}
                            mono
                          />
                          <SessionField
                            label="Threshold Tokens"
                            value={formatNumber(sessionInsights.context.compactionThresholdTokens)}
                            mono
                          />
                          <SessionField
                            label="Remaining Before Compaction"
                            value={formatNumber(sessionInsights.context.tokensRemainingBeforeCompaction)}
                            mono
                          />
                          <SessionField
                            label="Remaining Before Limit"
                            value={formatNumber(sessionInsights.context.tokensRemainingBeforeContextLimit)}
                            mono
                          />
                          <SessionField
                            label="Latest Compaction"
                            value={sessionInsights.context.latestCompaction}
                            mono
                          />
                        </div>
                      </div>
                    ) : null}

                    {sessionInsights.lastTurn ? (
                      <div className="space-y-4">
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Last Turn
                        </div>
                        <div className="grid gap-4">
                          <SessionField
                            label="Completed At"
                            value={formatSessionTimestamp(sessionInsights.lastTurn.completedAt)}
                          />
                          <SessionField
                            label="Finish Reason"
                            value={sessionInsights.lastTurn.finishReason}
                          />
                          <SessionField
                            label="Error"
                            value={sessionInsights.lastTurn.errorMessage}
                          />
                          <SessionField
                            label="Provider"
                            value={sessionInsights.lastTurn.model.provider}
                          />
                          <SessionField
                            label="Model"
                            value={sessionInsights.lastTurn.model.model}
                            mono
                          />
                        </div>

                        {lastTurnTokens ? (
                          <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3">
                            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Last-Turn Tokens
                            </div>
                            <div className="mt-3 grid gap-3">
                              <SessionField
                                label="Input"
                                value={formatNumber(lastTurnTokens.input)}
                                mono
                              />
                              <SessionField
                                label="Output"
                                value={formatNumber(lastTurnTokens.output)}
                                mono
                              />
                              <SessionField
                                label="Cache Read"
                                value={formatNumber(lastTurnTokens.cacheRead)}
                                mono
                              />
                              <SessionField
                                label="Cache Write"
                                value={formatNumber(lastTurnTokens.cacheWrite)}
                                mono
                              />
                              <SessionField
                                label="Total"
                                value={formatNumber(lastTurnTokens.total)}
                                mono
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Available Tools
            </div>

            {activeSessionSummary.isLoadingTools ? (
              <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading session tools
              </div>
            ) : null}

            {!activeSessionSummary.isLoadingTools && activeSessionSummary.toolsError ? (
              <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
                <div className="font-medium">Failed to load available tools.</div>
                <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">
                  {activeSessionSummary.toolsError}
                </div>
              </div>
            ) : null}

            {!activeSessionSummary.isLoadingTools &&
            !activeSessionSummary.toolsError &&
            activeSessionSummary.availableTools.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
                No tools available for this session.
              </div>
            ) : null}

            {!activeSessionSummary.isLoadingTools &&
            !activeSessionSummary.toolsError &&
            activeSessionSummary.availableTools.length > 0
              ? activeSessionSummary.availableTools.map((tool) => (
                  tool.kind === "repo_diff" ? (
                    <RepoDiffTool key={`${tool.toolKey}:${tool.url}`} tool={tool} />
                  ) : (
                    <div
                      key={`${tool.toolKey}:${tool.url}`}
                      className="rounded-[16px] border border-border/60 bg-background/45 px-3 py-3"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Wrench className="h-4 w-4 text-primary" />
                        <span className="font-mono">{tool.toolKey}</span>
                      </div>
                      <div className="mt-2 break-all font-mono text-[11px] leading-5 text-muted-foreground">
                        {tool.url}
                      </div>
                    </div>
                  )
                ))
              : null}
          </div>
        </div>
      </div>
    </section>
  );
}
