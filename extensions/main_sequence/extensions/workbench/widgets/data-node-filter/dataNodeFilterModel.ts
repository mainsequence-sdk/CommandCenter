import type { DataNodeDetail, DataNodeRemoteDataRow } from "../../../../common/api";
import {
  buildDataNodeFieldOptionsFromRows,
  resolveDataNodeDateRange,
  type DataNodeFieldOption,
} from "../data-node-shared/dataNodeShared";
import {
  normalizeDataNodeWidgetSourceReferenceProps,
  normalizeDataNodeWidgetSourceProps,
  resolveDataNodeWidgetSourceConfig,
  type DataNodeWidgetSourceReferenceProps,
  type DataNodeWidgetSourceProps,
  type ResolvedDataNodeWidgetSourceConfig,
} from "../data-node-shared/dataNodeWidgetSource";

const defaultDataNodeFilterLimit = 2_500;

export type DataNodeFilterChromeMode = "default" | "minimal";
export type DataNodeGroupAggregateMode = "first" | "last" | "sum" | "mean" | "min" | "max";
export type DataNodeTransformMode = "none" | "aggregate" | "pivot";

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
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

function isNumericValue(value: unknown): value is number {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed);
}

function normalizeGroupByFields(
  value: unknown,
  validFieldKeys?: string[],
) {
  const normalized = Array.isArray(value)
    ? uniqueStrings(
        value.map((entry) => (typeof entry === "string" ? entry.trim() : "")),
      )
    : typeof value === "string"
      ? uniqueStrings(value.split(/[\n,]+/).map((entry) => entry.trim()))
      : [];

  if (validFieldKeys == null || validFieldKeys.length === 0) {
    return normalized.length > 0 ? normalized : undefined;
  }

  const allowed = new Set(validFieldKeys);
  const filtered = normalized.filter((entry) => allowed.has(entry));
  return filtered.length > 0 ? filtered : undefined;
}

function normalizeOptionalFieldKey(
  value: unknown,
  validFieldKeys?: string[],
) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim();

  if (validFieldKeys == null || validFieldKeys.length === 0) {
    return normalized;
  }

  return validFieldKeys.includes(normalized) ? normalized : undefined;
}

function normalizeGroupAggregateMode(value: unknown): DataNodeGroupAggregateMode {
  return value === "first" ||
    value === "last" ||
    value === "sum" ||
    value === "mean" ||
    value === "min" ||
    value === "max"
    ? value
    : "last";
}

function normalizeTransformMode(value: unknown): DataNodeTransformMode {
  return value === "aggregate" || value === "pivot" ? value : "none";
}

export interface MainSequenceDataNodeFilterWidgetProps
  extends DataNodeWidgetSourceProps,
    DataNodeWidgetSourceReferenceProps {
  aggregateMode?: DataNodeGroupAggregateMode;
  chromeMode?: DataNodeFilterChromeMode;
  keyFields?: string[];
  limit?: number;
  pivotField?: string;
  pivotValueField?: string;
  projectFields?: string[];
  showHeader?: boolean;
  transformMode?: DataNodeTransformMode;
}

export interface ResolvedDataNodeFilterConfig extends ResolvedDataNodeWidgetSourceConfig {
  aggregateMode: DataNodeGroupAggregateMode;
  keyFields?: string[];
  limit: number;
  pivotField?: string;
  pivotValueField?: string;
  projectFields?: string[];
  transformMode: DataNodeTransformMode;
}

export interface DataNodeFilterRuntimeState {
  columns: string[];
  dataNodeId?: number;
  error?: string;
  limit: number;
  rangeEndMs?: number | null;
  rangeStartMs?: number | null;
  rows: DataNodeRemoteDataRow[];
  status: "idle" | "loading" | "error" | "ready";
  uniqueIdentifierList?: string[];
  updatedAtMs?: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeColumns(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (typeof entry !== "string" || !entry.trim()) {
      return [];
    }

    const nextValue = entry.trim();

    if (seen.has(nextValue)) {
      return [];
    }

    seen.add(nextValue);
    return [nextValue];
  });
}

function normalizeRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is DataNodeRemoteDataRow => isPlainRecord(entry));
}

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeStatus(value: unknown): DataNodeFilterRuntimeState["status"] {
  return value === "loading" || value === "error" || value === "ready" ? value : "idle";
}

export function normalizeDataNodeFilterRuntimeState(
  value: unknown,
): DataNodeFilterRuntimeState | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  return {
    columns: normalizeColumns(value.columns),
    dataNodeId: normalizePositiveInteger(value.dataNodeId),
    error: typeof value.error === "string" && value.error.trim() ? value.error.trim() : undefined,
    limit: normalizePositiveInteger(value.limit) ?? defaultDataNodeFilterLimit,
    rangeEndMs: normalizeTimestampMs(value.rangeEndMs) ?? null,
    rangeStartMs: normalizeTimestampMs(value.rangeStartMs) ?? null,
    rows: normalizeRows(value.rows),
    status: normalizeStatus(value.status),
    uniqueIdentifierList: Array.isArray(value.uniqueIdentifierList)
      ? value.uniqueIdentifierList.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        )
      : undefined,
    updatedAtMs: normalizeTimestampMs(value.updatedAtMs),
  };
}

export function resolveDataNodeFilterConfig(
  props: MainSequenceDataNodeFilterWidgetProps,
  detail?: DataNodeDetail | null,
  fieldOptionsOverride?: DataNodeFieldOption[],
): ResolvedDataNodeFilterConfig {
  const sourceReference = normalizeDataNodeWidgetSourceReferenceProps(props);
  const sourceConfig = resolveDataNodeWidgetSourceConfig(props, detail);
  const availableFields =
    fieldOptionsOverride && fieldOptionsOverride.length > 0
      ? fieldOptionsOverride
      : sourceConfig.availableFields;

  return {
    ...sourceConfig,
    availableFields,
    sourceMode: sourceReference.sourceMode,
    sourceWidgetId: sourceReference.sourceWidgetId,
    aggregateMode: normalizeGroupAggregateMode(props.aggregateMode),
    keyFields: normalizeGroupByFields(
      props.keyFields,
      availableFields.map((field) => field.key),
    ),
    pivotField: normalizeOptionalFieldKey(
      props.pivotField,
      availableFields.map((field) => field.key),
    ),
    pivotValueField: normalizeOptionalFieldKey(
      props.pivotValueField,
      availableFields.map((field) => field.key),
    ),
    projectFields: normalizeGroupByFields(props.projectFields),
    transformMode:
      normalizeTransformMode(props.transformMode) === "none"
        ? props.pivotField && props.pivotValueField
          ? "pivot"
          : props.keyFields?.length
            ? "aggregate"
            : "none"
        : normalizeTransformMode(props.transformMode),
    limit: normalizePositiveInteger(props.limit) ?? defaultDataNodeFilterLimit,
  };
}

export function normalizeDataNodeFilterProps(
  props: MainSequenceDataNodeFilterWidgetProps,
  detail?: DataNodeDetail | null,
) {
  const resolved = resolveDataNodeFilterConfig(props, detail);

  return {
    chromeMode: props.chromeMode === "default" ? "default" : "minimal",
    ...normalizeDataNodeWidgetSourceProps(props, detail),
    ...normalizeDataNodeWidgetSourceReferenceProps(props),
    aggregateMode: resolved.aggregateMode,
    keyFields: resolved.keyFields,
    limit: resolved.limit,
    pivotField: resolved.pivotField,
    pivotValueField: resolved.pivotValueField,
    projectFields: resolved.projectFields,
    showHeader: props.showHeader === true,
    transformMode: resolved.transformMode,
  } satisfies MainSequenceDataNodeFilterWidgetProps;
}

export function resolveDataNodeFilterDateRange(
  config: Pick<ResolvedDataNodeFilterConfig, "dateRangeMode" | "fixedEndMs" | "fixedStartMs">,
  dashboardStartMs?: number | null,
  dashboardEndMs?: number | null,
) {
  return resolveDataNodeDateRange(config, dashboardStartMs, dashboardEndMs);
}

function collectRowKeys(rows: readonly DataNodeRemoteDataRow[]) {
  return uniqueStrings(rows.flatMap((row) => Object.keys(row)));
}

function projectTransformedDataset(
  rows: readonly DataNodeRemoteDataRow[],
  columns: readonly string[],
  projectFields?: readonly string[],
) {
  const projectedColumns = projectFields
    ? projectFields.filter((column) => columns.includes(column))
    : [];

  if (projectedColumns.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
    };
  }

  return {
    columns: projectedColumns,
    rows: rows.map<DataNodeRemoteDataRow>((row) =>
      Object.fromEntries(projectedColumns.map((column) => [column, row[column] ?? null])),
    ),
  };
}

function shouldBypassPivotProjection(
  config: Pick<ResolvedDataNodeFilterConfig, "keyFields" | "projectFields" | "transformMode">,
  baseColumns: readonly string[],
) {
  if (config.transformMode !== "pivot" || !config.projectFields || config.projectFields.length === 0) {
    return false;
  }

  const projectedColumns = config.projectFields.filter((column) => baseColumns.includes(column));

  if (projectedColumns.length === 0) {
    return false;
  }

  const rowKeyColumns = (config.keyFields ?? []).filter((column) => baseColumns.includes(column));
  return projectedColumns.every((column) => rowKeyColumns.includes(column));
}

function getRepresentativeValue(
  rows: readonly DataNodeRemoteDataRow[],
  columnKey: string,
  mode: DataNodeGroupAggregateMode,
) {
  const values = rows
    .map((row) => row[columnKey])
    .filter((value) => value !== null && value !== undefined && value !== "");

  if (values.length === 0) {
    return null;
  }

  if (mode === "first") {
    return values[0] ?? null;
  }

  return values[values.length - 1] ?? null;
}

function aggregateNumericValues(
  values: number[],
  mode: DataNodeGroupAggregateMode,
) {
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

function buildGroupedDataset(
  rows: readonly DataNodeRemoteDataRow[],
  columns: readonly string[],
  config: Pick<ResolvedDataNodeFilterConfig, "aggregateMode" | "keyFields">,
) {
  if (!config.keyFields || config.keyFields.length === 0 || rows.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
    };
  }

  const groupColumns = config.keyFields.filter((key) => columns.includes(key));

  if (groupColumns.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
    };
  }

  const groupedRows = new Map<string, DataNodeRemoteDataRow[]>();

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
  const transformedRows = [...groupedRows.values()].map<DataNodeRemoteDataRow>((groupRows) => {
    const nextRow: DataNodeRemoteDataRow = {};

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

      if (numericValues.length > 0) {
        nextRow[column] = aggregateNumericValues(numericValues, config.aggregateMode);
        return;
      }

      nextRow[column] = getRepresentativeValue(groupRows, column, config.aggregateMode);
    });

    return nextRow;
  });

  return {
    columns: outputColumns,
    rows: transformedRows,
  };
}

function buildPivotedDataset(
  rows: readonly DataNodeRemoteDataRow[],
  columns: readonly string[],
  config: Pick<
    ResolvedDataNodeFilterConfig,
    "aggregateMode" | "keyFields" | "pivotField" | "pivotValueField"
  >,
) {
  if (!config.pivotField || !config.pivotValueField || rows.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
    };
  }

  if (!columns.includes(config.pivotField) || !columns.includes(config.pivotValueField)) {
    return {
      columns: [...columns],
      rows: [...rows],
    };
  }

  const pivotField = config.pivotField;
  const pivotValueField = config.pivotValueField;

  const rowKeyColumns = (config.keyFields ?? []).filter(
    (column) =>
      column !== pivotField &&
      column !== pivotValueField &&
      columns.includes(column),
  );
  const pivotValues = uniqueStrings(rows.map((row) => formatPivotValue(row[pivotField])));
  const pivotColumnNames = pivotValues.map((pivotValue) => {
    if (!rowKeyColumns.includes(pivotValue)) {
      return pivotValue;
    }

    return `${pivotValueField}:${pivotValue}`;
  });
  const groupedRows = new Map<string, DataNodeRemoteDataRow[]>();

  rows.forEach((row) => {
    const key = JSON.stringify(rowKeyColumns.map((column) => row[column] ?? null));
    const current = groupedRows.get(key) ?? [];
    current.push(row);
    groupedRows.set(key, current);
  });

  const outputRows = [...groupedRows.values()].map<DataNodeRemoteDataRow>((groupRows) => {
    const nextRow: DataNodeRemoteDataRow = {};

    rowKeyColumns.forEach((column) => {
      nextRow[column] = groupRows[0]?.[column] ?? null;
    });

    pivotValues.forEach((pivotValue, index) => {
      const matchingRows = groupRows.filter(
        (row) => formatPivotValue(row[pivotField]) === pivotValue,
      );

      const numericValues = matchingRows
        .map((row) => row[pivotValueField])
        .filter(isNumericValue)
        .map((value) => Number(value));

      nextRow[pivotColumnNames[index]!] =
        numericValues.length > 0
          ? aggregateNumericValues(numericValues, config.aggregateMode)
          : getRepresentativeValue(
              matchingRows,
              pivotValueField,
              config.aggregateMode,
            );
    });

    return nextRow;
  });

  return {
    columns: uniqueStrings([...rowKeyColumns, ...pivotColumnNames]),
    rows: outputRows,
  };
}

export function buildDataNodeTransformedDataset(
  rows: readonly DataNodeRemoteDataRow[],
  config: Pick<
    ResolvedDataNodeFilterConfig,
    "aggregateMode" | "keyFields" | "pivotField" | "pivotValueField" | "projectFields" | "transformMode"
  >,
  knownColumns?: readonly string[],
) {
  const columns = uniqueStrings([
    ...(knownColumns ?? []),
    ...collectRowKeys(rows),
  ]);

  const baseDataset =
    config.transformMode === "pivot"
      ? buildPivotedDataset(rows, columns, config)
      : config.transformMode === "aggregate"
        ? buildGroupedDataset(rows, columns, config)
        : {
            columns: [...columns],
            rows: [...rows],
          };
  const effectiveProjectFields = shouldBypassPivotProjection(config, baseDataset.columns)
    ? undefined
    : config.projectFields;
  const projectedDataset = projectTransformedDataset(
    baseDataset.rows,
    baseDataset.columns,
    effectiveProjectFields,
  );

  return {
    columns: projectedDataset.columns,
    rows: projectedDataset.rows,
    availableFields: buildDataNodeFieldOptionsFromRows({
      columns: projectedDataset.columns,
      rows: projectedDataset.rows,
    }),
  };
}
