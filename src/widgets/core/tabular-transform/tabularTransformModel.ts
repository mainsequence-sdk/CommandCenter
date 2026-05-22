import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
} from "@/widgets/types";
import { compileTableFormulaExpression } from "@/widgets/core/table/tableFormulaCompiler";
import {
  applyResolvedTableComputedColumns,
  type TableFrameComputedColumn,
} from "@/widgets/core/table/tableFrameMetadata";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  attachWidgetRuntimeUpdateContext,
  mapWidgetRuntimeUpdateEnvelope,
  type WidgetRuntimeUpdateEnvelope,
} from "@/widgets/shared/runtime-update";
import {
  getRuntimeDataRef,
  materializeRuntimeTabularFrame,
  type RuntimeDataStore,
} from "@/widgets/shared/runtime-data-store";
import {
  isUpstreamConsumerBindingProblemKind,
  resolveUpstreamConsumerState,
  type ResolvedUpstreamConsumerState,
} from "@/widgets/shared/upstream-consumer-state";
import {
  hasIncrementalTabularRoleBindings,
  resolveIncrementalTabularBindingSnapshot,
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
  type TabularMergeKeyMapping,
} from "@/widgets/shared/incremental-tabular-consumer";

export const TABULAR_TRANSFORM_SOURCE_INPUT_ID = "sourceData";
export const TABULAR_TRANSFORM_DATASET_OUTPUT_ID = "dataset";

const TABULAR_TRANSFORM_DEBUG_LOGS_ENABLED = false;
const TABULAR_TRANSFORM_DEBUG_SIGNATURE_LIMIT = 2_000;
const tabularTransformDebugSignatures = new Set<string>();

function logTabularTransformDebug(event: string, payload: Record<string, unknown>) {
  if (
    typeof window === "undefined" ||
    !import.meta.env.DEV ||
    !TABULAR_TRANSFORM_DEBUG_LOGS_ENABLED
  ) {
    return;
  }

  const signature = JSON.stringify({ event, payload });

  if (tabularTransformDebugSignatures.has(signature)) {
    return;
  }

  tabularTransformDebugSignatures.add(signature);

  if (tabularTransformDebugSignatures.size > TABULAR_TRANSFORM_DEBUG_SIGNATURE_LIMIT) {
    tabularTransformDebugSignatures.clear();
  }

  console.log(`[tabular-transform:${event}]`, payload);
}

function summarizeFrameForDebug(frame: TabularFrameSourceV1 | null | undefined) {
  return frame
    ? {
        status: frame.status,
        columnCount: frame.columns.length,
        rowCount: frame.rows.length,
        hasRuntimeDataRef: Boolean(getRuntimeDataRef(frame)),
        sourceKind: frame.source?.kind,
        sourceLabel: frame.source?.label,
        streamStatus:
          (frame as { streamStatus?: unknown }).streamStatus ??
          (frame.source?.context &&
          typeof frame.source.context === "object" &&
          "stream" in frame.source.context &&
          frame.source.context.stream &&
          typeof frame.source.context.stream === "object" &&
          "status" in frame.source.context.stream
            ? (frame.source.context.stream as { status?: unknown }).status
            : undefined),
      }
    : null;
}

function resolveTransformSourceUpdatedAt(source: TabularFrameSourceV1) {
  return source.source?.updatedAtMs;
}

export type TabularTransformMode = "none" | "filter" | "aggregate" | "pivot" | "unpivot";
export type TabularAggregateMode = "first" | "last" | "sum" | "mean" | "min" | "max";
export type TabularFilterCombineMode = "all" | "any";
export type TabularTransformRowMergeMode = "passthrough" | "latest";
export type TabularTransformComputedColumnType = NonNullable<TableFrameComputedColumn["type"]>;
export type TabularFilterOperator =
  | "equals"
  | "not-equals"
  | "in"
  | "not-in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is-empty"
  | "is-not-empty";
export type TabularFilterRuleValue = string | number | boolean | null;

export interface TabularFilterRule {
  field?: string;
  operator?: TabularFilterOperator;
  value?: TabularFilterRuleValue | TabularFilterRuleValue[];
}

export interface TabularTransformComputedColumnConfig {
  key?: string;
  label?: string;
  type?: TabularTransformComputedColumnType;
  formulaExpression?: string;
}

interface TabularTransformDataset {
  columns: string[];
  rows: Record<string, unknown>[];
  derivedColumns: Set<string>;
  fields?: TabularFrameFieldSchema[];
  metaComputedColumns?: TableFrameComputedColumn[];
}

interface TabularTransformErrorResult extends TabularTransformDataset {
  error: string;
}

interface CompiledTabularFilterRule {
  field: string;
  operator: TabularFilterOperator;
  fieldType: TabularFrameFieldType;
  normalizedValue:
    | TabularFilterRuleValue
    | string
    | number
    | boolean
    | null
    | Array<string | number | boolean | null | undefined>
    | undefined;
}

interface BuiltFilterPredicate {
  predicate: (row: Record<string, unknown>) => boolean;
}

interface BuiltFilterPredicateError {
  error: string;
}

interface ResolvedTabularTransformComputedColumn extends TableFrameComputedColumn {
  sourceIndex: number;
}

export interface TabularTransformWidgetProps extends Record<string, unknown> {
  transformMode?: TabularTransformMode;
  aggregateMode?: TabularAggregateMode;
  computedColumns?: TabularTransformComputedColumnConfig[];
  filterCombineMode?: TabularFilterCombineMode;
  filterRules?: TabularFilterRule[];
  keyFields?: string[];
  pivotField?: string;
  pivotValueField?: string;
  projectFields?: string[];
  rowMergeKeyFields?: string[];
  rowMergeKeyMappings?: TabularMergeKeyMapping[];
  rowMergeMode?: TabularTransformRowMergeMode;
  unpivotFieldName?: string;
  unpivotValueFieldName?: string;
  unpivotValueFields?: string[];
}

export type TabularTransformRuntimeState = TabularFrameSourceV1;

export type TabularTransformSourceRole = "conflict" | "legacy" | "live" | "none" | "seed";

export type TabularTransformOutputChannel = "dataset" | "updates";

export const TABULAR_TRANSFORM_SINGLE_SOURCE_ERROR =
  "Tabular Transform accepts either seedData or liveUpdates, not both. Remove one binding so the transform publishes on a single downstream path.";

const TABULAR_TRANSFORM_INACTIVE_DATASET_OUTPUT_MESSAGE =
  "This Tabular Transform is bound to liveUpdates, so its dataset output is inactive. Bind downstream live inputs to the updates output.";

const TABULAR_TRANSFORM_INACTIVE_UPDATES_OUTPUT_MESSAGE =
  "This Tabular Transform is bound to seedData, so its updates output is inactive. Bind downstream seed inputs to the dataset output.";

export interface TabularTransformStatusProvenance {
  activeInputRole: TabularTransformSourceRole;
  liveBound: boolean;
  liveHasPublishedValue: boolean;
  liveSourceOutputId?: string;
  liveSourceWidgetId?: string;
  seedBound: boolean;
  seedHasPublishedValue: boolean;
  seedSourceOutputId?: string;
  seedSourceWidgetId?: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values: readonly unknown[]) {
  const seen = new Set<string>();

  return values.flatMap((value) => {
    const normalized = typeof value === "string" ? value.trim() : "";

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function normalizeFieldList(value: unknown) {
  if (typeof value === "string") {
    return uniqueStrings(value.split(/[\n,]+/));
  }

  return Array.isArray(value) ? uniqueStrings(value) : undefined;
}

function normalizeOptionalField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeComputedColumnType(
  value: unknown,
): TabularTransformComputedColumnType | undefined {
  return value === "number" ||
    value === "string" ||
    value === "boolean" ||
    value === "json"
    ? value
    : undefined;
}

function normalizeTransformMode(value: unknown): TabularTransformMode {
  return value === "filter" || value === "aggregate" || value === "pivot" || value === "unpivot"
    ? value
    : "none";
}

function normalizeAggregateMode(value: unknown): TabularAggregateMode {
  return value === "first" ||
    value === "last" ||
    value === "sum" ||
    value === "mean" ||
    value === "min" ||
    value === "max"
    ? value
    : "last";
}

function normalizeRowMergeMode(value: unknown): TabularTransformRowMergeMode {
  return value === "latest" ? "latest" : "passthrough";
}

function normalizeOutputFieldName(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

function normalizeFilterCombineMode(value: unknown): TabularFilterCombineMode {
  return value === "any" ? "any" : "all";
}

function normalizeFilterOperator(value: unknown): TabularFilterOperator | undefined {
  return value === "equals" ||
    value === "not-equals" ||
    value === "in" ||
    value === "not-in" ||
    value === "gt" ||
    value === "gte" ||
    value === "lt" ||
    value === "lte" ||
    value === "is-empty" ||
    value === "is-not-empty"
    ? value
    : undefined;
}

function normalizeFilterScalarValue(value: unknown): TabularFilterRuleValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  return typeof value === "boolean" ? value : undefined;
}

function normalizeFilterRuleValue(
  value: unknown,
): TabularFilterRuleValue | TabularFilterRuleValue[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value.flatMap((entry) => {
      const scalar = normalizeFilterScalarValue(entry);
      return scalar === undefined ? [] : [scalar];
    });

    return normalized.length > 0 ? normalized : undefined;
  }

  return normalizeFilterScalarValue(value);
}

function normalizeFilterRule(value: unknown): TabularFilterRule | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const field = normalizeOptionalField(value.field);
  const operator = normalizeFilterOperator(value.operator);
  const normalizedValue = normalizeFilterRuleValue(value.value);

  if (!field && !operator && normalizedValue === undefined) {
    return null;
  }

  return {
    field,
    operator,
    value: normalizedValue,
  };
}

function normalizeFilterRules(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.flatMap((entry) => {
    const rule = normalizeFilterRule(entry);
    return rule ? [rule] : [];
  });

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMergeKeyMappings(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.flatMap((entry) => {
    if (!isPlainRecord(entry)) {
      return [];
    }

    const seedField = normalizeOptionalField(entry.seedField);
    const liveField = normalizeOptionalField(entry.liveField);

    return seedField && liveField ? [{ seedField, liveField }] : [];
  });

  return normalized.length > 0 ? normalized : undefined;
}

function mergeKeyFieldsToMappings(fields: readonly string[] | undefined) {
  return fields?.map((field) => ({ seedField: field, liveField: field })) ?? [];
}

function resolveRowMergeKeyMappings(props: ReturnType<typeof normalizeTabularTransformProps>) {
  return props.rowMergeKeyMappings?.length
    ? props.rowMergeKeyMappings
    : mergeKeyFieldsToMappings(props.rowMergeKeyFields);
}

function normalizeComputedColumnConfig(
  value: unknown,
): TabularTransformComputedColumnConfig | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const key = normalizeOptionalField(value.key ?? value.id);
  const label = normalizeOptionalField(value.label);
  const type = normalizeComputedColumnType(value.type) ?? "number";
  const formulaExpression =
    typeof value.formulaExpression === "string" ? value.formulaExpression : undefined;

  if (!key && !label && !formulaExpression) {
    return null;
  }

  return {
    key,
    label,
    type,
    formulaExpression,
  };
}

function normalizeComputedColumnConfigs(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.flatMap((entry) => {
    const column = normalizeComputedColumnConfig(entry);
    return column ? [column] : [];
  });

  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeTabularTransformProps(
  props: TabularTransformWidgetProps,
): Required<
  Pick<
    TabularTransformWidgetProps,
    | "aggregateMode"
    | "filterCombineMode"
    | "rowMergeMode"
    | "transformMode"
    | "unpivotFieldName"
    | "unpivotValueFieldName"
  >
> &
  TabularTransformWidgetProps {
  return {
    ...props,
    transformMode: normalizeTransformMode(props.transformMode),
    aggregateMode: normalizeAggregateMode(props.aggregateMode),
    computedColumns: normalizeComputedColumnConfigs(props.computedColumns),
    filterCombineMode: normalizeFilterCombineMode(props.filterCombineMode),
    filterRules: normalizeFilterRules(props.filterRules),
    keyFields: normalizeFieldList(props.keyFields),
    pivotField: normalizeOptionalField(props.pivotField),
    pivotValueField: normalizeOptionalField(props.pivotValueField),
    projectFields: normalizeFieldList(props.projectFields),
    rowMergeKeyFields: normalizeFieldList(props.rowMergeKeyFields),
    rowMergeKeyMappings: normalizeMergeKeyMappings(props.rowMergeKeyMappings),
    rowMergeMode: normalizeRowMergeMode(props.rowMergeMode),
    unpivotFieldName: normalizeOutputFieldName(props.unpivotFieldName, "series"),
    unpivotValueFieldName: normalizeOutputFieldName(props.unpivotValueFieldName, "value"),
    unpivotValueFields: normalizeFieldList(props.unpivotValueFields),
  };
}

function collectRowKeys(rows: readonly Record<string, unknown>[]) {
  return uniqueStrings(rows.flatMap((row) => Object.keys(row)));
}

function inferFieldType(values: unknown[]): TabularFrameFieldType {
  const sample = values.find((value) => value !== null && value !== undefined && value !== "");

  if (typeof sample === "number") {
    return Number.isInteger(sample) ? "integer" : "number";
  }

  if (typeof sample === "boolean") {
    return "boolean";
  }

  if (typeof sample === "string") {
    const parsed = Date.parse(sample);
    return Number.isNaN(parsed) ? "string" : "datetime";
  }

  if (typeof sample === "object") {
    return "json";
  }

  return "unknown";
}

function inferFields(
  columns: readonly string[],
  rows: readonly Record<string, unknown>[],
  sourceFields?: readonly TabularFrameFieldSchema[],
  derivedColumns = new Set<string>(),
) {
  const sourceFieldByKey = new Map((sourceFields ?? []).map((field) => [field.key, field]));

  return columns.map<TabularFrameFieldSchema>((column) => {
    const sourceField = sourceFieldByKey.get(column);

    if (sourceField && !derivedColumns.has(column)) {
      return sourceField;
    }

    return {
      key: column,
      label: sourceField?.label ?? column,
      type: sourceField?.type ?? inferFieldType(rows.map((row) => row[column])),
      nullable: true,
      provenance: derivedColumns.has(column) ? "derived" : "inferred",
      nativeType: sourceField?.nativeType,
      reason: derivedColumns.has(column)
        ? "Created by the tabular transform widget."
        : "Inferred from transformed rows.",
      derivedFrom: derivedColumns.has(column) ? [column] : undefined,
    };
  });
}

export function resolveTabularTransformComputedColumns(
  props: Pick<TabularTransformWidgetProps, "computedColumns">,
) {
  const normalized = normalizeTabularTransformProps(props);
  const errorsByIndex = new Map<number, string>();
  const seenKeys = new Set<string>();

  const computedColumns = (normalized.computedColumns ?? []).flatMap((column, index) => {
    if (!column.key) {
      errorsByIndex.set(index, `Computed column ${index + 1} needs a column key.`);
      return [];
    }

    if (seenKeys.has(column.key)) {
      errorsByIndex.set(index, `Computed column ${index + 1} reuses "${column.key}". Use a unique key.`);
      return [];
    }

    const compiled = compileTableFormulaExpression(column.formulaExpression);

    if (!compiled.expression) {
      errorsByIndex.set(
        index,
        compiled.error ?? `Computed column ${index + 1} has an invalid formula.`,
      );
      return [];
    }

    seenKeys.add(column.key);
    return [{
      id: column.key,
      label: column.label ?? column.key,
      type: column.type ?? "number",
      expression: compiled.expression,
      sourceIndex: index,
    } satisfies ResolvedTabularTransformComputedColumn];
  });

  return {
    computedColumns,
    errorsByIndex,
  };
}

function isNumericValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return Number.isFinite(Number(value));
}

function aggregateNumericValues(values: number[], mode: TabularAggregateMode) {
  if (values.length === 0) {
    return null;
  }

  if (mode === "first") {
    return values[0] ?? null;
  }

  if (mode === "last") {
    return values[values.length - 1] ?? null;
  }

  if (mode === "sum") {
    return values.reduce((total, value) => total + value, 0);
  }

  if (mode === "mean") {
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  if (mode === "min") {
    return Math.min(...values);
  }

  return Math.max(...values);
}

function representativeValue(
  rows: readonly Record<string, unknown>[],
  column: string,
  mode: TabularAggregateMode,
) {
  if (rows.length === 0) {
    return null;
  }

  if (mode === "first") {
    return rows[0]?.[column] ?? null;
  }

  return rows[rows.length - 1]?.[column] ?? null;
}

function buildGroupedDataset(
  rows: readonly Record<string, unknown>[],
  columns: readonly string[],
  props: ReturnType<typeof normalizeTabularTransformProps>,
) {
  const groupColumns = (props.keyFields ?? []).filter((column) => columns.includes(column));

  if (groupColumns.length === 0 || rows.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
      derivedColumns: new Set<string>(),
    };
  }

  const groupedRows = new Map<string, Record<string, unknown>[]>();

  rows.forEach((row) => {
    const key = JSON.stringify(groupColumns.map((column) => row[column] ?? null));
    const current = groupedRows.get(key) ?? [];
    current.push(row);
    groupedRows.set(key, current);
  });

  const outputColumns = uniqueStrings([
    ...groupColumns,
    ...columns.filter((column) => !groupColumns.includes(column)),
  ]);
  const transformedRows = [...groupedRows.values()].map((groupRows) => {
    const nextRow: Record<string, unknown> = {};

    groupColumns.forEach((column) => {
      nextRow[column] = groupRows[0]?.[column] ?? null;
    });

    outputColumns.forEach((column) => {
      if (groupColumns.includes(column)) {
        return;
      }

      const numericValues = groupRows
        .map((row) => row[column])
        .filter(isNumericValue)
        .map((value) => Number(value));

      nextRow[column] =
        numericValues.length > 0
          ? aggregateNumericValues(numericValues, props.aggregateMode)
          : representativeValue(groupRows, column, props.aggregateMode);
    });

    return nextRow;
  });

  return {
    columns: outputColumns,
    rows: transformedRows,
    derivedColumns: new Set(outputColumns.filter((column) => !groupColumns.includes(column))),
  } satisfies TabularTransformDataset;
}

function isEmptyFilterValue(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function resolveFieldType(
  field: string,
  sourceFields: readonly TabularFrameFieldSchema[] | undefined,
  rows: readonly Record<string, unknown>[],
): TabularFrameFieldType {
  const declared = sourceFields?.find((entry) => entry.key === field)?.type;

  if (declared) {
    return declared;
  }

  return inferFieldType(rows.map((row) => row[field]));
}

function collectAvailableFields(source: TabularFrameSourceV1) {
  return new Set<string>([
    ...source.columns,
    ...collectRowKeys(source.rows),
    ...(source.fields ?? []).map((field) => field.key),
  ]);
}

function normalizeConfiguredComparableValue(
  value: TabularFilterRuleValue,
  fieldType: TabularFrameFieldType,
) {
  if (value === null) {
    return null;
  }

  if (fieldType === "number" || fieldType === "integer") {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  if (fieldType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (normalized === "true") {
        return true;
      }

      if (normalized === "false") {
        return false;
      }
    }

    return undefined;
  }

  if (fieldType === "datetime" || fieldType === "date" || fieldType === "time") {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value);

      if (Number.isFinite(numeric)) {
        return numeric;
      }

      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function normalizeRowComparableValue(value: unknown, fieldType: TabularFrameFieldType) {
  if (value === null || value === undefined) {
    return value;
  }

  if (fieldType === "number" || fieldType === "integer") {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  if (fieldType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (normalized === "true") {
        return true;
      }

      if (normalized === "false") {
        return false;
      }
    }

    return undefined;
  }

  if (fieldType === "datetime" || fieldType === "date" || fieldType === "time") {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value);

      if (Number.isFinite(numeric)) {
        return numeric;
      }

      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function valuesEqual(left: unknown, right: unknown) {
  return left === right;
}

function isOrderableValue(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

function validateFilterRuleValue(
  rule: TabularFilterRule,
  fieldType: TabularFrameFieldType,
  label: string,
) {
  if (rule.operator === "is-empty" || rule.operator === "is-not-empty") {
    return null;
  }

  if (rule.value === undefined) {
    return `${label} requires a value.`;
  }

  if (rule.operator === "in" || rule.operator === "not-in") {
    if (!Array.isArray(rule.value) || rule.value.length === 0) {
      return `${label} requires one or more values.`;
    }

    return rule.value.some(
      (entry) => normalizeConfiguredComparableValue(entry, fieldType) === undefined,
    )
      ? `${label} contains a value that does not match the selected field type.`
      : null;
  }

  if (Array.isArray(rule.value)) {
    return `${label} expects a single value.`;
  }

  const normalizedValue = normalizeConfiguredComparableValue(rule.value, fieldType);

  if (normalizedValue === undefined) {
    return `${label} does not match the selected field type.`;
  }

  if (
    (rule.operator === "gt" ||
      rule.operator === "gte" ||
      rule.operator === "lt" ||
      rule.operator === "lte") &&
    !isOrderableValue(normalizedValue)
  ) {
    return `${label} requires an orderable value.`;
  }

  return null;
}

function buildFilterPredicate(
  source: TabularFrameSourceV1,
  props: ReturnType<typeof normalizeTabularTransformProps>,
): BuiltFilterPredicate | BuiltFilterPredicateError {
  const rules = props.filterRules ?? [];

  if (props.transformMode !== "filter") {
    return {
      predicate: (_row: Record<string, unknown>) => true,
    };
  }

  if (rules.length === 0) {
    return {
      error: "Add at least one filter rule before this transform can run.",
    };
  }

  const availableFields = collectAvailableFields(source);
  const compiledRules: Array<{ error: string } | CompiledTabularFilterRule> = rules.map((rule, index) => {
    const label = `Filter rule ${index + 1}`;

    if (!rule.field) {
      return {
        error: `${label} is missing a field.`,
      };
    }

    if (!rule.operator) {
      return {
        error: `${label} is missing an operator.`,
      };
    }

    if (!availableFields.has(rule.field)) {
      return {
        error: `${label} references "${rule.field}", but that field is not present in the source dataset.`,
      };
    }

    const fieldType = resolveFieldType(rule.field, source.fields, source.rows);
    const valueError = validateFilterRuleValue(rule, fieldType, label);

    if (valueError) {
      return {
        error: valueError,
      };
    }

    const normalizedValue = Array.isArray(rule.value)
      ? rule.value.map((entry) => normalizeConfiguredComparableValue(entry, fieldType))
      : rule.value === undefined
        ? undefined
        : normalizeConfiguredComparableValue(rule.value, fieldType);

    return {
      field: rule.field,
      operator: rule.operator,
      fieldType,
      normalizedValue,
    };
  });

  const failedRule = compiledRules.find((entry) => "error" in entry);

  if (failedRule && "error" in failedRule) {
    return {
      error: failedRule.error,
    };
  }

  const validRules = compiledRules.filter(
    (entry): entry is CompiledTabularFilterRule => !("error" in entry),
  );

  return {
    predicate: (row: Record<string, unknown>) => {
      const matches = validRules.map((rule) => {
        const actualValue = row[rule.field];

        if (rule.operator === "is-empty") {
          return isEmptyFilterValue(actualValue);
        }

        if (rule.operator === "is-not-empty") {
          return !isEmptyFilterValue(actualValue);
        }

        const normalizedActual = normalizeRowComparableValue(actualValue, rule.fieldType);

        if (rule.operator === "in" || rule.operator === "not-in") {
          const expectedValues = Array.isArray(rule.normalizedValue) ? rule.normalizedValue : [];
          const contained = expectedValues.some((expected) => valuesEqual(normalizedActual, expected));
          return rule.operator === "in" ? contained : !contained;
        }

        if (normalizedActual === undefined) {
          return false;
        }

        const expectedValue = Array.isArray(rule.normalizedValue)
          ? rule.normalizedValue[0]
          : rule.normalizedValue;

        if (rule.operator === "equals") {
          return valuesEqual(normalizedActual, expectedValue);
        }

        if (rule.operator === "not-equals") {
          return !valuesEqual(normalizedActual, expectedValue);
        }

        if (!isOrderableValue(normalizedActual) || !isOrderableValue(expectedValue)) {
          return false;
        }

        if (rule.operator === "gt") {
          return normalizedActual > expectedValue;
        }

        if (rule.operator === "gte") {
          return normalizedActual >= expectedValue;
        }

        if (rule.operator === "lt") {
          return normalizedActual < expectedValue;
        }

        return normalizedActual <= expectedValue;
      });

      return props.filterCombineMode === "any" ? matches.some(Boolean) : matches.every(Boolean);
    },
  };
}

function buildFilteredDataset(
  source: TabularFrameSourceV1,
  rows: readonly Record<string, unknown>[],
  columns: readonly string[],
  props: ReturnType<typeof normalizeTabularTransformProps>,
) {
  const compiled = buildFilterPredicate(source, props);

  if ("error" in compiled) {
    return {
      columns: [...columns],
      rows: [] as Record<string, unknown>[],
      derivedColumns: new Set<string>(),
      error: compiled.error,
    } satisfies TabularTransformErrorResult;
  }

  return {
    columns: [...columns],
    rows: rows.filter(compiled.predicate),
    derivedColumns: new Set<string>(),
  } satisfies TabularTransformDataset;
}

function formatPivotValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "empty";
  }

  if (typeof value === "string") {
    return value.trim() || "empty";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildPivotedDataset(
  rows: readonly Record<string, unknown>[],
  columns: readonly string[],
  props: ReturnType<typeof normalizeTabularTransformProps>,
) {
  if (!props.pivotField || !props.pivotValueField || rows.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
      derivedColumns: new Set<string>(),
    };
  }

  if (!columns.includes(props.pivotField) || !columns.includes(props.pivotValueField)) {
    return {
      columns: [...columns],
      rows: [...rows],
      derivedColumns: new Set<string>(),
    };
  }

  const rowKeyColumns = (props.keyFields ?? []).filter(
    (column) =>
      column !== props.pivotField &&
      column !== props.pivotValueField &&
      columns.includes(column),
  );
  const pivotValues = uniqueStrings(rows.map((row) => formatPivotValue(row[props.pivotField!])));
  const pivotColumnNames = pivotValues.map((pivotValue) =>
    rowKeyColumns.includes(pivotValue) ? `${props.pivotValueField}:${pivotValue}` : pivotValue,
  );
  const groupedRows = new Map<string, Record<string, unknown>[]>();

  rows.forEach((row) => {
    const key = JSON.stringify(rowKeyColumns.map((column) => row[column] ?? null));
    const current = groupedRows.get(key) ?? [];
    current.push(row);
    groupedRows.set(key, current);
  });

  const outputRows = [...groupedRows.values()].map((groupRows) => {
    const nextRow: Record<string, unknown> = {};

    rowKeyColumns.forEach((column) => {
      nextRow[column] = groupRows[0]?.[column] ?? null;
    });

    pivotValues.forEach((pivotValue, index) => {
      const matchingRows = groupRows.filter(
        (row) => formatPivotValue(row[props.pivotField!]) === pivotValue,
      );
      const numericValues = matchingRows
        .map((row) => row[props.pivotValueField!])
        .filter(isNumericValue)
        .map((value) => Number(value));

      nextRow[pivotColumnNames[index]!] =
        numericValues.length > 0
          ? aggregateNumericValues(numericValues, props.aggregateMode)
          : representativeValue(matchingRows, props.pivotValueField!, props.aggregateMode);
    });

    return nextRow;
  });

  return {
    columns: uniqueStrings([...rowKeyColumns, ...pivotColumnNames]),
    rows: outputRows,
    derivedColumns: new Set(pivotColumnNames),
  } satisfies TabularTransformDataset;
}

function buildUnpivotedDataset(
  rows: readonly Record<string, unknown>[],
  columns: readonly string[],
  props: ReturnType<typeof normalizeTabularTransformProps>,
) {
  const keyColumns = (props.keyFields ?? []).filter((column) => columns.includes(column));
  const valueColumns = (props.unpivotValueFields ?? []).filter(
    (column) => columns.includes(column) && !keyColumns.includes(column),
  );

  if (valueColumns.length === 0 || rows.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
      derivedColumns: new Set<string>(),
    };
  }

  const outputRows = rows.flatMap((row) =>
    valueColumns.map((column) => {
      const nextRow: Record<string, unknown> = {};

      keyColumns.forEach((keyColumn) => {
        nextRow[keyColumn] = row[keyColumn] ?? null;
      });

      nextRow[props.unpivotFieldName] = column;
      nextRow[props.unpivotValueFieldName] = row[column] ?? null;

      return nextRow;
    }),
  );

  return {
    columns: uniqueStrings([...keyColumns, props.unpivotFieldName, props.unpivotValueFieldName]),
    rows: outputRows,
    derivedColumns: new Set([props.unpivotFieldName, props.unpivotValueFieldName]),
  } satisfies TabularTransformDataset;
}

function projectDataset(
  rows: readonly Record<string, unknown>[],
  columns: readonly string[],
  projectFields: readonly string[] | undefined,
  derivedColumns: Set<string>,
) {
  const projectedColumns = projectFields
    ? projectFields.filter((column) => columns.includes(column))
    : [];

  if (projectedColumns.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
      derivedColumns,
    };
  }

  return {
    columns: projectedColumns,
    rows: rows.map((row) =>
      Object.fromEntries(projectedColumns.map((column) => [column, row[column] ?? null])),
    ),
    derivedColumns: new Set([...derivedColumns].filter((column) => projectedColumns.includes(column))),
  } satisfies TabularTransformDataset;
}

function stableRowMergeValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hasRowMergeKeyValue(value: unknown) {
  return value !== null && value !== undefined && !(typeof value === "string" && value.trim() === "");
}

function buildLatestRowMergeKey(
  row: Record<string, unknown>,
  mappings: readonly TabularMergeKeyMapping[],
) {
  const values: string[] = [];

  for (const mapping of mappings) {
    const liveValue = row[mapping.liveField];
    const seedValue = row[mapping.seedField];
    const value = hasRowMergeKeyValue(liveValue) ? liveValue : seedValue;

    if (!hasRowMergeKeyValue(value)) {
      return null;
    }

    values.push(stableRowMergeValue(value));
  }

  return values.join("\u001f");
}

function normalizeLatestRowForMerge(
  row: Record<string, unknown>,
  mappings: readonly TabularMergeKeyMapping[],
) {
  const nextRow = { ...row };

  mappings.forEach((mapping) => {
    if (mapping.seedField === mapping.liveField || !(mapping.liveField in nextRow)) {
      return;
    }

    if (!(mapping.seedField in nextRow)) {
      nextRow[mapping.seedField] = nextRow[mapping.liveField];
    }

    delete nextRow[mapping.liveField];
  });

  return nextRow;
}

function normalizeLatestRowMergeColumns(
  columns: readonly string[],
  mappings: readonly TabularMergeKeyMapping[],
) {
  const liveToSeed = new Map(
    mappings.flatMap((mapping) =>
      mapping.seedField === mapping.liveField
        ? []
        : [[mapping.liveField, mapping.seedField] as const],
    ),
  );

  return uniqueStrings([
    ...columns.map((column) => liveToSeed.get(column) ?? column),
    ...mappings.map((mapping) => mapping.seedField),
  ]);
}

function applyLatestRowMerge(
  dataset: TabularTransformDataset,
  props: ReturnType<typeof normalizeTabularTransformProps>,
) {
  if (props.rowMergeMode !== "latest") {
    return dataset;
  }

  const mappings = resolveRowMergeKeyMappings(props);

  if (mappings.length === 0) {
    return {
      ...dataset,
      rows: [...dataset.rows],
      derivedColumns: new Set(dataset.derivedColumns),
      error: "Latest row merge needs at least one merge mapping.",
    } satisfies TabularTransformErrorResult;
  }

  const missingKeyMappings = mappings.filter(
    (mapping) =>
      !dataset.columns.includes(mapping.seedField) &&
      !dataset.columns.includes(mapping.liveField),
  );

  if (missingKeyMappings.length > 0) {
    const missingMapping = missingKeyMappings[0]!;
    return {
      ...dataset,
      rows: [...dataset.rows],
      derivedColumns: new Set(dataset.derivedColumns),
      error: `Latest row merge mapping "${missingMapping.seedField} -> ${missingMapping.liveField}" does not match the transformed dataset.`,
    } satisfies TabularTransformErrorResult;
  }

  const rowsByKey = new Map<string, { index: number; row: Record<string, unknown> }>();
  const rows: Record<string, unknown>[] = [];
  const columns = normalizeLatestRowMergeColumns(dataset.columns, mappings);

  dataset.rows.forEach((row) => {
    const key = buildLatestRowMergeKey(row, mappings);
    const normalizedRow = normalizeLatestRowForMerge(row, mappings);

    if (!key) {
      rows.push(normalizedRow);
      return;
    }

    const existing = rowsByKey.get(key);
    const nextRow = existing
      ? {
          ...existing.row,
          ...normalizedRow,
        }
      : normalizedRow;

    if (existing) {
      rows[existing.index] = nextRow;
      rowsByKey.set(key, {
        index: existing.index,
        row: nextRow,
      });
      return;
    }

    rowsByKey.set(key, {
      index: rows.length,
      row: nextRow,
    });
    rows.push(nextRow);
  });

  return {
    ...dataset,
    columns,
    rows,
    derivedColumns: new Set(dataset.derivedColumns),
  } satisfies TabularTransformDataset;
}

function applyConfiguredComputedColumns(
  source: TabularFrameSourceV1,
  dataset: TabularTransformDataset,
  props: ReturnType<typeof normalizeTabularTransformProps>,
) {
  const resolved = resolveTabularTransformComputedColumns(props);

  if (resolved.errorsByIndex.size > 0) {
    const firstError = [...resolved.errorsByIndex.values()][0];
    return {
      columns: [...dataset.columns],
      rows: [...dataset.rows],
      derivedColumns: new Set(dataset.derivedColumns),
      error: firstError ?? "One or more computed columns are invalid.",
    } satisfies TabularTransformErrorResult;
  }

  const collision = resolved.computedColumns.find((column) => dataset.columns.includes(column.id));

  if (collision) {
    return {
      columns: [...dataset.columns],
      rows: [...dataset.rows],
      derivedColumns: new Set(dataset.derivedColumns),
      error: `Computed column ${collision.sourceIndex + 1} reuses "${collision.id}", which already exists in the transformed dataset.`,
    } satisfies TabularTransformErrorResult;
  }

  if (resolved.computedColumns.length === 0) {
    return {
      ...dataset,
      metaComputedColumns: [] as TableFrameComputedColumn[],
    };
  }

  const baseFrame = {
    status: "ready",
    columns: dataset.columns,
    rows: dataset.rows.map((row) => ({ ...row })),
    fields: inferFields(
      dataset.columns,
      dataset.rows,
      source.fields,
      dataset.derivedColumns,
    ),
  } satisfies TabularFrameSourceV1;
  const computedFrame = applyResolvedTableComputedColumns(baseFrame, resolved.computedColumns);

  return {
    columns: computedFrame.columns,
    rows: computedFrame.rows,
    fields: computedFrame.fields,
    derivedColumns: new Set([
      ...dataset.derivedColumns,
      ...resolved.computedColumns.map((column) => column.id),
    ]),
    metaComputedColumns: resolved.computedColumns.map(({ sourceIndex: _sourceIndex, ...column }) => column),
  };
}

function transformFrame(
  source: TabularFrameSourceV1,
  props: ReturnType<typeof normalizeTabularTransformProps>,
): TabularTransformDataset | TabularTransformErrorResult {
  const columns = uniqueStrings([...source.columns, ...collectRowKeys(source.rows)]);
  const base =
    props.transformMode === "filter"
      ? buildFilteredDataset(source, source.rows, columns, props)
      : props.transformMode === "aggregate"
      ? buildGroupedDataset(source.rows, columns, props)
      : props.transformMode === "pivot"
        ? buildPivotedDataset(source.rows, columns, props)
        : props.transformMode === "unpivot"
          ? buildUnpivotedDataset(source.rows, columns, props)
          : ({
              columns,
              rows: [...source.rows],
              derivedColumns: new Set<string>(),
            } satisfies TabularTransformDataset);

  if ("error" in base) {
    return base;
  }

  const withComputedColumns = applyConfiguredComputedColumns(source, base, props);

  if ("error" in withComputedColumns) {
    return withComputedColumns;
  }

  const projected = projectDataset(
    withComputedColumns.rows,
    withComputedColumns.columns,
    props.projectFields,
    withComputedColumns.derivedColumns,
  );
  const merged = applyLatestRowMerge(projected, props);

  if ("error" in merged) {
    return merged;
  }

  return {
    ...merged,
    fields:
      withComputedColumns.fields?.filter((field) => merged.columns.includes(field.key)) ??
      inferFields(merged.columns, merged.rows, source.fields, merged.derivedColumns),
    metaComputedColumns: withComputedColumns.metaComputedColumns,
  };
}

function canTransformDeltaFromRows(props: ReturnType<typeof normalizeTabularTransformProps>) {
  return props.transformMode === "none" || props.transformMode === "filter";
}

function resolveSourceInput(resolvedInputs: ResolvedWidgetInputs | undefined) {
  const input = resolvedInputs?.[TABULAR_TRANSFORM_SOURCE_INPUT_ID];
  const candidate = Array.isArray(input)
    ? input.find((entry) => entry.status === "valid")
    : input;

  return candidate;
}

function resolveRoleInput(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  inputId: string,
) {
  const input = resolvedInputs?.[inputId];

  return Array.isArray(input)
    ? input.find((entry) => entry.status === "valid") ?? input[0]
    : input;
}

interface TabularTransformInputState {
  activeInputRole: TabularTransformSourceRole;
  configurationError?: string;
  consumerState: ResolvedUpstreamConsumerState<TabularFrameSourceV1>;
  deltaFrame: TabularFrameSourceV1 | null;
  retainedOutputFrame: TabularFrameSourceV1 | null;
  sourceFrame: TabularFrameSourceV1 | null;
  sourceInput: ResolvedWidgetInput | undefined;
  sourceValuePresent: boolean;
  statusProvenance: TabularTransformStatusProvenance;
  upstreamUpdate?: WidgetRuntimeUpdateEnvelope;
  upstreamUpdateInput?: ResolvedWidgetInput;
}

function isInputRoleBound(input: ResolvedWidgetInput | undefined) {
  return Boolean(input?.sourceWidgetId || input?.sourceOutputId) && input?.status !== "unbound";
}

function hasInputPublishedValue(input: ResolvedWidgetInput | undefined) {
  return Boolean(
    input &&
      (input.value !== undefined ||
        input.valueRef !== undefined ||
        input.upstreamBase !== undefined ||
        input.upstreamBaseRef !== undefined ||
        input.upstreamDelta !== undefined ||
        input.upstreamDeltaRef !== undefined),
  );
}

export function resolveTabularTransformSourceRole(
  resolvedInputs: ResolvedWidgetInputs | undefined,
): TabularTransformSourceRole {
  if (hasIncrementalTabularRoleBindings(resolvedInputs)) {
    const seedInput = resolveRoleInput(resolvedInputs, TABULAR_SEED_INPUT_ID);
    const liveInput = resolveRoleInput(resolvedInputs, TABULAR_LIVE_UPDATES_INPUT_ID);
    const seedBound = isInputRoleBound(seedInput);
    const liveBound = isInputRoleBound(liveInput);

    if (seedBound && liveBound) {
      return "conflict";
    }

    if (liveBound) {
      return "live";
    }

    if (seedBound) {
      return "seed";
    }

    return "none";
  }

  return isInputRoleBound(resolveSourceInput(resolvedInputs)) ? "legacy" : "none";
}

function buildTabularTransformStatusProvenance(input: {
  activeInputRole?: TabularTransformSourceRole;
  liveHasPublishedValue?: boolean;
  liveInput?: ResolvedWidgetInput;
  seedHasPublishedValue?: boolean;
  seedInput?: ResolvedWidgetInput;
}): TabularTransformStatusProvenance {
  return {
    activeInputRole: input.activeInputRole ?? "none",
    liveBound: isInputRoleBound(input.liveInput),
    liveHasPublishedValue:
      input.liveHasPublishedValue ?? hasInputPublishedValue(input.liveInput),
    liveSourceOutputId: input.liveInput?.sourceOutputId,
    liveSourceWidgetId: input.liveInput?.sourceWidgetId,
    seedBound: isInputRoleBound(input.seedInput),
    seedHasPublishedValue:
      input.seedHasPublishedValue ?? hasInputPublishedValue(input.seedInput),
    seedSourceOutputId: input.seedInput?.sourceOutputId,
    seedSourceWidgetId: input.seedInput?.sourceWidgetId,
  };
}

function withTabularTransformStatusProvenance<T extends TabularFrameSourceV1>(
  frame: T,
  statusProvenance: TabularTransformStatusProvenance,
): T {
  return {
    ...frame,
    source: {
      ...frame.source,
      kind: frame.source?.kind ?? "tabular-transform",
      context: {
        ...(frame.source?.context ?? {}),
        statusProvenance,
      },
    },
  };
}

function resolveLegacyTabularTransformInputState(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeDataStore?: RuntimeDataStore | null,
): TabularTransformInputState {
  const sourceInput = resolveSourceInput(resolvedInputs);
  const activeInputRole = isInputRoleBound(sourceInput) ? "legacy" : "none";
  const sourceValue =
    sourceInput?.upstreamBaseRef ??
    sourceInput?.valueRef ??
    sourceInput?.upstreamBase ??
    sourceInput?.value;
  const deltaValue =
    sourceInput?.upstreamDeltaRef ??
    sourceInput?.upstreamDelta;
  const sourceFrame =
    materializeRuntimeTabularFrame(sourceValue, runtimeDataStore) ??
    normalizeTabularFrameSource(sourceInput?.upstreamBase ?? sourceInput?.value);
  const deltaFrame =
    materializeRuntimeTabularFrame(deltaValue, runtimeDataStore) ??
    normalizeTabularFrameSource(sourceInput?.upstreamDelta);
  const effectiveValue = sourceValue ?? deltaValue;
  const effectiveFrame = sourceFrame ?? deltaFrame;
  const consumerState = resolveUpstreamConsumerState({
    hasCanonicalSourceBinding: Boolean(sourceInput?.sourceWidgetId),
    hasPublishedValue: effectiveValue !== undefined,
    resolvedSourceInput: sourceInput,
    dataset: effectiveFrame,
    deltaDataset: deltaFrame,
    invalidPublishedValueMessage: "The bound source did not publish a valid tabular dataset.",
  });

  return {
    activeInputRole,
    consumerState,
    deltaFrame,
    retainedOutputFrame: null,
    sourceFrame: effectiveFrame,
    sourceInput,
    sourceValuePresent: effectiveValue !== undefined,
    statusProvenance: buildTabularTransformStatusProvenance({
      activeInputRole,
      seedHasPublishedValue: effectiveValue !== undefined,
      seedInput: sourceInput,
    }),
    upstreamUpdate: sourceInput?.upstreamUpdate,
    upstreamUpdateInput: sourceInput,
  };
}

function resolveTabularTransformInputState(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeDataStore?: RuntimeDataStore | null,
  runtimeState?: unknown,
): TabularTransformInputState {
  if (hasIncrementalTabularRoleBindings(resolvedInputs)) {
    const activeInputRole = resolveTabularTransformSourceRole(resolvedInputs);
    const bindingSnapshot = resolveIncrementalTabularBindingSnapshot({
      resolvedInputs,
      runtimeDataStore,
      runtimeState,
    });
    const currentBindingSnapshot =
      runtimeState === undefined
        ? bindingSnapshot
        : resolveIncrementalTabularBindingSnapshot({
            resolvedInputs,
            runtimeDataStore,
          });
    const retainedOutputFrame = normalizeTabularFrameSource(runtimeState);
    const problemInput = [bindingSnapshot.liveInput, bindingSnapshot.seedInput].find((entry) =>
      entry ? isUpstreamConsumerBindingProblemKind(entry.status) : false,
    );
    const validInput =
      [bindingSnapshot.liveInput, bindingSnapshot.seedInput].find(
        (entry) => entry?.status === "valid",
      );
    const upstreamUpdateInput = bindingSnapshot.liveInput?.upstreamUpdate
      ? bindingSnapshot.liveInput
      : bindingSnapshot.seedInput;
    const seedHasPublishedValue = Boolean(
      bindingSnapshot.seedPublication ||
        currentBindingSnapshot.seedPublication ||
        hasInputPublishedValue(bindingSnapshot.seedInput),
    );
    const liveHasPublishedValue = Boolean(
      bindingSnapshot.livePublication ||
        currentBindingSnapshot.livePublication ||
        hasInputPublishedValue(bindingSnapshot.liveInput),
    );
    const statusProvenance = buildTabularTransformStatusProvenance({
      activeInputRole,
      liveHasPublishedValue,
      liveInput: bindingSnapshot.liveInput,
      seedHasPublishedValue,
      seedInput: bindingSnapshot.seedInput,
    });

    if (activeInputRole === "conflict") {
      const sourceInput =
        problemInput ?? validInput ?? bindingSnapshot.seedInput ?? bindingSnapshot.liveInput;

      return {
        activeInputRole,
        configurationError: TABULAR_TRANSFORM_SINGLE_SOURCE_ERROR,
        consumerState: {
          kind: "error",
          dataset: null,
          deltaDataset: null,
          inputStatus: undefined,
          sourceWidgetId: sourceInput?.sourceWidgetId,
          sourceOutputId: sourceInput?.sourceOutputId,
          sourceWidgetTitle: null,
          error: TABULAR_TRANSFORM_SINGLE_SOURCE_ERROR,
          requiresUpstreamResolution: false,
          hasCanonicalSourceBinding: true,
          hasPublishedValue: seedHasPublishedValue || liveHasPublishedValue,
          isEmpty: false,
        },
        deltaFrame: null,
        retainedOutputFrame:
          retainedOutputFrame && retainedOutputFrame.status !== "idle" ? retainedOutputFrame : null,
        sourceFrame: null,
        sourceInput,
        sourceValuePresent: false,
        statusProvenance,
        upstreamUpdate: undefined,
        upstreamUpdateInput: undefined,
      };
    }

    return {
      activeInputRole,
      consumerState: bindingSnapshot.consumerState,
      deltaFrame: currentBindingSnapshot.deltaDataset,
      retainedOutputFrame:
        retainedOutputFrame && retainedOutputFrame.status !== "idle" ? retainedOutputFrame : null,
      sourceFrame: currentBindingSnapshot.dataset,
      sourceInput:
        problemInput ?? validInput ?? bindingSnapshot.liveInput ?? bindingSnapshot.seedInput,
      sourceValuePresent:
        bindingSnapshot.consumerState.hasPublishedValue ||
        Boolean(currentBindingSnapshot.dataset) ||
        Boolean(currentBindingSnapshot.deltaDataset) ||
        Boolean(retainedOutputFrame && retainedOutputFrame.status !== "idle"),
      statusProvenance,
      upstreamUpdate: upstreamUpdateInput?.upstreamUpdate,
      upstreamUpdateInput,
    };
  }

  return resolveLegacyTabularTransformInputState(resolvedInputs, runtimeDataStore);
}

function resolveInvalidInputError(input: ResolvedWidgetInput | undefined) {
  if (!input) {
    return "Bind a tabular dataset before this transform can run.";
  }

  if (input.status === "missing-source") {
    return "The bound source widget is no longer available.";
  }

  if (input.status === "missing-output") {
    return "The bound source widget no longer publishes the selected output.";
  }

  if (input.status === "contract-mismatch") {
    return "The bound source output is not a tabular dataset.";
  }

  if (input.status === "self-reference-blocked") {
    return "A transform widget cannot bind to itself.";
  }

  if (input.status === "transform-invalid") {
    return "The binding transform for the source dataset is invalid.";
  }

  return "Bind a tabular dataset before this transform can run.";
}

export function resolveTabularTransformSourceConsumerState(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeDataStore?: RuntimeDataStore | null,
  runtimeState?: unknown,
): ResolvedUpstreamConsumerState<TabularFrameSourceV1> {
  const inputState = resolveTabularTransformInputState(
    resolvedInputs,
    runtimeDataStore,
    runtimeState,
  );
  const {
    consumerState,
    deltaFrame,
    retainedOutputFrame,
    sourceFrame,
    sourceInput,
  } = inputState;

  logTabularTransformDebug("source-state", {
    sourceInputStatus: sourceInput?.status,
    sourceWidgetId: sourceInput?.sourceWidgetId,
    sourceOutputId: sourceInput?.sourceOutputId,
    sourceValuePresent: Boolean(sourceFrame),
    deltaValuePresent: Boolean(deltaFrame),
    effectiveValuePresent: inputState.sourceValuePresent,
    consumerKind: consumerState.kind,
    requiresUpstreamResolution: consumerState.requiresUpstreamResolution,
    sourceFrame: summarizeFrameForDebug(sourceFrame),
    deltaFrame: summarizeFrameForDebug(deltaFrame),
    retainedOutputFrame: summarizeFrameForDebug(retainedOutputFrame),
    effectiveFrame: summarizeFrameForDebug(sourceFrame ?? retainedOutputFrame),
  });

  return consumerState;
}

export function resolveTabularTransformOutput(input: {
  props: TabularTransformWidgetProps;
  runtimeState?: unknown;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeDataStore?: RuntimeDataStore | null;
}): TabularTransformRuntimeState {
  const props = normalizeTabularTransformProps(input.props);
  const transformInputState = resolveTabularTransformInputState(
    input.resolvedInputs,
    input.runtimeDataStore,
    input.runtimeState,
  );
  const {
    consumerState: sourceConsumerState,
    deltaFrame: inputDeltaFrame,
    retainedOutputFrame,
    sourceFrame: inputSourceFrame,
    sourceInput,
    sourceValuePresent,
    statusProvenance,
    configurationError,
    upstreamUpdate,
    upstreamUpdateInput,
  } = transformInputState;
  const hasSourceBinding =
    Boolean(sourceInput) || hasIncrementalTabularRoleBindings(input.resolvedInputs);

  if (configurationError) {
    return {
      status: "error",
      error: configurationError,
      columns: [],
      rows: [],
      source: {
        kind: "tabular-transform",
        label: "Tabular transform",
        context: {
          statusProvenance,
          transformMode: props.transformMode,
        },
      },
    };
  }

  if (hasSourceBinding && (!sourceInput || sourceInput.status === "valid")) {
    const source = inputSourceFrame;
    const sourceCarriesFrame = source
      ? source.rows.length > 0 ||
        source.columns.length > 0 ||
        Boolean(getRuntimeDataRef(source))
      : false;

    logTabularTransformDebug("output-input", {
      sourceWidgetId: sourceInput?.sourceWidgetId,
      sourceOutputId: sourceInput?.sourceOutputId,
      sourceConsumerKind: sourceConsumerState.kind,
      sourceValuePresent,
      upstreamUpdateMode: upstreamUpdate?.mode,
      source: summarizeFrameForDebug(source),
      delta: summarizeFrameForDebug(inputDeltaFrame),
      retainedOutputFrame: summarizeFrameForDebug(retainedOutputFrame),
    });

    if (!source && retainedOutputFrame) {
      logTabularTransformDebug("output-retained-runtime", {
        sourceWidgetId: sourceInput?.sourceWidgetId,
        sourceOutputId: sourceInput?.sourceOutputId,
        sourceConsumerKind: sourceConsumerState.kind,
        runtimeFrame: summarizeFrameForDebug(retainedOutputFrame),
      });

      return withTabularTransformStatusProvenance(retainedOutputFrame, statusProvenance);
    }

    if (
      (sourceConsumerState.kind === "awaiting-upstream" || !sourceValuePresent) &&
      !sourceCarriesFrame
    ) {
      const runtimeFrame = retainedOutputFrame ?? normalizeTabularFrameSource(input.runtimeState);

      if (runtimeFrame && runtimeFrame.status !== "idle") {
        logTabularTransformDebug("output-retained-runtime", {
          sourceWidgetId: sourceInput?.sourceWidgetId,
          sourceOutputId: sourceInput?.sourceOutputId,
          sourceConsumerKind: sourceConsumerState.kind,
          runtimeFrame: summarizeFrameForDebug(runtimeFrame),
        });

        return withTabularTransformStatusProvenance(runtimeFrame, statusProvenance);
      }

      logTabularTransformDebug("output-idle-awaiting", {
        sourceWidgetId: sourceInput?.sourceWidgetId,
        sourceOutputId: sourceInput?.sourceOutputId,
        sourceConsumerKind: sourceConsumerState.kind,
        sourceValuePresent,
        sourceCarriesFrame,
      });

      return {
        status: "idle",
        columns: [],
        rows: [],
        source: {
          kind: "tabular-transform",
          label: "Tabular transform",
          context: {
            statusProvenance,
            transformMode: props.transformMode,
            upstreamSource:
              sourceInput?.value && typeof sourceInput.value === "object"
                ? normalizeTabularFrameSource(sourceInput.value)?.source
                : undefined,
          },
        },
      };
    }

    if (!source) {
      logTabularTransformDebug("output-error-invalid-source", {
        sourceWidgetId: sourceInput?.sourceWidgetId,
        sourceOutputId: sourceInput?.sourceOutputId,
        sourceConsumerKind: sourceConsumerState.kind,
        error: sourceConsumerState.error,
      });

      return {
        status: "error",
        error: sourceConsumerState.error ?? "The bound source did not publish a valid tabular dataset.",
        columns: [],
        rows: [],
      };
    }

    if (sourceConsumerState.kind === "error" || source.status === "error") {
      logTabularTransformDebug("output-error-source", {
        sourceWidgetId: sourceInput?.sourceWidgetId,
        sourceOutputId: sourceInput?.sourceOutputId,
        sourceConsumerKind: sourceConsumerState.kind,
        source: summarizeFrameForDebug(source),
        error: sourceConsumerState.error ?? source.error,
      });

      return {
        status: "error",
        error: sourceConsumerState.error ?? source.error ?? "The bound tabular source failed.",
        columns: source.columns,
        rows: [],
        fields: source.fields,
        source: {
          kind: "tabular-transform",
          label: "Tabular transform",
          updatedAtMs: resolveTransformSourceUpdatedAt(source),
          context: {
            statusProvenance,
            transformMode: props.transformMode,
            upstreamSource: source.source,
          },
        },
      };
    }

    const shouldBlockForNonReadySource =
      (sourceConsumerState.kind === "loading" || source.status !== "ready") &&
      !sourceCarriesFrame;

    if (shouldBlockForNonReadySource) {
      logTabularTransformDebug("output-pass-through-non-ready", {
        sourceWidgetId: sourceInput?.sourceWidgetId,
        sourceOutputId: sourceInput?.sourceOutputId,
        sourceConsumerKind: sourceConsumerState.kind,
        sourceCarriesFrame,
        source: summarizeFrameForDebug(source),
      });

      return {
        status: source.status,
        columns: source.columns,
        rows: [],
        fields: source.fields,
        source: {
          kind: "tabular-transform",
          label: "Tabular transform",
          updatedAtMs: source.source?.updatedAtMs,
          context: {
            statusProvenance,
            transformMode: props.transformMode,
            upstreamSource: source.source,
          },
        },
      };
    }

    if (source.status !== "ready") {
      logTabularTransformDebug("output-transform-non-ready-frame", {
        sourceWidgetId: sourceInput?.sourceWidgetId,
        sourceOutputId: sourceInput?.sourceOutputId,
        sourceConsumerKind: sourceConsumerState.kind,
        sourceCarriesFrame,
        source: summarizeFrameForDebug(source),
      });
    }

    const transformed = transformFrame(source, props);

    if ("error" in transformed) {
      logTabularTransformDebug("output-error-transform", {
        sourceWidgetId: sourceInput?.sourceWidgetId,
        sourceOutputId: sourceInput?.sourceOutputId,
        source: summarizeFrameForDebug(source),
        error: transformed.error,
      });

      return {
        status: "error",
        error: transformed.error,
        columns: source.columns,
        rows: [],
        fields: source.fields,
        source: {
          kind: "tabular-transform",
          label: "Tabular transform",
          updatedAtMs: source.source?.updatedAtMs,
          context: {
            statusProvenance,
            transformMode: props.transformMode,
            upstreamSource: source.source,
          },
        },
      };
    }

    const outputFrame = {
      status: "ready",
      columns: transformed.columns,
      rows: transformed.rows,
      fields:
        transformed.fields ??
        inferFields(
          transformed.columns,
          transformed.rows,
          source.fields,
          transformed.derivedColumns,
        ),
      source: {
        kind: "tabular-transform",
        label: "Tabular transform",
        updatedAtMs: resolveTransformSourceUpdatedAt(source),
        context: {
          statusProvenance,
          transformMode: props.transformMode,
          aggregateMode: props.aggregateMode,
          filterCombineMode: props.filterCombineMode,
          filterRuleCount: props.filterRules?.length ?? 0,
          rowMergeKeyFields: props.rowMergeMode === "latest" ? props.rowMergeKeyFields : undefined,
          rowMergeKeyMappings:
            props.rowMergeMode === "latest" ? resolveRowMergeKeyMappings(props) : undefined,
          rowMergeMode: props.rowMergeMode,
          upstreamSource: source.source,
        },
      },
    } satisfies TabularTransformRuntimeState;

    logTabularTransformDebug("output-ready", {
      sourceWidgetId: sourceInput?.sourceWidgetId,
      sourceOutputId: sourceInput?.sourceOutputId,
      source: summarizeFrameForDebug(source),
      output: summarizeFrameForDebug(outputFrame),
      transformMode: props.transformMode,
      rowMergeMode: props.rowMergeMode,
      hasUpstreamUpdate: Boolean(upstreamUpdate),
    });

    if (!upstreamUpdate) {
      return outputFrame;
    }

    const rowMergeKeyMappings = props.rowMergeMode === "latest"
      ? resolveRowMergeKeyMappings(props)
      : [];
    const deltaSource =
      inputDeltaFrame ??
      materializeRuntimeTabularFrame(
        upstreamUpdateInput?.upstreamDeltaRef ?? upstreamUpdateInput?.upstreamDelta,
        input.runtimeDataStore,
      ) ??
      normalizeTabularFrameSource(upstreamUpdateInput?.upstreamDelta);
    const canPublishDelta =
      upstreamUpdate.mode === "delta" &&
      canTransformDeltaFromRows(props) &&
      deltaSource !== null;
    const transformedDelta = canPublishDelta
      ? transformFrame(deltaSource, props)
      : null;
    const deltaFrame =
      transformedDelta && !("error" in transformedDelta) && canPublishDelta
        ? {
            ...outputFrame,
            rows: transformedDelta.rows,
            columns: transformedDelta.columns,
            fields:
              transformedDelta.fields ??
              inferFields(
                transformedDelta.columns,
                transformedDelta.rows,
                deltaSource.fields,
                transformedDelta.derivedColumns,
              ),
            source: {
              ...outputFrame.source,
              context: {
                ...(outputFrame.source?.context ?? {}),
                incrementalDeltaOnly: true,
              },
            },
          } satisfies TabularTransformRuntimeState
        : undefined;

    logTabularTransformDebug("output-runtime-update", {
      sourceWidgetId: sourceInput?.sourceWidgetId,
      sourceOutputId: sourceInput?.sourceOutputId,
      upstreamUpdateMode: upstreamUpdate.mode,
      canPublishDelta,
      deltaSource: summarizeFrameForDebug(deltaSource),
      deltaFrame: summarizeFrameForDebug(deltaFrame),
      fallbackToSnapshot: !deltaFrame,
    });

    return attachWidgetRuntimeUpdateContext(
      outputFrame,
      mapWidgetRuntimeUpdateEnvelope(upstreamUpdate, {
        mode: deltaFrame ? "delta" : "snapshot",
        outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        upstreamBase: outputFrame,
        upstreamDelta: deltaFrame,
        preserveOutputRefs: false,
        diagnostics: {
          ...(rowMergeKeyMappings.length > 0
            ? {
                mergeKeyFields: rowMergeKeyMappings.map((mapping) => mapping.seedField),
                mergeKeyMappings: rowMergeKeyMappings,
                tabularTransformRowMergeMode: props.rowMergeMode,
              }
            : {}),
          ...(deltaFrame
            ? {}
            : {
                tabularTransformDeltaFallback: props.transformMode,
              }),
        },
      }),
    );
  }

  if (sourceInput) {
    logTabularTransformDebug("output-error-input", {
      sourceInputStatus: sourceInput.status,
      sourceWidgetId: sourceInput.sourceWidgetId,
      sourceOutputId: sourceInput.sourceOutputId,
      error: resolveInvalidInputError(sourceInput),
    });

    return {
      status: "error",
      error: resolveInvalidInputError(sourceInput),
      columns: [],
      rows: [],
    };
  }

  const runtimeFrame = normalizeTabularFrameSource(input.runtimeState);

  logTabularTransformDebug("output-runtime-fallback", {
    runtimeFrame: summarizeFrameForDebug(runtimeFrame),
  });

  return runtimeFrame ?? {
    status: "idle",
    columns: [],
    rows: [],
  };
}

function buildInactiveTabularTransformOutput(input: {
  message: string;
  props: ReturnType<typeof normalizeTabularTransformProps>;
  statusProvenance: TabularTransformStatusProvenance;
}): TabularTransformRuntimeState {
  return {
    status: "idle",
    columns: [],
    rows: [],
    source: {
      kind: "tabular-transform",
      label: "Tabular transform",
      context: {
        inactiveOutputReason: input.message,
        statusProvenance: input.statusProvenance,
        transformMode: input.props.transformMode,
      },
    },
  };
}

export function resolveTabularTransformChannelOutput(input: {
  outputChannel: TabularTransformOutputChannel;
  props: TabularTransformWidgetProps;
  runtimeState?: unknown;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeDataStore?: RuntimeDataStore | null;
}): TabularTransformRuntimeState {
  const props = normalizeTabularTransformProps(input.props);
  const inputState = resolveTabularTransformInputState(
    input.resolvedInputs,
    input.runtimeDataStore,
    input.runtimeState,
  );

  if (inputState.configurationError) {
    return resolveTabularTransformOutput(input);
  }

  if (input.outputChannel === "dataset" && inputState.activeInputRole === "live") {
    return buildInactiveTabularTransformOutput({
      message: TABULAR_TRANSFORM_INACTIVE_DATASET_OUTPUT_MESSAGE,
      props,
      statusProvenance: inputState.statusProvenance,
    });
  }

  if (
    input.outputChannel === "updates" &&
    (inputState.activeInputRole === "seed" || inputState.activeInputRole === "legacy")
  ) {
    return buildInactiveTabularTransformOutput({
      message: TABULAR_TRANSFORM_INACTIVE_UPDATES_OUTPUT_MESSAGE,
      props,
      statusProvenance: inputState.statusProvenance,
    });
  }

  return resolveTabularTransformOutput(input);
}

export function normalizeTabularTransformRuntimeState(
  value: unknown,
): TabularTransformRuntimeState | null {
  return normalizeTabularFrameSource(value);
}

export function formatTabularTransformSummary(props: TabularTransformWidgetProps) {
  const normalized = normalizeTabularTransformProps(props);
  const rowMergeKeyLabels =
    normalized.rowMergeMode === "latest"
      ? resolveRowMergeKeyMappings(normalized).map((mapping) => mapping.seedField)
      : [];

  if (normalized.transformMode === "filter") {
    const ruleCount = normalized.filterRules?.length ?? 0;

    if (ruleCount === 1 && normalized.filterRules?.[0]?.field && normalized.filterRules[0].operator) {
      return `Filter ${normalized.filterRules[0].field} (${normalized.filterRules[0].operator})`;
    }

    if (ruleCount > 1) {
      return `Filter ${ruleCount.toLocaleString()} rules (${normalized.filterCombineMode})`;
    }

    return "Filter rows";
  }

  if (normalized.transformMode === "aggregate" && normalized.keyFields?.length) {
    return `Aggregate by ${normalized.keyFields.join(", ")} (${normalized.aggregateMode})`;
  }

  if (normalized.transformMode === "pivot" && normalized.pivotField && normalized.pivotValueField) {
    return `Pivot ${normalized.pivotField} -> ${normalized.pivotValueField} (${normalized.aggregateMode})`;
  }

  if (normalized.transformMode === "unpivot" && normalized.unpivotValueFields?.length) {
    return `Unpivot ${normalized.unpivotValueFields.length.toLocaleString()} columns`;
  }

  if (normalized.projectFields?.length) {
    return rowMergeKeyLabels.length > 0
      ? `Project ${normalized.projectFields.length.toLocaleString()} columns, latest by ${rowMergeKeyLabels.join(", ")}`
      : `Project ${normalized.projectFields.length.toLocaleString()} columns`;
  }

  if ((normalized.computedColumns?.length ?? 0) > 0) {
    return rowMergeKeyLabels.length > 0
      ? `Compute ${normalized.computedColumns!.length.toLocaleString()} columns, latest by ${rowMergeKeyLabels.join(", ")}`
      : `Compute ${normalized.computedColumns!.length.toLocaleString()} columns`;
  }

  if (rowMergeKeyLabels.length > 0) {
    return `Latest by ${rowMergeKeyLabels.join(", ")}`;
  }

  return "Pass through";
}

export function parseFieldListText(value: string) {
  return normalizeFieldList(value) ?? [];
}

export function formatFieldListText(value: readonly string[] | undefined) {
  return (value ?? []).join(", ");
}
