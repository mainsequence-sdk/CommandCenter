import type { TabularDataRow } from "@/widgets/shared/tabular-widget-source";
import {
  resolveTabularFieldOptionsFromDataset,
  type TabularFieldOption,
} from "@/widgets/shared/tabular-widget-source";
import {
  normalizeTabularWidgetSourceReferenceProps,
  type TabularWidgetSourceReferenceProps,
} from "@/widgets/shared/tabular-widget-source";

export type StatisticMode =
  | "count"
  | "last"
  | "first"
  | "max"
  | "min"
  | "sum"
  | "mean";
export type StatisticOperator = "gt" | "gte" | "lt" | "lte" | "eq";
export type StatisticTone = "neutral" | "primary" | "success" | "warning" | "danger";
export type StatisticColorMode = "none" | "range-rules" | "change-from-last";

export interface StatisticColorStyle {
  tone?: StatisticTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface StatisticRangeRule extends StatisticColorStyle {
  id: string;
  operator: StatisticOperator;
  value: number;
}

export interface StatisticChangeStyles {
  negative?: StatisticColorStyle;
  neutral?: StatisticColorStyle;
  positive?: StatisticColorStyle;
}

export interface StatisticWidgetProps
  extends Record<string, unknown>,
    TabularWidgetSourceReferenceProps {
  changeStyles?: StatisticChangeStyles;
  colorMode?: StatisticColorMode;
  decimals?: number;
  groupField?: string;
  orderField?: string;
  prefix?: string;
  rangeRules?: StatisticRangeRule[];
  showSourceLabel?: boolean;
  statisticMode?: StatisticMode;
  suffix?: string;
  valueField?: string;
  valueFieldLabel?: string;
}

export interface ResolvedStatisticConfig {
  availableFields: TabularFieldOption[];
  changeStyles?: StatisticChangeStyles;
  colorMode: StatisticColorMode;
  decimals?: number;
  groupField?: string;
  orderField?: string;
  prefix?: string;
  rangeRules: StatisticRangeRule[];
  showSourceLabel: boolean;
  sourceMode: "filter_widget";
  sourceWidgetId?: string;
  statisticMode: StatisticMode;
  suffix?: string;
  valueField?: string;
  valueFieldLabel?: string;
}

export interface StatisticResolvedCardStyle extends StatisticColorStyle {
  changeDirection?: "negative" | "neutral" | "positive";
}

export interface StatisticCard {
  chartPoints?: number[];
  formattedPrimaryValue: string;
  formattedSuffix?: string;
  formattedValue: string;
  id: string;
  label?: string;
  metricLabel?: string;
  resolvedStyle?: StatisticResolvedCardStyle;
  value: number | string | null;
}

export interface StatisticResult {
  cards: StatisticCard[];
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

function normalizeStatisticMode(value: unknown): StatisticMode {
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

function normalizeColorMode(value: unknown): StatisticColorMode {
  return value === "range-rules" || value === "change-from-last" ? value : "none";
}

function normalizeFieldKey(
  value: unknown,
  availableFields: readonly TabularFieldOption[],
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

function normalizeBoolean(value: unknown) {
  return value === true;
}

const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function normalizeTone(value: unknown): StatisticTone | undefined {
  return value === "neutral" ||
    value === "primary" ||
    value === "success" ||
    value === "warning" ||
    value === "danger"
    ? value
    : undefined;
}

function normalizeStatisticColorStyle(value: unknown): StatisticColorStyle | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as StatisticColorStyle;
  const nextValue: StatisticColorStyle = {};

  if (record.tone) {
    nextValue.tone = normalizeTone(record.tone);
  }

  if (record.textColor) {
    nextValue.textColor = normalizeHexColor(record.textColor);
  }

  if (record.backgroundColor) {
    nextValue.backgroundColor = normalizeHexColor(record.backgroundColor);
  }

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
}

function normalizeStatisticRangeRule(value: unknown): StatisticRangeRule | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as StatisticRangeRule;
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

  const nextStyle = normalizeStatisticColorStyle(record);

  return {
    id:
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : createStatisticRangeRuleId(),
    operator: record.operator,
    value: numericValue,
    tone: nextStyle?.tone,
    textColor: nextStyle?.textColor,
    backgroundColor: nextStyle?.backgroundColor,
  };
}

function normalizeStatisticRangeRules(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const normalized = normalizeStatisticRangeRule(entry);
    return normalized ? [normalized] : [];
  });
}

function normalizeStatisticChangeStyles(value: unknown): StatisticChangeStyles | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as StatisticChangeStyles;
  const nextValue: StatisticChangeStyles = {
    positive: normalizeStatisticColorStyle(record.positive),
    negative: normalizeStatisticColorStyle(record.negative),
    neutral: normalizeStatisticColorStyle(record.neutral),
  };

  return nextValue.positive || nextValue.negative || nextValue.neutral ? nextValue : undefined;
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

function sortRows(rows: readonly TabularDataRow[], orderField?: string) {
  if (!orderField) {
    return [...rows];
  }

  return [...rows].sort((left, right) =>
    compareOrderValues(left[orderField], right[orderField]),
  );
}

function formatNumericValue(
  value: number,
  config: Pick<ResolvedStatisticConfig, "decimals" | "prefix" | "suffix" | "statisticMode">,
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
  config: Pick<ResolvedStatisticConfig, "decimals" | "prefix" | "suffix" | "statisticMode">,
) {
  if (value == null) {
    return "—";
  }

  if (typeof value === "number") {
    return formatNumericValue(value, config);
  }

  return `${config.prefix ?? ""}${value}${config.suffix ?? ""}`;
}

function formatDisplayValueParts(
  value: number | string | null,
  config: Pick<ResolvedStatisticConfig, "decimals" | "prefix" | "suffix" | "statisticMode">,
) {
  if (value == null) {
    return {
      primary: "—",
      suffix: undefined,
    };
  }

  const normalizedSuffix = config.suffix?.trim() || undefined;

  if (typeof value === "number") {
    return {
      primary: formatNumericValue(value, {
        ...config,
        suffix: undefined,
      }),
      suffix: normalizedSuffix,
    };
  }

  return {
    primary: `${config.prefix ?? ""}${value}`,
    suffix: normalizedSuffix,
  };
}

function groupRowsByField(
  rows: readonly TabularDataRow[],
  groupField?: string,
) {
  if (!groupField) {
    return new Map<string, { label?: string; rows: TabularDataRow[] }>([
      ["__all__", { rows: [...rows] }],
    ]);
  }

  const groups = new Map<string, { label: string; rows: TabularDataRow[] }>();

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
  rows: readonly TabularDataRow[],
  config: Pick<ResolvedStatisticConfig, "orderField" | "statisticMode" | "valueField">,
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
  rows: readonly TabularDataRow[],
  config: Pick<ResolvedStatisticConfig, "orderField" | "valueField">,
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

function resolveStatisticModeLabel(mode: StatisticMode) {
  if (mode === "count") {
    return "Count";
  }

  if (mode === "last") {
    return "Last";
  }

  if (mode === "first") {
    return "First";
  }

  if (mode === "max") {
    return "Max";
  }

  if (mode === "min") {
    return "Min";
  }

  if (mode === "sum") {
    return "Sum";
  }

  return "Mean";
}

function resolveCardMetricLabel(
  config: Pick<
    ResolvedStatisticConfig,
    "statisticMode" | "valueField" | "valueFieldLabel" | "availableFields"
  >,
) {
  if (config.valueFieldLabel?.trim()) {
    return config.valueFieldLabel.trim();
  }

  const statisticLabel = resolveStatisticModeLabel(config.statisticMode);

  if (config.statisticMode === "count") {
    return `${statisticLabel} · Rows`;
  }

  if (!config.valueField) {
    return statisticLabel;
  }

  const field = config.availableFields.find((entry) => entry.key === config.valueField);
  const fieldLabel = config.valueFieldLabel?.trim() || field?.label?.trim() || config.valueField;
  return `${statisticLabel} · ${fieldLabel}`;
}

function resolveLastObservationDelta(
  rows: readonly TabularDataRow[],
  config: Pick<ResolvedStatisticConfig, "orderField" | "valueField">,
) {
  if (!config.valueField) {
    return null;
  }

  const orderedRows = sortRows(rows, config.orderField);
  const numericValues = orderedRows
    .map((row) => toNumericValue(row[config.valueField!]))
    .filter((value): value is number => value != null);

  if (numericValues.length < 2) {
    return null;
  }

  return numericValues[numericValues.length - 1] - numericValues[numericValues.length - 2];
}

export function evaluateStatisticRule(
  value: number,
  rule: Pick<StatisticRangeRule, "operator" | "value">,
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

function resolveStatisticCardStyle(
  value: number | string | null,
  rows: readonly TabularDataRow[],
  config: Pick<
    ResolvedStatisticConfig,
    "changeStyles" | "colorMode" | "orderField" | "rangeRules" | "valueField"
  >,
): StatisticResolvedCardStyle | undefined {
  if (config.colorMode === "range-rules" && typeof value === "number") {
    const matchedRule = config.rangeRules.find((rule) =>
      evaluateStatisticRule(value, rule),
    );

    if (matchedRule) {
      return {
        tone: matchedRule.tone,
        textColor: matchedRule.textColor,
        backgroundColor: matchedRule.backgroundColor,
      };
    }
  }

  if (config.colorMode === "change-from-last") {
    const delta = resolveLastObservationDelta(rows, config);

    if (delta == null) {
      return undefined;
    }

    const direction = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";
    const style =
      config.changeStyles?.[direction] ??
      (direction === "positive"
        ? { tone: "success" as const }
        : direction === "negative"
          ? { tone: "danger" as const }
          : { tone: "neutral" as const });

    return {
      changeDirection: direction,
      tone: style.tone,
      textColor: style.textColor,
      backgroundColor: style.backgroundColor,
    };
  }

  return undefined;
}

export function buildStatisticFieldOptions(input: {
  columns?: string[];
  fields?: readonly TabularFieldOption[];
  rows?: readonly TabularDataRow[];
}) {
  return resolveTabularFieldOptionsFromDataset(input);
}

export function resolveStatisticConfig(
  props: StatisticWidgetProps,
  availableFields: readonly TabularFieldOption[],
): ResolvedStatisticConfig {
  const sourceReference = normalizeTabularWidgetSourceReferenceProps(props);
  const statisticMode = normalizeStatisticMode(props.statisticMode);

  return {
    availableFields: [...availableFields],
    changeStyles: normalizeStatisticChangeStyles(props.changeStyles),
    colorMode: normalizeColorMode(props.colorMode),
    decimals: normalizeDecimals(props.decimals),
    groupField: normalizeFieldKey(props.groupField, availableFields),
    orderField: normalizeFieldKey(props.orderField, availableFields),
    prefix: normalizeText(props.prefix),
    rangeRules: normalizeStatisticRangeRules(props.rangeRules),
    showSourceLabel: normalizeBoolean(props.showSourceLabel),
    sourceMode: "filter_widget",
    sourceWidgetId: sourceReference.sourceWidgetId,
    statisticMode,
    suffix: normalizeText(props.suffix),
    valueFieldLabel: normalizeText(props.valueFieldLabel),
    valueField:
      statisticMode === "count"
        ? normalizeFieldKey(props.valueField, availableFields)
        : normalizeFieldKey(props.valueField, availableFields),
  };
}

export function normalizeStatisticProps(
  props: StatisticWidgetProps,
  availableFields: readonly TabularFieldOption[],
) {
  const resolved = resolveStatisticConfig(props, availableFields);

  return {
    changeStyles: resolved.changeStyles,
    colorMode: resolved.colorMode,
    sourceMode: "filter_widget",
    sourceWidgetId: resolved.sourceWidgetId,
    valueField: resolved.valueField,
    statisticMode: resolved.statisticMode,
    groupField: resolved.groupField,
    orderField: resolved.orderField,
    decimals: resolved.decimals,
    prefix: resolved.prefix,
    rangeRules: resolved.rangeRules,
    showSourceLabel: resolved.showSourceLabel,
    suffix: resolved.suffix,
    valueFieldLabel: resolved.valueFieldLabel,
  } satisfies StatisticWidgetProps;
}

export function createStatisticRangeRuleId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `stat-rule-${uuid}`
    : `stat-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildStatisticCards(
  rows: readonly TabularDataRow[],
  config: ResolvedStatisticConfig,
): StatisticResult {
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
  const metricLabel = resolveCardMetricLabel(config);
  const cards = [...groups.entries()].map(([groupId, group]) => {
    const value = computeStatisticValue(group.rows, config);
    const valueParts = formatDisplayValueParts(value, config);

    return {
      id: groupId,
      label: config.groupField ? group.label : undefined,
      metricLabel,
      resolvedStyle: resolveStatisticCardStyle(value, group.rows, config),
      value,
      formattedPrimaryValue: valueParts.primary,
      formattedSuffix: valueParts.suffix,
      formattedValue: formatDisplayValue(value, config),
      chartPoints: buildCardChartPoints(group.rows, config),
    } satisfies StatisticCard;
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
  fields: readonly TabularFieldOption[],
) {
  return fields.map((field) => ({
    value: field.key,
    label: field.label ?? field.key,
    description: uniqueStrings([
      field.type === "number" || field.type === "integer" ? "numeric" : null,
      field.type === "datetime" || field.type === "date" || field.type === "time"
        ? "time-like"
        : null,
      /^(unique_identifier|identifier)$/i.test(field.key)
        ? "identifier"
        : null,
    ]).join(" · ") || field.key,
    keywords: [field.key, field.label ?? field.key],
  }));
}
