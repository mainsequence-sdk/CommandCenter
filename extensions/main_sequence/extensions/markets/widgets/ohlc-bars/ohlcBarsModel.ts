import type { DataNodeRemoteDataRow } from "../../../../common/api";
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
import type { DataNodePublishedDataset } from "../../../workbench/widgets/data-node-shared/dataNodePublishedDataset";
import type { DataNodeDetail } from "../../../../common/api";

export interface MainSequenceOhlcBarsWidgetProps
  extends DataNodeWidgetSourceProps,
    DataNodeWidgetSourceReferenceProps {
  closeField?: string;
  highField?: string;
  lowField?: string;
  openField?: string;
  studies?: OhlcBarsStudyConfig[];
  timeField?: string;
  volumeField?: string;
}

export type OhlcBarsStudyType = "sma" | "ema";

export interface OhlcBarsStudyConfig {
  id?: string;
  period?: number;
  type?: OhlcBarsStudyType;
}

export interface ResolvedOhlcBarsConfig extends ResolvedDataNodeWidgetSourceConfig {
  closeField?: string;
  highField?: string;
  lowField?: string;
  openField?: string;
  studies: Required<OhlcBarsStudyConfig>[];
  timeField?: string;
  volumeField?: string;
}

export interface OhlcBarsPoint {
  close: number;
  high: number;
  low: number;
  open: number;
  sourceTime: unknown;
  timeMs: number;
  time: number;
  volume?: number;
}

export interface OhlcBarsSeriesResult {
  invalidRowCount: number;
  points: OhlcBarsPoint[];
  volumePointCount: number;
}

const timeFieldPatterns = [/^time$/i, /time[_\s-]?index/i, /timestamp/i, /datetime/i, /^date$/i];
const openFieldPatterns = [/^open$/i, /^o$/i, /open[_\s-]?price/i];
const highFieldPatterns = [/^high$/i, /^h$/i, /high[_\s-]?price/i];
const lowFieldPatterns = [/^low$/i, /^l$/i, /low[_\s-]?price/i];
const closeFieldPatterns = [/^close$/i, /^c$/i, /close[_\s-]?price/i, /settle/i, /last/i];
const maxStudyCount = 5;
const studyPeriodMin = 2;
const studyPeriodMax = 500;

function normalizeStringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getRequestedFieldKey(
  requestedKey: unknown,
  fieldOptions: DataNodeFieldOption[],
  autoPatterns: RegExp[],
) {
  const normalized = normalizeStringField(requestedKey);

  if (normalized) {
    if (fieldOptions.length === 0 || fieldOptions.some((field) => field.key === normalized)) {
      return normalized;
    }
  }

  return fieldOptions.find((field) =>
    autoPatterns.some((pattern) => pattern.test(formatDataNodeFieldSearchText(field))),
  )?.key;
}

function getOptionalFieldKey(
  requestedKey: unknown,
  fieldOptions: DataNodeFieldOption[],
) {
  const normalized = normalizeStringField(requestedKey);

  if (!normalized) {
    return undefined;
  }

  if (fieldOptions.length === 0 || fieldOptions.some((field) => field.key === normalized)) {
    return normalized;
  }

  return undefined;
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

function normalizeEpochValueToUnixMilliseconds(value: number) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1_000_000_000_000_000_000) {
    return Math.trunc(value / 1_000_000);
  }

  if (absoluteValue >= 1_000_000_000_000_000) {
    return Math.trunc(value / 1000);
  }

  if (absoluteValue >= 1_000_000_000_000) {
    return Math.trunc(value);
  }

  if (absoluteValue >= 1_000_000_000) {
    return Math.trunc(value * 1000);
  }

  return null;
}

function parseTimeToUnixMilliseconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeEpochValueToUnixMilliseconds(value);
  }

  if (value instanceof Date) {
    const timestampMs = value.getTime();

    return Number.isFinite(timestampMs) ? Math.trunc(timestampMs) : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const numericValue = Number(trimmed);

  if (Number.isFinite(numericValue)) {
    return normalizeEpochValueToUnixMilliseconds(numericValue);
  }

  const timestampMs = Date.parse(normalizeDateTimeString(trimmed));

  return Number.isFinite(timestampMs) ? Math.trunc(timestampMs) : null;
}

function normalizeOhlcValue(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeStudyType(value: unknown): OhlcBarsStudyType {
  return value === "ema" ? "ema" : "sma";
}

function normalizeStudyPeriod(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.max(studyPeriodMin, Math.min(Math.trunc(parsed), studyPeriodMax));
}

function normalizeStudies(value: unknown): Required<OhlcBarsStudyConfig>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, maxStudyCount).map((entry, index) => {
    const record = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry as OhlcBarsStudyConfig
      : {};
    const type = normalizeStudyType(record.type);
    const period = normalizeStudyPeriod(record.period);
    const id =
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : `${type}-${period}-${index + 1}`;

    return {
      id,
      period,
      type,
    };
  });
}

export function normalizeOhlcBarsProps(
  props: MainSequenceOhlcBarsWidgetProps,
  detail?: DataNodeDetail | null,
): MainSequenceOhlcBarsWidgetProps {
  const resolved = resolveOhlcBarsConfig(props, detail);
  const sourceProps = normalizeDataNodeWidgetSourceProps(props, detail);
  const sourceReferenceProps = normalizeDataNodeWidgetSourceReferenceProps(props);

  return {
    ...sourceProps,
    sourceMode: "filter_widget",
    sourceWidgetId: sourceReferenceProps.sourceWidgetId,
    closeField: resolved.closeField,
    highField: resolved.highField,
    lowField: resolved.lowField,
    openField: resolved.openField,
    studies: resolved.studies,
    timeField: resolved.timeField,
    volumeField: resolved.volumeField,
  } satisfies MainSequenceOhlcBarsWidgetProps;
}

export function buildOhlcBarsFieldOptionsFromRuntime(dataset?: DataNodePublishedDataset | null) {
  return resolveDataNodeFieldOptionsFromDataset({
    columns: dataset?.columns,
    fields: dataset?.fields,
    rows: dataset?.rows,
  });
}

export function resolveOhlcBarsConfig(
  props: MainSequenceOhlcBarsWidgetProps,
  detail?: DataNodeDetail | null,
  fieldOptionsOverride?: DataNodeFieldOption[],
): ResolvedOhlcBarsConfig {
  const normalizedReference = normalizeDataNodeWidgetSourceReferenceProps(props);
  const sourceConfig = resolveDataNodeWidgetSourceConfig(props, detail);
  const availableFields =
    fieldOptionsOverride && fieldOptionsOverride.length > 0
      ? fieldOptionsOverride
      : sourceConfig.availableFields;

  return {
    ...sourceConfig,
    availableFields,
    closeField: getRequestedFieldKey(props.closeField, availableFields, closeFieldPatterns),
    highField: getRequestedFieldKey(props.highField, availableFields, highFieldPatterns),
    lowField: getRequestedFieldKey(props.lowField, availableFields, lowFieldPatterns),
    openField: getRequestedFieldKey(props.openField, availableFields, openFieldPatterns),
    sourceMode: "filter_widget",
    sourceWidgetId: normalizedReference.sourceWidgetId,
    studies: normalizeStudies(props.studies),
    timeField: getRequestedFieldKey(props.timeField, availableFields, timeFieldPatterns),
    volumeField: getOptionalFieldKey(props.volumeField, availableFields),
  };
}

export function buildOhlcBarsSeries(
  rows: readonly DataNodeRemoteDataRow[],
  config: Pick<ResolvedOhlcBarsConfig, "closeField" | "highField" | "lowField" | "openField" | "timeField" | "volumeField">,
): OhlcBarsSeriesResult {
  if (!config.timeField || !config.openField || !config.highField || !config.lowField || !config.closeField) {
    return {
      invalidRowCount: rows.length,
      points: [],
      volumePointCount: 0,
    };
  }

  let invalidRowCount = 0;
  const points = rows.flatMap<OhlcBarsPoint>((row) => {
    const timeMs = parseTimeToUnixMilliseconds(row[config.timeField!]);
    const open = parseNumericValue(row[config.openField!]);
    const high = parseNumericValue(row[config.highField!]);
    const low = parseNumericValue(row[config.lowField!]);
    const close = parseNumericValue(row[config.closeField!]);
    const volume = config.volumeField ? parseNumericValue(row[config.volumeField]) : null;

    if (
      timeMs === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null
    ) {
      invalidRowCount += 1;
      return [];
    }

    return [
      {
        close: normalizeOhlcValue(close),
        high: normalizeOhlcValue(high),
        low: normalizeOhlcValue(low),
        open: normalizeOhlcValue(open),
        sourceTime: row[config.timeField!],
        time: Math.floor(timeMs / 1000),
        timeMs,
        volume: volume === null ? undefined : normalizeOhlcValue(volume),
      },
    ];
  });

  points.sort((left, right) => left.timeMs - right.timeMs);

  return {
    invalidRowCount,
    points,
    volumePointCount: points.filter((point) => point.volume !== undefined).length,
  };
}
