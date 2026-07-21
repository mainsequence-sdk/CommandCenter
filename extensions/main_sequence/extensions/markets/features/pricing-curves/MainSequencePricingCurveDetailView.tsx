import { useEffect, useMemo, useRef, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

import {
  deletePricingCurve,
  fetchPricingCurveDeleteImpact,
  fetchPricingCurveDiscountCurve,
  fetchPricingCurveSelections,
  fetchPricingCurveSummary,
  formatMainSequenceError,
  listPricingMarketDataSets,
  type EntitySummaryHeader,
  type PricingCurveDeleteImpactRelationship,
  type PricingCurveDeleteResponse,
  type PricingCurveDiscountCurveResponse,
  type PricingCurveSelectionRow,
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

export const pricingCurveDetailTabs = [
  { id: "curve", label: "Curve" },
  { id: "selections", label: "Curve Selections" },
] as const;

export type PricingCurveDetailTabId = (typeof pricingCurveDetailTabs)[number]["id"];

export const defaultPricingCurveDetailTabId: PricingCurveDetailTabId = "curve";

export function isPricingCurveDetailTabId(
  value: string | null,
): value is PricingCurveDetailTabId {
  return pricingCurveDetailTabs.some((tab) => tab.id === value);
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function CurveSelectionsSection({
  count,
  error,
  isLoading,
  selections,
}: {
  count: number | null;
  error: unknown;
  isLoading: boolean;
  selections: PricingCurveSelectionRow[];
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Curve Selections</CardTitle>
            <CardDescription>
              Shows where this curve is selected by pricing market-data set bindings.
            </CardDescription>
          </div>
          {count !== null ? <Badge variant="neutral">{`${count} selections`}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading curve selections
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(error)}
          </div>
        ) : null}

        {!isLoading && !error && selections.length === 0 ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
            This curve is not selected by any pricing market-data binding.
          </div>
        ) : null}

        {!isLoading && !error && selections.length > 0 ? (
          <div className="overflow-x-auto rounded-[calc(var(--radius)-4px)] border border-border/70">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-4 py-3">Market Data Set</th>
                  <th className="px-4 py-3">Selector</th>
                  <th className="px-4 py-3">Role Key</th>
                  <th className="px-4 py-3">Quote Side</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Binding UID</th>
                </tr>
              </thead>
              <tbody>
                {selections.map((selection) => (
                  <tr
                    key={selection.binding_uid}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">
                        {readText(selection.market_data_set.display_name) ??
                          selection.market_data_set.set_key}
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {selection.market_data_set.set_key}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">
                        {readText(selection.selector.index_identifier) ??
                          readText(selection.selector.display_name) ??
                          selection.selector.selector_key}
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {selection.selector.type} / {selection.selector.selector_key}
                      </div>
                      {readText(selection.selector.index_uid) ? (
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          index selector UID {selection.selector.index_uid}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs">
                      {readText(selection.role_key) ?? "Not available"}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs">
                      {readText(selection.quote_side) ?? "Not available"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant="neutral">{readText(selection.status) ?? "Unknown"}</Badge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {readText(selection.source) ?? "Not available"}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
                      {selection.binding_uid}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-4 py-3 text-xs text-muted-foreground">
          Selector index fields describe how a binding selected the curve. They do not make the curve
          own that index.
        </div>
      </CardContent>
    </Card>
  );
}

function getDeleteSeverityVariant(
  severity: PricingCurveDeleteImpactRelationship["severity"],
) {
  if (severity === "blocking" || severity === "destructive") {
    return "danger" as const;
  }

  if (severity === "warning" || severity === "mutating") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function CurveDeleteDialog({
  curveTitle,
  curveUid,
  onClose,
  onDeleted,
  open,
}: {
  curveTitle: string;
  curveUid: string;
  onClose: () => void;
  onDeleted?: (result: PricingCurveDeleteResponse) => void | Promise<void>;
  open: boolean;
}) {
  const [deleteValues, setDeleteValues] = useState(false);
  const [deleteCurveSelections, setDeleteCurveSelections] = useState(false);
  const wasOpenRef = useRef(false);
  const deleteImpactQuery = useQuery({
    queryKey: [
      "main_sequence",
      "pricing_curves",
      "delete_impact",
      curveUid,
      deleteValues,
      deleteCurveSelections,
    ],
    queryFn: () =>
      fetchPricingCurveDeleteImpact(curveUid, {
        deleteCurveSelections,
        deleteValues,
      }),
    enabled: open && Boolean(curveUid),
  });
  const deleteMutation = useMutation({
    mutationFn: () =>
      deletePricingCurve(curveUid, {
        deleteCurveSelections,
        deleteValues,
      }),
    onSuccess: async (result) => {
      await onDeleted?.(result);
      onClose();
    },
  });

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (open && !wasOpen) {
      setDeleteValues(false);
      setDeleteCurveSelections(false);
      deleteMutation.reset();
    }
  }, [deleteMutation, open]);

  const impact = deleteImpactQuery.data ?? null;
  const displayName = readText(impact?.display_name) ?? readText(impact?.identifier) ?? curveTitle;
  const canDelete =
    impact?.can_delete === true && !deleteImpactQuery.isFetching && !deleteMutation.isPending;
  const relationships = impact?.relationships ?? [];

  return (
    <Dialog
      title="Delete Pricing Curve"
      description="Review the backend delete impact before deleting this curve."
      open={open}
      onClose={deleteMutation.isPending ? () => undefined : onClose}
      className="max-w-[min(980px,calc(100vw-24px))]"
    >
      <div className="space-y-5">
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="space-y-1">
              <div className="text-sm font-semibold text-danger">Destructive operation</div>
              <p className="text-sm leading-6 text-danger">
                This deletes the pricing curve identity. Additional toggles expand deletion to
                stored curve observations and market-data-set curve selections.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3 md:col-span-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Curve
            </div>
            <div className="mt-2 font-medium text-foreground">{displayName}</div>
            <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{curveUid}</div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Blocking
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {(impact?.blocking_count ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Affected
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {(impact?.affected_count ?? 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-danger/25 bg-background/35 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-danger"
              checked={deleteValues}
              disabled={deleteMutation.isPending}
              onChange={(event) => setDeleteValues(event.target.checked)}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">Delete curve values</span>
              <span className="block text-xs leading-5 text-muted-foreground">
                Delete DiscountCurvesStorage observations for this curve identifier.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-danger/25 bg-background/35 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-danger"
              checked={deleteCurveSelections}
              disabled={deleteMutation.isPending}
              onChange={(event) => setDeleteCurveSelections(event.target.checked)}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">
                Delete curve selections
              </span>
              <span className="block text-xs leading-5 text-muted-foreground">
                Delete market-data-set curve-selection rows pointing to this curve.
              </span>
            </span>
          </label>
        </div>

        {deleteImpactQuery.isLoading ? (
          <div className="flex min-h-32 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading delete impact
            </div>
          </div>
        ) : null}

        {deleteImpactQuery.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(deleteImpactQuery.error)}
          </div>
        ) : null}

        {impact ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={impact.can_delete ? "success" : "danger"}>
                {impact.can_delete ? "Delete allowed" : "Delete blocked"}
              </Badge>
              {deleteImpactQuery.isFetching ? (
                <Badge variant="neutral">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Refreshing impact
                </Badge>
              ) : null}
            </div>

            {impact.warnings.length > 0 ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
                {impact.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-[calc(var(--radius)-4px)] border border-border/70">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-4 py-3">Relationship</th>
                    <th className="px-4 py-3">Count</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Effect</th>
                    <th className="px-4 py-3">Blocks</th>
                  </tr>
                </thead>
                <tbody>
                  {relationships.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>
                        No dependent relationships reported.
                      </td>
                    </tr>
                  ) : null}
                  {relationships.map((relationship) => (
                    <tr
                      key={relationship.key}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-foreground">{relationship.label}</div>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {relationship.model}.{relationship.column}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">
                          {relationship.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs">
                        {relationship.count.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={getDeleteSeverityVariant(relationship.severity)}>
                          {relationship.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">
                        {relationship.effect}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={relationship.blocks_delete ? "danger" : "neutral"}>
                          {relationship.blocks_delete ? "Yes" : "No"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {deleteMutation.isError ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(deleteMutation.error)}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-4">
          <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!canDelete}
            onClick={() => {
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete pricing curve
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function MainSequencePricingCurveDetailView({
  curveDate,
  curveUid,
  initialCurve,
  onBack,
  onDeleted,
  onResetContext,
  onSelectTab,
  onSelectCurveDate,
  onSelectMarketDataSet,
  selectedMarketDataSetUid,
  selectedTabId,
}: {
  curveDate: string;
  curveUid: string;
  initialCurve: PricingCurveRow | null;
  onBack: () => void;
  onDeleted?: (result: PricingCurveDeleteResponse) => void | Promise<void>;
  onResetContext: () => void;
  onSelectTab: (tabId: PricingCurveDetailTabId) => void;
  onSelectCurveDate: (value: string) => void;
  onSelectMarketDataSet: (value: string) => void;
  selectedMarketDataSetUid: string;
  selectedTabId: PricingCurveDetailTabId;
}) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isCurveTab = selectedTabId === "curve";
  const isSelectionsTab = selectedTabId === "selections";
  const curveSummaryQuery = useQuery({
    queryKey: ["main_sequence", "pricing_curves", "summary", curveUid],
    queryFn: () => fetchPricingCurveSummary(curveUid),
    enabled: Boolean(curveUid),
  });
  const marketDataSetsQuery = useQuery({
    queryKey: ["main_sequence", "pricing_market_data", "sets", "curve_detail_picker"],
    queryFn: () => listPricingMarketDataSets({ limit: 500, offset: 0 }),
    enabled: isCurveTab,
  });
  const curveSelectionsQuery = useQuery({
    queryKey: ["main_sequence", "pricing_curves", "curve_selections", curveUid],
    queryFn: () => fetchPricingCurveSelections(curveUid),
    enabled: Boolean(curveUid) && isSelectionsTab,
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
      isCurveTab &&
      Boolean(curveUid) &&
      Boolean(selectedMarketDataSetUid.trim()),
  });

  const summary = curveSummaryQuery.data ?? null;
  const marketDataSets = marketDataSetsQuery.data?.results ?? [];
  const discountCurve = discountCurveQuery.data ?? null;
  const curveSelections = curveSelectionsQuery.data?.results ?? [];
  const curveSelectionCount =
    readNumber(summary?.extensions?.curve_selection_count) ??
    readNumber(curveSelectionsQuery.data?.count) ??
    null;
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
    if (!isCurveTab) {
      return;
    }

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
  }, [isCurveTab, marketDataSets, onSelectMarketDataSet, selectedMarketDataSetUid]);

  useEffect(() => {
    if (!isCurveTab) {
      return;
    }

    const responseDate = discountCurve?.valuation_date?.trim();

    if (!responseDate || responseDate === curveDate) {
      return;
    }

    onSelectCurveDate(responseDate);
  }, [curveDate, discountCurve?.valuation_date, isCurveTab, onSelectCurveDate]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={pageTitle}
        description={pageDescription}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete curve
            </Button>
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to curves
            </Button>
          </div>
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

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {pricingCurveDetailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedTabId === tab.id
                    ? "border-primary/50 bg-primary/12 text-primary"
                    : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                }`}
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.label}
                {tab.id === "selections" && curveSelectionCount !== null
                  ? ` (${curveSelectionCount.toLocaleString()})`
                  : ""}
              </button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {selectedTabId === "curve" ? (
        <>
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
        </>
      ) : null}

      {selectedTabId === "selections" ? (
        <CurveSelectionsSection
          count={curveSelectionCount}
          error={curveSelectionsQuery.isError ? curveSelectionsQuery.error : null}
          isLoading={curveSelectionsQuery.isLoading}
          selections={curveSelections}
        />
      ) : null}

      <CurveDeleteDialog
        curveTitle={pageTitle}
        curveUid={curveUid}
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDeleted={onDeleted}
      />
    </div>
  );
}
