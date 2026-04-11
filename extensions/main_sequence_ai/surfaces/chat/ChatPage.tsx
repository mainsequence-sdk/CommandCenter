import { useState } from "react";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AgentSessionRail } from "../../assistant-ui/components/AgentSessionRail";
import { ChatThread } from "../../assistant-ui/components/ChatThread";
import { useChatFeature } from "../../assistant-ui/ChatProvider";

function getRunStatusLabel(status: "idle" | "queued" | "thinking" | "responding" | "complete" | "error") {
  switch (status) {
    case "queued":
      return "Queued";
    case "thinking":
      return "Thinking";
    case "responding":
      return "Responding";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function getRunStatusVariant(status: "idle" | "queued" | "thinking" | "responding" | "complete" | "error") {
  switch (status) {
    case "thinking":
    case "responding":
      return "primary" as const;
    case "complete":
      return "success" as const;
    case "error":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function ChatPage() {
  const navigate = useNavigate();
  const {
    activeAgentLabel,
    activeAgentName,
    activeSessionDisplayId,
    agentId,
    clearThread,
    context,
    createAgentSession,
    minimizeToOverlay,
    runStatus,
  } = useChatFeature();
  const [contextOpen, setContextOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const contextPayload = JSON.stringify(context, null, 2);
  const busy = runStatus === "queued" || runStatus === "thinking" || runStatus === "responding";

  return (
    <div
      className={cn(
        "grid h-[calc(100dvh-120px)] min-h-0 gap-0",
        explorerOpen ? "grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]" : "grid-cols-1",
      )}
    >
      {explorerOpen ? (
        <div className="h-full min-h-0 overflow-hidden border-r border-border/60 pr-4">
          <AgentSessionRail />
        </div>
      ) : null}

      <section className="relative flex min-h-0 flex-col overflow-hidden px-4">
        <div className="relative z-30 flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-2 pb-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              Conversation with: <span className="font-mono text-primary">{activeAgentName}</span>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{activeAgentLabel}</div>
            <div className="mt-2 truncate text-sm font-medium text-foreground">
              {activeSessionDisplayId ? (
                <span className="font-mono">Session ID: {activeSessionDisplayId}</span>
              ) : (
                "Session pending assignment"
              )}
            </div>
            {agentId ? (
              <CardTitle className="mt-2 truncate text-base">
                <span className="font-mono">Agent ID: {agentId}</span>
              </CardTitle>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-[calc(var(--radius)-6px)] border-border/70 bg-card/40 px-4 text-sm font-medium text-foreground hover:bg-muted/50"
              aria-expanded={explorerOpen}
              onClick={() => {
                setExplorerOpen((current) => !current);
              }}
            >
              {explorerOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              Sessions
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-[calc(var(--radius)-6px)] border-border/70 bg-card/40 px-4 text-sm font-medium text-foreground hover:bg-muted/50"
              onClick={createAgentSession}
            >
              <Plus className="h-4 w-4" />
              New Session
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant={getRunStatusVariant(runStatus)}>{getRunStatusLabel(runStatus)}</Badge>
              {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/40 px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={clearThread}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-[calc(var(--radius)-6px)] border-border/70 bg-card/40 px-4 text-sm font-medium text-foreground hover:bg-muted/50"
              aria-expanded={contextOpen}
              onClick={() => {
                setContextOpen((current) => !current);
              }}
            >
              <Eye className="h-4 w-4" />
              Context
              {contextOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/40 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              onClick={() => {
                navigate(-1);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              onClick={minimizeToOverlay}
            >
              <Minimize2 className="h-4 w-4" />
              Minimize To Overlay
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 pt-3">
          <ChatThread surface="page" />
        </div>

        {contextOpen ? (
          <div className="pointer-events-none absolute bottom-3 right-4 top-24 z-20 flex w-[min(24rem,calc(100vw-2rem))] justify-end">
            <Card className="pointer-events-auto flex h-full min-h-0 w-full flex-col overflow-hidden border-border/70 shadow-[0_24px_64px_rgba(0,0,0,0.24)]">
              <CardHeader className="shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>Visible Context</CardTitle>
                    <CardDescription>
                      Raw context payload currently sent with chat requests.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setContextOpen(false);
                    }}
                    aria-label="Close context"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-hidden">
                <pre className="h-full overflow-auto rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/85 px-3 py-3 text-[11px] leading-5 text-foreground">
                  <code>{contextPayload}</code>
                </pre>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>
    </div>
  );
}
