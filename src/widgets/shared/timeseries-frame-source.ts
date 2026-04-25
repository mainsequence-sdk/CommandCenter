import type { WidgetValueDescriptor } from "@/widgets/types";
import type {
  TabularFrameFieldSchema,
  TabularFrameFieldType,
  TabularFrameSourceDescriptor,
  TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";

export const CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT = "core.time_series_frame@v1" as const;
export const CORE_TIMESERIES_FRAME_SOURCE_CONTRACT = CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT;

export const TIMESERIES_FRAME_SOURCE_CONTRACTS = [
  CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
] as const;

export type TimeSeriesFrameContractId = (typeof TIMESERIES_FRAME_SOURCE_CONTRACTS)[number];
export type TimeSeriesFrameStatus = "idle" | "loading" | "ready" | "error";
export type TimeSeriesShape = "long" | "wide";
export type TimeSeriesGapPolicy = "preserve_nulls" | "drop_nulls";
export type TimeSeriesDuplicatePolicy =
  | "error"
  | "first"
  | "latest"
  | "aggregate"
  | "preserve";
export type TimeSeriesFrameFieldType = "time" | "number" | "string" | "boolean" | "json";

export interface TimeSeriesFrameField {
  name: string;
  type: TimeSeriesFrameFieldType;
  values: unknown[];
  labels?: Record<string, string>;
  config?: {
    unit?: string;
    displayName?: string;
    decimals?: number;
  };
}

export interface TimeSeriesFrameMeta {
  shape: TimeSeriesShape;
  timeField: string;
  timeUnit: "ms";
  timezone: "UTC";
  sorted: boolean;
  valueField?: string;
  seriesField?: string;
  seriesLabelFields?: string[];
  valueFields?: string[];
  frequency?: string;
  calendar?: string;
  gapPolicy?: TimeSeriesGapPolicy;
  duplicatePolicy?: TimeSeriesDuplicatePolicy;
  unitByField?: Record<string, string>;
}

export interface TimeSeriesFrameSourceV1 {
  status: TimeSeriesFrameStatus;
  error?: string;
  name?: string;
  contract: TimeSeriesFrameContractId;
  fields: TimeSeriesFrameField[];
  meta: Record<string, unknown> & {
    timeSeries: TimeSeriesFrameMeta;
  };
  source?: TabularFrameSourceDescriptor;
  warnings?: string[];
  traceId?: string;
}

export interface TimeSeriesGraphDefaults {
  xField: string;
  yField: string;
  groupField?: string;
}

export const TIMESERIES_FRAME_SOURCE_VALUE_DESCRIPTOR = {
  kind: "object",
  contract: CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  description:
    "Canonical time-series frame with field arrays and declared time/value/series semantics.",
  fields: [
    {
      key: "contract",
      label: "Contract",
      value: {
        kind: "primitive",
        contract: "core.value.string@v1",
        primitive: "string",
      },
    },
    {
      key: "fields",
      label: "Fields",
      value: {
        kind: "array",
        contract: "core.value.json@v1",
        items: {
          kind: "object",
          contract: "core.value.json@v1",
          fields: [
            {
              key: "name",
              label: "Name",
              value: {
                kind: "primitive",
                contract: "core.value.string@v1",
                primitive: "string",
              },
            },
            {
              key: "type",
              label: "Type",
              value: {
                kind: "primitive",
                contract: "core.value.string@v1",
                primitive: "string",
              },
            },
          ],
        },
      },
    },
    {
      key: "meta",
      label: "Metadata",
      value: {
        kind: "object",
        contract: "core.value.json@v1",
        fields: [],
      },
    },
  ],
} satisfies WidgetValueDescriptor;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized = value.flatMap((entry) => {
    const nextValue = normalizeString(entry);

    if (!nextValue || seen.has(nextValue)) {
      return [];
    }

    seen.add(nextValue);
    return [nextValue];
  });

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeStringRecord(value: unknown) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([key, entryValue]) => {
    const normalizedKey = key.trim();
    const normalizedValue = normalizeString(entryValue);

    return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeFieldType(value: unknown): TimeSeriesFrameFieldType {
  return value === "time" ||
    value === "number" ||
    value === "string" ||
    value === "boolean" ||
    value === "json"
    ? value
    : "json";
}

function normalizeTabularFieldType(value: TimeSeriesFrameFieldType): TabularFrameFieldType {
  if (value === "time") {
    return "datetime";
  }

  return value;
}

function normalizeFrameFieldConfig(value: unknown) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const unit = normalizeString(value.unit);
  const displayName = normalizeString(value.displayName);
  const decimals = Number(value.decimals);

  return {
    unit,
    displayName,
    decimals: Number.isFinite(decimals) ? Math.trunc(decimals) : undefined,
  };
}

function normalizeFrameFields(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value.flatMap((entry) => {
    if (!isPlainRecord(entry)) {
      return [];
    }

    const name = normalizeString(entry.name);

    if (!name || seen.has(name) || !Array.isArray(entry.values)) {
      return [];
    }

    seen.add(name);

    return [{
      name,
      type: normalizeFieldType(entry.type),
      values: entry.values,
      labels: isPlainRecord(entry.labels)
        ? Object.fromEntries(
            Object.entries(entry.labels).flatMap(([key, label]) => {
              const normalizedLabel = normalizeString(label);
              return key.trim() && normalizedLabel ? [[key.trim(), normalizedLabel] as const] : [];
            }),
          )
        : undefined,
      config: normalizeFrameFieldConfig(entry.config),
    } satisfies TimeSeriesFrameField];
  });
}

function isTimeSeriesContract(value: unknown): value is TimeSeriesFrameContractId {
  return TIMESERIES_FRAME_SOURCE_CONTRACTS.includes(value as TimeSeriesFrameContractId);
}

function normalizeShape(value: unknown): TimeSeriesShape | undefined {
  return value === "long" || value === "wide" ? value : undefined;
}

function normalizeGapPolicy(value: unknown): TimeSeriesGapPolicy | undefined {
  return value === "preserve_nulls" || value === "drop_nulls" ? value : undefined;
}

function normalizeDuplicatePolicy(value: unknown): TimeSeriesDuplicatePolicy | undefined {
  return value === "error" ||
    value === "first" ||
    value === "latest" ||
    value === "aggregate" ||
    value === "preserve"
    ? value
    : undefined;
}

function fieldExists(fieldsByName: Map<string, TimeSeriesFrameField>, fieldName: string | undefined) {
  return Boolean(fieldName && fieldsByName.has(fieldName));
}

function normalizeTimeSeriesMeta(value: unknown, fields: TimeSeriesFrameField[]) {
  if (!isPlainRecord(value)) {
    return null;
  }

  const shape = normalizeShape(value.shape);
  const timeField = normalizeString(value.timeField);
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));

  if (!shape || !fieldExists(fieldsByName, timeField)) {
    return null;
  }

  const valueField = normalizeString(value.valueField);
  const seriesField = normalizeString(value.seriesField);
  const valueFields = normalizeStringArray(value.valueFields)?.filter((fieldName) =>
    fieldExists(fieldsByName, fieldName),
  );

  if (shape === "long" && !fieldExists(fieldsByName, valueField)) {
    return null;
  }

  if (shape === "wide" && (!valueFields || valueFields.length === 0)) {
    return null;
  }

  return {
    shape,
    timeField: timeField!,
    timeUnit: "ms",
    timezone: "UTC",
    sorted: value.sorted === true,
    valueField: shape === "long" ? valueField : undefined,
    seriesField: fieldExists(fieldsByName, seriesField) ? seriesField : undefined,
    seriesLabelFields: normalizeStringArray(value.seriesLabelFields)?.filter((fieldName) =>
      fieldExists(fieldsByName, fieldName),
    ),
    valueFields: shape === "wide" ? valueFields : undefined,
    frequency: normalizeString(value.frequency),
    calendar: normalizeString(value.calendar),
    gapPolicy: normalizeGapPolicy(value.gapPolicy),
    duplicatePolicy: normalizeDuplicatePolicy(value.duplicatePolicy),
    unitByField: normalizeStringRecord(value.unitByField),
  } satisfies TimeSeriesFrameMeta;
}

function normalizeStatus(value: unknown, error?: string): TimeSeriesFrameStatus {
  if (value === "idle" || value === "loading" || value === "ready" || value === "error") {
    return value;
  }

  return error ? "error" : "ready";
}

export function normalizeTimeSeriesFrameSource(value: unknown): TimeSeriesFrameSourceV1 | null {
  if (!isPlainRecord(value) || !isTimeSeriesContract(value.contract)) {
    return null;
  }

  const fields = normalizeFrameFields(value.fields);
  const rawMeta = isPlainRecord(value.meta) ? value.meta : {};
  const timeSeriesMeta = normalizeTimeSeriesMeta(rawMeta.timeSeries, fields);

  if (fields.length === 0 || !timeSeriesMeta) {
    return null;
  }

  const error = normalizeString(value.error);

  return {
    status: normalizeStatus(value.status, error),
    error,
    name: normalizeString(value.name),
    contract: value.contract,
    fields,
    meta: {
      ...rawMeta,
      timeSeries: timeSeriesMeta,
    },
    source: isPlainRecord(value.source) ? normalizeSourceDescriptor(value.source) : undefined,
    warnings: normalizeStringArray(value.warnings),
    traceId: normalizeString(value.traceId),
  };
}

function normalizeSourceDescriptor(value: unknown): TabularFrameSourceDescriptor | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const kind = normalizeString(value.kind);

  if (!kind) {
    return undefined;
  }

  const rawId = value.id;
  const id =
    typeof rawId === "string" && rawId.trim()
      ? rawId.trim()
      : typeof rawId === "number" && Number.isFinite(rawId)
        ? rawId
        : undefined;

  return {
    kind,
    id,
    label: normalizeString(value.label),
    updatedAtMs:
      typeof value.updatedAtMs === "number" && Number.isFinite(value.updatedAtMs)
        ? Math.trunc(value.updatedAtMs)
        : undefined,
    context: isPlainRecord(value.context) ? value.context : undefined,
  };
}

function fieldToTabularField(field: TimeSeriesFrameField): TabularFrameFieldSchema {
  return {
    key: field.name,
    label: field.config?.displayName ?? field.name,
    type: normalizeTabularFieldType(field.type),
    nullable: true,
    nativeType: field.type,
    provenance: "backend",
    reason: "Returned by the selected time-series connection query frame.",
  };
}

function getField(fields: TimeSeriesFrameField[], fieldName: string) {
  return fields.find((field) => field.name === fieldName);
}

function buildRowsFromFields(fields: TimeSeriesFrameField[]) {
  const rowCount = Math.max(0, ...fields.map((field) => field.values.length));

  return Array.from({ length: rowCount }, (_entry, index) =>
    Object.fromEntries(fields.map((field) => [field.name, field.values[index] ?? null])),
  );
}

function formatSeriesLabel(
  row: Record<string, unknown>,
  seriesField: string | undefined,
  labelFields: string[] | undefined,
  fallback: string,
) {
  const labelParts = (labelFields ?? [])
    .map((fieldName) => row[fieldName])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(String);

  if (labelParts.length > 0) {
    return labelParts.join(" / ");
  }

  if (seriesField) {
    const seriesValue = row[seriesField];
    return seriesValue === null || seriesValue === undefined || seriesValue === ""
      ? fallback
      : String(seriesValue);
  }

  return fallback;
}

function buildLongRows(frame: TimeSeriesFrameSourceV1) {
  const timeSeries = frame.meta.timeSeries;
  const rows = buildRowsFromFields(frame.fields);
  const valueField = timeSeries.valueField!;
  const defaults: TimeSeriesGraphDefaults = {
    xField: timeSeries.timeField,
    yField: valueField,
    groupField: timeSeries.seriesField,
  };

  return {
    columns: frame.fields.map((field) => field.name),
    rows,
    fields: frame.fields.map(fieldToTabularField),
    graphDefaults: defaults,
  };
}

function buildWideRows(frame: TimeSeriesFrameSourceV1) {
  const timeSeries = frame.meta.timeSeries;
  const timeField = getField(frame.fields, timeSeries.timeField);
  const valueFields = (timeSeries.valueFields ?? []).flatMap((fieldName) => {
    const field = getField(frame.fields, fieldName);
    return field ? [field] : [];
  });
  const rows = valueFields.flatMap((valueField) =>
    (timeField?.values ?? []).map((timeValue, index) => ({
      [timeSeries.timeField]: timeValue ?? null,
      series: valueField.config?.displayName ?? valueField.name,
      value: valueField.values[index] ?? null,
      sourceField: valueField.name,
    })),
  );
  const defaults: TimeSeriesGraphDefaults = {
    xField: timeSeries.timeField,
    yField: "value",
    groupField: "series",
  };

  return {
    columns: [timeSeries.timeField, "series", "value", "sourceField"],
    rows,
    fields: [
      fieldToTabularField(timeField ?? {
        name: timeSeries.timeField,
        type: "time",
        values: [],
      }),
      {
        key: "series",
        label: "Series",
        type: "string",
        nullable: false,
        nativeType: "string",
        provenance: "derived",
        reason: "Derived from the wide time-series value field names.",
      },
      {
        key: "value",
        label: "Value",
        type: "number",
        nullable: true,
        nativeType: "number",
        provenance: "derived",
        reason: "Derived from the wide time-series value fields.",
        derivedFrom: valueFields.map((field) => field.name),
      },
      {
        key: "sourceField",
        label: "Source field",
        type: "string",
        nullable: false,
        nativeType: "string",
        provenance: "derived",
        reason: "Identifies the original wide value field.",
      },
    ] satisfies TabularFrameFieldSchema[],
    graphDefaults: defaults,
  };
}

export function timeSeriesFrameToTabularFrameSource(value: unknown): TabularFrameSourceV1 | null {
  const frame = normalizeTimeSeriesFrameSource(value);

  if (!frame) {
    return null;
  }

  const normalized =
    frame.meta.timeSeries.shape === "wide" ? buildWideRows(frame) : buildLongRows(frame);

  return {
    status: frame.status,
    error: frame.error,
    columns: normalized.columns,
    rows: normalized.rows,
    fields: normalized.fields,
    source: {
      kind: "time-series-frame",
      id: frame.source?.id,
      label: frame.source?.label ?? frame.name,
      updatedAtMs: frame.source?.updatedAtMs,
      context: {
        ...(frame.source?.context ?? {}),
        sourceContract: frame.contract,
        timeSeries: frame.meta.timeSeries,
        graphDefaults: normalized.graphDefaults,
        warnings: frame.warnings,
        traceId: frame.traceId,
      },
    },
  };
}

export function isTimeSeriesFrameSource(value: unknown): value is TimeSeriesFrameSourceV1 {
  return normalizeTimeSeriesFrameSource(value) !== null;
}
