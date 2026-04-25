import type {
  DataNodeDetail,
  DataNodeRemoteDataRow,
  DataNodeSummary,
  LocalTimeSerieQuickSearchRecord,
} from "../../../../common/api";
import type {
  TabularFrameFieldSchema,
  TabularFrameFieldType,
  TabularFrameFieldProvenance,
} from "@/widgets/shared/tabular-frame-source";

export type DataNodeDateRangeMode = "dashboard" | "fixed";
export type DataNodeFieldOption = TabularFrameFieldSchema;

function fieldTypeFamily(type: TabularFrameFieldType) {
  if (type === "integer" || type === "number") {
    return "numeric";
  }

  if (type === "date" || type === "datetime" || type === "time") {
    return "temporal";
  }

  return type;
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

export function formatDataNodeFieldMetadata(field: DataNodeFieldOption) {
  return [
    field.nativeType,
    field.type !== "unknown" ? field.type : null,
    field.description ?? null,
  ].filter((value): value is string => Boolean(value && value.trim()));
}

export function formatDataNodeFieldSearchText(field: DataNodeFieldOption) {
  return [
    field.key,
    field.label,
    field.description ?? "",
    field.nativeType ?? "",
    field.type,
  ].join(" ");
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

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
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

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed);
}

function isTimeValue(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (!/[T:\-\/ ]/.test(trimmed) && !/time|date/i.test(trimmed)) {
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

function sampleValueLooksLikeLocaleDate(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  return /^(\d{2})[-/](\d{2})[-/](\d{4})$/.test(trimmed);
}

function sampleValueHasAmbiguousDayMonthOrder(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);

  if (!match) {
    return false;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  return Number.isFinite(first) && Number.isFinite(second) && first <= 12 && second <= 12;
}

function buildFieldWarningsFromSamples(samples: unknown[]) {
  const warnings: string[] = [];

  if (samples.some((value) => sampleValueLooksLikeLocaleDate(value))) {
    warnings.push(
      "Sample values use locale-style date strings. Prefer YYYY-MM-DD or an explicit time parser.",
    );
  }

  if (samples.some((value) => sampleValueHasAmbiguousDayMonthOrder(value))) {
    warnings.push(
      "Some sampled dates are ambiguous because both day and month are <= 12.",
    );
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

function cloneFieldOption(field: DataNodeFieldOption): DataNodeFieldOption {
  return {
    ...field,
    derivedFrom: field.derivedFrom ? [...field.derivedFrom] : undefined,
    warnings: field.warnings ? [...field.warnings] : undefined,
  };
}

function getFieldOptionLabel(
  key: string,
  detail?: DataNodeDetail | null,
) {
  const metadata =
    detail?.sourcetableconfiguration?.columns_metadata?.find((column) => column.column_name === key) ??
    null;

  return metadata?.label?.trim() || key;
}

function getFieldOptionDescription(
  key: string,
  detail?: DataNodeDetail | null,
) {
  const metadata =
    detail?.sourcetableconfiguration?.columns_metadata?.find((column) => column.column_name === key) ??
    null;

  return metadata?.description?.trim() || null;
}

function getFieldOptionDtype(
  key: string,
  detail?: DataNodeDetail | null,
) {
  const metadata =
    detail?.sourcetableconfiguration?.columns_metadata?.find((column) => column.column_name === key) ??
    null;
  const sourceConfig = detail?.sourcetableconfiguration;

  return metadata?.dtype?.trim() || sourceConfig?.column_dtypes_map?.[key] || null;
}

export function formatDataNodeLabel(
  dataNode?: Pick<DataNodeSummary, "id" | "identifier" | "storage_hash"> | null,
) {
  if (!dataNode) {
    return "Data node";
  }

  const identifier = dataNode.identifier?.trim();

  if (identifier) {
    return identifier;
  }

  return dataNode.storage_hash || `Data node ${dataNode.id}`;
}

export function formatLocalTimeSerieLabel(
  localTimeSerie?:
    | Pick<LocalTimeSerieQuickSearchRecord, "id" | "update_hash" | "data_node_storage">
    | null,
) {
  if (!localTimeSerie) {
    return "Local update";
  }

  const updateHash = localTimeSerie.update_hash?.trim();

  if (updateHash) {
    return updateHash;
  }

  const dataNodeIdentifier = localTimeSerie.data_node_storage?.identifier?.trim();

  if (dataNodeIdentifier) {
    return dataNodeIdentifier;
  }

  const dataNodeStorageHash = localTimeSerie.data_node_storage?.storage_hash?.trim();

  if (dataNodeStorageHash) {
    return dataNodeStorageHash;
  }

  return `Local update ${localTimeSerie.id}`;
}

export function buildDataNodeFieldOptions(detail?: DataNodeDetail | null) {
  const sourceConfig = detail?.sourcetableconfiguration;
  const orderedKeys = uniqueStrings([
    sourceConfig?.time_index_name ?? undefined,
    ...(sourceConfig?.index_names ?? []),
    ...(sourceConfig?.columns_metadata?.map((column) => column.column_name) ?? []),
    ...Object.keys(sourceConfig?.column_dtypes_map ?? {}),
  ]);

  return orderedKeys.map<DataNodeFieldOption>((key) => {
    const nativeType = getFieldOptionDtype(key, detail);
    const type = inferTypeFromNativeType(nativeType) ?? "unknown";

    return {
      key,
      label: getFieldOptionLabel(key, detail),
      description: getFieldOptionDescription(key, detail),
      nativeType,
      type,
      provenance: "backend",
      reason: "Resolved from Data Node source-table metadata.",
    };
  });
}

export function buildDataNodeFieldOptionsFromRows(input: {
  columns?: readonly string[];
  rows?: readonly DataNodeRemoteDataRow[];
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

  return orderedKeys.map<DataNodeFieldOption>((key) => {
    const samples = (input.rows ?? [])
      .map((row) => row[key])
      .filter((value) => value !== null && value !== undefined && value !== "");
    const type = inferTypeFromSamples(samples);
    const warnings = buildFieldWarningsFromSamples(samples);
    const reason =
      options?.reasonByKey?.[key] ??
      (provenance === "manual"
        ? "Configured manually in the table editor."
        : provenance === "derived"
          ? "Derived from transformed dataset rows."
          : "Inferred from sampled dataset rows.");

    return {
      key,
      label: key,
      description: null,
      nativeType: null,
      type,
      provenance,
      reason,
      derivedFrom: options?.derivedFromByKey?.[key],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  });
}

export function resolveDataNodeFieldOptionsFromDataset(input: {
  columns?: string[];
  rows?: readonly DataNodeRemoteDataRow[];
  fields?: readonly DataNodeFieldOption[];
}) {
  const datasetFields = input.fields?.filter((field) => typeof field.key === "string" && field.key.trim()) ?? [];

  if (datasetFields.length === 0) {
    return buildDataNodeFieldOptionsFromRows({
      columns: input.columns,
      rows: input.rows,
    });
  }

  const fallbackFields = buildDataNodeFieldOptionsFromRows({
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

  return orderedKeys.flatMap<DataNodeFieldOption>((key) => {
    if (seen.has(key)) {
      return [];
    }

    seen.add(key);

    const declaredField = datasetFields.find((field) => field.key === key);

    if (declaredField) {
      const fallbackField = fallbackFieldByKey.get(key);

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
        warnings:
          mergeFieldWarnings(
            declaredField.warnings,
            fallbackField?.warnings,
            fallbackField &&
              fieldTypeFamily(declaredField.type) !== fieldTypeFamily(fallbackField.type)
              ? `Runtime samples look like ${fallbackField.type}, but the declared schema resolves this field as ${declaredField.type}.`
              : null,
          ).length > 0
            ? mergeFieldWarnings(
                declaredField.warnings,
                fallbackField?.warnings,
                fallbackField &&
                  fieldTypeFamily(declaredField.type) !== fieldTypeFamily(fallbackField.type)
                  ? `Runtime samples look like ${fallbackField.type}, but the declared schema resolves this field as ${declaredField.type}.`
                  : null,
              )
            : undefined,
      }];
    }

    const fallbackField = fallbackFieldByKey.get(key);
    return fallbackField ? [fallbackField] : [];
  });
}

export function resolveDataNodeDateRange(
  config: Pick<DataNodeDateRangeConfig, "dateRangeMode" | "fixedEndMs" | "fixedStartMs">,
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

export interface DataNodeDateRangeConfig {
  dateRangeMode: DataNodeDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
}
