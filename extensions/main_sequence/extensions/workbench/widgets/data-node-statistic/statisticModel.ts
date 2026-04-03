import type { DataNodeRemoteDataRow } from "../../../../common/api";
import {
  hasTabularFieldRole,
  resolveDataNodeFieldOptionsFromDataset,
  type DataNodeFieldOption,
} from "../data-node-shared/dataNodeShared";
import {
  normalizeDataNodeWidgetSourceReferenceProps,
  type DataNodeWidgetSourceReferenceProps,
} from "../data-node-shared/dataNodeWidgetSource";

export type DataNodeStatisticMode =
  | "count"
  | "last"
  | "first"
  | "max"
  | "min"
  | "sum"
  | "mean";

export interface MainSequenceDataNodeStatisticWidgetProps
  extends Record<string, unknown>,
    DataNodeWidgetSourceReferenceProps {
  decimals?: number;
  groupField?: string;
  orderField?: string;
  prefix?: string;
  statisticMode?: DataNodeStatisticMode;
  suffix?: string;
  valueField?: string;
}

export interface ResolvedDataNodeStatisticConfig {
  availableFields: DataNodeFieldOption[];
  decimals?: number;
  groupField?: string;
  orderField?: string;
  prefix?: string;
  sourceMode: "filter_widget";
  sourceWidgetId?: string;
  statisticMode: DataNodeStatisticMode;
  suffix?: string;
  valueField?: string;
}

export interface DataNodeStatisticCard {
  chartPoints?: number[];
  formattedValue: string;
  id: string;
  label?: string;
  value: number | string | null;
}

export interface DataNodeStatisticResult {
  cards: DataNodeStatisticCard[];
  issue?:
    | "missing_value_field"
    | "non_numeric_value_field"
    | "empty_rows";
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

function normalizeStatisticMode(value: unknown): DataNodeStatisticMode {
  return value === "last" ||
    value === "first" ||
    value === "max" ||
    value === "min" ||
    value === "sum" ||
    value === "mean" ||
    value === "count"
    ? value
    : "last";
}

function normalizeFieldKey(
  value: unknown,
  availableFields: readonly DataNodeFieldOption[],
) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim();

  if (availableFields.length === 0) {
    return normalized;
  }

  return availableFields.some((field) => field.key === normalized) ? normalized : undefined;
}

function normalizeDecimals(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(0, Math.min(Math.trunc(parsed), 6));
}

function normalizeText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return value;
}

function toNumericValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toComparableOrderValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const numeric = Number(trimmed);

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const timestamp = Date.parse(trimmed);

  if (!Number.isNaN(timestamp)) {
    return timestamp;
  }

  return trimmed.toLowerCase();
}

function compareOrderValues(left: unknown, right: unknown) {
  const leftValue = toComparableOrderValue(left);
  const rightValue = toComparableOrderValue(right);

  if (leftValue == null && rightValue == null) {
    return 0;
  }

  if (leftValue == null) {
    return 1;
  }

  if (rightValue == null) {
    return -1;
  }

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return leftValue - rightValue;
  }

  return String(leftValue).localeCompare(String(rightValue));
}

function sortRows(rows: readonly DataNodeRemoteDataRow[], orderField?: string) {
  if (!orderField) {
    return [...rows];
  }

  return [...rows].sort((left, right) =>
    compareOrderValues(left[orderField], right[orderField]),
  );
}

function formatNumericValue(
  value: number,
  config: Pick<ResolvedDataNodeStatisticConfig, "decimals" | "prefix" | "suffix" | "statisticMode">,
) {
  const decimals =
    config.statisticMode === "count"
      ? 0
      : (config.decimals ?? (Number.isInteger(value) ? 0 : 2));

  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${config.prefix ?? ""}${formatter.format(value)}${config.suffix ?? ""}`;
}

function formatDisplayValue(
  value: number | string | null,
  config: Pick<ResolvedDataNodeStatisticConfig, "decimals" | "prefix" | "suffix" | "statisticMode">,
) {
  if (value == null) {
    return "—";
  }

  if (typeof value === "number") {
    return formatNumericValue(value, config);
  }

  return `${config.prefix ?? ""}${value}${config.suffix ?? ""}`;
}

function groupRowsByField(
  rows: readonly DataNodeRemoteDataRow[],
  groupField?: string,
) {
  if (!groupField) {
    return new Map<string, { label?: string; rows: DataNodeRemoteDataRow[] }>([
      ["__all__", { rows: [...rows] }],
    ]);
  }

  const groups = new Map<string, { label: string; rows: DataNodeRemoteDataRow[] }>();

  rows.forEach((row) => {
    const rawValue = row[groupField];
    const label =
      rawValue == null || rawValue === ""
        ? "Empty"
        : String(rawValue);
    const groupKey = label;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.rows.push(row);
      return;
    }

    groups.set(groupKey, {
      label,
      rows: [row],
    });
  });

  return new Map(
    [...groups.entries()].sort((left, right) =>
      left[1].label.localeCompare(right[1].label),
    ),
  );
}

function computeStatisticValue(
  rows: readonly DataNodeRemoteDataRow[],
  config: Pick<ResolvedDataNodeStatisticConfig, "orderField" | "statisticMode" | "valueField">,
) {
  if (rows.length === 0) {
    return null;
  }

  if (config.statisticMode === "count") {
    return rows.length;
  }

  if (!config.valueField) {
    return null;
  }

  const orderedRows = sortRows(rows, config.orderField);

  if (config.statisticMode === "first") {
    const value = orderedRows[0]?.[config.valueField];
    return value == null || value === "" ? null : typeof value === "number" ? value : String(value);
  }

  if (config.statisticMode === "last") {
    const value = orderedRows[orderedRows.length - 1]?.[config.valueField];
    return value == null || value === "" ? null : typeof value === "number" ? value : String(value);
  }

  const numericValues = orderedRows
    .map((row) => toNumericValue(row[config.valueField!]))
    .filter((value): value is number => value != null);

  if (numericValues.length === 0) {
    return null;
  }

  if (config.statisticMode === "max") {
    return Math.max(...numericValues);
  }

  if (config.statisticMode === "min") {
    return Math.min(...numericValues);
  }

  if (config.statisticMode === "sum") {
    return numericValues.reduce((sum, value) => sum + value, 0);
  }

  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function buildCardChartPoints(
  rows: readonly DataNodeRemoteDataRow[],
  config: Pick<ResolvedDataNodeStatisticConfig, "orderField" | "valueField">,
) {
  if (!config.valueField) {
    return undefined;
  }

  const orderedRows = sortRows(rows, config.orderField);
  const numericValues = orderedRows
    .map((row) => toNumericValue(row[config.valueField!]))
    .filter((value): value is number => value != null);

  if (numericValues.length < 2) {
    return undefined;
  }

  return numericValues.slice(-64);
}

export function buildDataNodeStatisticFieldOptions(input: {
  columns?: string[];
  fields?: readonly DataNodeFieldOption[];
  rows?: readonly DataNodeRemoteDataRow[];
}) {
  return resolveDataNodeFieldOptionsFromDataset(input);
}

export function resolveDataNodeStatisticConfig(
  props: MainSequenceDataNodeStatisticWidgetProps,
  availableFields: readonly DataNodeFieldOption[],
): ResolvedDataNodeStatisticConfig {
  const sourceReference = normalizeDataNodeWidgetSourceReferenceProps(props);
  const statisticMode = normalizeStatisticMode(props.statisticMode);

  return {
    availableFields: [...availableFields],
    decimals: normalizeDecimals(props.decimals),
    groupField: normalizeFieldKey(props.groupField, availableFields),
    orderField: normalizeFieldKey(props.orderField, availableFields),
    prefix: normalizeText(props.prefix),
    sourceMode: "filter_widget",
    sourceWidgetId: sourceReference.sourceWidgetId,
    statisticMode,
    suffix: normalizeText(props.suffix),
    valueField:
      statisticMode === "count"
        ? normalizeFieldKey(props.valueField, availableFields)
        : normalizeFieldKey(props.valueField, availableFields),
  };
}

export function normalizeDataNodeStatisticProps(
  props: MainSequenceDataNodeStatisticWidgetProps,
  availableFields: readonly DataNodeFieldOption[],
) {
  const resolved = resolveDataNodeStatisticConfig(props, availableFields);

  return {
    sourceMode: "filter_widget",
    sourceWidgetId: resolved.sourceWidgetId,
    valueField: resolved.valueField,
    statisticMode: resolved.statisticMode,
    groupField: resolved.groupField,
    orderField: resolved.orderField,
    decimals: resolved.decimals,
    prefix: resolved.prefix,
    suffix: resolved.suffix,
  } satisfies MainSequenceDataNodeStatisticWidgetProps;
}

export function buildDataNodeStatisticCards(
  rows: readonly DataNodeRemoteDataRow[],
  config: ResolvedDataNodeStatisticConfig,
): DataNodeStatisticResult {
  if (rows.length === 0) {
    return {
      cards: [],
      issue: "empty_rows",
    };
  }

  if (
    config.statisticMode !== "count" &&
    !config.valueField
  ) {
    return {
      cards: [],
      issue: "missing_value_field",
    };
  }

  const groups = groupRowsByField(rows, config.groupField);
  const cards = [...groups.entries()].map(([groupId, group]) => {
    const value = computeStatisticValue(group.rows, config);

    return {
      id: groupId,
      label: config.groupField ? group.label : undefined,
      value,
      formattedValue: formatDisplayValue(value, config),
      chartPoints: buildCardChartPoints(group.rows, config),
    } satisfies DataNodeStatisticCard;
  });

  const requiresNumericValue =
    config.statisticMode === "max" ||
    config.statisticMode === "min" ||
    config.statisticMode === "sum" ||
    config.statisticMode === "mean";

  if (requiresNumericValue && cards.every((card) => card.value == null)) {
    return {
      cards: [],
      issue: "non_numeric_value_field",
    };
  }

  if (cards.length === 1) {
    return {
      cards: cards.map((card) => ({
        ...card,
        chartPoints: card.chartPoints,
      })),
    };
  }

  return {
    cards: cards.map((card) => ({
      ...card,
      chartPoints: undefined,
    })),
  };
}

export function resolveStatisticValueFieldPickerOptions(
  fields: readonly DataNodeFieldOption[],
) {
  return fields.map((field) => ({
    value: field.key,
    label: field.label ?? field.key,
    description: uniqueStrings([
      field.type === "number" || field.type === "integer" ? "numeric" : null,
      hasTabularFieldRole(field, "time") ? "time-like" : null,
      hasTabularFieldRole(field, "index") || hasTabularFieldRole(field, "identifier")
        ? "index"
        : null,
    ]).join(" · ") || field.key,
    keywords: [field.key, field.label ?? field.key],
  }));
}
