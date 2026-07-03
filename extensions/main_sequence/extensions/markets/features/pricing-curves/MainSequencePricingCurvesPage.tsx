import { useDeferredValue, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, LineChart, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  formatMainSequenceError,
  listPricingCurves,
  mainSequenceRegistryPageSize,
  type PricingCurveFilters,
  type PricingCurveRow,
} from "../../../../common/api";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import {
  defaultPricingCurveDetailTabId,
  isPricingCurveDetailTabId,
  MainSequencePricingCurveDetailView,
  type PricingCurveDetailTabId,
} from "./MainSequencePricingCurveDetailView";

const mainSequencePricingCurveUidParam = "msPricingCurveUid";
const mainSequencePricingCurveTabParam = "msPricingCurveTab";
const mainSequencePricingCurveDateParam = "msPricingCurveDate";
const mainSequencePricingCurveMarketDataSetUidParam = "msPricingMarketDataSetUid";

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

function PricingCurvesTable({
  onOpenCurveDetail,
  rows,
}: {
  onOpenCurveDetail: (curve: PricingCurveRow) => void;
  rows: PricingCurveRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
          <LineChart className="h-6 w-6" />
        </div>
        <div className="mt-4 text-sm font-medium text-foreground">No pricing curves found</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Adjust the curve search.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-4 pb-2">Curve</th>
            <th className="px-4 pb-2">Type</th>
            <th className="px-4 pb-2">Interpolation</th>
            <th className="px-4 pb-2">Compounding</th>
            <th className="px-4 pb-2">Source</th>
            <th className="px-4 pb-2">Metadata</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid}>
              <td className={getRegistryTableCellClassName(false, "left")}>
                <button
                  type="button"
                  className="block w-full min-w-0 text-left"
                  onClick={() => onOpenCurveDetail(row)}
                >
                  <div className="min-w-0">
                    <div className="group inline-flex max-w-full items-center gap-1.5 font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary">
                      <span className="truncate">
                        {formatText(row.display_name, row.unique_identifier)}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {row.unique_identifier}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{row.uid}</div>
                  </div>
                </button>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <Badge variant="neutral">{formatText(row.curve_type)}</Badge>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <div className="font-mono text-xs">{formatText(row.interpolation_method)}</div>
              </td>
              <td className={getRegistryTableCellClassName(false)}>
                <div className="font-mono text-xs">{formatText(row.compounding)}</div>
              </td>
              <td className={getRegistryTableCellClassName(false)}>{formatText(row.source)}</td>
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

export function MainSequencePricingCurvesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pageSize = mainSequenceRegistryPageSize;
  const offset = readPositiveInt(searchParams.get("offset")) ?? 0;
  const pageIndex = Math.floor(offset / pageSize);
  const searchValue = searchParams.get("search") ?? "";
  const selectedCurveUid =
    searchParams.get(mainSequencePricingCurveUidParam)?.trim() || null;
  const requestedCurveTabId = searchParams.get(mainSequencePricingCurveTabParam);
  const selectedCurveTabId = isPricingCurveDetailTabId(requestedCurveTabId)
    ? requestedCurveTabId
    : defaultPricingCurveDetailTabId;
  const selectedCurveDate =
    searchParams.get(mainSequencePricingCurveDateParam)?.trim() || "";
  const selectedMarketDataSetUid =
    searchParams.get(mainSequencePricingCurveMarketDataSetUidParam)?.trim() || "";
  const deferredSearchValue = useDeferredValue(searchValue);

  const curveFilters = useMemo(
    () =>
      ({
        limit: pageSize,
        offset,
        search: deferredSearchValue,
      }) satisfies PricingCurveFilters,
    [deferredSearchValue, offset, pageSize],
  );
  const curvesQuery = useQuery({
    queryKey: ["main_sequence", "pricing_curves", "list", curveFilters],
    queryFn: () => listPricingCurves(curveFilters),
  });
  const rows = curvesQuery.data?.results ?? [];
  const selectedCurveFromList = useMemo(
    () => rows.find((curve) => curve.uid === selectedCurveUid) ?? null,
    [rows, selectedCurveUid],
  );
  const totalCount = curvesQuery.data?.count ?? 0;

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

  function updateFilter(key: string, value: string) {
    updateSearchParams(
      (nextParams) => {
        nextParams.delete(mainSequencePricingCurveUidParam);
        setOrDeleteParam(nextParams, key, value);
        applyPaginationParams(nextParams, 0, pageSize);
      },
      { replace: true },
    );
  }

  function handlePageChange(nextPageIndex: number) {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequencePricingCurveUidParam);
      applyPaginationParams(nextParams, nextPageIndex, pageSize);
    });
  }

  function openCurveDetail(curve: PricingCurveRow) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequencePricingCurveUidParam, curve.uid);
      nextParams.set(mainSequencePricingCurveTabParam, defaultPricingCurveDetailTabId);
    });
  }

  function closeCurveDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequencePricingCurveUidParam);
      nextParams.delete(mainSequencePricingCurveTabParam);
      nextParams.delete(mainSequencePricingCurveDateParam);
      nextParams.delete(mainSequencePricingCurveMarketDataSetUidParam);
    });
  }

  function selectCurveDetailTab(tabId: PricingCurveDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequencePricingCurveTabParam, tabId);
    });
  }

  function updateCurveDetailContext(key: string, value: string) {
    updateSearchParams(
      (nextParams) => {
        setOrDeleteParam(nextParams, key, value);
      },
      { replace: true },
    );
  }

  function resetCurveDetailContext() {
    updateSearchParams(
      (nextParams) => {
        nextParams.delete(mainSequencePricingCurveDateParam);
        nextParams.delete(mainSequencePricingCurveMarketDataSetUidParam);
      },
      { replace: true },
    );
  }

  if (selectedCurveUid !== null) {
    return (
      <MainSequencePricingCurveDetailView
        curveDate={selectedCurveDate}
        curveUid={selectedCurveUid}
        initialCurve={selectedCurveFromList}
        onBack={closeCurveDetail}
        onResetContext={resetCurveDetailContext}
        onSelectTab={selectCurveDetailTab}
        onSelectCurveDate={(value) =>
          updateCurveDetailContext(mainSequencePricingCurveDateParam, value)
        }
        onSelectMarketDataSet={(value) =>
          updateCurveDetailContext(mainSequencePricingCurveMarketDataSetUidParam, value)
        }
        selectedMarketDataSetUid={selectedMarketDataSetUid}
        selectedTabId={selectedCurveTabId}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title="Pricing Curves"
        description="Browse pricing curves from the `/api/v1/pricing/curves/` registry."
        actions={<Badge variant="neutral">{`${totalCount} curves`}</Badge>}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="space-y-4">
            <div className="space-y-1">
              <CardTitle>Curve Registry</CardTitle>
              <CardDescription>
                Search the pricing-curve registry and open the detail view for one curve.
              </CardDescription>
            </div>

            <MainSequenceRegistrySearch
              actionMenuLabel="Curve actions"
              accessory={<Badge variant="neutral">{`${totalCount} curves`}</Badge>}
              value={searchValue}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search curve unique_identifier"
              searchClassName="max-w-xl"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {curvesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading pricing curves
              </div>
            </div>
          ) : null}

          {curvesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(curvesQuery.error)}
            </div>
          ) : null}

          {!curvesQuery.isLoading && !curvesQuery.isError ? (
            <PricingCurvesTable rows={rows} onOpenCurveDetail={openCurveDetail} />
          ) : null}
        </CardContent>

        <MainSequenceRegistryPagination
          count={totalCount}
          hasNextPage={Boolean(curvesQuery.data?.next)}
          hasPreviousPage={Boolean(curvesQuery.data?.previous) || pageIndex > 0}
          itemLabel="curves"
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}
