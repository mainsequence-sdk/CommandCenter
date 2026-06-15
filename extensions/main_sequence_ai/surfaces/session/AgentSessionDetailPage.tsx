import { useMemo, useState } from "react";

import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { EntitySummaryHeader } from "../../../main_sequence/common/api";
import { MainSequenceEntitySummaryCard } from "../../../main_sequence/common/components/MainSequenceEntitySummaryCard";
import { AgentSessionDetailSections } from "../../agent-session-detail/AgentSessionDetailSections";
import { AgentSessionInsightsSections } from "../../agent-session-detail/AgentSessionInsightsSections";
import { AgentSessionModelEditor } from "../../agent-session-detail/AgentSessionModelEditor";
import { formatSessionTimestamp } from "../../agent-session-detail/sessionDetailUi";
import { useAgentSessionDetail } from "../../agent-session-detail/useAgentSessionDetail";
import { CHAT_PAGE_PATH } from "../../assistant-ui/chat-ui-store";

type SessionPageTab = "details" | "model" | "insights";

const sessionPageTabs: readonly { id: SessionPageTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "model", label: "Model" },
  { id: "insights", label: "Insights" },
];

function buildSessionSummary(detail: NonNullable<ReturnType<typeof useAgentSessionDetail>["activeDetail"]>): EntitySummaryHeader | null {
  const core = detail.core;

  if (!core) {
    return null;
  }

  const title =
    core.title ||
    detail.context.displayLabel ||
    detail.context.agentUniqueId ||
    "Agent Session";
  const handleUniqueId = core.boundHandle?.handleUniqueId ?? detail.context.handleUniqueId ?? null;

  return {
    entity: {
      id: detail.sessionId,
      type: "agent_session",
      title,
    },
    badges: [
      {
        key: "status",
        label: core.status || "Unknown status",
        tone: core.working || detail.context.working ? "warning" : "secondary",
      },
      ...(core.working || detail.context.working
        ? [
            {
              key: "working",
              label: "Working",
              tone: "warning",
            },
          ]
        : []),
      ...(handleUniqueId
        ? [
            {
              key: "bound_handle",
              label: "Bound handle",
              tone: "primary",
            },
          ]
        : []),
    ],
    inline_fields: [
      {
        key: "session_uid",
        label: "UID",
        value: core.sessionId,
        kind: "code",
      },
      {
        key: "handle_unique_id",
        label: "Handle",
        value: handleUniqueId,
        kind: "code",
      },
      {
        key: "agent_uid",
        label: "Agent UID",
        value: core.agentId || detail.context.agentId,
        kind: "code",
      },
      {
        key: "provider",
        label: "Provider",
        value: core.llmProvider,
        kind: "text",
      },
      {
        key: "model",
        label: "Model",
        value: core.llmModel,
        kind: "code",
      },
    ].filter((field) => field.value),
    highlight_fields: [
      {
        key: "runtime_state",
        label: "Runtime State",
        value: core.runtimeState || detail.context.runtimeState || "Not available",
        kind: "text",
      },
      {
        key: "started_at",
        label: "Started",
        value: formatSessionTimestamp(core.startedAt),
        kind: "text",
      },
      {
        key: "thread_id",
        label: "Thread UID",
        value: detail.context.threadId,
        kind: "code",
      },
    ].filter((field) => field.value),
    stats: [],
  };
}

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
  const summary = activeDetail?.status === "ready" ? buildSessionSummary(activeDetail) : null;
  const sessionTitle =
    summary?.entity.title || activeDetail?.core?.title || sessionId || "Agent Session";
  const sessionHandleUniqueId =
    activeDetail?.status === "ready"
      ? activeDetail.core?.boundHandle?.handleUniqueId ?? activeDetail.context.handleUniqueId ?? null
      : null;
  const headerSecondaryLabel = sessionHandleUniqueId
    ? `Handle ${sessionHandleUniqueId}`
    : sessionId
      ? `UID ${sessionId}`
      : null;
  const headerDescription =
    headerSecondaryLabel || "Inspect one backend AgentSession in the standard Main Sequence detail shell.";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Main Sequence AI"
        title={sessionTitle}
        description={headerDescription}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigate(-1);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Link to={CHAT_PAGE_PATH}>
              <Button type="button" variant="outline" size="sm">Open Chat</Button>
            </Link>
          </>
        }
      />

      {!sessionId ? (
        <Card>
          <CardContent className="py-5 text-sm text-muted-foreground">
            No AgentSession UID was provided. Open this page from a session link so the detail
            screen can resolve one backend session.
          </CardContent>
        </Card>
      ) : null}

      {activeDetail?.status === "loading" ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading AgentSession detail
          </CardContent>
        </Card>
      ) : null}

      {activeDetail?.status === "not_found" ? (
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              <div className="font-medium">AgentSession not found.</div>
              <div className="mt-1 text-xs leading-5">
                {activeDetail.detailError ||
                  "The selected AgentSession is no longer available in the backend."}
              </div>
            </div>
            <div>
              <Button size="sm" variant="outline" onClick={refreshSessionDetail}>
                Retry detail lookup
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeDetail?.status === "error" ? (
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              <div className="font-medium">Failed to load AgentSession detail.</div>
              <div className="mt-1 text-xs leading-5">
                {activeDetail.detailError || "The detail request failed."}
              </div>
            </div>
            <div>
              <Button size="sm" variant="outline" onClick={refreshSessionDetail}>
                Retry detail lookup
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? <MainSequenceEntitySummaryCard summary={summary} /> : null}

      {activeDetail?.status === "ready" ? (
        <Card>
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-wrap gap-2">
              {sessionPageTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    activeTab === tab.id
                      ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                      : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground",
                  )}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            {activeTab === "details" ? (
              <AgentSessionDetailSections detail={activeDetail} />
            ) : null}

            {activeTab === "model" ? (
              <AgentSessionModelEditor
                detail={activeDetail}
                refreshSessionDetail={refreshSessionDetail}
                refreshSessionInsights={refreshSessionInsights}
              />
            ) : null}

            {activeTab === "insights" ? (
              <AgentSessionInsightsSections
                insights={activeDetail?.insights ?? null}
                isLoading={activeDetail?.isLoadingInsights === true}
                error={activeDetail?.insightsError ?? null}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
