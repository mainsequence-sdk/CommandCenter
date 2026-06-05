import { useDeferredValue, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { Database, Link as LinkIcon, Loader2, Network } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

import {
  formatMainSequenceError,
  listPricingMarketDataBindings,
  listPricingMarketDataSetBindings,
  listPricingMarketDataSets,
  mainSequenceRegistryPageSize,
  type PricingMarketDataBindingFilters,
  type PricingMarketDataSet,
  type PricingMarketDataSetBinding,
  type PricingMarketDataSetFilters,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";

type PricingMarketDataTab = "sets" | "bindings";

const pricingMarketDataTabParam = "msPricingMarketDataTab";
const pricingMarketDataTabs = [
  { id: "sets", label: "Sets" },
  { id: "bindings", label: "Bindings" },
] as const satisfies readonly { id: PricingMarketDataTab; label: string }[];

function readPositiveInt(value: string | null) {
  const parsed = Number(value ?? "");

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeTab(value: string | null): PricingMarketDataTab {
  return pricingMarketDataTabs.some((tab) => tab.id === value)
    ? (value as PricingMarketDataTab)
    : "sets";
}

function setOrDeleteParam(nextParams: URLSearchParams, key: string, value: string) {
  if (value.trim()) {
    nextParams.set(key, value);
    return;
  }

  nextParams.delete(key);
}

function applyPaginationParams(nextParams: URLSearchParams, pageIndex: number, pageSize: number) {
  const safePageIndex = Math.max(0, pageIndex);

  nextParams.set("limit", String(pageSize));
  nextParams.set("offset", String(safePageIndex * pageSize));
}

function formatText(value: string | null | undefined, fallback = "Not available") {
  return value?.trim() || fallback;
}

function formatMetadata(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) {
    return "None";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Unable to render metadata";
  }
}

function ExactFilterField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function PricingMarketDataSetsTable({
  rows,
  onShowBindings,
}: {
  rows: PricingMarketDataSet[];
  onShowBindings: (setUid: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
          <Database className="h-6 w-6" />
        </div>
        <div className="mt-4 text-sm font-medium text-foreground">No market data sets found</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Adjust the exact `set_key` or `status` filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 pb-2">Set</th>
            <th className="px-4 pb-2">Status</th>
            <th className="px-4 pb-2">Description</th>
            <th className="px-4 pb-2">Metadata</th>
            <th className="px-4 pb-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid}>
              <td className={getRegistryTableCellClassName(false, "left")}>
                <div className="font-medium text-foreground">{row.display_name}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{row.set_key}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{row.uid}</div>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <Badge variant="neutral">{row.status}</Badge>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                {formatText(row.description)}
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <div className="max-w-72 truncate font-mono text-xs text-muted-foreground">
                  {formatMetadata(row.metadata_json)}
                </div>
              </td>
              <td className={getRegistryTableCellClassName(false, "right")}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onShowBindings(row.uid)}
                >
                  <LinkIcon className="h-4 w-4" />
                  Bindings
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricingMarketDataBindingsTable({
  rows,
}: {
  rows: PricingMarketDataSetBinding[];
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
          <Network className="h-6 w-6" />
        </div>
        <div className="mt-4 text-sm font-medium text-foreground">No market data bindings found</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Adjust the exact `market_data_set_uid` or `concept_key` filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 pb-2">Concept</th>
            <th className="px-4 pb-2">Market Data Set UID</th>
            <th className="px-4 pb-2">Data Node UID</th>
            <th className="px-4 pb-2">Storage Table</th>
            <th className="px-4 pb-2">Source</th>
            <th className="px-4 pb-2">Metadata</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid}>
              <td className={getRegistryTableCellClassName(false, "left")}>
                <div className="font-medium text-foreground">{row.concept_key}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{row.uid}</div>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <div className="max-w-56 truncate font-mono text-xs">{row.market_data_set_uid}</div>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <div className="max-w-56 truncate font-mono text-xs">{row.data_node_uid}</div>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <div className="font-mono text-xs">{row.storage_table_identifier}</div>
              </td>
              <td className={getRegistryTableCellClassName(false)}>{row.source}</td>
              <td className={getRegistryTableCellClassName(false, "right")}>
                <div className="max-w-72 truncate font-mono text-xs text-muted-foreground">
                  {formatMetadata(row.metadata_json)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MainSequencePricingMarketDataPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = normalizeTab(searchParams.get(pricingMarketDataTabParam));
  const pageSize = mainSequenceRegistryPageSize;
  const offset = readPositiveInt(searchParams.get("offset")) ?? 0;
  const pageIndex = Math.floor(offset / pageSize);
  const setKeyFilter = searchParams.get("set_key") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const marketDataSetUidFilter = searchParams.get("market_data_set_uid") ?? "";
  const conceptKeyFilter = searchParams.get("concept_key") ?? "";
  const deferredSetKeyFilter = useDeferredValue(setKeyFilter);
  const deferredStatusFilter = useDeferredValue(statusFilter);
  const deferredMarketDataSetUidFilter = useDeferredValue(marketDataSetUidFilter);
  const deferredConceptKeyFilter = useDeferredValue(conceptKeyFilter);

  const setFilters = useMemo(
    () =>
      ({
        limit: pageSize,
        offset,
        setKey: deferredSetKeyFilter,
        status: deferredStatusFilter,
      }) satisfies PricingMarketDataSetFilters,
    [deferredSetKeyFilter, deferredStatusFilter, offset, pageSize],
  );

  const bindingFilters = useMemo(
    () =>
      ({
        limit: pageSize,
        offset,
        marketDataSetUid: deferredMarketDataSetUidFilter,
        conceptKey: deferredConceptKeyFilter,
      }) satisfies PricingMarketDataBindingFilters,
    [deferredConceptKeyFilter, deferredMarketDataSetUidFilter, offset, pageSize],
  );

  const setsQuery = useQuery({
    enabled: activeTab === "sets",
    queryKey: ["main_sequence", "pricing_market_data", "sets", setFilters],
    queryFn: () => listPricingMarketDataSets(setFilters),
  });

  const useSetBindingsEndpoint =
    activeTab === "bindings" &&
    deferredMarketDataSetUidFilter.trim().length > 0 &&
    deferredConceptKeyFilter.trim().length === 0;

  const bindingsQuery = useQuery({
    enabled: activeTab === "bindings",
    queryKey: [
      "main_sequence",
      "pricing_market_data",
      "bindings",
      bindingFilters,
      useSetBindingsEndpoint,
    ],
    queryFn: () =>
      useSetBindingsEndpoint
        ? listPricingMarketDataSetBindings(deferredMarketDataSetUidFilter, {
            limit: pageSize,
            offset,
          })
        : listPricingMarketDataBindings(bindingFilters),
  });

  const activeQuery = activeTab === "sets" ? setsQuery : bindingsQuery;
  const totalCount = activeQuery.data?.count ?? 0;

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

  function selectTab(tab: PricingMarketDataTab) {
    updateSearchParams((nextParams) => {
      nextParams.set(pricingMarketDataTabParam, tab);

      if (tab === "sets") {
        nextParams.delete("market_data_set_uid");
        nextParams.delete("concept_key");
      } else {
        nextParams.delete("set_key");
        nextParams.delete("status");
      }

      applyPaginationParams(nextParams, 0, pageSize);
    });
  }

  function updateFilter(key: string, value: string) {
    updateSearchParams(
      (nextParams) => {
        setOrDeleteParam(nextParams, key, value);
        applyPaginationParams(nextParams, 0, pageSize);
      },
      { replace: true },
    );
  }

  function handlePageChange(nextPageIndex: number) {
    updateSearchParams((nextParams) => {
      applyPaginationParams(nextParams, nextPageIndex, pageSize);
    });
  }

  function showBindingsForSet(setUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(pricingMarketDataTabParam, "bindings");
      nextParams.set("market_data_set_uid", setUid);
      nextParams.delete("concept_key");
      nextParams.delete("set_key");
      nextParams.delete("status");
      applyPaginationParams(nextParams, 0, pageSize);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Pricing Market Data"
        description="Inspect pricing market-data sets and their data-node bindings."
        actions={<Badge variant="neutral">{`${totalCount} ${activeTab}`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle>Market Data Registry</CardTitle>
                <CardDescription>
                  Lists the paginated `/api/v1/pricing/market_data/sets/` and `/bindings/` resources.
                  Filters are exact-match only; the backend does not expose search yet.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {pricingMarketDataTabs.map((tab) => (
                  <Button
                    key={tab.id}
                    type="button"
                    size="sm"
                    variant={activeTab === tab.id ? "default" : "outline"}
                    onClick={() => selectTab(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>

            {activeTab === "sets" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <ExactFilterField
                  label="Set Key"
                  value={setKeyFilter}
                  onChange={(value) => updateFilter("set_key", value)}
                  placeholder="Exact set_key, for example default"
                />
                <ExactFilterField
                  label="Status"
                  value={statusFilter}
                  onChange={(value) => updateFilter("status", value)}
                  placeholder="Exact status, for example ACTIVE"
                />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <ExactFilterField
                  label="Market Data Set UID"
                  value={marketDataSetUidFilter}
                  onChange={(value) => updateFilter("market_data_set_uid", value)}
                  placeholder="Exact market_data_set_uid"
                />
                <ExactFilterField
                  label="Concept Key"
                  value={conceptKeyFilter}
                  onChange={(value) => updateFilter("concept_key", value)}
                  placeholder="Exact concept_key, for example discount_curves"
                />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {activeQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading pricing market data {activeTab}
              </div>
            </div>
          ) : null}

          {activeQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(activeQuery.error)}
            </div>
          ) : null}

          {!activeQuery.isLoading && !activeQuery.isError && activeTab === "sets" ? (
            <PricingMarketDataSetsTable
              rows={(setsQuery.data?.results ?? []) as PricingMarketDataSet[]}
              onShowBindings={showBindingsForSet}
            />
          ) : null}

          {!activeQuery.isLoading && !activeQuery.isError && activeTab === "bindings" ? (
            <PricingMarketDataBindingsTable
              rows={(bindingsQuery.data?.results ?? []) as PricingMarketDataSetBinding[]}
            />
          ) : null}
        </CardContent>

        <MainSequenceRegistryPagination
          count={totalCount}
          hasNextPage={Boolean(activeQuery.data?.next)}
          hasPreviousPage={Boolean(activeQuery.data?.previous) || pageIndex > 0}
          itemLabel={activeTab}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}
