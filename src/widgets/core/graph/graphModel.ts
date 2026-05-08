import type {
  TabularSourceDetail,
  TabularDataRow,
} from "@/widgets/shared/tabular-widget-source";
import type { WidgetInstancePresentation } from "@/widgets/types";
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
import {
  normalizeConnectionQueryProps,
  type ConnectionQueryWidgetProps,
} from "@/widgets/core/connection-query/connectionQueryModel";
import type { ConnectionStreamQueryWidgetProps } from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";

export type GraphProvider = "tradingview" | "echarts";
export type GraphChartType = "line" | "area" | "bar" | "markers";
export type GraphViewMode = "chart" | "table";
export type GraphSeriesAxisMode = "shared" | "separate";
export type GraphTimeAxisMode = "auto" | "date" | "datetime";
export type GraphNormalizationAnchor = number | "series-start" | null;
export type GraphAuthoringSourceMode = "bound" | "connection" | "connection-stream";
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
  graphSourceMode?: GraphAuthoringSourceMode;
  embeddedConnectionQuery?: ConnectionQueryWidgetProps | ConnectionStreamQueryWidgetProps;
  embeddedConnectionPresentation?: WidgetInstancePresentation;
  chartType?: GraphChartType;
  groupField?: string;
  limit?: number;
  maxSeries?: number;
  markerSizePx?: number;
  minBarSpacingPx?: number;
  normalizeAtMs?: number;
  normalizeSeries?: boolean;
  provider?: GraphProvider;
  stackSeries?: boolean;
  seriesAxisMode?: GraphSeriesAxisMode;
  seriesOverrides?: GraphSeriesOverrides;
  timeAxisMode?: GraphTimeAxisMode;
  xField?: string;
  yAxisDecimals?: number;
  yAxisScaleZeros?: number;
  yAxisSuffix?: string;
  yField?: string;
}

export type GraphFieldOption = TabularFieldOption;

export interface ResolvedGraphConfig extends ResolvedTabularWidgetSourceConfig {
  chartType: GraphChartType;
  groupField?: string;
  limit: number;
  maxSeries: number;
  markerSizePx: number;
  minBarSpacingPx: number;
  normalizeAtMs?: number;
  normalizeSeries: boolean;
  provider: GraphProvider;
  stackSeries: boolean;
  seriesAxisMode: GraphSeriesAxisMode;
  seriesOverrides?: GraphSeriesOverrides;
  timeAxisMode: GraphTimeAxisMode;
  xField?: string;
  yAxisDecimals?: number;
  yAxisScaleZeros: number;
  yAxisSuffix?: string;
  yField?: string;
}

export interface GraphSeries {
  color?: string;
  id: string;
  label: string;
  lineStyle?: GraphLineStyle;
  pointCount: number;
  sourcePointCount: number;
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

export interface IncrementalGraphSeriesUpdateResult {
  deltaSeries: GraphSeries[];
  result: GraphSeriesResult;
  updateMode: "snapshot" | "delta";
}

const defaultVisualizerLimit = 14_000;
const defaultVisualizerMaxSeries = 8;
const defaultVisualizerMarkerSizePx = 8;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function normalizeMarkerSizePx(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function normalizeOptionalInteger(
  value: unknown,
  options: { min: number; max: number },
) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(options.max, Math.max(options.min, Math.trunc(parsed)));
}

function normalizeTimeAxisMode(value: unknown): GraphTimeAxisMode {
  return value === "date" || value === "datetime" ? value : "auto";
}

export function normalizeGraphAuthoringSourceMode(value: unknown): GraphAuthoringSourceMode {
  return value === "connection" || value === "connection-stream" ? value : "bound";
}

function normalizeProvider(value: unknown): GraphProvider {
  return value === "echarts" ? "echarts" : "tradingview";
}

function normalizeGraphChartType(value: unknown): GraphChartType {
  return value === "area" || value === "bar" || value === "markers" ? value : "line";
}

function normalizeStackSeries(value: unknown) {
  return value === true;
}

function normalizeYAxisDecimals(value: unknown) {
  return normalizeOptionalInteger(value, { min: 0, max: 12 });
}

function normalizeYAxisScaleZeros(value: unknown) {
  return normalizeOptionalInteger(value, { min: 0, max: 18 }) ?? 0;
}

function normalizeYAxisSuffix(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
  const chartType = normalizeGraphChartType(props.chartType);
  const limit = Math.max(1, Math.min(normalizePositiveInteger(props.limit) ?? defaultVisualizerLimit, 14_000));
  const maxSeries = Math.max(
    1,
    Math.min(
      normalizePositiveInteger(props.maxSeries) ?? defaultVisualizerMaxSeries,
      200,
    ),
  );
  const markerSizePx = Math.min(
    Math.max(
      normalizeMarkerSizePx(props.markerSizePx) ?? defaultVisualizerMarkerSizePx,
      2,
    ),
    24,
  );
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
  const stackSeries = normalizeStackSeries(props.stackSeries);
  const seriesOverrides = normalizeSeriesOverrides(props.seriesOverrides);
  const timeAxisMode = normalizeTimeAxisMode(props.timeAxisMode);
  const yAxisDecimals = normalizeYAxisDecimals(props.yAxisDecimals);
  const yAxisScaleZeros = normalizeYAxisScaleZeros(props.yAxisScaleZeros);
  const yAxisSuffix = normalizeYAxisSuffix(props.yAxisSuffix);

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
    maxSeries,
    markerSizePx,
    minBarSpacingPx,
    normalizeSeries,
    normalizeAtMs,
    stackSeries,
    seriesAxisMode,
    seriesOverrides,
    availableFields,
    yAxisDecimals,
    yAxisScaleZeros,
    yAxisSuffix,
  };
}

export function resolveGraphEmbeddedConnectionQueryProps(
  props: GraphWidgetProps,
): ConnectionQueryWidgetProps {
  return normalizeConnectionQueryProps(
    isPlainRecord(props.embeddedConnectionQuery)
      ? (props.embeddedConnectionQuery as ConnectionQueryWidgetProps)
      : {},
  );
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
    graphSourceMode: normalizeGraphAuthoringSourceMode(props.graphSourceMode),
    embeddedConnectionQuery: resolveGraphEmbeddedConnectionQueryProps(props),
    embeddedConnectionPresentation: isPlainRecord(props.embeddedConnectionPresentation)
      ? (props.embeddedConnectionPresentation as WidgetInstancePresentation)
      : undefined,
    provider: resolved.provider,
    chartType: resolved.chartType,
    xField: resolved.xField,
    yField: resolved.yField,
    groupField: resolved.groupField,
    limit: resolved.limit,
    maxSeries: resolved.maxSeries,
    markerSizePx: resolved.markerSizePx,
    minBarSpacingPx: resolved.minBarSpacingPx,
    normalizeSeries: resolved.normalizeSeries,
    normalizeAtMs: resolved.normalizeAtMs,
    stackSeries: resolved.stackSeries,
    seriesAxisMode: resolved.seriesAxisMode,
    seriesOverrides: resolved.seriesOverrides,
    timeAxisMode: resolved.timeAxisMode,
    yAxisDecimals: resolved.yAxisDecimals,
    yAxisScaleZeros: resolved.yAxisScaleZeros,
    yAxisSuffix: resolved.yAxisSuffix,
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

export function resolveGraphStackingEnabled(
  config: Pick<ResolvedGraphConfig, "chartType" | "seriesAxisMode" | "stackSeries">,
) {
  return config.stackSeries && config.seriesAxisMode === "shared" && config.chartType !== "markers";
}

export function formatGraphAxisValue(
  value: string | number,
  config: Pick<ResolvedGraphConfig, "yAxisDecimals" | "yAxisScaleZeros" | "yAxisSuffix">,
) {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  const scaledValue = numericValue / 10 ** config.yAxisScaleZeros;
  const maximumFractionDigits =
    config.yAxisDecimals ??
    (Math.abs(scaledValue) < 1 ? 6 : 4);
  const normalizedScaledValue =
    Math.abs(scaledValue) < 10 ** (-(maximumFractionDigits + 1))
      ? 0
      : scaledValue;

  const formattedValue = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: config.yAxisDecimals ?? 0,
    maximumFractionDigits,
  }).format(normalizedScaledValue);

  return `${formattedValue}${config.yAxisSuffix ?? ""}`;
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
    "groupField" | "limit" | "maxSeries" | "seriesOverrides" | "xField" | "yField"
  >,
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

  const maxPointsPerSeries = Math.max(1, config.limit);
  const sortedGroups = [...groupedPoints.values()]
    .map((series) => {
      const sourcePoints = [...series.pointMap.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([time, value]) => ({ time, value }));
      const points = sourcePoints.length > maxPointsPerSeries
        ? sourcePoints.slice(-maxPointsPerSeries)
        : sourcePoints;

      return {
        id: series.id,
        label: series.label,
        color: series.color,
        lineStyle: series.lineStyle,
        points,
        pointCount: points.length,
        sourcePointCount: sourcePoints.length,
      };
    })
    .sort((left, right) => right.sourcePointCount - left.sourcePointCount);
  const totalGroups = groupField
    ? uniqueStrings(rows.map((row) => String(row[groupField] ?? "__empty__"))).length
    : sortedGroups.length;
  const maxSeries = Math.max(1, config.maxSeries);

  return {
    series: sortedGroups.slice(0, maxSeries),
    droppedGroups: Math.max(sortedGroups.length - maxSeries, 0),
    filteredGroups: 0,
    totalGroups,
  };
}

function serializeSeriesOverrides(
  overrides: Pick<ResolvedGraphConfig, "seriesOverrides">["seriesOverrides"],
) {
  if (!overrides) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(overrides)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([seriesId, override]) => [
        seriesId,
        {
          color: override.color ?? null,
          lineStyle: override.lineStyle ?? null,
        },
      ]),
  );
}

export function buildGraphSeriesConfigKey(
  config: Pick<
    ResolvedGraphConfig,
    "groupField" | "limit" | "maxSeries" | "seriesOverrides" | "xField" | "yField"
  >,
) {
  return JSON.stringify({
    groupField: config.groupField ?? null,
    limit: config.limit,
    maxSeries: config.maxSeries,
    seriesOverrides: serializeSeriesOverrides(config.seriesOverrides),
    xField: config.xField ?? null,
    yField: config.yField ?? null,
  });
}

function sortGraphSeriesEntries(series: GraphSeries[]) {
  return [...series].sort((left, right) => {
    if (right.sourcePointCount !== left.sourcePointCount) {
      return right.sourcePointCount - left.sourcePointCount;
    }

    return left.label.localeCompare(right.label);
  });
}

function buildGraphSeriesResultFromSeries(
  series: GraphSeries[],
  maxSeries: number,
): GraphSeriesResult {
  const sortedSeries = sortGraphSeriesEntries(series);

  return {
    series: sortedSeries.slice(0, maxSeries),
    droppedGroups: Math.max(sortedSeries.length - maxSeries, 0),
    filteredGroups: 0,
    totalGroups: sortedSeries.length,
  };
}

function mergeGraphSeriesPoints(
  existingPoints: Array<{ time: number; value: number }>,
  deltaPoints: Array<{ time: number; value: number }>,
  limit: number,
) {
  const points = [...existingPoints];
  let requiresSnapshot = false;

  deltaPoints.forEach((point) => {
    const existingIndex = points.findIndex((entry) => entry.time === point.time);

    if (existingIndex >= 0) {
      if (existingIndex !== points.length - 1) {
        requiresSnapshot = true;
      }

      points[existingIndex] = point;
      return;
    }

    const lastTime = points[points.length - 1]?.time ?? Number.NEGATIVE_INFINITY;

    if (point.time < lastTime) {
      requiresSnapshot = true;
      const insertIndex = points.findIndex((entry) => entry.time > point.time);

      if (insertIndex < 0) {
        points.push(point);
      } else {
        points.splice(insertIndex, 0, point);
      }

      return;
    }

    points.push(point);
  });

  if (points.length > limit) {
    requiresSnapshot = true;
  }

  const trimmedPoints =
    points.length > limit
      ? points.slice(points.length - limit)
      : points;

  return {
    points: trimmedPoints,
    requiresSnapshot,
  };
}

export function reduceIncrementalGraphSeries(
  previous: GraphSeriesResult,
  deltaRows: TabularDataRow[],
  config: Pick<
    ResolvedGraphConfig,
    "groupField" | "limit" | "maxSeries" | "seriesOverrides" | "xField" | "yField"
  >,
): IncrementalGraphSeriesUpdateResult {
  const deltaResult = buildGraphSeries(deltaRows, config);

  if (deltaResult.series.length === 0) {
    return {
      deltaSeries: [],
      result: previous,
      updateMode: "delta",
    };
  }

  const mergedSeries = previous.series.map((series) => ({
    ...series,
    points: [...series.points],
  }));
  const mergedSeriesById = new Map(mergedSeries.map((series) => [series.id, series]));
  let requiresSnapshot = false;

  deltaResult.series.forEach((deltaSeries) => {
    const existingSeries = mergedSeriesById.get(deltaSeries.id);

    if (!existingSeries) {
      mergedSeries.push({
        ...deltaSeries,
        points: [...deltaSeries.points],
        sourcePointCount: deltaSeries.points.length,
        pointCount: deltaSeries.points.length,
      });
      mergedSeriesById.set(deltaSeries.id, mergedSeries[mergedSeries.length - 1]!);
      return;
    }

    const mergedPoints = mergeGraphSeriesPoints(
      existingSeries.points,
      deltaSeries.points,
      config.limit,
    );

    requiresSnapshot = requiresSnapshot || mergedPoints.requiresSnapshot;
    existingSeries.points = mergedPoints.points;
    existingSeries.pointCount = mergedPoints.points.length;
    existingSeries.sourcePointCount = mergedPoints.points.length;
    existingSeries.color = existingSeries.color ?? deltaSeries.color;
    existingSeries.lineStyle = existingSeries.lineStyle ?? deltaSeries.lineStyle;
    existingSeries.label = deltaSeries.label;
  });

  const nextResult = buildGraphSeriesResultFromSeries(
    mergedSeries,
    Math.max(1, config.maxSeries),
  );
  const previousSeriesIds = previous.series.map((series) => series.id).join("\u001f");
  const nextSeriesIds = nextResult.series.map((series) => series.id).join("\u001f");

  if (previousSeriesIds !== nextSeriesIds) {
    requiresSnapshot = true;
  }

  const deltaSeries = requiresSnapshot
    ? deltaResult.series
        .map((series) => nextResult.series.find((entry) => entry.id === series.id))
        .filter((series): series is GraphSeries => Boolean(series))
    : deltaResult.series;

  return {
    deltaSeries,
    result: nextResult,
    updateMode: requiresSnapshot ? "snapshot" : "delta",
  };
}

export function buildGraphChartSeries(
  series: GraphSeries[],
  timeAxisMode: Exclude<GraphTimeAxisMode, "auto"> = "datetime",
  provider: GraphProvider = "tradingview",
): GraphChartSeriesResult {
  if (provider === "echarts") {
    return {
      series: series.map((entry) => ({
        ...entry,
        pointCount: entry.points.length,
        points: [...entry.points].sort((left, right) => left.time - right.time),
      })),
      affectedSeriesCount: 0,
      collapsedPointCount: 0,
    };
  }

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
      sourcePointCount: entry.sourcePointCount,
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

export function buildStackedGraphSeriesProjection(series: GraphSeries[]) {
  if (series.length <= 1) {
    return series;
  }

  const timeValues = [...new Set(series.flatMap((entry) => entry.points.map((point) => point.time)))]
    .sort((left, right) => left - right);

  if (timeValues.length === 0) {
    return series;
  }

  const cumulativeByTime = new Map<number, number>();

  return series.map((entry) => {
    if (entry.points.length === 0) {
      return entry;
    }

    const seriesValueByTime = new Map(entry.points.map((point) => [point.time, point.value]));
    const points = timeValues.map((time) => {
      const nextValue = (cumulativeByTime.get(time) ?? 0) + (seriesValueByTime.get(time) ?? 0);
      cumulativeByTime.set(time, nextValue);
      return { time, value: nextValue };
    });

    return {
      ...entry,
      pointCount: points.length,
      points,
    };
  });
}
