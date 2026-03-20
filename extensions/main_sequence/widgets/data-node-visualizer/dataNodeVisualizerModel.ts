import type {
  DataNodeDetail,
  DataNodeRemoteDataRow,
  DataNodeSummary,
} from "../../api";

export type DataNodeVisualizerProvider = "tradingview";
export type DataNodeVisualizerChartType = "line" | "area" | "bar";
export type DataNodeVisualizerViewMode = "chart" | "table";
export type DataNodeVisualizerSeriesAxisMode = "shared" | "separate";
export type DataNodeVisualizerDateRangeMode = "dashboard" | "fixed";

export interface DataNodeVisualizerSeriesOverride {
  color?: string;
}

export type DataNodeVisualizerSeriesOverrides = Record<string, DataNodeVisualizerSeriesOverride>;

export interface MainSequenceDataNodeVisualizerWidgetProps extends Record<string, unknown> {
  chartType?: DataNodeVisualizerChartType;
  dataNodeId?: number;
  dateRangeMode?: DataNodeVisualizerDateRangeMode;
  displayMode?: DataNodeVisualizerViewMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  groupField?: string;
  limit?: number;
  normalizeAtMs?: number;
  normalizeSeries?: boolean;
  provider?: DataNodeVisualizerProvider;
  seriesAxisMode?: DataNodeVisualizerSeriesAxisMode;
  seriesOverrides?: DataNodeVisualizerSeriesOverrides;
  xField?: string;
  yField?: string;
}

export interface DataNodeVisualizerFieldOption {
  description?: string | null;
  dtype: string | null;
  isIndex: boolean;
  isNumeric: boolean;
  isTime: boolean;
  key: string;
  label: string;
}

export interface ResolvedDataNodeVisualizerConfig {
  availableFields: DataNodeVisualizerFieldOption[];
  chartType: DataNodeVisualizerChartType;
  dataNodeId?: number;
  dataNodeLabel: string;
  dateRangeMode: DataNodeVisualizerDateRangeMode;
  displayMode: DataNodeVisualizerViewMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  groupField?: string;
  limit: number;
  normalizeAtMs?: number;
  normalizeSeries: boolean;
  provider: DataNodeVisualizerProvider;
  seriesAxisMode: DataNodeVisualizerSeriesAxisMode;
  seriesOverrides?: DataNodeVisualizerSeriesOverrides;
  xField?: string;
  yField?: string;
}

export interface DataNodeVisualizerSeries {
  color?: string;
  id: string;
  label: string;
  pointCount: number;
  points: Array<{ time: number; value: number }>;
}

export interface DataNodeVisualizerSeriesResult {
  droppedGroups: number;
  series: DataNodeVisualizerSeries[];
}

const defaultVisualizerLimit = 14_000;
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;

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

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function normalizeSeriesOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const normalizedEntries = Object.entries(value).flatMap(([seriesId, overrideValue]) => {
    if (!seriesId.trim() || !overrideValue || typeof overrideValue !== "object" || Array.isArray(overrideValue)) {
      return [];
    }

    const color = normalizeHexColor((overrideValue as DataNodeVisualizerSeriesOverride).color);

    if (!color) {
      return [];
    }

    return [[seriesId, { color }] as const];
  });

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries) satisfies DataNodeVisualizerSeriesOverrides;
}

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function isNumericDtype(dtype: string | null | undefined) {
  if (!dtype) {
    return false;
  }

  return /int|float|double|decimal|number|numeric|real|bigint/i.test(dtype);
}

function isTimeDtype(dtype: string | null | undefined) {
  if (!dtype) {
    return false;
  }

  return /date|time|timestamp/i.test(dtype);
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

export function buildDataNodeVisualizerFieldOptions(detail?: DataNodeDetail | null) {
  const sourceConfig = detail?.sourcetableconfiguration;
  const orderedKeys = uniqueStrings([
    sourceConfig?.time_index_name ?? undefined,
    ...(sourceConfig?.index_names ?? []),
    ...(sourceConfig?.columns_metadata?.map((column) => column.column_name) ?? []),
    ...Object.keys(sourceConfig?.column_dtypes_map ?? {}),
  ]);

  return orderedKeys.map<DataNodeVisualizerFieldOption>((key) => {
    const dtype = getFieldOptionDtype(key, detail);

    return {
      key,
      label: getFieldOptionLabel(key, detail),
      description: getFieldOptionDescription(key, detail),
      dtype,
      isIndex: (sourceConfig?.index_names ?? []).includes(key),
      isNumeric: isNumericDtype(dtype),
      isTime: key === sourceConfig?.time_index_name || isTimeDtype(dtype),
    };
  });
}

function getDefaultXField(
  fieldOptions: DataNodeVisualizerFieldOption[],
  detail?: DataNodeDetail | null,
) {
  const sourceConfig = detail?.sourcetableconfiguration;

  return (
    sourceConfig?.time_index_name ||
    fieldOptions.find((field) => field.isTime)?.key ||
    sourceConfig?.index_names?.[0] ||
    fieldOptions[0]?.key
  );
}

function getDefaultGroupField(
  fieldOptions: DataNodeVisualizerFieldOption[],
  detail: DataNodeDetail | null | undefined,
  xField?: string,
) {
  const indexNames = detail?.sourcetableconfiguration?.index_names ?? [];

  return (
    indexNames.find((field) => field !== xField) ||
    fieldOptions.find((field) => field.isIndex && field.key !== xField)?.key ||
    undefined
  );
}

function getDefaultYField(
  fieldOptions: DataNodeVisualizerFieldOption[],
  xField?: string,
  groupField?: string,
) {
  return (
    fieldOptions.find(
      (field) => field.isNumeric && field.key !== xField && field.key !== groupField,
    )?.key ||
    fieldOptions.find((field) => field.key !== xField && field.key !== groupField)?.key ||
    undefined
  );
}

function getValidFieldKey(
  requestedKey: unknown,
  fieldOptions: DataNodeVisualizerFieldOption[],
) {
  if (typeof requestedKey !== "string" || !requestedKey.trim()) {
    return undefined;
  }

  return fieldOptions.some((field) => field.key === requestedKey) ? requestedKey : undefined;
}

export function resolveDataNodeVisualizerConfig(
  props: MainSequenceDataNodeVisualizerWidgetProps,
  detail?: DataNodeDetail | null,
): ResolvedDataNodeVisualizerConfig {
  const dataNodeId = normalizePositiveInteger(props.dataNodeId);
  const dateRangeMode: DataNodeVisualizerDateRangeMode =
    props.dateRangeMode === "fixed" ? "fixed" : "dashboard";
  const fixedStartMs = normalizeTimestampMs(props.fixedStartMs);
  const fixedEndMs = normalizeTimestampMs(props.fixedEndMs);
  const availableFields = buildDataNodeVisualizerFieldOptions(detail);
  const provider: DataNodeVisualizerProvider = "tradingview";
  const chartType: DataNodeVisualizerChartType =
    props.chartType === "area" || props.chartType === "bar" ? props.chartType : "line";
  const displayMode: DataNodeVisualizerViewMode =
    props.displayMode === "table" ? "table" : "chart";
  const limit = Math.max(1, Math.min(normalizePositiveInteger(props.limit) ?? defaultVisualizerLimit, 14_000));
  const normalizeSeries = props.normalizeSeries === true;
  const normalizeAtMs = normalizePositiveInteger(props.normalizeAtMs);
  const seriesAxisMode: DataNodeVisualizerSeriesAxisMode =
    props.seriesAxisMode === "separate" ? "separate" : "shared";
  const seriesOverrides = normalizeSeriesOverrides(props.seriesOverrides);

  const xField =
    getValidFieldKey(props.xField, availableFields) ||
    getDefaultXField(availableFields, detail);
  const groupField =
    getValidFieldKey(props.groupField, availableFields) ||
    getDefaultGroupField(availableFields, detail, xField);
  const yField =
    getValidFieldKey(props.yField, availableFields) ||
    getDefaultYField(availableFields, xField, groupField);

  return {
    dataNodeId,
    dateRangeMode,
    provider,
    chartType,
    displayMode,
    fixedStartMs,
    fixedEndMs,
    xField,
    yField,
    groupField,
    limit,
    normalizeSeries,
    normalizeAtMs,
    seriesAxisMode,
    seriesOverrides,
    availableFields,
    dataNodeLabel: formatDataNodeLabel(detail ?? (dataNodeId ? { id: dataNodeId, storage_hash: "", identifier: null } : null)),
  };
}

export function normalizeDataNodeVisualizerProps(
  props: MainSequenceDataNodeVisualizerWidgetProps,
  detail?: DataNodeDetail | null,
) {
  const resolved = resolveDataNodeVisualizerConfig(props, detail);

  return {
    ...props,
    dataNodeId: resolved.dataNodeId,
    dateRangeMode: resolved.dateRangeMode,
    provider: resolved.provider,
    chartType: resolved.chartType,
    displayMode: resolved.displayMode,
    fixedStartMs: resolved.fixedStartMs,
    fixedEndMs: resolved.fixedEndMs,
    xField: resolved.xField,
    yField: resolved.yField,
    groupField: resolved.groupField,
    limit: resolved.limit,
    normalizeSeries: resolved.normalizeSeries,
    normalizeAtMs: resolved.normalizeAtMs,
    seriesAxisMode: resolved.seriesAxisMode,
    seriesOverrides: resolved.seriesOverrides,
  } satisfies MainSequenceDataNodeVisualizerWidgetProps;
}

export function resolveDataNodeVisualizerDateRange(
  config: Pick<ResolvedDataNodeVisualizerConfig, "dateRangeMode" | "fixedEndMs" | "fixedStartMs">,
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

export function buildDataNodeVisualizerRequestedColumns(
  config: Pick<ResolvedDataNodeVisualizerConfig, "groupField" | "xField" | "yField">,
) {
  return uniqueStrings([config.xField, config.yField, config.groupField]);
}

export function resolveDataNodeVisualizerNormalizationTimeMs(
  config: Pick<ResolvedDataNodeVisualizerConfig, "normalizeAtMs" | "normalizeSeries">,
  fallbackStartMs?: number | null,
) {
  if (!config.normalizeSeries) {
    return null;
  }

  if (typeof config.normalizeAtMs === "number" && Number.isFinite(config.normalizeAtMs)) {
    return config.normalizeAtMs;
  }

  if (typeof fallbackStartMs === "number" && Number.isFinite(fallbackStartMs)) {
    return Math.trunc(fallbackStartMs);
  }

  return null;
}

export function formatDataNodeVisualizerValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? new Intl.NumberFormat("en-US").format(value)
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function parseDataNodeVisualizerTimeValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value) >= 1_000_000_000_000) {
      return Math.trunc(value);
    }

    if (Math.abs(value) >= 1_000_000_000) {
      return Math.trunc(value * 1000);
    }

    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const numericValue = Number(trimmed);

    if (Number.isFinite(numericValue)) {
      return parseDataNodeVisualizerTimeValue(numericValue);
    }

    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function resolveDataNodeVisualizerPreviewAnchorMs(
  detail?: DataNodeDetail | null,
  lastObservation?: DataNodeRemoteDataRow | null,
) {
  const timeIndexName = detail?.sourcetableconfiguration?.time_index_name ?? undefined;

  if (timeIndexName && lastObservation) {
    const timeIndexValue = parseDataNodeVisualizerTimeValue(lastObservation[timeIndexName]);

    if (timeIndexValue !== null) {
      return timeIndexValue;
    }
  }

  return parseDataNodeVisualizerTimeValue(
    detail?.sourcetableconfiguration?.last_time_index_value ?? null,
  );
}

export function buildDataNodeVisualizerSeries(
  rows: DataNodeRemoteDataRow[],
  config: Pick<ResolvedDataNodeVisualizerConfig, "groupField" | "seriesOverrides" | "xField" | "yField">,
  maxSeries = 8,
): DataNodeVisualizerSeriesResult {
  if (!config.xField || !config.yField) {
    return { series: [], droppedGroups: 0 };
  }

  const groupedPoints = new Map<string, DataNodeVisualizerSeries>();

  rows.forEach((row) => {
    const time = parseDataNodeVisualizerTimeValue(row[config.xField!]);
    const value = parseNumericValue(row[config.yField!]);

    if (time === null || value === null) {
      return;
    }

    const groupLabel = config.groupField
      ? formatDataNodeVisualizerValue(row[config.groupField])
      : config.yField!;

    const groupKey = config.groupField
      ? String(row[config.groupField] ?? "__empty__")
      : config.yField!;
    const current =
      groupedPoints.get(groupKey) ??
      {
        id: groupKey,
        label: groupLabel,
        pointCount: 0,
        points: [],
      };

    current.points.push({ time, value });
    current.pointCount += 1;
    groupedPoints.set(groupKey, current);
  });

  const sortedGroups = [...groupedPoints.values()]
    .map((series) => ({
      ...series,
      points: [...series.points].sort((left, right) => left.time - right.time),
      color: config.seriesOverrides?.[series.id]?.color,
    }))
    .sort((left, right) => right.pointCount - left.pointCount);

  return {
    series: sortedGroups.slice(0, maxSeries),
    droppedGroups: Math.max(sortedGroups.length - maxSeries, 0),
  };
}

export function buildDataNodeVisualizerTableColumns(
  rows: DataNodeRemoteDataRow[],
  config: Pick<ResolvedDataNodeVisualizerConfig, "groupField" | "xField" | "yField">,
) {
  return uniqueStrings([
    ...buildDataNodeVisualizerRequestedColumns(config),
    ...rows.flatMap((row) => Object.keys(row)),
  ]);
}

function isUsableNormalizationBase(value: number) {
  return Number.isFinite(value) && Math.abs(value) > Number.EPSILON;
}

function findNormalizationBasePoint(
  points: Array<{ time: number; value: number }>,
  normalizeAtMs: number,
) {
  const nextPoint = points.find(
    (point) => point.time >= normalizeAtMs && isUsableNormalizationBase(point.value),
  );

  if (nextPoint) {
    return nextPoint;
  }

  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (isUsableNormalizationBase(points[index]!.value)) {
      return points[index]!;
    }
  }

  return null;
}

export function normalizeDataNodeVisualizerSeries(
  series: DataNodeVisualizerSeries[],
  normalizeAtMs: number | null | undefined,
) {
  if (normalizeAtMs === null || normalizeAtMs === undefined || !Number.isFinite(normalizeAtMs)) {
    return series;
  }

  return series.map((entry) => {
    if (entry.points.length === 0) {
      return entry;
    }

    const basePoint = findNormalizationBasePoint(entry.points, normalizeAtMs);

    if (!basePoint) {
      return {
        ...entry,
        points: entry.points.map((point) => ({ ...point, value: 100 })),
      };
    }

    return {
      ...entry,
      points: entry.points.map((point) => ({
        time: point.time,
        value: (point.value / basePoint.value) * 100,
      })),
    };
  });
}
