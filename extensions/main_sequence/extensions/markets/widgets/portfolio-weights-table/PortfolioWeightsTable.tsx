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

import { type TargetPortfolioWeightsPositionColumnDef } from "../../../../common/api";
import { MainSequenceDataGrid } from "../../../../common/components/MainSequenceDataGrid";

export type PortfolioWeightsTableVariant = "summary" | "positions";

export interface PortfolioWeightsTableProps {
  columnDefs: TargetPortfolioWeightsPositionColumnDef[];
  rows: Array<Record<string, unknown>>;
  emptyMessage?: string;
  emptyTitle?: string;
  expandableAssetRows?: boolean;
  positionMap?: Record<string, unknown> | null;
  preferredPositionColumns?: boolean;
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

function formatPortfolioWeightsColumnLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPortfolioWeightsUnknownValue(value: unknown) {
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

function readPortfolioWeightsPath(
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

function findPortfolioWeightsValue(
  row: Record<string, unknown>,
  paths: string[][],
) {
  for (const path of paths) {
    const value = readPortfolioWeightsPath(row, path);

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

function findPortfolioWeightsString(
  row: Record<string, unknown>,
  paths: string[][],
) {
  const value = findPortfolioWeightsValue(row, paths);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatPortfolioWeightsCellValue(value: unknown, field?: string) {
  if (typeof value === "string" && field && field.toLowerCase().includes("date")) {
    const parsed = Date.parse(value);

    if (Number.isFinite(parsed)) {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(parsed));
    }
  }

  return formatPortfolioWeightsUnknownValue(value);
}

function formatPortfolioWeightPositionValueByType(
  value: unknown,
  positionType: string | null | undefined,
  field = "position_value",
) {
  if ((positionType ?? "").trim().toLowerCase() === "weight_notional_exposure") {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;

    if (Number.isFinite(parsed)) {
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(parsed);
    }
  }

  return formatPortfolioWeightsCellValue(value, field);
}

export function formatPortfolioWeightAggregateValue(
  value: number,
  positionType: string | null | undefined,
) {
  return formatPortfolioWeightPositionValueByType(value, positionType, "position_value");
}

function normalizePortfolioWeightsSummaryPositionType(types: Set<string>) {
  if (types.size !== 1) {
    return null;
  }

  return Array.from(types)[0] ?? null;
}

export function normalizePortfolioWeightSummaryRows(weights: unknown): Array<Record<string, unknown>> {
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

function getPortfolioWeightAssetRowId(row: Record<string, unknown>, index: number) {
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

function getPortfolioWeightAssetFigi(row: Record<string, unknown>) {
  return typeof row.figi === "string" && row.figi.trim() ? row.figi.trim() : "Not available";
}

function getPortfolioWeightAssetName(row: Record<string, unknown>) {
  return findPortfolioWeightsString(row, [
    ["asset_name"],
    ["name"],
    ["current_snapshot", "name"],
    ["asset", "current_snapshot", "name"],
  ])
    ? findPortfolioWeightsString(row, [
        ["asset_name"],
        ["name"],
        ["current_snapshot", "name"],
        ["asset", "current_snapshot", "name"],
      ])!
    : "Not available";
}

function getPortfolioWeightAssetTicker(row: Record<string, unknown>) {
  return findPortfolioWeightsString(row, [
    ["asset_ticker"],
    ["ticker"],
    ["current_snapshot", "ticker"],
    ["asset", "current_snapshot", "ticker"],
  ])
    ? findPortfolioWeightsString(row, [
        ["asset_ticker"],
        ["ticker"],
        ["current_snapshot", "ticker"],
        ["asset", "current_snapshot", "ticker"],
      ])!
    : "Not available";
}

function getPortfolioWeightAssetUid(row: Record<string, unknown>) {
  return findPortfolioWeightsString(row, [
    ["unique_identifier"],
    ["uid"],
    ["asset", "unique_identifier"],
  ])
    ? findPortfolioWeightsString(row, [
        ["unique_identifier"],
        ["uid"],
        ["asset", "unique_identifier"],
      ])!
    : "Not available";
}

function getPortfolioWeightPositionDetail(
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

function getPortfolioWeightPositionType(positionDetail: Record<string, unknown> | null) {
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

function getPortfolioWeightPositionValue(positionDetail: Record<string, unknown> | null) {
  if (!positionDetail) {
    return "Not available";
  }

  const positionType = getPortfolioWeightPositionType(positionDetail);

  for (const key of ["position_value", "value", "weight", "position", "target_weight"]) {
    const value = positionDetail[key];

    if (value !== null && value !== undefined && value !== "") {
      return formatPortfolioWeightPositionValueByType(value, positionType, key);
    }
  }

  return "Not available";
}

export function getPortfolioWeightPositionRowType(row: Record<string, unknown>) {
  const directValue = findPortfolioWeightsString(row, [
    ["position_type"],
    ["new_position_type"],
    ["type"],
    ["position_side"],
    ["side"],
  ]);

  return directValue || "Not available";
}

export function getPortfolioWeightPositionRowNumericValue(row: Record<string, unknown>) {
  const value = findPortfolioWeightsValue(row, [
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

export function getPortfolioWeightsPositionSummary(
  rows: Array<Record<string, unknown>>,
) {
  let longSum = 0;
  let shortSum = 0;
  let totalSum = 0;
  const longTypes = new Set<string>();
  const shortTypes = new Set<string>();
  const totalTypes = new Set<string>();

  for (const row of rows) {
    const numericValue = getPortfolioWeightPositionRowNumericValue(row);

    if (numericValue === null) {
      continue;
    }

    const positionType = getPortfolioWeightPositionRowType(row);
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
    longType: normalizePortfolioWeightsSummaryPositionType(longTypes),
    shortType: normalizePortfolioWeightsSummaryPositionType(shortTypes),
    totalType: normalizePortfolioWeightsSummaryPositionType(totalTypes),
  };
}

export function PortfolioWeightsPositionSummaryStrip({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  const summary = useMemo(() => getPortfolioWeightsPositionSummary(rows), [rows]);

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {[
        {
          key: "longs",
          label: "Longs",
          value: formatPortfolioWeightAggregateValue(summary.longSum, summary.longType),
          tone:
            summary.longSum > 0
              ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/8"
              : "text-muted-foreground border-border/60 bg-background/40",
        },
        {
          key: "shorts",
          label: "Shorts",
          value: formatPortfolioWeightAggregateValue(summary.shortSum, summary.shortType),
          tone:
            summary.shortSum < 0
              ? "text-rose-300 border-rose-500/20 bg-rose-500/8"
              : "text-muted-foreground border-border/60 bg-background/40",
        },
        {
          key: "total",
          label: "Total",
          value: formatPortfolioWeightAggregateValue(summary.totalSum, summary.totalType),
          tone: "text-foreground border-border/60 bg-background/40",
        },
      ].map((item) => (
        <div
          key={item.key}
          className={`min-w-[112px] rounded-[calc(var(--radius)-8px)] border px-3 py-2 ${item.tone}`}
        >
          <div className="text-[10px] uppercase tracking-[0.16em]">{item.label}</div>
          <div className="mt-1 text-sm font-medium">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function getPortfolioWeightPositionRowValue(row: Record<string, unknown>) {
  const value = getPortfolioWeightPositionRowNumericValue(row);
  const positionType = getPortfolioWeightPositionRowType(row);

  return value !== null
    ? formatPortfolioWeightPositionValueByType(value, positionType, "position_value")
    : "Not available";
}

const collapsedPositionFieldKeys = new Set([
  "asset_name",
  "name",
  "asset_ticker",
  "ticker",
  "unique_identifier",
  "uid",
  "position_type",
  "new_position_type",
  "type",
  "position_side",
  "side",
  "position_value",
  "new_position_value",
  "weight",
  "target_weight",
  "value",
  "position",
]);

function getPortfolioWeightPositionExpandedFields(row: Record<string, unknown>) {
  const scalarFields: Array<{ key: string; label: string; value: string }> = [];
  const structuredFields: Array<{ key: string; label: string; value: unknown }> = [];

  for (const [key, rawValue] of Object.entries(row)) {
    if (collapsedPositionFieldKeys.has(key) || rawValue === null || rawValue === undefined || rawValue === "") {
      continue;
    }

    const label = formatPortfolioWeightsColumnLabel(key);

    if (isRecord(rawValue) || Array.isArray(rawValue)) {
      structuredFields.push({
        key,
        label,
        value: rawValue,
      });
      continue;
    }

    scalarFields.push({
      key,
      label,
      value: formatPortfolioWeightsCellValue(rawValue, key),
    });
  }

  return { scalarFields, structuredFields };
}

function PortfolioWeightsNestedValue({
  value,
  fieldKey,
  depth = 0,
}: {
  value: unknown;
  fieldKey?: string;
  depth?: number;
}) {
  if (value === null || value === undefined || value === "") {
    return <div className="text-sm text-muted-foreground">Not available</div>;
  }

  if (depth >= 4) {
    return (
      <div className="text-sm text-foreground">
        {formatPortfolioWeightsCellValue(value, fieldKey)}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <div className="text-sm text-muted-foreground">No items</div>;
    }

    if (value.every((entry) => isPrimitiveValue(entry))) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((entry, index) => (
            <div
              key={`${fieldKey ?? "value"}-${index}`}
              className="rounded-[calc(var(--radius)-10px)] border border-border/50 bg-card/65 px-2.5 py-1 text-xs text-foreground"
            >
              {formatPortfolioWeightsCellValue(entry, fieldKey)}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {value.map((entry, index) => (
          <div
            key={`${fieldKey ?? "value"}-${index}`}
            className="rounded-[calc(var(--radius)-8px)] border border-border/50 bg-card/65 px-3 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Item {index + 1}
            </div>
            <div className="mt-2">
              <PortfolioWeightsNestedValue
                value={entry}
                fieldKey={fieldKey}
                depth={depth + 1}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(
      ([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== "",
    );

    if (entries.length === 0) {
      return <div className="text-sm text-muted-foreground">No fields</div>;
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {entries.map(([key, entryValue]) => (
          <div
            key={key}
            className="rounded-[calc(var(--radius)-8px)] border border-border/50 bg-card/65 px-3 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {formatPortfolioWeightsColumnLabel(key)}
            </div>
            <div className="mt-2">
              <PortfolioWeightsNestedValue
                value={entryValue}
                fieldKey={key}
                depth={depth + 1}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-sm text-foreground">
      {formatPortfolioWeightsCellValue(value, fieldKey)}
    </div>
  );
}

function getPortfolioWeightsColumns(
  columnDefs: TargetPortfolioWeightsPositionColumnDef[],
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
      headerName: column.headerName || formatPortfolioWeightsColumnLabel(column.field),
    }));
  }

  const orderedColumns: Array<{ field: string; headerName: string }> = [];

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!orderedColumns.some((column) => column.field === key)) {
        orderedColumns.push({
          field: key,
          headerName: formatPortfolioWeightsColumnLabel(key),
        });
      }
    }
  }

  return orderedColumns;
}

function buildPreferredPositionColumns(): ColumnDef<Record<string, unknown>>[] {
  return [
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
                {getPortfolioWeightAssetName(row.original)}
              </div>
              <div className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
                {getPortfolioWeightAssetFigi(row.original)}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "asset_ticker",
      header: "Asset Ticker",
      cell: ({ row }) => (
        <div className="font-mono text-sm text-foreground">{getPortfolioWeightAssetTicker(row.original)}</div>
      ),
    },
    {
      id: "unique_identifier",
      header: "UID",
      cell: ({ row }) => (
        <div className="font-mono text-sm text-foreground">{getPortfolioWeightAssetUid(row.original)}</div>
      ),
    },
    {
      id: "position_type",
      header: "Position Type",
      cell: ({ row }) => (
        <div className="text-sm text-foreground">{getPortfolioWeightPositionRowType(row.original)}</div>
      ),
    },
    {
      id: "position_value",
      header: "Position Value",
      cell: ({ row }) => (
        <div className="text-sm text-foreground">{getPortfolioWeightPositionRowValue(row.original)}</div>
      ),
    },
  ];
}

function PortfolioWeightPositionExpandedContent({
  row,
}: {
  row: Record<string, unknown>;
}) {
  const { scalarFields, structuredFields } = getPortfolioWeightPositionExpandedFields(row);

  if (scalarFields.length === 0 && structuredFields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No additional position details were returned for this row.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <div className="min-w-0 space-y-3">
        {scalarFields.length > 0 ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50 px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Additional Fields
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {scalarFields.map((field) => (
                <div key={field.key} className="rounded-[calc(var(--radius)-8px)] border border-border/50 bg-card/65 px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {field.label}
                  </div>
                  <div className="mt-2 text-sm text-foreground">{field.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <aside className="space-y-3">
        {structuredFields.map((field) => (
          <div
            key={field.key}
            className="rounded-[calc(var(--radius)-6px)] border border-border/60 bg-background/50 px-3 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {field.label}
            </div>
            <div className="mt-2">
              <PortfolioWeightsNestedValue value={field.value} fieldKey={field.key} />
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}

function PortfolioWeightAssetExpandedContent({
  asset,
  positionMap,
}: {
  asset: Record<string, unknown>;
  positionMap?: Record<string, unknown> | null;
}) {
  const positionDetail = getPortfolioWeightPositionDetail(asset, positionMap);
  const detailItems = [
    {
      key: "asset_name",
      label: "Asset Name",
      value: getPortfolioWeightAssetName(asset),
    },
    {
      key: "asset_ticker",
      label: "Asset Ticker",
      value: getPortfolioWeightAssetTicker(asset),
    },
    {
      key: "uid",
      label: "UID",
      value: getPortfolioWeightAssetUid(asset),
    },
    {
      key: "position_type",
      label: "Position Type",
      value: getPortfolioWeightPositionType(positionDetail),
    },
    {
      key: "position_value",
      label: "Position Value",
      value: getPortfolioWeightPositionValue(positionDetail),
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

function PortfolioWeightsAssetSummaryTable({
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
              {getPortfolioWeightAssetFigi(row.original)}
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
    getRowId: (row, index) => getPortfolioWeightAssetRowId(row, index),
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
                          <PortfolioWeightAssetExpandedContent
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

function PortfolioWeightsPositionTable({
  rows,
  emptyMessage,
  emptyTitle,
}: {
  rows: Array<Record<string, unknown>>;
  emptyMessage: string;
  emptyTitle: string;
}) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => buildPreferredPositionColumns(), []);
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      expanded,
    },
    onExpandedChange: setExpanded,
    getRowId: (row, index) => getPortfolioWeightAssetRowId(row, index),
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
                          <PortfolioWeightPositionExpandedContent row={row.original} />
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

export function buildPortfolioWeightsTableColumns(
  columnDefs: TargetPortfolioWeightsPositionColumnDef[],
  rows: Array<Record<string, unknown>>,
  { preferredPositionColumns = false }: { preferredPositionColumns?: boolean } = {},
): ColumnDef<Record<string, unknown>>[] {
  if (preferredPositionColumns) {
    return buildPreferredPositionColumns();
  }

  const resolvedColumns = getPortfolioWeightsColumns(columnDefs, rows);

  return resolvedColumns.map((column) => ({
    id: column.field,
    header: column.headerName,
    cell: ({ row }) => (
      <div className="text-sm text-foreground">
        {formatPortfolioWeightsCellValue(row.original[column.field], column.field)}
      </div>
    ),
  }));
}

export function PortfolioWeightsTable({
  columnDefs,
  rows,
  emptyMessage = "No rows were returned.",
  emptyTitle = "No rows",
  expandableAssetRows = false,
  positionMap,
  preferredPositionColumns = false,
  tableMinWidth = 760,
}: PortfolioWeightsTableProps) {
  if (expandableAssetRows) {
    return (
      <PortfolioWeightsAssetSummaryTable
        rows={rows}
        emptyMessage={emptyMessage}
        emptyTitle={emptyTitle}
        positionMap={positionMap}
      />
    );
  }

  if (preferredPositionColumns) {
    return (
      <PortfolioWeightsPositionTable
        rows={rows}
        emptyMessage={emptyMessage}
        emptyTitle={emptyTitle}
      />
    );
  }

  const columns = useMemo(
    () => buildPortfolioWeightsTableColumns(columnDefs, rows, { preferredPositionColumns }),
    [columnDefs, preferredPositionColumns, rows],
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
