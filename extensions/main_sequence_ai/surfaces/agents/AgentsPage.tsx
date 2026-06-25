import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Bot, Loader2, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";
import { mainSequenceRegistryPageSize } from "../../../main_sequence/common/api";
import { MainSequenceRegistryPagination } from "../../../main_sequence/common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../main_sequence/common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../main_sequence/common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../main_sequence/common/components/registryTable";
import { useRegistrySelection } from "../../../main_sequence/common/hooks/useRegistrySelection";
import {
  bulkDeleteAgents,
  fetchAgentList,
  fetchAgentSemanticSearch,
  getAgentSearchResultLookupKey,
  getAgentSearchResultRowKey,
  type AgentSemanticSearchResult,
  type AgentSearchResult,
} from "../../agent-search";
import { useChatFeature } from "../../assistant-ui/ChatProvider";
import { CHAT_PAGE_PATH } from "../../assistant-ui/chat-ui-store";
import {
  AgentDetailView,
  defaultAgentDetailTabId,
  isAgentDetailTabId,
} from "./AgentDetailView";

const mainSequenceAgentIdParam = "msAgentId";
const mainSequenceAgentTabParam = "msAgentTab";

export function AgentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionToken = useAuthStore((state) => state.session?.token ?? null);
  const sessionTokenType = useAuthStore((state) => state.session?.tokenType ?? "Bearer");
  const {
    hasActiveChatStream,
    isActiveSessionLoading,
    isCreatingAgentSession,
    startAgentSession,
  } = useChatFeature();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedAgentLookupKey = searchParams.get(mainSequenceAgentIdParam)?.trim() ?? "";
  const requestedAgentTabId = searchParams.get(mainSequenceAgentTabParam);
  const isAgentDetailOpen = selectedAgentLookupKey.length > 0 && selectedAgentLookupKey !== "0";
  const selectedAgentTabId = isAgentDetailTabId(requestedAgentTabId)
    ? requestedAgentTabId
    : defaultAgentDetailTabId;
  const [filterValue, setFilterValue] = useState("");
  const [semanticQueryInput, setSemanticQueryInput] = useState("");
  const [semanticQuery, setSemanticQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [agentDeleteRequest, setAgentDeleteRequest] = useState<AgentSearchResult[] | null>(null);
  const deferredFilterValue = useDeferredValue(filterValue);
  const sessionMutationBusy =
    hasActiveChatStream || isActiveSessionLoading || isCreatingAgentSession;
  const agentsQuery = useQuery({
    queryKey: ["main_sequence_ai", "agents", "list", pageIndex],
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      fetchAgentList({
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
        limit: mainSequenceRegistryPageSize,
        offset: pageIndex * mainSequenceRegistryPageSize,
      }),
  });
  const semanticSearchQuery = useQuery({
    queryKey: ["main_sequence_ai", "agents", "semantic-search", semanticQuery],
    enabled: semanticQuery.trim().length >= 3,
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      fetchAgentSemanticSearch({
        query: semanticQuery,
        signal,
        token: sessionToken,
        tokenType: sessionTokenType,
        limit: 20,
      }),
  });
  const deleteAgentMutation = useMutation({
    mutationFn: (agents: AgentSearchResult[]) =>
      bulkDeleteAgents({
        agentUids: agents.map((agent) => agent.uid ?? ""),
        token: sessionToken,
        tokenType: sessionTokenType,
      }),
    onSuccess: async (result) => {
      setAgentDeleteRequest(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["main_sequence_ai", "agents", "list"] }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence_ai", "agents", "semantic-search"],
        }),
      ]);
      toast({
        variant: "success",
        title: result.deleted_count === 1 ? "Agent deleted" : "Agents deleted",
        description:
          result.deleted_count === 1
            ? "1 agent was deleted."
            : `${result.deleted_count} agents were deleted.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Unable to delete agent",
        description: error instanceof Error ? error.message : "The agent could not be deleted.",
      });
    },
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSemanticQuery(semanticQueryInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [semanticQueryInput]);

  useEffect(() => {
    setPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil((agentsQuery.data?.count ?? 0) / mainSequenceRegistryPageSize),
    );

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [pageIndex, agentsQuery.data?.count]);

  const filteredAgents = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return (agentsQuery.data?.results ?? []).filter((agent) => {
      if (!needle) {
        return true;
      }

      return [
        agent.name,
        agent.uid ?? "",
        agent.displayLabel,
        agent.agentType,
        agent.agent_unique_id,
        agent.id > 0 ? String(agent.id) : "",
        agent.description ?? "",
        agent.engine_name ?? "",
        agent.llm_provider ?? "",
        agent.llm_model ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, agentsQuery.data?.results]);
  const selectableAgents = useMemo(
    () => filteredAgents.filter((agent) => Boolean(agent.uid?.trim())),
    [filteredAgents],
  );
  const agentSelection = useRegistrySelection(selectableAgents, (agent) => agent.uid ?? "");
  const agentBulkActions =
    agentSelection.selectedCount > 0
      ? [
          {
            id: "delete-agents",
            label: "Delete Agents",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              deleteAgentMutation.reset();
              setAgentDeleteRequest(agentSelection.selectedItems);
            },
          },
        ]
      : [];
  const selectedAgentFromList = useMemo(
    () =>
      (agentsQuery.data?.results ?? []).find((agent) => {
        const lookupKey = getAgentSearchResultLookupKey(agent);

        return (
          lookupKey === selectedAgentLookupKey ||
          (agent.id > 0 && String(agent.id) === selectedAgentLookupKey)
        );
      }) ?? null,
    [agentsQuery.data?.results, selectedAgentLookupKey],
  );
  const semanticSearchActive = semanticQuery.length >= 3;
  const semanticSearchResults = semanticSearchQuery.data ?? [];

  function updateSearchParams(
    update: (nextParams: URLSearchParams) => void,
    { replace = false }: { replace?: boolean } = {},
  ) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace },
    );
  }

  function openAgentDetail(agentLookupKey: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceAgentIdParam, agentLookupKey);
      nextParams.delete(mainSequenceAgentTabParam);
    });
  }

  function closeAgentDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceAgentIdParam);
      nextParams.delete(mainSequenceAgentTabParam);
    });
  }

  function selectAgentDetailTab(tabId: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceAgentTabParam, tabId);
    });
  }

  if (isAgentDetailOpen) {
    return (
      <AgentDetailView
        activeTabId={selectedAgentTabId}
        agentId={selectedAgentLookupKey}
        initialAgent={selectedAgentFromList}
        onBack={closeAgentDetail}
        onSelectTab={selectAgentDetailTab}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence AI"
        title="Agents"
        description="Browse the registered agent list and start a fresh chat session for one agent."
        actions={<Badge variant="neutral">{`${agentsQuery.data?.count ?? 0} agents`}</Badge>}
      />

      <Card className="max-w-4xl">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Search</CardTitle>
              <CardDescription>
                Search by function, skills, and description. Semantic matches open the agent detail
                view.
              </CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={
                semanticSearchActive && !semanticSearchQuery.isLoading ? (
                  <Badge variant="neutral">{`${semanticSearchResults.length} results`}</Badge>
                ) : null
              }
              value={semanticQueryInput}
              onChange={(event) => setSemanticQueryInput(event.target.value)}
              placeholder="Search by function, skills, or description"
              searchClassName="max-w-[32rem]"
              selectionCount={0}
            />
          </div>
        </CardHeader>

        {semanticSearchActive ? (
          <CardContent className="p-0">
            {semanticSearchQuery.isLoading ? (
            <div className="flex min-h-36 items-center justify-center px-5 py-5">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching agents
              </div>
            </div>
            ) : null}

            {semanticSearchQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {semanticSearchQuery.error instanceof Error
                  ? semanticSearchQuery.error.message
                  : "Unable to search agents right now."}
              </div>
            </div>
            ) : null}

            {!semanticSearchQuery.isLoading &&
            !semanticSearchQuery.isError &&
            semanticSearchResults.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No matching agents</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different function, skill set, or problem description.
              </p>
            </div>
            ) : null}

            {!semanticSearchQuery.isLoading &&
            !semanticSearchQuery.isError &&
            semanticSearchResults.length > 0 ? (
            <div className="space-y-2 px-4 py-4">
              {semanticSearchResults.map((agent, index) => {
                const lookupKey = getAgentSearchResultLookupKey(agent);

                return (
                  <SemanticAgentRow
                    key={getAgentSearchResultRowKey(agent, index)}
                    agent={agent}
                    canOpenDetail={Boolean(lookupKey)}
                    onOpenDetail={() => {
                      if (lookupKey) {
                        openAgentDetail(lookupKey);
                      }
                    }}
                  />
                );
              })}
            </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Agent registry</CardTitle>
              <CardDescription>Browse agents and launch a new session directly into chat.</CardDescription>
            </div>
            <MainSequenceRegistrySearch
              accessory={<Badge variant="neutral">{`${agentsQuery.data?.count ?? 0} agents`}</Badge>}
              actionMenuLabel="Actions"
              bulkActions={agentBulkActions}
              clearSelectionLabel="Clear"
              onClearSelection={agentSelection.clearSelection}
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder="Filter by name, UID, unique identifier, provider, model, or engine"
              selectionCount={agentSelection.selectedCount}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {agentsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading agents
              </div>
            </div>
          ) : null}

          {agentsQuery.isError ? (
            <div className="p-5">
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {agentsQuery.error instanceof Error
                  ? agentsQuery.error.message
                  : "Unable to load agents right now."}
              </div>
            </div>
          ) : null}

          {!agentsQuery.isLoading &&
          !agentsQuery.isError &&
          filteredAgents.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No agents found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {deferredFilterValue.trim()
                  ? "Clear the current filter or try another search term."
                  : "No agents were returned by the registry endpoint."}
              </p>
            </div>
          ) : null}

          {!agentsQuery.isLoading &&
          !agentsQuery.isError &&
          filteredAgents.length > 0 ? (
            <div className="overflow-x-auto px-4 py-4">
              <table className="w-full min-w-[1180px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible agents"
                        checked={agentSelection.allSelected}
                        indeterminate={agentSelection.someSelected}
                        onChange={agentSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Agent</th>
                    <th className="px-4 pb-2">Identifier</th>
                    <th className="px-4 pb-2">Type</th>
                    <th className="px-4 pb-2">Model</th>
                    <th className="px-4 pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map((agent, index) => {
                    const lookupKey = getAgentSearchResultLookupKey(agent);
                    const selectableAgentUid = agent.uid?.trim() || "";
                    const selected = selectableAgentUid
                      ? agentSelection.isSelected(selectableAgentUid)
                      : false;

                    return (
                      <AgentRow
                        key={getAgentSearchResultRowKey(agent, index)}
                        agent={agent}
                        selected={selected}
                        disabled={sessionMutationBusy}
                        canOpenDetail={Boolean(lookupKey)}
                        onToggleSelection={
                          selectableAgentUid
                            ? () => agentSelection.toggleSelection(selectableAgentUid)
                            : null
                        }
                        onOpenDetail={() => {
                          if (lookupKey) {
                            openAgentDetail(lookupKey);
                          }
                        }}
                        onStartSession={() => {
                          startAgentSession(agent);
                          navigate(CHAT_PAGE_PATH);
                        }}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!agentsQuery.isLoading &&
          !agentsQuery.isError &&
          (agentsQuery.data?.count ?? 0) > 0 ? (
            <MainSequenceRegistryPagination
              count={agentsQuery.data?.count ?? 0}
              itemLabel="agents"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </CardContent>
      </Card>

      <ActionConfirmationDialog
        title="Delete Agents"
        open={agentDeleteRequest !== null}
        onClose={() => {
          if (!deleteAgentMutation.isPending) {
            deleteAgentMutation.reset();
            setAgentDeleteRequest(null);
          }
        }}
        tone="danger"
        actionLabel="delete selected agents"
        objectLabel={(agentDeleteRequest?.length ?? 0) === 1 ? "agent" : "agents"}
        confirmWord="DELETE AGENTS"
        confirmButtonLabel="Delete Agents"
        description="This deletes the selected agents."
        specialText="This action cannot be undone."
        objectSummary={
          agentDeleteRequest?.length === 1 ? (
            <>
              <div className="font-medium">{agentDeleteRequest[0]?.name || "Unnamed agent"}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {agentDeleteRequest[0]?.uid}
              </div>
            </>
          ) : agentDeleteRequest ? (
            <>
              <div className="font-medium">{agentDeleteRequest.length} agents selected</div>
              <div className="mt-1 text-muted-foreground">
                {agentDeleteRequest
                  .slice(0, 3)
                  .map((agent) => agent.name || agent.agent_unique_id || agent.uid)
                  .join(", ")}
                {agentDeleteRequest.length > 3 ? ", ..." : ""}
              </div>
            </>
          ) : null
        }
        error={
          deleteAgentMutation.isError
            ? deleteAgentMutation.error instanceof Error
              ? deleteAgentMutation.error.message
              : "The agent could not be deleted."
            : undefined
        }
        isPending={deleteAgentMutation.isPending}
        onConfirm={() => {
          if (!agentDeleteRequest || agentDeleteRequest.length === 0) {
            return;
          }

          return deleteAgentMutation.mutateAsync(agentDeleteRequest);
        }}
      />
    </div>
  );
}

function AgentRow({
  agent,
  selected,
  disabled,
  canOpenDetail,
  onToggleSelection,
  onOpenDetail,
  onStartSession,
}: {
  agent: AgentSearchResult;
  selected: boolean;
  disabled: boolean;
  canOpenDetail: boolean;
  onToggleSelection: (() => void) | null;
  onOpenDetail: () => void;
  onStartSession: () => void;
}) {
  const modelSummary =
    agent.llm_provider && agent.llm_model
      ? `${agent.llm_provider} / ${agent.llm_model}`
      : "No model configured";
  const description = agent.description?.trim() || "No description provided.";
  const agentName = agent.name?.trim() || "Unnamed agent";
  const primaryIdentifier =
    agent.agent_unique_id?.trim() || agent.uid?.trim() || "No identifier";
  const agentUid = agent.uid?.trim() || "";
  const secondaryIdentifier = agentUid && agentUid !== primaryIdentifier ? agentUid : "";

  return (
    <tr>
      <td className={getRegistryTableCellClassName(selected, "left")}>
        {onToggleSelection ? (
          <MainSequenceSelectionCheckbox
            ariaLabel={`Select ${agentName}`}
            checked={selected}
            onChange={onToggleSelection}
          />
        ) : null}
      </td>
      <td className={getRegistryTableCellClassName(selected)}>
        <div className="flex items-start gap-2">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <button
              type="button"
              className="group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:text-primary"
              disabled={!canOpenDetail}
              onClick={onOpenDetail}
              title={`Open ${agentName}`}
            >
              <span className="font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors group-hover:decoration-primary group-focus-visible:decoration-primary">
                {agentName}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary" />
            </button>
            <div
              className="mt-0.5 line-clamp-2 text-muted-foreground"
              style={{ fontSize: "var(--table-meta-font-size)" }}
              title={description}
            >
              {description}
            </div>
          </div>
        </div>
      </td>
      <td className={getRegistryTableCellClassName(selected)}>
        <div className="font-mono text-foreground">{primaryIdentifier}</div>
        {secondaryIdentifier ? (
          <div
            className="mt-0.5 font-mono text-muted-foreground"
            style={{ fontSize: "var(--table-meta-font-size)" }}
          >
            {secondaryIdentifier}
          </div>
        ) : null}
      </td>
      <td className={getRegistryTableCellClassName(selected)}>
        <div className="text-foreground">{agent.agentType || "Unknown type"}</div>
      </td>
      <td className={getRegistryTableCellClassName(selected)}>
        <div className="text-foreground">{modelSummary}</div>
      </td>
      <td className={getRegistryTableCellClassName(selected, "right")}>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="h-9 min-w-[9.25rem] whitespace-nowrap rounded-full border-border/80 bg-background/55 px-3.5 text-[12px] font-medium text-foreground hover:bg-background/75"
            disabled={disabled}
            onClick={onStartSession}
          >
            Start session
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function formatSemanticScore(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : null;
}

function SemanticAgentRow({
  agent,
  canOpenDetail,
  onOpenDetail,
}: {
  agent: AgentSemanticSearchResult;
  canOpenDetail: boolean;
  onOpenDetail: () => void;
}) {
  const combinedScore = formatSemanticScore(agent.combined_score);
  const semanticScore = formatSemanticScore(agent.semantic_score);
  const textScore = formatSemanticScore(agent.text_score);

  return (
    <button
      type="button"
      className="flex w-full items-start justify-between gap-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-4 text-left transition-colors hover:bg-background/55"
      disabled={!canOpenDetail}
      onClick={onOpenDetail}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">
              {agent.name || "Unnamed agent"}
            </div>
            <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {agent.agent_unique_id}
            </div>
            {agent.description ? (
              <div className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {agent.description}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        {combinedScore ? <Badge variant="neutral">{`Score ${combinedScore}`}</Badge> : null}
        {(semanticScore || textScore) ? (
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {semanticScore ? <div>{`Semantic ${semanticScore}`}</div> : null}
            {textScore ? <div>{`Text ${textScore}`}</div> : null}
          </div>
        ) : null}
        <div className="mt-3 flex justify-end text-primary">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}
