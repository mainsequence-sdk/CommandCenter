import { Fragment, useDeferredValue, useMemo, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  fetchAssetDetail,
  formatMainSequenceError,
  listAssets,
  type AssetDetailResponse,
  type AssetListRow,
} from "../../../../common/api";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import {
  formatPositionDetailPositionTypeLabel,
  PositionDetailPositionSummaryStrip,
  PositionDetailTable,
} from "./PositionDetailTable";
import {
  buildPositionDetailInlineDisplayRows,
  getDefaultPositionDetailPositionType,
  normalizePositionDetailPositionRows,
  syntheticPositionDetailAssetIdBase,
  type PositionDetailCanonicalPositionType,
  type PositionDetailSourceType,
  type PositionDetailInlinePositionType,
  type PositionDetailInlineRow,
} from "./positionDetailRuntime";

const inlinePositionTypeOptions = [
  "weight_notional_exposure",
  "units",
  "constant_notional",
] as const satisfies readonly PositionDetailCanonicalPositionType[];
const minimumAssetSearchLength = 3;
const incompleteInlinePositionInputs = new Set(["", "-", ".", "-."]);

interface InlineEditorAssetSource {
  id?: number | null;
  uid?: string | null;
  unique_identifier?: string | null;
  figi?: string | null;
  name?: string | null;
  ticker?: string | null;
  current_snapshot?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readAssetNumericId(asset: InlineEditorAssetSource) {
  if (typeof asset.id !== "number" || !Number.isFinite(asset.id) || asset.id <= 0) {
    return null;
  }

  return Math.trunc(asset.id);
}

function readAssetSnapshot(asset: InlineEditorAssetSource) {
  return isRecord(asset.current_snapshot) ? asset.current_snapshot : null;
}

function readAssetUid(asset: InlineEditorAssetSource) {
  return readString(asset.uid);
}

function readAssetUniqueIdentifier(asset: InlineEditorAssetSource) {
  return readString(asset.unique_identifier);
}

function readAssetName(asset: InlineEditorAssetSource) {
  return readString(asset.name) ?? readString(readAssetSnapshot(asset)?.name);
}

function readAssetTicker(asset: InlineEditorAssetSource) {
  return readString(asset.ticker) ?? readString(readAssetSnapshot(asset)?.ticker);
}

function readAssetFigi(asset: InlineEditorAssetSource) {
  return readString(asset.figi) ?? readString(readAssetSnapshot(asset)?.figi);
}

function resolveAssetIdentity(asset: InlineEditorAssetSource) {
  const numericId = readAssetNumericId(asset);
  return (
    readAssetUid(asset) ??
    readAssetUniqueIdentifier(asset) ??
    (numericId !== null ? String(numericId) : "")
  );
}

function buildSyntheticAssetId(asset: InlineEditorAssetSource, index = 0) {
  const identity = resolveAssetIdentity(asset);
  let hash = 0;

  for (let position = 0; position < identity.length; position += 1) {
    hash = (hash * 31 + identity.charCodeAt(position)) % 999_999;
  }

  return syntheticPositionDetailAssetIdBase + hash + index + 1;
}

function isSyntheticInlineAssetId(assetId: number) {
  return assetId >= syntheticPositionDetailAssetIdBase;
}

function buildInlinePositionRowId(assetIdentity: string | number) {
  return `inline-position-${assetIdentity}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveAssetLabel(asset: InlineEditorAssetSource) {
  return (
    readAssetName(asset) ??
    readAssetTicker(asset) ??
    readAssetUniqueIdentifier(asset) ??
    readAssetUid(asset) ??
    "Asset pending identity"
  );
}

function resolveAssetDescription(asset: InlineEditorAssetSource) {
  return [
    readAssetTicker(asset),
    readAssetUniqueIdentifier(asset),
    readAssetUid(asset),
  ].filter(Boolean).join(" · ") || undefined;
}

function safeFormatInlinePositionJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildInlineExpandedPositionRecord(
  row: PositionDetailInlineRow,
  sourceType: PositionDetailSourceType,
) {
  if (sourceType === "target_positions_account") {
    return {
      ...(row.uniqueIdentifier ? { unique_identifier: row.uniqueIdentifier } : {}),
      ...(row.positionType === "weight_notional_exposure"
        ? { weight_notional_exposure: row.positionValue }
        : row.positionType === "constant_notional"
          ? { constant_notional_exposure: row.positionValue }
          : { single_asset_quantity: row.positionValue }),
      asset: {
        ...(row.assetUid ? { uid: row.assetUid } : {}),
        ...(!isSyntheticInlineAssetId(row.assetId) ? { id: row.assetId } : {}),
        name: row.assetName ?? null,
        ticker: row.assetTicker ?? null,
        uniqueIdentifier: row.uniqueIdentifier ?? null,
        figi: row.figi ?? null,
      },
    };
  }

  return {
    asset: {
      ...(row.assetUid ? { uid: row.assetUid } : {}),
      ...(!isSyntheticInlineAssetId(row.assetId) ? { id: row.assetId } : {}),
      name: row.assetName ?? null,
      ticker: row.assetTicker ?? null,
      uniqueIdentifier: row.uniqueIdentifier ?? null,
      figi: row.figi ?? null,
    },
    ...(sourceType === "portfolio" && row.date ? { date: row.date } : {}),
    ...(sourceType === "account" ? {} : { positionType: row.positionType }),
    positionValue: row.positionValue,
    ...(row.price !== null && row.price !== undefined ? { price: row.price } : {}),
  };
}

function formatInlinePositionValueInput(row: PositionDetailInlineRow) {
  if (row.positionType === "weight_notional_exposure") {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 20,
    }).format(row.positionValue * 100);
  }

  if (row.positionType === "constant_notional") {
    return new Intl.NumberFormat("en-US", {
      useGrouping: true,
      minimumFractionDigits: 0,
      maximumFractionDigits: 20,
    }).format(row.positionValue);
  }

  if (row.positionType === "units") {
    return new Intl.NumberFormat("en-US", {
      useGrouping: true,
      minimumFractionDigits: 0,
      maximumFractionDigits: 20,
    }).format(row.positionValue);
  }

  return String(row.positionValue);
}

function parseInlinePositionValueInput(
  value: string,
  positionType: PositionDetailInlinePositionType,
) {
  const normalizedValue = value.replace(/[$,%\s]/g, "").replace(/,/g, "");

  if (incompleteInlinePositionInputs.has(normalizedValue)) {
    return null;
  }

  const parsed = Number(normalizedValue);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (positionType === "weight_notional_exposure") {
    return parsed / 100;
  }

  return parsed;
}

export function PositionDetailInlineEditor({
  rows,
  sourceType,
  allowedPositionTypes,
  editable,
  holdingsDate: _holdingsDate,
  onRowsChange,
}: {
  rows: PositionDetailInlineRow[];
  sourceType: PositionDetailSourceType;
  allowedPositionTypes: readonly PositionDetailInlinePositionType[];
  editable: boolean;
  holdingsDate?: string;
  onRowsChange?: (rows: PositionDetailInlineRow[]) => void;
}) {
  const [assetSearchValue, setAssetSearchValue] = useState("");
  const [positionValueDrafts, setPositionValueDrafts] = useState<Record<string, string>>({});
  const deferredAssetSearchValue = useDeferredValue(assetSearchValue);
  const normalizedAssetSearchValue = deferredAssetSearchValue.trim();
  const canSearchAssets = normalizedAssetSearchValue.length >= minimumAssetSearchLength;
  const normalizedRows = useMemo(
    () => normalizePositionDetailPositionRows(rows, sourceType),
    [rows, sourceType],
  );
  const displayRows = useMemo(
    () => buildPositionDetailInlineDisplayRows(normalizedRows, sourceType),
    [normalizedRows, sourceType],
  );
  const selectedAssetIds = useMemo(
    () => new Set(normalizedRows.map((row) => row.assetId)),
    [normalizedRows],
  );
  const selectedAssetUids = useMemo(
    () =>
      new Set(
        normalizedRows
          .map((row) => row.assetUid?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    [normalizedRows],
  );
  const selectedAssetUniqueIdentifiers = useMemo(
    () =>
      new Set(
        normalizedRows
          .map((row) => row.uniqueIdentifier?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    [normalizedRows],
  );
  const hasUnitsRows = useMemo(
    () => normalizedRows.some((row) => row.positionType === "units"),
    [normalizedRows],
  );
  const hasMissingUnitPrices = useMemo(
    () =>
      normalizedRows.some(
        (row) => row.positionType === "units" && (row.price === null || row.price === undefined),
      ),
    [normalizedRows],
  );
  const canChoosePositionType = sourceType !== "account" && allowedPositionTypes.length > 1;
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  const showUidColumn = sourceType === "portfolio";
  const showRowDateColumn = sourceType === "portfolio";
  const showPositionTypeColumn = sourceType !== "account";
  const showExtraDetailsColumn = sourceType === "account";
  const showAssetIdentitySubline = sourceType !== "account";

  const assetSearchQuery = useQuery({
    queryKey: [
      "main_sequence",
      "assets",
      "position-detail-inline-search",
      normalizedAssetSearchValue,
    ],
    queryFn: () =>
      listAssets({
        search: normalizedAssetSearchValue,
        limit: 50,
        offset: 0,
      }),
    enabled: editable && typeof onRowsChange === "function" && canSearchAssets,
    staleTime: 60_000,
  });

  const assetSearchResults = canSearchAssets ? (assetSearchQuery.data?.results ?? []) : [];
  const assetOptions = useMemo<PickerOption[]>(
    () =>
      assetSearchResults
        .filter((asset) => {
          const assetUid = readAssetUid(asset);
          const assetUniqueIdentifier = readAssetUniqueIdentifier(asset);
          const assetNumericId = readAssetNumericId(asset);

          return (
            assetUid !== undefined &&
            !selectedAssetUids.has(assetUid) &&
            (!assetUniqueIdentifier || !selectedAssetUniqueIdentifiers.has(assetUniqueIdentifier)) &&
            (assetNumericId === null || !selectedAssetIds.has(assetNumericId))
          );
        })
        .map((asset) => ({
          value: readAssetUid(asset) ?? "",
          label: resolveAssetLabel(asset),
          description: resolveAssetDescription(asset),
          keywords: [
            asset.name ?? "",
            asset.ticker ?? "",
            asset.unique_identifier ?? "",
            asset.uid ?? "",
            asset.figi ?? "",
            String(readAssetNumericId(asset) ?? ""),
          ],
        })),
    [assetSearchResults, selectedAssetIds, selectedAssetUids, selectedAssetUniqueIdentifiers],
  );

  const addAssetMutation = useMutation({
    mutationFn: (assetUid: string) => fetchAssetDetail(assetUid),
    onSuccess: (assetDetail, assetUid) => {
      addAsset(assetDetail, assetUid);
    },
  });

  function commitRows(nextRows: PositionDetailInlineRow[]) {
    onRowsChange?.(nextRows);
  }

  function addAsset(asset: AssetDetailResponse | null, selectedAssetUid?: string) {
    if (!asset || !onRowsChange) {
      return;
    }

    const assetUid = readAssetUid(asset) ?? selectedAssetUid?.trim();
    const assetUniqueIdentifier = readAssetUniqueIdentifier(asset);
    const assetNumericId = readAssetNumericId(asset);

    if (
      (assetUid && selectedAssetUids.has(assetUid)) ||
      (assetUniqueIdentifier && selectedAssetUniqueIdentifiers.has(assetUniqueIdentifier)) ||
      (assetNumericId !== null && selectedAssetIds.has(assetNumericId))
    ) {
      return;
    }

    const assetId = assetNumericId ?? buildSyntheticAssetId(asset, normalizedRows.length);
    const assetIdentity = assetUid ?? assetUniqueIdentifier ?? String(assetId);
    const assetName = readAssetName(asset) ?? readAssetTicker(asset) ?? assetUniqueIdentifier ?? assetUid;

    commitRows([
      ...normalizedRows,
      {
        rowId: buildInlinePositionRowId(assetIdentity),
        assetId,
        assetUid,
        assetName,
        assetTicker: readAssetTicker(asset),
        uniqueIdentifier: assetUniqueIdentifier,
        figi: readAssetFigi(asset),
        ...(showRowDateColumn
          ? {
              date: new Date().toISOString().slice(0, 10),
            }
          : {}),
        price: null,
        positionType: getDefaultPositionDetailPositionType(sourceType),
        positionValue: 0,
      },
    ]);
    setAssetSearchValue("");
  }

  function updateRow(rowId: string, patch: Partial<PositionDetailInlineRow>) {
    commitRows(
      normalizedRows.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  }

  function removeRow(rowId: string) {
    commitRows(normalizedRows.filter((row) => row.rowId !== rowId));
    setExpandedRowIds((current) => current.filter((entry) => entry !== rowId));
    setPositionValueDrafts((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }

  function toggleExpandedRow(rowId: string) {
    setExpandedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((entry) => entry !== rowId)
        : [...current, rowId],
    );
  }

  if (!editable || !onRowsChange) {
    return (
      <div className="space-y-0">
        {sourceType !== "account" && displayRows.length > 0 ? (
          <PositionDetailPositionSummaryStrip rows={displayRows} />
        ) : null}
        <PositionDetailTable
          columnDefs={[]}
          rows={displayRows}
          sourceType={sourceType}
          preferredPositionColumns
          emptyTitle="No inline positions"
          emptyMessage="No inline positions have been configured for this widget."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/60 p-3">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Add Asset
          </div>
          <PickerField
            value=""
            onChange={(value) => {
              if (!value || addAssetMutation.isPending) {
                return;
              }

              addAssetMutation.mutate(value);
            }}
            options={assetOptions}
            placeholder="Search assets"
            searchPlaceholder="Search assets"
            searchable
            emptyMessage={
              canSearchAssets
                ? "No matching assets."
                : `Type at least ${minimumAssetSearchLength} characters to search assets.`
            }
            loading={assetSearchQuery.isLoading || addAssetMutation.isPending}
            searchValue={assetSearchValue}
            onSearchValueChange={setAssetSearchValue}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Type at least {minimumAssetSearchLength} characters, then select an asset to add a new row directly on the canvas.
        </div>
        {addAssetMutation.isError ? (
          <div className="mt-3 rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {formatMainSequenceError(addAssetMutation.error)}
          </div>
        ) : null}
      </div>

      {sourceType !== "account" && hasUnitsRows ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {hasMissingUnitPrices
            ? "Units positions require a manual price in this editor because no live price feed is connected."
            : "Units positions are using manual prices in this editor because no live price feed is connected."}
        </div>
      ) : null}

      {sourceType !== "account" && displayRows.length > 0 ? (
        <PositionDetailPositionSummaryStrip rows={displayRows} />
      ) : null}

      <div className="overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/70 bg-card/75">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left">
            <thead className="sticky top-0 z-[1] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/75">
              <tr>
                {[
                  "Asset Name",
                  "Asset Ticker",
                  ...(showUidColumn ? ["UID"] : []),
                  ...(showRowDateColumn ? ["Date"] : []),
                  ...(showPositionTypeColumn ? ["Position Type"] : []),
                  sourceType === "account" ? "Quantity" : "Position Value",
                  ...(showExtraDetailsColumn ? ["Extra Details"] : []),
                  "",
                ].map((label) => (
                  <th
                    key={label || "actions"}
                    className="border-b border-border/70 px-3 py-[var(--table-compact-header-padding-y)] text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalizedRows.length > 0 ? (
                normalizedRows.map((row) => {
                  const expanded = expandedRowIds.includes(row.rowId);

                  return (
                    <Fragment key={row.rowId}>
                      <tr className="border-b border-border/50">
                        <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                          <div className="flex min-w-0 items-start gap-2">
                            <button
                              type="button"
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/60 hover:text-foreground"
                              aria-label={expanded ? "Collapse position row" : "Expand position row"}
                              onClick={() => toggleExpandedRow(row.rowId)}
                            >
                              {expanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-foreground">
                                {row.assetName ||
                                  row.uniqueIdentifier ||
                                  row.assetUid ||
                                  (isSyntheticInlineAssetId(row.assetId)
                                    ? "Asset pending identity"
                                    : `Asset ${row.assetId}`)}
                              </div>
                              {showAssetIdentitySubline ? (
                                <div className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
                                  {row.figi ||
                                    row.uniqueIdentifier ||
                                    row.assetUid ||
                                    (!isSyntheticInlineAssetId(row.assetId)
                                      ? `ID ${row.assetId}`
                                      : "Identity pending")}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                          <div className="font-mono text-sm text-foreground">
                            {row.assetTicker || "Not available"}
                          </div>
                        </td>
                        {showUidColumn ? (
                          <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                            <div className="font-mono text-sm text-foreground">
                              {row.uniqueIdentifier || "Not available"}
                            </div>
                          </td>
                        ) : null}
                        {showRowDateColumn ? (
                          <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                            <Input
                              type="date"
                              value={row.date}
                              onChange={(event) => {
                                updateRow(row.rowId, {
                                  date: event.target.value,
                                });
                              }}
                            />
                          </td>
                        ) : null}
                        {showPositionTypeColumn ? (
                          <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                            {canChoosePositionType ? (
                              <select
                                value={row.positionType}
                                className="flex h-10 w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring/30"
                                onChange={(event) => {
                                  updateRow(row.rowId, {
                                    positionType: event.target.value as PositionDetailInlinePositionType,
                                  });
                                  setPositionValueDrafts((current) => {
                                    const next = { ...current };
                                    delete next[row.rowId];
                                    return next;
                                  });
                                }}
                              >
                                {inlinePositionTypeOptions
                                  .filter((option) => allowedPositionTypes.includes(option))
                                  .map((option) => (
                                    <option key={option} value={option}>
                                      {formatPositionDetailPositionTypeLabel(option)}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <div className="flex h-10 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/50 px-3 text-sm text-foreground">
                                {formatPositionDetailPositionTypeLabel(row.positionType)}
                              </div>
                            )}
                          </td>
                        ) : null}
                        <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                          <div className="relative">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={positionValueDrafts[row.rowId] ?? formatInlinePositionValueInput(row)}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                const parsedValue = parseInlinePositionValueInput(
                                  nextValue,
                                  row.positionType,
                                );

                                setPositionValueDrafts((current) => ({
                                  ...current,
                                  [row.rowId]: nextValue,
                                }));

                                if (parsedValue === null) {
                                  return;
                                }

                                updateRow(row.rowId, {
                                  positionValue: parsedValue,
                                });
                              }}
                              onBlur={() => {
                                setPositionValueDrafts((current) => {
                                  const next = { ...current };
                                  delete next[row.rowId];
                                  return next;
                                });
                              }}
                              className={
                                row.positionType === "weight_notional_exposure" && sourceType !== "account"
                                  ? "pr-9"
                                  : undefined
                              }
                            />
                            {row.positionType === "weight_notional_exposure" && sourceType !== "account" ? (
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                %
                              </span>
                            ) : null}
                          </div>
                        </td>
                        {showExtraDetailsColumn ? (
                          <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                            <div className="flex h-10 items-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/40 px-3 text-sm text-muted-foreground">
                              This can only be filled with the API
                            </div>
                          </td>
                        ) : null}
                        <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${row.assetName || `asset ${row.assetId}`}`}
                              onClick={() => removeRow(row.rowId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-background/45">
                          <td
                            colSpan={
                              2 +
                              (showUidColumn ? 1 : 0) +
                              (showRowDateColumn ? 1 : 0) +
                              (showPositionTypeColumn ? 1 : 0) +
                              (showExtraDetailsColumn ? 1 : 0) +
                              1 +
                              1
                            }
                            className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)]"
                          >
                            <div
                              className="min-w-0 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50"
                              style={{ marginLeft: "28px" }}
                            >
                              <div className="border-b border-border/60 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                Position Details
                              </div>
                              <pre className="overflow-x-auto px-3 py-3 font-mono text-[12px] leading-5 text-foreground whitespace-pre-wrap break-words">
                                {safeFormatInlinePositionJson(buildInlineExpandedPositionRecord(row, sourceType))}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={
                      2 +
                      (showUidColumn ? 1 : 0) +
                      (showRowDateColumn ? 1 : 0) +
                      (showPositionTypeColumn ? 1 : 0) +
                      (showExtraDetailsColumn ? 1 : 0) +
                      1 +
                      1
                    }
                    className="px-4 py-10"
                  >
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      {assetSearchQuery.isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <div className="text-sm text-muted-foreground">Loading asset search</div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-foreground">No inline positions</div>
                          <div className="max-w-[420px] text-sm text-muted-foreground">
                            Search for an asset above and add it to start building inline positions.
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
