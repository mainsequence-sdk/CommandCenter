import { useCallback, useEffect, useRef, useState } from "react";

import {
  ChainOfThoughtPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessagePartText,
  type ReasoningMessagePartProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { useAuiState } from "@assistant-ui/store";
import { ArrowUp, ChevronDown, Loader2, Sparkles, Trash2, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { env } from "@/config/env";
import { cn } from "@/lib/utils";
import type { ChatRunStatus } from "../chat-backend-adapter";
import { useChatFeature } from "../ChatProvider";

interface ChatThreadProps {
  compact?: boolean;
  surface?: "overlay" | "page";
}

interface ScrollRailState {
  isScrollable: boolean;
  thumbHeight: number;
  thumbTop: number;
}

const INITIAL_SCROLL_RAIL_STATE: ScrollRailState = {
  isScrollable: false,
  thumbHeight: 0,
  thumbTop: 0,
};

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function formatStructuredValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractToolTextContent(value: unknown) {
  if (!value || typeof value !== "object" || !("content" in value)) {
    return null;
  }

  const content = (value as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return null;
  }

  const textParts = content
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      if (!("type" in entry) || entry.type !== "text") {
        return [];
      }

      if (!("text" in entry) || typeof entry.text !== "string") {
        return [];
      }

      return [entry.text];
    })
    .join("\n\n")
    .trim();

  return textParts || null;
}

function getToolResultDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const { content, ...rest } = value as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : null;
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

function AssistantMarkdownTextPart() {
  const { text } = useMessagePartText();

  return (
    <MarkdownContent
      content={text}
      className="[&_blockquote]:my-3 [&_h1]:mt-0 [&_h2]:mt-0 [&_h3]:mt-0 [&_h4]:mt-0 [&_hr]:my-4 [&_img]:my-4 [&_ol]:my-3 [&_p]:my-0 [&_p+p]:mt-3 [&_pre]:my-4 [&_table]:my-4 [&_ul]:my-3"
    />
  );
}

function ReasoningPart(_props: ReasoningMessagePartProps) {
  return (
    <div className="rounded-[calc(var(--radius)-10px)] border border-primary/15 bg-primary/6 px-3 py-2 text-sm text-foreground">
      <MessagePartPrimitive.Text className="whitespace-pre-wrap break-words text-sm leading-6 text-current" />
    </div>
  );
}

function ToolFallbackPart({ argsText, isError, result, toolName }: ToolCallMessagePartProps) {
  const parsedArgs = argsText ? tryParseJson(argsText) : null;
  const formattedArgs = argsText ? formatStructuredValue(parsedArgs ?? argsText) : null;
  const resultText = extractToolTextContent(result);
  const resultDetails = getToolResultDetails(result);
  const formattedResultDetails =
    resultDetails !== null && resultDetails !== undefined
      ? formatStructuredValue(resultDetails)
      : null;
  const statusLabel = result === undefined ? "Running" : isError ? "Failed" : "Done";
  const statusVariant = result === undefined ? "neutral" : isError ? "danger" : "success";

  return (
    <div className="rounded-[calc(var(--radius)-10px)] border border-border/70 bg-background/55 px-3 py-3 text-xs leading-5 text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-foreground">
          <Wrench className="h-3.5 w-3.5" />
          <span className="font-medium">{toolName}</span>
        </div>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>

      {formattedArgs ? (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Input
          </div>
          <pre className="overflow-x-auto rounded-[calc(var(--radius)-12px)] border border-border/70 bg-background/85 px-3 py-2 text-[11px] leading-5 text-foreground">
            <code>{formattedArgs}</code>
          </pre>
        </div>
      ) : null}

      {resultText ? (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Output
          </div>
          <div
            className={cn(
              "rounded-[calc(var(--radius)-12px)] border px-3 py-2",
              isError
                ? "border-danger/30 bg-danger/8 text-danger"
                : "border-primary/15 bg-primary/6 text-foreground",
            )}
          >
            <MarkdownContent
              content={resultText}
              className="[&_p]:my-0 [&_p+p]:mt-3 [&_pre]:my-3 [&_ul]:my-2 [&_ol]:my-2"
              openLinksInNewTab
            />
          </div>
        </div>
      ) : null}

      {formattedResultDetails ? (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Details
          </div>
          <pre className="overflow-x-auto rounded-[calc(var(--radius)-12px)] border border-border/70 bg-background/85 px-3 py-2 text-[11px] leading-5 text-foreground">
            <code>{formattedResultDetails}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function ChainOfThoughtBlock() {
  const collapsed = useAuiState((s) => s.chainOfThought.collapsed);

  return (
    <ChainOfThoughtPrimitive.Root className="mb-3 overflow-hidden rounded-[18px] border border-primary/15 bg-primary/5">
      <ChainOfThoughtPrimitive.AccordionTrigger
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-primary/6 hover:text-foreground"
      >
        <span>Thinking</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} />
      </ChainOfThoughtPrimitive.AccordionTrigger>
      {!collapsed ? (
        <ChainOfThoughtPrimitive.Parts
          components={{
            Layout: ({ children }) => <div className="space-y-2 px-3 pb-3">{children}</div>,
            Reasoning: ReasoningPart,
            tools: {
              Fallback: ToolFallbackPart,
            },
          }}
        />
      ) : null}
    </ChainOfThoughtPrimitive.Root>
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
  const { runStatus } = useChatFeature();
  const isLastAssistantMessage = useAuiState(
    (s) => s.message.index === s.thread.messages.length - 1,
  );
  const hasRenderableContent = useAuiState((s) =>
    s.message.parts.some((part: { type: string; text?: string }) => {
      if (part.type === "text" || part.type === "reasoning") {
        return typeof part.text === "string" && part.text.trim().length > 0;
      }

      return true;
    }),
  );
  const isPendingAssistant =
    isLastAssistantMessage &&
    !hasRenderableContent &&
    (runStatus === "queued" || runStatus === "thinking" || runStatus === "responding");

  return (
    <MessagePrimitive.Root className="flex items-start gap-3">
      <div
        className={cn(
          "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/85 text-primary shadow-sm",
          isPendingAssistant && "border-primary/30",
        )}
      >
        <Sparkles className={cn("h-4 w-4", isPendingAssistant && "animate-pulse")} />
      </div>
      <div className="min-w-0 max-w-[min(100%,58rem)] flex-1 py-1 text-foreground">
        <MessagePrimitive.Parts
          components={{ ChainOfThought: ChainOfThoughtBlock, Text: AssistantMarkdownTextPart }}
        />
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

function EmptyState({
  compact = false,
  surface = "overlay",
}: {
  compact?: boolean;
  surface?: "overlay" | "page";
}) {
  const isPage = surface === "page";
  const title = env.useMockData ? "Chat scaffold ready" : "Ask Main Sequence AI";
  const description = env.useMockData
    ? "This shell is isolated inside `extensions/main_sequence_ai/assistant-ui/`. Mock mode keeps the local scaffold adapter active so the UI can be exercised without a backend."
    : "The assistant receives the current surface context automatically. Start a conversation about what is visible here or what action to take next.";
  const firstPrompt = env.useMockData
    ? "Summarize the current route context."
    : "Summarize what I am looking at right now.";
  const secondPrompt = env.useMockData
    ? "List the action bridges still needed for this chat integration."
    : "What actions can I take on this surface?";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-6 py-8 text-center",
        isPage
          ? compact
            ? "min-h-[160px]"
            : "min-h-[200px]"
          : "rounded-[28px] border border-dashed border-border/70 bg-card/45 backdrop-blur",
        !isPage && (compact ? "min-h-[220px]" : "min-h-[280px]"),
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-semibold text-foreground">{title}</div>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {env.useMockData ? (
          <>
            This shell is isolated inside <code>extensions/main_sequence_ai/assistant-ui/</code>.
            Mock mode keeps the local scaffold adapter active so the UI can be exercised without a
            backend.
          </>
        ) : (
          description
        )}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <ThreadPrimitive.Suggestion
          send
          prompt={firstPrompt}
          className="rounded-full border border-border/70 bg-card/80 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          {env.useMockData ? "Summarize route" : "Summarize view"}
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion
          send
          prompt={secondPrompt}
          className="rounded-full border border-border/70 bg-card/80 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
        >
          {env.useMockData ? "List action bridges" : "List actions"}
        </ThreadPrimitive.Suggestion>
      </div>
    </div>
  );
}

function StatusBanner({
  compact = false,
  surface = "overlay",
}: {
  compact?: boolean;
  surface?: "overlay" | "page";
}) {
  const isPage = surface === "page";
  const { clearThread, runStatus, runStatusDetail, thinkingSummary } = useChatFeature();
  const busy = runStatus === "thinking" || runStatus === "responding" || runStatus === "queued";

  return (
    <div
      className={cn(
        isPage
          ? "flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3"
          : "mb-3 flex flex-wrap items-start justify-between gap-3 rounded-[22px] border border-border/70 bg-card/72 px-4 py-3 backdrop-blur",
        !isPage && compact && "px-3 py-2.5",
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

function SessionNotice({ surface = "overlay" }: { surface?: "overlay" | "page" }) {
  const { sessionNotice } = useChatFeature();

  if (!sessionNotice) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        surface === "page" ? "mx-auto w-full max-w-5xl px-4" : "",
      )}
    >
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/85 text-primary shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 max-w-[min(100%,42rem)] rounded-[22px] border border-primary/20 bg-primary/8 px-4 py-3 text-sm leading-6 text-foreground shadow-sm">
        {sessionNotice}
      </div>
    </div>
  );
}

function PageScrollRail({
  isScrollable,
  thumbHeight,
  thumbTop,
}: ScrollRailState) {
  if (!isScrollable) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-4 right-2 hidden w-8 items-center justify-center lg:flex"
    >
      <div className="relative h-full w-4">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full bg-border/45" />
        <div
          className="absolute left-1/2 w-2 -translate-x-1/2 rounded-full bg-foreground/70 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
          style={{
            height: `${thumbHeight}px`,
            top: `${thumbTop}px`,
          }}
        />
      </div>
    </div>
  );
}

function Composer({
  compact = false,
  surface = "overlay",
}: {
  compact?: boolean;
  surface?: "overlay" | "page";
}) {
  const isPage = surface === "page";
  const placeholder = env.useMockData
    ? "Ask about the visible view, action bridges, or backend event wiring..."
    : "Ask about the visible view, what it means, or what you can do here...";

  const composerBody = (
    <ComposerPrimitive.Root
      className={cn(
        isPage
          ? "mx-auto w-full max-w-4xl rounded-[30px] border border-border/70 bg-card/78 px-4 py-3 shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur"
          : "mt-4 rounded-[24px] border border-border/70 bg-card/80 px-3 py-3 shadow-sm backdrop-blur",
      )}
    >
      <div className="flex items-end gap-3">
        <ComposerPrimitive.Input
          autoFocus
          rows={1}
          placeholder={placeholder}
          className={cn(
            "w-full min-h-6 resize-y overflow-y-auto bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground",
          )}
        />
        <ComposerPrimitive.Send
          aria-label="Send message"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowUp className="h-4 w-4" />
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );

  return composerBody;
}

export function ChatThread({ compact = false, surface = "overlay" }: ChatThreadProps) {
  const isPage = surface === "page";
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollRailState, setScrollRailState] = useState<ScrollRailState>(
    INITIAL_SCROLL_RAIL_STATE,
  );

  const updateScrollRail = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const { clientHeight, scrollHeight, scrollTop } = viewport;

    if (scrollHeight <= clientHeight + 1) {
      setScrollRailState((current) =>
        current.isScrollable ? INITIAL_SCROLL_RAIL_STATE : current,
      );
      return;
    }

    const trackInset = 16;
    const trackHeight = Math.max(clientHeight - trackInset * 2, 1);
    const thumbHeight = Math.max(Math.round((clientHeight / scrollHeight) * trackHeight), 36);
    const maxThumbTop = Math.max(trackHeight - thumbHeight, 0);
    const maxScrollTop = Math.max(scrollHeight - clientHeight, 1);
    const thumbTop =
      trackInset + Math.round((scrollTop / maxScrollTop) * maxThumbTop);

    setScrollRailState((current) => {
      if (
        current.isScrollable &&
        current.thumbHeight === thumbHeight &&
        current.thumbTop === thumbTop
      ) {
        return current;
      }

      return {
        isScrollable: true,
        thumbHeight,
        thumbTop,
      };
    });
  }, []);

  useEffect(() => {
    if (!isPage) {
      setScrollRailState(INITIAL_SCROLL_RAIL_STATE);
      return;
    }

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    let animationFrame = 0;
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateScrollRail);
    };

    scheduleUpdate();
    viewport.addEventListener("scroll", scheduleUpdate, { passive: true });

    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(viewport, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(viewport);

    window.addEventListener("resize", scheduleUpdate);

    return () => {
      viewport.removeEventListener("scroll", scheduleUpdate);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isPage, updateScrollRail]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!isPage ? <StatusBanner compact={compact} surface={surface} /> : null}

      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1">
          <ThreadPrimitive.Viewport
            ref={viewportRef}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain",
              isPage
                ? "mx-auto w-full max-w-5xl px-4 py-5"
                : "pr-1",
            )}
            style={isPage ? { scrollbarGutter: "stable" } : undefined}
          >
            <div
              className={cn(
                "flex min-h-full flex-col",
                isPage ? "justify-end gap-6" : "gap-4",
              )}
            >
              <ThreadPrimitive.Empty>
                <EmptyState compact={compact} surface={surface} />
              </ThreadPrimitive.Empty>
              <ThreadPrimitive.Messages
                components={{
                  AssistantMessage,
                  UserMessage,
                }}
              />
              <SessionNotice surface={surface} />
            </div>
            {isPage ? (
              <ThreadPrimitive.ViewportFooter className="sticky bottom-0 z-10 bg-background/72 px-4 py-4 backdrop-blur-sm">
                <Composer compact={compact} surface={surface} />
              </ThreadPrimitive.ViewportFooter>
            ) : null}
          </ThreadPrimitive.Viewport>
          {isPage ? <PageScrollRail {...scrollRailState} /> : null}
        </div>

        {!isPage ? <Composer compact={compact} surface={surface} /> : null}
      </ThreadPrimitive.Root>
    </div>
  );
}
