import { useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

import {
  fetchPricingCurveDiscountCurve,
  fetchPricingCurveSummary,
  formatMainSequenceError,
  listPricingMarketDataSets,
  type EntitySummaryHeader,
  type PricingCurveDiscountCurveResponse,
  type PricingMarketDataSet,
  type PricingCurveRow,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { openMainSequenceMarketsSummaryLink } from "../summaryLinks";
import { ZeroCurveChartSurface } from "../../widgets/zero-curve/ZeroCurveWidget";
import {
  formatZeroCurveTimeIndexLabel,
  normalizeZeroCurveRateValue,
  parseZeroCurveTimeIndexMs,
  type ZeroCurveSeries,
} from "../../widgets/zero-curve/zeroCurveModel";

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getCurveTitle(
  curveUid: string,
  summary: EntitySummaryHeader | null,
  initialCurve: PricingCurveRow | null,
) {
  return (
    readText(summary?.entity.title) ??
    readText(initialCurve?.display_name) ??
    readText(initialCurve?.unique_identifier) ??
    curveUid
  );
}

function getCurveDescription(curveUid: string, initialCurve: PricingCurveRow | null) {
  const parts = [
    readText(initialCurve?.curve_type),
    readText(initialCurve?.source),
    readText(initialCurve?.index_uid) ? `Index UID ${readText(initialCurve?.index_uid)}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : `Pricing curve UID ${curveUid}`;
}

function formatMarketDataSetOption(
  set: Pick<PricingMarketDataSet, "uid" | "set_key" | "display_name">,
) {
  const displayName = readText(set.display_name);
  const setKey = readText(set.set_key);

  if (displayName && setKey) {
    return `${displayName} (${setKey})`;
  }

  return displayName ?? setKey ?? set.uid;
}

function toDateInputValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = Date.parse(trimmed);

  if (Number.isNaN(parsed)) {
    return trimmed.slice(0, 10);
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function toCurveDateIso(value: string) {
  const trimmed = value.trim();

  return trimmed ? `${trimmed}T00:00:00Z` : "";
}

function buildDiscountCurveSeries(
  response: PricingCurveDiscountCurveResponse | null,
): ZeroCurveSeries[] {
  if (!response) {
    return [];
  }

  const uniqueIdentifier =
    readText(response.curve_identifier) ??
    readText(response.curve.unique_identifier) ??
    response.curve_uid;
  const timeIndexValue = readText(response.valuation_date) ?? readText(response.effective_date);
  const timeIndexLabel = formatZeroCurveTimeIndexLabel(timeIndexValue);
  const timeIndexSortValue = parseZeroCurveTimeIndexMs(timeIndexValue);
  const points = response.nodes
    .map((node) => {
      const day = Number(node.days_to_maturity);
      const zero = Number(node.zero);

      if (!Number.isFinite(day) || !Number.isFinite(zero)) {
        return null;
      }

      return {
        day: Math.max(0, Math.round(day)),
        value: normalizeZeroCurveRateValue(zero),
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null)
    .sort((left, right) => left.day - right.day);

  if (points.length === 0) {
    return [];
  }

  return [
    {
      id: response.curve_uid,
      label:
        readText(response.curve.display_name) ??
        readText(response.curve.unique_identifier) ??
        uniqueIdentifier,
      pointCount: points.length,
      points,
      timeIndexLabel,
      timeIndexSortValue,
      uniqueIdentifier,
    },
  ];
}

function CurveDetailContextSection({
  curveDate,
  curveResponse,
  isLoadingMarketDataSets,
  marketDataSetError,
  marketDataSets,
  onResetContext,
  onSelectCurveDate,
  onSelectMarketDataSet,
  selectedMarketDataSetUid,
}: {
  curveDate: string;
  curveResponse: PricingCurveDiscountCurveResponse | null;
  isLoadingMarketDataSets: boolean;
  marketDataSetError: unknown;
  marketDataSets: PricingMarketDataSet[];
  onResetContext: () => void;
  onSelectCurveDate: (value: string) => void;
  onSelectMarketDataSet: (value: string) => void;
  selectedMarketDataSetUid: string;
}) {
  const selectedMarketDataSet =
    curveResponse?.market_data_set ??
    marketDataSets.find((set) => set.uid === selectedMarketDataSetUid) ??
    null;

  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Curve Detail</CardTitle>
            <CardDescription>
              Select the valuation date and pricing market-data set used for curve inspection.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={onResetContext}>
            Reset context
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Valuation Date
            </span>
            <Input
              type="date"
              value={toDateInputValue(curveDate)}
              onChange={(event) => onSelectCurveDate(toCurveDateIso(event.target.value))}
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Pricing Market Data Set
            </span>
            <Select
              disabled={isLoadingMarketDataSets}
              value={selectedMarketDataSetUid}
              onChange={(event) => onSelectMarketDataSet(event.target.value)}
            >
              <option value="">
                {isLoadingMarketDataSets ? "Loading market data sets..." : "Select a market data set"}
              </option>
              {marketDataSets.map((set) => (
                <option
                  key={set.uid}
                  value={set.uid}
                  data-description={[set.set_key, set.uid].filter(Boolean).join(" / ")}
                >
                  {formatMarketDataSetOption(set)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {marketDataSetError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(marketDataSetError)}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Selected Date
            </div>
            <div className="mt-2 font-mono text-sm text-foreground">
              {(curveResponse?.valuation_date ?? curveDate) || "Latest available"}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Market Data Set
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {selectedMarketDataSet ? formatMarketDataSetOption(selectedMarketDataSet) : "Not selected"}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Market Data Set UID
            </div>
            <div className="mt-2 break-all font-mono text-sm text-foreground">
              {selectedMarketDataSetUid || "Not selected"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MainSequencePricingCurveDetailView({
  curveDate,
  curveUid,
  initialCurve,
  onBack,
  onResetContext,
  onSelectCurveDate,
  onSelectMarketDataSet,
  selectedMarketDataSetUid,
}: {
  curveDate: string;
  curveUid: string;
  initialCurve: PricingCurveRow | null;
  onBack: () => void;
  onResetContext: () => void;
  onSelectCurveDate: (value: string) => void;
  onSelectMarketDataSet: (value: string) => void;
  selectedMarketDataSetUid: string;
}) {
  const navigate = useNavigate();
  const curveSummaryQuery = useQuery({
    queryKey: ["main_sequence", "pricing_curves", "summary", curveUid],
    queryFn: () => fetchPricingCurveSummary(curveUid),
    enabled: Boolean(curveUid),
  });
  const marketDataSetsQuery = useQuery({
    queryKey: ["main_sequence", "pricing_market_data", "sets", "curve_detail_picker"],
    queryFn: () => listPricingMarketDataSets({ limit: 500, offset: 0 }),
  });
  const discountCurveQuery = useQuery({
    queryKey: [
      "main_sequence",
      "pricing_curves",
      "discount_curve",
      curveUid,
      selectedMarketDataSetUid,
      curveDate || "__latest__",
    ],
    queryFn: () =>
      fetchPricingCurveDiscountCurve(curveUid, {
        marketDataSet: selectedMarketDataSetUid,
        valuationDate: curveDate || undefined,
      }),
    enabled:
      Boolean(curveUid) &&
      Boolean(selectedMarketDataSetUid.trim()),
  });

  const summary = curveSummaryQuery.data ?? null;
  const marketDataSets = marketDataSetsQuery.data?.results ?? [];
  const discountCurve = discountCurveQuery.data ?? null;
  const pageTitle = useMemo(
    () => getCurveTitle(curveUid, summary, initialCurve),
    [curveUid, initialCurve, summary],
  );
  const pageDescription = useMemo(
    () => getCurveDescription(curveUid, initialCurve),
    [curveUid, initialCurve],
  );
  const discountCurveSeries = useMemo(
    () => buildDiscountCurveSeries(discountCurve),
    [discountCurve],
  );

  useEffect(() => {
    const firstSetUid = marketDataSets[0]?.uid?.trim();

    if (!firstSetUid) {
      return;
    }

    if (!selectedMarketDataSetUid.trim()) {
      onSelectMarketDataSet(firstSetUid);
      return;
    }

    const selectedExists = marketDataSets.some((set) => set.uid === selectedMarketDataSetUid);

    if (!selectedExists) {
      onSelectMarketDataSet(firstSetUid);
    }
  }, [marketDataSets, onSelectMarketDataSet, selectedMarketDataSetUid]);

  useEffect(() => {
    const responseDate = discountCurve?.valuation_date?.trim();

    if (!responseDate || responseDate === curveDate) {
      return;
    }

    onSelectCurveDate(responseDate);
  }, [curveDate, discountCurve?.valuation_date, onSelectCurveDate]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={pageTitle}
        description={pageDescription}
        actions={
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to curves
          </Button>
        }
      />

      {curveSummaryQuery.isLoading && !summary ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading pricing curve summary
            </div>
          </CardContent>
        </Card>
      ) : null}

      {curveSummaryQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(curveSummaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <MainSequenceEntitySummaryCard
          summary={summary}
          onSummaryItemLinkClick={(linkUrl) =>
            openMainSequenceMarketsSummaryLink(navigate, linkUrl)
          }
          onSummaryUpdated={async () => {
            await curveSummaryQuery.refetch();
          }}
        />
      ) : null}

      <CurveDetailContextSection
        curveDate={curveDate}
        curveResponse={discountCurve}
        isLoadingMarketDataSets={marketDataSetsQuery.isLoading}
        marketDataSetError={marketDataSetsQuery.isError ? marketDataSetsQuery.error : null}
        marketDataSets={marketDataSets}
        onResetContext={onResetContext}
        onSelectCurveDate={onSelectCurveDate}
        onSelectMarketDataSet={onSelectMarketDataSet}
        selectedMarketDataSetUid={selectedMarketDataSetUid}
      />

      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Zero Curve</CardTitle>
              <CardDescription>
                Discount-curve nodes for the selected market-data set and valuation date.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {discountCurveQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading zero curve
              </div>
            </div>
          ) : null}

          {discountCurveQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(discountCurveQuery.error)}
            </div>
          ) : null}

          {discountCurve ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Effective Date
                </div>
                <div className="mt-2 font-mono text-sm text-foreground">
                  {discountCurve.effective_date}
                </div>
              </div>
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Request Mode
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {discountCurve.request_mode}
                </div>
              </div>
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Binding
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {discountCurve.binding.storage_table_identifier}
                </div>
              </div>
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Nodes
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {discountCurve.nodes.length.toLocaleString()}
                </div>
              </div>
            </div>
          ) : null}

          {!discountCurveQuery.isLoading && !discountCurveQuery.isError ? (
            <div className="h-[420px]">
              <ZeroCurveChartSurface
                series={discountCurveSeries}
                emptyDescription="The selected discount-curve response did not return any parsable nodes."
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
