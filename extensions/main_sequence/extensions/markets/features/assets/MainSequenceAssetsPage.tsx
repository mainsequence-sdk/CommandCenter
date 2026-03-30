import { useDeferredValue, useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { Database, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchAssetSummary,
  formatMainSequenceError,
  listAssets,
  mainSequenceRegistryPageSize,
  type AssetListFilters,
  type AssetListRow,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import {
  MainSequenceAssetDetailView,
  isAssetDetailTabId,
  type AssetDetailTabId,
} from "./MainSequenceAssetDetailView";

const mainSequenceAssetIdParam = "msAssetId";
const mainSequenceAssetTabParam = "msAssetTab";
const defaultAssetDetailTabId: AssetDetailTabId = "metadata";

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

  nextParams.set("page", String(page));
  nextParams.set("page_size", String(pageSize));
  nextParams.set("limit", String(pageSize));
  nextParams.set("offset", String(nextOffset));
}

function formatAssetValue(value: string | null | undefined, fallback = "Not available") {
  return value?.trim() || fallback;
}

export function MainSequenceAssetsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const searchValue = searchParams.get("search") ?? "";
  const selectedAssetId = Number(searchParams.get(mainSequenceAssetIdParam) ?? "");
  const requestedAssetTabId = searchParams.get(mainSequenceAssetTabParam);
  const pageSize = mainSequenceRegistryPageSize;
  const offsetParam = readPositiveInt(searchParams.get("offset"));
  const pageParam = readPositiveInt(searchParams.get("page"));
  const page = pageParam ?? (offsetParam !== null ? Math.floor(offsetParam / pageSize) + 1 : 1);
  const pageIndex = Math.max(0, page - 1);
  const limit = readPositiveInt(searchParams.get("limit")) ?? pageSize;
  const offset = offsetParam ?? pageIndex * pageSize;
  const isAssetDetailOpen = Number.isFinite(selectedAssetId) && selectedAssetId > 0;
  const selectedAssetTabId: AssetDetailTabId = isAssetDetailTabId(requestedAssetTabId)
    ? requestedAssetTabId
    : defaultAssetDetailTabId;

  const deferredSearchValue = useDeferredValue(searchValue);

  const assetFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        page,
        pageSize,
        limit,
        offset,
      }) satisfies AssetListFilters,
    [deferredSearchValue, limit, offset, page, pageSize],
  );
  const assetSummaryFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
      }) satisfies AssetListFilters,
    [deferredSearchValue],
  );

  const assetsQuery = useQuery({
    queryKey: ["main_sequence", "assets", "list", assetFilters],
    queryFn: () => listAssets(assetFilters),
  });
  const assetSummaryQuery = useQuery({
    queryKey: ["main_sequence", "assets", "summary", assetSummaryFilters],
    queryFn: () => fetchAssetSummary(assetSummaryFilters),
  });

  const pageRows = assetsQuery.data?.results ?? [];
  const selectedAssetFromList = useMemo(
    () => pageRows.find((asset) => asset.id === selectedAssetId) ?? null,
    [pageRows, selectedAssetId],
  );
  const totalCount = assetsQuery.data?.count ?? 0;

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

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search);
    let changed = false;

    ["ticker", "name", "exchange_code", "is_custom_by_organization"].forEach((key) => {
      if (nextParams.has(key)) {
        nextParams.delete(key);
        changed = true;
      }
    });

    [...nextParams.keys()].forEach((key) => {
      if (key.startsWith("current_snapshot__")) {
        nextParams.delete(key);
        changed = true;
      }
    });

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
  }, [location.pathname, location.search, navigate]);

  function updateFilter(key: string, value: string) {
    updateSearchParams(
      (nextParams) => {
        setOrDeleteParam(nextParams, key, value);
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

  function closeAssetDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceAssetIdParam);
      nextParams.delete(mainSequenceAssetTabParam);
    });
  }

  function selectAssetDetailTab(tabId: AssetDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceAssetTabParam, tabId);
    });
  }

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    if (page > totalPages) {
      updateSearchParams(
        (nextParams) => {
          applyPaginationParams(nextParams, totalPages, pageSize);
        },
        { replace: true },
      );
    }
  }, [page, pageSize, totalCount]);

  if (isAssetDetailOpen) {
    return (
      <MainSequenceAssetDetailView
        activeTabId={selectedAssetTabId}
        assetId={selectedAssetId}
        initialAsset={selectedAssetFromList}
        onBack={closeAssetDetail}
        onSelectTab={selectAssetDetailTab}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Master List"
        description="Browse market assets with the shared Main Sequence registry pattern."
        actions={<Badge variant="neutral">{`${totalCount} assets`}</Badge>}
      />

      {assetSummaryQuery.data ? <MainSequenceEntitySummaryCard summary={assetSummaryQuery.data} /> : null}

      {assetSummaryQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(assetSummaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle>Asset registry</CardTitle>
              <CardDescription>Browse and search the frontend asset list.</CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Asset actions"
              accessory={<Badge variant="neutral">{`${totalCount} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search by id, unique identifier, FIGI, name, ticker, exchange, sector, or type"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {assetsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading assets
              </div>
            </div>
          ) : null}

          {assetsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(assetsQuery.error)}
            </div>
          ) : null}

          {!assetsQuery.isLoading && !assetsQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No assets found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search or clear unsupported query params from the URL.
              </p>
            </div>
          ) : null}

          {!assetsQuery.isLoading && !assetsQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 pb-2">Asset</th>
                    <th className="px-4 pb-2">Ticker</th>
                    <th className="px-4 pb-2">Exchange</th>
                    <th className="px-4 pb-2">Sector</th>
                    <th className="px-4 pb-2">Type</th>
                    <th className="px-4 pb-2">is_custom_by_organization</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((asset) => (
                    <tr key={asset.id}>
                      <td className={getRegistryTableCellClassName(false, "left")}>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {formatAssetValue(
                                asset.name,
                                asset.unique_identifier || asset.figi || `Asset ${asset.id}`,
                              )}
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {[
                                `ID ${asset.id}`,
                                asset.unique_identifier ? `UID ${asset.unique_identifier}` : null,
                                asset.figi ? `FIGI ${asset.figi}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                          <div className="font-medium text-foreground">
                            {formatAssetValue(asset.ticker)}
                          </div>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                          {formatAssetValue(asset.exchange_code)}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                          {formatAssetValue(asset.security_market_sector)}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                          {formatAssetValue(asset.security_type)}
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                          <span className="font-mono text-xs text-foreground">
                            {String(asset.is_custom_by_organization)}
                          </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>

        <MainSequenceRegistryPagination
          count={totalCount}
          itemLabel="assets"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}
