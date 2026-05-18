import { Fragment, useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import {
  listAssets,
  type AssetListRow,
} from "../../../../common/api";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import {
  formatPortfolioWeightPositionTypeLabel,
  PortfolioWeightsPositionSummaryStrip,
  PortfolioWeightsTable,
} from "./PortfolioWeightsTable";
import {
  buildPortfolioWeightsInlineDisplayRows,
  type PortfolioWeightsInlinePositionType,
  type PortfolioWeightsInlineRow,
} from "./portfolioWeightsRuntime";

const inlinePositionTypeOptions = [
  "weight_notional_exposure",
  "units",
  "constant_notional",
] as const satisfies readonly PortfolioWeightsInlinePositionType[];
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

function formatInlinePositionValueInput(row: PortfolioWeightsInlineRow) {
  if (row.positionType === "weight_notional_exposure") {
    return row.positionValue === 0 ? "0" : String(row.positionValue * 100);
  }

  return String(row.positionValue);
}

function parseInlinePositionValueInput(
  value: string,
  positionType: PortfolioWeightsInlinePositionType,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (positionType === "weight_notional_exposure") {
    return parsed / 100;
  }

  return parsed;
}

export function PortfolioWeightsInlineEditor({
  rows,
  editable,
  onRowsChange,
}: {
  rows: PortfolioWeightsInlineRow[];
  editable: boolean;
  onRowsChange?: (rows: PortfolioWeightsInlineRow[]) => void;
}) {
  const [assetSearchValue, setAssetSearchValue] = useState("");
  const deferredAssetSearchValue = useDeferredValue(assetSearchValue);
  const normalizedAssetSearchValue = deferredAssetSearchValue.trim();
  const canSearchAssets = normalizedAssetSearchValue.length >= minimumAssetSearchLength;
  const displayRows = useMemo(() => buildPortfolioWeightsInlineDisplayRows(rows), [rows]);
  const selectedAssetIds = useMemo(() => new Set(rows.map((row) => row.assetId)), [rows]);
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);

  const assetSearchQuery = useQuery({
    queryKey: [
      "main_sequence",
      "assets",
      "portfolio-weights-inline-search",
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

  function commitRows(nextRows: PortfolioWeightsInlineRow[]) {
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
        positionType: "weight_notional_exposure",
        positionValue: 0,
      },
    ]);
    setAssetSearchValue("");
  }

  function updateRow(rowId: string, patch: Partial<PortfolioWeightsInlineRow>) {
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
        {displayRows.length > 0 ? <PortfolioWeightsPositionSummaryStrip rows={displayRows} /> : null}
        <PortfolioWeightsTable
          columnDefs={[]}
          rows={displayRows}
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

      {displayRows.length > 0 ? <PortfolioWeightsPositionSummaryStrip rows={displayRows} /> : null}

      <div className="overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/70 bg-card/75">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead className="sticky top-0 z-[1] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/75">
              <tr>
                {["Asset Name", "Asset Ticker", "UID", "Position Type", "Position Value", ""].map((label) => (
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
                              <div className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
                                {row.figi || `ID ${row.assetId}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                          <div className="font-mono text-sm text-foreground">
                            {row.assetTicker || "Not available"}
                          </div>
                        </td>
                        <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                          <div className="font-mono text-sm text-foreground">
                            {row.uniqueIdentifier || "Not available"}
                          </div>
                        </td>
                        <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                          <Select
                            value={row.positionType}
                            onChange={(event) => {
                              updateRow(row.rowId, {
                                positionType: event.target.value as PortfolioWeightsInlinePositionType,
                              });
                            }}
                          >
                            {inlinePositionTypeOptions.map((option) => (
                              <option key={option} value={option}>
                                {formatPortfolioWeightPositionTypeLabel(option)}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top">
                          <div className="relative">
                            <Input
                              type="number"
                              step="any"
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
                                row.positionType === "weight_notional_exposure"
                                  ? "pr-9"
                                  : undefined
                              }
                            />
                            {row.positionType === "weight_notional_exposure" ? (
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                %
                              </span>
                            ) : null}
                          </div>
                        </td>
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
                            colSpan={6}
                            className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)]"
                          >
                            <div
                              className="min-w-0 overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50"
                              style={{ marginLeft: "28px" }}
                            >
                              <div className="border-b border-border/60 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                Position JSON
                              </div>
                              <pre className="overflow-x-auto px-3 py-3 font-mono text-[12px] leading-5 text-foreground whitespace-pre-wrap break-words">
                                {safeFormatInlinePositionJson({
                                  asset_id: row.assetId,
                                  asset_name: row.assetName ?? null,
                                  asset_ticker: row.assetTicker ?? null,
                                  unique_identifier: row.uniqueIdentifier ?? null,
                                  figi: row.figi ?? null,
                                  position_type: row.positionType,
                                  position_type_label: formatPortfolioWeightPositionTypeLabel(row.positionType),
                                  position_value:
                                    row.positionType === "weight_notional_exposure"
                                      ? `${formatInlinePositionValueInput(row)}%`
                                      : row.positionValue,
                                })}
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
                  <td colSpan={6} className="px-4 py-10">
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
