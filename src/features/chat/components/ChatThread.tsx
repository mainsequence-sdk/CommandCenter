import {
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useChatFeature } from "@/features/chat/ChatProvider";
import type { ChatRunStatus } from "@/features/chat/chat-backend-adapter";

interface ChatThreadProps {
  compact?: boolean;
}

function getRunStatusLabel(status: ChatRunStatus) {
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

function getRunStatusVariant(status: ChatRunStatus) {
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

function TextPart() {
  return (
    <MessagePartPrimitive.Text className="whitespace-pre-wrap break-words text-sm leading-6 text-current" />
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[88%] rounded-[22px] bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
        <MessagePrimitive.Parts components={{ Text: TextPart }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex items-start gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/85 text-primary shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="max-w-[92%] rounded-[22px] border border-border/70 bg-card/86 px-4 py-3 text-foreground shadow-sm backdrop-blur">
        <MessagePrimitive.Parts components={{ Text: TextPart }} />
        <MessagePrimitive.Error>
          <div className="mt-3 rounded-[calc(var(--radius)-8px)] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            <ErrorPrimitive.Root>
              <ErrorPrimitive.Message />
            </ErrorPrimitive.Root>
          </div>
        </MessagePrimitive.Error>
      </div>
    </MessagePrimitive.Root>
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-card/45 px-6 py-8 text-center backdrop-blur",
        compact ? "min-h-[220px]" : "min-h-[280px]",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-semibold text-foreground">Chat scaffold ready</div>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        This shell is isolated inside <code>src/features/chat/</code>. Replace the mock backend
        adapter when you are ready to stream real agent events.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <ThreadPrimitive.Suggestion
          send
          prompt="Summarize the current route context."
          className="rounded-full border border-border/70 bg-card/80 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          Summarize route
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion
          send
          prompt="List the action bridges still needed for this chat integration."
          className="rounded-full border border-border/70 bg-card/80 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          List action bridges
        </ThreadPrimitive.Suggestion>
      </div>
    </div>
  );
}

function StatusBanner({ compact = false }: { compact?: boolean }) {
  const { clearThread, runStatus, runStatusDetail, thinkingSummary } = useChatFeature();
  const busy = runStatus === "thinking" || runStatus === "responding" || runStatus === "queued";

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-start justify-between gap-3 rounded-[22px] border border-border/70 bg-card/72 px-4 py-3 backdrop-blur",
        compact && "px-3 py-2.5",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant={getRunStatusVariant(runStatus)}>{getRunStatusLabel(runStatus)}</Badge>
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
        {runStatusDetail ? (
          <div className="text-xs leading-5 text-muted-foreground">{runStatusDetail}</div>
        ) : null}
        {thinkingSummary ? (
          <div className="rounded-[calc(var(--radius)-8px)] border border-primary/20 bg-primary/8 px-3 py-2 text-xs leading-5 text-foreground">
            {thinkingSummary}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/55 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        onClick={clearThread}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
}

function Composer({ compact = false }: { compact?: boolean }) {
  return (
    <ComposerPrimitive.Root className="mt-4 rounded-[24px] border border-border/70 bg-card/80 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3">
        <ComposerPrimitive.Input
          rows={compact ? 3 : 4}
          placeholder="Ask about the visible view, action bridges, or backend event wiring..."
          className={cn(
            "w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground",
            compact ? "min-h-[72px]" : "min-h-[96px]",
          )}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">Shared runtime across page and overlay.</div>
          <ComposerPrimitive.Send className="inline-flex h-10 items-center justify-center rounded-[calc(var(--radius)-6px)] bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50">
            Send
          </ComposerPrimitive.Send>
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
}

export function ChatThread({ compact = false }: ChatThreadProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StatusBanner compact={compact} />

      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <ThreadPrimitive.Empty>
            <EmptyState compact={compact} />
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{
              AssistantMessage,
              UserMessage,
            }}
          />
        </ThreadPrimitive.Viewport>

        <Composer compact={compact} />
      </ThreadPrimitive.Root>
    </div>
  );
}
