import { Loader2 } from "lucide-react";

import type { SessionInsightsSnapshot } from "../assistant-ui/session-insights";
import { getSessionInsightsInfoNode } from "../assistant-ui/session-insights";
import {
  SessionField,
  SessionSection,
  formatBoolean,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSessionTimestamp,
} from "./sessionDetailUi";

export function AgentSessionInsightsSections({
  insights,
  isLoading,
  error,
}: {
  insights: SessionInsightsSnapshot | null;
  isLoading: boolean;
  error: string | null;
}) {
  const usageTokens = insights?.usage?.tokens ?? null;
  const lastTurnTokens = insights?.lastTurn?.tokens ?? null;
  const hasRenderableInsights =
    Boolean(insights?.model) ||
    Boolean(insights?.usage) ||
    Boolean(insights?.context) ||
    Boolean(insights?.lastTurn);
  const getInfo = (path: readonly string[]) => getSessionInsightsInfoNode(insights, path);
  const fieldLabel = (path: readonly string[], fallback: string) => getInfo(path)?.label || fallback;
  const fieldDescription = (path: readonly string[]) => getInfo(path)?.description || null;

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading session insights
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
          <div className="font-medium">Failed to load session insights.</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">{error}</div>
        </div>
      ) : null}

      {!isLoading && !error && !insights ? (
        <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
          No session insights available for this session.
        </div>
      ) : null}

      {!isLoading && !error && insights ? (
        <>
          {insights.model ? (
            <SessionSection title="Model Insights">
              <div className="grid gap-4 md:grid-cols-2">
                <SessionField
                  label={fieldLabel(["config", "model", "provider"], "Provider")}
                  description={fieldDescription(["config", "model", "provider"])}
                  value={insights.model.provider}
                />
                <SessionField
                  label={fieldLabel(["config", "model", "model"], "Model")}
                  description={fieldDescription(["config", "model", "model"])}
                  value={insights.model.model}
                  mono
                />
                <SessionField
                  label={fieldLabel(["config", "model", "reasoningEffort"], "Reasoning Effort")}
                  description={fieldDescription(["config", "model", "reasoningEffort"])}
                  value={insights.model.reasoningEffort}
                />
                <SessionField
                  label={fieldLabel(["config", "model", "contextWindow"], "Context Window")}
                  description={fieldDescription(["config", "model", "contextWindow"])}
                  value={formatNumber(insights.model.contextWindow)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["config", "model", "maxOutputTokens"], "Max Output Tokens")}
                  description={fieldDescription(["config", "model", "maxOutputTokens"])}
                  value={formatNumber(insights.model.maxOutputTokens)}
                  mono
                />
              </div>
            </SessionSection>
          ) : null}

          {insights.usage ? (
            <SessionSection title="Session Insights">
              <div className="grid gap-4 md:grid-cols-2">
                <SessionField
                  label={fieldLabel(["usage", "userMessages"], "User Messages")}
                  description={fieldDescription(["usage", "userMessages"])}
                  value={formatNumber(insights.usage.userMessages)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "assistantMessages"], "Assistant Messages")}
                  description={fieldDescription(["usage", "assistantMessages"])}
                  value={formatNumber(insights.usage.assistantMessages)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "assistantTurns"], "Assistant Turns")}
                  description={fieldDescription(["usage", "assistantTurns"])}
                  value={formatNumber(insights.usage.assistantTurns)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "toolCalls"], "Tool Calls")}
                  description={fieldDescription(["usage", "toolCalls"])}
                  value={formatNumber(insights.usage.toolCalls)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "toolResults"], "Tool Results")}
                  description={fieldDescription(["usage", "toolResults"])}
                  value={formatNumber(insights.usage.toolResults)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "totalMessages"], "Total Messages")}
                  description={fieldDescription(["usage", "totalMessages"])}
                  value={formatNumber(insights.usage.totalMessages)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["usage", "estimatedCostUsd"], "Estimated Cost")}
                  description={fieldDescription(["usage", "estimatedCostUsd"])}
                  value={formatCurrency(insights.usage.estimatedCostUsd)}
                />
              </div>

              {usageTokens ? (
                <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Cumulative Tokens
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "input"], "Input")}
                      description={fieldDescription(["usage", "tokens", "input"])}
                      value={formatNumber(usageTokens.input)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "output"], "Output")}
                      description={fieldDescription(["usage", "tokens", "output"])}
                      value={formatNumber(usageTokens.output)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "cacheRead"], "Cache Read")}
                      description={fieldDescription(["usage", "tokens", "cacheRead"])}
                      value={formatNumber(usageTokens.cacheRead)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "cacheWrite"], "Cache Write")}
                      description={fieldDescription(["usage", "tokens", "cacheWrite"])}
                      value={formatNumber(usageTokens.cacheWrite)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["usage", "tokens", "total"], "Total")}
                      description={fieldDescription(["usage", "tokens", "total"])}
                      value={formatNumber(usageTokens.total)}
                      mono
                    />
                  </div>
                </div>
              ) : null}
            </SessionSection>
          ) : null}

          {insights.context ? (
            <SessionSection title="Context">
              {insights.context.status === "unknown_after_compaction" ? (
                <div className="rounded-[14px] border border-warning/30 bg-warning/8 px-3 py-3 text-sm text-warning-foreground">
                  Context usage was compacted recently. The current context estimate is not trusted yet.
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <SessionField
                  label={fieldLabel(["context", "status"], "Status")}
                  description={fieldDescription(["context", "status"])}
                  value={insights.context.status}
                />
                <SessionField
                  label={fieldLabel(["context", "source"], "Source")}
                  description={fieldDescription(["context", "source"])}
                  value={insights.context.source}
                />
                <SessionField
                  label={fieldLabel(["context", "tokens"], "Context Tokens")}
                  description={fieldDescription(["context", "tokens"])}
                  value={formatNumber(insights.context.tokens)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "contextWindow"], "Context Window")}
                  description={fieldDescription(["context", "contextWindow"])}
                  value={formatNumber(insights.context.contextWindow)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "percentOfContextWindow"], "Window Used")}
                  description={fieldDescription(["context", "percentOfContextWindow"])}
                  value={formatPercent(insights.context.percentOfContextWindow)}
                />
                <SessionField
                  label={fieldLabel(["context", "compactionEnabled"], "Compaction")}
                  description={fieldDescription(["context", "compactionEnabled"])}
                  value={formatBoolean(insights.context.compactionEnabled)}
                />
                <SessionField
                  label={fieldLabel(["context", "compactionReserveTokens"], "Reserve Tokens")}
                  description={fieldDescription(["context", "compactionReserveTokens"])}
                  value={formatNumber(insights.context.compactionReserveTokens)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "compactionThresholdTokens"], "Threshold Tokens")}
                  description={fieldDescription(["context", "compactionThresholdTokens"])}
                  value={formatNumber(insights.context.compactionThresholdTokens)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "compactionThresholdPercent"], "Threshold Percent")}
                  description={fieldDescription(["context", "compactionThresholdPercent"])}
                  value={formatPercent(insights.context.compactionThresholdPercent)}
                />
                <SessionField
                  label={fieldLabel(["context", "tokensRemainingBeforeCompaction"], "Remaining Before Compaction")}
                  description={fieldDescription(["context", "tokensRemainingBeforeCompaction"])}
                  value={formatNumber(insights.context.tokensRemainingBeforeCompaction)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "tokensRemainingBeforeContextLimit"], "Remaining Before Limit")}
                  description={fieldDescription(["context", "tokensRemainingBeforeContextLimit"])}
                  value={formatNumber(insights.context.tokensRemainingBeforeContextLimit)}
                  mono
                />
                <SessionField
                  label={fieldLabel(["context", "latestCompaction"], "Latest Compaction")}
                  description={fieldDescription(["context", "latestCompaction"])}
                  value={insights.context.latestCompaction}
                  mono
                />
              </div>
            </SessionSection>
          ) : null}

          {insights.lastTurn ? (
            <SessionSection title="Last Turn">
              <div className="grid gap-4 md:grid-cols-2">
                <SessionField
                  label={fieldLabel(["lastTurn", "completedAt"], "Completed At")}
                  description={fieldDescription(["lastTurn", "completedAt"])}
                  value={formatSessionTimestamp(insights.lastTurn.completedAt)}
                />
                <SessionField
                  label={fieldLabel(["lastTurn", "finishReason"], "Finish Reason")}
                  description={fieldDescription(["lastTurn", "finishReason"])}
                  value={insights.lastTurn.finishReason}
                />
                <SessionField
                  label={fieldLabel(["lastTurn", "errorMessage"], "Error")}
                  description={fieldDescription(["lastTurn", "errorMessage"])}
                  value={insights.lastTurn.errorMessage}
                />
                <SessionField
                  label={fieldLabel(["lastTurn", "model", "provider"], "Provider")}
                  description={fieldDescription(["lastTurn", "model", "provider"])}
                  value={insights.lastTurn.model.provider}
                />
                <SessionField
                  label={fieldLabel(["lastTurn", "model", "model"], "Model")}
                  description={fieldDescription(["lastTurn", "model", "model"])}
                  value={insights.lastTurn.model.model}
                  mono
                />
              </div>

              {lastTurnTokens ? (
                <div className="rounded-[14px] border border-border/60 bg-background/45 px-3 py-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Last-Turn Tokens
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "input"], "Input")}
                      description={fieldDescription(["lastTurn", "tokens", "input"])}
                      value={formatNumber(lastTurnTokens.input)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "output"], "Output")}
                      description={fieldDescription(["lastTurn", "tokens", "output"])}
                      value={formatNumber(lastTurnTokens.output)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "cacheRead"], "Cache Read")}
                      description={fieldDescription(["lastTurn", "tokens", "cacheRead"])}
                      value={formatNumber(lastTurnTokens.cacheRead)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "cacheWrite"], "Cache Write")}
                      description={fieldDescription(["lastTurn", "tokens", "cacheWrite"])}
                      value={formatNumber(lastTurnTokens.cacheWrite)}
                      mono
                    />
                    <SessionField
                      label={fieldLabel(["lastTurn", "tokens", "total"], "Total")}
                      description={fieldDescription(["lastTurn", "tokens", "total"])}
                      value={formatNumber(lastTurnTokens.total)}
                      mono
                    />
                  </div>
                </div>
              ) : null}
            </SessionSection>
          ) : null}

          {!hasRenderableInsights ? (
            <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">
              Session insights loaded, but no renderable insight sections were returned by the backend.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
