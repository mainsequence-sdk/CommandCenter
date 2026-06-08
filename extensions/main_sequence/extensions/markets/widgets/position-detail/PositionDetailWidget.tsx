import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { useWidgetExecutionState } from "@/dashboards/DashboardWidgetExecution";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  fetchManagedAccountHoldingsByFundPositionDetails,
  formatMainSequenceError,
  saveManagedAccountHoldings,
  saveManagedAccountTargetPositions,
  type ManagedAccountHoldingsByFundPositionDetailsResponse,
  type ManagedAccountHoldingsByFundResidualRow,
  type TargetPositionDetailPositionDetailsResponse,
} from "../../../../common/api";
import {
  normalizePositionDetailSummaryRows,
  PositionDetailPositionSummaryStrip,
  PositionDetailTable,
  type PositionDetailTableVariant,
} from "./PositionDetailTable";
import {
  getAllowedPositionDetailPositionTypes,
  normalizePositionDetailAccountUid,
  hydratePositionDetailRowsFromPayload,
  normalizePositionDetailHoldingsDate,
  type PositionDetailInlineRow,
  normalizePositionDetailPersistedRows,
  normalizePositionDetailRuntimeState,
  normalizePositionDetailSourceType,
  normalizePositionDetailTargetUid,
  normalizePositionDetailTargetPositionsDate,
  normalizePositionDetailVariant,
  type PositionDetailWidgetProps,
} from "./positionDetailRuntime";
import { PositionDetailInlineEditor } from "./PositionDetailInlineEditor";

type Props = WidgetComponentProps<PositionDetailWidgetProps>;

function getCurrentIsoTimestamp() {
  return new Date().toISOString();
}

function padDateTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateTimeLocalValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${padDateTimePart(parsed.getMonth() + 1)}-${padDateTimePart(parsed.getDate())}T${padDateTimePart(parsed.getHours())}:${padDateTimePart(parsed.getMinutes())}`;
}

function parseDateTimeLocalValue(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function PositionDetailDateTimeField({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange?: (nextValue: string) => void;
}) {
  return (
    <label className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <input
        type="datetime-local"
        step={60}
        value={formatDateTimeLocalValue(value)}
        readOnly={!editable}
        className="flex h-10 rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30 read-only:cursor-default"
        onChange={
          editable && onChange
            ? (event) => {
                const nextDate =
                  parseDateTimeLocalValue(event.target.value) ?? getCurrentIsoTimestamp();
                onChange(nextDate);
              }
            : undefined
        }
      />
    </label>
  );
}

type AccountHoldingsView = "holdings" | "by_fund";

function readDisplayString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDetailValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "Not available";
}

function formatAllocationWarning(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getResidualAssetLabel(row: ManagedAccountHoldingsByFundResidualRow) {
  const snapshot =
    row.asset?.current_snapshot &&
    typeof row.asset.current_snapshot === "object" &&
    !Array.isArray(row.asset.current_snapshot)
      ? (row.asset.current_snapshot as Record<string, unknown>)
      : null;

  return (
    readDisplayString(snapshot?.name) ??
    readDisplayString(row.asset_identifier) ??
    "Unknown asset"
  );
}

function getResidualAssetTicker(row: ManagedAccountHoldingsByFundResidualRow) {
  const snapshot =
    row.asset?.current_snapshot &&
    typeof row.asset.current_snapshot === "object" &&
    !Array.isArray(row.asset.current_snapshot)
      ? (row.asset.current_snapshot as Record<string, unknown>)
      : null;

  return readDisplayString(snapshot?.ticker);
}

function PositionDetailAccountHoldingsTabs({
  value,
  onChange,
}: {
  value: AccountHoldingsView;
  onChange: (value: AccountHoldingsView) => void;
}) {
  const tabs: Array<{ value: AccountHoldingsView; label: string }> = [
    { value: "holdings", label: "Holdings" },
    { value: "by_fund", label: "By Fund" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Account holdings views"
      className="inline-flex rounded-[calc(var(--radius)-4px)] border border-border/70 bg-card/60 p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={
            value === tab.value
              ? "rounded-[calc(var(--radius)-6px)] bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm"
              : "rounded-[calc(var(--radius)-6px)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          }
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function PositionDetailAccountHoldingsByFundView({
  data,
  error,
  isLoading,
  tableMinWidth,
}: {
  data?: ManagedAccountHoldingsByFundPositionDetailsResponse;
  error: unknown;
  isLoading: boolean;
  tableMinWidth: number;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          Loading holdings by fund
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(error)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || (!data.holdings_date && data.funds.length === 0)) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          No source account holdings snapshot was returned.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Holdings Date", data.holdings_date],
          ["Source Holdings Set", data.source_account_holdings_set_uid],
          ["Funds", data.funds.length],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-[calc(var(--radius)-4px)] border border-border/70 bg-card/60 px-4 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 truncate font-mono text-sm text-foreground">
              {formatDetailValue(value)}
            </div>
          </div>
        ))}
      </div>

      {data.funds.length > 0 ? (
        data.funds.map((fund) => (
          <Card
            key={
              fund.virtual_fund_uid ??
              fund.virtual_fund_unique_identifier ??
              fund.holdings_set_uid ??
              "fund"
            }
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {fund.virtual_fund_unique_identifier ??
                      fund.virtual_fund_uid ??
                      "Virtual fund"}
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {fund.virtual_fund_uid ?? "UID not available"}
                  </div>
                </div>
                <div className="grid gap-2 text-right text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <div className="uppercase tracking-[0.14em]">Portfolio</div>
                    <div className="font-mono text-foreground">
                      {fund.target_portfolio_uid ?? "Not available"}
                    </div>
                  </div>
                  <div>
                    <div className="uppercase tracking-[0.14em]">Holdings Set</div>
                    <div className="font-mono text-foreground">
                      {fund.holdings_set_uid ?? "Not available"}
                    </div>
                  </div>
                </div>
              </div>
              <PositionDetailTable
                columnDefs={fund.position_details.columnDefs}
                rows={fund.position_details.rows}
                sourceType="account"
                holdingsDate={data.holdings_date}
                preferredPositionColumns
                emptyTitle="No fund holdings"
                emptyMessage="This fund has no persisted allocated holdings for the selected snapshot."
                tableMinWidth={tableMinWidth}
              />
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
            No virtual-fund allocations were returned for this holdings snapshot.
          </CardContent>
        </Card>
      )}

      {data.residuals.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <div className="text-sm font-semibold text-foreground">Residuals</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Source account signed quantity minus allocated signed quantity per asset.
              </div>
            </div>
            <div className="overflow-hidden rounded-[calc(var(--radius)-4px)] border border-border/70">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-background/80">
                  <tr>
                    {[
                      "Asset",
                      "Ticker",
                      "Source Signed",
                      "Allocated Signed",
                      "Residual Signed",
                    ].map((header) => (
                      <th
                        key={header}
                        className="border-b border-border/70 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.residuals.map((row, index) => (
                    <tr
                      key={`${row.asset_identifier ?? "asset"}-${index}`}
                      className="border-b border-border/50 last:border-b-0"
                    >
                      <td className="px-3 py-2 text-foreground">
                        <div className="font-medium">{getResidualAssetLabel(row)}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.asset_identifier ?? "Not available"}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">
                        {getResidualAssetTicker(row) ?? "Not available"}
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">
                        {formatDetailValue(row.source_signed_quantity)}
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">
                        {formatDetailValue(row.allocated_signed_quantity)}
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">
                        {formatDetailValue(row.residual_signed_quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.allocation_warnings.length > 0 ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="text-sm font-semibold text-warning">Allocation warnings</div>
            {data.allocation_warnings.map((warning, index) => (
              <pre
                key={index}
                className="overflow-x-auto rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning whitespace-pre-wrap"
              >
                {formatAllocationWarning(warning)}
              </pre>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function buildManagedAccountHoldingsPayload(
  rows: ReturnType<typeof normalizePositionDetailPersistedRows>,
  holdingsDate: string,
) {
  if (rows.length === 0) {
    throw new Error("Add at least one holdings row before saving.");
  }

  return {
    holdings_date: holdingsDate,
    overwrite: true,
    positions: rows.map((row) => {
      const uniqueIdentifier = row.uniqueIdentifier?.trim();
      if (!uniqueIdentifier) {
        throw new Error(`Asset ${row.assetName ?? row.assetId} is missing a unique identifier.`);
      }

      const assetUid = row.assetUid?.trim();
      if (!assetUid) {
        throw new Error(`Asset ${row.assetName ?? uniqueIdentifier} is missing an asset uid.`);
      }

      const direction: 1 | -1 =
        row.positionValue < 0 || Object.is(row.positionValue, -0) ? -1 : 1;

      return {
        asset_identifier: uniqueIdentifier,
        asset_uid: assetUid,
        position_type: "units",
        quantity: String(Math.abs(row.positionValue)),
        direction,
        target_trade_time: holdingsDate,
        extra_details: {},
      };
    }),
  };
}

function normalizeManagedAccountTargetAllocationType(value: unknown): "asset" | "portfolio" {
  return value === "portfolio" ? "portfolio" : "asset";
}

export function buildManagedAccountTargetPositionsPayload(
  rows: ReturnType<typeof normalizePositionDetailPersistedRows>,
  targetPositionsDate: string,
) {
  if (rows.length === 0) {
    throw new Error("Add at least one target allocation row before saving.");
  }

  return {
    target_positions_date: targetPositionsDate,
    overwrite: true,
    positions: rows.map((row) => {
      const assetUid = row.assetUid?.trim();
      const portfolioUid = row.portfolioUid?.trim();
      const targetType = normalizeManagedAccountTargetAllocationType(
        row.targetType?.trim() || (portfolioUid ? "portfolio" : "asset"),
      );
      const targetUid =
        row.targetUid?.trim() || (targetType === "portfolio" ? portfolioUid : assetUid);

      if (!targetUid) {
        throw new Error(
          `Target ${row.assetName ?? row.uniqueIdentifier ?? row.assetId} is missing a target uid.`,
        );
      }

      if (targetType === "portfolio" && row.positionType === "units") {
        throw new Error("Portfolio target allocations cannot use single asset quantity.");
      }

      const basePosition = (() => {
        if (targetType === "portfolio") {
          const resolvedPortfolioUid = portfolioUid || targetUid;

          if (!resolvedPortfolioUid) {
            throw new Error(
              `Portfolio ${row.assetName ?? row.uniqueIdentifier ?? row.assetId} is missing a portfolio uid.`,
            );
          }

          return {
            target_type: "portfolio" as const,
            target_uid: targetUid,
            portfolio_uid: resolvedPortfolioUid,
            metadata_json: row.targetMetadata ?? {},
          };
        }

        const resolvedAssetUid = assetUid || targetUid;

        if (!resolvedAssetUid) {
          throw new Error(
            `Asset ${row.assetName ?? row.uniqueIdentifier ?? row.assetId} is missing an asset uid.`,
          );
        }

        return {
          target_type: "asset" as const,
          target_uid: targetUid,
          asset_uid: resolvedAssetUid,
          metadata_json: row.targetMetadata ?? {},
        };
      })();

      if (row.positionType === "weight_notional_exposure") {
        return {
          ...basePosition,
          weight_notional_exposure: String(row.positionValue),
        };
      }

      if (row.positionType === "constant_notional") {
        return {
          ...basePosition,
          constant_notional_exposure: String(row.positionValue),
        };
      }

      if (row.positionType === "units") {
        if (basePosition.target_type !== "asset") {
          throw new Error("Portfolio target allocations cannot use single asset quantity.");
        }

        return {
          ...basePosition,
          single_asset_quantity: String(row.positionValue),
        };
      }

      throw new Error(
        `Target ${row.assetName ?? row.assetId} has an unsupported position type: ${row.positionType}.`,
      );
    }),
  };
}

export function PositionDetailWidget({
  instanceId,
  props,
  runtimeState,
  editable = false,
  onPropsChange,
}: Props) {
  const executionState = useWidgetExecutionState(instanceId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const widgetPreviewMode = isWidgetPreviewMode();
  const sourceType = normalizePositionDetailSourceType(props);
  const targetPortfolioUid = normalizePositionDetailTargetUid(props);
  const accountUid = normalizePositionDetailAccountUid(props);
  const variant: PositionDetailTableVariant =
    props.editableInPlace === true || sourceType !== "portfolio"
      ? "positions"
      : normalizePositionDetailVariant(props.variant);
  const tableMinWidth =
    typeof props.tableMinWidth === "number" ? props.tableMinWidth : variant === "summary" ? 680 : 760;
  const normalizedRuntimeState = normalizePositionDetailRuntimeState(runtimeState);
  const [optimisticAccountPayload, setOptimisticAccountPayload] = useState<
    TargetPositionDetailPositionDetailsResponse | undefined
  >(undefined);
  const payload = optimisticAccountPayload ?? normalizedRuntimeState.payload;
  const backendAuthoritativeSource =
    sourceType === "account" || sourceType === "target_positions_account";
  const persistedRows = normalizePositionDetailPersistedRows(props);
  const hydratedRows = hydratePositionDetailRowsFromPayload(payload, sourceType);
  const [inlineDraftRows, setInlineDraftRows] = useState<PositionDetailInlineRow[] | null>(null);
  const usingLocalDraftRows = backendAuthoritativeSource && inlineDraftRows !== null;
  const usingPersistedRows = !backendAuthoritativeSource && persistedRows.length > 0;
  const effectiveRows = backendAuthoritativeSource
    ? (inlineDraftRows ?? hydratedRows)
    : usingPersistedRows
      ? persistedRows
      : hydratedRows;
  const hasRuntimePayload = Boolean(payload);
  const accountHoldingsDateSource = props.holdingsDate ?? payload?.weights_date;
  const resolvedAccountHoldingsDate =
    sourceType === "account" && accountHoldingsDateSource
      ? normalizePositionDetailHoldingsDate(accountHoldingsDateSource)
      : undefined;
  const targetPositionsDateSource = props.targetPositionsDate ?? payload?.weights_date;
  const resolvedTargetPositionsDate =
    sourceType === "target_positions_account" && targetPositionsDateSource
      ? normalizePositionDetailTargetPositionsDate(targetPositionsDateSource)
      : undefined;
  const allowedPositionTypes = getAllowedPositionDetailPositionTypes(sourceType);
  const inlineEditingAvailable =
    props.editableInPlace === true && editable && typeof onPropsChange === "function";
  const supportsExplicitEditToggle = sourceType === "portfolio" || sourceType === "account";
  const alwaysInlineAuthoringSource =
    sourceType === "target_position" || sourceType === "target_positions_account";
  const [inlineEditMode, setInlineEditMode] = useState(
    inlineEditingAvailable && alwaysInlineAuthoringSource,
  );
  const [accountHoldingsView, setAccountHoldingsView] =
    useState<AccountHoldingsView>("holdings");
  const [accountEditDate, setAccountEditDate] = useState(getCurrentIsoTimestamp());
  const [targetPositionsEditDate, setTargetPositionsEditDate] = useState(getCurrentIsoTimestamp());
  const canHydrateFromBackend =
    (sourceType === "portfolio" && Boolean(targetPortfolioUid)) ||
    ((sourceType === "account" || sourceType === "target_positions_account") &&
      Boolean(accountUid));
  const hasLocalRows = usingPersistedRows || usingLocalDraftRows;
  const isLoading =
    (!hasLocalRows &&
      !hasRuntimePayload &&
      normalizedRuntimeState.status === "loading") ||
    (canHydrateFromBackend &&
      !hasLocalRows &&
      executionState?.status === "running") ||
    (canHydrateFromBackend &&
      !hasLocalRows &&
      normalizedRuntimeState.status === "loading") ||
    (canHydrateFromBackend &&
      !hasLocalRows &&
      !payload &&
      Boolean(instanceId) &&
      normalizedRuntimeState.status !== "error");

  useEffect(() => {
    setOptimisticAccountPayload(undefined);
  }, [accountUid, normalizedRuntimeState.payload, sourceType]);

  useEffect(() => {
    if (sourceType !== "account" || inlineEditMode) {
      setAccountHoldingsView("holdings");
    }
  }, [inlineEditMode, sourceType]);

  useEffect(() => {
    if (!backendAuthoritativeSource) {
      setInlineDraftRows(null);
      return;
    }

    if (!inlineEditMode) {
      setInlineDraftRows(null);
    }
  }, [backendAuthoritativeSource, inlineEditMode, accountUid, sourceType]);

  useEffect(() => {
    if (!inlineEditingAvailable) {
      setInlineEditMode(false);
      return;
    }

    if (alwaysInlineAuthoringSource) {
      setInlineEditMode(true);
    }
  }, [alwaysInlineAuthoringSource, inlineEditingAvailable]);

  useEffect(() => {
    if (!inlineEditMode || sourceType !== "account") {
      return;
    }

    setAccountEditDate(resolvedAccountHoldingsDate ?? getCurrentIsoTimestamp());
  }, [inlineEditMode, resolvedAccountHoldingsDate, sourceType]);

  useEffect(() => {
    if (!inlineEditMode || sourceType !== "target_positions_account") {
      return;
    }

    setTargetPositionsEditDate(resolvedTargetPositionsDate ?? getCurrentIsoTimestamp());
  }, [inlineEditMode, resolvedTargetPositionsDate, sourceType]);

  const holdingsByFundQuery = useQuery({
    queryKey: [
      "main_sequence",
      "managed_accounts",
      "holdings_by_fund",
      accountUid,
      resolvedAccountHoldingsDate ?? null,
    ],
    queryFn: () =>
      fetchManagedAccountHoldingsByFundPositionDetails(accountUid, {
        holdingsDate: resolvedAccountHoldingsDate,
        order: "desc",
        includeAssetDetail: true,
      }),
    enabled:
      sourceType === "account" &&
      Boolean(accountUid) &&
      accountHoldingsView === "by_fund" &&
      !inlineEditMode,
    staleTime: 60_000,
  });

  const saveHoldingsMutation = useMutation({
    mutationFn: async () => {
      if (widgetPreviewMode) {
        throw new Error("Saving holdings is not available from widget preview mode.");
      }

      if (sourceType !== "account" || !accountUid) {
        throw new Error("A valid account uid is required to save holdings.");
      }

      const normalizedHoldingsDate = normalizePositionDetailHoldingsDate(accountEditDate);

      return saveManagedAccountHoldings(
        accountUid,
        buildManagedAccountHoldingsPayload(effectiveRows, normalizedHoldingsDate),
      );
    },
    onSuccess: async (nextPayload) => {
      if (sourceType !== "account" || !accountUid) {
        return;
      }

      const nextHoldingsDate = normalizePositionDetailHoldingsDate(
        nextPayload.weights_date ?? accountEditDate,
      );

      setOptimisticAccountPayload(nextPayload);
      setInlineDraftRows(null);
      setAccountEditDate(nextHoldingsDate);
      setInlineEditMode(false);
      onPropsChange?.({
        ...props,
        sourceType,
        holdingsDate: nextHoldingsDate,
        variant: "positions",
        positionRows: [],
      });

      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "managed_accounts", "holdings", accountUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "managed_accounts", "holdings_by_fund", accountUid],
      });

      toast({
        variant: "success",
        title: "Holdings saved",
        description: "The account holdings snapshot was overwritten successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Holdings save failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const saveTargetPositionsMutation = useMutation({
    mutationFn: async () => {
      if (widgetPreviewMode) {
        throw new Error("Saving target allocations is not available from widget preview mode.");
      }

      if (sourceType !== "target_positions_account" || !accountUid) {
        throw new Error("A valid account uid is required to save target allocations.");
      }

      const normalizedTargetPositionsDate = normalizePositionDetailTargetPositionsDate(
        targetPositionsEditDate,
      );

      return saveManagedAccountTargetPositions(
        accountUid,
        buildManagedAccountTargetPositionsPayload(
          effectiveRows,
          normalizedTargetPositionsDate,
        ),
      );
    },
    onSuccess: (nextPayload) => {
      if (sourceType !== "target_positions_account") {
        return;
      }

      const nextTargetPositionsDate = normalizePositionDetailTargetPositionsDate(
        nextPayload.weights_date ?? targetPositionsEditDate,
      );

      setOptimisticAccountPayload(nextPayload);
      setInlineDraftRows(null);
      setTargetPositionsEditDate(nextTargetPositionsDate);
      onPropsChange?.({
        ...props,
        sourceType,
        accountUid,
        targetPositionsDate: nextTargetPositionsDate,
        variant: "positions",
        positionRows: [],
      });

      void queryClient.invalidateQueries({
        queryKey: ["main_sequence", "managed_accounts", "target_positions", accountUid],
      });

      toast({
        variant: "success",
        title: "Target allocations saved",
        description: "The account target allocation assignment was saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Target allocation save failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  if (sourceType === "portfolio" && !targetPortfolioUid && !hasLocalRows) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Set a valid portfolio UID to render this widget.
        </CardContent>
      </Card>
    );
  }

  if (
    sourceType === "account" &&
    !accountUid &&
    !hasLocalRows &&
    !hasRuntimePayload &&
    normalizedRuntimeState.status !== "loading" &&
    normalizedRuntimeState.status !== "error"
  ) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Set a valid account uid to render this widget.
        </CardContent>
      </Card>
    );
  }

  if (sourceType === "target_positions_account" && !accountUid) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Set a valid account uid to save target allocations for this widget.
        </CardContent>
      </Card>
    );
  }

  if (
    (sourceType === "target_position" || sourceType === "target_positions_account") &&
    effectiveRows.length === 0 &&
    props.editableInPlace !== true
  ) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Add positions directly on the canvas for this {sourceType.replace(/_/g, " ")} source.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          {sourceType === "account"
            ? "Loading account holdings"
            : sourceType === "target_positions_account"
              ? "Loading account target allocations"
              : "Loading position details"}
        </CardContent>
      </Card>
    );
  }

  if (normalizedRuntimeState.status === "error") {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formatMainSequenceError(normalizedRuntimeState.error)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (inlineEditingAvailable && (alwaysInlineAuthoringSource || inlineEditMode)) {
    return (
      <div className="space-y-3">
        {supportsExplicitEditToggle || sourceType === "target_positions_account" ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            {sourceType === "account" ? (
              <PositionDetailDateTimeField
                label="Holdings Date"
                value={accountEditDate}
                editable
                onChange={setAccountEditDate}
              />
            ) : sourceType === "target_positions_account" ? (
              <PositionDetailDateTimeField
                label="Target Allocation Date"
                value={targetPositionsEditDate}
                editable
                onChange={setTargetPositionsEditDate}
              />
            ) : (
              <div />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {sourceType === "account" && !widgetPreviewMode ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void saveHoldingsMutation.mutateAsync();
                  }}
                  disabled={saveHoldingsMutation.isPending || effectiveRows.length === 0}
                >
                  {saveHoldingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Save holdings
                </Button>
              ) : null}
              {sourceType === "target_positions_account" && !widgetPreviewMode ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void saveTargetPositionsMutation.mutateAsync();
                  }}
                  disabled={saveTargetPositionsMutation.isPending || effectiveRows.length === 0}
                >
                  {saveTargetPositionsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Save target allocation
                </Button>
              ) : null}
              {supportsExplicitEditToggle ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInlineDraftRows(null);
                    setAccountEditDate(resolvedAccountHoldingsDate ?? getCurrentIsoTimestamp());
                    setInlineEditMode(false);
                  }}
                >
                  Done editing
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <PositionDetailInlineEditor
          rows={effectiveRows}
          sourceType={sourceType}
          allowedPositionTypes={allowedPositionTypes}
          editable={editable}
          holdingsDate={
            sourceType === "account"
              ? accountEditDate
              : sourceType === "target_positions_account"
                ? targetPositionsEditDate
                : undefined
          }
          onRowsChange={
            onPropsChange
              ? (nextRows) => {
                  if (backendAuthoritativeSource) {
                    setInlineDraftRows(nextRows);
                    return;
                  }

                  onPropsChange({
                    ...props,
                    sourceType,
                    holdingsDate: props.holdingsDate,
                    targetPositionsDate: props.targetPositionsDate,
                    variant: "positions",
                    positionRows: nextRows,
                  });
                }
              : undefined
          }
        />
      </div>
    );
  }

  const rows =
    variant === "summary" && !usingPersistedRows
      ? normalizePositionDetailSummaryRows(payload?.weights ?? null)
      : hasLocalRows
        ? effectiveRows.map((row) => ({
            asset_id: row.assetId,
            ...(row.assetUid ? { asset_uid: row.assetUid } : {}),
            ...(row.targetType ? { target_type: row.targetType } : {}),
            ...(row.targetUid ? { target_uid: row.targetUid } : {}),
            ...(row.portfolioUid ? { portfolio_uid: row.portfolioUid } : {}),
            ...(row.targetMetadata ? { target_metadata: row.targetMetadata } : {}),
            asset_name: row.assetName ?? `Asset ${row.assetId}`,
            asset_ticker: row.assetTicker ?? null,
            unique_identifier: row.uniqueIdentifier ?? null,
            figi: row.figi ?? row.uniqueIdentifier ?? null,
            ...(
              row.date
                ? { date: row.date }
                : sourceType === "account" && resolvedAccountHoldingsDate
                  ? { date: resolvedAccountHoldingsDate }
                  : {}
            ),
            ...(row.price !== null && row.price !== undefined ? { price: row.price } : {}),
            ...(sourceType === "account" ? {} : { position_type: row.positionType }),
            position_value: row.positionValue,
            ...(sourceType === "target_positions_account"
              ? {
                  weight_notional_exposure:
                    row.positionType === "weight_notional_exposure" ? row.positionValue : null,
                  constant_notional_exposure:
                    row.positionType === "constant_notional" ? row.positionValue : null,
                  single_asset_quantity: row.positionType === "units" ? row.positionValue : null,
                }
              : {}),
          }))
        : payload?.rows ?? [];
  const columnDefs =
    variant === "summary" && !usingPersistedRows
      ? payload?.summaryColumnDefs ?? []
      : payload?.columnDefs ?? [];

  return (
    <div className="space-y-3">
      {sourceType === "account" && resolvedAccountHoldingsDate ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PositionDetailDateTimeField
            label="Holdings Date"
            value={resolvedAccountHoldingsDate}
            editable={false}
          />
          {inlineEditingAvailable && supportsExplicitEditToggle ? (
            <div />
          ) : null}
        </div>
      ) : null}
      {sourceType === "target_positions_account" && resolvedTargetPositionsDate ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PositionDetailDateTimeField
            label="Target Allocation Date"
            value={resolvedTargetPositionsDate}
            editable={false}
          />
        </div>
      ) : null}
      {inlineEditingAvailable && supportsExplicitEditToggle ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setInlineDraftRows(hydratedRows);
              setAccountEditDate(resolvedAccountHoldingsDate ?? getCurrentIsoTimestamp());
              setInlineEditMode(true);
            }}
          >
            <PencilLine className="h-4 w-4" />
            Edit positions
          </Button>
        </div>
      ) : null}
      {sourceType === "account" && accountUid ? (
        <PositionDetailAccountHoldingsTabs
          value={accountHoldingsView}
          onChange={setAccountHoldingsView}
        />
      ) : null}
      {sourceType === "account" && accountUid && accountHoldingsView === "by_fund" ? (
        <PositionDetailAccountHoldingsByFundView
          data={holdingsByFundQuery.data}
          error={holdingsByFundQuery.error}
          isLoading={holdingsByFundQuery.isLoading}
          tableMinWidth={tableMinWidth}
        />
      ) : (
        <>
          {variant === "positions" && rows.length > 0 && sourceType !== "account" ? (
            <PositionDetailPositionSummaryStrip rows={rows} />
          ) : null}
          <PositionDetailTable
            columnDefs={columnDefs}
            rows={rows}
            sourceType={sourceType}
            holdingsDate={resolvedAccountHoldingsDate}
            expandableAssetRows={variant === "summary"}
            positionMap={payload?.position_map ?? null}
            preferredPositionColumns={variant === "positions"}
            emptyMessage={
              variant === "summary"
                ? "No summary weight rows were returned."
                : "No position rows were returned."
            }
            emptyTitle={variant === "summary" ? "No summary rows" : "No position rows"}
            tableMinWidth={tableMinWidth}
          />
        </>
      )}
    </div>
  );
}
