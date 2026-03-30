import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { PageHeader } from "@/components/ui/page-header";

import {
  fetchTargetPortfolioWeightsPositionDetails,
  fetchTargetPortfolioSummary,
  formatMainSequenceError,
  type SummaryField,
  type SummaryResponse,
  type TargetPortfolioSummaryExtensions,
  type TargetPortfolioSummaryResponse,
  type TargetPortfolioListRow,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import {
  formatPortfolioWeightsCellValue,
  normalizePortfolioWeightSummaryRows,
  PortfolioWeightsPositionSummaryStrip,
  PortfolioWeightsTable,
} from "../../widgets/portfolio-weights-table/PortfolioWeightsTable";

export const targetPortfolioDetailTabs = [
  { id: "detail", label: "Detail" },
  { id: "weights", label: "Weights" },
] as const;

export type TargetPortfolioDetailTabId = (typeof targetPortfolioDetailTabs)[number]["id"];

export const defaultTargetPortfolioDetailTabId: TargetPortfolioDetailTabId = "detail";

export function isTargetPortfolioDetailTabId(
  value: string | null,
): value is TargetPortfolioDetailTabId {
  return targetPortfolioDetailTabs.some((tab) => tab.id === value);
}

function getPortfolioIndexAsset(row: TargetPortfolioListRow | null) {
  if (!row) {
    return null;
  }

  return row.index_asset ?? row.portfolio_index_asset ?? null;
}

function getPortfolioName(row: TargetPortfolioListRow | null) {
  const name = getPortfolioIndexAsset(row)?.current_snapshot?.name;
  return typeof name === "string" && name.trim() ? name.trim() : "";
}

function getPortfolioTicker(row: TargetPortfolioListRow | null) {
  const ticker = getPortfolioIndexAsset(row)?.current_snapshot?.ticker;
  return typeof ticker === "string" && ticker.trim() ? ticker.trim() : "";
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getTargetPortfolioSummaryExtensions(
  summary: TargetPortfolioSummaryResponse | null,
) {
  return summary?.extensions;
}

function getTargetPortfolioDetailContent(summary: TargetPortfolioSummaryResponse | null) {
  const extensions = getTargetPortfolioSummaryExtensions(summary);

  return {
    description: readTrimmedString(extensions?.description),
    signalName: readTrimmedString(extensions?.signal_name),
    signalDescription: readTrimmedString(extensions?.signal_description),
    rebalanceStrategyName: readTrimmedString(extensions?.rebalance_strategy_name),
    rebalanceStrategyDescription: readTrimmedString(extensions?.rebalance_strategy_description),
  };
}

function buildLocalUpdateWorkbenchPath(localUpdateId: number) {
  const searchParams = new URLSearchParams();
  searchParams.set("msDataNodeTab", "local-time-series");
  searchParams.set("msLocalUpdateId", String(localUpdateId));
  searchParams.set("msLocalUpdateTab", "details");
  return `${getAppPath("main_sequence_workbench", "data-nodes")}?${searchParams.toString()}`;
}

function normalizePortfolioSummaryField(field: SummaryField): SummaryField {
  const rawValue = field.value as unknown;

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return field;
  }

  const payload = rawValue as Record<string, unknown>;
  const dataNodeUpdateValue = payload.data_node_update ?? null;
  const rawLocalUpdateId = payload.id ?? null;

  if (!("data_node_update" in payload) && !("id" in payload)) {
    return field;
  }

  const localUpdateLabel =
    typeof dataNodeUpdateValue === "string" && dataNodeUpdateValue.trim()
      ? dataNodeUpdateValue.trim()
      : "Not available";
  const localUpdateId = Number(rawLocalUpdateId ?? "");

  return {
    ...field,
    value: localUpdateLabel,
    href:
      Number.isFinite(localUpdateId) && localUpdateId > 0
        ? buildLocalUpdateWorkbenchPath(localUpdateId)
        : undefined,
  };
}

function normalizePortfolioSummary<T extends SummaryResponse>(
  summary: T,
): T {
  return {
    ...summary,
    inline_fields: summary.inline_fields.map(normalizePortfolioSummaryField),
    highlight_fields: summary.highlight_fields.map(normalizePortfolioSummaryField),
  } as T;
}

function buildFallbackPortfolioSummary(
  portfolioId: number,
  portfolio: TargetPortfolioListRow | null,
): SummaryResponse<TargetPortfolioSummaryExtensions> | null {
  if (!portfolio) {
    return null;
  }

  const portfolioName = getPortfolioName(portfolio);
  const creationDate = portfolio.creation_date?.trim() || "";
  const indexTicker = getPortfolioTicker(portfolio);

  return {
    entity: {
      id: portfolioId,
      type: "target_portfolio",
      title: portfolioName || `Portfolio ${portfolioId}`,
    },
    badges: [
      {
        key: "portfolio-type",
        label: "Target Portfolio",
        tone: "neutral",
      },
    ],
    inline_fields: [
      {
        key: "portfolio_id",
        label: "ID",
        value: String(portfolioId),
        kind: "code",
      },
      ...(creationDate
        ? [
            {
              key: "creation_date",
              label: "Created",
              value: creationDate,
              kind: "text" as const,
            },
          ]
        : []),
    ],
    highlight_fields: [
      {
        key: "portfolio_name",
        label: "Portfolio",
        value: portfolioName || "Not available",
        kind: "text",
      },
      {
        key: "index_asset_ticker",
        label: "Index Asset",
        value: indexTicker || "Not available",
        kind: "text",
      },
    ],
    stats: [],
  };
}

export function MainSequenceTargetPortfolioDetailView({
  initialPortfolio,
  onBack,
  portfolioId,
  onSelectTab,
  selectedTabId,
}: {
  initialPortfolio: TargetPortfolioListRow | null;
  onBack: () => void;
  onSelectTab: (tabId: TargetPortfolioDetailTabId) => void;
  portfolioId: number;
  selectedTabId: TargetPortfolioDetailTabId;
}) {
  const navigate = useNavigate();
  const fallbackSummary = useMemo(
    () => buildFallbackPortfolioSummary(portfolioId, initialPortfolio),
    [initialPortfolio, portfolioId],
  );

  const portfolioSummaryQuery = useQuery({
    queryKey: ["main_sequence", "target_portfolios", "summary", portfolioId],
    queryFn: () => fetchTargetPortfolioSummary(portfolioId),
    enabled: portfolioId > 0,
  });

  const summary = useMemo(() => {
    const rawSummary = portfolioSummaryQuery.data ?? fallbackSummary;
    return rawSummary ? normalizePortfolioSummary(rawSummary) : null;
  }, [fallbackSummary, portfolioSummaryQuery.data]);
  const detailContent = useMemo(
    () => getTargetPortfolioDetailContent(portfolioSummaryQuery.data ?? null),
    [portfolioSummaryQuery.data],
  );
  const weightsDetailsQuery = useQuery({
    queryKey: ["main_sequence", "target_portfolios", "weights_position_details", portfolioId],
    queryFn: () => fetchTargetPortfolioWeightsPositionDetails(portfolioId),
    enabled: portfolioId > 0 && selectedTabId === "weights",
  });
  const weightRows = weightsDetailsQuery.data?.rows ?? [];
  const weightSummaryRows = useMemo(
    () => normalizePortfolioWeightSummaryRows(weightsDetailsQuery.data?.weights ?? null),
    [weightsDetailsQuery.data?.weights],
  );
  const hasDetailContent = Boolean(
    detailContent.description ||
      detailContent.signalName ||
      detailContent.signalDescription ||
      detailContent.rebalanceStrategyName ||
      detailContent.rebalanceStrategyDescription,
  );
  const portfolioTitle =
    summary?.entity.title?.trim() ||
    getPortfolioName(initialPortfolio) ||
    `Portfolio ${portfolioId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={portfolioTitle}
        description="Review the canonical target portfolio summary."
        actions={
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to portfolios
          </Button>
        }
      />

      {portfolioSummaryQuery.isError ? (
        <Card>
          <CardContent className="p-5">
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(portfolioSummaryQuery.error)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <MainSequenceEntitySummaryCard
          summary={summary}
          onFieldLinkClick={(field) => {
            if (field.href) {
              navigate(field.href);
            }
          }}
        />
      ) : (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading portfolio summary
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex flex-wrap gap-2">
            {targetPortfolioDetailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  tab.id === selectedTabId
                    ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                    : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                }
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {selectedTabId === "detail" ? (
            portfolioSummaryQuery.isLoading && !portfolioSummaryQuery.data ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                Loading portfolio details
              </div>
            ) : hasDetailContent ? (
              <div className="space-y-4">
                {detailContent.description ? (
                  <Card variant="nested">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Description</CardTitle>
                      <CardDescription>
                        Canonical portfolio description from the summary endpoint.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <MarkdownContent content={detailContent.description} />
                    </CardContent>
                  </Card>
                ) : null}

                {detailContent.signalName || detailContent.signalDescription ? (
                  <Card variant="nested">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {detailContent.signalName || "Signal"}
                      </CardTitle>
                      <CardDescription>Signal metadata attached to this portfolio.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {detailContent.signalDescription ? (
                        <MarkdownContent content={detailContent.signalDescription} />
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No signal description was returned.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                {detailContent.rebalanceStrategyName || detailContent.rebalanceStrategyDescription ? (
                  <Card variant="nested">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        {detailContent.rebalanceStrategyName || "Rebalance strategy"}
                      </CardTitle>
                      <CardDescription>
                        Rebalance strategy metadata from the summary endpoint.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {detailContent.rebalanceStrategyDescription ? (
                        <MarkdownContent content={detailContent.rebalanceStrategyDescription} />
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No rebalance strategy description was returned.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-10 text-center text-sm text-muted-foreground">
                No additional portfolio detail fields were returned.
              </div>
            )
          ) : weightsDetailsQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-3 h-4 w-4 animate-spin" />
              Loading portfolio weights
            </div>
          ) : weightsDetailsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(weightsDetailsQuery.error)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {weightsDetailsQuery.data?.weights_date ? (
                  <Card variant="nested" className="min-w-[220px]">
                    <CardContent className="pt-5">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Weights Date
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {formatPortfolioWeightsCellValue(
                          weightsDetailsQuery.data.weights_date,
                          "weights_date",
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <Card variant="nested" className="min-w-[220px]">
                  <CardContent className="pt-5">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Position Rows
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {weightRows.length.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                {weightSummaryRows.length > 0 ? (
                  <Card variant="nested" className="min-w-[220px]">
                    <CardContent className="pt-5">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Weight Entries
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {weightSummaryRows.length.toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>

              {weightSummaryRows.length > 0 ? (
                <Card variant="nested">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Weights Summary</CardTitle>
                    <CardDescription>
                      Summary rows returned by the weights-position-details endpoint.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <PortfolioWeightsTable
                      columnDefs={weightsDetailsQuery.data?.summaryColumnDefs ?? []}
                      rows={weightSummaryRows}
                      expandableAssetRows
                      positionMap={weightsDetailsQuery.data?.position_map ?? null}
                      emptyMessage="No summary weight rows were returned."
                      emptyTitle="No summary rows"
                      tableMinWidth={680}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {weightRows.length > 0 ? (
                <Card variant="nested">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Position Details</CardTitle>
                    <CardDescription>
                      Detailed rows returned by the weights-position-details endpoint.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <PortfolioWeightsPositionSummaryStrip rows={weightRows} />
                    <PortfolioWeightsTable
                      columnDefs={weightsDetailsQuery.data?.columnDefs ?? []}
                      rows={weightRows}
                      preferredPositionColumns
                      emptyMessage="No position rows were returned."
                      emptyTitle="No position rows"
                      tableMinWidth={760}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {weightSummaryRows.length === 0 && weightRows.length === 0 ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-10 text-center text-sm text-muted-foreground">
                  No weights were returned for this portfolio.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
