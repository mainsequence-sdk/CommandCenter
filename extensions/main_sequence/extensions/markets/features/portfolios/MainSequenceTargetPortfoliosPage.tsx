import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Database, Loader2, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
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

type PortfolioDeleteIntent =
  | { mode: "selection"; portfolios: TargetPortfolioListRow[] }
  | { mode: "filtered" };

const mainSequenceTargetPortfolioIdParam = "msTargetPortfolioId";
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

function getPortfolioIndexAsset(row: TargetPortfolioListRow) {
  return row.index_asset ?? row.portfolio_index_asset ?? null;
}

function getPortfolioIndexSnapshot(row: TargetPortfolioListRow) {
  return getPortfolioIndexAsset(row)?.current_snapshot ?? null;
}

function getPortfolioName(row: TargetPortfolioListRow) {
  const value = getPortfolioIndexSnapshot(row)?.name;
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

function getPortfolioIndexTicker(row: TargetPortfolioListRow) {
  const ticker = getPortfolioIndexSnapshot(row)?.ticker;
  return typeof ticker === "string" && ticker.trim() ? ticker.trim() : "—";
}

function formatCreationDate(value: unknown) {
  return formatPortfolioValue(value, "creation_date");
}

function getPortfolioIndexAssetId(row: TargetPortfolioListRow) {
  const nestedAsset = getPortfolioIndexAsset(row);
  const directId = nestedAsset?.id;

  if (typeof directId === "number" && Number.isFinite(directId) && directId > 0) {
    return directId;
  }

  const snapshotId = nestedAsset?.current_snapshot?.id;
  return typeof snapshotId === "number" && Number.isFinite(snapshotId) && snapshotId > 0
    ? snapshotId
    : null;
}

function getAssetDetailPath(assetId: number) {
  const searchParams = new URLSearchParams({
    msAssetId: String(assetId),
  });

  return `${getAppPath("main_sequence_markets", "assets")}?${searchParams.toString()}`;
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
        <div key={portfolio.id} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{getPortfolioName(portfolio)}</div>
            <div className="truncate text-xs text-muted-foreground">{`Index ticker ${getPortfolioIndexTicker(portfolio)}`}</div>
          </div>
          <Badge variant="neutral">{`ID ${portfolio.id}`}</Badge>
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

function buildFilteredDeleteSummary({
  searchValue,
  totalCount,
}: {
  searchValue: string;
  totalCount: number;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-foreground">
        {`This will delete every target portfolio matching the current search.`}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="neutral">{`${totalCount} matching row${totalCount === 1 ? "" : "s"}`}</Badge>
        <span>{`Search: "${searchValue}"`}</span>
      </div>
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
  const selectedPortfolioId = Number(searchParams.get(mainSequenceTargetPortfolioIdParam) ?? "");
  const requestedPortfolioTabId = searchParams.get(mainSequenceTargetPortfolioTabParam);
  const pageSize = mainSequenceRegistryPageSize;
  const offsetParam = readPositiveInt(searchParams.get("offset"));
  const pageParam = readPositiveInt(searchParams.get("page"));
  const page = offsetParam !== null ? Math.floor(offsetParam / pageSize) + 1 : (pageParam ?? 1);
  const pageIndex = Math.max(0, page - 1);
  const limit = pageSize;
  const offset = offsetParam ?? Math.max(0, pageIndex * pageSize);
  const isPortfolioDetailOpen = Number.isFinite(selectedPortfolioId) && selectedPortfolioId > 0;
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
    () => pageRows.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null,
    [pageRows, selectedPortfolioId],
  );
  const totalCount = portfoliosQuery.data?.count ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const portfolioSelection = useRegistrySelection(pageRows);

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
      nextParams.delete(mainSequenceTargetPortfolioIdParam);
      nextParams.delete(mainSequenceTargetPortfolioTabParam);
    });
  }

  function selectPortfolioDetailTab(tabId: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceTargetPortfolioIdParam, String(selectedPortfolioId));
      nextParams.set(mainSequenceTargetPortfolioTabParam, tabId);
    });
  }

  const deletePortfoliosMutation = useMutation({
    mutationFn: bulkDeleteTargetPortfolios,
    onSuccess: async () => {
      if (deleteIntent?.mode === "selection") {
        const deletedIds = deleteIntent.portfolios.map((portfolio) => portfolio.id);

        portfolioSelection.setSelection(
          portfolioSelection.selectedIds.filter((id) => !deletedIds.includes(id)),
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
    deleteIntent?.mode === "filtered"
      ? "Delete filtered portfolios"
      : deleteSelectionPortfolios.length === 1
        ? "Delete portfolio"
        : "Delete portfolios";
  const deleteActionLabel =
    deleteIntent?.mode === "filtered"
      ? "delete all portfolios matching the current search"
      : deleteSelectionPortfolios.length === 1
        ? "delete the selected portfolio"
        : "delete the selected portfolios";
  const deleteConfirmButtonLabel =
    deleteSelectionPortfolios.length === 1 && deleteIntent?.mode !== "filtered"
      ? "Delete portfolio"
      : "Delete portfolios";
  const deleteDescription =
    deleteIntent?.mode === "filtered"
      ? "This uses the target-portfolio bulk-delete endpoint with select_all=true and current_url set to the active list."
      : "This uses the target-portfolio bulk-delete endpoint for the selected rows.";
  const deleteObjectSummary =
    deleteIntent?.mode === "filtered"
      ? buildFilteredDeleteSummary({
          searchValue,
          totalCount,
        })
      : buildPortfolioDeleteSummary(deleteSelectionPortfolios);

  async function confirmDelete() {
    if (!deleteIntent) {
      return null;
    }

    if (deleteIntent.mode === "filtered") {
      return deletePortfoliosMutation.mutateAsync({
        selectAll: true,
        currentUrl: `${location.pathname}${location.search}`,
      });
    }

    return deletePortfoliosMutation.mutateAsync({
      ids: deleteIntent.portfolios.map((portfolio) => portfolio.id),
      selectedItemsIds: deleteIntent.portfolios.map((portfolio) => portfolio.id).join(","),
    });
  }

  if (isPortfolioDetailOpen) {
    return (
      <MainSequenceTargetPortfolioDetailView
        initialPortfolio={selectedPortfolioFromList}
        onBack={closePortfolioDetail}
        onSelectTab={selectPortfolioDetailTab}
        portfolioId={selectedPortfolioId}
        selectedTabId={selectedPortfolioTabId}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Portfolios"
        description="Browse target portfolios using the shared Main Sequence registry pattern and remove selected rows through the backend bulk-delete action."
        actions={<Badge variant="neutral">{`${totalCount} portfolios`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Target portfolio registry</CardTitle>
              <CardDescription>
                Browse target portfolios backed by the standard DRF list endpoint. This surface
                keeps the same shared search, pagination, and bulk-action patterns used across Main
                Sequence Markets.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Portfolio actions"
              accessory={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{`${totalCount} rows`}</Badge>
                  {searchValue.trim() && totalCount > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteIntent({ mode: "filtered" })}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete filtered
                    </Button>
                  ) : null}
                </div>
              }
              bulkActions={portfolioBulkActions}
              clearSelectionLabel="Clear portfolios"
              onClearSelection={portfolioSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} portfolios selected`}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search target portfolios"
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
                Try a different search to locate a target portfolio.
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
                    <th className="px-4 pb-2">Portfolio Name</th>
                    <th className="px-4 pb-2">Creation Date</th>
                    <th className="px-4 pb-2">Portfolio Index Ticker</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((portfolio) => {
                    const selected = portfolioSelection.isSelected(portfolio.id);

                    return (
                      <tr key={portfolio.id}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select portfolio ${portfolio.id}`}
                            checked={selected}
                            onChange={() => portfolioSelection.toggleSelection(portfolio.id)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <button
                            type="button"
                            className="group min-w-0 text-left"
                            onClick={() =>
                              updateSearchParams((nextParams) => {
                                nextParams.set(
                                  mainSequenceTargetPortfolioIdParam,
                                  String(portfolio.id),
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
                            {formatCreationDate(portfolio.creation_date)}
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          {(() => {
                            const assetId = getPortfolioIndexAssetId(portfolio);
                            const ticker = getPortfolioIndexTicker(portfolio);

                            if (assetId === null) {
                              return <div className="font-mono text-xs text-foreground">{ticker}</div>;
                            }

                            return (
                              <Link
                                to={getAssetDetailPath(assetId)}
                                className="font-mono text-xs text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary/80"
                              >
                                {ticker}
                              </Link>
                            );
                          })()}
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
            const fallbackCount =
              deleteIntent?.mode === "filtered"
                ? totalCount
                : (deleteIntent?.portfolios.length ?? 0);
            const deletedCount = resolveDeletedCount(result, fallbackCount);

            return deletedCount === 1 ? "Portfolio deleted" : "Portfolios deleted";
          },
          description: (result) =>
            readDeleteDetail(result) ||
            (deleteIntent?.mode === "filtered"
              ? "The filtered portfolios were removed."
              : "The selected portfolios were removed."),
          variant: "success",
        }}
      />
    </div>
  );
}
