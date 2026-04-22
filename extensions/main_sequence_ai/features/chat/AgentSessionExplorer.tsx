import { useEffect, useRef, useState } from "react";

import { Bot, Loader2, Search, Sparkles, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  buildAgentOptionDescription,
  fetchAgentQuickSearch,
  type AgentSearchResult,
} from "../../agent-search";
import { CHAT_PAGE_PATH } from "../../assistant-ui/chat-ui-store";
import { useChatFeature } from "../../assistant-ui/ChatProvider";

function formatSessionTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  return sameDay
    ? new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
}

export function AgentSessionExplorer({
  className,
  layout = "rail",
  navigateToChatOnSessionChange = false,
}: {
  className?: string;
  layout?: "rail" | "canvas";
  navigateToChatOnSessionChange?: boolean;
}) {
  const navigate = useNavigate();
  const {
    activeSessionSummary,
    activeAgentName,
    agentSessions,
    currentSessionId,
    deleteAgentSession,
    isLoadingLatestSessions,
    latestSessionsError,
    runStatus,
    selectAgentSession,
    startAgentSession,
  } = useChatFeature();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const [searchValue, setSearchValue] = useState("");
  const [agentResults, setAgentResults] = useState<AgentSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const trimmedQuery = searchValue.trim();
  const busy =
    runStatus === "queued" ||
    runStatus === "thinking" ||
    runStatus === "responding" ||
    Boolean(activeSessionSummary?.working);
  const showAgentSearchResults =
    isSearching || Boolean(searchError) || trimmedQuery.length >= 3;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < 3) {
      setAgentResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setIsSearching(true);
          setSearchError(null);

          const payload = await fetchAgentQuickSearch({
            query: trimmedQuery,
            signal: controller.signal,
            token: sessionToken,
            tokenType: sessionTokenType,
          });

          setAgentResults(payload);
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setAgentResults([]);
          setSearchError(
            error instanceof Error ? error.message : "Unable to search agents right now.",
          );
        } finally {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        }
      })();
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [sessionToken, sessionTokenType, trimmedQuery]);

  function openChatSurface() {
    if (!navigateToChatOnSessionChange) {
      return;
    }

    navigate(CHAT_PAGE_PATH);
  }

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        layout === "rail"
          ? "h-full bg-transparent"
          : "mx-auto h-full w-full max-w-[760px] rounded-[calc(var(--radius)+8px)] border border-border/70 bg-card/58 shadow-[var(--shadow-panel)] backdrop-blur-xl",
        className,
      )}
    >
      <div
        className={cn(
          "border-b border-border/60",
          layout === "rail" ? "px-2 py-4" : "px-4 py-4 md:px-5",
        )}
      >
        <div>
          <div className="text-sm font-semibold text-foreground">Agent Sessions</div>
          <div className="text-xs text-muted-foreground">
            Search agents and resume recent sessions.
          </div>
        </div>

        <div className="mt-3 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchValue}
            placeholder="Search agent"
            className="h-10 border-border/70 bg-background/55 pl-9"
            onChange={(event) => {
              setSearchValue(event.target.value);
            }}
          />
        </div>
        <div className="mt-2 px-1 text-xs text-muted-foreground">
          Conversation with <span className="font-mono text-foreground">{activeAgentName}</span>
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          layout === "rail" ? "px-2 py-3" : "px-4 py-4 md:px-5",
        )}
      >
        {showAgentSearchResults ? (
          <div className="shrink-0 pb-4">
            <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Agent Search
            </div>
            <div className="space-y-1">
              {isSearching ? (
                <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching agents
                </div>
              ) : null}

              {!isSearching && searchError ? (
                <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-4 text-sm text-danger">
                  {searchError}
                </div>
              ) : null}

              {!isSearching && !searchError && trimmedQuery.length >= 3 && agentResults.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                  No agents found.
                </div>
              ) : null}

              {!isSearching && !searchError && trimmedQuery.length >= 3
                ? agentResults.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      disabled={busy}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[16px] border border-transparent px-3 py-3 text-left transition-colors hover:bg-background/45",
                        busy && "cursor-not-allowed opacity-60",
                      )}
                      onClick={() => {
                        startAgentSession(agent);
                        setSearchValue("");
                        openChatSurface();
                      }}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {agent.name}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {buildAgentOptionDescription(agent)}
                        </div>
                        {agent.description ? (
                          <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {agent.description}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 shrink-0 text-primary">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    </button>
                  ))
                : null}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Latest Sessions
          </div>
          <div className="h-full overflow-y-auto pr-1">
            <div className="space-y-1">
              {isLoadingLatestSessions ? (
                <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading latest agent sessions
                </div>
              ) : null}

              {latestSessionsError ? (
                <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-4 text-sm text-danger">
                  Latest session sync failed: {latestSessionsError}
                </div>
              ) : null}

              {agentSessions.length > 0 ? (
                agentSessions.map((session) => {
                  const active = session.id === currentSessionId;

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "rounded-[16px] border px-3 py-3 transition-colors",
                        active
                          ? "border-primary/35 bg-primary/10"
                          : "border-transparent bg-transparent hover:bg-background/45",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className={cn(
                            "min-w-0 flex-1 text-left",
                            busy && !active && "cursor-not-allowed opacity-60",
                          )}
                          onClick={() => {
                            selectAgentSession(session.id);
                            openChatSurface();
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-foreground">
                                {session.agent?.requestName || session.agent?.name || "Unassigned agent"}
                              </div>
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                <span className="font-mono">Session ID: {session.id}</span>
                              </div>
                              {session.handleUniqueId ? (
                                <div className="mt-1 truncate text-xs text-muted-foreground">
                                  <span className="font-mono">Handle: {session.handleUniqueId}</span>
                                </div>
                              ) : null}
                              {session.working ? (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                                  <Sparkles className="h-3 w-3 animate-pulse" />
                                  Working
                                </div>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-[11px] text-muted-foreground">
                              {formatSessionTimestamp(session.updatedAt)}
                            </div>
                          </div>
                          {session.preview ? (
                            <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {session.preview}
                            </div>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-danger"
                          title="Delete session"
                          aria-label={`Delete session ${session.id}`}
                          onClick={async (event) => {
                            event.stopPropagation();
                            await deleteAgentSession(session.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-6 text-sm text-muted-foreground">
                  No recent agent sessions were returned.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
