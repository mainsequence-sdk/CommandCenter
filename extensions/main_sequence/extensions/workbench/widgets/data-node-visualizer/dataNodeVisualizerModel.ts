import type {
  DataNodeDetail,
  DataNodeRemoteDataRow,
} from "../../../../common/api";
import {
  buildDataNodeFieldOptions,
  buildDataNodeFieldOptionsFromRows,
  resolveDataNodeDateRange,
  type DataNodeFieldOption,
} from "../data-node-shared/dataNodeShared";
import {
  normalizeDataNodeWidgetSourceProps,
  normalizeDataNodeWidgetSourceReferenceProps,
  resolveDataNodeWidgetSourceConfig,
  type DataNodeWidgetSourceProps,
  type DataNodeWidgetSourceReferenceProps,
  type ResolvedDataNodeWidgetSourceConfig,
} from "../data-node-shared/dataNodeWidgetSource";

export type DataNodeVisualizerProvider = "tradingview";
export type DataNodeVisualizerChartType = "line" | "area" | "bar";
export type DataNodeVisualizerViewMode = "chart" | "table";
export type DataNodeVisualizerSeriesAxisMode = "shared" | "separate";
export type DataNodeVisualizerDateRangeMode = ResolvedDataNodeWidgetSourceConfig["dateRangeMode"];

export interface DataNodeVisualizerSeriesOverride {
  color?: string;
}

export type DataNodeVisualizerSeriesOverrides = Record<string, DataNodeVisualizerSeriesOverride>;

export interface MainSequenceDataNodeVisualizerWidgetProps
  extends DataNodeWidgetSourceProps,
    DataNodeWidgetSourceReferenceProps {
  chartType?: DataNodeVisualizerChartType;
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

export type DataNodeVisualizerFieldOption = DataNodeFieldOption;

export interface ResolvedDataNodeVisualizerConfig extends ResolvedDataNodeWidgetSourceConfig {
  chartType: DataNodeVisualizerChartType;
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

export function buildDataNodeVisualizerFieldOptions(detail?: DataNodeDetail | null) {
  return buildDataNodeFieldOptions(detail);
}

function getValidFieldKey(
  requestedKey: unknown,
  fieldOptions: DataNodeVisualizerFieldOption[],
) {
  if (typeof requestedKey !== "string" || !requestedKey.trim()) {
    return undefined;
  }

  if (fieldOptions.length === 0) {
    return requestedKey.trim();
  }

  return fieldOptions.some((field) => field.key === requestedKey) ? requestedKey : undefined;
}

export function resolveDataNodeVisualizerConfig(
  props: MainSequenceDataNodeVisualizerWidgetProps,
  detail?: DataNodeDetail | null,
  fieldOptionsOverride?: DataNodeVisualizerFieldOption[],
): ResolvedDataNodeVisualizerConfig {
  const normalizedReference = normalizeDataNodeWidgetSourceReferenceProps(props);
  const sourceConfig = resolveDataNodeWidgetSourceConfig(props, detail);
  const availableFields =
    fieldOptionsOverride && fieldOptionsOverride.length > 0
      ? fieldOptionsOverride
      : sourceConfig.availableFields;
  const provider: DataNodeVisualizerProvider = "tradingview";
  const chartType: DataNodeVisualizerChartType =
    props.chartType === "area" || props.chartType === "bar" ? props.chartType : "line";
  const limit = Math.max(1, Math.min(normalizePositiveInteger(props.limit) ?? defaultVisualizerLimit, 14_000));
  const normalizeSeries = props.normalizeSeries === true;
  const normalizeAtMs = normalizePositiveInteger(props.normalizeAtMs);
  const seriesAxisMode: DataNodeVisualizerSeriesAxisMode =
    props.seriesAxisMode === "separate" ? "separate" : "shared";
  const seriesOverrides = normalizeSeriesOverrides(props.seriesOverrides);

  const xField = getValidFieldKey(props.xField, availableFields);
  const groupField = getValidFieldKey(props.groupField, availableFields);
  const yField = getValidFieldKey(props.yField, availableFields);

  return {
    ...sourceConfig,
    sourceMode: "filter_widget",
    sourceWidgetId: normalizedReference.sourceWidgetId,
    provider,
    chartType,
    xField,
    yField,
    groupField,
    limit,
    normalizeSeries,
    normalizeAtMs,
    seriesAxisMode,
    seriesOverrides,
    availableFields,
  };
}

export function normalizeDataNodeVisualizerProps(
  props: MainSequenceDataNodeVisualizerWidgetProps,
  detail?: DataNodeDetail | null,
) {
  const resolved = resolveDataNodeVisualizerConfig(props, detail);
  const sourceProps = normalizeDataNodeWidgetSourceProps(props, detail);
  const sourceReferenceProps = normalizeDataNodeWidgetSourceReferenceProps(props);

  return {
    ...sourceProps,
    sourceMode: "filter_widget",
    sourceWidgetId: sourceReferenceProps.sourceWidgetId,
    provider: resolved.provider,
    chartType: resolved.chartType,
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

export function buildDataNodeVisualizerFieldOptionsFromRuntime(
  runtimeState?: {
    columns?: string[];
    rows?: readonly DataNodeRemoteDataRow[];
  } | null,
) {
  return buildDataNodeFieldOptionsFromRows({
    columns: runtimeState?.columns,
    rows: runtimeState?.rows,
  });
}

export function hasDataNodeVisualizerDuplicateTimes(
  rows: DataNodeRemoteDataRow[],
  config: Pick<ResolvedDataNodeVisualizerConfig, "groupField" | "xField" | "yField">,
) {
  if (!config.xField || !config.yField) {
    return false;
  }

  const seenBySeries = new Map<string, Set<number>>();

  for (const row of rows) {
    const time = parseDataNodeVisualizerTimeValue(row[config.xField]);
    const value = parseNumericValue(row[config.yField]);

    if (time === null || value === null) {
      continue;
    }

    const seriesKey = config.groupField
      ? String(row[config.groupField] ?? "__empty__")
      : "__default__";
    const seenTimes = seenBySeries.get(seriesKey) ?? new Set<number>();

    if (seenTimes.has(time)) {
      return true;
    }

    seenTimes.add(time);
    seenBySeries.set(seriesKey, seenTimes);
  }

  return false;
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
    "groupField" | "seriesOverrides" | "xField" | "yField"
  >,
  maxSeries = 8,
): DataNodeVisualizerSeriesResult {
  if (!config.xField || !config.yField) {
    return { series: [], droppedGroups: 0 };
  }

  const xField = config.xField;
  const yField = config.yField;
  const groupField = config.groupField;
  const groupedPoints = new Map<
    string,
    {
      color?: string;
      id: string;
      label: string;
      pointMap: Map<number, number>;
    }
  >();

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
    const current =
      groupedPoints.get(groupKey) ??
      {
        id: groupKey,
        label: groupLabel,
        pointMap: new Map<number, number>(),
        color: config.seriesOverrides?.[groupKey]?.color,
      };

    current.pointMap.set(time, value);
    groupedPoints.set(groupKey, current);
  });

  const sortedGroups = [...groupedPoints.values()]
    .map((series) => ({
      id: series.id,
      label: series.label,
      color: series.color,
      points: [...series.pointMap.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([time, value]) => ({ time, value })),
      pointCount: series.pointMap.size,
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
