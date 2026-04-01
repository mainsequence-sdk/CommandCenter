import type {
  DataNodeDetail,
  DataNodeRemoteDataRow,
} from "../../../../common/api";
import {
  normalizeDataNodeWidgetSourceProps,
  normalizeDataNodeWidgetSourceReferenceProps,
  resolveDataNodeWidgetSourceConfig,
  type DataNodeWidgetSourceProps,
  type DataNodeWidgetSourceReferenceProps,
  type ResolvedDataNodeWidgetSourceConfig,
} from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";

export type ZeroCurveSelectionMode = "all" | "include" | "exclude";

export interface MainSequenceZeroCurveWidgetProps
  extends DataNodeWidgetSourceProps,
    DataNodeWidgetSourceReferenceProps {
  curveSelectionMode?: ZeroCurveSelectionMode;
  selectedCurveValues?: string[];
}

export interface ResolvedZeroCurveConfig extends ResolvedDataNodeWidgetSourceConfig {
  curveSelectionMode: ZeroCurveSelectionMode;
  selectedCurveValues?: string[];
}

export interface ZeroCurveSeriesPoint {
  day: number;
  value: number;
}

export interface ZeroCurveSeries {
  id: string;
  label: string;
  pointCount: number;
  points: ZeroCurveSeriesPoint[];
  timeIndexLabel: string | null;
  timeIndexSortValue: number | null;
  uniqueIdentifier: string;
}

export interface ZeroCurveSeriesResult {
  filteredGroups: number;
  invalidRowCount: number;
  series: ZeroCurveSeries[];
  totalGroups: number;
}

const curveField = "curve";
const uniqueIdentifierField = "unique_identifier";
const timeIndexField = "time_index";
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

function normalizeSelectionMode(value: unknown): ZeroCurveSelectionMode {
  return value === "include" || value === "exclude" ? value : "all";
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

function normalizeZeroCurveRateValue(value: number) {
  return Math.round(value * 100 * 1_000_000) / 1_000_000;
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
    throw new Error("This browser does not support gzip decompression for Zero Curve widgets.");
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

function parseZeroCurveTimeIndexLabel(value: unknown) {
  const timestampMs = parseZeroCurveTimeIndexMs(value);

  if (timestampMs !== null) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(timestampMs);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return null;
}

function parseZeroCurveTimeIndexMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalizedMs =
      Math.abs(value) >= 1_000_000_000_000
        ? Math.trunc(value)
        : Math.abs(value) >= 1_000_000_000
          ? Math.trunc(value * 1000)
          : null;

    if (normalizedMs !== null) {
      return normalizedMs;
    }

    return null;
  }

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const numericValue = Number(trimmed);

    if (Number.isFinite(numericValue)) {
      return parseZeroCurveTimeIndexMs(numericValue);
    }

    const parsed = Date.parse(trimmed);

    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function formatZeroCurveValue(value: unknown) {
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

export function formatZeroCurveDayLabel(days: number) {
  if (!Number.isFinite(days)) {
    return "";
  }

  const normalizedDays = Math.max(1, Math.round(days));

  if (normalizedDays < 31) {
    return `${normalizedDays}D`;
  }

  if (normalizedDays < 365) {
    return `${Math.max(1, Math.round(normalizedDays / averageDaysPerMonth))}M`;
  }

  return `${Math.max(1, Math.round(normalizedDays / 365.25))}Y`;
}

export function resolveZeroCurveConfig(
  props: MainSequenceZeroCurveWidgetProps,
  detail?: DataNodeDetail | null,
): ResolvedZeroCurveConfig {
  const normalizedReference = normalizeDataNodeWidgetSourceReferenceProps(props);
  const sourceConfig = resolveDataNodeWidgetSourceConfig(props, detail);

  return {
    ...sourceConfig,
    sourceMode: "filter_widget",
    sourceWidgetId: normalizedReference.sourceWidgetId,
    curveSelectionMode: normalizeSelectionMode(props.curveSelectionMode),
    selectedCurveValues: normalizeSelectedCurveValues(props.selectedCurveValues),
  };
}

export function normalizeZeroCurveProps(
  props: MainSequenceZeroCurveWidgetProps,
  detail?: DataNodeDetail | null,
) {
  const resolved = resolveZeroCurveConfig(props, detail);
  const sourceProps = normalizeDataNodeWidgetSourceProps(props, detail);
  const sourceReferenceProps = normalizeDataNodeWidgetSourceReferenceProps(props);

  return {
    ...sourceProps,
    sourceMode: "filter_widget",
    sourceWidgetId: sourceReferenceProps.sourceWidgetId,
    curveSelectionMode: resolved.curveSelectionMode,
    selectedCurveValues: resolved.selectedCurveValues,
  } satisfies MainSequenceZeroCurveWidgetProps;
}

export function buildZeroCurveValueOptions(rows: DataNodeRemoteDataRow[]) {
  const seen = new Set<string>();

  return rows.flatMap((row) => {
    const rawValue = row[uniqueIdentifierField];
    const value = String(rawValue ?? "__empty__");

    if (seen.has(value)) {
      return [];
    }

    seen.add(value);

    return [{
      value,
      label: formatZeroCurveValue(rawValue),
      description: value === "__empty__" ? "Empty value" : undefined,
      keywords: [value, formatZeroCurveValue(rawValue)],
    }];
  });
}

export async function buildZeroCurveSeriesFromRows(
  rows: DataNodeRemoteDataRow[],
  config: Pick<ResolvedZeroCurveConfig, "curveSelectionMode" | "selectedCurveValues">,
): Promise<ZeroCurveSeriesResult> {
  const selectedCurves = new Set(config.selectedCurveValues ?? []);
  const series: ZeroCurveSeries[] = [];
  let invalidRowCount = 0;
  let filteredGroups = 0;

  for (const row of rows) {
    const curveIdentifier = String(row[uniqueIdentifierField] ?? "__empty__");
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

    const compressedCurve = row[curveField];

    if (typeof compressedCurve !== "string" || !compressedCurve.trim()) {
      invalidRowCount += 1;
      continue;
    }

    try {
      const decompressedCurve = await decompressStringToCurve(compressedCurve);
      const points = Object.entries(decompressedCurve)
        .map(([day, value]) => {
          const dayValue = parseNumericValue(day);
          const curveValue = parseNumericValue(value);

          if (dayValue === null || curveValue === null) {
            return null;
          }

          return {
            day: Math.max(0, Math.round(dayValue)),
            value: normalizeZeroCurveRateValue(curveValue),
          };
        })
        .filter((point): point is ZeroCurveSeriesPoint => point !== null)
        .sort((left, right) => left.day - right.day);

      if (points.length === 0) {
        invalidRowCount += 1;
        continue;
      }

      const timeIndexLabel = parseZeroCurveTimeIndexLabel(row[timeIndexField]);
      const timeIndexSortValue = parseZeroCurveTimeIndexMs(row[timeIndexField]);
      const label =
        timeIndexLabel && curveIdentifier !== "__empty__"
          ? `${curveIdentifier} • ${timeIndexLabel}`
          : timeIndexLabel
            ? timeIndexLabel
            : curveIdentifier === "__empty__"
              ? "Zero Curve"
              : curveIdentifier;
      const seriesId =
        timeIndexLabel != null ? `${curveIdentifier}::${timeIndexLabel}` : curveIdentifier;

      series.push({
        id: seriesId,
        label,
        pointCount: points.length,
        points,
        timeIndexLabel,
        timeIndexSortValue,
        uniqueIdentifier: curveIdentifier,
      });
    } catch {
      invalidRowCount += 1;
    }
  }

  return {
    filteredGroups,
    invalidRowCount,
    series,
    totalGroups: rows.length,
  };
}
