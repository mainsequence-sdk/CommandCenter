import type {
  DataNodeDetail,
  DataNodeRemoteDataRow,
} from "../../../../common/api";
import {
  formatDataNodeFieldSearchText,
  resolveDataNodeFieldOptionsFromDataset,
  type DataNodeFieldOption,
} from "../../../workbench/widgets/data-node-shared/dataNodeShared";
import {
  normalizeDataNodeWidgetSourceProps,
  normalizeDataNodeWidgetSourceReferenceProps,
  resolveDataNodeWidgetSourceConfig,
  type DataNodeWidgetSourceProps,
  type DataNodeWidgetSourceReferenceProps,
  type ResolvedDataNodeWidgetSourceConfig,
} from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";

export type CurvePlotMaturityUnit = "auto" | "months" | "years";
export type CurvePlotSelectionMode = "all" | "include" | "exclude";

export interface MainSequenceCurvePlotWidgetProps
  extends DataNodeWidgetSourceProps,
    DataNodeWidgetSourceReferenceProps {
  curveDataNode?: boolean;
  curveField?: string;
  curveSelectionMode?: CurvePlotSelectionMode;
  maturityField?: string;
  maturityUnit?: CurvePlotMaturityUnit;
  selectedCurveValues?: string[];
  valueField?: string;
}

export interface ResolvedCurvePlotConfig extends ResolvedDataNodeWidgetSourceConfig {
  curveDataNode: boolean;
  curveField?: string;
  curveSelectionMode: CurvePlotSelectionMode;
  maturityField?: string;
  maturityUnit: CurvePlotMaturityUnit;
  selectedCurveValues?: string[];
  valueField?: string;
}

export interface CurvePlotSeries {
  id: string;
  label: string;
  pointCount: number;
  points: Array<{ time: number; value: number }>;
}

export interface CurvePlotSeriesResult {
  droppedGroups: number;
  filteredGroups: number;
  invalidRowCount: number;
  series: CurvePlotSeries[];
  totalGroups: number;
}

const maturityFieldPatterns = [/maturity/i, /tenor/i, /term/i, /bucket/i, /expiry/i, /years?/i];
const valueFieldPatterns = [/yield/i, /rate/i, /mid/i, /value/i, /close/i];
const maxCurveSeries = 8;
const curveDataNodeCurveField = "curve";
const curveDataNodeCurveIdentifierField = "unique_identifier";
const curveDataNodeTimeIndexField = "time_index";
const averageDaysPerMonth = 365.25 / 12;

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

function normalizeSelectionMode(value: unknown): CurvePlotSelectionMode {
  return value === "include" || value === "exclude" ? value : "all";
}

function normalizeCurveDataNode(value: unknown) {
  return value === true;
}

function normalizeMaturityUnit(value: unknown): CurvePlotMaturityUnit {
  return value === "months" || value === "years" ? value : "auto";
}

function normalizeSelectedCurveValues(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = uniqueStrings(
    value.map((entry) => (typeof entry === "string" ? entry.trim() : "")),
  );

  return normalized.length > 0 ? normalized : undefined;
}

function getRequestedFieldKey(
  requestedKey: unknown,
  fieldOptions: DataNodeFieldOption[],
  autoPatterns: RegExp[],
) {
  if (typeof requestedKey === "string" && requestedKey.trim()) {
    const trimmed = requestedKey.trim();

    if (fieldOptions.length === 0) {
      return trimmed;
    }

    if (fieldOptions.some((field) => field.key === trimmed)) {
      return trimmed;
    }
  }

  return fieldOptions.find((field) =>
    autoPatterns.some((pattern) => pattern.test(formatDataNodeFieldSearchText(field))),
  )?.key;
}

function parseNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value.trim().replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTenorUnitValue(rawValue: string, multiplier: number) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

export function parseCurvePlotMaturityValue(
  value: unknown,
  maturityUnit: CurvePlotMaturityUnit,
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (maturityUnit === "months") {
      return value;
    }

    if (maturityUnit === "years") {
      return value * 12;
    }

    return value <= 40 ? value * 12 : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (maturityUnit === "months") {
    return parseNumericValue(trimmed);
  }

  if (maturityUnit === "years") {
    const numericValue = parseNumericValue(trimmed);
    return numericValue === null ? null : numericValue * 12;
  }

  const normalized = trimmed.toLowerCase().replaceAll(/\s+/g, "");
  const monthMatch = normalized.match(/^(\d+(?:\.\d+)?)m(?:o|onths?)?$/i);

  if (monthMatch) {
    return parseTenorUnitValue(monthMatch[1]!, 1);
  }

  const yearMatch = normalized.match(/^(\d+(?:\.\d+)?)y(?:r|ears?)?$/i);

  if (yearMatch) {
    return parseTenorUnitValue(yearMatch[1]!, 12);
  }

  const weekMatch = normalized.match(/^(\d+(?:\.\d+)?)w(?:eeks?)?$/i);

  if (weekMatch) {
    return parseTenorUnitValue(weekMatch[1]!, 12 / 52);
  }

  const dayMatch = normalized.match(/^(\d+(?:\.\d+)?)d(?:ays?)?$/i);

  if (dayMatch) {
    return parseTenorUnitValue(dayMatch[1]!, 12 / 365);
  }

  const numericValue = parseNumericValue(trimmed);

  if (numericValue === null) {
    return null;
  }

  return numericValue <= 40 ? numericValue * 12 : numericValue;
}

function normalizeCurvePlotAxisValue(value: number) {
  return Math.round(value * 1000) / 1000;
}

function normalizeCurvePlotRateValue(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatCurvePlotRoundedMonthLabel(totalMonths: number) {
  if (!Number.isFinite(totalMonths)) {
    return "";
  }

  const roundedMonths = Math.max(1, Math.round(totalMonths));

  if (roundedMonths < 12) {
    return `${roundedMonths}M`;
  }

  return `${Math.max(1, Math.round(roundedMonths / 12))}Y`;
}

export function formatCurvePlotValue(value: unknown) {
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

export function formatCurvePlotMaturityLabel(months: number) {
  if (!Number.isFinite(months)) {
    return "";
  }

  return formatCurvePlotRoundedMonthLabel(months);
}

export function formatCurvePlotDayMaturityLabel(days: number) {
  if (!Number.isFinite(days)) {
    return "";
  }

  return formatCurvePlotRoundedMonthLabel(days / averageDaysPerMonth);
}

export function convertCurvePlotDaysToChartMonths(days: number) {
  if (!Number.isFinite(days)) {
    return null;
  }

  return Math.round((days / averageDaysPerMonth) * 1000) / 1000;
}

export function convertCurvePlotChartMonthsToDays(months: number) {
  if (!Number.isFinite(months)) {
    return null;
  }

  return months * averageDaysPerMonth;
}

export function buildCurvePlotFieldOptionsFromRuntime(runtimeState?: {
  columns?: string[];
  fields?: readonly DataNodeFieldOption[];
  rows?: readonly DataNodeRemoteDataRow[];
} | null) {
  return resolveDataNodeFieldOptionsFromDataset({
    columns: runtimeState?.columns,
    fields: runtimeState?.fields,
    rows: runtimeState?.rows,
  });
}

export function resolveCurvePlotConfig(
  props: MainSequenceCurvePlotWidgetProps,
  detail?: DataNodeDetail | null,
  fieldOptionsOverride?: DataNodeFieldOption[],
): ResolvedCurvePlotConfig {
  const normalizedReference = normalizeDataNodeWidgetSourceReferenceProps(props);
  const sourceConfig = resolveDataNodeWidgetSourceConfig(props, detail);
  const availableFields =
    fieldOptionsOverride && fieldOptionsOverride.length > 0
      ? fieldOptionsOverride
      : sourceConfig.availableFields;
  const curveDataNode = normalizeCurveDataNode(props.curveDataNode);

  return {
    ...sourceConfig,
    sourceMode: "filter_widget",
    sourceWidgetId: normalizedReference.sourceWidgetId,
    curveDataNode,
    curveField: curveDataNode
      ? curveDataNodeCurveIdentifierField
      : typeof props.curveField === "string" && props.curveField.trim()
        ? availableFields.some((field) => field.key === props.curveField)
          ? props.curveField
          : undefined
        : undefined,
    curveSelectionMode: normalizeSelectionMode(props.curveSelectionMode),
    maturityField: curveDataNode
      ? curveDataNodeCurveField
      : getRequestedFieldKey(props.maturityField, availableFields, maturityFieldPatterns),
    maturityUnit: normalizeMaturityUnit(props.maturityUnit),
    selectedCurveValues: normalizeSelectedCurveValues(props.selectedCurveValues),
    valueField: curveDataNode
      ? curveDataNodeCurveField
      : getRequestedFieldKey(props.valueField, availableFields, valueFieldPatterns),
  };
}

export function normalizeCurvePlotProps(
  props: MainSequenceCurvePlotWidgetProps,
  detail?: DataNodeDetail | null,
) {
  const resolved = resolveCurvePlotConfig(props, detail);
  const sourceProps = normalizeDataNodeWidgetSourceProps(props, detail);
  const sourceReferenceProps = normalizeDataNodeWidgetSourceReferenceProps(props);

  return {
    ...sourceProps,
    sourceMode: "filter_widget",
    sourceWidgetId: sourceReferenceProps.sourceWidgetId,
    curveDataNode: resolved.curveDataNode,
    curveField: resolved.curveField,
    curveSelectionMode: resolved.curveSelectionMode,
    maturityField: resolved.maturityField,
    maturityUnit: resolved.maturityUnit,
    selectedCurveValues: resolved.selectedCurveValues,
    valueField: resolved.valueField,
  } satisfies MainSequenceCurvePlotWidgetProps;
}

export function buildCurvePlotCurveValueOptions(
  rows: DataNodeRemoteDataRow[],
  config: Pick<ResolvedCurvePlotConfig, "curveDataNode" | "curveField">,
) {
  const activeCurveField = config.curveDataNode
    ? curveDataNodeCurveIdentifierField
    : config.curveField;

  if (!activeCurveField) {
    return [];
  }

  const seen = new Set<string>();

  return rows.flatMap((row) => {
    const rawValue = row[activeCurveField];
    const value = String(rawValue ?? "__empty__");

    if (seen.has(value)) {
      return [];
    }

    seen.add(value);

    return [{
      value,
      label: formatCurvePlotValue(rawValue),
      description: value === "__empty__" ? "Empty value" : undefined,
      keywords: [value, formatCurvePlotValue(rawValue)],
    }];
  });
}

function parseCurveDataNodeTimeIndexLabel(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalizedMs =
      Math.abs(value) >= 1_000_000_000_000 ? Math.trunc(value) : Math.abs(value) >= 1_000_000_000 ? Math.trunc(value * 1000) : null;

    if (normalizedMs !== null) {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(normalizedMs);
    }

    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const numericValue = Number(trimmed);

    if (Number.isFinite(numericValue)) {
      return parseCurveDataNodeTimeIndexLabel(numericValue);
    }

    const parsed = Date.parse(trimmed);

    if (!Number.isNaN(parsed)) {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
    }

    return trimmed;
  }

  return null;
}

function toBase64Bytes(base64Value: string) {
  const binary = globalThis.atob(base64Value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function decompressStringToCurve(b64String: string) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser does not support gzip decompression for compressed curve payloads.");
  }

  const compressedBytes = toBase64Bytes(b64String.trim());
  const decompressedStream = new Blob([compressedBytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const jsonText = await new Response(decompressedStream).text();
  const parsed = JSON.parse(jsonText);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Curve payload did not decompress into an object.");
  }

  return parsed as Record<string, unknown>;
}

export async function buildCurvePlotSeriesFromCurveDataNodeRows(
  rows: DataNodeRemoteDataRow[],
  config: Pick<ResolvedCurvePlotConfig, "curveField" | "curveSelectionMode" | "selectedCurveValues">,
  maxSeries = maxCurveSeries,
): Promise<CurvePlotSeriesResult> {
  const selectedCurves = new Set(config.selectedCurveValues ?? []);
  const series: CurvePlotSeries[] = [];
  let invalidRowCount = 0;
  let filteredGroups = 0;

  for (const row of rows) {
    const curveIdentifier = String(row[curveDataNodeCurveIdentifierField] ?? "__empty__");
    const selectedCurveMatch = selectedCurves.has(curveIdentifier);

    if (
      config.curveSelectionMode === "include" &&
      selectedCurves.size > 0 &&
      !selectedCurveMatch
    ) {
      filteredGroups += 1;
      continue;
    }

    if (
      config.curveSelectionMode === "exclude" &&
      selectedCurves.size > 0 &&
      selectedCurveMatch
    ) {
      filteredGroups += 1;
      continue;
    }

    const compressedCurve = row[curveDataNodeCurveField];

    if (typeof compressedCurve !== "string" || !compressedCurve.trim()) {
      invalidRowCount += 1;
      continue;
    }

    try {
      const decompressedCurve = await decompressStringToCurve(compressedCurve);
      const points = Object.entries(decompressedCurve)
        .map(([maturity, value]) => {
          const maturityDays = parseNumericValue(maturity);
          const curveValue = parseNumericValue(value);

          if (maturityDays === null || curveValue === null) {
            return null;
          }

          const chartMonths = convertCurvePlotDaysToChartMonths(maturityDays);

          if (chartMonths === null) {
            return null;
          }

          return {
            time: normalizeCurvePlotAxisValue(chartMonths),
            value: normalizeCurvePlotRateValue(curveValue),
          };
        })
        .filter((point): point is { time: number; value: number } => point !== null)
        .sort((left, right) => left.time - right.time);

      if (points.length === 0) {
        invalidRowCount += 1;
        continue;
      }

      const timeIndexLabel = parseCurveDataNodeTimeIndexLabel(row[curveDataNodeTimeIndexField]);
      const label =
        timeIndexLabel && curveIdentifier !== "__empty__"
          ? `${curveIdentifier} • ${timeIndexLabel}`
          : timeIndexLabel
            ? timeIndexLabel
            : curveIdentifier === "__empty__"
              ? "Curve"
              : curveIdentifier;

      const seriesId =
        timeIndexLabel != null ? `${curveIdentifier}::${timeIndexLabel}` : curveIdentifier;

      series.push({
        id: seriesId,
        label,
        pointCount: points.length,
        points,
      });
    } catch {
      invalidRowCount += 1;
    }
  }

  return {
    series: series.slice(0, maxSeries),
    droppedGroups: Math.max(series.length - maxSeries, 0),
    filteredGroups,
    invalidRowCount,
    totalGroups: rows.length,
  };
}

export function buildCurvePlotSeries(
  rows: DataNodeRemoteDataRow[],
  config: Pick<
    ResolvedCurvePlotConfig,
    "curveField" | "curveSelectionMode" | "maturityField" | "maturityUnit" | "selectedCurveValues" | "valueField"
  >,
  maxSeries = maxCurveSeries,
): CurvePlotSeriesResult {
  if (!config.maturityField || !config.valueField) {
    return { series: [], droppedGroups: 0, filteredGroups: 0, invalidRowCount: 0, totalGroups: 0 };
  }

  const maturityField = config.maturityField;
  const valueField = config.valueField;
  const curveField = config.curveField;
  const selectedCurves = new Set(config.selectedCurveValues ?? []);
  const groupedCurves = new Map<
    string,
    { id: string; label: string; pointsByMaturity: Map<number, number> }
  >();
  let invalidRowCount = 0;

  rows.forEach((row) => {
    const maturity = parseCurvePlotMaturityValue(row[maturityField], config.maturityUnit);
    const value = parseNumericValue(row[valueField]);

    if (maturity === null || value === null) {
      invalidRowCount += 1;
      return;
    }

    const curveKey = curveField ? String(row[curveField] ?? "__empty__") : "__default__";
    const selectedCurveMatch = selectedCurves.has(curveKey);

    if (
      curveField &&
      config.curveSelectionMode === "include" &&
      selectedCurves.size > 0 &&
      !selectedCurveMatch
    ) {
      return;
    }

    if (
      curveField &&
      config.curveSelectionMode === "exclude" &&
      selectedCurves.size > 0 &&
      selectedCurveMatch
    ) {
      return;
    }

    const label = curveField ? formatCurvePlotValue(row[curveField]) : "Curve";
    const currentCurve = groupedCurves.get(curveKey) ?? {
      id: curveKey,
      label,
      pointsByMaturity: new Map<number, number>(),
    };

    currentCurve.pointsByMaturity.set(
      normalizeCurvePlotAxisValue(maturity),
      normalizeCurvePlotRateValue(value),
    );
    groupedCurves.set(curveKey, currentCurve);
  });

  const series = [...groupedCurves.values()]
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      pointCount: entry.pointsByMaturity.size,
      points: [...entry.pointsByMaturity.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([time, value]) => ({ time, value })),
    }))
    .filter((entry) => entry.pointCount > 0);

  const totalGroups = curveField
    ? uniqueStrings(rows.map((row) => String(row[curveField] ?? "__empty__"))).length
    : series.length;
  const filteredGroups = Math.max(totalGroups - series.length, 0);

  return {
    series: series.slice(0, maxSeries),
    droppedGroups: Math.max(series.length - maxSeries, 0),
    filteredGroups,
    invalidRowCount,
    totalGroups,
  };
}
