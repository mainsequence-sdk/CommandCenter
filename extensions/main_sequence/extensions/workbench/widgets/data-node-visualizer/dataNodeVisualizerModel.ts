import type {
  DataNodeDetail,
  DataNodeRemoteDataRow,
} from "../../../../common/api";
import {
  buildDataNodeFieldOptions,
  formatDataNodeLabel,
  resolveDataNodeDateRange,
  type DataNodeDateRangeMode,
  type DataNodeFieldOption,
} from "../data-node-shared/dataNodeShared";

export type DataNodeVisualizerProvider = "tradingview";
export type DataNodeVisualizerChartType = "line" | "area" | "bar";
export type DataNodeVisualizerViewMode = "chart" | "table";
export type DataNodeVisualizerSeriesAxisMode = "shared" | "separate";
export type DataNodeVisualizerDateRangeMode = DataNodeDateRangeMode;

export interface DataNodeVisualizerSeriesOverride {
  color?: string;
}

export type DataNodeVisualizerSeriesOverrides = Record<string, DataNodeVisualizerSeriesOverride>;

export interface MainSequenceDataNodeVisualizerWidgetProps extends Record<string, unknown> {
  chartType?: DataNodeVisualizerChartType;
  dataNodeId?: number;
  dateRangeMode?: DataNodeVisualizerDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  groupField?: string;
  limit?: number;
  normalizeAtMs?: number;
  normalizeSeries?: boolean;
  provider?: DataNodeVisualizerProvider;
  seriesAxisMode?: DataNodeVisualizerSeriesAxisMode;
  seriesOverrides?: DataNodeVisualizerSeriesOverrides;
  uniqueIdentifierList?: string[];
  xField?: string;
  yField?: string;
}

export type DataNodeVisualizerFieldOption = DataNodeFieldOption;

export interface ResolvedDataNodeVisualizerConfig {
  availableFields: DataNodeVisualizerFieldOption[];
  chartType: DataNodeVisualizerChartType;
  dataNodeId?: number;
  dataNodeLabel: string;
  dateRangeMode: DataNodeVisualizerDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  groupField?: string;
  limit: number;
  normalizeAtMs?: number;
  normalizeSeries: boolean;
  provider: DataNodeVisualizerProvider;
  seriesAxisMode: DataNodeVisualizerSeriesAxisMode;
  seriesOverrides?: DataNodeVisualizerSeriesOverrides;
  supportsUniqueIdentifierList: boolean;
  uniqueIdentifierList?: string[];
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

function normalizeUniqueIdentifierList(value: unknown) {
  if (typeof value === "string") {
    return uniqueStrings(value.split(/[\n,]+/).map((item) => item.trim()));
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedValues = uniqueStrings(
    value.map((item) => (typeof item === "string" ? item.trim() : "")),
  );

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

export function buildDataNodeVisualizerFieldOptions(detail?: DataNodeDetail | null) {
  return buildDataNodeFieldOptions(detail);
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

function supportsUniqueIdentifierList(detail?: DataNodeDetail | null) {
  return detail?.sourcetableconfiguration?.index_names?.[1] === "unique_identifier";
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
  const limit = Math.max(1, Math.min(normalizePositiveInteger(props.limit) ?? defaultVisualizerLimit, 14_000));
  const normalizeSeries = props.normalizeSeries === true;
  const normalizeAtMs = normalizePositiveInteger(props.normalizeAtMs);
  const seriesAxisMode: DataNodeVisualizerSeriesAxisMode =
    props.seriesAxisMode === "separate" ? "separate" : "shared";
  const seriesOverrides = normalizeSeriesOverrides(props.seriesOverrides);
  const supportsIdentifierList = supportsUniqueIdentifierList(detail);
  const uniqueIdentifierList = supportsIdentifierList
    ? normalizeUniqueIdentifierList(props.uniqueIdentifierList)
    : undefined;

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
    supportsUniqueIdentifierList: supportsIdentifierList,
    uniqueIdentifierList,
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
    uniqueIdentifierList: resolved.uniqueIdentifierList,
  } satisfies MainSequenceDataNodeVisualizerWidgetProps;
}

export function resolveDataNodeVisualizerDateRange(
  config: Pick<ResolvedDataNodeVisualizerConfig, "dateRangeMode" | "fixedEndMs" | "fixedStartMs">,
  dashboardStartMs?: number | null,
  dashboardEndMs?: number | null,
) {
  return resolveDataNodeDateRange(config, dashboardStartMs, dashboardEndMs);
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
    const parsed = Number(value.trim().replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDateTimeString(value: string) {
  let normalized = value.trim();

  if (!normalized) {
    return normalized;
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized)) {
    normalized = normalized.replace(/\s+/, "T");
  }

  normalized = normalized.replace(/(\.\d{3})\d+/, "$1");
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  normalized = normalized.replace(/\s+UTC$/i, "Z");

  return normalized;
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

    const parsed = Date.parse(normalizeDateTimeString(trimmed));
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function fieldHasParsableValue(
  rows: DataNodeRemoteDataRow[],
  key: string,
  parser: (value: unknown) => number | null,
) {
  return rows.some((row) => parser(row[key]) !== null);
}

export function resolveDataNodeVisualizerRenderableFields(
  rows: DataNodeRemoteDataRow[],
  config: Pick<ResolvedDataNodeVisualizerConfig, "availableFields" | "groupField" | "xField" | "yField">,
) {
  if (rows.length === 0) {
    return {
      xField: config.xField,
      yField: config.yField,
      groupField: config.groupField,
    };
  }

  const rowKeys = uniqueStrings(rows.flatMap((row) => Object.keys(row)));
  const xField =
    uniqueStrings([
      config.xField,
      ...config.availableFields.filter((field) => field.isTime).map((field) => field.key),
      ...rowKeys,
    ]).find((key) => fieldHasParsableValue(rows, key, parseDataNodeVisualizerTimeValue)) ??
    config.xField;
  const yField =
    uniqueStrings([
      config.yField,
      ...config.availableFields.filter((field) => field.isNumeric).map((field) => field.key),
      ...rowKeys,
    ])
      .filter((key) => key !== xField && key !== config.groupField)
      .find((key) => fieldHasParsableValue(rows, key, parseNumericValue)) ?? config.yField;
  const groupField =
    config.groupField && config.groupField !== xField && config.groupField !== yField
      ? config.groupField
      : undefined;

  return {
    xField,
    yField,
    groupField,
  };
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
  config: Pick<
    ResolvedDataNodeVisualizerConfig,
    "availableFields" | "groupField" | "seriesOverrides" | "xField" | "yField"
  >,
  maxSeries = 8,
): DataNodeVisualizerSeriesResult {
  const renderableFields = resolveDataNodeVisualizerRenderableFields(rows, config);

  if (!renderableFields.xField || !renderableFields.yField) {
    return { series: [], droppedGroups: 0 };
  }

  const xField = renderableFields.xField;
  const yField = renderableFields.yField;
  const groupField = renderableFields.groupField;
  const groupedPoints = new Map<string, DataNodeVisualizerSeries>();

  rows.forEach((row) => {
    const time = parseDataNodeVisualizerTimeValue(row[xField]);
    const value = parseNumericValue(row[yField]);

    if (time === null || value === null) {
      return;
    }

    const groupLabel = groupField
      ? formatDataNodeVisualizerValue(row[groupField])
      : yField;

    const groupKey = groupField
      ? String(row[groupField] ?? "__empty__")
      : yField;
    const current: DataNodeVisualizerSeries =
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
