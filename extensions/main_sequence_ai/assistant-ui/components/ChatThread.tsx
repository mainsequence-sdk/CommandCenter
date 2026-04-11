import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  ChainOfThoughtPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useThreadViewport,
  useMessagePartText,
  type ReasoningMessagePartProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { useAui, useAuiState } from "@assistant-ui/store";
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

function getUserMessagePreview(text: string) {
  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 2) {
    return text;
  }

  return paragraphs.slice(-2).join("\n\n");
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
  const aui = useAui();
  const { runStatus } = useChatFeature();
  const collapsed = useAuiState((s) => s.chainOfThought.collapsed);
  const isLastAssistantMessage = useAuiState(
    (s) => s.message.index === s.thread.messages.length - 1,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const isActiveThinking =
    isLastAssistantMessage &&
    (runStatus === "queued" || runStatus === "thinking" || runStatus === "responding");

  useEffect(() => {
    aui.chainOfThought().setCollapsed(false);
  }, [aui]);

  useEffect(() => {
    if (collapsed || typeof window === "undefined") {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: "nearest" });
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [collapsed]);

  return (
    <ChainOfThoughtPrimitive.Root
      ref={rootRef}
      className="mb-3 overflow-hidden rounded-[18px] border border-primary/15 bg-primary/5"
    >
      <ChainOfThoughtPrimitive.AccordionTrigger
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/6 hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Sparkles className={cn("h-3.5 w-3.5", isActiveThinking && "animate-pulse text-primary")} />
          <span className={cn(isActiveThinking && "animate-pulse text-foreground")}>Thinking ...</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} />
      </ChainOfThoughtPrimitive.AccordionTrigger>
      {!collapsed ? (
        <div
          ref={contentRef}
          className="max-h-[min(55vh,34rem)] overflow-y-auto overscroll-contain pr-1"
        >
          <ChainOfThoughtPrimitive.Parts
            components={{
              Layout: ({ children }) => <div className="space-y-2 px-3 pb-3">{children}</div>,
              Reasoning: ReasoningPart,
              tools: {
                Fallback: ToolFallbackPart,
              },
            }}
          />
        </div>
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

function PageUserTextPart() {
  const { text } = useMessagePartText();

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-6 text-current">
      {getUserMessagePreview(text)}
    </div>
  );
}

function PageUserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[88%] rounded-[22px] bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
        <MessagePrimitive.Parts components={{ Text: PageUserTextPart }} />
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
  const isActiveAssistant =
    isLastAssistantMessage &&
    (runStatus === "queued" || runStatus === "thinking" || runStatus === "responding");

  return (
    <MessagePrimitive.Root className="flex items-start gap-3">
      <div
        className={cn(
          "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/85 text-primary shadow-sm",
          isActiveAssistant && "border-primary/30",
        )}
      >
        <Sparkles className={cn("h-4 w-4", isActiveAssistant && "animate-pulse")} />
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
    : "What should we investigate?";

  const composerBody = (
    <ComposerPrimitive.Root
      className={cn(
        isPage
          ? "mx-auto w-full max-w-5xl rounded-[30px] border border-border/70 bg-card/78 px-4 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur"
          : "mt-4 rounded-[24px] border border-border/70 bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur",
      )}
    >
      <div className="flex items-center gap-3">
        <ComposerPrimitive.Input
          autoFocus
          minRows={1}
          maxRows={10}
          placeholder={placeholder}
          className={cn(
            "w-full resize-none overflow-y-auto bg-transparent py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground",
          )}
        />
        <ComposerPrimitive.Send
          aria-label="Send message"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowUp className="h-4 w-4" />
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );

  return composerBody;
}

function PageComposerFooter() {
  return (
    <div className="mt-3 text-center text-xs text-muted-foreground">
      Main Sequence AI can make mistakes. Verify important outputs before acting.
    </div>
  );
}

function PageFooterInsetSpacer({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
}) {
  const registerInset = useThreadViewport((s) => s.registerContentInset);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const target = targetRef.current;
    if (!target || typeof ResizeObserver === "undefined") {
      return;
    }

    const handle = registerInset();

    const update = () => {
      const marginTop = parseFloat(getComputedStyle(target).marginTop) || 0;
      const nextHeight = target.offsetHeight + marginTop;
      setHeight(nextHeight);
      handle.setHeight(nextHeight);
    };

    update();

    const observer = new ResizeObserver(() => {
      update();
    });

    observer.observe(target);

    return () => {
      observer.disconnect();
      handle.unregister();
    };
  }, [registerInset, targetRef]);

  if (height <= 0) {
    return null;
  }

  return <div aria-hidden className="shrink-0" style={{ height }} />;
}

export function ChatThread({ compact = false, surface = "overlay" }: ChatThreadProps) {
  const isPage = surface === "page";
  const hasMessages = useAuiState((s) => s.thread.messages.length > 0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pageFooterRef = useRef<HTMLDivElement | null>(null);
  const UserMessageComponent = isPage ? PageUserMessage : UserMessage;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {!isPage ? <StatusBanner compact={compact} surface={surface} /> : null}

      <ThreadPrimitive.Root className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {isPage && !hasMessages ? (
          <div className="relative flex h-full min-h-0 flex-1 px-4 pb-8 pt-4">
            <div className="mx-auto flex w-full max-w-5xl justify-center pt-16">
              <div className="w-full max-w-3xl">
                <EmptyState compact={compact} surface={surface} />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2">
              <div className="pointer-events-auto mx-auto w-full max-w-3xl">
                <Composer compact={compact} surface={surface} />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex h-full min-h-0 flex-1 flex-col">
            <ThreadPrimitive.Viewport
              ref={viewportRef}
              turnAnchor={isPage ? "top" : "bottom"}
              className={cn(
                "flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
                isPage
                  ? "mx-auto w-full max-w-5xl px-4 pt-5"
                  : "pb-24 pr-1",
              )}
              style={isPage ? { scrollbarGutter: "stable" } : undefined}
            >
              <div
                className={cn(
                  "flex min-h-full flex-col",
                  isPage ? "gap-6" : "gap-4",
                )}
              >
                {!isPage ? (
                  <ThreadPrimitive.Empty>
                    <EmptyState compact={compact} surface={surface} />
                  </ThreadPrimitive.Empty>
                ) : null}
                <ThreadPrimitive.Messages
                  components={{
                    AssistantMessage,
                    UserMessage: UserMessageComponent,
                  }}
                />
                <SessionNotice surface={surface} />
                {isPage ? <PageFooterInsetSpacer targetRef={pageFooterRef} /> : null}
              </div>
            </ThreadPrimitive.Viewport>
            {isPage ? (
              <div
                ref={pageFooterRef}
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/96 to-transparent px-4 pb-4 pt-10"
              >
                <div className="pointer-events-auto mx-auto w-full max-w-5xl">
                  <Composer compact={compact} surface={surface} />
                  <PageComposerFooter />
                </div>
              </div>
            ) : null}
            {!isPage ? (
              <div className="absolute inset-x-0 bottom-4 z-10">
                <Composer compact={compact} surface={surface} />
              </div>
            ) : null}
          </div>
        )}
      </ThreadPrimitive.Root>
    </div>
  );
}
