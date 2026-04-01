import type {
  DataNodeDetail,
  DataNodeRemoteDataRow,
  DataNodeSummary,
  LocalTimeSerieQuickSearchRecord,
} from "../../../../common/api";

export type DataNodeDateRangeMode = "dashboard" | "fixed";

export interface DataNodeFieldOption {
  description?: string | null;
  dtype: string | null;
  isIndex: boolean;
  isNumeric: boolean;
  isTime: boolean;
  key: string;
  label: string;
}

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

function isNumericValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed);
}

function isTimeValue(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (!/[T:\-\/ ]/.test(trimmed) && !/time|date/i.test(trimmed)) {
    return false;
  }

  return !Number.isNaN(Date.parse(trimmed));
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

export function formatLocalTimeSerieLabel(
  localTimeSerie?:
    | Pick<LocalTimeSerieQuickSearchRecord, "id" | "update_hash" | "data_node_storage">
    | null,
) {
  if (!localTimeSerie) {
    return "Local update";
  }

  const updateHash = localTimeSerie.update_hash?.trim();

  if (updateHash) {
    return updateHash;
  }

  const dataNodeIdentifier = localTimeSerie.data_node_storage?.identifier?.trim();

  if (dataNodeIdentifier) {
    return dataNodeIdentifier;
  }

  const dataNodeStorageHash = localTimeSerie.data_node_storage?.storage_hash?.trim();

  if (dataNodeStorageHash) {
    return dataNodeStorageHash;
  }

  return `Local update ${localTimeSerie.id}`;
}

export function buildDataNodeFieldOptions(detail?: DataNodeDetail | null) {
  const sourceConfig = detail?.sourcetableconfiguration;
  const orderedKeys = uniqueStrings([
    sourceConfig?.time_index_name ?? undefined,
    ...(sourceConfig?.index_names ?? []),
    ...(sourceConfig?.columns_metadata?.map((column) => column.column_name) ?? []),
    ...Object.keys(sourceConfig?.column_dtypes_map ?? {}),
  ]);

  return orderedKeys.map<DataNodeFieldOption>((key) => {
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

export function buildDataNodeFieldOptionsFromRows(input: {
  columns?: string[];
  rows?: readonly DataNodeRemoteDataRow[];
}) {
  const orderedKeys = uniqueStrings([
    ...(input.columns ?? []),
    ...((input.rows ?? []).flatMap((row) => Object.keys(row))),
  ]);

  return orderedKeys.map<DataNodeFieldOption>((key) => {
    const samples = (input.rows ?? [])
      .map((row) => row[key])
      .filter((value) => value !== null && value !== undefined && value !== "");

    return {
      key,
      label: key,
      description: null,
      dtype: null,
      isIndex: /^(unique_identifier|identifier)$/i.test(key),
      isNumeric: samples.some((value) => isNumericValue(value)),
      isTime: /date|time|timestamp/i.test(key) || samples.some((value) => isTimeValue(value)),
    };
  });
}

export function resolveDataNodeDateRange(
  config: Pick<DataNodeDateRangeConfig, "dateRangeMode" | "fixedEndMs" | "fixedStartMs">,
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

export function formatDateTimeLocalValue(timestampMs?: number) {
  if (!timestampMs) {
    return "";
  }

  const date = new Date(timestampMs);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function parseDateTimeLocalValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export interface DataNodeDateRangeConfig {
  dateRangeMode: DataNodeDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
}
