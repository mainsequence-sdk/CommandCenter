import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toaster";

import {
  bulkDeleteTargetPortfolios,
  formatMainSequenceError,
  listTargetPortfolios,
  mainSequenceRegistryPageSize,
  type TargetPortfolioListFilters,
  type TargetPortfolioListRow,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import {
  defaultTargetPortfolioDetailTabId,
  isTargetPortfolioDetailTabId,
  MainSequenceTargetPortfolioDetailView,
} from "./MainSequenceTargetPortfolioDetailView";

type PortfolioDeleteIntent = { mode: "selection"; portfolios: TargetPortfolioListRow[] };

const mainSequenceTargetPortfolioUidParam = "msTargetPortfolioUid";
const mainSequenceTargetPortfolioTabParam = "msTargetPortfolioTab";

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

function isBlankValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function getPortfolioName(row: TargetPortfolioListRow) {
  const value = row.unique_identifier;
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function truncateText(value: string, maxLength = 140) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function formatPortfolioValue(value: unknown, key?: string) {
  if (isBlankValue(value)) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : "—";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (key && key.toLowerCase().includes("date")) {
      const parsed = Date.parse(trimmed);

      if (Number.isFinite(parsed)) {
        return new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(parsed));
      }
    }

    return truncateText(trimmed);
  }

  if (Array.isArray(value)) {
    const normalizedItems = value
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter((item) => item.length > 0);

    return normalizedItems.length > 0 ? truncateText(normalizedItems.join(", ")) : "—";
  }

  try {
    return truncateText(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function getPortfolioCalendarLabel(row: TargetPortfolioListRow) {
  return formatPortfolioValue(row.calendar_name ?? row.calendar_uid);
}

function getPortfolioIndexUid(row: TargetPortfolioListRow) {
  return formatPortfolioValue(row.portfolio_index_uid);
}

function getPortfolioWeightsDataNodeUid(row: TargetPortfolioListRow) {
  return formatPortfolioValue(row.portfolio_weights_data_node_uid);
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

function buildPortfolioDeleteSummary(portfolios: TargetPortfolioListRow[]) {
  if (portfolios.length === 0) {
    return null;
  }

  const preview = portfolios.slice(0, 5);

  return (
    <div className="space-y-2">
      {preview.map((portfolio) => (
        <div key={portfolio.uid} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{getPortfolioName(portfolio)}</div>
            <div className="truncate text-xs text-muted-foreground">
              {`Index UID ${getPortfolioIndexUid(portfolio)}`}
            </div>
          </div>
          <Badge variant="neutral">{`UID ${portfolio.uid}`}</Badge>
        </div>
      ))}
      {portfolios.length > preview.length ? (
        <div className="text-xs text-muted-foreground">
          {`…and ${portfolios.length - preview.length} more portfolio${portfolios.length - preview.length === 1 ? "" : "s"}.`}
        </div>
      ) : null}
    </div>
  );
}

export function MainSequenceTargetPortfoliosPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [deleteIntent, setDeleteIntent] = useState<PortfolioDeleteIntent | null>(null);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const searchValue = searchParams.get("search") ?? "";
  const selectedPortfolioUid = searchParams.get(mainSequenceTargetPortfolioUidParam)?.trim() ?? "";
  const requestedPortfolioTabId = searchParams.get(mainSequenceTargetPortfolioTabParam);
  const pageSize = mainSequenceRegistryPageSize;
  const offsetParam = readPositiveInt(searchParams.get("offset"));
  const pageParam = readPositiveInt(searchParams.get("page"));
  const page = offsetParam !== null ? Math.floor(offsetParam / pageSize) + 1 : (pageParam ?? 1);
  const pageIndex = Math.max(0, page - 1);
  const limit = pageSize;
  const offset = offsetParam ?? Math.max(0, pageIndex * pageSize);
  const isPortfolioDetailOpen = selectedPortfolioUid.length > 0;
  const selectedPortfolioTabId = isTargetPortfolioDetailTabId(requestedPortfolioTabId)
    ? requestedPortfolioTabId
    : defaultTargetPortfolioDetailTabId;
  const needsSearchParamNormalization = useMemo(() => {
    if (pageParam !== null || searchParams.has("page_size")) {
      return true;
    }

    const limitParam = readPositiveInt(searchParams.get("limit"));
    return limitParam !== null && limitParam !== pageSize;
  }, [pageParam, pageSize, searchParams]);

  const deferredSearchValue = useDeferredValue(searchValue);

  const portfolioFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit,
        offset,
      }) satisfies TargetPortfolioListFilters,
    [deferredSearchValue, limit, offset],
  );

  const portfoliosQuery = useQuery({
    enabled: !needsSearchParamNormalization,
    queryKey: ["main_sequence", "target_portfolios", "list", portfolioFilters],
    queryFn: () => listTargetPortfolios(portfolioFilters),
  });

  const pageRows = portfoliosQuery.data?.results ?? [];
  const selectedPortfolioFromList = useMemo(
    () => pageRows.find((portfolio) => portfolio.uid === selectedPortfolioUid) ?? null,
    [pageRows, selectedPortfolioUid],
  );
  const totalCount = portfoliosQuery.data?.count ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const portfolioSelection = useRegistrySelection(pageRows, (portfolio) => portfolio.uid);

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

  function closePortfolioDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceTargetPortfolioUidParam);
      nextParams.delete(mainSequenceTargetPortfolioTabParam);
    });
  }

  function selectPortfolioDetailTab(tabId: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceTargetPortfolioUidParam, selectedPortfolioUid);
      nextParams.set(mainSequenceTargetPortfolioTabParam, tabId);
    });
  }

  const deletePortfoliosMutation = useMutation({
    mutationFn: bulkDeleteTargetPortfolios,
    onSuccess: async () => {
      if (deleteIntent?.mode === "selection") {
        const deletedUids = deleteIntent.portfolios.map((portfolio) => portfolio.uid);

        portfolioSelection.setSelection(
          portfolioSelection.selectedIds.filter((uid) => !deletedUids.includes(uid)),
        );
      } else {
        portfolioSelection.clearSelection();
      }

      setDeleteIntent(null);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "target_portfolios"],
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Portfolio deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const portfolioBulkActions =
    portfolioSelection.selectedCount > 0
      ? [
          {
            id: "delete-portfolios",
            label:
              portfolioSelection.selectedCount === 1
                ? "Delete selected portfolio"
                : "Delete selected portfolios",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () =>
              setDeleteIntent({
                mode: "selection",
                portfolios: portfolioSelection.selectedItems,
              }),
          },
        ]
      : [];

  const deleteSelectionPortfolios =
    deleteIntent?.mode === "selection" ? deleteIntent.portfolios : [];
  const deleteDialogTitle =
    deleteSelectionPortfolios.length === 1
        ? "Delete portfolio"
        : "Delete portfolios";
  const deleteActionLabel =
    deleteSelectionPortfolios.length === 1
        ? "delete the selected portfolio"
        : "delete the selected portfolios";
  const deleteConfirmButtonLabel =
    deleteSelectionPortfolios.length === 1
      ? "Delete portfolio"
      : "Delete portfolios";
  const deleteDescription =
    "This uses the portfolio bulk-delete endpoint for the selected portfolio UIDs.";
  const deleteObjectSummary = buildPortfolioDeleteSummary(deleteSelectionPortfolios);

  async function confirmDelete() {
    if (!deleteIntent) {
      return null;
    }

    return deletePortfoliosMutation.mutateAsync({
      uids: deleteIntent.portfolios.map((portfolio) => portfolio.uid),
    });
  }

  if (isPortfolioDetailOpen) {
    return (
      <MainSequenceTargetPortfolioDetailView
        initialPortfolio={selectedPortfolioFromList}
        onBack={closePortfolioDetail}
        onSelectTab={selectPortfolioDetailTab}
        portfolioUid={selectedPortfolioUid}
        selectedTabId={selectedPortfolioTabId}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Portfolios"
        description="Browse portfolios using the shared Main Sequence registry pattern and remove selected rows through the backend bulk-delete action."
        actions={<Badge variant="neutral">{`${totalCount} portfolios`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Portfolio registry</CardTitle>
              <CardDescription>
                Browse portfolios backed by the standard list endpoint. This surface
                keeps the same shared search, pagination, and bulk-action patterns used across Main
                Sequence Markets.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Portfolio actions"
              accessory={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{`${totalCount} portfolios`}</Badge>
                </div>
              }
              bulkActions={portfolioBulkActions}
              clearSelectionLabel="Clear portfolios"
              onClearSelection={portfolioSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} portfolios selected`}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search portfolios"
              selectionCount={portfolioSelection.selectedCount}
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {portfoliosQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading portfolios
              </div>
            </div>
          ) : null}

          {portfoliosQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(portfoliosQuery.error)}
            </div>
          ) : null}

          {!portfoliosQuery.isLoading && !portfoliosQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No portfolios found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search to locate a portfolio.
              </p>
            </div>
          ) : null}

          {!portfoliosQuery.isLoading && !portfoliosQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible portfolios"
                        checked={portfolioSelection.allSelected}
                        indeterminate={portfolioSelection.someSelected}
                        onChange={portfolioSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Portfolio</th>
                    <th className="px-4 pb-2">Calendar</th>
                    <th className="px-4 pb-2">Portfolio Index UID</th>
                    <th className="px-4 pb-2">Weights Data Node</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((portfolio) => {
                    const selected = portfolioSelection.isSelected(portfolio.uid);

                    return (
                      <tr key={portfolio.uid}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select portfolio ${portfolio.uid}`}
                            checked={selected}
                            onChange={() => portfolioSelection.toggleSelection(portfolio.uid)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <button
                            type="button"
                            className="group min-w-0 text-left"
                            onClick={() =>
                              updateSearchParams((nextParams) => {
                                nextParams.set(
                                  mainSequenceTargetPortfolioUidParam,
                                  portfolio.uid,
                                );
                                nextParams.set(
                                  mainSequenceTargetPortfolioTabParam,
                                  defaultTargetPortfolioDetailTabId,
                                );
                              })
                            }
                          >
                            <div className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
                              <span className="truncate">{getPortfolioName(portfolio)}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                            </div>
                          </button>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="text-foreground">
                            {getPortfolioCalendarLabel(portfolio)}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="font-mono text-xs text-foreground">
                            {getPortfolioIndexUid(portfolio)}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <div className="font-mono text-xs text-foreground">
                            {getPortfolioWeightsDataNodeUid(portfolio)}
                          </div>
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
          itemLabel="portfolios"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>

      <ActionConfirmationDialog
        open={deleteIntent !== null}
        onClose={() => {
          if (!deletePortfoliosMutation.isPending) {
            setDeleteIntent(null);
          }
        }}
        title={deleteDialogTitle}
        tone="danger"
        actionLabel={deleteActionLabel}
        objectLabel="portfolio rows"
        objectSummary={deleteObjectSummary}
        description={deleteDescription}
        confirmWord="DELETE"
        confirmButtonLabel={deleteConfirmButtonLabel}
        isPending={deletePortfoliosMutation.isPending}
        onConfirm={confirmDelete}
        error={
          deletePortfoliosMutation.isError ? formatMainSequenceError(deletePortfoliosMutation.error) : undefined
        }
        successToast={{
          title: (result) => {
            const fallbackCount = deleteIntent?.portfolios.length ?? 0;
            const deletedCount = resolveDeletedCount(result, fallbackCount);

            return deletedCount === 1 ? "Portfolio deleted" : "Portfolios deleted";
          },
          description: (result) =>
            readDeleteDetail(result) ||
            "The selected portfolios were removed.",
          variant: "success",
        }}
      />
    </div>
  );
}
