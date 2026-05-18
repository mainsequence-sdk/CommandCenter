import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import {
  AllCommunityModule,
  type CellSelectionChangedEvent,
  type CellClickedEvent,
  type CellRange,
  type CellStyle,
  type ColDef,
  type GridApi,
  type ICellRendererParams,
  type RowSelectionOptions,
  type SelectionChangedEvent,
} from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { withAlpha } from "@/lib/color";
import { cn } from "@/lib/utils";
import { mainSequenceSpaceTheme } from "@/themes/presets/main-sequence-space";
import { getThemeTightnessMetrics } from "@/themes/tightness";
import type { ThemeTightness, ThemeTokens } from "@/themes/types";
import { createAgGridTerminalTheme } from "@/widgets/extensions/ag-grid/grid-theme";

export type TableWidgetColumnFormat =
  | "auto"
  | "text"
  | "datetime"
  | "number"
  | "currency"
  | "percent"
  | "bps";
export type TableWidgetDensity = "compact" | "comfortable";
export type TableWidgetBarMode = "none" | "fill";
export type TableWidgetGradientMode = "none" | "fill";
export type TableWidgetHeatmapPalette =
  | "auto"
  | "viridis"
  | "plasma"
  | "inferno"
  | "magma"
  | "turbo"
  | "jet"
  | "blue-white-red"
  | "red-yellow-green";
export type TableWidgetGaugeMode = "none" | "ring";
export type TableWidgetRangeMode = "auto" | "fixed";
export type TableWidgetAlign = "auto" | "left" | "center" | "right";
export type TableWidgetPinned = "none" | "left" | "right";
export type TableWidgetOperator = "gt" | "gte" | "lt" | "lte" | "eq";
export type TableWidgetTone = "neutral" | "primary" | "success" | "warning" | "danger";
export type TableWidgetSelectionMode = "none" | "single-row" | "multi-row" | "cell";
export type TableWidgetCellValue = number | string | boolean | null;
export type TableWidgetRow = Record<string, TableWidgetCellValue>;
type TableFrameGridRow = TableWidgetRow & {
  __tableRowIndex: number;
  __tableRowKey?: string;
};
export type TableWidgetFrameRow = TableWidgetCellValue[];

export interface TableWidgetActiveCellSelection {
  rowKey?: string;
  rowIndex: number;
  columnKey: string;
  value: unknown;
}

export interface TableWidgetSelectionState {
  mode: TableWidgetSelectionMode;
  selectedRowKeys: string[];
  selectedRowIndices: number[];
  activeRowKey?: string;
  activeRowIndex?: number;
  activeCell?: TableWidgetActiveCellSelection;
  selectedCells: TableWidgetActiveCellSelection[];
  updatedAtMs: number;
}

function tableActiveCellBelongsToRow(
  activeCell: TableWidgetActiveCellSelection | undefined,
  row: TableFrameGridRow | null,
) {
  if (!activeCell || !row) {
    return false;
  }

  if (activeCell.rowKey && row.__tableRowKey) {
    return activeCell.rowKey === row.__tableRowKey;
  }

  return activeCell.rowIndex === row.__tableRowIndex;
}

function tableActiveCellFromFocusedCell(
  api: GridApi<TableFrameGridRow>,
  row: TableFrameGridRow | null,
): TableWidgetActiveCellSelection | undefined {
  if (!row) {
    return undefined;
  }

  const focusedCell =
    typeof api.getFocusedCell === "function" ? api.getFocusedCell() : null;
  const columnKey = focusedCell?.column.getColId();

  if (!columnKey || focusedCell?.rowIndex !== row.__tableRowIndex) {
    return undefined;
  }

  return {
    rowKey: row.__tableRowKey,
    rowIndex: row.__tableRowIndex,
    columnKey,
    value: row[columnKey] ?? null,
  };
}

function tableCellSelectionKey(row: TableFrameGridRow, columnKey: string) {
  return `${row.__tableRowKey ?? row.__tableRowIndex}:${columnKey}`;
}

function tableRowSelectionKey(row: TableFrameGridRow) {
  return row.__tableRowKey ?? `row:${row.__tableRowIndex}`;
}

function resolveDisplayedRangeRow(
  api: GridApi<TableFrameGridRow>,
  displayedRowIndex: number,
) {
  return api.getDisplayedRowAtIndex(displayedRowIndex)?.data ?? null;
}

function normalizeCellRangeRows(range: CellRange) {
  const startRowIndex = range.startRow?.rowIndex;
  const endRowIndex = range.endRow?.rowIndex;

  if (startRowIndex == null && endRowIndex == null) {
    return [];
  }

  const minIndex = Math.min(startRowIndex ?? endRowIndex ?? 0, endRowIndex ?? startRowIndex ?? 0);
  const maxIndex = Math.max(startRowIndex ?? endRowIndex ?? 0, endRowIndex ?? startRowIndex ?? 0);

  return Array.from({ length: maxIndex - minIndex + 1 }, (_, offset) => minIndex + offset);
}

function collectTableRangeSelection(
  api: GridApi<TableFrameGridRow>,
) {
  const ranges = typeof api.getCellRanges === "function" ? (api.getCellRanges() ?? []) : [];
  const selectedCellSet = new Set<string>();
  const selectedRowSet = new Set<string>();
  const selectedCells: TableWidgetActiveCellSelection[] = [];
  const selectedRows: TableFrameGridRow[] = [];

  ranges.forEach((range) => {
    const columns = range.columns?.length > 0 ? range.columns : [range.startColumn];

    normalizeCellRangeRows(range).forEach((displayedRowIndex) => {
      const row = resolveDisplayedRangeRow(api, displayedRowIndex);

      if (!row) {
        return;
      }

      const rowIdentity = tableRowSelectionKey(row);

      if (!selectedRowSet.has(rowIdentity)) {
        selectedRowSet.add(rowIdentity);
        selectedRows.push(row);
      }

      columns.forEach((column) => {
        const columnKey = typeof column?.getColId === "function" ? column.getColId() : "";

        if (!columnKey) {
          return;
        }

        const selectionKey = tableCellSelectionKey(row, columnKey);

        if (selectedCellSet.has(selectionKey)) {
          return;
        }

        selectedCellSet.add(selectionKey);
        selectedCells.push({
          rowKey: row.__tableRowKey,
          rowIndex: row.__tableRowIndex,
          columnKey,
          value: row[columnKey] ?? null,
        });
      });
    });
  });

  return { selectedCells, selectedRows };
}

function tableActiveCellFromFocusedSelection(
  api: GridApi<TableFrameGridRow>,
  fallbackCells: readonly TableWidgetActiveCellSelection[],
) {
  const focusedCell =
    typeof api.getFocusedCell === "function" ? api.getFocusedCell() : null;
  const columnKey = focusedCell?.column.getColId();

  if (focusedCell?.rowIndex != null && columnKey) {
    const row = resolveDisplayedRangeRow(api, focusedCell.rowIndex);

    if (row) {
      return {
        rowKey: row.__tableRowKey,
        rowIndex: row.__tableRowIndex,
        columnKey,
        value: row[columnKey] ?? null,
      } satisfies TableWidgetActiveCellSelection;
    }
  }

  return fallbackCells[fallbackCells.length - 1];
}

export interface TableWidgetColumnSchema {
  key: string;
  label: string;
  description?: string;
  format: Exclude<TableWidgetColumnFormat, "auto">;
  minWidth?: number;
  flex?: number;
  pinned?: Exclude<TableWidgetPinned, "none">;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  dateTimeInputFormat?: string;
  dateTimeOutputFormat?: string;
  categorical?: boolean;
  heatmapEligible?: boolean;
  compact?: boolean;
}

export interface TableWidgetColumnOverride {
  visible?: boolean;
  label?: string;
  format?: TableWidgetColumnFormat;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  dateTimeInputFormat?: string;
  dateTimeOutputFormat?: string;
  heatmap?: boolean;
  compact?: boolean;
  barMode?: TableWidgetBarMode;
  gradientMode?: TableWidgetGradientMode;
  heatmapPalette?: TableWidgetHeatmapPalette;
  gaugeMode?: TableWidgetGaugeMode;
  visualRangeMode?: TableWidgetRangeMode;
  visualMin?: number;
  visualMax?: number;
  align?: TableWidgetAlign;
  pinned?: TableWidgetPinned;
}

export interface TableWidgetValueLabel {
  columnKey: string;
  value: string;
  label?: string;
  tone?: TableWidgetTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface TableWidgetConditionalRule {
  id: string;
  columnKey: string;
  operator: TableWidgetOperator;
  value: number;
  tone?: TableWidgetTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface ResolvedTableWidgetColumnConfig extends TableWidgetColumnSchema {
  visible: boolean;
  align: Exclude<TableWidgetAlign, "auto">;
  heatmap: boolean;
  barMode: TableWidgetBarMode;
  gradientMode: TableWidgetGradientMode;
  heatmapPalette: TableWidgetHeatmapPalette;
  gaugeMode: TableWidgetGaugeMode;
  visualRangeMode: TableWidgetRangeMode;
  visualMin?: number;
  visualMax?: number;
  compact: boolean;
  pinned?: Exclude<TableWidgetPinned, "none">;
}

export interface ResolvedTableWidgetProps {
  columns: string[];
  rows: TableWidgetFrameRow[];
  schema: TableWidgetColumnSchema[];
  density: TableWidgetDensity;
  showToolbar: boolean;
  showSearch: boolean;
  showColumnFilters: boolean;
  zebraRows: boolean;
  pagination: boolean;
  pageSize: number;
  columnOverrides: Record<string, TableWidgetColumnOverride>;
  valueLabels: TableWidgetValueLabel[];
  conditionalRules: TableWidgetConditionalRule[];
  selectionMode?: TableWidgetSelectionMode;
  selectionKeyFields?: string[];
  publishSelectionOutputs?: boolean;
}

interface TableWidgetSchemaValidationIssue {
  code: "empty_schema" | "missing_columns" | "non_numeric_columns";
  columnKeys?: string[];
}

export type TableFrameColumnRange = ReturnType<typeof getTableWidgetColumnRange>;

export interface TableFrameCustomCellRendererInput {
  columnConfig: ResolvedTableWidgetColumnConfig;
  formattedValue: string;
  range: TableFrameColumnRange;
  resolvedProps: ResolvedTableWidgetProps;
  row: TableWidgetRow | undefined;
  tokens: ThemeTokens;
  value: TableWidgetCellValue;
}

export type TableFrameCustomCellRenderer = (
  input: TableFrameCustomCellRendererInput,
) => ReactNode | undefined;

export interface TableFrameViewProps {
  customCellRenderers?: Record<string, TableFrameCustomCellRenderer>;
  dataErrorMessage?: string | null;
  emptyMessage?: string;
  getRowStyle?: (row: TableWidgetRow | undefined) => CSSProperties | undefined;
  isDataLoading?: boolean;
  quickFilterPlaceholder?: string;
  resolvedProps: ResolvedTableWidgetProps;
  resolvedTokens?: ThemeTokens;
  rowObjects?: TableWidgetRow[];
  showColumnFilters?: boolean;
  selectionKeyFields?: string[];
  selectionMode?: TableWidgetSelectionMode;
  selectionState?: TableWidgetSelectionState;
  surface?: "card" | "transparent";
  tightness?: ThemeTightness;
  toolbarStart?: ReactNode;
  onSelectionChange?: (selection: TableWidgetSelectionState) => void;
}

interface TableFrameCellRendererParams
  extends ICellRendererParams<TableFrameGridRow, TableWidgetCellValue> {
  columnConfig: ResolvedTableWidgetColumnConfig;
  customCellRenderers?: Record<string, TableFrameCustomCellRenderer>;
  range: TableFrameColumnRange;
  resolvedProps: ResolvedTableWidgetProps;
  tokens: ThemeTokens;
}

const agGridModules = [AllCommunityModule];
const TABLE_FRAME_DEFAULT_DATETIME_OUTPUT_FORMAT = "yyyy-MM-dd HH:mm:ss";
const numberFormatterCache = new Map<string, Intl.NumberFormat>();

function buildTableWidgetRowObjects(
  columns: string[],
  rows: TableWidgetFrameRow[],
): TableWidgetRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((column, index) => [column, row[index] ?? null]),
    ) as TableWidgetRow,
  );
}

function stableSelectionValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

function buildTableWidgetRowKey(
  row: Record<string, unknown> | undefined,
  keyFields: readonly string[],
) {
  if (!row || keyFields.length === 0) {
    return undefined;
  }

  return JSON.stringify(keyFields.map((field) => stableSelectionValue(row[field])));
}

function isTableWidgetNumericFormat(format: TableWidgetColumnFormat) {
  return format === "number" || format === "currency" || format === "percent" || format === "bps";
}

function resolveTableWidgetColumns(
  props: ResolvedTableWidgetProps,
) {
  return props.schema.map<ResolvedTableWidgetColumnConfig>((column) => {
    const override = props.columnOverrides[column.key] ?? {};
    const effectiveFormat =
      override.format && override.format !== "auto" ? override.format : column.format;
    const numericFormat = isTableWidgetNumericFormat(effectiveFormat);

    return {
      ...column,
      label: override.label ?? column.label,
      format: effectiveFormat,
      decimals: override.decimals ?? column.decimals,
      prefix: override.prefix ?? column.prefix,
      suffix: override.suffix ?? column.suffix,
      dateTimeInputFormat: override.dateTimeInputFormat ?? column.dateTimeInputFormat,
      dateTimeOutputFormat: override.dateTimeOutputFormat ?? column.dateTimeOutputFormat,
      compact: override.compact ?? column.compact ?? false,
      visible: override.visible ?? true,
      heatmap: numericFormat ? (override.heatmap ?? false) : false,
      barMode: numericFormat ? (override.barMode ?? "none") : "none",
      gradientMode:
        numericFormat
          ? ((override.gradientMode ?? ((override.heatmap ?? false) ? "fill" : "none")) as TableWidgetGradientMode)
          : "none",
      heatmapPalette:
        numericFormat
          ? (override.heatmapPalette ?? "auto")
          : "auto",
      gaugeMode: numericFormat ? (override.gaugeMode ?? "none") : "none",
      visualRangeMode: numericFormat ? (override.visualRangeMode ?? "auto") : "auto",
      visualMin:
        numericFormat && typeof override.visualMin === "number" && Number.isFinite(override.visualMin)
          ? override.visualMin
          : undefined,
      visualMax:
        numericFormat && typeof override.visualMax === "number" && Number.isFinite(override.visualMax)
          ? override.visualMax
          : undefined,
      align:
        override.align && override.align !== "auto"
          ? override.align
          : numericFormat
            ? "right"
            : "left",
      pinned:
        override.pinned && override.pinned !== "none"
          ? override.pinned
          : column.pinned,
    };
  });
}

function getTableWidgetNumericValue(value: TableWidgetCellValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getTableWidgetValueLabel(
  props: ResolvedTableWidgetProps,
  columnKey: string,
  value: TableWidgetCellValue,
) {
  const lookupValue = value == null ? "" : String(value);
  return (
    props.valueLabels.find(
      (entry) => entry.columnKey === columnKey && entry.value === lookupValue,
    ) ?? null
  );
}

function getTableWidgetColumnRange(
  rows: TableWidgetRow[],
  columnKey: string,
) {
  const values = rows
    .map((row) => getTableWidgetNumericValue(row[columnKey]))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function validateTableWidgetSchema(
  rows: readonly TableWidgetRow[],
  columns: readonly Pick<ResolvedTableWidgetColumnConfig, "format" | "key">[],
) {
  const issues: TableWidgetSchemaValidationIssue[] = [];

  if (columns.length === 0) {
    issues.push({ code: "empty_schema" });
    return {
      isValid: false,
      issues,
    };
  }

  if (rows.length === 0) {
    return {
      isValid: true,
      issues,
    };
  }

  const sampledRows = rows.slice(0, 50);
  const missingColumns = columns
    .filter((column) =>
      sampledRows.every((row) => !Object.prototype.hasOwnProperty.call(row, column.key)),
    )
    .map((column) => column.key);

  if (missingColumns.length > 0) {
    issues.push({
      code: "missing_columns",
      columnKeys: missingColumns,
    });
  }

  const nonNumericColumns = columns
    .filter((column) => isTableWidgetNumericFormat(column.format))
    .filter((column) => {
      const values = sampledRows
        .map((row) => row[column.key])
        .filter((value) => value !== null && value !== undefined && value !== "");

      if (values.length === 0) {
        return false;
      }

      return values.every((value) => getTableWidgetNumericValue(value) === null);
    })
    .map((column) => column.key);

  if (nonNumericColumns.length > 0) {
    issues.push({
      code: "non_numeric_columns",
      columnKeys: nonNumericColumns,
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

function normalizeTimestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const absoluteValue = Math.abs(value);

    if (absoluteValue >= 1_000_000_000_000_000_000) {
      return Math.trunc(value / 1_000_000);
    }

    if (absoluteValue >= 1_000_000_000_000_000) {
      return Math.trunc(value / 1000);
    }

    if (absoluteValue >= 100_000_000_000) {
      return Math.trunc(value);
    }

    if (absoluteValue >= 100_000_000) {
      return Math.trunc(value * 1000);
    }

    return undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value.trim());

    if (Number.isFinite(numericValue)) {
      return normalizeTimestampMs(numericValue);
    }

    const parsed = Date.parse(normalizeDateTimeString(value));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeDateTimeString(value: string) {
  let normalized = value.trim();

  if (!normalized) {
    return normalized;
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized)) {
    normalized = normalized.replace(/\s+/, "T");
  }

  normalized = normalized.replace(/(\.\d{3})\d+/, "$1");
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  normalized = normalized.replace(/\s+UTC$/i, "Z");

  return normalized;
}

function parseDateOnlyLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date.getTime()
    : null;
}

function parseTimeOnlyLocal(value: string) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  const millisecond = Number((match[4] ?? "0").padEnd(3, "0"));

  if (hour > 23 || minute > 59 || second > 59 || millisecond > 999) {
    return null;
  }

  return new Date(1970, 0, 1, hour, minute, second, millisecond).getTime();
}

function normalizeDateTimePattern(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseTableWidgetDateTimeValue(
  value: TableWidgetCellValue,
  inputFormat?: string,
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeTimestampMs(value) ?? null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const numericValue = Number(trimmed);

  if (Number.isFinite(numericValue)) {
    return normalizeTimestampMs(numericValue) ?? null;
  }

  const dateOnly = parseDateOnlyLocal(trimmed);

  if (dateOnly !== null) {
    return dateOnly;
  }

  const timeOnly = parseTimeOnlyLocal(trimmed);

  if (timeOnly !== null) {
    return timeOnly;
  }

  const explicitInputFormat = normalizeDateTimePattern(inputFormat);
  const parsed = Date.parse(normalizeDateTimeString(trimmed));

  return explicitInputFormat && Number.isFinite(parsed)
    ? parsed
    : Number.isFinite(parsed)
      ? parsed
      : null;
}

function padDateTimePart(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function formatDateTimeWithPattern(timestampMs: number, pattern: string) {
  const date = new Date(timestampMs);
  const hours = date.getHours();
  const twelveHour = hours % 12 || 12;

  return pattern
    .replace(/yyyy/g, String(date.getFullYear()))
    .replace(/yy/g, padDateTimePart(date.getFullYear() % 100))
    .replace(/MM/g, padDateTimePart(date.getMonth() + 1))
    .replace(/dd/g, padDateTimePart(date.getDate()))
    .replace(/HH/g, padDateTimePart(hours))
    .replace(/hh/g, padDateTimePart(twelveHour))
    .replace(/mm/g, padDateTimePart(date.getMinutes()))
    .replace(/ss/g, padDateTimePart(date.getSeconds()))
    .replace(/SSS/g, padDateTimePart(date.getMilliseconds(), 3))
    .replace(/a/g, hours >= 12 ? "PM" : "AM");
}

function getNumberFormatter(key: string, factory: () => Intl.NumberFormat) {
  const existing = numberFormatterCache.get(key);

  if (existing) {
    return existing;
  }

  const nextFormatter = factory();
  numberFormatterCache.set(key, nextFormatter);
  return nextFormatter;
}

function formatTableWidgetValue(
  value: TableWidgetCellValue,
  column: Pick<
    ResolvedTableWidgetColumnConfig,
    | "compact"
    | "dateTimeInputFormat"
    | "dateTimeOutputFormat"
    | "decimals"
    | "format"
    | "prefix"
    | "suffix"
  >,
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (column.format === "text") {
    return `${column.prefix ?? ""}${String(value)}${column.suffix ?? ""}`;
  }

  if (column.format === "datetime") {
    const timestampMs = parseTableWidgetDateTimeValue(value, column.dateTimeInputFormat);

    if (timestampMs === null) {
      return String(value);
    }

    const outputFormat = normalizeDateTimePattern(column.dateTimeOutputFormat) ??
      TABLE_FRAME_DEFAULT_DATETIME_OUTPUT_FORMAT;

    return `${column.prefix ?? ""}${formatDateTimeWithPattern(timestampMs, outputFormat)}${column.suffix ?? ""}`;
  }

  const numericValue = getTableWidgetNumericValue(value);

  if (numericValue === null) {
    return String(value);
  }

  const digits = column.decimals ?? (column.format === "currency" ? 2 : column.format === "percent" || column.format === "bps" ? 1 : 0);
  const notation = column.compact ? "compact" : "standard";
  const formatterKey = `${column.format}:${digits}:${notation}`;
  const formatter = getNumberFormatter(formatterKey, () => {
    if (column.format === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    }

    return new Intl.NumberFormat("en-US", {
      notation,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  });

  let formatted = formatter.format(numericValue);

  if (column.format === "percent") {
    formatted = `${formatted}%`;
  } else if (column.format === "bps") {
    formatted = `${formatted} bps`;
  }

  return `${column.prefix ?? ""}${formatted}${column.suffix ?? ""}`;
}

function evaluateTableWidgetRule(
  value: number,
  rule: Pick<TableWidgetConditionalRule, "operator" | "value">,
) {
  if (rule.operator === "gt") {
    return value > rule.value;
  }

  if (rule.operator === "gte") {
    return value >= rule.value;
  }

  if (rule.operator === "lt") {
    return value < rule.value;
  }

  if (rule.operator === "lte") {
    return value <= rule.value;
  }

  return value === rule.value;
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseHexColor(hex: string) {
  const normalized = hex.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    return null;
  }

  const value = Number.parseInt(expanded, 16);

  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function toHexColor({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}) {
  const encode = (value: number) =>
    Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

  return `#${encode(r)}${encode(g)}${encode(b)}`;
}

function interpolateHexColor(left: string, right: string, ratio: number) {
  const leftColor = parseHexColor(left);
  const rightColor = parseHexColor(right);

  if (!leftColor || !rightColor) {
    return left;
  }

  const normalizedRatio = clamp(ratio);

  return toHexColor({
    r: leftColor.r + (rightColor.r - leftColor.r) * normalizedRatio,
    g: leftColor.g + (rightColor.g - leftColor.g) * normalizedRatio,
    b: leftColor.b + (rightColor.b - leftColor.b) * normalizedRatio,
  });
}

function getHeatmapPaletteStops(
  palette: ResolvedTableWidgetColumnConfig["heatmapPalette"],
) {
  switch (palette) {
    case "viridis":
      return ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];
    case "plasma":
      return ["#0d0887", "#7e03a8", "#cc4778", "#f89441", "#f0f921"];
    case "inferno":
      return ["#000004", "#420a68", "#932667", "#dd513a", "#fca50a", "#fcffa4"];
    case "magma":
      return ["#000004", "#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"];
    case "turbo":
      return ["#30123b", "#4675ed", "#1bcfd4", "#61fc6c", "#d1e834", "#fe9b2d", "#c52702"];
    case "jet":
      return ["#00008f", "#005bff", "#00d4ff", "#7dff7a", "#ffe600", "#ff7d00", "#800000"];
    case "blue-white-red":
      return ["#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b"];
    case "red-yellow-green":
      return ["#a50026", "#f46d43", "#fee08b", "#a6d96a", "#1a9850"];
    case "auto":
    default:
      return ["#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b"];
  }
}

function getInterpolatedPaletteColor(stops: string[], ratio: number) {
  if (stops.length === 0) {
    return "#000000";
  }

  if (stops.length === 1) {
    return stops[0]!;
  }

  const normalizedRatio = clamp(ratio);
  const scaled = normalizedRatio * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const localRatio = scaled - lowerIndex;

  return interpolateHexColor(stops[lowerIndex]!, stops[upperIndex]!, localRatio);
}

function getHeatmapNormalizedRatio(numericValue: number, range: TableFrameColumnRange) {
  if (!range) {
    return 0.5;
  }

  if (range.min === range.max) {
    return 1;
  }

  return clamp((numericValue - range.min) / (range.max - range.min));
}

function getHeatmapBackgroundAlpha(
  numericValue: number,
  range: TableFrameColumnRange,
) {
  if (!range) {
    return 0.28;
  }

  if (range.min === range.max) {
    return 0.58;
  }

  if (range.min < 0 && range.max > 0) {
    const maxAbs = Math.max(Math.abs(range.min), Math.abs(range.max), 1);
    return 0.18 + clamp(Math.abs(numericValue) / maxAbs) * 0.44;
  }

  return 0.18 + getHeatmapNormalizedRatio(numericValue, range) * 0.44;
}

function getColumnTone(
  numericValue: number,
  range: TableFrameColumnRange,
  tokens: ThemeTokens,
) {
  if (range && range.min < 0 && range.max <= 0) {
    return tokens.danger;
  }

  if (range && range.min < 0 && range.max > 0) {
    return numericValue >= 0 ? tokens.primary : tokens.danger;
  }

  return numericValue >= 0 ? tokens.primary : tokens.warning;
}

export function resolveTableGaugeVisual(
  numericValue: number,
  range: TableFrameColumnRange,
  conditionalRule: Pick<TableWidgetConditionalRule, "backgroundColor" | "tone"> | null,
  tokens: ThemeTokens,
) {
  if (!Number.isFinite(numericValue) || numericValue === 0) {
    return {
      color:
        conditionalRule?.backgroundColor ??
        (conditionalRule?.tone ? resolveSemanticToneColor(conditionalRule.tone, tokens) : tokens.primary),
      direction: null as "left" | "right" | null,
      ratio: 0,
    };
  }

  const maxAbsFromRange = range
    ? Math.max(Math.abs(range.min), Math.abs(range.max))
    : 0;
  const denominator = maxAbsFromRange > 0 ? maxAbsFromRange : Math.abs(numericValue) || 1;

  return {
    color:
      conditionalRule?.backgroundColor ??
      (conditionalRule?.tone
        ? resolveSemanticToneColor(conditionalRule.tone, tokens)
        : getColumnTone(numericValue, range, tokens)),
    direction: numericValue < 0 ? "left" as const : "right" as const,
    ratio: clamp(Math.abs(numericValue) / denominator),
  };
}

function getBarFillRatio(numericValue: number, range: TableFrameColumnRange) {
  if (!range) {
    return 0;
  }

  if (range.min === range.max) {
    return 1;
  }

  if (range.min < 0 && range.max > 0) {
    const maxAbs = Math.max(Math.abs(range.min), Math.abs(range.max), 1);
    return clamp(Math.abs(numericValue) / maxAbs);
  }

  const denominator = Math.max(Math.abs(range.min), Math.abs(range.max), 1);
  return clamp(Math.abs(numericValue) / denominator);
}

function resolveColumnVisualRange(
  columnConfig: Pick<
    ResolvedTableWidgetColumnConfig,
    "visualMax" | "visualMin" | "visualRangeMode"
  >,
  range: TableFrameColumnRange,
): TableFrameColumnRange {
  if (
    columnConfig.visualRangeMode === "fixed" &&
    typeof columnConfig.visualMin === "number" &&
    Number.isFinite(columnConfig.visualMin) &&
    typeof columnConfig.visualMax === "number" &&
    Number.isFinite(columnConfig.visualMax) &&
    columnConfig.visualMin < columnConfig.visualMax
  ) {
    return {
      min: columnConfig.visualMin,
      max: columnConfig.visualMax,
    };
  }

  return range;
}

function getMatchingConditionalRule(
  resolvedProps: ResolvedTableWidgetProps,
  columnKey: string,
  numericValue: number,
) {
  return (
    resolvedProps.conditionalRules.find(
      (rule) => rule.columnKey === columnKey && evaluateTableWidgetRule(numericValue, rule),
    ) ?? null
  );
}

function getAlignmentClasses(
  align: ResolvedTableWidgetColumnConfig["align"],
) {
  if (align === "left") {
    return "justify-start text-left";
  }

  if (align === "center") {
    return "justify-center text-center";
  }

  return "justify-end text-right";
}

function supportsValueLabels(columnConfig: Pick<ResolvedTableWidgetColumnConfig, "format">) {
  return columnConfig.format === "text";
}

function supportsNumericDisplay(columnConfig: Pick<ResolvedTableWidgetColumnConfig, "format">) {
  return isTableWidgetNumericFormat(columnConfig.format);
}

function formatSchemaValidationIssue(issue: TableWidgetSchemaValidationIssue) {
  if (issue.code === "empty_schema") {
    return "No schema fields are configured for this widget instance.";
  }

  if (issue.code === "missing_columns") {
    return `Configured fields not found in the data rows: ${(issue.columnKeys ?? []).join(", ")}`;
  }

  return `Fields formatted as numeric but backed by non-numeric data: ${(issue.columnKeys ?? []).join(", ")}`;
}

function resolveSemanticToneColor(
  tone: TableWidgetTone | undefined,
  tokens: ThemeTokens,
) {
  if (tone === "primary") {
    return tokens.primary;
  }

  if (tone === "success") {
    return tokens.success;
  }

  if (tone === "warning") {
    return tokens.warning;
  }

  if (tone === "danger") {
    return tokens.danger;
  }

  return tokens["muted-foreground"];
}

function resolveLabelToneStyle(
  entry: Pick<TableWidgetValueLabel, "tone" | "backgroundColor" | "textColor">,
  tokens: ThemeTokens,
) {
  const toneColor = resolveSemanticToneColor(entry.tone, tokens);
  return {
    textColor: entry.textColor ?? toneColor,
    backgroundColor: entry.backgroundColor ?? withAlpha(toneColor, entry.tone === "neutral" ? 0.18 : 0.14),
    borderColor:
      entry.backgroundColor != null
        ? withAlpha(entry.backgroundColor, 0.58)
        : withAlpha(entry.tone === "neutral" ? tokens.border : toneColor, 0.42),
  };
}

function resolveConditionalToneStyle(
  entry: Pick<TableWidgetConditionalRule, "tone" | "backgroundColor" | "textColor">,
  tokens: ThemeTokens,
) {
  const toneColor = resolveSemanticToneColor(entry.tone, tokens);
  return {
    textColor: entry.textColor ?? (entry.tone ? toneColor : tokens.foreground),
    backgroundColor: entry.backgroundColor ?? toneColor,
  };
}

function getValueLabelChipClass(
  density: ResolvedTableWidgetProps["density"],
) {
  return density === "compact"
    ? "inline-flex max-w-full min-h-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] overflow-hidden"
    : "inline-flex max-w-full min-h-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.12em] overflow-hidden";
}

function createTableCellStyle({
  value,
  columnConfig,
  resolvedProps,
  range,
  tokens,
}: Omit<TableFrameCellRendererParams, "api" | "colDef" | "column" | "context" | "customCellRenderers" | "data" | "eGridCell" | "eParentOfValue" | "getValue" | "node" | "pinned" | "registerRowDragger" | "refreshCell" | "setTooltip" | "valueFormatted">): CellStyle {
  const cellValue = value ?? null;
  const supportsNumericFormatting = supportsNumericDisplay(columnConfig);
  const numericValue = supportsNumericFormatting ? getTableWidgetNumericValue(cellValue) : null;
  const conditionalRule =
    numericValue === null
      ? null
      : getMatchingConditionalRule(resolvedProps, columnConfig.key, numericValue);

  const style: CellStyle = {
    textAlign: columnConfig.align,
    color: conditionalRule?.textColor ?? tokens.foreground,
  };
  const visualRange = resolveColumnVisualRange(columnConfig, range);

  if (conditionalRule?.backgroundColor) {
    style.background = `linear-gradient(90deg, ${withAlpha(conditionalRule.backgroundColor, 0.18)} 0%, ${withAlpha(
      conditionalRule.backgroundColor,
      0.08,
    )} 100%)`;
    style.boxShadow = `inset 3px 0 0 ${withAlpha(conditionalRule.backgroundColor, 0.72)}`;
    return style;
  }

  if (conditionalRule?.tone) {
    const toneStyle = resolveConditionalToneStyle(conditionalRule, tokens);
    style.color = toneStyle.textColor;
    style.background = `linear-gradient(90deg, ${withAlpha(toneStyle.backgroundColor, 0.16)} 0%, ${withAlpha(
      toneStyle.backgroundColor,
      0.05,
    )} 100%)`;
    style.boxShadow = `inset 3px 0 0 ${withAlpha(toneStyle.backgroundColor, 0.44)}`;
    return style;
  }

  if (
    !supportsNumericFormatting ||
    (columnConfig.gradientMode !== "fill" && !columnConfig.heatmap) ||
    numericValue === null
  ) {
    return style;
  }

  const effectivePalette =
    columnConfig.heatmapPalette === "auto"
      ? (visualRange && visualRange.min < 0 && visualRange.max > 0
          ? "blue-white-red"
          : "viridis")
      : columnConfig.heatmapPalette;
  const heatmapColor = getInterpolatedPaletteColor(
    getHeatmapPaletteStops(effectivePalette),
    getHeatmapNormalizedRatio(numericValue, visualRange),
  );

  style.backgroundColor = withAlpha(
    heatmapColor,
    getHeatmapBackgroundAlpha(numericValue, visualRange),
  );
  style.boxShadow = `inset 0 0 0 1px ${withAlpha(heatmapColor, 0.18)}`;

  return style;
}

function TableFrameCellRenderer({
  value,
  columnConfig,
  customCellRenderers,
  data,
  range,
  resolvedProps,
  tokens,
}: TableFrameCellRendererParams) {
  const cellValue = value ?? null;
  const formattedValue = formatTableWidgetValue(cellValue, columnConfig);
  const customCellRenderer = customCellRenderers?.[columnConfig.key];

  if (customCellRenderer) {
    const customContent = customCellRenderer({
      columnConfig,
      formattedValue,
      range,
      resolvedProps,
      row: data,
      tokens,
      value: cellValue,
    });

    if (customContent !== undefined) {
      return customContent;
    }
  }

  const supportsNumericFormatting = supportsNumericDisplay(columnConfig);
  const numericValue = supportsNumericFormatting ? getTableWidgetNumericValue(cellValue) : null;
  const conditionalRule =
    numericValue === null
      ? null
      : getMatchingConditionalRule(resolvedProps, columnConfig.key, numericValue);
  const valueLabel =
    supportsValueLabels(columnConfig)
      ? getTableWidgetValueLabel(resolvedProps, columnConfig.key, cellValue)
      : null;
  const alignmentClasses = getAlignmentClasses(columnConfig.align);
  const visualRange = resolveColumnVisualRange(columnConfig, range);

  if (valueLabel) {
    const toneStyle = resolveLabelToneStyle(valueLabel, tokens);
    return (
      <div className={`flex h-full w-full items-center overflow-hidden ${alignmentClasses}`}>
        <span
          className={getValueLabelChipClass(resolvedProps.density)}
          style={{
            color: toneStyle.textColor,
            backgroundColor: toneStyle.backgroundColor,
            borderColor: toneStyle.borderColor,
            maxHeight: resolvedProps.density === "compact" ? "calc(100% - 6px)" : "calc(100% - 8px)",
          }}
        >
          <span className="truncate">{valueLabel.label ?? formattedValue}</span>
        </span>
      </div>
    );
  }

  const fillRatio =
    supportsNumericFormatting &&
    numericValue !== null &&
    columnConfig.barMode === "fill" &&
    columnConfig.gaugeMode === "none"
      ? getBarFillRatio(numericValue, visualRange)
      : 0;
  const fillTone =
    numericValue !== null ? getColumnTone(numericValue, visualRange, tokens) : tokens.primary;
  const showGauge = supportsNumericFormatting && columnConfig.gaugeMode === "ring";
  const gaugeVisual =
    showGauge && numericValue !== null
      ? resolveTableGaugeVisual(numericValue, visualRange, conditionalRule, tokens)
      : null;

  return (
    <div className={`relative flex h-full w-full items-center overflow-hidden ${alignmentClasses}`}>
      {fillRatio > 0 ? (
        <div
          className="pointer-events-none absolute inset-y-1 left-0 rounded-[6px]"
          style={{
            width: `${Math.max(fillRatio * 100, 6)}%`,
            background: `linear-gradient(90deg, ${withAlpha(fillTone, 0.18)} 0%, ${withAlpha(
              fillTone,
              0.42,
            )} 100%)`,
            boxShadow: `inset 0 0 0 1px ${withAlpha(fillTone, 0.22)}`,
          }}
        />
      ) : null}
      {showGauge ? (
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-0 h-2 -translate-y-1/2">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor: withAlpha(tokens.border, 0.12),
              boxShadow: `inset 0 0 0 1px ${withAlpha(tokens.border, 0.2)}`,
            }}
          />
          {gaugeVisual && gaugeVisual.direction ? (
            <div
              className="absolute inset-y-0"
              style={{
                ...(gaugeVisual.direction === "right"
                  ? {
                      left: "50%",
                      width: `${gaugeVisual.ratio * 50}%`,
                      minWidth: gaugeVisual.ratio > 0 ? "2px" : undefined,
                      borderRadius: "0 9999px 9999px 0",
                      background: `linear-gradient(90deg, ${withAlpha(gaugeVisual.color, 0.88)} 0%, ${withAlpha(
                        gaugeVisual.color,
                        0.4,
                      )} 100%)`,
                    }
                  : {
                      right: "50%",
                      width: `${gaugeVisual.ratio * 50}%`,
                      minWidth: gaugeVisual.ratio > 0 ? "2px" : undefined,
                      borderRadius: "9999px 0 0 9999px",
                      background: `linear-gradient(90deg, ${withAlpha(gaugeVisual.color, 0.4)} 0%, ${withAlpha(
                        gaugeVisual.color,
                        0.88,
                      )} 100%)`,
                    }),
                boxShadow: `inset 0 0 0 1px ${withAlpha(gaugeVisual.color, 0.28)}`,
              }}
            />
          ) : null}
          <div
            className="absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2"
            style={{ backgroundColor: withAlpha(tokens.border, 0.72) }}
          />
        </div>
      ) : null}
      <span
        className="relative z-10 w-full truncate font-medium tabular-nums"
        style={{ color: conditionalRule?.textColor }}
      >
        {formattedValue}
      </span>
    </div>
  );
}

export function TableFrameView({
  customCellRenderers,
  dataErrorMessage,
  emptyMessage = "No rows were returned for the selected period.",
  getRowStyle,
  isDataLoading = false,
  quickFilterPlaceholder = "Quick filter rows, labels, and routes",
  resolvedProps,
  resolvedTokens = mainSequenceSpaceTheme.tokens,
  rowObjects: rowObjectsOverride,
  showColumnFilters = true,
  selectionKeyFields = [],
  selectionMode = "none",
  selectionState,
  surface = "card",
  tightness = mainSequenceSpaceTheme.tightness,
  toolbarStart,
  onSelectionChange,
}: TableFrameViewProps) {
  const tightnessMetrics = useMemo(() => getThemeTightnessMetrics(tightness), [tightness]);
  const [quickFilter, setQuickFilter] = useState("");
  const deferredQuickFilter = useDeferredValue(quickFilter);
  const gridApiRef = useRef<GridApi<TableFrameGridRow> | null>(null);
  const isApplyingSelectionRef = useRef(false);
  const latestSelectionStateRef = useRef<TableWidgetSelectionState | undefined>(selectionState);
  const rowObjects = useMemo(
    () => rowObjectsOverride ?? buildTableWidgetRowObjects(resolvedProps.columns, resolvedProps.rows),
    [resolvedProps.columns, resolvedProps.rows, rowObjectsOverride],
  );
  const rowData = useMemo<TableFrameGridRow[]>(
    () =>
      rowObjects.map((row, rowIndex) => {
        const rowKey = buildTableWidgetRowKey(row, selectionKeyFields);

        return rowKey
          ? {
              ...row,
              __tableRowIndex: rowIndex,
              __tableRowKey: rowKey,
            }
          : {
              ...row,
              __tableRowIndex: rowIndex,
            };
      }),
    [rowObjects, selectionKeyFields],
  );
  const columns = useMemo(
    () => resolveTableWidgetColumns(resolvedProps),
    [resolvedProps],
  );
  const schemaValidation = useMemo(
    () => validateTableWidgetSchema(rowObjects, columns),
    [columns, rowObjects],
  );
  const theme = useMemo(
    () =>
      createAgGridTerminalTheme(resolvedTokens, tightnessMetrics.table, {
        transparentSurface: surface === "transparent",
      }),
    [resolvedTokens, surface, tightnessMetrics],
  );
  const columnRanges = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [column.key, getTableWidgetColumnRange(rowObjects, column.key)]),
      ) satisfies Record<string, TableFrameColumnRange>,
    [columns, rowObjects],
  );
  const isActiveCell = useCallback(
    (row: TableFrameGridRow | undefined, columnKey: string) => {
      if (!row || !selectionState?.activeCell || selectionMode !== "cell") {
        return false;
      }

      const activeCell = selectionState.activeCell;
      if (activeCell.columnKey !== columnKey) {
        return false;
      }

      if (activeCell.rowKey && row.__tableRowKey) {
        return activeCell.rowKey === row.__tableRowKey;
      }

      return activeCell.rowIndex === row.__tableRowIndex;
    },
    [selectionMode, selectionState],
  );
  const columnDefs = useMemo<ColDef<TableFrameGridRow>[]>(
    () =>
      columns.map((column) => {
        const numericFormat = isTableWidgetNumericFormat(column.format);
        const columnFiltersVisible = showColumnFilters && resolvedProps.showColumnFilters;

        return {
          field: column.key,
          colId: column.key,
          headerName: column.label,
          headerTooltip: column.description,
          minWidth: column.minWidth ?? 110,
          flex: column.flex ?? 1,
          hide: !column.visible,
          pinned: column.pinned,
          sortable: true,
          resizable: true,
          filter: columnFiltersVisible
            ? numericFormat
              ? "agNumberColumnFilter"
              : "agTextColumnFilter"
            : false,
          floatingFilter: columnFiltersVisible,
          suppressHeaderMenuButton: !columnFiltersVisible,
          cellDataType: numericFormat ? "number" : "text",
          comparator:
            column.format === "datetime"
              ? (leftValue: TableWidgetCellValue, rightValue: TableWidgetCellValue) => {
                  const leftTime = parseTableWidgetDateTimeValue(
                    leftValue ?? null,
                    column.dateTimeInputFormat,
                  );
                  const rightTime = parseTableWidgetDateTimeValue(
                    rightValue ?? null,
                    column.dateTimeInputFormat,
                  );

                  if (leftTime !== null && rightTime !== null) {
                    return leftTime - rightTime;
                  }

                  return String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
                }
              : undefined,
          tooltipValueGetter: (params) => formatTableWidgetValue(params.value ?? null, column),
          cellStyle: (params) => {
            const baseStyle = createTableCellStyle({
              value: params.value ?? null,
              columnConfig: column,
              resolvedProps,
              range: columnRanges[column.key] ?? null,
              tokens: resolvedTokens,
            });

            if (!isActiveCell(params.data, column.key)) {
              return baseStyle;
            }

            return {
              ...baseStyle,
              backgroundColor: withAlpha(resolvedTokens.primary, 0.18),
              boxShadow: [
                baseStyle.boxShadow,
                `inset 0 0 0 1px ${withAlpha(resolvedTokens.primary, 0.88)}`,
              ].filter(Boolean).join(", "),
            };
          },
          cellRenderer: TableFrameCellRenderer,
          cellRendererParams: {
            columnConfig: column,
            customCellRenderers,
            resolvedProps,
            range: columnRanges[column.key] ?? null,
            tokens: resolvedTokens,
          },
        };
      }),
    [
      columnRanges,
      columns,
      customCellRenderers,
      isActiveCell,
      resolvedProps,
      resolvedTokens,
      showColumnFilters,
    ],
  );
  const defaultColDef = useMemo<ColDef<TableFrameGridRow>>(
    () => ({
      sortable: true,
      resizable: true,
      filter: showColumnFilters && resolvedProps.showColumnFilters,
      floatingFilter: showColumnFilters && resolvedProps.showColumnFilters,
      flex: 1,
      minWidth: 110,
    }),
    [resolvedProps.showColumnFilters, showColumnFilters],
  );
  const rowHeight =
    resolvedProps.density === "compact"
      ? tightnessMetrics.table.agGridRowHeight
      : tightnessMetrics.table.agGridRowHeight + 6;
  const headerHeight =
    resolvedProps.density === "compact"
      ? tightnessMetrics.table.agGridHeaderHeight
      : tightnessMetrics.table.agGridHeaderHeight + 4;
  const showToolbar = Boolean(toolbarStart) || (resolvedProps.showToolbar && resolvedProps.showSearch);
  const transparentSurface = surface === "transparent";
  const rowSelection = useMemo<RowSelectionOptions<TableFrameGridRow> | undefined>(() => {
    if (selectionMode === "single-row") {
      return {
        mode: "singleRow",
        enableClickSelection: true,
        checkboxes: false,
      };
    }

    if (selectionMode === "multi-row") {
      return {
        mode: "multiRow",
        enableClickSelection: true,
        enableSelectionWithoutKeys: true,
        checkboxes: true,
        headerCheckbox: false,
      };
    }

    return undefined;
  }, [selectionMode]);
  const buildSelectionState = useCallback(
    (
      selectedRows: TableFrameGridRow[],
      activeRow: TableFrameGridRow | null,
      activeCell?: TableWidgetSelectionState["activeCell"],
      selectedCells: TableWidgetSelectionState["selectedCells"] = [],
    ): TableWidgetSelectionState => ({
      mode: selectionMode,
      selectedRowKeys: selectedRows
        .map((row) => row.__tableRowKey)
        .filter((value): value is string => Boolean(value)),
      selectedRowIndices: selectedRows.map((row) => row.__tableRowIndex),
      activeRowKey: activeRow?.__tableRowKey,
      activeRowIndex: activeRow?.__tableRowIndex,
      activeCell,
      selectedCells,
      updatedAtMs: Date.now(),
    }),
    [selectionMode],
  );
  const publishSelectionChange = useCallback(
    (selection: TableWidgetSelectionState) => {
      latestSelectionStateRef.current = selection;
      onSelectionChange?.(selection);
    },
    [onSelectionChange],
  );
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TableFrameGridRow>) => {
      if (
        isApplyingSelectionRef.current ||
        selectionMode === "none" ||
        selectionMode === "cell" ||
        !onSelectionChange
      ) {
        return;
      }

      const selectedRows = event.api.getSelectedRows();
      const activeRow = selectedRows[selectedRows.length - 1] ?? null;
      const previousActiveCell = latestSelectionStateRef.current?.activeCell;
      const activeCell = tableActiveCellBelongsToRow(previousActiveCell, activeRow)
        ? previousActiveCell
        : tableActiveCellFromFocusedCell(event.api, activeRow);

      publishSelectionChange(buildSelectionState(selectedRows, activeRow, activeCell));
    },
    [
      buildSelectionState,
      onSelectionChange,
      publishSelectionChange,
      selectionMode,
    ],
  );
  const handleCellClicked = useCallback(
    (event: CellClickedEvent<TableFrameGridRow>) => {
      const columnKey = event.colDef.field ?? event.column.getColId();

      if (selectionMode === "none" || !event.data || !onSelectionChange) {
        return;
      }

      if (selectionMode === "cell") {
        return;
      }

      if (!columnKey) {
        return;
      }

      const activeCell: TableWidgetSelectionState["activeCell"] = {
        rowKey: event.data.__tableRowKey,
        rowIndex: event.data.__tableRowIndex,
        columnKey,
        value: event.data[columnKey] ?? null,
      };
      const selectedRows =
        selectionMode === "multi-row" && typeof event.api?.getSelectedRows === "function"
          ? event.api.getSelectedRows()
          : [event.data];
      const selectedRowsWithActive = selectedRows.some((row) =>
        row.__tableRowKey && event.data?.__tableRowKey
          ? row.__tableRowKey === event.data.__tableRowKey
          : row.__tableRowIndex === event.data?.__tableRowIndex,
      )
        ? selectedRows
        : [...selectedRows, event.data];

      publishSelectionChange(
        buildSelectionState(selectedRowsWithActive, event.data, activeCell),
      );
    },
    [
      buildSelectionState,
      onSelectionChange,
      publishSelectionChange,
      selectionMode,
    ],
  );
  const handleCellSelectionChanged = useCallback(
    (event: CellSelectionChangedEvent<TableFrameGridRow>) => {
      if (
        isApplyingSelectionRef.current ||
        selectionMode !== "cell" ||
        !onSelectionChange ||
        event.finished !== true
      ) {
        return;
      }

      const { selectedCells, selectedRows } = collectTableRangeSelection(event.api);
      const activeCell = tableActiveCellFromFocusedSelection(event.api, selectedCells);
      const activeRow = activeCell
        ? (selectedRows.find((row) =>
            activeCell.rowKey && row.__tableRowKey
              ? row.__tableRowKey === activeCell.rowKey
              : row.__tableRowIndex === activeCell.rowIndex,
          ) ?? null)
        : (selectedRows[selectedRows.length - 1] ?? null);

      publishSelectionChange(
        buildSelectionState(selectedRows, activeRow, activeCell, selectedCells),
      );
    },
    [
      buildSelectionState,
      onSelectionChange,
      publishSelectionChange,
      selectionMode,
    ],
  );
  const syncGridSelectionFromState = useCallback(
    (api: GridApi<TableFrameGridRow>) => {
      if (selectionMode === "cell") {
        return;
      }

      const selectedKeySet = new Set(selectionState?.selectedRowKeys ?? []);
      const selectedIndexSet = new Set(selectionState?.selectedRowIndices ?? []);

      isApplyingSelectionRef.current = true;
      try {
        if (selectionMode === "none" || (!selectedKeySet.size && !selectedIndexSet.size)) {
          api.deselectAll();
          return;
        }

        api.forEachNode((node) => {
          const row = node.data;
          if (!row) {
            node.setSelected(false);
            return;
          }

          const shouldSelect =
            (row.__tableRowKey ? selectedKeySet.has(row.__tableRowKey) : false) ||
            selectedIndexSet.has(row.__tableRowIndex);
          if (node.isSelected() !== shouldSelect) {
            node.setSelected(shouldSelect);
          }
        });
      } finally {
        isApplyingSelectionRef.current = false;
      }
    },
    [selectionMode, selectionState],
  );

  useEffect(() => {
    if (!resolvedProps.showSearch && quickFilter) {
      setQuickFilter("");
    }
  }, [quickFilter, resolvedProps.showSearch]);

  useEffect(() => {
    latestSelectionStateRef.current = selectionState;
  }, [selectionState]);

  useEffect(() => {
    if (!gridApiRef.current) {
      return;
    }

    syncGridSelectionFromState(gridApiRef.current);
  }, [rowData, syncGridSelectionFromState]);

  if (isDataLoading && rowObjects.length === 0) {
    return <Skeleton className="h-full" />;
  }

  if (dataErrorMessage) {
    return (
      <div className="border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {dataErrorMessage}
      </div>
    );
  }

  return (
    <AgGridProvider modules={agGridModules}>
      <div
        className={cn(
          "flex h-full min-h-[280px] flex-col overflow-hidden border border-border/70 text-foreground",
          transparentSurface ? "bg-transparent" : "bg-card/70",
        )}
      >
        {showToolbar ? (
          <div
            className={cn(
              "border-b border-border/70 px-4 py-3",
              transparentSurface ? "bg-transparent" : "bg-card/88",
            )}
          >
            <div className="flex flex-wrap items-center justify-end gap-2">
              {toolbarStart ? (
                <div className="mr-auto min-w-0">
                  {toolbarStart}
                </div>
              ) : null}
              {resolvedProps.showSearch ? (
                <div className="flex min-w-[280px] flex-1 flex-wrap items-center justify-end gap-2">
                  <Input
                    value={quickFilter}
                    onChange={(event) => {
                      setQuickFilter(event.target.value);
                    }}
                    placeholder={quickFilterPlaceholder}
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!quickFilter}
                    onClick={() => {
                      setQuickFilter("");
                    }}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!schemaValidation.isValid ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <div className="w-full max-w-3xl border border-danger/40 bg-danger/10 px-4 py-4 text-sm text-danger">
              <div className="font-medium text-foreground">Wrong schema affects rendering</div>
              <p className="mt-1 text-danger/90">
                The current widget schema does not match the available row shape, so the table cannot render reliably.
              </p>
              <ul className="mt-3 space-y-1">
                {schemaValidation.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{formatSchemaValidationIssue(issue)}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <AgGridReact<TableFrameGridRow>
              theme={theme}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              quickFilterText={resolvedProps.showSearch ? deferredQuickFilter : ""}
              animateRows
              enableCellTextSelection
              cellSelection={selectionMode === "cell"}
              rowSelection={rowSelection}
              suppressRowClickSelection={selectionMode === "cell"}
              getRowId={(params) =>
                params.data.__tableRowKey ?? String(params.data.__tableRowIndex)
              }
              pagination={resolvedProps.pagination}
              paginationPageSize={resolvedProps.pageSize}
              rowHeight={rowHeight}
              headerHeight={headerHeight}
              onGridReady={(event) => {
                gridApiRef.current = event.api;
                syncGridSelectionFromState(event.api);
              }}
              onGridPreDestroyed={() => {
                gridApiRef.current = null;
              }}
              onSelectionChanged={handleSelectionChanged}
              onCellClicked={handleCellClicked}
              onCellSelectionChanged={handleCellSelectionChanged}
              getRowStyle={(params) => {
                const baseStyle =
                  resolvedProps.zebraRows
                    ? undefined
                    : {
                        backgroundColor: transparentSurface
                          ? "transparent"
                          : withAlpha(resolvedTokens.card, 0.98),
                      };
                const customStyle = getRowStyle?.(params.data);

                if (!baseStyle && !customStyle) {
                  return undefined;
                }

                return {
                  ...baseStyle,
                  ...customStyle,
                };
              }}
            />
          </div>
        )}

        {!isDataLoading &&
        !dataErrorMessage &&
        rowObjects.length === 0 &&
        emptyMessage ? (
          <div
            className={cn(
              "border-t border-border/70 px-4 py-3 text-sm text-muted-foreground",
              transparentSurface ? "bg-transparent" : "bg-background/22",
            )}
          >
            {emptyMessage}
          </div>
        ) : null}
      </div>
    </AgGridProvider>
  );
}
