import { useEffect, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";
import { useWidgetExecutionState } from "@/dashboards/DashboardWidgetExecution";
import { isWidgetPreviewMode } from "@/features/widgets/widget-explorer";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  formatMainSequenceError,
  saveManagedAccountHoldings,
  type TargetPortfolioWeightsPositionDetailsResponse,
} from "../../../../common/api";
import {
  normalizePortfolioWeightSummaryRows,
  PortfolioWeightsPositionSummaryStrip,
  PortfolioWeightsTable,
  type PortfolioWeightsTableVariant,
} from "./PortfolioWeightsTable";
import {
  getAllowedPortfolioWeightsPositionTypes,
  normalizePortfolioWeightsAccountId,
  hydratePortfolioWeightsRowsFromPayload,
  normalizePortfolioWeightsHoldingsDate,
  normalizePortfolioWeightsPersistedRows,
  normalizePortfolioWeightsRuntimeState,
  normalizePortfolioWeightsSourceType,
  normalizePortfolioWeightsTargetId,
  normalizePortfolioWeightsVariant,
  type PortfolioWeightsWidgetProps,
} from "./portfolioWeightsRuntime";
import { PortfolioWeightsInlineEditor } from "./PortfolioWeightsInlineEditor";

type Props = WidgetComponentProps<PortfolioWeightsWidgetProps>;

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

function buildManagedAccountHoldingsPayload(
  rows: ReturnType<typeof normalizePortfolioWeightsPersistedRows>,
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

      const positionType = row.positionType.trim();
      if (!positionType) {
        throw new Error(`Asset ${row.assetName ?? row.assetId} is missing a position type.`);
      }

      const missingPrice = row.price === null || row.price === undefined || !Number.isFinite(row.price);
      const price = missingPrice ? "0" : String(row.price);

      return {
        unique_identifier: uniqueIdentifier,
        asset_id: row.assetId,
        position_type: positionType,
        price,
        quantity: String(row.positionValue),
        missing_price: missingPrice,
        target_trade_time: holdingsDate,
        extra_details: {},
      };
    }),
  };
}

export function PortfolioWeightsWidget({
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
  const sourceType = normalizePortfolioWeightsSourceType(props);
  const targetPortfolioId = normalizePortfolioWeightsTargetId(props);
  const accountId = normalizePortfolioWeightsAccountId(props);
  const variant: PortfolioWeightsTableVariant =
    props.editableInPlace === true || sourceType !== "portfolio"
      ? "positions"
      : normalizePortfolioWeightsVariant(props.variant);
  const tableMinWidth =
    typeof props.tableMinWidth === "number" ? props.tableMinWidth : variant === "summary" ? 680 : 760;
  const normalizedRuntimeState = normalizePortfolioWeightsRuntimeState(runtimeState);
  const [optimisticAccountPayload, setOptimisticAccountPayload] = useState<
    TargetPortfolioWeightsPositionDetailsResponse | undefined
  >(undefined);
  const payload = optimisticAccountPayload ?? normalizedRuntimeState.payload;
  const persistedRows = normalizePortfolioWeightsPersistedRows(props);
  const hydratedRows = hydratePortfolioWeightsRowsFromPayload(payload, sourceType);
  const effectiveRows = persistedRows.length > 0 ? persistedRows : hydratedRows;
  const resolvedAccountHoldingsDate =
    sourceType === "account"
      ? normalizePortfolioWeightsHoldingsDate(props.holdingsDate ?? payload?.weights_date)
      : undefined;
  const allowedPositionTypes = getAllowedPortfolioWeightsPositionTypes(sourceType);
  const inlineEditingAvailable =
    props.editableInPlace === true && editable && typeof onPropsChange === "function";
  const supportsExplicitEditToggle = sourceType === "portfolio" || sourceType === "account";
  const [inlineEditMode, setInlineEditMode] = useState(
    inlineEditingAvailable && sourceType === "target_position",
  );
  const [accountEditDate, setAccountEditDate] = useState(getCurrentIsoTimestamp());
  const canHydrateFromBackend =
    (sourceType === "portfolio" && targetPortfolioId > 0) ||
    (sourceType === "account" && accountId > 0);
  const isLoading =
    (canHydrateFromBackend &&
      persistedRows.length === 0 &&
      executionState?.status === "running") ||
    (canHydrateFromBackend &&
      persistedRows.length === 0 &&
      normalizedRuntimeState.status === "loading") ||
    (canHydrateFromBackend &&
      persistedRows.length === 0 &&
      !payload &&
      Boolean(instanceId) &&
      normalizedRuntimeState.status !== "error");

  useEffect(() => {
    setOptimisticAccountPayload(undefined);
  }, [accountId, normalizedRuntimeState.payload, sourceType]);

  useEffect(() => {
    if (!inlineEditingAvailable) {
      setInlineEditMode(false);
      return;
    }

    if (sourceType === "target_position") {
      setInlineEditMode(true);
    }
  }, [inlineEditingAvailable, sourceType]);

  useEffect(() => {
    if (!inlineEditMode || sourceType !== "account") {
      return;
    }

    setAccountEditDate(resolvedAccountHoldingsDate ?? getCurrentIsoTimestamp());
  }, [inlineEditMode, resolvedAccountHoldingsDate, sourceType]);

  const saveHoldingsMutation = useMutation({
    mutationFn: async () => {
      if (widgetPreviewMode) {
        throw new Error("Saving holdings is not available from widget preview mode.");
      }

      if (sourceType !== "account" || accountId <= 0) {
        throw new Error("A valid account id is required to save holdings.");
      }

      const normalizedHoldingsDate = normalizePortfolioWeightsHoldingsDate(accountEditDate);

      return saveManagedAccountHoldings(
        accountId,
        buildManagedAccountHoldingsPayload(effectiveRows, normalizedHoldingsDate),
      );
    },
    onSuccess: async (nextPayload) => {
      if (sourceType !== "account" || accountId <= 0) {
        return;
      }

      const nextHoldingsDate = normalizePortfolioWeightsHoldingsDate(
        nextPayload.weights_date ?? accountEditDate,
      );

      setOptimisticAccountPayload(nextPayload);
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
        queryKey: ["main_sequence", "managed_accounts", "holdings", accountId],
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

  if (sourceType === "portfolio" && (!Number.isFinite(targetPortfolioId) || targetPortfolioId <= 0) && persistedRows.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Set a valid target portfolio id to render this widget.
        </CardContent>
      </Card>
    );
  }

  if (sourceType === "account" && accountId <= 0 && persistedRows.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Set a valid account id to render this widget.
        </CardContent>
      </Card>
    );
  }

  if (
    sourceType === "target_position" &&
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
          {sourceType === "account" ? "Loading account holdings" : "Loading portfolio weights"}
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

  if (inlineEditingAvailable && (sourceType === "target_position" || inlineEditMode)) {
    return (
      <div className="space-y-3">
        {supportsExplicitEditToggle ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            {sourceType === "account" ? (
              <label className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Holdings Date
                </div>
                <input
                  type="datetime-local"
                  step={60}
                  value={formatDateTimeLocalValue(accountEditDate)}
                  className="flex h-10 rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30"
                  onChange={(event) => {
                    const nextDate =
                      parseDateTimeLocalValue(event.target.value) ?? getCurrentIsoTimestamp();
                    setAccountEditDate(nextDate);
                    onPropsChange?.({
                      ...props,
                      sourceType,
                      holdingsDate: nextDate,
                      variant: "positions",
                      positionRows: effectiveRows,
                    });
                  }}
                />
              </label>
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setInlineEditMode(false)}
              >
                Done editing
              </Button>
            </div>
          </div>
        ) : null}
        <PortfolioWeightsInlineEditor
          rows={effectiveRows}
          sourceType={sourceType}
          allowedPositionTypes={allowedPositionTypes}
          editable={editable}
          holdingsDate={sourceType === "account" ? accountEditDate : undefined}
          onRowsChange={
            onPropsChange
              ? (nextRows) => {
                  onPropsChange({
                    ...props,
                    sourceType,
                    holdingsDate:
                      sourceType === "account" ? accountEditDate : props.holdingsDate,
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
    variant === "summary" && persistedRows.length === 0
      ? normalizePortfolioWeightSummaryRows(payload?.weights ?? null)
      : persistedRows.length > 0
        ? effectiveRows.map((row) => ({
            asset_id: row.assetId,
            asset_name: row.assetName ?? `Asset ${row.assetId}`,
            asset_ticker: row.assetTicker ?? null,
            unique_identifier: row.uniqueIdentifier ?? null,
            figi: row.figi ?? row.uniqueIdentifier ?? null,
            ...(row.date ? { date: row.date } : {}),
            price: row.price ?? null,
            position_type: row.positionType,
            position_value: row.positionValue,
          }))
        : payload?.rows ?? [];
  const columnDefs =
    variant === "summary" && persistedRows.length === 0
      ? payload?.summaryColumnDefs ?? []
      : payload?.columnDefs ?? [];

  return (
    <div className="space-y-3">
      {inlineEditingAvailable && supportsExplicitEditToggle ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setInlineEditMode(true)}
          >
            <PencilLine className="h-4 w-4" />
            Edit positions
          </Button>
        </div>
      ) : null}
      {variant === "positions" && rows.length > 0 && sourceType !== "account" ? (
        <PortfolioWeightsPositionSummaryStrip rows={rows} />
      ) : null}
      <PortfolioWeightsTable
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
    </div>
  );
}
