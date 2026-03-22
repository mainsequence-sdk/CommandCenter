import type {
  DataNodeDetail,
  DataNodeSummary,
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
  )}:${pad(date.getMinutes())}`;
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
