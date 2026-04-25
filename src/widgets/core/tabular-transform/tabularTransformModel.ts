import type {
  ResolvedWidgetInput,
  ResolvedWidgetInputs,
} from "@/widgets/types";
import {
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";

export const TABULAR_TRANSFORM_SOURCE_INPUT_ID = "sourceData";
export const TABULAR_TRANSFORM_DATASET_OUTPUT_ID = "dataset";

export type TabularTransformMode = "none" | "aggregate" | "pivot" | "unpivot";
export type TabularAggregateMode = "first" | "last" | "sum" | "mean" | "min" | "max";

export interface TabularTransformWidgetProps extends Record<string, unknown> {
  transformMode?: TabularTransformMode;
  aggregateMode?: TabularAggregateMode;
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

function normalizeTransformMode(value: unknown): TabularTransformMode {
  return value === "aggregate" || value === "pivot" || value === "unpivot" ? value : "none";
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

export function normalizeTabularTransformProps(
  props: TabularTransformWidgetProps,
): Required<
  Pick<
    TabularTransformWidgetProps,
    "aggregateMode" | "transformMode" | "unpivotFieldName" | "unpivotValueFieldName"
  >
> &
  TabularTransformWidgetProps {
  return {
    ...props,
    transformMode: normalizeTransformMode(props.transformMode),
    aggregateMode: normalizeAggregateMode(props.aggregateMode),
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
  };
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
  };
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
  };
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
  };
}

function transformFrame(
  source: TabularFrameSourceV1,
  props: ReturnType<typeof normalizeTabularTransformProps>,
) {
  const columns = uniqueStrings([...source.columns, ...collectRowKeys(source.rows)]);
  const base =
    props.transformMode === "aggregate"
      ? buildGroupedDataset(source.rows, columns, props)
      : props.transformMode === "pivot"
        ? buildPivotedDataset(source.rows, columns, props)
        : props.transformMode === "unpivot"
          ? buildUnpivotedDataset(source.rows, columns, props)
          : {
              columns,
              rows: [...source.rows],
              derivedColumns: new Set<string>(),
            };

  return projectDataset(base.rows, base.columns, props.projectFields, base.derivedColumns);
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

export function resolveTabularTransformOutput(input: {
  props: TabularTransformWidgetProps;
  runtimeState?: unknown;
  resolvedInputs?: ResolvedWidgetInputs;
}): TabularTransformRuntimeState {
  const props = normalizeTabularTransformProps(input.props);
  const sourceInput = resolveSourceInput(input.resolvedInputs);

  if (sourceInput?.status === "valid") {
    const source = normalizeTabularFrameSource(sourceInput.value);

    if (!source) {
      return {
        status: "error",
        error: "The bound source did not publish a valid tabular dataset.",
        columns: [],
        rows: [],
      };
    }

    if (source.status === "error") {
      return {
        status: "error",
        error: source.error ?? "The bound tabular source failed.",
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

    if (source.status !== "ready") {
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

    return {
      status: "ready",
      columns: transformed.columns,
      rows: transformed.rows,
      fields: inferFields(
        transformed.columns,
        transformed.rows,
        source.fields,
        transformed.derivedColumns,
      ),
      source: {
        kind: "tabular-transform",
        label: "Tabular transform",
        updatedAtMs: Date.now(),
        context: {
          transformMode: props.transformMode,
          aggregateMode: props.aggregateMode,
          upstreamSource: source.source,
        },
      },
    };
  }

  const runtimeFrame = normalizeTabularFrameSource(input.runtimeState);

  if (runtimeFrame) {
    return runtimeFrame;
  }

  return {
    status: sourceInput ? "error" : "idle",
    error: sourceInput ? resolveInvalidInputError(sourceInput) : undefined,
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

  return "Pass through";
}

export function parseFieldListText(value: string) {
  return normalizeFieldList(value) ?? [];
}

export function formatFieldListText(value: readonly string[] | undefined) {
  return (value ?? []).join(", ");
}
