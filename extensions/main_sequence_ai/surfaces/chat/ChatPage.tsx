import { useState } from "react";

import {
  ArrowLeft,
  Eye,
  Loader2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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

function getRunStatusClasses(status: "idle" | "queued" | "thinking" | "responding" | "complete" | "error") {
  switch (status) {
    case "thinking":
    case "responding":
      return "border-primary/25 bg-primary/10 text-primary";
    case "complete":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-500";
    case "error":
      return "border-danger/25 bg-danger/10 text-danger";
    case "queued":
      return "border-warning/25 bg-warning/10 text-warning";
    default:
      return "border-border/70 bg-card/40 text-muted-foreground";
  }
}

export function ChatPage() {
  const navigate = useNavigate();
  const {
    activeAgentLabel,
    activeAgentName,
    activeSessionDisplayId,
    agentId,
    context,
    createAgentSession,
    minimizeToOverlay,
    runStatus,
  } = useChatFeature();
  const [contextOpen, setContextOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const contextPayload = JSON.stringify(context, null, 2);
  const busy = runStatus === "queued" || runStatus === "thinking" || runStatus === "responding";

  return (
    <div
      className={cn(
        "grid h-[calc(100dvh-56px)] min-h-0 gap-0",
        explorerOpen
          ? "grid-cols-[64px_320px_minmax(0,1fr)]"
          : "grid-cols-[64px_minmax(0,1fr)]",
      )}
    >
      <aside className="flex h-full min-h-0 flex-col items-center justify-between border-r border-border/60 px-2 py-4">
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[calc(var(--radius)-6px)] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-expanded={explorerOpen}
            aria-label={explorerOpen ? "Close sessions" : "Open sessions"}
            title={explorerOpen ? "Close sessions" : "Open sessions"}
            onClick={() => {
              setExplorerOpen((current) => !current);
            }}
          >
            {explorerOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[calc(var(--radius)-6px)] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-label="New session"
            title="New session"
            onClick={createAgentSession}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-[calc(var(--radius)-6px)] text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              contextOpen && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
            aria-expanded={contextOpen}
            aria-label={contextOpen ? "Hide context" : "Show context"}
            title={contextOpen ? "Hide context" : "Show context"}
            onClick={() => {
              setContextOpen((current) => !current);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-[calc(var(--radius)-6px)] border",
              getRunStatusClasses(runStatus),
            )}
            title={getRunStatusLabel(runStatus)}
            aria-label={getRunStatusLabel(runStatus)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[calc(var(--radius)-6px)] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-label="Go back"
            title="Go back"
            onClick={() => {
              navigate(-1);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[calc(var(--radius)-6px)] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-label="Minimize to overlay"
            title="Minimize to overlay"
            onClick={minimizeToOverlay}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {explorerOpen ? (
        <div className="h-full min-h-0 overflow-hidden border-r border-border/60">
          <AgentSessionRail />
        </div>
      ) : null}

      <section className="relative flex h-full min-h-0 flex-col overflow-hidden px-4">
        <div className="shrink-0 px-4 pt-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              Conversation with: <span className="font-mono text-primary">{activeAgentName}</span>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{activeAgentLabel}</div>
            {activeSessionDisplayId ? (
              <div className="mt-2 truncate text-sm font-medium text-foreground">
                <span className="font-mono">Session ID: {activeSessionDisplayId}</span>
              </div>
            ) : null}
            {agentId ? (
              <CardTitle className="mt-2 truncate text-base">
                <span className="font-mono">Agent ID: {agentId}</span>
              </CardTitle>
            ) : null}
          </div>
        </div>

        <div className="relative flex h-full min-h-0 flex-1 overflow-hidden pt-2">
          <ChatThread surface="page" />
        </div>

        {contextOpen ? (
          <div className="pointer-events-none absolute bottom-4 right-4 top-4 z-20 flex w-[min(24rem,calc(100vw-2rem))] justify-end">
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
