import { useEffect, useMemo } from "react";

import { useDashboardWidgetRegistry, type DashboardWidgetRegistryEntry } from "@/dashboards/DashboardWidgetRegistry";
import { useResolvedWidgetInput } from "@/dashboards/DashboardWidgetDependencies";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  legacyTimeSeriesFrameToTabularFrameSource,
  normalizeTabularFrameSource,
  type TabularFrameFieldProvenance,
  type TabularFrameFieldSchema,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import type {
  WidgetFieldDefinition,
  WidgetFieldSection,
  WidgetSettingsSchema,
} from "@/widgets/types";

import type { PickerOption } from "@/widgets/shared/picker-field";

export const TABULAR_SOURCE_INPUT_ID = "sourceData";
export const TABULAR_SOURCE_OUTPUT_ID = "dataset";
export const TABULAR_SOURCE_CONTRACT = CORE_TABULAR_FRAME_SOURCE_CONTRACT;
export { normalizeTabularFrameSource };

export function buildTabularSourceDescriptor(input: {
  sourceId?: number;
  sourceLabel?: string;
  dateRangeMode?: "dashboard" | "fixed";
  fixedStartMs?: number;
  fixedEndMs?: number;
  uniqueIdentifierList?: string[];
  updatedAtMs?: number;
  limit?: number;
}) {
  return {
    kind: "tabular-frame",
    id: input.sourceId,
    label: input.sourceLabel,
    updatedAtMs: input.updatedAtMs,
    context: {
      dateRangeMode: input.dateRangeMode,
      fixedStartMs: input.fixedStartMs,
      fixedEndMs: input.fixedEndMs,
      uniqueIdentifierList: input.uniqueIdentifierList,
      limit: input.limit,
    },
  };
}

export type TabularDateRangeMode = "dashboard" | "fixed";
export type TabularFieldOption = TabularFrameFieldSchema;
export type TabularDataRow = Record<string, unknown>;
export type TabularWidgetSourceMode = "direct" | "filter_widget" | "manual";

export interface TabularSourceDetail {
  id?: number;
  identifier?: string | null;
  storage_hash?: string;
  sourcetableconfiguration?: {
    time_index_name?: string | null;
    index_names?: string[];
    column_dtypes_map?: Record<string, string | null | undefined>;
    columns_metadata?: Array<{
      column_name: string;
      label?: string | null;
      description?: string | null;
      dtype?: string | null;
    }>;
    last_time_index_value?: unknown;
  } | null;
}

export interface ManualTabularColumnDefinition {
  key: string;
  type: TabularFrameFieldType;
}

export interface TabularWidgetSourceProps extends Record<string, unknown> {
  sourceId?: number;
  dateRangeMode?: TabularDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  manualColumns?: ManualTabularColumnDefinition[];
  manualRows?: Array<Record<string, unknown>>;
  uniqueIdentifierList?: string[];
}

export interface TabularWidgetSourceReferenceProps extends Record<string, unknown> {
  sourceMode?: TabularWidgetSourceMode;
  sourceWidgetId?: string;
}

export interface ResolvedTabularWidgetSourceConfig {
  availableFields: TabularFieldOption[];
  sourceId?: number;
  sourceLabel: string;
  dateRangeMode: TabularDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  sourceMode?: TabularWidgetSourceMode;
  sourceWidgetId?: string;
  supportsUniqueIdentifierList: boolean;
  uniqueIdentifierList?: string[];
}

export interface MinimalTabularDetailQuery {
  data?: TabularSourceDetail | null;
  isLoading: boolean;
}

export interface TabularWidgetSourceControllerContext<
  TResolvedConfig extends ResolvedTabularWidgetSourceConfig = ResolvedTabularWidgetSourceConfig,
> {
  currentWidgetInstanceId?: string;
  filterWidgetOptions: PickerOption[];
  fieldPickerOptions: PickerOption[];
  hasLoadedTabularSourceDetail: boolean;
  hasNoData: boolean;
  hasResolvedFilterWidgetSource: boolean;
  isAwaitingBoundSourceValue: boolean;
  isFilterWidgetSource: boolean;
  referencedFilterWidget: DashboardWidgetRegistryEntry | null;
  requiresUpstreamResolution: boolean;
  resolvedSourceWidget: DashboardWidgetRegistryEntry | null;
  resolvedConfig: TResolvedConfig;
  resolvedSourceDataset: TabularFrameSourceV1 | null;
  resolvedSourceFrame: TabularFrameSourceV1 | null;
  resolvedSourceProps: TabularWidgetSourceProps;
  selectedTabularSourceDetailQuery: MinimalTabularDetailQuery;
  selectedSourceId: number;
  sourceMode: TabularWidgetSourceMode;
  sourceWidgetId?: string;
  supportsUniqueIdentifierList: boolean;
}

export interface ResolvedTabularWidgetSourceBinding {
  filterWidgetOptions: PickerOption[];
  hasCanonicalSourceBinding: boolean;
  hasResolvedFilterWidgetSource: boolean;
  isAwaitingBoundSourceValue: boolean;
  isFilterWidgetSource: boolean;
  referencedFilterWidget: DashboardWidgetRegistryEntry | null;
  requiresUpstreamResolution: boolean;
  resolvedSourceDataset: TabularFrameSourceV1 | null;
  resolvedSourceFrame: TabularFrameSourceV1 | null;
  resolvedSourceInput: ReturnType<typeof useResolvedWidgetInput> extends infer T
    ? T extends readonly unknown[]
      ? never
      : T
    : never;
  resolvedSourceProps: TabularWidgetSourceProps;
  resolvedSourceWidget: DashboardWidgetRegistryEntry | null;
  sourceMode: TabularWidgetSourceMode;
  sourceWidgetId?: string;
}

interface CreateTabularWidgetSourceSchemaOptions<
  TProps extends TabularWidgetSourceProps,
  TContext extends TabularWidgetSourceControllerContext,
> {
  additionalFields?: WidgetFieldDefinition<TProps, TContext>[];
  additionalSections?: WidgetFieldSection[];
  canvasQueryScope?: string;
  dataSourceSectionDescription?: string;
  dateRangeSectionDescription?: string;
  enableFilterWidgetSource?: boolean;
  enableManualSource?: boolean;
  filterWidgetOnly?: boolean;
  selectionHelpText?: string;
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

function uniqueWarningMessages(values: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return values.filter((value): value is string => {
    if (!value?.trim()) {
      return false;
    }

    const nextValue = value.trim();

    if (seen.has(nextValue)) {
      return false;
    }

    seen.add(nextValue);
    return true;
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeSourceValueForDebug(value: unknown) {
  if (!isPlainRecord(value)) {
    return value === undefined ? { kind: "undefined" } : { kind: typeof value };
  }

  if (typeof value.contract === "string" && Array.isArray(value.fields)) {
    return {
      kind: "frame",
      status: typeof value.status === "string" ? value.status : undefined,
      contract: value.contract,
      fieldCount: value.fields.length,
      fieldNames: value.fields
        .flatMap((field) =>
          isPlainRecord(field) && typeof field.name === "string" ? [field.name] : [],
        )
        .slice(0, 6),
      traceId: typeof value.traceId === "string" ? value.traceId : undefined,
    };
  }

  if (Array.isArray(value.columns) && Array.isArray(value.rows)) {
    return {
      kind: "tabular-frame",
      status: typeof value.status === "string" ? value.status : undefined,
      columnCount: value.columns.length,
      rowCount: value.rows.length,
      fieldCount: Array.isArray(value.fields) ? value.fields.length : 0,
    };
  }

  return {
    kind: "record",
    status: typeof value.status === "string" ? value.status : undefined,
    keys: Object.keys(value).slice(0, 10),
  };
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

function fieldTypeFamily(type: TabularFrameFieldType) {
  if (type === "integer" || type === "number") {
    return "numeric";
  }

  if (type === "date" || type === "datetime" || type === "time") {
    return "temporal";
  }

  return type;
}

function inferTypeFromNativeType(nativeType: string | null | undefined): TabularFrameFieldType | null {
  if (!nativeType) {
    return null;
  }

  if (/timestamp|datetime/i.test(nativeType)) {
    return "datetime";
  }

  if (/(^|[^a-z])date([^a-z]|$)/i.test(nativeType)) {
    return "date";
  }

  if (/(^|[^a-z])time([^a-z]|$)/i.test(nativeType)) {
    return "time";
  }

  if (/bool/i.test(nativeType)) {
    return "boolean";
  }

  if (/bigint|smallint|integer|int/i.test(nativeType)) {
    return "integer";
  }

  if (/float|double|decimal|number|numeric|real/i.test(nativeType)) {
    return "number";
  }

  if (/json|dict|map|object|struct/i.test(nativeType)) {
    return "json";
  }

  return "string";
}

function isNumericValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "string") {
    return false;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed);
}

function isTimeValue(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed || (!/[T:\-\/ ]/.test(trimmed) && !/time|date/i.test(trimmed))) {
    return false;
  }

  return !Number.isNaN(Date.parse(trimmed));
}

function isBooleanValue(value: unknown) {
  return (
    typeof value === "boolean" ||
    (typeof value === "string" && /^(true|false)$/i.test(value.trim()))
  );
}

function inferTypeFromSamples(samples: unknown[]): TabularFrameFieldType {
  if (samples.some((value) => isBooleanValue(value))) {
    return "boolean";
  }

  if (samples.some((value) => isTimeValue(value))) {
    return "datetime";
  }

  if (samples.some((value) => isNumericValue(value))) {
    const hasDecimal = samples.some((value) => {
      const normalized =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim()
            ? Number(value.trim())
            : null;

      return normalized != null && Number.isFinite(normalized) && !Number.isInteger(normalized);
    });

    return hasDecimal ? "number" : "integer";
  }

  return "string";
}

function buildFieldWarningsFromSamples(samples: unknown[]) {
  const warnings: string[] = [];

  if (samples.some((value) => typeof value === "string" && /^(\d{2})[-/](\d{2})[-/](\d{4})$/.test(value.trim()))) {
    warnings.push(
      "Sample values use locale-style date strings. Prefer YYYY-MM-DD or an explicit time parser.",
    );
  }

  if (
    samples.some((value) => {
      if (typeof value !== "string") {
        return false;
      }

      const match = value.trim().match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);

      if (!match) {
        return false;
      }

      const first = Number(match[1]);
      const second = Number(match[2]);
      return Number.isFinite(first) && Number.isFinite(second) && first <= 12 && second <= 12;
    })
  ) {
    warnings.push("Some sampled dates are ambiguous because both day and month are <= 12.");
  }

  return warnings;
}

function mergeFieldWarnings(
  ...warningSets: Array<readonly string[] | string | undefined | null>
) {
  return uniqueWarningMessages(
    warningSets.flatMap((warnings) =>
      typeof warnings === "string" ? [warnings] : (warnings ?? []),
    ),
  );
}

function cloneFieldOption(field: TabularFieldOption): TabularFieldOption {
  return {
    ...field,
    derivedFrom: field.derivedFrom ? [...field.derivedFrom] : undefined,
    warnings: field.warnings ? [...field.warnings] : undefined,
  };
}

function getFieldOptionLabel(key: string, detail?: TabularSourceDetail | null) {
  const metadata =
    detail?.sourcetableconfiguration?.columns_metadata?.find((column) => column.column_name === key) ??
    null;

  return metadata?.label?.trim() || key;
}

function getFieldOptionDescription(key: string, detail?: TabularSourceDetail | null) {
  const metadata =
    detail?.sourcetableconfiguration?.columns_metadata?.find((column) => column.column_name === key) ??
    null;

  return metadata?.description?.trim() || null;
}

function getFieldOptionDtype(key: string, detail?: TabularSourceDetail | null) {
  const metadata =
    detail?.sourcetableconfiguration?.columns_metadata?.find((column) => column.column_name === key) ??
    null;
  const sourceConfig = detail?.sourcetableconfiguration;

  return metadata?.dtype?.trim() || sourceConfig?.column_dtypes_map?.[key] || null;
}

export function formatTabularFieldMetadata(field: TabularFieldOption) {
  return [
    field.nativeType,
    field.type !== "unknown" ? field.type : null,
    field.description ?? null,
  ].filter((value): value is string => Boolean(value && value.trim()));
}

export function formatTabularFieldSearchText(field: TabularFieldOption) {
  return [
    field.key,
    field.label,
    field.description ?? "",
    field.nativeType ?? "",
    field.type,
  ].join(" ");
}

export function formatTabularSourceLabel(
  source?: Pick<TabularSourceDetail, "id" | "identifier" | "storage_hash"> | null,
) {
  if (!source) {
    return "Dataset";
  }

  const identifier = source.identifier?.trim();

  if (identifier) {
    return identifier;
  }

  return source.storage_hash || (source.id ? `Dataset ${source.id}` : "Dataset");
}

export function buildTabularFieldOptions(detail?: TabularSourceDetail | null) {
  const sourceConfig = detail?.sourcetableconfiguration;
  const orderedKeys = uniqueStrings([
    sourceConfig?.time_index_name ?? undefined,
    ...(sourceConfig?.index_names ?? []),
    ...(sourceConfig?.columns_metadata?.map((column) => column.column_name) ?? []),
    ...Object.keys(sourceConfig?.column_dtypes_map ?? {}),
  ]);

  return orderedKeys.map<TabularFieldOption>((key) => {
    const nativeType = getFieldOptionDtype(key, detail);

    return {
      key,
      label: getFieldOptionLabel(key, detail),
      description: getFieldOptionDescription(key, detail),
      nativeType,
      type: inferTypeFromNativeType(nativeType) ?? "unknown",
      provenance: "backend",
      reason: "Resolved from source metadata.",
    };
  });
}

export function buildTabularFieldOptionsFromRows(input: {
  columns?: readonly string[];
  rows?: readonly TabularDataRow[];
}, options?: {
  provenance?: TabularFrameFieldProvenance;
  reasonByKey?: Record<string, string | undefined>;
  derivedFromByKey?: Record<string, string[] | undefined>;
}) {
  const orderedKeys = uniqueStrings([
    ...(input.columns ?? []),
    ...((input.rows ?? []).flatMap((row) => Object.keys(row))),
  ]);
  const provenance = options?.provenance ?? "inferred";

  return orderedKeys.map<TabularFieldOption>((key) => {
    const samples = (input.rows ?? [])
      .map((row) => row[key])
      .filter((value) => value !== null && value !== undefined && value !== "");
    const warnings = buildFieldWarningsFromSamples(samples);

    return {
      key,
      label: key,
      description: null,
      nativeType: null,
      type: inferTypeFromSamples(samples),
      provenance,
      reason:
        options?.reasonByKey?.[key] ??
        (provenance === "manual"
          ? "Configured manually in the table editor."
          : provenance === "derived"
            ? "Derived from transformed dataset rows."
            : "Inferred from sampled dataset rows."),
      derivedFrom: options?.derivedFromByKey?.[key],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  });
}

export function resolveTabularFieldOptionsFromDataset(input: {
  columns?: string[];
  rows?: readonly TabularDataRow[];
  fields?: readonly TabularFieldOption[];
}) {
  const datasetFields = input.fields?.filter((field) => typeof field.key === "string" && field.key.trim()) ?? [];

  if (datasetFields.length === 0) {
    return buildTabularFieldOptionsFromRows({
      columns: input.columns,
      rows: input.rows,
    });
  }

  const fallbackFields = buildTabularFieldOptionsFromRows({
    columns: input.columns,
    rows: input.rows,
  });
  const fallbackFieldByKey = new Map(fallbackFields.map((field) => [field.key, field]));
  const seen = new Set<string>();
  const orderedKeys = uniqueStrings([
    ...datasetFields.map((field) => field.key),
    ...(input.columns ?? []),
    ...((input.rows ?? []).flatMap((row) => Object.keys(row))),
  ]);

  return orderedKeys.flatMap<TabularFieldOption>((key) => {
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);

    const declaredField = datasetFields.find((field) => field.key === key);

    if (!declaredField) {
      const fallbackField = fallbackFieldByKey.get(key);
      return fallbackField ? [fallbackField] : [];
    }

    const fallbackField = fallbackFieldByKey.get(key);
    const warnings = mergeFieldWarnings(
      declaredField.warnings,
      fallbackField?.warnings,
      fallbackField && fieldTypeFamily(declaredField.type) !== fieldTypeFamily(fallbackField.type)
        ? `Runtime samples look like ${fallbackField.type}, but the declared schema resolves this field as ${declaredField.type}.`
        : null,
    );

    return [{
      ...cloneFieldOption(fallbackField ?? { key, type: "unknown" }),
      ...cloneFieldOption(declaredField),
      key,
      label: declaredField.label?.trim() || fallbackField?.label || key,
      description: declaredField.description ?? fallbackField?.description ?? null,
      nativeType: declaredField.nativeType ?? fallbackField?.nativeType ?? null,
      type: declaredField.type ?? fallbackField?.type ?? "unknown",
      provenance: declaredField.provenance ?? fallbackField?.provenance,
      reason: declaredField.reason ?? fallbackField?.reason ?? null,
      derivedFrom: declaredField.derivedFrom ?? fallbackField?.derivedFrom,
      warnings: warnings.length > 0 ? warnings : undefined,
    }];
  });
}

function normalizeTimeSeriesFieldTypeForTabular(value: unknown): TabularFrameFieldType {
  if (value === "time") {
    return "datetime";
  }

  if (
    value === "string" ||
    value === "number" ||
    value === "integer" ||
    value === "boolean" ||
    value === "datetime" ||
    value === "date" ||
    value === "json"
  ) {
    return value;
  }

  return "unknown";
}

function timeSeriesFieldArrayToTabularFrameSource(value: unknown): TabularFrameSourceV1 | null {
  if (!isPlainRecord(value) || value.contract !== LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT) {
    return null;
  }

  const rawFields = Array.isArray(value.fields) ? value.fields : [];
  const fields = rawFields.flatMap((field) => {
    if (!isPlainRecord(field) || typeof field.name !== "string" || !field.name.trim()) {
      return [];
    }

    return [{
      name: field.name.trim(),
      type: field.type,
      values: Array.isArray(field.values) ? field.values : [],
      config: isPlainRecord(field.config) ? field.config : undefined,
    }];
  });

  if (fields.length === 0) {
    return null;
  }

  const columns = fields.map((field) => field.name);
  const rowCount = Math.max(0, ...fields.map((field) => field.values.length));
  const rows = Array.from({ length: rowCount }, (_entry, rowIndex) =>
    Object.fromEntries(fields.map((field) => [field.name, field.values[rowIndex] ?? null])),
  );

  return {
    status:
      value.status === "error" || value.status === "loading" || value.status === "idle"
        ? value.status
        : "ready",
    error: typeof value.error === "string" ? value.error : undefined,
    columns,
    rows,
    fields: fields.map((field) => ({
      key: field.name,
      label:
        typeof field.config?.displayName === "string" && field.config.displayName.trim()
          ? field.config.displayName.trim()
          : field.name,
      type: normalizeTimeSeriesFieldTypeForTabular(field.type),
      nullable: true,
      nativeType: typeof field.type === "string" ? field.type : null,
      provenance: "backend",
      reason: "Converted from a time-series frame field array for table rendering.",
    })),
    source: {
      kind: "time-series-frame",
      label: typeof value.name === "string" ? value.name : undefined,
      context: {
        sourceContract: LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
      },
    },
  };
}

export function normalizeAnyTabularFrameSource(value: unknown): TabularFrameSourceV1 | null {
  const directFrame =
    normalizeTabularFrameSource(value) ??
    legacyTimeSeriesFrameToTabularFrameSource(value) ??
    timeSeriesFieldArrayToTabularFrameSource(value);

  if (directFrame) {
    return directFrame;
  }

  if (!isPlainRecord(value) || !Array.isArray(value.frames)) {
    return null;
  }

  for (const frame of value.frames) {
    const normalizedFrame = normalizeAnyTabularFrameSource(frame);

    if (normalizedFrame) {
      return normalizedFrame;
    }
  }

  return null;
}

export function isEmptyTabularFrameSource(frame: TabularFrameSourceV1 | null | undefined) {
  return Boolean(
    frame &&
      frame.status !== "error" &&
      frame.status !== "loading" &&
      frame.columns.length === 0 &&
      frame.rows.length === 0 &&
      (!frame.fields || frame.fields.length === 0),
  );
}

function normalizeManualColumnType(value: unknown): TabularFrameFieldType {
  return value === "string" ||
    value === "number" ||
    value === "integer" ||
    value === "boolean" ||
    value === "datetime" ||
    value === "date" ||
    value === "time" ||
    value === "json"
    ? value
    : "string";
}

function buildFallbackManualColumnKey(index: number) {
  return `column_${index + 1}`;
}

function createUniqueManualColumnKey(requestedKey: string, usedKeys: Set<string>, fallbackIndex: number) {
  const trimmed = requestedKey.trim();
  const baseKey = trimmed || buildFallbackManualColumnKey(fallbackIndex);

  if (!usedKeys.has(baseKey)) {
    usedKeys.add(baseKey);
    return baseKey;
  }

  let suffix = 2;
  let candidate = `${baseKey}_${suffix}`;

  while (usedKeys.has(candidate)) {
    suffix += 1;
    candidate = `${baseKey}_${suffix}`;
  }

  usedKeys.add(candidate);
  return candidate;
}

export function normalizeManualTabularColumns(value: unknown): ManualTabularColumnDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const usedKeys = new Set<string>();

  return value.flatMap((entry, index) => {
    const rawKey =
      isPlainRecord(entry) && typeof entry.key === "string"
        ? entry.key
        : typeof entry === "string"
          ? entry
          : "";
    const key = createUniqueManualColumnKey(rawKey, usedKeys, index);

    return [{
      key,
      type: isPlainRecord(entry) ? normalizeManualColumnType(entry.type) : "string",
    } satisfies ManualTabularColumnDefinition];
  });
}

export function normalizeManualTabularRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => isPlainRecord(entry))
    : [];
}

export function buildManualTabularFieldOptions(input: {
  columns?: ManualTabularColumnDefinition[];
  rows?: Array<Record<string, unknown>>;
}) {
  const normalizedColumns = normalizeManualTabularColumns(input.columns);

  if (normalizedColumns.length > 0) {
    return normalizedColumns.map<TabularFieldOption>((column) => ({
      key: column.key,
      label: column.key,
      type: column.type,
      nullable: true,
      provenance: "manual",
      reason: "Configured manually in the table editor.",
    }));
  }

  return buildTabularFieldOptionsFromRows({
    columns: [],
    rows: normalizeManualTabularRows(input.rows),
  }, {
    provenance: "manual",
  });
}

export type ManualTableColumnDefinition = ManualTabularColumnDefinition;
export const normalizeManualTableColumns = normalizeManualTabularColumns;
export const normalizeManualTableRows = normalizeManualTabularRows;
export const buildManualTableFieldOptions = buildManualTabularFieldOptions;

function normalizeSourceWidgetId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeSourceMode(value: unknown): TabularWidgetSourceMode {
  return value === "manual" || value === "direct" ? value : "filter_widget";
}

export function normalizeTabularWidgetSourceReferenceProps<
  TProps extends TabularWidgetSourceReferenceProps,
>(props: TProps) {
  return {
    ...props,
    sourceMode: normalizeSourceMode(props.sourceMode),
    sourceWidgetId: normalizeSourceWidgetId(props.sourceWidgetId),
  } satisfies TProps;
}

export function normalizeTabularWidgetSourceProps<
  TProps extends TabularWidgetSourceProps,
>(props: TProps, _detail?: TabularSourceDetail | null) {
  return {
    ...props,
    sourceId: normalizePositiveInteger(props.sourceId),
    dateRangeMode: props.dateRangeMode === "fixed" ? "fixed" : "dashboard",
    fixedStartMs: normalizeTimestampMs(props.fixedStartMs),
    fixedEndMs: normalizeTimestampMs(props.fixedEndMs),
    manualColumns: normalizeManualTabularColumns(props.manualColumns),
    manualRows: normalizeManualTabularRows(props.manualRows),
    uniqueIdentifierList: Array.isArray(props.uniqueIdentifierList)
      ? props.uniqueIdentifierList.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined,
  } satisfies TProps;
}

export function resolveTabularWidgetSourceConfig(
  props: TabularWidgetSourceProps & Partial<TabularWidgetSourceReferenceProps>,
  detail?: TabularSourceDetail | null,
): ResolvedTabularWidgetSourceConfig {
  const normalizedReference = normalizeTabularWidgetSourceReferenceProps(props);
  const sourceId = normalizePositiveInteger(props.sourceId) ?? normalizePositiveInteger(detail?.id);
  const dateRangeMode: TabularDateRangeMode = props.dateRangeMode === "fixed" ? "fixed" : "dashboard";

  return {
    availableFields: buildTabularFieldOptions(detail),
    sourceId,
    sourceLabel: formatTabularSourceLabel(
      detail ?? (sourceId ? { id: sourceId, storage_hash: "", identifier: null } : null),
    ),
    dateRangeMode,
    fixedStartMs: normalizeTimestampMs(props.fixedStartMs),
    fixedEndMs: normalizeTimestampMs(props.fixedEndMs),
    sourceMode: normalizedReference.sourceMode,
    sourceWidgetId: normalizedReference.sourceWidgetId,
    supportsUniqueIdentifierList: false,
    uniqueIdentifierList: undefined,
  };
}

function buildFilterWidgetOptions(
  widgets: DashboardWidgetRegistryEntry[],
  currentWidgetInstanceId?: string,
): PickerOption[] {
  return widgets
    .filter((widget) => widget.id !== currentWidgetInstanceId)
    .map((widget) => {
      const widgetTitle = widget.title?.trim() || widget.widgetId || "Source widget";

      return {
        value: widget.id,
        label: widgetTitle,
        description: widget.id,
        keywords: [widget.id, widgetTitle, widget.widgetId],
      } satisfies PickerOption;
    });
}

export function useResolvedTabularWidgetSourceBinding<
  TProps extends TabularWidgetSourceProps & Partial<TabularWidgetSourceReferenceProps>,
>({
  props,
  currentWidgetInstanceId,
}: {
  props: TProps;
  currentWidgetInstanceId?: string;
}): ResolvedTabularWidgetSourceBinding {
  const widgetRegistry = useDashboardWidgetRegistry();
  const resolvedSourceInput = useResolvedWidgetInput(currentWidgetInstanceId, TABULAR_SOURCE_INPUT_ID);
  const normalizedReference = useMemo(
    () => normalizeTabularWidgetSourceReferenceProps(props),
    [props],
  );
  const resolvedInputBinding = !Array.isArray(resolvedSourceInput) ? resolvedSourceInput : undefined;
  const resolvedSourceWidgetId =
    resolvedInputBinding?.sourceWidgetId ?? normalizedReference.sourceWidgetId;
  const resolvedSourceWidget = useMemo(
    () =>
      resolvedSourceWidgetId
        ? widgetRegistry.find(
            (widget) =>
              widget.id !== currentWidgetInstanceId &&
              widget.id === resolvedSourceWidgetId,
          ) ?? null
        : null,
    [currentWidgetInstanceId, resolvedSourceWidgetId, widgetRegistry],
  );
  const resolvedSourceFrame = useMemo(
    () => {
      const inputFrame = normalizeAnyTabularFrameSource(resolvedInputBinding?.value);
      const runtimeFrame = normalizeAnyTabularFrameSource(resolvedSourceWidget?.runtimeState);

      return inputFrame && !isEmptyTabularFrameSource(inputFrame)
        ? inputFrame
        : runtimeFrame ?? inputFrame;
    },
    [resolvedInputBinding?.value, resolvedSourceWidget?.runtimeState],
  );
  const resolvedSourceDataset = resolvedSourceFrame;
  const hasCanonicalSourceBinding = resolvedInputBinding?.sourceWidgetId != null;
  const resolvedSourceStatus =
    resolvedSourceDataset?.status ??
    (resolvedInputBinding?.value === undefined ? "idle" : null);
  const isAwaitingBoundSourceValue = Boolean(
    hasCanonicalSourceBinding &&
      resolvedInputBinding?.status === "valid" &&
      (resolvedInputBinding.value === undefined ||
        resolvedSourceStatus === "idle" ||
        resolvedSourceStatus === "loading" ||
        isEmptyTabularFrameSource(resolvedSourceDataset)),
  );
  const sourceMode: TabularWidgetSourceMode =
    normalizedReference.sourceMode === "manual" ? "manual" : "filter_widget";

  const debugSnapshot = useMemo(
    () =>
      !import.meta.env.DEV || !hasCanonicalSourceBinding
        ? null
        : {
            currentWidgetInstanceId,
            sourceWidgetId: resolvedSourceWidgetId,
            inputStatus: resolvedInputBinding?.status,
            inputContractId: resolvedInputBinding?.contractId,
            inputValue: summarizeSourceValueForDebug(resolvedInputBinding?.value),
            sourceRuntimeState: summarizeSourceValueForDebug(resolvedSourceWidget?.runtimeState),
            resolvedDataset: summarizeSourceValueForDebug(resolvedSourceDataset),
            resolvedSourceStatus,
            requiresUpstreamResolution: isAwaitingBoundSourceValue,
          },
    [
      currentWidgetInstanceId,
      hasCanonicalSourceBinding,
      isAwaitingBoundSourceValue,
      resolvedInputBinding?.contractId,
      resolvedInputBinding?.status,
      resolvedInputBinding?.value,
      resolvedSourceDataset,
      resolvedSourceStatus,
      resolvedSourceWidget?.runtimeState,
      resolvedSourceWidgetId,
    ],
  );
  const debugSnapshotJson = useMemo(
    () => (debugSnapshot ? JSON.stringify(debugSnapshot) : null),
    [debugSnapshot],
  );

  useEffect(() => {
    if (!debugSnapshotJson) {
      return;
    }

    console.debug("[tabular-source-binding] consumer snapshot", JSON.parse(debugSnapshotJson));
  }, [debugSnapshotJson]);

  return {
    filterWidgetOptions: buildFilterWidgetOptions(widgetRegistry, currentWidgetInstanceId),
    hasCanonicalSourceBinding,
    hasResolvedFilterWidgetSource:
      resolvedInputBinding?.sourceWidgetId != null
        ? resolvedInputBinding.status !== "missing-source"
        : resolvedSourceWidgetId != null
          ? resolvedSourceWidget !== null
          : true,
    isAwaitingBoundSourceValue,
    isFilterWidgetSource: sourceMode !== "manual",
    referencedFilterWidget: resolvedSourceWidget,
    requiresUpstreamResolution: isAwaitingBoundSourceValue,
    resolvedSourceWidget,
    resolvedSourceDataset,
    resolvedSourceFrame,
    resolvedSourceInput: resolvedInputBinding,
    resolvedSourceProps: normalizeTabularWidgetSourceProps(props),
    sourceMode,
    sourceWidgetId: resolvedSourceWidgetId,
  };
}

function toFieldPickerOption(field: TabularFieldOption): PickerOption {
  const metadata = formatTabularFieldMetadata(field);

  return {
    value: field.key,
    label: field.label ?? field.key,
    description: metadata.join(" • ") || undefined,
    keywords: [field.key, field.label ?? field.key, field.nativeType ?? "", field.description ?? ""],
  };
}

export function useTabularWidgetSourceControllerContext<
  TProps extends TabularWidgetSourceProps & Partial<TabularWidgetSourceReferenceProps>,
  TResolvedConfig extends ResolvedTabularWidgetSourceConfig,
>({
  props,
  currentWidgetInstanceId,
  resolveConfig,
}: {
  props: TProps;
  currentWidgetInstanceId?: string;
  queryKeyScope: string;
  resolveConfig: (props: TProps, detail?: TabularSourceDetail | null) => TResolvedConfig;
}): TabularWidgetSourceControllerContext<TResolvedConfig> {
  const sourceBinding = useResolvedTabularWidgetSourceBinding({ props, currentWidgetInstanceId });
  const resolvedConfig = useMemo(
    () => resolveConfig({ ...props, ...sourceBinding.resolvedSourceProps }),
    [props, resolveConfig, sourceBinding.resolvedSourceProps],
  );
  const fieldPickerOptions = useMemo<PickerOption[]>(
    () => resolvedConfig.availableFields.map(toFieldPickerOption),
    [resolvedConfig.availableFields],
  );

  return {
    currentWidgetInstanceId,
    filterWidgetOptions: sourceBinding.filterWidgetOptions,
    fieldPickerOptions,
    hasLoadedTabularSourceDetail: false,
    hasNoData: false,
    hasResolvedFilterWidgetSource: sourceBinding.hasResolvedFilterWidgetSource,
    isAwaitingBoundSourceValue: sourceBinding.isAwaitingBoundSourceValue,
    isFilterWidgetSource: sourceBinding.isFilterWidgetSource,
    referencedFilterWidget: sourceBinding.referencedFilterWidget,
    requiresUpstreamResolution: sourceBinding.requiresUpstreamResolution,
    resolvedSourceWidget: sourceBinding.resolvedSourceWidget,
    resolvedConfig,
    resolvedSourceDataset: sourceBinding.resolvedSourceDataset,
    resolvedSourceFrame: sourceBinding.resolvedSourceFrame,
    resolvedSourceProps: sourceBinding.resolvedSourceProps,
    selectedTabularSourceDetailQuery: { data: null, isLoading: false },
    selectedSourceId: 0,
    sourceMode: sourceBinding.sourceMode,
    sourceWidgetId: sourceBinding.sourceWidgetId,
    supportsUniqueIdentifierList: false,
  };
}

export function createTabularWidgetSourceSettingsSchema<
  TProps extends TabularWidgetSourceProps,
  TContext extends TabularWidgetSourceControllerContext,
>({
  additionalFields = [],
  additionalSections = [],
}: CreateTabularWidgetSourceSchemaOptions<TProps, TContext>): WidgetSettingsSchema<TProps, TContext> {
  return {
    sections: additionalSections,
    fields: additionalFields,
  };
}

export function resolveTabularDateRange(
  config: Pick<ResolvedTabularWidgetSourceConfig, "dateRangeMode" | "fixedEndMs" | "fixedStartMs">,
  dashboardStartMs?: number | null,
  dashboardEndMs?: number | null,
) {
  if (config.dateRangeMode === "fixed") {
    const fixedStartMs = normalizeTimestampMs(config.fixedStartMs);
    const fixedEndMs = normalizeTimestampMs(config.fixedEndMs);
    const hasValidRange =
      fixedStartMs !== undefined &&
      fixedEndMs !== undefined &&
      fixedStartMs < fixedEndMs;

    return {
      mode: "fixed" as const,
      rangeStartMs: hasValidRange ? fixedStartMs : null,
      rangeEndMs: hasValidRange ? fixedEndMs : null,
      hasValidRange,
    };
  }

  const rangeStartMs = normalizeTimestampMs(dashboardStartMs);
  const rangeEndMs = normalizeTimestampMs(dashboardEndMs);
  const hasValidRange =
    rangeStartMs !== undefined &&
    rangeEndMs !== undefined &&
    rangeStartMs < rangeEndMs;

  return {
    mode: "dashboard" as const,
    rangeStartMs: hasValidRange ? rangeStartMs : null,
    rangeEndMs: hasValidRange ? rangeEndMs : null,
    hasValidRange,
  };
}

export function formatDateTimeLocalValue(timestampMs?: number) {
  if (!timestampMs) {
    return "";
  }

  const date = new Date(timestampMs);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function parseDateTimeLocalValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveTabularWidgetPreviewAnchorMs() {
  return null;
}

export function resolveTabularWidgetPrefilledFixedRange() {
  return null;
}
