import { Fragment, useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  listAssets,
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

function buildInlinePositionRowId(assetId: number) {
  return `inline-position-${assetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveAssetLabel(asset: AssetListRow) {
  return asset.name?.trim() || asset.ticker?.trim() || asset.unique_identifier?.trim() || `Asset ${asset.id}`;
}

function resolveAssetDescription(asset: AssetListRow) {
  return [asset.ticker?.trim(), asset.unique_identifier?.trim()].filter(Boolean).join(" · ") || undefined;
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
  return {
    asset: {
      id: row.assetId,
      name: row.assetName ?? null,
      ticker: row.assetTicker ?? null,
      uniqueIdentifier: row.uniqueIdentifier ?? null,
      figi: row.figi ?? null,
    },
    ...(row.date ? { date: row.date } : {}),
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
  const parsed = Number(normalizedValue);

  if (!Number.isFinite(parsed)) {
    return 0;
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
  const deferredAssetSearchValue = useDeferredValue(assetSearchValue);
  const normalizedAssetSearchValue = deferredAssetSearchValue.trim();
  const canSearchAssets = normalizedAssetSearchValue.length >= minimumAssetSearchLength;
  const displayRows = useMemo(
    () => buildPositionDetailInlineDisplayRows(rows, sourceType),
    [rows, sourceType],
  );
  const selectedAssetIds = useMemo(() => new Set(rows.map((row) => row.assetId)), [rows]);
  const hasUnitsRows = useMemo(
    () => rows.some((row) => row.positionType === "units"),
    [rows],
  );
  const hasMissingUnitPrices = useMemo(
    () =>
      rows.some(
        (row) => row.positionType === "units" && (row.price === null || row.price === undefined),
      ),
    [rows],
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
        .filter((asset) => !selectedAssetIds.has(asset.id))
        .map((asset) => ({
          value: String(asset.id),
          label: resolveAssetLabel(asset),
          description: resolveAssetDescription(asset),
          keywords: [
            asset.name ?? "",
            asset.ticker ?? "",
            asset.unique_identifier ?? "",
            asset.figi ?? "",
            String(asset.id),
          ],
        })),
    [assetSearchResults, selectedAssetIds],
  );

  function commitRows(nextRows: PositionDetailInlineRow[]) {
    onRowsChange?.(nextRows);
  }

  function addAsset(asset: AssetListRow | null) {
    if (!asset || !onRowsChange) {
      return;
    }

    if (selectedAssetIds.has(asset.id)) {
      return;
    }

    commitRows([
      ...rows,
      {
        rowId: buildInlinePositionRowId(asset.id),
        assetId: asset.id,
        assetName: asset.name?.trim() || undefined,
        assetTicker: asset.ticker?.trim() || undefined,
        uniqueIdentifier: asset.unique_identifier?.trim() || undefined,
        figi: asset.figi?.trim() || undefined,
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
      rows.map((row) =>
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
    commitRows(rows.filter((row) => row.rowId !== rowId));
    setExpandedRowIds((current) => current.filter((entry) => entry !== rowId));
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
              const matchedAsset = assetSearchResults.find((asset) => String(asset.id) === value) ?? null;
              addAsset(matchedAsset);
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
            loading={assetSearchQuery.isLoading}
            searchValue={assetSearchValue}
            onSearchValueChange={setAssetSearchValue}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Type at least {minimumAssetSearchLength} characters, then select an asset to add a new row directly on the canvas.
        </div>
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
              {rows.length > 0 ? (
                rows.map((row) => {
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
                                {row.assetName || `Asset ${row.assetId}`}
                              </div>
                              {showAssetIdentitySubline ? (
                                <div className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
                                  {row.figi || `ID ${row.assetId}`}
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
                              value={formatInlinePositionValueInput(row)}
                              onChange={(event) => {
                                updateRow(row.rowId, {
                                  positionValue: parseInlinePositionValueInput(
                                    event.target.value,
                                    row.positionType,
                                  ),
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
