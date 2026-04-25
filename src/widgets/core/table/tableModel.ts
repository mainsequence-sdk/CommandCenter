import type { TabularSourceDetail, TabularDataRow } from "@/widgets/shared/tabular-widget-source";
import {
  buildTabularFieldOptions,
  formatTabularSourceLabel,
  type TabularFieldOption,
} from "@/widgets/shared/tabular-widget-source";
import {
  buildManualTableFieldOptions,
  normalizeTabularWidgetSourceReferenceProps,
  normalizeManualTableColumns,
  normalizeManualTableRows,
  type TabularWidgetSourceReferenceProps,
  type TabularWidgetSourceMode,
  type ManualTableColumnDefinition,
} from "@/widgets/shared/tabular-widget-source";

export type TableWidgetDateRangeMode = "dashboard" | "fixed";
export type TableWidgetSourceMode = "bound" | "manual";
export type TableWidgetColumnFormat =
  | "auto"
  | "text"
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

export type TableWidgetCellValue = number | string | boolean | null;
export type TableWidgetRow = Record<string, TableWidgetCellValue>;
export type TableWidgetFrameRow = TableWidgetCellValue[];

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

export interface TableWidgetProps
  extends Record<string, unknown>,
    TabularWidgetSourceReferenceProps {
  tableSourceMode?: TableWidgetSourceMode;
  sourceId?: number;
  dateRangeMode?: TableWidgetDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  uniqueIdentifierList?: string[];
  manualColumns?: ManualTableColumnDefinition[];
  manualRows?: Array<Record<string, unknown>>;
  limit?: number;
  columns?: string[];
  rows?: TableWidgetFrameRow[];
  schema?: TableWidgetColumnSchema[];
  density?: TableWidgetDensity;
  showToolbar?: boolean;
  showSearch?: boolean;
  zebraRows?: boolean;
  pagination?: boolean;
  pageSize?: number;
  columnOverrides?: Record<string, TableWidgetColumnOverride>;
  valueLabels?: TableWidgetValueLabel[];
  conditionalRules?: TableWidgetConditionalRule[];
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
  tableSourceMode: TableWidgetSourceMode;
  sourceId?: number;
  sourceLabel?: string;
  dateRangeMode: TableWidgetDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  sourceMode: TabularWidgetSourceMode;
  sourceWidgetId?: string;
  uniqueIdentifierList?: string[];
  manualColumns: ManualTableColumnDefinition[];
  manualRows: Array<Record<string, unknown>>;
  limit: number;
  supportsUniqueIdentifierList: boolean;
  columns: string[];
  rows: TableWidgetFrameRow[];
  schema: TableWidgetColumnSchema[];
  density: TableWidgetDensity;
  showToolbar: boolean;
  showSearch: boolean;
  zebraRows: boolean;
  pagination: boolean;
  pageSize: number;
  columnOverrides: Record<string, TableWidgetColumnOverride>;
  valueLabels: TableWidgetValueLabel[];
  conditionalRules: TableWidgetConditionalRule[];
}

export interface TableWidgetResolvedFrameInput {
  columns: string[];
  rows: TableWidgetFrameRow[];
  schemaFallback: TableWidgetColumnSchema[];
  supportsUniqueIdentifierList?: boolean;
  sourceLabel?: string;
}

export interface TableWidgetSchemaValidationIssue {
  code: "empty_schema" | "missing_columns" | "non_numeric_columns";
  columnKeys?: string[];
}

export interface TableWidgetSchemaValidationResult {
  isValid: boolean;
  issues: TableWidgetSchemaValidationIssue[];
}

const defaultPageSize = 10;
const defaultRemoteLimit = 500;
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;

function isTimeLikeField(field: Pick<TabularFieldOption, "key" | "type"> | undefined) {
  if (!field) {
    return false;
  }

  return (
    field.type === "datetime" ||
    field.type === "date" ||
    field.type === "time" ||
    /date|time|timestamp/i.test(field.key)
  );
}

function isKeyLikeField(field: Pick<TabularFieldOption, "key"> | undefined) {
  if (!field) {
    return false;
  }

  return /^(unique_identifier|identifier)$/i.test(field.key.trim());
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function normalizeTone(value: unknown): TableWidgetTone | undefined {
  return value === "neutral" ||
    value === "primary" ||
    value === "success" ||
    value === "warning" ||
    value === "danger"
    ? value
    : undefined;
}

function normalizeCellValue(value: unknown): TableWidgetCellValue {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return String(value);
}

function normalizeTableSourceMode(value: unknown): TableWidgetSourceMode {
  return value === "manual" ? "manual" : "bound";
}

function coerceManualTableCellValue(
  value: unknown,
  fieldType: TabularFieldOption["type"],
): TableWidgetCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  if (fieldType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (/^true$/i.test(value.trim())) {
        return true;
      }

      if (/^false$/i.test(value.trim())) {
        return false;
      }
    }

    return null;
  }

  if (fieldType === "number" || fieldType === "integer") {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.trim())
          : Number.NaN;

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return fieldType === "integer" ? Math.trunc(parsed) : parsed;
  }

  if (fieldType === "json") {
    if (typeof value === "string") {
      return value.trim();
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return normalizeCellValue(value);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return values.filter((value): value is string => {
    if (!value?.trim()) {
      return false;
    }

    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeDateRangeMode(value: unknown): TableWidgetDateRangeMode {
  return value === "fixed" ? "fixed" : "dashboard";
}

function normalizeUniqueIdentifierList(value: unknown) {
  if (typeof value === "string") {
    return uniqueStrings(value.split(/[\n,]+/).map((item) => item.trim()));
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedValues = uniqueStrings(
    value.map((item) => (typeof item === "string" ? item.trim() : "")),
  );

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

function inferRemoteColumnFormatFromKey(
  key: string,
  fieldType: TabularFieldOption["type"] | undefined,
  nativeType: string | null | undefined,
  rows: readonly TableWidgetFrameRow[],
  columnIndex: number,
): Exclude<TableWidgetColumnFormat, "auto"> {
  if (
    fieldType === "datetime" ||
    fieldType === "date" ||
    fieldType === "time" ||
    (nativeType && /date|time|timestamp/i.test(nativeType))
  ) {
    return "text";
  }

  if (
    fieldType === "number" ||
    fieldType === "integer" ||
    (nativeType && /int|float|double|decimal|number|numeric|real|bigint/i.test(nativeType))
  ) {
    if (/%|pct|percent/i.test(key)) {
      return "percent";
    }

    if (/bps/i.test(key)) {
      return "bps";
    }

    if (/price|cost|value|gross|net|pnl|notional|amount|exposure/i.test(key)) {
      return "currency";
    }

    return "number";
  }

  return inferSchemaFormatFromRows(key, rows, columnIndex);
}

export function buildTableWidgetFrameFromRemoteData(
  detail?: TabularSourceDetail | null,
  remoteRows: readonly TabularDataRow[] = [],
  runtimeColumns: readonly string[] = [],
  runtimeFields: readonly TabularFieldOption[] = [],
): TableWidgetResolvedFrameInput {
  const fieldOptions = runtimeFields.length > 0 ? runtimeFields : buildTabularFieldOptions(detail);
  const fieldOptionByKey = new Map(fieldOptions.map((field) => [field.key, field]));
  const rowKeys = uniqueStrings(remoteRows.flatMap((row) => Object.keys(row)));
  const normalizedRuntimeColumns = uniqueStrings(
    runtimeColumns.map((column) => (typeof column === "string" ? column.trim() : "")),
  );
  const columns =
    normalizedRuntimeColumns.length > 0 || rowKeys.length > 0
      ? uniqueStrings([...normalizedRuntimeColumns, ...rowKeys])
      : uniqueStrings(fieldOptions.map((field) => field.key));
  const rows = remoteRows.map((row) => columns.map((columnKey) => normalizeCellValue(row[columnKey])));
  const schemaFallback = columns.map<TableWidgetColumnSchema>((columnKey, index) => {
    const field = fieldOptionByKey.get(columnKey);
    const label = field?.label?.trim() || columnKey;
    const format = inferRemoteColumnFormatFromKey(
      columnKey,
      field?.type,
      field?.nativeType,
      rows,
      index,
    );

    return {
      key: columnKey,
      label,
      description: field?.description ?? undefined,
      format,
      minWidth: isTimeLikeField(field) ? 160 : format === "text" ? 140 : 120,
      pinned: isKeyLikeField(field) ? "left" : undefined,
      categorical: format === "text",
      heatmapEligible: format !== "text",
      compact:
        format === "currency" &&
        /gross|net|pnl|notional|amount|exposure|value/i.test(columnKey),
    };
  });

  return {
    columns,
    rows,
    schemaFallback,
    supportsUniqueIdentifierList:
      (detail?.sourcetableconfiguration?.index_names ?? []).includes("unique_identifier"),
    sourceLabel: formatTabularSourceLabel(detail),
  };
}

export function buildTableWidgetFrameFromManualData(
  props: Pick<TableWidgetProps, "manualColumns" | "manualRows">,
): TableWidgetResolvedFrameInput {
  const manualColumns = normalizeManualTableColumns(props.manualColumns);
  const manualRows = normalizeManualTableRows(props.manualRows);
  const fields = buildManualTableFieldOptions({
    columns: manualColumns,
    rows: manualRows,
  });
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const columns = fields.map((field) => field.key);
  const rows = manualRows.map<TableWidgetFrameRow>((row) =>
    columns.map((columnKey) => {
      const field = fieldByKey.get(columnKey);
      return coerceManualTableCellValue(row[columnKey], field?.type ?? "string");
    }),
  );
  const schemaFallback = fields.map<TableWidgetColumnSchema>((field, index) => {
    const format = inferRemoteColumnFormatFromKey(
      field.key,
      field.type,
      field.nativeType,
      rows,
      index,
    );

    return {
      key: field.key,
      label: field.label ?? field.key,
      description: field.description ?? undefined,
      format,
      minWidth: isTimeLikeField(field) ? 160 : format === "text" ? 140 : 120,
      categorical: format === "text",
      heatmapEligible: format !== "text",
    };
  });

  return {
    columns,
    rows,
    schemaFallback,
    supportsUniqueIdentifierList: false,
    sourceLabel: "Manual table",
  };
}

function normalizeFrameColumns(value: unknown, fallback: readonly string[]) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const seen = new Set<string>();
  const normalized = value.flatMap((entry) => {
    if (typeof entry !== "string" || !entry.trim()) {
      return [];
    }

    const key = entry.trim();

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [key];
  });

  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeFrameRows(value: unknown, columnCount: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry)) {
      return [];
    }

    const row = Array.from({ length: columnCount }, (_, index) =>
      normalizeCellValue(entry[index]),
    );

    return [row];
  });
}

function inferSchemaFormatFromRows(
  columnKey: string,
  rows: readonly TableWidgetFrameRow[],
  columnIndex: number,
): Exclude<TableWidgetColumnFormat, "auto"> {
  const values = rows
    .map((row) => row[columnIndex])
    .filter((value) => value !== null && value !== undefined && value !== "");

  if (values.length === 0) {
    return "text";
  }

  const allNumeric = values.every((value) => getTableWidgetNumericValue(value) !== null);

  if (allNumeric) {
    if (/%|pct|percent/i.test(columnKey)) {
      return "percent";
    }

    if (/bps/i.test(columnKey)) {
      return "bps";
    }

    if (/price|cost|value|gross|net|pnl|notional|amount|exposure/i.test(columnKey)) {
      return "currency";
    }

    return "number";
  }

  return "text";
}

function createSchemaTemplateFromFrame(
  columns: readonly string[],
  rows: readonly TableWidgetFrameRow[],
  schemaFallback: readonly TableWidgetColumnSchema[] = [],
) {
  const schemaFallbackByKey = new Map(schemaFallback.map((column) => [column.key, column]));

  return columns.map<TableWidgetColumnSchema>((columnKey, index) => {
    const existing = schemaFallbackByKey.get(columnKey);

    if (existing) {
      return { ...existing };
    }

    return {
      key: columnKey,
      label: columnKey,
      format: inferSchemaFormatFromRows(columnKey, rows, index),
      categorical: false,
    };
  });
}

function normalizeColumnSchema(value: unknown): TableWidgetColumnSchema | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as TableWidgetColumnSchema;
  if (typeof record.key !== "string" || !record.key.trim()) {
    return undefined;
  }

  if (typeof record.label !== "string" || !record.label.trim()) {
    return undefined;
  }

  if (
    record.format !== "text" &&
    record.format !== "number" &&
    record.format !== "currency" &&
    record.format !== "percent" &&
    record.format !== "bps"
  ) {
    return undefined;
  }

  const nextValue: TableWidgetColumnSchema = {
    key: record.key.trim(),
    label: record.label.trim(),
    format: record.format,
  };

  if (typeof record.description === "string" && record.description.trim()) {
    nextValue.description = record.description.trim();
  }

  if (typeof record.minWidth === "number" && Number.isFinite(record.minWidth)) {
    nextValue.minWidth = Math.max(60, Math.trunc(record.minWidth));
  }

  if (typeof record.flex === "number" && Number.isFinite(record.flex)) {
    nextValue.flex = Math.max(0, record.flex);
  }

  if (record.pinned === "left" || record.pinned === "right") {
    nextValue.pinned = record.pinned;
  }

  if (typeof record.decimals === "number" && Number.isFinite(record.decimals)) {
    nextValue.decimals = Math.max(0, Math.min(Math.trunc(record.decimals), 6));
  }

  if (typeof record.prefix === "string") {
    nextValue.prefix = record.prefix;
  }

  if (typeof record.suffix === "string") {
    nextValue.suffix = record.suffix;
  }

  if (typeof record.categorical === "boolean") {
    nextValue.categorical = record.categorical;
  }

  if (typeof record.heatmapEligible === "boolean") {
    nextValue.heatmapEligible = record.heatmapEligible;
  }

  if (typeof record.compact === "boolean") {
    nextValue.compact = record.compact;
  }

  return nextValue;
}

function normalizeColumnSchemas(value: unknown, fallback: readonly TableWidgetColumnSchema[] = []) {
  if (!Array.isArray(value)) {
    return cloneTableWidgetSchema(fallback);
  }

  const seenKeys = new Set<string>();
  const normalized = value.flatMap((entry) => {
    const nextEntry = normalizeColumnSchema(entry);

    if (!nextEntry || seenKeys.has(nextEntry.key)) {
      return [];
    }

    seenKeys.add(nextEntry.key);
    return [nextEntry];
  });

  return normalized;
}

export function cloneTableWidgetSchema(
  columns: readonly TableWidgetColumnSchema[],
): TableWidgetColumnSchema[] {
  return columns.map((column) => ({ ...column }));
}

function normalizeColumnOverride(value: unknown): TableWidgetColumnOverride | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as TableWidgetColumnOverride;
  const nextValue: TableWidgetColumnOverride = {};

  if (typeof record.visible === "boolean") {
    nextValue.visible = record.visible;
  }

  if (typeof record.label === "string" && record.label.trim()) {
    nextValue.label = record.label.trim();
  }

  if (
    record.format === "auto" ||
    record.format === "text" ||
    record.format === "number" ||
    record.format === "currency" ||
    record.format === "percent" ||
    record.format === "bps"
  ) {
    nextValue.format = record.format;
  }

  if (typeof record.decimals === "number" && Number.isFinite(record.decimals)) {
    nextValue.decimals = Math.max(0, Math.min(Math.trunc(record.decimals), 6));
  }

  if (typeof record.prefix === "string") {
    nextValue.prefix = record.prefix;
  }

  if (typeof record.suffix === "string") {
    nextValue.suffix = record.suffix;
  }

  if (typeof record.heatmap === "boolean") {
    nextValue.heatmap = record.heatmap;
  }

  if (typeof record.compact === "boolean") {
    nextValue.compact = record.compact;
  }

  if (record.barMode === "fill" || record.barMode === "none") {
    nextValue.barMode = record.barMode;
  }

  if (record.gradientMode === "fill" || record.gradientMode === "none") {
    nextValue.gradientMode = record.gradientMode;
  }

  if (
    record.heatmapPalette === "auto" ||
    record.heatmapPalette === "viridis" ||
    record.heatmapPalette === "plasma" ||
    record.heatmapPalette === "inferno" ||
    record.heatmapPalette === "magma" ||
    record.heatmapPalette === "turbo" ||
    record.heatmapPalette === "jet" ||
    record.heatmapPalette === "blue-white-red" ||
    record.heatmapPalette === "red-yellow-green"
  ) {
    nextValue.heatmapPalette = record.heatmapPalette;
  }

  if (record.gaugeMode === "ring" || record.gaugeMode === "none") {
    nextValue.gaugeMode = record.gaugeMode;
  }

  if (record.visualRangeMode === "auto" || record.visualRangeMode === "fixed") {
    nextValue.visualRangeMode = record.visualRangeMode;
  }

  if (typeof record.visualMin === "number" && Number.isFinite(record.visualMin)) {
    nextValue.visualMin = record.visualMin;
  }

  if (typeof record.visualMax === "number" && Number.isFinite(record.visualMax)) {
    nextValue.visualMax = record.visualMax;
  }

  if (
    record.align === "auto" ||
    record.align === "left" ||
    record.align === "center" ||
    record.align === "right"
  ) {
    nextValue.align = record.align;
  }

  if (record.pinned === "none" || record.pinned === "left" || record.pinned === "right") {
    nextValue.pinned = record.pinned;
  }

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
}

function normalizeValueLabel(value: unknown): TableWidgetValueLabel | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as TableWidgetValueLabel;
  if (typeof record.columnKey !== "string" || !record.columnKey.trim()) {
    return undefined;
  }

  if (typeof record.value !== "string") {
    return undefined;
  }

  return {
    columnKey: record.columnKey.trim(),
    value: record.value,
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : undefined,
    tone: normalizeTone(record.tone),
    textColor: normalizeHexColor(record.textColor),
    backgroundColor: normalizeHexColor(record.backgroundColor),
  };
}

function normalizeConditionalRule(value: unknown): TableWidgetConditionalRule | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as TableWidgetConditionalRule;
  if (typeof record.columnKey !== "string" || !record.columnKey.trim()) {
    return undefined;
  }

  const numericValue = Number(record.value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  if (
    record.operator !== "gt" &&
    record.operator !== "gte" &&
    record.operator !== "lt" &&
    record.operator !== "lte" &&
    record.operator !== "eq"
  ) {
    return undefined;
  }

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : createTableWidgetRuleId(),
    columnKey: record.columnKey.trim(),
    operator: record.operator,
    value: numericValue,
    tone: normalizeTone(record.tone),
    textColor: normalizeHexColor(record.textColor),
    backgroundColor: normalizeHexColor(record.backgroundColor),
  };
}

function normalizeColumnOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, override]) => {
      const normalized = normalizeColumnOverride(override);
      return normalized ? [[key, normalized] as const] : [];
    }),
  ) satisfies Record<string, TableWidgetColumnOverride>;
}

function stripSchemaManagedFieldsFromColumnOverrides(
  value: Record<string, TableWidgetColumnOverride> | undefined,
) {
  return Object.fromEntries(
    Object.entries(normalizeColumnOverrides(value)).flatMap(([key, override]) => {
      const nextOverride = { ...override };
      delete nextOverride.label;
      delete nextOverride.format;

      return Object.keys(nextOverride).length > 0 ? [[key, nextOverride] as const] : [];
    }),
  ) satisfies Record<string, TableWidgetColumnOverride>;
}

const legacyShippedColumnOverrides: Record<string, TableWidgetColumnOverride> = {
  quantity: { barMode: "fill" },
  pnl: { barMode: "fill", heatmap: true },
  exposure: { heatmap: true, compact: true },
  conviction: { barMode: "fill", heatmap: true, suffix: " /10" },
  dayChangePct: { heatmap: true },
  utilizationPct: { barMode: "fill", heatmap: true, suffix: "%" },
  fillRatePct: { barMode: "fill", heatmap: true, suffix: "%" },
  participationPct: { barMode: "fill", heatmap: true, suffix: "%" },
  avgFillMs: { barMode: "fill", heatmap: true, suffix: " ms" },
  notional: { barMode: "fill", heatmap: true, compact: true },
  score: { barMode: "fill", heatmap: true },
  slippageBps: { heatmap: true },
};

const legacyShippedValueLabels: TableWidgetValueLabel[] = [
  { columnKey: "side", value: "Long", label: "Long", tone: "primary" },
  { columnKey: "side", value: "Short", label: "Short", tone: "warning" },
  { columnKey: "status", value: "Active", label: "Active", tone: "success" },
  { columnKey: "status", value: "Watch", label: "Watch", tone: "warning" },
  { columnKey: "status", value: "Trim", label: "Trim", tone: "primary" },
  { columnKey: "status", value: "Reduce", label: "Reduce", tone: "danger" },
  { columnKey: "status", value: "Healthy", label: "Healthy", tone: "success" },
  { columnKey: "status", value: "Critical", label: "Critical", tone: "danger" },
  { columnKey: "regime", value: "Stable", label: "Stable", tone: "success" },
  { columnKey: "regime", value: "Watch", label: "Watch", tone: "warning" },
  { columnKey: "regime", value: "Crowded", label: "Crowded", tone: "warning" },
  { columnKey: "regime", value: "Protective", label: "Protective", tone: "primary" },
  { columnKey: "regime", value: "Hot", label: "Hot", tone: "danger" },
];

const legacyShippedConditionalRules: TableWidgetConditionalRule[] = [
  { id: "pnl-positive", columnKey: "pnl", operator: "gt", value: 0, tone: "primary" },
  { id: "pnl-negative", columnKey: "pnl", operator: "lt", value: 0, tone: "danger" },
  { id: "drawdown-risk", columnKey: "drawdownPct", operator: "lt", value: -5, tone: "danger" },
  { id: "exec-watch", columnKey: "slippageBps", operator: "gt", value: 1.5, tone: "warning" },
  { id: "utilization-hot", columnKey: "utilizationPct", operator: "gt", value: 80, tone: "danger" },
  { id: "reject-rate-hot", columnKey: "rejectRatePct", operator: "gt", value: 1, tone: "danger" },
  { id: "score-low", columnKey: "score", operator: "lt", value: 6, tone: "warning" },
];

function serializeColumnOverridesForComparison(
  value: Record<string, TableWidgetColumnOverride> | undefined,
) {
  const normalized = normalizeColumnOverrides(value);

  return JSON.stringify(
    Object.keys(normalized)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, normalized[key]]),
  );
}

function serializeValueLabelsForComparison(value: TableWidgetValueLabel[] | undefined) {
  return JSON.stringify(
    (value ?? [])
      .map((entry) => normalizeValueLabel(entry))
      .filter((entry): entry is TableWidgetValueLabel => Boolean(entry)),
  );
}

function serializeConditionalRulesForComparison(
  value: TableWidgetConditionalRule[] | undefined,
) {
  return JSON.stringify(
    (value ?? [])
      .map((entry) => normalizeConditionalRule(entry))
      .filter((entry): entry is TableWidgetConditionalRule => Boolean(entry)),
  );
}

const legacyShippedColumnOverridesSignature =
  serializeColumnOverridesForComparison(legacyShippedColumnOverrides);
const legacyShippedValueLabelsSignature =
  serializeValueLabelsForComparison(legacyShippedValueLabels);
const legacyShippedConditionalRulesSignature =
  serializeConditionalRulesForComparison(legacyShippedConditionalRules);

export function stripLegacyTableWidgetDisplayConfig(
  props: TableWidgetProps,
): TableWidgetProps {
  const nextProps: TableWidgetProps = { ...props };

  if (
    serializeColumnOverridesForComparison(props.columnOverrides) ===
    legacyShippedColumnOverridesSignature
  ) {
    nextProps.columnOverrides = {};
  }

  if (
    serializeValueLabelsForComparison(props.valueLabels) ===
    legacyShippedValueLabelsSignature
  ) {
    nextProps.valueLabels = [];
  }

  if (
    serializeConditionalRulesForComparison(props.conditionalRules) ===
    legacyShippedConditionalRulesSignature
  ) {
    nextProps.conditionalRules = [];
  }

  return nextProps;
}

export function createTableWidgetRuleId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `table-rule-${uuid}` : `table-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildTableWidgetRowObjects(
  columns: readonly string[],
  rows: readonly TableWidgetFrameRow[],
) {
  return rows.map<TableWidgetRow>((row) =>
    Object.fromEntries(
      columns.map((columnKey, index) => [columnKey, normalizeCellValue(row[index])]),
    ),
  );
}

function resolveTableWidgetSchemaFromFrame(
  props: Pick<TableWidgetProps, "columnOverrides" | "schema">,
  frameInput: Pick<
    TableWidgetResolvedFrameInput,
    "columns" | "rows" | "schemaFallback"
  >,
) {
  const schemaFallback =
    frameInput.schemaFallback.length > 0
      ? frameInput.schemaFallback
      : createSchemaTemplateFromFrame(frameInput.columns, frameInput.rows);

  if (Array.isArray(props.schema)) {
    const normalizedSchema = normalizeColumnSchemas(props.schema, []);

    if (schemaFallback.length === 0) {
      return normalizedSchema;
    }

    const normalizedSchemaByKey = new Map(
      normalizedSchema.map((column) => [column.key, column] as const),
    );

    return cloneTableWidgetSchema(schemaFallback).map((column) => {
      const savedColumn = normalizedSchemaByKey.get(column.key);

      return savedColumn
        ? {
            ...column,
            ...savedColumn,
            key: column.key,
          }
        : column;
    });
  }

  const normalizedOverrides = normalizeColumnOverrides(props.columnOverrides);

  return cloneTableWidgetSchema(schemaFallback).map((column) => {
    const override = normalizedOverrides[column.key];

    return {
      ...column,
      label: override?.label ?? column.label,
      format:
        override?.format && override.format !== "auto"
          ? override.format
          : column.format,
    };
  });
}

export function resolveTableWidgetPropsWithFrame(
  props: TableWidgetProps,
  frameInput?: TableWidgetResolvedFrameInput | null,
): ResolvedTableWidgetProps {
  const migratedProps = stripLegacyTableWidgetDisplayConfig(props);
  const normalizedSourceReference = normalizeTabularWidgetSourceReferenceProps(migratedProps);
  const tableSourceMode = normalizeTableSourceMode(migratedProps.tableSourceMode);
  const normalizedSourceId = normalizePositiveInteger(migratedProps.sourceId);
  const normalizedFixedStartMs = normalizeTimestampMs(migratedProps.fixedStartMs);
  const normalizedFixedEndMs = normalizeTimestampMs(migratedProps.fixedEndMs);
  const normalizedUniqueIdentifierList = normalizeUniqueIdentifierList(
    migratedProps.uniqueIdentifierList,
  );
  const normalizedLimit =
    normalizePositiveInteger(migratedProps.limit) ?? defaultRemoteLimit;
  const manualColumns = normalizeManualTableColumns(migratedProps.manualColumns);
  const manualRows = normalizeManualTableRows(migratedProps.manualRows);
  const resolvedFrameInput =
    tableSourceMode === "manual"
      ? buildTableWidgetFrameFromManualData({
          manualColumns,
          manualRows,
        })
      : frameInput;
  const columns = normalizeFrameColumns(resolvedFrameInput?.columns, []);
  const rows = normalizeFrameRows(resolvedFrameInput?.rows, columns.length);
  const schema = resolveTableWidgetSchemaFromFrame(
    migratedProps,
    {
      columns,
      rows,
      schemaFallback: resolvedFrameInput?.schemaFallback ?? [],
    },
  );

  return {
    tableSourceMode,
    sourceId: normalizedSourceId,
    sourceLabel:
      resolvedFrameInput?.sourceLabel ??
      (normalizedSourceId
        ? formatTabularSourceLabel({ id: normalizedSourceId, storage_hash: "", identifier: null })
        : undefined),
    dateRangeMode: normalizeDateRangeMode(migratedProps.dateRangeMode),
    fixedStartMs: normalizedFixedStartMs,
    fixedEndMs: normalizedFixedEndMs,
    sourceMode: tableSourceMode === "manual" ? "direct" : "filter_widget",
    sourceWidgetId:
      tableSourceMode === "manual" ? undefined : normalizedSourceReference.sourceWidgetId,
    uniqueIdentifierList: normalizedUniqueIdentifierList,
    manualColumns,
    manualRows,
    limit: normalizedLimit,
    supportsUniqueIdentifierList: Boolean(resolvedFrameInput?.supportsUniqueIdentifierList),
    columns,
    rows,
    schema,
    density: migratedProps.density === "compact" ? "compact" : "comfortable",
    showToolbar: migratedProps.showToolbar !== false,
    showSearch: migratedProps.showSearch !== false,
    zebraRows: migratedProps.zebraRows !== false,
    pagination: migratedProps.pagination !== false,
    pageSize:
      typeof migratedProps.pageSize === "number" && Number.isFinite(migratedProps.pageSize)
        ? Math.max(5, Math.min(Math.trunc(migratedProps.pageSize), 200))
        : defaultPageSize,
    columnOverrides: stripSchemaManagedFieldsFromColumnOverrides(migratedProps.columnOverrides),
    valueLabels: Array.isArray(migratedProps.valueLabels)
      ? migratedProps.valueLabels
          .map((entry) => normalizeValueLabel(entry))
          .filter((entry): entry is TableWidgetValueLabel => Boolean(entry))
      : [],
    conditionalRules: Array.isArray(migratedProps.conditionalRules)
      ? migratedProps.conditionalRules
          .map((entry) => normalizeConditionalRule(entry))
          .filter((entry): entry is TableWidgetConditionalRule => Boolean(entry))
      : [],
  };
}

export function resolveTableWidgetProps(props: TableWidgetProps): ResolvedTableWidgetProps {
  return resolveTableWidgetPropsWithFrame(props);
}

export function resolveTableWidgetColumns(
  props: ResolvedTableWidgetProps,
) {
  return props.schema.map<ResolvedTableWidgetColumnConfig>((column) => {
    const override = props.columnOverrides[column.key] ?? {};
    const effectiveFormat =
      override.format && override.format !== "auto" ? override.format : column.format;

    return {
      ...column,
      label: override.label ?? column.label,
      format: effectiveFormat,
      decimals: override.decimals ?? column.decimals,
      prefix: override.prefix ?? column.prefix,
      suffix: override.suffix ?? column.suffix,
      compact: override.compact ?? column.compact ?? false,
      visible: override.visible ?? true,
      heatmap: effectiveFormat !== "text" ? (override.heatmap ?? false) : false,
      barMode: override.barMode ?? "none",
      gradientMode:
        effectiveFormat !== "text"
          ? ((override.gradientMode ?? ((override.heatmap ?? false) ? "fill" : "none")) as TableWidgetGradientMode)
          : "none",
      heatmapPalette:
        effectiveFormat !== "text"
          ? (override.heatmapPalette ?? "auto")
          : "auto",
      gaugeMode: effectiveFormat !== "text" ? (override.gaugeMode ?? "none") : "none",
      visualRangeMode: override.visualRangeMode ?? "auto",
      visualMin:
        typeof override.visualMin === "number" && Number.isFinite(override.visualMin)
          ? override.visualMin
          : undefined,
      visualMax:
        typeof override.visualMax === "number" && Number.isFinite(override.visualMax)
          ? override.visualMax
          : undefined,
      align:
        override.align && override.align !== "auto"
          ? override.align
          : effectiveFormat === "text"
            ? "left"
            : "right",
      pinned:
        override.pinned && override.pinned !== "none"
          ? override.pinned
          : column.pinned,
    };
  });
}

export function getTableWidgetNumericValue(value: TableWidgetCellValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getTableWidgetValueLabel(
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

export function getTableWidgetColumnRange(
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

export function getTableWidgetCategoricalValues(
  rows: readonly TableWidgetRow[],
  columnKey: string,
) {
  const values = new Set<string>();

  rows.forEach((row) => {
    const value = row[columnKey];
    if (value !== null && value !== undefined && value !== "") {
      values.add(String(value));
    }
  });

  return [...values.values()];
}

export function validateTableWidgetSchema(
  rows: readonly TableWidgetRow[],
  columns: readonly Pick<ResolvedTableWidgetColumnConfig, "format" | "key">[],
): TableWidgetSchemaValidationResult {
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
    .filter((column) => column.format !== "text")
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

export function formatTableWidgetValue(
  value: TableWidgetCellValue,
  column: Pick<
    ResolvedTableWidgetColumnConfig,
    "compact" | "decimals" | "format" | "prefix" | "suffix"
  >,
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (column.format === "text") {
    return `${column.prefix ?? ""}${String(value)}${column.suffix ?? ""}`;
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

export function evaluateTableWidgetRule(
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

const numberFormatterCache = new Map<string, Intl.NumberFormat>();

function getNumberFormatter(key: string, factory: () => Intl.NumberFormat) {
  const existing = numberFormatterCache.get(key);

  if (existing) {
    return existing;
  }

  const nextFormatter = factory();
  numberFormatterCache.set(key, nextFormatter);
  return nextFormatter;
}

export const tableWidgetDateRangeModeOptions: Array<{
  value: TableWidgetDateRangeMode;
  label: string;
  description: string;
}> = [
  {
    value: "dashboard",
    label: "Dashboard date",
    description: "Keep the table in sync with the current dashboard range.",
  },
  {
    value: "fixed",
    label: "Fixed date",
    description: "Use a saved start and end date for this widget only.",
  },
];

export const tableWidgetFormatOptions: Array<{
  value: TableWidgetColumnFormat;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "bps", label: "Bps" },
];

export const tableWidgetDensityOptions: Array<{
  value: TableWidgetDensity;
  label: string;
}> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

export const tableWidgetBarModeOptions: Array<{
  value: TableWidgetBarMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "fill", label: "Filled bar" },
];

export const tableWidgetGradientModeOptions: Array<{
  value: TableWidgetGradientMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "fill", label: "Gradient fill" },
];

export const tableWidgetHeatmapPaletteOptions: Array<{
  value: TableWidgetHeatmapPalette;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "viridis", label: "Viridis" },
  { value: "plasma", label: "Plasma" },
  { value: "inferno", label: "Inferno" },
  { value: "magma", label: "Magma" },
  { value: "turbo", label: "Turbo" },
  { value: "jet", label: "Jet" },
  { value: "blue-white-red", label: "Blue-White-Red" },
  { value: "red-yellow-green", label: "Red-Yellow-Green" },
];

export const tableWidgetGaugeModeOptions: Array<{
  value: TableWidgetGaugeMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "ring", label: "Ring gauge" },
];

export const tableWidgetRangeModeOptions: Array<{
  value: TableWidgetRangeMode;
  label: string;
}> = [
  { value: "auto", label: "Auto bounds" },
  { value: "fixed", label: "Fixed bounds" },
];

export const tableWidgetAlignOptions: Array<{
  value: TableWidgetAlign;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const tableWidgetPinnedOptions: Array<{
  value: TableWidgetPinned;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export const tableWidgetOperatorOptions: Array<{
  value: TableWidgetOperator;
  label: string;
}> = [
  { value: "gt", label: "> greater than" },
  { value: "gte", label: ">= greater or equal" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "<= less or equal" },
  { value: "eq", label: "= equal" },
];

export const tableWidgetToneOptions: Array<{
  value: TableWidgetTone;
  label: string;
}> = [
  { value: "neutral", label: "Neutral" },
  { value: "primary", label: "Primary" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];

export const tableWidgetDefaultProps: TableWidgetProps = {
  tableSourceMode: "bound",
  sourceMode: "filter_widget",
  dateRangeMode: "dashboard",
  manualColumns: [],
  manualRows: [],
  limit: defaultRemoteLimit,
  schema: [],
  density: "comfortable",
  showToolbar: true,
  showSearch: true,
  zebraRows: true,
  pagination: true,
  pageSize: 10,
  columnOverrides: {},
  valueLabels: [],
  conditionalRules: [],
};
