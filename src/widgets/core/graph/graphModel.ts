import type {
  TabularSourceDetail,
  TabularDataRow,
} from "@/widgets/shared/tabular-widget-source";
import {
  buildGraphDefaultsFromTimeSeriesMeta,
  resolveTabularTimeSeriesMeta,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  buildTabularFieldOptions,
  resolveTabularFieldOptionsFromDataset,
  resolveTabularDateRange,
  type TabularFieldOption,
} from "@/widgets/shared/tabular-widget-source";
import {
  normalizeTabularWidgetSourceProps,
  normalizeTabularWidgetSourceReferenceProps,
  resolveTabularWidgetSourceConfig,
  type TabularWidgetSourceProps,
  type TabularWidgetSourceReferenceProps,
  type ResolvedTabularWidgetSourceConfig,
} from "@/widgets/shared/tabular-widget-source";

export type GraphProvider = "tradingview" | "echarts";
export type GraphChartType = "line" | "area" | "bar";
export type GraphViewMode = "chart" | "table";
export type GraphSeriesAxisMode = "shared" | "separate";
export type GraphTimeAxisMode = "auto" | "date" | "datetime";
export type GraphNormalizationAnchor = number | "series-start" | null;
export type GraphLineStyle =
  | "solid"
  | "dotted"
  | "dashed"
  | "large_dashed"
  | "sparse_dotted";
export type GraphDateRangeMode = ResolvedTabularWidgetSourceConfig["dateRangeMode"];

export interface GraphSeriesOverride {
  color?: string;
  lineStyle?: GraphLineStyle;
}

export type GraphSeriesOverrides = Record<string, GraphSeriesOverride>;

export interface GraphWidgetProps
  extends TabularWidgetSourceProps,
    TabularWidgetSourceReferenceProps {
  chartType?: GraphChartType;
  groupField?: string;
  limit?: number;
  minBarSpacingPx?: number;
  normalizeAtMs?: number;
  normalizeSeries?: boolean;
  provider?: GraphProvider;
  seriesAxisMode?: GraphSeriesAxisMode;
  seriesOverrides?: GraphSeriesOverrides;
  timeAxisMode?: GraphTimeAxisMode;
  xField?: string;
  yField?: string;
}

export type GraphFieldOption = TabularFieldOption;

export interface ResolvedGraphConfig extends ResolvedTabularWidgetSourceConfig {
  chartType: GraphChartType;
  groupField?: string;
  limit: number;
  minBarSpacingPx: number;
  normalizeAtMs?: number;
  normalizeSeries: boolean;
  provider: GraphProvider;
  seriesAxisMode: GraphSeriesAxisMode;
  seriesOverrides?: GraphSeriesOverrides;
  timeAxisMode: GraphTimeAxisMode;
  xField?: string;
  yField?: string;
}

export interface GraphSeries {
  color?: string;
  id: string;
  label: string;
  lineStyle?: GraphLineStyle;
  pointCount: number;
  points: Array<{ time: number; value: number }>;
}

export interface GraphSeriesResult {
  droppedGroups: number;
  filteredGroups: number;
  totalGroups: number;
  series: GraphSeries[];
}

export interface GraphChartSeriesResult {
  affectedSeriesCount: number;
  collapsedPointCount: number;
  series: GraphSeries[];
}

const defaultVisualizerLimit = 14_000;
const defaultVisualizerMinBarSpacingPx = 0.01;
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

function normalizeNonNegativeNumber(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

function normalizeTimeAxisMode(value: unknown): GraphTimeAxisMode {
  return value === "date" || value === "datetime" ? value : "auto";
}

function normalizeProvider(value: unknown): GraphProvider {
  return value === "echarts" ? "echarts" : "tradingview";
}

export function normalizeGraphLineStyle(value: unknown): GraphLineStyle {
  return value === "dotted" ||
    value === "dashed" ||
    value === "large_dashed" ||
    value === "sparse_dotted"
    ? value
    : "solid";
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

    const color = normalizeHexColor((overrideValue as GraphSeriesOverride).color);
    const lineStyle = normalizeGraphLineStyle(
      (overrideValue as GraphSeriesOverride).lineStyle,
    );

    if (!color && lineStyle === "solid") {
      return [];
    }

    return [[seriesId, {
      color,
      lineStyle: lineStyle === "solid" ? undefined : lineStyle,
    }] as const];
  });

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries) satisfies GraphSeriesOverrides;
}

export function buildGraphFieldOptions(detail?: TabularSourceDetail | null) {
  return buildTabularFieldOptions(detail);
}

function getValidFieldKey(
  requestedKey: unknown,
  fieldOptions: GraphFieldOption[],
) {
  if (typeof requestedKey !== "string" || !requestedKey.trim()) {
    return undefined;
  }

  if (fieldOptions.length === 0) {
    return requestedKey.trim();
  }

  return fieldOptions.some((field) => field.key === requestedKey) ? requestedKey : undefined;
}

export function resolveGraphConfig(
  props: GraphWidgetProps,
  detail?: TabularSourceDetail | null,
  fieldOptionsOverride?: GraphFieldOption[],
): ResolvedGraphConfig {
  const normalizedReference = normalizeTabularWidgetSourceReferenceProps(props);
  const sourceConfig = resolveTabularWidgetSourceConfig(props, detail);
  const availableFields =
    fieldOptionsOverride && fieldOptionsOverride.length > 0
      ? fieldOptionsOverride
      : sourceConfig.availableFields;
  const provider = normalizeProvider(props.provider);
  const chartType: GraphChartType =
    props.chartType === "area" || props.chartType === "bar" ? props.chartType : "line";
  const limit = Math.max(1, Math.min(normalizePositiveInteger(props.limit) ?? defaultVisualizerLimit, 14_000));
  const minBarSpacingPx = Math.min(
    Math.max(
      normalizeNonNegativeNumber(props.minBarSpacingPx) ?? defaultVisualizerMinBarSpacingPx,
      0,
    ),
    6,
  );
  const normalizeSeries = props.normalizeSeries === true;
  const normalizeAtMs = normalizePositiveInteger(props.normalizeAtMs);
  const seriesAxisMode: GraphSeriesAxisMode =
    props.seriesAxisMode === "separate" ? "separate" : "shared";
  const seriesOverrides = normalizeSeriesOverrides(props.seriesOverrides);
  const timeAxisMode = normalizeTimeAxisMode(props.timeAxisMode);

  const xField = getValidFieldKey(props.xField, availableFields);
  const groupField = getValidFieldKey(props.groupField, availableFields);
  const yField = getValidFieldKey(props.yField, availableFields);

  return {
    ...sourceConfig,
    sourceMode: "filter_widget",
    sourceWidgetId: normalizedReference.sourceWidgetId,
    provider,
    chartType,
    timeAxisMode,
    xField,
    yField,
    groupField,
    limit,
    minBarSpacingPx,
    normalizeSeries,
    normalizeAtMs,
    seriesAxisMode,
    seriesOverrides,
    availableFields,
  };
}

export function normalizeGraphProps(
  props: GraphWidgetProps,
  detail?: TabularSourceDetail | null,
) {
  const resolved = resolveGraphConfig(props, detail);
  const sourceProps = normalizeTabularWidgetSourceProps(props, detail);
  const sourceReferenceProps = normalizeTabularWidgetSourceReferenceProps(props);

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
    minBarSpacingPx: resolved.minBarSpacingPx,
    normalizeSeries: resolved.normalizeSeries,
    normalizeAtMs: resolved.normalizeAtMs,
    seriesAxisMode: resolved.seriesAxisMode,
    seriesOverrides: resolved.seriesOverrides,
    timeAxisMode: resolved.timeAxisMode,
  } satisfies GraphWidgetProps;
}

export function resolveGraphDateRange(
  config: Pick<ResolvedGraphConfig, "dateRangeMode" | "fixedEndMs" | "fixedStartMs">,
  dashboardStartMs?: number | null,
  dashboardEndMs?: number | null,
) {
  return resolveTabularDateRange(config, dashboardStartMs, dashboardEndMs);
}

export function buildGraphRequestedColumns(
  config: Pick<ResolvedGraphConfig, "groupField" | "xField" | "yField">,
) {
  return uniqueStrings([config.xField, config.yField, config.groupField]);
}

export function resolveGraphNormalizationTimeMs(
  config: Pick<ResolvedGraphConfig, "normalizeAtMs" | "normalizeSeries">,
): GraphNormalizationAnchor {
  if (!config.normalizeSeries) {
    return null;
  }

  if (typeof config.normalizeAtMs === "number" && Number.isFinite(config.normalizeAtMs)) {
    return config.normalizeAtMs;
  }

  return "series-start";
}

export function formatGraphValue(value: unknown) {
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

export function parseGraphTimeValue(value: unknown) {
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
      return parseGraphTimeValue(numericValue);
    }

    const parsed = Date.parse(normalizeDateTimeString(trimmed));
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function isDateOnlyTimeString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function formatGraphUtcDateKey(timestampMs: number) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

export function resolveGraphEffectiveTimeAxisMode(
  config: Pick<ResolvedGraphConfig, "timeAxisMode" | "xField">,
  rows: TabularDataRow[],
): Exclude<GraphTimeAxisMode, "auto"> {
  if (config.timeAxisMode === "date" || config.timeAxisMode === "datetime") {
    return config.timeAxisMode;
  }

  if (!config.xField) {
    return "datetime";
  }

  const sampleValues = rows
    .map((row) => row[config.xField!])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .slice(0, 50);

  if (sampleValues.length === 0) {
    return "datetime";
  }

  const hasOnlyDateStrings = sampleValues.every(
    (value) => typeof value === "string" && isDateOnlyTimeString(value),
  );

  return hasOnlyDateStrings ? "date" : "datetime";
}

function fieldHasParsableValue(
  rows: TabularDataRow[],
  key: string,
  parser: (value: unknown) => number | null,
) {
  return rows.some((row) => parser(row[key]) !== null);
}

export function buildGraphFieldOptionsFromRuntime(
  runtimeState?: {
    columns?: string[];
    fields?: readonly TabularFieldOption[];
    rows?: readonly TabularDataRow[];
  } | null,
) {
  return resolveTabularFieldOptionsFromDataset({
    columns: runtimeState?.columns,
    fields: runtimeState?.fields,
    rows: runtimeState?.rows,
  });
}

export function resolveGraphDatasetFrame(
  sourceFrame?: TabularFrameSourceV1 | null,
): TabularFrameSourceV1 | null {
  const timeSeries = resolveTabularTimeSeriesMeta(sourceFrame);

  if (
    !sourceFrame ||
    !timeSeries ||
    timeSeries.shape !== "wide" ||
    !timeSeries.valueFields?.length
  ) {
    return sourceFrame ?? null;
  }

  const rows = timeSeries.valueFields.flatMap((fieldName) =>
    sourceFrame.rows.map((row) => ({
      [timeSeries.timeField]: row[timeSeries.timeField] ?? null,
      series: fieldName,
      value: row[fieldName] ?? null,
      sourceField: fieldName,
    })),
  );

  return {
    ...sourceFrame,
    columns: [timeSeries.timeField, "series", "value", "sourceField"],
    rows,
    fields: [
      ...(sourceFrame.fields?.filter((field) => field.key === timeSeries.timeField) ?? [{
        key: timeSeries.timeField,
        label: timeSeries.timeField,
        type: "datetime" as const,
        provenance: "derived" as const,
      }]),
      {
        key: "series",
        label: "Series",
        type: "string",
        nullable: false,
        nativeType: "string",
        provenance: "derived",
        reason: "Derived from wide time-series value fields for graph rendering.",
      },
      {
        key: "value",
        label: "Value",
        type: "number",
        nullable: true,
        nativeType: "number",
        provenance: "derived",
        reason: "Derived from wide time-series value fields for graph rendering.",
        derivedFrom: timeSeries.valueFields,
      },
      {
        key: "sourceField",
        label: "Source field",
        type: "string",
        nullable: false,
        nativeType: "string",
        provenance: "derived",
        reason: "Identifies which original wide value field produced the graph row.",
      },
    ],
    meta: {
      ...(sourceFrame.meta ?? {}),
      timeSeries: {
        shape: "long",
        timeField: timeSeries.timeField,
        timeUnit: timeSeries.timeUnit,
        timezone: timeSeries.timezone,
        sorted: timeSeries.sorted,
        valueField: "value",
        seriesField: "series",
        duplicatePolicy: timeSeries.duplicatePolicy,
        gapPolicy: timeSeries.gapPolicy,
      },
    },
    source: {
      kind: sourceFrame.source?.kind ?? "tabular-frame",
      id: sourceFrame.source?.id,
      label: sourceFrame.source?.label,
      updatedAtMs: sourceFrame.source?.updatedAtMs,
      context: {
        ...(sourceFrame.source?.context ?? {}),
        graphDefaults: buildGraphDefaultsFromTimeSeriesMeta({
          shape: "long",
          timeField: timeSeries.timeField,
          timeUnit: timeSeries.timeUnit,
          timezone: timeSeries.timezone,
          sorted: timeSeries.sorted,
          valueField: "value",
          seriesField: "series",
          duplicatePolicy: timeSeries.duplicatePolicy,
          gapPolicy: timeSeries.gapPolicy,
        }),
      },
    },
  };
}

export function resolveGraphSourceFieldDefaults(
  sourceFrame?: TabularFrameSourceV1 | null,
) {
  const timeSeriesDefaults = buildGraphDefaultsFromTimeSeriesMeta(
    resolveTabularTimeSeriesMeta(resolveGraphDatasetFrame(sourceFrame)),
  );

  const defaults = sourceFrame?.source?.context?.graphDefaults;

  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    return timeSeriesDefaults;
  }

  const record = defaults as Record<string, unknown>;

  return {
    xField: typeof record.xField === "string" && record.xField.trim()
      ? record.xField.trim()
      : timeSeriesDefaults.xField,
    yField: typeof record.yField === "string" && record.yField.trim()
      ? record.yField.trim()
      : timeSeriesDefaults.yField,
    groupField: typeof record.groupField === "string" && record.groupField.trim()
      ? record.groupField.trim()
      : timeSeriesDefaults.groupField,
  };
}

export function hasGraphDuplicateTimes(
  rows: TabularDataRow[],
  config: Pick<ResolvedGraphConfig, "groupField" | "xField" | "yField">,
) {
  if (!config.xField || !config.yField) {
    return false;
  }

  const seenBySeries = new Map<string, Set<number>>();

  for (const row of rows) {
    const time = parseGraphTimeValue(row[config.xField]);
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

export function resolveGraphPreviewAnchorMs(
  detail?: TabularSourceDetail | null,
  lastObservation?: TabularDataRow | null,
) {
  const timeIndexName = detail?.sourcetableconfiguration?.time_index_name ?? undefined;

  if (timeIndexName && lastObservation) {
    const timeIndexValue = parseGraphTimeValue(lastObservation[timeIndexName]);

    if (timeIndexValue !== null) {
      return timeIndexValue;
    }
  }

  return parseGraphTimeValue(
    detail?.sourcetableconfiguration?.last_time_index_value ?? null,
  );
}

export function buildGraphSeries(
  rows: TabularDataRow[],
  config: Pick<
    ResolvedGraphConfig,
    "groupField" | "seriesOverrides" | "xField" | "yField"
  >,
  maxSeries = 8,
): GraphSeriesResult {
  if (!config.xField || !config.yField) {
    return { series: [], droppedGroups: 0, filteredGroups: 0, totalGroups: 0 };
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
      lineStyle?: GraphLineStyle;
      pointMap: Map<number, number>;
    }
  >();

  rows.forEach((row) => {
    const time = parseGraphTimeValue(row[xField]);
    const value = parseNumericValue(row[yField]);

    if (time === null || value === null) {
      return;
    }

    const groupLabel = groupField
      ? formatGraphValue(row[groupField])
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
        lineStyle: config.seriesOverrides?.[groupKey]?.lineStyle,
      };

    current.pointMap.set(time, value);
    groupedPoints.set(groupKey, current);
  });

  const sortedGroups = [...groupedPoints.values()]
    .map((series) => ({
      id: series.id,
      label: series.label,
      color: series.color,
      lineStyle: series.lineStyle,
      points: [...series.pointMap.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([time, value]) => ({ time, value })),
      pointCount: series.pointMap.size,
    }))
    .sort((left, right) => right.pointCount - left.pointCount);
  const totalGroups = groupField
    ? uniqueStrings(rows.map((row) => String(row[groupField] ?? "__empty__"))).length
    : sortedGroups.length;

  return {
    series: sortedGroups.slice(0, maxSeries),
    droppedGroups: Math.max(sortedGroups.length - maxSeries, 0),
    filteredGroups: 0,
    totalGroups,
  };
}

export function buildGraphChartSeries(
  series: GraphSeries[],
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto"> = "datetime",
): GraphChartSeriesResult {
  let affectedSeriesCount = 0;
  let collapsedPointCount = 0;

  const normalizedSeries = series.map((entry) => {
    const pointsByBucket = new Map<string, { bucketTime: number; time: number; value: number }>();
    const sortedPoints = [...entry.points].sort((left, right) => left.time - right.time);

    sortedPoints.forEach((point) => {
      const bucketKey =
        timeAxisMode === "date"
          ? formatGraphUtcDateKey(point.time)
          : String(Math.floor(point.time / 1000));
      const bucketTime =
        timeAxisMode === "date"
          ? Date.parse(bucketKey)
          : Math.floor(point.time / 1000) * 1000;

      if (pointsByBucket.has(bucketKey)) {
        collapsedPointCount += 1;
      }

      pointsByBucket.set(bucketKey, {
        bucketTime,
        time: bucketTime,
        value: point.value,
      });
    });

    const points = [...pointsByBucket.values()]
      .sort((left, right) => left.bucketTime - right.bucketTime)
      .map(({ time, value }) => ({ time, value }));

    if (points.length !== entry.points.length) {
      affectedSeriesCount += 1;
    }

    return {
      ...entry,
      pointCount: points.length,
      points,
    };
  });

  return {
    series: normalizedSeries,
    affectedSeriesCount,
    collapsedPointCount,
  };
}

export function buildGraphTableColumns(
  rows: TabularDataRow[],
  config: Pick<ResolvedGraphConfig, "groupField" | "xField" | "yField">,
) {
  return uniqueStrings([
    ...buildGraphRequestedColumns(config),
    ...rows.flatMap((row) => Object.keys(row)),
  ]);
}

function isUsableNormalizationBase(value: number) {
  return Number.isFinite(value) && Math.abs(value) > Number.EPSILON;
}

function findNormalizationBasePoint(
  points: Array<{ time: number; value: number }>,
  normalizationAnchor: Exclude<GraphNormalizationAnchor, null>,
) {
  if (normalizationAnchor === "series-start") {
    return points.find((point) => isUsableNormalizationBase(point.value)) ?? null;
  }

  const nextPoint = points.find(
    (point) => point.time >= normalizationAnchor && isUsableNormalizationBase(point.value),
  );

  if (nextPoint) {
    return nextPoint;
  }

  return points.find((point) => isUsableNormalizationBase(point.value)) ?? null;
}

export function normalizeGraphSeries(
  series: GraphSeries[],
  normalizationAnchor: GraphNormalizationAnchor | undefined,
) {
  if (
    normalizationAnchor === null ||
    normalizationAnchor === undefined ||
    (normalizationAnchor !== "series-start" && !Number.isFinite(normalizationAnchor))
  ) {
    return series;
  }

  return series.map((entry) => {
    if (entry.points.length === 0) {
      return entry;
    }

    const basePoint = findNormalizationBasePoint(entry.points, normalizationAnchor);

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
