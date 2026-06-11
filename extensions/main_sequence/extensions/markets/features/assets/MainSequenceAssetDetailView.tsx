import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchAssetDetail,
  fetchAssetPricingDetails,
  fetchAssetSummary,
  formatMainSequenceError,
  type AssetCurrentSnapshot,
  type AssetDetailField,
  type AssetDetailResponse,
  type AssetListRow,
  type AssetPricingDetailsResponse,
  type EntitySummaryHeader,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { openMainSequenceMarketsSummaryLink } from "../summaryLinks";

export const assetDetailTabs = [
  { id: "details", label: "Details" },
  { id: "pricing-details", label: "Pricing Details" },
] as const;

export type AssetDetailTabId = (typeof assetDetailTabs)[number]["id"];

export function isAssetDetailTabId(value: string | null): value is AssetDetailTabId {
  return assetDetailTabs.some((tab) => tab.id === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatAssetValue(value: unknown, fallback = "Not available") {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    return value.trim() || fallback;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function getSnapshot(detail: AssetDetailResponse | null | undefined): AssetCurrentSnapshot | null {
  return isRecord(detail?.current_snapshot) ? detail.current_snapshot : null;
}

function getAssetTitle(
  assetUid: string,
  summary: EntitySummaryHeader | null | undefined,
  detail: AssetDetailResponse | null | undefined,
  initialAsset: AssetListRow | null,
) {
  const snapshot = getSnapshot(detail);

  return (
    readText(summary?.entity.title) ??
    readText(snapshot?.name) ??
    readText(detail?.name) ??
    readText(initialAsset?.name) ??
    readText(snapshot?.ticker) ??
    readText(detail?.ticker) ??
    readText(initialAsset?.ticker) ??
    readText(detail?.unique_identifier) ??
    readText(initialAsset?.unique_identifier) ??
    assetUid
  );
}

function getAssetSubtitle(assetUid: string, detail: AssetDetailResponse | null | undefined) {
  const snapshot = getSnapshot(detail);
  const parts = [
    readText(detail?.asset_type),
    readText(snapshot?.ticker) ?? readText(detail?.ticker),
    readText(snapshot?.exchange_code) ?? readText(detail?.exchange_code),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : `Asset UID ${assetUid}`;
}

function DetailValueCard({
  label,
  value,
  code = false,
}: {
  label: string;
  value: unknown;
  code?: boolean;
}) {
  return (
    <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/40 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 break-words text-sm text-foreground ${
          code ? "font-mono" : "font-medium"
        }`}
      >
        {formatAssetValue(value)}
      </div>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50 p-4 font-mono text-xs leading-relaxed text-foreground">
      {safeJsonStringify(value)}
    </pre>
  );
}

function AssetDetailFields({ fields }: { fields: AssetDetailField[] }) {
  if (fields.length === 0) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-8 text-center text-sm text-muted-foreground">
        No additional asset detail fields were returned.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field, index) => (
        <Card key={field.key ?? `${field.label}-${index}`} variant="nested">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{field.label}</CardTitle>
            {field.key || field.value_type ? (
              <CardDescription>
                {[field.key, field.value_type].filter(Boolean).join(" / ")}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {isRecord(field.value) || Array.isArray(field.value) ? (
              <JsonBlock value={field.value} />
            ) : (
              <div className="break-words text-sm text-foreground">
                {formatAssetValue(field.value)}
              </div>
            )}
            {field.description ? (
              <div className="text-xs text-muted-foreground">{field.description}</div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AssetDetailsSection({
  detail,
  isLoading,
  isError,
  error,
}: {
  detail: AssetDetailResponse | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}) {
  if (isLoading && !detail) {
    return (
      <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-3 h-4 w-4 animate-spin" />
        Loading asset details
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(error)}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-8 text-center text-sm text-muted-foreground">
        No asset detail was returned.
      </div>
    );
  }

  const snapshot = getSnapshot(detail);
  const detailFields = Array.isArray(detail.details) ? detail.details : [];

  return (
    <div className="space-y-5">
      <Card variant="nested">
        <CardHeader>
          <CardTitle>Asset Detail</CardTitle>
          <CardDescription>
            Canonical asset identity and latest snapshot returned by the asset detail endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailValueCard label="UID" value={detail.uid} code />
            <DetailValueCard label="Identifier" value={detail.unique_identifier} code />
            <DetailValueCard label="Asset Type" value={detail.asset_type} />
            <DetailValueCard label="Snapshot Time" value={snapshot?.time_index} code />
            <DetailValueCard label="Snapshot Asset Identifier" value={snapshot?.asset_identifier} code />
            <DetailValueCard label="Name" value={snapshot?.name ?? detail.name} />
            <DetailValueCard label="Ticker" value={snapshot?.ticker ?? detail.ticker} code />
            <DetailValueCard
              label="Exchange"
              value={snapshot?.exchange_code ?? detail.exchange_code}
              code
            />
            <DetailValueCard
              label="Asset Ticker Group"
              value={snapshot?.asset_ticker_group_id}
              code
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Current Snapshot</CardTitle>
          <CardDescription>
            Latest snapshot payload from `current_snapshot`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock value={snapshot ?? {}} />
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Additional Details</CardTitle>
          <CardDescription>
            Rows returned by the `details` array in the frontend detail response.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssetDetailFields fields={detailFields} />
        </CardContent>
      </Card>
    </div>
  );
}

function PricingDetailsSection({
  pricingDetails,
  isLoading,
  isError,
  error,
}: {
  pricingDetails: AssetPricingDetailsResponse | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}) {
  if (isLoading && !pricingDetails) {
    return (
      <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-3 h-4 w-4 animate-spin" />
        Loading pricing details
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(error)}
      </div>
    );
  }

  if (!pricingDetails) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-8 text-center text-sm text-muted-foreground">
        No pricing details were returned.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card variant="nested">
        <CardHeader>
          <CardTitle>Pricing Details</CardTitle>
          <CardDescription>
            Current pricing and instrument configuration for this asset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DetailValueCard label="Asset UID" value={pricingDetails.asset_uid} code />
            <DetailValueCard label="Instrument Type" value={pricingDetails.instrument_type} />
            <DetailValueCard
              label="Pricing Details Date"
              value={pricingDetails.pricing_details_date}
              code
            />
            <DetailValueCard
              label="Serialization Format"
              value={pricingDetails.serialization_format}
              code
            />
            <DetailValueCard
              label="Pricing Package Version"
              value={pricingDetails.pricing_package_version}
              code
            />
            <DetailValueCard label="Source" value={pricingDetails.source} />
          </div>
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Instrument Dump</CardTitle>
          <CardDescription>
            Serialized pricing instrument payload returned by the backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock value={pricingDetails.instrument_dump ?? {}} />
        </CardContent>
      </Card>

      <Card variant="nested">
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>
            Pricing-details metadata from `metadata_json`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock value={pricingDetails.metadata_json ?? {}} />
        </CardContent>
      </Card>
    </div>
  );
}

export function MainSequenceAssetDetailView({
  activeTabId,
  assetUid,
  initialAsset,
  onBack,
  onSelectTab,
}: {
  activeTabId: AssetDetailTabId;
  assetUid: string;
  initialAsset: AssetListRow | null;
  onBack: () => void;
  onSelectTab: (tabId: AssetDetailTabId) => void;
}) {
  const navigate = useNavigate();
  const assetDetailQuery = useQuery({
    queryKey: ["main_sequence", "assets", "detail", assetUid],
    queryFn: () => fetchAssetDetail(assetUid),
    enabled: Boolean(assetUid),
  });
  const assetSummaryQuery = useQuery({
    queryKey: ["main_sequence", "assets", "summary", assetUid],
    queryFn: () => fetchAssetSummary(assetUid),
    enabled: Boolean(assetUid),
  });
  const assetPricingDetailsQuery = useQuery({
    queryKey: ["main_sequence", "assets", "pricing_details", assetUid],
    queryFn: () => fetchAssetPricingDetails(assetUid),
    enabled: Boolean(assetUid) && activeTabId === "pricing-details",
  });

  const detail = assetDetailQuery.data ?? null;
  const summary = assetSummaryQuery.data ?? null;
  const pageTitle = useMemo(
    () => getAssetTitle(assetUid, summary, detail, initialAsset),
    [assetUid, detail, initialAsset, summary],
  );
  const pageDescription = getAssetSubtitle(assetUid, detail);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={pageTitle}
        description={pageDescription}
        actions={
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to assets
          </Button>
        }
      />

      {assetSummaryQuery.isLoading && !summary ? (
        <Card>
          <CardContent className="flex min-h-32 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading asset summary
            </div>
          </CardContent>
        </Card>
      ) : null}

      {assetSummaryQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(assetSummaryQuery.error)}
        </div>
      ) : null}

      {summary ? (
        <MainSequenceEntitySummaryCard
          summary={summary}
          onSummaryItemLinkClick={(linkUrl) =>
            openMainSequenceMarketsSummaryLink(navigate, linkUrl)
          }
          onSummaryUpdated={async () => {
            await assetSummaryQuery.refetch();
          }}
        />
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {assetDetailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTabId === tab.id
                    ? "border-primary/50 bg-primary/12 text-primary"
                    : "border-border/70 bg-background/35 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                }`}
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {activeTabId === "details" ? (
            <AssetDetailsSection
              detail={detail}
              error={assetDetailQuery.error}
              isError={assetDetailQuery.isError}
              isLoading={assetDetailQuery.isLoading}
            />
          ) : (
            <PricingDetailsSection
              error={assetPricingDetailsQuery.error}
              isError={assetPricingDetailsQuery.isError}
              isLoading={assetPricingDetailsQuery.isLoading}
              pricingDetails={assetPricingDetailsQuery.data ?? null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
