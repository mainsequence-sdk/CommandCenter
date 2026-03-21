import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Plus, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeletePortfolioGroups,
  createPortfolioGroup,
  formatMainSequenceError,
  listPortfolioGroups,
  mainSequenceRegistryPageSize,
  type PortfolioGroupListFilters,
  type PortfolioGroupListRow,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import {
  buildCreatePortfolioGroupPayload,
  buildPortfolioGroupDeleteSummary,
  formatPortfolioGroupValue,
  getPortfolioGroupCreationDate,
  getPortfolioGroupDetailPath,
  getPortfolioGroupTitle,
  getPortfolioGroupUniqueIdentifier,
  PortfolioGroupEditorDialog,
  type PortfolioGroupEditorValues,
} from "./portfolioGroupShared";

type PortfolioGroupDeleteIntent = {
  portfolioGroups: PortfolioGroupListRow[];
};

function readPositiveInt(value: string | null) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function setOrDeleteParam(nextParams: URLSearchParams, key: string, value: string) {
  if (value.trim()) {
    nextParams.set(key, value);
    return;
  }

  nextParams.delete(key);
}

function applyPaginationParams(nextParams: URLSearchParams, page: number, pageSize: number) {
  const nextOffset = Math.max(0, (page - 1) * pageSize);

  nextParams.set("limit", String(pageSize));
  nextParams.set("offset", String(nextOffset));
  nextParams.delete("page");
  nextParams.delete("page_size");
}

function resolveDeletedCount(result: unknown, fallbackCount: number) {
  if (
    result &&
    typeof result === "object" &&
    "deleted_count" in result &&
    typeof (result as { deleted_count?: unknown }).deleted_count === "number"
  ) {
    return (result as { deleted_count: number }).deleted_count;
  }

  return fallbackCount;
}

function readDeleteDetail(result: unknown) {
  if (
    result &&
    typeof result === "object" &&
    "detail" in result &&
    typeof (result as { detail?: unknown }).detail === "string"
  ) {
    const detail = (result as { detail: string }).detail.trim();
    return detail.length > 0 ? detail : undefined;
  }

  return undefined;
}

export function MainSequencePortfolioGroupsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteIntent, setDeleteIntent] = useState<PortfolioGroupDeleteIntent | null>(null);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const searchValue = searchParams.get("search") ?? "";
  const pageSize = mainSequenceRegistryPageSize;
  const offsetParam = readPositiveInt(searchParams.get("offset"));
  const pageParam = readPositiveInt(searchParams.get("page"));
  const page = offsetParam !== null ? Math.floor(offsetParam / pageSize) + 1 : (pageParam ?? 1);
  const pageIndex = Math.max(0, page - 1);
  const limit = pageSize;
  const offset = offsetParam ?? Math.max(0, pageIndex * pageSize);
  const needsSearchParamNormalization = useMemo(() => {
    if (pageParam !== null || searchParams.has("page_size")) {
      return true;
    }

    const limitParam = readPositiveInt(searchParams.get("limit"));
    return limitParam !== null && limitParam !== pageSize;
  }, [pageParam, pageSize, searchParams]);

  const deferredSearchValue = useDeferredValue(searchValue);

  const portfolioGroupFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit,
        offset,
      }) satisfies PortfolioGroupListFilters,
    [deferredSearchValue, limit, offset],
  );

  const portfolioGroupsQuery = useQuery({
    enabled: !needsSearchParamNormalization,
    queryKey: ["main_sequence", "portfolio_groups", "list", portfolioGroupFilters],
    queryFn: () => listPortfolioGroups(portfolioGroupFilters),
  });

  const pageRows = portfolioGroupsQuery.data?.results ?? [];
  const totalCount = portfolioGroupsQuery.data?.count ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const portfolioGroupSelection = useRegistrySelection(pageRows);

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search);
    let changed = false;

    if (nextParams.has("page")) {
      nextParams.delete("page");
      changed = true;
    }

    if (nextParams.has("page_size")) {
      nextParams.delete("page_size");
      changed = true;
    }

    const limitParam = readPositiveInt(nextParams.get("limit"));

    if (limitParam !== null && limitParam !== pageSize) {
      nextParams.set("limit", String(pageSize));
      changed = true;
    }

    if (pageParam !== null && offsetParam === null) {
      nextParams.set("offset", String(Math.max(0, (pageParam - 1) * pageSize)));
      changed = true;
    }

    if (!changed) {
      return;
    }

    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, offsetParam, pageParam, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      const nextParams = new URLSearchParams(location.search);
      applyPaginationParams(nextParams, totalPages, pageSize);

      navigate(
        {
          pathname: location.pathname,
          search: `?${nextParams.toString()}`,
        },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate, page, pageSize, totalPages]);

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

  function updateSearch(value: string) {
    updateSearchParams(
      (nextParams) => {
        setOrDeleteParam(nextParams, "search", value);
        applyPaginationParams(nextParams, 1, pageSize);
      },
      { replace: true },
    );
  }

  function handlePageChange(nextPageIndex: number) {
    updateSearchParams((nextParams) => {
      applyPaginationParams(nextParams, nextPageIndex + 1, pageSize);
    });
  }

  const deletePortfolioGroupsMutation = useMutation({
    mutationFn: bulkDeletePortfolioGroups,
    onSuccess: async () => {
      const deletedIds = deleteIntent?.portfolioGroups.map((portfolioGroup) => portfolioGroup.id) ?? [];

      portfolioGroupSelection.setSelection(
        portfolioGroupSelection.selectedIds.filter((id) => !deletedIds.includes(id)),
      );
      setDeleteIntent(null);

      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_groups"],
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Portfolio group deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const createPortfolioGroupMutation = useMutation({
    mutationFn: createPortfolioGroup,
    onSuccess: async (portfolioGroup) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "portfolio_groups"],
      });

      toast({
        title: "Portfolio group ready",
        description: `${getPortfolioGroupTitle(portfolioGroup)} is available.`,
      });

      setCreateDialogOpen(false);
      navigate(getPortfolioGroupDetailPath(portfolioGroup.id), {
        state: {
          from: `${location.pathname}${location.search}`,
        },
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Portfolio group creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const portfolioGroupBulkActions =
    portfolioGroupSelection.selectedCount > 0
      ? [
          {
            id: "delete-portfolio-groups",
            label:
              portfolioGroupSelection.selectedCount === 1
                ? "Delete selected portfolio group"
                : "Delete selected portfolio groups",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () =>
              setDeleteIntent({
                portfolioGroups: portfolioGroupSelection.selectedItems,
              }),
          },
        ]
      : [];

  async function confirmDelete() {
    if (!deleteIntent) {
      return null;
    }

    return deletePortfolioGroupsMutation.mutateAsync({
      ids: deleteIntent.portfolioGroups.map((portfolioGroup) => portfolioGroup.id),
    });
  }

  function submitCreate(values: PortfolioGroupEditorValues) {
    createPortfolioGroupMutation.mutate(buildCreatePortfolioGroupPayload(values));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Portfolio Groups"
        description="Browse portfolio groups using the shared Main Sequence registry pattern and open dedicated detail pages."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{`${totalCount} groups`}</Badge>
            <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create group
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Portfolio group registry</CardTitle>
              <CardDescription>
                Browse portfolio groups backed by the standard DRF list endpoint with the same shared search, pagination, and bulk-selection pattern used across Main Sequence Markets.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Portfolio group actions"
              accessory={<Badge variant="neutral">{`${totalCount} rows`}</Badge>}
              bulkActions={portfolioGroupBulkActions}
              clearSelectionLabel="Clear portfolio groups"
              onClearSelection={portfolioGroupSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} portfolio groups selected`}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search portfolio groups"
              selectionCount={portfolioGroupSelection.selectedCount}
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {portfolioGroupsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading portfolio groups
              </div>
            </div>
          ) : null}

          {portfolioGroupsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(portfolioGroupsQuery.error)}
            </div>
          ) : null}

          {!portfolioGroupsQuery.isLoading && !portfolioGroupsQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No portfolio groups found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search to locate a portfolio group.
              </p>
            </div>
          ) : null}

          {!portfolioGroupsQuery.isLoading && !portfolioGroupsQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible portfolio groups"
                        checked={portfolioGroupSelection.allSelected}
                        indeterminate={portfolioGroupSelection.someSelected}
                        onChange={portfolioGroupSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Name</th>
                    <th className="px-4 pb-2">Unique Identifier</th>
                    <th className="px-4 pb-2">Creation Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((portfolioGroup) => {
                    const selected = portfolioGroupSelection.isSelected(portfolioGroup.id);

                    return (
                      <tr key={portfolioGroup.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select portfolio group ${portfolioGroup.id}`}
                            checked={selected}
                            onChange={() => portfolioGroupSelection.toggleSelection(portfolioGroup.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <button
                            type="button"
                            className="group min-w-0 text-left"
                            onClick={() =>
                              navigate(getPortfolioGroupDetailPath(portfolioGroup.id), {
                                state: {
                                  from: `${location.pathname}${location.search}`,
                                },
                              })
                            }
                          >
                            <div className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
                              <span className="truncate">{getPortfolioGroupTitle(portfolioGroup)}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                            </div>
                          </button>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          {formatPortfolioGroupValue(getPortfolioGroupUniqueIdentifier(portfolioGroup))}
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          {formatPortfolioGroupValue(getPortfolioGroupCreationDate(portfolioGroup), "creation_date")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>

        <MainSequenceRegistryPagination
          count={totalCount}
          itemLabel="groups"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>

      <PortfolioGroupEditorDialog
        open={createDialogOpen}
        onClose={() => {
          if (!createPortfolioGroupMutation.isPending) {
            setCreateDialogOpen(false);
          }
        }}
        onSubmit={submitCreate}
        isPending={createPortfolioGroupMutation.isPending}
        error={createPortfolioGroupMutation.error}
        initialValues={{
          uniqueIdentifier: "",
          displayName: "",
          source: "Main Sequence Markets",
          description: "",
        }}
      />

      <ActionConfirmationDialog
        open={deleteIntent !== null}
        onClose={() => {
          if (!deletePortfolioGroupsMutation.isPending) {
            setDeleteIntent(null);
          }
        }}
        title={
          (deleteIntent?.portfolioGroups.length ?? 0) === 1
            ? "Delete portfolio group"
            : "Delete portfolio groups"
        }
        tone="danger"
        actionLabel={
          (deleteIntent?.portfolioGroups.length ?? 0) === 1
            ? "delete the selected portfolio group"
            : "delete the selected portfolio groups"
        }
        objectLabel="portfolio group rows"
        objectSummary={buildPortfolioGroupDeleteSummary(deleteIntent?.portfolioGroups ?? [])}
        description="This uses the portfolio-group bulk-delete endpoint for the selected rows."
        confirmWord="DELETE"
        confirmButtonLabel={
          (deleteIntent?.portfolioGroups.length ?? 0) === 1
            ? "Delete portfolio group"
            : "Delete portfolio groups"
        }
        isPending={deletePortfolioGroupsMutation.isPending}
        onConfirm={confirmDelete}
        error={
          deletePortfolioGroupsMutation.isError
            ? formatMainSequenceError(deletePortfolioGroupsMutation.error)
            : undefined
        }
        successToast={{
          title: (result) => {
            const fallbackCount = deleteIntent?.portfolioGroups.length ?? 0;
            const deletedCount = resolveDeletedCount(result, fallbackCount);

            return deletedCount === 1 ? "Portfolio group deleted" : "Portfolio groups deleted";
          },
          description: (result) =>
            readDeleteDetail(result) || "The selected portfolio groups were removed.",
          variant: "success",
        }}
      />
    </div>
  );
}
