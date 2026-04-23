import { Link } from "react-router-dom";

import { ArrowUpRight, Loader2, Wrench } from "lucide-react";

import { getAgentSessionDetailPath } from "../../agent-session-detail/routes";
import { useChatFeature } from "../../assistant-ui/ChatProvider";
import { RepoDiffTool } from "./components/RepoDiffTool";

export function SessionDetailRail() {
  const { activeSessionSummary } = useChatFeature();
  const hasBackendSession = Boolean(
    activeSessionSummary?.sessionDisplayId || activeSessionSummary?.runtimeSessionId,
  );

  if (!activeSessionSummary || !hasBackendSession) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="text-sm font-semibold text-foreground">Session Details & Insights</div>
          <div className="text-xs text-muted-foreground">
            Open the dedicated AgentSession detail screen and inspect runtime tools.
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-sm text-muted-foreground">
          No active session. The next conversation will start with the orchestrator.
        </div>
      </section>
    );
  }

  const sessionInsights = activeSessionSummary.sessionInsights;
  const detailPath = activeSessionSummary.sessionId
    ? getAgentSessionDetailPath(activeSessionSummary.sessionId)
    : null;
  const insightsSummary = activeSessionSummary.isLoadingInsights
    ? "Loading insights"
    : activeSessionSummary.insightsError
      ? "Insights unavailable"
      : sessionInsights?.model?.model || sessionInsights?.context?.status || "Open model, usage, and context details";
  const summaryCard = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
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
        <div className="pt-1 text-sm text-foreground">{insightsSummary}</div>
      </div>
      {detailPath ? (
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      ) : null}
    </div>
  );

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="text-sm font-semibold text-foreground">Session Details & Insights</div>
        <div className="text-xs text-muted-foreground">
          Open the dedicated AgentSession detail screen and inspect runtime tools.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {detailPath ? (
            <Link
              to={detailPath}
              className="group block w-full rounded-[16px] border border-border/60 bg-background/35 px-3 py-3 text-left transition-colors hover:bg-background/25"
            >
              {summaryCard}
            </Link>
          ) : (
            <div className="w-full rounded-[16px] border border-border/60 bg-background/35 px-3 py-3 text-left">
              {summaryCard}
            </div>
          )}

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
