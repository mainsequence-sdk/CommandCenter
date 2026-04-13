import { useEffect, useRef, useState } from "react";

import { Bot, Loader2, Search, Sparkles, X } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  buildAgentOptionDescription,
  buildAgentSelectionDescription,
  fetchAgentQuickSearch,
  type AgentSearchResult,
} from "../../agent-search";
import {
  fetchLatestAgentSessions,
  getAgentSessionRecordSessionId,
  getAgentSessionRecordSummary,
  getAgentSessionRecordTitle,
  getAgentSessionRecordUpdatedAt,
  type AgentSessionApiRecord,
} from "../../runtime/agent-sessions-api";

const MIN_AGENT_QUERY_LENGTH = 2;

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

export interface AgentSessionCatalogSelection {
  agent: AgentSearchResult;
  session: AgentSessionApiRecord;
}

export function AgentSessionCatalogPicker({
  className,
  currentSessionId,
  currentSessionLabel,
  editable = true,
  onClear,
  onSelect,
}: {
  className?: string;
  currentSessionId?: string | null;
  currentSessionLabel?: string | null;
  editable?: boolean;
  onClear?: () => void;
  onSelect: (selection: AgentSessionCatalogSelection) => void;
}) {
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [agentQuery, setAgentQuery] = useState("");
  const [agentResults, setAgentResults] = useState<AgentSearchResult[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentSearchResult | null>(null);
  const [agentSearchError, setAgentSearchError] = useState<string | null>(null);
  const [isSearchingAgents, setIsSearchingAgents] = useState(false);
  const [agentSessions, setAgentSessions] = useState<AgentSessionApiRecord[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const trimmedAgentQuery = agentQuery.trim();
  const normalizedCurrentSessionId =
    typeof currentSessionId === "string" && currentSessionId.trim() ? currentSessionId.trim() : null;
  const showAgentResults =
    isSearchingAgents || Boolean(agentSearchError) || trimmedAgentQuery.length >= MIN_AGENT_QUERY_LENGTH;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (trimmedAgentQuery.length < MIN_AGENT_QUERY_LENGTH || !editable) {
      setAgentResults([]);
      setAgentSearchError(null);
      setIsSearchingAgents(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setIsSearchingAgents(true);
          setAgentSearchError(null);

          const payload = await fetchAgentQuickSearch({
            query: trimmedAgentQuery,
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
          setAgentSearchError(
            error instanceof Error ? error.message : "Unable to search agents right now.",
          );
        } finally {
          if (!controller.signal.aborted) {
            setIsSearchingAgents(false);
          }
        }
      })();
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [editable, sessionToken, sessionTokenType, trimmedAgentQuery]);

  useEffect(() => {
    if (!selectedAgent?.id || !sessionUserId) {
      setAgentSessions([]);
      setSessionError(null);
      setIsLoadingSessions(false);
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        setIsLoadingSessions(true);
        setSessionError(null);

        const payload = await fetchLatestAgentSessions({
          agentId: selectedAgent.id,
          createdByUser: sessionUserId,
          signal: controller.signal,
          token: sessionToken,
          tokenType: sessionTokenType,
        });

        if (controller.signal.aborted) {
          return;
        }

        setAgentSessions(payload);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setAgentSessions([]);
        setSessionError(
          error instanceof Error ? error.message : "Unable to load sessions for this agent.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSessions(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [selectedAgent, sessionToken, sessionTokenType, sessionUserId]);

  return (
    <div className={cn("space-y-4", className)}>
      {normalizedCurrentSessionId ? (
        <section className="rounded-[calc(var(--radius)-2px)] border border-border/70 bg-background/26 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Current session
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="neutral" className="border border-border/70 bg-card/55">
                  {currentSessionLabel?.trim() || `AgentSession ${normalizedCurrentSessionId}`}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {normalizedCurrentSessionId}
                </span>
              </div>
            </div>
            {editable && onClear ? (
              <Button size="sm" variant="ghost" onClick={onClear}>
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Agent</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Search for an agent first, then choose one of its recent sessions.
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={agentQuery}
            readOnly={!editable}
            placeholder="Search agent"
            className="h-10 border-border/70 bg-background/55 pl-9"
            onChange={(event) => {
              setAgentQuery(event.target.value);
            }}
          />
        </div>

        {selectedAgent ? (
          <div className="rounded-[16px] border border-border/70 bg-card/60 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {selectedAgent.name}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {buildAgentSelectionDescription(selectedAgent)}
                </div>
                <div className="mt-2 truncate text-xs text-muted-foreground">
                  {buildAgentOptionDescription(selectedAgent)}
                </div>
              </div>
              {editable ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedAgent(null);
                    setAgentSessions([]);
                    setSessionError(null);
                    searchInputRef.current?.focus();
                  }}
                >
                  Change
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {showAgentResults ? (
          <div className="space-y-1">
            {isSearchingAgents ? (
              <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching agents
              </div>
            ) : null}

            {!isSearchingAgents && agentSearchError ? (
              <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-4 text-sm text-danger">
                {agentSearchError}
              </div>
            ) : null}

            {!isSearchingAgents &&
            !agentSearchError &&
            trimmedAgentQuery.length >= MIN_AGENT_QUERY_LENGTH &&
            agentResults.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                No agents found.
              </div>
            ) : null}

            {!isSearchingAgents && !agentSearchError
              ? agentResults.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    disabled={!editable}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[16px] border border-transparent px-3 py-3 text-left transition-colors hover:bg-background/45",
                      !editable && "cursor-not-allowed opacity-60",
                    )}
                    onClick={() => {
                      setSelectedAgent(agent);
                      setAgentQuery("");
                      setAgentResults([]);
                      setAgentSearchError(null);
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
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-topbar-foreground">Sessions</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedAgent
              ? `Recent sessions created for ${selectedAgent.name}.`
              : "Select an agent to load its recent sessions."}
          </p>
        </div>

        <div className="space-y-1">
          {!selectedAgent ? (
            <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-5 text-sm text-muted-foreground">
              Search and choose an agent first.
            </div>
          ) : null}

          {selectedAgent && isLoadingSessions ? (
            <div className="flex items-center gap-2 rounded-[16px] border border-border/60 bg-background/45 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions
            </div>
          ) : null}

          {selectedAgent && sessionError ? (
            <div className="rounded-[16px] border border-danger/30 bg-danger/8 px-3 py-4 text-sm text-danger">
              {sessionError}
            </div>
          ) : null}

          {selectedAgent && !isLoadingSessions && !sessionError && agentSessions.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-border/60 px-3 py-5 text-sm text-muted-foreground">
              No recent sessions were returned for this agent.
            </div>
          ) : null}

          {selectedAgent && !isLoadingSessions && !sessionError
            ? agentSessions.map((session) => {
                const sessionId = getAgentSessionRecordSessionId(session);
                const active = normalizedCurrentSessionId === sessionId;

                return (
                  <button
                    key={`${selectedAgent.id}:${sessionId}`}
                    type="button"
                    disabled={!editable}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[16px] border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-primary/35 bg-primary/10"
                        : "border-transparent bg-transparent hover:bg-background/45",
                      !editable && "cursor-not-allowed opacity-60",
                    )}
                    onClick={() => {
                      onSelect({
                        agent: selectedAgent,
                        session,
                      });
                    }}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-primary">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {getAgentSessionRecordTitle(session)}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            <span className="font-mono">Session ID: {sessionId}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-[11px] text-muted-foreground">
                          {formatSessionTimestamp(getAgentSessionRecordUpdatedAt(session))}
                        </div>
                      </div>
                      {getAgentSessionRecordSummary(session) ? (
                        <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {getAgentSessionRecordSummary(session)}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })
            : null}
        </div>
      </section>
    </div>
  );
}
