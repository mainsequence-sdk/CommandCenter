import type { DataNodeDetail, DataNodeRemoteDataRow } from "../../../../common/api";
import type { ResolvedWidgetInputs } from "@/widgets/types";
import {
  normalizeTabularFrameSource,
  type TabularFrameFieldType,
} from "@/widgets/shared/tabular-frame-source";
import {
  buildDataNodeFieldOptionsFromRows,
  resolveDataNodeFieldOptionsFromDataset,
  resolveDataNodeDateRange,
  type DataNodeFieldOption,
} from "../data-node-shared/dataNodeShared";
import {
  defaultDataNodePublishedDatasetLimit,
  normalizeDataNodePublishedDataset,
  type DataNodePublishedDataset,
} from "../data-node-shared/dataNodePublishedDataset";
import { buildMainSequenceDataSourceDescriptor } from "../../widget-contracts/mainSequenceDataSourceBundle";
import {
  buildManualDataNodeFieldOptions,
  normalizeManualDataNodeColumns,
  normalizeManualDataNodeRows,
  normalizeDataNodeWidgetSourceReferenceProps,
  normalizeDataNodeWidgetSourceProps,
  resolveDataNodeWidgetSourceConfig,
  type DataNodeWidgetSourceReferenceProps,
  type DataNodeWidgetSourceProps,
  type ResolvedDataNodeWidgetSourceConfig,
} from "../data-node-shared/dataNodeWidgetSource";
import { DATA_NODE_SOURCE_INPUT_ID } from "../data-node-shared/widgetBindings";

const defaultDataNodeFilterLimit = defaultDataNodePublishedDatasetLimit;

export type DataNodeFilterChromeMode = "default" | "minimal";
export type DataNodeGroupAggregateMode = "first" | "last" | "sum" | "mean" | "min" | "max";
export type DataNodeTransformMode = "none" | "aggregate" | "pivot" | "unpivot";

const defaultUnpivotFieldName = "series";
const defaultUnpivotValueFieldName = "value";

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coerceManualDataNodeCellValue(
  value: unknown,
  type: TabularFrameFieldType,
) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  if (type === "boolean") {
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

  if (type === "number" || type === "integer") {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.trim())
          : Number.NaN;

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return type === "integer" ? Math.trunc(parsed) : parsed;
  }

  if (type === "json") {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  if (type === "datetime" || type === "date" || type === "time") {
    return typeof value === "string" ? value.trim() : String(value);
  }

  return typeof value === "string" ? value : String(value);
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
  return value === "aggregate" || value === "pivot" || value === "unpivot" ? value : "none";
}

function normalizeOutputFieldName(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim();
}

function createUniqueOutputFieldName(
  requestedName: string,
  reservedNames: Iterable<string>,
  fallbackBase: string,
) {
  const reserved = new Set(
    [...reservedNames].filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()),
  );

  if (!reserved.has(requestedName)) {
    return requestedName;
  }

  if (!reserved.has(fallbackBase)) {
    return fallbackBase;
  }

  let suffix = 2;

  while (reserved.has(`${fallbackBase}_${suffix}`)) {
    suffix += 1;
  }

  return `${fallbackBase}_${suffix}`;
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
  unpivotFieldName?: string;
  unpivotValueFieldName?: string;
  unpivotValueFields?: string[];
}

export interface ResolvedDataNodeFilterConfig extends ResolvedDataNodeWidgetSourceConfig {
  aggregateMode: DataNodeGroupAggregateMode;
  keyFields?: string[];
  limit: number;
  pivotField?: string;
  pivotValueField?: string;
  projectFields?: string[];
  transformMode: DataNodeTransformMode;
  unpivotFieldName: string;
  unpivotValueFieldName: string;
  unpivotValueFields?: string[];
}

export type DataNodeFilterRuntimeState = DataNodePublishedDataset;

export function normalizeDataNodeFilterRuntimeState(
  value: unknown,
): DataNodeFilterRuntimeState | null {
  return normalizeDataNodePublishedDataset(value);
}

function resolveDataNodeSourceInput(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  const resolvedEntry = resolvedInputs?.[DATA_NODE_SOURCE_INPUT_ID];

  if (!resolvedEntry || Array.isArray(resolvedEntry)) {
    return undefined;
  }

  return resolvedEntry.status === "valid" ? resolvedEntry : undefined;
}

export function buildManualDataNodeSourceDataset(
  props: MainSequenceDataNodeFilterWidgetProps,
): DataNodePublishedDataset {
  const manualColumns = normalizeManualDataNodeColumns(props.manualColumns);
  const rawRows = normalizeManualDataNodeRows(props.manualRows);
  const fields = buildManualDataNodeFieldOptions({
    columns: manualColumns,
    rows: rawRows,
  });
  const columns = fields.map((field) => field.key);
  const rows = rawRows.map<DataNodeRemoteDataRow>((row) =>
    Object.fromEntries(
      columns.map((columnKey) => {
        const fieldType = fields.find((field) => field.key === columnKey)?.type ?? "string";
        const nextValue = isPlainRecord(row) ? row[columnKey] : null;
        return [columnKey, coerceManualDataNodeCellValue(nextValue, fieldType)];
      }),
    ),
  );
  const hasConfiguredManualTable = columns.length > 0;

  return {
    status: hasConfiguredManualTable ? "ready" : "idle",
    columns,
    rows,
    fields,
    limit: normalizePositiveInteger(props.limit) ?? defaultDataNodeFilterLimit,
    rangeStartMs: null,
    rangeEndMs: null,
    source: buildMainSequenceDataSourceDescriptor({
      dataNodeLabel: "Manual table",
      limit: normalizePositiveInteger(props.limit) ?? defaultDataNodeFilterLimit,
    }),
  };
}

export function resolveDataNodePublishedOutput(args: {
  props: MainSequenceDataNodeFilterWidgetProps;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
}) {
  const normalizedProps = normalizeDataNodeFilterProps(args.props);
  const runtimeDataset = normalizeDataNodeFilterRuntimeState(args.runtimeState);
  const normalizedSourceReference = normalizeDataNodeWidgetSourceReferenceProps(args.props);
  const resolvedSourceInput = resolveDataNodeSourceInput(args.resolvedInputs);
  const resolvedSourceFrame = normalizeTabularFrameSource(resolvedSourceInput?.value);
  const resolvedSourceDataset = normalizeDataNodePublishedDataset(resolvedSourceInput?.value);

  if (normalizedSourceReference.sourceMode === "manual") {
    const manualSourceDataset = buildManualDataNodeSourceDataset(normalizedProps);
    const resolvedConfig = resolveDataNodeFilterConfig(
      normalizedProps,
      undefined,
      manualSourceDataset.fields,
    );
    const transformedDataset =
      manualSourceDataset.status === "ready"
        ? buildDataNodeTransformedDataset(
            manualSourceDataset.rows,
            resolvedConfig,
            manualSourceDataset.columns,
            manualSourceDataset.fields,
          )
        : null;

    return {
      status: manualSourceDataset.status,
      error: runtimeDataset?.error,
      columns: transformedDataset?.columns ?? manualSourceDataset.columns,
      rows:
        transformedDataset?.rows ??
        (manualSourceDataset.status === "ready" ? manualSourceDataset.rows : []),
      fields: transformedDataset?.availableFields ?? manualSourceDataset.fields,
      rangeStartMs: null,
      rangeEndMs: null,
      updatedAtMs: runtimeDataset?.updatedAtMs,
      source: buildMainSequenceDataSourceDescriptor({
        dataNodeLabel: "Manual table",
        updatedAtMs: runtimeDataset?.updatedAtMs,
        limit: resolvedConfig.limit,
      }),
    };
  }

  if (!resolvedSourceFrame) {
    const status =
      runtimeDataset?.status === "error"
        ? "error"
        : runtimeDataset?.status === "loading"
          ? "loading"
          : runtimeDataset?.status === "ready"
            ? "ready"
            : "idle";

    return {
      status,
      error: runtimeDataset?.error,
      columns: runtimeDataset?.columns ?? [],
      rows: runtimeDataset?.rows ?? [],
      fields: buildDataNodeFieldOptionsFromRows({
        columns: runtimeDataset?.columns ?? [],
        rows: runtimeDataset?.rows ?? [],
      }),
      rangeStartMs: runtimeDataset?.rangeStartMs ?? null,
      rangeEndMs: runtimeDataset?.rangeEndMs ?? null,
      updatedAtMs: runtimeDataset?.updatedAtMs,
      source: buildMainSequenceDataSourceDescriptor({
        dataNodeId:
          typeof normalizedProps.dataNodeId === "number"
            ? normalizedProps.dataNodeId
            : undefined,
        dateRangeMode: normalizedProps.dateRangeMode,
        fixedStartMs: normalizedProps.fixedStartMs,
        fixedEndMs: normalizedProps.fixedEndMs,
        uniqueIdentifierList: normalizedProps.uniqueIdentifierList,
        updatedAtMs: runtimeDataset?.updatedAtMs,
        limit: runtimeDataset?.limit,
      }),
    };
  }

  const sourceFieldOptions = resolveDataNodeFieldOptionsFromDataset({
    columns: resolvedSourceFrame.columns,
    fields: resolvedSourceFrame.fields,
    rows: resolvedSourceFrame.rows,
  });
  const resolvedConfig = resolveDataNodeFilterConfig(
    normalizedProps,
    undefined,
    sourceFieldOptions.length > 0 ? sourceFieldOptions : undefined,
  );
  const transformedDataset =
    resolvedSourceFrame.status === "ready"
      ? buildDataNodeTransformedDataset(
          resolvedSourceFrame.rows,
          resolvedConfig,
          resolvedSourceFrame.columns,
          sourceFieldOptions,
        )
      : null;

  return {
    status: resolvedSourceFrame.status,
    error: resolvedSourceFrame.error,
    columns:
      transformedDataset?.columns ??
      runtimeDataset?.columns ??
      resolvedSourceFrame.columns,
    rows:
      transformedDataset?.rows ??
      (resolvedSourceFrame.status === "ready" ? resolvedSourceFrame.rows : (runtimeDataset?.rows ?? [])),
    fields:
      transformedDataset?.availableFields ??
      runtimeDataset?.fields ??
      sourceFieldOptions,
    rangeStartMs:
      resolvedSourceDataset?.rangeStartMs ??
      runtimeDataset?.rangeStartMs ??
      null,
    rangeEndMs:
      resolvedSourceDataset?.rangeEndMs ??
      runtimeDataset?.rangeEndMs ??
      null,
    updatedAtMs:
      resolvedSourceDataset?.updatedAtMs ??
      runtimeDataset?.updatedAtMs,
    source: buildMainSequenceDataSourceDescriptor({
      dataNodeId:
        typeof normalizedProps.dataNodeId === "number"
          ? normalizedProps.dataNodeId
          : undefined,
      dateRangeMode: normalizedProps.dateRangeMode,
      fixedStartMs: normalizedProps.fixedStartMs,
      fixedEndMs: normalizedProps.fixedEndMs,
      uniqueIdentifierList: normalizedProps.uniqueIdentifierList,
      updatedAtMs: resolvedSourceFrame.source?.updatedAtMs ?? runtimeDataset?.updatedAtMs,
      limit: resolvedConfig.limit,
    }),
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

  const resolvedKeyFields = normalizeGroupByFields(
    props.keyFields,
    availableFields.map((field) => field.key),
  );
  const requestedUnpivotFieldName = normalizeOutputFieldName(
    props.unpivotFieldName,
    defaultUnpivotFieldName,
  );
  const unpivotFieldName = createUniqueOutputFieldName(
    requestedUnpivotFieldName,
    resolvedKeyFields ?? [],
    defaultUnpivotFieldName,
  );
  const unpivotValueFieldName = createUniqueOutputFieldName(
    normalizeOutputFieldName(props.unpivotValueFieldName, defaultUnpivotValueFieldName),
    [...(resolvedKeyFields ?? []), unpivotFieldName],
    defaultUnpivotValueFieldName,
  );

  return {
    ...sourceConfig,
    availableFields,
    sourceMode: sourceReference.sourceMode,
    sourceWidgetId: sourceReference.sourceWidgetId,
    aggregateMode: normalizeGroupAggregateMode(props.aggregateMode),
    keyFields: resolvedKeyFields,
    pivotField: normalizeOptionalFieldKey(
      props.pivotField,
      availableFields.map((field) => field.key),
    ),
    pivotValueField: normalizeOptionalFieldKey(
      props.pivotValueField,
      availableFields.map((field) => field.key),
    ),
    projectFields: normalizeGroupByFields(props.projectFields),
    unpivotFieldName,
    unpivotValueFieldName,
    unpivotValueFields: normalizeGroupByFields(
      props.unpivotValueFields,
      availableFields.map((field) => field.key),
    ),
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
    unpivotFieldName: resolved.unpivotFieldName,
    unpivotValueFieldName: resolved.unpivotValueFieldName,
    unpivotValueFields: resolved.unpivotValueFields,
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

function cloneFieldOption(field: DataNodeFieldOption): DataNodeFieldOption {
  return {
    ...field,
    derivedFrom: field.derivedFrom ? [...field.derivedFrom] : undefined,
    warnings: field.warnings ? [...field.warnings] : undefined,
  };
}

function mergeWarnings(
  ...warnings: Array<readonly string[] | undefined | null>
) {
  return uniqueStrings(warnings.flatMap((entry) => entry ?? []));
}

function buildDerivedField(
  key: string,
  fallbackField: DataNodeFieldOption | undefined,
  input: {
    label?: string;
    description: string;
    derivedFrom: string[];
    sourceField?: DataNodeFieldOption;
    typeOverride?: DataNodeFieldOption["type"];
    nativeType?: string | null;
  },
): DataNodeFieldOption {
  return {
    ...(fallbackField ? cloneFieldOption(fallbackField) : { key, type: "unknown" as const }),
    key,
    label: input.label ?? input.sourceField?.label ?? fallbackField?.label ?? key,
    description: input.description,
    nativeType: input.nativeType ?? null,
    type: input.typeOverride ?? fallbackField?.type ?? input.sourceField?.type ?? "unknown",
    provenance: "derived",
    reason: input.description,
    derivedFrom: uniqueStrings(input.derivedFrom),
    warnings:
      mergeWarnings(fallbackField?.warnings, input.sourceField?.warnings).length > 0
        ? mergeWarnings(fallbackField?.warnings, input.sourceField?.warnings)
        : undefined,
  };
}

function buildPreservedField(
  key: string,
  sourceField: DataNodeFieldOption | undefined,
  fallbackField: DataNodeFieldOption | undefined,
): DataNodeFieldOption {
  if (!sourceField && fallbackField) {
    return fallbackField;
  }

  if (!sourceField) {
    return {
      key,
      label: key,
      type: "unknown",
      provenance: "inferred",
      reason: "Inferred from transformed dataset rows.",
    };
  }

  return {
    ...cloneFieldOption(sourceField),
    key,
    label: sourceField.label?.trim() || fallbackField?.label || key,
    description: sourceField.description ?? fallbackField?.description ?? null,
    nativeType: sourceField.nativeType ?? fallbackField?.nativeType ?? null,
    type: sourceField.type ?? fallbackField?.type ?? "unknown",
    warnings:
      mergeWarnings(sourceField.warnings, fallbackField?.warnings).length > 0
        ? mergeWarnings(sourceField.warnings, fallbackField?.warnings)
        : undefined,
  };
}

function buildDataNodeTransformedFieldOptions(args: {
  columns: readonly string[];
  rows: readonly DataNodeRemoteDataRow[];
  sourceFields?: readonly DataNodeFieldOption[];
  config: Pick<
    ResolvedDataNodeFilterConfig,
    | "aggregateMode"
    | "keyFields"
    | "pivotField"
    | "pivotValueField"
    | "projectFields"
    | "transformMode"
    | "unpivotFieldName"
    | "unpivotValueFieldName"
    | "unpivotValueFields"
  >;
}) {
  const fallbackFields = buildDataNodeFieldOptionsFromRows(
    {
      columns: args.columns,
      rows: args.rows,
    },
    {
      provenance: args.config.transformMode === "none" ? "inferred" : "derived",
    },
  );
  const fallbackFieldByKey = new Map(fallbackFields.map((field) => [field.key, field]));
  const sourceFieldByKey = new Map(
    (args.sourceFields ?? []).map((field) => [field.key, field]),
  );
  const keyFields = new Set(args.config.keyFields ?? []);
  const unpivotValueFields = args.config.unpivotValueFields ?? [];
  const pivotValueField = args.config.pivotValueField
    ? sourceFieldByKey.get(args.config.pivotValueField)
    : undefined;

  return args.columns.map<DataNodeFieldOption>((key) => {
    const fallbackField = fallbackFieldByKey.get(key);
    const sourceField = sourceFieldByKey.get(key);

    if (args.config.transformMode === "none") {
      return buildPreservedField(key, sourceField, fallbackField);
    }

    if (args.config.transformMode === "aggregate") {
      if (keyFields.has(key)) {
        return buildPreservedField(key, sourceField, fallbackField);
      }

      return buildDerivedField(key, fallbackField, {
        sourceField,
        description: `Derived by aggregating ${key} with ${args.config.aggregateMode}.`,
        derivedFrom: [key],
        nativeType:
          args.config.aggregateMode === "first" || args.config.aggregateMode === "last"
            ? (sourceField?.nativeType ?? null)
            : null,
      });
    }

    if (args.config.transformMode === "pivot") {
      if (keyFields.has(key)) {
        return buildPreservedField(key, sourceField, fallbackField);
      }

      return buildDerivedField(key, fallbackField, {
        label: key,
        sourceField: pivotValueField,
        description: `Derived pivot column from ${args.config.pivotValueField ?? "value"} by ${args.config.pivotField ?? "pivot field"} using ${args.config.aggregateMode}.`,
        derivedFrom: uniqueStrings([
          args.config.pivotField,
          args.config.pivotValueField,
        ]),
      });
    }

    if (args.config.transformMode === "unpivot") {
      if (keyFields.has(key)) {
        return buildPreservedField(key, sourceField, fallbackField);
      }

      if (key === args.config.unpivotFieldName) {
        return buildDerivedField(key, fallbackField, {
          label: key,
          description: `Generated unpivot label field from ${unpivotValueFields.length.toLocaleString()} source columns.`,
          derivedFrom: unpivotValueFields,
          typeOverride: "string",
          nativeType: null,
        });
      }

      if (key === args.config.unpivotValueFieldName) {
        const firstSourceValueField = unpivotValueFields
          .map((fieldKey) => sourceFieldByKey.get(fieldKey))
          .find((field) => field != null);

        return buildDerivedField(key, fallbackField, {
          label: key,
          sourceField: firstSourceValueField,
          description: `Generated unpivot value field from ${unpivotValueFields.length.toLocaleString()} source columns.`,
          derivedFrom: unpivotValueFields,
          nativeType: null,
        });
      }
    }

    return fallbackField ?? {
      key,
      label: key,
      type: "unknown",
      provenance: "inferred",
      reason: "Inferred from transformed dataset rows.",
    };
  });
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

function buildUnpivotedDataset(
  rows: readonly DataNodeRemoteDataRow[],
  columns: readonly string[],
  config: Pick<
    ResolvedDataNodeFilterConfig,
    "keyFields" | "unpivotFieldName" | "unpivotValueFieldName" | "unpivotValueFields"
  >,
) {
  if (!config.unpivotValueFields || config.unpivotValueFields.length === 0 || rows.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
    };
  }

  const keyColumns = (config.keyFields ?? []).filter((column) => columns.includes(column));
  const valueColumns = config.unpivotValueFields.filter(
    (column) => columns.includes(column) && !keyColumns.includes(column),
  );

  if (valueColumns.length === 0) {
    return {
      columns: [...columns],
      rows: [...rows],
    };
  }

  const outputRows = rows.flatMap<DataNodeRemoteDataRow>((row) =>
    valueColumns.map((column) => {
      const nextRow: DataNodeRemoteDataRow = {};

      keyColumns.forEach((keyColumn) => {
        nextRow[keyColumn] = row[keyColumn] ?? null;
      });

      nextRow[config.unpivotFieldName] = column;
      nextRow[config.unpivotValueFieldName] = row[column] ?? null;

      return nextRow;
    }),
  );

  return {
    columns: uniqueStrings([
      ...keyColumns,
      config.unpivotFieldName,
      config.unpivotValueFieldName,
    ]),
    rows: outputRows,
  };
}

export function formatDataNodeFilterTransformSummary(
  config: Pick<
    ResolvedDataNodeFilterConfig,
    | "aggregateMode"
    | "keyFields"
    | "pivotField"
    | "pivotValueField"
    | "projectFields"
    | "transformMode"
    | "unpivotFieldName"
    | "unpivotValueFieldName"
    | "unpivotValueFields"
  >,
) {
  if (config.transformMode === "pivot" && config.pivotField && config.pivotValueField) {
    return `Pivot ${config.pivotField} -> ${config.pivotValueField} (${config.aggregateMode})`;
  }

  if (config.transformMode === "aggregate" && config.keyFields && config.keyFields.length > 0) {
    return `Aggregate by ${config.keyFields.join(", ")} (${config.aggregateMode})`;
  }

  if (
    config.transformMode === "unpivot" &&
    config.unpivotValueFields &&
    config.unpivotValueFields.length > 0
  ) {
    return `Unpivot ${config.unpivotValueFields.length.toLocaleString()} columns into ${config.unpivotFieldName}/${config.unpivotValueFieldName}`;
  }

  if (config.projectFields && config.projectFields.length > 0) {
    return `Projected ${config.projectFields.length.toLocaleString()} columns`;
  }

  return "Raw dataset";
}

export function buildDataNodeTransformedDataset(
  rows: readonly DataNodeRemoteDataRow[],
  config: Pick<
    ResolvedDataNodeFilterConfig,
    | "aggregateMode"
    | "keyFields"
    | "pivotField"
    | "pivotValueField"
    | "projectFields"
    | "transformMode"
    | "unpivotFieldName"
    | "unpivotValueFieldName"
    | "unpivotValueFields"
  >,
  knownColumns?: readonly string[],
  sourceFields?: readonly DataNodeFieldOption[],
) {
  const columns = uniqueStrings([
    ...(knownColumns ?? []),
    ...collectRowKeys(rows),
  ]);

  const baseDataset =
    config.transformMode === "pivot"
      ? buildPivotedDataset(rows, columns, config)
      : config.transformMode === "unpivot"
        ? buildUnpivotedDataset(rows, columns, config)
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
    availableFields: buildDataNodeTransformedFieldOptions({
      columns: projectedDataset.columns,
      rows: projectedDataset.rows,
      sourceFields,
      config,
    }),
  };
}
