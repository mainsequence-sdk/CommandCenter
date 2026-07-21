import { AlertTriangle, Bot, Expand, Settings2, Sparkles, X } from "lucide-react";

import { ChatThread } from "./components/ChatThread";
import { useChatFeature } from "./ChatProvider";

export function ChatOverlay({
  mode = "overlay",
  rightOffsetPx = 0,
}: {
  mode?: "overlay" | "docked";
  rightOffsetPx?: number;
}) {
  const {
    activeSessionSummary,
    closeRail,
    expandToPage,
    openDeploymentConfigurator,
    railExperience,
  } = useChatFeature();
  const isDocked = mode === "docked";
  const isProjectAgentRail = railExperience === "project-agent";
  const showDeploymentAction = !isProjectAgentRail && Boolean(activeSessionSummary);
  const activeRequestAgentType = activeSessionSummary?.requestAgentType?.trim().toLowerCase() || null;
  const isCommandCenterOrchestratorSession = activeSessionSummary
    ? activeSessionSummary.isDefaultCommandCenterSession || activeRequestAgentType === "astro-orchestrator"
    : false;
  const showDefaultSessionWarning = activeSessionSummary
    ? !isProjectAgentRail && !isCommandCenterOrchestratorSession
    : false;
  const warningLabel = activeSessionSummary
    ? activeSessionSummary.requestAgentType || "selected session"
    : "another session";
  const railTitle = isProjectAgentRail ? "Project Agent" : "Main Sequence AI";
  const railSubtitle = isProjectAgentRail
    ? "Direct session with this project's execution agent."
    : "Command Center assistant rail.";
  const activeSessionDisplayId =
    activeSessionSummary?.sessionDisplayId?.trim() ||
    activeSessionSummary?.sessionId?.trim() ||
    null;
  const activeSessionLabel = activeSessionSummary?.displayLabel?.trim() || null;
  const projectAgentSessionSummary = activeSessionDisplayId
    ? `Session ${activeSessionDisplayId}${activeSessionLabel ? ` · ${activeSessionLabel}` : ""}`
    : activeSessionLabel;

  return (
    <section
      style={!isDocked && rightOffsetPx > 0 ? { right: `${rightOffsetPx}px` } : undefined}
      className={
        isDocked
          ? "relative z-[100] flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_84%,transparent)_0%,color-mix(in_srgb,var(--card)_90%,transparent)_28%,color-mix(in_srgb,var(--background)_86%,transparent)_100%)] text-card-foreground backdrop-blur-3xl"
          : "fixed inset-y-0 right-0 z-[110] flex w-[min(540px,calc(100vw-10px))] flex-col overflow-hidden border-l border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_84%,transparent)_0%,color-mix(in_srgb,var(--card)_90%,transparent)_28%,color-mix(in_srgb,var(--background)_86%,transparent)_100%)] text-card-foreground shadow-[-26px_0_80px_rgba(0,0,0,0.28)] backdrop-blur-3xl"
      }
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_24%,transparent_100%)]" />
        <div
          className={
            isProjectAgentRail
              ? "absolute inset-y-0 left-0 w-8 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--accent)_18%,transparent)_0%,transparent_100%)]"
              : "absolute inset-y-0 left-0 w-8 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--primary)_18%,transparent)_0%,transparent_100%)]"
          }
        />
        <div
          className={
            isProjectAgentRail
              ? "absolute -left-24 top-[-60px] h-72 w-72 rounded-full bg-accent/12 blur-3xl"
              : "absolute -left-24 top-[-60px] h-72 w-72 rounded-full bg-primary/12 blur-3xl"
          }
        />
        <div
          className={
            isProjectAgentRail
              ? "absolute right-[-140px] top-1/3 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
              : "absolute right-[-140px] top-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl"
          }
        />
        <div className="absolute bottom-[-160px] left-[15%] h-72 w-72 rounded-full bg-topbar-foreground/6 blur-3xl" />
      </div>

      <div className="relative border-b border-border/70 px-6 pt-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div
                className={
                  isProjectAgentRail
                    ? "flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-foreground shadow-sm"
                    : "flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm"
                }
              >
                {isProjectAgentRail ? <Bot className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{railTitle}</div>
                <div className="text-xs text-muted-foreground">{railSubtitle}</div>
                {isProjectAgentRail && projectAgentSessionSummary ? (
                  <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-border/70 bg-background/55 px-2.5 py-1 text-[11px] text-muted-foreground">
                    <span className="truncate">{projectAgentSessionSummary}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showDeploymentAction ? (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/55 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Configure deployment"
                title="Configure deployment"
                onClick={openDeploymentConfigurator}
              >
                <Settings2 className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/55 px-3.5 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-muted/60"
              onClick={expandToPage}
            >
              <Expand className="h-3.5 w-3.5" />
              Expand
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/55 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="Close chat rail"
              onClick={closeRail}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showDefaultSessionWarning ? (
          <div className="mt-4 rounded-[16px] border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0">
                <div className="font-medium text-amber-200">Not using the default Command Center orchestrator</div>
                <div className="mt-1 text-xs leading-5 text-amber-100/85">
                  This rail is currently attached to <span className="font-mono">{warningLabel}</span>, not the default Command Center orchestrator session.
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-5 py-5">
        <ChatThread />
      </div>
    </section>
  );
}
