import { useDeferredValue, useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Database, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchVirtualFundDetail,
  fetchVirtualFundHoldingsPositionDetails,
  fetchVirtualFundSummary,
  formatMainSequenceError,
  listVirtualFunds,
  mainSequenceRegistryPageSize,
  type VirtualFundListFilters,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { openMainSequenceMarketsSummaryLink } from "../summaryLinks";
import { positionDetailWidget } from "../../widgets/position-detail/definition";
import { PositionDetailWidget } from "../../widgets/position-detail/PositionDetailWidget";
import type { PositionDetailWidgetProps } from "../../widgets/position-detail/positionDetailRuntime";
import {
  defaultVirtualFundDetailTabId,
  mainSequenceVirtualFundTabParam,
  mainSequenceVirtualFundUidParam,
  virtualFundHoldingsTabId,
} from "./fundShared";

const legacyVirtualFundHoldingsTabId = "latest-holdings";

const virtualFundDetailTabs = [
  { id: defaultVirtualFundDetailTabId, label: "Details" },
  { id: virtualFundHoldingsTabId, label: "Holdings" },
] as const;

type VirtualFundDetailTabId = (typeof virtualFundDetailTabs)[number]["id"];

function readPositiveInt(value: string | null) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeUid(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function isVirtualFundDetailTabId(value: string | null): value is VirtualFundDetailTabId {
  return virtualFundDetailTabs.some((tab) => tab.id === value);
}

function normalizeVirtualFundDetailTabId(value: string | null): VirtualFundDetailTabId {
  if (value === legacyVirtualFundHoldingsTabId) {
    return virtualFundHoldingsTabId;
  }

  return isVirtualFundDetailTabId(value) ? value : "details";
}

function buildVirtualFundHoldingsWidgetProps(): PositionDetailWidgetProps {
  return {
    editableInPlace: false,
    sourceType: "account",
    variant: "positions",
    positionRows: [],
  };
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

function formatFundTitle(value: string | null | undefined, fallback: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : fallback;
}

function formatFundUid(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : "UID unavailable";
}

function formatLinkedUid(value: string | null | undefined, label: string) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : `${label} not linked`;
}

export function MainSequenceFundsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const selectedFundUid = normalizeUid(searchParams.get(mainSequenceVirtualFundUidParam));
  const selectedTabId = normalizeVirtualFundDetailTabId(searchParams.get(mainSequenceVirtualFundTabParam));
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
  const virtualFundHoldingsWidgetProps = useMemo(
    () => buildVirtualFundHoldingsWidgetProps(),
    [],
  );

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
    enabled: !needsSearchParamNormalization && selectedFundUid === null,
    queryKey: ["main_sequence", "virtual_funds", "list", virtualFundFilters],
    queryFn: () => listVirtualFunds(virtualFundFilters),
  });

  const virtualFundSummaryQuery = useQuery({
    enabled: selectedFundUid !== null,
    queryKey: ["main_sequence", "virtual_funds", "summary", selectedFundUid],
    queryFn: () => fetchVirtualFundSummary(selectedFundUid as string),
  });

  const virtualFundDetailQuery = useQuery({
    enabled: selectedFundUid !== null && selectedTabId === "details",
    queryKey: ["main_sequence", "virtual_funds", "detail", selectedFundUid],
    queryFn: () => fetchVirtualFundDetail(selectedFundUid as string),
  });

  const virtualFundHoldingsQuery = useQuery({
    enabled: selectedFundUid !== null && selectedTabId === virtualFundHoldingsTabId,
    queryKey: ["main_sequence", "virtual_funds", "holdings", selectedFundUid],
    queryFn: () => fetchVirtualFundHoldingsPositionDetails(selectedFundUid as string),
  });

  const pageRows = virtualFundsQuery.data?.results ?? [];
  const totalCount = virtualFundsQuery.data?.count ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (
      selectedFundUid === null ||
      searchParams.get(mainSequenceVirtualFundTabParam) !== legacyVirtualFundHoldingsTabId
    ) {
      return;
    }

    const nextParams = new URLSearchParams(location.search);
    nextParams.set(mainSequenceVirtualFundTabParam, virtualFundHoldingsTabId);

    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, searchParams, selectedFundUid]);

  useEffect(() => {
    if (selectedFundUid !== null) {
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
  }, [location.pathname, location.search, navigate, offsetParam, pageParam, pageSize, selectedFundUid]);

  useEffect(() => {
    if (selectedFundUid !== null || page <= totalPages) {
      return;
    }

    const nextParams = new URLSearchParams(location.search);
    applyPaginationParams(nextParams, totalPages, pageSize);

    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, page, pageSize, selectedFundUid, totalPages]);

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

  function openFundDetail(fundUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceVirtualFundUidParam, fundUid);
      nextParams.set(mainSequenceVirtualFundTabParam, defaultVirtualFundDetailTabId);
    });
  }

  function closeFundDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceVirtualFundUidParam);
      nextParams.delete(mainSequenceVirtualFundTabParam);
    });
  }

  function selectFundDetailTab(tabId: VirtualFundDetailTabId) {
    updateSearchParams(
      (nextParams) => {
        nextParams.set(mainSequenceVirtualFundTabParam, tabId);
      },
      { replace: true },
    );
  }

  if (selectedFundUid !== null) {
    const detailFund = virtualFundDetailQuery.data?.virtual_fund ?? null;
    const summaryTitle = virtualFundSummaryQuery.data?.entity.title?.trim();
    const detailTitle = detailFund?.unique_identifier?.trim();
    const pageTitle = summaryTitle || detailTitle || selectedFundUid;

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Main Sequence Markets"
          title={pageTitle}
          description={`Virtual Fund UID ${selectedFundUid}`}
          actions={
            <Button type="button" variant="outline" onClick={closeFundDetail}>
              <ArrowLeft className="h-4 w-4" />
              Back to funds
            </Button>
          }
        />

        {virtualFundSummaryQuery.isLoading ? (
          <Card>
            <CardContent className="flex min-h-32 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading virtual fund summary
              </div>
            </CardContent>
          </Card>
        ) : null}

        {virtualFundSummaryQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(virtualFundSummaryQuery.error)}
          </div>
        ) : null}

        {virtualFundSummaryQuery.data ? (
          <MainSequenceEntitySummaryCard
            summary={virtualFundSummaryQuery.data}
            onSummaryItemLinkClick={(linkUrl) =>
              openMainSequenceMarketsSummaryLink(navigate, linkUrl)
            }
            onSummaryUpdated={async () => {
              await virtualFundSummaryQuery.refetch();
            }}
          />
        ) : null}

        <Card>
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {virtualFundDetailTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedTabId === tab.id
                      ? "border-primary/50 bg-primary/12 text-primary"
                      : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                  }`}
                  onClick={() => selectFundDetailTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            {selectedTabId === "details" ? (
              <>
                {virtualFundDetailQuery.isLoading ? (
                  <div className="flex min-h-48 items-center justify-center">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading virtual fund detail
                    </div>
                  </div>
                ) : null}

                {virtualFundDetailQuery.isError ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {formatMainSequenceError(virtualFundDetailQuery.error)}
                  </div>
                ) : null}

                {detailFund ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        key: "unique_identifier",
                        label: "Fund",
                        value: detailFund.unique_identifier,
                      },
                      {
                        key: "uid",
                        label: "UID",
                        value: detailFund.uid,
                      },
                      {
                        key: "account_uid",
                        label: "Account UID",
                        value: detailFund.account_uid,
                      },
                      {
                        key: "target_portfolio_uid",
                        label: "Portfolio UID",
                        value: detailFund.target_portfolio_uid,
                      },
                    ].map((field) => (
                      <div
                        key={field.key}
                        className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/40 px-3 py-3"
                      >
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          {field.label}
                        </div>
                        <div className="mt-2 break-all font-mono text-sm text-foreground">
                          {formatFundTitle(field.value ?? null, "Not available")}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

              </>
            ) : null}

            {selectedTabId === virtualFundHoldingsTabId ? (
              <Card variant="nested">
                <CardHeader className="border-b border-border/70 pb-4">
                  <CardTitle className="text-base">Holdings</CardTitle>
                  <CardDescription>
                    Review the canonical holdings snapshot resolved directly from this virtual fund.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  <PositionDetailWidget
                    widget={positionDetailWidget}
                    props={virtualFundHoldingsWidgetProps}
                    runtimeState={
                      virtualFundHoldingsQuery.isError
                        ? {
                            status: "error",
                            error: formatMainSequenceError(virtualFundHoldingsQuery.error),
                            variant: "positions",
                            payload: undefined,
                          }
                        : virtualFundHoldingsQuery.isLoading
                          ? {
                              status: "loading",
                              error: undefined,
                              variant: "positions",
                              payload: undefined,
                            }
                          : virtualFundHoldingsQuery.data
                            ? {
                                status: "success",
                                error: undefined,
                                variant: "positions",
                                payload: virtualFundHoldingsQuery.data,
                              }
                            : undefined
                    }
                  />
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
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
                Search the current funds list and review each fund's account and target portfolio UIDs.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Virtual fund actions"
              accessory={<Badge variant="neutral">{`${totalCount} virtual funds`}</Badge>}
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
                    <th className="px-4 pb-2">Fund</th>
                    <th className="px-4 pb-2">Account</th>
                    <th className="px-4 pb-2">Portfolio</th>
                    <th className="px-4 pb-2 text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((fund) => (
                    <tr key={fund.uid}>
                      <td className={getRegistryTableCellClassName(false, "left")}>
                        <button
                          type="button"
                          className="block w-full min-w-0 text-left"
                          onClick={() => openFundDetail(fund.uid)}
                        >
                          <div className="group inline-flex max-w-full items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
                            <span className="truncate">
                              {formatFundTitle(fund.unique_identifier, "Virtual fund")}
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {formatFundUid(fund.uid)}
                          </div>
                        </button>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        <div className="font-mono text-sm text-foreground">
                          {formatLinkedUid(fund.account_uid, "Account UID")}
                        </div>
                      </td>
                      <td className={getRegistryTableCellClassName(false)}>
                        <div className="font-mono text-sm text-foreground">
                          {formatLinkedUid(fund.target_portfolio_uid, "Portfolio UID")}
                        </div>
                      </td>
                      <td className={getRegistryTableCellClassName(false, "right")}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openFundDetail(fund.uid)}
                        >
                          Details
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
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
