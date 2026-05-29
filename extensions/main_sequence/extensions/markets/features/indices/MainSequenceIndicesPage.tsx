import { useDeferredValue, useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { Database, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  formatMainSequenceError,
  listIndices,
  mainSequenceRegistryPageSize,
  type IndexListFilters,
  type IndexListRow,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { MainSequenceIndexDetailView } from "./MainSequenceIndexDetailView";

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

function normalizeIndexUid(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatIndexText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function formatDescription(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : "No description provided.";
}

function getIndexTitle(indexRow: IndexListRow) {
  return formatIndexText(
    indexRow.display_name,
    formatIndexText(indexRow.unique_identifier, `Index ${indexRow.uid}`),
  );
}

export function MainSequenceIndicesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const selectedIndexUid = normalizeIndexUid(searchParams.get("msIndexUid"));
  const listViewActive = selectedIndexUid === null;
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

  const indexFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit,
        offset,
      }) satisfies IndexListFilters,
    [deferredSearchValue, limit, offset],
  );

  const indicesQuery = useQuery({
    enabled: listViewActive && !needsSearchParamNormalization,
    queryKey: ["main_sequence", "indices", "list", indexFilters],
    queryFn: () => listIndices(indexFilters),
  });

  const pageRows = indicesQuery.data?.results ?? [];
  const totalCount = indicesQuery.data?.count ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (!listViewActive) {
      return;
    }

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
  }, [listViewActive, location.pathname, location.search, navigate, offsetParam, pageParam, pageSize]);

  useEffect(() => {
    if (!listViewActive) {
      return;
    }

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
  }, [listViewActive, location.pathname, location.search, navigate, page, pageSize, totalPages]);

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
        nextParams.delete("msIndexUid");
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

  function openIndexDetail(indexUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set("msIndexUid", indexUid);
    });
  }

  function closeIndexDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete("msIndexUid");
    });
  }

  if (selectedIndexUid !== null) {
    return (
      <MainSequenceIndexDetailView
        indexUid={selectedIndexUid}
        onBack={closeIndexDetail}
        onDeleted={closeIndexDetail}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Indices"
        description="Browse the index registry and inspect the canonical metadata payload for each record."
        actions={<Badge variant="neutral">{`${totalCount} indices`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Index registry</CardTitle>
              <CardDescription>
                Search the current index list and open a record to inspect its read-only metadata payload.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Index actions"
              accessory={<Badge variant="neutral">{`${totalCount} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search indices"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {indicesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading indices
              </div>
            </div>
          ) : null}

          {indicesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(indicesQuery.error)}
            </div>
          ) : null}

          {!indicesQuery.isLoading && !indicesQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/60">
                <Database className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-foreground">No indices found</p>
                <p className="text-sm text-muted-foreground">
                  Adjust the search or refresh later after new index records are synced.
                </p>
              </div>
            </div>
          ) : null}

          {!indicesQuery.isLoading && !indicesQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/35 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Index</th>
                    <th className="px-4 py-3 font-medium">Identifier</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((indexRow) => (
                    <tr key={indexRow.uid} className="border-t border-border/70 align-top">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="space-y-1 text-left transition-opacity hover:opacity-80"
                          onClick={() => openIndexDetail(indexRow.uid)}
                        >
                          <div className="font-medium text-foreground">{getIndexTitle(indexRow)}</div>
                          <div className="font-mono text-xs text-muted-foreground">{indexRow.uid}</div>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatIndexText(indexRow.unique_identifier, "Not set")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatIndexText(indexRow.provider, "Unknown")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="max-w-2xl whitespace-pre-wrap leading-6">
                          {formatDescription(indexRow.description)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>

        {!indicesQuery.isLoading && !indicesQuery.isError && totalCount > 0 ? (
          <MainSequenceRegistryPagination
            count={totalCount}
            itemLabel="indices"
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        ) : null}
      </Card>
    </div>
  );
}
