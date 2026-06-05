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
  saveManagedAccountTargetPositions,
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
        unique_identifier: uniqueIdentifier,
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

function buildManagedAccountTargetPositionsPayload(
  rows: ReturnType<typeof normalizePositionDetailPersistedRows>,
  targetPositionsDate: string,
) {
  if (rows.length === 0) {
    throw new Error("Add at least one target-position row before saving.");
  }

  return {
    target_positions_date: targetPositionsDate,
    overwrite: false,
    positions: rows.map((row) => {
      const uniqueIdentifier = row.uniqueIdentifier?.trim();
      if (!uniqueIdentifier) {
        throw new Error(`Asset ${row.assetName ?? row.assetId} is missing a unique identifier.`);
      }

      if (row.positionType === "weight_notional_exposure") {
        return {
          unique_identifier: uniqueIdentifier,
          weight_notional_exposure: String(row.positionValue),
        };
      }

      if (row.positionType === "constant_notional") {
        return {
          unique_identifier: uniqueIdentifier,
          constant_notional_exposure: String(row.positionValue),
        };
      }

      if (row.positionType === "units") {
        return {
          unique_identifier: uniqueIdentifier,
          single_asset_quantity: String(row.positionValue),
        };
      }

      throw new Error(
        `Asset ${row.assetName ?? row.assetId} has an unsupported position type: ${row.positionType}.`,
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
  const [accountEditDate, setAccountEditDate] = useState(getCurrentIsoTimestamp());
  const [targetPositionsEditDate, setTargetPositionsEditDate] = useState(getCurrentIsoTimestamp());
  const canHydrateFromBackend =
    (sourceType === "portfolio" && Boolean(targetPortfolioUid)) ||
    ((sourceType === "account" || sourceType === "target_positions_account") &&
      Boolean(accountUid));
  const hasLocalRows = usingPersistedRows || usingLocalDraftRows;
  const isLoading =
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
        throw new Error("Saving target positions is not available from widget preview mode.");
      }

      if (sourceType !== "target_positions_account" || !accountUid) {
        throw new Error("A valid account uid is required to save target positions.");
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
        title: "Target positions saved",
        description: "The account target-position assignment was saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Target positions save failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  if (sourceType === "portfolio" && !targetPortfolioUid && !hasLocalRows) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Set a valid target portfolio UID to render this widget.
        </CardContent>
      </Card>
    );
  }

  if (sourceType === "account" && !accountUid && !hasLocalRows) {
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
          Set a valid account uid to save target positions for this widget.
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
              ? "Loading account target positions"
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
                label="Target Positions Date"
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
                  Save target positions
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
            label="Target Positions Date"
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
    </div>
  );
}
