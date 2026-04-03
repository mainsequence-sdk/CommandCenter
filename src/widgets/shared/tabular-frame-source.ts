import type { WidgetValueDescriptor } from "@/widgets/types";

export const CORE_TABULAR_FRAME_SOURCE_CONTRACT = "core.tabular_frame@v1" as const;

export type TabularFrameSourceStatus = "idle" | "loading" | "ready" | "error";

export type TabularFrameFieldType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "datetime"
  | "date"
  | "time"
  | "json"
  | "unknown";

export interface TabularFrameFieldSchema {
  key: string;
  label?: string;
  description?: string | null;
  type: TabularFrameFieldType;
  nullable?: boolean;
  nativeType?: string | null;
}

export interface TabularFrameSourceDescriptor {
  kind: string;
  id?: string | number;
  label?: string;
  updatedAtMs?: number;
  context?: Record<string, unknown>;
}

export interface TabularFrameSourceV1 {
  status: TabularFrameSourceStatus;
  error?: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  fields?: TabularFrameFieldSchema[];
  source?: TabularFrameSourceDescriptor;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTimestampMs(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
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

    const normalized = entry.trim();

    if (seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function normalizeRows(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is Record<string, unknown> => isPlainRecord(entry));
}

function normalizeFieldType(value: unknown): TabularFrameFieldType {
  return value === "string" ||
    value === "number" ||
    value === "integer" ||
    value === "boolean" ||
    value === "datetime" ||
    value === "date" ||
    value === "time" ||
    value === "json"
    ? value
    : "unknown";
}

function normalizeFields(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized = value.flatMap((entry) => {
    if (!isPlainRecord(entry)) {
      return [];
    }

    const key = typeof entry.key === "string" ? entry.key.trim() : "";

    if (!key || seen.has(key)) {
      return [];
    }

    seen.add(key);

    return [{
      key,
      label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : undefined,
      description:
        typeof entry.description === "string" && entry.description.trim()
          ? entry.description.trim()
          : null,
      type: normalizeFieldType(entry.type),
      nullable: entry.nullable === true ? true : undefined,
      nativeType:
        typeof entry.nativeType === "string" && entry.nativeType.trim()
          ? entry.nativeType.trim()
          : null,
    } satisfies TabularFrameFieldSchema];
  });

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSourceDescriptor(value: unknown) {
  if (!isPlainRecord(value) || typeof value.kind !== "string" || !value.kind.trim()) {
    return undefined;
  }

  const rawId = value.id;
  const id =
    typeof rawId === "string" && rawId.trim()
      ? rawId.trim()
      : typeof rawId === "number" && Number.isFinite(rawId)
        ? rawId
        : undefined;

  return {
    kind: value.kind.trim(),
    id,
    label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : undefined,
    updatedAtMs: normalizeTimestampMs(value.updatedAtMs),
    context: isPlainRecord(value.context) ? value.context : undefined,
  } satisfies TabularFrameSourceDescriptor;
}

function resolveExplicitStatus(value: unknown): TabularFrameSourceStatus | undefined {
  return value === "loading" || value === "ready" || value === "error" ? value : undefined;
}

function normalizeStatus(
  value: unknown,
  {
    columns,
    rows,
    error,
  }: {
    columns: string[];
    rows: Array<Record<string, unknown>>;
    error?: string;
  },
): TabularFrameSourceStatus {
  const explicitStatus = resolveExplicitStatus(value);

  if (explicitStatus) {
    return explicitStatus;
  }

  if (error) {
    return "error";
  }

  if (columns.length > 0 || rows.length > 0) {
    return "ready";
  }

  return "idle";
}

function getObjectFieldDescriptor(
  descriptor: WidgetValueDescriptor | undefined,
  key: string,
) {
  if (!descriptor || descriptor.kind !== "object") {
    return undefined;
  }

  return descriptor.fields.find((field) => field.key === key)?.value;
}

function isStringLikeDescriptor(descriptor: WidgetValueDescriptor | undefined) {
  return (
    descriptor?.kind === "unknown" ||
    (descriptor?.kind === "primitive" && descriptor.primitive === "string")
  );
}

function isArrayOfStringLikeDescriptor(descriptor: WidgetValueDescriptor | undefined) {
  if (!descriptor || descriptor.kind !== "array") {
    return false;
  }

  return !descriptor.items || isStringLikeDescriptor(descriptor.items);
}

function isRowObjectLikeDescriptor(descriptor: WidgetValueDescriptor | undefined) {
  return descriptor?.kind === "unknown" || descriptor?.kind === "object";
}

function isArrayOfRowObjectsDescriptor(descriptor: WidgetValueDescriptor | undefined) {
  if (!descriptor || descriptor.kind !== "array") {
    return false;
  }

  return !descriptor.items || isRowObjectLikeDescriptor(descriptor.items);
}

function isTabularFrameFieldSchemaDescriptor(descriptor: WidgetValueDescriptor | undefined) {
  if (!descriptor || descriptor.kind !== "object") {
    return false;
  }

  return Boolean(
    isStringLikeDescriptor(getObjectFieldDescriptor(descriptor, "key")) &&
      isStringLikeDescriptor(getObjectFieldDescriptor(descriptor, "type")),
  );
}

function isArrayOfFieldSchemaDescriptors(descriptor: WidgetValueDescriptor | undefined) {
  if (!descriptor || descriptor.kind !== "array") {
    return false;
  }

  return !descriptor.items || isTabularFrameFieldSchemaDescriptor(descriptor.items);
}

function isSourceDescriptorDescriptor(descriptor: WidgetValueDescriptor | undefined) {
  if (!descriptor || descriptor.kind !== "object") {
    return false;
  }

  return isStringLikeDescriptor(getObjectFieldDescriptor(descriptor, "kind"));
}

export function resolveTabularFrameDescriptorContract(
  descriptor: WidgetValueDescriptor | undefined,
) {
  if (!descriptor || descriptor.kind !== "object") {
    return undefined;
  }

  const columnsDescriptor = getObjectFieldDescriptor(descriptor, "columns");
  const rowsDescriptor = getObjectFieldDescriptor(descriptor, "rows");

  if (
    !isArrayOfStringLikeDescriptor(columnsDescriptor) ||
    !isArrayOfRowObjectsDescriptor(rowsDescriptor)
  ) {
    return undefined;
  }

  const statusDescriptor = getObjectFieldDescriptor(descriptor, "status");
  const errorDescriptor = getObjectFieldDescriptor(descriptor, "error");
  const fieldsDescriptor = getObjectFieldDescriptor(descriptor, "fields");
  const sourceDescriptor = getObjectFieldDescriptor(descriptor, "source");

  if (statusDescriptor && !isStringLikeDescriptor(statusDescriptor)) {
    return undefined;
  }

  if (errorDescriptor && !isStringLikeDescriptor(errorDescriptor)) {
    return undefined;
  }

  if (fieldsDescriptor && !isArrayOfFieldSchemaDescriptors(fieldsDescriptor)) {
    return undefined;
  }

  if (sourceDescriptor && !isSourceDescriptorDescriptor(sourceDescriptor)) {
    return undefined;
  }

  return CORE_TABULAR_FRAME_SOURCE_CONTRACT;
}

export function coerceTabularFrameValueDescriptorContract(
  descriptor: WidgetValueDescriptor | undefined,
): WidgetValueDescriptor | undefined {
  const resolvedContract = resolveTabularFrameDescriptorContract(descriptor);

  if (!descriptor || !resolvedContract || descriptor.contract === resolvedContract) {
    return descriptor;
  }

  if (descriptor.kind === "object") {
    return {
      ...descriptor,
      contract: resolvedContract,
    };
  }

  return descriptor;
}

export function normalizeTabularFrameSource(value: unknown): TabularFrameSourceV1 | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const error =
    typeof value.error === "string" && value.error.trim() ? value.error.trim() : undefined;
  const columns = normalizeColumns(value.columns);
  const rows = normalizeRows(value.rows);

  return {
    status: normalizeStatus(value.status, {
      columns,
      rows,
      error,
    }),
    error,
    columns,
    rows,
    fields: normalizeFields(value.fields),
    source: normalizeSourceDescriptor(value.source),
  };
}
