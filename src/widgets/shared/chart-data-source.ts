import type { WidgetValueDescriptor } from "@/widgets/types";

import {
  CORE_VALUE_JSON_CONTRACT,
  CORE_VALUE_STRING_CONTRACT,
} from "./value-contracts";

export const CORE_CHART_DATA_SOURCE_CONTRACT = "core.chart_data@v1" as const;

export type ChartDataSourceStatus = "idle" | "loading" | "ready" | "error";
export type ChartDataFieldType = "time" | "number" | "string" | "boolean" | "json";
export type ChartKind =
  | "line"
  | "area"
  | "bar"
  | "scatter"
  | "histogram"
  | "pie"
  | string;
export type ChartLogicalType = "time" | "number" | "string" | "boolean" | "category";

export interface ChartDataFieldConfig {
  unit?: string;
  displayName?: string;
  decimals?: number;
}

export interface ChartDataField {
  name: string;
  type: ChartDataFieldType;
  values: unknown[];
  labels?: Record<string, string>;
  config?: ChartDataFieldConfig;
}

export interface ChartFieldRef {
  field: string;
  type: ChartLogicalType;
  label?: string;
  unit?: string;
}

export interface ChartDataMetadata {
  chart: {
    kind: ChartKind;
    x?: ChartFieldRef;
    y?: ChartFieldRef;
    series?: {
      field: string;
      label?: string;
    };
    color?: {
      field?: string;
      value?: string;
    };
    size?: ChartFieldRef;
    tooltipFields?: string[];
    legend?: {
      visible?: boolean;
      title?: string;
    };
    axes?: {
      x?: { label?: string; unit?: string; scale?: "linear" | "log" | "time" | "category" };
      y?: { label?: string; unit?: string; scale?: "linear" | "log" };
    };
    stack?: "none" | "normal" | "percent";
  };
  source?: Record<string, unknown>;
  rowCount?: number;
  generatedAt?: string;
  adapterVersion?: string;
  cache?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChartDataSourceDescriptor {
  kind: string;
  id?: string | number;
  label?: string;
  updatedAtMs?: number;
  context?: Record<string, unknown>;
}

export interface ChartDataSourceV1 {
  status: ChartDataSourceStatus;
  error?: string;
  name?: string;
  fields: ChartDataField[];
  meta: ChartDataMetadata;
  source?: ChartDataSourceDescriptor;
}

export const CHART_DATA_SOURCE_VALUE_DESCRIPTOR = {
  kind: "object",
  contract: CORE_CHART_DATA_SOURCE_CONTRACT,
  description:
    "Renderer-neutral chart data with columnar fields and declared chart encoding metadata.",
  fields: [
    {
      key: "status",
      label: "Status",
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "name",
      label: "Name",
      value: {
        kind: "primitive",
        contract: CORE_VALUE_STRING_CONTRACT,
        primitive: "string",
      },
    },
    {
      key: "fields",
      label: "Fields",
      value: {
        kind: "array",
        contract: CORE_VALUE_JSON_CONTRACT,
        items: {
          kind: "object",
          contract: CORE_VALUE_JSON_CONTRACT,
          fields: [],
        },
      },
    },
    {
      key: "meta",
      label: "Metadata",
      value: {
        kind: "object",
        contract: CORE_VALUE_JSON_CONTRACT,
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

function normalizeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
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

function normalizeStringMap(value: unknown) {
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

function normalizeFieldType(value: unknown): ChartDataFieldType | undefined {
  return value === "time" ||
    value === "number" ||
    value === "string" ||
    value === "boolean" ||
    value === "json"
    ? value
    : undefined;
}

function normalizeFieldConfig(value: unknown): ChartDataFieldConfig | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const unit = normalizeString(value.unit);
  const displayName = normalizeString(value.displayName);
  const decimals = normalizeInteger(value.decimals);

  return unit || displayName || decimals !== undefined
    ? {
        unit,
        displayName,
        decimals,
      }
    : undefined;
}

function normalizeFields(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized = value.flatMap((entry) => {
    if (!isPlainRecord(entry)) {
      return [];
    }

    const name = normalizeString(entry.name);
    const type = normalizeFieldType(entry.type);

    if (!name || !type || seen.has(name) || !Array.isArray(entry.values)) {
      return [];
    }

    seen.add(name);

    return [{
      name,
      type,
      values: entry.values,
      labels: normalizeStringMap(entry.labels),
      config: normalizeFieldConfig(entry.config),
    } satisfies ChartDataField];
  });

  const rowCount = normalized[0]?.values.length ?? 0;

  return normalized.every((field) => field.values.length === rowCount) ? normalized : [];
}

function normalizeLogicalType(value: unknown): ChartLogicalType | undefined {
  return value === "time" ||
    value === "number" ||
    value === "string" ||
    value === "boolean" ||
    value === "category"
    ? value
    : undefined;
}

function hasField(fields: readonly ChartDataField[], fieldName: string | undefined) {
  return Boolean(fieldName && fields.some((field) => field.name === fieldName));
}

function normalizeChartFieldRef(
  value: unknown,
  fields: readonly ChartDataField[],
): ChartFieldRef | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const field = normalizeString(value.field);
  const type = normalizeLogicalType(value.type);

  if (!field || !type || !hasField(fields, field)) {
    return undefined;
  }

  return {
    field,
    type,
    label: normalizeString(value.label),
    unit: normalizeString(value.unit),
  };
}

function normalizeChartSeriesRef(value: unknown, fields: readonly ChartDataField[]) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const field = normalizeString(value.field);

  return field && hasField(fields, field)
    ? {
        field,
        label: normalizeString(value.label),
      }
    : undefined;
}

function normalizeChartColor(value: unknown, fields: readonly ChartDataField[]) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const field = normalizeString(value.field);
  const fixedValue = normalizeString(value.value);

  return (field && hasField(fields, field)) || fixedValue
    ? {
        field: field && hasField(fields, field) ? field : undefined,
        value: fixedValue,
      }
    : undefined;
}

function normalizeLegend(value: unknown) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  return typeof value.visible === "boolean" || normalizeString(value.title)
    ? {
        visible: typeof value.visible === "boolean" ? value.visible : undefined,
        title: normalizeString(value.title),
      }
    : undefined;
}

function normalizeStack(value: unknown) {
  return value === "normal" || value === "percent" ? value : value === "none" ? "none" : undefined;
}

function normalizeChartMeta(
  value: unknown,
  fields: readonly ChartDataField[],
): ChartDataMetadata | undefined {
  if (!isPlainRecord(value) || !isPlainRecord(value.chart)) {
    return undefined;
  }

  const chart = value.chart;
  const kind = normalizeString(chart.kind);
  const x = normalizeChartFieldRef(chart.x, fields);
  const y = normalizeChartFieldRef(chart.y, fields);
  const size = normalizeChartFieldRef(chart.size, fields);

  if (!kind || (!x && !y)) {
    return undefined;
  }

  const tooltipFields = normalizeStringArray(chart.tooltipFields)?.filter((field) =>
    hasField(fields, field)
  );

  return {
    ...value,
    chart: {
      kind,
      x,
      y,
      series: normalizeChartSeriesRef(chart.series, fields),
      color: normalizeChartColor(chart.color, fields),
      size,
      tooltipFields: tooltipFields?.length ? tooltipFields : undefined,
      legend: normalizeLegend(chart.legend),
      axes: isPlainRecord(chart.axes) ? chart.axes : undefined,
      stack: normalizeStack(chart.stack),
    },
  };
}

function normalizeSourceDescriptor(value: unknown) {
  if (!isPlainRecord(value) || typeof value.kind !== "string" || !value.kind.trim()) {
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
    kind: value.kind.trim(),
    id,
    label: normalizeString(value.label),
    updatedAtMs: normalizeInteger(value.updatedAtMs),
    context: isPlainRecord(value.context) ? value.context : undefined,
  } satisfies ChartDataSourceDescriptor;
}

function resolveExplicitStatus(value: unknown): ChartDataSourceStatus | undefined {
  return value === "loading" || value === "ready" || value === "error" ? value : undefined;
}

function normalizeStatus(
  value: unknown,
  fields: readonly ChartDataField[],
  error?: string,
): ChartDataSourceStatus {
  const explicitStatus = resolveExplicitStatus(value);

  if (explicitStatus) {
    return explicitStatus;
  }

  if (error) {
    return "error";
  }

  return fields.length > 0 ? "ready" : "idle";
}

function readFirstMatchingFrame(value: Record<string, unknown>) {
  if (!Array.isArray(value.frames)) {
    return null;
  }

  return value.frames.find(
    (frame): frame is Record<string, unknown> =>
      isPlainRecord(frame) && frame.contract === CORE_CHART_DATA_SOURCE_CONTRACT,
  ) ?? null;
}

export function normalizeChartDataSource(value: unknown): ChartDataSourceV1 | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const candidate = value.contract === CORE_CHART_DATA_SOURCE_CONTRACT
    ? value
    : readFirstMatchingFrame(value);

  if (!candidate) {
    return null;
  }

  const error = normalizeString(candidate.error);
  const fields = normalizeFields(candidate.fields);
  const meta = normalizeChartMeta(candidate.meta, fields);

  if (!meta && !error) {
    return null;
  }

  return {
    status: normalizeStatus(candidate.status, fields, error),
    error,
    name: normalizeString(candidate.name),
    fields,
    meta: meta ?? {
      chart: {
        kind: "line",
      },
    },
    source: normalizeSourceDescriptor(candidate.source) ??
      normalizeSourceDescriptor(isPlainRecord(candidate.meta) ? candidate.meta.source : undefined),
  };
}
