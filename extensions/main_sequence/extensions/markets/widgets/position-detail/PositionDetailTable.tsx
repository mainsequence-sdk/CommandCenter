import { Fragment, useMemo, useState } from "react";

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { type TargetPositionDetailPositionColumnDef } from "../../../../common/api";
import { MainSequenceDataGrid } from "../../../../common/components/MainSequenceDataGrid";
import type { PositionDetailSourceType } from "./positionDetailRuntime";

export type PositionDetailTableVariant = "summary" | "positions";

export function formatPositionDetailPositionTypeLabel(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  switch (normalized) {
    case "weight_notional_exposure":
      return "Weight from Notional Exposure";
    case "units":
      return "Units";
    case "constant_notional":
      return "Constant Notional";
    default:
      return typeof value === "string" && value.trim() ? value.trim() : "Not available";
  }
}

export interface PositionDetailTableProps {
  columnDefs: TargetPositionDetailPositionColumnDef[];
  rows: Array<Record<string, unknown>>;
  emptyMessage?: string;
  emptyTitle?: string;
  expandableAssetRows?: boolean;
  positionMap?: Record<string, unknown> | null;
  preferredPositionColumns?: boolean;
  sourceType?: PositionDetailSourceType;
  holdingsDate?: string | null;
  tableMinWidth?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrimitiveValue(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function formatPositionDetailColumnLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPositionDetailUnknownValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (Array.isArray(value)) {
    if (value.every((entry) => isPrimitiveValue(entry))) {
      return value.map((entry) => String(entry)).join(", ");
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function readPositionDetailPath(
  value: Record<string, unknown> | null | undefined,
  path: string[],
): unknown {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current) || !(key in current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

function findPositionDetailValue(
  row: Record<string, unknown>,
  paths: string[][],
) {
  for (const path of paths) {
    const value = readPositionDetailPath(row, path);

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

function findPositionDetailString(
  row: Record<string, unknown>,
  paths: string[][],
) {
  const value = findPositionDetailValue(row, paths);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatPositionDetailCellValue(value: unknown, field?: string) {
  if (typeof value === "string" && field && field.toLowerCase().includes("date")) {
    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(parsed));
    }
  }

  return formatPositionDetailUnknownValue(value);
}

function formatPositionDetailPositionDateValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
      }).format(new Date(parsed));
    }
  }

  return "Not available";
}

function formatPositionDetailPositionValueByType(
  value: unknown,
  positionType: string | null | undefined,
  field = "position_value",
) {
  const normalizedPositionType = (positionType ?? "").trim().toLowerCase();
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (Number.isFinite(parsed)) {
    if (normalizedPositionType === "weight_notional_exposure") {
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(parsed);
    }

    if (normalizedPositionType === "constant_notional") {
      return `$${new Intl.NumberFormat("en-US", {
        useGrouping: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 20,
      }).format(parsed)}`;
    }

    if (normalizedPositionType === "units") {
      return new Intl.NumberFormat("en-US", {
        useGrouping: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 20,
      }).format(parsed);
    }
  }

  return formatPositionDetailCellValue(value, field);
}

export function formatPositionDetailAggregateValue(
  value: number,
  positionType: string | null | undefined,
) {
  return formatPositionDetailPositionValueByType(value, positionType, "position_value");
}

function normalizePositionDetailSummaryPositionType(types: Set<string>) {
  if (types.size !== 1) {
    return null;
  }

  return Array.from(types)[0] ?? null;
}

export function normalizePositionDetailSummaryRows(weights: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(weights) && weights.every((entry) => isRecord(entry))) {
    return weights;
  }

  if (isRecord(weights)) {
    const entries = Object.entries(weights);

    if (entries.every(([, value]) => isPrimitiveValue(value))) {
      return entries.map(([label, value]) => ({
        label,
        value,
      }));
    }
  }

  return [];
}

function getPositionDetailAssetRowId(row: Record<string, unknown>, index: number) {
  const directId = row.id;

  if (typeof directId === "number" && Number.isFinite(directId) && directId > 0) {
    return `asset-${directId}`;
  }

  const figi = typeof row.figi === "string" && row.figi.trim() ? row.figi.trim() : "";

  if (figi) {
    return `asset-${figi}`;
  }

  return `asset-row-${index}`;
}

function getPositionDetailAssetFigi(row: Record<string, unknown>) {
  return typeof row.figi === "string" && row.figi.trim() ? row.figi.trim() : "Not available";
}

function getPositionDetailAssetName(row: Record<string, unknown>) {
  return findPositionDetailString(row, [
    ["asset_name"],
    ["name"],
    ["current_snapshot", "name"],
    ["asset", "current_snapshot", "name"],
  ])
    ? findPositionDetailString(row, [
        ["asset_name"],
        ["name"],
        ["current_snapshot", "name"],
        ["asset", "current_snapshot", "name"],
      ])!
    : "Not available";
}

function getPositionDetailAssetTicker(row: Record<string, unknown>) {
  return findPositionDetailString(row, [
    ["asset_ticker"],
    ["ticker"],
    ["current_snapshot", "ticker"],
    ["asset", "current_snapshot", "ticker"],
  ])
    ? findPositionDetailString(row, [
        ["asset_ticker"],
        ["ticker"],
        ["current_snapshot", "ticker"],
        ["asset", "current_snapshot", "ticker"],
      ])!
    : "Not available";
}

function getPositionDetailAssetUid(row: Record<string, unknown>) {
  return findPositionDetailString(row, [
    ["unique_identifier"],
    ["uid"],
    ["asset", "unique_identifier"],
  ])
    ? findPositionDetailString(row, [
        ["unique_identifier"],
        ["uid"],
        ["asset", "unique_identifier"],
      ])!
    : "Not available";
}

function getPositionDetailPositionDetail(
  asset: Record<string, unknown>,
  positionMap: Record<string, unknown> | null | undefined,
) {
  if (!positionMap) {
    return null;
  }

  const candidates = [
    asset.id,
    asset.unique_identifier,
    asset.figi,
  ]
    .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
    .filter((value) => value.length > 0);

  for (const key of candidates) {
    const detail = positionMap[key];

    if (isRecord(detail)) {
      return detail;
    }
  }

  return null;
}

function getPositionDetailPositionType(positionDetail: Record<string, unknown> | null) {
  if (!positionDetail) {
    return "Not available";
  }

  for (const key of ["position_type", "type", "side", "position_side"]) {
    const value = positionDetail[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "Not available";
}

function getPositionDetailPositionValue(positionDetail: Record<string, unknown> | null) {
  if (!positionDetail) {
    return "Not available";
  }

  const positionType = getPositionDetailPositionType(positionDetail);

  for (const key of ["position_value", "value", "weight", "position", "target_weight"]) {
    const value = positionDetail[key];

    if (value !== null && value !== undefined && value !== "") {
      return formatPositionDetailPositionValueByType(value, positionType, key);
    }
  }

  return "Not available";
}

export function getPositionDetailPositionRowType(row: Record<string, unknown>) {
  const directValue = findPositionDetailString(row, [
    ["position_type"],
    ["new_position_type"],
    ["type"],
    ["position_side"],
    ["side"],
  ]);

  return directValue || "Not available";
}

function getPositionDetailPositionRowDate(row: Record<string, unknown>) {
  return getPositionDetailPositionRowDateWithFallback(row);
}

function getPositionDetailPositionRowDateWithFallback(
  row: Record<string, unknown>,
  fallbackDate?: string | null,
) {
  const value = findPositionDetailValue(row, [
    ["date"],
    ["as_of_date"],
    ["effective_date"],
    ["position_date"],
    ["weights_date"],
    ["timestamp"],
    ["time_index"],
  ]);

  return formatPositionDetailPositionDateValue(value ?? fallbackDate);
}

export function getPositionDetailPositionRowNumericValue(row: Record<string, unknown>) {
  const value = findPositionDetailValue(row, [
    ["position_value"],
    ["new_position_value"],
    ["weight"],
    ["target_weight"],
    ["value"],
    ["position"],
  ]);

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

export function getPositionDetailPositionSummary(
  rows: Array<Record<string, unknown>>,
) {
  let longSum = 0;
  let shortSum = 0;
  let totalSum = 0;
  const longTypes = new Set<string>();
  const shortTypes = new Set<string>();
  const totalTypes = new Set<string>();

  for (const row of rows) {
    const numericValue = getPositionDetailPositionRowNumericValue(row);

    if (numericValue === null) {
      continue;
    }

    const positionType = getPositionDetailPositionRowType(row);
    totalSum += numericValue;

    if (positionType !== "Not available") {
      totalTypes.add(positionType);
    }

    if (numericValue > 0) {
      longSum += numericValue;
      if (positionType !== "Not available") {
        longTypes.add(positionType);
      }
    } else if (numericValue < 0) {
      shortSum += numericValue;
      if (positionType !== "Not available") {
        shortTypes.add(positionType);
      }
    }
  }

  return {
    longSum,
    shortSum,
    totalSum,
    longType: normalizePositionDetailSummaryPositionType(longTypes),
    shortType: normalizePositionDetailSummaryPositionType(shortTypes),
    totalType: normalizePositionDetailSummaryPositionType(totalTypes),
  };
}

export function getPositionDetailPositionSummariesByType(
  rows: Array<Record<string, unknown>>,
) {
  const summaryByType = new Map<
    string,
    {
      positionType: string;
      longSum: number;
      shortSum: number;
      totalSum: number;
    }
  >();

  for (const row of rows) {
    const numericValue = getPositionDetailPositionRowNumericValue(row);

    if (numericValue === null) {
      continue;
    }

    const positionType = getPositionDetailPositionRowType(row);

    if (positionType === "units") {
      continue;
    }

    const key = positionType !== "Not available" ? positionType : "unknown";
    const existing = summaryByType.get(key) ?? {
      positionType: key,
      longSum: 0,
      shortSum: 0,
      totalSum: 0,
    };

    existing.totalSum += numericValue;

    if (numericValue > 0) {
      existing.longSum += numericValue;
    } else if (numericValue < 0) {
      existing.shortSum += numericValue;
    }

    summaryByType.set(key, existing);
  }

  const preferredOrder = [
    "weight_notional_exposure",
    "constant_notional",
    "units",
    "unknown",
  ];

  return Array.from(summaryByType.values()).sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.positionType);
    const rightIndex = preferredOrder.indexOf(right.positionType);

    const normalizedLeftIndex = leftIndex === -1 ? preferredOrder.length : leftIndex;
    const normalizedRightIndex = rightIndex === -1 ? preferredOrder.length : rightIndex;

    if (normalizedLeftIndex !== normalizedRightIndex) {
      return normalizedLeftIndex - normalizedRightIndex;
    }

    return left.positionType.localeCompare(right.positionType);
  });
}

export function PositionDetailPositionSummaryStrip({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  const summaries = useMemo(() => getPositionDetailPositionSummariesByType(rows), [rows]);

  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-wrap gap-3">
      {summaries.map((summary) => (
        <div
          key={summary.positionType}
          className="min-w-[260px] rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/40 p-3"
        >
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {formatPositionDetailPositionTypeLabel(summary.positionType)}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              {
                key: "longs",
                label: "Longs",
                value: formatPositionDetailAggregateValue(summary.longSum, summary.positionType),
                tone:
                  summary.longSum > 0
                    ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/8"
                    : "text-muted-foreground border-border/60 bg-background/40",
              },
              {
                key: "shorts",
                label: "Shorts",
                value: formatPositionDetailAggregateValue(summary.shortSum, summary.positionType),
                tone:
                  summary.shortSum < 0
                    ? "text-rose-300 border-rose-500/20 bg-rose-500/8"
                    : "text-muted-foreground border-border/60 bg-background/40",
              },
              {
                key: "total",
                label: "Total",
                value: formatPositionDetailAggregateValue(summary.totalSum, summary.positionType),
                tone: "text-foreground border-border/60 bg-background/40",
              },
            ].map((item) => (
              <div
                key={`${summary.positionType}-${item.key}`}
                className={`min-w-[112px] rounded-[calc(var(--radius)-8px)] border px-3 py-2 ${item.tone}`}
              >
                <div className="text-[10px] uppercase tracking-[0.16em]">{item.label}</div>
                <div className="mt-1 text-sm font-medium">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function getPositionDetailPositionRowValue(row: Record<string, unknown>) {
  const value = getPositionDetailPositionRowNumericValue(row);
  const positionType = getPositionDetailPositionRowType(row);

  return value !== null
    ? formatPositionDetailPositionValueByType(value, positionType, "position_value")
    : "Not available";
}

function safeFormatPositionDetailJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildAccountHoldingExpandedRecord(row: Record<string, unknown>) {
  const uniqueIdentifier =
    typeof row.unique_identifier === "string" && row.unique_identifier.trim()
      ? row.unique_identifier.trim()
      : null;
  const timeIndex =
    typeof row.time_index === "string" && row.time_index.trim()
      ? row.time_index.trim()
      : typeof row.date === "string" && row.date.trim()
        ? row.date.trim()
        : null;
  const price =
    typeof row.price === "string" || typeof row.price === "number" ? row.price : null;
  const quantity =
    typeof row.quantity === "string" || typeof row.quantity === "number"
      ? row.quantity
      : typeof row.position_value === "string" || typeof row.position_value === "number"
        ? row.position_value
        : null;
  const asset =
    typeof row.asset === "number"
      ? row.asset
      : isRecord(row.asset)
        ? row.asset
        : null;
  const targetTradeTime =
    typeof row.target_trade_time === "string" && row.target_trade_time.trim()
      ? row.target_trade_time.trim()
      : null;
  const extraDetails =
    isRecord(row.extra_details) || Array.isArray(row.extra_details) ? row.extra_details : undefined;

  return {
    ...(uniqueIdentifier ? { unique_identifier: uniqueIdentifier } : {}),
    ...(timeIndex ? { time_index: timeIndex } : {}),
    ...(price !== null ? { price } : {}),
    ...(quantity !== null ? { quantity } : {}),
    ...(targetTradeTime ? { target_trade_time: targetTradeTime } : {}),
    ...(extraDetails !== undefined ? { extra_details: extraDetails } : {}),
    ...(asset !== null ? { asset } : {}),
  };
}

function getPositionDetailColumns(
  columnDefs: TargetPositionDetailPositionColumnDef[],
  rows: Array<Record<string, unknown>>,
) {
  const configuredColumns = columnDefs
    .map((column) => ({
      field: typeof column.field === "string" ? column.field.trim() : "",
      headerName:
        typeof column.headerName === "string" && column.headerName.trim()
          ? column.headerName.trim()
          : null,
    }))
    .filter((column) => column.field.length > 0);

  if (configuredColumns.length > 0) {
    return configuredColumns.map((column) => ({
      field: column.field,
      headerName: column.headerName || formatPositionDetailColumnLabel(column.field),
    }));
  }

  const orderedColumns: Array<{ field: string; headerName: string }> = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!orderedColumns.some((column) => column.field === key)) {
        orderedColumns.push({
          field: key,
          headerName: formatPositionDetailColumnLabel(key),
        });
      }
    }
  }

  return orderedColumns;
}

function buildPreferredPositionColumns({
  sourceType,
  holdingsDate,
}: {
  sourceType?: PositionDetailSourceType;
  holdingsDate?: string | null;
} = {}): ColumnDef<Record<string, unknown>>[] {
  const showAccountIdentitySubline = sourceType !== "account";
  const columns: ColumnDef<Record<string, unknown>>[] = [
    {
      id: "asset_name",
      header: "Asset Name",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/60 hover:text-foreground"
              aria-label={row.getIsExpanded() ? "Collapse weight row" : "Expand weight row"}
              onClick={(event) => {
                event.stopPropagation();
                row.toggleExpanded();
              }}
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {getPositionDetailAssetName(row.original)}
              </div>
              {showAccountIdentitySubline ? (
                <div className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
                  {getPositionDetailAssetFigi(row.original)}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "asset_ticker",
      header: "Asset Ticker",
      cell: ({ row }) => (
        <div className="font-mono text-sm text-foreground">{getPositionDetailAssetTicker(row.original)}</div>
      ),
    },
  ];

  if (sourceType === "portfolio") {
    columns.push({
      id: "unique_identifier",
      header: "UID",
      cell: ({ row }) => (
        <div className="font-mono text-sm text-foreground">{getPositionDetailAssetUid(row.original)}</div>
      ),
    });
    columns.push({
      id: "date",
      header: "Date",
      cell: ({ row }) => (
        <div className="text-sm text-foreground">
          {getPositionDetailPositionRowDateWithFallback(row.original, holdingsDate)}
        </div>
      ),
    });
  }

  if (sourceType !== "account") {
    columns.push({
      id: "position_type",
      header: "Position Type",
      cell: ({ row }) => (
        <div className="text-sm text-foreground">
          {formatPositionDetailPositionTypeLabel(getPositionDetailPositionRowType(row.original))}
        </div>
      ),
    });
  }

  columns.push({
    id: "position_value",
    header: sourceType === "account" ? "Quantity" : "Position Value",
    cell: ({ row }) => (
      <div className="text-sm text-foreground">{getPositionDetailPositionRowValue(row.original)}</div>
    ),
  });

  return columns;
}

function PositionDetailPositionExpandedContent({
  row,
  sourceType,
}: {
  row: Record<string, unknown>;
  sourceType?: PositionDetailSourceType;
}) {
  const formattedJson = safeFormatPositionDetailJson(
    sourceType === "account"
      ? buildAccountHoldingExpandedRecord(row)
      : row,
  );

  return (
    <div className="overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50">
      <div className="border-b border-border/60 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {sourceType === "account" ? "Holding JSON" : "Position JSON"}
      </div>
      <pre className="overflow-x-auto px-3 py-3 font-mono text-[12px] leading-5 text-foreground whitespace-pre-wrap break-words">
        {formattedJson}
      </pre>
    </div>
  );
}

function PositionDetailAssetExpandedContent({
  asset,
  positionMap,
}: {
  asset: Record<string, unknown>;
  positionMap?: Record<string, unknown> | null;
}) {
  const positionDetail = getPositionDetailPositionDetail(asset, positionMap);
  const detailItems = [
    {
      key: "asset_name",
      label: "Asset Name",
      value: getPositionDetailAssetName(asset),
    },
    {
      key: "asset_ticker",
      label: "Asset Ticker",
      value: getPositionDetailAssetTicker(asset),
    },
    {
      key: "uid",
      label: "UID",
      value: getPositionDetailAssetUid(asset),
    },
    {
      key: "position_type",
      label: "Position Type",
      value: formatPositionDetailPositionTypeLabel(getPositionDetailPositionType(positionDetail)),
    },
    {
      key: "date",
      label: "Date",
      value: getPositionDetailPositionRowDate(asset),
    },
    {
      key: "position_value",
      label: "Position Value",
      value: getPositionDetailPositionValue(positionDetail),
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {detailItems.map((item) => (
        <div
          key={item.key}
          className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50 px-3 py-3"
        >
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {item.label}
          </div>
          <div className="mt-2 text-sm text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function PositionDetailAssetSummaryTable({
  rows,
  emptyMessage,
  emptyTitle,
  positionMap,
}: {
  rows: Array<Record<string, unknown>>;
  emptyMessage: string;
  emptyTitle: string;
  positionMap?: Record<string, unknown> | null;
}) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => [
      {
        id: "figi",
        header: "FIGI",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
              aria-label={row.getIsExpanded() ? "Collapse asset details" : "Expand asset details"}
              onClick={(event) => {
                event.stopPropagation();
                row.toggleExpanded();
              }}
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            <div className="font-mono text-sm text-foreground">
              {getPositionDetailAssetFigi(row.original)}
            </div>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      expanded,
    },
    onExpandedChange: setExpanded,
    getRowId: (row, index) => getPositionDetailAssetRowId(row, index),
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length || 1;

  return (
    <div className="overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/70 bg-card/75">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-border/70 px-3 py-[var(--table-compact-header-padding-y)] text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className="border-b border-border/50 transition-colors hover:bg-muted/20"
                    onClick={() => row.toggleExpanded()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() ? (
                    <tr className="bg-background/45">
                      <td
                        colSpan={visibleColumnCount}
                        className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)]"
                      >
                        <div className="min-w-0 rounded-[calc(var(--radius)-6px)] border border-border/60 bg-card/70 p-3">
                          <PositionDetailAssetExpandedContent
                            asset={row.original}
                            positionMap={positionMap}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumnCount} className="px-4 py-10">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="text-sm font-medium text-foreground">{emptyTitle}</div>
                    <div className="max-w-[420px] text-sm text-muted-foreground">
                      {emptyMessage}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PositionDetailPositionTable({
  rows,
  emptyMessage,
  emptyTitle,
  sourceType,
  holdingsDate,
}: {
  rows: Array<Record<string, unknown>>;
  emptyMessage: string;
  emptyTitle: string;
  sourceType?: PositionDetailSourceType;
  holdingsDate?: string | null;
}) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () => buildPreferredPositionColumns({ sourceType, holdingsDate }),
    [holdingsDate, sourceType],
  );
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      expanded,
    },
    onExpandedChange: setExpanded,
    getRowId: (row, index) => getPositionDetailAssetRowId(row, index),
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length || 1;

  return (
    <div className="overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border/70 bg-card/75">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead className="sticky top-0 z-[1] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-border/70 px-3 py-[var(--table-compact-header-padding-y)] text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-muted/35",
                      row.getCanExpand() && "cursor-pointer",
                    )}
                    onClick={() => row.toggleExpanded()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)] align-top"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() ? (
                    <tr className="bg-background/45">
                      <td
                        colSpan={visibleColumnCount}
                        className="border-b border-border/50 px-3 py-[var(--table-compact-cell-padding-y)]"
                      >
                        <div
                          className="min-w-0 rounded-[calc(var(--radius)-6px)] border border-border/60 bg-card/70 p-3"
                          style={{ marginLeft: "28px" }}
                        >
                          <PositionDetailPositionExpandedContent row={row.original} sourceType={sourceType} />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumnCount} className="px-4 py-10">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <div className="text-sm font-medium text-foreground">{emptyTitle}</div>
                    <div className="max-w-[420px] text-sm text-muted-foreground">
                      {emptyMessage}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function buildPositionDetailTableColumns(
  columnDefs: TargetPositionDetailPositionColumnDef[],
  rows: Array<Record<string, unknown>>,
  {
    preferredPositionColumns = false,
    sourceType,
    holdingsDate,
  }: {
    preferredPositionColumns?: boolean;
    sourceType?: PositionDetailSourceType;
    holdingsDate?: string | null;
  } = {},
): ColumnDef<Record<string, unknown>>[] {
  if (preferredPositionColumns) {
    return buildPreferredPositionColumns({ sourceType, holdingsDate });
  }

  const resolvedColumns = getPositionDetailColumns(columnDefs, rows);

  return resolvedColumns.map((column) => ({
    id: column.field,
    header: column.headerName,
    cell: ({ row }) => (
      <div className="text-sm text-foreground">
        {formatPositionDetailCellValue(row.original[column.field], column.field)}
      </div>
    ),
  }));
}

export function PositionDetailTable({
  columnDefs,
  rows,
  emptyMessage = "No rows were returned.",
  emptyTitle = "No rows",
  expandableAssetRows = false,
  positionMap,
  preferredPositionColumns = false,
  sourceType,
  holdingsDate,
  tableMinWidth = 760,
}: PositionDetailTableProps) {
  if (expandableAssetRows) {
    return (
      <PositionDetailAssetSummaryTable
        rows={rows}
        emptyMessage={emptyMessage}
        emptyTitle={emptyTitle}
        positionMap={positionMap}
      />
    );
  }

  if (preferredPositionColumns) {
    return (
      <PositionDetailPositionTable
        rows={rows}
        emptyMessage={emptyMessage}
        emptyTitle={emptyTitle}
        sourceType={sourceType}
        holdingsDate={holdingsDate}
      />
    );
  }

  const columns = useMemo(
    () =>
      buildPositionDetailTableColumns(columnDefs, rows, {
        preferredPositionColumns,
        sourceType,
        holdingsDate,
      }),
    [columnDefs, holdingsDate, preferredPositionColumns, rows, sourceType],
  );

  return (
    <MainSequenceDataGrid
      columns={columns}
      data={rows}
      emptyMessage={emptyMessage}
      emptyTitle={emptyTitle}
      tableMinWidth={tableMinWidth}
    />
  );
}
