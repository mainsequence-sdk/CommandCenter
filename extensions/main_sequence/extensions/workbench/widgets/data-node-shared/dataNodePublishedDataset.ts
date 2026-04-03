import type { DataNodeRemoteDataRow } from "../../../../common/api";
import { resolveMainSequenceDataSourceContext } from "../../widget-contracts/mainSequenceDataSourceBundle";
import type {
  TabularFrameFieldSchema,
  TabularFrameSourceDescriptor,
} from "@/widgets/shared/tabular-frame-source";
import { normalizeTabularFrameSource } from "@/widgets/shared/tabular-frame-source";

export const defaultDataNodePublishedDatasetLimit = 2_500;

export interface DataNodePublishedDataset {
  columns: string[];
  dataNodeId?: number;
  error?: string;
  fields?: TabularFrameFieldSchema[];
  limit: number;
  rangeEndMs?: number | null;
  rangeStartMs?: number | null;
  rows: DataNodeRemoteDataRow[];
  source?: TabularFrameSourceDescriptor;
  status: "idle" | "loading" | "error" | "ready";
  uniqueIdentifierList?: string[];
  updatedAtMs?: number;
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

function normalizeColumns(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (typeof entry !== "string" || !entry.trim()) {
      return [];
    }

    const nextValue = entry.trim();

    if (seen.has(nextValue)) {
      return [];
    }

    seen.add(nextValue);
    return [nextValue];
  });
}

function normalizeRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is DataNodeRemoteDataRow => isPlainRecord(entry));
}

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeStatus(value: unknown): DataNodePublishedDataset["status"] {
  return value === "loading" || value === "error" || value === "ready" ? value : "idle";
}

export function normalizeDataNodePublishedDataset(
  value: unknown,
): DataNodePublishedDataset | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const normalizedFrame = normalizeTabularFrameSource(value);
  const sourceContext = resolveMainSequenceDataSourceContext(normalizedFrame?.source);

  return {
    columns: normalizedFrame?.columns ?? normalizeColumns(value.columns),
    dataNodeId:
      normalizePositiveInteger(value.dataNodeId) ??
      sourceContext?.dataNodeId,
    error: typeof value.error === "string" && value.error.trim() ? value.error.trim() : undefined,
    fields: normalizedFrame?.fields,
    limit:
      normalizePositiveInteger(value.limit) ??
      sourceContext?.limit ??
      defaultDataNodePublishedDatasetLimit,
    rangeEndMs:
      normalizeTimestampMs(value.rangeEndMs) ??
      sourceContext?.fixedEndMs ??
      null,
    rangeStartMs:
      normalizeTimestampMs(value.rangeStartMs) ??
      sourceContext?.fixedStartMs ??
      null,
    rows: normalizedFrame?.rows ?? normalizeRows(value.rows),
    source: normalizedFrame?.source,
    status: normalizedFrame?.status ?? normalizeStatus(value.status),
    uniqueIdentifierList: Array.isArray(value.uniqueIdentifierList)
      ? value.uniqueIdentifierList.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        )
      : sourceContext?.uniqueIdentifierList,
    updatedAtMs: normalizeTimestampMs(value.updatedAtMs) ?? sourceContext?.updatedAtMs,
  };
}
