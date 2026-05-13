import { Link } from "react-router-dom";

import { ArrowUpRight } from "lucide-react";

import { getAgentSessionDetailPath } from "../../agent-session-detail/routes";
import { useChatFeature } from "../../assistant-ui/ChatProvider";
import {
  AGENT_RUNTIME_IMAGE_DRIFT_NOTICE,
  shouldShowAgentRuntimeImageDriftWarning,
} from "../../image-drift";

function normalizeSessionSecondaryLabel({
  agentUniqueId,
  displayLabel,
  requestAgentType,
}: {
  agentUniqueId: string | null;
  displayLabel: string | null;
  requestAgentType: string | null;
}) {
  const normalizedRequestAgentType = requestAgentType?.trim() || null;
  const candidates = [displayLabel, agentUniqueId]
    .map((value) => value?.trim() || null)
    .filter((value): value is string => Boolean(value));

  return (
    candidates.find((value) => value !== normalizedRequestAgentType) ??
    null
  );
}

function buildInsightsSummaryLabel(activeSessionSummary: NonNullable<ReturnType<typeof useChatFeature>["activeSessionSummary"]>) {
  if (activeSessionSummary.llmModel) {
    return activeSessionSummary.llmModel;
  }

  const sessionInsights = activeSessionSummary.sessionInsights;

  if (activeSessionSummary.isLoadingInsights && !sessionInsights) {
    return "Loading insights";
  }

  if (activeSessionSummary.insightsError) {
    return "Insights unavailable";
  }

  if (sessionInsights?.hasInsights === false) {
    return "No persisted insights yet";
  }

  if (sessionInsights?.model?.model) {
    return sessionInsights.model.model;
  }

  switch (sessionInsights?.context?.status) {
    case "known":
      return "Context tracked";
    case "unknown_after_compaction":
      return "Context estimate recalculating";
    default:
      return "Open model, usage, and context details";
  }
}

function buildThinkingSummaryLabel(
  activeSessionSummary: NonNullable<ReturnType<typeof useChatFeature>["activeSessionSummary"]>,
) {
  return activeSessionSummary.llmThinking?.trim() || null;
}

export function SessionDetailRail() {
  const { activeSessionSummary, railExperience } = useChatFeature();
  const isProjectAgentRail = railExperience === "project-agent";
  const hasBackendSession = Boolean(
    activeSessionSummary?.sessionDisplayId || activeSessionSummary?.runtimeSessionId,
  );

  if (!activeSessionSummary || !hasBackendSession) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="text-sm font-semibold text-foreground">
            {isProjectAgentRail ? "Project Agent Session" : "Session Details & Insights"}
          </div>
          <div className="text-xs text-muted-foreground">
            {isProjectAgentRail
              ? "Open the dedicated AgentSession detail screen and inspect the project agent session."
              : "Open the dedicated AgentSession detail screen and inspect session details."}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-sm text-muted-foreground">
          {isProjectAgentRail
            ? "No active project-agent session. Launch it from the project header robot."
            : "No active session. The next conversation will start with the orchestrator."}
        </div>
      </section>
    );
  }

  const sessionInsights = activeSessionSummary.sessionInsights;
  const detailPath = activeSessionSummary.sessionId
    ? getAgentSessionDetailPath(activeSessionSummary.sessionId)
    : null;
  const insightsSummary = buildInsightsSummaryLabel(activeSessionSummary);
  const thinkingSummary = buildThinkingSummaryLabel(activeSessionSummary);
  const secondaryLabel = normalizeSessionSecondaryLabel({
    agentUniqueId: activeSessionSummary.agentUniqueId,
    displayLabel: activeSessionSummary.displayLabel,
    requestAgentType: activeSessionSummary.requestAgentType,
  });
  const summaryCard = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {isProjectAgentRail ? "Project Agent Session" : "Conversation With"}
        </div>
        <div className="font-mono text-sm font-semibold text-primary">
          {activeSessionSummary.requestAgentType}
        </div>
        {secondaryLabel ? (
          <div className="font-mono text-xs text-muted-foreground">
            {secondaryLabel}
          </div>
        ) : null}
        <div className="pt-1 text-sm text-foreground">{insightsSummary}</div>
        {thinkingSummary ? (
          <div className="font-mono text-xs text-muted-foreground">
            Thinking · {thinkingSummary}
          </div>
        ) : null}
      </div>
      {detailPath ? (
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      ) : null}
    </div>
  );
  const showImageDriftWarning = shouldShowAgentRuntimeImageDriftWarning(
    activeSessionSummary.imageDrift,
  );

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="text-sm font-semibold text-foreground">
          {isProjectAgentRail ? "Project Agent Session" : "Session Details & Insights"}
        </div>
        <div className="text-xs text-muted-foreground">
          {isProjectAgentRail
            ? "Open the dedicated AgentSession detail screen and inspect the project agent session."
            : "Open the dedicated AgentSession detail screen and inspect session details."}
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
          {showImageDriftWarning ? (
            <div className="rounded-[16px] border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
              {AGENT_RUNTIME_IMAGE_DRIFT_NOTICE}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
