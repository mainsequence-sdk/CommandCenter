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

export type TabularFrameFieldRole =
  | "dimension"
  | "measure"
  | "time"
  | "index"
  | "identifier";

export interface TabularFrameFieldSchema {
  key: string;
  label?: string;
  description?: string | null;
  type: TabularFrameFieldType;
  roles?: TabularFrameFieldRole[];
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

function normalizeFieldRoles(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<TabularFrameFieldRole>();
  const normalized = value.flatMap((entry) => {
    if (
      entry !== "dimension" &&
      entry !== "measure" &&
      entry !== "time" &&
      entry !== "index" &&
      entry !== "identifier"
    ) {
      return [];
    }

    if (seen.has(entry)) {
      return [];
    }

    seen.add(entry);
    return [entry];
  });

  return normalized.length > 0 ? normalized : undefined;
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
      roles: normalizeFieldRoles(entry.roles),
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

function normalizeStatus(value: unknown): TabularFrameSourceStatus {
  return value === "loading" || value === "ready" || value === "error" ? value : "idle";
}

export function normalizeTabularFrameSource(value: unknown): TabularFrameSourceV1 | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  return {
    status: normalizeStatus(value.status),
    error: typeof value.error === "string" && value.error.trim() ? value.error.trim() : undefined,
    columns: normalizeColumns(value.columns),
    rows: normalizeRows(value.rows),
    fields: normalizeFields(value.fields),
    source: normalizeSourceDescriptor(value.source),
  };
}

export function hasTabularFieldRole(
  field: Pick<TabularFrameFieldSchema, "roles"> | undefined,
  role: TabularFrameFieldRole,
) {
  return field?.roles?.includes(role) ?? false;
}
