import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
} from "@/widgets/types";
import { compileTableFormulaExpression } from "@/widgets/core/table/tableFormulaCompiler";
import {
  applyResolvedTableComputedColumns,
  tableTransformsMetaKey,
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
} from "@/widgets/shared/runtime-update";
import {
  materializeRuntimeTabularFrame,
  type RuntimeDataStore,
} from "@/widgets/shared/runtime-data-store";
import {
  resolveUpstreamConsumerState,
  type ResolvedUpstreamConsumerState,
} from "@/widgets/shared/upstream-consumer-state";

export const TABULAR_TRANSFORM_SOURCE_INPUT_ID = "sourceData";
export const TABULAR_TRANSFORM_DATASET_OUTPUT_ID = "dataset";

export type TabularTransformMode = "none" | "filter" | "aggregate" | "pivot" | "unpivot";
export type TabularAggregateMode = "first" | "last" | "sum" | "mean" | "min" | "max";
export type TabularFilterCombineMode = "all" | "any";
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
  unpivotFieldName?: string;
  unpivotValueFieldName?: string;
  unpivotValueFields?: string[];
}

export type TabularTransformRuntimeState = TabularFrameSourceV1;

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

  return {
    ...projected,
    fields:
      withComputedColumns.fields?.filter((field) => projected.columns.includes(field.key)) ??
      inferFields(projected.columns, projected.rows, source.fields, projected.derivedColumns),
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
): ResolvedUpstreamConsumerState<TabularFrameSourceV1> {
  const sourceInput = resolveSourceInput(resolvedInputs);
  const sourceValue =
    sourceInput?.upstreamBaseRef ??
    sourceInput?.valueRef ??
    sourceInput?.upstreamBase ??
    sourceInput?.value;
  const sourceFrame =
    materializeRuntimeTabularFrame(sourceValue, runtimeDataStore) ??
    normalizeTabularFrameSource(sourceInput?.upstreamBase ?? sourceInput?.value);

  return resolveUpstreamConsumerState({
    hasCanonicalSourceBinding: Boolean(sourceInput?.sourceWidgetId),
    hasPublishedValue: sourceValue !== undefined,
    resolvedSourceInput: sourceInput,
    dataset: sourceFrame,
    invalidPublishedValueMessage: "The bound source did not publish a valid tabular dataset.",
  });
}

export function resolveTabularTransformOutput(input: {
  props: TabularTransformWidgetProps;
  runtimeState?: unknown;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeDataStore?: RuntimeDataStore | null;
}): TabularTransformRuntimeState {
  const props = normalizeTabularTransformProps(input.props);
  const sourceInput = resolveSourceInput(input.resolvedInputs);
  const sourceConsumerState = resolveTabularTransformSourceConsumerState(
    input.resolvedInputs,
    input.runtimeDataStore,
  );

  if (sourceInput?.status === "valid") {
    const source = sourceConsumerState.dataset;
    const sourceValue =
      sourceInput.upstreamBaseRef ??
      sourceInput.valueRef ??
      sourceInput.upstreamBase ??
      sourceInput.value;

    if (sourceConsumerState.kind === "awaiting-upstream" || sourceValue === undefined) {
      return {
        status: "idle",
        columns: [],
        rows: [],
      };
    }

    if (!source) {
      return {
        status: "error",
        error: sourceConsumerState.error ?? "The bound source did not publish a valid tabular dataset.",
        columns: [],
        rows: [],
      };
    }

    if (sourceConsumerState.kind === "error" || source.status === "error") {
      return {
        status: "error",
        error: sourceConsumerState.error ?? source.error ?? "The bound tabular source failed.",
        columns: source.columns,
        rows: [],
        fields: source.fields,
        source: {
          kind: "tabular-transform",
          label: "Tabular transform",
          updatedAtMs: Date.now(),
          context: {
            transformMode: props.transformMode,
            upstreamSource: source.source,
          },
        },
      };
    }

    if (sourceConsumerState.kind === "loading" || source.status !== "ready") {
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
            transformMode: props.transformMode,
            upstreamSource: source.source,
          },
        },
      };
    }

    const transformed = transformFrame(source, props);

    if ("error" in transformed) {
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
      meta:
        (transformed.metaComputedColumns ?? []).length > 0
          ? {
              [tableTransformsMetaKey]: {
                computedColumns: transformed.metaComputedColumns ?? [],
              },
            }
          : undefined,
      source: {
        kind: "tabular-transform",
        label: "Tabular transform",
        updatedAtMs: Date.now(),
        context: {
          transformMode: props.transformMode,
          aggregateMode: props.aggregateMode,
          filterCombineMode: props.filterCombineMode,
          filterRuleCount: props.filterRules?.length ?? 0,
          upstreamSource: source.source,
        },
      },
    } satisfies TabularTransformRuntimeState;

    if (!sourceInput.upstreamUpdate) {
      return outputFrame;
    }

    const deltaSource =
      materializeRuntimeTabularFrame(
        sourceInput.upstreamDeltaRef ?? sourceInput.upstreamDelta,
        input.runtimeDataStore,
      ) ??
      normalizeTabularFrameSource(sourceInput.upstreamDelta);
    const canPublishDelta =
      sourceInput.upstreamUpdate.mode === "delta" &&
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
            meta:
              (transformedDelta.metaComputedColumns ?? []).length > 0
                ? {
                    [tableTransformsMetaKey]: {
                      computedColumns: transformedDelta.metaComputedColumns ?? [],
                    },
                  }
                : undefined,
            source: {
              ...outputFrame.source,
              context: {
                ...(outputFrame.source?.context ?? {}),
                incrementalDeltaOnly: true,
              },
            },
          } satisfies TabularTransformRuntimeState
        : undefined;

    return attachWidgetRuntimeUpdateContext(
      outputFrame,
      mapWidgetRuntimeUpdateEnvelope(sourceInput.upstreamUpdate, {
        mode: deltaFrame ? "delta" : "snapshot",
        outputContractId: CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        upstreamBase: outputFrame,
        upstreamDelta: deltaFrame,
        preserveOutputRefs: false,
        diagnostics: deltaFrame
          ? undefined
          : {
              tabularTransformDeltaFallback: props.transformMode,
            },
      }),
    );
  }

  if (sourceInput) {
    return {
      status: "error",
      error: resolveInvalidInputError(sourceInput),
      columns: [],
      rows: [],
    };
  }

  const runtimeFrame = normalizeTabularFrameSource(input.runtimeState);

  return runtimeFrame ?? {
    status: "idle",
    columns: [],
    rows: [],
  };
}

export function normalizeTabularTransformRuntimeState(
  value: unknown,
): TabularTransformRuntimeState | null {
  return normalizeTabularFrameSource(value);
}

export function formatTabularTransformSummary(props: TabularTransformWidgetProps) {
  const normalized = normalizeTabularTransformProps(props);

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
    return `Project ${normalized.projectFields.length.toLocaleString()} columns`;
  }

  if ((normalized.computedColumns?.length ?? 0) > 0) {
    return `Compute ${normalized.computedColumns!.length.toLocaleString()} columns`;
  }

  return "Pass through";
}

export function parseFieldListText(value: string) {
  return normalizeFieldList(value) ?? [];
}

export function formatFieldListText(value: readonly string[] | undefined) {
  return (value ?? []).join(", ");
}
