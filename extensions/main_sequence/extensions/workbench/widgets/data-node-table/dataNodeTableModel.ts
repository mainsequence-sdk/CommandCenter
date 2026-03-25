import type { DataNodeDetail, DataNodeRemoteDataRow } from "../../../../common/api";
import {
  buildDataNodeFieldOptions,
  formatDataNodeLabel,
} from "../data-node-shared/dataNodeShared";

export type DataNodeTableVisualizerDateRangeMode = "dashboard" | "fixed";
export type DataNodeTableVisualizerColumnFormat =
  | "auto"
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "bps";
export type DataNodeTableVisualizerDensity = "compact" | "comfortable";
export type DataNodeTableVisualizerBarMode = "none" | "fill";
export type DataNodeTableVisualizerAlign = "auto" | "left" | "center" | "right";
export type DataNodeTableVisualizerPinned = "none" | "left" | "right";
export type DataNodeTableVisualizerOperator = "gt" | "gte" | "lt" | "lte" | "eq";
export type DataNodeTableVisualizerTone = "neutral" | "primary" | "success" | "warning" | "danger";

export type DataNodeTableVisualizerCellValue = number | string | boolean | null;
export type DataNodeTableVisualizerRow = Record<string, DataNodeTableVisualizerCellValue>;
export type DataNodeTableVisualizerFrameRow = DataNodeTableVisualizerCellValue[];

export interface DataNodeTableVisualizerColumnSchema {
  key: string;
  label: string;
  description?: string;
  format: Exclude<DataNodeTableVisualizerColumnFormat, "auto">;
  minWidth?: number;
  flex?: number;
  pinned?: Exclude<DataNodeTableVisualizerPinned, "none">;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  categorical?: boolean;
  heatmapEligible?: boolean;
  compact?: boolean;
}

export interface DataNodeTableVisualizerColumnOverride {
  visible?: boolean;
  label?: string;
  format?: DataNodeTableVisualizerColumnFormat;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  heatmap?: boolean;
  compact?: boolean;
  barMode?: DataNodeTableVisualizerBarMode;
  align?: DataNodeTableVisualizerAlign;
  pinned?: DataNodeTableVisualizerPinned;
}

export interface DataNodeTableVisualizerValueLabel {
  columnKey: string;
  value: string;
  label?: string;
  tone?: DataNodeTableVisualizerTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface DataNodeTableVisualizerConditionalRule {
  id: string;
  columnKey: string;
  operator: DataNodeTableVisualizerOperator;
  value: number;
  tone?: DataNodeTableVisualizerTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface DataNodeTableVisualizerProps extends Record<string, unknown> {
  dataNodeId?: number;
  dateRangeMode?: DataNodeTableVisualizerDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  uniqueIdentifierList?: string[];
  limit?: number;
  columns?: string[];
  rows?: DataNodeTableVisualizerFrameRow[];
  schema?: DataNodeTableVisualizerColumnSchema[];
  density?: DataNodeTableVisualizerDensity;
  showToolbar?: boolean;
  showSearch?: boolean;
  zebraRows?: boolean;
  pagination?: boolean;
  pageSize?: number;
  columnOverrides?: Record<string, DataNodeTableVisualizerColumnOverride>;
  valueLabels?: DataNodeTableVisualizerValueLabel[];
  conditionalRules?: DataNodeTableVisualizerConditionalRule[];
}

export interface ResolvedDataNodeTableVisualizerColumnConfig extends DataNodeTableVisualizerColumnSchema {
  visible: boolean;
  align: Exclude<DataNodeTableVisualizerAlign, "auto">;
  heatmap: boolean;
  barMode: DataNodeTableVisualizerBarMode;
  compact: boolean;
  pinned?: Exclude<DataNodeTableVisualizerPinned, "none">;
}

export interface ResolvedDataNodeTableVisualizerProps {
  dataNodeId?: number;
  dataNodeLabel?: string;
  dateRangeMode: DataNodeTableVisualizerDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  uniqueIdentifierList?: string[];
  limit: number;
  supportsUniqueIdentifierList: boolean;
  columns: string[];
  rows: DataNodeTableVisualizerFrameRow[];
  schema: DataNodeTableVisualizerColumnSchema[];
  density: DataNodeTableVisualizerDensity;
  showToolbar: boolean;
  showSearch: boolean;
  zebraRows: boolean;
  pagination: boolean;
  pageSize: number;
  columnOverrides: Record<string, DataNodeTableVisualizerColumnOverride>;
  valueLabels: DataNodeTableVisualizerValueLabel[];
  conditionalRules: DataNodeTableVisualizerConditionalRule[];
}

export interface DataNodeTableVisualizerResolvedFrameInput {
  columns: string[];
  rows: DataNodeTableVisualizerFrameRow[];
  schemaFallback: DataNodeTableVisualizerColumnSchema[];
  supportsUniqueIdentifierList?: boolean;
  dataNodeLabel?: string;
}

export interface DataNodeTableVisualizerSchemaValidationIssue {
  code: "empty_schema" | "missing_columns" | "non_numeric_columns";
  columnKeys?: string[];
}

export interface DataNodeTableVisualizerSchemaValidationResult {
  isValid: boolean;
  issues: DataNodeTableVisualizerSchemaValidationIssue[];
}

const defaultPageSize = 10;
const defaultRemoteLimit = 500;
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function normalizeTone(value: unknown): DataNodeTableVisualizerTone | undefined {
  return value === "neutral" ||
    value === "primary" ||
    value === "success" ||
    value === "warning" ||
    value === "danger"
    ? value
    : undefined;
}

function normalizeCellValue(value: unknown): DataNodeTableVisualizerCellValue {
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

function normalizeDateRangeMode(value: unknown): DataNodeTableVisualizerDateRangeMode {
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
  dtype: string | null | undefined,
  rows: readonly DataNodeTableVisualizerFrameRow[],
  columnIndex: number,
): Exclude<DataNodeTableVisualizerColumnFormat, "auto"> {
  if (dtype && /date|time|timestamp/i.test(dtype)) {
    return "text";
  }

  if (dtype && /int|float|double|decimal|number|numeric|real|bigint/i.test(dtype)) {
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

export function buildDataNodeTableVisualizerFrameFromRemoteData(
  detail?: DataNodeDetail | null,
  remoteRows: readonly DataNodeRemoteDataRow[] = [],
): DataNodeTableVisualizerResolvedFrameInput {
  const fieldOptions = buildDataNodeFieldOptions(detail);
  const fieldOptionByKey = new Map(fieldOptions.map((field) => [field.key, field]));
  const rowKeys = uniqueStrings(remoteRows.flatMap((row) => Object.keys(row)));
  const columns = uniqueStrings([
    ...fieldOptions.map((field) => field.key),
    ...rowKeys,
  ]);
  const rows = remoteRows.map((row) => columns.map((columnKey) => normalizeCellValue(row[columnKey])));
  const schemaFallback = columns.map<DataNodeTableVisualizerColumnSchema>((columnKey, index) => {
    const field = fieldOptionByKey.get(columnKey);
    const label = field?.label?.trim() || columnKey;
    const format = inferRemoteColumnFormatFromKey(columnKey, field?.dtype, rows, index);

    return {
      key: columnKey,
      label,
      description: field?.description ?? undefined,
      format,
      minWidth: field?.isTime ? 160 : format === "text" ? 140 : 120,
      pinned: field?.isIndex ? "left" : undefined,
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
    dataNodeLabel: formatDataNodeLabel(detail),
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
  rows: readonly DataNodeTableVisualizerFrameRow[],
  columnIndex: number,
): Exclude<DataNodeTableVisualizerColumnFormat, "auto"> {
  const values = rows
    .map((row) => row[columnIndex])
    .filter((value) => value !== null && value !== undefined && value !== "");

  if (values.length === 0) {
    return "text";
  }

  const allNumeric = values.every((value) => getDataNodeTableVisualizerNumericValue(value) !== null);

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
  rows: readonly DataNodeTableVisualizerFrameRow[],
  schemaFallback: readonly DataNodeTableVisualizerColumnSchema[] = [],
) {
  const schemaFallbackByKey = new Map(schemaFallback.map((column) => [column.key, column]));

  return columns.map<DataNodeTableVisualizerColumnSchema>((columnKey, index) => {
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

function normalizeColumnSchema(value: unknown): DataNodeTableVisualizerColumnSchema | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as DataNodeTableVisualizerColumnSchema;
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

  const nextValue: DataNodeTableVisualizerColumnSchema = {
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

function normalizeColumnSchemas(value: unknown, fallback: readonly DataNodeTableVisualizerColumnSchema[] = []) {
  if (!Array.isArray(value)) {
    return cloneDataNodeTableVisualizerSchema(fallback);
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

export function cloneDataNodeTableVisualizerSchema(
  columns: readonly DataNodeTableVisualizerColumnSchema[],
): DataNodeTableVisualizerColumnSchema[] {
  return columns.map((column) => ({ ...column }));
}

function normalizeColumnOverride(value: unknown): DataNodeTableVisualizerColumnOverride | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as DataNodeTableVisualizerColumnOverride;
  const nextValue: DataNodeTableVisualizerColumnOverride = {};

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

function normalizeValueLabel(value: unknown): DataNodeTableVisualizerValueLabel | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as DataNodeTableVisualizerValueLabel;
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

function normalizeConditionalRule(value: unknown): DataNodeTableVisualizerConditionalRule | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as DataNodeTableVisualizerConditionalRule;
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
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : createDataNodeTableVisualizerRuleId(),
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
  ) satisfies Record<string, DataNodeTableVisualizerColumnOverride>;
}

function stripSchemaManagedFieldsFromColumnOverrides(
  value: Record<string, DataNodeTableVisualizerColumnOverride> | undefined,
) {
  return Object.fromEntries(
    Object.entries(normalizeColumnOverrides(value)).flatMap(([key, override]) => {
      const nextOverride = { ...override };
      delete nextOverride.label;
      delete nextOverride.format;

      return Object.keys(nextOverride).length > 0 ? [[key, nextOverride] as const] : [];
    }),
  ) satisfies Record<string, DataNodeTableVisualizerColumnOverride>;
}

const legacyShippedColumnOverrides: Record<string, DataNodeTableVisualizerColumnOverride> = {
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

const legacyShippedValueLabels: DataNodeTableVisualizerValueLabel[] = [
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

const legacyShippedConditionalRules: DataNodeTableVisualizerConditionalRule[] = [
  { id: "pnl-positive", columnKey: "pnl", operator: "gt", value: 0, tone: "primary" },
  { id: "pnl-negative", columnKey: "pnl", operator: "lt", value: 0, tone: "danger" },
  { id: "drawdown-risk", columnKey: "drawdownPct", operator: "lt", value: -5, tone: "danger" },
  { id: "exec-watch", columnKey: "slippageBps", operator: "gt", value: 1.5, tone: "warning" },
  { id: "utilization-hot", columnKey: "utilizationPct", operator: "gt", value: 80, tone: "danger" },
  { id: "reject-rate-hot", columnKey: "rejectRatePct", operator: "gt", value: 1, tone: "danger" },
  { id: "score-low", columnKey: "score", operator: "lt", value: 6, tone: "warning" },
];

function serializeColumnOverridesForComparison(
  value: Record<string, DataNodeTableVisualizerColumnOverride> | undefined,
) {
  const normalized = normalizeColumnOverrides(value);

  return JSON.stringify(
    Object.keys(normalized)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, normalized[key]]),
  );
}

function serializeValueLabelsForComparison(value: DataNodeTableVisualizerValueLabel[] | undefined) {
  return JSON.stringify(
    (value ?? [])
      .map((entry) => normalizeValueLabel(entry))
      .filter((entry): entry is DataNodeTableVisualizerValueLabel => Boolean(entry)),
  );
}

function serializeConditionalRulesForComparison(
  value: DataNodeTableVisualizerConditionalRule[] | undefined,
) {
  return JSON.stringify(
    (value ?? [])
      .map((entry) => normalizeConditionalRule(entry))
      .filter((entry): entry is DataNodeTableVisualizerConditionalRule => Boolean(entry)),
  );
}

const legacyShippedColumnOverridesSignature =
  serializeColumnOverridesForComparison(legacyShippedColumnOverrides);
const legacyShippedValueLabelsSignature =
  serializeValueLabelsForComparison(legacyShippedValueLabels);
const legacyShippedConditionalRulesSignature =
  serializeConditionalRulesForComparison(legacyShippedConditionalRules);

export function stripLegacyDataNodeTableVisualizerDisplayConfig(
  props: DataNodeTableVisualizerProps,
): DataNodeTableVisualizerProps {
  const nextProps: DataNodeTableVisualizerProps = { ...props };

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

export function createDataNodeTableVisualizerRuleId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `table-rule-${uuid}` : `table-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildDataNodeTableVisualizerRowObjects(
  columns: readonly string[],
  rows: readonly DataNodeTableVisualizerFrameRow[],
) {
  return rows.map<DataNodeTableVisualizerRow>((row) =>
    Object.fromEntries(
      columns.map((columnKey, index) => [columnKey, normalizeCellValue(row[index])]),
    ),
  );
}

function resolveDataNodeTableVisualizerSchemaFromFrame(
  props: Pick<DataNodeTableVisualizerProps, "columnOverrides" | "schema">,
  frameInput: Pick<
    DataNodeTableVisualizerResolvedFrameInput,
    "columns" | "rows" | "schemaFallback"
  >,
) {
  const schemaFallback =
    frameInput.schemaFallback.length > 0
      ? frameInput.schemaFallback
      : createSchemaTemplateFromFrame(frameInput.columns, frameInput.rows);

  if (Array.isArray(props.schema)) {
    return normalizeColumnSchemas(props.schema, schemaFallback);
  }

  const normalizedOverrides = normalizeColumnOverrides(props.columnOverrides);

  return cloneDataNodeTableVisualizerSchema(schemaFallback).map((column) => {
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

export function resolveDataNodeTableVisualizerPropsWithFrame(
  props: DataNodeTableVisualizerProps,
  frameInput?: DataNodeTableVisualizerResolvedFrameInput | null,
): ResolvedDataNodeTableVisualizerProps {
  const migratedProps = stripLegacyDataNodeTableVisualizerDisplayConfig(props);
  const normalizedDataNodeId = normalizePositiveInteger(migratedProps.dataNodeId);
  const normalizedFixedStartMs = normalizeTimestampMs(migratedProps.fixedStartMs);
  const normalizedFixedEndMs = normalizeTimestampMs(migratedProps.fixedEndMs);
  const normalizedUniqueIdentifierList = normalizeUniqueIdentifierList(
    migratedProps.uniqueIdentifierList,
  );
  const normalizedLimit =
    normalizePositiveInteger(migratedProps.limit) ?? defaultRemoteLimit;
  const columns = normalizeFrameColumns(frameInput?.columns, []);
  const rows = normalizeFrameRows(frameInput?.rows, columns.length);
  const schema = resolveDataNodeTableVisualizerSchemaFromFrame(
    migratedProps,
    {
      columns,
      rows,
      schemaFallback: frameInput?.schemaFallback ?? [],
    },
  );

  return {
    dataNodeId: normalizedDataNodeId,
    dataNodeLabel:
      frameInput?.dataNodeLabel ??
      (normalizedDataNodeId
        ? formatDataNodeLabel({ id: normalizedDataNodeId, storage_hash: "", identifier: null })
        : undefined),
    dateRangeMode: normalizeDateRangeMode(migratedProps.dateRangeMode),
    fixedStartMs: normalizedFixedStartMs,
    fixedEndMs: normalizedFixedEndMs,
    uniqueIdentifierList: normalizedUniqueIdentifierList,
    limit: normalizedLimit,
    supportsUniqueIdentifierList: Boolean(frameInput?.supportsUniqueIdentifierList),
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
        ? Math.max(5, Math.min(Math.trunc(migratedProps.pageSize), 50))
        : defaultPageSize,
    columnOverrides: stripSchemaManagedFieldsFromColumnOverrides(migratedProps.columnOverrides),
    valueLabels: Array.isArray(migratedProps.valueLabels)
      ? migratedProps.valueLabels
          .map((entry) => normalizeValueLabel(entry))
          .filter((entry): entry is DataNodeTableVisualizerValueLabel => Boolean(entry))
      : [],
    conditionalRules: Array.isArray(migratedProps.conditionalRules)
      ? migratedProps.conditionalRules
          .map((entry) => normalizeConditionalRule(entry))
          .filter((entry): entry is DataNodeTableVisualizerConditionalRule => Boolean(entry))
      : [],
  };
}

export function resolveDataNodeTableVisualizerProps(props: DataNodeTableVisualizerProps): ResolvedDataNodeTableVisualizerProps {
  return resolveDataNodeTableVisualizerPropsWithFrame(props);
}

export function resolveDataNodeTableVisualizerColumns(
  props: ResolvedDataNodeTableVisualizerProps,
) {
  return props.schema.map<ResolvedDataNodeTableVisualizerColumnConfig>((column) => {
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

export function getDataNodeTableVisualizerNumericValue(value: DataNodeTableVisualizerCellValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getDataNodeTableVisualizerValueLabel(
  props: ResolvedDataNodeTableVisualizerProps,
  columnKey: string,
  value: DataNodeTableVisualizerCellValue,
) {
  const lookupValue = value == null ? "" : String(value);
  return (
    props.valueLabels.find(
      (entry) => entry.columnKey === columnKey && entry.value === lookupValue,
    ) ?? null
  );
}

export function getDataNodeTableVisualizerColumnRange(
  rows: DataNodeTableVisualizerRow[],
  columnKey: string,
) {
  const values = rows
    .map((row) => getDataNodeTableVisualizerNumericValue(row[columnKey]))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function getDataNodeTableVisualizerCategoricalValues(
  rows: readonly DataNodeTableVisualizerRow[],
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

export function validateDataNodeTableVisualizerSchema(
  rows: readonly DataNodeTableVisualizerRow[],
  columns: readonly Pick<ResolvedDataNodeTableVisualizerColumnConfig, "format" | "key">[],
): DataNodeTableVisualizerSchemaValidationResult {
  const issues: DataNodeTableVisualizerSchemaValidationIssue[] = [];

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

      return values.every((value) => getDataNodeTableVisualizerNumericValue(value) === null);
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

export function formatDataNodeTableVisualizerValue(
  value: DataNodeTableVisualizerCellValue,
  column: Pick<
    ResolvedDataNodeTableVisualizerColumnConfig,
    "compact" | "decimals" | "format" | "prefix" | "suffix"
  >,
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (column.format === "text") {
    return `${column.prefix ?? ""}${String(value)}${column.suffix ?? ""}`;
  }

  const numericValue = getDataNodeTableVisualizerNumericValue(value);

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

export function evaluateDataNodeTableVisualizerRule(
  value: number,
  rule: Pick<DataNodeTableVisualizerConditionalRule, "operator" | "value">,
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

export const dataNodeTableVisualizerDateRangeModeOptions: Array<{
  value: DataNodeTableVisualizerDateRangeMode;
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

export const dataNodeTableVisualizerFormatOptions: Array<{
  value: DataNodeTableVisualizerColumnFormat;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "bps", label: "Bps" },
];

export const dataNodeTableVisualizerDensityOptions: Array<{
  value: DataNodeTableVisualizerDensity;
  label: string;
}> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

export const dataNodeTableVisualizerBarModeOptions: Array<{
  value: DataNodeTableVisualizerBarMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "fill", label: "Filled bar" },
];

export const dataNodeTableVisualizerAlignOptions: Array<{
  value: DataNodeTableVisualizerAlign;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const dataNodeTableVisualizerPinnedOptions: Array<{
  value: DataNodeTableVisualizerPinned;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export const dataNodeTableVisualizerOperatorOptions: Array<{
  value: DataNodeTableVisualizerOperator;
  label: string;
}> = [
  { value: "gt", label: "> greater than" },
  { value: "gte", label: ">= greater or equal" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "<= less or equal" },
  { value: "eq", label: "= equal" },
];

export const dataNodeTableVisualizerToneOptions: Array<{
  value: DataNodeTableVisualizerTone;
  label: string;
}> = [
  { value: "neutral", label: "Neutral" },
  { value: "primary", label: "Primary" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];

export const dataNodeTableVisualizerDefaultProps: DataNodeTableVisualizerProps = {
  dateRangeMode: "dashboard",
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
