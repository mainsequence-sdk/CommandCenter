import { useEffect, useRef, useState } from "react";

import { Bot, Loader2, Search, Sparkles } from "lucide-react";

import { useAuthStore } from "@/auth/auth-store";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  buildAgentOptionDescription,
  buildAgentSelectionDescription,
  fetchAgentQuickSearch,
  type AgentSearchResult,
} from "../../agent-search";
import {
  filterAgentTerminalAllowedAgents,
  getAgentTerminalAllowedAgentsLabel,
} from "./agentTerminalAgents";

const MIN_AGENT_QUERY_LENGTH = 2;

export function AgentTerminalAgentPicker({
  className,
  editable = true,
  onSelect,
}: {
  className?: string;
  editable?: boolean;
  onSelect: (agent: AgentSearchResult) => void;
}) {
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [agentQuery, setAgentQuery] = useState("");
  const [agentResults, setAgentResults] = useState<AgentSearchResult[]>([]);
  const [rawResultCount, setRawResultCount] = useState(0);
  const [agentSearchError, setAgentSearchError] = useState<string | null>(null);
  const [isSearchingAgents, setIsSearchingAgents] = useState(false);
  const trimmedAgentQuery = agentQuery.trim();
  const showAgentResults =
    isSearchingAgents || Boolean(agentSearchError) || trimmedAgentQuery.length >= MIN_AGENT_QUERY_LENGTH;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (trimmedAgentQuery.length < MIN_AGENT_QUERY_LENGTH || !editable) {
      setAgentResults([]);
      setRawResultCount(0);
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

          if (controller.signal.aborted) {
            return;
          }

          setRawResultCount(payload.length);
          setAgentResults(filterAgentTerminalAllowedAgents(payload));
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setRawResultCount(0);
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

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral" className="border border-border/70 bg-card/55">
          Supported here
        </Badge>
        <span className="text-xs text-muted-foreground">{getAgentTerminalAllowedAgentsLabel()}</span>
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
              {rawResultCount > 0
                ? `No supported agents found. Agent Terminal currently allows ${getAgentTerminalAllowedAgentsLabel()} only.`
                : "No agents found."}
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
                    onSelect(agent);
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
                      {buildAgentSelectionDescription(agent)}
                    </div>
                    <div className="mt-2 truncate text-xs text-muted-foreground">
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
    </div>
  );
}
