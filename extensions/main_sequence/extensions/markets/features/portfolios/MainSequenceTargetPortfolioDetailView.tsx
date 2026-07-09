import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { PageHeader } from "@/components/ui/page-header";
import type { CommandCenterFrameFieldType } from "@/connections/types";
import {
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import { TabularPreviewTable } from "@/widgets/shared/tabular-preview-table";

import {
  deleteTargetPortfolioWeights,
  fetchTargetPortfolioDetail,
  fetchTargetPortfolioSignalWeights,
  fetchTargetPositionDetailPositionDetails,
  fetchTargetPortfolioSummary,
  fetchTargetPortfolioValues,
  formatMainSequenceError,
  type SummaryField,
  type SummaryResponse,
  type TargetPortfolioSummaryExtensions,
  type TargetPortfolioSummaryResponse,
  type TargetPortfolioListRow,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { openMainSequenceMarketsSummaryLink } from "../summaryLinks";
import {
  formatPositionDetailCellValue,
  PositionDetailPositionSummaryStrip,
  PositionDetailTable,
} from "../../widgets/position-detail/PositionDetailTable";

export const targetPortfolioDetailTabs = [
  { id: "detail", label: "Detail" },
  { id: "weights", label: "Weights" },
  { id: "signal_weights", label: "Signal Weights" },
  { id: "portfolio_values", label: "Portfolio Values" },
] as const;

export type TargetPortfolioDetailTabId = (typeof targetPortfolioDetailTabs)[number]["id"];

export const defaultTargetPortfolioDetailTabId: TargetPortfolioDetailTabId = "detail";

export function isTargetPortfolioDetailTabId(
  value: string | null,
): value is TargetPortfolioDetailTabId {
  return targetPortfolioDetailTabs.some((tab) => tab.id === value);
}

function getPortfolioName(row: TargetPortfolioListRow | null) {
  return readTrimmedString(row?.unique_identifier) ?? "";
}

function getPortfolioIndexUid(row: TargetPortfolioListRow | null) {
  return readTrimmedString(row?.portfolio_index_uid) ?? "";
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readDeletedWeightsCount(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const count = (value as Record<string, unknown>).deleted_count;
  return typeof count === "number" && Number.isFinite(count) ? count : null;
}

function formatDeletedWeightsDescription(value: unknown) {
  const count = readDeletedWeightsCount(value);

  if (count === null) {
    return "Portfolio weights were deleted.";
  }

  return `${count.toLocaleString()} ${count === 1 ? "weight row was" : "weight rows were"} deleted.`;
}

function mapCommandCenterFrameFieldType(value: unknown): TabularFrameFieldType {
  if (value === "time") {
    return "datetime";
  }

  if (
    value === "number" ||
    value === "string" ||
    value === "boolean" ||
    value === "json"
  ) {
    return value;
  }

  return "unknown";
}

function readCommandCenterFrameFields(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((field) => {
    if (!isPlainRecord(field)) {
      return [];
    }

    const name = readTrimmedString(field.name);
    const values = Array.isArray(field.values) ? field.values : null;

    if (!name || !values) {
      return [];
    }

    const fieldType = field.type as CommandCenterFrameFieldType | undefined;
    const config = isPlainRecord(field.config) ? field.config : {};
    const displayName = readTrimmedString(config.displayName);

    return [
      {
        name,
        type: fieldType,
        values,
        schema: {
          key: name,
          label: displayName ?? name,
          type: mapCommandCenterFrameFieldType(fieldType),
          nullable: true,
          provenance: "backend",
          nativeType: typeof fieldType === "string" ? fieldType : null,
          reason: "Returned by the Main Sequence Markets tabular endpoint.",
        } satisfies TabularFrameFieldSchema,
      },
    ];
  });
}

function commandCenterFrameToTabularSource(
  frame: Record<string, unknown>,
  label: string,
): TabularFrameSourceV1 | null {
  const fields = readCommandCenterFrameFields(frame.fields);

  if (fields.length === 0) {
    return null;
  }

  const rowCount = Math.max(0, ...fields.map((field) => field.values.length));
  const columns = fields.map((field) => field.name);
  const rows = Array.from({ length: rowCount }, (_entry, index) =>
    Object.fromEntries(fields.map((field) => [field.name, field.values[index] ?? null])),
  );

  return {
    status: "ready",
    columns,
    rows,
    fields: fields.map((field) => field.schema),
    meta: isPlainRecord(frame.meta) ? frame.meta : undefined,
    source: {
      kind: "main-sequence-markets",
      label: readTrimmedString(frame.name) ?? label,
      updatedAtMs: Date.now(),
    },
  };
}

function normalizePortfolioTabularFrameResponse(
  value: unknown,
  label: string,
): TabularFrameSourceV1 | null {
  const normalizedSource = normalizeTabularFrameSource(value);

  if (normalizedSource) {
    return normalizedSource;
  }

  if (!isPlainRecord(value) || !Array.isArray(value.frames)) {
    return null;
  }

  const tabularFrame = value.frames.find(
    (frame) =>
      isPlainRecord(frame) &&
      frame.contract === "core.tabular_frame@v1" &&
      Array.isArray(frame.fields),
  );

  return tabularFrame && isPlainRecord(tabularFrame)
    ? commandCenterFrameToTabularSource(tabularFrame, label)
    : null;
}

function PortfolioTabularFramePanel({
  data,
  description,
  emptyMessage,
  error,
  isError,
  isLoading,
  title,
}: {
  data: unknown;
  description: string;
  emptyMessage: string;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  title: string;
}) {
  const frame = useMemo(
    () => (data === undefined ? null : normalizePortfolioTabularFrameResponse(data, title)),
    [data, title],
  );
  const errorMessage =
    isError
      ? formatMainSequenceError(error)
      : frame?.status === "error"
        ? frame.error ?? "The endpoint returned a tabular frame error."
        : null;

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-3 h-4 w-4 animate-spin" />
        Loading {title.toLowerCase()}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {errorMessage}
      </div>
    );
  }

  if (!frame) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 text-sm text-warning">
        <AlertTriangle className="h-4 w-4" />
        The endpoint did not return a tabular frame.
      </div>
    );
  }

  return (
    <Card variant="nested">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/35 px-2 py-1">
              {frame.rows.length.toLocaleString()} rows
            </span>
            <span className="rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/35 px-2 py-1">
              {frame.columns.length.toLocaleString()} columns
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <TabularPreviewTable
          className="min-h-[420px]"
          columns={frame.columns}
          rows={frame.rows}
          emptyMessage={emptyMessage}
          maxRows={100}
        />
      </CardContent>
    </Card>
  );
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
  };
}

function buildLocalUpdateWorkbenchPath(localUpdateId: string) {
  const searchParams = new URLSearchParams();
  searchParams.set("msDataNodeTab", "local-updates");
  searchParams.set("msLocalUpdateUid", localUpdateId);
  searchParams.set("msLocalUpdateTab", "details");
  return `${getAppPath("main-sequence-foundry", "data-nodes")}?${searchParams.toString()}`;
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
  const localUpdateId =
    typeof rawLocalUpdateId === "string" && rawLocalUpdateId.trim()
      ? rawLocalUpdateId.trim()
      : null;

  return {
    ...field,
    value: localUpdateLabel,
    href: localUpdateId ? buildLocalUpdateWorkbenchPath(localUpdateId) : undefined,
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
  portfolioUid: string,
  portfolio: TargetPortfolioListRow | null,
): SummaryResponse<TargetPortfolioSummaryExtensions> | null {
  if (!portfolio) {
    return null;
  }

  const portfolioName = getPortfolioName(portfolio);
  const calendarName = readTrimmedString(portfolio.calendar_name);
  const indexUid = getPortfolioIndexUid(portfolio);

  return {
    entity: {
      id: portfolioUid,
      type: "portfolio",
      title: portfolioName || `Portfolio ${portfolioUid}`,
    },
    badges: [
      {
        key: "portfolio-type",
        label: indexUid ? "Indexed" : "Portfolio",
        tone: "neutral",
      },
    ],
    inline_fields: [
      {
        key: "portfolio_uid",
        label: "UID",
        value: portfolioUid,
        kind: "code",
      },
      ...(calendarName
        ? [
            {
              key: "calendar_name",
              label: "Calendar",
              value: calendarName,
              kind: "text" as const,
            },
          ]
        : []),
    ],
    highlight_fields: [
      {
        key: "unique_identifier",
        label: "Portfolio",
        value: portfolioName || "Not available",
        kind: "text",
      },
      {
        key: "portfolio_index_uid",
        label: "Portfolio Index UID",
        value: indexUid || "Not available",
        kind: "text",
      },
    ],
    stats: [],
  };
}

export function MainSequenceTargetPortfolioDetailView({
  initialPortfolio,
  onBack,
  portfolioUid,
  onSelectTab,
  selectedTabId,
}: {
  initialPortfolio: TargetPortfolioListRow | null;
  onBack: () => void;
  onSelectTab: (tabId: TargetPortfolioDetailTabId) => void;
  portfolioUid: string;
  selectedTabId: TargetPortfolioDetailTabId;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteWeightsDialogOpen, setDeleteWeightsDialogOpen] = useState(false);
  const fallbackSummary = useMemo(
    () => buildFallbackPortfolioSummary(portfolioUid, initialPortfolio),
    [initialPortfolio, portfolioUid],
  );

  const portfolioSummaryQuery = useQuery({
    queryKey: ["main_sequence", "target_portfolios", "summary", portfolioUid],
    queryFn: () => fetchTargetPortfolioSummary(portfolioUid),
    enabled: Boolean(portfolioUid),
  });
  const portfolioDetailQuery = useQuery({
    queryKey: ["main_sequence", "target_portfolios", "detail", portfolioUid],
    queryFn: () => fetchTargetPortfolioDetail(portfolioUid),
    enabled: Boolean(portfolioUid) && selectedTabId === "detail",
  });

  const summary = useMemo(() => {
    const rawSummary = portfolioSummaryQuery.data ?? fallbackSummary;
    return rawSummary ? normalizePortfolioSummary(rawSummary) : null;
  }, [fallbackSummary, portfolioSummaryQuery.data]);
  const detailContent = useMemo(() => {
    const summaryDetail = getTargetPortfolioDetailContent(portfolioSummaryQuery.data ?? null);
    const detailDescription = readTrimmedString(portfolioDetailQuery.data?.metadata?.description);

    return {
      description: detailDescription ?? summaryDetail.description,
    };
  }, [portfolioDetailQuery.data, portfolioSummaryQuery.data]);
  const weightsDetailsQuery = useQuery({
    queryKey: ["main_sequence", "target_portfolios", "weights_position_details", portfolioUid],
    queryFn: () => fetchTargetPositionDetailPositionDetails(portfolioUid),
    enabled: Boolean(portfolioUid) && selectedTabId === "weights",
  });
  const weightRows = weightsDetailsQuery.data?.rows ?? [];
  const weightsDate = weightsDetailsQuery.data?.weights_date ?? null;
  const deleteWeightsMutation = useMutation({
    mutationFn: () => deleteTargetPortfolioWeights(portfolioUid),
  });
  const signalWeightsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "target_portfolios",
      "signal_weights",
      portfolioUid,
      "desc",
      100,
    ],
    queryFn: () =>
      fetchTargetPortfolioSignalWeights(portfolioUid, {
        order: "desc",
        limit: 100,
      }),
    enabled: Boolean(portfolioUid) && selectedTabId === "signal_weights",
  });
  const portfolioValuesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "target_portfolios",
      "portfolio_values",
      portfolioUid,
      "desc",
      100,
    ],
    queryFn: () =>
      fetchTargetPortfolioValues(portfolioUid, {
        order: "desc",
        limit: 100,
      }),
    enabled: Boolean(portfolioUid) && selectedTabId === "portfolio_values",
  });
  const hasDetailContent = Boolean(
    detailContent.description,
  );
  const portfolioTitle =
    summary?.entity.title?.trim() ||
    getPortfolioName(initialPortfolio) ||
    `Portfolio ${portfolioUid}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Main Sequence Markets"
        title={portfolioTitle}
        description="Review the canonical portfolio summary."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to portfolios
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => setDeleteWeightsDialogOpen(true)}
              disabled={deleteWeightsMutation.isPending}
            >
              {deleteWeightsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete weights
            </Button>
          </div>
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
          onSummaryItemLinkClick={(linkUrl) =>
            openMainSequenceMarketsSummaryLink(navigate, linkUrl)
          }
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
            (portfolioSummaryQuery.isLoading && !portfolioSummaryQuery.data) ||
            portfolioDetailQuery.isLoading ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                Loading portfolio details
              </div>
            ) : portfolioDetailQuery.isError ? (
              <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {formatMainSequenceError(portfolioDetailQuery.error)}
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
              </div>
            ) : (
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-10 text-center text-sm text-muted-foreground">
                No additional portfolio detail fields were returned.
              </div>
            )
          ) : selectedTabId === "weights" ? (
            weightsDetailsQuery.isLoading ? (
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
                  {weightsDate ? (
                    <Card variant="nested" className="min-w-[220px]">
                      <CardContent className="pt-5">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Weights Date
                        </div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          {formatPositionDetailCellValue(
                            weightsDate,
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
                </div>

                {weightRows.length > 0 ? (
                  <Card variant="nested">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Position Details</CardTitle>
                      <CardDescription>
                        Detailed records returned by the portfolio weights endpoint.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <PositionDetailPositionSummaryStrip rows={weightRows} />
                      <PositionDetailTable
                        columnDefs={weightsDetailsQuery.data?.columnDefs ?? []}
                        rows={weightRows}
                        preferredPositionColumns
                        sourceType="portfolio"
                        holdingsDate={weightsDetailsQuery.data?.weights_date ?? null}
                        emptyMessage="No position rows were returned."
                        emptyTitle="No position rows"
                        tableMinWidth={760}
                      />
                    </CardContent>
                  </Card>
                ) : null}

                {weightRows.length === 0 ? (
                  <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/32 px-4 py-10 text-center text-sm text-muted-foreground">
                    {weightsDetailsQuery.data?.resolution_warning ||
                      "No weights were returned for this portfolio."}
                  </div>
                ) : null}
              </div>
            )
          ) : selectedTabId === "signal_weights" ? (
            <PortfolioTabularFramePanel
              title="Signal Weights"
              description="Signal weight rows returned by the portfolio signal weights endpoint."
              emptyMessage="No signal weight rows were returned for this portfolio."
              data={signalWeightsQuery.data}
              error={signalWeightsQuery.error}
              isError={signalWeightsQuery.isError}
              isLoading={signalWeightsQuery.isLoading}
            />
          ) : (
            <PortfolioTabularFramePanel
              title="Portfolio Values"
              description="Portfolio value rows returned by the portfolio values endpoint."
              emptyMessage="No portfolio value rows were returned for this portfolio."
              data={portfolioValuesQuery.data}
              error={portfolioValuesQuery.error}
              isError={portfolioValuesQuery.isError}
              isLoading={portfolioValuesQuery.isLoading}
            />
          )}
        </CardContent>
      </Card>

      <ActionConfirmationDialog
        open={deleteWeightsDialogOpen}
        onClose={() => {
          if (!deleteWeightsMutation.isPending) {
            setDeleteWeightsDialogOpen(false);
          }
        }}
        title="Delete portfolio weights"
        tone="danger"
        actionLabel="delete"
        objectLabel="portfolio weights"
        objectSummary={
          <div className="space-y-2">
            <div>
              <div className="font-medium text-foreground">{portfolioTitle}</div>
              <div className="font-mono text-xs text-muted-foreground">{portfolioUid}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Delete scope
              </div>
              <div className="mt-1 text-sm text-foreground">
                All portfolio weight rows for the resolved portfolio index identifier
              </div>
            </div>
          </div>
        }
        description="This deletes all weight rows for this portfolio's resolved portfolio index identifier."
        specialText="The request intentionally omits weights_date so the backend deletes all portfolio weights."
        confirmWord="DELETE"
        confirmButtonLabel="Delete weights"
        isPending={deleteWeightsMutation.isPending}
        onConfirm={() => deleteWeightsMutation.mutateAsync()}
        onSuccess={async () => {
          setDeleteWeightsDialogOpen(false);
          await queryClient.invalidateQueries({
            queryKey: ["main_sequence", "target_portfolios"],
          });
        }}
        error={
          deleteWeightsMutation.isError
            ? formatMainSequenceError(deleteWeightsMutation.error)
            : undefined
        }
        successToast={{
          title: "Portfolio weights deleted",
          description: formatDeletedWeightsDescription,
          variant: "success",
        }}
        errorToast={{
          title: "Portfolio weights delete failed",
          description: formatMainSequenceError,
          variant: "error",
        }}
      />
    </div>
  );
}
