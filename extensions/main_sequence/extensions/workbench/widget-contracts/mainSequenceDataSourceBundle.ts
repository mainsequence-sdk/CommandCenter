import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameSourceDescriptor,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";

export const MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT = CORE_TABULAR_FRAME_SOURCE_CONTRACT;
export const MAIN_SEQUENCE_DATA_SOURCE_KIND = "main-sequence-data-node" as const;

export interface MainSequenceDataSourceContext {
  dateRangeMode?: "dashboard" | "fixed";
  fixedStartMs?: number;
  fixedEndMs?: number;
  uniqueIdentifierList?: string[];
  limit?: number;
}

export type MainSequenceDataSourceFieldOption = TabularFrameFieldSchema;
export type MainSequenceDataSourceBundleV1 = TabularFrameSourceV1;

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeUniqueIdentifierList(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );

  return normalized.length > 0 ? normalized : undefined;
}

export function buildMainSequenceDataSourceDescriptor(input: {
  dataNodeId?: number;
  dataNodeLabel?: string;
  dateRangeMode?: "dashboard" | "fixed";
  fixedStartMs?: number;
  fixedEndMs?: number;
  uniqueIdentifierList?: string[];
  updatedAtMs?: number;
  limit?: number;
}): TabularFrameSourceDescriptor {
  return {
    kind: MAIN_SEQUENCE_DATA_SOURCE_KIND,
    id: typeof input.dataNodeId === "number" && Number.isFinite(input.dataNodeId)
      ? input.dataNodeId
      : undefined,
    label: typeof input.dataNodeLabel === "string" && input.dataNodeLabel.trim()
      ? input.dataNodeLabel.trim()
      : undefined,
    updatedAtMs: normalizeTimestampMs(input.updatedAtMs),
    context: {
      dateRangeMode: input.dateRangeMode,
      fixedStartMs: normalizeTimestampMs(input.fixedStartMs),
      fixedEndMs: normalizeTimestampMs(input.fixedEndMs),
      uniqueIdentifierList: normalizeUniqueIdentifierList(input.uniqueIdentifierList),
      limit: normalizePositiveInteger(input.limit),
    },
  };
}

export function resolveMainSequenceDataSourceContext(
  source?: TabularFrameSourceDescriptor | null,
) {
  if (!source || source.kind !== MAIN_SEQUENCE_DATA_SOURCE_KIND) {
    return null;
  }

  const context = source.context ?? {};

  return {
    dataNodeId:
      typeof source.id === "number" && Number.isFinite(source.id)
        ? Math.trunc(source.id)
        : typeof source.id === "string" && source.id.trim()
          ? normalizePositiveInteger(source.id)
          : undefined,
    dataNodeLabel:
      typeof source.label === "string" && source.label.trim() ? source.label.trim() : undefined,
    dateRangeMode:
      context.dateRangeMode === "fixed" ? "fixed" : context.dateRangeMode === "dashboard"
        ? "dashboard"
        : undefined,
    fixedStartMs: normalizeTimestampMs(context.fixedStartMs),
    fixedEndMs: normalizeTimestampMs(context.fixedEndMs),
    uniqueIdentifierList: normalizeUniqueIdentifierList(context.uniqueIdentifierList),
    updatedAtMs: normalizeTimestampMs(source.updatedAtMs),
    limit: normalizePositiveInteger(context.limit),
  };
}

export const normalizeMainSequenceDataSourceBundle = normalizeTabularFrameSource;
