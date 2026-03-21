import { useDeferredValue, useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { Database, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  formatMainSequenceError,
  listVirtualFunds,
  mainSequenceRegistryPageSize,
  type VirtualFundListFilters,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

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

function formatFundName(value: string | null | undefined, fallback: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : fallback;
}

function formatLinkedId(value: number | null | undefined, label: string) {
  return Number.isFinite(value) && Number(value) > 0 ? `${label} ${value}` : `${label} not linked`;
}

export function MainSequenceFundsPage() {
  const location = useLocation();
  const navigate = useNavigate();
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

  const virtualFundFilters = useMemo(
    () =>
      ({
        search: deferredSearchValue,
        limit,
        offset,
      }) satisfies VirtualFundListFilters,
    [deferredSearchValue, limit, offset],
  );

  const virtualFundsQuery = useQuery({
    enabled: !needsSearchParamNormalization,
    queryKey: ["main_sequence", "virtual_funds", "list", virtualFundFilters],
    queryFn: () => listVirtualFunds(virtualFundFilters),
  });

  const pageRows = virtualFundsQuery.data?.results ?? [];
  const totalCount = virtualFundsQuery.data?.count ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Virtual Funds"
        description="Browse virtual funds and the linked portfolios and accounts behind them."
        actions={<Badge variant="neutral">{`${totalCount} funds`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div>
              <CardTitle>Virtual funds registry</CardTitle>
              <CardDescription>
                Search the current funds list and review the portfolio and account each fund is linked to.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Virtual fund actions"
              accessory={<Badge variant="neutral">{`${totalCount} rows`}</Badge>}
              value={searchValue}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search virtual funds"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {virtualFundsQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading funds
              </div>
            </div>
          ) : null}

          {virtualFundsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(virtualFundsQuery.error)}
            </div>
          ) : null}

          {!virtualFundsQuery.isLoading && !virtualFundsQuery.isError && pageRows.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Database className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No funds found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search to locate a fund.
              </p>
            </div>
          ) : null}

          {!virtualFundsQuery.isLoading && !virtualFundsQuery.isError && pageRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-4 pb-2">Portfolio</th>
                    <th className="px-4 pb-2">Account</th>
                    <th className="px-4 pb-2">Fund</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((fund) => (
                    <tr key={fund.id}>
                      <td className={getRegistryTableCellClassName(false, "left")}>
                        <div className="font-medium text-foreground">
                          {formatFundName(fund.target_portfolio_name, `Portfolio ${fund.target_portfolio_id ?? "—"}`)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatLinkedId(fund.target_portfolio_id, "Portfolio ID")}
                        </div>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        <div className="font-medium text-foreground">
                          {formatFundName(fund.account_name, `Account ${fund.account_id ?? "—"}`)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatLinkedId(fund.account_id, "Account ID")}
                        </div>
                      </td>
                      <td className={getRegistryTableCellClassName(false, "right")}>
                        <div className="font-medium text-foreground">{`Fund ${fund.id}`}</div>
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
          itemLabel="funds"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}
