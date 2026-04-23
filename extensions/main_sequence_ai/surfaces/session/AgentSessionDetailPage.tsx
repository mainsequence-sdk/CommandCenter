import { useMemo, useState } from "react";

import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentSessionDetailSections } from "../../agent-session-detail/AgentSessionDetailSections";
import { AgentSessionInsightsSections } from "../../agent-session-detail/AgentSessionInsightsSections";
import { AgentSessionModelEditor } from "../../agent-session-detail/AgentSessionModelEditor";
import { useAgentSessionDetail } from "../../agent-session-detail/useAgentSessionDetail";
import { CHAT_PAGE_PATH } from "../../assistant-ui/chat-ui-store";

type SessionPageTab = "details" | "insights";

export function AgentSessionDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [activeTab, setActiveTab] = useState<SessionPageTab>("details");
  const sessionId = searchParams.get("session")?.trim() || "";
  const session = useMemo(
    () => (sessionId ? { id: sessionId } : null),
    [sessionId],
  );
  const {
    activeDetail,
    refreshSessionDetail,
    refreshSessionInsights,
  } = useAgentSessionDetail({
    enabled: Boolean(sessionId),
    session,
    token: sessionToken,
    tokenType: sessionTokenType,
  });
  const title =
    activeDetail?.core?.title ||
    activeDetail?.core?.agentName ||
    activeDetail?.core?.actorName ||
    activeDetail?.context.displayName ||
    activeDetail?.context.requestName ||
    "Agent Session";
  const subtitle = sessionId ? `Session ${sessionId}` : "Select a session from Chat or a widget.";

  return (
    <div className="h-[calc(100dvh-56px)] min-h-0 overflow-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Agent Session
            </div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigate(-1);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Link to={CHAT_PAGE_PATH}>
              <Button variant="outline">Open Chat</Button>
            </Link>
            {sessionId ? (
              <Button
                variant="outline"
                onClick={() => {
                  refreshSessionDetail();
                  refreshSessionInsights();
                }}
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            ) : null}
          </div>
        </div>

        {!sessionId ? (
          <div className="rounded-[20px] border border-border/60 bg-background/30 px-5 py-5 text-sm text-muted-foreground">
            No AgentSession id was provided. Open this page from a session link so the detail shell
            knows which backend session to load.
          </div>
        ) : null}

        {sessionId ? (
          <div className="space-y-6 rounded-[24px] border border-border/60 bg-background/25 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/35 p-1">
              {([
                { id: "details", label: "Session Details" },
                { id: "insights", label: "Session Insights" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    "flex-1 rounded-[12px] px-3 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-background/45 hover:text-foreground",
                  )}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "details" ? (
              <div className="space-y-6">
                <AgentSessionModelEditor
                  detail={activeDetail}
                  refreshSessionDetail={refreshSessionDetail}
                  refreshSessionInsights={refreshSessionInsights}
                />

                {activeDetail?.status === "loading" ? (
                  <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading AgentSession detail
                  </div>
                ) : null}

                {activeDetail?.status === "not_found" ? (
                  <div className="space-y-3 rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
                    <div className="font-medium">AgentSession not found.</div>
                    <div className="text-xs leading-5">
                      {activeDetail.detailError ||
                        "The selected AgentSession is no longer available in the backend."}
                    </div>
                    <div>
                      <Button size="sm" variant="outline" onClick={refreshSessionDetail}>
                        Retry detail lookup
                      </Button>
                    </div>
                  </div>
                ) : null}

                {activeDetail?.status === "error" ? (
                  <div className="space-y-3 rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-3 text-sm text-danger">
                    <div className="font-medium">Failed to load AgentSession detail.</div>
                    <div className="text-xs leading-5">
                      {activeDetail.detailError || "The detail request failed."}
                    </div>
                    <div>
                      <Button size="sm" variant="outline" onClick={refreshSessionDetail}>
                        Retry detail lookup
                      </Button>
                    </div>
                  </div>
                ) : null}

                {activeDetail?.status === "ready" ? (
                  <AgentSessionDetailSections detail={activeDetail} />
                ) : null}
              </div>
            ) : null}

            {activeTab === "insights" ? (
              <AgentSessionInsightsSections
                insights={activeDetail?.insights ?? null}
                isLoading={activeDetail?.isLoadingInsights === true}
                error={activeDetail?.insightsError ?? null}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
